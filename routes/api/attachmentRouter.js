const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');
const { attachmentUpload, processKoreanFilename } = require('../../lib_board/fileUpload');
const { validateUploadSecurity } = require('../../lib_board/securityValidator');
const { saveAttachment, getAttachmentsByPostId, deleteAttachment, getDownloadUrl } = require('../../lib_board/attachmentService');
const db = require('../../lib_login/db');

/**
 * 첨부파일 업로드 API
 * POST /api/board/attachments/upload
 */
router.post('/upload', authenticateUser, (req, res) => {
    // multer 미들웨어 실행
    attachmentUpload.array('files', 10)(req, res, async (err) => {
        if (err) {
            console.error('파일 업로드 오류:', err);
            
            let errorMessage = '파일 업로드 중 오류가 발생했습니다.';
            
            if (err.code === 'LIMIT_FILE_SIZE') {
                errorMessage = '파일 크기가 너무 큽니다.';
            } else if (err.code === 'LIMIT_FILE_COUNT') {
                errorMessage = '파일 개수가 너무 많습니다. (최대 10개)';
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            return res.status(400).json({
                success: false,
                error: errorMessage
            });
        }
        
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '업로드할 파일을 선택해주세요.'
                });
            }
            
            const userId = req.session.userID;
            const userRole = req.session.role;
            const clientIP = req.ip || req.connection.remoteAddress;
            
            console.log('파일 업로드 요청:', {
                userId,
                userRole,
                fileCount: req.files.length,
                clientIP
            });
            
            const uploadedFiles = [];
            const errors = [];
            
            // 각 파일에 대해 보안 검증 및 처리
            for (const file of req.files) {
                try {
                    // 🔥 한글 파일명 처리 (이미 multer에서 처리되었지만 한번 더 확인)
                    const originalName = processKoreanFilename(file.originalname);
                    
                    console.log('🔥 파일 처리:', {
                        original: file.originalname,
                        processed: originalName,
                        size: file.size,
                        type: file.mimetype
                    });
                    
                    // 보안 검증
                    const securityCheck = await validateUploadSecurity(
                        file, userId, userRole, null, clientIP
                    );
                    
                    if (!securityCheck.isValid) {
                        errors.push({
                            filename: originalName,
                            errors: securityCheck.errors
                        });
                        continue;
                    }
                    
                    // 파일 정보 구성
                    const fileInfo = {
                        key: file.key,
                        originalname: originalName, // 🔥 처리된 한글 파일명 사용
                        size: file.size,
                        mimetype: file.mimetype,
                        location: file.location,
                        bucket: file.bucket
                    };
                    
                    uploadedFiles.push({
                        tempId: Date.now() + Math.random(), // 임시 ID
                        key: file.key,
                        originalName: originalName, // 🔥 처리된 한글 파일명 사용
                        size: file.size,
                        type: file.mimetype,
                        url: file.location,
                        isImage: file.mimetype.startsWith('image/')
                    });
                    
                    console.log('파일 업로드 성공:', originalName);
                    
                } catch (fileError) {
                    console.error('파일 처리 오류:', fileError);
                    errors.push({
                        filename: file.originalname,
                        errors: [fileError.message]
                    });
                }
            }
            
            // 업로드 로그 기록
            try {
                await logUploadActivity(userId, clientIP, req.files, uploadedFiles, errors);
            } catch (logError) {
                console.error('업로드 로그 기록 오류:', logError);
            }
            
            // 결과 반환
            res.json({
                success: true,
                files: uploadedFiles,
                errors: errors,
                message: `${uploadedFiles.length}개 파일이 업로드되었습니다.`
            });
            
        } catch (error) {
            console.error('파일 업로드 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: '파일 업로드 처리 중 오류가 발생했습니다.'
            });
        }
    });
});

/**
 * 게시글 첨부파일 연결 API
 * POST /api/board/posts/:postId/attachments
 */
