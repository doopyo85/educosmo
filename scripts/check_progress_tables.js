const db = require('../lib_login/db');

async function checkTables() {
    try {
        console.log('--- Checking Database Tables ---');

        // 1. List all tables
        const tables = await db.queryDatabase('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Tables found:', tableNames);

        // 2. Check specific tables
        const targetTables = ['Users', 'LearningLogs', 'ContentMap'];

        for (const table of targetTables) {
            if (tableNames.includes(table)) {
                const count = await db.queryDatabase(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`Table [${table}]: ${count[0].count} rows`);

                if (table === 'ContentMap' && count[0].count > 0) {
                    const sample = await db.queryDatabase(`SELECT * FROM ${table} LIMIT 5`);
                    console.log(`[${table}] Sample Data:`, sample);
                }
            } else {
                console.log(`❌ Table [${table}] NOT FOUND!`);
            }
        }

    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        process.exit();
    }
}

checkTables();
