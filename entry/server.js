const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8070;

// Apache 프록시 trust 설정
app.set('trust proxy', true);

// 🔥 전역 디버깅 미들웨어 (모든 요청 로깅)
app.use((req, res, next) => {
    console.log('\n=== 8070 포트 요청 수신 ===');
    console.log('📍 URL:', req.originalUrl);
    console.log('📍 Path:', req.path);
    console.log('📍 Method:', req.method);
    console.log('📍 Query Params:', JSON.stringify(req.query));
    console.log('📍 Headers:', {
        'x-user-id': req.headers['x-user-id'],
        'x-user-role': req.headers['x-user-role'],
        'user-agent': req.headers['user-agent']?.substring(0, 50)
    });
    console.log('========================\n');
    next();
});

// 보안 미들웨어 (EntryJS 호환)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://cdnjs.cloudflare.com",
                "https://playentry.org",
                "https://entry-cdn.pstatic.net",
                "https://apis.google.com",
                "https://fonts.googleapis.com",
                "blob:",
                "data:"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdnjs.cloudflare.com",
                "https://playentry.org",
                "https://entry-cdn.pstatic.net",
                "https://fonts.googleapis.com"
            ],
            imgSrc: ["'self'", "data:", "https:", "blob:", "*"],
            connectSrc: ["'self'", "https:", "wss:", "*"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            frameSrc: ["'self'", "https:", "*"],
            mediaSrc: ["'self'", "https:", "blob:", "data:", "*"],
            objectSrc: ["'none'"],
            workerSrc: ["'self'", "blob:"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS 설정
app.use(cors({
    origin: [
        'https://app.codingnplay.co.kr',
        'http://localhost:3000',
        'https://172.31.0.184:3000',
        'http://172.31.0.184:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Forwarded-For',
        'X-Forwarded-Proto',
        'X-Real-IP',
        'X-User-ID',
        'X-User-Role'
    ]
}));

// 미들웨어
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// EJS 템플릿 엔진
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 기본 정적 파일 서빙
app.use('/', express.static('./', {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();

        switch (ext) {
            case '.js':
            case '.mjs':
                res.set('Content-Type', 'application/javascript; charset=utf-8');
                break;
            case '.css':
                res.set('Content-Type', 'text/css; charset=utf-8');
                break;
            case '.svg':
                res.set('Content-Type', 'image/svg+xml');
                break;
            case '.png':
                res.set('Content-Type', 'image/png');
                break;
        }

        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', 'https://app.codingnplay.co.kr');
    }
}));

// 🖼️ ENT 파일 이미지 정적 파일 서빙 - 사용자 세션 디렉토리 지원
app.use('/temp/ent_files/users', express.static('/var/www/html/temp/ent_files/users', {
    setHeaders: (res, filePath) => {
        console.log(`🖼️ ENT 사용자 이미지 서빙: ${filePath}`);
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.set('X-Image-Source', 'EntryJS-8070-UserSession');
    }
}));

// 🖼️ ENT 파일 이미지 정적 파일 서빙 - current 디렉토리 (하위 호환성)
app.use('/temp', express.static('/var/www/html/temp/ent_files/current', {
    setHeaders: (res, filePath) => {
        console.log(`🖼️ ENT 이미지 서빙 (current): ${filePath}`);
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.set('X-Image-Source', 'EntryJS-8070');
    }
}));

// 🔍 ENT 이미지 디버깅용 로그
app.use('/temp/*', (req, res, next) => {
    const requestedPath = req.path;
    const fullPath = path.join('/var/www/html/temp/ent_files/current', requestedPath.replace('/temp', ''));

    console.log('🖼️ ENT 이미지 요청 디버깅:', {
        requestedUrl: req.originalUrl,
        requestedPath: requestedPath,
        fullPath: fullPath,
        fileExists: fs.existsSync(fullPath),
        timestamp: new Date().toISOString()
    });

    // 파일이 존재하지 않는 경우 상세 로그
    if (!fs.existsSync(fullPath)) {
        console.error('❌ ENT 이미지 파일 없음:', {
            requestedPath,
            fullPath,
            currentDir: fs.existsSync('/var/www/html/temp/ent_files/current') ? 'exists' : 'missing'
        });

        // current 디렉토리 내용 확인
        try {
            const currentDirContents = fs.readdirSync('/var/www/html/temp/ent_files/current');
            console.log('📁 current 디렉토리 내용:', currentDirContents.slice(0, 10)); // 처음 10개만
        } catch (err) {
            console.error('❌ current 디렉토리 읽기 오류:', err.message);
        }
    }

    next();
});

console.log('✅ ENT 이미지 정적 파일 서빙 설정:');
console.log('   - /temp/ent_files/users -> /var/www/html/temp/ent_files/users (사용자 세션)');
console.log('   - /temp -> /var/www/html/temp/ent_files/current (하위 호환)');

// npm 패키지 서빙
app.use('/node_modules', express.static('./node_modules'));

// 🔥 사용자 정보 디코딩 미들웨어 (강화된 디버깅)
function decodeUserInfo(req, res, next) {
    console.log('\n🔍 === 사용자 정보 디코딩 시작 ===');
    console.log('Query:', req.query);
    console.log('Headers:', {
        'x-user-id': req.headers['x-user-id'],
        'x-user-role': req.headers['x-user-role']
    });

    const authParam = req.query.auth;

    if (authParam) {
        try {
            const decodedInfo = JSON.parse(Buffer.from(authParam, 'base64').toString());

            const now = Date.now();
            if (now - decodedInfo.timestamp > 10 * 60 * 1000) {
                console.warn('⚠️ 만료된 인증 토큰');
                req.userInfo = { userID: 'guest', role: 'guest' };
            } else {
                req.userInfo = decodedInfo;
                console.log('✅ auth 파라미터 디코딩 성공:', req.userInfo);
            }
        } catch (error) {
            console.error('❌ 사용자 정보 디코딩 실패:', error);
            req.userInfo = { userID: 'guest', role: 'guest' };
        }
    } else {
        // URL 파라미터 또는 헤더에서 읽기
        req.userInfo = {
            userID: req.query.userID || req.headers['x-user-id'] || 'guest',
            role: req.query.role || req.headers['x-user-role'] || 'guest',
            project: req.query.project || 'new',
            sessionID: req.query.sessionID || '',
            s3Url: req.query.s3Url || ''
        };

        console.log('✅ URL 파라미터/헤더에서 사용자 정보 추출:', req.userInfo);
    }

    console.log('🔍 === 최종 사용자 정보 ===');
    console.log(JSON.stringify(req.userInfo, null, 2));
    console.log('========================\n');

    next();
}

// 헬스 체크
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        server: 'EntryJS Base Server',
        port: PORT,
        timestamp: new Date().toISOString(),
        files: {
            indexHtml: fs.existsSync('./index.html'),
            appMjs: fs.existsSync('./js/app.mjs'),
            npmEntry: fs.existsSync('./node_modules/@entrylabs/entry'),
            entryImages: fs.existsSync('./node_modules/@entrylabs/entry/images')
        }
    });
});

