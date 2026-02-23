const Admin = require('../models/Admin');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Deposit = require('../models/Deposit');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');

async function getConfirmedVolumes(pool) {
    const [[confirmedDeposits]] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM deposits
         WHERE status IN ('confirmee', 'confirmée')`
    );
    const [[confirmedWithdrawals]] = await pool.query(
        `SELECT COALESCE(SUM(amount_net), 0) as total
         FROM withdrawals
         WHERE status IN ('confirmee', 'confirmée')`
    );
    return {
        depositsConfirmedTotal: Number(confirmedDeposits.total || 0),
        withdrawalsConfirmedTotal: Number(confirmedWithdrawals.total || 0)
    };
}

exports.dashboard = async (req, res) => {
    const pool = require('../config/database');
    const [[users]] = await pool.query('SELECT COUNT(*) as total FROM users');
    const [[pendingWithdrawals]] = await pool.query(
        `SELECT COUNT(*) as total
         FROM withdrawals
         WHERE status = 'en_attente' OR status IS NULL OR TRIM(status) = ''`
    );
    const [[pendingDeposits]] = await pool.query('SELECT COUNT(*) as total FROM deposits WHERE status = "en_attente"');
    const { depositsConfirmedTotal, withdrawalsConfirmedTotal } = await getConfirmedVolumes(pool);
    const totalVolume = depositsConfirmedTotal + withdrawalsConfirmedTotal;

    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        users: users.total,
        pendingWithdrawals: pendingWithdrawals.total,
        pendingDeposits: pendingDeposits.total,
        depositsConfirmedTotal,
        withdrawalsConfirmedTotal,
        totalVolume,
        csrfToken: req.csrfToken(),
        currentPage: 'dashboard'
    });
};

exports.volumes = async (req, res) => {
    const pool = require('../config/database');
    const { depositsConfirmedTotal, withdrawalsConfirmedTotal } = await getConfirmedVolumes(pool);
    const netEvolution = depositsConfirmedTotal - withdrawalsConfirmedTotal;
    res.render('admin/volumes', {
        title: 'Bilan des validations',
        depositsConfirmedTotal,
        withdrawalsConfirmedTotal,
        netEvolution,
        csrfToken: req.csrfToken(),
        currentPage: 'dashboard'
    });
};

exports.users = async (req, res) => {
    const pool = require('../config/database');
    const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.render('admin/users', {
        title: 'Gestion utilisateurs',
        users: rows,
        csrfToken: req.csrfToken(),
        currentPage: 'users'
    });
};

exports.userReferrals = async (req, res) => {
    const { phone } = req.params;
    const pool = require('../config/database');
    const [userRows] = await pool.query('SELECT phone, full_name, referral_code FROM users WHERE phone = ?', [phone]);
    if (userRows.length === 0) {
        return res.status(404).render('error', { title: 'Utilisateur introuvable', message: 'Cet utilisateur n\'existe pas.' });
    }
    const user = userRows[0];
    const referrals = await Referral.getReferrals(phone);
    res.render('admin/user-referrals', {
        title: 'Filleuls de ' + user.phone,
        user,
        referrals,
        csrfToken: req.csrfToken(),
        currentPage: 'users'
    });
};

exports.toggleUser = async (req, res) => {
    const { phone } = req.params;
    const { action } = req.query;
    try {
        if (action === 'deactivate') {
            await User.deactivate(phone);
        } else if (action === 'activate') {
            await User.activate(phone);
        }
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/users');
    }
};

exports.withdrawals = async (req, res) => {
    const withdrawals = await Withdrawal.findPending();
    res.render('admin/withdrawals', {
        title: 'Retraits en attente',
        withdrawals,
        csrfToken: req.csrfToken(),
        currentPage: 'withdrawals'
    });
};

exports.withdrawalsHistory = async (req, res) => {
    const status = req.query.status || '';
    const withdrawals = await Withdrawal.findAll(status);
    res.render('admin/withdrawals-history', {
        title: 'Historique des retraits',
        withdrawals,
        status,
        csrfToken: req.csrfToken(),
        currentPage: 'withdrawals'
    });
};

exports.confirmWithdrawal = async (req, res) => {
    const { id } = req.params;
    const adminPhone = req.session.admin.username;
    try {
        await Withdrawal.confirm(id, adminPhone);
        req.flash('success', 'Retrait confirme');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur');
    }
    res.redirect('/admin/withdrawals');
};

exports.rejectWithdrawal = async (req, res) => {
    const { id } = req.params;
    const adminPhone = req.session.admin.username;
    try {
        await Withdrawal.reject(id, adminPhone);
        req.flash('success', 'Retrait rejete et rembourse');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Erreur');
    }
    res.redirect('/admin/withdrawals');
};

exports.deposits = async (req, res) => {
    const pool = require('../config/database');
    const [rows] = await pool.query(`
        SELECT d.*, 
               COALESCE(NULLIF(d.transaction_id, ''), tx.sms_code) AS display_transaction_id
        FROM deposits d
        LEFT JOIN (
            SELECT t1.reference,
                   TRIM(SUBSTRING_INDEX(t1.description, 'Code:', -1)) AS sms_code
            FROM transactions t1
            INNER JOIN (
                SELECT reference, MAX(id) AS max_id
                FROM transactions
                WHERE type = 'recharge'
                  AND reference IS NOT NULL
                  AND reference <> ''
                  AND description LIKE '%Code:%'
                GROUP BY reference
            ) latest ON latest.max_id = t1.id
        ) tx ON tx.reference = CAST(d.id AS CHAR)
        WHERE d.status = 'en_attente'
        ORDER BY d.created_at ASC
    `);
    res.render('admin/deposits', {
        title: 'Recharges en attente',
        deposits: rows,
        csrfToken: req.csrfToken(),
        currentPage: 'deposits'
    });
};

exports.depositsHistory = async (req, res) => {
    const status = req.query.status || '';
    const pool = require('../config/database');
    const where = [];
    const params = [];
    if (status) {
        where.push('d.status = ?');
        params.push(status);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT d.*, 
                COALESCE(NULLIF(d.transaction_id, ''), tx.sms_code) AS display_transaction_id
         FROM deposits d
         LEFT JOIN (
             SELECT t1.reference,
                    TRIM(SUBSTRING_INDEX(t1.description, 'Code:', -1)) AS sms_code
             FROM transactions t1
             INNER JOIN (
                 SELECT reference, MAX(id) AS max_id
                 FROM transactions
                 WHERE type = 'recharge'
                   AND reference IS NOT NULL
                   AND reference <> ''
                   AND description LIKE '%Code:%'
                 GROUP BY reference
             ) latest ON latest.max_id = t1.id
         ) tx ON tx.reference = CAST(d.id AS CHAR)
         ${clause}
         ORDER BY d.created_at DESC`,
        params
    );
    res.render('admin/deposits-history', {
        title: 'Historique des recharges',
        deposits: rows,
        status,
        csrfToken: req.csrfToken(),
        currentPage: 'deposits'
    });
};

