/**
 * 스크래치 API 라우터
 * 3000번 서버에서 스크래치 프로젝트 저장/불러오기 처리
 * 8601 스크래치 GUI와 계정 연동
 */

const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../config');

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
// GET /api/auth/session
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
router.post('/scratch/save-project', requireAuth, async (req, res) => {
    try {
        const { projectData, title, isNew, isCopy, isRemix, originalId } = req.body;
        const userID = req.session.userID;
        const centerID = req.session.centerID;

        if (!projectData) {
            return res.status(400).json({
                success: false,
                message: '프로젝트 데이터가 필요합니다.'
            });
        }

        // 프로젝트 ID 생성 (타임스탬프 + 랜덤)
        const projectId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fileName = `${S3_SCRATCH_PATH}/${userID}/${projectId}.sb3`;

        // S3에 프로젝트 파일 업로드
        const uploadParams = {
            Bucket: S3_BUCKET,
            Key: fileName,
            Body: typeof projectData === 'string' ? projectData : JSON.stringify(projectData),
            ContentType: 'application/json'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // MySQL에 메타데이터 저장
        const insertQuery = `
            INSERT INTO ScratchProjects 
            (project_id, user_id, center_id, title, s3_path, is_copy, is_remix, original_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        await db.queryDatabase(insertQuery, [
            projectId,
            userID,
            centerID,
            title || '제목 없음',
            fileName,
            isCopy ? 1 : 0,
            isRemix ? 1 : 0,
            originalId || null
        ]);

        console.log(`스크래치 프로젝트 저장 완료: ${projectId} by ${userID}`);

        res.json({
            success: true,
            projectId: projectId,
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
// API: 프로젝트 수정 (기존 프로젝트)
// PUT /api/scratch/save-project/:projectId
// =====================================================================
router.put('/scratch/save-project/:projectId', requireAuth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { projectData, title } = req.body;
        const userID = req.session.userID;

        if (!projectData) {
            return res.status(400).json({
                success: false,
                message: '프로젝트 데이터가 필요합니다.'
            });
        }

        // 프로젝트 소유권 확인
        const [project] = await db.queryDatabase(
            'SELECT * FROM ScratchProjects WHERE project_id = ? AND user_id = ?',
            [projectId, userID]
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // S3에 프로젝트 파일 업데이트
        const uploadParams = {
            Bucket: S3_BUCKET,
            Key: project.s3_path,
            Body: typeof projectData === 'string' ? projectData : JSON.stringify(projectData),
            ContentType: 'application/json'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // MySQL 메타데이터 업데이트
        const updateQuery = `
            UPDATE ScratchProjects 
            SET title = ?, updated_at = NOW()
            WHERE project_id = ? AND user_id = ?
        `;

        await db.queryDatabase(updateQuery, [
            title || project.title,
            projectId,
            userID
        ]);

        console.log(`스크래치 프로젝트 업데이트 완료: ${projectId} by ${userID}`);

        res.json({
            success: true,
            projectId: projectId,
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
router.get('/scratch/projects', requireAuth, async (req, res) => {
    try {
        const userID = req.session.userID;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // 프로젝트 목록 조회
        const projects = await db.queryDatabase(`
            SELECT project_id, title, created_at, updated_at, is_copy, is_remix
            FROM ScratchProjects 
            WHERE user_id = ?
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
        `, [userID, parseInt(limit), parseInt(offset)]);

        // 전체 개수 조회
        const [countResult] = await db.queryDatabase(
            'SELECT COUNT(*) as total FROM ScratchProjects WHERE user_id = ?',
            [userID]
        );

        res.json({
            success: true,
            projects: projects,
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
// API: 프로젝트 불러오기
// GET /api/scratch/project/:projectId
// =====================================================================
router.get('/scratch/project/:projectId', requireAuth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userID = req.session.userID;

        // 프로젝트 메타데이터 조회
        const [project] = await db.queryDatabase(
            'SELECT * FROM ScratchProjects WHERE project_id = ? AND user_id = ?',
            [projectId, userID]
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // S3에서 프로젝트 데이터 가져오기 (Presigned URL 생성)
        const getCommand = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: project.s3_path
        });

        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

        res.json({
            success: true,
            project: {
                id: project.project_id,
                title: project.title,
                createdAt: project.created_at,
                updatedAt: project.updated_at
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
// DELETE /api/scratch/project/:projectId
// =====================================================================
router.delete('/scratch/project/:projectId', requireAuth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userID = req.session.userID;

        // 프로젝트 조회
        const [project] = await db.queryDatabase(
            'SELECT * FROM ScratchProjects WHERE project_id = ? AND user_id = ?',
            [projectId, userID]
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // S3에서 파일 삭제
        const deleteCommand = new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: project.s3_path
        });

        await s3Client.send(deleteCommand);

        // MySQL에서 메타데이터 삭제
        await db.queryDatabase(
            'DELETE FROM ScratchProjects WHERE project_id = ? AND user_id = ?',
            [projectId, userID]
        );

        console.log(`스크래치 프로젝트 삭제 완료: ${projectId} by ${userID}`);

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
router.get('/scratch/template/:templateId', async (req, res) => {
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
