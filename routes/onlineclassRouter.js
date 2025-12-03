// routes/onlineclassRouter.js
const express = require('express');
const router = express.Router();
// getSheetData 함수 가져오기
const { getSheetData } = require('../server'); // 또는 적절한 경로

// 중요: 엔드포인트 앞에 /api/ 접두사가 없어야 함
router.get('/get-onlineclass-data', async (req, res) => {
  console.log('GET /onlineclass/get-onlineclass-data 요청 받음');
  try {
    const data = await getSheetData('onlineClass!A2:C');
    res.json(data);
  } catch (error) {
    console.error('온라인 클래스 데이터 가져오기 오류:', error);
    res.status(500).json({ error: '데이터를 불러오는 중 오류가 발생했습니다.' });
  }
});

module.exports = router;