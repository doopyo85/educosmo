// lib_login/accessControl.js
// MyUniverse 요금제 기반 접근 제어 미들웨어

const { queryDatabase } = require('./db');

/**
 * 교육 콘텐츠 접근 권한 체크
 * Pong2 무료 계정은 교육 콘텐츠에 접근 불가
 */
function requireEducationAccess(req, res, next) {
  // 세션 확인
  if (!req.session?.is_logined) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: '로그인이 필요합니다.',
      redirect: '/auth/login'
    });
  }

  // account_type 확인 (세션에 없으면 DB 조회)
  if (!req.session.account_type) {
    // 세션에 account_type이 없으면 DB에서 조회하여 세션에 저장
    queryDatabase('SELECT account_type FROM Users WHERE userID = ?', [req.session.userID])
      .then(([user]) => {
        if (user) {
          req.session.account_type = user.account_type;
          req.session.save(() => {
            checkAccess(req, res, next);
          });
        } else {
          return res.status(401).json({
            success: false,
            error: 'USER_NOT_FOUND',
            message: '사용자를 찾을 수 없습니다.'
          });
        }
      })
      .catch(err => {
        console.error('DB 조회 오류:', err);
        return res.status(500).json({
          success: false,
          error: 'SERVER_ERROR',
          message: '서버 오류가 발생했습니다.'
        });
      });
  } else {
    checkAccess(req, res, next);
  }
}

async function checkAccess(req, res, next) {
  const accountType = req.session.account_type;

  // 🔥 Phase 3: 센터 상태 확인 (center_student, center_admin만 해당)
  if (accountType === 'center_student' || accountType === 'center_admin') {
    const centerID = req.session.centerID;

    if (centerID) {
      try {
        const [center] = await queryDatabase(
          'SELECT status FROM Centers WHERE id = ?',
          [centerID]
        );

        // 센터가 SUSPENDED 상태면 교육 콘텐츠 차단
        if (center && center.status === 'SUSPENDED') {
          if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(403).json({
              success: false,
              error: 'CENTER_SUSPENDED',
              message: '센터 구독이 만료되어 교육 콘텐츠 이용이 제한됩니다.',
              accountType: accountType,
              callToAction: {
                text: '구독 갱신하기',
                url: '/subscription/plans',
                description: 'Standard 플랜을 구독하시면 모든 기능을 다시 이용하실 수 있습니다.'
              }
            });
          } else {
            return res.redirect('/center-suspended');
          }
        }
      } catch (error) {
        console.error('[AccessControl] 센터 상태 조회 오류:', error);
        // DB 오류 시에도 일단 진행 (fallback)
      }
    }
  }

  // Pong2 무료 계정은 교육 콘텐츠 차단
  if (accountType === 'pong2') {
    // AJAX 요청인지 확인
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(403).json({
        success: false,
        error: 'EDUCATION_ACCESS_DENIED',
        message: '교육 콘텐츠는 센터 회원만 이용 가능합니다.',
        accountType: 'pong2',
        callToAction: {
          text: '센터 코드로 가입하기',
          url: '/center/join',
          description: '학원/학교 센터 코드를 입력하여 모든 교육 콘텐츠를 이용하세요.'
        },
        features: {
          available: ['커뮤니티', '광장', '갤러리', '블로그 (제한)'],
          locked: ['Portal 학습자료', 'PongTube', 'CT 문제은행', 'Entry/Scratch IDE', 'Python Jupyter', 'Judge0 채점']
        }
      });
    } else {
      // 일반 페이지 요청은 안내 페이지로 리다이렉트
      return res.redirect('/education-access-denied');
    }
  }

  // center_student, center_admin은 접근 허용
  next();
}

/**
 * 센터 회원 권한 체크
 * center_student 또는 center_admin만 접근 가능
 */
