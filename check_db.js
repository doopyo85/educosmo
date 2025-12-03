const { queryDatabase } = require('./lib_login/db');

async function checkSchema() {
    try {
        console.log('Checking tables...');
        const tables = await queryDatabase("SHOW TABLES LIKE 'board_%'");
        console.log('Tables:', tables);

        console.log('\nChecking board_posts columns...');
        const columns = await queryDatabase("DESCRIBE board_posts");
        console.log('Columns:', columns.map(c => c.Field));

    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

checkSchema();
