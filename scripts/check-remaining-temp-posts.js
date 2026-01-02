/**
 * 남은 temp 이미지 게시글 상세 확인
 */

const { queryDatabase } = require('../lib_login/db');

async function checkRemainingTempPosts() {
    console.log('🔍 temp 이미지가 포함된 공개 게시글 검색...\n');

    try {
        // 1. 공개 게시글 중 temp 이미지 포함 게시글
        const publicPosts = await queryDatabase(`
            SELECT
                id,
                title,
                author,
                author_type,
                is_public,
                created_at,
                board_scope,
                category_id,
                content
            FROM board_posts
            WHERE content LIKE '%board/images/temp/%'
              AND is_public = 1
            ORDER BY created_at DESC
        `);

        console.log(`📊 공개된 temp 이미지 게시글: ${publicPosts.length}개\n`);

        if (publicPosts.length > 0) {
            console.log('=== 공개 상태의 temp 이미지 게시글 목록 ===\n');
            publicPosts.forEach((post, index) => {
                console.log(`${index + 1}. [ID: ${post.id}] ${post.title}`);
                console.log(`   작성자: ${post.author} (${post.author_type})`);
                console.log(`   상태: ${post.is_public ? '공개' : '비공개'}`);
                console.log(`   범위: ${post.board_scope}`);
                console.log(`   카테고리: ${post.category_id}`);
                console.log(`   작성일: ${post.created_at}`);

                // temp 이미지 URL 추출
                const tempUrls = post.content.match(/board\/images\/temp\/[a-f0-9-]+\.(png|jpg|webp|gif)/gi);
                console.log(`   temp 이미지: ${tempUrls ? tempUrls.length : 0}개`);
                if (tempUrls) {
                    tempUrls.forEach(url => console.log(`      - ${url}`));
                }
                console.log('');
            });
            console.log('=========================================\n');
        }

        // 2. 비공개 처리된 temp 이미지 게시글
        const hiddenPosts = await queryDatabase(`
            SELECT
                id,
                title,
                author,
                is_public,
                created_at
            FROM board_posts
            WHERE content LIKE '%board/images/temp/%'
              AND is_public = 0
            ORDER BY created_at DESC
        `);

        console.log(`📊 비공개 처리된 temp 이미지 게시글: ${hiddenPosts.length}개\n`);

        // 3. 전체 통계
        const stats = await queryDatabase(`
            SELECT
                board_scope,
                COUNT(*) as total,
                SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_count,
                SUM(CASE WHEN content LIKE '%board/images/temp/%' THEN 1 ELSE 0 END) as temp_image_count
            FROM board_posts
            GROUP BY board_scope
        `);

        console.log('=== 범위별 통계 ===');
        stats.forEach(stat => {
            console.log(`${stat.board_scope}:`);
            console.log(`  전체: ${stat.total}개`);
            console.log(`  공개: ${stat.public_count}개`);
            console.log(`  temp 이미지: ${stat.temp_image_count}개`);
        });
        console.log('===================\n');

        // 4. 권장 조치
        if (publicPosts.length > 0) {
            console.log('⚠️ 권장 조치:');
            console.log(`   아직 ${publicPosts.length}개의 공개 게시글에 temp 이미지가 포함되어 있습니다.`);
            console.log('   비공개 처리를 다시 실행하세요:');
            console.log('   node scripts/cleanup-broken-posts.js hide\n');
        } else {
            console.log('✅ 모든 temp 이미지 게시글이 비공개 처리되었습니다.');
            console.log('   브라우저 캐시를 삭제하고 강제 새로고침(Ctrl+F5)하세요.\n');
        }

    } catch (error) {
        console.error('❌ 오류:', error);
        process.exit(1);
    }
}

// 실행
if (require.main === module) {
    checkRemainingTempPosts().then(() => process.exit(0));
}

module.exports = { checkRemainingTempPosts };
