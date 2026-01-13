const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const config = require('../config');

// 🔐 S3 클라이언트 설정 - NCP Endpoint & Credentials
const s3Config = {
    region: process.env.AWS_REGION || 'ap-northeast-2',
    endpoint: 'https://kr.object.ncloudstorage.com', // 🔥 NCP Endpoint 명시
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
};

console.log('🔐 [S3Utils] NCP S3 Endpoint 설정 완료:', s3Config.endpoint);

const s3Client = new S3Client(s3Config);

// 🔧 버킷 이름 - 여러 환경변수 지원
const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || process.env.BUCKET_NAME || 'educodingnplaycontents';

// 🔧 디버깅: S3Utils에서 사용 중인 설정 확인
console.log('=== S3Utils 설정 확인 ===');
console.log('S3Utils 버킷 이름:', BUCKET_NAME);
console.log('S3Utils AWS 리전:', process.env.AWS_REGION || 'ap-northeast-2');
console.log('S3Utils 인증 방식:', s3Config.credentials ? '환경변수' : 'IAM Role');

/**
 * Base64 이미지를 S3에 업로드 (에디터 붙여넣기용)
 */
async function uploadBase64Image(base64Data, originalName = 'pasted-image.png') {
    try {
        // Base64 데이터에서 헤더 제거
        const base64WithoutHeader = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64WithoutHeader, 'base64');

        // 이미지 포맷 감지 및 최적화
        const optimizedBuffer = await optimizeImage(buffer);

        // S3 키 생성
        const ext = path.extname(originalName) || '.png';
        const key = generateImageKey(ext, true); // 임시 이미지로 업로드

        // S3에 업로드
        const uploadResult = await uploadBufferToS3(optimizedBuffer, key, 'image/png');

        return {
            key: key,
            url: `${config.S3.ASSET_URL}/${key}`,
            size: optimizedBuffer.length,
            originalName: originalName
        };

    } catch (error) {
        console.error('Base64 이미지 업로드 오류:', error);
        throw new Error('이미지 업로드 중 오류가 발생했습니다.');
    }
}

/**
 * 이미지 최적화 (리사이징, 압축)
 */
async function optimizeImage(buffer, options = {}) {
    try {
        const {
            maxWidth = 1920,
            maxHeight = 1080,
            quality = 85,
            format = 'jpeg'
        } = options;

        let sharpInstance = sharp(buffer);

        // 메타데이터 확인
        const metadata = await sharpInstance.metadata();

        // 리사이징이 필요한 경우
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // 포맷별 최적화
        if (format === 'jpeg') {
            sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        } else if (format === 'png') {
            sharpInstance = sharpInstance.png({ quality, progressive: true });
        } else if (format === 'webp') {
            sharpInstance = sharpInstance.webp({ quality });
        }

        return await sharpInstance.toBuffer();

    } catch (error) {
        console.error('이미지 최적화 오류:', error);
        // 최적화 실패 시 원본 반환
        return buffer;
    }
}

/**
 * 썸네일 생성
 */
async function generateThumbnail(imageBuffer, size = 200) {
    try {
        return await sharp(imageBuffer)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toBuffer();

    } catch (error) {
        console.error('썸네일 생성 오류:', error);
        throw new Error('썸네일 생성 중 오류가 발생했습니다.');
    }
}

/**
 * 버퍼를 S3에 업로드
 */
async function uploadBufferToS3(buffer, key, contentType = 'application/octet-stream') {
    try {
        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            Metadata: {
                'upload-date': new Date().toISOString(),
                'upload-type': 'buffer'
            }
        });

        const result = await s3Client.send(uploadCommand);
        return result;

    } catch (error) {
        console.error('S3 버퍼 업로드 오류:', error);
        throw new Error('파일 업로드 중 오류가 발생했습니다.');
    }
}

/**
 * S3에서 파일 다운로드
 */
async function downloadFromS3(key) {
    try {
        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const response = await s3Client.send(getCommand);

        // Stream을 Buffer로 변환
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);

    } catch (error) {
        console.error('S3 다운로드 오류:', error);
        throw new Error('파일 다운로드 중 오류가 발생했습니다.');
    }
}

