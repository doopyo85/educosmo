/**
 * 병렬 저장 모듈 (Parallel Save Module)
 * 
 * UserFiles + ProjectSubmissions 동시 기록
 * - UserFiles: 용량 관리 (quotaChecker 연동)
 * - ProjectSubmissions: 학습 평가 (CT 분석 연동)
 * 
 * @version 1.1.0
 * @date 2025-12-27
 * @updated 파라미터 구조 통일 및 자동 분석 지원
 */

const db = require('../lib_login/db');
const quotaChecker = require('./quotaChecker');

// 플랫폼별 카테고리 매핑
const PLATFORM_CATEGORY_MAP = {
    'entry': 'entry',
    'scratch': 'scratch',
    'python': 'python',
    'appinventor': 'appinventor'
};

// 저장 타입 정의
const SUBMISSION_TYPES = {
    AUTOSAVE: 'autosave',      // 자동저장 (ProjectSubmissions만)
    PROJECTS: 'projects',      // 수동저장 (병렬 저장)
    SUBMITTED: 'submitted'     // 최종제출 (병렬 저장 + CT 분석)
};

/**
 * Entry 프로젝트 분석
 */
function analyzeEntryProject(projectData) {
    if (!projectData) return { blocksCount: 0, spritesCount: 0 };

    const spritesCount = projectData.objects?.length || 0;
    const blocksCount = projectData.objects?.reduce((sum, obj) => {
        return sum + (obj.script?.length || 0);
    }, 0) || 0;

    return { blocksCount, spritesCount };
}

/**
 * Scratch 프로젝트 분석 (SB3 JSON)
 */
function analyzeScratchProject(projectData) {
    if (!projectData || !projectData.targets) {
        return { blocksCount: 0, spritesCount: 0 };
    }

    const targets = projectData.targets || [];
    const spritesCount = targets.filter(t => !t.isStage).length;
    const blocksCount = targets.reduce((sum, target) => {
        return sum + Object.keys(target.blocks || {}).length;
    }, 0);

    return { blocksCount, spritesCount };
}

/**
 * 플랫폼별 프로젝트 분석
 */
function analyzeProject(platform, projectData) {
    if (platform === 'entry') {
        return analyzeEntryProject(projectData);
    } else if (platform === 'scratch') {
        return analyzeScratchProject(projectData);
    }
    return { blocksCount: 0, spritesCount: 0 };
}

/**
 * 프로젝트 병렬 저장
 * UserFiles + ProjectSubmissions 동시 INSERT
 * 
 * @param {Object} params - 저장 파라미터
 * @param {number} params.userId - 사용자 DB ID
 * @param {number} params.centerId - 센터 ID
 * @param {string} params.userID - 사용자 문자열 ID (세션)
 * @param {string} params.platform - 플랫폼 (entry, scratch 등)
 * @param {string} params.projectName - 프로젝트명
 * @param {Buffer} params.projectBuffer - 프로젝트 데이터 버퍼
 * @param {string} params.saveType - 저장 타입 (autosave, projects, submitted)
 * @param {string} params.s3Url - S3 URL
 * @param {string} params.s3Key - S3 키
 * @param {string} params.thumbnailUrl - 썸네일 URL (선택)
 * @param {Object} params.projectData - 원본 프로젝트 데이터 (분석용)
 * @returns {Promise<Object>} 저장 결과
 */
