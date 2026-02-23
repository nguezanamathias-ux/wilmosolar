const pool = require('../config/database');

class Withdrawal {
    static async create(userPhone, amountRequested, connection = null) {
        const fee = amountRequested * 0.15;
        const amountNet = amountRequested - fee;
        const executor = connection || pool;
        const [result] = await executor.query(
            `INSERT INTO withdrawals (user_phone, amount_requested, fee, amount_net, status)
             VALUES (?, ?, ?, ?, 'en_attente')`,
            [userPhone, amountRequested, fee, amountNet]
        );
        return result;
    }

    static async findPending() {
        const [rows] = await pool.query(
            `SELECT w.id, w.user_phone, w.amount_requested, w.fee, w.amount_net,
                    CASE
                        WHEN w.status IS NULL OR TRIM(w.status) = '' THEN 'en_attente'
                        ELSE w.status
                    END AS status,
                    w.processed_by, w.processed_at, w.created_at, u.full_name
             FROM withdrawals w
             JOIN users u ON w.user_phone = u.phone
             WHERE w.status = 'en_attente' OR w.status IS NULL OR TRIM(w.status) = ''
             ORDER BY w.created_at ASC`
        );
        return rows;
    }

    static async findAll(status = '') {
        const where = [];
        const params = [];
        if (status) {
            if (status === 'en_attente') {
                where.push(`(w.status = 'en_attente' OR w.status IS NULL OR TRIM(w.status) = '')`);
            } else {
                where.push('w.status = ?');
                params.push(status);
            }
        }
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await pool.query(
            `SELECT w.id, w.user_phone, w.amount_requested, w.fee, w.amount_net,
                    CASE
                        WHEN w.status IS NULL OR TRIM(w.status) = '' THEN 'en_attente'
                        ELSE w.status
                    END AS status,
                    w.processed_by, w.processed_at, w.created_at, u.full_name
             FROM withdrawals w
             JOIN users u ON w.user_phone = u.phone
             ${clause}
             ORDER BY w.created_at DESC`,
            params
        );
        return rows;
    }

    static async confirm(id, adminPhone) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [withdrawalRows] = await connection.query(
                'SELECT user_phone FROM withdrawals WHERE id = ? AND status = "en_attente"',
                [id]
            );
            if (withdrawalRows.length === 0) throw new Error('Retrait introuvable');

            const [result] = await connection.query(
                `UPDATE withdrawals
                 SET status = 'confirmee', processed_by = ?, processed_at = NOW()
                 WHERE id = ? AND status = 'en_attente'`,
                [adminPhone, id]
            );

            await connection.query(
                `UPDATE transactions
                 SET status = 'confirmee'
                 WHERE reference = ? AND type = 'retrait'`,
                [id]
            );
            await connection.query(
                `UPDATE transactions
                 SET status = 'confirmee'
                 WHERE id = (
                     SELECT id FROM (
                         SELECT id FROM transactions
                         WHERE user_phone = ? AND type = 'retrait' AND status = 'en_attente'
                         ORDER BY created_at DESC
                         LIMIT 1
                     ) t
                 )`,
                [withdrawalRows[0].user_phone]
            );

            await connection.commit();
            return result;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async reject(id, adminPhone) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [withdrawal] = await connection.query(
                'SELECT user_phone, amount_requested FROM withdrawals WHERE id = ?',
                [id]
            );
            if (withdrawal.length === 0) throw new Error('Retrait introuvable');
            const { user_phone, amount_requested } = withdrawal[0];

            await connection.query('UPDATE users SET balance = balance + ? WHERE phone = ?', [amount_requested, user_phone]);
            await connection.query(
                'UPDATE withdrawals SET status = "echec", processed_by = ?, processed_at = NOW() WHERE id = ?',
                [adminPhone, id]
            );
            await connection.query(
                `UPDATE transactions
                 SET status = 'echec'
                 WHERE reference = ? AND type = 'retrait'`,
                [id]
            );
            await connection.query(
                `UPDATE transactions
                 SET status = 'echec'
                 WHERE id = (
                     SELECT id FROM (
                         SELECT id FROM transactions
                         WHERE user_phone = ? AND type = 'retrait' AND status = 'en_attente'
                         ORDER BY created_at DESC
                         LIMIT 1
                     ) t
                 )`,
                [user_phone]
            );
            await connection.query(
                `INSERT INTO transactions (user_phone, type, amount, description, status, reference)
                 VALUES (?, 'frais', ?, CONCAT('Remboursement retrait #', ?), 'echec', ?)`,
                [user_phone, amount_requested, String(id), String(id)]
            );
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = Withdrawal;
