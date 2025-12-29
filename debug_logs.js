const db = require('./lib_login/db');

async function debugLogs() {
    try {
        console.log('Querying UserActivityLogs for user_id = 112...');
        const logs = await db.queryDatabase(`
            SELECT * FROM UserActivityLogs 
            WHERE user_id = 112 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.log(JSON.stringify(logs, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debugLogs();
