const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../lib_login/authMiddleware');
const { uploadBase64Image, optimizeImage, generateThumbnail } = require('../../lib_board/s3Utils');
const { validateUploadSecurity } = require('../../lib_board/securityValidator');
const sharp = require('sharp');

/**
 * 클립보드 이미지 처리 전용 API
 * Gmail처럼 즉시 붙여넣기 지원
 */

/**
 * 클립보드 Base64 이미지 업로드
 * POST /api/board/clipboard/paste
 */
router.post('/paste', authenticateUser, async (req, res) => {
    try {
        const { imageData, fileName, insertPosition } = req.body;
        const userId = req.session.userID;
        const userRole = req.session.role;
        const clientIP = req.ip || req.connection.remoteAddress;
        
        console.log('=== 클립보드 이미지 붙여넣기 ===');
        console.log('사용자:', userId);
        console.log('파일명:', fileName || 'clipboard-image');
        console.log('데이터 크기:', imageData ? imageData.length : 0);
        
        // 필수 데이터 검증
        if (!imageData) {
            return res.status(400).json({
                success: false,
                error: '이미지 데이터가 필요합니다.'
            });
        }
        
        // Base64 형식 검증
        if (!imageData.startsWith('data:image/')) {
            return res.status(400).json({
                success: false,
                error: '올바른 이미지 형식이 아닙니다.'
            });
        }
        
        // MIME 타입 추출
        const mimeMatch = imageData.match(/data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        
        // 허용된 이미지 타입 검증
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(mimeType)) {
            return res.status(400).json({
                success: false,
                error: '지원하지 않는 이미지 형식입니다.'
            });
        }
        
        // Base64 데이터 크기 추정 (실제 크기는 약 75%)
        const estimatedSize = (imageData.length * 0.75);
        
        // 크기 제한 (10MB)
        if (estimatedSize > 10 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                error: '이미지 크기가 너무 큽니다. (최대 10MB)'
            });
        }
        
        // 사용자 권한 기본 확인
        if (!['student', 'teacher', 'manager', 'admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: '이미지 업로드 권한이 없습니다.'
            });
        }
        
        // Base64 → Buffer 변환
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        console.log('이미지 변환 완료:', {
            mimeType,
            originalSize: buffer.length,
            estimatedSize
        });
        
        // 이미지 메타데이터 추출
        let imageInfo = {};
        try {
            const metadata = await sharp(buffer).metadata();
            imageInfo = {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: buffer.length
            };
            console.log('이미지 메타데이터:', imageInfo);
        } catch (metaError) {
            console.warn('메타데이터 추출 실패:', metaError.message);
        }
        
        // 파일명 생성
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const finalFileName = fileName || `clipboard-${timestamp}.png`;
        
        // S3에 업로드
        const uploadResult = await uploadBase64Image(imageData, finalFileName);
        
        // 썸네일 생성 (옵션)
        let thumbnailUrl = null;
        try {
            const thumbnailBuffer = await generateThumbnail(buffer, 200);
            const thumbnailKey = uploadResult.key.replace(/\.[^.]+$/, '_thumb.jpg');
            
            const { uploadBufferToS3 } = require('../../lib_board/s3Utils');
            await uploadBufferToS3(thumbnailBuffer, thumbnailKey, 'image/jpeg');
            
            thumbnailUrl = `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${thumbnailKey}`;
            console.log('썸네일 생성 완료:', thumbnailKey);
        } catch (thumbError) {
            console.warn('썸네일 생성 실패:', thumbError.message);
        }
        
        console.log('클립보드 이미지 업로드 성공:', {
            key: uploadResult.key,
            size: uploadResult.size,
            url: uploadResult.url
        });
        
        // 업로드 로그 기록
        await logClipboardUpload(userId, clientIP, {
            fileName: finalFileName,
            size: buffer.length,
            mimeType,
            imageInfo,
            success: true
        });
        
        // CKEditor 5 호환 응답
        res.json({
            uploaded: true,
            url: uploadResult.url,
            fileName: finalFileName,
            meta: {
                key: uploadResult.key,
                size: uploadResult.size,
                type: mimeType,
                uploadedAt: new Date().toISOString(),
                source: 'clipboard',
                imageInfo: imageInfo,
                thumbnailUrl: thumbnailUrl,
                isTemporary: true
            }
        });
        
    } catch (error) {
        console.error('클립보드 이미지 업로드 오류:', error);
        
        // 업로드 실패 로그
        await logClipboardUpload(req.session?.userID, req.ip, {
            fileName: req.body?.fileName || 'unknown',
            error: error.message,
            success: false
        });
        
        res.status(500).json({
            success: false,
            error: '클립보드 이미지 업로드 중 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 스크린샷 캡처 지원 API
 * POST /api/board/clipboard/screenshot
 */
router.post('/screenshot', authenticateUser, async (req, res) => {
    try {
        const { imageData, captureInfo } = req.body;
        const userId = req.session.userID;
        
        console.log('=== 스크린샷 캡처 업로드 ===');
        console.log('사용자:', userId);
        console.log('캡처 정보:', captureInfo);
        
        if (!imageData) {
            return res.status(400).json({
                success: false,
                error: '스크린샷 데이터가 필요합니다.'
            });
        }
        
        // 스크린샷 전용 파일명 생성
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `screenshot-${timestamp}.png`;
        
        // 스크린샷은 PNG 형식으로 강제 변환
        let processedImageData = imageData;
        if (!imageData.startsWith('data:image/png')) {
            // 다른 형식이면 PNG로 변환
            const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            const pngBuffer = await sharp(buffer).png({ quality: 90 }).toBuffer();
            processedImageData = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        }
        
        // 기본 업로드 로직 재사용
        const uploadResult = await uploadBase64Image(processedImageData, fileName);
        
        console.log('스크린샷 업로드 성공:', uploadResult.key);
        
        res.json({
            uploaded: true,
            url: uploadResult.url,
            fileName: fileName,
            meta: {
                key: uploadResult.key,
                size: uploadResult.size,
                type: 'image/png',
                uploadedAt: new Date().toISOString(),
                source: 'screenshot',
                captureInfo: captureInfo,
                isTemporary: true
            }
        });
        
    } catch (error) {
        console.error('스크린샷 업로드 오류:', error);
        res.status(500).json({
            success: false,
            error: '스크린샷 업로드 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 이미지 포맷 변환 API
 * POST /api/board/clipboard/convert
 */
router.post('/convert', authenticateUser, async (req, res) => {
    try {
        const { imageData, targetFormat, quality } = req.body;
        const userId = req.session.userID;
        
        console.log('=== 이미지 포맷 변환 ===');
        console.log('대상 포맷:', targetFormat);
        console.log('품질:', quality);
        
        if (!imageData) {
            return res.status(400).json({
                success: false,
                error: '변환할 이미지 데이터가 필요합니다.'
            });
        }
        
        const allowedFormats = ['jpeg', 'png', 'webp'];
        if (!allowedFormats.includes(targetFormat)) {
            return res.status(400).json({
                success: false,
                error: '지원하지 않는 변환 형식입니다.'
            });
        }
        
        // Base64 → Buffer 변환
        const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');
        const inputBuffer = Buffer.from(base64Data, 'base64');
        
        // Sharp를 사용한 포맷 변환
        let sharpInstance = sharp(inputBuffer);
        
        const conversionQuality = parseInt(quality) || 85;
        
        switch (targetFormat) {
            case 'jpeg':
                sharpInstance = sharpInstance.jpeg({ quality: conversionQuality });
                break;
            case 'png':
                sharpInstance = sharpInstance.png({ quality: conversionQuality });
                break;
            case 'webp':
                sharpInstance = sharpInstance.webp({ quality: conversionQuality });
                break;
        }
        
        const outputBuffer = await sharpInstance.toBuffer();
        
        // 변환된 이미지를 Base64로 인코딩
        const convertedBase64 = `data:image/${targetFormat};base64,${outputBuffer.toString('base64')}`;
        
        // S3에 업로드
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `converted-${timestamp}.${targetFormat}`;
        const uploadResult = await uploadBase64Image(convertedBase64, fileName);
        
        console.log('이미지 변환 완료:', {
            originalSize: inputBuffer.length,
            convertedSize: outputBuffer.length,
            format: targetFormat,
            compression: ((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(1) + '%'
        });
        
        res.json({
            uploaded: true,
            url: uploadResult.url,
            fileName: fileName,
            meta: {
                key: uploadResult.key,
                size: uploadResult.size,
                type: `image/${targetFormat}`,
                uploadedAt: new Date().toISOString(),
                source: 'converted',
                originalSize: inputBuffer.length,
                compressionRatio: ((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(1),
                isTemporary: true
            }
        });
        
    } catch (error) {
        console.error('이미지 변환 오류:', error);
        res.status(500).json({
            success: false,
            error: '이미지 변환 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 임시 이미지 목록 조회 API
 * GET /api/board/clipboard/temp-images
 */
router.get('/temp-images', authenticateUser, async (req, res) => {
    try {
        const userId = req.session.userID;
        const limit = parseInt(req.query.limit) || 10;
        
        console.log('=== 임시 이미지 목록 조회 ===');
        console.log('사용자:', userId);
        console.log('제한:', limit);
        
        // 세션 기반 임시 이미지 조회 (실제로는 DB나 Redis에서)
        // 현재는 기본 응답 반환
        const tempImages = [
            // 실제 구현에서는 DB 조회 결과
        ];
        
        res.json({
            success: true,
            images: tempImages,
            count: tempImages.length,
            message: tempImages.length > 0 
                ? `${tempImages.length}개의 임시 이미지가 있습니다.`
                : '임시 이미지가 없습니다.'
        });
        
    } catch (error) {
        console.error('임시 이미지 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '임시 이미지 목록을 불러오는 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 일괄 임시 이미지 정리 API
 * DELETE /api/board/clipboard/cleanup
 */
router.delete('/cleanup', authenticateUser, async (req, res) => {
    try {
        const userId = req.session.userID;
        const olderThan = req.query.olderThan || '24h'; // 24시간 이전
        
        console.log('=== 임시 이미지 정리 ===');
        console.log('사용자:', userId);
        console.log('기준:', olderThan);
        
        // 임시 이미지 정리 로직 (실제 구현 필요)
        let deletedCount = 0;
        
        // 예시: 24시간 이전 임시 이미지 삭제
        // const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // 실제로는 S3에서 temp/ 폴더의 오래된 파일들 삭제
        
        console.log(`${deletedCount}개 임시 이미지 정리 완료`);
        
        res.json({
            success: true,
            deletedCount: deletedCount,
            message: `${deletedCount}개의 임시 이미지가 정리되었습니다.`
        });
        
    } catch (error) {
        console.error('임시 이미지 정리 오류:', error);
        res.status(500).json({
            success: false,
            error: '임시 이미지 정리 중 오류가 발생했습니다.'
        });
    }
});

// === 헬퍼 함수들 ===

/**
 * 클립보드 업로드 로그 기록
 */
async function logClipboardUpload(userId, clientIP, logData) {
    try {
        // 실제 구현에서는 DB에 로그 기록
        console.log('클립보드 업로드 로그:', {
            userId,
            ip: clientIP,
            ...logData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('클립보드 업로드 로그 기록 오류:', error);
    }
}

module.exports = router;
