/**
 * 스크래치 API 라우터
 * UserFiles + ProjectSubmissions 병렬 저장 모델
 * - UserFiles: 용량 관리 (quotaChecker 연동)
 * - ProjectSubmissions: 학습 평가 (CT 분석 연동)
 * 
 * @updated 2025-12-31 병렬 저장 모델 적용
 */

const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../config');

// 🔥 병렬 저장 모듈 (UserFiles + ProjectSubmissions)
const parallelSave = require('../../lib_storage/parallelSave');

// quotaChecker 모듈 (용량 체크용)
const { canUpload } = require('../../lib_storage/quotaChecker');

// S3 클라이언트 설정 (EC2 IAM Role 자동 사용)
const s3Client = new S3Client({
    region: config.S3.REGION
    // credentials 생략 → EC2 IAM Role 자동 감지
});

// S3 버킷 및 경로 설정
const S3_BUCKET = config.S3.BUCKET_NAME;
const S3_SCRATCH_PATH = 'scratch/projects';
const S3_THUMBNAIL_PATH = 'scratch/thumbnails';

// =====================================================================
// 헬퍼 함수
// =====================================================================

/**
 * 세션 userID로 DB user.id 조회
 */
async function getUserDbId(userID) {
    const [user] = await db.queryDatabase(
        'SELECT id, centerID FROM Users WHERE userID = ?',
        [userID]
    );
    return user;
}

// =====================================================================
// 인증 미들웨어
// =====================================================================
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.is_logined) {
        return res.status(401).json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }
    next();
};

// =====================================================================
// API: 세션 정보 조회 (스크래치에서 호출)
// GET /api/scratch/auth/session
// =====================================================================
router.get('/auth/session', (req, res) => {
    try {
        if (req.session && req.session.is_logined) {
            res.json({
                loggedIn: true,
                user: {
                    id: req.session.userId || req.session.userID,
                    userID: req.session.userID,
                    name: req.session.name || req.session.userID,
                    role: req.session.role,
                    centerID: req.session.centerID,
                    profileImage: req.session.profileImage || '/resource/profiles/default.webp'
                }
            });
        } else {
            res.json({
                loggedIn: false,
                user: null
            });
        }
    } catch (error) {
        console.error('세션 조회 오류:', error);
        res.status(500).json({
            loggedIn: false,
            error: '세션 조회 중 오류가 발생했습니다.'
        });
    }
});