async function saveProjectParallel(params) {
    const {
        userId,
        centerId,
        userID,
        platform,
        projectName,
        projectBuffer,
        saveType = SUBMISSION_TYPES.PROJECTS,
        s3Url,
        s3Key,
        thumbnailUrl = null,
        projectData = null
    } = params;

    // 파일 크기 계산
    const fileSize = projectBuffer ? projectBuffer.length : 0;
    const fileSizeKb = Math.ceil(fileSize / 1024);
    const category = PLATFORM_CATEGORY_MAP[platform] || platform;
    
    // 프로젝트 분석
    const analysis = analyzeProject(platform, projectData);

    console.log(`💾 [parallelSave] 병렬 저장 시작:`, {
        userId, platform, projectName, saveType, fileSizeKb, analysis
    });

    try {
        // 병렬 저장 (UserFiles + ProjectSubmissions)
        const results = await Promise.all([
            // 1. UserFiles INSERT
            insertUserFile({
                userId,
                centerId,
                category,
                originalName: projectName,
                storedName: s3Key,
                fileSize,
                fileType: 'application/json',
                s3Url
            }),
            // 2. ProjectSubmissions INSERT
            insertProjectSubmission({
                userId,
                centerId,
                platform,
                projectName,
                saveType,
                s3Url,
                s3Key,
                fileSizeKb,
                thumbnailUrl,
                analysis
            })
        ]);

        const [userFileResult, submissionResult] = results;

        // 3. 용량 증가 (UserFiles 기준)
        await quotaChecker.increaseUsage(userId, centerId, fileSize, category);

        console.log(`✅ [parallelSave] 병렬 저장 완료:`, {
            userFileId: userFileResult.insertId,
            projectSubmissionId: submissionResult.insertId
        });

        return {
            success: true,
            userFileId: userFileResult.insertId,
            projectSubmissionId: submissionResult.insertId,
            s3Url,
            s3Key,
            fileSize,
            fileSizeKb
        };

    } catch (error) {
        console.error(`❌ [parallelSave] 저장 실패:`, error);
        throw error;
    }
}

/**
 * 자동저장 전용 (ProjectSubmissions만)
 * 기존 autosave가 있으면 UPDATE, 없으면 INSERT
 * UserFiles에 저장하지 않음 (용량 미산정)
 */
async function saveAutosaveOnly(params) {
    const {
        userId,
        centerId,
        userID,
        platform,
        projectName,
        projectBuffer,
        s3Url,
        s3Key,
        thumbnailUrl = null,
        projectData = null
    } = params;

    // 파일 크기 계산
    const fileSize = projectBuffer ? projectBuffer.length : 0;
    const fileSizeKb = Math.ceil(fileSize / 1024);
    
    // 프로젝트 분석
    const analysis = analyzeProject(platform, projectData);

    console.log(`🔄 [parallelSave] 자동저장 시작:`, {
        userId, platform, projectName, fileSizeKb
    });

    // 기존 autosave 검색
    const existingAutosave = await db.queryDatabase(
        `SELECT id, file_size_kb FROM ProjectSubmissions 
         WHERE user_id = ? AND platform = ? AND save_type = 'autosave'
           AND (is_deleted = FALSE OR is_deleted IS NULL)
         ORDER BY updated_at DESC LIMIT 1`,
        [userId, platform]
    );

    if (existingAutosave.length > 0) {
        // UPDATE 기존 autosave
        const oldId = existingAutosave[0].id;
        await db.queryDatabase(`
            UPDATE ProjectSubmissions 
            SET project_name = ?,
                s3_url = ?,
                s3_key = ?,
                file_size_kb = ?,
                blocks_count = ?,
                sprites_count = ?,
                thumbnail_url = COALESCE(?, thumbnail_url),
                updated_at = NOW()
            WHERE id = ?
        `, [
            projectName,
            s3Url,
            s3Key,
            fileSizeKb,
            analysis.blocksCount || 0,
            analysis.spritesCount || 0,
            thumbnailUrl,
            oldId
        ]);

        console.log(`🔄 [parallelSave] 자동저장 UPDATE: ID ${oldId}`);

        return {
            success: true,
            projectSubmissionId: oldId,
            isUpdate: true,
            s3Url,
            s3Key,
            fileSize,
            fileSizeKb
        };
    } else {
        // INSERT 새 autosave
        const result = await insertProjectSubmission({
            userId,
            centerId,
            platform,
            projectName,
            saveType: SUBMISSION_TYPES.AUTOSAVE,
            s3Url,
            s3Key,
            fileSizeKb,
            thumbnailUrl,
            analysis
        });

        console.log(`➕ [parallelSave] 자동저장 INSERT: ID ${result.insertId}`);

        return {
            success: true,
            projectSubmissionId: result.insertId,
            isUpdate: false,
            s3Url,
            s3Key,
            fileSize,
            fileSizeKb
        };
    }
}

