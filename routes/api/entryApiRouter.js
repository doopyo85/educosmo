// routes/api/entryApiRouter.js - Entry 전용 API 라우터
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');

console.log('EntryApiRouter 모듈 로드 시작');

// EntryJS DataApi 라우터 연결 (S3 에셋 지원)
try {
  const entryDataApiRouter = require('./entryDataApiRouter');
  router.use('/dataApi', entryDataApiRouter);
  console.log('✅ EntryJS DataApi 등록 완료: /api/entry/dataApi/*');
} catch (error) {
  console.error('❌ EntryJS DataApi 로드 실패:', error);
}

// Entry 프로젝트 목록 API (Google Sheets 연동)
router.get('/projects/list', authenticateUser, async (req, res) => {
  try {
    console.log('Entry 프로젝트 목록 API 호출');
    
    // getSheetData 함수 가져오기
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: 'getSheetData 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    // Google Sheets에서 Entry 프로젝트 데이터 가져오기
    const data = await getSheetData('ent!A2:F');
    console.log(`Entry 프로젝트 목록 로드 완료: ${data.length}개 항목`);
    
    res.json(data || []);
    
  } catch (error) {
    console.error('Entry 프로젝트 목록 로드 오류:', error);
    res.status(500).json({ 
      error: 'Entry 프로젝트 목록을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// Entry 프로젝트 파일 다운로드 API (S3 연동)
router.get('/projects/:filename', authenticateUser, async (req, res) => {
  try {
    const filename = req.params.filename;
    console.log('Entry 프로젝트 파일 다운로드 요청:', filename);
    
    // S3 키 생성 (ent/ 접두사 추가)
    const s3Key = `ent/${filename}`;
    console.log('S3 키:', s3Key);
    
    // S3에서 파일 가져오기
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const config = require('../../config');
    
    const s3Client = new S3Client({
      region: config.S3.REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const params = {
      Bucket: config.S3.BUCKET_NAME,
      Key: s3Key
    };
    
    const command = new GetObjectCommand(params);
    const data = await s3Client.send(command);
    const fileStream = data.Body;
    
    // Stream을 문자열로 변환
    const chunks = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    
    // BOM 제거 및 안전한 문자열 변환
    let fileBuffer = Buffer.concat(chunks);
    
    // UTF-8 BOM 제거 (EF BB BF)
    if (fileBuffer.length >= 3 && 
        fileBuffer[0] === 0xEF && 
        fileBuffer[1] === 0xBB && 
        fileBuffer[2] === 0xBF) {
      console.log('UTF-8 BOM 감지됨, 제거 중...');
      fileBuffer = fileBuffer.slice(3);
    }
    
    const fileContent = fileBuffer.toString('utf-8');
    console.log('파일 내용 길이:', fileContent.length);
    
    // JSON 파싱 시도
    let projectData;
    try {
      const cleanedContent = fileContent.trim();
      projectData = JSON.parse(cleanedContent);
      console.log('✅ Entry 프로젝트 JSON 파싱 성공');
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      return res.status(500).json({ 
        error: '프로젝트 파일 형식이 잘못되었습니다.',
        details: parseError.message,
        sample: fileContent.slice(0, 100)
      });
    }
    
    // EntryJS용 응답 헤더 설정
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 프로젝트 데이터 반환
    res.json(projectData);
    
    console.log(`✅ Entry 프로젝트 파일 전송 완료: ${filename}`);
    
  } catch (error) {
    console.error('Entry 프로젝트 파일 로드 오류:', error);
    
    // S3 NoSuchKey 오류 처리
    if (error.Code === 'NoSuchKey') {
      return res.status(404).json({ 
        error: '프로젝트 파일을 찾을 수 없습니다.',
        filename: req.params.filename,
        s3Key: `ent/${req.params.filename}`,
        suggestion: '파일명을 확인해주세요.'
      });
    }
    
    // 기타 오류
    res.status(500).json({ 
      error: '프로젝트 파일을 불러오는 중 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 🔧 미래 확장용 API들 (현재는 주석 처리)
/*
// Entry 프로젝트 저장 API
router.post('/projects', authenticateUser, async (req, res) => {
  // TODO: Entry 프로젝트 저장 기능 구현
});

// Entry 프로젝트 삭제 API  
router.delete('/projects/:id', authenticateUser, async (req, res) => {
  // TODO: Entry 프로젝트 삭제 기능 구현
});

// Entry 프로젝트 공유 API
router.post('/projects/:id/share', authenticateUser, async (req, res) => {
  // TODO: Entry 프로젝트 공유 기능 구현
});
*/

console.log('EntryApiRouter 모듈 로드 완료');
console.log('등록된 API: /projects/list, /projects/:filename');

module.exports = router;