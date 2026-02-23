const pool = require('../config/database');

exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

exports.isActive = async (req, res, next) => {
    if (!req.session.user) return next();
    const [rows] = await pool.query('SELECT is_active FROM users WHERE phone = ?', [req.session.user.phone]);
    if (rows.length === 0 || rows[0].is_active === 0) {
        req.session.destroy();
        return res.redirect('/login?inactive=1');
    }
    next();
};
