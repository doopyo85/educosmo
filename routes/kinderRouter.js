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
// 🔥 데이터 그룹화 헬퍼 함수
// Adjusted for Schema:
// [0]Page(kinder), [1]Category(Tab), [2]Group(Vol), [3]Title, [4]Topic, ...
// [9]Thumbnail, [10]Video, [11...]Images
function groupByVolume(rows) {
    const groups = {};

    rows.forEach(row => {
        // Validation: Must have Group(C) and Title(D)
        if (!row[2] || !row[3]) return;

        const groupName = row[2]; // Group (Col C)

        if (!groups[groupName]) {
            groups[groupName] = {
                title: groupName,
                sessions: []
            };
        }

        // Images start from Col L (Index 11) -> 11 to 17
        const images = row.slice(11, 18).filter(img => img && img.trim().startsWith('http'));

        groups[groupName].sessions.push({
            name: row[3], // Title (Col D)
            topic: row[4], // Topic (Col E)
            thumbnail: row[9],  // Thumb (Col J)
            videoUrl: row[10], // Video (Col K)
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
            allRawData    // Education Video Cards Data (Raw)
        ] = await Promise.all([
            // Tab 1: Board Data - Sheet 'kinder'
            getSheetData('kinder', 'A:D', process.env.SPREADSHEET_ID),

            // Tab 2: All Lessons - Sheet 'Teacher'
            getSheetData('Teacher', 'A:Q', process.env.SPREADSHEET_ID)
        ]);

        // 1. Filter by Page Column (Col A, Index 0) == 'kinder'
        //    (User requested to exclude 'center' etc.)
        const kinderLessonData = allRawData.filter(row => row[0] && row[0].trim().toLowerCase() === 'kinder');

        // 2. Extract Categories from Col B (Index 1) for Tabs
        const categoriesInOrder = [];
        const seen = new Set();
        kinderLessonData.forEach(row => {
            const cat = row[1] ? row[1].trim() : '';
            if (cat && !seen.has(cat)) {
                seen.add(cat);
                categoriesInOrder.push(cat);
            }
        });

        // 3. Helper to filter rows by Category (Col B)
        const filterByCat = (rows, catKeyword) => {
            return rows.filter(row => row[1] && row[1].trim() === catKeyword);
        };

        // 4. Create Tabs structure
        const lessonTabs = categoriesInOrder.map((cat, index) => {
            return {
                id: `dynamic-tab-${index}`,
                title: cat,
                groups: groupByVolume(filterByCat(kinderLessonData, cat))
            };
        });

        // Process Board Data (Preserved)
        // ... (No changes to preschoolItems logic yet unless board sheet also changed)
        // Helper to parse content into array if it contains multiple items like "[A] [B]"
        const parseContent = (text) => {
            if (!text) return [];
            let items = text.split(/\]\s*\[/);
            return items.map((item, index) => {
                let str = item.trim();
                // Add brackets back if missing
                if (!str.startsWith('[')) str = '[' + str;
                if (!str.endsWith(']')) str = str + ']';
                return str;
            });
        };

        const preschoolItems = kinderSheetData
            .filter(row => row[0] === '프리스쿨')
            .map(row => ({
                type: row[1] || '',
                content: parseContent(row[2] || ''),
                links: ['다운로드'],
                url: row[3] || ''
            }));

        const preschoolAIItems = kinderSheetData
            .filter(row => row[0] === '프리스쿨AI')
            .map(row => ({
                type: row[1] || '',
                content: parseContent(row[2] || ''),
                links: ['다운로드'],
                url: row[3] || ''
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
