const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();
const { checkPageAccess } = require('../lib_login/authMiddleware');

const router = express.Router();

async function getSheetData(range) {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `교사게시판!${range}`,
    });
    return response.data.values;
}

router.get('/', async (req, res) => {
    try {
        const preschoolData = await getSheetData('A1:D14');  // 프리스쿨
        const preschoolAIData = await getSheetData('E1:H14'); // 프리스쿨 AI

        const preschoolTitle = preschoolData[0][0];  // A1 셀 (프리스쿨 탭 이름)
        const preschoolAITitle = preschoolAIData[0][0]; // E1 셀 (프리스쿨 AI 탭 이름)

        const preschoolItems = preschoolData.slice(2).map(row => ({
            type: row[0] || '',
            content: row[1] || '',
            links: row[2] ? row[2].split('\n') : [],
            url: row[3] || ''
        }));

        const preschoolAIItems = preschoolAIData.slice(2).map(row => ({
            type: row[0] || '',
            content: row[1] || '',
            links: row[2] ? row[2].split('\n') : [],
            url: row[3] || ''
        }));

        res.render('kinder', { 
            preschoolTitle, preschoolAITitle, 
            preschoolItems, preschoolAIItems 
        });
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        res.status(500).send('데이터를 불러오는 중 오류 발생');
    }
});

module.exports = router;
