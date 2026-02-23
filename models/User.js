const pool = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    static async findByPhone(phone) {
        const [rows] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
        return rows[0];
    }

    static async findByReferralCode(code) {
        const [rows] = await pool.query('SELECT phone FROM users WHERE referral_code = ?', [code]);
        return rows[0];
    }

    static async create({ phone, password, full_name = '', referred_by = null }) {
        const hashedPassword = await bcrypt.hash(password, 12);
        const referral_code = 'WMS' + phone.slice(-4) + Math.random().toString(36).substring(2, 6).toUpperCase();
        const [result] = await pool.query(
            `INSERT INTO users (phone, password, full_name, referred_by, referral_code)
             VALUES (?, ?, ?, ?, ?)`,
            [phone, hashedPassword, full_name, referred_by, referral_code]
        );
        return result;
    }

    static async updateBalance(phone, amount) {
        await pool.query('UPDATE users SET balance = balance + ? WHERE phone = ?', [amount, phone]);
    }

    static async updateEarnings(phone, amount) {
        await pool.query('UPDATE users SET total_earnings = total_earnings + ? WHERE phone = ?', [amount, phone]);
    }

    static async updateCommission(phone, amount) {
        await pool.query('UPDATE users SET total_commissions = total_commissions + ? WHERE phone = ?', [amount, phone]);
    }

    static async deactivate(phone) {
        await pool.query('UPDATE users SET is_active = 0 WHERE phone = ?', [phone]);
    }

    static async activate(phone) {
        await pool.query('UPDATE users SET is_active = 1 WHERE phone = ?', [phone]);
    }
}

module.exports = User;
