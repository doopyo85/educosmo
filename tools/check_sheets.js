const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Manually parse .env because dotenv might not be working as expected in this context
try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^GOOGLE_API_KEY=(.*)$/);
            if (match) {
                const key = match[1].trim();
                // Override config/process.env
                process.env.GOOGLE_API_KEY = key;
                config.GOOGLE_API.KEY = key;
                console.log('✅ Manually loaded GOOGLE_API_KEY from .env');
            }
        });
    } else {
        console.log('❌ .env file not found at', envPath);
    }
} catch (e) {
    console.log('Error reading .env:', e.message);
}

async function inspectSheets() {
    try {
        const apiKey = process.env.GOOGLE_API_KEY || config.GOOGLE_API.KEY;
        console.log('API Key present:', !!apiKey);

        // Pass auth in options AND key in params to be safe
        const sheets = google.sheets({ version: 'v4', auth: apiKey });

        const spreadsheetId = config.GOOGLE_API.SPREADSHEET_ID;
        const eduSpreadsheetId = process.env.SPREADSHEET_ID_EDU || spreadsheetId;

        console.log('Target Spreadsheet ID:', eduSpreadsheetId);

        // 1. Get Spreadsheet Metadata (Sheet Names)
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: eduSpreadsheetId,
            key: apiKey
        });

        console.log('\n--- Available Sheets ---');
        meta.data.sheets.forEach(s => {
            console.log(`- ${s.properties.title} (ID: ${s.properties.sheetId})`);
        });

        // 2. Fetch Categories from 'Teacher!' (Col A)
        // Group by unique values
        try {
            console.log('\n--- Fetching Teacher! Categories ---');
            const tData = await sheets.spreadsheets.values.get({
                spreadsheetId: eduSpreadsheetId,
                range: 'Teacher!!A2:A',
                key: apiKey
            });
            const tCats = [...new Set(tData.data.values?.flat().filter(c => c))];
            console.log(tCats);
        } catch (e) {
            console.log('Warning (Teacher!):', e.message);
        }

        // 3. Fetch Categories from '교육영상' or '[교육영상]'
        const sheetCandidates = ['교육영상', '[교육영상]'];
        for (const sName of sheetCandidates) {
            try {
                console.log(`\n--- Fetching ${sName} Categories ---`);
                const kData = await sheets.spreadsheets.values.get({
                    spreadsheetId: eduSpreadsheetId,
                    range: `${sName}!A2:A`,
                    key: apiKey
                });
                const kCats = [...new Set(kData.data.values?.flat().filter(c => c))];
                console.log(`✅ Success (${sName}):`, kCats);
            } catch (e) {
                console.log(`Warning (${sName}):`, e.message);
            }
        }

    } catch (error) {
        console.error('Fatal Error:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

inspectSheets();
