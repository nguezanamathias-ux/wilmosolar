const pool = require('../config/database');

class Purchase {
    static async create(userPhone, productId, amountPaid, dailyRate, connection = null) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 90);
        const nextPayout = new Date(startDate);
        nextPayout.setDate(nextPayout.getDate() + 1);

        const executor = connection || pool;
        const [result] = await executor.query(
            `INSERT INTO purchases (user_phone, product_id, amount_paid, daily_rate, start_date, end_date, next_payout)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userPhone, productId, amountPaid, dailyRate, startDate, endDate, nextPayout]
        );
        return result;
    }

    static async findActiveByUser(userPhone) {
        const [rows] = await pool.query(
            `SELECT p.*, pr.name, pr.price, pr.image_url, pr.duration_days
             FROM purchases p
             JOIN products pr ON p.product_id = pr.id
             WHERE p.user_phone = ? AND p.status = 'active'
             ORDER BY p.created_at DESC`,
            [userPhone]
        );
        return rows;
    }

    static async countByUser(userPhone) {
        const [rows] = await pool.query('SELECT COUNT(*) as total FROM purchases WHERE user_phone = ?', [userPhone]);
        return rows[0].total;
    }

    static async isFirstPurchase(userPhone, connection = null) {
        const executor = connection || pool;
        const [rows] = await executor.query('SELECT COUNT(*) as total FROM purchases WHERE user_phone = ?', [userPhone]);
        return rows[0].total === 0;
    }
}

module.exports = Purchase;
