// routes/api/problemRouter.js
// 각 페이지(certification, python, algorithm, aiMath)의 메뉴 및 문제 데이터를 제공하는 라우터

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');

const { getSheetData } = require('../../lib_google/sheetService');

// 공통 오류 처리 함수
const handleApiRequest = async (req, res, sheetRange, errorMessage) => {
  try {
    // 요청 로깅
    console.log(`API 요청: ${req.originalUrl}, 시트 범위: ${sheetRange}`);

    // 데이터 가져오기
    const data = await getSheetData(sheetRange);

    // 빈 데이터 확인
    if (!data || !Array.isArray(data)) {
      console.warn(`데이터 없음: ${sheetRange}`);
      return res.json([]);
    }

    // 응답 로깅
    console.log(`데이터 조회 성공: ${sheetRange}, ${data?.length || 0}개 항목`);

    // 응답 반환
    res.json(data || []);
  } catch (error) {
    // 오류 로깅
    console.error(`${errorMessage}:`, error);
    console.error('오류 세부 정보:', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      range: sheetRange
    });

    // 오류 응답
    res.status(500).json({
      error: errorMessage,
      message: error.message
    });
  }
};

const pageTypeToSheetRange = {
  'python': 'Python!A2:F100',
  'algorithm': 'Algorithm!A2:F100',
  'aiMath': 'AIMath!A2:F100',
  'certification': 'Certification!A2:F100',
  'template': 'Template!A2:F100',  // 추가된 부분
  'default': 'Default!A2:F100'
};

const pageTypeToProblemRange = {
  'python': 'Problems!A2:N500',  // 🔥 수정: N열까지 확장
  'algorithm': 'Problems!A2:N500',  // 🔥 수정: N열까지 확장
  'aiMath': 'Problems!A2:N500',  // 🔥 수정: N열까지 확장
  'certification': 'Problems!A2:N500',  // 🔥 수정: N열까지 확장
  'template': 'Problems!A2:N500',  // 🔥 수정: N열까지 확장
  'default': 'Problems!A2:N500'  // 🔥 수정: N열까지 확장
};

// 공통 메뉴 데이터 API
router.get('/get-menu-data', authenticateUser, async (req, res) => {
  try {
    const { pageType } = req.query;
    const sheetRange = pageTypeToSheetRange[pageType] || 'Certification!A2:F100';

    await handleApiRequest(
      req, res,
      sheetRange,
      `${pageType || 'certification'} 메뉴 데이터를 불러오는 중 오류가 발생했습니다`
    );
  } catch (error) {
    console.error('메뉴 데이터 로드 오류:', error);
    res.status(500).json({ error: '메뉴 데이터 로드 오류' });
  }
});

// 공통 문제 데이터 API
router.get('/get-problem-data', authenticateUser, async (req, res) => {
  try {
    const { pageType } = req.query;
    const sheetRange = pageTypeToProblemRange[pageType] || 'Problems!A2:D500';

    await handleApiRequest(
      req, res,
      sheetRange,
      `${pageType || 'certification'} 문제 데이터를 불러오는 중 오류가 발생했습니다`
    );
  } catch (error) {
    console.error('문제 데이터 로드 오류:', error);
    res.status(500).json({ error: '문제 데이터 로드 오류' });
  }
});

//=============================================================================
// 메뉴 데이터 API 엔드포인트
//=============================================================================