/**
 * S3에서 파일 삭제
 */
async function deleteFromS3(key) {
    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3Client.send(deleteCommand);
        console.log(`S3 파일 삭제 완료: ${key}`);

    } catch (error) {
        console.error('S3 파일 삭제 오류:', error);
        throw new Error('파일 삭제 중 오류가 발생했습니다.');
    }
}

/**
 * S3에서 파일 복사/이동
 */
async function copyInS3(sourceKey, destKey) {
    try {
        const copyCommand = new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${sourceKey}`,
            Key: destKey,
            MetadataDirective: 'COPY'
        });

        await s3Client.send(copyCommand);
        console.log(`S3 파일 복사 완료: ${sourceKey} → ${destKey}`);

    } catch (error) {
        console.error('S3 파일 복사 오류:', error);
        throw new Error('파일 복사 중 오류가 발생했습니다.');
    }
}

/**
 * Presigned URL 생성 (업로드용)
 */
async function generateUploadUrl(key, contentType, expiresIn = 3600) {
    try {
        const putCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType
        });

        const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn });
        return uploadUrl;

    } catch (error) {
        console.error('업로드 URL 생성 오류:', error);
        throw new Error('업로드 URL 생성 중 오류가 발생했습니다.');
    }
}

/**
 * Presigned URL 생성 (다운로드용)
 */
async function generateDownloadUrl(key, filename, expiresIn = 900) {
    try {
        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`
        });

        const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });
        return downloadUrl;

    } catch (error) {
        console.error('다운로드 URL 생성 오류:', error);
        throw new Error('다운로드 URL 생성 중 오류가 발생했습니다.');
    }
}

/**
 * 이미지 키 생성 (🔥 S3 경로 수정: board/ 제거)
 */
function generateImageKey(extension, isTemp = false) {
    const uuid = uuidv4();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    if (isTemp) {
        return `images/temp/${uuid}${extension}`;  // 🔥 board/ 제거
    } else {
        return `images/${year}/${month}/${uuid}${extension}`;  // 🔥 board/ 제거
    }
}

/**
 * 첨부파일 키 생성 (🔥 S3 경로 수정: board/ 제거)
 */
function generateAttachmentKey(extension, isTemp = false) {
    const uuid = uuidv4();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    if (isTemp) {
        return `attachments/temp/${uuid}${extension}`;  // 🔥 board/ 제거
    } else {
        return `attachments/${year}/${month}/${uuid}${extension}`;  // 🔥 board/ 제거
    }
}

/**
 * 임시 파일을 정식 파일로 이동
 */
async function moveFromTempToPermanent(tempKey) {
    try {
        // temp 경로에서 정식 경로로 변환
        let permanentKey;

        if (tempKey.includes('/images/temp/')) {
            const filename = path.basename(tempKey);
            const ext = path.extname(filename);
            permanentKey = generateImageKey(ext, false);
        } else if (tempKey.includes('/attachments/temp/')) {
            const filename = path.basename(tempKey);
            const ext = path.extname(filename);
            permanentKey = generateAttachmentKey(ext, false);
        } else {
            throw new Error('올바르지 않은 임시 파일 경로입니다.');
        }

        // 파일 복사
        await copyInS3(tempKey, permanentKey);

        // 임시 파일 삭제
        await deleteFromS3(tempKey);

        return permanentKey;

    } catch (error) {
        console.error('파일 이동 오류:', error);
        throw new Error('파일 이동 중 오류가 발생했습니다.');
    }
}

/**
 * 파일 존재 여부 확인
 */
async function checkFileExists(key) {
    try {
        const headCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3Client.send(headCommand);
        return true;

    } catch (error) {
        if (error.name === 'NoSuchKey') {
            return false;
        }
        throw error;
    }
}

/**
 * 🔥 게시글 content 내 temp 이미지를 정식 경로로 이동
 * @param {string} content - 게시글 HTML content
 * @returns {Promise<{content: string, movedImages: Array}>} - 업데이트된 content와 이동된 이미지 목록
 */
