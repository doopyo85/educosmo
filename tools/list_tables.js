const db = require('../lib_login/db');

async function listTables() {
    try {
        const result = await db.queryDatabase('SHOW TABLES');
        console.log('Tables in database:');
        result.forEach(row => {
            console.log(Object.values(row)[0]);
        });
    } catch (error) {
        console.error('Error listing tables:', error);
    }
}

listTables();
