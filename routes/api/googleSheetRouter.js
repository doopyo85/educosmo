// /routes/api/googleSheetRouter.js
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');
const { getSheetData } = require('../../lib_google/sheetService');

// 공통 Google 시트 데이터 API - 데이터 전처리 추가
router.get('/computer', async (req, res) => {
  try {
    const data = await getSheetData('computer!A2:E');

    // 데이터 전처리 - 안전한 문자열 변환 및 JSON 직렬화 문제 해결
    const safeData = data.map(row => {
      if (!Array.isArray(row)) return [];

      return row.map(cell => {
        // undefined, null 처리
        if (cell === undefined || cell === null) return '';

        // 객체인 경우 JSON 문자열로 변환 (안전하게)
        if (typeof cell === 'object') {
          try {
            return JSON.stringify(cell);
          } catch (e) {
            return '';
          }
        }

        // 기본적으로 문자열로 변환
        return String(cell);
      });
    });

    console.log('전처리된 데이터 샘플 (첫 항목):', safeData.length > 0 ? safeData[0] : '데이터 없음');

    res.json(safeData);
  } catch (error) {
    console.error('Computer 시트 데이터 로드 및 처리 오류:', error);
    res.status(500).json({
      error: 'computer 시트 오류',
      message: error.message
    });
  }
});

router.get('/ml', async (req, res) => {
  try {
    const data = await getSheetData('ml!A2:E');
    res.json(data);
  } catch (error) {
    console.error('ml 시트 오류:', error);
    res.status(500).json({ error: 'ml 시트 오류' });
  }
});

router.get('/onlineclass', async (req, res) => {
  try {
    const data = await getSheetData('onlineClass!A2:C');
    res.json(data);
  } catch (error) {
    console.error('onlineClass 시트 오류:', error);
    res.status(500).json({ error: 'onlineClass 시트 오류' });
  }
});

router.get('/sb2', async (req, res) => {
  try {
    const data = await getSheetData('sb2!A2:F');
    res.json(data);
  } catch (error) {
    console.error('sb2 시트 오류:', error);
    res.status(500).json({ error: 'sb2 시트 오류' });
  }
});

router.get('/sb3', async (req, res) => {
  try {
    const data = await getSheetData('sb3!A2:F');
    res.json(data);
  } catch (error) {
    console.error('sb3 시트 오류:', error);
    res.status(500).json({ error: 'sb3 시트 오류' });
  }
});

router.get('/ent', async (req, res) => {
  try {
    const data = await getSheetData('ent!A2:G');
    console.log(`✅ ENT Sheet Data Loaded: ${data ? data.length : 0} rows`);
    res.json(data);
  } catch (error) {
    console.error('ent 시트 오류:', error);
    res.status(500).json({ error: 'ent 시트 오류' });
  }
});

router.get('/aia', async (req, res) => {
  try {
    const data = await getSheetData('aia!A2:F');
    res.json(data);
  } catch (error) {
    console.error('aia 시트 오류:', error);
    res.status(500).json({ error: 'aia 시트 오류' });
  }
});

// routes/api/googleSheetRouter.js의 메뉴 데이터 부분 수정
router.get('/menu', authenticateUser, async (req, res) => {
  try {
    const { pageType } = req.query;
    let sheetName = 'Template'; // 'Default'에서 'Template'으로 변경
    switch (pageType) {
      case 'python': sheetName = 'Python'; break;
      case 'algorithm': sheetName = 'Algorithm'; break;
      case 'aiMath': sheetName = 'AIMath'; break;
      default: sheetName = req.query.sheet || 'Template'; // 여기도 변경
    }
    const menuData = await getSheetData(`${sheetName}!A2:C`);
    res.json(menuData);
  } catch (error) {
    res.status(500).json({ error: '메뉴 데이터 로드 오류' });
  }
});

// 시트별 전용 메뉴 데이터 엔드포인트
router.get('/certification', async (req, res) => {
  try {
    // Certification 시트에서 메뉴 데이터 가져오기
    const data = await getSheetData('Certification!A2:E');
    res.json(data);
  } catch (error) {
    console.error('certification 시트 오류:', error);
    res.json([]);
  }
});

router.get('/python', async (req, res) => {
  try {
    // Python 시트에서 메뉴 데이터 가져오기
    const data = await getSheetData('Python!A2:E');
    res.json(data);
  } catch (error) {
    console.error('python 시트 오류:', error);
    res.json([]);
  }
});

router.get('/algorithm', async (req, res) => {
  try {
    // Algorithm 시트에서 메뉴 데이터 가져오기
    const data = await getSheetData('Algorithm!A2:E');
    res.json(data);
  } catch (error) {
    console.error('algorithm 시트 오류:', error);
    res.json([]);
  }
});

router.get('/aimath', async (req, res) => {
  try {
    // AIMath 시트에서 메뉴 데이터 가져오기
    const data = await getSheetData('AIMath!A2:E');
    res.json(data);
  } catch (error) {
    console.error('aimath 시트 오류:', error);
    res.json([]);
  }
});

// /routes/api/googleSheetRouter.js에 추가
router.get('/template', async (req, res) => {
  try {
    const data = await getSheetData('Template!A2:E');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Template 시트 오류' });
  }
});

router.get('/teachermenu', async (req, res) => {
  try {
    const data = await getSheetData('teacher!A2:h');
    res.json(data);
  } catch (error) {
    console.error('teacher 시트 오류:', error);
    res.status(500).json({ error: 'teacher 시트 오류' });
  }
});

module.exports = router;