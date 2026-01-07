const db = require('../lib_login/db');
const { S3Client, DeleteObjectCommand, CopyObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { BUCKET_NAME } = require('./fileUpload');

// S3 클라이언트 (fileUpload.js에서 가져오기)
const { s3Client } = require('./fileUpload');

/**
 * 첨부파일을 데이터베이스에 저장
 */
async function saveAttachment(postId, fileInfo, userId) {
    try {
        const insertQuery = `
            INSERT INTO board_attachments 
            (post_id, original_name, stored_name, file_size, file_type, s3_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;
        
        const s3Url = `https://${BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/${fileInfo.key}`;
        
        const result = await db.queryDatabase(insertQuery, [
            postId,
            fileInfo.originalname,
            fileInfo.key,
            fileInfo.size,
            fileInfo.mimetype,
            s3Url
        ]);
        
        return {
            id: result.insertId,
            ...fileInfo,
            s3_url: s3Url
        };
        
    } catch (error) {
        console.error('첨부파일 저장 오류:', error);
        throw new Error('첨부파일 저장 중 오류가 발생했습니다.');
    }
}

/**
 * 게시글의 첨부파일 목록 조회
 */
async function getAttachmentsByPostId(postId) {
    try {
        const query = `
            SELECT 
                id, original_name, stored_name, file_size, file_type, 
                s3_url, download_count, created_at
            FROM board_attachments 
            WHERE post_id = ?
            ORDER BY created_at ASC
        `;
        
        const attachments = await db.queryDatabase(query, [postId]);
        
        return attachments.map(attachment => ({
            ...attachment,
            formatted_size: formatFileSize(attachment.file_size),
            is_image: isImageFile(attachment.file_type)
        }));
        
    } catch (error) {
        console.error('첨부파일 조회 오류:', error);
        throw new Error('첨부파일 조회 중 오류가 발생했습니다.');
    }
}

/**
 * 첨부파일 삭제 (DB + S3)
 */
async function deleteAttachment(attachmentId, userId, userRole) {
    try {
        // 첨부파일 정보 조회
        const attachment = await getAttachmentById(attachmentId);
        if (!attachment) {
            throw new Error('첨부파일을 찾을 수 없습니다.');
        }
        
        // 권한 확인 (게시글 작성자 또는 관리자)
        const canDelete = await checkAttachmentDeletePermission(attachment.post_id, userId, userRole);
        if (!canDelete) {
            throw new Error('첨부파일을 삭제할 권한이 없습니다.');
        }
        
        // S3에서 파일 삭제
        await deleteFileFromS3(attachment.stored_name);
        
        // DB에서 삭제
        await db.queryDatabase('DELETE FROM board_attachments WHERE id = ?', [attachmentId]);
        
        return { success: true, message: '첨부파일이 삭제되었습니다.' };
        
    } catch (error) {
        console.error('첨부파일 삭제 오류:', error);
        throw error;
    }
}

/**
 * 첨부파일 다운로드 URL 생성 (Presigned URL)
 */
async function getDownloadUrl(attachmentId, userId) {
    try {
        const attachment = await getAttachmentById(attachmentId);
        if (!attachment) {
            throw new Error('첨부파일을 찾을 수 없습니다.');
        }
        
        // 🔥 다운로드 권한 확인 추가 (공개 게시글은 누구나, 비공개는 권한 확인)
        const canDownload = await checkDownloadPermission(attachment.post_id, userId);
        if (!canDownload) {
            throw new Error('파일 다운로드 권한이 없습니다.');
        }
        
        // 다운로드 카운트 증가
        await incrementDownloadCount(attachmentId);
        
        // Presigned URL 생성 (15분 유효)
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: attachment.stored_name,
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(attachment.original_name)}"`
        });
        
        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15분
        
        console.log('다운로드 URL 생성 완료:', {
            attachmentId,
            filename: attachment.original_name,
            downloadCount: attachment.download_count + 1
        });
        
        return {
            download_url: downloadUrl,
            filename: attachment.original_name,
            file_size: attachment.file_size
        };
        
    } catch (error) {
        console.error('다운로드 URL 생성 오류:', error);
        throw error; // 원래 에러 메시지 유지
    }
}

/**
 * 임시 파일을 정식 파일로 이동
 */
