const mime = require('mime-types');
const path = require('path');

// 허용된 파일 확장자
const ALLOWED_EXTENSIONS = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
    document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
    archive: ['.zip', '.rar', '.7z'],
    text: ['.txt', '.js', '.py', '.html', '.css', '.json', '.xml']
};

// 위험한 파일 확장자 (업로드 금지)
const DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
    '.php', '.asp', '.aspx', '.jsp', '.sh', '.bash', '.ps1', '.msi'
];

// 파일 확장자 검증
function validateFileExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    // 위험한 확장자 체크
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
        return {
            isValid: false,
            error: '보안상 위험한 파일 형식입니다.'
        };
    }
    
    // 허용된 확장자 체크
    const isAllowed = Object.values(ALLOWED_EXTENSIONS).some(extensions => 
        extensions.includes(ext)
    );
    
    if (!isAllowed) {
        return {
            isValid: false,
            error: '지원하지 않는 파일 형식입니다.'
        };
    }
    
    return { isValid: true };
}

// MIME 타입과 확장자 일치 검증
function validateMimeType(filename, mimeType) {
    const ext = path.extname(filename).toLowerCase();
    const expectedMime = mime.lookup(filename);
    
    // MIME 타입이 예상과 다른 경우
    if (expectedMime && expectedMime !== mimeType) {
        // 일부 예외 케이스 허용 (브라우저별 차이)
        const exceptions = {
            '.jpg': ['image/jpeg', 'image/jpg'],
            '.jpeg': ['image/jpeg', 'image/jpg'], 
            '.png': ['image/png'],
            '.gif': ['image/gif'],
            '.pdf': ['application/pdf'],
            '.zip': ['application/zip', 'application/x-zip-compressed']
        };
        
        if (exceptions[ext] && !exceptions[ext].includes(mimeType)) {
            return {
                isValid: false,
                error: '파일 형식이 올바르지 않습니다.'
            };
        }
    }
    
    return { isValid: true };
}

// 파일 크기 검증
function validateFileSize(fileSize, fileType) {
    const limits = {
        image: 10 * 1024 * 1024,     // 10MB
        document: 50 * 1024 * 1024,  // 50MB
        archive: 100 * 1024 * 1024,  // 100MB
        text: 1 * 1024 * 1024        // 1MB
    };
    
    const maxSize = limits[fileType] || limits.document;
    
    if (fileSize > maxSize) {
        return {
            isValid: false,
            error: `파일 크기가 너무 큽니다. (최대 ${formatFileSize(maxSize)})`
        };
    }
    
    return { isValid: true };
}

// 파일명 안전성 검증
function validateFilename(filename) {
    // 파일명 길이 체크
    if (filename.length > 255) {
        return {
            isValid: false,
            error: '파일명이 너무 깁니다.'
        };
    }
    
    // 위험한 문자 체크
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
        return {
            isValid: false,
            error: '파일명에 사용할 수 없는 문자가 포함되어 있습니다.'
        };
    }
    
    // 숨김 파일 체크
    if (filename.startsWith('.')) {
        return {
            isValid: false,
            error: '숨김 파일은 업로드할 수 없습니다.'
        };
    }
    
    return { isValid: true };
}

// 종합 파일 검증
function validateFile(file) {
    const errors = [];
    
    // 파일명 검증
    const filenameCheck = validateFilename(file.originalname);
    if (!filenameCheck.isValid) {
        errors.push(filenameCheck.error);
    }
    
    // 확장자 검증
    const extensionCheck = validateFileExtension(file.originalname);
    if (!extensionCheck.isValid) {
        errors.push(extensionCheck.error);
    }
    
    // MIME 타입 검증
    const mimeCheck = validateMimeType(file.originalname, file.mimetype);
    if (!mimeCheck.isValid) {
        errors.push(mimeCheck.error);
    }
    
    // 파일 크기 검증 (파일 타입 결정 후)
    const fileType = detectFileTypeByExtension(file.originalname);
    if (fileType) {
        const sizeCheck = validateFileSize(file.size, fileType);
        if (!sizeCheck.isValid) {
            errors.push(sizeCheck.error);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// 확장자로 파일 타입 결정
function detectFileTypeByExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
        if (extensions.includes(ext)) {
            return type;
        }
    }
    
    return null;
}

// 파일 크기 포맷팅
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 안전한 파일명 생성
function sanitizeFilename(filename) {
    // 위험한 문자 제거
    let safe = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    
    // 연속된 언더스코어 정리
    safe = safe.replace(/_+/g, '_');
    
    // 앞뒤 공백 및 점 제거
    safe = safe.trim().replace(/^\.+|\.+$/g, '');
    
    // 길이 제한
    if (safe.length > 200) {
        const ext = path.extname(safe);
        const name = path.basename(safe, ext);
        safe = name.substring(0, 200 - ext.length) + ext;
    }
    
    return safe || 'unnamed_file';
}

module.exports = {
    ALLOWED_EXTENSIONS,
    DANGEROUS_EXTENSIONS,
    validateFile,
    validateFileExtension,
    validateMimeType,
    validateFileSize,
    validateFilename,
    detectFileTypeByExtension,
    formatFileSize,
    sanitizeFilename
};
