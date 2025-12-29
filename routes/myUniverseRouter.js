const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../lib_login/db');

// 🚀 Caching for Problem Data
let problemCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getProblemMap(req) { // Pass req to access getSheetData if needed
    const now = Date.now();
    if (problemCache && (now - lastCacheTime < CACHE_TTL)) {
        return problemCache;
    }

    try {
        // Use global getSheetData or require it
        const { getSheetData } = require('../lib_google/sheetService');
        const rows = await getSheetData('problems!A2:C'); // A: ID?, B: Key, C: Title

        const map = new Map();
        if (rows && rows.length) {
            rows.forEach(row => {
                // Assuming B is the ID/Key (e.g., 'cospro_3-1_p08' or 'cpe1-1a')
                // and C is the Title. 
                // Adjust index based on inspecting 'update_excel_p08.py' which implied col 1 (B) is Key.
                // Row structure: [A, B, C] -> indices 0, 1, 2
                if (row[1] && row[2]) {
                    map.set(row[1].trim(), row[2].trim());
                }
            });
        }

        problemCache = map;
        lastCacheTime = now;
        // console.log(`Problem Map Cached: ${map.size} items`);
        return map;
    } catch (e) {
        console.error('Failed to load problem map:', e);
        return new Map(); // Empty map fallback
    }
}

