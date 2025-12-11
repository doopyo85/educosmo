const express = require('express');
const router = express.Router();
const db = require('../lib_login/db');
const bcrypt = require('bcrypt');
const { checkRole } = require('../lib_login/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { authenticateUser } = require('../lib_login/authMiddleware');
const { exec } = require('child_process'); // 🔥 추가: Python 실행을 위한 모듈
const EntFileLoader = require('../lib_entry/entFileLoader'); // 🔥 추가: ENT 파일 로더
const s3BrowserRouter = require('./api/s3BrowserRouter');

// EntFileLoader 인스턴스 생성
const entFileLoader = new EntFileLoader();

// Multer 설정 (메모리 스토리지 사용)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB 제한
        files: 1 // 한 번에 하나의 파일만
    },
    fileFilter: (req, file, cb) => {
        // ENT 파일만 허용
        if (file.originalname.toLowerCase().endsWith('.ent')) {
            cb(null, true);
        } else {
            cb(new Error('ENT 파일만 업로드할 수 있습니다.'), false);
        }
    }
});

let jupyterRouter, googleSheetRouter, problemRouter, gameScoreRouter;

try {
  gameScoreRouter = require('./api/gameScoreRouter');
} catch (error) {
  console.error('gameScoreRouter 로드 실패:', error);
  gameScoreRouter = express.Router();
}

try {
  jupyterRouter = require('./api/jupyterRouter');
} catch (error) {
  console.error('jupyterRouter 로드 실패:', error);
  jupyterRouter = express.Router();
}

try {
  googleSheetRouter = require('./api/googleSheetRouter');
} catch (error) {
  console.error('googleSheetRouter 로드 실패:', error);
  googleSheetRouter = express.Router();
}

try {
  problemRouter = require('./api/problemRouter');
} catch (error) {
  console.error('problemRouter 로드 실패:', error);
  problemRouter = express.Router();
}

// Entry 전용 API 라우터 연결
try {
  const entryApiRouter = require('./api/entryApiRouter');
  router.use('/entry', entryApiRouter);
  console.log('✅ EntryApiRouter 등록 완료');
} catch (error) {
  console.error('❌ EntryApiRouter 로드 실패:', error);
}

// Entry DataAPI 라우터 연결 (Entry.dataApi URL 대응)
try {
  const entryDataApiRouter = require('./api/entryDataApiRouter');
  router.use('/entry/dataApi', entryDataApiRouter);
  console.log('✅ EntryDataApiRouter 등록 완료');
} catch (error) {
  console.error('❌ EntryDataApiRouter 로드 실패:', error);
}

router.use('/s3', s3BrowserRouter);
router.use('/game', gameScoreRouter);
router.use('/jupyter', jupyterRouter);
router.use('/sheets', googleSheetRouter);
router.use('/', problemRouter);

