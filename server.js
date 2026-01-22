require('dotenv').config();
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const mime = require('mime-types');
const fs = require('fs');
const cron = require('node-cron');

const bcrypt = require('bcrypt');
const { createProxyMiddleware } = require('http-proxy-middleware');

// 설정 파일 불러오기
const config = require('./config');

// DB 및 권한 관련 모듈 불러오기
const db = require('./lib_login/db');
const { updatePermissionCache } = require('./lib_login/permissions');
const { checkPageAccess, checkRole, checkAdminRole } = require('./lib_login/authMiddleware');
const { logUserActivity, logMenuAccess, logLearningActivity } = require('./lib_login/logging');
const { requireEducationAccess, requireCenterUser, requireCenterAdmin, checkStorageQuota, checkBlogPostLimit } = require('./lib_login/accessControl');

// 🔥 Initialize Gallery DB Tables
const initGalleryDB = require('./tools/init_gallery_db');
// initGalleryDB().catch(console.error);

// 🔥 Initialize Observatory DB Schema
const initSchema = require('./lib_login/schemaInit');
// initSchema().catch(console.error);

const app = express();
const SERVICE_TYPE = process.env.SERVICE_TYPE || 'main';
const isMain = SERVICE_TYPE === 'main';

// 서버 시작 시 권한 캐시 초기화
const permissionsPath = path.join(__dirname, './lib_login/permissions.json');
const permissions = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
updatePermissionCache(permissions);

// AWS SDK v3 사용
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { fromEnv } = require('@aws-sdk/credential-provider-env');

// S3Client 설정
const s3Client = new S3Client({
  region: config.S3.REGION,
  credentials: fromEnv()
});

// S3에서 객체 가져오는 함수
const getObjectFromS3 = async (fileName) => {
  const params = {
    Bucket: config.S3.BUCKET_NAME,
    Key: fileName
  };

  try {
    const data = await s3Client.send(new GetObjectCommand(params));
    return data.Body;
  } catch (err) {
    console.error(`Error fetching file from S3: ${err.message}`);
    throw err;
  }
};

// view 사용 설정
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'portfolio-project', 'games')
]);

// =====================================================================
// 정적 파일 서빙
// =====================================================================

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath, stat) => {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.js':
        res.set('Content-Type', 'application/javascript; charset=utf-8');
        break;
      case '.css':
        res.set('Content-Type', 'text/css; charset=utf-8');
        break;
      case '.json':
        res.set('Content-Type', 'application/json; charset=utf-8');
        break;
      case '.html':
        res.set('Content-Type', 'text/html; charset=utf-8');
        break;
      case '.png':
        res.set('Content-Type', 'image/png');
        break;
      case '.jpg':
      case '.jpeg':
        res.set('Content-Type', 'image/jpeg');
        break;
      case '.gif':
        res.set('Content-Type', 'image/gif');
        break;
      case '.svg':
        res.set('Content-Type', 'image/svg+xml');
        break;
      case '.ico':
        res.set('Content-Type', 'image/x-icon');
        break;
      case '.woff':
        res.set('Content-Type', 'font/woff');
        break;
      case '.woff2':
        res.set('Content-Type', 'font/woff2');
        break;
      case '.ttf':
        res.set('Content-Type', 'font/ttf');
        break;
      case '.eot':
        res.set('Content-Type', 'application/vnd.ms-fontobject');
        break;
      case '.pdf':
        res.set('Content-Type', 'application/pdf');
        break;
      default:
        res.set('Content-Type', mime.lookup(filePath) || 'application/octet-stream');
    }

    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  }
}));

app.use('/resource', express.static(path.join(__dirname, 'public', 'resource')));
app.use('/node_modules/bootstrap-icons', express.static(path.join(__dirname, 'node_modules/bootstrap-icons')));
app.use('/js/turn.js', express.static(path.join(__dirname, 'node_modules/turn.js/turn.min.js')));
app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'resource', 'favicon.ico')));


app.use('/node_modules', express.static(path.join(__dirname, 'node_modules'), {
  setHeaders: (res, filePath, stat) => {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.js':
        res.set('Content-Type', 'application/javascript; charset=utf-8');
        break;
      case '.css':
        res.set('Content-Type', 'text/css; charset=utf-8');
        break;
      case '.wasm':
        res.set('Content-Type', 'application/wasm');
        break;
      case '.json':
        res.set('Content-Type', 'application/json; charset=utf-8');
        break;
    }

    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  }
}));

// 환경 설정 API
app.get('/config', (req, res) => {
  res.json({
    apiKey: config.GOOGLE_API.KEY,
    discoveryDocs: config.GOOGLE_API.DISCOVERY_DOCS,
    spreadsheetId: config.GOOGLE_API.SPREADSHEET_ID,
  });
});

// Redis 클라이언트 설정
const redisClient = redis.createClient({ url: config.REDIS.URL });
redisClient.connect().catch(console.error);
redisClient.setMaxListeners(20);

const store = new RedisStore({
  client: redisClient,
  prefix: config.REDIS.PREFIX
});
store.setMaxListeners(20);

