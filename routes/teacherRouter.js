const express = require('express');
const router = express.Router();
const db = require('../lib_login/db');
const bcrypt = require('bcrypt');
const { getSheetData } = require('../lib_google/sheetService'); // 🔥 Google Sheet Service Import

// ============================================
// 미들웨어: 교사 권한 확인
// ============================================
const requireTeacher = (req, res, next) => {
    const allowedRoles = ['teacher', 'manager', 'admin'];
    if (!req.session || !req.session.is_logined) {
        // API 요청인 경우 JSON 응답
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }
        // 페이지 요청인 경우 로그인 페이지로 리다이렉트
        return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    if (!allowedRoles.includes(req.session.role)) {
        // API 요청인 경우 JSON 응답
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                message: '교사/관리자 권한이 필요합니다.'
            });
        }
        // 페이지 요청인 경우 에러 페이지 또는 홈으로 리다이렉트
        return res.status(403).send('교사/관리자 권한이 필요합니다. <a href="/">홈으로 돌아가기</a>');
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


// 🔥 데이터 그룹화 헬퍼 함수 (from kinderRouter.js logic)
// To keep isolation, defined here locally.
function groupByVolume(rows) {
    const groups = {};
    rows.forEach(row => {
        // Data Structure based on User Request:
        // [0]Page, [1]Category, [2]Group by, [3]차시명, [4]주제, [5]활동명, [6]CT, [7]강의자, [8]시간, [9]URL, [10]Download, [11]Thumb, [12~]IMG...

        if (!row[2] || !row[3]) return;

        const groupName = row[2]; // Group by
        if (!groups[groupName]) {
            groups[groupName] = { title: groupName, sessions: [] };
        }

        // Images start from Index 12 (IMG-1) to Index 23 (IMG-12)
        const images = row.slice(12, 24).filter(img => img && img.trim().startsWith('http'));

        groups[groupName].sessions.push({
            name: row[3], // 차시명
            topic: row[5] || row[4] || '', // 활동명 fallback to 주제
            videoUrl: row[9], // URL
            thumbnail: row[11], // Thumb
            images: images
        });
    });
    return Object.values(groups);
}

// ============================================
// 수업 자료 - 서브메뉴
// ============================================

// 수업 자료 메인 리다이렉트
router.get('/class-materials', requireTeacher, (req, res) => {
    res.redirect('/teacher/class-materials/lessons');
});

// 🔥 교안 및 영상 (Teacher! Sheet)
router.get('/class-materials/lessons', requireTeacher, async (req, res) => {
    try {
        // Fetch 'Teacher!' Sheet Data
        // Range A:X covers up to IMG-12
        const teacherSheetData = await getSheetData('Teacher!A:X');

        // Group Data
        // Extract unique categories from Column A (Index 0) - "Page" column
        // Filter out '페이지' which is likely the header row
        const allCategories = [...new Set(teacherSheetData
            .map(row => row[0] ? row[0].trim() : '')
            .filter(c => c !== '' && c !== '페이지')
        )];

        // Native sheet order approach:
        const categoriesInOrder = [];
        const seen = new Set();
        teacherSheetData.forEach(row => {
            const c = row[0] ? row[0].trim() : '';
            if (c && c !== '페이지' && !seen.has(c)) {
                seen.add(c);
                categoriesInOrder.push(c);
            }
        });

        // Helper filter
        const filterByCategory = (rows, categoryKeyword) => {
            return rows.filter(row => row[0] && row[0] === categoryKeyword); // Use exact match for Page column
        };

        // Create Tabs structure
        const lessonTabs = categoriesInOrder.map((cat, index) => {
            return {
                id: `dynamic-tab-${index}`,
                title: cat,
                groups: groupByVolume(filterByCategory(teacherSheetData, cat))
            };
        });

        res.render('teacher/class_materials_lessons', {
            // Main Tab Titles
            pageTitle: '교사 교육자료',

            // Dynamic Tabs Data
            lessonTabs,

            // Board Tab Data (Not needed for this view but passing empty just in case)
            preschoolTitle: '',
            preschoolAITitle: '',
            preschoolItems: [],
            preschoolAIItems: []
        });

    } catch (error) {
        console.error('Teacher page error:', error);
        res.status(500).send('자료를 불러오는 중 오류가 발생했습니다.');
    }
});

