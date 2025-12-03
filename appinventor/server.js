const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 8888;

// AppInventor 소스 경로 정의 (심볼릭 링크 대신 직접 참조도 가능)
const AI_SOURCE_PATH = '/var/www/html/appinventor-sources/appinventor/appengine/build/war';

// 미들웨어 설정
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 제공 - MIME 타입 강제 설정
app.use('/static', express.static(path.join(__dirname, 'static'), {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.css':
                res.set('Content-Type', 'text/css; charset=utf-8');
                break;
            case '.js':
                res.set('Content-Type', 'application/javascript; charset=utf-8');
                break;
            case '.png':
                res.set('Content-Type', 'image/png');
                break;
            case '.gif':
                res.set('Content-Type', 'image/gif');
                break;
            case '.jpg':
            case '.jpeg':
                res.set('Content-Type', 'image/jpeg');
                break;
            case '.svg':
                res.set('Content-Type', 'image/svg+xml');
                break;
            case '.woff':
                res.set('Content-Type', 'font/woff');
                break;
            case '.woff2':
                res.set('Content-Type', 'font/woff2');
                break;
        }
    }
}));

app.use('/ode', express.static(path.join(__dirname, 'ode'), {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.js') {
            res.set('Content-Type', 'application/javascript; charset=utf-8');
        } else if (ext === '.css') {
            res.set('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));

app.use('/reference', express.static(path.join(__dirname, 'reference'), {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.js') {
            res.set('Content-Type', 'application/javascript; charset=utf-8');
        } else if (ext === '.css') {
            res.set('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));

app.use('/templates', express.static(path.join(__dirname, 'templates')));
app.use('/WEB-INF', express.static(path.join(__dirname, 'WEB-INF')));

// 직접 소스 경로 참조 (백업용)
app.use('/direct/static', express.static(path.join(AI_SOURCE_PATH, 'static')));
app.use('/direct/ode', express.static(path.join(AI_SOURCE_PATH, 'ode')));
app.use('/direct/reference', express.static(path.join(AI_SOURCE_PATH, 'reference')));

// CORS 및 보안 헤더 설정
app.use((req, res, next) => {
    // CORS 설정
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // AppInventor에 필요한 헤더
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('X-Content-Type-Options', 'nosniff');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// JSP 파일을 HTML로 변환하는 함수 (완전 수정)
function processJSP(jspContent, req) {
    const token = req.cookies.token || '';
    const userID = req.cookies.userID || 'anonymous';
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    let htmlContent = jspContent
        // JSP 페이지 지시자 제거
        .replace(/<%@\s*page\s+[^%>]*%>/g, '')
        .replace(/<%@\s*taglib\s+[^%>]*%>/g, '')
        
        // 핵심 AppInventor 변수들을 직접 설정
        .replace(/<%[\s\S]*?%>/g, '') // 모든 JSP 코드 제거
        
        // 필수 스크립트를 head에 삽입
        .replace('</head>', `
            <script>
                // AppInventor 핵심 변수 설정
                window.odeBase = "${baseUrl}/ode/";
                window.translation = "en";
                window.JWT_TOKEN = "${token}";
                window.USER_ID = "${userID}";
                
                // 경로 설정
                window.contextPath = "";
                window.staticUrl = "${baseUrl}/static";
                
                // Google Closure Library 기본 설정
                window.CLOSURE_NO_DEPS = true;
                window.CLOSURE_BASE_PATH = "${baseUrl}/static/closure-library/closure/goog/";
                
                console.log("AppInventor 변수 설정 완료:", {
                    odeBase: window.odeBase,
                    translation: window.translation,
                    contextPath: window.contextPath,
                    staticUrl: window.staticUrl
                });
                
                // AppInventor 기본 설정
                window.AI_CONFIG = {
                    userId: "${userID}",
                    baseUrl: "${baseUrl}",
                    staticUrl: "${baseUrl}/static",
                    odeUrl: "${baseUrl}/ode"
                };
            </script>
            </head>`);
    
    return htmlContent;
}

// 메인 페이지 라우팅 (index.jsp)
app.get('/', (req, res) => {
    const jspPath = path.join(__dirname, 'index.jsp');
    
    if (fs.existsSync(jspPath)) {
        try {
            const jspContent = fs.readFileSync(jspPath, 'utf8');
            const htmlContent = processJSP(jspContent, req);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(htmlContent);
        } catch (err) {
            console.error('index.jsp 처리 오류:', err);
            res.status(500).send(`
                <html>
                    <head><title>AppInventor 시작 오류</title></head>
                    <body>
                        <h1>AppInventor 초기화 중 오류 발생</h1>
                        <p>오류: ${err.message}</p>
                        <p><a href="/debug">디버그 정보 보기</a></p>
                    </body>
                </html>
            `);
        }
    } else {
        // index.jsp가 없으면 사용 가능한 파일들 표시
        const files = fs.readdirSync(__dirname).filter(f => 
            f.endsWith('.jsp') || f.endsWith('.html')
        );
        
        res.send(`
            <html>
                <head><title>AppInventor - 파일 목록</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>AppInventor 서버</h1>
                    <p><strong>포트:</strong> ${PORT}</p>
                    <p><strong>상태:</strong> 실행 중</p>
                    
                    <h2>사용 가능한 파일:</h2>
                    <ul>
                        ${files.map(f => `<li><a href="/${f}">${f}</a></li>`).join('')}
                    </ul>
                    
                    <h2>디렉토리 구조:</h2>
                    <ul>
                        <li><a href="/static/">정적 파일</a></li>
                        <li><a href="/ode/">ODE (Open Blocks Editor)</a></li>
                        <li><a href="/reference/">참조 문서</a></li>
                        <li><a href="/templates/">프로젝트 템플릿</a></li>
                    </ul>
                </body>
            </html>
        `);
    }
});

// 로그인 페이지 라우팅
app.get('/login.jsp', (req, res) => {
    // 3000번 서버로 리다이렉트 (우리 자체 로그인 시스템 사용)
    res.redirect('http://localhost:3000/auth/login?redirect=' + encodeURIComponent(req.get('referer') || '/'));
});

// 모든 JSP 파일 처리
app.get('*.jsp', (req, res) => {
    const jspPath = path.join(__dirname, req.path);
    
    if (fs.existsSync(jspPath)) {
        try {
            const jspContent = fs.readFileSync(jspPath, 'utf8');
            const htmlContent = processJSP(jspContent, req);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(htmlContent);
        } catch (err) {
            console.error(`${req.path} 처리 오류:`, err);
            res.status(500).send(`JSP 파일 처리 중 오류: ${err.message}`);
        }
    } else {
        res.status(404).send(`${req.path}를 찾을 수 없습니다.`);
    }
});

// 디버그 정보 엔드포인트
app.get('/debug', (req, res) => {
    const debugInfo = {
        port: PORT,
        nodeVersion: process.version,
        workingDirectory: __dirname,
        files: fs.readdirSync(__dirname).filter(f => f.endsWith('.jsp') || f.endsWith('.html')),
        staticDirs: ['static', 'ode', 'reference', 'templates'].map(dir => ({
            name: dir,
            exists: fs.existsSync(path.join(__dirname, dir)),
            files: fs.existsSync(path.join(__dirname, dir)) ? 
                fs.readdirSync(path.join(__dirname, dir)).slice(0, 10) : []
        })),
        headers: req.headers,
        cookies: req.cookies
    };
    
    res.json(debugInfo);
});

// API 엔드포인트들 (AppInventor 백엔드 기능)
app.post('/api/*', (req, res) => {
    // 임시로 모든 API 요청을 성공으로 응답
    console.log('API 요청:', req.url, req.body);
    res.json({ 
        success: true, 
        message: 'API endpoint placeholder',
        url: req.url,
        method: req.method 
    });
});

// 정적 파일 최종 처리 (마지막에 위치)
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.js') {
            res.set('Content-Type', 'application/javascript; charset=utf-8');
        } else if (ext === '.css') {
            res.set('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));

// 404 처리
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, req.path);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.status(404).send(`
            <html>
                <head><title>404 - 파일을 찾을 수 없습니다</title></head>
                <body>
                    <h1>404 - 파일을 찾을 수 없습니다</h1>
                    <p>요청한 경로: ${req.path}</p>
                    <p><a href="/">메인 페이지로 돌아가기</a></p>
                </body>
            </html>
        `);
    }
});

// 서버 시작
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`AppInventor 서버 시작됨`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`디렉토리: ${__dirname}`);
    console.log(`시작 시간: ${new Date().toISOString()}`);
    
    // 파일 목록 출력
    try {
        const files = fs.readdirSync(__dirname);
        console.log(`총 ${files.length}개 파일 발견`);
        
        const jspFiles = files.filter(f => f.endsWith('.jsp'));
        const htmlFiles = files.filter(f => f.endsWith('.html'));
        const directories = files.filter(f => {
            try {
                return fs.statSync(path.join(__dirname, f)).isDirectory();
            } catch {
                return false;
            }
        });
        
        console.log(`JSP 파일: ${jspFiles.join(', ')}`);
        console.log(`HTML 파일: ${htmlFiles.join(', ')}`);
        console.log(`디렉토리: ${directories.join(', ')}`);
    } catch (err) {
        console.log('파일 목록 출력 중 오류:', err.message);
    }
});

// 에러 처리
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`포트 ${PORT}가 이미 사용 중입니다.`);
        console.error(`다른 프로세스를 중지하거나 다른 포트를 사용하세요.`);
    } else {
        console.error('서버 시작 오류:', err);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM 수신, 서버를 안전하게 종료합니다...');
    server.close(() => {
        console.log('서버가 종료되었습니다.');
    });
});

module.exports = app;