// =====================================================================
// API: 프로젝트 저장 (새 프로젝트) - 병렬 저장 모델
// POST /api/scratch/save-project
// UserFiles + ProjectSubmissions 동시 저장
// =====================================================================
router.post('/save-project', requireAuth, async (req, res) => {
    try {
        const { projectData, title, thumbnail, saveType } = req.body;
        const userID = req.session.userID;
        const centerID = req.session.centerID;

        if (!projectData) {
            return res.status(400).json({
                success: false,
                message: '프로젝트 데이터가 필요합니다.'
            });
        }

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // Base64를 Buffer로 변환
        let fileBuffer;
        let parsedProjectData = null;
        try {
            fileBuffer = Buffer.from(projectData, 'base64');
            // 프로젝트 데이터 파싱 (CT 분석용)
            try {
                parsedProjectData = JSON.parse(fileBuffer.toString('utf8'));
            } catch (parseErr) {
                console.log('프로젝트 JSON 파싱 실패 (무시):', parseErr.message);
            }
        } catch (e) {
            fileBuffer = Buffer.from(projectData);
        }

        const fileSize = fileBuffer.length;
        const actualSaveType = saveType || 'projects'; // 'autosave' 또는 'projects'

        // 프로젝트 ID 및 S3 경로 생성
        const projectId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const projectTitle = title || '제목 없음';
        const s3Key = `${S3_SCRATCH_PATH}/${encodeURIComponent(userID)}/${projectId}.sb3`;

        // 🔥 자동저장: ProjectSubmissions만 저장 (용량 미산정)
        if (actualSaveType === 'autosave') {
            console.log('🔄 [자동저장] ProjectSubmissions만 저장');

            // S3 업로드
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: 'application/x-scratch'
            }));

            const s3Url = `${config.S3.DIRECT_URL}/${s3Key}`;

            // ProjectSubmissions만 저장 (용량 미산정)
            const autosaveResult = await parallelSave.saveAutosaveOnly({
                userId: user.id,
                centerId: user.centerID || centerID,
                userID: userID,
                platform: 'scratch',
                projectName: `${projectTitle}.sb3`,
                projectBuffer: fileBuffer,
                s3Url: s3Url,
                s3Key: s3Key,
                thumbnailUrl: null,
                projectData: parsedProjectData
            });

            return res.json({
                success: true,
                projectId: projectId,
                projectSubmissionId: autosaveResult.projectSubmissionId,
                isAutosave: true,
                message: '자동저장 완료'
            });
        }

        // 🔥 수동저장: 용량 체크 후 병렬 저장
        const quotaCheck = await canUpload(user.id, user.centerID, fileSize);
        if (!quotaCheck.allowed) {
            return res.status(413).json({
                success: false,
                message: quotaCheck.message
            });
        }

        // S3에 프로젝트 업로드
        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: 'application/x-scratch'
        }));

        // 썸네일 업로드 (thumbnail 이 있는 경우)
        let thumbnailUrl = null;
        if (thumbnail) {
            try {
                const base64Data = thumbnail.replace(/^data:image\/\w+;base64,/, '');
                const thumbnailBuffer = Buffer.from(base64Data, 'base64');
                const thumbnailKey = `${S3_THUMBNAIL_PATH}/${encodeURIComponent(userID)}/${projectId}.png`;

                await s3Client.send(new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: thumbnailKey,
                    Body: thumbnailBuffer,
                    ContentType: 'image/png'
                }));

                thumbnailUrl = `${config.S3.DIRECT_URL}/${thumbnailKey}`;
                console.log(`썸네일 저장 완료: ${thumbnailKey}`);
            } catch (thumbError) {
                console.error('썸네일 저장 실패 (무시하고 계속):', thumbError.message);
            }
        }

        const s3Url = `${config.S3.DIRECT_URL}/${s3Key}`;

        // 🔥 병렬 저장: UserFiles + ProjectSubmissions 동시 INSERT
        const saveResult = await parallelSave.saveProjectParallel({
            userId: user.id,
            centerId: user.centerID || centerID,
            userID: userID,
            platform: 'scratch',
            projectName: `${projectTitle}.sb3`,
            projectBuffer: fileBuffer,
            saveType: actualSaveType,
            s3Url: s3Url,
            s3Key: s3Key,
            thumbnailUrl: thumbnailUrl,
            projectData: parsedProjectData
        });

        console.log(`✅ 스크래치 병렬 저장 완료: ${projectId} by ${userID}`, {
            fileId: saveResult.userFileId,
            submissionId: saveResult.projectSubmissionId,
            fileSize: saveResult.fileSize
        });

        res.json({
            success: true,
            projectId: projectId,
            fileId: saveResult.userFileId,
            projectSubmissionId: saveResult.projectSubmissionId,
            thumbnailUrl: thumbnailUrl,
            message: '프로젝트가 저장되었습니다.'
        });

    } catch (error) {
        console.error('프로젝트 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 저장 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// =====================================================================
// API: 프로젝트 수정 (기존 프로젝트 덮어쓰기) - 병렬 저장 모델
// PUT /api/scratch/save-project/:fileId
// UserFiles + ProjectSubmissions 동시 UPDATE
// =====================================================================
router.put('/save-project/:fileId', requireAuth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { projectData, title, thumbnail } = req.body;
        const userID = req.session.userID;
        const centerID = req.session.centerID;

        if (!projectData) {
            return res.status(400).json({
                success: false,
                message: '프로젝트 데이터가 필요합니다.'
            });
        }

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 기존 파일 조회 (UserFiles)
        const [existingFile] = await db.queryDatabase(
            'SELECT * FROM UserFiles WHERE id = ? AND user_id = ? AND file_category = ? AND is_deleted = FALSE',
            [fileId, user.id, 'scratch']
        );

        if (!existingFile) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // Base64를 Buffer로 변환
        let fileBuffer;
        let parsedProjectData = null;
        try {
            fileBuffer = Buffer.from(projectData, 'base64');
            // 프로젝트 데이터 파싱 (CT 분석용)
            try {
                parsedProjectData = JSON.parse(fileBuffer.toString('utf8'));
            } catch (parseErr) {
                console.log('프로젝트 JSON 파싱 실패 (무시):', parseErr.message);
            }
        } catch (e) {
            fileBuffer = Buffer.from(projectData);
        }

        const newFileSize = fileBuffer.length;
        const oldFileSize = existingFile.file_size;
        const sizeDiff = newFileSize - oldFileSize;

        // 용량 증가분 체크 (크기가 커진 경우만)
        if (sizeDiff > 0) {
            const quotaCheck = await canUpload(user.id, user.centerID, sizeDiff);
            if (!quotaCheck.allowed) {
                return res.status(413).json({
                    success: false,
                    message: quotaCheck.message
                });
            }
        }

        // S3에 프로젝트 업로드 (덮어쓰기)
        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: existingFile.stored_name,
            Body: fileBuffer,
            ContentType: 'application/x-scratch'
        }));

        // 썸네일 업데이트
        let thumbnailUrl = existingFile.thumbnail_url;
        if (thumbnail) {
            try {
                const projectIdMatch = existingFile.stored_name.match(/\/([^/]+)\.sb3$/);
                const projectId = projectIdMatch ? projectIdMatch[1] : fileId;

                const base64Data = thumbnail.replace(/^data:image\/\w+;base64,/, '');
                const thumbnailBuffer = Buffer.from(base64Data, 'base64');
                const thumbnailKey = `${S3_THUMBNAIL_PATH}/${encodeURIComponent(userID)}/${projectId}.png`;

                await s3Client.send(new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: thumbnailKey,
                    Body: thumbnailBuffer,
                    ContentType: 'image/png'
                }));

                thumbnailUrl = `${config.S3.DIRECT_URL}/${thumbnailKey}`;
                console.log(`썸네일 업데이트 완료: ${thumbnailKey}`);
            } catch (thumbError) {
                console.error('썸네일 업데이트 실패 (무시하고 계속):', thumbError.message);
            }
        }

        const newTitle = title ? `${title}.sb3` : existingFile.original_name;
        const s3Url = existingFile.s3_url;

        // 🔥 ProjectSubmissions에서 매칭되는 레코드 찾기 (s3_url 기준)
        const [existingSubmission] = await db.queryDatabase(
            `SELECT id FROM ProjectSubmissions 
             WHERE user_id = ? AND platform = 'scratch' AND s3_url = ? 
               AND (is_deleted = FALSE OR is_deleted IS NULL)
             ORDER BY updated_at DESC LIMIT 1`,
            [user.id, s3Url]
        );

        if (existingSubmission) {
            // 🔥 병렬 UPDATE: UserFiles + ProjectSubmissions
            await parallelSave.updateProjectParallel({
                userId: user.id,
                centerId: user.centerID || centerID,
                userID: userID,
                platform: 'scratch',
                projectSubmissionId: existingSubmission.id,
                userFileId: parseInt(fileId),
                projectName: newTitle,
                projectBuffer: fileBuffer,
                s3Url: s3Url,
                s3Key: existingFile.stored_name,
                thumbnailUrl: thumbnailUrl,
                saveType: 'projects',
                projectData: parsedProjectData
            });

            console.log(`✅ 스크래치 병렬 UPDATE 완료: fileId=${fileId}, submissionId=${existingSubmission.id}`);
        } else {
            // ProjectSubmissions에 매칭 레코드가 없는 경우 (레거시 데이터)
            // UserFiles만 업데이트 + 용량 조정
            const { increaseUsage, decreaseUsage } = require('../../lib_storage/quotaChecker');

            if (sizeDiff > 0) {
                await increaseUsage(user.id, user.centerID, sizeDiff, 'scratch');
            } else if (sizeDiff < 0) {
                await decreaseUsage(user.id, user.centerID, Math.abs(sizeDiff), 'scratch');
            }

            await db.queryDatabase(
                'UPDATE UserFiles SET original_name = ?, file_size = ?, thumbnail_url = ? WHERE id = ?',
                [newTitle, newFileSize, thumbnailUrl, fileId]
            );

            console.log(`✅ 스크래치 UserFiles만 UPDATE (레거시): fileId=${fileId}`);
        }

        res.json({
            success: true,
            fileId: parseInt(fileId),
            projectSubmissionId: existingSubmission?.id || null,
            thumbnailUrl: thumbnailUrl,
            message: '프로젝트가 업데이트되었습니다.'
        });

    } catch (error) {
        console.error('프로젝트 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 업데이트 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// =====================================================================
// API: 사용자 프로젝트 목록 조회
// GET /api/scratch/projects
// =====================================================================
router.get('/projects', requireAuth, async (req, res) => {
    try {
        const userID = req.session.userID;
        const pageNum = Number(req.query.page) || 1;
        const limitNum = Number(req.query.limit) || 20;
        const offsetNum = (pageNum - 1) * limitNum;

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 프로젝트 목록 조회 (UserFiles에서 scratch 카테고리)
        // MySQL prepared statement에서 LIMIT/OFFSET은 직접 삽입
        const projects = await db.queryDatabase(`
            SELECT 
                id AS fileId,
                original_name AS title,
                stored_name AS s3Key,
                file_size AS size,
                s3_url AS url,
                thumbnail_url AS thumbnailUrl,
                created_at AS createdAt
            FROM UserFiles 
            WHERE user_id = ? AND file_category = 'scratch' AND is_deleted = FALSE
            ORDER BY created_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `, [user.id]);

        // 전체 개수 조회
        const [countResult] = await db.queryDatabase(
            'SELECT COUNT(*) as total FROM UserFiles WHERE user_id = ? AND file_category = ? AND is_deleted = FALSE',
            [user.id, 'scratch']
        );

        // 제목에서 .sb3 확장자 제거
        const formattedProjects = projects.map(p => ({
            ...p,
            title: p.title.replace(/\.sb3$/i, '')
        }));

        res.json({
            success: true,
            projects: formattedProjects,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / limitNum)
            }
        });

    } catch (error) {
        console.error('프로젝트 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 목록 조회 중 오류가 발생했습니다.'
        });
    }
});

