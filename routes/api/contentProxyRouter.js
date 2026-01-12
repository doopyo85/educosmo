// routes/api/contentProxyRouter.js
// NCP Object Storage 콘텐츠를 CORS 헤더와 함께 프록시하는 라우터

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { S3 } = require('../../config');

// Object Storage 콘텐츠 프록시
router.get('/*', async (req, res) => {
  try {
    // 요청된 파일 경로
    const filePath = req.params[0];

    // Object Storage URL 생성
    const objectUrl = `${S3.ASSET_URL}/${filePath}`;

    console.log('프록시 요청:', objectUrl);

    // Object Storage에서 파일 가져오기
    const response = await axios.get(objectUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': '*/*'
      },
      validateStatus: (status) => status < 500 // 404도 처리
    });

    // Content-Type 결정
    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // CORS 헤더와 함께 응답
    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'public, max-age=3600'
    });

    // 응답 전송
    res.status(response.status).send(response.data);

  } catch (error) {
    console.error('프록시 오류:', error.message);

    // CORS 헤더를 포함한 오류 응답
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });

    if (error.response) {
      // Object Storage에서 온 오류
      res.status(error.response.status).json({
        error: '콘텐츠를 불러올 수 없습니다',
        status: error.response.status
      });
    } else {
      // 네트워크 오류
      res.status(500).json({
        error: '서버 오류가 발생했습니다',
        message: error.message
      });
    }
  }
});

// OPTIONS preflight 요청 처리
router.options('/*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  });
  res.sendStatus(204);
});

module.exports = router;