/**
 * 프로젝트 덮어쓰기 (UPDATE)
 * 기존 레코드 업데이트 + 용량 차이 반영
 */
async function updateProjectParallel(params) {
    const {
        userId,
        centerId,
        userID,
        platform,
        projectSubmissionId,  // ProjectSubmissions.id
        userFileId = null,    // UserFiles.id (있는 경우)
        projectName,
        projectBuffer,
        s3Url,
        s3Key,
        thumbnailUrl = null,
        saveType = SUBMISSION_TYPES.PROJECTS,
        projectData = null
    } = params;

    // 파일 크기 계산
    const fileSize = projectBuffer ? projectBuffer.length : 0;
    const fileSizeKb = Math.ceil(fileSize / 1024);
    const category = PLATFORM_CATEGORY_MAP[platform] || platform;
    
    // 프로젝트 분석
    const analysis = analyzeProject(platform, projectData);

    console.log(`🔄 [parallelSave] 덮어쓰기 시작:`, {
        userId, platform, projectSubmissionId, userFileId, fileSizeKb
    });

    try {
        // 1. 기존 파일 크기 조회
        const [oldProject] = await db.queryDatabase(
            'SELECT file_size_kb FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
            [projectSubmissionId, userId]
        );

        const oldFileSize = oldProject ? (oldProject.file_size_kb || 0) * 1024 : 0;
        const sizeDiff = fileSize - oldFileSize;

        // 2. ProjectSubmissions UPDATE
        await db.queryDatabase(`
            UPDATE ProjectSubmissions 
            SET project_name = ?,
                s3_url = ?,
                s3_key = ?,
                file_size_kb = ?,
                blocks_count = ?,
                sprites_count = ?,
                thumbnail_url = COALESCE(?, thumbnail_url),
                updated_at = NOW()
            WHERE id = ? AND user_id = ?
        `, [
            projectName,
            s3Url,
            s3Key,
            fileSizeKb,
            analysis.blocksCount || 0,
            analysis.spritesCount || 0,
            thumbnailUrl,
            projectSubmissionId,
            userId
        ]);

        // 3. UserFiles UPDATE (있는 경우)
        if (userFileId) {
            await db.queryDatabase(`
                UPDATE UserFiles 
                SET original_name = ?,
                    stored_name = ?,
                    file_size = ?,
                    s3_url = ?
                WHERE id = ? AND user_id = ?
            `, [projectName, s3Key, fileSize, s3Url, userFileId, userId]);
        }

        // 4. 용량 차이 반영
        if (sizeDiff !== 0) {
            if (sizeDiff > 0) {
                await quotaChecker.increaseUsage(userId, centerId, sizeDiff, category);
            } else {
                await quotaChecker.decreaseUsage(userId, centerId, Math.abs(sizeDiff), category);
            }
        }

        console.log(`✅ [parallelSave] 덮어쓰기 완료: sizeDiff=${sizeDiff}`);

        return {
            success: true,
            projectSubmissionId,
            userFileId,
            s3Url,
            s3Key,
            fileSize,
            fileSizeKb,
            sizeDiff
        };

    } catch (error) {
        console.error(`❌ [parallelSave] 덮어쓰기 실패:`, error);
        throw error;
    }
}

/**
 * 프로젝트 삭제 (병렬 삭제)
 * 양쪽 테이블 모두 삭제 + 용량 반환
 * 
 * @param {Object} params - 삭제 파라미터
 * @param {number} params.userId - 사용자 DB ID
 * @param {number} params.centerId - 센터 ID
 * @param {string} params.userID - 사용자 문자열 ID
 * @param {string} params.platform - 플랫폼
 * @param {number} params.projectSubmissionId - ProjectSubmissions.id
 * @param {number} params.userFileId - UserFiles.id (선택)
 * @param {string} params.s3Key - S3 키 (하드 삭제 시 사용)
 * @param {number} params.fileSize - 파일 크기 (bytes)
 * @param {boolean} params.hardDelete - 영구 삭제 여부
 */
