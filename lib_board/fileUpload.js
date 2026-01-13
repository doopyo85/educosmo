const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const path = require('path');

// 🔐 S3 클라이언트 설정 - NCP Endpoint & Credentials
const s3Config = {
    region: process.env.AWS_REGION || 'ap-northeast-2',
    endpoint: 'https://kr.object.ncloudstorage.com', // 🔥 NCP Endpoint 명시
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
};

console.log('🔐 [FileUpload] NCP S3 Endpoint 설정 완료:', s3Config.endpoint);

const s3Client = new S3Client(s3Config);

// S3 버킷 이름 (여러 환경변수 지원)
const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.BUCKET_NAME || 'educodingnplaycontents';

// 🔧 디버깅: 사용 중인 버킷과 인증 방식 확인
console.log('=== FileUpload S3 설정 확인 ===');
console.log('사용할 버킷:', BUCKET_NAME);
console.log('AWS_REGION:', process.env.AWS_REGION || 'ap-northeast-2');
console.log('인증 방식:', s3Config.credentials ? '환경변수' : 'IAM Role');

// 🔥 파일 타입별 설정 (S3 경로 수정: board/ 제거)
const FILE_CONFIGS = {
    image: {
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        maxSize: 10 * 1024 * 1024, // 10MB
        folder: 'images'  // 🔥 board/ 제거
    },
    document: {
        allowedTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.hancom.hwp', // 🔥 HWP 추가
            'application/haansofthwp', // 🔥 HWP 대체 MIME 타입
            'application/x-hwp' // 🔥 HWP 또 다른 MIME 타입
        ],
        maxSize: 50 * 1024 * 1024, // 50MB
        folder: 'attachments'  // 🔥 board/ 제거
    },
    archive: {
        allowedTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
        maxSize: 100 * 1024 * 1024, // 100MB
        folder: 'attachments'  // 🔥 board/ 제거
    },
    text: {
        allowedTypes: ['text/plain', 'text/javascript', 'text/html', 'text/css', 'text/python'],
        maxSize: 1 * 1024 * 1024, // 1MB
        folder: 'attachments'  // 🔥 board/ 제거
    }
};

// 🔥 한글 파일명 처리 함수
function processKoreanFilename(originalname) {
    if (!originalname) return 'unknown-file';

    try {
        // UTF-8로 디코딩 시도
        let processedName = originalname;

        // 이미 깨진 한글이 있는 경우 복구 시도
        if (originalname.includes('ê') || originalname.includes('ì') || originalname.includes('ë')) {
            try {
                // Latin1으로 받은 파일명을 UTF-8로 변환
                const buffer = Buffer.from(originalname, 'latin1');
                processedName = buffer.toString('utf8');
                console.log('🔥 한글 파일명 복구:', originalname, '->', processedName);
            } catch (decodeError) {
                console.warn('🔥 한글 파일명 복구 실패:', decodeError);
            }
        }

        return processedName;
    } catch (error) {
        console.error('🔥 파일명 처리 오류:', error);
        return originalname;
    }
}

// 🔥 파일 타입 감지 (강화된 버전)
function detectFileType(mimeType, fileName = '') {
    console.log('🔥 파일 타입 감지 시도:', { mimeType, fileName });

    // 1단계: MIME 타입으로 첫 번째 판단
    for (const [type, config] of Object.entries(FILE_CONFIGS)) {
        if (config.allowedTypes.includes(mimeType)) {
            console.log('🔥 MIME 타입으로 감지:', type);
            return type;
        }
    }

    // 2단계: 파일 확장자로 추가 판단 (특히 HWP 같은 경우)
    if (fileName && fileName.includes('.')) {
        const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        console.log('🔥 확장자 감지 시도:', extension);

        switch (extension) {
            case '.hwp':
                console.log('🔥 HWP 파일로 감지');
                return 'document';
            case '.jpg':
            case '.jpeg':
            case '.png':
            case '.gif':
            case '.webp':
            case '.svg':
                return 'image';
            case '.pdf':
            case '.doc':
            case '.docx':
            case '.xls':
            case '.xlsx':
            case '.ppt':
            case '.pptx':
                return 'document';
            case '.zip':
            case '.rar':
            case '.7z':
                return 'archive';
            case '.txt':
            case '.js':
            case '.html':
            case '.css':
            case '.py':
                return 'text';
            default:
                console.log('🔥 알 수 없는 확장자:', extension);
                break;
        }
    }

    console.log('🔥 파일 타입 감지 실패');
    return null;
}

// S3 키 생성 함수
function generateS3Key(fileType, originalName, isTemp = false) {
    const ext = path.extname(originalName);
    const uuid = uuidv4();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const config = FILE_CONFIGS[fileType];
    const folder = isTemp ? `${config.folder}/temp` : `${config.folder}/${year}/${month}`;

    return `${folder}/${uuid}${ext}`;
}

