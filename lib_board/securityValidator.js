const {
    GLOBAL_LIMITS,
    FILE_TYPE_POLICIES,
    FORBIDDEN_FILES,
    ROLE_PERMISSIONS,
    FILENAME_POLICIES,
    CONTENT_SCAN_POLICIES,
    IP_RATE_LIMITS
} = require('./securityPolicies');
const { detectFileTypeByExtension } = require('./fileValidation');
const db = require('../lib_login/db');
const path = require('path');

/**
 * 업로드 레이트 제한 체크 (IP 기반)
 */
const uploadRateLimits = new Map(); // IP별 업로드 기록 저장

async function checkIPRateLimit(ip) {
    if (!IP_RATE_LIMITS.enabled) return { allowed: true };

    const now = Date.now();
    const ipData = uploadRateLimits.get(ip) || { uploads: [], banned: false, banUntil: 0 };

    // 차단 해제 시간 확인
    if (ipData.banned && now > ipData.banUntil) {
        ipData.banned = false;
        ipData.banUntil = 0;
        ipData.uploads = [];
    }

    // 현재 차단 상태 확인
    if (ipData.banned) {
        return {
            allowed: false,
            error: `IP가 차단되었습니다. ${Math.ceil((ipData.banUntil - now) / 60000)}분 후 다시 시도하세요.`
        };
    }

    // 1분 이내 업로드 기록 필터링
    const oneMinuteAgo = now - 60 * 1000;
    ipData.uploads = ipData.uploads.filter(time => time > oneMinuteAgo);

    // 분당 제한 확인
    if (ipData.uploads.length >= IP_RATE_LIMITS.maxUploadsPerMinute) {
        // 차단 적용
        ipData.banned = true;
        ipData.banUntil = now + IP_RATE_LIMITS.banDuration;
        uploadRateLimits.set(ip, ipData);

        return {
            allowed: false,
            error: '업로드 횟수 제한을 초과했습니다. 잠시 후 다시 시도하세요.'
        };
    }

    // 업로드 기록 추가
    ipData.uploads.push(now);
    uploadRateLimits.set(ip, ipData);

    return { allowed: true };
}

/**
 * 사용자별 업로드 제한 체크
 */
async function checkUserUploadLimits(userId, userRole, fileSize) {
    try {
        if (!userId) {
            console.warn('checkUserUploadLimits called without userId');
            return { allowed: false, error: '사용자 정보가 없습니다.' };
        }
        const rolePermissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.student;

        // 24시간 전 시간
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // 사용자의 24시간 내 업로드 통계 조회
        const [stats] = await db.queryDatabase(`
            SELECT 
                COUNT(*) as file_count,
                COALESCE(SUM(file_size), 0) as total_size
            FROM board_attachments ba
            LEFT JOIN board_posts bp ON ba.post_id = bp.id
            WHERE bp.author_id = (SELECT id FROM Users WHERE userID = ?)
            AND ba.created_at > ?
        `, [userId, oneDayAgo]);

        // 파일 개수 제한 확인
        if (stats.file_count >= rolePermissions.maxFilesPerPost) {
            return {
                allowed: false,
                error: `일일 업로드 파일 개수 제한을 초과했습니다. (${stats.file_count}/${rolePermissions.maxFilesPerPost})`
            };
        }

        // 용량 제한 확인
        const newTotalSize = parseInt(stats.total_size) + fileSize;
        if (newTotalSize > rolePermissions.dailyUploadLimit) {
            return {
                allowed: false,
                error: `일일 업로드 용량 제한을 초과했습니다. (${formatFileSize(newTotalSize)}/${formatFileSize(rolePermissions.dailyUploadLimit)})`
            };
        }

        return { allowed: true };

    } catch (error) {
        console.error('사용자 업로드 제한 확인 오류:', error);
        return { allowed: false, error: '업로드 제한 확인 중 오류가 발생했습니다.' };
    }
}

/**
 * 파일 보안 검증
 */
