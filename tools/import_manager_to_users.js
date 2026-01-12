const XLSX = require('xlsx');
const path = require('path');
const { queryDatabase } = require('../lib_login/db');

async function importUsers() {
    console.log('🚀 Starting import from manager.xlsx...');

    try {
        // 1. Read Excel File
        const workbook = XLSX.readFile('docs/content_sample/manager.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Read as array of arrays to handle headers manually if needed, or just sheet_to_json
        // Using sheet_to_json to get objects keyed by header
        const rawData = XLSX.utils.sheet_to_json(sheet);

        console.log(`📊 Found ${rawData.length} rows in Excel.`);

        let successCount = 0;
        let failCount = 0;

        for (const row of rawData) {
            try {
                // 2. Data Cleaning & Mapping
                // Map keys based on inspection (assuming headers match DB columns exactly)
                // Clean values: trim strings, handle 'NULL' string

                const user = {};
                for (const [key, value] of Object.entries(row)) {
                    let cleanedValue = value;
                    if (typeof value === 'string') {
                        cleanedValue = value.trim();
                        if (cleanedValue === 'NULL') cleanedValue = null;
                    }
                    user[key.trim()] = cleanedValue;
                }

                // Construct INSERT query
                // We use INSERT IGNORE to skip duplicates based on PRIMARY KEY (id)
                // Columns: id, userID, password, email, name, phone, birthdate, role, subscription_status, subscription_expiry, created_at, center_id

                const columns = Object.keys(user);
                const values = Object.values(user);

                const placeholders = values.map(() => '?').join(', ');
                const sql = `INSERT IGNORE INTO Users (${columns.join(', ')}) VALUES (${placeholders})`;

                await queryDatabase(sql, values);
                successCount++;

                if (successCount % 10 === 0) process.stdout.write('.');

            } catch (err) {
                console.error(`\n❌ Error inserting row: ${JSON.stringify(row)}`, err.message);
                failCount++;
            }
        }

        console.log('\n✅ Import completed.');
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);

    } catch (err) {
        console.error('❌ Fatal error:', err);
    } finally {
        process.exit(0);
    }
}

importUsers();
