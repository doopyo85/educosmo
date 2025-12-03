const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const bcrypt = require('bcrypt');

// 인증 미들웨어
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.is_logined) {
        return res.status(401).json({ 
            success: false, 
            message: '로그인이 필요합니다.' 
        });
    }
    next();
};

// ============================================
// 내 프로필 페이지 렌더링
// ============================================
router.get('/my-profile', requireAuth, async (req, res) => {
    try {
        const [student] = await db.queryDatabase(
            'SELECT * FROM Users WHERE userID = ?',
            [req.session.userID]
        );
        
        if (!student) {
            return res.status(404).send('사용자를 찾을 수 없습니다.');
        }
        
        // 학습 기록 조회
        const logs = await db.queryDatabase(
            'SELECT * FROM LearningLogs WHERE user_id = ? ORDER BY start_time DESC LIMIT 20',
            [student.id]
        );
        
        // 로그인 기록 조회
        const activityLogs = await db.queryDatabase(
            `SELECT created_at, ip_address, user_agent, url, status 
             FROM UserActivityLogs 
             WHERE user_id = ? AND status IN ('login', 'logout')
             ORDER BY created_at DESC 
             LIMIT 50`,
            [student.id]
        );
        
        res.render('teacher/student-detail', { 
            student, 
            logs,
            activityLogs,
            isMyProfile: true  // 본인 프로필 표시
        });
        
    } catch (error) {
        console.error('프로필 조회 오류:', error);
        res.status(500).send('오류 발생');
    }
});

// ============================================
// 내 프로필 수정 API
// ============================================
router.put('/my-profile', requireAuth, async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        const userId = req.session.userID;
        
        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }
        
        let query, params;
        
        if (password && password.trim() !== '') {
            // 비밀번호 변경 포함
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `
                UPDATE Users 
                SET name = ?, email = ?, password = ?, phone = ?
                WHERE id = ?
            `;
            params = [name, email || '', hashedPassword, phone || '', user.id];
        } else {
            // 비밀번호 변경 제외
            query = `
                UPDATE Users 
                SET name = ?, email = ?, phone = ?
                WHERE id = ?
            `;
            params = [name, email || '', phone || '', user.id];
        }
        
        await db.queryDatabase(query, params);
        
        res.json({
            success: true,
            message: '프로필이 수정되었습니다.'
        });
        
    } catch (error) {
        console.error('프로필 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로필 수정에 실패했습니다.',
            error: error.message
        });
    }
});

module.exports = router;