// 🔥 ENT 파일 업로드 및 처리 API
router.post('/load-ent-file', authenticateUser, upload.single('entFile'), async (req, res) => {
    console.log('📁 ENT 파일 업로드 요청 받음');
    
    try {
        // 파일 업로드 확인
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'ENT 파일이 업로드되지 않았습니다.'
            });
        }

        console.log('📄 업로드된 파일 정보:', {
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // 임시 파일로 저장
        const tempFilePath = path.join(__dirname, '..', 'temp', `upload_${Date.now()}_${req.file.originalname}`);
        
        // 임시 디렉토리 생성
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 메모리 버퍼를 파일로 저장
        fs.writeFileSync(tempFilePath, req.file.buffer);
        console.log('💾 임시 파일 저장 완료:', tempFilePath);

        // 🔥 UPDATE: 세션 ID 생성 및 에셋 포함 옵션
        const sessionId = `${req.session.userID || 'guest'}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        // ENT 파일 로드 (에셋 포함)
        const result = await entFileLoader.loadEntFile(tempFilePath, {
            sessionId: sessionId,
            includeAssets: true // 🔥 NEW: 에셋 파일 포함
        });

        // 임시 업로드 파일 삭제
        setTimeout(() => {
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log('🧹 임시 업로드 파일 삭제:', tempFilePath);
                }
            } catch (error) {
                console.error('임시 파일 삭제 실패:', error);
            }
        }, 5000);

        // 결과 반환
        if (result.success) {
            console.log('✅ ENT 파일 로드 성공 (에셋 포함)');
            
            res.json({
                success: true,
                message: result.message,
                projectData: result.projectData,
                loadTime: result.loadTime,
                fileName: req.file.originalname,
                // 🔥 NEW: 에셋 정보 추가
                sessionId: result.sessionId,
                assetBaseUrl: result.assetBaseUrl,
                hasAssets: result.hasAssets,
                debug: {
                    fileSize: (req.file.size / 1024).toFixed(1) + ' KB',
                    objects: result.projectData?.objects?.length || 0,
                    scenes: result.projectData?.scenes?.length || 0,
                    variables: result.projectData?.variables?.length || 0,
                    functions: result.projectData?.functions?.length || 0
                }
            });
        } else {
            console.log('❌ ENT 파일 로드 실패:', result.error);
            res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ ENT 파일 처리 중 오류:', error);
        
        let errorMessage = '파일 처리 중 오류가 발생했습니다.';
        
        if (error.code === 'LIMIT_FILE_SIZE') {
            errorMessage = '파일 크기가 너무 큽니다. 최대 50MB까지 업로드할 수 있습니다.';
        } else if (error.message.includes('ENT 파일만')) {
            errorMessage = 'ENT 파일만 업로드할 수 있습니다.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// ENT 파일 유효성 검사 API (업로드 전 미리 확인)
router.post('/validate-ent-file', authenticateUser, upload.single('entFile'), (req, res) => {
    console.log('🔍 ENT 파일 유효성 검사 요청');
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'ENT 파일이 업로드되지 않았습니다.'
            });
        }

        // 기본 검증
        const fileInfo = {
            name: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
            sizeInMB: (req.file.size / 1024 / 1024).toFixed(2)
        };

        console.log('📊 파일 정보:', fileInfo);

        res.json({
            success: true,
            message: 'ENT 파일이 유효합니다.',
            fileInfo
        });

    } catch (error) {
        console.error('❌ ENT 파일 검증 실패:', error);
        res.status(400).json({
            success: false,
            error: error.message || '파일 검증 중 오류가 발생했습니다.'
        });
    }
});

// 🔥 Jupyter 상태 확인 API 추가
router.get('/jupyter/status', authenticateUser, (req, res) => {
  console.log('✅ Jupyter 상태 확인 요청 - PM2 관리 모드');
  
  // 간단한 상태 응답 (항상 온라인으로 가정)
  res.json({
    status: 'online',
    server: 'jupyter-server',
    port: 8000,
    baseUrl: '/jupyter',
    message: 'PM2로 관리되는 Jupyter 서버가 정상 작동 중입니다.'
  });
});

// 🔥 수정: Python 코드 실행 API - 응답 형식 표준화 및 에러 처리 강화
router.post('/run-python', authenticateUser, (req, res) => {
    console.log('=== Python 코드 실행 요청 받음 ===');
    console.log('요청 본문:', req.body);
    
    try {
        const userCode = req.body?.code;
        console.log('실행할 코드:', userCode);
        console.log('코드 타입:', typeof userCode);
        console.log('코드 길이:', userCode ? userCode.length : 'undefined');
        
        // 🔥 개선: 코드 검증 강화
        if (!userCode || typeof userCode !== 'string') {
            console.log('❌ 유효하지 않은 코드');
            return res.json({ 
                success: false,
                output: '',
                error: '유효하지 않은 코드입니다.' 
            });
        }
        
        // 빈 코드 체크
        if (userCode.trim() === '') {
            console.log('빈 코드 입력');
            return res.json({ 
                success: false,
                output: '',
                error: '실행할 코드를 입력해주세요.' 
            });
        }
        
        // 임시 파일 경로 생성 (사용자별 고유한 파일명)
        const timestamp = Date.now();
        const userId = req.session?.userID || 'anonymous';
        const fileName = `temp_normal_${userId}_${timestamp}.py`;
        const filePath = path.join(__dirname, '..', fileName);
        
        console.log('임시 파일 경로:', filePath);
        
        try {
            // 파이썬 코드를 임시 파일에 저장
            fs.writeFileSync(filePath, userCode, 'utf8');
            console.log('파일 저장 완료');
        } catch (writeError) {
            console.error('파일 저장 오류:', writeError);
            return res.json({ 
                success: false,
                output: '',
                error: '코드 파일 저장 중 오류가 발생했습니다.' 
            });
        }
        
        // Python 실행 (타임아웃 설정)
        const execOptions = {
            timeout: 10000, // 10초 타임아웃
            maxBuffer: 1024 * 1024, // 1MB 버퍼
            cwd: path.join(__dirname, '..')
        };
        
        exec(`python3 ${fileName}`, execOptions, (error, stdout, stderr) => {
            console.log('Python 실행 완료');
            
            // 🔥 중요: 임시 파일 삭제 (성공/실패 관계없이)
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('임시 파일 삭제 완료');
                }
            } catch (deleteError) {
                console.error('임시 파일 삭제 실패:', deleteError);
            }
            
            // 🔥 개선: 결과 처리 표준화
            if (error) {
                console.error('Python 실행 오류:', error);
                let errorMessage = '';
                
                if (error.code === 'ENOENT') {
                    errorMessage = 'Python이 설치되지 않았거나 경로를 찾을 수 없습니다.';
                } else if (error.signal === 'SIGTERM') {
                    errorMessage = '코드 실행 시간이 초과되었습니다. (10초 제한)';
                } else if (stderr && stderr.trim()) {
                    // stderr가 있으면 Python 에러로 처리
                    errorMessage = stderr.trim();
                } else {
                    errorMessage = error.message || '알 수 없는 실행 오류가 발생했습니다.';
                }
                
                const errorResponse = { 
                    success: false,
                    output: '',
                    error: errorMessage,
                    warning: null
                };
                
                console.log('❌ 오류 응답 전송:', errorResponse);
                return res.json(errorResponse);
            }
            
            // 🔥 개선: stderr 처리 (Python 경고 메시지 구분)
            if (stderr && stderr.trim()) {
                console.log('Python stderr:', stderr);
                // stderr가 있지만 exit code가 0인 경우 (경고 메시지)
                const warningMessage = stderr.trim();
                const finalOutput = stdout && stdout.trim() ? stdout.trim() : '(출력 없음)';
                console.log('경고와 함께 성공 응답 전송');
                return res.json({ 
                    success: true,
                    output: finalOutput,
                    warning: warningMessage
                });
            }
            
            // 🔥 개선: 성공 응답 표준화
            console.log('Python stdout:', stdout);
            const finalOutput = stdout && stdout.trim() ? stdout.trim() : '(출력 없음)';
            
            const responseData = { 
                success: true,
                output: finalOutput,
                error: null,
                warning: null
            };
            
            console.log('✅ 성공 응답 전송:', responseData);
            res.json(responseData);
        });
        
    } catch (error) {
        console.error('Python 실행 API 최상위 오류:', error);
        
        // 🔥 개선: 서버 오류 응답 표준화
        res.json({ 
            success: false,
            output: '',
            error: `서버 오류: ${error.message}` 
        });
    }
});

// getSheetData 함수 가져오기
let getSheetData;
try {
  const serverModule = require('../server');
  getSheetData = serverModule.getSheetData;
  
  // 함수가 제대로 로드되었는지 확인
  if (typeof getSheetData !== 'function') {
    console.error('getSheetData는 함수가 아닙니다!');
    // 임시 구현
    getSheetData = async () => [];
  }
} catch (error) {
  console.error('server.js에서 getSheetData 가져오기 실패:', error);
  // 임시 구현
  getSheetData = async () => [];
}

// 사용자 관련 API
router.get('/get-user', (req, res) => {
  if (req.session && req.session.userID) {
    res.json({ username: req.session.userID });
  } else {
    res.status(401).json({ error: '인증되지 않은 사용자' });
  }
});

router.post('/save-profile-preference', (req, res) => {
  try {
    const { profilePath } = req.body;
    const userId = req.session?.userID;
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    req.session.profileImage = profilePath;
    req.session.save(err => {
      if (err) return res.status(500).json({ success: false, message: '세션 저장 중 오류 발생' });
      return res.json({ success: true });
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: '서버 오류 발생' });
  }
});

router.post('/save-profile-to-db', (req, res) => {
  try {
    const { profilePath } = req.body;
    const userId = req.session?.userID;
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    db.queryDatabase('UPDATE Users SET profile_image = ? WHERE userID = ?', [profilePath, userId])
      .then(() => {
        req.session.profileImage = profilePath;
        req.session.save(err => {
          if (err) return res.status(500).json({ success: false, message: '세션 저장 중 오류 발생' });
          return res.json({ success: true });
        });
      })
      .catch(error => {
        return res.status(500).json({ success: false, message: 'DB 오류 발생' });
      });
  } catch (error) {
    return res.status(500).json({ success: false, message: '서버 오류 발생' });
  }
});

router.get('/get-profile-info', (req, res) => {
  try {
    if (!req.session?.userID) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    db.queryDatabase('SELECT profile_image FROM Users WHERE userID = ?', [req.session.userID])
      .then(results => {
        const profilePath = results.length > 0 && results[0].profile_image ? results[0].profile_image : '/resource/profiles/default.webp';
        return res.json({ success: true, profilePath });
      })
      .catch(error => {
        return res.status(500).json({ success: false, message: 'DB 오류 발생' });
      });
  } catch (error) {
    return res.status(500).json({ success: false, message: '서버 오류 발생' });
  }
});

router.get('/debug-session', (req, res) => {
  const responseData = {
    sessionExists: !!req.session,
    sessionId: req.sessionID || 'none',
    isLoggedIn: req.session?.is_logined || false,
    userId: req.session?.userID || 'not logged in',
    role: req.session?.role || 'none',
    sessionData: {
      cookie: req.session?.cookie || {},
      created: req.session?.created || null,
      lastAccess: req.session?.lastAccess || null
    }
  };
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(responseData, null, 2));
});

router.get('/get-user-type', (req, res) => {
  if (req.session && req.session.userID) {
    res.json({ userType: req.session.userType });
  } else {
    res.status(401).json({ error: '로그인되지 않은 사용자입니다.' });
  }
});

router.get('/get-user-session', (req, res) => {
  if (req.session && req.session.is_logined) {
    res.json({
      userID: req.session.userID,
      role: req.session.role,
      is_logined: true,
      centerID: req.session.centerID
    });
  } else {
    res.status(200).json({ is_logined: false, role: 'guest' });
  }
});

// 직접 카드형 페이지 API 추가 (복구)
router.get('/get-computer-data', authenticateUser, async (req, res) => {
  try {
    const data = await getSheetData('computer!A2:F');
    res.json(data);
  } catch (error) {
    console.error('computer 시트 데이터 로드 오류:', error);
    res.status(500).json({ error: 'computer 시트 오류' });
  }
});

router.get('/get-scratch-data', authenticateUser, async (req, res) => {
  try {
    const data = await getSheetData('sb2!A2:F');
    res.json(data);
  } catch (error) {
    console.error('scratch 시트 데이터 로드 오류:', error);
    res.status(500).json({ error: 'scratch 시트 오류' });
  }
});

// Entry 데이터 API는 entryApiRouter로 이동됨 (/api/entry/projects/list)

router.get('/get-ml-data', authenticateUser, async (req, res) => {
  try {
    const data = await getSheetData('ml!A2:F');
    res.json(data);
  } catch (error) {
    console.error('ml 시트 데이터 로드 오류:', error);
    res.status(500).json({ error: 'ml 시트 오류' });
  }
});

// 파이썬 메뉴 데이터 API
router.get('/get-python-data', authenticateUser, async (req, res) => {
  try {
    console.log('Python 메뉴 데이터 API 요청');
    
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    const data = await getSheetData('Python!A2:F100');
    console.log(`Python 메뉴 데이터 로드 완료: ${data.length}개 항목`);
    res.json(data || []);
    
  } catch (error) {
    console.error('Error fetching python data:', error);
    res.status(500).json({ 
      error: '파이썬 데이터를 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});
router.get('/get-algorithm-data', authenticateUser, async (req, res) => {
  try {
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    const data = await getSheetData('Algorithm!A2:F100');
    console.log(`알고리즘 메뉴 데이터 로드 완료: ${data.length}개 항목`);
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching algorithm data:', error);
    res.status(500).json({ 
      error: '알고리즘 데이터를 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 자격증 메뉴 데이터 API
router.get('/get-certification-data', authenticateUser, async (req, res) => {
  try {
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    const data = await getSheetData('Certification!A2:F100');
    console.log(`자격증 메뉴 데이터 로드 완료: ${data.length}개 항목`);
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching certification data:', error);
    res.status(500).json({ 
      error: '자격증 데이터를 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// AI Math 메뉴 데이터 API
router.get('/get-aimath-data', authenticateUser, async (req, res) => {
  try {
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    const data = await getSheetData('AIMath!A2:F100');
    console.log(`AI Math 메뉴 데이터 로드 완료: ${data.length}개 항목`);
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching aimath data:', error);
    res.status(500).json({ 
      error: 'AI Math 데이터를 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 기존 AI Math 메뉴 데이터 API 아래에 추가
router.get('/get-dataanalysis-data', authenticateUser, async (req, res) => {
  try {
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    console.log('🔍 DataAnalysis 시트 데이터 요청');
    const data = await getSheetData('DataAnalysis!A2:F100');
    console.log(`🔥 DataAnalysis 메뉴 데이터 로드 완료: ${data.length}개 항목`);
    
    // 🔥 디버깅: 데이터 구조 로깅
    if (data.length > 0) {
      console.log('📦 DataAnalysis 첫 번째 데이터:', data[0]);
      console.log('📊 데이터 구조:');
      console.log('  - A열(리스트목록1):', data[0][0]);
      console.log('  - B열(리스트목록2):', data[0][1]);
      console.log('  - C열(시험지명):', data[0][2]);
      console.log('  - D열(PPT URL):', data[0][3]);
      console.log('  - E열(Type):', data[0][4]);
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('😱 Error fetching dataanalysis data:', error);
    res.status(500).json({ 
      error: '데이터 분석 데이터를 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 공통 문제 데이터 API - 모든 페이지에서 사용
router.get('/get-problem-data', async (req, res) => {
  try {
    // getSheetData 함수 가져오기
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      console.log('app에서 getSheetData 로드 실패, 직접 import 시도:', e.message);
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    // 🔥 수정: 새로운 구조로 N열까지 데이터 가져오기 (예제파일URL 추가)
    const data = await getSheetData('problems!A2:N500');
    console.log(`공통 문제 데이터 로드 완료: ${data.length}개 항목 (N열까지 포함)`);
    
    // 🔥 추가: 데이터 구조 검증 및 로깅
    if (data.length > 0) {
      console.log('첫 번째 데이터 샘플:', {
        filename: data[0][0],
        examName: data[0][1], 
        problemNumber: data[0][2],
        pythonFileUrl: data[0][3] || '(없음)'
      });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching problem data:', error);
    res.status(500).json({ 
      error: '문제 데이터를 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 정답 코드 가져오기 API
router.get('/get-answer-code', authenticateUser, async (req, res) => {
  try {
    console.log('정답 코드 API 요청 받음:', req.query);
    
    // 교사/관리자 권한 체크
    if (!['teacher', 'admin', 'manager'].includes(req.session.role)) {
      return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    }
    
    const { examName, problemNumber } = req.query;
    
    if (!examName || !problemNumber) {
      return res.status(400).json({ success: false, message: '시험명과 문제 번호가 필요합니다.' });
    }
    
    // 형식 맞추기 - 숫자만 있으면 p01 형식으로 변환
    const formattedProblemNumber = problemNumber.toString().startsWith('p') 
      ? problemNumber 
      : `p${problemNumber.toString().padStart(2, '0')}`;
    
    console.log('조회할 문제:', examName, formattedProblemNumber);
    
    // 문제 데이터를 가져와서 정답 URL 찾기 (새로운 구조 N열까지)
    const allProblemData = await getSheetData('problems!A2:N');
    console.log('전체 문제 데이터 로드됨:', allProblemData.length);
    
    // 해당 시험과 문제 번호에 맞는 행 찾기
    const problemRow = allProblemData.find(row => 
      row[1]?.toLowerCase() === examName.toLowerCase() && 
      row[2]?.toLowerCase() === formattedProblemNumber.toLowerCase()
    );
    
    console.log('찾은 문제 데이터:', problemRow);
    
    if (!problemRow || !problemRow[6]) { // 🔥 수정: G열(인덱스 6)로 변경
      console.log('정답 코드 URL을 찾을 수 없음');
      return res.status(404).json({ success: false, message: '정답 코드를 찾을 수 없습니다.' });
    }
    
    // 🔥 수정: G열(인덱스 6)에서 정답 파일 경로 가져오기 (상대 경로)
    const answerFilePath = problemRow[6]; // 예: 'python/cospro_1-1_p01.py'
    console.log('정답 파일 경로 (상대):', answerFilePath);
    
    // 🔥 수정: S3 기본 URL과 조합하여 절대 URL 생성
    const baseS3Url = 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/';
    const fullAnswerUrl = baseS3Url + answerFilePath;
    console.log('정답 파일 URL (절대):', fullAnswerUrl);
    
    // 🔥 파일 존재 여부 사전 확인 (HEAD 요청)
    try {
      console.log('파일 존재 여부 확인 중:', fullAnswerUrl);
      const headResponse = await axios.head(fullAnswerUrl);
      console.log('파일 존재 확인됨, 상태:', headResponse.status);
    } catch (headError) {
      console.error('파일 존재 확인 실패:', headError.response?.status, headError.message);
      return res.status(404).json({ 
        success: false, 
        message: '정답 파일을 찾을 수 없습니다.',
        details: `파일이 존재하지 않습니다: ${fullAnswerUrl}`,
        url: fullAnswerUrl
      });
    }
    
    // S3에서 직접 파일 가져오기
    try {
      console.log('정답 파일 요청 중:', fullAnswerUrl);
      const response = await axios.get(fullAnswerUrl);
      console.log('정답 파일 로드 성공, 길이:', response.data.length);
      
      // 🔥 수정: Content-Type을 text/plain으로 설정하여 Python 코드로 반환
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(response.data);
      
    } catch (error) {
      console.error('정답 파일 가져오기 오류:', error.message);
      
      // 🔥 개선: 구체적인 오류 메시지 제공
      let errorMessage = '정답 파일을 가져오는 중 오류가 발생했습니다.';
      
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = '정답 파일이 S3에 존재하지 않습니다.';
        } else if (error.response.status === 403) {
          errorMessage = 'S3 접근 권한이 없습니다.';
        } else {
          errorMessage = `S3 오류 (${error.response.status}): ${error.response.statusText}`;
        }
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'S3 서버에 연결할 수 없습니다.';
      }
      
      res.status(500).json({ 
        success: false, 
        message: errorMessage,
        url: fullAnswerUrl,
        error: error.message
      });
    }
  } catch (error) {
    console.error('정답 코드 API 오류:', error.message);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 퀴즈 시험지 목록 API
router.get('/get-quiz-exams', authenticateUser, async (req, res) => {
  try {
    console.log('퀴즈 시험지 목록 요청 받음');
    
    // getSheetData 함수 가져오기
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    // problems 시트에서 시험지 목록 가져오기 (새로운 구조 N열까지)
    const problemsData = await getSheetData('problems!A2:N500');
    
    if (!problemsData || problemsData.length === 0) {
      return res.json([]);
    }
    
    // 시험지명별로 그룹화하여 고유 시험지 목록 생성
    const examGroups = {};
    
    problemsData.forEach(problem => {
      const examName = problem[1]; // B열: 시험지명
      if (examName && examName.trim()) {
        const cleanExamName = examName.trim();
        if (!examGroups[cleanExamName]) {
          examGroups[cleanExamName] = {
            examName: cleanExamName,
            problems: [],
            totalProblems: 0
          };
        }
        
        const problemNumber = problem[2]; // C열: 문제번호
        if (problemNumber && problemNumber.trim()) {
          examGroups[cleanExamName].problems.push({
            problemNumber: problemNumber.trim(),
            url: problem[0] || '', // A열: URL
            questionType: problem[12] || '객관식', // M열: 객관식/주관식 (새로운 구조)
            difficulty: problem[11] || '1' // L열: 난이도 (새로운 구조)
          });
          examGroups[cleanExamName].totalProblems++;
        }
      }
    });
    
    // 메뉴 형식으로 변환 (NavigationComponent가 인식할 수 있는 형태)
    const menuData = [];
    
    Object.values(examGroups).forEach(examGroup => {
      // 시험지명을 분석하여 상위 메뉴 결정
      let topLevelMenu = 'TCP 문제';
      let displayName = examGroup.examName;
      
      if (examGroup.examName.toLowerCase().includes('tcp')) {
        // tcp_2-1 -> "TCP 2-1 (10문제)"
        const match = examGroup.examName.match(/tcp[_-]?(\d+)[_-]?(\d+)?/i);
        if (match) {
          const grade = match[1];
          const semester = match[2] || '1';
          displayName = `TCP ${grade}-${semester} (${examGroup.totalProblems}문제)`;
        }
      }
      
      // NavigationComponent에서 인식하는 배열 형태
      menuData.push([
        '', // A열: URL (빈값)
        topLevelMenu, // B열: 상위메뉴
        displayName, // C열: 하위메뉴 (표시명)
        examGroup.examName, // D열: examName (실제 데이터)
        'quiz', // E열: 타입 (퀴즈)
        examGroup.totalProblems.toString() // F열: 문제수
      ]);
    });
    
    console.log(`퀴즈 시험지 목록 생성 완료: ${menuData.length}개 시험지`);
    res.json(menuData);
    
  } catch (error) {
    console.error('퀴즈 시험지 목록 로드 오류:', error);
    res.status(500).json({ 
      error: '퀴즈 시험지 목록을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// Entry 프로젝트 파일 API는 entryApiRouter로 이동됨 (/api/entry/projects/:filename)

// 🔥 추가: Entry-Offline 에셋 API
router.get('/get-offline-assets', authenticateUser, (req, res) => {
  try {
    console.log('Entry-Offline 에셋 요청 받음');
    
    // 테스트용 메타데이터 사용
    const metadataPath = path.join(__dirname, '..', 'public', 'offline', 'metadata_test.json');
    
    if (!fs.existsSync(metadataPath)) {
      console.log('⚠️ 테스트 메타데이터 없음, 기본 메타데이터 시도:', metadataPath);
      const originalPath = path.join(__dirname, '..', 'public', 'offline', 'metadata.json');
      
      if (!fs.existsSync(originalPath)) {
        return res.status(404).json({ 
          error: '오프라인 에셋이 설치되지 않았습니다.',
          message: 'Windows에서 에셋을 추출하여 Git으로 업로드해야 합니다.'
        });
      }
      
      // 기본 메타데이터에서 간단한 형태로 변환
      const originalMetadata = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
      const convertedMetadata = {
        totalAssets: 5,
        baseUrl: 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads',
        entryAssetsIntegrated: true,
        sprites: [],
        sounds: [],
        categories: {
          entrybot_friends: { id: "entrybot_friends", name: "엔트리봇", value: "entrybot_friends", sub: { all: { id: "", name: "전체", value: "all" } } },
          animal: { id: "animal", name: "동물", value: "animal", sub: { all: { id: "", name: "전체", value: "all" } } },
          thing: { id: "thing", name: "사물", value: "thing", sub: { all: { id: "", name: "전체", value: "all" } } },
          background: { id: "background", name: "배경", value: "background", sub: { all: { id: "", name: "전체", value: "all" } } },
          other: { id: "other", name: "기타", value: "other", sub: { all: { id: "", name: "전체", value: "all" } } }
        },
        imageBaseUrl: 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads/images/',
        soundBaseUrl: 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads/sounds/'
      };
      
      // 몇 개 스프라이트 샘플 추가
      const sampleSprites = Object.entries(originalMetadata.sprites).slice(0, 5);
      sampleSprites.forEach(([spriteId, spriteData]) => {
        convertedMetadata.sprites.push({
          id: spriteId,
          name: spriteData.name || spriteId,
          label: { ko: spriteData.name || spriteId, en: spriteData.name || spriteId },
          category: { main: spriteData.category?.main || 'other', sub: null },
          pictures: spriteData.pictures?.map(pic => ({
            id: pic.id,
            name: pic.name,
            filename: pic.filename,
            imageType: pic.imageType || 'png',
            dimension: pic.dimension || { width: 100, height: 100 },
            fileurl: `${convertedMetadata.imageBaseUrl}${pic.filename}.${pic.imageType}`,
            trimmed: null
          })) || [],
          sounds: spriteData.sounds?.map(sound => ({
            id: sound.id,
            name: sound.name,
            filename: sound.filename,
            ext: sound.ext || '.mp3',
            duration: sound.duration || 1,
            fileurl: `${convertedMetadata.soundBaseUrl}${sound.filename}${sound.ext}`
          })) || []
        });
      });
      
      console.log(`✅ 즉석 변환 메타데이터 생성: ${convertedMetadata.sprites.length}개 스프라이트`);
      return res.json(convertedMetadata);
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    console.log(`✅ 테스트 오프라인 에셋 로드 성공: ${metadata.totalAssets}개 스프라이트`);
    
    res.json(metadata);
    
  } catch (error) {
    console.error('❌ 오프라인 에셋 로드 실패:', error);
    res.status(500).json({ 
      error: '오프라인 에셋을 불러오는 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 🔥 수정: S3로 리다이렉트하는 오프라인 에셋 서빙
router.get('/offline-asset/:type/:filename', authenticateUser, (req, res) => {
  try {
    const { type, filename } = req.params;
    
    // 타입 검증 (보안)
    if (!['images', 'sounds', 'metadata'].includes(type)) {
      return res.status(400).json({ error: '지원하지 않는 에셋 타입입니다.' });
    }
    
    // S3 URL로 리다이렉트
    const s3Url = `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads/${type}/${filename}`;
    res.redirect(302, s3Url);
    
  } catch (error) {
    console.error('❌ 오프라인 에셋 리다이렉트 실패:', error);
    res.status(500).json({ error: '파일 리다이렉트 중 오류가 발생했습니다.' });
  }
});

// 🔥 해설 파일 가져오기 API - 학습 지원 기능 (F열 .md 파일명 → S3 URL 조합)
router.get('/get-explanation-md', authenticateUser, async (req, res) => {
  try {
    console.log('해설 파일 API 요청 받음:', req.query);
    
    const { examName, problemNumber } = req.query;
    
    // 입력 검증
    if (!examName || !problemNumber) {
      return res.status(400).json({ 
        success: false, 
        message: '시험명과 문제 번호가 필요합니다.' 
      });
    }
    
    // 형식 맞추기 - 숫자만 있으면 p01 형식으로 변환
    const formattedProblemNumber = problemNumber.toString().startsWith('p') 
      ? problemNumber 
      : `p${problemNumber.toString().padStart(2, '0')}`;
    
    console.log('조회할 해설:', examName, formattedProblemNumber);
    
    // getSheetData 함수 가져오기
    let getSheetData;
    try {
      getSheetData = req.app.get('getSheetData');
      if (!getSheetData) throw new Error('getSheetData function not found in app');
    } catch (e) {
      try {
        const server = require('../server');
        getSheetData = server.getSheetData;
        if (!getSheetData) throw new Error('getSheetData function not found in server module');
      } catch (e2) {
        return res.status(500).json({ 
          error: '데이터 로드 함수를 찾을 수 없습니다',
          message: e2.message
        });
      }
    }
    
    // 문제 데이터에서 해설 파일명 찾기 (H열 = 인덱스 7, 새로운 구조)
    const allProblemData = await getSheetData('problems!A2:N500');
    console.log('전체 문제 데이터 로드됨:', allProblemData.length);
    
    // 해당 시험과 문제 번호에 맞는 행 찾기
    const problemRow = allProblemData.find(row => 
      row[1]?.toLowerCase() === examName.toLowerCase() && 
      row[2]?.toLowerCase() === formattedProblemNumber.toLowerCase()
    );
    
    console.log('찾은 문제 데이터:', problemRow);
    
    if (!problemRow || !problemRow[7]) { // 🔥 수정: H열 인덱스 7로 변경
      console.log('해설 파일명을 찾을 수 없음');
      return res.status(404).json({ 
        success: false, 
        message: '해설 파일을 찾을 수 없습니다.' 
      });
    }
    
    // 🔥 수정: H열(인덱스 7)의 .md 파일명을 S3 기본 URL과 조합
    const explanationFileName = problemRow[7].trim(); // H열에서 파일명 가져오기
    console.log('해설 파일명 (H열):', explanationFileName);
    
    // S3 기본 URL과 조합하여 완전한 URL 생성
    const baseS3Url = 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/';
    const explanationUrl = baseS3Url + explanationFileName;
    console.log('조합된 해설 파일 URL:', explanationUrl);
    
    // 파일 존재 여부 사전 확인 (HEAD 요청)
    try {
      console.log('해설 파일 존재 여부 확인 중:', explanationUrl);
      const headResponse = await axios.head(explanationUrl);
      console.log('해설 파일 존재 확인됨, 상태:', headResponse.status);
    } catch (headError) {
      console.error('해설 파일 존재 확인 실패:', headError.response?.status, headError.message);
      return res.status(404).json({ 
        success: false, 
        message: '해설 파일을 찾을 수 없습니다.',
        details: `파일이 존재하지 않습니다: ${explanationUrl}`,
        fileName: explanationFileName,
        url: explanationUrl
      });
    }
    
    // S3에서 마크다운 파일 다운로드
    try {
      console.log('해설 파일 다운로드 중:', explanationUrl);
      const response = await axios.get(explanationUrl);
      console.log('해설 파일 다운로드 성공, 길이:', response.data.length);
      
      res.json({
        success: true,
        markdownContent: response.data,
        title: `${examName} - 문제 ${problemNumber} 해설`,
        url: explanationUrl,
        fileName: explanationFileName,
        examName: examName,
        problemNumber: formattedProblemNumber
      });
      
    } catch (error) {
      console.error('해설 파일 다운로드 오류:', error.message);
      
      // 구체적인 오류 메시지 제공
      let errorMessage = '해설을 불러오는 중 오류가 발생했습니다.';
      
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = '해설 파일이 S3에 존재하지 않습니다.';
        } else if (error.response.status === 403) {
          errorMessage = 'S3 접근 권한이 없습니다.';
        } else {
          errorMessage = `S3 오류 (${error.response.status}): ${error.response.statusText}`;
        }
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'S3 서버에 연결할 수 없습니다.';
      }
      
      res.status(500).json({ 
        success: false, 
        message: errorMessage,
        fileName: explanationFileName,
        url: explanationUrl,
        error: error.message
      });
    }
    
  } catch (error) {
    console.error('해설 파일 API 오류:', error.message);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 🔥 예제 코드 가져오기 API (E열 활용) - 모든 문제에 기본 파일 제공
router.get('/get-example-code', authenticateUser, async (req, res) => {
  try {
    const { examName, problemNumber } = req.query;
    
    // 입력 검증
    if (!examName || !problemNumber) {
      return res.status(400).json({ 
        success: false, 
        message: '시험명과 문제 번호가 필요합니다.' 
      });
    }
    
    // 문제 번호 포맷팅 (p01, p02 형식으로 통일)
    const formattedProblemNumber = problemNumber.startsWith('p') 
      ? problemNumber 
      : `p${problemNumber.toString().padStart(2, '0')}`;
    
    console.log(`예제 코드 요청: ${examName} - ${formattedProblemNumber}`);
    
    // 🔥 수정: Google Sheets에서 문제 데이터 조회 (N열까지 확장)
    const allProblemData = await getSheetData('problems!A2:N500');
    
    console.log(`🔍 전체 데이터 개수: ${allProblemData.length}`);
    console.log('🔍 전체 데이터 샘플 (첫 3개):');
    allProblemData.slice(0, 3).forEach((row, index) => {
      console.log(`  ${index + 1}: [${row.map(cell => cell || '(empty)').join(', ')}]`);
    });
    
    console.log(`🔍 검색 조건: examName="${examName}", problemNumber="${formattedProblemNumber}"`);
    
    const problemRow = allProblemData.find(row => 
      row[1]?.toLowerCase() === examName.toLowerCase() && 
      row[2]?.toLowerCase() === formattedProblemNumber.toLowerCase()
    );
    
    console.log('🔍 찾은 문제 행:', problemRow);
    
    if (!problemRow) {
      return res.status(404).json({ 
        success: false, 
        message: '문제를 찾을 수 없습니다.' 
      });
    }
    
    // E열(인덱스 4) - 예제파일URL 확인
    const exampleFileUrl = problemRow[4];
    if (!exampleFileUrl) {
      // 예제 파일이 없으면 빈 템플릿 반환
      return res.json({
        success: true,
        code: `# ${examName} - 문제 ${problemNumber}\n# 여기에 코드를 작성하세요`,
        hasExampleFile: false,
        message: '기본 템플릿을 로드했습니다.'
      });
    }
    
    // 파이썬 파일만 처리
    if (!exampleFileUrl.toLowerCase().endsWith('.py')) {
      return res.json({
        success: true,
        code: `# ${examName} - 문제 ${problemNumber}\n`,
        hasExampleFile: false,
        message: 'Python 파일이 아닙니다. 기본 템플릿을 로드했습니다.'
      });
    }
    
    // 🔥 수정: S3에서 예제 파일 다운로드 - URL 조합 및 파일 유형 확인
    let fullExampleUrl;
    if (exampleFileUrl.startsWith('http')) {
      // 이미 완전한 URL인 경우
      fullExampleUrl = exampleFileUrl;
    } else {
      // 상대 경로인 경우 S3 기본 URL과 조합
      const baseS3Url = 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/';
      fullExampleUrl = baseS3Url + exampleFileUrl;
    }
    
    console.log('최종 예제 파일 URL:', fullExampleUrl);
    
    // 파이썬 파일만 처리
    if (!fullExampleUrl.toLowerCase().endsWith('.py')) {
      console.log('Python 파일이 아님:', fullExampleUrl);
      return res.json({
        success: true,
        code: `# ${examName} - 문제 ${problemNumber}\n# 여기에 코드를 작성하세요`,
        hasExampleFile: false,
        message: 'Python 파일이 아닙니다. 기본 템플릿을 로드했습니다.'
      });
    }
    // 🔥 수정: S3에서 예제 파일 다운로드
    const response = await axios.get(fullExampleUrl);
    
    res.json({
      success: true,
      code: response.data,
      hasExampleFile: true,
      examName: examName,
      problemNumber: formattedProblemNumber,
      originalUrl: fullExampleUrl, // 🔥 수정: 전체 URL 사용
      message: '예제 코드를 성공적으로 로드했습니다.'
    });
    
  } catch (error) {
    console.error('예제 코드 로드 오류:', error);
    
    // 오류 발생 시 기본 템플릿 반환
    const { examName = 'Unknown', problemNumber = '01' } = req.query;
    res.json({
      success: true,
      code: `# ${examName} - 문제 ${problemNumber}\n# 예제 파일 로드 실패, 기본 템플릿을 사용하세요\n\ndef solution():\n    pass`,
      hasExampleFile: false,
      error: error.message,
      message: '예제 파일 로드에 실패했습니다. 기본 템플릿을 사용하세요.'
    });
  }
});
router.get('/get-file-content', authenticateUser, async (req, res) => {
  try {
    const { fileUrl } = req.query;
    
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: '파일 URL이 필요합니다.'
      });
    }
    
    console.log('📁 파일 콘텐츠 요청:', fileUrl);
    
    // S3 기본 URL과 조합하여 전체 URL 생성
    let fullUrl;
    if (fileUrl.startsWith('http')) {
      // 이미 완전한 URL인 경우
      fullUrl = fileUrl;
    } else {
      // 상대 경로인 경우 S3 기본 URL과 조합
      const baseS3Url = 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/';
      fullUrl = baseS3Url + fileUrl;
    }
    
    console.log('🌐 최종 요청 URL:', fullUrl);
    
    // S3에서 파일 다운로드
    const response = await axios.get(fullUrl);
    
    if (response.status === 200) {
      console.log('✅ 파일 다운로드 성공, 크기:', response.data.length);
      
      res.json({
        success: true,
        content: response.data,
        url: fullUrl
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ 파일 콘텐츠 가져오기 실패:', error.message);
    
    let errorMessage = '파일을 불러오는 중 오류가 발생했습니다.';
    
    if (error.response) {
      if (error.response.status === 404) {
        errorMessage = '요청한 파일을 찾을 수 없습니다.';
      } else if (error.response.status === 403) {
        errorMessage = '파일에 접근할 권한이 없습니다.';
      } else {
        errorMessage = `서버 오류 (${error.response.status}): ${error.response.statusText}`;
      }
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = '서버에 연결할 수 없습니다.';
    }
    
    res.status(error.response?.status || 500).json({
      success: false,
      message: errorMessage,
      url: req.query.fileUrl
    });
  }
});