// 🔥 메인 워크스페이스 라우트 (// 경로도 처리)
app.get(['/', '//'], decodeUserInfo, (req, res) => {
    console.log('\n📋 === EntryJS Base 워크스페이스 렌더링 ===');
    console.log('사용자 정보:', req.userInfo);

    const indexPath = path.join(__dirname, 'index.html');

    if (!fs.existsSync(indexPath)) {
        return res.status(404).send(`
            <h1>EntryJS Base 서버</h1>
            <p>index.html 파일을 찾을 수 없습니다.</p>
        `);
    }

    let htmlContent = fs.readFileSync(indexPath, 'utf8');

    const userScript = `
    <script>
        console.log('🔥 EDUCODINGNPLAY_USER 설정 시작');
        window.EDUCODINGNPLAY_USER = {
            userID: '${req.userInfo.userID}',
            role: '${req.userInfo.role}',
            centerID: '${req.userInfo.centerID || ''}',
            project: '${req.userInfo.project || 'new'}',
            sessionID: '${req.userInfo.sessionID || ''}',
            s3Url: '${req.userInfo.s3Url || ''}',
            baseUrl: 'https://app.codingnplay.co.kr'
        };
        console.log('✅ EDUCODINGNPLAY_USER 설정 완료:', window.EDUCODINGNPLAY_USER);
    </script>
    `;

    htmlContent = htmlContent.replace('</head>', userScript + '\n</head>');

    console.log('✅ HTML 전송 (사용자 정보 포함)');
    console.log('========================\n');

    res.send(htmlContent);
});

