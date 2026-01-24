require('dotenv').config();
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const path = require('path');
const config = require('./config');
const { queryDatabase } = require('./lib_login/db');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, BUCKET_NAME, generateMultimediaKey } = require('./lib_board/s3Utils');

const app = express();
const PORT = process.env.BLOG_PORT || 3001;

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'views/blog')
]);

// Redis Client
const redisClient = redis.createClient({ url: config.REDIS.URL });
redisClient.connect().catch(err => console.error('Redis Connection Error:', err));

const store = new RedisStore({
    client: redisClient,
    prefix: config.REDIS.PREFIX
});

// Session Middleware
app.use(session({
    store: store,
    secret: config.SESSION.SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: {
        secure: false, // Set to true if using https
        httpOnly: true,
        sameSite: 'lax',
        domain: '.pong2.app', // Share cookie across subdomains
        maxAge: 10800000
    }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: Resolve Blog Context from Subdomain
app.use(async (req, res, next) => {
    const host = req.headers.host || '';
    console.log(`[BlogServer] Request Host: ${host}, URL: ${req.url}`);
    let subdomain = '';

    // 1. Handle *.pong2.app (New Style: doopyo.pong2.app)
    if (host.endsWith('pong2.app') && host !== 'pong2.app' && !host.startsWith('blog.')) {
        subdomain = host.split('.')[0]; // doopyo
    }
    // 2. Handle *.blog.* (Old Style: doopyo.blog.pong2.app)
    else if (host.includes('.blog.')) {
        subdomain = host.split('.blog.')[0]; // doopyo
    }
    // 3. Handle blog.* Direct Access (Main Page)
    else if (host.startsWith('blog.')) {
        // Just show main page (no specific user context)
    }

    const DOMAIN = 'pong2.app'; // Should come from config in prod

    // Filter out system subdomains
    if (!subdomain || subdomain === 'www' || subdomain === 'api' || subdomain === 'localhost' || host === DOMAIN) {
        return next();
    }

    try {
        // 1. Check User Blogs (Student)
        let [userBlog] = await queryDatabase('SELECT * FROM user_blogs WHERE subdomain = ?', [subdomain]);
        if (userBlog) {
            req.blog = userBlog;
            req.blogType = 'user';

            // Get Owner Info
            const [owner] = await queryDatabase('SELECT id, name, profile_image FROM Users WHERE id = ?', [userBlog.user_id]);
            req.blogOwner = owner;
            return next();
        }

        // 2. Check Teacher Blogs (Before Center or After User)
        // If not found in user_blogs, check if it's a teacher blog with the same subdomain (username)
        let [teacherBlog] = await queryDatabase('SELECT * FROM teacher_blogs WHERE subdomain = ?', [subdomain]);
        if (teacherBlog) {
            req.blog = teacherBlog;
            req.blogType = 'teacher';

            // Get Owner Info (Teacher)
            const [owner] = await queryDatabase('SELECT id, name, profile_image FROM Users WHERE id = ?', [teacherBlog.user_id]);
            req.blogOwner = owner;
            return next();
        }

        // 3. Check Center Blogs
        let [centerBlog] = await queryDatabase('SELECT * FROM center_blogs WHERE subdomain = ?', [subdomain]);
        if (centerBlog) {
            req.blog = centerBlog;
            req.blogType = 'center';
            return next();
        }

        // 4. Not Found - Mark for 404
        req.isBlogNotFound = true;
        next();

    } catch (error) {
        console.error('Blog resolution error:', error);
        next(error);
    }
});

// Home Route (List Posts)
app.get('/', async (req, res) => {
    if (req.isBlogNotFound) return res.status(404).render('blog/404', { message: 'Blog not found' });
    if (!req.blog) return res.send('Welcome to MyUniverse (Main Page)'); // Or redirect to www

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        // Fetch Posts
        const posts = await queryDatabase(`
            SELECT id, title, slug, excerpt, thumbnail_url, view_count, created_at, file_type, published_to_platform
            FROM blog_posts 
            WHERE blog_id = ? AND blog_type = ? AND is_published = TRUE
            ORDER BY created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
        `, [req.blog.id, req.blogType]);

        const [countResult] = await queryDatabase(`
            SELECT COUNT(*) as total 
            FROM blog_posts 
            WHERE blog_id = ? AND blog_type = ? AND is_published = TRUE
        `, [req.blog.id, req.blogType]);

        const totalPosts = countResult.total;
        const totalPages = Math.ceil(totalPosts / limit);

        let template = 'blog/user_theme_galaxy';
        if (req.blogType === 'center') template = 'blog/center_theme_board';
        if (req.blogType === 'teacher') template = 'blog/teacher_theme_simple';

        // Sidebar Data
        const sidebarPosts = await getSidebarData(req.blog.id, req.blogType);

        // SEO 메타데이터
        const seoData = {
            title: `${req.blog.title} - ${req.blogOwner.name}의 코딩 블로그`,
            description: req.blog.description || `${req.blogOwner.name}의 프로젝트와 학습 기록`,
            ogImage: req.blogOwner.profile_image || 'https://pong2.app/images/default-og.png',
            url: `https://${req.blog.subdomain}.pong2.app`,
            type: 'website'
        };

        res.render(template, {
            blog: req.blog,
            owner: req.blogOwner,
            posts: posts,
            sidebarPosts: sidebarPosts,
            pagination: { page, totalPages },
            user: req.session,
            seoData: seoData
        });

    } catch (error) {
        console.error('Home route error:', error);
        res.status(500).send('Server Error');
    }
});

// Post Detail Route
app.get('/p/:slug', async (req, res) => {
    if (req.isBlogNotFound) return res.status(404).render('blog/404', { message: 'Blog not found' });
    if (!req.blog) return res.redirect('/');

    try {
        const slug = req.params.slug;
        const [post] = await queryDatabase(`
            SELECT * FROM blog_posts 
            WHERE blog_id = ? AND blog_type = ? AND slug = ? AND is_published = TRUE
        `, [req.blog.id, req.blogType, slug]);

        if (!post) {
            return res.status(404).render('blog/404', { message: 'Post not found', blog: req.blog });
        }

        // Increment View Count
        await queryDatabase('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?', [post.id]);

        let template = 'blog/post_detail_galaxy';
        if (req.blogType === 'center') template = 'blog/post_detail_board';
        if (req.blogType === 'teacher') template = 'blog/post_detail_teacher';

        // Sidebar Data
        const sidebarPosts = await getSidebarData(req.blog.id, req.blogType);

        // 첫 번째 이미지 추출 (SEO용)
        const extractFirstImage = (content) => {
            if (!content) return null;
            const match = content.match(/<img[^>]+src="([^">]+)"/);
            return match ? match[1] : null;
        };

        // SEO 메타데이터
        const seoData = {
            title: `${post.title} - ${req.blog.title}`,
            description: post.excerpt || post.title,
            ogImage: post.thumbnail_url || extractFirstImage(post.content) || req.blogOwner.profile_image || 'https://pong2.app/images/default-og.png',
            url: `https://${req.blog.subdomain}.pong2.app/p/${post.slug}`,
            type: 'article',
            publishedTime: post.created_at,
            modifiedTime: post.updated_at
        };

        res.render(template, {
            blog: req.blog,
            owner: req.blogOwner,
            post: post,
            sidebarPosts: sidebarPosts,
            user: req.session,
            seoData: seoData
        });

    } catch (error) {
        console.error('Post detail error:', error);
        res.status(500).send('Server Error');
    }
});


// ==========================================
// Write Routes (Owner Only)
// ==========================================

// Helper: Check permission (Owner)
function isOwner(req, res, next) {
    let visitorId = null;

    // Resolve visitorId from session (Robust check)
    if (req.session) {
        if (req.session.user && req.session.user.id) {
            visitorId = req.session.user.id;
        } else if (req.session.id) {
            visitorId = req.session.id;
        }
        // Fallback
        if (!visitorId && req.session.user && req.session.user.user && req.session.user.user.id) {
            visitorId = req.session.user.user.id;
        }
    }

    // 1. User Blog Owner Check
    if (req.blogType === 'user') {
        if (!visitorId || !req.blogOwner) {
            return res.status(403).send('Forbidden: Not logged in or blog owner not found');
        }
        if (visitorId == req.blogOwner.id) {
            return next();
        }
    }

    // 2. Teacher Blog Owner Check
    if (req.blogType === 'teacher') {
        if (!visitorId || !req.blogOwner) {
            return res.status(403).send('Forbidden: Not logged in or blog owner not found');
        }
        if (visitorId == req.blogOwner.id) {
            return next();
        }
    }

    // 3. Center Blog Admin/Teacher Check
    if (req.blogType === 'center' && req.session && req.session.is_logined) {
        // Check if user belongs to this center
        if (req.session.centerID == req.blog.center_id) {
            // Check roles
            const role = req.session.role;
            if (role === 'manager' || role === 'teacher' || role === 'admin') {
                return next();
            }
        }
    }

    res.status(403).send('Forbidden: Access denied');
}

// Image Upload Configuration for Editor.js
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        acl: 'public-read',
        key: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            const context = 'blog';
            const key = generateMultimediaKey(context, ext, false); // Direct to perm for simplicity in blog for now
            cb(null, key);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for blog images
});

