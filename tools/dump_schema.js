require('dotenv').config();
const { queryDatabase } = require('../lib_login/db');

async function dumpSchema() {
    try {
        console.log('Fetching database schema...');

        // 1. Get all tables
        const tablesResult = await queryDatabase("SHOW TABLES");
        const tables = tablesResult.map(row => Object.values(row)[0]);

        console.log(`Found ${tables.length} tables:`, tables.join(', '));
        console.log('------------------------------------------------');

        // 2. Describe each table
        for (const table of tables) {
            console.log(`\nTable: [${table}]`);
            const columns = await queryDatabase(`DESCRIBE ${table}`);
            columns.forEach(col => {
                console.log(` - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Extra}`);
            });
        }

    } catch (error) {
        console.error('Error dumping schema:', error);
    }
    process.exit();
}

dumpSchema();