function requireCenterUser(req, res, next) {
  if (!req.session?.is_logined) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: '로그인이 필요합니다.'
    });
  }

  const accountType = req.session.account_type;

  if (accountType === 'pong2') {
    return res.status(403).json({
      success: false,
      error: 'CENTER_MEMBER_ONLY',
      message: '센터 회원만 이용 가능한 기능입니다.',
      callToAction: {
        text: '센터 가입하기',
        url: '/center/join'
      }
    });
  }

  next();
}

/**
 * 로그인 필수 체크
 */
function requireLogin(req, res, next) {
  if (!req.session?.is_logined) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: '로그인이 필요합니다.'
    });
  }
  next();
}

/**
 * 센터 관리자 권한 체크
 * center_admin만 접근 가능
 */
function requireCenterAdmin(req, res, next) {
  if (!req.session?.is_logined) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: '로그인이 필요합니다.'
    });
  }

  const accountType = req.session.account_type;

  if (accountType !== 'center_admin') {
    return res.status(403).json({
      success: false,
      error: 'ADMIN_ONLY',
      message: '센터 관리자만 접근 가능합니다.'
    });
  }

  next();
}

/**
 * 용량 제한 체크
 * account_type에 따라 다른 용량 제한 적용
 */
async function checkStorageQuota(req, res, next) {
  try {
    const userId = req.user?.id || req.session?.userID;
    const accountType = req.session?.account_type;

    if (!userId || !accountType) {
      return next();
    }

    // 사용자별 용량 제한 조회
    const [user] = await queryDatabase(
      'SELECT storage_limit_bytes FROM Users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return next();
    }

    // 현재 사용량 조회 (UserStorageUsage 테이블이 있다고 가정)
    const [usage] = await queryDatabase(
      'SELECT total_usage FROM UserStorageUsage WHERE user_id = ?',
      [userId]
    );

    const currentUsage = usage?.total_usage || 0;
    const limit = user.storage_limit_bytes;

    // 요청 정보에 용량 정보 추가
    req.storageInfo = {
      used: currentUsage,
      limit: limit,
      percentage: limit > 0 ? (currentUsage / limit * 100).toFixed(2) : 0,
      available: limit - currentUsage
    };

    next();
  } catch (error) {
    console.error('용량 체크 오류:', error);
    next(); // 에러가 있어도 진행
  }
}

/**
 * 블로그 게시글 수 제한 체크 (Pong2 계정 전용)
 */
async function checkBlogPostLimit(req, res, next) {
  try {
    const accountType = req.session?.account_type;

    // Pong2 계정만 제한 적용
    if (accountType !== 'pong2') {
      return next();
    }

    const userId = req.user?.id || req.session?.userID;
    const [user] = await queryDatabase(
      'SELECT blog_post_limit FROM Users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return next();
    }

    // 이번 달 게시글 수 조회
    const [count] = await queryDatabase(`
      SELECT COUNT(*) as post_count
      FROM blog_posts
      WHERE blog_id IN (SELECT id FROM user_blogs WHERE user_id = ?)
      AND YEAR(created_at) = YEAR(CURRENT_DATE)
      AND MONTH(created_at) = MONTH(CURRENT_DATE)
    `, [userId]);

    const currentCount = count?.post_count || 0;
    const limit = user.blog_post_limit || 10;

    if (currentCount >= limit) {
      return res.status(403).json({
        success: false,
        error: 'BLOG_POST_LIMIT_EXCEEDED',
        message: `무료 계정은 월 ${limit}개까지만 게시글을 작성할 수 있습니다.`,
        currentCount,
        limit,
        callToAction: {
          text: '센터 회원 가입하고 무제한 이용하기',
          url: '/center/join'
        }
      });
    }

    // 요청 정보에 게시글 정보 추가
    req.blogPostInfo = {
      currentCount,
      limit,
      remaining: limit - currentCount
    };

    next();
  } catch (error) {
    console.error('블로그 게시글 수 체크 오류:', error);
    next();
  }
}

/**
 * 계정 타입별 기능 제한 정보 반환
 */
