const express = require('express');
const router = express.Router();
const { authenticateUser, checkPageAccess } = require('../lib_login/authMiddleware');

// 템플릿 페이지 라우트 - template.ejs 사용
router.get('/',
  authenticateUser,
  checkPageAccess('/template'),
  (req, res) => {
    console.log('템플릿 페이지 요청 - 사용자:', req.session?.userID);

    res.render('template', {  // lesson-view가 아닌 template.ejs 사용
      userID: req.session.userID,
      userRole: req.session.role,
      is_logined: req.session.is_logined,
      centerID: req.session.centerID,
      pageType: 'template',
      pageTitle: '템플릿 테스트 페이지'
    });
  }
);

// templateRouter.js에 추가할 API 엔드포인트들
// 컴포넌트 시스템용 메뉴 데이터 API
router.get('/api/data', authenticateUser, async (req, res) => {
  try {
    const { pageType } = req.query;
    console.log(`Template API - 메뉴 데이터 요청: pageType=${pageType}`);

    // getSheetData 함수 가져오기
    const { getSheetData } = require('../server');

    // 페이지 타입에 따라 시트 이름 선택
    let sheetName = 'Template';
    switch (pageType) {
      case 'python': sheetName = 'Python'; break;
      case 'algorithm': sheetName = 'Algorithm'; break;
      case 'aiMath': sheetName = 'AIMath'; break;
      case 'certification': sheetName = 'Certification'; break;
      case 'dataAnalysis': sheetName = 'DataAnalysis'; break; // 🔥 NEW: 데이터분석 시트
      case 'component': sheetName = 'Template'; break; // 테스트용
      default: sheetName = 'Template';
    }

    console.log(`Template API - 사용할 시트: ${sheetName}`);

    // 선택된 시트에서 데이터 로드
    const data = await getSheetData(`${sheetName}!A2:L`);
    console.log(`Template API - 메뉴 데이터 로드 완료: ${data.length}개 항목`);

    res.json({
      success: true,
      data: data,
      count: data.length,
      sheetName: sheetName // 디버깅용 정보 추가
    });
  } catch (error) {
    console.error('Template API - 메뉴 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 컴포넌트 시스템용 문제 데이터 API  
router.get('/api/problems', authenticateUser, async (req, res) => {
  try {
    const { pageType } = req.query;
    console.log(`Template API - 문제 데이터 요청: pageType=${pageType}`);

    const { getSheetData } = require('../server');
    const data = await getSheetData('problems!A2:N');
    console.log(`Template API - 문제 데이터 로드 완료: ${data.length}개 항목`);

    res.json({
      success: true,
      data: data,
      count: data.length
    });
  } catch (error) {
    console.error('Template API - 문제 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 컴포넌트 시스템 테스트 페이지들도 template.ejs 사용
router.get('/component',
  authenticateUser,
  checkPageAccess('/template'),
  (req, res) => {
    res.render('template', {
      userID: req.session.userID,
      userRole: req.session.role,
      is_logined: req.session.is_logined,
      centerID: req.session.centerID,
      pageType: 'component',
      pageTitle: '컴포넌트 시스템 테스트'
    });
  }
);

router.get('/python-style',
  authenticateUser,
  checkPageAccess('/template'),
  (req, res) => {
    res.render('template', {
      userID: req.session.userID,
      userRole: req.session.role,
      is_logined: req.session.is_logined,
      centerID: req.session.centerID,
      pageType: 'python',
      pageTitle: 'Python 스타일 테스트'
    });
  }
);

router.get('/cert-style',
  authenticateUser,
  checkPageAccess('/template'),
  (req, res) => {
    res.render('template', {
      userID: req.session.userID,
      userRole: req.session.role,
      is_logined: req.session.is_logined,
      centerID: req.session.centerID,
      pageType: 'certification',
      pageTitle: '자격증 스타일 테스트'
    });
  }
);

router.get('/aimath-style',
  authenticateUser,
  checkPageAccess('/template'),
  (req, res) => {
    res.render('template', {
      userID: req.session.userID,
      userRole: req.session.role,
      is_logined: req.session.is_logined,
      centerID: req.session.centerID,
      pageType: 'aiMath',
      pageTitle: 'AI Math 스타일 테스트'
    });
  }
);

// 🔥 NEW: 데이터분석 스타일 테스트 페이지
router.get('/dataanalysis-style',
  authenticateUser,
  checkPageAccess('/template'),
  (req, res) => {
    res.render('template', {
      userID: req.session.userID,
      userRole: req.session.role,
      is_logined: req.session.is_logined,
      centerID: req.session.centerID,
      pageType: 'dataAnalysis',
      pageTitle: '데이터분석 스타일 테스트'
    });
  }
);

// 디버깅 및 API 테스트는 기존 코드 유지
router.get('/debug', authenticateUser, (req, res) => {
  const debugInfo = {
    sessionInfo: {
      userID: req.session?.userID,
      role: req.session?.role,
      is_logined: req.session?.is_logined,
      centerID: req.session?.centerID
    },
    serverTime: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    availableRoutes: [
      '/template',
      '/template/component',
      '/template/python-style',
      '/template/cert-style',
      '/template/aimath-style',
      '/template/dataanalysis-style' // 🔥 NEW
    ]
  };
  res.json(debugInfo);
});

router.get('/api-test', authenticateUser, async (req, res) => {
  try {
    const { getSheetData } = require('../server');

    if (!getSheetData) {
      throw new Error('getSheetData 함수를 찾을 수 없습니다');
    }

    const testResults = {};
    const sheetsToTest = ['Template', 'Python', 'Algorithm', 'AIMath', 'Certification', 'DataAnalysis', 'Default']; // 🔥 DataAnalysis 추가

    for (const sheet of sheetsToTest) {
      try {
        const data = await getSheetData(`${sheet}!A2:L100`);
        testResults[sheet] = {
          success: true,
          count: data.length,
          sample: data.slice(0, 2)
        };
      } catch (error) {
        testResults[sheet] = {
          success: false,
          error: error.message
        };
      }
    }

    res.json({
      message: 'API 테스트 결과',
      results: testResults
    });
  } catch (error) {
    console.error('API 테스트 중 오류:', error);
    res.status(500).json({
      error: 'API 테스트 실패',
      message: error.message
    });
  }
});

module.exports = router;