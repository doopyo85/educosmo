const { queryDatabase } = require('../lib_login/db');

async function checkSchema() {
    try {
        console.log('Checking board_posts schema...');
        const columns = await queryDatabase('DESCRIBE board_posts');
        console.log(columns.map(c => `${c.Field} (${c.Type})`).join('\n'));

        console.log('\nChecking Pong2Users table...');
        try {
            const users = await queryDatabase('DESCRIBE Pong2Users');
            console.log(users.map(c => `${c.Field} (${c.Type})`).join('\n'));
        } catch (e) {
            console.log('Pong2Users table does not exist.');
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
