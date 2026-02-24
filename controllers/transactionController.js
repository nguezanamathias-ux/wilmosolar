const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const { validationResult } = require('express-validator');
const { notifyAdmin } = require('../utils/notifyAdmin');

exports.deposit = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { amount, method, payment_phone } = req.body;
    const userPhone = req.session.user.phone;

    try {
        const result = await Deposit.create(userPhone, amount, method, payment_phone);
        const depositId = result.insertId;
        const orangeCodeToName = {
            '#150*11*688602320#': 'ISMAILA',
            '#150*11*640516009#': 'NARAYEM'
        };
        const orangeCodes = Object.keys(orangeCodeToName);
        const mtnNumbers = ['652251784', '681721137'];
        const randomOrangeCode = orangeCodes[Math.floor(Math.random() * orangeCodes.length)];
        const randomMtnNumber = mtnNumbers[Math.floor(Math.random() * mtnNumbers.length)];
        const ussdCode = method === 'orange_money' ? randomOrangeCode : '*126#';
        const transferNumber = method === 'mobile_money' ? randomMtnNumber : null;
        const orangeRecipientName = method === 'orange_money' ? orangeCodeToName[randomOrangeCode] : null;

        try { await notifyAdmin('recharge', { userPhone, amount, id: depositId }); } catch (e) { console.error(e); }

        res.json({
            success: true,
            depositId,
            amount,
            method,
            paymentPhone: payment_phone,
            ussdCode,
            transferNumber,
            orangeRecipientName
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la demande' });
    }
};

exports.ussdConfirm = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { deposit_id, amount, method, payment_phone, transaction_code } = req.body;
    const userPhone = req.session.user.phone;

    try {
        const depositIdNum = parseInt(deposit_id, 10);
        const smsCode = String(transaction_code || '').trim();
        if (!Number.isInteger(depositIdNum) || depositIdNum <= 0) {
            return res.status(400).json({ error: 'ID de depot invalide' });
        }
        if (smsCode.length < 3) {
            return res.status(400).json({ error: 'Code de confirmation invalide' });
        }

        const pool = require('../config/database');
        const [updateResult] = await pool.query(
            'UPDATE deposits SET transaction_id = ? WHERE id = ? AND user_phone = ? AND status = "en_attente"',
            [smsCode, depositIdNum, userPhone]
        );
        if (!updateResult || updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Demande introuvable ou deja traitee. Rechargez la page et recommencez.' });
        }

        await Transaction.create(
            userPhone,
            'recharge',
            amount,
            `Recharge ${method} - Code: ${smsCode}`,
            'en_attente',
            String(depositIdNum)
        );

        try { await notifyAdmin('recharge (confirmation)', { userPhone, amount, id: depositIdNum }); } catch (e) { console.error(e); }

        req.flash('success', `Recharge de ${amount} FCFA demandee. En attente de validation.`);
        res.json({ success: true, redirectTo: '/user/dashboard' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la confirmation' });
    }
};

exports.withdrawal = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errMsg = errors.array()[0].msg;
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
            return res.status(400).json({ error: errMsg });
        }

        req.flash('error', errMsg);
        return res.redirect('/user/dashboard');
    }

    const { amount } = req.body;
    const userPhone = req.session.user.phone;
    const amountNum = parseFloat(amount);
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Douala' }));
    const day = now.getDay();
    const hour = now.getHours();
    const isOpenDay = day >= 1 && day <= 5;
    const isOpenHour = hour >= 10 && hour < 17;

    if (!isOpenDay || !isOpenHour) {
        const msg = 'Les retraits sont traites uniquement de 10h a 17h, du lundi au vendredi.';
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
            return res.status(400).json({ error: msg });
        }
        req.flash('error', msg);
        return res.redirect('/user/dashboard');
    }

    if (amountNum < 2500) {
        const msg = 'Le montant minimum de retrait est 2 500 FCFA.';
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
            return res.status(400).json({ error: msg });
        }
        req.flash('error', msg);
        return res.redirect('/user/dashboard');
    }

    const connection = await require('../config/database').getConnection();
    try {
        await connection.beginTransaction();

        const [userRows] = await connection.query('SELECT balance FROM users WHERE phone = ? FOR UPDATE', [userPhone]);
        const user = userRows[0];
        const userBalanceNum = Number(user.balance) || 0;
        if (userBalanceNum < amountNum) throw new Error('Solde insuffisant');

        await connection.query('UPDATE users SET balance = balance - ? WHERE phone = ?', [amountNum, userPhone]);

        const wdRes = await Withdrawal.create(userPhone, amountNum, connection);

        await connection.query(
            `INSERT INTO transactions (user_phone, type, amount, description, status, reference)
             VALUES (?, 'retrait', ?, ?, 'en_attente', ?)`,
            [userPhone, -amountNum, `Demande de retrait de ${amountNum} F`, wdRes.insertId]
        );

        try { await notifyAdmin('retrait', { userPhone, amount: amountNum, id: wdRes.insertId }); } catch (e) { console.error(e); }

        await connection.commit();

        req.session.user.balance = Number(userBalanceNum - amountNum);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
            return res.json({ success: true, message: 'Demande de retrait envoyee', balance: req.session.user.balance });
        }

        req.flash('success', 'Demande de retrait envoyee');
        res.redirect('/user/dashboard');
    } catch (err) {
        await connection.rollback();
        console.error(err);
        const errMsg = err.message || 'Erreur';
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
            return res.status(500).json({ error: errMsg });
        }

        req.flash('error', errMsg);
        res.redirect('/user/dashboard');
    } finally {
        connection.release();
    }
};
