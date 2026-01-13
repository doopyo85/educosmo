const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');

// 🔥 NCP Object Storage 클라이언트 생성 (config.js 기반)
const s3Client = new S3Client({
    region: config.S3.NCP.REGION,
    endpoint: config.S3.NCP.ENDPOINT,
    credentials: {
        accessKeyId: config.S3.NCP.ACCESS_KEY,
        secretAccessKey: config.S3.NCP.SECRET_KEY
    },
    forcePathStyle: true // NCP Object Storage 필수
});

const BUCKET_NAME = config.S3.BUCKET_NAME;

// 🔥 사용자 Jupyter 폴더 경로 (config.js 기반)
const getUserNotebookDir = (userId) => {
    return config.S3.NCP.getUserPath(userId);
};

// 🔥 노트북 목록 반환 (NCP Object Storage)
const getNotebookList = async (userId) => {
    try {
        const prefix = config.S3.NCP.getUserPath(userId);

        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix
        });

        const response = await s3Client.send(command);

        if (!response.Contents) {
            return [];
        }

        // .ipynb 파일만 필터링하고 파일명만 반환
        return response.Contents
            .map(item => item.Key.replace(prefix, '')) // 프리픽스 제거
            .filter(filename => filename.endsWith('.ipynb') && filename.length > 0);
    } catch (error) {
        console.error('❌ Jupyter 노트북 목록 조회 실패:', error);
        return [];
    }
};

// 🔥 노트북 삭제 (NCP Object Storage)
const deleteNotebook = async (userId, filename) => {
    try {
        const key = config.S3.NCP.getNotebookPath(userId, filename);

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3Client.send(command);
        console.log(`✅ Jupyter 노트북 삭제 성공: ${key}`);
    } catch (error) {
        console.error('❌ Jupyter 노트북 삭제 실패:', error);
        throw new Error('Notebook deletion failed');
    }
};

// 🔥 노트북 저장 (NCP Object Storage)
const saveNotebook = async (userId, filename, content) => {
    try {
        const key = config.S3.NCP.getNotebookPath(userId, filename);

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: content,
            ContentType: 'application/json'
        });

        await s3Client.send(command);
        console.log(`✅ Jupyter 노트북 저장 성공: ${key}`);
    } catch (error) {
        console.error('❌ Jupyter 노트북 저장 실패:', error);
        throw new Error('Notebook save failed');
    }
};

// 🔥 노트북 읽기 (NCP Object Storage)
const readNotebook = async (userId, filename) => {
    try {
        const key = config.S3.NCP.getNotebookPath(userId, filename);

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const response = await s3Client.send(command);
        const content = await streamToString(response.Body);

        console.log(`✅ Jupyter 노트북 읽기 성공: ${key}`);
        return content;
    } catch (error) {
        console.error('❌ Jupyter 노트북 읽기 실패:', error);
        throw new Error('Notebook not found');
    }
};

// 🔥 사용자 디렉토리 확인 (NCP Object Storage에서는 불필요하지만 호환성 유지)
const ensureUserDir = async (userId) => {
    // NCP Object Storage는 폴더 개념이 없으므로 아무 작업 없음
    console.log(`📁 사용자 Jupyter 경로: ${config.S3.NCP.getUserPath(userId)}`);
    return true;
};

// 🔥 Stream을 문자열로 변환하는 헬퍼 함수
const streamToString = (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
};

module.exports = {
    getNotebookList,
    deleteNotebook,
    saveNotebook,
    readNotebook,
    ensureUserDir,
    getUserNotebookDir,
};