async function processContentImages(content) {
    if (!content) {
        return { content: content, movedImages: [] };
    }

    const movedImages = [];
    let updatedContent = content;

    try {
        // 🔥 S3 temp 이미지 URL 패턴 찾기 (board/ 제거)
        // 예: https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/images/temp/uuid.png
        const tempImagePattern = new RegExp(
            `https://${BUCKET_NAME}\\.s3\\.[^/]+\\.amazonaws\\.com/(images/temp/[^"'\\s]+)`,
            'gi'
        );

        const matches = content.match(tempImagePattern) || [];
        console.log(`📸 content 내 temp 이미지 발견: ${matches.length}개`);

        for (const match of matches) {
            try {
                // URL에서 S3 키 추출
                const urlObj = new URL(match);
                const tempKey = decodeURIComponent(urlObj.pathname.substring(1)); // 앞의 '/' 제거

                console.log(`🔄 이미지 이동 시작: ${tempKey}`);

                // temp 경로인지 확인
                if (!tempKey.includes('/temp/')) {
                    console.log(`⏭️ temp 경로가 아님, 건너뜀: ${tempKey}`);
                    continue;
                }

                // 정식 경로로 이동
                const permanentKey = await moveFromTempToPermanent(tempKey);
                const permanentUrl = `${config.S3.ASSET_URL}/${permanentKey}`;

                // content 내 URL 교체
                updatedContent = updatedContent.split(match).join(permanentUrl);

                movedImages.push({
                    originalUrl: match,
                    originalKey: tempKey,
                    newUrl: permanentUrl,
                    newKey: permanentKey
                });

                console.log(`✅ 이미지 이동 완료: ${tempKey} → ${permanentKey}`);

            } catch (moveError) {
                console.error(`❌ 이미지 이동 실패: ${match}`, moveError.message);
                // 개별 이미지 이동 실패해도 계속 진행
            }
        }

        console.log(`📸 총 ${movedImages.length}개 이미지 영구 저장 완료`);

        return {
            content: updatedContent,
            movedImages: movedImages
        };

    } catch (error) {
        console.error('❌ content 이미지 처리 오류:', error);
        // 오류 발생해도 원본 content 반환
        return { content: content, movedImages: [] };
    }
}

/**
 * 🔥 첨부파일을 temp에서 정식 경로로 이동
 * @param {Array} attachments - 첨부파일 배열 [{key, url, ...}]
 * @returns {Promise<Array>} - 업데이트된 첨부파일 배열
 */
async function processAttachmentFiles(attachments) {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        return attachments;
    }

    const processedAttachments = [];

    for (const attachment of attachments) {
        try {
            const key = attachment.key || attachment.stored_name;

            if (!key) {
                processedAttachments.push(attachment);
                continue;
            }

            // temp 경로인지 확인
            if (!key.includes('/temp/')) {
                console.log(`⏭️ 첨부파일 temp 경로 아님, 건너뜀: ${key}`);
                processedAttachments.push(attachment);
                continue;
            }

            console.log(`🔄 첨부파일 이동 시작: ${key}`);

            // 정식 경로로 이동
            const permanentKey = await moveFromTempToPermanent(key);
            const permanentUrl = `${config.S3.ASSET_URL}/${permanentKey}`;

            // 업데이트된 정보로 교체
            processedAttachments.push({
                ...attachment,
                key: permanentKey,
                stored_name: permanentKey,
                url: permanentUrl,
                s3_url: permanentUrl
            });

            console.log(`✅ 첨부파일 이동 완료: ${key} → ${permanentKey}`);

        } catch (moveError) {
            console.error(`❌ 첨부파일 이동 실패:`, moveError.message);
            // 실패해도 원본 정보 유지
            processedAttachments.push(attachment);
        }
    }

    return processedAttachments;
}

module.exports = {
    s3Client,
    BUCKET_NAME,
    uploadBase64Image,
    optimizeImage,
    generateThumbnail,
    uploadBufferToS3,
    downloadFromS3,
    deleteFromS3,
    copyInS3,
    generateUploadUrl,
    generateDownloadUrl,
    generateImageKey,
    generateAttachmentKey,
    moveFromTempToPermanent,
    checkFileExists,
    // 🔥 새로 추가된 함수들
    processContentImages,
    processAttachmentFiles
};
