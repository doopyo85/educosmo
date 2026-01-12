const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();
const { checkPageAccess } = require('../lib_login/authMiddleware');

const router = express.Router();


// 🔥 시트 데이터 가져오기 (시트명 포함)
async function getSheetData(sheetName, range) {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `${sheetName}!${range}`,
    });
    return response.data.values || [];
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

        // 이미지 배열 생성 (IMG-1 ~ IMG-7: 인덱스 7~13)
        // 빈 값이나 undefined 필터링
        const images = row.slice(7, 14).filter(img => img && img.trim().startsWith('http'));

        groups[groupName].sessions.push({
            name: row[1], // 차시명
            topic: row[2], // 주제
            videoUrl: row[5], // URL (영상)
            thumbnail: row[6], // Thumb
            images: images
        });
    });

    return Object.values(groups);
}

router.get('/', async (req, res) => {
    try {
        // 🔥 레벨별 데이터 가져오기 (A1:N100 넉넉하게 잡음)
        // TODO: 실제 데이터 양에 따라 범위 조정 필요
        const [level1Data, level2Data, level3Data, preAIData] = await Promise.all([
            getSheetData('프리-LV1(5세)', 'A:N'),
            getSheetData('프리-LV2(6세)', 'A:O'), // LV2는 컬럼이 더 많을 수 있음 확인 필요
            getSheetData('프리-LV3(7세)', 'A:O'),
            getSheetData('프리AI(LV2)', 'A:H') // AI는 컬럼 적음
        ]);

        const level1Groups = groupByVolume(level1Data);
        const level2Groups = groupByVolume(level2Data);
        const level3Groups = groupByVolume(level3Data);

        // Pre-AI 데이터 처리 (단순 리스트 형태일 수 있음, 일단 그룹화 시도)
        // Pre-AI 컬럼 구조: Group by, 차시명, 주제, 활동명, 강의자, 재생시간, URL, IMG-1
        const preAIGroups = [];
        // Pre-AI 별도 로직 (필요시) - 일단 비슷하게 처리하되 이미지 인덱스 다름 (IMG-1이 인덱스 7)
        // analyze result: IMG-1 is at index 7. So slice(7, 8) might work.

        // 렌더링
        res.render('kinder', {
            level1Groups,
            level2Groups,
            level3Groups,
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
