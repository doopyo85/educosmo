/**
 * 스크래치 API 라우터
 * UserFiles 테이블을 사용하여 Entry와 동일한 패턴으로 프로젝트 관리
 * quotaChecker 연동으로 용량 관리 자동화
 */

const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../config');

// quotaChecker 모듈 (용량 관리)
const {
    canUpload,
    increaseUsage,
    decreaseUsage,
    recordFile,
    markFileDeleted
} = require('../../lib_storage/quotaChecker');

// S3 클라이언트 설정
const s3Client = new S3Client({
    region: config.S3.REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// S3 버킷 및 경로 설정
const S3_BUCKET = config.S3.BUCKET_NAME;
const S3_SCRATCH_PATH = 'scratch/projects';

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
// API: 프로젝트 저장 (새 프로젝트)
// POST /api/scratch/save-project
// =====================================================================
router.post('/save-project', requireAuth, async (req, res) => {
    try {
        const { projectData, title } = req.body;
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
        try {
            fileBuffer = Buffer.from(projectData, 'base64');
        } catch (e) {
            fileBuffer = Buffer.from(projectData);
        }

        const fileSize = fileBuffer.length;

        // 용량 체크
        const quotaCheck = await canUpload(user.id, user.centerID, fileSize);
        if (!quotaCheck.allowed) {
            return res.status(413).json({
                success: false,
                message: quotaCheck.message
            });
        }

        // 프로젝트 ID 및 S3 경로 생성
        const projectId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const projectTitle = title || '제목 없음';
        const s3Key = `${S3_SCRATCH_PATH}/${userID}/${projectId}.sb3`;

        // S3에 업로드
        const uploadParams = {
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: 'application/x-scratch'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // S3 URL 생성
        const s3Url = `https://${S3_BUCKET}.s3.${config.S3.REGION}.amazonaws.com/${s3Key}`;

        // 용량 증가 + UserFiles 테이블에 기록
        await increaseUsage(user.id, user.centerID, fileSize, 'scratch');
        
        const fileId = await recordFile(user.id, user.centerID, {
            category: 'scratch',
            originalName: `${projectTitle}.sb3`,
            storedName: s3Key,
            size: fileSize,
            type: 'application/x-scratch',
            s3Url: s3Url
        });

        console.log(`스크래치 프로젝트 저장 완료: ${projectId} by ${userID} (${fileSize} bytes)`);

        res.json({
            success: true,
            projectId: projectId,
            fileId: fileId,
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
// API: 프로젝트 수정 (기존 프로젝트 덮어쓰기)
// PUT /api/scratch/save-project/:fileId
// =====================================================================
router.put('/save-project/:fileId', requireAuth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { projectData, title } = req.body;
        const userID = req.session.userID;

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

        // 기존 파일 조회 (소유권 확인)
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
        try {
            fileBuffer = Buffer.from(projectData, 'base64');
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

        // S3에 업로드 (덮어쓰기)
        const uploadParams = {
            Bucket: S3_BUCKET,
            Key: existingFile.stored_name,
            Body: fileBuffer,
            ContentType: 'application/x-scratch'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // 용량 조정
        if (sizeDiff > 0) {
            await increaseUsage(user.id, user.centerID, sizeDiff, 'scratch');
        } else if (sizeDiff < 0) {
            await decreaseUsage(user.id, user.centerID, Math.abs(sizeDiff), 'scratch');
        }

        // 파일명(제목) 업데이트
        const newTitle = title ? `${title}.sb3` : existingFile.original_name;
        await db.queryDatabase(
            'UPDATE UserFiles SET original_name = ?, file_size = ? WHERE id = ?',
            [newTitle, newFileSize, fileId]
        );

        console.log(`스크래치 프로젝트 업데이트 완료: fileId=${fileId} by ${userID}`);

        res.json({
            success: true,
            fileId: parseInt(fileId),
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
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // DB user.id 조회
        const user = await getUserDbId(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 프로젝트 목록 조회 (UserFiles에서 scratch 카테고리)
        const projects = await db.queryDatabase(`
            SELECT 
                id AS fileId,
                original_name AS title,
                stored_name AS s3Key,
                file_size AS size,
                s3_url AS url,
                created_at AS createdAt
            FROM UserFiles 
            WHERE user_id = ? AND file_category = 'scratch' AND is_deleted = FALSE
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [user.id, parseInt(limit), parseInt(offset)]);

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
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / limit)
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
// API: 프로젝트 삭제
// DELETE /api/scratch/project/:fileId
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
        const deleteCommand = new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: file.stored_name
        });

        await s3Client.send(deleteCommand);

        // 용량 감소 + 파일 삭제 표시
        await decreaseUsage(user.id, user.centerID, file.file_size, 'scratch');
        await markFileDeleted(file.id);

        console.log(`스크래치 프로젝트 삭제 완료: fileId=${fileId} by ${userID}`);

        res.json({
            success: true,
            message: '프로젝트가 삭제되었습니다.'
        });

    } catch (error) {
        console.error('프로젝트 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 삭제 중 오류가 발생했습니다.'
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

module.exports = router;