exports.confirmDeposit = async (req, res) => {
    const { id } = req.params;
    const adminPhone = req.session.admin.username;
    const connection = await require('../config/database').getConnection();
    try {
        await connection.beginTransaction();
        const [depositRows] = await connection.query('SELECT * FROM deposits WHERE id = ? AND status = "en_attente"', [id]);
        if (depositRows.length === 0) throw new Error('Depot introuvable');
        const deposit = depositRows[0];
        const reference = deposit.transaction_id || `ADMIN-${id}-${Date.now()}`;

        await connection.query('UPDATE users SET balance = balance + ? WHERE phone = ?', [deposit.amount, deposit.user_phone]);

        const [depositsCount] = await connection.query(
            'SELECT COUNT(*) as count FROM deposits WHERE user_phone = ? AND status IN ("confirmée", "confirmee") AND id != ?',
            [deposit.user_phone, id]
        );
        const [userRows] = await connection.query('SELECT referred_by FROM users WHERE phone = ?', [deposit.user_phone]);
        const user = userRows[0];

        if (depositsCount[0].count === 0 && user.referred_by) {
            const commission = Number(deposit.amount) * 0.30;
            await connection.query(
                'UPDATE users SET balance = balance + ?, total_commissions = total_commissions + ? WHERE phone = ?',
                [commission, commission, user.referred_by]
            );
            await Referral.updateBonus(user.referred_by, deposit.user_phone, commission);
        }

        await connection.query(
            'UPDATE deposits SET status = "confirmee", confirmed_by = ?, confirmed_at = NOW() WHERE id = ?',
            [adminPhone, id]
        );
        const [txUpdate] = await connection.query(
            `UPDATE transactions
             SET status = 'confirmee'
             WHERE type = 'recharge' AND reference = ?`,
            [String(id)]
        );
        if (!txUpdate || txUpdate.affectedRows === 0) {
            await connection.query(
                `INSERT INTO transactions (user_phone, type, amount, description, status, reference)
                 VALUES (?, 'recharge', ?, ?, 'confirmee', ?)`,
                [deposit.user_phone, deposit.amount, `Recharge ${deposit.method}`, reference]
            );
        }
        await connection.commit();
        req.flash('success', 'Recharge confirmee');
    } catch (err) {
        await connection.rollback();
        console.error(err);
        if (err && err.code === 'ER_LOCK_WAIT_TIMEOUT') {
            req.flash('error', 'Temps d\'attente depasse. Veuillez reessayer.');
        } else {
            req.flash('error', 'Erreur');
        }
    } finally {
        connection.release();
    }
    res.redirect('/admin/deposits');
};

