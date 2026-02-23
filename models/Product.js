const pool = require('../config/database');

class Product {
    static async findAllActive() {
        const [rows] = await pool.query('SELECT * FROM products WHERE is_active = 1 ORDER BY price');
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ? AND is_active = 1', [id]);
        return rows[0];
    }
}

module.exports = Product;
