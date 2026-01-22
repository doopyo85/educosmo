const { queryDatabase } = require('../lib_login/db');

async function checkSchema() {
    try {
        console.log('Listing tables in educodingnplay...');
        const tables = await queryDatabase("SHOW TABLES FROM educodingnplay");
        console.log('Tables:', tables.map(t => Object.values(t)[0]).join(', '));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
