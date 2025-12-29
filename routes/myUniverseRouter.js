const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../lib_login/db');

// ============================================
// Main My Universe Route (Redirect)
// ============================================
router.get('/', (req, res) => {
    res.redirect('/my-universe/timeline');
});

// ============================================
// Timeline Tab (Previously Portfolio)
// ============================================
router.get('/timeline', async (req, res) => {
    try {
        const userID = req.session.userID;

        // Basic auth check
        if (!req.session.is_logined) {
            return res.redirect('/auth/login');
        }

        let activityLogs = [];
        if (userID) {
            const users = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [userID]);
            if (users.length > 0) {
                const dbId = users[0].id;
                // Fetch activity logs (Refined query from portfolioRouter)
                activityLogs = await db.queryDatabase(`
                    SELECT created_at, action_type, url, action_detail, status 
                    FROM UserActivityLogs 
                    WHERE user_id = ? 
                    AND (
                        action_type = 'portfolio_upload' 
                        OR action_type LIKE '%entry%' 
                        OR action_type LIKE '%scratch%' 
                        OR action_type LIKE '%pong%'
                        OR action_type IN ('login', 'logout')
                    )
                    ORDER BY created_at DESC 
                    LIMIT 100
                `, [dbId]);
            }
        }

        res.render('my-universe/index', {
            activeTab: 'timeline',
            userID: req.session.userID,
            userRole: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID,
            activityLogs: activityLogs,
            readOnly: false
        });

    } catch (error) {
        console.error('My Universe Timeline Error:', error);
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
            SELECT created_at, action_type, url, action_detail, status 
            FROM UserActivityLogs 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [studentId]);

        res.render('my-universe/index', {
            activeTab: 'timeline',
            student,
            activityLogs,
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
