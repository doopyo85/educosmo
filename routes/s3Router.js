/**
 * 🗄️ S3 브라우저 통합 라우터
 * Admin, Teacher, Student 공통 사용
 * 역할별 권한 자동 설정
 */

const express = require('express');
const router = express.Router();
const config = require('../config'); // 🔥 config import
const { authenticateUser } = require('../lib_login/authMiddleware');

/**
 * GET /s3/browser
 * S3 파일 탐색기 페이지
 * 역할별 자동 권한 설정
 */
router.get('/browser', authenticateUser, (req, res) => {
  try {
    const userID = req.session.userID;
    const role = req.session.role;
    const centerID = req.session.centerID;
    const initialPath = req.query.initialPath || ''; // 🔥 초기 경로 파라미터

    console.log(`📂 S3 브라우저 접근 - User: ${userID}, Role: ${role}, InitialPath: ${initialPath}`);

    // 🔥 역할별 설정
    let config = {
      userID: userID,
      role: role,
      is_logined: req.session.is_logined,
      centerID: centerID,
      pageTitle: 'S3 파일 관리',
      initialPath: initialPath, // 🔥 초기 경로 전달
      s3AssetUrl: config.S3.ASSET_URL // 🔥 NCP Asset URL 전달
    };

    // 🎯 역할별 scope, enableDelete 설정
    switch (role) {
      case 'admin':
        config.scope = 'all';           // 전체 접근
        config.enableDelete = true;     // 삭제 가능
        config.pageTitle = 'S3 파일 관리 (전체)';
        break;

      case 'manager':
      case 'teacher':
        config.scope = 'center';        // 센터 학생만
        config.enableDelete = true;     // 삭제 가능
        config.pageTitle = `학생 파일 관리 (센터 ${centerID})`;
        break;

      case 'student':
        config.scope = 'self';          // 본인만
        config.enableDelete = true;     // 본인 파일 삭제 가능
        config.pageTitle = '내 파일 관리';
        break;

      case 'school':
      case 'kinder':
        config.scope = 'center';        // 소속 학생만
        config.enableDelete = false;    // 조회만 가능
        config.pageTitle = '학생 파일 조회';
        break;

      default:
        // guest 또는 기타
        return res.status(403).json({
          success: false,
          error: '접근 권한이 없습니다.'
        });
    }

    console.log(`✅ S3 설정 - Scope: ${config.scope}, Delete: ${config.enableDelete}`);

    // S3 브라우저 페이지 렌더링
    res.render('common/s3-browser', config);

  } catch (error) {
    console.error('❌ S3 브라우저 오류:', error);
    res.status(500).send('페이지 로드에 실패했습니다.');
  }
});

/**
 * GET /s3/my-files (학생 전용 단축 링크)
 * /s3/browser와 동일하지만 student만 접근
 */
router.get('/my-files', authenticateUser, (req, res) => {
  if (req.session.role !== 'student') {
    return res.redirect('/s3/browser');
  }

  res.render('common/s3-browser', {
    userID: req.session.userID,
    role: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageTitle: '내 파일 관리',
    scope: 'self',
    enableDelete: true,
    s3AssetUrl: config.S3.ASSET_URL
  });
});

/**
 * GET /s3/student-files (교사 전용 단축 링크)
 * /s3/browser와 동일하지만 teacher/manager만 접근
 */
router.get('/student-files', authenticateUser, (req, res) => {
  const allowedRoles = ['admin', 'teacher', 'manager'];

  if (!allowedRoles.includes(req.session.role)) {
    return res.status(403).send('교사 권한이 필요합니다.');
  }

  res.render('common/s3-browser', {
    userID: req.session.userID,
    role: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageTitle: '학생 파일 관리',
    scope: req.session.role === 'admin' ? 'all' : 'center',
    enableDelete: true,
    s3AssetUrl: config.S3.ASSET_URL
  });
});

module.exports = router;
