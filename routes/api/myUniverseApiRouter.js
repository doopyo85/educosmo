const express = require('express');
const router = express.Router();
const { queryDatabase } = require('../../lib_login/db');
const { authenticateUser, checkResourcePermission } = require('../../lib_login/authMiddleware');

/**
 * POST /api/myuniverse/blogs/create
 * Create a new user blog
 */
router.post('/blogs/create', authenticateUser, async (req, res) => {
    try {
        const { subdomain, title, description, theme } = req.body;
        const userId = req.session.userID;

        if (!subdomain) {
            return res.status(400).json({ error: 'Subdomain is required' });
        }

        // 1. Validate Subdomain (Alphanumeric, 4-20 chars)
        const subdomainRegex = /^[a-z0-9]{4,20}$/;
        if (!subdomainRegex.test(subdomain)) {
            return res.status(400).json({ error: 'Subdomain must be 4-20 lowercase alphanumeric characters.' });
        }

        // 2. Check Availability
        // Check User Blogs
        const [existingUserBlog] = await queryDatabase('SELECT id FROM user_blogs WHERE subdomain = ?', [subdomain]);
        if (existingUserBlog) {
            return res.status(409).json({ error: 'Subdomain is already taken.' });
        }

        // Check Center Blogs
        const [existingCenterBlog] = await queryDatabase('SELECT id FROM center_blogs WHERE subdomain = ?', [subdomain]);
        if (existingCenterBlog) {
            return res.status(409).json({ error: 'Subdomain is already taken.' });
        }

        // 3. User Limit Check (One blog per user)
        const [userBlog] = await queryDatabase('SELECT id FROM user_blogs WHERE user_id = (SELECT id FROM Users WHERE userID = ?)', [userId]);
        if (userBlog) {
            return res.status(409).json({ error: 'You already have a blog.' });
        }

        // 4. Create Blog
        const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);

        await queryDatabase(`
            INSERT INTO user_blogs (user_id, subdomain, title, description, theme)
            VALUES (?, ?, ?, ?, ?)
        `, [user.id, subdomain, title || 'My Universe', description || '', theme || 'galaxy']);

        res.json({ success: true, subdomain, message: 'Blog created successfully' });

    } catch (error) {
        console.error('Create Blog Error:', error);
        res.status(500).json({ error: 'Failed to create blog' });
    }
});

/**
 * GET /api/myuniverse/blogs/check/:subdomain
 * Check if subdomain is available
 */
router.get('/blogs/check/:subdomain', async (req, res) => {
    try {
        const { subdomain } = req.params;

        // Validation
        const subdomainRegex = /^[a-z0-9]{4,20}$/;
        if (!subdomainRegex.test(subdomain)) {
            return res.json({ available: false, message: 'Invalid format' });
        }

        // Reserved Words check
        const reserved = ['www', 'api', 'admin', 'mail', 'blog', 'shop', 'test'];
        if (reserved.includes(subdomain)) {
            return res.json({ available: false, message: 'Reserved word' });
        }

        // Check Availability
        const [userBlog] = await queryDatabase('SELECT id FROM user_blogs WHERE subdomain = ?', [subdomain]);
        if (userBlog) return res.json({ available: false });

        const [centerBlog] = await queryDatabase('SELECT id FROM center_blogs WHERE subdomain = ?', [subdomain]);
        if (centerBlog) return res.json({ available: false });

        res.json({ available: true });

    } catch (error) {
        console.error('Check Blog Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/myuniverse/blogs/my
 * Get current user's blog info
 */
router.get('/blogs/my', authenticateUser, async (req, res) => {
    try {
        const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [req.session.userID]);
        const [blog] = await queryDatabase('SELECT * FROM user_blogs WHERE user_id = ?', [user.id]);

        if (!blog) {
            return res.json({ hasBlog: false });
        }

        res.json({
            hasBlog: true,
            blog: {
                subdomain: blog.subdomain,
                title: blog.title,
                url: `http://${blog.subdomain}.pong2.app` // Should be https in prod
            }
        });

    } catch (error) {
        console.error('Get My Blog Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
