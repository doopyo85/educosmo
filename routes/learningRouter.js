const express = require('express');
const router = express.Router();
const { queryDatabase } = require('../lib_login/db');
const { checkRole } = require('../lib_login/authMiddleware');
const { getSheetData } = require('../server');

// checkRole 사용으로 변경
router.get('/roadmap', checkRole(['manager', 'admin']), async (req, res) => {
    try {
        // 🔹 Step 1: 구글시트에서 센터 데이터 가져오기
        const centerData = await getSheetData('센터목록!A2:B');
        const centerMap = new Map(centerData.map(row => [row[0].toString(), row[1]]));

        // 🔹 Step 2: 학습 활동 데이터 가져오기
        const query = `
            SELECT 
                u.name AS student_name,
                lr.platform,
                ll.content_name,
                ll.start_time,
                ll.end_time,
                ll.duration,
                ll.progress,
                u.centerID
            FROM LearningLogs ll
            JOIN Users u ON ll.user_id = u.id
            LEFT JOIN LearningRecords lr ON ll.user_id = lr.user_id
            ORDER BY ll.start_time DESC;
        `;

        const roadmapData = await queryDatabase(query);

        // 🔹 Step 3: centerID → center_name 변환
        const roadmapWithCenters = roadmapData.map(record => ({
            ...record,
            center_name: centerMap.get(record.centerID?.toString()) || '미지정' // centerID 기반으로 센터명 매핑
        }));

        res.json({
            success: true,
            data: roadmapWithCenters
        });
    } catch (error) {
        console.error('Error fetching learning roadmap:', error);
        res.status(500).json({ success: false, error: '로드맵 데이터를 불러오는데 실패했습니다.' });
    }
});

// 프로젝트 로드 기록 API (학습 시작)
router.post('/project-load', async (req, res) => {
    try {
        const { platform, project_name, file_type, s3_url } = req.body;

        const userID = req.session.userID;
        if (!userID) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        // 사용자 정보 조회
        const userQuery = 'SELECT id, centerID FROM Users WHERE userID = ?';
        const users = await queryDatabase(userQuery, [userID]);

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const user = users[0];

        // LearningLogs에 기록
        const insertQuery = `
            INSERT INTO LearningLogs 
            (user_id, content_type, content_name, platform, project_id, file_type, start_time, center_id)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
        `;

        await queryDatabase(insertQuery, [
            user.id,
            platform,
            project_name,
            platform,
            s3_url,
            file_type,
            user.centerID
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error('프로젝트 로드 기록 오류:', error);
        res.status(500).json({
            success: false,
            error: '기록 중 오류가 발생했습니다.'
        });
    }
});


// 학습 종료 API
router.post('/end', async (req, res) => {
    try {
        const { content_type, content_name, progress } = req.body;

        // 세션에서 사용자 정보 가져오기
        const userID = req.session.userID;
        if (!userID) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        // 사용자 ID 조회
        const userQuery = 'SELECT id FROM Users WHERE userID = ?';
        const users = await queryDatabase(userQuery, [userID]);

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                error: '사용자 정보를 찾을 수 없습니다.'
            });
        }

        const user = users[0];

        // 진행 중인 학습 로그 업데이트
        const updateQuery = `
            UPDATE LearningLogs 
            SET 
                end_time = NOW(),
                duration = TIMESTAMPDIFF(SECOND, start_time, NOW()),
                progress = ?
            WHERE 
                user_id = ? 
                AND content_type = ? 
                AND content_name = ?
                AND end_time IS NULL
        `;

        const result = await queryDatabase(updateQuery, [
            progress,
            user.id,
            content_type,
            content_name
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: '진행 중인 학습 기록을 찾을 수 없습니다.'
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Learning end log error:', error);
        res.status(500).json({
            success: false,
            error: '학습 종료 기록 중 오류가 발생했습니다.'
        });
    }
});

// 학습 활동 로그 API (Generic)
router.post('/log', async (req, res) => {
    try {
        const { action, data } = req.body;
        const userID = req.session.userID; // Can be null (guest)

        // Guest handling or skip?
        // If guest, we might log with user_id = null or 0? 
        // UserActivityLogs usually requires user_id.
        // If no user, we check if we can get it from body? No.

        let dbUserId = null;
        if (userID) {
            const users = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userID]);
            if (users.length > 0) dbUserId = users[0].id;
        }

        if (!dbUserId) {
            // For now, if not logged in, just return success to avoid client error
            return res.json({ success: true, message: 'Guest log skipped' });
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.get('User-Agent');
        const detail = data ? JSON.stringify(data) : '';

        await queryDatabase(`
            INSERT INTO UserActivityLogs 
            (user_id, action_type, url, ip_address, user_agent, status, action_detail, created_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, NOW())
        `, [dbUserId, action, '/learning/log', ip, userAgent, detail]);

        res.json({ success: true });

    } catch (error) {
        console.error('Learning Generic Log Error:', error);
        // Don't fail the client flow
        res.status(200).json({ success: false, error: 'Logging failed' });
    }
});

module.exports = router;
