const XLSX = require('xlsx');
const path = require('path');
const { queryDatabase } = require('../lib_login/db');

async function inspect() {
    try {
        console.log('--- Inspecting Excel ---');
        const workbook = XLSX.readFile('docs/content_sample/manager.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays
        console.log('Sheet Name:', sheetName);
        console.log('Headers:', data[0]);
        console.log('First Row Example:', data[1]);

        console.log('\n--- Inspecting Table Users ---');
        const schema = await queryDatabase('DESCRIBE Users');
        console.log(JSON.stringify(schema, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

inspect();
