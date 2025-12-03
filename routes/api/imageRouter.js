const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');
const { editorImageUpload } = require('../../lib_board/fileUpload');
const { uploadBase64Image, optimizeImage } = require('../../lib_board/s3Utils');
const { validateUploadSecurity } = require('../../lib_board/securityValidator');
const multer = require('multer');
const crypto = require('crypto');

/**
 * 에디터 이미지 업로드 API (파일 업로드)
 * POST /api/board/images/upload
 */
router.post('/upload', authenticateUser, (req, res) => {
    // multer 미들웨어 실행 (단일 이미지만)
    editorImageUpload.single('upload')(req, res, async (err) => {
        if (err) {
            console.error('에디터 이미지 업로드 오류:', err);
            
            let errorMessage = '이미지 업로드 중 오류가 발생했습니다.';
            
            if (err.code === 'LIMIT_FILE_SIZE') {
                errorMessage = '이미지 크기가 너무 큽니다. (최대 10MB)';
            } else if (err.message.includes('이미지 파일만')) {
                errorMessage = '이미지 파일만 업로드 가능합니다.';
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            // CKEditor 5 응답 형식
            return res.status(400).json({
                error: {
                    message: errorMessage
                }
            });
        }
        
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: {
                        message: '업로드할 이미지를 선택해주세요.'
                    }
                });
            }
            
            const userId = req.session.userID;
            const userRole = req.session.role;
            const clientIP = req.ip || req.connection.remoteAddress;
            
            console.log('에디터 이미지 업로드 요청:', {
                userId,
                filename: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            });
            
            // 보안 검증
            const securityCheck = await validateUploadSecurity(
                req.file, userId, userRole, null, clientIP
            );
            
            if (!securityCheck.isValid) {
                return res.status(400).json({
                    error: {
                        message: securityCheck.errors.join(', ')
                    }
                });
            }
            
            // 이미지 최적화 정보 로그
            console.log('이미지 업로드 성공:', {
                originalName: req.file.originalname,
                s3Key: req.file.key,
                size: req.file.size,
                url: req.file.location
            });
            
            // CKEditor 5 응답 형식으로 반환
            res.json({
                url: req.file.location,
                uploaded: true,
                fileName: req.file.originalname,
                // 추가 메타데이터
                meta: {
                    key: req.file.key,
                    size: req.file.size,
                    type: req.file.mimetype,
                    uploadedAt: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('에디터 이미지 처리 오류:', error);
            res.status(500).json({
                error: {
                    message: '이미지 처리 중 오류가 발생했습니다.'
                }
            });
        }
    });
});

/**
 * 클립보드 이미지 업로드 API (Base64)
 * POST /api/board/images/paste
 */
router.post('/paste', authenticateUser, async (req, res) => {
    try {
        const { imageData, fileName } = req.body;
        const userId = req.session.userID;
        const userRole = req.session.role;
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (!imageData) {
            return res.status(400).json({
                error: {
                    message: '이미지 데이터가 필요합니다.'
                }
            });
        }
        
        console.log('클립보드 이미지 업로드 요청:', {
            userId,
            fileName: fileName || 'pasted-image.png',
            dataLength: imageData.length
        });
        
        // Base64 데이터 검증
        if (!imageData.startsWith('data:image/')) {
            return res.status(400).json({
                error: {
                    message: '올바른 이미지 데이터가 아닙니다.'
                }
            });
        }
        
        // 사용자 권한 확인 (기본적인 체크)
        if (!['student', 'teacher', 'manager', 'admin'].includes(userRole)) {
            return res.status(403).json({
                error: {
                    message: '이미지 업로드 권한이 없습니다.'
                }
            });
        }
        
        // Base64 이미지를 S3에 업로드
        const uploadResult = await uploadBase64Image(
            imageData, 
            fileName || `pasted-image-${Date.now()}.png`
        );
        
        console.log('클립보드 이미지 업로드 성공:', {
            key: uploadResult.key,
            size: uploadResult.size,
            url: uploadResult.url
        });
        
        // CKEditor 5 응답 형식
        res.json({
            url: uploadResult.url,
            uploaded: true,
            fileName: uploadResult.originalName,
            meta: {
                key: uploadResult.key,
                size: uploadResult.size,
                type: 'image/png',
                uploadedAt: new Date().toISOString(),
                source: 'clipboard'
            }
        });
        
    } catch (error) {
        console.error('클립보드 이미지 업로드 오류:', error);
        res.status(500).json({
            error: {
                message: '클립보드 이미지 업로드 중 오류가 발생했습니다.'
            }
        });
    }
});

