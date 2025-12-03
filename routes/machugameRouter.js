const express = require('express');
const router = express.Router();
const cors = require('cors');
const { checkPageAccess } = require('../lib_login/authMiddleware');

// CORS 설정 (Pong 사이트 접근용)
const corsOptions = {
  origin: [
    'https://cosmoedu.co.kr',
    'https://www.cosmoedu.co.kr', 
    'http://localhost:3000',
    /\.netlify\.app$/,
    /\.github\.io$/
  ],
  credentials: false,
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
};

// 🎮 메인 페이지 라우트
router.get('/', checkPageAccess('/machu'), (req, res) => {
  res.render('machu_game', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageTitle: '마추기 게임'
  });
});

// 🎯 특정 시리즈 게임 페이지
router.get('/:seriesId', checkPageAccess('/machu'), (req, res) => {
  const seriesId = req.params.seriesId;
  
  res.render('machu_play', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    seriesId: seriesId,
    pageTitle: `마추기 게임 - ${seriesId}`
  });
});

// 🔥 API: 시리즈 목록 (CORS 적용)
router.get('/api/series', cors(corsOptions), async (req, res) => {
  try {
    // getSheetData 함수 가져오기
    const getSheetData = req.app.get('getSheetData');
    if (!getSheetData) {
      return res.status(500).json({ 
        success: false, 
        error: 'Google Sheets API가 초기화되지 않았습니다.' 
      });
    }

    // MemeSeries 시트에서 데이터 가져오기
    const rawData = await getSheetData('MemeSeries!A2:F100');
    
    // 데이터 포맷팅
    const series = rawData.map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      description: row[2] || '',
      thumbnail: row[3] || '',
      questionCount: parseInt(row[4]) || 0,
      status: row[5] || 'active'
    })).filter(item => item.id && item.status === 'active');

    console.log(`마추기 시리즈 로드 완료: ${series.length}개 시리즈`);
    
    res.json({
      success: true,
      data: series
    });
  } catch (error) {
    console.error('시리즈 목록 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '시리즈 목록을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 🔥 API: 특정 시리즈 문제 데이터 (CORS 적용)
router.get('/api/:seriesId/questions', cors(corsOptions), async (req, res) => {
  try {
    const seriesId = req.params.seriesId;
    
    // getSheetData 함수 가져오기
    const getSheetData = req.app.get('getSheetData');
    if (!getSheetData) {
      return res.status(500).json({ 
        success: false, 
        error: 'Google Sheets API가 초기화되지 않았습니다.' 
      });
    }

    // Quiz 시트에서 모든 데이터 가져오기
    const allQuestions = await getSheetData('Quiz!A2:G500');
    
    // 특정 시리즈 문제만 필터링
    const seriesQuestions = allQuestions.filter(row => row[1] === seriesId);
    
    // 데이터 포맷팅
    const questions = seriesQuestions.map((row, index) => ({
      id: parseInt(row[0]) || index + 1,
      seriesId: row[1] || '',
      answer: row[2] || '',
      aliases: (row[3] || '').split(',').map(alias => alias.trim()).filter(alias => alias),
      imageUrl: row[4] || '',
      difficulty: row[5] || 'normal',
      hint: row[6] || ''
    })).filter(item => item.answer && item.imageUrl);

    console.log(`${seriesId} 시리즈 문제 로드 완료: ${questions.length}개 문제`);
    
    res.json({
      success: true,
      seriesId: seriesId,
      data: questions
    });
  } catch (error) {
    console.error(`${req.params.seriesId} 문제 로드 오류:`, error);
    res.status(500).json({
      success: false,
      error: '문제 데이터를 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 🎲 API: 랜덤 게임 생성
router.post('/api/:seriesId/random-game', cors(corsOptions), async (req, res) => {
  try {
    const seriesId = req.params.seriesId;
    const { count = 10 } = req.body;
    
    // 시리즈 문제 가져오기
    const getSheetData = req.app.get('getSheetData');
    const allQuestions = await getSheetData('Quiz!A2:G500');
    const seriesQuestions = allQuestions.filter(row => row[1] === seriesId);
    
    if (seriesQuestions.length < count) {
      return res.status(400).json({
        success: false,
        error: `${seriesId} 시리즈에는 ${seriesQuestions.length}개의 문제만 있습니다.`
      });
    }
    
    // Fisher-Yates 알고리즘으로 랜덤 선택
    const shuffled = [...seriesQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // 선택된 문제들 포맷팅 (정답은 제외하고 전송)
    const gameQuestions = shuffled.slice(0, count).map((row, index) => ({
      questionId: index + 1,
      id: parseInt(row[0]) || index + 1,
      imageUrl: row[4] || '',
      difficulty: row[5] || 'normal',
      hint: row[6] || ''
      // 정답과 별칭은 클라이언트에 전송하지 않음 (보안)
    }));
    
    // 게임 세션 ID 생성
    const gameSessionId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      gameSessionId: gameSessionId,
      seriesId: seriesId,
      totalQuestions: count,
      questions: gameQuestions
    });
  } catch (error) {
    console.error(`랜덤 게임 생성 오류:`, error);
    res.status(500).json({
      success: false,
      error: '게임을 생성하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 🔍 API: 정답 확인
router.post('/api/check-answer', cors(corsOptions), async (req, res) => {
  try {
    const { seriesId, questionId, userAnswer } = req.body;
    
    if (!seriesId || !questionId || !userAnswer) {
      return res.status(400).json({
        success: false,
        error: '필수 파라미터가 누락되었습니다.'
      });
    }
    
    // Quiz 시트에서 해당 문제 찾기
    const getSheetData = req.app.get('getSheetData');
    const allQuestions = await getSheetData('Quiz!A2:G500');
    
    const question = allQuestions.find(row => 
      row[1] === seriesId && parseInt(row[0]) === parseInt(questionId)
    );
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: '문제를 찾을 수 없습니다.'
      });
    }
    
    // 정답과 별칭 확인
    const correctAnswer = question[2] || '';
    const aliases = (question[3] || '').split(',').map(alias => alias.trim().toLowerCase());
    const userAnswerLower = userAnswer.trim().toLowerCase();
    
    // 정답 체크 (정답 자체 또는 별칭 중 하나와 일치)
    const isCorrect = 
      correctAnswer.toLowerCase() === userAnswerLower ||
      aliases.includes(userAnswerLower);
    
    res.json({
      success: true,
      correct: isCorrect,
      correctAnswer: correctAnswer,
      userAnswer: userAnswer
    });
  } catch (error) {
    console.error('정답 확인 오류:', error);
    res.status(500).json({
      success: false,
      error: '정답을 확인하는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

module.exports = router;
