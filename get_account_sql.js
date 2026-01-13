require('dotenv').config();
const bcrypt = require('bcrypt');
const { getSheetData } = require('./lib_google/sheetService');

async function main() {
    try {
        console.log('Generating hash...');
        const hashedPassword = await bcrypt.hash('123456', 10);
        console.log('Hash generated.');

        console.log('Fetching center list...');
        // Using the 1-arg signature that currently works in sheetService
        const rows = await getSheetData('센터목록!A2:B');

        let centerID = null;
        if (rows && rows.length > 0) {
            const target = rows.find(r => r[1] && r[1].trim() === '청주오송');
            if (target) {
                centerID = target[0];
                console.log(`Found Center ID: ${centerID} for 청주오송`);
            } else {
                console.log('Center "청주오송" not found in the list.');
            }
        } else {
            console.log('No data returned from sheet.');
        }

        const sql = `
INSERT INTO Users 
(userID, password, name, centerID, role, created_at)
VALUES 
('cjos', '${hashedPassword}', '청주오송', ${centerID ? `'${centerID}'` : 'NULL /* Center ID needed */'}, 'manager', NOW());
`;

        console.log('\n--- SQL QUERY ---');
        console.log(sql);
        console.log('-----------------');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
