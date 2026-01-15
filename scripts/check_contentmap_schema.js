const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { queryDatabase } = require('../lib_login/db');

async function checkSchema() {
    try {
        const rows = await queryDatabase('DESCRIBE ContentMap');
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error describing table:', error);
    }
    process.exit(0);
}

checkSchema();
