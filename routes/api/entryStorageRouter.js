/**
 * 엔트리 스토리지 API 라우터
 * UserFiles 테이블을 사용하여 Scratch와 동일한 패턴으로 프로젝트 관리
 * quotaChecker 연동으로 용량 관리 자동화
 * 
 * 스크래치(scratchRouter.js)와 동일한 구조로 통일
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

// S3 클라이언트 설정 (EC2 IAM Role 자동 사용)
const s3Client = new S3Client({
    region: config.S3.REGION
    // credentials 생략 → EC2 IAM Role 자동 감지
});

// S3 버킷 및 경로 설정
const S3_BUCKET = config.S3.BUCKET_NAME;
const S3_ENTRY_PATH = 'entry/projects';

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
// API: 프로젝트 저장 (새 프로젝트)
// POST /api/entry-storage/save-project
// =====================================================================
router.post('/save-project', requireAuth, async (req, res) => {
    try {
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

        // Base64를 Buffer로 변환
        let fileBuffer;
        try {
            // projectData가 Base64 문자열인 경우
            if (typeof projectData === 'string') {
                fileBuffer = Buffer.from(projectData, 'base64');
            } else if (typeof projectData === 'object') {
                // JSON 객체인 경우 (Entry의 프로젝트 데이터)
                const jsonString = JSON.stringify(projectData);
                fileBuffer = Buffer.from(jsonString, 'utf-8');
            } else {
                fileBuffer = Buffer.from(projectData);
            }
        } catch (e) {
            console.error('프로젝트 데이터 변환 오류:', e);
            return res.status(400).json({
                success: false,
                message: '프로젝트 데이터 형식이 올바르지 않습니다.'
            });
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
        const s3Key = `${S3_ENTRY_PATH}/${userID}/${projectId}.ent`;

        // S3에 업로드
        const uploadParams = {
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: 'application/json'  // Entry 프로젝트는 JSON 기반
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // 썸네일이 있으면 별도 저장
        if (thumbnail) {
            try {
                const thumbBuffer = Buffer.from(thumbnail.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                const thumbKey = `${S3_ENTRY_PATH}/${userID}/${projectId}_thumb.png`;
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: thumbKey,
                    Body: thumbBuffer,
                    ContentType: 'image/png'
                }));
                
                console.log(`썸네일 저장 완료: ${thumbKey}`);
            } catch (thumbError) {
                console.warn('썸네일 저장 실패 (무시):', thumbError.message);
            }
        }

        // S3 URL 생성
        const s3Url = `https://${S3_BUCKET}.s3.${config.S3.REGION}.amazonaws.com/${s3Key}`;

        // 용량 증가 + UserFiles 테이블에 기록
        await increaseUsage(user.id, user.centerID, fileSize, 'entry');
        
        const fileId = await recordFile(user.id, user.centerID, {
            category: 'entry',
            originalName: `${projectTitle}.ent`,
            storedName: s3Key,
            size: fileSize,
            type: 'application/json',
            s3Url: s3Url
        });

        console.log(`엔트리 프로젝트 저장 완료: ${projectId} by ${userID} (${fileSize} bytes)`);

        res.json({
            success: true,
            projectId: projectId,
            fileId: fileId,
            s3Url: s3Url,
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
// PUT /api/entry-storage/save-project/:fileId
// =====================================================================
router.put('/save-project/:fileId', requireAuth, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { projectData, title, thumbnail } = req.body;
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
            [fileId, user.id, 'entry']
        );

        if (!existingFile) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
            });
        }

        // 데이터를 Buffer로 변환
        let fileBuffer;
        try {
            if (typeof projectData === 'string') {
                fileBuffer = Buffer.from(projectData, 'base64');
            } else if (typeof projectData === 'object') {
                const jsonString = JSON.stringify(projectData);
                fileBuffer = Buffer.from(jsonString, 'utf-8');
            } else {
                fileBuffer = Buffer.from(projectData);
            }
        } catch (e) {
            return res.status(400).json({
                success: false,
                message: '프로젝트 데이터 형식이 올바르지 않습니다.'
            });
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
            ContentType: 'application/json'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // 썸네일 업데이트
        if (thumbnail) {
            try {
                const thumbBuffer = Buffer.from(thumbnail.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                const thumbKey = existingFile.stored_name.replace('.ent', '_thumb.png');
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: thumbKey,
                    Body: thumbBuffer,
                    ContentType: 'image/png'
                }));
            } catch (thumbError) {
                console.warn('썸네일 업데이트 실패 (무시):', thumbError.message);
            }
        }

        // 용량 조정
        if (sizeDiff > 0) {
            await increaseUsage(user.id, user.centerID, sizeDiff, 'entry');
        } else if (sizeDiff < 0) {
            await decreaseUsage(user.id, user.centerID, Math.abs(sizeDiff), 'entry');
        }

        // 파일명(제목) 업데이트
        const newTitle = title ? `${title}.ent` : existingFile.original_name;
        await db.queryDatabase(
            'UPDATE UserFiles SET original_name = ?, file_size = ? WHERE id = ?',
            [newTitle, newFileSize, fileId]
        );

        console.log(`엔트리 프로젝트 업데이트 완료: fileId=${fileId} by ${userID}`);

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
// GET /api/entry-storage/projects
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

        // 프로젝트 목록 조회 (UserFiles에서 entry 카테고리)
        const projects = await db.queryDatabase(`
            SELECT 
                id AS fileId,
                original_name AS title,
                stored_name AS s3Key,
                file_size AS size,
                s3_url AS url,
                created_at AS createdAt
            FROM UserFiles 
            WHERE user_id = ? AND file_category = 'entry' AND is_deleted = FALSE
            ORDER BY created_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `, [user.id]);

        // 전체 개수 조회
        const [countResult] = await db.queryDatabase(
            'SELECT COUNT(*) as total FROM UserFiles WHERE user_id = ? AND file_category = ? AND is_deleted = FALSE',
            [user.id, 'entry']
        );

        // 제목에서 .ent 확장자 제거 + 썸네일 URL 추가
        const formattedProjects = projects.map(p => ({
            ...p,
            title: p.title.replace(/\.ent$/i, ''),
            thumbnailUrl: p.url ? p.url.replace('.ent', '_thumb.png') : null
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
// GET /api/entry-storage/project/:fileId
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
            [fileId, user.id, 'entry']
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

        // 썸네일 URL도 생성
        let thumbnailUrl = null;
        try {
            const thumbKey = file.stored_name.replace('.ent', '_thumb.png');
            const thumbCommand = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: thumbKey
            });
            thumbnailUrl = await getSignedUrl(s3Client, thumbCommand, { expiresIn: 3600 });
        } catch (e) {
            // 썸네일 없을 수 있음
        }

        res.json({
            success: true,
            project: {
                fileId: file.id,
                title: file.original_name.replace(/\.ent$/i, ''),
                size: file.file_size,
                createdAt: file.created_at
            },
            url: presignedUrl,
            thumbnailUrl: thumbnailUrl
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
// DELETE /api/entry-storage/project/:fileId
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
            [fileId, user.id, 'entry']
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

        // 썸네일도 삭제 시도
        try {
            const thumbKey = file.stored_name.replace('.ent', '_thumb.png');
            await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: thumbKey
            }));
        } catch (e) {
            // 썸네일 없을 수 있음
        }

        // 용량 감소 + 파일 삭제 표시
        await decreaseUsage(user.id, user.centerID, file.file_size, 'entry');
        await markFileDeleted(file.id);

        console.log(`엔트리 프로젝트 삭제 완료: fileId=${fileId} by ${userID}`);

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

module.exports = router;
