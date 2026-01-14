const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { queryDatabase, getStudentById } = require('../../lib_login/db');
const { pong2Auth, requireAuth, requireDbUser } = require('../../lib_login/pong2_auth');
const { JWT } = require('../../config');

// 🔥 Pong2 전용 CORS 미들웨어 (pong2.app에서의 크로스 오리진 요청 허용)
router.use((req, res, next) => {
    const allowedOrigins = [
        'https://pong2.app',
        'https://www.pong2.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'https://app.codingnplay.co.kr'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Preflight 요청 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// 🔥 JSON 응답 보장 미들웨어 (HTML 응답 방지)
router.use((req, res, next) => {
    // 원본 res.send를 저장
    const originalSend = res.send.bind(res);
    
    res.send = function(body) {
        // Content-Type이 설정되지 않았으면 JSON으로 설정
        if (!res.get('Content-Type')) {
            res.set('Content-Type', 'application/json');
        }
        return originalSend(body);
    };
    
    next();
});

// 🔥 요청 로깅 (디버깅용)
router.use((req, res, next) => {
    console.log(`🔍 [Pong2] ${req.method} ${req.path}`, {
        hasSession: !!req.session?.is_logined,
        hasAuthHeader: !!req.headers.authorization,
        origin: req.headers.origin
    });
    next();
});

// Use Hybrid Auth for all routes
router.use(pong2Auth);

// ==========================================
// DB Initialization (Auto-Migration)
// ==========================================
async function initPong2Tables() {
    try {
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS BoardComments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                parent_id INT DEFAULT NULL,
                content TEXT NOT NULL,
                author_name VARCHAR(255) NOT NULL,
                author_id INT NOT NULL,
                author_type VARCHAR(50) NOT NULL, 
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT 0,
                FOREIGN KEY (post_id) REFERENCES board_posts(id) ON DELETE CASCADE
            )
        `);
        console.log('BoardComments table checked/created');

        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS BoardReactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                user_type VARCHAR(50) NOT NULL,
                reaction_type VARCHAR(20) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_reaction (post_id, user_id, user_type, reaction_type),
                FOREIGN KEY (post_id) REFERENCES board_posts(id) ON DELETE CASCADE
            )
        `);
        console.log('BoardReactions table checked/created');

        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS UserActivityLogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                center_id INT,
                action_type VARCHAR(50),
                url VARCHAR(255),
                ip_address VARCHAR(50),
                user_agent TEXT,
                action_detail TEXT,
                status VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('UserActivityLogs table checked/created');
    } catch (error) {
        console.error('Pong2 Table Init Error:', error);
    }
}
// Run init
initPong2Tables();


// ==========================================
// Public: Board List
// ==========================================
// ==========================================
// Public: Board List (Viewer)
// ==========================================
router.get('/boards', async (req, res) => {
    try {
        const { type, limit, nestId } = req.query; // type can be 'community', 'teacher', 'portfolio'

        let query, params = [];
        let targetScope = 'COMMUNITY'; // Default

        if (type === 'teacher') targetScope = 'TEACHER';

        // Permission Check for Teacher Board
        if (targetScope === 'TEACHER') {
            if (!req.user || !['teacher', 'manager', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Access denied. Teachers only.' });
            }
        }

        query = `
            SELECT b.id, b.title, b.image_url, b.author, b.created_at as created, b.views, b.author_type, b.board_scope, b.category_id as nest_id
            FROM board_posts b
            WHERE b.is_public = 1 
            AND b.board_scope = ?
        `;
        params.push(targetScope);

        // Nest Filtering
        if (type === 'community' && nestId) {
            query += ` AND b.category_id = ?`;
            params.push(nestId);
        }

        const limitVal = parseInt(limit) || 20;
        const offsetVal = parseInt(req.query.offset) || 0;

        query += ` ORDER BY b.created_at DESC LIMIT ${limitVal} OFFSET ${offsetVal}`;

        const posts = await queryDatabase(query, params);

        // Enhance with comment/reaction counts? (Optional for list view performance)
        // For now, keep it simple.

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
        const posts = await queryDatabase(`
            SELECT b.id, b.title, b.content, b.image_url, b.author, b.created_at as created, b.views, b.author_type, b.board_scope, b.author_id, b.category_id as nest_id
            FROM board_posts b
            WHERE b.id = ? 
            AND b.is_public = 1 
        `, [id]);

        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const post = posts[0];

        // Permission Check
        if (post.board_scope === 'TEACHER') {
            if (!req.user || !['teacher', 'manager', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Access denied. Teachers only.' });
            }
        }

        // 2. Fetch Comments
        const comments = await queryDatabase(`
            SELECT id, parent_id, content, author_name, author_id, author_type, created_at
            FROM BoardComments
            WHERE post_id = ? AND is_deleted = 0
            ORDER BY created_at ASC
        `, [id]);

        // 3. Fetch Reactions
        // Aggregate by type
        const reactionsRaw = await queryDatabase(`
            SELECT reaction_type, COUNT(*) as count 
            FROM BoardReactions 
            WHERE post_id = ? 
            GROUP BY reaction_type
        `, [id]);

        const reactions = {};
        reactionsRaw.forEach(r => reactions[r.reaction_type] = r.count);

        // Check if current user reacted (if logged in)
        let myReactions = [];
        if (req.user) {
            const myRaw = await queryDatabase(`
                SELECT reaction_type FROM BoardReactions
                WHERE post_id = ? AND user_id = ? AND user_type = ?
            `, [id, req.user.id, req.user.type || 'PONG2']); // Handle potentially undefined type
            myReactions = myRaw.map(r => r.reaction_type);
        }

        // 4. Increment Views (Async)
        queryDatabase('UPDATE board_posts SET views = views + 1 WHERE id = ?', [id]).catch(err => {
            console.error('View increment error:', err);
        });

        res.json({
            success: true,
            post,
            comments,
            reactions,
            myReactions
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
router.post('/boards', requireDbUser, async (req, res) => {
    try {
        let { title, content, board_type, nest_id, image_url } = req.body; // board_type: 'COMMUNITY' or 'TEACHER'

        // Validate basic input
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const authorName = req.user.nickname || req.user.name;
        const authorId = req.user.id;
        const authorType = req.user.type; // 'PAID' or 'PONG2'

        // 🔥 Step 1: content 내 temp 이미지를 정식 경로로 이동
        const { processContentImages } = require('../../lib_board/s3Utils');
        console.log('=== Pong2 게시글 작성: 이미지 영구화 시작 ===');
        const imageResult = await processContentImages(content);
        content = imageResult.content;  // 업데이트된 content
        console.log(`이동된 이미지: ${imageResult.movedImages.length}개`);

        let imageUrl = image_url || null; // 🔥 이미지 URL 추가

        // Determine Scope AND Category
        let boardScope = 'COMMUNITY';
        let categoryId = nest_id || 3; // Default to 3 (Game/Free) if not provided, but frontend should force it.

        if (board_type === 'TEACHER') {
            if (req.user.type === 'PAID' && ['teacher', 'manager', 'admin'].includes(req.user.role)) {
                boardScope = 'TEACHER';
                categoryId = 99; // Special ID for Teacher? Or just ignore category for Teacher board.
            } else {
                return res.status(403).json({ error: 'Only teachers can write to Teacher Board' });
            }
        }

        const result = await queryDatabase(`
            INSERT INTO board_posts
            (category_id, title, content, image_url, author, author_id, author_type, board_scope, is_public, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [categoryId, title, content, imageUrl, authorName, authorId, authorType, boardScope]);

        res.json({ success: true, postId: result.insertId });

    } catch (error) {
        console.error('Pong2 Create Post Error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// ==========================================
// New: Comments & Reactions
// ==========================================

// Add Comment
router.post('/boards/:id/comments', requireDbUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { content, parent_id } = req.body;
        const authorName = req.user.nickname || req.user.name;

        // Depth Check
        if (parent_id) {
            const parents = await queryDatabase('SELECT parent_id FROM BoardComments WHERE id = ?', [parent_id]);
            if (parents.length > 0 && parents[0].parent_id) {
                return res.status(400).json({ error: 'Max comment depth exceeded (Level 2 max)' });
            }
        }

        await queryDatabase(`
            INSERT INTO BoardComments (post_id, parent_id, content, author_name, author_id, author_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, parent_id || null, content, authorName, req.user.id, req.user.type]);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Toggle Reaction
router.post('/boards/:id/react', requireDbUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'like', 'laugh', 'heart'

        if (!['like', 'laugh', 'heart'].includes(type)) {
            return res.status(400).json({ error: 'Invalid reaction type' });
        }

        // Toggle: Check if exists
        const existing = await queryDatabase(`
            SELECT id FROM BoardReactions 
            WHERE post_id = ? AND user_id = ? AND user_type = ? AND reaction_type = ?
        `, [id, req.user.id, req.user.type, type]);

        if (existing.length > 0) {
            // Remove
            await queryDatabase('DELETE FROM BoardReactions WHERE id = ?', [existing[0].id]);
            res.json({ success: true, action: 'removed' });
        } else {
            // Add
            await queryDatabase(`
                INSERT INTO BoardReactions (post_id, user_id, user_type, reaction_type)
                VALUES (?, ?, ?, ?)
            `, [id, req.user.id, req.user.type, type]);
            res.json({ success: true, action: 'added' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Reaction failed' });
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

// ==========================================
// SSO & Tracking
// ==========================================

// 1. Generate SSO Token (For Paid Users moving to Pong2)
router.get('/auth/sso-token', requireAuth, (req, res) => {
    try {
        if (req.user.type !== 'PAID') {
            return res.status(403).json({ error: 'Only paid users can generate SSO tokens' });
        }

        // Short-lived token (5 mins)
        // 🔥 userID 추가: boardApiRouter 등에서 req.session.userID로 사용
        const token = jwt.sign(
            {
                id: req.user.id, // This is 'Users.id' (Paid User PK)
                userID: req.user.userID, // 🔥 문자열 userID 추가
                type: 'PAID',
                centerID: req.user.centerID,
                role: req.user.role,
                userType: req.user.userType || 'student' // 🔥 userType 추가
            },
            JWT.SECRET,
            { expiresIn: JWT.EXPIRES_IN }
        );

        res.json({ success: true, token });
    } catch (error) {
        console.error('SSO Token Error:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

// 2. Get Current User (For Pong2 to validate token)
router.get('/auth/me', requireAuth, async (req, res) => {
    try {
        console.log('🔍 [Pong2] /auth/me requested', req.user ? `by ${req.user.id}` : 'no user');

        // req.user is already populated by pong2Auth middleware
        const user = {
            id: req.user.id,
            nickname: req.user.nickname || req.user.name, // Normalize name
            type: req.user.type,
            role: req.user.role || 'student'
        };

        console.log('✅ [Pong2] /auth/me responding with:', user);
        res.json({ success: true, user });
    } catch (error) {
        console.error('❌ [Pong2] Get Me Error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// 3. Tracking Beacon (로그인 사용자만, 실패해도 무시)
router.post('/logs/track', async (req, res) => {
    try {
        // 🔥 비로그인 사용자는 트래킹 스킵
        if (!req.user || typeof req.user.id !== 'number') {
            return res.json({ success: true, skipped: true });
        }

        const { action, detail, url } = req.body;

        await queryDatabase(`
            INSERT INTO UserActivityLogs 
            (user_id, center_id, action_type, url, ip_address, user_agent, action_detail, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.user.id,
            req.user.centerID || null,
            'PONG2_EVENT',
            url || 'pong2.app',
            req.ip,
            req.headers['user-agent'],
            `${action}: ${detail || ''}`,
            'track'
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error('Tracking Error:', error.message);
        res.json({ success: false });
    }
});

// ==========================================
// 🔥 Google Sheets: Add Project
// ==========================================
router.post('/sheets/add-project', requireDbUser, async (req, res) => {
    // 명시적으로 JSON 응답 설정
    res.setHeader('Content-Type', 'application/json');

    try {
        const { category, title, description, url, tags } = req.body;

        // 입력 검증
        if (!category || !title || !url) {
            return res.status(400).json({
                success: false,
                error: 'category, title, url are required'
            });
        }

        // 로그인한 사용자 정보
        const userName = req.user.nickname || req.user.name || '익명';
        console.log(`📝 [Pong2] 프로젝트 추가 요청 - User: ${userName}, Category: ${category}, Title: ${title}`);

        // 1. 썸네일 자동 추출 (에러가 발생해도 계속 진행)
        let thumbnailUrl = 'https://kr.object.ncloudstorage.com/educodingnplaycontents/thumbs/default.png';

        try {
            const { extractThumbnail } = require('../../lib_pong/thumbnailExtractor');
            const extracted = await extractThumbnail(url);
            if (extracted) {
                thumbnailUrl = extracted;
            }
            console.log(`🖼️ Thumbnail: ${thumbnailUrl}`);
        } catch (thumbError) {
            console.error('⚠️ Thumbnail extraction failed, using default:', thumbError.message);
        }

        // 2. 구글 시트에 데이터 추가
        // pong! 시트의 컬럼: A=카테고리, B=콘텐츠명, C=한줄요약, D=stageURL, E=imgURL, F=Tag
        const { appendSheetData } = require('../../lib_google/sheetService');

        const rowData = [
            [
                category,           // A: 카테고리
                title,              // B: 콘텐츠명
                description || '',  // C: 한줄요약
                url,                // D: stageURL
                thumbnailUrl,       // E: imgURL
                tags || ''          // F: Tag
            ]
        ];

        // pong! 시트에 추가 (시트 ID는 config에서 가져옴)
        const result = await appendSheetData('pong!!A:F', rowData);

        console.log(`✅ [Pong2] 프로젝트가 구글시트에 추가되었습니다.`);

        return res.json({
            success: true,
            message: '프로젝트가 성공적으로 추가되었습니다.',
            thumbnailUrl: thumbnailUrl,
            updatedRange: result.updatedRange
        });

    } catch (error) {
        console.error('❌ [Pong2] Add Project Error:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({
            success: false,
            error: 'Failed to add project',
            message: error.message
        });
    }
});

module.exports = router;
