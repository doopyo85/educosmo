/**
 * 이미지 소실된 Pong2 게시글 정리 스크립트
 * temp 폴더의 이미지가 삭제된 게시글을 찾아서 처리
 */

const { queryDatabase } = require('../lib_login/db');

class BrokenPostCleaner {
    constructor() {
        this.dryRun = true; // 기본값: 실제 삭제하지 않고 확인만
    }

    /**
     * 로그 출력
     */
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * 1. 이미지 소실된 게시글 조회
     */
    async findBrokenPosts() {
        this.log('🔍 이미지 소실된 게시글 검색 시작...');

        try {
            const posts = await queryDatabase(`
                SELECT
                    id,
                    title,
                    author,
                    author_type,
                    board_scope,
                    created_at,
                    views,
                    LENGTH(content) as content_length,
                    SUBSTRING(content, 1, 100) as content_preview
                FROM board_posts
                WHERE content LIKE '%board/images/temp/%'
                ORDER BY created_at DESC
            `);

            this.log(`찾은 게시글: ${posts.length}개`);

            if (posts.length > 0) {
                console.log('\n=== 이미지 소실된 게시글 목록 ===');
                posts.forEach((post, index) => {
                    console.log(`\n${index + 1}. [ID: ${post.id}] ${post.title}`);
                    console.log(`   작성자: ${post.author} (${post.author_type})`);
                    console.log(`   범위: ${post.board_scope}`);
                    console.log(`   작성일: ${post.created_at}`);
                    console.log(`   조회수: ${post.views}`);
                    console.log(`   내용 길이: ${post.content_length} bytes`);
                });
                console.log('\n================================\n');
            }

            return posts;

        } catch (error) {
            this.log(`게시글 검색 실패: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * 2. 게시글 삭제 (실제 삭제)
     */
    async deleteBrokenPosts() {
        this.log('🗑️ 이미지 소실된 게시글 삭제 시작...');

        if (this.dryRun) {
            this.log('⚠️ DRY-RUN 모드: 실제 삭제하지 않습니다', 'WARN');
            this.log('실제 삭제를 원하면 dryRun = false로 설정하세요', 'WARN');
            return { deleted: 0, dryRun: true };
        }

        try {
            const result = await queryDatabase(`
                DELETE FROM board_posts
                WHERE content LIKE '%board/images/temp/%'
            `);

            const deletedCount = result.affectedRows || 0;
            this.log(`✅ 삭제 완료: ${deletedCount}개 게시글`, 'SUCCESS');

            return { deleted: deletedCount, dryRun: false };

        } catch (error) {
            this.log(`게시글 삭제 실패: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * 3. 게시글 비공개 처리 (안전한 대안)
     */
    async hideBrokenPosts() {
        this.log('🔒 이미지 소실된 게시글 비공개 처리 시작 (모든 범위)...');

        if (this.dryRun) {
            this.log('⚠️ DRY-RUN 모드: 실제 변경하지 않습니다', 'WARN');
            return { updated: 0, dryRun: true };
        }

        try {
            const result = await queryDatabase(`
                UPDATE board_posts
                SET is_public = 0,
                    title = CONCAT('[이미지 손실] ', title)
                WHERE content LIKE '%board/images/temp/%'
                  AND is_public = 1
            `);

            const updatedCount = result.affectedRows || 0;
            this.log(`✅ 비공개 처리 완료: ${updatedCount}개 게시글`, 'SUCCESS');

            return { updated: updatedCount, dryRun: false };

        } catch (error) {
            this.log(`게시글 비공개 처리 실패: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * 4. 통계 조회
     */
    async getStats() {
        this.log('📊 게시글 통계 조회...');

        try {
            const stats = await queryDatabase(`
                SELECT
                    COUNT(*) as total_posts,
                    SUM(CASE WHEN content LIKE '%board/images/temp/%' THEN 1 ELSE 0 END) as broken_posts,
                    SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_posts,
                    SUM(CASE WHEN content LIKE '%board/images/temp/%' AND is_public = 1 THEN 1 ELSE 0 END) as public_broken_posts,
                    MAX(created_at) as latest_post
                FROM board_posts
            `);

            const stat = stats[0];
            const brokenPercentage = stat.total_posts > 0
                ? ((stat.broken_posts / stat.total_posts) * 100).toFixed(2)
                : 0;

            console.log('\n=== 게시글 통계 ===');
            console.log(`전체 게시글: ${stat.total_posts}개`);
            console.log(`공개 게시글: ${stat.public_posts}개`);
            console.log(`이미지 소실 (전체): ${stat.broken_posts}개 (${brokenPercentage}%)`);
            console.log(`이미지 소실 (공개): ${stat.public_broken_posts}개`);
            console.log(`최근 게시일: ${stat.latest_post || 'N/A'}`);
            console.log('===================\n');

            return stat;

        } catch (error) {
            this.log(`통계 조회 실패: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * 메인 실행 함수
     */
    async run(mode = 'check') {
        this.log('='.repeat(60));
        this.log('이미지 소실 게시글 정리 스크립트 시작');
        this.log('='.repeat(60));

        try {
            // 통계 조회
            await this.getStats();

            // 이미지 소실된 게시글 조회
            const brokenPosts = await this.findBrokenPosts();

            if (brokenPosts.length === 0) {
                this.log('✅ 이미지 소실된 게시글이 없습니다', 'SUCCESS');
                return { success: true, action: 'none', count: 0 };
            }

            // 모드에 따라 처리
            let result;
            switch (mode) {
                case 'delete':
                    result = await this.deleteBrokenPosts();
                    break;
                case 'hide':
                    result = await this.hideBrokenPosts();
                    break;
                case 'check':
                default:
                    this.log('ℹ️ 확인 모드: 게시글 목록만 표시합니다', 'INFO');
                    result = { checked: brokenPosts.length };
                    break;
            }

            // 최종 통계
            this.log('\n=== 처리 후 통계 ===');
            await this.getStats();

            this.log('='.repeat(60));
            this.log('정리 작업 완료', 'SUCCESS');
            this.log('='.repeat(60));

            return { success: true, ...result };

        } catch (error) {
            this.log(`작업 실패: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }
}

/**
 * 스크립트 직접 실행
 */
async function main() {
    const cleaner = new BrokenPostCleaner();

    // 명령줄 인자 파싱
    const args = process.argv.slice(2);
    const mode = args[0] || 'check'; // check | hide | delete

    if (mode === 'delete' || mode === 'hide') {
        cleaner.dryRun = false;
        console.log(`⚠️ 실제 ${mode === 'delete' ? '삭제' : '비공개 처리'} 모드로 실행합니다!`);
        console.log('10초 후 시작됩니다. Ctrl+C로 취소할 수 있습니다...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    const result = await cleaner.run(mode);

    if (result.success) {
        console.log('\n✅ 작업 성공');
        process.exit(0);
    } else {
        console.error('\n❌ 작업 실패:', result.error);
        process.exit(1);
    }
}

// 모듈 내보내기
module.exports = {
    BrokenPostCleaner
};

// 직접 실행 감지
if (require.main === module) {
    main();
}