async function moveTemporaryFile(tempKey, permanentKey) {
    try {
        // S3에서 파일 복사
        const copyCommand = new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${tempKey}`,
            Key: permanentKey,
            MetadataDirective: 'COPY'
        });
        
        await s3Client.send(copyCommand);
        
        // 임시 파일 삭제
        await deleteFileFromS3(tempKey);
        
        return permanentKey;
        
    } catch (error) {
        console.error('파일 이동 오류:', error);
        throw new Error('파일 이동 중 오류가 발생했습니다.');
    }
}

/**
 * 임시 파일들 정리 (24시간 이상 된 파일)
 */
async function cleanupTemporaryFiles() {
    try {
        console.log('S3 임시 파일 정리 시작...');
        
        // 24시간 전 시간
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // 🔥 S3에서 임시 폴더의 파일들 조회 및 삭제 (S3 경로 수정: board/ 제거)

        // 이미지 임시 폴더 정리
        await cleanupS3TempFolder(s3Client, 'images/temp/', cutoffTime);

        // 첨부파일 임시 폴더 정리
        await cleanupS3TempFolder(s3Client, 'attachments/temp/', cutoffTime);
        
        console.log(`S3 임시 파일 정리 완룼: ${cutoffTime.toISOString()} 이전 파일들 삭제`);
        
    } catch (error) {
        console.error('S3 임시 파일 정리 오류:', error);
        throw error;
    }
}

/**
 * S3 임시 폴더 정리 헬퍼 함수
 */
async function cleanupS3TempFolder(s3Client, prefix, cutoffTime) {
    try {
        console.log(`S3 폴더 정리 시작: ${prefix}`);
        
        // 임시 폴더의 파일 목록 조회
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            MaxKeys: 1000 // 한 번에 최대 1000개씩 처리
        });
        
        const listResult = await s3Client.send(listCommand);
        
        if (!listResult.Contents || listResult.Contents.length === 0) {
            console.log(`정리할 파일이 없음: ${prefix}`);
            return;
        }
        
        let deletedCount = 0;
        
        // 각 파일의 수정 시간 확인 및 삭제
        for (const object of listResult.Contents) {
            try {
                // LastModified가 cutoffTime보다 오래된 파일만 삭제
                if (object.LastModified && object.LastModified < cutoffTime) {
                    await deleteFileFromS3(object.Key);
                    console.log(`오래된 임시 파일 삭제: ${object.Key}`);
                    deletedCount++;
                }
            } catch (deleteError) {
                console.error(`파일 삭제 오류 (${object.Key}):`, deleteError);
                // 개별 파일 삭제 실패해도 계속 진행
            }
        }
        
        console.log(`${prefix} 정리 완료: ${deletedCount}개 파일 삭제`);
        
        // 🔥 더 많은 파일이 있는 경우 재귀 처리
        if (listResult.IsTruncated) {
            console.log(`${prefix} 폴더에 더 많은 파일이 있음, 계속 정리...`);
            await cleanupS3TempFolder(s3Client, prefix, cutoffTime);
        }
        
    } catch (error) {
        console.error(`S3 폴더 정리 오류 (${prefix}):`, error);
        throw error;
    }
}

// === 내부 헬퍼 함수들 ===

async function getAttachmentById(attachmentId) {
    const attachments = await db.queryDatabase(
        'SELECT * FROM board_attachments WHERE id = ?', 
        [attachmentId]
    );
    return attachments.length > 0 ? attachments[0] : null;
}

// 🔥 다운로드 권한 확인 추가
async function checkDownloadPermission(postId, userId) {
    try {
        // 게시글이 존재하는지 확인 (삭제된 게시글의 첨부파일은 다운로드 불가)
        const posts = await db.queryDatabase(
            'SELECT id FROM board_posts WHERE id = ?', 
            [postId]
        );
        
        if (posts.length === 0) {
            return false; // 게시글이 없으면 다운로드 불가
        }
        
        // 현재는 모든 게시글이 공개이므로 누구나 다운로드 가능
        // 추후 비공개 게시글 기능 추가 시 여기서 권한 체크
        return true;
        
    } catch (error) {
        console.error('다운로드 권한 확인 오류:', error);
        return false;
    }
}

async function checkAttachmentDeletePermission(postId, userId, userRole) {
    // 관리자는 모든 파일 삭제 가능
    if (['admin', 'manager'].includes(userRole)) {
        return true;
    }
    
    // 게시글 작성자 확인
    const posts = await db.queryDatabase(
        'SELECT author_id, author FROM board_posts WHERE id = ?', 
        [postId]
    );
    
    if (posts.length > 0) {
        const post = posts[0];
        // author_id 또는 author 필드로 확인 (호환성)
        return post.author_id?.toString() === userId?.toString() || 
               post.author === userId;
    }
    
    return false;
}

async function deleteFileFromS3(key) {
    const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    
    await s3Client.send(deleteCommand);
}

async function incrementDownloadCount(attachmentId) {
    await db.queryDatabase(
        'UPDATE board_attachments SET download_count = download_count + 1 WHERE id = ?',
        [attachmentId]
    );
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isImageFile(mimeType) {
    return mimeType && mimeType.startsWith('image/');
}

module.exports = {
    saveAttachment,
    getAttachmentsByPostId,
    deleteAttachment,
    getDownloadUrl,
    moveTemporaryFile,
    cleanupTemporaryFiles
};
