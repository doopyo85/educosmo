const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();
const { checkPageAccess } = require('../lib_login/authMiddleware');

const router = express.Router();


// 🔥 시트 데이터 가져오기 (시트명, ID 포함)
async function getSheetData(sheetName, range, spreadsheetId) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId || process.env.SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
        });
        return response.data.values || [];
    } catch (error) {
        console.warn(`Warning: Failed to fetch data for sheet '${sheetName}'. Returning empty array.`, error.message);
        return [];
    }
}

// 🔥 데이터 그룹화 헬퍼 함수
function groupByVolume(rows) {
    const groups = {};

    // 첫 번째 행(헤더) 제외하고 데이터 처리
    rows.slice(1).forEach(row => {
        // 데이터가 없는 행 건너뛰기
        if (!row[0] || !row[1]) return;

        const groupName = row[0]; // Group by (e.g., Level1 1호)

        if (!groups[groupName]) {
            groups[groupName] = {
                title: groupName,
                sessions: []
            };
        }

        // 이미지 배열 생성 (IMG-1 ~ IMG-7: 인덱스 8~14 -> Column I ~ O)
        const images = row.slice(8, 15).filter(img => img && img.trim().startsWith('http'));

        groups[groupName].sessions.push({
            name: row[1], // 차시명
            topic: row[2], // 주제
            videoUrl: row[6], // URL (영상) - G열
            thumbnail: row[7], // Thumb - H열
            images: images
        });
    });

    return Object.values(groups);
}

router.get('/', async (req, res) => {
    try {
        const eduSpreadsheetId = process.env.SPREADSHEET_ID_EDU || process.env.SPREADSHEET_ID;

        // 🔥 병렬 데이터 호출
        const [
            preschoolData,
            preschoolAIData,
            level1Data,
            level2Data,
            level3Data,
            aiLevel1Data,
            aiLevel2Data,
            aiLevel3Data
        ] = await Promise.all([
            // Tab 1: Board Data (Old) - Uses Default SPREADSHEET_ID
            getSheetData('교사게시판', 'A1:D14', process.env.SPREADSHEET_ID),
            getSheetData('교사게시판', 'E1:H14', process.env.SPREADSHEET_ID),

            // Tab 2: Lesson Data (Regular) - Uses EDU SPREADSHEET_ID
            getSheetData('프리-LV1(5세)', 'A:N', eduSpreadsheetId),
            getSheetData('프리-LV2(6세)', 'A:O', eduSpreadsheetId),
            getSheetData('프리-LV3(7세)', 'A:O', eduSpreadsheetId),

            // Tab 2: Lesson Data (AI) - Uses EDU SPREADSHEET_ID (Assumed Sheet Names)
            getSheetData('프리AI-LV1(5세)', 'A:O', eduSpreadsheetId),
            getSheetData('프리AI-LV2(6세)', 'A:O', eduSpreadsheetId),
            getSheetData('프리AI-LV3(7세)', 'A:O', eduSpreadsheetId)
        ]);

        // Process Board Data
        const preschoolTitle = preschoolData[0] ? preschoolData[0][0] : '프리스쿨';
        const preschoolAITitle = preschoolAIData[0] ? preschoolAIData[0][0] : '프리스쿨 AI';

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

        // Process Lesson Data
        const level1Groups = groupByVolume(level1Data);
        const level2Groups = groupByVolume(level2Data);
        const level3Groups = groupByVolume(level3Data);

        const aiLevel1Groups = groupByVolume(aiLevel1Data);
        const aiLevel2Groups = groupByVolume(aiLevel2Data);
        const aiLevel3Groups = groupByVolume(aiLevel3Data);

        // 렌더링
        res.render('kinder', {
            // Board Tab Data
            preschoolTitle, preschoolAITitle,
            preschoolItems, preschoolAIItems,

            // Lesson Tab Data
            level1Groups,
            level2Groups,
            level3Groups,
            aiLevel1Groups,
            aiLevel2Groups,
            aiLevel3Groups,

            pageTitle: '프리스쿨 교육자료'
        });

    } catch (error) {
        console.error('Error fetching sheet data:', error);
        res.status(500).send(`
            <div style="text-align:center; padding: 50px;">
                <h3>데이터를 불러오는 중 오류가 발생했습니다.</h3>
                <p>${error.message}</p>
            </div>
        `);
    }
});

module.exports = router;