// 리디렉션용 라우팅
router.get('/jupyter-auth', (_, res) => res.redirect('/api/jupyter/auth'));
router.get('/jupyter-auth-direct', (_, res) => res.redirect('/api/jupyter/auth-direct'));

// 프로필 라우터 등록
const profileRouter = require('./api/profileRouter');
router.use('/', profileRouter);

// 업로드 에러 처리 미들웨어
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        console.error('❌ Multer 오류:', error);
        
        let errorMessage = '파일 업로드 중 오류가 발생했습니다.';
        
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                errorMessage = '파일 크기가 너무 큽니다. 최대 50MB까지 업로드할 수 있습니다.';
                break;
            case 'LIMIT_FILE_COUNT':
                errorMessage = '한 번에 하나의 파일만 업로드할 수 있습니다.';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                errorMessage = '예상하지 못한 파일 필드입니다.';
                break;
        }

        return res.status(400).json({
            success: false,
            error: errorMessage
        });
    }
    
    next(error);
});

// 🎨 Paint Editor API - Entry 캔버스 이미지 저장 (S3Manager 사용 - IAM Role 지원)

// Paint 전용 Multer 설정
const paintUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

router.post('/picture/paint', authenticateUser, async (req, res) => {
  console.log('🎨 Paint Editor 저장 요청');
  console.log('📦 req.body:', req.body);
  
  try {
    const imageData = req.body.image;
    const fileInfo = req.body.file; // 페인트 에디터에서 전달하는 파일 정보
    
    if (!imageData || !imageData.startsWith('data:image/')) {
      return res.status(400).json({ 
        success: false, 
        error: '유효하지 않은 이미지 데이터'
      });
    }

    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: '이미지 형식 오류'
      });
    }

    const ext = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // 🔥 S3Manager 사용 (IAM Role 지원)
    const S3Manager = require('../lib_storage/s3Manager');
    const s3Manager = new S3Manager();

    const timestamp = Date.now();
    const userId = req.session?.userID || 'anonymous';
    const filename = 'paint_' + userId + '_' + timestamp + '.' + ext;
    const s3Key = 'ent/uploads/images/' + filename;

    // S3Manager의 uploadProject 메서드 사용
    const fileUrl = await s3Manager.uploadProject(s3Key, buffer, 'image/' + ext);
    
    console.log(`✅ Paint Editor 이미지 S3 업로드 완료: ${fileUrl}`);
    
    // 🔥 Entry가 기대하는 형식으로 응답
    const pictureData = {
      _id: 'paint_' + timestamp,
      id: 'paint_' + timestamp,
      filename: filename,
      imageType: ext,
      dimension: { width: 480, height: 270 },
      fileurl: fileUrl,
      thumbUrl: fileUrl,
      name: fileInfo?.name || '새 그림'
    };

    console.log('📤 응답 데이터:', pictureData);
    res.json(pictureData);

  } catch (error) {
    console.error('❌ Paint Editor 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔥 Storage 관리 API 라우터 등록
try {
  const storageRouter = require('./api/storageRouter');
  router.use('/storage', storageRouter);
  console.log('✅ StorageRouter 등록 완료');
} catch (error) {
  console.error('❌ StorageRouter 로드 실패:', error);
}

module.exports = router;