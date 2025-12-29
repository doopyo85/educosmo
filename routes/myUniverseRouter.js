const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../lib_login/db');

// Helper to get friendly title
const getFriendlyTitle = (item) => {
    // 1. If it has a direct title (Blog, Gallery, Badge), use it
    if (item.title && item.title !== 'User Activity') return item.title;

    // 2. Map log types
    const actionType = item.title; // In the query below, we map action_type to title for logs

    if (actionType === 'login') return '로그인 (Login)';
    if (actionType === 'logout') return '로그아웃 (Logout)';
    if (actionType === 'portfolio_upload') {
        try {
            const detail = JSON.parse(item.metadata || '{}');
            return detail.projectName || '프로젝트 업로드';
        } catch (e) {
            return '프로젝트 업로드';
        }
    }
    if (!actionType) return 'Activity';

    if (actionType.includes('entry')) return '엔트리 학습';
    if (actionType.includes('scratch')) return '스크래치 학습';
    if (actionType.includes('python')) return '파이썬 학습';

    return actionType;
};

// Helper to get icon class
const getIconClass = (item) => {
    switch (item.type) {
        case 'submit':
        case 'gallery':
            return 'bi-file-earmark-code-fill text-primary'; // Blue
        case 'solve':
            return 'bi-check-circle-fill text-success'; // Green
        case 'blog':
            return 'bi-pencil-square text-warning'; // Orange
        case 'badge':
            return 'bi-trophy-fill text-warning'; // Gold
        case 'log':
            if (item.title === 'login') return 'bi-door-open-fill text-success';
            if (item.title === 'portfolio_upload') return 'bi-cloud-upload-fill text-info';
            return 'bi-activity text-secondary';
        default: return 'bi-circle-fill text-secondary';
    }
};

const processLogs = (logs) => {
    return logs.map(log => {
        const dateObj = new Date(log.created_at);
        const finalTitle = getFriendlyTitle(log);

        // Metadata parsing for detail view
        let finalUrl = log.metadata || '#';
        if (log.type === 'log' && log.title === 'portfolio_upload') {
            try {
                const detail = JSON.parse(log.metadata || '{}');
                finalUrl = detail.s3Url || '#';
            } catch (e) { }
        }

        return {
            dateStr: dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
            timeStr: dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            title: finalTitle,
            iconClass: getIconClass(log),
            url: finalUrl,
            status: 'Completed', // Default
            action_type: (log.type || 'Activity').toUpperCase() // For display label
        };
    });
};

// Middleware (assuming these are defined elsewhere or will be added)
const authenticateUser = (req, res, next) => {
    if (!req.session.is_logined) {
        return res.redirect('/auth/login');
    }
    // Assuming dbId and user object are set in session after login
    if (!req.session.dbId) {
        // This might happen if session is old or user data is incomplete
        // Re-fetch or redirect to login to refresh session
        return res.redirect('/auth/login');
    }
    next();
};

const requireTeacher = (req, res, next) => {
    if (!['teacher', 'manager', 'admin'].includes(req.session.role)) {
        return res.status(403).send('권한이 없습니다.');
    }
    next();
};

const checkSameCenter = async (req, res, next) => {
    const studentId = req.params.id;
    const teacherRole = req.session.role;
    const teacherCenterId = req.session.centerID;

    if (teacherRole === 'admin') {
        return next(); // Admins can view any student
    }

    try {
        const [student] = await db.queryDatabase(
            'SELECT centerID FROM Users WHERE id = ? AND role = "student"',
            [studentId]
        );

        if (!student) {
            return res.status(404).send('학생을 찾을 수 없습니다.');
        }

        if (student.centerID !== teacherCenterId) {
            return res.status(403).send('다른 센터 학생입니다.');
        }
        next();
    } catch (error) {
        console.error('Center check error:', error);
        res.status(500).send('Error checking student center.');
    }
};


// ============================================
// Main My Universe Route (Redirect)
// ============================================
router.get('/', (req, res) => {
    res.redirect('/my-universe/timeline');
});

// ============================================
// Timeline Tab (Previously Portfolio)
// ============================================