// Certification 메뉴 데이터
router.get('/get-certification-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'Certification!A2:F100',
    '자격증 메뉴 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Python 메뉴 데이터
router.get('/get-python-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'Python!A2:F100',
    '파이썬 메뉴 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Algorithm 메뉴 데이터
router.get('/get-algorithm-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'Algorithm!A2:F100',
    '알고리즘 메뉴 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// AI Math 메뉴 데이터
router.get('/get-aimath-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'AIMath!A2:F100',
    'AI 수학 메뉴 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// AppInventor 메뉴 데이터
router.get('/get-appinventor-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'AppInventor!A2:F100',
    '앱인벤터 메뉴 데이터를 불러오는 중 오류가 발생했습니다'
  );
});


//=============================================================================
// 문제 데이터 API 엔드포인트
//=============================================================================

// 기본 문제 데이터 (공통) - 🔥 수정: N열까지 확장
router.get('/get-problem-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'Problems!A2:N500',
    '문제 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Certification 문제 데이터 - 🔥 수정: N열까지 확장
router.get('/get-certification-problem-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'Problems!A2:N500',
    '자격증 문제 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Python 문제 데이터 - 🔥 수정: N열까지 확장
router.get('/get-python-problem-data', authenticateUser, async (req, res) => {
  // Python 문제 데이터는 'Problems' 시트에서 가져옴
  await handleApiRequest(
    req, res,
    'Problems!A2:N500',
    '파이썬 문제 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Algorithm 문제 데이터 - 🔥 수정: N열까지 확장
router.get('/get-algorithm-problem-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'Problems!A2:N500',
    '알고리즘 문제 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// AI Math 문제 데이터 - 🔥 수정: N열까지 확장
router.get('/get-aimath-problem-data', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res,
    'Problems!A2:N500',
    'AI 수학 문제 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

//=============================================================================
// 파이썬 코드 실행 API
//=============================================================================

// 파이썬 코드 실행
router.post('/run-python', (req, res) => {
  const { exec } = require('child_process');
  const fs = require('fs');
  const path = require('path');

  try {
    const userCode = req.body.code;
    if (!userCode || typeof userCode !== 'string') {
      return res.status(400).json({ output: '코드가 제공되지 않았습니다.' });
    }

    // 고유한 임시 파일 생성
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.py`;
    const tempPath = path.join(__dirname, '../../', tempFilename);

    // 파일에 코드 저장
    fs.writeFileSync(tempPath, userCode);

    // 코드 실행 (타임아웃 설정)
    const timeout = 10000; // 10초 타임아웃
    const child = exec(`python3 ${tempPath}`, { timeout }, (error, stdout, stderr) => {
      // 임시 파일 정리
      fs.unlinkSync(tempPath);

      if (error) {
        if (error.killed) {
          return res.json({ output: '실행 시간이 초과되었습니다 (10초 제한).' });
        }
        return res.json({ output: `실행 오류: ${error.message}` });
      }

      if (stderr) {
        return res.json({ output: `오류: ${stderr}` });
      }

      // 출력 결과 전송
      res.json({ output: stdout || '출력 없음' });
    });

    // 메모리 사용량 제한 (100MB)
    if (child.pid) {
      try {
        process.kill(child.pid, 'SIGSTOP');
        exec(`prlimit --pid ${child.pid} --as=100000000`, () => {
          process.kill(child.pid, 'SIGCONT');
        });
      } catch (e) {
        console.warn('프로세스 리소스 제한 설정 실패:', e);
      }
    }
  } catch (error) {
    console.error('코드 실행 중 서버 오류:', error);
    res.status(500).json({ output: '서버 오류가 발생했습니다: ' + error.message });
  }
});

//=============================================================================
// PPT URL 생성 API
//=============================================================================

// PPT URL 가져오기
router.get('/get-ppt', authenticateUser, async (req, res) => {
  try {
    const { examName, problemNumber } = req.query;

    if (!examName) {
      return res.status(400).json({
        success: false,
        message: '필수 매개변수가 누락되었습니다 (examName)'
      });
    }

    // PPT 데이터를 찾기 위한 시트 범위
    const sheetRange = 'PPTs!A2:C500';

    try {
      const pptData = await getSheetData(sheetRange);

      // examName과 일치하는 PPT URL 찾기
      const pptInfo = pptData.find(row =>
        row[0] && row[0].toLowerCase() === examName.toLowerCase() &&
        (!problemNumber || row[1] === problemNumber.toString())
      );

      if (pptInfo && pptInfo[2]) {
        return res.json({
          success: true,
          url: pptInfo[2]
        });
      } else {
        return res.json({
          success: false,
          message: 'PPT를 찾을 수 없습니다'
        });
      }
    } catch (error) {
      console.error('PPT 데이터 불러오기 오류:', error);
      return res.status(500).json({
        success: false,
        message: 'PPT 데이터를 불러오는 중 오류가 발생했습니다'
      });
    }
  } catch (error) {
    console.error('PPT URL 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

//=============================================================================
// 콘텐츠 미리보기 API
//=============================================================================

// 콘텐츠 미리보기 URL 생성 (S3 콘텐츠)
router.get('/preview-content', authenticateUser, async (req, res) => {
  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ error: '파일명이 제공되지 않았습니다.' });
    }

    // S3 URL 생성 (실제 URL은 환경에 따라 다를 수 있음)
    const contentUrl = `https://educodingnplaycontents.s3.amazonaws.com/${filename}`;

    res.json({
      success: true,
      url: contentUrl
    });
  } catch (error) {
    console.error('콘텐츠 미리보기 URL 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;