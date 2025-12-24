const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { queryDatabase, getStudentById } = require('../../lib_login/db');
const { pong2Auth, requireAuth } = require('../../lib_login/pong2_auth');
const { JWT } = require('../../config');

// Use Hybrid Auth for all routes
router.use(pong2Auth);

// ==========================================
// Public: Board List
// ==========================================
// ==========================================
// Public: Board List (Viewer)
// ==========================================
router.get('/boards', async (req, res) => {
    try {
        const { type, limit } = req.query; // type is category/board_type

        // 🔥 Strict Filter: Only COMMUNITY scope and Public posts
        let query = `
            SELECT b.id, b.title, b.author, b.created_at as created, b.views, b.author_type, b.board_scope
            FROM board_posts b
            WHERE b.is_public = 1 
            AND b.board_scope = 'COMMUNITY'
        `;
        const params = [];

        // Optional: Filter by specific board type if column exists or logic requires
        // if (type) { ... }

        // query += ` ORDER BY b.created_at DESC LIMIT ?`;
        // params.push(parseInt(limit) || 20);

        // 🔥 Fix for "Incorrect arguments to mysqld_stmt_execute"
        // Prepared statements with LIMIT can be tricky.
        // We will just interpolate the integer safely since it's processed as int.
        const limitVal = parseInt(limit) || 20;
        query += ` ORDER BY b.created_at DESC LIMIT ${limitVal}`;

        const posts = await queryDatabase(query, params);
        res.json(posts);
    } catch (error) {
        console.error('Pong2 Board List Error:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ==========================================
// Public: Single Board Post (Read)
// ==========================================
router.get('/boards/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch Post details
        // Ensure it is COMMUNITY scope and Public
        const posts = await queryDatabase(`
            SELECT b.id, b.title, b.content, b.author, b.created_at as created, b.views, b.author_type, b.board_scope, b.author_id
            FROM board_posts b
            WHERE b.id = ? 
            AND b.is_public = 1 
            AND b.board_scope = 'COMMUNITY'
        `, [id]);

        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = posts[0];

        // 2. Increment Views (Async, don't wait)
        queryDatabase('UPDATE board_posts SET views = views + 1 WHERE id = ?', [id]).catch(err => {
            console.error('View increment error:', err);
        });

        // 3. Check Author ownership (Optional, for frontend edit buttons)
        // const isOwner = req.user && req.user.id === post.author_id; // Check req.user if authenticated

        res.json({
            success: true,
            post
        });

    } catch (error) {
        console.error('Pong2 Get Post Error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ==========================================
// Public: Portfolio Showcase
// ==========================================
router.get('/portfolio/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;

        // Check if student exists (Paid User)
        const student = await getStudentById(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Get Public Portfolio Posts (Paid Users only)
        // Ensure scope implies it's shareable, or is_public is enough?
        // Spec says Portfolio is for Paid users.
        const portfolios = await queryDatabase(`
            SELECT id, title, content, created_at as created, views 
            FROM board_posts 
            WHERE author_id = ? 
            AND author_type = 'PAID' 
            AND is_public = 1 
            -- AND category_id = ? (if portfolio has specific category)
            ORDER BY created_at DESC
        `, [student.id]);

        res.json({
            student: {
                nickname: student.name,
                joined_at: student.created_at
            },
            portfolios
        });
    } catch (error) {
        console.error('Pong2 Portfolio Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// Auth: Create Post (Community)
// ==========================================
router.post('/boards', requireAuth, async (req, res) => {
    try {
        const { title, content, board_type } = req.body;

        // Validate basic input
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const authorName = req.user.nickname || req.user.name;
        const authorId = req.user.id;
        const authorType = req.user.type; // 'PAID' or 'PONG2'

        // 🔥 Enforce Scope based on Origin/User
        // If coming from Pong2 API, default to COMMUNITY.
        // Even paid users writing from Pong2 should probably be COMMUNITY scope?
        // Spec says: "pong2는 COMMUNITY scope만 접근 가능"
        const boardScope = 'COMMUNITY';

        // Map board_type to category_id if needed, or use a default
        // For now assuming board_posts has category_id. 
        // Let's use specific category for 'Community' (e.g., 3 from boardApiRouter map) or default.
        // Hardcoding 3 (Free/Community) for safe fallback if not provided.
        const categoryId = 3;

        const result = await queryDatabase(`
            INSERT INTO board_posts 
            (category_id, title, content, author, author_id, author_type, board_scope, is_public, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [categoryId, title, content, authorName, authorId, authorType, boardScope]);

        res.json({ success: true, postId: result.insertId });

    } catch (error) {
        console.error('Pong2 Create Post Error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// ==========================================
// Pong2 Local Auth: Signup
// ==========================================
router.post('/auth/signup', async (req, res) => {
    try {
        const { email, password, nickname } = req.body;

        // 1. Check existing
        const existing = await queryDatabase('SELECT id FROM Pong2Users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        // 2. Hash password
        const hash = await bcrypt.hash(password, 10);

        // 3. Insert
        const result = await queryDatabase(`
            INSERT INTO Pong2Users (email, password_hash, nickname)
            VALUES (?, ?, ?)
        `, [email, hash, nickname]);

        res.json({ success: true, userId: result.insertId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

// ==========================================
// Pong2 Local Auth: Login
// ==========================================
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Find User
        const users = await queryDatabase('SELECT * FROM Pong2Users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = users[0];

        // 2. Check Password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 3. Issue Token
        const token = jwt.sign(
            { id: user.id, type: 'PONG2' },
            JWT.SECRET,
            { expiresIn: JWT.EXPIRES_IN }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                nickname: user.nickname
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;
