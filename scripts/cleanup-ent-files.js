const fs = require('fs').promises;
const path = require('path');

/**
 * ENT 임시 파일 정리 스크립트
 * Cron Job으로 정기적으로 실행되어 만료된 임시 파일들을 삭제
 */
class EntFileCleaner {
    constructor() {
        this.tempDir = path.join(__dirname, '..', 'temp', 'ent_files');
        this.logFile = path.join(__dirname, '..', 'temp', 'cleanup.log');
        
        // 설정
        this.config = {
            maxAge: 30 * 60 * 1000,        // 30분 (밀리초)
            maxLogSize: 5 * 1024 * 1024,   // 5MB 로그 파일 최대 크기
            maxLogLines: 1000              // 최대 로그 라인 수
        };
    }

    /**
     * 로그 메시지 기록
     */
    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;
        
        try {
            // 콘솔 출력
            console.log(`[ENT-CLEANUP] ${logMessage.trim()}`);
            
            // 파일 로그 (선택사항)
            await fs.appendFile(this.logFile, logMessage);
            
            // 로그 파일 크기 관리
            await this.rotateLogIfNeeded();
            
        } catch (error) {
            console.error('로그 기록 오류:', error);
        }
    }

    /**
     * 로그 파일 회전 (크기가 너무 클 때)
     */
    async rotateLogIfNeeded() {
        try {
            const stats = await fs.stat(this.logFile);
            
            if (stats.size > this.config.maxLogSize) {
                const backupFile = `${this.logFile}.old`;
                await fs.rename(this.logFile, backupFile);
                await this.log('로그 파일 회전 완료', 'INFO');
            }
        } catch (error) {
            // 로그 파일이 없으면 무시
            if (error.code !== 'ENOENT') {
                console.error('로그 파일 회전 오류:', error);
            }
        }
    }

    /**
     * 임시 디렉토리 존재 확인
     */
    async ensureTempDirectory() {
        try {
            await fs.access(this.tempDir);
            return true;
        } catch (error) {
            await this.log(`임시 디렉토리가 존재하지 않음: ${this.tempDir}`, 'WARN');
            return false;
        }
    }

    /**
     * 파일 삭제 안전 실행
     */
    async safeDeleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            await this.log(`파일 삭제 실패: ${filePath} - ${error.message}`, 'ERROR');
            return false;
        }
    }

    /**
     * 파일 나이 계산 (밀리초)
     */
    getFileAge(stats) {
        const now = Date.now();
        return now - stats.birthtime.getTime();
    }

    /**
     * 파일 크기를 읽기 쉬운 형태로 변환
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * 시간을 읽기 쉬운 형태로 변환
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}시간 ${minutes % 60}분`;
        } else if (minutes > 0) {
            return `${minutes}분 ${seconds % 60}초`;
        } else {
            return `${seconds}초`;
        }
    }

    /**
     * 메인 정리 함수
     */
    async cleanup() {
        const startTime = Date.now();
        
        try {
            await this.log('ENT 파일 정리 작업 시작');
            
            // 임시 디렉토리 확인
            if (!(await this.ensureTempDirectory())) {
                return {
                    success: false,
                    error: '임시 디렉토리에 접근할 수 없습니다.'
                };
            }

            // 파일 목록 가져오기
            const files = await fs.readdir(this.tempDir);
            const entFiles = files.filter(file => file.endsWith('.ent'));
            
            if (entFiles.length === 0) {
                await this.log('정리할 ENT 파일이 없습니다.');
                return {
                    success: true,
                    totalFiles: 0,
                    deletedFiles: 0,
                    freedSpace: 0,
                    duration: Date.now() - startTime
                };
            }

            await this.log(`총 ${entFiles.length}개의 ENT 파일 검사 시작`);

            // 파일별 처리
            let deletedCount = 0;
            let totalDeletedSize = 0;
            let errors = [];
            const now = Date.now();

            for (const file of entFiles) {
                const filePath = path.join(this.tempDir, file);
                
                try {
                    const stats = await fs.stat(filePath);
                    const fileAge = this.getFileAge(stats);
                    const isExpired = fileAge > this.config.maxAge;

                    await this.log(
                        `파일: ${file}, 크기: ${this.formatFileSize(stats.size)}, ` +
                        `나이: ${this.formatDuration(fileAge)}, 만료: ${isExpired ? 'YES' : 'NO'}`,
                        'DEBUG'
                    );

                    if (isExpired) {
                        if (await this.safeDeleteFile(filePath)) {
                            deletedCount++;
                            totalDeletedSize += stats.size;
                            
                            await this.log(
                                `만료 파일 삭제 완료: ${file} (${this.formatFileSize(stats.size)})`,
                                'INFO'
                            );
                        } else {
                            errors.push(`삭제 실패: ${file}`);
                        }
                    }

                } catch (statError) {
                    const errorMsg = `파일 상태 확인 실패: ${file} - ${statError.message}`;
                    await this.log(errorMsg, 'ERROR');
                    errors.push(errorMsg);
                }
            }

            // 결과 요약
            const duration = Date.now() - startTime;
            const result = {
                success: true,
                totalFiles: entFiles.length,
                deletedFiles: deletedCount,
                activeFiles: entFiles.length - deletedCount,
                freedSpace: totalDeletedSize,
                freedSpaceFormatted: this.formatFileSize(totalDeletedSize),
                duration: duration,
                durationFormatted: this.formatDuration(duration),
                errors: errors
            };

            // 요약 로그
            await this.log(
                `정리 작업 완료: ${deletedCount}/${entFiles.length}개 파일 삭제, ` +
                `${this.formatFileSize(totalDeletedSize)} 공간 확보, ` +
                `소요시간: ${this.formatDuration(duration)}`,
                'INFO'
            );

            if (errors.length > 0) {
                await this.log(`오류 ${errors.length}건 발생: ${errors.join(', ')}`, 'WARN');
            }

            return result;

        } catch (error) {
            const errorMsg = `정리 작업 중 치명적 오류: ${error.message}`;
            await this.log(errorMsg, 'ERROR');
            
            return {
                success: false,
                error: errorMsg,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * 강제 정리 (모든 ENT 파일 삭제) - 긴급상황용
     */
    async forceCleanup() {
        await this.log('강제 정리 시작 - 모든 ENT 파일 삭제', 'WARN');
        
        try {
            if (!(await this.ensureTempDirectory())) {
                return { success: false, error: '임시 디렉토리에 접근할 수 없습니다.' };
            }

            const files = await fs.readdir(this.tempDir);
            const entFiles = files.filter(file => file.endsWith('.ent'));
            
            let deletedCount = 0;
            let totalSize = 0;

            for (const file of entFiles) {
                const filePath = path.join(this.tempDir, file);
                
                try {
                    const stats = await fs.stat(filePath);
                    if (await this.safeDeleteFile(filePath)) {
                        deletedCount++;
                        totalSize += stats.size;
                    }
                } catch (error) {
                    await this.log(`강제 삭제 실패: ${file} - ${error.message}`, 'ERROR');
                }
            }

            await this.log(
                `강제 정리 완료: ${deletedCount}개 파일 삭제, ${this.formatFileSize(totalSize)} 확보`,
                'WARN'
            );

            return {
                success: true,
                deletedFiles: deletedCount,
                freedSpace: totalSize
            };

        } catch (error) {
            await this.log(`강제 정리 중 오류: ${error.message}`, 'ERROR');
            return {
                success: false,
                error: error.message
            };
        }
    }
}

/**
 * 스크립트 직접 실행시 정리 작업 수행
 */
async function runCleanup() {
    const cleaner = new EntFileCleaner();
    
    try {
        console.log('🧹 ENT 파일 정리 스크립트 시작...');
        
        const result = await cleaner.cleanup();
        
        if (result.success) {
            console.log('✅ 정리 작업 완료');
            console.log(`📊 결과: ${result.deletedFiles}/${result.totalFiles}개 파일 삭제`);
            console.log(`💾 확보된 공간: ${result.freedSpaceFormatted || '0 B'}`);
            console.log(`⏱️  소요시간: ${result.durationFormatted}`);
            
            if (result.errors && result.errors.length > 0) {
                console.log(`⚠️  오류: ${result.errors.length}건`);
            }
        } else {
            console.error('❌ 정리 작업 실패:', result.error);
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ 스크립트 실행 오류:', error);
        process.exit(1);
    }
}

/**
 * Cron Job용 함수 (server.js에서 사용)
 */
async function scheduledCleanup() {
    const cleaner = new EntFileCleaner();
    return await cleaner.cleanup();
}

/**
 * 강제 정리 함수 (관리자용)
 */
async function forceCleanupAll() {
    const cleaner = new EntFileCleaner();
    return await cleaner.forceCleanup();
}

// 모듈 내보내기
module.exports = {
    scheduledCleanup,
    forceCleanupAll,
    EntFileCleaner
};

// 스크립트 직접 실행 감지
if (require.main === module) {
    runCleanup();
}
