const pool = require('../config/database');

exports.isAdmin = async (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect('/login');
    }

    try {
        const [rows] = await pool.query('SELECT id FROM admins WHERE id = ?', [req.session.admin.id]);
        if (rows.length === 0) {
            req.session.destroy(() => {
                res.redirect('/login');
            });
            return;
        }
    } catch (err) {
        console.error('[ERROR isAdmin]', err);
        return res.render('error', { title: 'Erreur', message: 'Erreur de verification admin' });
    }

    next();
};
