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

        const newPasswordHash = '$2b$12$IYI5CBLwbRL2qD3O38XsOOLrn6.EsDfr1o8yS.LX.mkdyaYm.AGqq';
        
        const [result] = await connection.query(
            'UPDATE admins SET password =  WHERE username = ',
            [newPasswordHash, 'admin']
        );

        if (result.affectedRows > 0) {
            console.log('✅ Mot de passe admin mises à jour avec succès!');
            console.log('\nIdentifiants de connexion:');
            console.log('  Username: admin');
            console.log('  Password: Admin@12345');
        } else {
            console.log('❌ Aucun admin trouvé avec le username "admin"');
        }

        await connection.release();
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Erreur:', err.message);
        process.exit(1);
    }
})();
