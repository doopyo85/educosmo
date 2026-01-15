// /routes/api/googleSheetRouter.js
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');
const { getSheetData } = require('../../lib_google/sheetService');
const config = require('../../config');

// 🔥 AWS S3 URL을 NCP Object Storage URL로 변환하는 헬퍼 함수
function transformS3UrlToNCP(url) {
  if (!url || typeof url !== 'string') return url;

  // AWS S3 패턴 감지 및 변환
  // 예: https://educodingnplaycontents.s3.amazonaws.com/...
  //  -> https://onag54aw13447.edge.naverncp.com/...
  // AWS S3 패턴
  const awsS3Pattern = /https?:\/\/educodingnplaycontents\.s3\.amazonaws\.com\//gi;
  // NCP Global Edge 패턴
  const ncpEdgePattern = /https?:\/\/onag54aw13447\.edge\.naverncp\.com\//gi;

  if (awsS3Pattern.test(url)) {
    const transformedUrl = url.replace(awsS3Pattern, config.S3.DIRECT_URL + '/');
    console.log(`🔄 AWS S3 URL 변환: ${url.substring(0, 50)}... -> ${transformedUrl.substring(0, 50)}...`);
    return transformedUrl;
  }

  if (ncpEdgePattern.test(url)) {
    const transformedUrl = url.replace(ncpEdgePattern, config.S3.DIRECT_URL + '/');
    console.log(`🔄 NCP Edge URL 변환: ${url.substring(0, 50)}... -> ${transformedUrl.substring(0, 50)}...`);
    return transformedUrl;
  }

  return url;
}

// 🔥 데이터 배열의 모든 URL을 NCP로 변환
function transformDataUrls(data) {
  if (!Array.isArray(data)) return data;

  return data.map(row => {
    if (!Array.isArray(row)) return row;

    return row.map(cell => {
      if (typeof cell === 'string' && (cell.includes('s3.amazonaws.com') || cell.includes('educodingnplaycontents'))) {
        return transformS3UrlToNCP(cell);
      }
      return cell;
    });
  });
}

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
    const data = await getSheetData('sb2!A2:H');
    console.log(`✅ SB2 Sheet Data Loaded: ${data ? data.length : 0} rows`);

    // 🔥 AWS S3 URL을 NCP로 변환
    const transformedData = transformDataUrls(data);
    res.json(transformedData);
  } catch (error) {
    console.error('sb2 시트 오류:', error);
    res.status(500).json({ error: 'sb2 시트 오류' });
  }
});

router.get('/sb3', async (req, res) => {
  try {
    const data = await getSheetData('sb3!A2:H');
    console.log(`✅ SB3 Sheet Data Loaded: ${data ? data.length : 0} rows`);

    // 🔥 AWS S3 URL을 NCP로 변환
    const transformedData = transformDataUrls(data);
    res.json(transformedData);
  } catch (error) {
    console.error('sb3 시트 오류:', error);
    res.status(500).json({ error: 'sb3 시트 오류' });
  }
});

router.get('/ent', async (req, res) => {
  try {
    const data = await getSheetData('ent!A2:G');
    console.log(`✅ ENT Sheet Data Loaded: ${data ? data.length : 0} rows`);

    // 🔥 AWS S3 URL을 NCP로 변환
    const transformedData = transformDataUrls(data);
    res.json(transformedData);
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