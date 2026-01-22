require('dotenv').config();
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const path = require('path');
const config = require('./config');
const { queryDatabase } = require('./lib_login/db');

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
            LIMIT ? OFFSET ?
        `, [req.blog.id, req.blogType, limit, offset]);

        const [countResult] = await queryDatabase(`
            SELECT COUNT(*) as total 
            FROM blog_posts 
            WHERE blog_id = ? AND blog_type = ? AND is_published = TRUE
        `, [req.blog.id, req.blogType]);

        const totalPosts = countResult.total;
        const totalPages = Math.ceil(totalPosts / limit);

        const template = req.blogType === 'user' ? 'blog/user_theme_galaxy' : 'blog/center_theme_board';

        res.render(template, {
            blog: req.blog,
            owner: req.blogOwner,
            posts: posts,
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
        res.render(template, {
            blog: req.blog,
            owner: req.blogOwner,
            post: post,
            user: req.session
        });

    } catch (error) {
        console.error('Post detail error:', error);
        res.status(500).send('Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 MyUniverse Blog Server running on port ${PORT}`);
});
