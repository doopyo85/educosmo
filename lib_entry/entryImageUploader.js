/**
 * 🖼️ Entry 이미지 업로드 매니저
 * Entry 에디터의 파일 업로드 및 그리기 저장 기능 처리
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const S3Manager = require('../lib_storage/s3Manager');

class EntryImageUploader {
    constructor() {
        this.s3Manager = new S3Manager();
        this.tempDir = path.join(__dirname, '..', 'temp', 'entry_uploads');
        
        // 허용 확장자
        this.allowedExtensions = ['jpg', 'jpeg', 'png', 'bmp', 'svg', 'eo'];
        
        // 허용 MIME 타입
        this.allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/bmp',
            'image/svg+xml',
            'application/octet-stream' // .eo 파일용
        ];
        
        // 최대 파일 크기 (5MB)
        this.maxFileSize = 5 * 1024 * 1024;
        
        console.log('✅ EntryImageUploader 초기화 완료');
    }

    /**
     * 파일 업로드 (multipart/form-data)
     * @param {Object} file - Multer file 객체
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {Promise<Object>} 업로드 결과
     */
    async uploadFile(file, userID, sessionID) {
        try {
            console.log(`📤 파일 업로드 시작: ${file.originalname} (User: ${userID})`);
            
            // 1. 파일 검증
            this.validateFile(file);
            
            // 2. 파일명 생성 (보안)
            const timestamp = Date.now();
            const randomStr = crypto.randomBytes(4).toString('hex');
            const ext = path.extname(file.originalname).toLowerCase();
            const safeFileName = `${timestamp}_${randomStr}${ext}`;
            
            // 3. S3 키 생성
            const s3Key = `ent/uploads/${userID}_${sessionID}/${safeFileName}`;
            
            // 4. S3 업로드
            const contentType = file.mimetype || this.getContentType(ext);
            await this.s3Manager.uploadProject(s3Key, file.buffer, contentType);
            
            // 5. S3 URL 생성
            const s3Url = `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${s3Key}`;
            
            // 6. Entry 접근 경로 생성
            const entryUrl = this.generateEntryImagePath(safeFileName, userID, sessionID);
            
            // 7. 이미지 크기 정보 (기본값)
            const dimension = await this.getImageDimension(file.buffer, ext);
            
            console.log(`✅ 파일 업로드 완료: ${s3Key}`);
            
            return {
                success: true,
                filename: safeFileName,
                originalName: file.originalname,
                s3Key: s3Key,
                s3Url: s3Url,
                entryUrl: entryUrl,
                imageType: ext.replace('.', ''),
                dimension: dimension,
                fileSize: file.size,
                contentType: contentType
            };
            
        } catch (error) {
            console.error('❌ 파일 업로드 실패:', error);
            throw new Error(`파일 업로드 실패: ${error.message}`);
        }
    }

    /**
     * Base64 이미지 업로드 (그리기 도구)
     * @param {string} base64Data - Base64 이미지 데이터
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @param {string} fileName - 파일명 (옵션)
     * @returns {Promise<Object>} 업로드 결과
     */
    async uploadBase64Drawing(base64Data, userID, sessionID, fileName = null) {
        try {
            console.log(`🎨 그리기 저장 시작 (User: ${userID})`);
            
            // 1. Base64 검증
            if (!base64Data || !base64Data.startsWith('data:image/')) {
                throw new Error('올바른 Base64 이미지 데이터가 아닙니다.');
            }
            
            // 2. Base64 디코딩
            const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                throw new Error('Base64 형식이 올바르지 않습니다.');
            }
            
            const imageType = matches[1]; // png, jpeg 등
            const base64Content = matches[2];
            const buffer = Buffer.from(base64Content, 'base64');
            
            // 3. 크기 검증
            if (buffer.length > this.maxFileSize) {
                throw new Error(`파일 크기가 너무 큽니다. (최대 5MB)`);
            }
            
            // 4. 파일명 생성
            const timestamp = Date.now();
            const randomStr = crypto.randomBytes(4).toString('hex');
            const safeFileName = fileName 
                ? `${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
                : `drawing_${timestamp}_${randomStr}.${imageType}`;
            
            // 5. S3 키 생성
            const s3Key = `ent/uploads/${userID}_${sessionID}/${safeFileName}`;
            
            // 6. S3 업로드
            const contentType = `image/${imageType}`;
            await this.s3Manager.uploadProject(s3Key, buffer, contentType);
            
            // 7. S3 URL 생성
            const s3Url = `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${s3Key}`;
            
            // 8. Entry 접근 경로 생성
            const entryUrl = this.generateEntryImagePath(safeFileName, userID, sessionID);
            
            // 9. 이미지 크기 정보
            const dimension = await this.getImageDimension(buffer, `.${imageType}`);
            
            console.log(`✅ 그리기 저장 완료: ${s3Key}`);
            
            return {
                success: true,
                filename: safeFileName,
                s3Key: s3Key,
                s3Url: s3Url,
                entryUrl: entryUrl,
                imageType: imageType,
                dimension: dimension,
                fileSize: buffer.length,
                contentType: contentType
            };
            
        } catch (error) {
            console.error('❌ 그리기 저장 실패:', error);
            throw new Error(`그리기 저장 실패: ${error.message}`);
        }
    }

    /**
     * 사용자 업로드 이미지 목록 조회
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID (옵션)
     * @returns {Promise<Array>} 이미지 목록
     */
    async listUserImages(userID, sessionID = null) {
        try {
            const prefix = sessionID 
                ? `ent/uploads/${userID}_${sessionID}/`
                : `ent/uploads/${userID}_`;
            
            console.log(`📂 사용자 이미지 목록 조회: ${prefix}`);
            
            const result = await this.s3Manager.browse(prefix);
            
            const images = result.files.map(file => ({
                filename: file.name,
                s3Key: file.key,
                s3Url: file.url,
                entryUrl: this.generateEntryImagePathFromKey(file.key),
                size: file.size,
                sizeFormatted: file.sizeFormatted,
                lastModified: file.lastModified
            }));
            
            console.log(`✅ 이미지 목록 조회 완료: ${images.length}개`);
            
            return images;
            
        } catch (error) {
            console.error('❌ 이미지 목록 조회 실패:', error);
            throw new Error(`이미지 목록 조회 실패: ${error.message}`);
        }
    }

    /**
     * Entry 이미지 경로 생성
     * Entry 표준 경로: /entry/uploads/{userID}_{sessionID}/{filename}
     * @param {string} filename - 파일명
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {string} Entry 경로
     */
    generateEntryImagePath(filename, userID, sessionID) {
        return `/entry/uploads/${userID}_${sessionID}/${filename}`;
    }

    /**
     * S3 키로부터 Entry 경로 생성
     * @param {string} s3Key - S3 키 (ent/uploads/{userID}_{sessionID}/{filename})
     * @returns {string} Entry 경로
     */
    generateEntryImagePathFromKey(s3Key) {
        // ent/uploads/{userID}_{sessionID}/{filename} → /entry/uploads/{userID}_{sessionID}/{filename}
        const parts = s3Key.split('/');
        if (parts.length >= 3 && parts[0] === 'ent' && parts[1] === 'uploads') {
            const userSession = parts[2];
            const filename = parts.slice(3).join('/');
            return `/entry/uploads/${userSession}/${filename}`;
        }
        return s3Key; // fallback
    }

    /**
     * 파일 검증
     * @param {Object} file - Multer file 객체
     * @throws {Error} 검증 실패 시
     */
    validateFile(file) {
        // 1. 파일 존재 확인
        if (!file || !file.buffer) {
            throw new Error('파일이 업로드되지 않았습니다.');
        }
        
        // 2. 파일 크기 확인
        if (file.size > this.maxFileSize) {
            throw new Error(`파일 크기가 너무 큽니다. (최대 5MB, 현재: ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB)`);
        }
        
        // 3. 확장자 확인
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (!this.allowedExtensions.includes(ext)) {
            throw new Error(`허용되지 않는 파일 형식입니다. (허용: ${this.allowedExtensions.join(', ')})`);
        }
        
        // 4. MIME 타입 확인
        if (file.mimetype && !this.allowedMimeTypes.includes(file.mimetype)) {
            console.warn(`⚠️ MIME 타입 경고: ${file.mimetype} (파일명 기준으로 허용)`);
        }
        
        return true;
    }

    /**
     * Content-Type 가져오기
     * @param {string} ext - 확장자 (.jpg, .png 등)
     * @returns {string} Content-Type
     */
    getContentType(ext) {
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.bmp': 'image/bmp',
            '.svg': 'image/svg+xml',
            '.eo': 'application/octet-stream'
        };
        
        return contentTypes[ext.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * 이미지 크기 정보 가져오기
     * @param {Buffer} buffer - 이미지 버퍼
     * @param {string} ext - 확장자
     * @returns {Promise<Object>} { width, height }
     */
    async getImageDimension(buffer, ext) {
        try {
            // sharp 라이브러리가 있으면 사용
            const sharp = require('sharp');
            const metadata = await sharp(buffer).metadata();
            return {
                width: metadata.width || 80,
                height: metadata.height || 80
            };
        } catch (error) {
            // sharp 없으면 기본값 반환
            console.warn('⚠️ sharp 라이브러리 없음, 기본 크기 반환');
            return {
                width: 80,
                height: 80
            };
        }
    }

    /**
     * 사용자 이미지 디렉토리 경로
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {string} 디렉토리 경로
     */
    getUserImageDir(userID, sessionID) {
        return path.join(this.tempDir, `${userID}_${sessionID}`);
    }

    /**
     * 사용자 이미지 디렉토리 생성
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {Promise<string>} 생성된 디렉토리 경로
     */
    async ensureUserImageDir(userID, sessionID) {
        const imageDir = this.getUserImageDir(userID, sessionID);
        await fs.mkdir(imageDir, { recursive: true });
        console.log(`📁 사용자 이미지 디렉토리 생성: ${imageDir}`);
        return imageDir;
    }

    /**
     * 사용자 이미지 정리 (세션 만료 시)
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {Promise<void>}
     */
    async cleanupUserImages(userID, sessionID) {
        try {
            const imageDir = this.getUserImageDir(userID, sessionID);
            await fs.rm(imageDir, { recursive: true, force: true });
            console.log(`🧹 사용자 이미지 정리 완료: ${imageDir}`);
        } catch (error) {
            console.error('⚠️ 이미지 정리 중 오류 (무시):', error.message);
        }
    }
}

module.exports = EntryImageUploader;