// CORS 설정
app.use(cors({
  origin: function (origin, callback) {
    // 허용된 Origin 목록 (config.js에서 가져옴)
    const allowedOrigins = config.CORS.ALLOWED_ORIGINS;

    // Chrome Extension Origin 허용 (chrome-extension://)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// CSP 설정
app.use((req, res, next) => {
  let cspString = config.getCSPString();
  let cspParts = cspString.split(';').map(part => part.trim());

  let scriptSrcIndex = cspParts.findIndex(part => part.startsWith('script-src'));
  if (scriptSrcIndex !== -1) {
    cspParts[scriptSrcIndex] += " https://polyfill.io https://entry-cdn.pstatic.net https://cdnjs.cloudflare.com https://cdn.jsdelivr.net";
  } else {
    cspParts.push("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://polyfill.io https://entry-cdn.pstatic.net https://cdnjs.cloudflare.com https://cdn.jsdelivr.net");
  }

  let connectSrcIndex = cspParts.findIndex(part => part.startsWith('connect-src'));
  if (connectSrcIndex !== -1) {
    cspParts[connectSrcIndex] += " ws: wss: https://playentry.org https://entry-cdn.pstatic.net https://kr.object.ncloudstorage.com";
  } else {
    cspParts.push(`connect-src 'self' ws: wss: https://playentry.org https://entry-cdn.pstatic.net ${config.S3.ASSET_URL}`);
  }

  let imgSrcIndex = cspParts.findIndex(part => part.startsWith('img-src'));
  if (imgSrcIndex !== -1) {
    cspParts[imgSrcIndex] += " data: blob: https://entry-cdn.pstatic.net https://kr.object.ncloudstorage.com https://codingnplay.co.kr https://cdn.imweb.me";
  } else {
    cspParts.push(`img-src 'self' data: blob: https: https://entry-cdn.pstatic.net ${config.S3.ASSET_URL} https://codingnplay.co.kr https://cdn.imweb.me`);
  }

  let fontSrcIndex = cspParts.findIndex(part => part.startsWith('font-src'));
  if (fontSrcIndex !== -1) {
    cspParts[fontSrcIndex] += " https://entry-cdn.pstatic.net";
  } else {
    cspParts.push("font-src 'self' data: https://entry-cdn.pstatic.net");
  }

  let styleSrcIndex = cspParts.findIndex(part => part.startsWith('style-src'));
  if (styleSrcIndex !== -1) {
    cspParts[styleSrcIndex] += " https://entry-cdn.pstatic.net";
  } else {
    cspParts.push("style-src 'self' 'unsafe-inline' https://entry-cdn.pstatic.net");
  }

  if (!cspParts.some(part => part.startsWith('worker-src'))) {
    cspParts.push("worker-src 'self' blob:");
  }

  res.setHeader("Content-Security-Policy", cspParts.join('; '));
  next();
});




app.set('trust proxy', 1);

// =====================================================================
// Jupyter Proxy (Body Parser 이전에 설정 필수)
// =====================================================================
const JUPYTER_HOST = process.env.JUPYTER_HOST || 'localhost';
const JUPYTER_PORT = process.env.JUPYTER_PORT || 8889;
const jupyterTarget = `http://${JUPYTER_HOST}:${JUPYTER_PORT}`;

console.log(`Setting up Jupyter Proxy to: ${jupyterTarget} (Env: ${process.env.JUPYTER_HOST}:${process.env.JUPYTER_PORT})`);

// 🔥 Blog Center Redirect Route
app.get('/blog/:centerId', async (req, res) => {
  const centerId = req.params.centerId;
  try {
    const [center] = await db.queryDatabase('SELECT subdomain FROM center_blogs WHERE center_id = ?', [centerId]);

    if (center && center.subdomain) {
      // Redirect to subdomain
      const protocol = req.protocol;
      const host = req.get('host'); // e.g. localhost:3000 or pong2.app

      // Determine base domain (remove subdomains if any, or just use config)
      const baseDomain = host.split('.').slice(-2).join('.'); // simple approximation or use config
      // For localhost dev:
      const targetHost = host.includes('localhost') ? `${center.subdomain}.blog.localhost:3001` : `${center.subdomain}.blog.${host}`;

      return res.redirect(`http://${targetHost}`);
    } else {
      return res.status(404).send('Center blog not found or not initialized.');
    }
  } catch (error) {
    console.error('Blog redirect error:', error);
    res.status(500).send('Server Error');
  }
});

// 🔥 Blog Server Proxy (Express로 라우팅 처리)
// Apache/Nginx에서 3000번으로 모든 트래픽을 보내면 여기서 분기

// 0. 🔥 내부 접근 경로 지원: /blog/{userid} -> {userid}.pong2.app 로 프록시
app.use('/blog', (req, res, next) => {
  const match = req.url.match(/^\/([^\/]+)(.*)/);
  if (match) {
    const subdomain = match[1]; // minho
    const restPath = match[2] || '/'; // /p/slug

    console.log(`Proxying internal blog request: /blog/${subdomain}${restPath} -> http://localhost:3001 (Host: ${subdomain}.pong2.app)`);

    return createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      pathRewrite: {
        [`^/blog/${subdomain}`]: '',
        [`^/${subdomain}`]: ''
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Host', `${subdomain}.pong2.app`);
      }
    })(req, res, next);
  }
  next();
});

app.use((req, res, next) => {
  const host = req.get('host') || '';

  // 1. 기존 blog.* 서브도메인 방식 Support
  const isOldBlog = host.startsWith('blog.') || host.includes('blog.app.codingnplay.co.kr');

  // 2. 새로운 *.pong2.app 방식 Support (doopyo.pong2.app)
  // 단, www.pong2.app, pong2.app, api.pong2.app 등은 제외
  const isNewBlog = host.endsWith('pong2.app') &&
    !host.startsWith('www.') &&
    host !== 'pong2.app' &&
    !host.startsWith('api.');

  if (isOldBlog || isNewBlog) {
    console.log(`Proxying blog request: ${host}${req.url} -> http://localhost:3001`);
    return createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: false,
      ws: true,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('Host', req.get('host'));
      }
    })(req, res, next);
  }
  next();
});

app.use('/jupyter', createProxyMiddleware({
  target: jupyterTarget,
  changeOrigin: true,
  ws: true,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('Jupyter Proxy Error:', err);
    res.status(502).send('Jupyter Proxy Error');
  }
}));

