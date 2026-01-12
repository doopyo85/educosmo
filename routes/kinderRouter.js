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
// Adjusted for Single Sheet with Category Column at Index 0
function groupByVolume(rows) {
    const groups = {};

    // Rows are already filtered, so we can iterate directly.
    // If the first row is a header, filtering might have kept or removed it. 
    // Usually 'filterByCategory' removes the header unless it matches the keyword.
    // We assume incoming rows are data rows.

    rows.forEach(row => {
        // [0]Category, [1]Group, [2]Title, [3]Topic, ..., [7]Video, [8]Thumb, [9...]Images
        if (!row[1] || !row[2]) return;

        const groupName = row[1]; // Group (e.g., 1호)

        if (!groups[groupName]) {
            groups[groupName] = {
                title: groupName,
                sessions: []
            };
        }

        // Images start from Index 9 (Column J) -> 9 to 16
        const images = row.slice(9, 16).filter(img => img && img.trim().startsWith('http'));

        groups[groupName].sessions.push({
            name: row[2], // Title
            topic: row[3], // Topic
            videoUrl: row[7], // Video (Col H)
            thumbnail: row[8], // Thumb (Col I)
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
            allLessonData // Single Consolidated Sheet
        ] = await Promise.all([
            // Tab 1: Board Data (Old) - Uses Default SPREADSHEET_ID
            getSheetData('교사게시판', 'A1:D14', process.env.SPREADSHEET_ID),
            getSheetData('교사게시판', 'E1:H14', process.env.SPREADSHEET_ID),

            // Tab 2: All Lessons from Single Sheet
            getSheetData('교육영상', 'A:P', eduSpreadsheetId)
        ]);

        // Helper to filter by Category column (Index 0)
        // Note: New Sheet Structure: [Category, Group, Title, Topic, ..., Video(H), Thumb(I), Images(J...)]
        // Original indices shifted by +1 because 'Category' is at 0.
        // Old Video was G (6), now H (7).
        // Old Thumb was H (7), now I (8).
        const filterByCategory = (rows, categoryKeyword) => {
            return rows.filter(row => row[0] && row[0].includes(categoryKeyword));
        };

        const level1Data = filterByCategory(allLessonData, '프리-LV1(5세)');
        const level2Data = filterByCategory(allLessonData, '프리-LV2(6세)');
        const level3Data = filterByCategory(allLessonData, '프리-LV3(7세)');

        const aiLevel1Data = filterByCategory(allLessonData, '프리AI-LV1(5세)');
        const aiLevel2Data = filterByCategory(allLessonData, '프리AI-LV2(6세)');
        const aiLevel3Data = filterByCategory(allLessonData, '프리AI-LV3(7세)');

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

            // Dynamic Tab Titles
            level1Title: 'Level 1 (5세)',
            level2Title: 'Level 2 (6세)',
            level3Title: 'Level 3 (7세)',
            aiLevel1Title: 'Pre-AI 1 (5세)',
            aiLevel2Title: 'Pre-AI 2 (6세)',
            aiLevel3Title: 'Pre-AI 3 (7세)',

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
