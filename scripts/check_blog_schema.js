const { queryDatabase } = require('../lib_login/db');

async function checkSchema() {
    try {
        console.log('Checking columns for blog_posts in educodingnplay...');
        const columns = await queryDatabase(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'educodingnplay' 
            AND TABLE_NAME = 'blog_posts'
        `);
        console.log('Columns:', columns.map(c => c.COLUMN_NAME).join(', '));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
