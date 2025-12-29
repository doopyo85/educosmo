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
        if (req.session && (req.session.userID || req.session.user)) {
            const sessionUserID = req.session.userID || req.session.user?.userID;
            
            // 🔥 중요: DB에서 실제 숫자 id 조회 (FK 제약 대응)
            if (sessionUserID) {
                try {
                    const users = await queryDatabase(
                        'SELECT id, name, userID, role, centerID FROM Users WHERE userID = ?', 
                        [sessionUserID]
                    );
                    
                    if (users.length > 0) {
                        req.user = {
                            id: users[0].id,          // 🔥 숫자 id (Users.id PK)
                            userID: users[0].userID,  // 문자열 userID (참고용)
                            name: users[0].name,
                            nickname: users[0].name,
                            role: users[0].role || req.session.role || 'student',
                            centerID: users[0].centerID || req.session.centerID,
                            type: 'PAID'
                        };
                        return next();
                    }
                } catch (dbError) {
                    console.error('Session user lookup error:', dbError);
                }
            }
            
            // DB 조회 실패 시 세션 값 사용 (비권장, 하위 호환성)
            req.user = {
                id: null,  // 🔥 null로 설정하여 FK 오류 방지
                userID: sessionUserID,
                name: req.session.username || 'Unknown',
                nickname: req.session.userNickname || sessionUserID,
                role: req.session.role || 'student',
                centerID: req.session.centerID || null,
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
                    // 🔥 decoded.id가 userID(문자열)일 수 있으므로 DB 조회 필수
                    const users = await queryDatabase(
                        'SELECT id, name, userID, role, centerID FROM Users WHERE userID = ?', 
                        [decoded.id]
                    );
                    
                    if (users.length > 0) {
                        req.user = {
                            id: users[0].id,          // 🔥 숫자 id
                            userID: users[0].userID,  // 문자열 userID
                            name: users[0].name,
                            nickname: users[0].name,
                            role: users[0].role,
                            centerID: users[0].centerID,
                            type: 'PAID'
                        };
                        return next();
                    }

                } else {
                    // 2b. Pong2 User Token
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
                        return next();
                    }
                }
            } catch (err) {
                console.warn('Invalid JWT Token:', err.message);
            }
        }

        // 3. No valid auth found
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
