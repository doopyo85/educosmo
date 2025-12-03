const express = require('express');
const router = express.Router();
const db = require('../lib_login/db');
const bcrypt = require('bcrypt');

// ============================================
// 미들웨어: 교사 권한 확인
// ============================================
const requireTeacher = (req, res, next) => {
    const allowedRoles = ['teacher', 'manager', 'admin'];
    if (!req.session || !req.session.is_logined) {
        return res.status(401).json({ 
            success: false, 
            message: '로그인이 필요합니다.' 
        });
    }
    
    if (!allowedRoles.includes(req.session.role)) {
        return res.status(403).json({ 
            success: false, 
            message: '교사/관리자 권한이 필요합니다.' 
        });
    }
    
    next();
};

// ============================================
// 미들웨어: 같은 센터 학생인지 확인
// ============================================
const checkSameCenter = async (req, res, next) => {
    try {
        const studentId = req.params.id || req.body.studentId;
        const teacherCenterId = req.session.centerID;
        const teacherRole = req.session.role;
        
        // admin은 모든 센터 접근 가능
        if (teacherRole === 'admin') {
            return next();
        }
        
        // 학생의 centerID 확인
        const [student] = await db.queryDatabase(
            'SELECT centerID FROM Users WHERE id = ?',
            [studentId]
        );
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: '학생을 찾을 수 없습니다.'
            });
        }
        
        if (student.centerID !== teacherCenterId) {
            return res.status(403).json({
                success: false,
                message: '다른 센터 학생에게는 접근할 수 없습니다.'
            });
        }
        
        next();
    } catch (error) {
        console.error('센터 확인 중 오류:', error);
        res.status(500).json({
            success: false,
            message: '권한 확인 중 오류가 발생했습니다.'
        });
    }
};

// ============================================
// API: 학생 목록 조회
// ============================================
router.get('/api/students', requireTeacher, async (req, res) => {
    try {
        const teacherCenterId = req.session.centerID;
        const teacherRole = req.session.role;
        
        let query, params;
        
        if (teacherRole === 'admin') {
            query = `
                SELECT 
                    u.id, u.userID, u.name, u.email, u.phone, u.birthdate, 
                    u.created_at, u.profile_image, u.centerID,
                    MAX(ual.created_at) AS last_access
                FROM Users u
                LEFT JOIN UserActivityLogs ual ON ual.user_id = u.id
                WHERE u.role = 'student'
                GROUP BY u.id
                ORDER BY u.created_at DESC
            `;
            params = [];
        } else {
            query = `
                SELECT 
                    u.id, u.userID, u.name, u.email, u.phone, u.birthdate, 
                    u.created_at, u.profile_image, u.centerID,
                    MAX(ual.created_at) AS last_access
                FROM Users u
                LEFT JOIN UserActivityLogs ual ON ual.user_id = u.id
                WHERE u.role = 'student' AND u.centerID = ?
                GROUP BY u.id
                ORDER BY u.created_at DESC
            `;
            params = [teacherCenterId];
        }
        
        const students = await db.queryDatabase(query, params);
        
        res.json({
            success: true,
            students: students,
            count: students.length,
            centerID: teacherCenterId
        });
        
    } catch (error) {
        console.error('학생 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '학생 목록을 불러올 수 없습니다.',
            error: error.message
        });
    }
});

// ============================================
// API: 학생 추가
// ============================================
router.post('/api/students', requireTeacher, async (req, res) => {
    try {
        const { userID, name, email, password, phone, birthdate } = req.body;
        const teacherCenterId = req.session.centerID;
        const teacherRole = req.session.role;
        
        // 필수 입력 확인
        if (!userID || !name || !password) {
            return res.status(400).json({
                success: false,
                message: '아이디, 이름, 비밀번호는 필수입니다.'
            });
        }
        
        // 아이디 중복 확인
        const [existingUser] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '이미 존재하는 아이디입니다.'
            });
        }
        
        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 학생 추가 (교사와 같은 centerID 자동 설정)
        const centerID = teacherRole === 'admin' ? (req.body.centerID || teacherCenterId) : teacherCenterId;
        
        const query = `
            INSERT INTO Users 
            (userID, password, name, email, phone, birthdate, role, centerID, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'student', ?, NOW())
        `;
        
        const result = await db.queryDatabase(query, [
            userID,
            hashedPassword,
            name,
            email || '',
            phone || '',
            birthdate || null,
            centerID
        ]);
        
        res.json({
            success: true,
            message: '학생이 추가되었습니다.',
            studentId: result.insertId
        });
        
    } catch (error) {
        console.error('학생 추가 오류:', error);
        res.status(500).json({
            success: false,
            message: '학생 추가에 실패했습니다.',
            error: error.message
        });
    }
});

