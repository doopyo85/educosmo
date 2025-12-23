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
router.get('/boards', async (req, res) => {
    try {
        const { type, limit } = req.query;
        let query = `
            SELECT b.id, b.title, b.author, b.created, b.views, b.author_type, b.is_public
            FROM board_posts b
            WHERE b.is_public = 1
        `;
        const params = [];

        // Filter by board type (community, portfolio, etc.) if needed
        // For now, simple list

        query += ` ORDER BY b.created DESC LIMIT ?`;
        params.push(parseInt(limit) || 20);

        const posts = await queryDatabase(query, params);
        res.json(posts);
    } catch (error) {
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
        // Adjust logic if studentId is numeric or username
        // Assuming integer ID for simplicity, or username query
        const student = await getStudentById(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Get Public Portfolio Posts
        const portfolios = await queryDatabase(`
            SELECT id, title, content, created, views 
            FROM board_posts 
            WHERE author_id = ? AND author_type = 'PAID' AND is_public = 1 AND board_type = 'portfolio'
            ORDER BY created DESC
        `, [student.id]);

        res.json({
            student: {
                nickname: student.name, // or proper nickname field
                joined_at: student.created_at
            },
            portfolios
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// Auth: Create Post (Community)
// ==========================================
router.post('/boards', requireAuth, async (req, res) => {
    try {
        const { title, content, board_type } = req.body;

        // Only allow community for now, or specific rules
        if (!['community', 'QnA'].includes(board_type)) {
            return res.status(400).json({ error: 'Invalid board type' });
        }

        const authorName = req.user.nickname || req.user.name;
        const authorId = req.user.id;
        const authorType = req.user.type; // 'PAID' or 'PONG2'

        const result = await queryDatabase(`
            INSERT INTO board_posts (title, content, author, author_id, author_type, board_type, created, is_public)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)
        `, [title, content, authorName, authorId, authorType, board_type]);

        res.json({ success: true, postId: result.insertId });

    } catch (error) {
        console.error(error);
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