router.post('/posts/:postId/attachments', authenticateUser, async (req, res) => {
    try {
        const { postId } = req.params;
        const { fileKeys } = req.body; // S3 키 배열
        const userId = req.session.userID;
        
        if (!fileKeys || !Array.isArray(fileKeys) || fileKeys.length === 0) {
            return res.status(400).json({
                success: false,
                error: '연결할 파일을 선택해주세요.'
            });
        }
        
        // 게시글 존재 및 권한 확인
        const posts = await db.queryDatabase(
            'SELECT * FROM board_posts WHERE id = ?',
            [postId]
        );
        
        if (posts.length === 0) {
            return res.status(404).json({
                success: false,
                error: '게시글을 찾을 수 없습니다.'
            });
        }
        
        const post = posts[0];
        const canEdit = post.author === userId || ['admin', 'manager'].includes(req.session.role);
        
        if (!canEdit) {
            return res.status(403).json({
                success: false,
                error: '첨부파일을 추가할 권한이 없습니다.'
            });
        }
        
        const attachedFiles = [];
        
        // 각 파일을 정식 첨부파일로 등록
        for (const fileKey of fileKeys) {
            try {
                // 🔥 S3에서 파일 메타데이터 가져오기 (한글 파일명 복원)
                const s3Metadata = await getS3FileMetadata(fileKey);
                
                const attachmentData = {
                    post_id: postId,
                    original_name: s3Metadata.originalName || fileKey.split('/').pop(),
                    stored_name: fileKey,
                    file_size: s3Metadata.fileSize || 0,
                    file_type: s3Metadata.contentType || 'application/octet-stream',
                    s3_url: `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${fileKey}`,
                    is_image: fileKey.includes('images/') || (s3Metadata.contentType && s3Metadata.contentType.startsWith('image/'))
                };
                
                const result = await db.queryDatabase(`
                    INSERT INTO board_attachments 
                    (post_id, original_name, stored_name, file_size, file_type, s3_url, is_image, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    attachmentData.post_id,
                    attachmentData.original_name,
                    attachmentData.stored_name,
                    attachmentData.file_size,
                    attachmentData.file_type,
                    attachmentData.s3_url,
                    attachmentData.is_image
                ]);
                
                attachedFiles.push({
                    id: result.insertId,
                    ...attachmentData
                });
                
            } catch (attachError) {
                console.error('첨부파일 등록 오류:', attachError);
            }
        }
        
        // 게시글 첨부파일 개수 업데이트
        await updatePostAttachmentCount(postId);
        
        res.json({
            success: true,
            attachments: attachedFiles,
            message: `${attachedFiles.length}개 파일이 첨부되었습니다.`
        });
        
    } catch (error) {
        console.error('첨부파일 연결 오류:', error);
        res.status(500).json({
            success: false,
            error: '첨부파일 연결 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 게시글 첨부파일 목록 조회 API
 * GET /api/board/posts/:postId/attachments
 */
router.get('/posts/:postId/attachments', async (req, res) => {
    try {
        const { postId } = req.params;
        
        const attachments = await getAttachmentsByPostId(postId);
        
        res.json({
            success: true,
            attachments: attachments
        });
        
    } catch (error) {
        console.error('첨부파일 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '첨부파일 목록을 불러오는 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 첨부파일 다운로드 API
 * GET /api/board/attachments/:id/download
 */
router.get('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session?.userID;
        
        console.log('파일 다운로드 요청:', {
            attachmentId: id,
            userId: userId || 'anonymous',
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });
        
        // 첨부파일 정보 및 다운로드 URL 생성
        const downloadInfo = await getDownloadUrl(id, userId);
        
        console.log('다운로드 URL 생성 완료:', {
            filename: downloadInfo.filename,
            size: downloadInfo.file_size
        });
        
        // 🔥 다운로드 카운터 업데이트
        await updateDownloadCounter(id, userId, req.ip);
        
        // 🔥 개선: JSON 응답으로 변경 (보안 강화)
        res.json({
            success: true,
            download_url: downloadInfo.download_url,
            filename: downloadInfo.filename,
            file_size: downloadInfo.file_size,
            expires_in: 900 // 15분
        });
        
    } catch (error) {
        console.error('파일 다운로드 오류:', error);
        
        let statusCode = 500;
        let errorMessage = '파일 다운로드 중 오류가 발생했습니다.';
        
        if (error.message.includes('찾을 수 없습니다')) {
            statusCode = 404;
            errorMessage = '파일을 찾을 수 없습니다.';
        } else if (error.message.includes('권한')) {
            statusCode = 403;
            errorMessage = '파일 다운로드 권한이 없습니다.';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * 첨부파일 다운로드 카운트 조회 API
 * GET /api/board/attachments/:id/count
 */
router.get('/:id/count', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [attachment] = await db.queryDatabase(
            'SELECT download_count FROM board_attachments WHERE id = ?',
            [id]
        );
        
        if (!attachment) {
            return res.status(404).json({
                success: false,
                error: '첨부파일을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            download_count: attachment.download_count || 0
        });
        
    } catch (error) {
        console.error('다운로드 카운트 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '다운로드 카운트를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 첨부파일 삭제 API
 * DELETE /api/board/attachments/:id
 */
router.delete('/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userID;
        const userRole = req.session.role;
        
        console.log('첨부파일 삭제 요청:', {
            attachmentId: id,
            userId,
            userRole
        });
        
        // 첨부파일 정보 조회 (삭제 전 로깅용)
        const attachments = await db.queryDatabase(
            'SELECT * FROM board_attachments WHERE id = ?',
            [id]
        );
        
        if (attachments.length === 0) {
            return res.status(404).json({
                success: false,
                error: '첨부파일을 찾을 수 없습니다.'
            });
        }
        
        const attachment = attachments[0];
        
        // 삭제 실행
        const result = await deleteAttachment(id, userId, userRole);
        
        // 게시글 첨부파일 개수 업데이트
        await updatePostAttachmentCount(attachment.post_id);
        
        console.log('첨부파일 삭제 완료:', {
            attachmentId: id,
            filename: attachment.original_name,
            s3Key: attachment.stored_name
        });
        
        res.json({
            success: true,
            message: `파일 '${attachment.original_name}'이(가) 삭제되었습니다.`
        });
        
    } catch (error) {
        console.error('첨부파일 삭제 오류:', error);
        
        let statusCode = 500;
        let errorMessage = '첨부파일 삭제 중 오류가 발생했습니다.';
        
        if (error.message.includes('찾을 수 없습니다')) {
            statusCode = 404;
            errorMessage = '첨부파일을 찾을 수 없습니다.';
        } else if (error.message.includes('권한')) {
            statusCode = 403;
            errorMessage = '첨부파일을 삭제할 권한이 없습니다.';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

// === 헬퍼 함수들 ===

/**
 * 🔥 S3 파일 메타데이터 조회 (한글 파일명 복원)
 */
async function getS3FileMetadata(s3Key) {
    try {
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const { s3Client, BUCKET_NAME } = require('../../lib_board/fileUpload');
        
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key
        });
        
        const response = await s3Client.send(command);
        
        let originalName = s3Key.split('/').pop(); // 기본값
        
        // 메타데이터에서 한글 파일명 복원
        if (response.Metadata && response.Metadata['original-name-utf8']) {
            try {
                const decodedName = Buffer.from(response.Metadata['original-name-utf8'], 'base64').toString('utf8');
                if (decodedName && decodedName.length > 0) {
                    originalName = decodedName;
                }
            } catch (decodeError) {
                console.warn('파일명 디코딩 실패:', decodeError);
            }
        }
        
        return {
            originalName: originalName,
            fileSize: response.ContentLength || 0,
            contentType: response.ContentType || 'application/octet-stream',
            lastModified: response.LastModified,
            metadata: response.Metadata
        };
        
    } catch (error) {
        console.error('S3 메타데이터 조회 오류:', error);
        return {
            originalName: s3Key.split('/').pop(),
            fileSize: 0,
            contentType: 'application/octet-stream'
        };
    }
}

/**
 * 업로드 활동 로그 기록
 */
async function logUploadActivity(userId, clientIP, uploadedFiles, successFiles, errors) {
    try {
        for (const file of uploadedFiles) {
            const isSuccess = successFiles.some(f => f.originalName === file.originalname);
            const fileErrors = errors.find(e => e.filename === file.originalname);
            
            // 실제 구현에서는 board_upload_logs 테이블에 기록
            console.log('Upload Log:', {
                userId,
                ip: clientIP,
                filename: file.originalname,
                size: file.size,
                result: isSuccess ? 'success' : 'failed',
                errors: fileErrors?.errors
            });
        }
    } catch (error) {
        console.error('업로드 로그 기록 오류:', error);
    }
}

/**
 * 다운로드 카운터 업데이트
 */
async function updateDownloadCounter(attachmentId, userId, clientIP) {
    try {
        // 다운로드 카운트 증가
        await db.queryDatabase(
            'UPDATE board_attachments SET download_count = download_count + 1 WHERE id = ?',
            [attachmentId]
        );
        
        // 다운로드 로그 기록 (선택사항)
        // await db.queryDatabase(`
        //     INSERT INTO board_download_logs (attachment_id, user_id, ip_address, downloaded_at)
        //     VALUES (?, ?, ?, NOW())
        // `, [attachmentId, userId, clientIP]);
        
        console.log(`다운로드 카운터 업데이트: attachment ${attachmentId}, user ${userId || 'anonymous'}`);
        
    } catch (error) {
        console.error('다운로드 카운터 업데이트 오류:', error);
        // 카운터 업데이트 실패해도 다운로드는 진행
    }
}

/**
 * 게시글 첨부파일 개수 업데이트
 */
async function updatePostAttachmentCount(postId) {
    try {
        await db.queryDatabase(`
            UPDATE board_posts 
            SET 
                attachment_count = (
                    SELECT COUNT(*) 
                    FROM board_attachments 
                    WHERE post_id = ?
                ),
                has_images = (
                    SELECT COUNT(*) > 0
                    FROM board_attachments 
                    WHERE post_id = ? AND is_image = TRUE
                )
            WHERE id = ?
        `, [postId, postId, postId]);
        
    } catch (error) {
        console.error('첨부파일 개수 업데이트 오류:', error);
    }
}

module.exports = router;