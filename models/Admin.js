const pool = require('../config/database');
const bcrypt = require('bcrypt');

class Admin {
    static async findByUsername(username) {
        const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
        return rows[0];
    }

    static async verifyPassword(admin, password) {
        return bcrypt.compare(password, admin.password);
    }

    static async updateLastLogin(id) {
        await pool.query('UPDATE admins SET last_login = NOW() WHERE id = ?', [id]);
    }
}

module.exports = Admin;
