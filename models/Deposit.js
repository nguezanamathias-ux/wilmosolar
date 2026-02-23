const pool = require('../config/database');

class Deposit {
    static async create(userPhone, amount, method, paymentPhone) {
        const [result] = await pool.query(
            `INSERT INTO deposits (user_phone, amount, method, payment_phone, status)
             VALUES (?, ?, ?, ?, 'en_attente')`,
            [userPhone, amount, method, paymentPhone]
        );
        return result;
    }
}

module.exports = Deposit;
