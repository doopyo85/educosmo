const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { BUCKET_NAME } = require('../s3Utils');

// S3 클라이언트 설정
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * 임시 파일 정리 스케줄러
 * - 24시간 이상 지난 임시 파일들을 S3에서 삭제
 * - 매일 자정에 실행됨
 */

/**
 * S3에서 임시 파일 목록 조회
 */
async function listTempFiles() {
    try {
        const tempPrefixes = [
            'board/images/temp/',
            'board/attachments/temp/'
        ];
        
        let allTempFiles = [];
        
        for (const prefix of tempPrefixes) {
            console.log(`임시 파일 조회 중: ${prefix}`);
            
            let continuationToken = undefined;
            let hasMore = true;
            
            while (hasMore) {
                const listCommand = new ListObjectsV2Command({
                    Bucket: BUCKET_NAME,
                    Prefix: prefix,
                    MaxKeys: 1000,
                    ContinuationToken: continuationToken
                });
                
                const response = await s3Client.send(listCommand);
                
                if (response.Contents && response.Contents.length > 0) {
                    allTempFiles.push(...response.Contents);
                }
                
                hasMore = response.IsTruncated;
                continuationToken = response.NextContinuationToken;
            }
        }
        
        console.log(`총 ${allTempFiles.length}개의 임시 파일 발견`);
        return allTempFiles;
        
    } catch (error) {
        console.error('임시 파일 목록 조회 오류:', error);
        throw error;
    }
}

/**
 * 오래된 임시 파일 필터링 (24시간 이상)
 */
function filterOldTempFiles(tempFiles) {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간 전
    
    const oldFiles = tempFiles.filter(file => {
        const fileModifiedTime = new Date(file.LastModified);
        return fileModifiedTime < cutoffTime;
    });
    
    console.log(`${oldFiles.length}개의 오래된 임시 파일 발견 (${cutoffTime.toISOString()} 이전)`);
    
    return oldFiles;
}

/**
 * S3에서 파일들 일괄 삭제
 */
async function deleteFilesFromS3(filesToDelete) {
    if (filesToDelete.length === 0) {
        console.log('삭제할 파일이 없습니다.');
        return { deletedCount: 0, errors: [] };
    }
    
    try {
        const MAX_DELETE_COUNT = 1000; // S3 일괄 삭제 제한
        let deletedCount = 0;
        let errors = [];
        
        // 1000개씩 나누어서 삭제
        for (let i = 0; i < filesToDelete.length; i += MAX_DELETE_COUNT) {
            const batch = filesToDelete.slice(i, i + MAX_DELETE_COUNT);
            
            const deleteObjects = batch.map(file => ({ Key: file.Key }));
            
            console.log(`${i + 1}-${i + batch.length} 번째 파일 일괄 삭제 중...`);
            
            const deleteCommand = new DeleteObjectsCommand({
                Bucket: BUCKET_NAME,
                Delete: {
                    Objects: deleteObjects,
                    Quiet: false // 삭제 결과를 상세히 받음
                }
            });
            
            const deleteResponse = await s3Client.send(deleteCommand);
            
            // 성공한 삭제
            if (deleteResponse.Deleted) {
                deletedCount += deleteResponse.Deleted.length;
                console.log(`${deleteResponse.Deleted.length}개 파일 삭제 완료`);
            }
            
            // 삭제 실패
            if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
                errors.push(...deleteResponse.Errors);
                console.error(`${deleteResponse.Errors.length}개 파일 삭제 실패:`, deleteResponse.Errors);
            }
        }
        
        return { deletedCount, errors };
        
    } catch (error) {
        console.error('파일 일괄 삭제 오류:', error);
        throw error;
    }
}

/**
 * 임시 파일 정리 실행
 */
async function cleanupTempFiles() {
    console.log('=== 임시 파일 정리 시작 ===');
    console.log('시작 시간:', new Date().toISOString());
    
    try {
        // 1. 모든 임시 파일 조회
        const tempFiles = await listTempFiles();
        
        if (tempFiles.length === 0) {
            console.log('정리할 임시 파일이 없습니다.');
            return { success: true, deletedCount: 0, errors: [] };
        }
        
        // 2. 오래된 파일만 필터링
        const oldFiles = filterOldTempFiles(tempFiles);
        
        if (oldFiles.length === 0) {
            console.log('삭제할 오래된 임시 파일이 없습니다.');
            return { success: true, deletedCount: 0, errors: [] };
        }
        
        // 3. 파일 크기 통계
        const totalSize = oldFiles.reduce((sum, file) => sum + (file.Size || 0), 0);
        console.log(`삭제할 파일 총 크기: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        
        // 4. 삭제 실행
        const { deletedCount, errors } = await deleteFilesFromS3(oldFiles);
        
        // 5. 결과 로그
        console.log('=== 임시 파일 정리 완료 ===');
        console.log(`완료 시간: ${new Date().toISOString()}`);
        console.log(`삭제된 파일 수: ${deletedCount}`);
        console.log(`오류 수: ${errors.length}`);
        
        if (errors.length > 0) {
            console.error('삭제 오류 상세:', errors);
        }
        
        return { 
            success: true, 
            deletedCount, 
            errors,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        };
        
    } catch (error) {
        console.error('=== 임시 파일 정리 실패 ===');
        console.error('오류 시간:', new Date().toISOString());
        console.error('오류 내용:', error);
        
        return { 
            success: false, 
            error: error.message, 
            deletedCount: 0, 
            errors: [] 
        };
    }
}

/**
 * 임시 파일 정리 통계 조회
 */
async function getTempFileStats() {
    try {
        const tempFiles = await listTempFiles();
        
        if (tempFiles.length === 0) {
            return {
                totalCount: 0,
                totalSizeMB: 0,
                oldCount: 0,
                oldSizeMB: 0
            };
        }
        
        const oldFiles = filterOldTempFiles(tempFiles);
        
        const totalSize = tempFiles.reduce((sum, file) => sum + (file.Size || 0), 0);
        const oldSize = oldFiles.reduce((sum, file) => sum + (file.Size || 0), 0);
        
        return {
            totalCount: tempFiles.length,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            oldCount: oldFiles.length,
            oldSizeMB: (oldSize / 1024 / 1024).toFixed(2)
        };
        
    } catch (error) {
        console.error('임시 파일 통계 조회 오류:', error);
        throw error;
    }
}

/**
 * 특정 경로의 임시 파일만 정리 (테스트용)
 */
async function cleanupTempFilesByPath(pathPrefix) {
    console.log(`특정 경로 임시 파일 정리: ${pathPrefix}`);
    
    try {
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: pathPrefix,
            MaxKeys: 1000
        });
        
        const response = await s3Client.send(listCommand);
        
        if (!response.Contents || response.Contents.length === 0) {
            console.log('해당 경로에 파일이 없습니다.');
            return { success: true, deletedCount: 0 };
        }
        
        const { deletedCount, errors } = await deleteFilesFromS3(response.Contents);
        
        console.log(`${pathPrefix} 경로 정리 완료: ${deletedCount}개 파일 삭제`);
        
        return { success: true, deletedCount, errors };
        
    } catch (error) {
        console.error(`${pathPrefix} 경로 정리 오류:`, error);
        throw error;
    }
}

module.exports = {
    cleanupTempFiles,
    getTempFileStats,
    cleanupTempFilesByPath,
    listTempFiles,
    filterOldTempFiles
};
