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
        // Matches apiRouter.js session structure
        if (req.session && (req.session.userID || req.session.user)) {
            req.user = {
                id: req.session.userID || req.session.user.id,
                name: req.session.username || (req.session.user ? req.session.user.name : 'Unknown'),
                nickname: req.session.userNickname || (req.session.user ? req.session.user.nickname : req.session.userID),
                role: req.session.role || (req.session.user ? req.session.user.role : 'student'),
                centerID: req.session.centerID || (req.session.user ? req.session.user.centerID : null),
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

                if (decoded.type === 'PAID') {
                    // 2a. Paid User Token
                    // We can trust the signature generally, but good to check if user exists/is active if needed.
                    // For performance, we'll trust the token claims for now as they are short-lived.
                    req.user = {
                        id: decoded.id,
                        type: 'PAID',
                        centerID: decoded.centerID,
                        role: decoded.role,
                        // Fetch name if needed, or rely on client to know it? 
                        // For 'auth/me', we need the name. Let's fetch it lazily or just query DB.
                    };

                    // Optimization: If we need nickname/name populated for everything, query DB.
                    // Let's query DB to be safe and consistent with session-based user.
                    // FIX: Process 'nickname' column error - Users table might not have nickname
                    // FIX: Use 'userID' column for lookup as token.id might be the username string (e.g. 'minho')
                    const users = await queryDatabase('SELECT id, name, role, centerID FROM Users WHERE userID = ?', [decoded.id]);
                    if (users.length > 0) {
                        req.user = {
                            ...req.user,
                            name: users[0].name,
                            nickname: users[0].name, // Use name as nickname for Paid Users
                            role: users[0].role,
                            centerID: users[0].centerID
                        };
                        return next();
                    }

                } else {
                    // 2b. Pong2 User Token (Existing logic)
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