// API 엔드포인트
app.get('/api/user-info', decodeUserInfo, (req, res) => {
    res.json({
        success: true,
        userInfo: req.userInfo
    });
});

// 🔥 Paint Editor API - 3000번 서버로 프록시
const http = require('http');

app.post('/api/picture/paint', (req, res) => {
    console.log('🎨 [8070] Paint Editor API 프록시 요청');

    const postData = JSON.stringify(req.body);

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/picture/paint',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Cookie': req.headers.cookie || ''
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => {
            try {
                const jsonData = JSON.parse(data);
                console.log('✅ [8070] 프록시 응답:', jsonData);
                res.json(jsonData);
            } catch (e) {
                console.error('❌ [8070] 프록시 응답 파싱 오류:', e);
                res.status(500).json({ error: 'Proxy response parse error' });
            }
        });
    });

    proxyReq.on('error', (e) => {
        console.error('❌ [8070] 프록시 요청 오류:', e);
        res.status(500).json({ error: 'Proxy request failed' });
    });

    proxyReq.write(postData);
    proxyReq.end();
});

// 🔥 ENT 프로젝트 로드 API - 3000번 서버로 프록시
// Apache에서 /entry/api/load-project → 8070의 /api/load-project로 전달됨
app.get('/api/load-project', (req, res) => {
    const { s3Url, file } = req.query;

    console.log('📦 [8070] ENT 프로젝트 로드 API 프록시 요청:', { s3Url, file });

    if (!s3Url && !file) {
        return res.status(400).json({
            success: false,
            error: 's3Url 또는 file 파라미터가 필요합니다.'
        });
    }

    // Query string 구성
    const queryParams = new URLSearchParams();
    if (s3Url) queryParams.set('s3Url', s3Url);
    if (file) queryParams.set('file', file);

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/entry/api/load-project?${queryParams.toString()}`,
        method: 'GET',
        headers: {
            'Cookie': req.headers.cookie || ''
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => {
            try {
                const jsonData = JSON.parse(data);
                console.log('✅ [8070] ENT 프로젝트 로드 프록시 응답:', {
                    success: jsonData.success,
                    fileName: jsonData.fileName,
                    hasProjectData: !!jsonData.projectData
                });
                res.json(jsonData);
            } catch (e) {
                console.error('❌ [8070] ENT 프로젝트 로드 프록시 응답 파싱 오류:', e);
                res.status(500).json({ success: false, error: 'Proxy response parse error' });
            }
        });
    });

    proxyReq.on('error', (e) => {
        console.error('❌ [8070] ENT 프로젝트 로드 프록시 요청 오류:', e);
        res.status(500).json({ success: false, error: 'Proxy request failed' });
    });

    proxyReq.end();
});

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path
    });
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('💥 서버 오류:', err.message);
    res.status(500).json({
        error: 'Internal Server Error'
    });
});

// 서버 시작
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🎯 EntryJS Base 서버 시작!');
    console.log(`✅ 서버: http://localhost:${PORT}`);
    console.log(`🌐 프록시: https://app.codingnplay.co.kr/entry/`);
    console.log('📝 디버깅 모드 활성화');
});

server.timeout = 30000;

// 활성 소켓 추적
const sockets = new Set();
server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => {
        sockets.delete(socket);
    });
});

// 🔥 Graceful Shutdown
const shutdown = (signal) => {
    console.log(`${signal} received: closing HTTP server`);

    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });

    // 소켓 강제 종료
    if (sockets.size > 0) {
        console.log(`Destroying ${sockets.size} active sockets...`);
        for (const socket of sockets) {
            socket.destroy();
            sockets.delete(socket);
        }
    }

    // Force close after timeout
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 4000); // 5초보다 약간 짧게 설정
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