// ============================================
// API: 학생 수정
// ============================================
router.put('/api/students/:id', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        const { name, email, password, phone, birthdate } = req.body;
        
        let query, params;
        
        if (password && password.trim() !== '') {
            // 비밀번호 변경 포함
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `
                UPDATE Users 
                SET name = ?, email = ?, password = ?, phone = ?, birthdate = ?
                WHERE id = ? AND role = 'student'
            `;
            params = [name, email || '', hashedPassword, phone || '', birthdate || null, studentId];
        } else {
            // 비밀번호 변경 제외
            query = `
                UPDATE Users 
                SET name = ?, email = ?, phone = ?, birthdate = ?
                WHERE id = ? AND role = 'student'
            `;
            params = [name, email || '', phone || '', birthdate || null, studentId];
        }
        
        await db.queryDatabase(query, params);
        
        res.json({
            success: true,
            message: '학생 정보가 수정되었습니다.'
        });
        
    } catch (error) {
        console.error('학생 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '학생 정보 수정에 실패했습니다.',
            error: error.message
        });
    }
});

// ============================================
// API: 학생 삭제
// ============================================
router.delete('/api/students/:id', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        
        // 학생만 삭제 가능 (안전장치)
        const query = `
            DELETE FROM Users 
            WHERE id = ? AND role = 'student'
        `;
        
        const result = await db.queryDatabase(query, [studentId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: '학생을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '학생이 삭제되었습니다.'
        });
        
    } catch (error) {
        console.error('학생 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '학생 삭제에 실패했습니다.',
            error: error.message
        });
    }
});

// ============================================
// API: 학생 프로필 조회
// ============================================
router.get('/api/students/:id/profile', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        
        const [profile] = await db.queryDatabase(`
            SELECT id, userID, name, email, phone, birthdate, 
                   created_at, profile_image, centerID, last_board_visit
            FROM Users 
            WHERE id = ? AND role = 'student'
        `, [studentId]);
        
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: '학생을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            profile: profile
        });
        
    } catch (error) {
        console.error('학생 프로필 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '학생 정보를 불러올 수 없습니다.',
            error: error.message
        });
    }
});

// ============================================
// API: 학생 활동 로그 조회
// ============================================
router.get('/api/students/:id/logs', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        const limit = req.query.limit || 100;
        
        // UserActivityLogs에서 최근 활동 로그 조회
        const logs = await db.queryDatabase(`
            SELECT action_type, url, ip_address, user_agent, created_at
            FROM UserActivityLogs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `, [studentId, parseInt(limit)]);
        
        res.json({
            success: true,
            logs: logs,
            count: logs.length
        });
        
    } catch (error) {
        console.error('활동 로그 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '활동 로그를 불러올 수 없습니다.',
            error: error.message
        });
    }
});

// ============================================
// API: 학생 학습 기록 조회 (LearningLogs)
// ============================================
router.get('/api/students/:id/learning-logs', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        const limit = req.query.limit || 50;
        
        const learningLogs = await db.queryDatabase(`
            SELECT learning_id, content_type, content_name, 
                   start_time, end_time, duration, progress
            FROM LearningLogs
            WHERE user_id = ?
            ORDER BY start_time DESC
            LIMIT ?
        `, [studentId, parseInt(limit)]);
        
        res.json({
            success: true,
            learningLogs: learningLogs,
            count: learningLogs.length
        });
        
    } catch (error) {
        console.error('학습 로그 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '학습 로그를 불러올 수 없습니다.',
            error: error.message
        });
    }
});

// ============================================
// API: 학생 퀴즈 결과 조회
// ============================================
router.get('/api/students/:id/quiz-results', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        const limit = req.query.limit || 50;
        
        const quizResults = await db.queryDatabase(`
            SELECT id, exam_name, problem_number, 
                   user_answer, is_correct, timestamp
            FROM QuizResults
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `, [studentId, parseInt(limit)]);
        
        res.json({
            success: true,
            quizResults: quizResults,
            count: quizResults.length
        });
        
    } catch (error) {
        console.error('퀴즈 결과 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '퀴즈 결과를 불러올 수 없습니다.',
            error: error.message
        });
    }
});

// ============================================
// 페이지 라우트
// ============================================

// 메인 교사 페이지
router.get('/', requireTeacher, (req, res) => {
    res.render('teacher', {
        userID: req.session.userID,
        role: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID
    });
});

