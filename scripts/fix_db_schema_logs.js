const { queryDatabase } = require('../lib_login/db');

async function fixSchema() {
    console.log('🚀 Starting DB Schema Fix for Logs...');

    try {
        // 1. Fix LearningLogs: Add platform column
        console.log('Checking LearningLogs table...');
        await queryDatabase(`
            ALTER TABLE LearningLogs 
            ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'scratch'
        `);
        console.log('✅ LearningLogs: platform column added/verified.');

        // 2. Fix MenuAccessLogs: Resize menu_name column
        console.log('Checking MenuAccessLogs table...');
        await queryDatabase(`
            ALTER TABLE MenuAccessLogs 
            MODIFY COLUMN menu_name VARCHAR(255)
        `);
        console.log('✅ MenuAccessLogs: menu_name column resized to 255.');

        console.log('🎉 DB Fix Completed Successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ DB Fix Failed:', error);
        process.exit(1);
    }
}

fixSchema();
