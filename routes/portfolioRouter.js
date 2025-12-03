const express = require('express');
const router = express.Router();
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const extract = require('extract-zip');
const db = require('../lib_login/db');
const portManager = require('../lib_portfolio/port-manager');

// 포트폴리오 프로젝트 관련 경로 설정
const projectsDir = path.join(__dirname, '..', 'portfolio-project', 'games');
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'portfolio');

// 디렉토리가 없으면 생성
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer 설정: 포트폴리오 프로젝트 업로드
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // 고유한 파일명 생성
    const uniqueName = uuidv4();
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: function (req, file, cb) {
    // ZIP 파일만 허용
    if (file.mimetype === 'application/zip' || path.extname(file.originalname).toLowerCase() === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('ZIP 파일만 업로드할 수 있습니다.'));
    }
  }
});

// Docker 컨테이너 관리를 위한 전역 변수
let runningContainers = {};

// 포트폴리오 메인 페이지
router.get('/', (req, res) => {
  res.render('portfolio', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

// 테스트 라우트 추가 (여기에 새로 추가)
router.get('/test', (req, res) => {
  console.log('포트폴리오 테스트 라우트 접속됨');
  res.send('포트폴리오 라우터 테스트 성공!');
});

// 두더지 게임 경로
router.get('/mole-game', (req, res) => {
  res.render('portfolio/mole_game', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

// QwerFighter 실행 라우트 수정
router.get('/run/qwerfighter', async (req, res) => {
  const projectId = 'qwerfighter';
  const projectPath = path.join(projectsDir, projectId);
  
  try {
    // Docker 컨테이너 실행 여부 확인
    const checkCmd = `docker ps --filter name=pygame-${projectId} --format "{{.Names}}"`;
    
    exec(checkCmd, (err, stdout) => {
      if (err) {
        console.error('Docker 명령 실행 오류:', err);
        return res.status(500).json({ error: 'Docker 서비스 연결 오류' });
      }
      
      // 실행 중이 아니면 새로 시작
      if (!stdout.includes(`pygame-${projectId}`)) {
        console.log(`컨테이너 pygame-${projectId} 시작 중...`);
        
        const runCmd = `
          docker run -d --rm \
            --name pygame-${projectId} \
            -v "${projectPath}:/app" \
            -p 6080:6080 \
            qwerfighter-vnc
        `;
        
        exec(runCmd, (err) => {
          if (err) {
            console.error('Docker 컨테이너 실행 오류:', err);
            return res.status(500).json({ error: '게임 환경 시작 실패' });
          }
          
          console.log(`컨테이너 pygame-${projectId} 실행 성공`);
          
          // 게임 뷰어 렌더링
          renderGameViewer();
        });
      } else {
        // 이미 실행 중이면 바로 게임 뷰어 렌더링
        console.log(`컨테이너 pygame-${projectId} 이미 실행 중`);
        renderGameViewer();
      }
    });
    
    // 게임 뷰어 페이지 렌더링 함수
    function renderGameViewer() {
      res.render('game-viewer', {
        title: 'QwerFighter',
        hostname: req.hostname, // 또는 서버 실제 IP
        userID: req.session.userID,
        is_logined: req.session.is_logined
      });
    }
  } catch (error) {
    console.error('프로젝트 실행 오류:', error);
    res.status(500).json({ error: '프로젝트 실행 중 오류가 발생했습니다.' });
  }
});

// 사용자 프로젝트 실행
router.get('/run/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const userId = req.session.userID;
  
  try {
    // 프로젝트 정보 조회
    const [project] = await db.queryDatabase(
      'SELECT * FROM PortfolioProjects WHERE id = ? AND user_id = ?',
      [projectId, userId]
    );
    
    if (!project) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' });
    }
    
    const projectPath = path.join(projectsDir, projectId);
    
    // 프로젝트 실행
    await runPygameProject(projectId, projectPath, req, res);
  } catch (error) {
    console.error('프로젝트 실행 오류:', error);
    res.status(500).json({ error: '프로젝트 실행 중 오류가 발생했습니다.' });
  }
});

// Pygame 프로젝트 실행 함수 수정
async function runPygameProject(projectId, projectPath, req, res) {
  const userId = req.session.userID;
  const containerName = `pygame-${projectId}`;
  
  try {
    // 포트 할당
    const port = await portManager.allocatePort(userId, projectId);
    
    // 이미 실행 중인 컨테이너 확인
    const checkCmd = `docker ps --filter name=${containerName} --format "{{.Names}}"`;
    
    exec(checkCmd, async (err, stdout) => {
      if (err) {
        console.error('Docker 컨테이너 확인 중 오류:', err);
        return res.status(500).json({ error: 'Docker 서비스에 연결할 수 없습니다.' });
      }
      
      // 이미 실행 중인 경우
      if (stdout.includes(containerName)) {
        console.log(`[SKIP] 이미 실행 중인 컨테이너: ${containerName}`);
        
        // 활동 시간 업데이트
        portManager.updateActivity(userId, projectId);
        
        // noVNC URL로 리다이렉트
        return res.redirect(`/novnc/vnc.html?host=${req.hostname}&path=/api/ws/proxy/6080&autoconnect=true`);
      } else {
        // 실행 중이 아니면 새로 시작
        startNewContainer(port);
      }
      
      // 새 컨테이너 시작 함수
      function startNewContainer(port) {
        // Docker 명령어 구성 (리소스 제한 추가)
        const runCmd = `
          docker run -d --rm \
            --name ${containerName} \
            --memory="256m" --memory-swap="512m" --cpus=0.5 \
            -v "${projectPath}:/app" \
            -p ${port}:6080 \
            qwerfighter-vnc
        `;
        
        // 컨테이너 실행
        exec(runCmd, (err) => {
          if (err) {
            console.error('Docker 컨테이너 실행 오류:', err);
            return res.status(500).json({ error: '게임 환경을 시작할 수 없습니다.' });
          }
          
          console.log(`[OK] 컨테이너 ${containerName} 시작됨 - 포트 ${port}`);
          
          // 컨테이너 ID 업데이트
          exec(`docker inspect --format='{{.Id}}' ${containerName}`, (err, stdout) => {
            if (!err && stdout) {
              portManager.updateContainerId(userId, projectId, stdout.trim());
            }
          });
          
          // noVNC URL로 리다이렉트
          res.redirect(`/novnc/vnc.html?host=${req.hostname}&path=/api/ws/proxy/6080&autoconnect=true`);
        });
      }
    });
  } catch (error) {
    console.error('프로젝트 실행 중 오류:', error);
    res.status(500).json({ error: error.message || '프로젝트 실행 중 오류가 발생했습니다.' });
  }
}

// API: 프로젝트 목록 조회
router.get('/api/projects', async (req, res) => {
  try {
    const userId = req.session.userID;
    
    const projects = await db.queryDatabase(
      'SELECT * FROM PortfolioProjects WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    res.json({ success: true, projects });
  } catch (error) {
    console.error('프로젝트 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '프로젝트 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// API: 프로젝트 업로드
router.post('/api/upload', upload.single('projectFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ZIP 파일을 업로드해주세요.' });
    }
    
    const { projectName, projectDesc } = req.body;
    const userId = req.session.userID;
    
    if (!projectName) {
      // 업로드된 파일 삭제
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: '프로젝트 이름을 입력해주세요.' });
    }
    
    // 프로젝트 ID 생성
    const projectId = uuidv4();
    const projectPath = path.join(projectsDir, projectId);
    
    // 프로젝트 디렉토리 생성
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }
    
    // ZIP 파일 압축 해제
    await extract(req.file.path, { dir: projectPath });
    
    // main.py 파일 존재 여부 확인
    const mainPyPath = path.join(projectPath, 'main.py');
    if (!fs.existsSync(mainPyPath)) {
      // 압축 해제된 디렉토리에서 main.py 찾기
      let mainPyFound = false;
      
      // 재귀적으로 main.py 찾기
      function findMainPy(dir) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            findMainPy(filePath);
          } else if (file === 'main.py') {
            // main.py를 찾으면 프로젝트 루트로 복사
            fs.copyFileSync(filePath, mainPyPath);
            mainPyFound = true;
            break;
          }
        }
      }
      
      findMainPy(projectPath);
      
      if (!mainPyFound) {
        // 프로젝트 디렉토리 삭제
        fs.rmdirSync(projectPath, { recursive: true });
        // 업로드된 파일 삭제
        fs.unlinkSync(req.file.path);
        
        return res.status(400).json({ success: false, message: 'ZIP 파일에 main.py가 포함되어 있지 않습니다.' });
      }
    }
    
    // index.html 파일 생성 (없을 경우)
    const indexHtmlPath = path.join(projectPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      const indexHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
        }
        .container {
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
        }
        p {
            line-height: 1.6;
            color: #666;
        }
        .btn {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
        }
        .btn:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${projectName}</h1>
        <p>${projectDesc || '이 프로젝트는 Pygame을 사용하여 만들어졌습니다.'}</p>
        <p>게임을 실행하려면 아래 버튼을 클릭하세요.</p>
        <a href="#" class="btn" onclick="window.location.href='/portfolio/run/${projectId}'">게임 실행하기</a>
    </div>
</body>
</html>
      `;
      
      fs.writeFileSync(indexHtmlPath, indexHtml);
    }
    
    // image 디렉토리 생성 (없을 경우)
    const imageDir = path.join(projectPath, 'image');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    
    // 썸네일 이미지 경로
    let thumbnailPath = null;
    
    // 업로드된 파일 정리
    fs.unlinkSync(req.file.path);
    
    // DB에 프로젝트 정보 저장
    const result = await db.queryDatabase(
      `INSERT INTO PortfolioProjects (id, user_id, name, description, thumbnail, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [projectId, userId, projectName, projectDesc, thumbnailPath]
    );
    
    res.json({
      success: true,
      message: '프로젝트가 성공적으로 업로드되었습니다.',
      project: {
        id: projectId,
        name: projectName,
        description: projectDesc,
        thumbnail: thumbnailPath
      }
    });
  } catch (error) {
    console.error('프로젝트 업로드 오류:', error);
    res.status(500).json({ success: false, message: '프로젝트 업로드 중 오류가 발생했습니다.' });
  }
});

