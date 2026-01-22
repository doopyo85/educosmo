require('dotenv').config();

// 기본 URL 설정
const BASE_URL = process.env.BASE_URL || 'https://app.codingnplay.co.kr';

// 서버 설정
const SERVER = {
  PORT: parseInt(process.env.PORT || '3000'),
  ENV: process.env.NODE_ENV || 'development',
  PRODUCTION: process.env.NODE_ENV === 'production',
};

// Redis 설정
const REDIS = {
  URL: process.env.REDIS_URL || 'redis://localhost:6379',
  PREFIX: process.env.REDIS_PREFIX || 'educodingnplay:sess:',
};

// 🔥 세션 설정 - 두 도메인 지원 (올바른 방법)
const SESSION = {
  SECRET: process.env.EXPRESS_SESSION_SECRET || 'your_fallback_secret',
  COOKIE: {
    MAX_AGE: parseInt(process.env.SESSION_MAX_AGE || (60 * 60 * 1000).toString()), // 기본값 1시간
    // 🔥 두 도메인 모두 지원하는 동적 도메인 함수 (오류 방지)
    getDomain: (req) => {
      const host = req.get('host') || req.hostname || '';
      if (typeof host === 'string') {
        if (host.includes('cosmoedu.co.kr')) return '.cosmoedu.co.kr';
        if (host.includes('codingnplay.co.kr')) return '.codingnplay.co.kr';
      }
      return undefined; // IP 접속이나 localhost 등은 자동 처리
    },
  },
};

// JWT 설정
const JWT = {
  SECRET: process.env.JWT_SECRET || 'your_jwt_secret',
  EXPIRES_IN: process.env.JWT_EXPIRES_IN || '3h',  // 3시간으로 변경
};

// 외부 API 엔드포인트
const API_ENDPOINTS = {
  GOOGLE_SHEETS: 'https://sheets.googleapis.com',
  S3_BUCKET: 'https://kr.object.ncloudstorage.com/educodingnplaycontents',
};

// S3 설정
const S3 = {
  REGION: process.env.AWS_REGION || 'ap-northeast-2',
  BUCKET_NAME: process.env.BUCKET_NAME || 'educodingnplaycontents',

  // 🔥 NCP Global Edge URL (CORS 자동 지원)
  // Edge 원본 경로: /educodingnplaycontents 설정되어 있음
  ASSET_URL: process.env.S3_ASSET_URL || 'https://onag54aw13447.edge.naverncp.com',

  // 🔥 NCP Direct URL (Object Storage 직접 접근)
  DIRECT_URL: process.env.S3_DIRECT_URL || 'https://kr.object.ncloudstorage.com/educodingnplaycontents',

  // 프록시 URL (백업용)
  PROXY_URL: '/proxy/content',

  // 🔥 Legacy URL 매핑 (AWS S3 → NCP 자동 변환용)
  LEGACY_URLS: [
    'https://educodingnplaycontents.s3.amazonaws.com',
    'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com',
    'http://educodingnplaycontents.s3.amazonaws.com',
    'http://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com'
  ],

  // 🔥 URL 변환 함수 (AWS/NCP → 현재 사용 중인 Storage로 변환)
  convertStorageUrl: (url) => {
    if (!url || typeof url !== 'string') return url;

    let convertedUrl = url;

    // Legacy AWS S3 URL → NCP Direct URL로 변환
    S3.LEGACY_URLS.forEach(legacyUrl => {
      if (convertedUrl.includes(legacyUrl)) {
        convertedUrl = convertedUrl.replace(legacyUrl, S3.DIRECT_URL);
      }
    });

    // NCP Edge URL → NCP Direct URL로 변환 (일관성)
    if (convertedUrl.includes('onag54aw13447.edge.naverncp.com')) {
      convertedUrl = convertedUrl.replace(
        'https://onag54aw13447.edge.naverncp.com',
        S3.DIRECT_URL
      );
    }

    return convertedUrl;
  },

  // 🔥 NCP Object Storage SDK 설정
  NCP: {
    ENDPOINT: process.env.NCP_ENDPOINT || 'https://kr.object.ncloudstorage.com',
    ACCESS_KEY: process.env.NCP_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
    SECRET_KEY: process.env.NCP_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    REGION: 'kr-standard',

    // Jupyter 사용자 폴더 경로 생성
    getUserPath: (userID) => {
      return `users/${userID}/jupyter/`;
    },

    // Jupyter 노트북 파일 경로 생성
    getNotebookPath: (userID, fileName) => {
      return `users/${userID}/jupyter/${fileName}`;
    }
  }
};

