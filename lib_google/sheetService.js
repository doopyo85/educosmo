const { google } = require('googleapis');
const config = require('../config');

let sheets;

async function initGoogleSheets() {
    sheets = google.sheets({ version: 'v4', auth: config.GOOGLE_API.KEY });
    if (process.env.NODE_ENV === 'development') {
        console.log('Google Sheets API 초기화 성공');
    }
}

async function getSheetData(range) {
    if (!sheets) {
        await initGoogleSheets();
    }

    try {
        const requestParams = {
            spreadsheetId: config.GOOGLE_API.SPREADSHEET_ID,
            range: range,
        };

        const response = await sheets.spreadsheets.values.get(requestParams);

        if (!response || !response.data) {
            console.error('API 응답이 없거나 올바르지 않음:', response);
            return [];
        }

        return response.data.values || [];
    } catch (error) {
        console.error(`스프레드시트 데이터 로드 오류 (${range}):`, error.message);
        throw error;
    }
}

module.exports = { getSheetData, initGoogleSheets };