/**
 * 이미지 메타데이터 조회 API
 * GET /api/board/images/:key/meta
 */
router.get('/:key/meta', authenticateUser, async (req, res) => {
    try {
        const { key } = req.params;
        
        // S3 키 디코딩
        const decodedKey = decodeURIComponent(key);
        
        // 이미지 키 형식 검증
        if (!decodedKey.startsWith('board/images/')) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 이미지 키입니다.'
            });
        }
        
        // 기본 메타데이터 반환 (실제로는 S3에서 가져와야 함)
        const metadata = {
            key: decodedKey,
            url: `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${decodedKey}`,
            type: 'image',
            uploadedAt: new Date().toISOString(),
            isTemporary: decodedKey.includes('/temp/')
        };
        
        res.json({
            success: true,
            metadata: metadata
        });
        
    } catch (error) {
        console.error('이미지 메타데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '이미지 정보를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 에디터 이미지 삭제 API
 * DELETE /api/board/images/:key
 */
router.delete('/:key', authenticateUser, async (req, res) => {
    try {
        const { key } = req.params;
        const userId = req.session.userID;
        const userRole = req.session.role;
        
        const decodedKey = decodeURIComponent(key);
        
        // 이미지 키 형식 검증
        if (!decodedKey.startsWith('board/images/')) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 이미지 키입니다.'
            });
        }
        
        // 임시 이미지만 삭제 가능 (정식 이미지는 게시글과 함께 관리)
        if (!decodedKey.includes('/temp/')) {
            return res.status(403).json({
                success: false,
                error: '임시 이미지만 삭제할 수 있습니다.'
            });
        }
        
        console.log('에디터 이미지 삭제 요청:', {
            userId,
            key: decodedKey
        });
        
        // S3에서 이미지 삭제 (실제 구현)
        const { deleteFromS3 } = require('../../lib_board/s3Utils');
        await deleteFromS3(decodedKey);
        
        console.log('에디터 이미지 삭제 완료:', decodedKey);
        
        res.json({
            success: true,
            message: '이미지가 삭제되었습니다.'
        });
        
    } catch (error) {
        console.error('에디터 이미지 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '이미지 삭제 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 이미지 리사이즈 API (썸네일 생성)
 * POST /api/board/images/:key/resize
 */
router.post('/:key/resize', authenticateUser, async (req, res) => {
    try {
        const { key } = req.params;
        const { width, height, quality } = req.body;
        
        const decodedKey = decodeURIComponent(key);
        
        console.log('이미지 리사이즈 요청:', {
            key: decodedKey,
            width,
            height,
            quality
        });
        
        // 기본값 설정
        const resizeOptions = {
            maxWidth: parseInt(width) || 800,
            maxHeight: parseInt(height) || 600,
            quality: parseInt(quality) || 85
        };
        
        // S3에서 원본 이미지 다운로드
        const { downloadFromS3, optimizeImage, uploadBufferToS3, generateImageKey } = require('../../lib_board/s3Utils');
        const originalBuffer = await downloadFromS3(decodedKey);
        
        // 이미지 리사이즈
        const resizedBuffer = await optimizeImage(originalBuffer, resizeOptions);
        
        // 리사이즈된 이미지 업로드
        const resizedKey = generateImageKey('.jpg', true); // 임시 파일로 저장
        await uploadBufferToS3(resizedBuffer, resizedKey, 'image/jpeg');
        
        const resizedUrl = `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${resizedKey}`;
        
        console.log('이미지 리사이즈 완료:', {
            originalKey: decodedKey,
            resizedKey: resizedKey,
            originalSize: originalBuffer.length,
            resizedSize: resizedBuffer.length
        });
        
        res.json({
            success: true,
            original: {
                key: decodedKey,
                size: originalBuffer.length
            },
            resized: {
                key: resizedKey,
                url: resizedUrl,
                size: resizedBuffer.length
            }
        });
        
    } catch (error) {
        console.error('이미지 리사이즈 오류:', error);
        res.status(500).json({
            success: false,
            error: '이미지 리사이즈 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