// API: 프로젝트 삭제
router.delete('/api/delete/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.userID;
    
    // 프로젝트 정보 조회
    const [project] = await db.queryDatabase(
      'SELECT * FROM PortfolioProjects WHERE id = ? AND user_id = ?',
      [projectId, userId]
    );
    
    if (!project) {
      return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없거나 접근 권한이 없습니다.' });
    }
    
    // 실행 중인 컨테이너가 있으면 중지
    const containerName = `pygame-${projectId}`;
    exec(`docker ps --filter name=${containerName} --format "{{.Names}}"`, (err, stdout) => {
      if (!err && stdout.includes(containerName)) {
        exec(`docker stop ${containerName}`);
        delete runningContainers[containerName];
      }
    });
    
    // 프로젝트 디렉토리 삭제
    const projectPath = path.join(projectsDir, projectId);
    if (fs.existsSync(projectPath)) {
      fs.rmdirSync(projectPath, { recursive: true });
    }
    
    // DB에서 프로젝트 정보 삭제
    await db.queryDatabase(
      'DELETE FROM PortfolioProjects WHERE id = ?',
      [projectId]
    );
    
    res.json({ success: true, message: '프로젝트가 삭제되었습니다.' });
  } catch (error) {
    console.error('프로젝트 삭제 오류:', error);
    res.status(500).json({ success: false, message: '프로젝트 삭제 중 오류가 발생했습니다.' });
  }
});

// 컨테이너 정리 함수 수정
async function cleanupContainers() {
  console.log('미사용 컨테이너 정리 중...');
  
  try {
    // 오래된 할당 정리 (30분)
    const cleanedCount = await portManager.cleanupOldAllocations(30);
    
    if (cleanedCount > 0) {
      // 해제된 컨테이너 중지
      const timeoutAllocations = await db.queryDatabase(
        'SELECT container_id FROM PortAllocation WHERE status = "timeout" AND container_id IS NOT NULL'
      );
      
      for (const allocation of timeoutAllocations) {
        if (allocation.container_id) {
          exec(`docker stop ${allocation.container_id}`, (err) => {
            if (err) {
              console.error(`컨테이너 정리 중 오류: ${err.message}`);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('컨테이너 정리 중 오류:', error);
  }
}


// 서버에 정리 스케줄러 등록 (15분마다 실행)
setInterval(cleanupContainers, 15 * 60 * 1000);

module.exports = router;