function getAccountFeatures(accountType) {
  const features = {
    pong2: {
      name: 'Pong2 무료 계정',
      price: '무료',
      education: false,
      ide: false,
      storage: '500MB',
      blogPosts: '월 10개',
      community: true,
      gallery: true,
      features: [
        '커뮤니티 (아지트, 광장)',
        '갤러리 작품 공유',
        '블로그 (제한적)',
        '프로필 관리'
      ],
      locked: [
        'Portal 학습자료',
        'PongTube 강의 영상',
        'CT 문제은행',
        'Entry/Scratch IDE',
        'Python Jupyter',
        'App Inventor',
        'Judge0 코드 채점'
      ]
    },
    center_student: {
      name: '센터 학생 계정',
      price: '센터 요금제에 포함',
      education: true,
      ide: true,
      storage: '2GB + 센터 공유 30GB',
      blogPosts: '무제한',
      community: true,
      gallery: true,
      features: [
        '모든 교육 콘텐츠',
        '전체 IDE 기능',
        '무제한 블로그',
        '센터 클라우드 보드',
        '과제 제출',
        '학습 분석'
      ],
      locked: []
    },
    center_admin: {
      name: '센터 관리자 계정',
      price: '월 110,000원',
      education: true,
      ide: true,
      storage: '5GB + 센터 공유 30GB',
      blogPosts: '무제한',
      community: true,
      gallery: true,
      features: [
        '모든 교육 콘텐츠',
        '전체 IDE 기능',
        '무제한 블로그',
        '센터 관리 대시보드',
        '학생 관리',
        '과제 관리',
        '학습 분석',
        '센터 클라우드 보드',
        '초대 코드 발급'
      ],
      locked: []
    }
  };

  return features[accountType] || features.pong2;
}

/**
 * 센터 구독 상태 확인 미들웨어
 * Trial 만료 또는 구독 정지 시 접근 차단
 */
async function checkSubscriptionStatus(req, res, next) {
  try {
    const user = req.user || req.session;

    // Pong2 유저는 구독 체크 불필요 (이미 accessControl에서 걸러짐 or 무료 기능만 사용)
    if (!user.centerID || user.account_type === 'pong2') {
      return next();
    }

    // 가장 최근의 유효한 구독 조회
    const [subscription] = await queryDatabase(`
            SELECT * FROM center_subscriptions 
            WHERE center_id = ? 
            ORDER BY created_at DESC LIMIT 1
        `, [user.centerID]);

    if (!subscription) {
      // 구독 기록이 없으면? 무료 체험판 자동 생성 or 차단
      // 여기서는 일단 차단하지 않고 Trial 자동 시작 로직을 넣거나,
      // 엄격하게 차단하려면 return error.
      // MVP에서는 Trial 생성 로직이 가입 시점에 있어야 함.
      // 일단 Pass 하되 로깅
      // console.warn('No subscription found for center:', user.centerID);
      return next();
    }

    const now = new Date();

    // Trial 만료 체크
    if (subscription.status === 'trial' && new Date(subscription.trial_ends_at) < now) {
      return res.status(403).json({
        error: 'SUBSCRIPTION_EXPIRED',
        message: '무료 체험 기간이 만료되었습니다. 구독을 업그레이드해주세요.',
        isExpired: true
      });
    }

    // 정지된 구독
    if (subscription.status === 'suspended' || subscription.status === 'cancelled') {
      return res.status(403).json({
        error: 'SUBSCRIPTION_SUSPENDED',
        message: '구독이 정지되었습니다. 관리자에게 문의하세요.',
        isSuspended: true
      });
    }

    // Active 상태면 통과
    req.subscription = subscription;
    next();

  } catch (error) {
    console.error('Subscription Check Error:', error);
    next(); // 에러 시 일단 통과 (Fail Open) or Block
  }
}


module.exports = {
  requireLogin,
  requireEducationAccess,
  requireCenterUser,
  requireCenterAdmin,
  checkStorageQuota,
  checkBlogPostLimit,
  getAccountFeatures,
  checkSubscriptionStatus
};
