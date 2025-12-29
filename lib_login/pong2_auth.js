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
        if (req.session && req.session.is_logined && req.session.userID) {
            // 🔥 DB에서 실제 숫자 ID 조회
            try {
                const users = await queryDatabase(
                    'SELECT id, name, userID, role, centerID FROM Users WHERE userID = ?', 
                    [req.session.userID]
                );
                
                if (users.length > 0) {
                    req.user = {
                        id: users[0].id,          // 숫자 id (Users.id PK)
                        userID: users[0].userID,  // 문자열 userID
                        name: users[0].name,
                        nickname: users[0].name,
                        role: users[0].role || req.session.role || 'student',
                        centerID: users[0].centerID || req.session.centerID,
                        type: 'PAID'
                    };
                    console.log('✅ [pong2Auth] Session user authenticated:', req.user.userID, '-> id:', req.user.id);
                    return next();
                }
            } catch (dbError) {
                console.error('❌ [pong2Auth] Session user lookup error:', dbError.message);
            }
            
            // 🔥 DB 조회 실패해도 세션 기반으로 기본 인증 허용 (읽기 전용)
            console.log('⚠️ [pong2Auth] DB lookup failed, using session data for:', req.session.userID);
            req.user = {
                id: null,  // 숫자 ID 없음 - 쓰기 작업 시 별도 처리 필요
                userID: req.session.userID,
                name: req.session.username || req.session.userID,
                nickname: req.session.userID,
                role: req.session.role || 'student',
                centerID: req.session.centerID || null,
                type: 'PAID',
                _sessionOnly: true  // 🔥 플래그: DB ID 없음 표시
            };
            return next();
        }

        // 2. Check for Bearer Token (Pong2 User or SSO)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            try {
                const decoded = jwt.verify(token, JWT.SECRET);

                if (decoded.type === 'PAID') {
                    // 2a. Paid User Token (SSO)
                    // 🔥 수정: decoded.id는 숫자 PK이므로 WHERE id = ? 사용
                    const users = await queryDatabase(
                        'SELECT id, name, userID, role, centerID FROM Users WHERE id = ?', 
                        [decoded.id]
                    );
                    
                    if (users.length > 0) {
                        req.user = {
                            id: users[0].id,
                            userID: users[0].userID,
                            name: users[0].name,
                            nickname: users[0].name,
                            role: users[0].role,
                            centerID: users[0].centerID,
                            type: 'PAID'
                        };
                        console.log('✅ [pong2Auth] JWT PAID user:', req.user.userID);
                        return next();
                    }

                } else {
                    // 2b. Pong2 Local User Token
                    const users = await queryDatabase(
                        'SELECT id, email, nickname FROM Pong2Users WHERE id = ?', 
                        [decoded.id]
                    );

                    if (users.length > 0) {
                        req.user = {
                            id: users[0].id,
                            email: users[0].email,
                            nickname: users[0].nickname,
                            type: 'PONG2'
                        };
                        console.log('✅ [pong2Auth] JWT PONG2 user:', req.user.nickname);
                        return next();
                    }
                }
            } catch (err) {
                console.warn('⚠️ [pong2Auth] Invalid JWT Token:', err.message);
            }
        }

        // 3. No valid auth found - 공개 라우트 허용
        req.user = null;
        next();

    } catch (error) {
        console.error('❌ [pong2Auth] Error:', error);
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
 * Require user with valid DB ID (for write operations)
 */
function requireDbUser(req, res, next) {
    if (!req.user || typeof req.user.id !== 'number') {
        return res.status(401).json({ error: 'Unauthorized', message: 'Valid user account required' });
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
    requireDbUser,
    requirePaidUser
};
