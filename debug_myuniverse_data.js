const db = require('./lib_login/db');

async function debugData() {
    try {
        console.log('--- 1. Checking Users Table Schema ---');
        try {
            const userCols = await db.queryDatabase('DESCRIBE Users');
            const colNames = userCols.map(c => c.Field);
            console.log('Users columns:', colNames.join(', '));
            if (!colNames.includes('username')) console.warn('WARNING: username column missing in Users!');
        } catch (e) { console.error('Error checking Users schema:', e.message); }

        console.log('\n--- 2. Checking ProjectSubmissions Schema ---');
        try {
            const projCols = await db.queryDatabase('DESCRIBE ProjectSubmissions');
            console.log('ProjectSubmissions columns:', projCols.map(c => c.Field).join(', '));
        } catch (e) { console.error('Error checking ProjectSubmissions schema:', e.message); }

        console.log('\n--- 3. Checking Data for User (Minho) ---');
        // Try to find the user likely being used (Minho or similar from context)
        const [user] = await db.queryDatabase("SELECT * FROM Users WHERE name LIKE '%민호%' OR id = 1 LIMIT 1");

        if (user) {
            console.log(`Found User: ID=${user.id}, Name=${user.name}, Username=${user.username || 'N/A'}`);

            console.log(`Checking ProjectSubmissions for UserID ${user.id}...`);
            const submissions = await db.queryDatabase('SELECT id, project_name, platform, created_at FROM ProjectSubmissions WHERE user_id = ?', [user.id]);
            console.log(`Found ${submissions.length} submissions.`);
            if (submissions.length > 0) {
                console.log('Sample submission:', submissions[0]);
            } else {
                console.log('No submissions found. Checking raw table count...');
                const [count] = await db.queryDatabase('SELECT COUNT(*) as total FROM ProjectSubmissions');
                console.log(`Total rows in ProjectSubmissions table: ${count.total}`);
            }
        } else {
            console.log('Could not find a test user (Minho).');
        }

    } catch (error) {
        console.error('Debug script failed:', error);
    }
    process.exit();
}

debugData();