// ============================================
// Observatory Tab
// ============================================
router.get('/observatory', (req, res) => {
    // Basic auth check
    if (!req.session.is_logined) {
        return res.redirect('/auth/login');
    }

    res.render('my-universe/index', {
        activeTab: 'observatory',
        userID: req.session.userID,
        userRole: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID
    });
});

// ============================================
// Teacher View: Student Timeline
// ============================================
router.get('/student/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        const teacherRole = req.session.role;
        const teacherCenterId = req.session.centerID;

        // Teacher/Admin check
        if (!['teacher', 'manager', 'admin'].includes(teacherRole)) {
            return res.status(403).send('권한이 없습니다.');
        }

        const [student] = await db.queryDatabase(
            'SELECT * FROM Users WHERE id = ? AND role = "student"',
            [studentId]
        );

        if (!student) {
            return res.status(404).send('학생을 찾을 수 없습니다.');
        }

        // Center check
        if (teacherRole !== 'admin' && student.centerID !== teacherCenterId) {
            return res.status(403).send('다른 센터 학생입니다.');
        }

        const activityLogs = await db.queryDatabase(`
            SELECT * FROM (
                -- 1. Gallery Projects
                SELECT 
                    'gallery' as type, 
                    title, 
                    created_at, 
                    id, 
                    thumbnail_url as metadata 
                FROM gallery_projects 
                WHERE user_id = ?

                UNION ALL

                -- 2. Blog Posts
                SELECT 
                    'blog' as type, 
                    title, 
                    created_at, 
                    id, 
                    excerpt as metadata 
                FROM user_blog_posts 
                WHERE user_id = ?

                UNION ALL

                -- 3. Badges
                SELECT 
                    'badge' as type, 
                    badge_code as title, 
                    earned_at as created_at, 
                    id, 
                    NULL as metadata 
                FROM user_badges 
                WHERE user_id = ?

                UNION ALL

                -- 4. User Activity Logs
                SELECT 
                    'log' as type, 
                    action_type as title, 
                    created_at, 
                    log_id as id, 
                    action_detail as metadata 
                FROM UserActivityLogs 
                WHERE user_id = ? 
                AND (
                    action_type = 'portfolio_upload' 
                    OR action_type = 'login'
                    OR action_type LIKE '%entry%'
                    OR action_type LIKE '%scratch%'
                    OR action_type LIKE '%python%'
                )
            ) AS UnifiedTimeline
            ORDER BY created_at DESC
            LIMIT 50
        `, [studentId, studentId, studentId, studentId]);

        // Process logs for view
        const timelineItems = processLogs(activityLogs);

        console.log('--- STUDENT TIMELINE DATA ---');
        console.log(JSON.stringify(timelineItems, null, 2));
        console.log('-----------------------------');

        res.render('my-universe/index', {
            activeTab: 'timeline',
            student,
            timelineItems, // Pass processed items
            readOnly: true, // Teacher view is read-only
            userID: req.session.userID,
            userRole: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID
        });

    } catch (error) {
        console.error('Student Timeline Error:', error);
        res.status(500).send('Error loading student timeline');
    }
});

// ============================================
// Teacher View: Student Observatory
// ============================================
router.get('/student/:id/observatory', async (req, res) => {
    try {
        const studentId = req.params.id;
        const teacherRole = req.session.role;
        const teacherCenterId = req.session.centerID;

        // Teacher/Admin check
        if (!['teacher', 'manager', 'admin'].includes(teacherRole)) {
            return res.status(403).send('권한이 없습니다.');
        }

        const [student] = await db.queryDatabase(
            'SELECT * FROM Users WHERE id = ? AND role = "student"',
            [studentId]
        );

        if (!student) {
            return res.status(404).send('학생을 찾을 수 없습니다.');
        }

        // Center check
        if (teacherRole !== 'admin' && student.centerID !== teacherCenterId) {
            return res.status(403).send('다른 센터 학생입니다.');
        }

        res.render('my-universe/index', {
            activeTab: 'observatory',
            student,
            readOnly: true,
            userID: req.session.userID,
            userRole: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID
        });

    } catch (error) {
        console.error('Student Observatory Error:', error);
        res.status(500).send('Error loading student observatory');
    }
});


module.exports = router;
