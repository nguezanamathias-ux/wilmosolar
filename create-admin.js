require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        const connection = await pool.getConnection();

        // Vérifier la structure de la table
        console.log('Vérification de la table admins...');
        const [columns] = await connection.query('DESCRIBE admins');
        console.log('Colonnes:', columns.map(c => c.Field).join(', '));

        // Paramètres d'accès admin
        const username = 'admin';
        const password = 'Admin@12345'; // Changez ce mot de passe!
        
        // Vérifier si l'admin existe déjà
        const [existing] = await connection.query('SELECT * FROM admins WHERE username = ', [username]);
        
        if (existing.length > 0) {
            console.log('❌ Un administrateur avec le username "' + username + '" existe déjà');
            const hashedPassword = await bcrypt.hash(password, 12);
            console.log('\nPour mettre à jour le mot de passe, exécutez:');
            console.log('UPDATE admins SET password = "' + hashedPassword + '" WHERE username = "' + username + '"');
        } else {
            // Créer un nouvel administrateur
            const hashedPassword = await bcrypt.hash(password, 12);
            
            await connection.query(
                'INSERT INTO admins (username, password) VALUES (, )',
                [username, hashedPassword]
            );
            
            console.log('✅ Administrateur créé avec succès!');
            console.log('\nCredentials:');
            console.log('Username: ' + username);
            console.log('Password: ' + password);
            console.log('\n⚠️  IMPORTANT: Changez ce mot de passe après la première connexion!');
        }

        await connection.release();
        await pool.end();
        return process.exit(0);
    } catch (err) {
        console.error('❌ Erreur:', err.message);
        return process.exit(1);
    }
})();