// Helper: Get Sidebar Data (Recent Posts)
async function getSidebarData(blogId, blogType) {
    try {
        const posts = await queryDatabase(`
            SELECT id, title, slug, created_at 
            FROM blog_posts 
            WHERE blog_id = ? AND blog_type = ? AND is_published = TRUE
            ORDER BY created_at DESC 
            LIMIT 20
        `, [blogId, blogType]);
        return posts;
    } catch (error) {
        console.error('Sidebar data fetch error:', error);
        return [];
    }
}

// POST /upload/image - For Tiptap & Editor.js
app.post('/upload/image', isOwner, upload.single('image'), (req, res) => {
    if (req.file) {
        // Support both Tiptap and Editor.js formats
        res.json({
            success: true, // Tiptap format
            url: req.file.location, // Tiptap format
            success: 1, // Editor.js format (legacy)
            file: {
                url: req.file.location
            }
        });
    } else {
        res.json({ success: false, error: 'Upload failed' });
    }
});

// GET /write - Show Tiptap Editor
app.get('/write', isOwner, async (req, res) => {
    const sidebarPosts = await getSidebarData(req.blog.id, req.blogType);
    res.render('blog/write_blocks', { // Use new Tiptap editor
        blog: req.blog,
        owner: req.blogOwner,
        sidebarPosts: sidebarPosts,
        user: req.session
    });
});

