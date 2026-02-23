const cron = require('node-cron');
const pool = require('../config/database');

exports.startCronJobs = () => {
    cron.schedule('* * * * *', async () => {
        console.log('Cron: paiements journaliers...');
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [rows] = await connection.query(`
                SELECT p.id, p.user_phone, p.daily_rate, p.next_payout, p.end_date
                FROM purchases p
                WHERE p.status = 'active'
                  AND p.next_payout <= NOW()
                LIMIT 500
            `);

            for (const purchase of rows) {
                if (purchase.next_payout > purchase.end_date) {
                    await connection.query('UPDATE purchases SET status = ? WHERE id = ?', ['expired', purchase.id]);
                    continue;
                }

                await connection.query(
                    'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ? WHERE phone = ?',
                    [purchase.daily_rate, purchase.daily_rate, purchase.user_phone]
                );

                await connection.query(
                    `INSERT INTO transactions (user_phone, type, amount, description, status)
                     VALUES (?, 'gain_produit', ?, ?, 'confirmee')`,
                    [purchase.user_phone, purchase.daily_rate, `Gain produit #${purchase.id}`]
                );

                await connection.query(
                    'UPDATE purchases SET next_payout = DATE_ADD(next_payout, INTERVAL 1 DAY) WHERE id = ?',
                    [purchase.id]
                );
            }

            await connection.commit();
            console.log(`Cron: ${rows.length} paiements effectues.`);
        } catch (error) {
            await connection.rollback();
            console.error('Erreur cron paiements:', error);
        } finally {
            connection.release();
        }
    });
};
