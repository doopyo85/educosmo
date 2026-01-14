const db = require('../lib_login/db');

async function checkTables() {
    try {
        console.log('Using app database configuration...');

        const tablesToCheck = ['ContentMap', 'LearningLogs', 'Users', 'UserStorageUsage'];

        for (const table of tablesToCheck) {
            try {
                // Using the specific queryDatabase function from db module
                const rows = await db.queryDatabase(`SELECT COUNT(*) as count FROM ${table}`);

                if (rows && rows.length > 0) {
                    console.log(`✅ Table '${table}' exists. Row count: ${rows[0].count}`);

                    if (table === 'ContentMap' && rows[0].count > 0) {
                        const sample = await db.queryDatabase(`SELECT * FROM ContentMap LIMIT 1`);
                        console.log('   Sample ContentMap row:', sample[0]);
                    }
                } else {
                    console.log(`❓ Table '${table}' returned no rows or unexpected format.`);
                }

            } catch (err) {
                // Determine if it is a missing table error
                if (err.message && err.message.includes("doesn't exist")) {
                    console.error(`❌ Table '${table}' DOES NOT EXIST.`);
                } else {
                    console.error(`⚠️ Error checking '${table}':`, err.message);
                }
            }
        }

    } catch (error) {
        console.error('Script execution failed:', error);
    } finally {
        // We might need to force exit since db pool might keep event loop open
        setTimeout(() => process.exit(0), 1000);
    }
}

checkTables();