// POST /write - Save Post
app.post('/write', isOwner, async (req, res) => {
    try {
        const { title, content, content_json, excerpt, thumbnail_url } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        // Generate Slug (simple)
        const slug = Math.random().toString(36).substring(2, 10); // temporary random slug

        // content might be empty if only using blocks, generate a backup or use empty string
        const htmlContent = content || '';

        // content_json may already be a string, handle both cases
        const jsonContent = typeof content_json === 'string' ? content_json : JSON.stringify(content_json);

        await queryDatabase(`
            INSERT INTO blog_posts
            (blog_id, blog_type, author_id, title, slug, content, content_json, excerpt, thumbnail_url, is_published, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [
            req.blog.id,
            req.blogType,
            req.session.dbId, // Add author_id
            title,
            slug,
            htmlContent,
            jsonContent,
            excerpt || (htmlContent.substring(0, 100)),
            thumbnail_url || null
        ]);

        res.json({ success: true, redirect: '/' });

    } catch (error) {
        console.error('Write post error:', error);
        res.status(500).json({ error: 'Failed to save post' });
    }
});


// ============================================
// Socket.IO 설정 (실시간 협업)
// ============================================
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.MAIN_APP_URL || 'http://localhost:3000',
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Socket.IO 연결 핸들러
io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // 센터 게시판 입장
    socket.on('join-board', (boardId) => {
        socket.join(`board-${boardId}`);
        console.log(`[Socket.IO] ${socket.id} joined board-${boardId}`);

        // 현재 접속자 수 브로드캐스트
        const room = io.sockets.adapter.rooms.get(`board-${boardId}`);
        const userCount = room ? room.size : 0;
        io.to(`board-${boardId}`).emit('user-count', userCount);
    });

    // 카드 위치 업데이트
    socket.on('card-moved', async (data) => {
        const { cardId, x, y, boardId } = data;

        try {
            // DB 업데이트
            await queryDatabase(`
                UPDATE blog_posts
                SET layout_meta = JSON_SET(
                    COALESCE(layout_meta, '{}'),
                    '$.x', ?,
                    '$.y', ?
                )
                WHERE id = ?
            `, [x, y, cardId]);

            // 같은 보드의 다른 사용자에게 브로드캐스트
            socket.to(`board-${boardId}`).emit('card-updated', data);
        } catch (error) {
            console.error('[Socket.IO] Card move error:', error);
        }
    });

    // 카드 리사이즈
    socket.on('card-resized', async (data) => {
        const { cardId, width, height, boardId } = data;

        try {
            // DB 업데이트
            await queryDatabase(`
                UPDATE blog_posts
                SET layout_meta = JSON_SET(
                    COALESCE(layout_meta, '{}'),
                    '$.width', ?,
                    '$.height', ?
                )
                WHERE id = ?
            `, [width, height, cardId]);

            // 같은 보드의 다른 사용자에게 브로드캐스트
            socket.to(`board-${boardId}`).emit('card-updated', data);
        } catch (error) {
            console.error('[Socket.IO] Card resize error:', error);
        }
    });

    // 새 카드 생성
    socket.on('card-created', (data) => {
        socket.to(`board-${data.boardId}`).emit('new-card', data);
    });

    // 카드 삭제
    socket.on('card-deleted', (data) => {
        socket.to(`board-${data.boardId}`).emit('card-removed', data);
    });

    // 게시판 나가기
    socket.on('leave-board', (boardId) => {
        socket.leave(`board-${boardId}`);
        console.log(`[Socket.IO] ${socket.id} left board-${boardId}`);

        // 현재 접속자 수 업데이트
        const room = io.sockets.adapter.rooms.get(`board-${boardId}`);
        const userCount = room ? room.size : 0;
        io.to(`board-${boardId}`).emit('user-count', userCount);
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 MyUniverse Blog Server running on port ${PORT}`);
    console.log(`✅ Socket.IO enabled for real-time collaboration`);
});
