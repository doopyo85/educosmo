const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../lib_login/db');

// 🚀 Caching for Problem Data (Enhanced with Tags)
let problemCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getProblemMetadataMap() {
    const now = Date.now();
    if (problemCache && (now - lastCacheTime < CACHE_TTL)) {
        return problemCache;
    }

    try {
        const { getSheetData } = require('../lib_google/sheetService');
        // Fetch all columns A-N for comprehensive metadata
        const rows = await getSheetData('problems!A2:N500');

        const map = new Map();
        if (rows && rows.length) {
            rows.forEach(row => {
                // Ensure row has enough columns
                while (row.length < 14) row.push('');

                // Key: exam_name + problem_number (lowercase for matching)
                const examName = (row[1] || '').trim();
                const problemNumber = (row[2] || '').trim();
                const key = `${examName.toLowerCase()}_${problemNumber.toLowerCase()}`;

                map.set(key, {
                    examName: examName,
                    problemNumber: problemNumber,
                    concept: row[3] || '',
                    difficulty: row[10] || '1',
                    questionType: row[11] || '',
                    tags: row[12] || ''
                });
            });
        }

        problemCache = map;
        lastCacheTime = now;
        return map;
    } catch (e) {
        console.error('Failed to load problem metadata:', e);
        return new Map();
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

const processLogs = async (logs, currentUser) => {
    const metadataMap = await getProblemMetadataMap(); // Load enhanced data

    return logs.map(log => {
        const dateObj = new Date(log.created_at);
        const info = getFriendlyInfo(log, metadataMap); // Get platform and name

        // Metadata parsing for detail view
        let finalUrl = '#'; // Default to no-op
        let tags = '';
        let concept = '';
        let isCorrect = null;

        // ... (Original Metadata Parsing - kept same logic mostly)
        if (log.type === 'log') {
            try {
                if (log.metadata && (log.metadata.startsWith('{') || log.metadata.startsWith('['))) {
                    const detail = JSON.parse(log.metadata);
                    if (detail.projectUrl) finalUrl = detail.projectUrl;
                    else if (detail.s3Url) finalUrl = detail.s3Url;
                    if (log.title.includes('entry_load_project')) {
                        if (detail.s3Url) {
                            // URL Format: /entry_editor/?s3Url=...&userID=...&role=...
                            const s3UrlEncoded = encodeURIComponent(detail.s3Url);
                            const userID = currentUser && currentUser.userID ? currentUser.userID : '';
                            const role = currentUser && currentUser.role ? currentUser.role : 'student';

                            finalUrl = `/entry_editor/?s3Url=${s3UrlEncoded}&userID=${userID}&role=${role}`;
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
        } else if (['entry', 'scratch'].includes(log.type)) {
            try {
                const detail = JSON.parse(log.metadata || '{}');
                if (log.type === 'entry' && detail.s3Url) {
                    const s3UrlEncoded = encodeURIComponent(detail.s3Url);
                    const userID = currentUser && currentUser.userID ? currentUser.userID : '';
                    const role = currentUser && currentUser.role ? currentUser.role : 'student';
                    finalUrl = `/entry_editor/?s3Url=${s3UrlEncoded}&userID=${userID}&role=${role}`;
                } else if (log.type === 'scratch' && detail.s3Url) {
                    const s3UrlEncoded = encodeURIComponent(detail.s3Url);
                    finalUrl = `/scratch/?project_file=${s3UrlEncoded}`;
                }
            } catch (e) { }
        } else if (log.type === 'learn') {
            try {
                const detail = JSON.parse(log.metadata || '{}');
                if (detail.progress) {
                    // Pass progress to be used in view
                    log.progress = detail.progress;
                }
            } catch (e) { }
            finalUrl = '#';
        } else if (log.type === 'solve') {
            // Parse metadata to get exam_name and problem_number for metadata lookup
            try {
                const detail = JSON.parse(log.metadata || '{}');
                isCorrect = detail.is_correct;
                const examName = detail.exam_name || '';
                const problemNumber = detail.problem_number || '';
                const key = `${examName.toLowerCase()}_${problemNumber.toLowerCase()}`;
                const meta = metadataMap.get(key);
                if (meta) {
                    tags = meta.tags || '';
                    concept = meta.concept || '';
                }
            } catch (e) { }
            finalUrl = '#';
        }

        return {
            dateStr: dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }),
            timeStr: dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }),
            title: info.name,
            platform: info.platform,
            iconClass: getIconClass(log),
            url: finalUrl,
            status: 'Completed',
            action_type: (log.type || 'Activity').toUpperCase(),
            // Enhanced fields for SOLVE items
            tags: tags,
            concept: concept,
            isCorrect: isCorrect,
            progress: log.progress || 0, // [NEW] Learning progress
            isoDate: dateObj.toISOString() // [FIX] Add standard ISO date for reliable client-side parsing
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
                    -- Removed generic entry/scratch logs as we now use ProjectSubmissions
                )

                UNION ALL

                -- 5. [NEW] Learning Logs (Content Study)
                SELECT 
                    'learn' as type,
                    content_name COLLATE utf8mb4_unicode_ci as title,
                    start_time as created_at,
                    learning_id as id,
                    CONCAT('{"progress":', IFNULL(progress, 0), ', "platform":"', IFNULL(platform,''), '"}') COLLATE utf8mb4_unicode_ci as metadata
                FROM LearningLogs
                WHERE user_id = ?

                UNION ALL

                -- 6. [NEW] Project Submissions (Entry/Scratch)
                SELECT 
                    LOWER(platform) as type, -- 'entry' or 'scratch'
                    project_name COLLATE utf8mb4_unicode_ci as title,
                    created_at,
                    id,
                    CONCAT('{"s3Url":"', IFNULL(s3_url,''), '", "thumbnail":"', IFNULL(thumbnail_url,''), '"}') COLLATE utf8mb4_unicode_ci as metadata
                FROM ProjectSubmissions
                WHERE user_id = ? AND is_deleted = 0

                UNION ALL

                -- 7. [NEW] Quiz/Problem Logs (Python) - Enhanced with exam_name
                SELECT 
                    'solve' as type,
                    CONCAT(exam_name, ' ', problem_number) COLLATE utf8mb4_unicode_ci as title,
                    timestamp as created_at,
                    id,
                    CONCAT('{"is_correct":', is_correct, ', "exam_name":"', IFNULL(exam_name,''), '", "problem_number":"', IFNULL(problem_number,''), '"}') COLLATE utf8mb4_unicode_ci as metadata
                FROM QuizResults
                WHERE user_id = ?

            ) AS UnifiedTimeline
            ORDER BY created_at DESC
            LIMIT 50
        `, [studentId, studentId, studentId, studentId, studentId, studentId, studentId]);

        // Process logs for view
        const currentUser = { userID: req.session.userID, role: req.session.role };
        const timelineItems = await processLogs(activityLogs, currentUser);

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
        const currentUser = { userID: req.session.userID, role: req.session.role };
        const timelineItems = await processLogs(activityLogs, currentUser);

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


// ============================================
// Problems Tab (Enhanced with Sheet Metadata)
// ============================================
router.get('/problems', async (req, res) => {
    try {
        if (!req.session.is_logined) {
            return res.redirect('/auth/login');
        }

        // Resolve numeric DB ID
        let targetDbId = req.session.dbId;
        if (!targetDbId && req.session.userID) {
            const [user] = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [req.session.userID]);
            if (user) targetDbId = user.id;
        }

        if (!targetDbId) {
            return res.redirect('/auth/login');
        }

        // 1. Fetch QuizResults
        const problems = await db.queryDatabase(`
            SELECT * FROM QuizResults 
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 100
        `, [targetDbId]);

        // 2. Fetch Problems Sheet Metadata
        const { getSheetData } = require('../lib_google/sheetService');
        let metadataMap = new Map();
        try {
            const problemsSheet = await getSheetData('problems!A2:N500');
            if (problemsSheet && problemsSheet.length > 0) {
                problemsSheet.forEach(row => {
                    // Ensure row has enough columns
                    while (row.length < 14) row.push('');
                    const key = `${(row[1] || '').toLowerCase()}_${(row[2] || '').toLowerCase()}`; // examName_problemNumber
                    metadataMap.set(key, {
                        concept: row[3] || '',
                        difficulty: row[10] || '1',
                        questionType: row[11] || '',
                        tags: row[12] || '',
                        testCases: row[9] || '[]'
                    });
                });
            }
        } catch (sheetErr) {
            console.error('Failed to load problem metadata:', sheetErr);
        }

        // 3. Calculate Accuracy Rates (group by exam_name + problem_number)
        const statsMap = new Map();
        problems.forEach(p => {
            const key = `${(p.exam_name || '').toLowerCase()}_${(p.problem_number || '').toLowerCase()}`;
            if (!statsMap.has(key)) {
                statsMap.set(key, { total: 0, correct: 0 });
            }
            statsMap.get(key).total++;
            if (p.is_correct) statsMap.get(key).correct++;
        });

        // 4. Enrich problems with metadata and accuracy
        const enrichedProblems = problems.map(p => {
            const key = `${(p.exam_name || '').toLowerCase()}_${(p.problem_number || '').toLowerCase()}`;
            const meta = metadataMap.get(key) || {};
            const stats = statsMap.get(key) || { total: 1, correct: 0 };

            // Parse execution_results to get test case counts
            let passedTests = 0;
            let totalTests = 0;
            if (p.execution_results) {
                try {
                    const results = JSON.parse(p.execution_results);
                    if (Array.isArray(results)) {
                        totalTests = results.length;
                        passedTests = results.filter(r => r.passed).length;
                    }
                } catch (e) { /* ignore parse errors */ }
            }

            return {
                ...p,
                concept: meta.concept || '',
                difficulty: meta.difficulty || '1',
                questionType: meta.questionType || '',
                tags: meta.tags || '',
                passedTests,
                totalTests,
                accuracyRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
                totalAttempts: stats.total,
                successAttempts: stats.correct
            };
        });

        // 5. Two-level grouping: exam_name (차시) → problems (문제)
        const examGroupsMap = new Map();
        enrichedProblems.forEach(p => {
            const examKey = p.exam_name || 'Unknown';
            const problemKey = p.problem_number || 'Unknown';

            // Create exam group if not exists
            if (!examGroupsMap.has(examKey)) {
                examGroupsMap.set(examKey, {
                    exam_name: examKey,
                    problems: new Map(),
                    latestTimestamp: null
                });
            }
            const examGroup = examGroupsMap.get(examKey);

            // Create problem group within exam if not exists
            if (!examGroup.problems.has(problemKey)) {
                examGroup.problems.set(problemKey, {
                    problem_number: problemKey,
                    concept: p.concept,
                    tags: p.tags,
                    difficulty: p.difficulty,
                    accuracyRate: p.accuracyRate,
                    totalAttempts: p.totalAttempts,
                    successAttempts: p.successAttempts,
                    latestStatus: null,
                    latestTimestamp: null,
                    latestPassedTests: 0,
                    latestTotalTests: 0,
                    attempts: []
                });
            }

            const problemGroup = examGroup.problems.get(problemKey);
            problemGroup.attempts.push(p);

            // Update latest status for this problem
            if (!problemGroup.latestTimestamp || new Date(p.timestamp) > new Date(problemGroup.latestTimestamp)) {
                problemGroup.latestStatus = p.is_correct;
                problemGroup.latestTimestamp = p.timestamp;
                problemGroup.latestPassedTests = p.passedTests;
                problemGroup.latestTotalTests = p.totalTests;
            }

            // Update latest timestamp for exam group
            if (!examGroup.latestTimestamp || new Date(p.timestamp) > new Date(examGroup.latestTimestamp)) {
                examGroup.latestTimestamp = p.timestamp;
            }
        });

        // Convert to array structure for template
        const groupedByExam = Array.from(examGroupsMap.values()).map(exam => ({
            exam_name: exam.exam_name,
            latestTimestamp: exam.latestTimestamp,
            problems: Array.from(exam.problems.values())
                .sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp))
        })).sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp));

        res.render('my-universe/index', {
            activeTab: 'problems',
            problems: enrichedProblems,       // Original flat list
            groupedByExam: groupedByExam,     // New two-level grouped data
            userID: req.session.userID,
            userRole: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID
        });

    } catch (error) {
        console.error('My Problems Error:', error);
        res.status(500).send('Error loading problems');
    }
});


// ============================================
// Observatory Tab (Student Self-View)
// ============================================
router.get('/observatory', async (req, res) => {
    try {
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

    } catch (error) {
        console.error('My Observatory Error:', error);
        res.status(500).send('Error loading observatory');
    }
});


module.exports = router;