// Google API 설정
const GOOGLE_API = {
  KEY: process.env.GOOGLE_API_KEY,
  SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  DISCOVERY_DOCS: [process.env.DISCOVERY_DOCS || 'https://sheets.googleapis.com/$discovery/rest?version=v4'],
};

// 🔥 CORS 설정 확장 - cosmoedu 도메인 추가
const CORS = {
  ALLOWED_ORIGINS: [
    // 기존 codingnplay 도메인들
    'https://codingnplay.co.kr',
    'https://www.codingnplay.co.kr',
    'https://app.codingnplay.co.kr',
    'http://codingnplay.co.kr',
    'http://www.codingnplay.co.kr',
    'http://app.codingnplay.co.kr',

    // 🔥 신규 cosmoedu 도메인들 추가
    'https://cosmoedu.co.kr',
    'https://www.cosmoedu.co.kr',
    'https://app.cosmoedu.co.kr',
    'http://cosmoedu.co.kr',
    'http://www.cosmoedu.co.kr',
    'http://app.cosmoedu.co.kr',

    // 🔥 Pong2 App
    'https://pong2.app',
    'https://www.pong2.app',
    'https://blog.pong2.app', // Blog Domain

    // 🔥 Blog Domains
    'https://blog.app.codingnplay.co.kr',
    'http://blog.app.codingnplay.co.kr',

    // 🔥 Server IP (Direct Access)
    'http://101.79.11.188',
    'http://101.79.11.188:3000',

    undefined  // 같은 origin 요청 허용
  ],
};

// CSP(Content-Security-Policy) 설정 - CKEditor 지원 추가
const CSP = {
  DEFAULT_SRC: ["'self'"],
  FONT_SRC: ["'self'", "data:", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
  SCRIPT_SRC: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://apis.google.com",
    "https://code.jquery.com",
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
    "https://cdnjs.cloudflare.com",
    "https://playentry.org",
    "https://pyscript.net",
    "https://www.gstatic.com",
    "https://polyfill.io",
    "https://cdn.ckeditor.com",  // 🔥 CKEditor 추가
    "https://entry-cdn.pstatic.net",  // 🔥 EntryJS CDN 추가
    // 🔥 EntryJS 추가 도메인
    "https://learning.playentry.org",
    "https://api.playentry.org",
    "https://www.playentry.org",
    "https://nstatic.playentry.org",
    "https://aiblock.playentry.org"
  ],
  STYLE_SRC: [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://playentry.org",
    "https://pyscript.net",
    "https://cdn.ckeditor.com",  // 🔥 CKEditor CSS 추가
    "https://entry-cdn.pstatic.net",  // 🔥 EntryJS CSS 추가
    // 🔥 EntryJS CSS 추가 도메인
    "https://learning.playentry.org",
    "https://api.playentry.org",
    "https://www.playentry.org",
    "https://nstatic.playentry.org"
  ],
  IMG_SRC: [
    "'self'",
    "data:",
    "blob:",
    "https://kr.object.ncloudstorage.com", // 🔥 NCP Object Storage 추가
    "https://onag54aw13447.edge.naverncp.com", // 🔥 NCP Global Edge 추가
    "https://www.google.com",
    "https://code.org",
    "https://blockly.games",
    "https://playentry.org",
    "https://cdn.ckeditor.com",  // 🔥 CKEditor 이미지 추가
    "https://entry-cdn.pstatic.net",
    // 🔥 EntryJS 이미지 도메인
    "https://learning.playentry.org",
    "https://api.playentry.org",
    "https://www.playentry.org",
    "https://nstatic.playentry.org",
    "https://aiblock.playentry.org",
    // 🔥 YouTube & Google Drive Images
    "https://img.youtube.com",
    "https://i.ytimg.com",
    "https://drive.google.com",
    "https://lh3.googleusercontent.com",
    "https://docs.google.com"
  ],
  CONNECT_SRC: [
    "'self'",
    "https://apis.google.com",
    "https://content-sheets.googleapis.com",
    "https://kr.object.ncloudstorage.com", // 🔥 NCP Object Storage 추가
    "https://onag54aw13447.edge.naverncp.com", // 🔥 NCP Global Edge 추가
    "https://www.google.com",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://playentry.org",
    "https://firestore.googleapis.com",
    "https://firebase-api.com",
    "https://cdn.ckeditor.com",  // 🔥 CKEditor 연결 추가
    "https://entry-cdn.pstatic.net",  // 🔥 EntryJS 연결 추가
    // 🔥 EntryJS WebSocket 및 추가 도메인
    "wss:",
    "ws:",
    "https://learning.playentry.org",
    "wss://learning.playentry.org",
    "https://api.playentry.org",
    "https://www.playentry.org",
    "https://nstatic.playentry.org",
    "https://aiblock.playentry.org"
  ],
  FRAME_SRC: [
    "'self'",
    "https://docs.google.com",
    "https://sheets.googleapis.com",
    "https://content-sheets.googleapis.com",
    "https://kr.object.ncloudstorage.com", // 🔥 NCP Object Storage 추가
    "https://onag54aw13447.edge.naverncp.com", // 🔥 NCP Global Edge 추가
    // codingnplay 도메인들
    "https://app.codingnplay.co.kr:8070",
    "https://app.codingnplay.co.kr:8080",
    "https://app.codingnplay.co.kr:8888",
    "https://app.codingnplay.co.kr:8889",
    "https://app.codingnplay.co.kr",
    "https://app.codingnplay.co.kr:6080",
    "http://app.codingnplay.co.kr:6080",
    "https://app.codingnplay.co.kr:6080",
    "http://app.codingnplay.co.kr:6080",
    "https://app.codingnplay.co.kr/report/",
    "https://blog.app.codingnplay.co.kr", // Blog Frame
    "https://blog.pong2.app", // Blog Frame
    // 🔥 cosmoedu 도메인들 추가
    "https://app.cosmoedu.co.kr:8070",
    "https://app.cosmoedu.co.kr:8080",
    "https://app.cosmoedu.co.kr:8888",
    "https://app.cosmoedu.co.kr:8889",
    "https://app.cosmoedu.co.kr",
    "https://app.cosmoedu.co.kr:6080",
    "http://app.cosmoedu.co.kr:6080",
    "https://app.cosmoedu.co.kr/report/",
    // 공통
    "http://localhost:6080",
    "http://localhost:8888",
    "http://localhost:8889",
    "https://playentry.org",
    "https://pyscript.net",
    // 🔥 YouTube Embed
    "https://www.youtube.com",
    "https://youtube.com"
  ],
  WORKER_SRC: ["'self'", "blob:"],
  OBJECT_SRC: ["'none'"],
};

