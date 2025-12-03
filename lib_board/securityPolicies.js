/**
 * 게시판 파일 업로드 보안 정책 설정
 * 
 * 이 파일은 파일 업로드 시 적용되는 모든 보안 정책을 정의합니다.
 * - 파일 타입 제한
 * - 크기 제한
 * - 사용자별 제한
 * - 시간별 제한
 */

// 전역 파일 업로드 제한
const GLOBAL_LIMITS = {
    MAX_FILES_PER_POST: 10,           // 게시글당 최대 첨부파일 수
    MAX_TOTAL_SIZE_PER_POST: 200 * 1024 * 1024,  // 게시글당 총 용량 (200MB)
    MAX_FILES_PER_HOUR: 50,           // 사용자당 시간당 최대 업로드 파일 수
    MAX_SIZE_PER_HOUR: 500 * 1024 * 1024,        // 사용자당 시간당 최대 업로드 용량 (500MB)
    MAX_FILES_PER_DAY: 200,           // 사용자당 일일 최대 업로드 파일 수
    MAX_SIZE_PER_DAY: 2 * 1024 * 1024 * 1024     // 사용자당 일일 최대 업로드 용량 (2GB)
};

// 파일 타입별 상세 정책
const FILE_TYPE_POLICIES = {
    image: {
        allowedMimes: [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/webp', 'image/bmp', 'image/tiff'
        ],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
        maxSize: 10 * 1024 * 1024,        // 10MB
        maxDimensions: { width: 4096, height: 4096 },  // 최대 해상도
        autoOptimize: true,               // 자동 최적화 적용
        generateThumbnail: true,          // 썸네일 자동 생성
        description: '이미지 파일 (JPG, PNG, GIF, WebP 등)'
    },
    document: {
        allowedMimes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain'
        ],
        allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
        maxSize: 50 * 1024 * 1024,        // 50MB
        autoOptimize: false,
        generateThumbnail: false,
        description: '문서 파일 (PDF, Word, Excel, PowerPoint 등)'
    },
    archive: {
        allowedMimes: [
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/gzip',
            'application/x-tar'
        ],
        allowedExtensions: ['.zip', '.rar', '.7z', '.gz', '.tar'],
        maxSize: 100 * 1024 * 1024,       // 100MB
        autoOptimize: false,
        generateThumbnail: false,
        description: '압축 파일 (ZIP, RAR, 7Z 등)'
    },
    code: {
        allowedMimes: [
            'text/plain',
            'text/javascript',
            'text/html',
            'text/css',
            'application/json',
            'text/xml'
        ],
        allowedExtensions: ['.txt', '.js', '.html', '.css', '.json', '.xml', '.py', '.java', '.cpp', '.c'],
        maxSize: 5 * 1024 * 1024,         // 5MB
        autoOptimize: false,
        generateThumbnail: false,
        description: '코드 파일 (JS, HTML, CSS, Python 등)'
    }
};

// 금지된 파일 형식 (보안 위험)
const FORBIDDEN_FILES = {
    extensions: [
        '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe',
        '.js', '.jse', '.jar', '.class', '.dex', '.apk', '.ipa',
        '.php', '.asp', '.aspx', '.jsp', '.cfm', '.cgi', '.pl',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1',
        '.msi', '.deb', '.rpm', '.dmg', '.pkg', '.app',
        '.dll', '.so', '.dylib', '.sys', '.drv'
    ],
    mimes: [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-dosexec',
        'application/java-archive',
        'application/x-java-archive'
    ],
    patterns: [
        /\.php\d*$/i,           // .php, .php3, .php4, .php5 등
        /\.asp\w*$/i,           // .asp, .aspx 등
        /\.jsp\w*$/i,           // .jsp, .jspx 등
        /\.(sh|bash|zsh)$/i     // 쉘 스크립트
    ],
    description: '실행 파일 및 스크립트 파일은 보안상 업로드할 수 없습니다.'
};

