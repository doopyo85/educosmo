// lib_login/authMiddleware.js
const { hasPageAccess } = require('./permissions');
const { hasResourcePermission } = require('./resourcePermissions'); // 🔥 Resource Permission 추가
const { queryDatabase } = require('./db');
const jwt = require('jsonwebtoken'); // 🔥 JWT 추가
const { JWT } = require('../config'); // 🔥 Config 추가

// permissions.json 파일 가져오기 추가
const fs = require('fs');
const path = require('path');
const permissionsPath = path.join(__dirname, './permissions.json');
const permissions = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));

// 공통 인증 실패 처리 함수
function handleUnauthorized(req, res, message) {
  // 🔥 세션 만료 로그 기록
  if (req.session?.userID) {
    const logSessionExpiry = async () => {
      try {
        const { queryDatabase } = require('./db');
        const [user] = await queryDatabase(
          'SELECT id, centerID FROM Users WHERE userID = ?',
          [req.session.userID]
        );

        if (user) {
          await queryDatabase(`
            INSERT INTO UserActivityLogs 
            (user_id, center_id, action_type, url, ip_address, user_agent, action_detail) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            user.id,
            user.centerID,
            'SESSION_EXPIRE',
            req.originalUrl.substring(0, 255),
            req.ip,
            req.headers['user-agent'],
            'Session expired - auto logout'
          ]);
        }
      } catch (err) {
        console.error('Session expiry logging error:', err);
      }
    };
    logSessionExpiry();
  }

  // 기존 코드 유지
  if (req.xhr ||
    (req.headers.accept && req.headers.accept.indexOf('json') > -1) ||
    req.path.startsWith('/api/')) {
    return res.status(401).json({
      loggedIn: false,
      error: message,
      redirect: '/auth/login'
    });
  }

  req.session.loginMessage = message;
  return res.redirect('/auth/login');
}

// 기본 사용자 인증 미들웨어
const authenticateUser = (req, res, next) => {
  // 🔥 1. JWT 토큰 확인 (Bearer Token) - Pong2 등 외부 API 호출용
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT.SECRET);

      // 토큰이 유효하면 세션 객체에 사용자 정보 주입 (기존 로직 호환성 유지)
      // express-session이 이미 req.session을 생성했을 것이므로 속성만 설정
      if (!req.session) req.session = {};

      req.session.is_logined = true;
      req.session.userID = decoded.userID;
      req.session.role = decoded.role;
      req.session.centerID = decoded.centerID;
      req.session.userType = decoded.userType;

      // console.log('✅ JWT 인증 성공:', decoded.userID);
      return next();
    } catch (err) {
      console.error('❌ JWT 인증 실패:', err.message);

      // 🔥 Fallback: 토큰이 만료되었거나 유효하지 않더라도, 
      // 웹 세션이 유효하다면 통과시킴 (브라우저에서 stale token이 헤더에 남아있는 경우 방지)
      if (req.session && req.session.is_logined) {
        console.log('✅ JWT 실패했으나 유효한 세션이 있어 통과함:', req.session.userID);
        return next();
      }

      return res.status(401).json({
        success: false,
        loggedIn: false,
        error: '유효하지 않은 인증 토큰입니다.',
        code: 'INVALID_TOKEN'
      });
    }
  }

  if (req.session && req.session.is_logined) {
    // 🔥 Activity Logging for Timeline
    // Only log meaningful page views (GET requests, not APIs/resources)
    if (req.method === 'GET' && !req.xhr && !req.path.startsWith('/api/') && !req.path.startsWith('/resource/') && !req.path.startsWith('/node_modules/')) {
      // Async logging - do not await
      const { queryDatabase } = require('./db');

      // Use subquery to get numeric user_id from string userID (username)
      // Truncate URL to avoid DB error
      const safeUrl = req.originalUrl.substring(0, 255);
      const safeActionDetail = ('Page View: ' + req.path).substring(0, 255);

      queryDatabase(`
        INSERT INTO UserActivityLogs 
        (user_id, center_id, action_type, url, ip_address, user_agent, action_detail, status) 
        SELECT 
           id, 
           ?, 
           ?, 
           ?, 
           ?, 
           ?, 
           ?, 
           'success'
        FROM Users 
        WHERE userID = ?
      `, [
        req.session.centerID,
        'GET',
        safeUrl,
        req.ip,
        req.headers['user-agent'],
        safeActionDetail,
        req.session.userID
      ]).catch(err => {
        // Silently fail or log to console if needed
        // console.error('Activity Logging Error:', err.message);
      });
    }

    // 세션이 존재하고 로그인 상태이면 다음 미들웨어로 진행
    next();
  } else {
    // 로그인되지 않은 경우 친절한 메시지와 함께 처리
    handleUnauthorized(req, res, '오랜 시간동안 접속하지 않아 로그아웃되었습니다.');
  }
};

const checkAdminRole = async (req, res, next) => {
  console.log('Checking admin role', {
    session: req.session,
    isLoggedIn: req.session?.is_logined,
    userRole: req.session?.role
  });

  if (!req.session?.is_logined) {
    return handleUnauthorized(req, res, '오랜 시간동안 접속하지 않아 로그아웃되었습니다.');
  }

  try {
    const [user] = await queryDatabase(
      'SELECT role FROM Users WHERE userID = ?',
      [req.session.userID]
    );

    if (user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

function checkRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session?.is_logined) {
      return handleUnauthorized(req, res, '오랜 시간동안 접속하지 않아 로그아웃되었습니다.');
    }

    const userRole = req.session.role;

    // 디버깅 로그 추가
    console.log('현재 사용자 역할:', userRole);
    console.log('허용된 역할:', allowedRoles);
    console.log('권한 확인 결과:', allowedRoles.includes(userRole));

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: '접근 권한이 없습니다.'
      });
    }

    next();
  };
}

function checkPageAccess(requiredPage) {
  return async (req, res, next) => {
    if (!req.session?.is_logined) {
      return handleUnauthorized(req, res, '오랜 시간동안 접속하지 않아 로그아웃되었습니다.');
    }

    const userRole = req.session.role;

    // 디버깅 로그 추가
    console.log('현재 사용자 역할:', userRole);
    console.log('요청한 페이지:', requiredPage);

    // permissions.json에서 해당 페이지에 필요한 역할 확인
    const requiredRoles = permissions.pages[requiredPage]?.roles || [];
    console.log('페이지에 필요한 역할:', requiredRoles);
    console.log('권한 확인 결과:', requiredRoles.includes(userRole));

    if (!hasPageAccess(userRole, requiredPage)) {
      // 403.ejs 파일이 없는 경우 대비
      try {
        return res.status(403).render('403', {
          message: '이 페이지에 대한 접근 권한이 없습니다.'
        });
      } catch (error) {
        console.error('Error rendering 403 page:', error);
        return res.status(403).send('이 페이지에 대한 접근 권한이 없습니다.');
      }
    }

    next();
  };
}

/**
 * Middleware to check resource permissions
 * Usage: router.post('/', checkResourcePermission('center:create'), (req, res) => ...)
 */
function checkResourcePermission(action) {
  return async (req, res, next) => {
    if (!req.session?.is_logined) {
      return handleUnauthorized(req, res, '오랜 시간동안 접속하지 않아 로그아웃되었습니다.');
    }

    try {
      const { queryDatabase } = require('./db');
      // Get fresh user data including account_type and centerID
      const [user] = await queryDatabase(
        'SELECT id, userID, role, centerID, account_type FROM Users WHERE userID = ?',
        [req.session.userID]
      );

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // For owner checks, we might need to fetch the specific resource.
      // This generic middleware works best for static permission checks.
      // For dynamic "owner" checks, controllers should call `hasResourcePermission` manually with the resource object.

      if (!hasResourcePermission(user, action)) {
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `You do not have permission to perform: ${action}`
        });
      }

      // Save fresh user data to request for controller use
      req.user = user;
      next();
    } catch (error) {
      console.error('Resource permission check error:', error);
      return res.status(500).json({ error: 'Server error check permissions' });
    }
  };
}

module.exports = {
  authenticateUser,
  checkPageAccess,
  checkRole,
  checkAdminRole,
  checkResourcePermission, // 🔥 Export new middleware
  handleUnauthorized // 필요한 경우 외부에서 직접 사용할 수 있도록 내보냄
};