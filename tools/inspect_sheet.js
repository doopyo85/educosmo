const { getSheetData } = require('../lib_google/sheetService');

async function run() {
    try {
        console.log('Fetching problems sheet...');
        const data = await getSheetData('problems!A1:E10');
        console.log('Headers/First 10 rows:');
        data.forEach((row, i) => {
            console.log(`[${i}]`, row.join(' | '));
        });
    } catch (e) {
        console.error(e);
    }
}

run();