exports.rejectDeposit = async (req, res) => {
    const { id } = req.params;
    const adminPhone = req.session.admin.username;
    const connection = await require('../config/database').getConnection();
    try {
        await connection.beginTransaction();
        const [depositRows] = await connection.query(
            'SELECT * FROM deposits WHERE id = ? AND status = "en_attente"',
            [id]
        );
        if (depositRows.length === 0) throw new Error('Depot introuvable');
        const deposit = depositRows[0];

        await connection.query(
            'UPDATE deposits SET status = "echec", confirmed_by = ?, confirmed_at = NOW() WHERE id = ?',
            [adminPhone, id]
        );

        const [txUpdateByRef] = await connection.query(
            `UPDATE transactions
             SET status = 'echec'
             WHERE type = 'recharge' AND reference = ?`,
            [String(id)]
        );

        if (!txUpdateByRef || txUpdateByRef.affectedRows === 0) {
            await connection.query(
                `UPDATE transactions
                 SET status = 'echec'
                 WHERE id = (
                     SELECT id FROM (
                         SELECT id
                         FROM transactions
                         WHERE user_phone = ? AND type = 'recharge' AND status = 'en_attente'
                         ORDER BY created_at DESC
                         LIMIT 1
                     ) t
                 )`,
                [deposit.user_phone]
            );
        }

        await connection.commit();
        req.flash('success', 'Recharge rejetee');
    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.flash('error', 'Erreur');
    } finally {
        connection.release();
    }
    res.redirect('/admin/deposits');
};

exports.purchases = async (req, res) => {
    const pool = require('../config/database');
    const [rows] = await pool.query(`
        SELECT p.*, u.phone as user_phone, u.full_name, pr.name as product_name
        FROM purchases p
        JOIN users u ON p.user_phone = u.phone
        JOIN products pr ON p.product_id = pr.id
        ORDER BY p.created_at DESC
        LIMIT 200
    `);
    res.render('admin/purchases', {
        title: 'Achats',
        purchases: rows,
        csrfToken: req.csrfToken(),
        currentPage: 'purchases'
    });
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};
