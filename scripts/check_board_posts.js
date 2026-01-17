const { queryDatabase } = require('../lib_login/db');

async function checkPosts() {
    try {
        console.log('=== 최근 게시글 확인 ===\n');

        // 최근 10개 게시글 조회
        const posts = await queryDatabase(`
            SELECT
                id,
                category_id,
                title,
                author,
                author_type,
                board_scope,
                is_public,
                created_at
            FROM board_posts
            ORDER BY created_at DESC
            LIMIT 10
        `);

        console.log(`총 ${posts.length}개의 게시글 발견\n`);

        posts.forEach((post, idx) => {
            console.log(`[${idx + 1}] ID: ${post.id}`);
            console.log(`    제목: ${post.title}`);
            console.log(`    카테고리ID: ${post.category_id}`);
            console.log(`    작성자: ${post.author} (${post.author_type})`);
            console.log(`    board_scope: ${post.board_scope}`);
            console.log(`    is_public: ${post.is_public}`);
            console.log(`    작성일: ${post.created_at}`);
            console.log('');
        });

        console.log('\n=== 카테고리별 게시글 수 ===\n');
        const categoryCount = await queryDatabase(`
            SELECT
                category_id,
                board_scope,
                COUNT(*) as count
            FROM board_posts
            GROUP BY category_id, board_scope
            ORDER BY category_id
        `);

        categoryCount.forEach(row => {
            console.log(`카테고리 ${row.category_id} (${row.board_scope}): ${row.count}개`);
        });

        process.exit(0);
    } catch (error) {
        console.error('오류:', error);
        process.exit(1);
    }
}

checkPosts();