async function deleteProjectParallel(params) {
    const {
        userId,
        centerId,
        userID,
        platform,
        projectSubmissionId,
        userFileId = null,
        s3Key = null,
        fileSize = 0,
        hardDelete = false
    } = params;

    const category = PLATFORM_CATEGORY_MAP[platform] || platform;

    console.log(`🗑️ [parallelSave] 삭제 시작:`, {
        userId, platform, projectSubmissionId, userFileId, hardDelete
    });

    try {
        // S3 파일 삭제 (하드 삭제 시)
        if (hardDelete && s3Key) {
            try {
                const S3Manager = require('./s3Manager');
                const s3Manager = new S3Manager();
                await s3Manager.deleteProject(s3Key);
                console.log(`✅ S3 파일 삭제: ${s3Key}`);
            } catch (s3Error) {
                console.warn(`⚠️ S3 삭제 실패 (무시):`, s3Error.message);
            }
        }

        if (hardDelete) {
            // 하드 삭제 (완전 삭제)
            await db.queryDatabase(
                'DELETE FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
                [projectSubmissionId, userId]
            );

            if (userFileId) {
                await db.queryDatabase(
                    'DELETE FROM UserFiles WHERE id = ? AND user_id = ?',
                    [userFileId, userId]
                );
            }
        } else {
            // 소프트 삭제 (휴지통)
            await db.queryDatabase(
                `UPDATE ProjectSubmissions 
                 SET is_deleted = TRUE, deleted_at = NOW() 
                 WHERE id = ? AND user_id = ?`,
                [projectSubmissionId, userId]
            );

            if (userFileId) {
                await db.queryDatabase(
                    `UPDATE UserFiles 
                     SET is_deleted = TRUE, deleted_at = NOW() 
                     WHERE id = ? AND user_id = ?`,
                    [userFileId, userId]
                );
            }
        }

        // 용량 반환
        if (fileSize > 0) {
            await quotaChecker.decreaseUsage(userId, centerId, fileSize, category);
        }

        console.log(`✅ [parallelSave] 삭제 완료: freed=${fileSize} bytes`);

        return {
            success: true,
            deletedProjectSubmissionId: projectSubmissionId,
            deletedUserFileId: userFileId,
            freedSpace: fileSize,
            deleteType: hardDelete ? 'permanent' : 'soft'
        };

    } catch (error) {
        console.error(`❌ [parallelSave] 삭제 실패:`, error);
        throw error;
    }
}

/**
 * UserFiles INSERT 헬퍼
 */
async function insertUserFile(params) {
    const {
        userId,
        centerId,
        category,
        originalName,
        storedName,
        fileSize,
        fileType,
        s3Url
    } = params;

    return await db.queryDatabase(`
        INSERT INTO UserFiles 
        (user_id, center_id, file_category, original_name, stored_name, 
         file_size, file_type, s3_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [userId, centerId, category, originalName, storedName, fileSize, fileType, s3Url]);
}

/**
 * ProjectSubmissions INSERT 헬퍼
 */
async function insertProjectSubmission(params) {
    const {
        userId,
        centerId,
        platform,
        projectName,
        saveType,
        s3Url,
        s3Key,
        fileSizeKb,
        thumbnailUrl,
        analysis = {}
    } = params;

    return await db.queryDatabase(`
        INSERT INTO ProjectSubmissions 
        (user_id, center_id, platform, project_name, save_type, s3_url, s3_key, 
         file_size_kb, blocks_count, sprites_count, thumbnail_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
        userId,
        centerId,
        platform,
        projectName,
        saveType,
        s3Url,
        s3Key,
        fileSizeKb,
        analysis.blocksCount || 0,
        analysis.spritesCount || 0,
        thumbnailUrl
    ]);
}

module.exports = {
    saveProjectParallel,
    saveAutosaveOnly,
    updateProjectParallel,
    deleteProjectParallel,
    analyzeEntryProject,
    analyzeScratchProject,
    analyzeProject,
    SUBMISSION_TYPES,
    PLATFORM_CATEGORY_MAP
};