// =====================================================================
// API: 프로젝트 불러오기 (Presigned URL)
// GET /api/scratch/project/:fileId
// =====================================================================
router.get('/project/:fileId', requireAuth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userID = req.session.userID;

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 파일 조회 (소유권 확인)
        const [file] = await db.queryDatabase(
            'SELECT * FROM UserFiles WHERE id = ? AND user_id = ? AND file_category = ? AND is_deleted = FALSE',
            [fileId, user.id, 'scratch']
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // S3 Presigned URL 생성 (1시간 유효)
        const getCommand = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: file.stored_name
        });

        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

        res.json({
            success: true,
            project: {
                fileId: file.id,
                title: file.original_name.replace(/\.sb3$/i, ''),
                size: file.file_size,
                createdAt: file.created_at
            },
            url: presignedUrl
        });

    } catch (error) {
        console.error('프로젝트 불러오기 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 불러오기 중 오류가 발생했습니다.'
        });
    }
});

// =====================================================================
// API: 프로젝트 삭제 - 병렬 삭제 모델
// DELETE /api/scratch/project/:fileId
// UserFiles + ProjectSubmissions 동시 삭제 (휴지통 없음, 영구 삭제)
// =====================================================================
router.delete('/project/:fileId', requireAuth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userID = req.session.userID;

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 파일 조회 (소유권 확인)
        const [file] = await db.queryDatabase(
            'SELECT * FROM UserFiles WHERE id = ? AND user_id = ? AND file_category = ? AND is_deleted = FALSE',
            [fileId, user.id, 'scratch']
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // S3에서 파일 삭제
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: file.stored_name
            }));
            console.log(`S3 파일 삭제: ${file.stored_name}`);
        } catch (s3Error) {
            console.error('S3 파일 삭제 실패 (계속 진행):', s3Error.message);
        }

        // 썸네일 삭제 (있는 경우)
        if (file.thumbnail_url) {
            try {
                const thumbnailMatch = file.stored_name.match(/\/([^/]+)\.sb3$/);
                const projectId = thumbnailMatch ? thumbnailMatch[1] : fileId;
                const thumbnailKey = `${S3_THUMBNAIL_PATH}/${encodeURIComponent(userID)}/${projectId}.png`;

                await s3Client.send(new DeleteObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: thumbnailKey
                }));
                console.log(`S3 썸네일 삭제: ${thumbnailKey}`);
            } catch (thumbError) {
                console.error('썸네일 삭제 실패 (무시):', thumbError.message);
            }
        }

        // 🔥 ProjectSubmissions에서 매칭 레코드 찾기
        const [existingSubmission] = await db.queryDatabase(
            `SELECT id FROM ProjectSubmissions 
             WHERE user_id = ? AND platform = 'scratch' AND s3_url = ?
             ORDER BY updated_at DESC LIMIT 1`,
            [user.id, file.s3_url]
        );

        // 🔥 병렬 삭제: UserFiles + ProjectSubmissions + 용량 반환
        await parallelSave.deleteProjectParallel({
            userId: user.id,
            centerId: user.centerID,
            platform: 'scratch',
            userFileId: parseInt(fileId),
            projectSubmissionId: existingSubmission?.id || null,
            fileSize: file.file_size,
            hardDelete: false // soft delete (is_deleted = TRUE)
        });

        // 갤러리 레코드도 비활성화 (공유된 경우)
        if (file.is_public) {
            await db.queryDatabase(
                `UPDATE gallery_projects SET is_active = 0 WHERE user_id = ? AND platform = 'scratch' AND s3_url = ?`,
                [user.id, file.s3_url]
            );
        }

        console.log(`✅ 스크래치 병렬 삭제 완료: fileId=${fileId}, submissionId=${existingSubmission?.id || 'N/A'}`);

        res.json({
            success: true,
            message: '프로젝트가 삭제되었습니다.'
        });

    } catch (error) {
        console.error('프로젝트 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 삭제 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// =====================================================================
// API: 템플릿 프로젝트 불러오기 (교육용)
// GET /api/scratch/template/:templateId
// =====================================================================
router.get('/template/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;

        // 템플릿 파일 경로
        const templatePath = `scratch/templates/${templateId}.sb3`;

        // S3에서 템플릿 가져오기 (Presigned URL)
        const getCommand = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: templatePath
        });

        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

        res.json({
            success: true,
            templateId: templateId,
            url: presignedUrl
        });

    } catch (error) {
        console.error('템플릿 불러오기 오류:', error);
        res.status(500).json({
            success: false,
            message: '템플릿 불러오기 중 오류가 발생했습니다.'
        });
    }
});

