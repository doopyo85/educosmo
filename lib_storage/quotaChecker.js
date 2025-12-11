/**
 * 🔥 스토리지 용량 체크 미들웨어
 * 파일 업로드 전 사용자/센터 용량 확인
 */

const db = require('../lib_login/db');
const { 
    STORAGE_PLANS, 
    validateUpload, 
    formatBytes,
    calculateUsagePercent 
} = require('./storagePolicy');

// =====================================================
// 📊 사용량 조회 함수들
// =====================================================

/**
 * 사용자 스토리지 사용량 조회
 */
async function getUserStorageUsage(userId) {
    try {
        const [usage] = await db.queryDatabase(`
            SELECT * FROM UserStorageUsage WHERE user_id = ?
        `, [userId]);
        
        if (!usage) {
            // 레코드가 없으면 생성
            await db.queryDatabase(`
                INSERT INTO UserStorageUsage (user_id, center_id, total_usage)
                SELECT id, centerID, 0 FROM Users WHERE id = ?
            `, [userId]);
            
            return {
                user_id: userId,
                total_usage: 0,
                entry_usage: 0,
                scratch_usage: 0,
                python_usage: 0,
                appinventor_usage: 0,
                gallery_usage: 0,
                board_usage: 0,
                storage_limit: null
            };
        }
        
        return usage;
    } catch (error) {
        console.error('사용자 스토리지 조회 오류:', error);
        throw error;
    }
}

/**
 * 센터 스토리지 사용량 조회
 */
async function getCenterStorageUsage(centerId) {
    try {
        const [usage] = await db.queryDatabase(`
            SELECT * FROM CenterStorageUsage WHERE center_id = ?
        `, [centerId]);
        
        if (!usage) {
            // 레코드가 없으면 생성
            await db.queryDatabase(`
                INSERT INTO CenterStorageUsage (center_id, total_usage, plan_type)
                VALUES (?, 0, 'free')
            `, [centerId]);
            
            return {
                center_id: centerId,
                total_usage: 0,
                storage_limit: STORAGE_PLANS.free.centerLimit,
                plan_type: 'free'
            };
        }
        
        return usage;
    } catch (error) {
        console.error('센터 스토리지 조회 오류:', error);
        throw error;
    }
}

/**
 * 사용자의 용량 제한 가져오기 (플랜 기반)
 */
async function getUserStorageLimit(userId, centerId) {
    try {
        // 센터 플랜 조회
        const centerUsage = await getCenterStorageUsage(centerId);
        const planType = centerUsage.plan_type || 'free';
        const plan = STORAGE_PLANS[planType] || STORAGE_PLANS.free;
        
        // 사용자별 커스텀 제한이 있는지 확인
        const userUsage = await getUserStorageUsage(userId);
        
        // 커스텀 제한이 있으면 그것을 사용, 없으면 플랜 기본값
        const userLimit = userUsage.storage_limit || plan.userLimit;
        
        return {
            userLimit,
            centerLimit: centerUsage.storage_limit || plan.centerLimit,
            planType,
            planName: plan.name
        };
    } catch (error) {
        console.error('용량 제한 조회 오류:', error);
        // 오류 시 기본값 반환
        return {
            userLimit: STORAGE_PLANS.free.userLimit,
            centerLimit: STORAGE_PLANS.free.centerLimit,
            planType: 'free',
            planName: 'Free'
        };
    }
}

/**
 * 업로드 가능 여부 확인
 */
