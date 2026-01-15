const db = require('./lib_login/db');

async function checkSchema() {
    try {
        const rows = await db.queryDatabase('DESCRIBE ContentMap');
        console.log('ContentMap Schema:', rows);
    } catch (e) {
        console.error('Error describing ContentMap:', e.message);
    }
    process.exit();
}

checkSchema();
