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
        // 1. Check User Blogs
        let [userBlog] = await queryDatabase('SELECT * FROM user_blogs WHERE subdomain = ?', [subdomain]);
        if (userBlog) {
            req.blog = userBlog;
            req.blogType = 'user';

            // Get Owner Info
            const [owner] = await queryDatabase('SELECT id, name, profile_image FROM Users WHERE id = ?', [userBlog.user_id]);
            req.blogOwner = owner;
            return next();
        }

        // 2. Check Center Blogs
        let [centerBlog] = await queryDatabase('SELECT * FROM center_blogs WHERE subdomain = ?', [subdomain]);
        if (centerBlog) {
            req.blog = centerBlog;
            req.blogType = 'center';
            return next();
        }

        // 3. Not Found - Mark for 404
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
            SELECT id, title, slug, excerpt, thumbnail_url, view_count, created_at 
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

        const template = req.blogType === 'user' ? 'blog/user_theme_galaxy' : 'blog/center_theme_board';

        // Sidebar Data
        const sidebarPosts = await getSidebarData(req.blog.id, req.blogType);

        res.render(template, {
            blog: req.blog,
            owner: req.blogOwner,
            posts: posts,
            sidebarPosts: sidebarPosts, // Pass sidebar data
            pagination: { page, totalPages },
            user: req.session // Current logged in user (visitor)
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

        const template = req.blogType === 'user' ? 'blog/post_detail_galaxy' : 'blog/post_detail_board';

        // Check if template exists, fallback to home or generic
        // For now rendering basic
        const sidebarPosts = await getSidebarData(req.blog.id, req.blogType);

        res.render(template, {
            blog: req.blog,
            owner: req.blogOwner,
            post: post,
            sidebarPosts: sidebarPosts, // Pass sidebar data
            user: req.session
        });

    } catch (error) {
        console.error('Post detail error:', error);
        res.status(500).send('Server Error');
    }
});


// ==========================================
// Write Routes (Owner Only)
// ==========================================

// Helper: Check if current user is owner
// Helper: Check permission (Owner or Center Admin)
// Helper: Check permission (Owner or Center Admin)
function isOwner(req, res, next) {
    let visitorId = null;

    // Resolve visitorId from session (Robust check)
    if (req.session) {
        if (req.session.user && req.session.user.id) {
            visitorId = req.session.user.id;
        } else if (req.session.id) {
            // Sometimes directly on session (legacy?)
            visitorId = req.session.id; // Be careful not to confuse with sessionID
            // Try to prefer user.id if available in future
        }
        // Fallback or specific structure check from EJS logic
        if (!visitorId && req.session.user && req.session.user.user && req.session.user.user.id) {
            visitorId = req.session.user.user.id;
        }
    }

    // 1. User Blog Owner Check
    if (req.blogType === 'user') {
        if (!visitorId || !req.blogOwner) {
            return res.status(403).send('Forbidden: Not logged in or blog owner not found');
        }

        // Loose equality check (string vs number)
        if (visitorId == req.blogOwner.id) {
            return next();
        }
    }

    // 2. Center Blog Admin/Teacher Check
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
            return res.status(400).send('Title is required');
        }

        // Generate Slug (simple)
        const slug = Math.random().toString(36).substring(2, 10); // temporary random slug

        // content might be empty if only using blocks, generate a backup or use empty string
        const htmlContent = content || '';
        const jsonContent = content_json ? JSON.stringify(content_json) : null;

        await queryDatabase(`
            INSERT INTO blog_posts 
            (blog_id, blog_type, title, slug, content, content_json, excerpt, thumbnail_url, is_published, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [
            req.blog.id,
            req.blogType,
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


app.listen(PORT, () => {
    console.log(`🚀 MyUniverse Blog Server running on port ${PORT}`);
});
