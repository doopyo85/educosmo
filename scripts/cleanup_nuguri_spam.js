const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../lib_login/db');

async function cleanupSpam() {
    try {
        console.log('🗑️ Starting cleanup of spam messages...');

        const targetUsers = ['류태훈', '이하윤'];

        const result = await db.queryDatabase(
            `DELETE FROM nuguritalk_posts WHERE author IN (?, ?)`,
            targetUsers
        );

        console.log(`✅ Cleanup complete.`);
        console.log(`- Deleted Rows: ${result.affectedRows}`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error cleaning up spam:', err);
        process.exit(1);
    }
}

cleanupSpam();