// =====================================================================
// 미들웨어 등록 (최적화된 순서)
// =====================================================================

// 1. 기본 파서 (🔥 10MB 제한 추가)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// 2. 서비스 감지
app.use((req, res, next) => {
  const serviceType = config.getServiceType(req);
  req.serviceType = serviceType;
  res.locals.serviceType = serviceType;
  res.locals.serviceName = serviceType === 'cosmoedu' ? '코스모에듀' : '코딩앤플레이';
  next();
});

// 3. 세션
app.use(session({
  store: store,
  secret: config.SESSION.SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,  // 🔥 매 요청마다 세션 TTL 갱신 (활동 시 로그아웃 방지)
  name: 'connect.sid',
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    // domain: '.codingnplay.co.kr', // IP 접속 문제로 제거 (브라우저 자동 처리)
    maxAge: 10800000  // 3시간
  }
}));

// 4. 로깅 미들웨어 (세션 이후!)
app.use(logUserActivity);
app.use(logMenuAccess);
app.use(logLearningActivity);

// 5. 개발 환경 로깅
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('세션:', req.session);
    next();
  });
}

// 인증 미들웨어
const authenticateUser = (req, res, next) => {
  const token = req.cookies.token;
  const isApiRequest = req.path.startsWith('/api/');

  // 세션 확인 함수
  const checkSession = () => {
    if (req.session && req.session.is_logined) {
      return next();
    }
    if (isApiRequest) {
      return res.status(401).json({ loggedIn: false, error: '로그인이 필요합니다.' });
    }
    return res.redirect('/auth/login');
  };

  if (token) {
    jwt.verify(token, config.JWT.SECRET, (err, user) => {
      if (err) {
        // 🔥 토큰이 만료되었거나 유효하지 않은 경우
        // 즉시 리다이렉트하지 않고 토큰 쿠키를 삭제한 후 세션 확인으로 넘어감
        // 이렇게 하면 세션이 살아있는 경우 로그아웃되지 않음
        res.clearCookie('token');
        return checkSession();
      }
      req.user = user;
      next();
    });
  } else {
    checkSession();
  }
};

// 템플릿 변수 설정 미들웨어
app.use(async (req, res, next) => {
  try {
    res.locals.userID = req.session?.userID || null;
    res.locals.is_logined = req.session?.is_logined || false;
    res.locals.role = req.session?.role || 'guest';
    res.locals.centerID = req.session?.centerID || null;

    if (req.session?.userID) {
      try {
        const [user] = await db.queryDatabase(
          'SELECT profile_image FROM Users WHERE userID = ?',
          [req.session.userID]
        );
        res.locals.profileImage = user?.profile_image || '/resource/profiles/default.webp';
      } catch (err) {
        console.error('프로필 이미지 조회 오류:', err);
        res.locals.profileImage = '/resource/profiles/default.webp';
      }
    } else {
      res.locals.profileImage = '/resource/profiles/default.webp';
    }

    // 🔥 센터명 설정
    if (res.locals.is_logined && res.locals.centerID) {
      if (global.centerMap) {
        res.locals.centerName = global.centerMap.get(res.locals.centerID) || '';
        if (!res.locals.centerName) {
          console.log(`[DEBUG] CenterID '${res.locals.centerID}' not found in centerMap. Keys:`, [...global.centerMap.keys()]);
        }
      } else {
        console.log('[DEBUG] global.centerMap is undefined or empty');
        res.locals.centerName = '';
      }
    } else {
      res.locals.centerName = '';
    }

  } catch (err) {
    console.error('템플릿 변수 설정 오류:', err);
  }

  next();
});

// HSTS 설정
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

// =====================================================================
// Google Sheets API using sheetService
// =====================================================================

const { getSheetData, initGoogleSheets } = require('./lib_google/sheetService');

// 🔥 센터 목록 로드 및 캐싱
global.centerMap = new Map();

async function loadCenterData() {
  try {
    const rows = await getSheetData('센터목록!A2:B'); // A: ID, B: Name
    if (rows && rows.length > 0) {
      global.centerMap.clear();
      rows.forEach(([id, name]) => {
        if (id && name) global.centerMap.set(id, name);
      });
      console.log(`🏫 센터 목록 로드 완료: ${global.centerMap.size}개`);
    }
  } catch (error) {
    console.error('센터 목록 로드 실패:', error);
  }
}

// 초기화 후 센터 목록 로드 (1시간마다 갱신)
// initGoogleSheets is handled internally by getSheetData but explicit init is fine
loadCenterData();
setInterval(loadCenterData, 3600000);

// Export for legacy compatibility (though routers should update)
module.exports = { getSheetData };

// =====================================================================
// 라우터 등록
// =====================================================================

// Entry-tool 에셋 프록시
app.use('/uploads', (req, res) => {
  const s3Url = `${config.S3.ASSET_URL}/ent/uploads${req.path}`;
  res.redirect(301, s3Url);
});

app.use('/resource/uploads', (req, res) => {
  const s3Url = `${config.S3.ASSET_URL}/ent/uploads${req.path}`;
  res.redirect(301, s3Url);
});

app.use('/api/assets', (req, res) => {
  const s3Url = `${config.S3.ASSET_URL}/ent/api/assets${req.path}`;
  res.redirect(301, s3Url);
});

