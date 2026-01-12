require('dotenv').config();
const { google } = require('googleapis');

async function inspectTeacherSheet() {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!spreadsheetId) {
        console.error('Error: SPREADSHEET_ID is not defined in .env');
        return;
    }

    try {
        console.log(`Fetching 'Teacher' sheet from ${spreadsheetId}...`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'Teacher!A1:Z5', // Fetch header and top 4 rows
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return;
        }

        console.log('\n🔥 Header Row:');
        rows[0].forEach((col, index) => {
            console.log(`Index ${index}: ${col}`);
        });

        console.log('\n🔥 First Data Row:');
        if (rows.length > 1) {
            rows[1].forEach((col, index) => {
                console.log(`Index ${index}: ${col}`);
            });
        }

    } catch (error) {
        console.error('Error fetching sheet:', error.message);
    }
}

inspectTeacherSheet();
