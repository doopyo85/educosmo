require('dotenv').config({ path: 'c:\\Users\\User\\Documents\\pioneer\\educodingnplay\\.env' }); // Adjust path if needed, or just .env in current dir
const db = require('../lib_login/db');

async function listTables() {
    // If db.pool doesn't exist yet, db.queryDatabase initializes it. 
    // But it needs process.env variables.

    // Let's check if .env exists first?
    // I will try to read .env first to make sure I can load it.

    try {
        const result = await db.queryDatabase('SHOW TABLES');
        console.log('Tables:');
        result.forEach(row => {
            console.log(Object.values(row)[0]);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

listTables();
