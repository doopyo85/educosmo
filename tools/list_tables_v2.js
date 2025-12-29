const mysql = require('mysql2/promise');

async function listTables() {
    try {
        const connection = await mysql.createConnection({
            host: 'database-1.cte6iy2wqmcn.ap-northeast-2.rds.amazonaws.com',
            user: 'codingpioneer',
            password: 'codingpioneer_password', // PREVIOUSLY KNOWN / ASSUMED or I need to find it. 
            // Wait, I don't have the password. I shouldn't guess.
            // The logs don't show the password.

            // ALTERNATIVE: Use the existing db module which has the config loaded!
            // But why did tools/list_tables.js fail? 
            // Because it didn't load dotenv config.

            // Let's try loading dotenv first.

            database: 'educodingnplay',
            port: 3306
        });

        // ...
    } catch (e) {
        console.error(e);
    }
}
