
const { getSheetData, initGoogleSheets } = require('./lib_google/sheetService');
require('dotenv').config();

async function debugSheet() {
    try {
        console.log('Initializing Google Sheets...');
        await initGoogleSheets();

        console.log('Fetching sb2 sheet...');
        const data = await getSheetData('sb2!A2:H');

        console.log(`Fetched ${data.length} rows.`);

        let found = false;
        for (const row of data) {
            // Check for cospro compatible rows
            // [category, name, type, webUrl, ctElement, tools, s3Url, imgUrl]
            const name = row[1];
            if (name && name.includes('COS')) {
                console.log('Found COS row:', row);
                const s3Url = row[6]; // G column
                if (s3Url) {
                    console.log('S3 URL:', s3Url);
                    if (s3Url.includes('cos1-1s-01a.sb2')) {
                        console.log('!!! Found the specific failing file entry !!!');
                        console.log('Raw S3 URL:', s3Url);
                        found = true;
                    }
                }
            }
        }

        if (!found) {
            console.log('Specific file cos1-1s-01a.sb2 not found in sb2 sheet.');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

debugSheet();