// 학생 관리 페이지
router.get('/student-management', requireTeacher, (req, res) => {
    res.render('teacher/student-management', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: req.session.centerID
    });
});

// 🔥 중복 제거: S3 통합 라우터로 리다이렉트
router.get('/student-files', requireTeacher, (req, res) => {
    res.redirect('/s3/student-files');
});


// 316번째 줄 근처 수정
router.get('/student-detail/:id', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        
        const [student] = await db.queryDatabase(
            'SELECT * FROM Users WHERE id = ? AND role = "student"',
            [studentId]
        );
        
        if (!student) {
            return res.status(404).send('학생을 찾을 수 없습니다.');
        }
        
        const logs = await db.queryDatabase(
            'SELECT * FROM LearningLogs WHERE user_id = ? ORDER BY start_time DESC LIMIT 20',
            [studentId]
        );
        
        const activityLogs = await db.queryDatabase(
            `SELECT created_at, ip_address, user_agent, url, status 
            FROM UserActivityLogs 
            WHERE user_id = ? AND status IN ('login', 'logout')
            ORDER BY created_at DESC 
            LIMIT 50`,
            [studentId]
        );
        
        res.render('teacher/student-detail', { 
            student, 
            logs,
            activityLogs  // 🔥 추가
        });
        
    } catch (error) {
        console.error('학생 상세 조회 오류:', error);
        res.status(500).send('오류 발생');
    }
});


// 진도 데이터 API
router.get('/api/student-progress', requireTeacher, async (req, res) => {
    try {
        const teacherCenterId = req.session.centerID;
        const teacherRole = req.session.role;
        
        const whereClause = teacherRole === 'admin' 
            ? "WHERE u.role = 'student'" 
            : "WHERE u.role = 'student' AND u.centerID = ?";
        
        const query = `
            SELECT 
                u.id AS user_id,
                u.name,
                u.userID AS username,
                u.profile_image,
                COALESCE(COUNT(DISTINCT l.content_name), 0) AS completed_contents,
                COALESCE(total_contents.total_count, 0) AS total_contents,
                ROUND((COUNT(DISTINCT l.content_name) / NULLIF(total_contents.total_count, 0)) * 100, 1) AS progress_rate,
                DATE_FORMAT(MAX(l.end_time), '%Y-%m-%d') AS last_learning_at,
                (
                    SELECT cm.platform
                    FROM LearningLogs ll
                    JOIN ContentMap cm ON cm.content_name = ll.content_name
                    WHERE ll.user_id = u.id
                    ORDER BY ll.end_time DESC
                    LIMIT 1
                ) AS current_platform,
                CASE
                    WHEN COUNT(DISTINCT l.content_name) >= 120 THEN 120
                    WHEN COUNT(DISTINCT l.content_name) >= 70 THEN 70
                    WHEN COUNT(DISTINCT l.content_name) >= 50 THEN 50
                    WHEN COUNT(DISTINCT l.content_name) >= 30 THEN 30
                    ELSE 0
                END AS ct_level
            FROM Users u
            LEFT JOIN LearningLogs l ON l.user_id = u.id
            LEFT JOIN (
                SELECT COUNT(*) AS total_count FROM ContentMap WHERE is_active = 1
            ) AS total_contents ON 1 = 1
            ${whereClause}
            GROUP BY u.id, u.name, u.userID, u.profile_image, total_contents.total_count
            ORDER BY u.name
        `;
        
        const params = teacherRole === 'admin' ? [] : [teacherCenterId];
        const students = await db.queryDatabase(query, params);
        
        res.json({
            success: true,
            students: students
        });
        
    } catch (error) {
        console.error('진도 데이터 로드 오류:', error);
        res.status(500).json({
            success: false,
            message: '진도 데이터를 불러올 수 없습니다.'
        });
    }
});

// 수업 자료 페이지
router.get('/teaching-materials', requireTeacher, (req, res) => {
    res.render('teacher/teaching-materials', {
        userID: req.session.userID,
        role: req.session.role
    });
});

// 진로진학 페이지
router.get('/career-info', requireTeacher, (req, res) => {
    res.render('teacher/career-info', {
        userID: req.session.userID,
        role: req.session.role
    });
});


