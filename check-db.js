require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const connection = await pool.getConnection();

        console.log('✅ Connexion à la base de données réussie');
        
        // Vérifier la table admins
        const [admins] = await connection.query('SELECT * FROM admins');
        console.log('\n📊 Admins en base de données:');
        console.table(admins);

        // Vérifier la structure de la table
        const [columns] = await connection.query('DESCRIBE admins');
        console.log('\n📋 Structure de la table admins:');
        console.table(columns);

        await connection.release();
        await pool.end();
    } catch (err) {
        console.error('❌ Erreur:', err.message);
    }
})();
