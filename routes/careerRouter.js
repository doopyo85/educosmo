const express = require('express');
const router = express.Router();
const { queryDatabase } = require('../lib_login/db');

// Mock Data Definitions
const MOCK_UNIVERSITIES = [
    { id: 1, name: '서울대학교', region: '서울' },
    { id: 2, name: '연세대학교', region: '서울' },
    { id: 3, name: '고려대학교', region: '서울' },
    { id: 4, name: '성균관대학교', region: '서울' },
    { id: 5, name: '서강대학교', region: '서울' },
    { id: 6, name: '한양대학교', region: '서울' },
    { id: 7, name: '카이스트', region: '대전' },
    { id: 8, name: '포항공과대학교', region: '경북' },
    { id: 9, name: '부산대학교', region: '부산' },
    { id: 10, name: '경북대학교', region: '대구' },
    { id: 11, name: '전남대학교', region: '광주' },
    { id: 12, name: '충남대학교', region: '대전' },
    { id: 13, name: '서울시립대학교', region: '서울' },
    { id: 14, name: '이화여자대학교', region: '서울' },
    { id: 15, name: '중앙대학교', region: '서울' },
    { id: 16, name: '경희대학교', region: '서울' },
    { id: 17, name: '한국외국어대학교', region: '서울' },
    { id: 18, name: '건국대학교', region: '서울' },
    { id: 19, name: '동국대학교', region: '서울' },
    { id: 20, name: '홍익대학교', region: '서울' }
];

const MOCK_RESULTS_MATRIX = [
    { grade_range: '1.0 ~ 1.2', universities: { '서울대학교': ['의예과', '컴퓨터공학부'], '연세대학교': ['의예과(추천형)'] } },
    { grade_range: '1.2 ~ 1.4', universities: { '서울대학교': ['전기정보공학부', '화학생물공학부'], '고려대학교': ['의과대학'], '연세대학교': ['경영학과'] } },
    { grade_range: '1.4 ~ 1.6', universities: { '한양대학교': ['미래자동차공학과'], '성균관대학교': ['반도체시스템공학'], '고려대학교': ['사이버국방학과'] } },
    { grade_range: '1.6 ~ 1.8', universities: { '서강대학교': ['경영학부'], '중앙대학교': ['소프트웨어학부'], '한양대학교': ['데이터사이언스학부'] } },
    { grade_range: '1.8 ~ 2.0', universities: { '이화여자대학교': ['뇌인지과학부'], '중앙대학교': ['AI학과'], '경희대학교': ['한의예과(인문)'] } },
    { grade_range: '2.0 ~ 2.3', universities: { '서울시립대학교': ['도시공학과'], '건국대학교': ['수의예과'], '동국대학교': ['경찰행정학부'] } },
    { grade_range: '2.3 ~ 2.7', universities: { '홍익대학교': ['자율전공'], '국민대학교': ['자동차공학과'], '숭실대학교': ['컴퓨터학부'] } },
];

// Helper to safely query DB with timeout/fallback
async function safeQuery(sql, params = []) {
    try {
        const results = await queryDatabase(sql, params);
        // If results array is empty but successful, it returns [], 
        // if connection fails logged in db.js, it might return [] too or throw.
        // We'll rely on catching exceptions or checking if specific expected data exists.
        return results;
    } catch (e) {
        console.error("DB Query failed:", e.message);
        return null;
    }
}

// 1. Main Dashboard (Map View)
router.get('/', async (req, res) => {
    try {
        let universities = [];
        let isMock = false;

        // Try DB first
        const dbResults = await safeQuery('SELECT id, name, region FROM admissions_universities LIMIT 100');

        if (dbResults && dbResults.length > 0) {
            universities = dbResults;
        } else {
            console.warn('Using Mock Data for Career Dashboard');
            universities = MOCK_UNIVERSITIES;
            isMock = true;
        }

        res.render('career/index', {
            universities,
            isMock,
            regions: ['서울', '경기/인천', '부산/경남', '대구/경북', '광주/전남', '대전/충청', '강원', '제주']
        });

    } catch (error) {
        console.error('Career Page Error:', error);
        // Fallback render on severe error
        res.render('career/index', {
            universities: MOCK_UNIVERSITIES,
            isMock: true,
            regions: ['서울', '경기', '부산', '대구', '대전']
        });
    }
});

// 2. Universities API (for Map/Search interactions)
router.get('/api/universities', async (req, res) => {
    const region = req.query.region;
    try {
        let query = 'SELECT * FROM admissions_universities';
        let params = [];
        if (region && region !== 'All') {
            query += ' WHERE region = ?';
            params.push(region);
        }

        const results = await safeQuery(query, params);

        if (results && results.length > 0) {
            res.json({ success: true, data: results });
        } else {
            // Mock fallback
            let filtered = MOCK_UNIVERSITIES;
            if (region && region !== 'All') {
                // Mock data simplistic region matching
                filtered = filtered.filter(u => region.includes(u.region.substring(0, 2)));
            }
            res.json({ success: true, isMock: true, data: filtered });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// 3. Admission Results API (for Matrix Table)
router.get('/api/results/matrix', async (req, res) => {
    try {
        // In a real scenario, we'd run a complex aggregation query here
        // For now, we return the mock matrix structure.

        // Check DB health just in case
        const check = await safeQuery('SELECT 1');

        // Always return mock matrix for now as SQL for this is complex and data might be sparse
        res.json({ success: true, isMock: true, data: MOCK_RESULTS_MATRIX });

    } catch (error) {
        res.json({ success: true, isMock: true, data: MOCK_RESULTS_MATRIX });
    }
});

module.exports = router;
