/**
 * 🔥 통합 스토리지 정책 관리
 * 파일 업로드 제한, 용량 정책, 허용 확장자 등 정의
 */

// =====================================================
// 📋 플랜별 용량 정책 (bytes)
// =====================================================
const STORAGE_PLANS = {
    free: {
        name: 'Free',
        userLimit: 500 * 1024 * 1024,      // 500MB per user
        centerLimit: 10 * 1024 * 1024 * 1024, // 10GB per center
        monthlyPrice: 0
    },
    basic: {
        name: 'Basic',
        userLimit: 2 * 1024 * 1024 * 1024,    // 2GB per user
        centerLimit: 50 * 1024 * 1024 * 1024, // 50GB per center
        monthlyPrice: 9900
    },
    pro: {
        name: 'Pro',
        userLimit: 5 * 1024 * 1024 * 1024,     // 5GB per user
        centerLimit: 200 * 1024 * 1024 * 1024, // 200GB per center
        monthlyPrice: 29900
    },
    enterprise: {
        name: 'Enterprise',
        userLimit: null,  // 무제한
        centerLimit: 1024 * 1024 * 1024 * 1024, // 1TB per center
        monthlyPrice: null // 별도 협의
    }
};

// =====================================================
// 📁 파일 카테고리별 설정
// =====================================================
const FILE_CATEGORIES = {
    entry: {
        name: '엔트리',
        folder: 'entry',
        maxFileSize: 20 * 1024 * 1024, // 20MB
        allowedExtensions: ['ent']
    },
    scratch: {
        name: '스크래치',
        folder: 'scratch',
        maxFileSize: 20 * 1024 * 1024, // 20MB
        allowedExtensions: ['sb3', 'sb2', 'sb']
    },
    python: {
        name: '파이썬',
        folder: 'python',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['py', 'ipynb']
    },
    appinventor: {
        name: '앱인벤터',
        folder: 'appinventor',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: ['aia', 'apk']
    },
    gallery: {
        name: '갤러리',
        folder: 'gallery',
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
    },
    board: {
        name: '게시판',
        folder: 'board',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedExtensions: null // 아래 ALLOWED_EXTENSIONS 참조
    }
};

// =====================================================
// 📎 허용/차단 확장자 정책
// =====================================================
const ALLOWED_EXTENSIONS = {
    // 이미지
    image: {
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'],
        maxSize: 10 * 1024 * 1024,  // 10MB
        mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/bmp']
    },
    // 문서
    document: {
        extensions: ['pdf', 'doc', 'docx', 'hwp', 'hwpx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp'],
        maxSize: 50 * 1024 * 1024,  // 50MB
        mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/haansofthwp',
            'application/x-hwp',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/markdown'
        ]
    },
    // 프로젝트 파일
    project: {
        extensions: ['ent', 'sb3', 'sb2', 'sb', 'aia', 'py', 'ipynb', 'json'],
        maxSize: 50 * 1024 * 1024,  // 50MB
        mimeTypes: ['application/json', 'text/x-python', 'application/x-python-code']
    },
    // 압축 파일
    archive: {
        extensions: ['zip', 'rar', '7z', 'tar', 'gz'],
        maxSize: 100 * 1024 * 1024,  // 100MB
        mimeTypes: [
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip'
        ]
    },
    // 미디어 (제한적)
    media: {
        extensions: ['mp3', 'wav', 'mp4', 'webm', 'ogg'],
        maxSize: 100 * 1024 * 1024,  // 100MB
        mimeTypes: [
            'audio/mpeg',
            'audio/wav',
            'video/mp4',
            'video/webm',
            'audio/ogg'
        ]
    }
};

// 🚫 절대 차단 확장자 (보안)
const BLOCKED_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'sh', 'bash', 'ps1',  // 실행 파일
    'dll', 'so', 'dylib',                      // 라이브러리
    'js', 'vbs', 'wsf', 'wsh',                 // 스크립트 (단독)
    'php', 'asp', 'aspx', 'jsp', 'cgi',        // 서버 스크립트
    'msi', 'dmg', 'pkg', 'deb', 'rpm',         // 설치 파일
    'scr', 'pif', 'com',                       // 위험 파일
    'hta', 'jar', 'jnlp'                       // 실행 가능
];

// =====================================================
// 🔧 헬퍼 함수들
// =====================================================

/**
 * 확장자로 파일 타입 카테고리 찾기
 */