// 🔥 Temporary Cleanup Route (No Auth)
app.get('/api/cleanup-nuguri-temp', async (req, res) => {
  try {
    const targetUsers = ['류태훈', '이하윤'];
    const result = await db.queryDatabase(
      `DELETE FROM nuguritalk_posts WHERE author IN (?, ?)`,
      targetUsers
    );
    res.json({ success: true, deleted: result.affectedRows, message: `Deleted messages from: ${targetUsers.join(', ')}` });
  } catch (error) {
    console.error('Cleanup Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API 라우터 등록
app.use('/api', require('./routes/apiRouter'));
// 🔥 Phase 3: 멀티미디어 업로드 시스템 (Board/Blog 공용)
app.use('/api/board/files', require('./routes/api/boardFileRouter'));

app.use('/api/board', require('./routes/api/boardApiRouter'));
// app.use('/api/jupyter', require('./routes/api/jupyterRouter')); // 🔥 Handled by apiRouter
app.use('/api', require('./routes/api/observatoryRouter')); // 🔥 Observatory API
// app.use('/api/pong2', require('./routes/api/pong2Router')); // 🔥 Moved to apiRouter.js
app.use('/api/myuniverse', require('./routes/api/myUniverseApiRouter')); // 🔥 New Blog Management API

// 🔥 Phase 2: 센터 관리 및 권한 관리 API 라우터
app.use('/api/centers', authenticateUser, require('./routes/api/centerRouter'));
app.use('/api/permissions', authenticateUser, require('./routes/api/permissionRouter'));
app.use('/api/subscriptions', authenticateUser, require('./routes/api/subscriptionRouter')); // 🔥 Phase 4


// 🔥 콘텐츠 프록시 라우터 (CORS 우회용)
app.use('/proxy/content', require('./routes/api/contentProxyRouter'));

// 🔥 스크래치 API 라우터 (8601 스크래치 GUI 계정 연동용)
if (isMain || SERVICE_TYPE === 'scratch') {
  app.use('/api/scratch', require('./routes/api/scratchRouter'));
}
// app.use('/api/entry-project', authenticateUser, require('./routes/api/entryProjectAPI')); // ❌ deprecated - 통합 projectRouter 사용

// 🔥 Entry 데이터 API 라우터 (업로드 포함)
if (isMain || SERVICE_TYPE === 'entry') {
  app.use('/entry/data', require('./routes/api/entryDataRouter'));
}

// 🔥 통합 프로젝트 저장 시스템 라우터
app.use('/api/projects', authenticateUser, require('./routes/api/projectRouter'));

// 🔥 통합 S3 브라우저 API 라우터
app.use('/api/s3', authenticateUser, require('./routes/api/s3BrowserRouter'));

// 🔥 External Submission Router (Extension)
app.use('/api/external', require('./routes/api/externalSubmissionRouter'));

// 🔥 Extension API Router (Presigned URL based)
app.use('/api/extension', require('./routes/api/extensionRouter'));

// 페이지 라우터 등록
const routes = {
  'auth': require('./lib_login/auth'),
  'admin': require('./routes/adminRouter'),
  'board': require('./routes/boardRouter'),
  'nuguritalk': require('./routes/nuguritalkRouter'),
  'teacher': require('./routes/teacherRouter'),
  'machu': require('./routes/machugameRouter'),
  'kinder': require('./routes/kinderRouter'),
  'learning': require('./routes/learningRouter'),
  'report': require('./routes/reportRouter'),
  'onlineclass': require('./routes/onlineclassRouter'),
  'machinelearning': require('./routes/machinelearningRouter'),
  'appinventor': require('./routes/appinventorRouter'),
  'python': require('./routes/pythonRouter'),
  'template': require('./routes/templateRouter'),
  'gallery': require('./routes/galleryRouter'),  // 🔥 갤러리 공유 시스템
  's3': require('./routes/s3Router'),  // 🔥 통합 S3 브라우저
  'subscription': require('./routes/subscriptionRouter')  // 🔥 센터 구독 관리
};

// 🔥 Python 문제은행 API 라우터
app.use('/api/python-problems', authenticateUser, requireEducationAccess, require('./routes/pythonProblemRouter'));
// 🔥 Entry Editor 프록시 설정 (8070 포트)
// /entry_editor 경로를 localhost:8070/ 으로 프록시
app.use('/entry_editor', authenticateUser, requireEducationAccess, createProxyMiddleware({
  target: 'http://localhost:8070',
  changeOrigin: true,
  pathRewrite: {
    '^/entry_editor': '' // /entry_editor 경로 제거 후 전달
  },
  ws: true, // WebSocket 지원
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    // 세션 정보를 헤더로 전달
    if (req.session && req.session.userID) {
      proxyReq.setHeader('X-User-ID', req.session.userID);
      proxyReq.setHeader('X-User-Role', req.session.role || 'guest');
      proxyReq.setHeader('X-Center-ID', req.session.centerID || '');
    }
  }
}));

// 라우터 설정
const entryRouter = require('./routes/entryRouter');
const myUniverseRouter = require('./routes/myUniverseRouter');
const ttsRouter = require('./routes/api/ttsRouter');
app.use('/api', authenticateUser, ttsRouter);

if (isMain || SERVICE_TYPE === 'entry') {
  app.use('/entry', authenticateUser, requireEducationAccess, entryRouter);
}

const entDebugRouter = require('./routes/api/debug/entDebugRouter');
app.use('/api/debug/ent', entDebugRouter);

// 🔥 Quiz Page Router (For Embedding)
app.use('/quiz', authenticateUser, require('./routes/quizPageRouter'));

// 🔥 My Universe 라우터
app.use('/my-universe', authenticateUser, myUniverseRouter);


if (isMain || SERVICE_TYPE === 'appinventor') {
  app.use('/appinventor/editor', createProxyMiddleware({
    target: 'http://localhost:8888',
    changeOrigin: true,
    pathRewrite: { '^/appinventor/editor': '/' },
  }));
}

// 🔥 디버깅: null 라우터 체크
Object.entries(routes).forEach(([path, router]) => {
  if (!router) {
    console.error(`❌ 라우터가 null입니다: ${path}`);
    throw new Error(`라우터 로드 실패: ${path}`);
  }

  if (path === 'auth') {
    app.use(`/${path}`, router);
  } else if (['python', 'machinelearning', 'appinventor'].includes(path)) {
    // 교육 콘텐츠 라우터는 requireEducationAccess 적용
    app.use(`/${path}`, authenticateUser, requireEducationAccess, router);
  } else {
    app.use(`/${path}`, authenticateUser, router);
  }
});

// JSON 파싱 오류 처리
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON 파싱 오류:', err);
    return res.status(400).json({
      error: 'JSON 형식이 잘못되었습니다.',
      details: err.message
    });
  }
  next(err);
});