// 역할별 업로드 권한
const ROLE_PERMISSIONS = {
    student: {
        maxFileSize: 10 * 1024 * 1024,    // 10MB
        maxFilesPerPost: 5,
        allowedCategories: ['free'],
        allowedFileTypes: ['image', 'document'],
        dailyUploadLimit: 50 * 1024 * 1024  // 50MB/일
    },
    teacher: {
        maxFileSize: 50 * 1024 * 1024,    // 50MB
        maxFilesPerPost: 10,
        allowedCategories: ['free', 'education'],
        allowedFileTypes: ['image', 'document', 'archive', 'code'],
        dailyUploadLimit: 200 * 1024 * 1024  // 200MB/일
    },
    manager: {
        maxFileSize: 100 * 1024 * 1024,   // 100MB
        maxFilesPerPost: 15,
        allowedCategories: ['free', 'education', 'notice'],
        allowedFileTypes: ['image', 'document', 'archive', 'code'],
        dailyUploadLimit: 500 * 1024 * 1024  // 500MB/일
    },
    admin: {
        maxFileSize: 200 * 1024 * 1024,   // 200MB
        maxFilesPerPost: 20,
        allowedCategories: ['free', 'education', 'notice'],
        allowedFileTypes: ['image', 'document', 'archive', 'code'],
        dailyUploadLimit: 1024 * 1024 * 1024  // 1GB/일
    }
};

// 파일명 보안 정책
const FILENAME_POLICIES = {
    maxLength: 255,
    minLength: 1,
    forbiddenChars: /[<>:"/\\|?*\x00-\x1f]/g,
    forbiddenNames: [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ],
    forbiddenPrefixes: ['.', '..', '~'],
    allowedCharsets: /^[\w\-\.\s\(\)\[\]가-힣ㄱ-ㅎㅏ-ㅣ一-龯]+$/
};

// 내용 스캔 정책 (바이러스/악성코드 감지)
const CONTENT_SCAN_POLICIES = {
    enableVirusScan: false,              // 바이러스 스캔 활성화 (추후 구현)
    enableContentScan: true,             // 파일 내용 스캔
    suspiciousPatterns: [
        /<script\s*>/i,                  // HTML 스크립트 태그
        /javascript:/i,                   // 자바스크립트 프로토콜
        /vbscript:/i,                    // VBScript 프로토콜
        /onload\s*=/i,                   // 이벤트 핸들러
        /onerror\s*=/i,
        /onclick\s*=/i
    ],
    maxScanSize: 10 * 1024 * 1024,      // 스캔할 최대 파일 크기 (10MB)
    scanTimeout: 30000                   // 스캔 타임아웃 (30초)
};

// IP 기반 업로드 제한
const IP_RATE_LIMITS = {
    enabled: true,
    maxUploadsPerMinute: 10,             // IP당 분당 최대 업로드 수
    maxUploadsPerHour: 100,              // IP당 시간당 최대 업로드 수
    banDuration: 60 * 60 * 1000,         // 제한 시 차단 시간 (1시간)
    whitelist: [],                       // 제한 제외 IP 목록
    blacklist: []                        // 차단된 IP 목록
};

// 임시 파일 정리 정책
const TEMP_FILE_POLICIES = {
    maxAge: 24 * 60 * 60 * 1000,        // 임시 파일 최대 보관 시간 (24시간)
    cleanupInterval: 60 * 60 * 1000,     // 정리 작업 간격 (1시간)
    maxTempFiles: 1000,                  // 최대 임시 파일 수
    enableAutoCleanup: true              // 자동 정리 활성화
};

module.exports = {
    GLOBAL_LIMITS,
    FILE_TYPE_POLICIES,
    FORBIDDEN_FILES,
    ROLE_PERMISSIONS,
    FILENAME_POLICIES,
    CONTENT_SCAN_POLICIES,
    IP_RATE_LIMITS,
    TEMP_FILE_POLICIES
};
