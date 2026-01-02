/**
 * 통합 일일 정리 스크립트
 * 모든 임시 파일 정리 작업을 하나의 cron으로 통합
 * 매일 새벽 2시 실행 (서버 부하 최소화)
 */

const { cleanupTemporaryFiles } = require('../lib_board/attachmentService');
const { scheduledCleanup: cleanupEntFiles } = require('./cleanup-ent-files');

class DailyCleanupManager {
    constructor() {
        this.startTime = null;
        this.results = {};
    }

    /**
     * 로그 메시지 출력
     */
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [DAILY-CLEANUP] [${level}] ${message}`);
    }

    /**
     * 메인 정리 함수
     */
    async runAllCleanupTasks() {
        this.startTime = Date.now();
        this.results = {
            s3TempImages: null,
            entFiles: null,
            entryAssets: null,
            subscriptions: null
        };

        this.log('='.repeat(60));
        this.log('일일 정리 작업 시작');
        this.log('='.repeat(60));

        // 1. S3 임시 파일 정리 (게시판 이미지 & 첨부파일)
        await this.cleanupS3TempFiles();

        // 2. ENT 파일 정리 (Entry 프로젝트 파일)
        await this.cleanupEntFilesTask();

        // 3. Entry 에셋 정리
        await this.cleanupEntryAssets();

        // 4. 구독 상태 업데이트
        await this.updateSubscriptionStatus();

        // 결과 요약
        this.printSummary();

        return {
            success: true,
            duration: Date.now() - this.startTime,
            results: this.results
        };
    }

    /**
     * 1. S3 임시 파일 정리 (board/images/temp/, board/attachments/temp/)
     */
    async cleanupS3TempFiles() {
        this.log('[1/4] S3 임시 파일 정리 시작 (게시판 이미지/첨부파일)');

        try {
            const result = await cleanupTemporaryFiles();
            this.results.s3TempImages = result;

            if (result.success) {
                this.log(`✅ S3 임시 파일 정리 완료`, 'SUCCESS');
            } else {
                this.log(`⚠️ S3 임시 파일 정리 중 일부 오류 발생`, 'WARN');
            }
        } catch (error) {
            this.log(`❌ S3 임시 파일 정리 실패: ${error.message}`, 'ERROR');
            this.results.s3TempImages = { success: false, error: error.message };
        }
    }

    /**
     * 2. ENT 파일 정리 (temp/ent_files/*.ent)
     */
    async cleanupEntFilesTask() {
        this.log('[2/4] ENT 임시 파일 정리 시작');

        try {
            const result = await cleanupEntFiles();
            this.results.entFiles = result;

            if (result.success && result.deletedFiles > 0) {
                this.log(`✅ ENT 파일 정리 완료: ${result.deletedFiles}개 파일 삭제`, 'SUCCESS');
            } else if (result.success) {
                this.log(`ℹ️  정리할 ENT 파일 없음`, 'INFO');
            } else {
                this.log(`⚠️ ENT 파일 정리 중 오류 발생`, 'WARN');
            }
        } catch (error) {
            this.log(`❌ ENT 파일 정리 실패: ${error.message}`, 'ERROR');
            this.results.entFiles = { success: false, error: error.message };
        }
    }

    /**
     * 3. Entry 에셋 정리 (public/entry-assets/*)
     */
    async cleanupEntryAssets() {
        this.log('[3/4] Entry 에셋 정리 시작');

        try {
            const fs = require('fs').promises;
            const path = require('path');
            const entryAssetsDir = path.join(__dirname, '..', 'public', 'entry-assets');

            if (!await this.directoryExists(entryAssetsDir)) {
                this.log(`ℹ️  Entry 에셋 디렉토리가 존재하지 않음`, 'INFO');
                this.results.entryAssets = { success: true, deletedFiles: 0, message: 'Directory not found' };
                return;
            }

            const files = await fs.readdir(entryAssetsDir);
            const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24시간 전
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(entryAssetsDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.birthtimeMs < cutoffTime) {
                        await fs.unlink(filePath);
                        deletedCount++;
                    }
                } catch (error) {
                    this.log(`파일 삭제 실패: ${file} - ${error.message}`, 'ERROR');
                }
            }

            this.results.entryAssets = { success: true, deletedFiles: deletedCount };

            if (deletedCount > 0) {
                this.log(`✅ Entry 에셋 정리 완료: ${deletedCount}개 파일 삭제`, 'SUCCESS');
            } else {
                this.log(`ℹ️  정리할 Entry 에셋 없음`, 'INFO');
            }

        } catch (error) {
            this.log(`❌ Entry 에셋 정리 실패: ${error.message}`, 'ERROR');
            this.results.entryAssets = { success: false, error: error.message };
        }
    }

    /**
     * 4. 구독 상태 업데이트 (만료된 구독 처리)
     */
    async updateSubscriptionStatus() {
        this.log('[4/4] 구독 상태 업데이트 시작');

        try {
            const db = require('../lib_login/db');

            const result = await db.queryDatabase(
                `UPDATE Users SET subscription_status = 'expired'
                 WHERE subscription_end_date < CURDATE()
                 AND subscription_status = 'active'`
            );

            this.results.subscriptions = {
                success: true,
                updatedUsers: result.affectedRows || 0
            };

            if (result.affectedRows > 0) {
                this.log(`✅ 구독 상태 업데이트 완료: ${result.affectedRows}명 만료 처리`, 'SUCCESS');
            } else {
                this.log(`ℹ️  만료 처리할 구독 없음`, 'INFO');
            }

        } catch (error) {
            this.log(`❌ 구독 상태 업데이트 실패: ${error.message}`, 'ERROR');
            this.results.subscriptions = { success: false, error: error.message };
        }
    }

    /**
     * 디렉토리 존재 여부 확인
     */
    async directoryExists(dirPath) {
        try {
            const fs = require('fs').promises;
            await fs.access(dirPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 결과 요약 출력
     */
    printSummary() {
        const duration = Date.now() - this.startTime;
        const durationMin = Math.floor(duration / 60000);
        const durationSec = Math.floor((duration % 60000) / 1000);

        this.log('='.repeat(60));
        this.log('일일 정리 작업 완료');
        this.log('='.repeat(60));
        this.log(`총 소요 시간: ${durationMin}분 ${durationSec}초`);
        this.log('');
        this.log('📊 작업 결과 요약:');
        this.log('');

        // S3 임시 파일
        if (this.results.s3TempImages?.success) {
            this.log(`✅ S3 임시 파일: 정상 처리`);
        } else {
            this.log(`❌ S3 임시 파일: 실패 - ${this.results.s3TempImages?.error || 'Unknown'}`);
        }

        // ENT 파일
        if (this.results.entFiles?.success) {
            this.log(`✅ ENT 파일: ${this.results.entFiles.deletedFiles}개 삭제`);
        } else {
            this.log(`❌ ENT 파일: 실패 - ${this.results.entFiles?.error || 'Unknown'}`);
        }

        // Entry 에셋
        if (this.results.entryAssets?.success) {
            this.log(`✅ Entry 에셋: ${this.results.entryAssets.deletedFiles}개 삭제`);
        } else {
            this.log(`❌ Entry 에셋: 실패 - ${this.results.entryAssets?.error || 'Unknown'}`);
        }

        // 구독 상태
        if (this.results.subscriptions?.success) {
            this.log(`✅ 구독 상태: ${this.results.subscriptions.updatedUsers}명 업데이트`);
        } else {
            this.log(`❌ 구독 상태: 실패 - ${this.results.subscriptions?.error || 'Unknown'}`);
        }

        this.log('='.repeat(60));
    }
}

/**
 * Cron Job용 함수 (server.js에서 호출)
 */
async function runDailyCleanup() {
    const manager = new DailyCleanupManager();
    return await manager.runAllCleanupTasks();
}

/**
 * 스크립트 직접 실행시 정리 작업 수행
 */
async function runScript() {
    try {
        console.log('🧹 일일 정리 스크립트 수동 실행...');
        const result = await runDailyCleanup();

        if (result.success) {
            console.log('✅ 정리 작업 완료');
            process.exit(0);
        } else {
            console.error('❌ 정리 작업 실패');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ 스크립트 실행 오류:', error);
        process.exit(1);
    }
}

// 모듈 내보내기
module.exports = {
    runDailyCleanup,
    DailyCleanupManager
};

// 스크립트 직접 실행 감지
if (require.main === module) {
    runScript();
}
