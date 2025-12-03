// routes/api/cardPagesRouter.js
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');
const { getSheetData } = require('../../server');

// 공통 오류 처리 미들웨어
const handleApiRequest = async (req, res, sheetRange, errorMessage) => {
  try {
    console.log(`카드 데이터 요청: ${req.originalUrl}, 시트 범위: ${sheetRange}`);
    const data = await getSheetData(sheetRange);
    console.log(`카드 데이터 조회 성공: ${sheetRange}, ${data?.length || 0}개 항목`);
    res.json(data || []);
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    res.status(500).json({ 
      error: errorMessage,
      message: error.message
    });
  }
};

// Computer 카드 데이터
router.get('/computer-cards', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res, 
    'computer!A2:F100', 
    '컴퓨터 카드 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Scratch 카드 데이터
router.get('/scratch-cards', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res, 
    'scratch!A2:F100', 
    '스크래치 카드 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Entry 카드 데이터
router.get('/entry-cards', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res, 
    'entry!A2:F100', 
    '엔트리 카드 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

// Machine Learning 카드 데이터
router.get('/ml-cards', authenticateUser, async (req, res) => {
  await handleApiRequest(
    req, res, 
    'ml!A2:F100', 
    '머신러닝 카드 데이터를 불러오는 중 오류가 발생했습니다'
  );
});

module.exports = router;