function validateFileSecurity(file) {
    const errors = [];

    // 1. 파일명 보안 검증
    const filenameCheck = validateSecureFilename(file.originalname);
    if (!filenameCheck.isValid) {
        errors.push(...filenameCheck.errors);
    }

    // 2. 확장자 보안 검증
    const extensionCheck = validateSecureExtension(file.originalname);
    if (!extensionCheck.isValid) {
        errors.push(extensionCheck.error);
    }

    // 3. MIME 타입 보안 검증
    const mimeCheck = validateSecureMimeType(file.mimetype);
    if (!mimeCheck.isValid) {
        errors.push(mimeCheck.error);
    }

    // 4. 파일 크기 검증
    const sizeCheck = validateFileSize(file.size, file.originalname);
    if (!sizeCheck.isValid) {
        errors.push(sizeCheck.error);
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * 안전한 파일명 검증
 */
function validateSecureFilename(filename) {
    const errors = [];

    // 길이 체크
    if (filename.length > FILENAME_POLICIES.maxLength) {
        errors.push(`파일명이 너무 깁니다. (최대 ${FILENAME_POLICIES.maxLength}자)`);
    }

    if (filename.length < FILENAME_POLICIES.minLength) {
        errors.push('파일명이 필요합니다.');
    }

    // 금지된 문자 체크
    if (FILENAME_POLICIES.forbiddenChars.test(filename)) {
        errors.push('파일명에 사용할 수 없는 문자가 포함되어 있습니다.');
    }

    // 금지된 파일명 체크 (Windows 예약어)
    const nameWithoutExt = path.basename(filename, path.extname(filename)).toUpperCase();
    if (FILENAME_POLICIES.forbiddenNames.includes(nameWithoutExt)) {
        errors.push('사용할 수 없는 파일명입니다.');
    }

    // 금지된 접두사 체크
    const startsWithForbidden = FILENAME_POLICIES.forbiddenPrefixes.some(prefix =>
        filename.startsWith(prefix)
    );
    if (startsWithForbidden) {
        errors.push('파일명은 점(.)이나 특수문자로 시작할 수 없습니다.');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * 안전한 확장자 검증
 */
function validateSecureExtension(filename) {
    const ext = path.extname(filename).toLowerCase();

    // 금지된 확장자 체크
    if (FORBIDDEN_FILES.extensions.includes(ext)) {
        return {
            isValid: false,
            error: `${ext} 파일은 보안상 업로드할 수 없습니다.`
        };
    }

    // 패턴 기반 금지 확장자 체크
    const matchesForbiddenPattern = FORBIDDEN_FILES.patterns.some(pattern =>
        pattern.test(filename)
    );
    if (matchesForbiddenPattern) {
        return {
            isValid: false,
            error: '해당 파일 형식은 보안상 업로드할 수 없습니다.'
        };
    }

    // 허용된 확장자인지 확인
    const fileType = detectFileTypeByExtension(filename);
    if (!fileType) {
        return {
            isValid: false,
            error: '지원하지 않는 파일 형식입니다.'
        };
    }

    return { isValid: true };
}

/**
 * 안전한 MIME 타입 검증
 */
function validateSecureMimeType(mimeType) {
    // 금지된 MIME 타입 체크
    if (FORBIDDEN_FILES.mimes.includes(mimeType)) {
        return {
            isValid: false,
            error: '해당 파일 형식은 보안상 업로드할 수 없습니다.'
        };
    }

    // 허용된 MIME 타입인지 확인
    const isAllowed = Object.values(FILE_TYPE_POLICIES).some(policy =>
        policy.allowedMimes.includes(mimeType)
    );

    if (!isAllowed) {
        return {
            isValid: false,
            error: '지원하지 않는 파일 형식입니다.'
        };
    }

    return { isValid: true };
}

/**
 * 파일 크기 검증
 */
function validateFileSize(fileSize, filename) {
    const fileType = detectFileTypeByExtension(filename);
    if (!fileType) {
        return {
            isValid: false,
            error: '파일 형식을 확인할 수 없습니다.'
        };
    }

    const policy = FILE_TYPE_POLICIES[fileType];
    if (fileSize > policy.maxSize) {
        return {
            isValid: false,
            error: `파일 크기가 너무 큽니다. (최대 ${formatFileSize(policy.maxSize)})`
        };
    }

    return { isValid: true };
}

/**
 * 역할별 파일 타입 권한 확인
 */
function validateRolePermissions(userRole, fileType, category) {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.student;

    // 파일 타입 권한 확인
    if (!rolePermissions.allowedFileTypes.includes(fileType)) {
        return {
            allowed: false,
            error: `${userRole} 권한으로는 ${fileType} 파일을 업로드할 수 없습니다.`
        };
    }

    // 카테고리 권한 확인
    if (category && !rolePermissions.allowedCategories.includes(category)) {
        return {
            allowed: false,
            error: `${userRole} 권한으로는 ${category} 게시판에 파일을 업로드할 수 없습니다.`
        };
    }

    return { allowed: true };
}

/**
 * 파일 내용 스캔 (악성 패턴 감지)
 */
async function scanFileContent(buffer, filename) {
    if (!CONTENT_SCAN_POLICIES.enableContentScan) {
        return { safe: true };
    }

    // 스캔 크기 제한
    if (buffer.length > CONTENT_SCAN_POLICIES.maxScanSize) {
        return { safe: true }; // 너무 큰 파일은 스캔 스킵
    }

    try {
        const content = buffer.toString('utf8');

        // 의심스러운 패턴 검사
        for (const pattern of CONTENT_SCAN_POLICIES.suspiciousPatterns) {
            if (pattern.test(content)) {
                return {
                    safe: false,
                    error: '파일에 의심스러운 내용이 포함되어 있습니다.'
                };
            }
        }

        return { safe: true };

    } catch (error) {
        // 바이너리 파일이거나 텍스트로 읽을 수 없는 경우
        return { safe: true };
    }
}

/**
 * 종합 보안 검증
 */
async function validateUploadSecurity(file, userId, userRole, category, clientIP) {
    const errors = [];

    try {
        // 1. IP 레이트 제한 확인
        const ipCheck = await checkIPRateLimit(clientIP);
        if (!ipCheck.allowed) {
            errors.push(ipCheck.error);
        }

        // 2. 파일 보안 검증
        const securityCheck = validateFileSecurity(file);
        if (!securityCheck.isValid) {
            errors.push(...securityCheck.errors);
        }

        // 3. 사용자 업로드 제한 확인
        const userLimitCheck = await checkUserUploadLimits(userId, userRole, file.size);
        if (!userLimitCheck.allowed) {
            errors.push(userLimitCheck.error);
        }

        // 4. 역할별 권한 확인
        const fileType = detectFileTypeByExtension(file.originalname);
        if (fileType) {
            const roleCheck = validateRolePermissions(userRole, fileType, category);
            if (!roleCheck.allowed) {
                errors.push(roleCheck.error);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };

    } catch (error) {
        console.error('보안 검증 오류:', error);
        return {
            isValid: false,
            errors: ['파일 보안 검증 중 오류가 발생했습니다.']
        };
    }
}

// 유틸리티 함수
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
    validateUploadSecurity,
    validateFileSecurity,
    validateSecureFilename,
    validateSecureExtension,
    validateSecureMimeType,
    validateFileSize,
    validateRolePermissions,
    checkIPRateLimit,
    checkUserUploadLimits,
    scanFileContent
};