async function canUpload(userId, centerId, fileSize) {
    try {
        const userUsage = await getUserStorageUsage(userId);
        const centerUsage = await getCenterStorageUsage(centerId);
        const limits = await getUserStorageLimit(userId, centerId);
        
        const newUserTotal = (userUsage.total_usage || 0) + fileSize;
        const newCenterTotal = (centerUsage.total_usage || 0) + fileSize;
        
        // 사용자 용량 체크 (무제한이 아닌 경우)
        if (limits.userLimit !== null && newUserTotal > limits.userLimit) {
            return {
                allowed: false,
                reason: 'user_limit',
                message: `개인 저장 용량(${formatBytes(limits.userLimit)})을 초과합니다.`,
                current: userUsage.total_usage,
                limit: limits.userLimit,
                required: fileSize
            };
        }
        
        // 센터 용량 체크
        if (limits.centerLimit !== null && newCenterTotal > limits.centerLimit) {
            return {
                allowed: false,
                reason: 'center_limit',
                message: `센터 저장 용량(${formatBytes(limits.centerLimit)})을 초과합니다. 관리자에게 문의하세요.`,
                current: centerUsage.total_usage,
                limit: limits.centerLimit,
                required: fileSize
            };
        }
        
        return {
            allowed: true,
            userUsage: {
                current: userUsage.total_usage,
                afterUpload: newUserTotal,
                limit: limits.userLimit,
                percent: calculateUsagePercent(newUserTotal, limits.userLimit)
            },
            centerUsage: {
                current: centerUsage.total_usage,
                afterUpload: newCenterTotal,
                limit: limits.centerLimit,
                percent: calculateUsagePercent(newCenterTotal, limits.centerLimit)
            }
        };
    } catch (error) {
        console.error('업로드 가능 여부 확인 오류:', error);
        // 오류 시 일단 허용 (서비스 중단 방지)
        return { allowed: true, error: error.message };
    }
}

// =====================================================
// 🔄 사용량 업데이트 함수들
// =====================================================

/**
 * 파일 업로드 후 사용량 증가
 */