// 일반 첨부파일용 multer 설정
const attachmentUpload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        key: function (req, file, cb) {
            // 🔥 한글 파일명 처리
            file.originalname = processKoreanFilename(file.originalname);

            const fileType = detectFileType(file.mimetype, file.originalname);
            if (!fileType) {
                return cb(new Error('지원하지 않는 파일 형식입니다.'));
            }

            const s3Key = generateS3Key(fileType, file.originalname, true); // 임시 파일로 업로드
            cb(null, s3Key);
        },
        metadata: function (req, file, cb) {
            try {
                // 🔥 한글 파일명을 S3 메타데이터에 안전하게 저장
                const originalName = processKoreanFilename(file.originalname);

                // S3 메타데이터는 HTTP 헤더 규칙을 따르므로 Base64 인코딩 사용
                const encodedFileName = Buffer.from(originalName, 'utf8').toString('base64');

                // 기본 메타데이터
                const metadata = {
                    'content-type': String(file.mimetype || 'application/octet-stream'),
                    'upload-date': String(new Date().toISOString()),
                    'file-size': String(file.size || 0),
                    'original-name-utf8': encodedFileName, // 🔥 Base64로 인코딩된 한글 파일명
                    'original-name-length': String(originalName.length)
                };

                console.log('🔥 S3 메타데이터 생성:', {
                    originalName: originalName,
                    encodedFileName: encodedFileName,
                    metadata: metadata
                });

                cb(null, metadata);

            } catch (error) {
                console.error('S3 메타데이터 생성 오류:', error);
                // 오류 발생 시 최소한의 메타데이터만 사용
                cb(null, {
                    'content-type': 'application/octet-stream',
                    'upload-date': String(new Date().toISOString())
                });
            }
        }
    }),
    fileFilter: function (req, file, cb) {
        console.log('🔥 파일 필터 검사:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });

        // 🔥 한글 파일명 처리
        file.originalname = processKoreanFilename(file.originalname);
        console.log('🔥 처리된 파일명:', file.originalname);

        const fileType = detectFileType(file.mimetype, file.originalname);
        if (!fileType) {
            console.log('🔥 파일 타입 감지 실패, 업로드 거부');
            return cb(new Error('지원하지 않는 파일 형식입니다.'), false);
        }

        console.log('🔥 파일 타입 감지 성공:', fileType);
        cb(null, true);
    },
    limits: {
        fileSize: Math.max(...Object.values(FILE_CONFIGS).map(config => config.maxSize)),
        files: 10 // 최대 10개 파일
    }
});

// 에디터 이미지용 multer 설정 (이미지만)
const editorImageUpload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        key: function (req, file, cb) {
            // 🔥 한글 파일명 처리
            file.originalname = processKoreanFilename(file.originalname);

            if (!FILE_CONFIGS.image.allowedTypes.includes(file.mimetype)) {
                return cb(new Error('이미지 파일만 업로드 가능합니다.'));
            }

            const s3Key = generateS3Key('image', file.originalname, true); // 임시 이미지로 업로드
            cb(null, s3Key);
        },
        metadata: function (req, file, cb) {
            try {
                // 🔥 이미지 파일명 안전 처리
                const originalName = processKoreanFilename(file.originalname);

                // S3 메타데이터는 HTTP 헤더 규칙을 따르므로 Base64 인코딩 사용
                const encodedFileName = Buffer.from(originalName, 'utf8').toString('base64');

                // 기본 메타데이터
                const metadata = {
                    'content-type': String(file.mimetype || 'image/png'),
                    'upload-date': String(new Date().toISOString()),
                    'upload-type': 'editor-image',
                    'file-size': String(file.size || 0),
                    'original-name-utf8': encodedFileName, // 🔥 Base64로 인코딩된 한글 파일명
                    'original-name-length': String(originalName.length)
                };

                console.log('🔥 S3 이미지 메타데이터 생성:', {
                    originalName: originalName,
                    encodedFileName: encodedFileName,
                    metadata: metadata
                });

                cb(null, metadata);

            } catch (error) {
                console.error('S3 이미지 메타데이터 생성 오류:', error);
                // 오류 발생 시 최소한의 메타데이터만 사용
                cb(null, {
                    'content-type': 'image/png',
                    'upload-date': String(new Date().toISOString()),
                    'upload-type': 'editor-image'
                });
            }
        }
    }),
    fileFilter: function (req, file, cb) {
        console.log('🔥 이미지 필터 검사:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });

        // 🔥 한글 파일명 처리
        file.originalname = processKoreanFilename(file.originalname);
        console.log('🔥 처리된 이미지 파일명:', file.originalname);

        if (!FILE_CONFIGS.image.allowedTypes.includes(file.mimetype)) {
            console.log('🔥 이미지 타입 거부:', file.mimetype);
            return cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
        }

        console.log('🔥 이미지 타입 허용');
        cb(null, true);
    },
    limits: {
        fileSize: FILE_CONFIGS.image.maxSize,
        files: 1
    }
});

module.exports = {
    s3Client,
    BUCKET_NAME,
    FILE_CONFIGS,
    detectFileType,
    generateS3Key,
    attachmentUpload,
    editorImageUpload,
    processKoreanFilename // 🔥 한글 파일명 처리 함수 내보내기
};