// 다운로드 폴더
router.get('/class-materials/downloads', requireTeacher, (req, res) => {
    res.render('teacher/class_materials_downloads', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: req.session.centerID,
        currentView: 'downloads'
    });
});

// ============================================
// 진로 진학 - 서브메뉴
// ============================================

// 진로 진학 메인 리다이렉트
router.get('/career-info', requireTeacher, (req, res) => {
    res.redirect('/teacher/career-info/university');
});

// 대학정보
router.get('/career-info/university', requireTeacher, (req, res) => {
    res.render('teacher/career_info_university', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: req.session.centerID,
        currentView: 'university'
    });
});

// 입결라인
router.get('/career-info/cutlines', requireTeacher, (req, res) => {
    res.render('teacher/career_info_cutlines', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: req.session.centerID,
        currentView: 'cutlines'
    });
});

// 블로그
router.get('/career-info/blog', requireTeacher, (req, res) => {
    res.render('teacher/career_info_blog', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: req.session.centerID,
        currentView: 'blog'
    });
});

router.get('/api/students', requireTeacher, async (req, res) => {
    try {
        const teacherCenterId = req.session.centerID;
        const teacherRole = req.session.role;

        let query, params;

        if (teacherRole === 'admin') {
            const filterCenterId = req.query.centerID;
            if (filterCenterId) {
                // Admin filtering by specific center
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
                params = [filterCenterId];
            } else {
                // Admin viewing all students
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
            }
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
        // 이미 존재하는 아이디 (Race Condition 등) 처리
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return res.status(400).json({
                success: false,
                message: '이미 존재하는 아이디입니다.'
            });
        }

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

        // 1. 연관 데이터(로그 및 활동 내역) 먼저 삭제
        await db.queryDatabase('DELETE FROM UserActivityLogs WHERE user_id = ?', [studentId]);
        await db.queryDatabase('DELETE FROM MenuAccessLogs WHERE user_id = ?', [studentId]);
        await db.queryDatabase('DELETE FROM LearningLogs WHERE user_id = ?', [studentId]);

        // 게임 점수 및 퀴즈 결과
        await db.queryDatabase('DELETE FROM DragGameScores WHERE user_id = ?', [studentId]);
        await db.queryDatabase('DELETE FROM MoleGameScores WHERE user_id = ?', [studentId]);
        await db.queryDatabase('DELETE FROM QuizResults WHERE user_id = ?', [studentId]);

        // 포트폴리오 및 커뮤니티 글
        await db.queryDatabase('DELETE FROM PortfolioProjects WHERE user_id = ?', [studentId]);
        await db.queryDatabase('DELETE FROM nuguritalk_posts WHERE author_id = ?', [studentId]);

        // 3. User의 centerID가 FK로 걸려있는 경우를 대비해 연결 해제
        // (LearningLogs 등이 Users.centerID를 참조하고 있어, 같은 centerID를 가진 학생 삭제 시 FK 제약 충돌 발생 가능)
        // -> 위 UPDATE 방식보다 확실하게, FK 체크를 일시 해제하고 삭제 (이미 자식 데이터는 삭제했으므로 안전)
        const query = `
            DELETE FROM Users 
            WHERE id = ? AND role = 'student'
        `;

        const result = await db.executeNoFKCheck(query, [studentId]);

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
// API: 월별 출석 현황 (캘린더용)
// ============================================
router.get('/api/attendance/monthly', requireTeacher, async (req, res) => {
    try {
        const teacherCenterId = req.session.centerID;
        const year = parseInt(req.query.year);
        const month = parseInt(req.query.month);

        if (!year || !month) {
            return res.status(400).json({ success: false, message: '연도와 월을 지정해주세요.' });
        }

        // 🔥 Admin Center Check
        let targetCenterId = teacherCenterId;
        if (req.session.role === 'admin' && req.query.centerID) {
            targetCenterId = req.query.centerID;
        }

        const query = `
            SELECT 
                u.id, 
                u.name, 
                DATE_FORMAT(ual.created_at, '%e') as day,
                DATE_FORMAT(MIN(ual.created_at), '%H:%i') as time
            FROM UserActivityLogs ual
            JOIN Users u ON ual.user_id = u.id
            WHERE u.centerID = ? 
              AND YEAR(ual.created_at) = ? 
              AND MONTH(ual.created_at) = ?
              AND u.role = 'student'
            GROUP BY u.id, DATE(ual.created_at)
            ORDER BY DATE(ual.created_at) ASC, MIN(ual.created_at) ASC
        `;

        const attendanceData = await db.queryDatabase(query, [targetCenterId, year, month]);

        res.json({
            success: true,
            data: attendanceData
        });

    } catch (error) {
        console.error('출석 현황 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '출석 데이터를 불러올 수 없습니다.'
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

// 학생 관리 페이지 (Redirect to default)
router.get('/student-management', requireTeacher, (req, res) => {
    res.redirect('/teacher/student-management/progress');
});

// 학생 관리 - 학습 진도
// Helper to get centers from Sheet
async function getCenterList() {
    try {
        const rows = await getSheetData('센터목록!A2:B'); // ID, Name
        if (!rows || rows.length === 0) return [];
        return rows.map(row => ({ id: row[0], name: row[1] }));
    } catch (e) {
        console.error('Center fetch error:', e);
        return [];
    }
}

// 학생 관리 - 학습 진도
router.get('/student-management/progress', requireTeacher, async (req, res) => {
    let centers = [];
    if (req.session.role === 'admin') {
        centers = await getCenterList();
    }

    // Default Admin Center: 0 (CodingAndPlay) if not specified
    // But initially user wants "Default 0", meaning if query is empty, treat as center 0?
    // Or just show all? User said "Admin default 0 CodingAndPlay".
    // I will pass centerID as query || 0 if admin? No, let's stick to query || session.
    // If Admin has no centerID in session, usage of '0' might be needed.
    // Typically Admin session.centerID might be null or 0.

    // Check if Admin needs default selection in UI
    let targetCenter = req.query.centerID;
    if (req.session.role === 'admin' && !targetCenter) {
        targetCenter = '0'; // Default to 0 as requested
    }

    res.render('teacher/student-management', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: targetCenter || req.session.centerID,
        currentView: 'progress',
        centers: centers,
        ajax: req.query.ajax
    });
});

// 학생 관리 - 학생 목록
router.get('/student-management/list', requireTeacher, async (req, res) => {
    let centers = [];
    if (req.session.role === 'admin') {
        centers = await getCenterList();
    }

    let targetCenter = req.query.centerID;
    if (req.session.role === 'admin' && !targetCenter) {
        targetCenter = '0';
    }

    res.render('teacher/student-management', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: targetCenter || req.session.centerID,
        currentView: 'list',
        centers: centers,
        ajax: req.query.ajax
    });
});

// 학생 관리 - 출석부
router.get('/student-management/attendance', requireTeacher, async (req, res) => {
    let centers = [];
    if (req.session.role === 'admin') {
        centers = await getCenterList();
    }

    let targetCenter = req.query.centerID;
    if (req.session.role === 'admin' && !targetCenter) {
        targetCenter = '0';
    }

    res.render('teacher/student-management', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: targetCenter || req.session.centerID,
        currentView: 'attendance',
        centers: centers,
        ajax: req.query.ajax
    });
});



// 진로 진학 (Coming Soon)
router.get('/career-info', requireTeacher, (req, res) => {
    res.render('teacher/student-management', {
        userID: req.session.userID,
        role: req.session.role,
        centerID: req.session.centerID,
        currentView: 'career-info'
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
            `SELECT created_at, ip_address, user_agent, url, status, action_type, action_detail 
            FROM UserActivityLogs 
            WHERE user_id = ?
            ORDER BY created_at DESC 
            LIMIT 50`,
            [studentId]
        );

        const centers = await getCenterList();
        // console.log('Centers:', centers);
        // console.log('Student CenterID:', student.centerID);
        const centerObj = centers.find(c => String(c.id).trim() === String(student.centerID).trim());
        student.centerName = centerObj ? centerObj.name : '소속 없음';

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

        let whereClause = "WHERE u.role = 'student' AND u.centerID = ?";
        let params = [teacherCenterId];

        if (teacherRole === 'admin') {
            const filterCenterId = req.query.centerID;
            if (filterCenterId) {
                whereClause = "WHERE u.role = 'student' AND u.centerID = ?";
                params = [filterCenterId];
            } else {
                whereClause = "WHERE u.role = 'student'";
                params = [];
            }
        }

        const query = `
            SELECT
                u.id AS user_id,
                u.name,
                u.userID AS username,
                u.profile_image,
                DATE_FORMAT(MAX(COALESCE(l.end_time, l.start_time)), '%Y-%m-%d') AS last_learning_at,

                -- Platform: Scratch (학습 일수 기반)
                COUNT(DISTINCT CASE
                    WHEN l.content_type = 'scratch' AND l.content_name LIKE '%/scratch_project%'
                    THEN DATE(l.start_time)
                END) AS scratch_completed,
                (SELECT COUNT(*) FROM ContentMap WHERE LOWER(platform) = 'scratch' AND is_active = 1) AS scratch_total,

                -- Platform: Entry (학습 일수 기반)
                COUNT(DISTINCT CASE
                    WHEN l.content_type = 'entry' AND (l.content_name LIKE '%/entry_project%' OR l.content_name LIKE '%/entry/api%')
                    THEN DATE(l.start_time)
                END) AS entry_completed,
                (SELECT COUNT(*) FROM ContentMap WHERE LOWER(platform) = 'entry' AND is_active = 1) AS entry_total,

                -- Platform: App Inventor
                COUNT(DISTINCT CASE
                    WHEN l.content_type = 'appinventor'
                    THEN DATE(l.start_time)
                END) AS appinventor_completed,
                (SELECT COUNT(*) FROM ContentMap WHERE LOWER(platform) IN ('appinventor', 'app_inventor', 'app inventor') AND is_active = 1) AS appinventor_total,

                -- Platform: Python (학습 일수 기반)
                COUNT(DISTINCT CASE
                    WHEN l.content_type = 'python'
                    THEN DATE(l.start_time)
                END) AS python_completed,
                (SELECT COUNT(*) FROM ContentMap WHERE LOWER(platform) = 'python' AND is_active = 1) AS python_total,

                -- Platform: Data Analysis
                COUNT(DISTINCT CASE
                    WHEN l.content_type IN ('data_analysis', 'dataanalysis', 'data')
                    THEN DATE(l.start_time)
                END) AS dataanalysis_completed,
                (SELECT COUNT(*) FROM ContentMap WHERE LOWER(platform) IN ('data_analysis', 'dataanalysis', 'data analysis', 'data') AND is_active = 1) AS dataanalysis_total,

                -- CT Level Logic (Overall - 전체 학습 일수 기반)
                CASE
                    WHEN COUNT(DISTINCT DATE(l.start_time)) >= 120 THEN 120
                    WHEN COUNT(DISTINCT DATE(l.start_time)) >= 70 THEN 70
                    WHEN COUNT(DISTINCT DATE(l.start_time)) >= 50 THEN 50
                    WHEN COUNT(DISTINCT DATE(l.start_time)) >= 30 THEN 30
                    ELSE 0
                END AS ct_level,

                COALESCE(usu.total_usage, 0) AS storage_usage

            FROM Users u
            LEFT JOIN LearningLogs l ON l.user_id = u.id
            LEFT JOIN UserStorageUsage usu ON usu.user_id = u.id
            ${whereClause}
            GROUP BY u.id, u.name, u.userID, u.profile_image, usu.total_usage
            ORDER BY u.name
        `;


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