// Helper to get friendly title and platform
const getFriendlyInfo = (item, problemMap) => {
    let platform = '';
    let name = item.title;

    // 1. Direct Types (Blog, Gallery, Badge)
    if (item.type !== 'log' && item.title && item.title !== 'User Activity') {
        return { platform: item.type.toUpperCase(), name: item.title };
    }

    // 2. Log Types
    const actionType = item.title;

    if (actionType === 'login') return { platform: 'SYSTEM', name: '로그인 (Login)' };
    if (actionType === 'logout') return { platform: 'SYSTEM', name: '로그아웃 (Logout)' };

    // Portfolio / Project Uploads
    if (actionType === 'portfolio_upload') {
        try {
            const detail = JSON.parse(item.metadata || '{}');
            name = detail.projectName || '프로젝트 업로드';
        } catch (e) {
            name = '프로젝트 업로드';
        }
        return { platform: 'PORTFOLIO', name };
    }

    // Entry Projects
    if (actionType.includes('entry') || actionType.includes('cpe')) {
        platform = '엔트리';
        try {
            const detail = JSON.parse(item.metadata || '{}');
            const url = detail.s3Url || detail.projectUrl;

            if (url) {
                let filename = url.substring(url.lastIndexOf('/') + 1);
                filename = decodeURIComponent(filename);
                // Remove extension
                filename = filename.replace(/\.(ent|sb2|sb3)$/i, '');

                // 1. Try Lookup in Problem Map
                if (problemMap && problemMap.has(filename)) {
                    name = problemMap.get(filename);
                } else {
                    // 2. Fallback formatting
                    name = filename.replace(/_/g, ' ');
                }
            } else {
                name = '프로젝트 학습';
            }
        } catch (e) {
            name = '프로젝트 학습';
        }
        return { platform, name };
    }

    if (actionType.includes('scratch')) return { platform: '스크래치', name: '학습 진행' };
    if (actionType.includes('python')) return { platform: '파이썬', name: '학습 진행' };
    if (actionType.includes('appinventor') || actionType.includes('app_inventor')) return { platform: '앱인벤터', name: '학습 진행' };

    return { platform: 'LOG', name: actionType || 'Activity' };
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

const processLogs = async (logs) => {
    const problemMap = await getProblemMap(); // Load data

    return logs.map(log => {
        const dateObj = new Date(log.created_at);
        const info = getFriendlyInfo(log, problemMap); // Get platform and name

        // Metadata parsing for detail view
        let finalUrl = '#'; // Default to no-op

        // ... (Original Metadata Parsing - kept same logic mostly)
        if (log.type === 'log') {
            try {
                if (log.metadata && (log.metadata.startsWith('{') || log.metadata.startsWith('['))) {
                    const detail = JSON.parse(log.metadata);
                    if (detail.projectUrl) finalUrl = detail.projectUrl;
                    else if (detail.s3Url) finalUrl = detail.s3Url;
                    if (log.title.includes('entry_load_project')) {
                        if (detail.s3Url) {
                            finalUrl = '/entry?s3Url=' + encodeURIComponent(detail.s3Url);
                        } else {
                            finalUrl = '/entry/workspace';
                        }
                    }
                } else {
                    if (log.metadata && log.metadata.startsWith('http')) {
                        finalUrl = log.metadata;
                    }
                }
            } catch (e) { console.error(e); }
        } else if (log.type === 'gallery') {
            finalUrl = `/gallery/project/${log.id}`;
        } else if (log.type === 'blog') {
            finalUrl = `/posts/${log.id}`;
        }

        return {
            dateStr: dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }),
            timeStr: dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }),
            title: info.name,
            platform: info.platform, // New field for badge
            iconClass: getIconClass(log),
            url: finalUrl,
            status: 'Completed',
            action_type: (log.type || 'Activity').toUpperCase()
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
// ============================================
// Timeline Tab (Previously Portfolio)
// ============================================
router.get('/timeline', async (req, res) => {
    try {
        if (!req.session.is_logined) {
            return res.redirect('/auth/login');
        }

        // Resolve numeric DB ID if not in session
        let studentId = req.session.dbId;
        if (!studentId && req.session.userID) {
            const [user] = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [req.session.userID]);
            if (user) studentId = user.id;
        }

        if (!studentId) {
            return res.redirect('/auth/login');
        }

        const activityLogs = await db.queryDatabase(`
            SELECT * FROM (
                -- 1. Gallery Projects
                SELECT 
                    'gallery' as type, 
                    title COLLATE utf8mb4_unicode_ci as title, 
                    created_at, 
                    id, 
                    thumbnail_url COLLATE utf8mb4_unicode_ci as metadata 
                FROM gallery_projects 
                WHERE user_id = ?

                UNION ALL

                -- 2. Blog Posts
                SELECT 
                    'blog' as type, 
                    title COLLATE utf8mb4_unicode_ci as title, 
                    created_at, 
                    id, 
                    excerpt COLLATE utf8mb4_unicode_ci as metadata 
                FROM user_blog_posts 
                WHERE user_id = ?

                UNION ALL

                -- 3. Badges
                SELECT 
                    'badge' as type, 
                    badge_code COLLATE utf8mb4_unicode_ci as title, 
                    earned_at as created_at, 
                    id, 
                    NULL as metadata 
                FROM user_badges 
                WHERE user_id = ?

                UNION ALL

                -- 4. User Activity Logs
                SELECT 
                    'log' as type, 
                    action_type COLLATE utf8mb4_unicode_ci as title, 
                    created_at, 
                    log_id as id, 
                    action_detail COLLATE utf8mb4_unicode_ci as metadata 
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
        const timelineItems = await processLogs(activityLogs);

        res.render('my-universe/index', {
            activeTab: 'timeline',
            timelineItems,
            userID: req.session.userID,
            userRole: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID
        });

    } catch (error) {
        console.error('My Timeline Error:', error);
        res.status(500).send('Error loading timeline');
    }
});

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
                    title COLLATE utf8mb4_unicode_ci as title, 
                    created_at, 
                    id, 
                    thumbnail_url COLLATE utf8mb4_unicode_ci as metadata 
                FROM gallery_projects 
                WHERE user_id = ?

                UNION ALL

                -- 2. Blog Posts
                SELECT 
                    'blog' as type, 
                    title COLLATE utf8mb4_unicode_ci as title, 
                    created_at, 
                    id, 
                    excerpt COLLATE utf8mb4_unicode_ci as metadata 
                FROM user_blog_posts 
                WHERE user_id = ?

                UNION ALL

                -- 3. Badges
                SELECT 
                    'badge' as type, 
                    badge_code COLLATE utf8mb4_unicode_ci as title, 
                    earned_at as created_at, 
                    id, 
                    NULL as metadata 
                FROM user_badges 
                WHERE user_id = ?

                UNION ALL

                -- 4. User Activity Logs
                SELECT 
                    'log' as type, 
                    action_type COLLATE utf8mb4_unicode_ci as title, 
                    created_at, 
                    log_id as id, 
                    action_detail COLLATE utf8mb4_unicode_ci as metadata 
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
