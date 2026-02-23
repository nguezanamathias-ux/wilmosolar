const pool = require('../config/database');

class Referral {
    static async create(referrerPhone, referredPhone) {
        const [result] = await pool.query(
            `INSERT INTO referrals (referrer_phone, referred_phone) VALUES (?, ?)`,
            [referrerPhone, referredPhone]
        );
        return result;
    }

    static async getReferrals(referrerPhone) {
        const [rows] = await pool.query(
            `SELECT r.*, u.created_at, u.full_name
             FROM referrals r
             JOIN users u ON r.referred_phone = u.phone
             WHERE r.referrer_phone = ?
             ORDER BY u.created_at DESC`,
            [referrerPhone]
        );
        return rows;
    }

    static async updateBonus(referrerPhone, referredPhone, bonus) {
        await pool.query(
            `UPDATE referrals SET bonus_earned = bonus_earned + ?
             WHERE referrer_phone = ? AND referred_phone = ?`,
            [bonus, referrerPhone, referredPhone]
        );
    }

    static async getReferralsWithPurchase(referrerPhone) {
        const [rows] = await pool.query(
            `SELECT u.phone, u.created_at,
                    MIN(p.amount_paid) as first_purchase_amount,
                    ROUND(MIN(p.amount_paid) * 0.3, 2) as bonus,
                    p.created_at as purchase_date,
                    p.product_id
             FROM referrals r
             JOIN users u ON r.referred_phone = u.phone
             JOIN purchases p ON u.phone = p.user_phone
             WHERE r.referrer_phone = ?
             GROUP BY u.phone, p.id`,
            [referrerPhone]
        );
        return rows;
    }
}

module.exports = Referral;
