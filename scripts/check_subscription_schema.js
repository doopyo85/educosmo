const { queryDatabase } = require('../lib_login/db');

async function checkSchema() {
    try {
        console.log('Checking center_subscriptions schema...');
        const columns = await queryDatabase('DESCRIBE center_subscriptions');
        console.log(columns.map(c => `${c.Field} (${c.Type})`).join('\n'));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