// API 프록시
app.use('/api/sprite', async (req, res) => {
  try {
    const targetUrl = `https://app.codingnplay.co.kr/entry/api/sprite${req.path}`;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'API 프록시 오류' });
  }
});

const entrySpritesRouter = require('./routes/api/entrySpritesRouter');
app.use('/entry/api/sprite', entrySpritesRouter);

// =====================================================================
// 로그인/로그아웃
// =====================================================================
app.get('/logout', async (req, res) => {
  if (req.session?.userID) {
    try {
      const [user] = await db.queryDatabase(
        'SELECT id, centerID FROM Users WHERE userID = ?',
        [req.session.userID]
      );

      if (user) {
        // 🔥 중복 체크
        const logKey = `logout-${user.id}-${Date.now()}`;
        if (!global.logoutLogs) global.logoutLogs = new Map();

        if (!global.logoutLogs.has(user.id)) {
          await db.queryDatabase(`
            INSERT INTO UserActivityLogs 
            (user_id, center_id, action_type, url, ip_address, user_agent, action_detail, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            user.id,
            user.centerID,
            'GET',
            '/logout',
            req.ip,
            req.headers['user-agent'],
            'User logout',
            'logout'
          ]);

          global.logoutLogs.set(user.id, Date.now());
          setTimeout(() => global.logoutLogs.delete(user.id), 2000);
        }
      }
    } catch (err) {
      console.error('Logout logging error:', err);
    }
  }

  const domain = config.SESSION.COOKIE.getDomain(req);
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('로그아웃 실패');
    }
    res.clearCookie('connect.sid', { domain: domain, path: '/' });
    res.clearCookie('token', { domain: domain, path: '/' });
    res.redirect('/auth/login');
  });
});

// 내 프로필 페이지
app.get('/my-profile', authenticateUser, async (req, res) => {
  try {
    const [student] = await db.queryDatabase(
      'SELECT * FROM Users WHERE userID = ?',
      [req.session.userID]
    );

    if (!student) {
      return res.status(404).send('사용자를 찾을 수 없습니다.');
    }

    const logs = await db.queryDatabase(
      'SELECT * FROM LearningLogs WHERE user_id = ? ORDER BY start_time DESC LIMIT 20',
      [student.id]
    );

    const activityLogs = await db.queryDatabase(
      `SELECT created_at, ip_address, user_agent, url, status 
             FROM UserActivityLogs 
             WHERE user_id = ? AND status IN ('login', 'logout')
             ORDER BY created_at DESC 
             LIMIT 50`,
      [student.id]
    );

    res.render('teacher/student-detail', {
      student,
      logs,
      activityLogs,
      isMyProfile: true
    });

  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).send('오류 발생');
  }
});

// =====================================================================
// 페이지 라우트
// =====================================================================

const pagesUnderConstruction = [];

function checkUnderConstruction(req, res, next) {
  if (pagesUnderConstruction.includes(req.path)) {
    return res.render('under-construction', {
      userID: req.session?.userID,
      userRole: req.session?.role,
      is_logined: req.session?.is_logined,
      centerID: req.session?.centerID
    });
  }
  next();
}

app.use(checkUnderConstruction);

// 🔥 Education Access Denied Page (MyUniverse 통합 플랜 Phase 1)
app.get('/education-access-denied', authenticateUser, (req, res) => {
  res.render('education-access-denied', {
    userID: req.session.userID,
    role: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

// 🔥 Center Suspended Page (Phase 3 - Trial 만료)
app.get('/center-suspended', authenticateUser, (req, res) => {
  res.render('center-suspended', {
    userID: req.session.userID,
    role: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

// 🔥 Observatory 3D Dashboard Route (Moved here to ensure session exists)
app.get('/observatory', authenticateUser, requireEducationAccess, checkPageAccess('/observatory'), (req, res) => {
  res.render('observatory', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

app.get('/entry_project', authenticateUser, requireEducationAccess, checkPageAccess('/entry_project'), (req, res) => {
  res.render('entry_project', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    serviceType: req.serviceType,
    serviceName: res.locals.serviceName
  });
});

// 🔥 Pyodide 테스트 페이지 (/pythontest)
app.get('/pythontest', authenticateUser, requireEducationAccess, checkPageAccess('/python_project'), (req, res) => {
  res.render('template', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageType: 'pythontest',
    serviceType: req.serviceType,
    serviceName: res.locals.serviceName
  });
});

app.get('/computer', authenticateUser, requireEducationAccess, checkPageAccess('/computer'), (req, res) => {
  res.render('computer', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

app.get('/scratch_project', authenticateUser, requireEducationAccess, checkPageAccess('/scratch_project'), (req, res) => {
  res.render('scratch_project', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

app.get('/scratch', authenticateUser, (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  const redirectUrl = query ? `${config.SERVICES.SCRATCH}/?${query}` : config.SERVICES.SCRATCH;
  res.redirect(redirectUrl);
});

// 🔥 Extension Guide Page
app.get('/extension-guide', (req, res) => {
  res.render('extension-guide', {
    role: req.session.role || 'guest',
    userID: req.session.userID || null,
    centerID: req.session.centerID || null
  });
});

// 🔥 COS 문제 이미지 팝업 (여백 없이 전체 화면)
app.get('/cos-problem-popup', (req, res) => {
  const { grade, sample, problem, problems } = req.query;

  if (!grade || !sample || !problem || !problems) {
    return res.status(400).send('필수 파라미터가 없습니다. (grade, sample, problem, problems)');
  }

  // problems JSON 파싱
  let problemsData = {};
  try {
    problemsData = JSON.parse(problems);
  } catch (e) {
    console.error('COS problems JSON 파싱 오류:', e);
    return res.status(400).send('problems 데이터 파싱 오류');
  }

  // 🔥 URL 정규화: /COS/ -> /cos/, /ENT/ -> /ent/ 등
  const normalizeUrl = (url) => {
    if (!url) return '';
    return url.replace(/\/([A-Z]+)\//g, (match, folder) => {
      return '/' + folder.toLowerCase() + '/';
    });
  };

  // problems JSON 내부 URL 정규화
  if (problemsData) {
    Object.keys(problemsData).forEach(key => {
      if (problemsData[key].img) problemsData[key].img = normalizeUrl(problemsData[key].img);
      if (problemsData[key].answer) problemsData[key].answer = normalizeUrl(problemsData[key].answer);
      if (problemsData[key].solution) problemsData[key].solution = normalizeUrl(problemsData[key].solution);
    });
  }

  // 현재 문제 데이터
  const currentProblemData = problemsData[problem] || {};
  const imgUrl = normalizeUrl(currentProblemData.img || '');

  res.render('cos_problem_popup', {
    grade,
    sample,
    problem,
    problems: problemsData,
    imgUrl
  });
});

// 🔥 COS 자격증 문제풀이 에디터 (문제 이미지 + 에디터 분할 화면)
app.get('/cos-editor', authenticateUser, (req, res) => {
  const { platform, grade, sample, problem, buttonType, problems, projectUrl, imgUrl } = req.query;

  if (!platform || !projectUrl) {
    return res.status(400).send('필수 파라미터가 없습니다. (platform, projectUrl)');
  }

  // problems JSON 파싱
  let problemsData = {};
  try {
    if (problems) {
      problemsData = JSON.parse(problems);
    }
  } catch (e) {
    console.error('COS problems JSON 파싱 오류:', e);
  }

  // 🔥 URL 정규화: /COS/ -> /cos/, /ENT/ -> /ent/ 등
  const normalizeUrl = (url) => {
    if (!url) return '';
    return url.replace(/\/([A-Z]+)\//g, (match, folder) => {
      return '/' + folder.toLowerCase() + '/';
    });
  };

  // problems JSON 내부 URL 정규화
  if (problemsData) {
    Object.keys(problemsData).forEach(key => {
      if (problemsData[key].img) problemsData[key].img = normalizeUrl(problemsData[key].img);
      if (problemsData[key].answer) problemsData[key].answer = normalizeUrl(problemsData[key].answer);
      if (problemsData[key].solution) problemsData[key].solution = normalizeUrl(problemsData[key].solution);
    });
  }

  // 사용자 정보
  const userID = req.session.userID || 'guest';
  const userRole = req.session.role || 'guest';

  // 플랫폼별 에디터 URL 생성
  let editorUrl = '';
  if (platform === 'scratch') {
    editorUrl = `/scratch/?project_file=${encodeURIComponent(normalizeUrl(projectUrl))}`;
  } else if (platform === 'entry') {
    // 8070 포트 직접 접근 대신 프록시 경로 사용 (/entry_editor -> localhost:8070)
    editorUrl = `/entry_editor/?s3Url=${encodeURIComponent(normalizeUrl(projectUrl))}&userID=${userID}&role=${userRole}`;
  } else {
    return res.status(400).send('지원하지 않는 플랫폼입니다.');
  }

  res.render('cos_editor', {
    platform: platform,
    grade: grade || '3',
    sample: sample || '1',
    currentProblem: problem || '01',
    buttonType: buttonType || 'solution',
    problems: problemsData,
    editorUrl: editorUrl,
    imgUrl: normalizeUrl(imgUrl) || '',
    userID: userID,
    userRole: userRole,
    entryBaseUrl: '/entry_editor' // 프록시 경로 사용
  });
});

app.get('/appinventor_project', authenticateUser, requireEducationAccess, checkPageAccess('/appinventor_project'), (req, res) => {
  res.render('appinventor_project', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

app.get('/machinelearning', authenticateUser, requireEducationAccess, checkPageAccess('/machinelearning'), (req, res) => {
  res.render('machinelearning', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

app.get('/python_project', authenticateUser, requireEducationAccess, checkPageAccess('/python_project'), (req, res) => {
  res.render('template', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageType: 'python'
  });
});

app.get('/algorithm', authenticateUser, requireEducationAccess, checkPageAccess('/algorithm'), (req, res) => {
  res.render('template', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageType: 'algorithm'
  });
});

app.get('/certification', authenticateUser, requireEducationAccess, checkPageAccess('/certification'), (req, res) => {
  res.render('template', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageType: 'certification'
  });
});

app.get('/aiMath', authenticateUser, requireEducationAccess, checkPageAccess('/aiMath'), (req, res) => {
  res.render('template', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageType: 'aiMath'
  });
});

app.get('/dataAnalysis', authenticateUser, requireEducationAccess, checkPageAccess('/dataAnalysis'), (req, res) => {
  res.render('template', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageType: 'dataAnalysis'
  });
});

app.get('/debug-page-type/:pageType', authenticateUser, (req, res) => {
  const pageType = req.params.pageType;
  const allowedPageTypes = ['certification', 'python', 'algorithm', 'aiMath', 'template'];

  if (!allowedPageTypes.includes(pageType)) {
    return res.status(400).json({
      error: '지원하지 않는 페이지 타입입니다.',
      allowedTypes: allowedPageTypes
    });
  }

  res.render('template', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    pageType: pageType
  });
});

const quizRouter = require('./routes/api/quizRouter');
app.use('/api/quiz', quizRouter);

const templateRouter = require('./routes/templateRouter');
app.use('/template', authenticateUser, templateRouter);

const portfolioRouter = require('./routes/portfolioRouter');
app.use('/portfolio', authenticateUser, portfolioRouter);

app.use('/novnc', express.static(path.join(__dirname, 'node_modules', 'novnc')));

const portManager = require('./lib_portfolio/port-manager');
setInterval(async () => {
  try {
    await portManager.cleanupOldAllocations();
  } catch (error) {
    console.error('포트 정리 중 오류:', error);
  }
}, 5 * 60 * 1000);

app.get('/teacher', authenticateUser, (req, res) => {
  res.render('teacher', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID
  });
});

// 루트 경로
app.get('/', (req, res) => {
  if (!req.session?.is_logined) {
    return res.redirect('/auth/login');
  }

  res.render('index', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    serviceType: req.serviceType,
    serviceName: res.locals.serviceName
  });
});

app.get('/debug-session', (req, res) => {
  res.json({
    session: {
      userID: req.session?.userID,
      role: req.session?.role,
      is_logined: req.session?.is_logined,
      userType: req.session?.userType,
      centerID: req.session?.centerID
    }
  });
});

// =====================================================================
// Cron Jobs - 통합 일일 정리 작업
// =====================================================================

// 🔥 통합 일일 정리: S3 temp 파일, ENT 파일, Entry 에셋, 구독 상태
// 매일 새벽 2시 실행 (서버 부하 최소화)
if (isMain) {
  const { runDailyCleanup } = require('./scripts/dailyCleanup');

  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🧹 일일 정리 작업 시작 (통합 Cron)');
      const result = await runDailyCleanup();

      if (result.success) {
        console.log(`✅ 일일 정리 작업 완료 (소요 시간: ${Math.floor(result.duration / 1000)}초)`);
      } else {
        console.error('⚠️ 일일 정리 작업 중 일부 오류 발생');
      }
    } catch (error) {
      console.error('❌ 일일 정리 작업 실패:', error);
    }
  });

  console.log('✅ 통합 일일 정리 Cron 등록 완료 (매일 새벽 2시)');

  // 🔥 Trial 만료 처리 Cron Job (Phase 3)
  const { startTrialExpiryCron } = require('./lib_cron/trialExpiryCron');
  startTrialExpiryCron();

  // 🔥 구독 자동 갱신 Cron Job (Phase 4)
  const { startSubscriptionRenewalCron } = require('./lib_cron/subscriptionRenewalCron');
  startSubscriptionRenewalCron();
}

app.get('/api/ws/proxy/:port', (req, res) => {
  res.status(200).send('WebSocket 프록시 엔드포인트');
});

app.get('/api/generate-metadata-direct', async (req, res) => {
  try {
    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const S3_BUCKET = process.env.S3_BUCKET_NAME || 'educodingnplaycontents';

    const listParams = {
      Bucket: S3_BUCKET,
      Prefix: 'ent/uploads/images/',
      MaxKeys: 1000
    };

    const listCommand = new ListObjectsV2Command(listParams);
    const listResult = await s3Client.send(listCommand);

    const metadata = {
      version: "2.0",
      lastUpdated: new Date().toISOString().split('T')[0],
      totalAssets: 0,
      baseUrl: `${config.S3.ASSET_URL}/ent/uploads`,
      categories: [
        { id: "entrybot_friends", name: "엔트리봇", visible: true },
        { id: "animal", name: "동물", visible: true },
        { id: "thing", name: "사물", visible: true },
        { id: "background", name: "배경", visible: true },
        { id: "characters", name: "캐릭터", visible: true },
        { id: "other", name: "기타", visible: true }
      ],
      sprites: {}
    };

    if (listResult.Contents && listResult.Contents.length > 0) {
      for (const object of listResult.Contents) {
        if (!object.Key.endsWith('/')) {
          const filename = path.basename(object.Key);
          const ext = path.extname(filename).toLowerCase();

          if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
            const baseName = path.parse(filename).name;
            const spriteId = baseName.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_');

            let category = 'other';
            const name = filename.toLowerCase();
            if (name.includes('entrybot')) category = 'entrybot_friends';
            else if (name.includes('ani_')) category = 'animal';
            else if (name.includes('entry_icon') || name.includes('button') || name.includes('block')) category = 'thing';
            else if (name.includes('entry_bg') || name.includes('workspace')) category = 'background';
            else category = 'characters';

            let spriteName = baseName;
            if (name.includes('entrybot')) spriteName = '엔트리봇';
            else if (name.includes('ani_')) spriteName = '동물';
            else if (name.includes('entry_icon')) spriteName = '아이콘';
            else if (name.includes('button')) spriteName = '버튼';
            else if (name.includes('entry_bg')) spriteName = '배경';

            metadata.sprites[spriteId] = {
              id: spriteId,
              name: spriteName,
              category: category,
              label: { ko: spriteName, en: baseName },
              pictures: [{
                id: `${spriteId}_pic1`,
                name: spriteName,
                filename: filename,
                imageType: ext.substring(1),
                dimension: { width: 80, height: 80 },
                scale: 100,
                fileurl: `${config.S3.ASSET_URL}/ent/uploads/images/${filename}`
              }],
              sounds: []
            };

            metadata.totalAssets++;
          }
        }
      }
    }

    fs.writeFileSync('metadata.json', JSON.stringify(metadata, null, 2), 'utf8');

    res.json({
      success: true,
      message: '메타데이터가 성공적으로 생성되었습니다!',
      totalAssets: metadata.totalAssets,
      filesFound: listResult.Contents?.length || 0,
      oldAssets: 3,
      newAssets: metadata.totalAssets
    });

  } catch (error) {
    console.error('메타데이터 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

// =====================================================================
// 캐치올 라우트
// =====================================================================

app.get('*', (req, res, next) => {
  const reqPath = req.path.toLowerCase();

  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.html', '.json',
    '.xml', '.txt', '.zip', '.mp3', '.mp4', '.wav', '.avi'
  ];

  const staticPaths = [
    '/js/', '/css/', '/resource/', '/node_modules/', '/uploads/',
    '/images/', '/fonts/', '/assets/', '/public/', '/static/'
  ];

  const isStaticFile = staticExtensions.some(ext => reqPath.endsWith(ext));
  const isStaticPath = staticPaths.some(staticPath => reqPath.startsWith(staticPath));
  const isApiRequest = reqPath.startsWith('/api/');

  // 🔥 S3 라우터 예외 처리
  const isS3Route = reqPath.startsWith('/s3/');

  if (isStaticFile || isStaticPath) {
    return res.status(404).send('File not found');
  }

  if (isApiRequest) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // 🔥 S3 경로는 404 반환 (라우터에서 처리)
  if (isS3Route) {
    console.log('❌ S3 라우트 처리 실패:', reqPath);
    return res.status(404).json({ error: 'S3 route not found' });
  }

  if (!req.session || !req.session.is_logined) {
    return res.redirect('/auth/login');
  }

  res.render('index', {
    userID: req.session.userID,
    userRole: req.session.role,
    is_logined: req.session.is_logined,
    centerID: req.session.centerID,
    serviceType: req.serviceType,
    serviceName: res.locals.serviceName
  });
});

// 오류 처리 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 관리자용 임시 파일 API
app.get('/api/admin/temp-files/stats', checkAdminRole, async (req, res) => {
  try {
    const stats = await tempFileCleanup.getTempFileStats();
    res.json({ success: true, stats: stats });
  } catch (error) {
    console.error('임시 파일 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '임시 파일 통계를 불러오는 중 오류가 발생했습니다.'
    });
  }
});

app.post('/api/admin/temp-files/cleanup', checkAdminRole, async (req, res) => {
  try {
    const result = await tempFileCleanup.cleanupTempFiles();
    res.json({ success: true, result: result });
  } catch (error) {
    console.error('수동 임시 파일 정리 오류:', error);
    res.status(500).json({
      success: false,
      error: '임시 파일 정리 중 오류가 발생했습니다.'
    });
  }
});

// 🔥 기존 개별 S3 temp 정리 cron은 통합 dailyCleanup으로 대체되었습니다.
// 위의 "통합 일일 정리 Cron"을 참고하세요.

// 서버 시작
const PORT = Number(process.env.PORT);

if (!PORT) {
  console.error('❌ PORT 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// 🔥 Database Migration: Drop Invalid FKs
(async () => {
  try {
    const invalidConstraints = [
      { table: 'LearningLogs', constraint: 'LearningLogs_ibfk_2' },
      { table: 'MenuAccessLogs', constraint: 'MenuAccessLogs_ibfk_2' },
      { table: 'UserActivityLogs', constraint: 'UserActivityLogs_ibfk_2' } // Prevent future errors
    ];

    for (const item of invalidConstraints) {
      const result = await db.queryDatabase(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
         WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND TABLE_SCHEMA = DATABASE()`,
        [item.table, item.constraint]
      );

      if (result && result.length > 0) {
        console.log(`🚧 Fixing DB: Dropping invalid FK ${item.constraint} from ${item.table}...`);
        await db.queryDatabase(`ALTER TABLE ${item.table} DROP FOREIGN KEY ${item.constraint}`);
        console.log(`✅ DB Fix Complete: ${item.constraint} dropped.`);
      }
    }
  } catch (err) {
    console.error('❌ DB Fix Error:', err.message);
  }
})();

const server = app.listen(PORT, () => {
  console.log(`✅ 서버 실행`);
  console.log(`   - PORT: ${PORT}`);
  console.log(`   - ENV: ${process.env.NODE_ENV}`);
});

// 🔥 Socket.io 초기화
try {
  const { initSocket } = require('./lib_nuguri/socketHandler');
  initSocket(server);
} catch (err) {
  console.error('❌ Socket.io 초기화 실패:', err);
}

// 🔥 우아한 종료 (Graceful Shutdown) - PM2 재시작 시 포트 점유 문제 예방
// 활성 소켓 추적
const sockets = new Set();

server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => {
    sockets.delete(socket);
  });
});

const shutdown = (signal) => {
  console.log(`${signal} 시그널 수신: 서버를 안전하게 종료합니다...`);

  // 1. 더 이상 새로운 연결을 받지 않음
  server.close(() => {
    console.log('⚡ 모든 HTTP 연결이 닫혔습니다.');

    // Redis 정리
    if (redisClient && redisClient.isOpen) {
      redisClient.quit();
      console.log('⚡ Redis 연결 해제됨');
    }

    process.exit(0);
  });

  // 2. 기존 연결 강제 종료 (빠른 재시작을 위해)
  if (sockets.size > 0) {
    console.log(`🔌 남은 소켓 ${sockets.size}개 강제 종료 중...`);
    for (const socket of sockets) {
      socket.destroy();
      sockets.delete(socket);
    }
  }

  // 10초 후 강제 종료 (타임아웃은 PM2 kill_timeout보다 짧아야 안전함)
  setTimeout(() => {
    console.error('⚠️ 강제 종료: 연결 종료 시간 초과');
    process.exit(1);
  }, 8000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
