const jwt = require('jsonwebtoken');
const { queryDatabase } = require('./db');
const { JWT } = require('../config');

/**
 * Hybrid Authentication Middleware
 * Supports:
 * 1. Existing Session (Paid Users)
 * 2. JWT Bearer Token (Pong2 Users)
 */
async function pong2Auth(req, res, next) {
    try {
        // 1. Check for existing session (Paid User)
        if (req.session && req.session.user) {
            req.user = {
                ...req.session.user,
                type: 'PAID'
            };
            return next();
        }

        // 2. Check for Bearer Token (Pong2 User)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            try {
                const decoded = jwt.verify(token, JWT.SECRET);

                // Verify user still exists in DB
                const users = await queryDatabase('SELECT id, email, nickname FROM Pong2Users WHERE id = ?', [decoded.id]);

                if (users.length > 0) {
                    req.user = {
                        id: users[0].id,
                        email: users[0].email,
                        nickname: users[0].nickname,
                        type: 'PONG2'
                    };
                    return next();
                }
            } catch (err) {
                // Token invalid or expired
                console.warn('Invalid JWT Token:', err.message);
            }
        }

        // 3. No valid auth found
        // If this is a protected route, the route handler should check for req.user
        // We don't force 401 here to allow "Optional Auth" routes (e.g. read public boards)
        req.user = null;
        next();

    } catch (error) {
        console.error('Pong2 Auth Error:', error);
        next(error);
    }
}

/**
 * Require valid user (Guard)
 */
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Login required' });
    }
    next();
}

/**
 * Require Paid user specifically
 */
function requirePaidUser(req, res, next) {
    if (!req.user || req.user.type !== 'PAID') {
        return res.status(403).json({ error: 'Forbidden', message: 'Paid account required' });
    }
    next();
}

module.exports = {
    pong2Auth,
    requireAuth,
    requirePaidUser
};
