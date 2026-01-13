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

        // J열(인덱스 9)이 URL, K열부터 이미지
        // Images start from Index 10 (Column K) -> 10 to 16
        const images = row.slice(10, 17).filter(img => img && img.trim().startsWith('http'));

        groups[groupName].sessions.push({
            name: row[2], // Title (C열)
            topic: row[3], // Topic (D열)
            videoUrl: row[9], // URL (J열, 인덱스 9)
            thumbnail: row[8], // Thumb (I열, 인덱스 8)
            images: images
        });
    });

    return Object.values(groups);
}

router.get('/', async (req, res) => {
    try {
        // 🔥 병렬 데이터 호출
        const [
            kinderSheetData, // Teacher Board Data
            allLessonData    // Education Video Cards Data
        ] = await Promise.all([
            // Tab 1: Board Data - Sheet 'kinder'
            getSheetData('kinder', 'A:D', process.env.SPREADSHEET_ID),

            // Tab 2: All Lessons - Sheet 'Teacher'
            getSheetData('Teacher', 'A:P', process.env.SPREADSHEET_ID)
        ]);

        // Helper to filter by Category column (Index 0)
        const filterByCategory = (rows, categoryKeyword) => {
            return rows.filter(row => row[0] && row[0].includes(categoryKeyword));
        };

        // 🔥 Dynamic Category Extraction
        // Extract unique categories from Column A (Index 0)
        // We trim whitespace and ignore empty values.
        const allCategories = [...new Set(allLessonData.map(row => row[0] ? row[0].trim() : '').filter(c => c !== ''))];

        // You might want to sort them. 
        // If specific order is needed, we might need a mapping or manual sort logic.
        // For now, sorting alphabetically or native sheet order (by appearance) is best.
        // Native sheet order approach:
        const categoriesInOrder = [];
        const seen = new Set();
        allLessonData.forEach(row => {
            const c = row[0] ? row[0].trim() : '';
            if (c && !seen.has(c)) {
                seen.add(c);
                categoriesInOrder.push(c);
            }
        });

        // Create Tabs structure
        const lessonTabs = categoriesInOrder.map((cat, index) => {
            return {
                id: `dynamic-tab-${index}`, // Unique ID for tab
                title: cat,
                groups: groupByVolume(filterByCategory(allLessonData, cat))
            };
        });

        // Process Board Data (New Structure from User Request)
        // Expected Columns: [0]Category, [1]Group by, [2]주제(Title), [3]Download(URL)
        // No explicit 'Board' column anymore. Filter by Category directly.

        const preschoolItems = kinderSheetData
            .filter(row => row[0] === '프리스쿨')
            .map(row => ({
                type: row[1] || '',    // Group by
                content: row[2] || '', // Title
                links: ['다운로드'],
                url: row[3] || ''      // URL
            }));

        const preschoolAIItems = kinderSheetData
            .filter(row => row[0] === '프리스쿨AI')
            .map(row => ({
                type: row[1] || '',    // Group by
                content: row[2] || '', // Title
                links: ['다운로드'],
                url: row[3] || ''      // URL
            }));

        const preschoolTitle = '프리스쿨';
        const preschoolAITitle = '프리스쿨 AI';

        // 렌더링
        res.render('kinder', {
            // Board Tab Data
            preschoolTitle, preschoolAITitle,
            preschoolItems, preschoolAIItems,

            // Dynamic Tabs Data
            lessonTabs,

            // Legacy support (pass empty or dummy if view still checks them before full refactor)
            // Ideally we remove them from view entirely.

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