// ============================================
// API: 학생 통계 (대시보드용)
// ============================================
router.get('/api/students/:id/stats', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        
        // 총 학습 시간
        const [learningTimeResult] = await db.queryDatabase(`
            SELECT SUM(duration) as totalLearningTime, COUNT(*) as sessionCount
            FROM LearningLogs
            WHERE user_id = ?
        `, [studentId]);
        
        // 퀴즈 정답률
        const [quizStatsResult] = await db.queryDatabase(`
            SELECT 
                COUNT(*) as totalQuizzes,
                SUM(is_correct) as correctCount
            FROM QuizResults
            WHERE user_id = ?
        `, [studentId]);
        
        // 최근 접속
        const [lastAccessResult] = await db.queryDatabase(`
            SELECT created_at as lastAccess
            FROM UserActivityLogs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [studentId]);
        
        res.json({
            success: true,
            stats: {
                totalLearningTime: learningTimeResult?.totalLearningTime || 0,
                sessionCount: learningTimeResult?.sessionCount || 0,
                totalQuizzes: quizStatsResult?.totalQuizzes || 0,
                correctCount: quizStatsResult?.correctCount || 0,
                accuracy: quizStatsResult?.totalQuizzes > 0 
                    ? ((quizStatsResult.correctCount / quizStatsResult.totalQuizzes) * 100).toFixed(1)
                    : 0,
                lastAccess: lastAccessResult?.lastAccess || null
            }
        });
        
    } catch (error) {
        console.error('학생 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '통계를 불러올 수 없습니다.',
            error: error.message
        });
    }
});

// ============================================
// 🔥 API: 학생 제출물 조회 (Entry/Scratch)
// ============================================
router.get('/api/students/:id/submissions', requireTeacher, checkSameCenter, async (req, res) => {
    try {
        const studentId = req.params.id;
        const platform = req.query.platform || 'entry'; // 'entry' or 'scratch'
        
        // ProjectSubmissions 테이블에서 제출물 조회
        const submissions = await db.queryDatabase(`
            SELECT 
                ps.id,
                ps.project_name,
                ps.submission_type,
                ps.s3_file_path,
                ps.file_size_kb,
                ps.submitted_at,
                ps.blocks_count,
                ps.sprites_count,
                ps.complexity_score
            FROM ProjectSubmissions ps
            WHERE ps.user_id = ? AND ps.platform = ? AND ps.submission_type = 'final'
            ORDER BY ps.submitted_at DESC
        `, [studentId, platform]);
        
        // S3 URL 생성
        const submissionsWithUrl = submissions.map(sub => ({
            ...sub,
            s3_url: `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${sub.s3_file_path}`,
            file_size_mb: (sub.file_size_kb / 1024).toFixed(2)
        }));
        
        res.json({
            success: true,
            submissions: submissionsWithUrl,
            count: submissions.length
        });
        
    } catch (error) {
        console.error('제출물 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '제출물을 불러올 수 없습니다.',
            error: error.message
        });
    }
});

// ============================================
// 🔥 API: 모든 학생 제출물 목록 (선생님 대시보드용)
// ============================================
router.get('/api/all-submissions', requireTeacher, async (req, res) => {
    try {
        const teacherCenterId = req.session.centerID;
        const teacherRole = req.session.role;
        const platform = req.query.platform || 'entry';
        
        let query, params;
        
        if (teacherRole === 'admin') {
            query = `
                SELECT 
                    ps.id,
                    ps.project_name,
                    ps.s3_file_path,
                    ps.file_size_kb,
                    ps.submitted_at,
                    u.id as user_id,
                    u.userID,
                    u.name as user_name,
                    u.centerID
                FROM ProjectSubmissions ps
                JOIN Users u ON ps.user_id = u.id
                WHERE ps.platform = ? AND ps.submission_type = 'final'
                ORDER BY ps.submitted_at DESC
                LIMIT 100
            `;
            params = [platform];
        } else {
            query = `
                SELECT 
                    ps.id,
                    ps.project_name,
                    ps.s3_file_path,
                    ps.file_size_kb,
                    ps.submitted_at,
                    u.id as user_id,
                    u.userID,
                    u.name as user_name,
                    u.centerID
                FROM ProjectSubmissions ps
                JOIN Users u ON ps.user_id = u.id
                WHERE ps.platform = ? AND ps.submission_type = 'final' AND u.centerID = ?
                ORDER BY ps.submitted_at DESC
                LIMIT 100
            `;
            params = [platform, teacherCenterId];
        }
        
        const submissions = await db.queryDatabase(query, params);
        
        // S3 URL 추가
        const submissionsWithUrl = submissions.map(sub => ({
            ...sub,
            s3_url: `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${sub.s3_file_path}`,
            file_size_mb: (sub.file_size_kb / 1024).toFixed(2)
        }));
        
        res.json({
            success: true,
            submissions: submissionsWithUrl,
            count: submissions.length
        });
        
    } catch (error) {
        console.error('제출물 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '제출물 목록을 불러올 수 없습니다.',
            error: error.message
        });
    }
});

module.exports = router;