// 🔥 서비스 타입 정의 추가
const SERVICE_TYPES = {
  CODINGNPLAY: 'codingnplay',
  COSMOEDU: 'cosmoedu'
};

// 사용자 역할 정의
const Roles = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  MANAGER: 'manager',
  STUDENT: 'student',
  KINDER: 'kinder',
  SCHOOL: 'school',
  GUEST: 'guest',
};

// 서비스 포트 설정
const SERVICES = {
  SCRATCH: `${BASE_URL}:8601`,
  ENTRY: `${BASE_URL}:8070`,
  APPINVENTOR: `${BASE_URL}:8888`,
  APPINVENTOR: `${BASE_URL}:8888`,
  JUPYTER: `${BASE_URL}:8889`,
  BLOG: `${BASE_URL}:3001`, // Blog Server
};

// 크론 작업 설정
const CRON = {
  SUBSCRIPTION_UPDATE: '0 0 * * *', // 매일 자정
};

// 🔥 서비스 감지 함수 추가 (오류 방지 강화)
const getServiceType = (req) => {
  const host = req.get('host') || req.hostname || '';

  // host가 문자열인지 확인 후 includes 사용
  if (typeof host === 'string' && host.includes('cosmoedu.co.kr')) {
    return SERVICE_TYPES.COSMOEDU;
  }
  return SERVICE_TYPES.CODINGNPLAY;
};

// 설정 내보내기
module.exports = {
  BASE_URL,
  SERVER,
  REDIS,
  SESSION,
  JWT,
  API_ENDPOINTS,
  S3,
  GOOGLE_API,
  CORS,
  CSP,
  SERVICE_TYPES,
  Roles,
  SERVICES,
  CRON,
  getServiceType,

  // 전체 CSP 문자열 생성 함수
  getCSPString: () => {
    return Object.entries(CSP)
      .map(([key, values]) => {
        // CSP 키를 HTTP 헤더 형식으로 변환 (예: DEFAULT_SRC -> default-src)
        const directive = key.replace(/_/g, '-').toLowerCase();
        return `${directive} ${values.join(' ')}`;
      })
      .join('; ');
  }
};
