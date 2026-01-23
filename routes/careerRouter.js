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
];

const MOCK_DEPARTMENTS = [
    { id: 101, name: '컴퓨터공학부', category: '공학' },
    { id: 102, name: '의예과', category: '의학' },
    { id: 103, name: '경영학과', category: '인문' },
    { id: 104, name: '전자전기공학부', category: '공학' },
    { id: 105, name: '국어국문학과', category: '인문' },
];

// Helper for Admissions Matrix (Grade vs Univ)
const MOCK_RESULTS_MATRIX = [
    { grade_range: '1.0~1.1', universities: { '서울대학교': ['의예과', '컴퓨터공학부'], '연세대학교': ['의예과'] } },
    { grade_range: '1.1~1.2', universities: { '서울대학교': ['전기정보공학부'], '고려대학교': ['의과대학'] } },
    { grade_range: '1.3~1.5', universities: { '한양대학교': ['미래자동차공학과'], '성균관대학교': ['반도체시스템공학'] } },
    { grade_range: '1.5~2.0', universities: { '서강대학교': ['경영학부'], '중앙대학교': ['소프트웨어학부'] } },
];

// Middleware to check DB status (Optional, currently handling via try-catch)

// 1. Main Dashboard (Map View)
router.get('/', async (req, res) => {
    try {
        // Try to fetch regions (for map interaction)
        // If DB fails, render with mock flag
        try {
            const universities = await queryDatabase('SELECT id, name, region FROM admissions_universities LIMIT 20');
            // Check if returned empty array (which db.js does on error)
            if (!universities || universities.length === 0) throw new Error("DB Empty or Down");

            res.render('career/index', {
                universities,
                isMock: false,
                regions: ['서울', '경기', '부산', '대구', '인천', '광주', '대전']
            });
        } catch (dbError) {
            console.warn('DB Fetch failed, falling back to mock data:', dbError.message);
            res.render('career/index', {
                universities: MOCK_UNIVERSITIES,
                isMock: true,
                regions: ['서울', '경기', '부산', '대구', '인천', '광주', '대전']
            });
        }
    } catch (error) {
        console.error('Career Page Error:', error);
        res.status(500).send('Server Error');
    }
});

// 2. Universities API (for Map/Search)
router.get('/api/universities', async (req, res) => {
    const region = req.query.region;
    try {
        let query = 'SELECT * FROM admissions_universities';
        let params = [];
        if (region) {
            query += ' WHERE region = ?';
            params.push(region);
        }

        const results = await queryDatabase(query, params);
        if (!results || results.length === 0) throw new Error("DB Error");
        res.json({ success: true, data: results });
    } catch (error) {
        // Mock fallback
        let filtered = MOCK_UNIVERSITIES;
        if (region) filtered = filtered.filter(u => u.region === region);
        res.json({ success: true, isMock: true, data: filtered });
    }
});

// 3. Admission Results API (for Matrix Table)
router.get('/api/results/matrix', async (req, res) => {
    try {
        // Real logic would involve complex aggregation
        // SELECT grade_cut_70, u.name as univ, d.name as dept ...
        // For now, return mock matrix directly if DB logic not implemented or DB down
        throw new Error("Complex query not implemented yet");
    } catch (error) {
        res.json({ success: true, isMock: true, data: MOCK_RESULTS_MATRIX });
    }
});

module.exports = router;
