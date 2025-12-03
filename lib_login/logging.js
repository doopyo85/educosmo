// lib_login/logging.js
const { queryDatabase } = require('./db');
const { Roles } = require('../config');

const recentLogs = new Map();


const logUserActivity = async (req, res, next) => {
    const isAuthRequest = req.path.includes('/auth/login_process') || 
                          req.path.includes('/logout');
    
    if (!req.session?.is_logined && !isAuthRequest) {
        return next();
    }

    try {
        let userId, centerId;
        
        if (isAuthRequest && req.body?.userID) {
            const sql = `SELECT id, centerID FROM Users WHERE userID = ?`;
            const [user] = await queryDatabase(sql, [req.body.userID]);
            if (user) {
                userId = user.id;
                centerId = user.centerID;
            }
        } else if (req.session?.userID) {
            const sql = `SELECT id, centerID FROM Users WHERE userID = ?`;
            const [user] = await queryDatabase(sql, [req.session.userID]);
            if (user) {
                userId = user.id;
                centerId = user.centerID;
            }
        }

        if (userId) {
            // 🔥 중복 체크 (1초 이내 동일 요청)
            const logKey = `${userId}-${req.method}-${req.originalUrl}`;
            const now = Date.now();
            const lastLog = recentLogs.get(logKey);
            
            if (lastLog && (now - lastLog) < 1000) {
                return next(); // 1초 이내 중복 요청 무시
            }
            recentLogs.set(logKey, now);
            
            // 메모리 관리: 1분 이상 된 항목 삭제
            if (recentLogs.size > 1000) {
                const cutoff = now - 60000;
                for (const [key, time] of recentLogs.entries()) {
                    if (time < cutoff) recentLogs.delete(key);
                }
            }
            
            let status = 'active';
            if (req.originalUrl.includes('login_process')) {
                status = 'login';
            } else if (req.originalUrl.includes('logout')) {
                status = 'logout';
            }
            
            await queryDatabase(`
                INSERT INTO UserActivityLogs 
                (user_id, center_id, action_type, url, ip_address, user_agent, action_detail, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId,
                centerId,
                req.method,
                req.originalUrl,
                req.ip,
                req.headers['user-agent'],
                `${req.method} ${req.originalUrl}`,
                status
            ]);
        }
    } catch (error) {
        console.error('Activity logging error:', error);
    }
    next();
};

// 메뉴 접근 로깅
let menuAccessStartTimes = new Map();

function logMenuAccess(req, res, next) {
    if (!req.session?.is_logined) {
        return next();
    }

    const startTime = new Date();
    const url = req.originalUrl;
    menuAccessStartTimes.set(`${req.session.userID}-${url}`, startTime);

    // 응답이 완료될 때 로그 기록
    res.on('finish', async () => {
        try {
            const sql = `SELECT id, centerID FROM Users WHERE userID = ?`;
            const [user] = await queryDatabase(sql, [req.session.userID]);
            
            if (user) {
                const startTime = menuAccessStartTimes.get(`${req.session.userID}-${url}`);
                const duration = Math.round((new Date() - startTime) / 1000); // 초 단위

                await queryDatabase(
                    `INSERT INTO MenuAccessLogs 
                    (user_id, menu_name, duration, center_id) 
                    VALUES (?, ?, ?, ?)`,

                    [user.id, url.split('/')[1] || 'home', duration, user.centerID]
                );

                menuAccessStartTimes.delete(`${req.session.userID}-${url}`);
            }
        } catch (error) {
            console.error('Menu access logging error:', error);
        }
    });

    next();
}

// 학습 활동 로깅
async function logLearningActivity(req, res, next) {
    if (!req.session?.is_logined) {
        return next();
    }

    console.log(' Logging learning activity:', req.originalUrl); // 요청 URL 확인
    console.log(' 세션 정보:', req.session); // 세션 값 확인

    try {
        const sql = `SELECT id, centerID FROM Users WHERE userID = ?`;
        const [user] = await queryDatabase(sql, [req.session.userID]);

        if (user) {
            console.log(' User found:', user);

            const validPaths = ['/scratch', '/entry', '/python'];
            const matchedPath = validPaths.find(path => req.originalUrl.startsWith(path));

            if (matchedPath) {
                const contentType = matchedPath.substring(1); // '/' 제거

                console.log(' Inserting learning log:', {
                    user_id: user.id,
                    contentType: contentType,
                    contentName: req.originalUrl,
                    centerID: user.centerID
                });

                await queryDatabase(
                    `INSERT INTO LearningLogs 
                    (user_id, content_type, content_name, start_time, center_id) 
                    VALUES (?, ?, ?, NOW(), ?)`,
                    [user.id, contentType, req.originalUrl, user.centerID]
                );

                console.log(' Learning log inserted successfully!');
            } else {
                console.log(' No matching path for learning log:', req.originalUrl);
            }
        }
    } catch (error) {
        console.error(' Learning activity logging error:', error);
    }
    next();
}

module.exports = {
    logUserActivity,
    logMenuAccess,
    logLearningActivity
};
