const pool = require('../config/database');

class Transaction {
    static async create(userPhone, type, amount, description, status = 'confirmee', reference = null) {
        const [result] = await pool.query(
            `INSERT INTO transactions (user_phone, type, amount, description, status, reference)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userPhone, type, amount, description, status, reference]
        );
        return result;
    }

    static async updateStatusByReference(reference, type, status) {
        const [result] = await pool.query(
            `UPDATE transactions
             SET status = ?
             WHERE reference = ? AND type = ?`,
            [status, reference, type]
        );
        return result;
    }

    static async updateLatestByUserAndType(userPhone, type, status) {
        const [result] = await pool.query(
            `UPDATE transactions
             SET status = ?
             WHERE id = (
                 SELECT id FROM (
                     SELECT id FROM transactions
                     WHERE user_phone = ? AND type = ?
                     ORDER BY created_at DESC
                     LIMIT 1
                 ) t
             )`,
            [status, userPhone, type]
        );
        return result;
    }

    static async findByUser(userPhone, limit = 50, offset = 0, filters = {}) {
        const where = ['user_phone = ?'];
        const params = [userPhone];

        if (filters.type) {
            where.push('type = ?');
            params.push(filters.type);
        }
        if (filters.status) {
            where.push('status = ?');
            params.push(filters.status);
        }

        params.push(limit, offset);

        const [rows] = await pool.query(
            `SELECT * FROM transactions
             WHERE ${where.join(' AND ')}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            params
        );
        return rows;
    }

    static async countByUser(userPhone, filters = {}) {
        const where = ['user_phone = ?'];
        const params = [userPhone];

        if (filters.type) {
            where.push('type = ?');
            params.push(filters.type);
        }
        if (filters.status) {
            where.push('status = ?');
            params.push(filters.status);
        }

        const [[row]] = await pool.query(
            `SELECT COUNT(*) as total FROM transactions WHERE ${where.join(' AND ')}`,
            params
        );
        return row.total || 0;
    }
}

module.exports = Transaction;
