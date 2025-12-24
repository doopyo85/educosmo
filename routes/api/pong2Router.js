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
        const { type, limit } = req.query; // type can be 'community', 'teacher', 'portfolio'

        let query, params = [];

        // Scope Logic
        // 1. Teacher Board: Only 'TEACHER' scope
        // 2. Community Board: 'COMMUNITY' scope (Free for all)
        // 3. Portfolio: Managed in separate route, but if here, maybe 'PAID_ONLY'? 

        let targetScope = 'COMMUNITY'; // Default
        if (type === 'teacher') targetScope = 'TEACHER';

        // Check Permissions for Teacher Board
        // If requesting teacher board, check if user is authorized to READ?
        // User said: "Teacher only read/write".
        if (targetScope === 'TEACHER') {
            if (!req.user || !['teacher', 'manager', 'admin'].includes(req.user.role)) {
                // But wait, if it's "Teacher Board" maybe students can READ notices?
                // User said "Teacher only read/write". Strict.
                // If strict, return 403 or empty.
                // Let's return error for clarity.
                return res.status(403).json({ error: 'Access denied. Teachers only.' });
            }
        }

        query = `
            SELECT b.id, b.title, b.author, b.created_at as created, b.views, b.author_type, b.board_scope
            FROM board_posts b
            WHERE b.is_public = 1 
            AND b.board_scope = ?
        `;
        params.push(targetScope);

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
        // We select ALL scopes here, but filter by ID.
        // If it's a TEACHER post, should we check auth?
        // For simplicity, fetch first, then check scope/permissions.
        const posts = await queryDatabase(`
            SELECT b.id, b.title, b.content, b.author, b.created_at as created, b.views, b.author_type, b.board_scope, b.author_id
            FROM board_posts b
            WHERE b.id = ? 
            AND b.is_public = 1 
        `, [id]);

        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = posts[0];

        // Permission Check for Read
        if (post.board_scope === 'TEACHER') {
            if (!req.user || !['teacher', 'manager', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Access denied. Teachers only.' });
            }
        }

        // 2. Increment Views (Async, don't wait)
        queryDatabase('UPDATE board_posts SET views = views + 1 WHERE id = ?', [id]).catch(err => {
            console.error('View increment error:', err);
        });

        res.json({
            success: true,
            post
        });

    } catch (error) {
        console.error('Pong2 Get Post Error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ... (Portfolio route unchanged) ...

// ==========================================
// Auth: Create Post (Community/Teacher)
// ==========================================
router.post('/boards', requireAuth, async (req, res) => {
    try {
        const { title, content, board_type } = req.body; // board_type: 'COMMUNITY' or 'TEACHER'

        // Validate basic input
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const authorName = req.user.nickname || req.user.name;
        const authorId = req.user.id;
        const authorType = req.user.type; // 'PAID' or 'PONG2'

        // Determine Scope
        let boardScope = 'COMMUNITY';

        if (board_type === 'TEACHER') {
            // Check Permissions
            if (req.user.type === 'PAID' && ['teacher', 'manager', 'admin'].includes(req.user.role)) {
                boardScope = 'TEACHER';
            } else {
                return res.status(403).json({ error: 'Only teachers can write to Teacher Board' });
            }
        } else {
            // Default to COMMUNITY (Free Board)
            // Everyone allowed (Paid and Pong2)
            boardScope = 'COMMUNITY';
        }

        // Category Mapping (Optional)
        // Community = 3, Teacher = ?? (Using 3 for generic board, or maybe separate?)
        // Let's stick to 3 for now or find a 'Teacher' category ID.
        // Assuming 3 is "Free Board".
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
