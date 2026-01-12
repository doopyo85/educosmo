require('dotenv').config();
const { google } = require('googleapis');

async function listSheets() {
    console.log('SPREADSHEET_ID:', process.env.SPREADSHEET_ID);
    console.log('SPREADSHEET_ID_EDU:', process.env.SPREADSHEET_ID_EDU);
    console.log('GOOGLE_API_KEY Available:', !!process.env.GOOGLE_API_KEY);

    const sheets = google.sheets({ version: 'v4' });
    const spreadsheetId = process.env.SPREADSHEET_ID_EDU || process.env.SPREADSHEET_ID;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!spreadsheetId) {
        console.error('Error: No Spreadsheet ID found.');
        return;
    }

    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            key: apiKey // Explicitly pass key here
        });

        const sheetTitles = response.data.sheets.map(sheet => sheet.properties.title);
        console.log('\n🔥 Sheets found in Spreadsheet (' + spreadsheetId + '):');
        sheetTitles.forEach(title => console.log(`- ${title}`));
    } catch (error) {
        console.error('Error listing sheets:', error.message);
        if (error.response) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

listSheets();