async function increaseUsage(userId, centerId, fileSize, category = 'board') {
    try {
        // 카테고리별 컬럼 매핑
        const categoryColumn = {
            entry: 'entry_usage',
            scratch: 'scratch_usage',
            python: 'python_usage',
            appinventor: 'appinventor_usage',
            gallery: 'gallery_usage',
            board: 'board_usage'
        };
        
        const column = categoryColumn[category] || 'board_usage';
        
        // 사용자 사용량 업데이트
        await db.queryDatabase(`
            INSERT INTO UserStorageUsage (user_id, center_id, ${column}, total_usage)
            SELECT ?, centerID, ?, ?
            FROM Users WHERE id = ?
            ON DUPLICATE KEY UPDATE 
                ${column} = ${column} + ?,
                total_usage = total_usage + ?,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, fileSize, fileSize, userId, fileSize, fileSize]);
        
        // 센터 사용량 업데이트
        await db.queryDatabase(`
            INSERT INTO CenterStorageUsage (center_id, total_usage)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE 
                total_usage = total_usage + ?,
                updated_at = CURRENT_TIMESTAMP
        `, [centerId, fileSize, fileSize]);
        
        console.log(`📊 사용량 증가: user=${userId}, center=${centerId}, size=${formatBytes(fileSize)}, category=${category}`);
        
        return true;
    } catch (error) {
        console.error('사용량 증가 오류:', error);
        return false;
    }
}

/**
 * 파일 삭제 후 사용량 감소
 */
async function decreaseUsage(userId, centerId, fileSize, category = 'board') {
    try {
        const categoryColumn = {
            entry: 'entry_usage',
            scratch: 'scratch_usage',
            python: 'python_usage',
            appinventor: 'appinventor_usage',
            gallery: 'gallery_usage',
            board: 'board_usage'
        };
        
        const column = categoryColumn[category] || 'board_usage';
        
        // 사용자 사용량 감소 (음수 방지)
        await db.queryDatabase(`
            UPDATE UserStorageUsage 
            SET ${column} = GREATEST(0, ${column} - ?),
                total_usage = GREATEST(0, total_usage - ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `, [fileSize, fileSize, userId]);
        
        // 센터 사용량 감소 (음수 방지)
        await db.queryDatabase(`
            UPDATE CenterStorageUsage 
            SET total_usage = GREATEST(0, total_usage - ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE center_id = ?
        `, [fileSize, centerId]);
        
        console.log(`📊 사용량 감소: user=${userId}, center=${centerId}, size=${formatBytes(fileSize)}, category=${category}`);
        
        return true;
    } catch (error) {
        console.error('사용량 감소 오류:', error);
        return false;
    }
}

/**
 * UserFiles 테이블에 파일 기록 추가
 */
async function recordFile(userId, centerId, fileInfo) {
    try {
        const result = await db.queryDatabase(`
            INSERT INTO UserFiles 
            (user_id, center_id, file_category, original_name, stored_name, 
             file_size, file_type, s3_url, related_post_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            centerId,
            fileInfo.category || 'board',
            fileInfo.originalName,
            fileInfo.storedName || fileInfo.key,
            fileInfo.size,
            fileInfo.type || fileInfo.mimeType,
            fileInfo.url || fileInfo.s3Url,
            fileInfo.postId || null
        ]);
        
        return result.insertId;
    } catch (error) {
        console.error('파일 기록 오류:', error);
        return null;
    }
}

/**
 * UserFiles 테이블에서 파일 삭제 표시
 */
async function markFileDeleted(fileId) {
    try {
        await db.queryDatabase(`
            UPDATE UserFiles 
            SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [fileId]);
        return true;
    } catch (error) {
        console.error('파일 삭제 표시 오류:', error);
        return false;
    }
}

// =====================================================
// 🛡️ Express 미들웨어
// =====================================================

/**
 * 파일 업로드 전 검증 미들웨어
 * 사용법: router.post('/upload', quotaCheckMiddleware('board'), uploadHandler)
 */
function quotaCheckMiddleware(category = 'board') {
    return async (req, res, next) => {
        try {
            // 세션에서 사용자 정보 확인
            if (!req.session || !req.session.userID) {
                return res.status(401).json({
                    success: false,
                    error: '로그인이 필요합니다.'
                });
            }
            
            // 사용자 ID 조회
            const [user] = await db.queryDatabase(
                'SELECT id, centerID FROM Users WHERE userID = ?',
                [req.session.userID]
            );
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: '사용자 정보를 찾을 수 없습니다.'
                });
            }
            
            // 파일이 있는 경우 검증
            const file = req.file || (req.files && req.files[0]);
            
            if (file) {
                // 1. 파일 형식/크기 검증
                const validation = validateUpload(file, category);
                if (!validation.valid) {
                    return res.status(400).json({
                        success: false,
                        error: validation.errors.join(' ')
                    });
                }
                
                // 2. 용량 체크
                const quotaCheck = await canUpload(user.id, user.centerID, file.size);
                if (!quotaCheck.allowed) {
                    return res.status(413).json({
                        success: false,
                        error: quotaCheck.message,
                        details: {
                            reason: quotaCheck.reason,
                            current: formatBytes(quotaCheck.current),
                            limit: formatBytes(quotaCheck.limit),
                            required: formatBytes(quotaCheck.required)
                        }
                    });
                }
                
                // 요청 객체에 정보 추가 (후속 처리에서 사용)
                req.storageInfo = {
                    userId: user.id,
                    centerId: user.centerID,
                    category,
                    fileSize: file.size,
                    quotaCheck
                };
            }
            
            // 사용자 정보 추가
            req.userDbId = user.id;
            req.userCenterId = user.centerID;
            
            next();
        } catch (error) {
            console.error('용량 체크 미들웨어 오류:', error);
            // 오류 시 일단 통과 (서비스 중단 방지)
            next();
        }
    };
}

/**
 * 업로드 완료 후 사용량 업데이트 헬퍼
 * 컨트롤러에서 파일 업로드 성공 후 호출
 */
async function afterUpload(req, fileInfo) {
    if (!req.storageInfo) {
        console.warn('storageInfo 없음 - quotaCheckMiddleware가 실행되지 않았을 수 있음');
        return;
    }
    
    const { userId, centerId, category, fileSize } = req.storageInfo;
    
    // 사용량 증가
    await increaseUsage(userId, centerId, fileSize, category);
    
    // 파일 기록
    await recordFile(userId, centerId, {
        ...fileInfo,
        category,
        size: fileSize
    });
}

// =====================================================
// 📤 모듈 내보내기
// =====================================================
module.exports = {
    // 조회 함수
    getUserStorageUsage,
    getCenterStorageUsage,
    getUserStorageLimit,
    canUpload,
    
    // 업데이트 함수
    increaseUsage,
    decreaseUsage,
    recordFile,
    markFileDeleted,
    
    // 미들웨어
    quotaCheckMiddleware,
    afterUpload
};