function getFileTypeByExtension(extension) {
    const ext = extension.toLowerCase().replace('.', '');
    
    for (const [category, config] of Object.entries(ALLOWED_EXTENSIONS)) {
        if (config.extensions.includes(ext)) {
            return {
                category,
                ...config
            };
        }
    }
    return null;
}

/**
 * 확장자가 허용되는지 확인
 */
function isExtensionAllowed(extension) {
    const ext = extension.toLowerCase().replace('.', '');
    
    // 차단 목록 먼저 확인
    if (BLOCKED_EXTENSIONS.includes(ext)) {
        return { allowed: false, reason: '보안상 허용되지 않는 파일 형식입니다.' };
    }
    
    // 허용 목록 확인
    const fileType = getFileTypeByExtension(ext);
    if (!fileType) {
        return { allowed: false, reason: '지원하지 않는 파일 형식입니다.' };
    }
    
    return { allowed: true, fileType };
}

/**
 * 파일 크기 제한 확인
 */
function checkFileSize(fileSize, extension) {
    const ext = extension.toLowerCase().replace('.', '');
    const fileType = getFileTypeByExtension(ext);
    
    if (!fileType) {
        return { allowed: false, reason: '지원하지 않는 파일 형식입니다.' };
    }
    
    if (fileSize > fileType.maxSize) {
        const maxSizeMB = Math.round(fileType.maxSize / (1024 * 1024));
        return { 
            allowed: false, 
            reason: `파일 크기가 제한(${maxSizeMB}MB)을 초과했습니다.` 
        };
    }
    
    return { allowed: true };
}

/**
 * 플랜별 용량 제한 가져오기
 */
function getPlanLimits(planType = 'free') {
    return STORAGE_PLANS[planType] || STORAGE_PLANS.free;
}

/**
 * 사용자 S3 경로 생성
 */
function generateUserPath(centerID, userID, category, filename) {
    const categoryConfig = FILE_CATEGORIES[category];
    if (!categoryConfig) {
        throw new Error(`알 수 없는 카테고리: ${category}`);
    }
    
    const folder = categoryConfig.folder;
    const timestamp = Date.now();
    const safeFilename = encodeURIComponent(filename);
    
    return `users/${centerID}/${userID}/${folder}/${timestamp}_${safeFilename}`;
}

/**
 * 바이트를 읽기 쉬운 형식으로 변환
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    if (bytes === null) return '무제한';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 사용률 계산 (%)
 */
function calculateUsagePercent(used, limit) {
    if (!limit) return 0; // 무제한
    return Math.round((used / limit) * 100);
}

/**
 * 파일 업로드 가능 여부 종합 검사
 */
function validateUpload(file, category = 'board') {
    const errors = [];
    
    // 1. 파일 존재 확인
    if (!file) {
        return { valid: false, errors: ['파일이 없습니다.'] };
    }
    
    // 2. 파일명에서 확장자 추출
    const filename = file.originalname || file.name || '';
    const extension = filename.split('.').pop();
    
    // 3. 확장자 검사
    const extCheck = isExtensionAllowed(extension);
    if (!extCheck.allowed) {
        errors.push(extCheck.reason);
    }
    
    // 4. 파일 크기 검사
    const fileSize = file.size || 0;
    const sizeCheck = checkFileSize(fileSize, extension);
    if (!sizeCheck.allowed) {
        errors.push(sizeCheck.reason);
    }
    
    // 5. 카테고리별 추가 검사
    const categoryConfig = FILE_CATEGORIES[category];
    if (categoryConfig && categoryConfig.allowedExtensions) {
        const ext = extension.toLowerCase();
        if (!categoryConfig.allowedExtensions.includes(ext)) {
            errors.push(`이 카테고리에서는 ${categoryConfig.allowedExtensions.join(', ')} 파일만 허용됩니다.`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        fileInfo: {
            filename,
            extension,
            size: fileSize,
            category: extCheck.fileType?.category
        }
    };
}

// =====================================================
// 📤 모듈 내보내기
// =====================================================
module.exports = {
    // 상수
    STORAGE_PLANS,
    FILE_CATEGORIES,
    ALLOWED_EXTENSIONS,
    BLOCKED_EXTENSIONS,
    
    // 함수
    getFileTypeByExtension,
    isExtensionAllowed,
    checkFileSize,
    getPlanLimits,
    generateUserPath,
    formatBytes,
    calculateUsagePercent,
    validateUpload
};