// =====================================================================
// 갤러리 공유 API
// =====================================================================

/**
 * 프로젝트 공개 상태 조회
 * GET /api/scratch/project/:fileId/status
 */
router.get('/project/:fileId/status', requireAuth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userID = req.session.userID;

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 파일 조회 (소유권 확인)
        const [file] = await db.queryDatabase(
            'SELECT id, is_public FROM UserFiles WHERE id = ? AND user_id = ? AND file_category = ? AND is_deleted = FALSE',
            [fileId, user.id, 'scratch']
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        res.json({
            success: true,
            isPublic: file.is_public || false
        });

    } catch (error) {
        console.error('프로젝트 상태 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '상태 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

/**
 * 프로젝트를 갤러리에 공유/공유해제
 * PUT /api/scratch/share/:fileId
 * 
 * gallery_projects 테이블과 동기화하여 통합 갤러리에서 조회 가능하도록 함
 */
router.put('/share/:fileId', requireAuth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userID = req.session.userID;

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 파일 소유권 확인
        const [file] = await db.queryDatabase(
            'SELECT * FROM UserFiles WHERE id = ? AND user_id = ? AND file_category = ? AND is_deleted = FALSE',
            [fileId, user.id, 'scratch']
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // 공유 상태 토글
        const currentPublic = file.is_public || false;
        const newPublic = !currentPublic;

        // 1. UserFiles 테이블 업데이트
        await db.queryDatabase(
            `UPDATE UserFiles 
             SET is_public = ?, 
                 shared_at = ${newPublic ? 'NOW()' : 'NULL'}
             WHERE id = ?`,
            [newPublic, fileId]
        );

        // 2. gallery_projects 테이블 동기화
        if (newPublic) {
            // 공유 시: gallery_projects에 INSERT 또는 UPDATE
            const projectTitle = file.original_name.replace(/\.sb3$/i, '');
            const embedUrl = `/scratch/?project_file=${encodeURIComponent(file.s3_url)}&mode=player&embed=1`;

            // 기존 레코드 확인 (UserFiles.id를 submission_id로 활용)
            const [existingGallery] = await db.queryDatabase(
                `SELECT id FROM gallery_projects WHERE user_id = ? AND platform = 'scratch' AND s3_url = ?`,
                [user.id, file.s3_url]
            );

            if (existingGallery) {
                // 기존 레코드가 있으면 활성화
                await db.queryDatabase(
                    `UPDATE gallery_projects SET is_active = 1, visibility = 'class' WHERE id = ?`,
                    [existingGallery.id]
                );
                console.log(`갤러리 레코드 재활성화: gallery_id=${existingGallery.id}`);
            } else {
                // 새로 INSERT
                const insertResult = await db.queryDatabase(
                    `INSERT INTO gallery_projects 
                     (user_id, title, description, platform, s3_url, s3_key, thumbnail_url, embed_url, visibility, tags, metadata)
                     VALUES (?, ?, ?, 'scratch', ?, ?, ?, ?, 'class', '[]', '{}')`,
                    [
                        user.id,
                        projectTitle,
                        null,
                        file.s3_url,
                        file.stored_name,
                        file.thumbnail_url,
                        embedUrl
                    ]
                );
                console.log(`갤러리 레코드 생성: gallery_id=${insertResult.insertId}`);
            }
        } else {
            // 공유 해제 시: gallery_projects에서 soft delete
            await db.queryDatabase(
                `UPDATE gallery_projects SET is_active = 0 WHERE user_id = ? AND platform = 'scratch' AND s3_url = ?`,
                [user.id, file.s3_url]
            );
            console.log(`갤러리 레코드 비활성화: s3_url=${file.s3_url}`);
        }

        console.log(`스크래치 프로젝트 공유 상태 변경: fileId=${fileId}, isPublic=${newPublic}`);

        res.json({
            success: true,
            message: newPublic ? '갤러리에 공유되었습니다!' : '갤러리 공유가 해제되었습니다.',
            isPublic: newPublic
        });

    } catch (error) {
        console.error('갤러리 공유 오류:', error);
        res.status(500).json({
            success: false,
            message: '공유 처리 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

/**
 * 공개된 프로젝트 목록 조회 (갤러리용)
 * GET /api/scratch/gallery
 */
router.get('/gallery', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { userId, category } = req.query;

        let whereClause = 'uf.is_public = TRUE AND uf.is_deleted = FALSE';
        let params = [];

        // 카테고리 필터 (scratch, entry, python)
        if (category) {
            whereClause += ' AND uf.file_category = ?';
            params.push(category);
        } else {
            whereClause += " AND uf.file_category IN ('scratch', 'entry', 'python')";
        }

        // 특정 유저 필터
        if (userId) {
            whereClause += ' AND u.userID = ?';
            params.push(userId);
        }

        // 공개된 프로젝트 조회
        const projects = await db.queryDatabase(
            `SELECT 
                uf.id,
                uf.original_name,
                uf.s3_url,
                uf.thumbnail_url,
                uf.file_size,
                uf.file_category,
                uf.shared_at,
                uf.view_count,
                uf.like_count,
                u.id as authorId,
                u.userID,
                u.name as userName,
                u.profile_image
             FROM UserFiles uf
             JOIN Users u ON uf.user_id = u.id
             WHERE ${whereClause}
             ORDER BY uf.shared_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        // 전체 개수
        const [countResult] = await db.queryDatabase(
            `SELECT COUNT(*) as total 
             FROM UserFiles uf
             JOIN Users u ON uf.user_id = u.id
             WHERE ${whereClause}`,
            params
        );

        res.json({
            success: true,
            data: {
                projects,
                pagination: {
                    page,
                    limit,
                    total: countResult.total,
                    totalPages: Math.ceil(countResult.total / limit)
                }
            }
        });

    } catch (error) {
        console.error('갤러리 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '갤러리 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

/**
 * 갤러리 프로젝트 조회수 증가
 * POST /api/scratch/gallery/:fileId/view
 */
router.post('/gallery/:fileId/view', async (req, res) => {
    try {
        const { fileId } = req.params;

        await db.queryDatabase(
            'UPDATE UserFiles SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ? AND is_public = TRUE',
            [fileId]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 갤러리에 공개한 유저 목록 (프로필 격자용)
 * GET /api/scratch/gallery/users
 */
router.get('/gallery/users', async (req, res) => {
    try {
        const { category } = req.query;

        let categoryFilter = "uf.file_category IN ('scratch', 'entry', 'python')";
        if (category) {
            categoryFilter = 'uf.file_category = ?';
        }

        const users = await db.queryDatabase(
            `SELECT 
                u.id,
                u.userID,
                u.name,
                u.profile_image,
                COUNT(uf.id) as project_count,
                SUM(COALESCE(uf.view_count, 0)) as total_views,
                SUM(COALESCE(uf.like_count, 0)) as total_likes,
                MAX(uf.shared_at) as last_shared
             FROM Users u
             JOIN UserFiles uf ON u.id = uf.user_id
             WHERE uf.is_public = TRUE AND uf.is_deleted = FALSE AND ${categoryFilter}
             GROUP BY u.id
             ORDER BY last_shared DESC`,
            category ? [category] : []
        );

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('갤러리 유저 목록 오류:', error);
        res.status(500).json({
            success: false,
            message: '유저 목록 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

/**
 * 특정 유저의 공개 프로젝트 조회
 * GET /api/scratch/gallery/user/:userId
 */
router.get('/gallery/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { category } = req.query;

        // 유저 정보 조회
        const [targetUser] = await db.queryDatabase(
            'SELECT id, userID, name, profile_image FROM Users WHERE userID = ?',
            [userId]
        );

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        let categoryFilter = "uf.file_category IN ('scratch', 'entry', 'python')";
        let params = [targetUser.id];

        if (category) {
            categoryFilter = 'uf.file_category = ?';
            params.push(category);
        }

        // 해당 유저의 공개 프로젝트 조회
        const projects = await db.queryDatabase(
            `SELECT 
                uf.id,
                uf.original_name,
                uf.s3_url,
                uf.thumbnail_url,
                uf.file_size,
                uf.file_category,
                uf.shared_at,
                uf.view_count,
                uf.like_count
             FROM UserFiles uf
             WHERE uf.user_id = ? AND uf.is_public = TRUE AND uf.is_deleted = FALSE AND ${categoryFilter}
             ORDER BY uf.shared_at DESC`,
            params
        );

        // 통계
        const [stats] = await db.queryDatabase(
            `SELECT 
                COUNT(*) as project_count,
                SUM(COALESCE(view_count, 0)) as total_views,
                SUM(COALESCE(like_count, 0)) as total_likes
             FROM UserFiles
             WHERE user_id = ? AND is_public = TRUE AND is_deleted = FALSE`,
            [targetUser.id]
        );

        res.json({
            success: true,
            data: {
                user: targetUser,
                projects,
                stats
            }
        });

    } catch (error) {
        console.error('유저 갤러리 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '유저 갤러리 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

module.exports = router;
