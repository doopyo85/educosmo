const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const { authenticateUser } = require('../../lib_login/authMiddleware');

// 🔥 새로운 라우터들 불러오기
const attachmentRouter = require('./attachmentRouter');
const imageRouter = require('./imageRouter');

// 🔥 S3 이미지 영구화 함수 불러오기
const { processContentImages, processAttachmentFiles } = require('../../lib_board/s3Utils');

// 날짜 포맷 함수
function formatDate(date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// 🔥 새로운 라우터들 등록
router.use('/attachments', attachmentRouter);  // 첨부파일 API
router.use('/images', imageRouter);             // 에디터 이미지 API

// 🔥 새 글 개수 확인 API
router.get('/new-posts-count', async (req, res) => {
    try {
        const userId = req.session?.userID;
        if (!userId) {
            return res.json({ count: 0 });
        }

        console.log('=== 새 글 개수 확인 API 호출 ===');
        console.log('사용자 ID:', userId);

        try {
            const [userVisit] = await db.queryDatabase(`
                SELECT last_board_visit 
                FROM Users 
                WHERE userID = ?
            `, [userId]);

            let lastVisit = userVisit?.last_board_visit;

            if (!lastVisit) {
                await db.queryDatabase(`
                    UPDATE Users 
                    SET last_board_visit = NOW() 
                    WHERE userID = ?
                `, [userId]);
                return res.json({ count: 0 });
            }

            const [currentUser] = await db.queryDatabase(
                'SELECT id FROM Users WHERE userID = ?',
                [userId]
            );

            if (!currentUser) {
                return res.json({ count: 0 });
            }

            const [countResult] = await db.queryDatabase(`
                SELECT COUNT(*) as newCount
                FROM board_posts 
                WHERE created_at > ? 
                AND author_id != ?
            `, [lastVisit, currentUser.id]);

            const newCount = countResult?.newCount || 0;

            res.json({
                success: true,
                count: newCount,
                lastVisit: lastVisit
            });

        } catch (columnError) {
            res.json({ count: 0 });
        }

    } catch (error) {
        console.error('새 글 개수 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '새 글 개수 조회 중 오류가 발생했습니다.'
        });
    }
});

// 🔥 게시판 방문 기록 업데이트 API
router.post('/update-visit', async (req, res) => {
    try {
        const userId = req.session?.userID;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        await db.queryDatabase(`
            UPDATE Users 
            SET last_board_visit = NOW() 
            WHERE userID = ?
        `, [userId]);

        res.json({
            success: true,
            message: '게시판 방문 기록이 업데이트되었습니다.'
        });

    } catch (error) {
        console.error('게시판 방문 기록 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            error: '방문 기록 업데이트 중 오류가 발생했습니다.'
        });
    }
});

// 🔥 게시글 목록 조회 API (첨부파일 정보 포함)
router.get('/posts', async (req, res) => {
    try {
        const { category } = req.query;

        const categoryMap = {
            'free': 3,
            'notice': 1,
            'education': 2
        };

        const categoryNameMap = {
            1: 'notice',
            2: 'education',
            3: 'free'
        };

        if (!category || !categoryMap[category]) {
            // 전체 게시글 조회 (첨부파일, 댓글, 좋아요 정보 포함)
            const posts = await db.queryDatabase(`
                SELECT
                    id, title, author, views, is_pinned, is_notice, created_at,
                    category_id, attachment_count, has_images,
                    comment_count, like_count, reaction_like, reaction_laugh, reaction_heart,
                    CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END as is_new
                FROM board_posts
                WHERE category_id IN (1, 2, 3)
                AND (board_scope = 'EDUCOSMO' OR board_scope IS NULL)
                ORDER BY is_pinned DESC, is_notice DESC, created_at DESC
                LIMIT 20
            `);

            const formattedPosts = posts.map(post => ({
                ...post,
                created_at: formatDate(post.created_at),
                category_name: categoryNameMap[post.category_id] || 'unknown',
                category_slug: categoryNameMap[post.category_id] || 'unknown',
                attachment_count: post.attachment_count || 0,
                comment_count: post.comment_count || 0,
                like_count: post.like_count || 0,
                reaction_like: post.reaction_like || 0,
                reaction_laugh: post.reaction_laugh || 0,
                reaction_heart: post.reaction_heart || 0
            }));

            return res.json({
                success: true,
                posts: formattedPosts,
                pagination: { current: 1, total: 1, limit: 20, count: posts.length }
            });
        }

        // 특정 카테고리 조회
        const categoryId = categoryMap[category];
        const posts = await db.queryDatabase(`
            SELECT
                id, title, author, views, is_pinned, is_notice, created_at,
                category_id, attachment_count, has_images,
                comment_count, like_count, reaction_like, reaction_laugh, reaction_heart,
                CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END as is_new
            FROM board_posts
            WHERE category_id = ?
            AND (board_scope = 'EDUCOSMO' OR board_scope IS NULL)
            ORDER BY is_pinned DESC, is_notice DESC, created_at DESC
            LIMIT 20
        `, [categoryId]);

        const formattedPosts = posts.map(post => ({
            ...post,
            created_at: formatDate(post.created_at),
            category_name: category,
            category_slug: category,
            attachment_count: post.attachment_count || 0,
            comment_count: post.comment_count || 0,
            like_count: post.like_count || 0,
            reaction_like: post.reaction_like || 0,
            reaction_laugh: post.reaction_laugh || 0,
            reaction_heart: post.reaction_heart || 0
        }));

        res.json({
            success: true,
            posts: formattedPosts,
            pagination: { current: 1, total: 1, limit: 20, count: posts.length }
        });

    } catch (error) {
        console.error('게시글 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '게시글 목록을 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// ===================================================
// 🔥 게시글 상세 조회 API (pong2 공유 게시판용)
// GET /api/board/posts/:id
// ===================================================
router.get('/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // 숫자인지 검증 (navigation과 구분)
        if (isNaN(parseInt(postId))) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 게시글 ID입니다.'
            });
        }

        const categoryNameMap = {
            1: 'notice',
            2: 'education',
            3: 'free'
        };

        const categoryDisplayMap = {
            1: '업데이트 노트',
            2: '교육정보',
            3: '자유게시판'
        };

        // 게시글 조회
        const posts = await db.queryDatabase(`
            SELECT 
                bp.id,
                bp.title,
                bp.content,
                bp.author,
                bp.author_id,
                bp.views,
                bp.is_pinned,
                bp.is_notice,
                bp.source,
                bp.ccl,
                bp.category_id,
                bp.attachment_count,
                bp.has_images,
                bp.created_at,
                bp.updated_at
            FROM board_posts bp
            WHERE bp.id = ?
        `, [postId]);

        if (!posts || posts.length === 0) {
            return res.status(404).json({
                success: false,
                message: '게시글을 찾을 수 없습니다.'
            });
        }

        const post = posts[0];

        // 조회수 증가
        await db.queryDatabase(
            'UPDATE board_posts SET views = views + 1 WHERE id = ?',
            [postId]
        );

        // 첨부파일 조회
        const attachments = await db.queryDatabase(`
            SELECT 
                id,
                original_name,
                stored_name,
                file_size,
                file_type,
                s3_url,
                is_image,
                download_count,
                created_at
            FROM board_attachments
            WHERE post_id = ?
            ORDER BY created_at ASC
        `, [postId]);

        // JSON 응답 반환
        res.json({
            success: true,
            post: {
                id: post.id,
                title: post.title,
                content: post.content,
                author: post.author,
                author_id: post.author_id,
                views: post.views + 1, // 증가된 조회수 반영
                is_pinned: post.is_pinned,
                is_notice: post.is_notice,
                source: post.source,
                ccl: post.ccl,
                category_id: post.category_id,
                category_name: categoryDisplayMap[post.category_id] || '알 수 없음',
                category_slug: categoryNameMap[post.category_id] || 'unknown',
                attachment_count: post.attachment_count || 0,
                has_images: post.has_images || false,
                created_at: formatDate(post.created_at),
                updated_at: formatDate(post.updated_at)
            },
            attachments: attachments || []
        });

    } catch (error) {
        console.error('게시글 상세 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '게시글을 불러오는 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 🔥 게시글 작성 API (첨부파일 지원 + 이미지 영구화)
router.post('/posts', authenticateUser, async (req, res) => {
    try {
        let { title, content, category_id, source, ccl, is_notice, is_pinned, attachments } = req.body;
        const userId = req.session.userID;

        // 필수 필드 검증
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: '제목을 입력해주세요.' });
        }

        if (!content || content.trim() === '' || content.trim() === '<p></p>') {
            return res.status(400).json({ error: '내용을 입력해주세요.' });
        }

        if (!category_id) {
            return res.status(400).json({ error: '카테고리를 선택해주세요.' });
        }

        // 사용자 정보 조회
        const users = await db.queryDatabase('SELECT id, name FROM Users WHERE userID = ?', [userId]);
        if (users.length === 0) {
            return res.status(401).json({ error: '사용자 정보를 찾을 수 없습니다.' });
        }

        const user = users[0];
        const categoryIdInt = parseInt(category_id);

        // 카테고리 유효성 검사
        if (![1, 2, 3].includes(categoryIdInt)) {
            return res.status(400).json({ error: '존재하지 않는 카테고리입니다.' });
        }

        // 🔥 Step 1: content 내 temp 이미지를 정식 경로로 이동
        console.log('=== 게시글 작성: 이미지 영구화 시작 ===');
        const imageResult = await processContentImages(content);
        content = imageResult.content;  // 업데이트된 content
        console.log(`이동된 이미지: ${imageResult.movedImages.length}개`);

        // 🔥 Step 2: 첨부파일 temp → 정식 경로 이동
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            console.log(`=== 첨부파일 영구화 시작: ${attachments.length}개 ===`);
            attachments = await processAttachmentFiles(attachments);
        }

        // 첨부파일 정보 계산
        const attachmentCount = attachments && Array.isArray(attachments) ? attachments.length : 0;
        const hasImages = attachments && Array.isArray(attachments) ?
            attachments.some(att => att.isImage || att.type?.startsWith('image/')) : false;

        // 게시글 INSERT
        const insertQuery = `
            INSERT INTO board_posts
            (category_id, title, content, author, author_id, source, ccl, is_notice, is_pinned,
             attachment_count, has_images, board_scope, is_public, author_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EDUCOSMO', 1, 'PAID', NOW(), NOW())
        `;

        const result = await db.queryDatabase(insertQuery, [
            categoryIdInt,
            title.trim(),
            content.trim(),
            user.name || userId,
            user.id,
            source ? source.trim() : null,
            ccl || null,
            (is_notice === '1' || is_notice === true) ? 1 : 0,
            (is_pinned === '1' || is_pinned === true) ? 1 : 0,
            attachmentCount,
            hasImages
        ]);

        const postId = result.insertId;

        // 첨부파일 연결 처리
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            for (const attachment of attachments) {
                try {
                    await db.queryDatabase(`
                        INSERT INTO board_attachments 
                        (post_id, original_name, stored_name, file_size, file_type, s3_url, is_image, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                    `, [
                        postId,
                        attachment.originalName || attachment.name,
                        attachment.key,
                        attachment.size || 0,
                        attachment.type || 'application/octet-stream',
                        attachment.url,
                        attachment.isImage || false
                    ]);
                } catch (attachError) {
                    console.error('첨부파일 연결 오류:', attachError);
                }
            }
        }

        res.json({
            success: true,
            postId,
            message: '게시글이 성공적으로 작성되었습니다.',
            data: {
                id: postId,
                title: title.trim(),
                category_id: categoryIdInt,
                attachment_count: attachmentCount,
                has_images: hasImages
            }
        });

    } catch (error) {
        console.error('게시글 작성 오류:', error);
        res.status(500).json({
            error: '게시글 작성 중 오류가 발생했습니다.'
        });
    }
});

// 🔥 게시글 수정 API (첨부파일 지원 + 이미지 영구화)
router.put('/posts/:id', authenticateUser, async (req, res) => {
    try {
        const postId = req.params.id;
        let { title, content, category_id, source, ccl, is_notice, is_pinned, attachments } = req.body;
        const userID = req.session.userID;
        const userRole = req.session.role;

        console.log('=== 게시글 수정 API 호출 ===');
        console.log('게시글 ID:', postId);
        console.log('사용자:', userID);
        console.log('제목:', title);
        console.log('첨부파일 개수:', attachments ? attachments.length : 0);

        // 게시글 존재 및 권한 확인
        const [existingPost] = await db.queryDatabase(
            'SELECT author FROM board_posts WHERE id = ?',
            [postId]
        );

        if (!existingPost) {
            console.log('❌ 게시글을 찾을 수 없음:', postId);
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }

        const canEdit = existingPost.author === userID || ['admin', 'manager'].includes(userRole);

        if (!canEdit) {
            console.log('❌ 권한 없음:', { author: existingPost.author, userID });
            return res.status(403).json({ error: '수정 권한이 없습니다.' });
        }

        // 🔥 Step 1: content 내 temp 이미지를 정식 경로로 이동
        console.log('=== 게시글 수정: 이미지 영구화 시작 ===');
        const imageResult = await processContentImages(content);
        content = imageResult.content;  // 업데이트된 content
        console.log(`이동된 이미지: ${imageResult.movedImages.length}개`);

        // 🔥 Step 2: 첨부파일 temp → 정식 경로 이동
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            console.log(`=== 첨부파일 영구화 시작: ${attachments.length}개 ===`);
            attachments = await processAttachmentFiles(attachments);
        }

        // 첨부파일 정보 계산
        let attachmentCount = 0;
        let hasImages = false;

        if (attachments && Array.isArray(attachments)) {
            attachmentCount = attachments.length;
            hasImages = attachments.some(att =>
                att.isImage ||
                (att.type && att.type.startsWith('image/')) ||
                (att.originalName && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.originalName))
            );

            console.log('첨부파일 처리:', {
                count: attachmentCount,
                hasImages: hasImages,
                files: attachments.map(att => att.originalName || att.name)
            });
        }

        // 게시글 업데이트 (첨부파일 정보 포함)
        await db.queryDatabase(
            `UPDATE board_posts 
             SET title = ?, content = ?, category_id = ?, source = ?, ccl = ?, 
                 is_notice = ?, is_pinned = ?, attachment_count = ?, has_images = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                title,
                content,
                category_id,
                source || '',
                ccl || '',
                (is_notice === '1' || is_notice === true) ? 1 : 0,
                (is_pinned === '1' || is_pinned === true) ? 1 : 0,
                attachmentCount,
                hasImages ? 1 : 0,
                postId
            ]
        );

        // 기존 첨부파일 삭제 (새로 업로드된 것으로 교체)
        await db.queryDatabase('DELETE FROM board_attachments WHERE post_id = ?', [postId]);

        // 새 첨부파일 정보 저장
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            for (const attachment of attachments) {
                try {
                    await db.queryDatabase(
                        `INSERT INTO board_attachments 
                         (post_id, original_name, stored_name, file_size, file_type, s3_url, is_image, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            postId,
                            attachment.originalName || attachment.name || 'unknown',
                            attachment.key || attachment.stored_name || '',
                            attachment.size || 0,
                            attachment.type || 'application/octet-stream',
                            attachment.url || attachment.s3_url || '',
                            attachment.isImage || (attachment.type && attachment.type.startsWith('image/')) ? 1 : 0
                        ]
                    );
                } catch (attachError) {
                    console.error('첨부파일 저장 오류:', attachError);
                }
            }
        }

        console.log('✅ 게시글 수정 완료:', {
            postId,
            attachmentCount,
            hasImages
        });

        res.json({
            success: true,
            message: '게시글이 수정되었습니다.',
            data: {
                id: postId,
                attachment_count: attachmentCount,
                has_images: hasImages
            }
        });

    } catch (error) {
        console.error('❌ 게시글 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 🔥 게시글 삭제 API (첨부파일도 함께 삭제)
router.delete('/posts/:id', authenticateUser, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.session.userID;
        const userRole = req.session.role;

        // 게시글 존재 및 권한 확인
        const posts = await db.queryDatabase('SELECT * FROM board_posts WHERE id = ?', [postId]);
        if (posts.length === 0) {
            return res.status(404).json({
                success: false,
                error: '게시글을 찾을 수 없습니다.'
            });
        }

        const post = posts[0];
        const canDelete =
            post.author === userId ||
            post.author_id.toString() === userId ||
            ['admin', 'manager'].includes(userRole);

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                error: '게시글을 삭제할 권한이 없습니다.'
            });
        }

        // 첨부파일 먼저 삭제 (S3에서도 삭제)
        const attachments = await db.queryDatabase(
            'SELECT stored_name, original_name FROM board_attachments WHERE post_id = ?',
            [postId]
        );

        console.log('삭제할 첨부파일:', attachments.length + '개');

        if (attachments.length > 0) {
            try {
                const { deleteFromS3 } = require('../../lib_board/s3Utils');

                for (const attachment of attachments) {
                    try {
                        await deleteFromS3(attachment.stored_name);
                        console.log('S3 파일 삭제 완료:', attachment.original_name);
                    } catch (s3Error) {
                        console.error('S3 파일 삭제 오류:', s3Error);
                        // S3 삭제 실패해도 계속 진행
                    }
                }
            } catch (moduleError) {
                console.log('S3Utils 모듈이 없어서 S3 삭제를 건너뜁니다:', moduleError.message);
            }

            // DB에서 첨부파일 기록 삭제
            await db.queryDatabase('DELETE FROM board_attachments WHERE post_id = ?', [postId]);
            console.log('DB 첨부파일 기록 삭제 완료');
        }

        // 게시글 삭제
        await db.queryDatabase('DELETE FROM board_posts WHERE id = ?', [postId]);

        console.log('=== 게시글 삭제 완료 ===');

        res.json({
            success: true,
            message: '게시글이 성공적으로 삭제되었습니다.',
            data: {
                deleted_post_id: postId,
                deleted_attachments: attachments.length
            }
        });

    } catch (error) {
        console.error('게시글 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '게시글 삭제 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 🔥 이전글/다음글 네비게이션 API
router.get('/posts/:id/navigation', async (req, res) => {
    try {
        const postId = parseInt(req.params.id);

        if (isNaN(postId)) {
            return res.status(400).json({ error: '올바르지 않은 게시글 ID입니다.' });
        }

        // 현재 게시글 정보 조회
        const currentPosts = await db.queryDatabase(
            'SELECT id, category_id FROM board_posts WHERE id = ?',
            [postId]
        );

        if (currentPosts.length === 0) {
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }

        const categoryId = currentPosts[0].category_id;

        // 이전글 조회 (같은 카테고리, 더 큰 ID)
        const prevPosts = await db.queryDatabase(`
            SELECT id, title FROM board_posts
            WHERE category_id = ? AND id > ?
            ORDER BY id ASC LIMIT 1
        `, [categoryId, postId]);

        // 다음글 조회 (같은 카테고리, 더 작은 ID)
        const nextPosts = await db.queryDatabase(`
            SELECT id, title FROM board_posts
            WHERE category_id = ? AND id < ?
            ORDER BY id DESC LIMIT 1
        `, [categoryId, postId]);

        res.json({
            prev: prevPosts.length > 0 ? prevPosts[0] : null,
            next: nextPosts.length > 0 ? nextPosts[0] : null
        });

    } catch (error) {
        console.error('네비게이션 조회 오류:', error);
        res.status(500).json({
            error: '네비게이션 정보를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 댓글 API (PAID/PONG2 공용)
// ============================================

// 🔥 댓글 목록 조회 (계층 구조)
router.get('/posts/:postId/comments', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);

        if (isNaN(postId)) {
            return res.status(400).json({ error: '올바르지 않은 게시글 ID입니다.' });
        }

        // 모든 댓글 조회 (삭제되지 않은 것만)
        const comments = await db.queryDatabase(`
            SELECT
                id, post_id, parent_id, content, author_name, author_id,
                author_type, created_at, is_deleted
            FROM BoardComments
            WHERE post_id = ?
            ORDER BY created_at ASC
        `, [postId]);

        // 계층 구조로 변환
        const commentMap = {};
        const rootComments = [];

        comments.forEach(comment => {
            comment.children = [];
            commentMap[comment.id] = comment;
        });

        comments.forEach(comment => {
            if (comment.parent_id) {
                // 대댓글
                if (commentMap[comment.parent_id]) {
                    commentMap[comment.parent_id].children.push(comment);
                }
            } else {
                // 루트 댓글
                rootComments.push(comment);
            }
        });

        res.json({
            success: true,
            comments: rootComments,
            total: comments.length
        });

    } catch (error) {
        console.error('댓글 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '댓글을 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 🔥 댓글 작성
router.post('/posts/:postId/comments', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const { content, parent_id } = req.body;

        // 로그인 확인
        if (!req.session?.userID) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        if (isNaN(postId)) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 게시글 ID입니다.'
            });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: '댓글 내용을 입력해주세요.'
            });
        }

        if (content.length > 500) {
            return res.status(400).json({
                success: false,
                error: '댓글은 500자 이내로 작성해주세요.'
            });
        }

        // depth 검증 (대댓글인 경우)
        if (parent_id) {
            const parentComments = await db.queryDatabase(
                'SELECT parent_id FROM BoardComments WHERE id = ?',
                [parent_id]
            );

            if (parentComments.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: '부모 댓글을 찾을 수 없습니다.'
                });
            }

            // 이미 대댓글이면 3단계 불가
            if (parentComments[0].parent_id !== null) {
                return res.status(400).json({
                    success: false,
                    error: '대댓글은 2단계까지만 가능합니다.'
                });
            }
        }

        // 사용자 정보
        const userID = req.session.userID;
        const userName = req.session.name || req.session.userID;

        // Users 테이블에서 id 조회
        const userRows = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const userId = userRows[0].id;
        const authorType = 'PAID'; // educodingnplay는 항상 PAID

        // 댓글 삽입
        const result = await db.queryDatabase(`
            INSERT INTO BoardComments
            (post_id, parent_id, content, author_name, author_id, author_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [postId, parent_id || null, content.trim(), userName, userId, authorType]);

        // 삽입된 댓글 조회
        const newComment = await db.queryDatabase(
            'SELECT * FROM BoardComments WHERE id = ?',
            [result.insertId]
        );

        res.json({
            success: true,
            message: '댓글이 작성되었습니다.',
            comment: newComment[0]
        });

    } catch (error) {
        console.error('댓글 작성 오류:', error);
        res.status(500).json({
            success: false,
            error: '댓글 작성 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 🔥 댓글 수정
router.put('/comments/:commentId', async (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);
        const { content } = req.body;

        // 로그인 확인
        if (!req.session?.userID) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        if (isNaN(commentId)) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 댓글 ID입니다.'
            });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: '댓글 내용을 입력해주세요.'
            });
        }

        // 댓글 조회 (권한 확인용)
        const comments = await db.queryDatabase(
            'SELECT author_id, is_deleted FROM BoardComments WHERE id = ?',
            [commentId]
        );

        if (comments.length === 0) {
            return res.status(404).json({
                success: false,
                error: '댓글을 찾을 수 없습니다.'
            });
        }

        const comment = comments[0];
        const userID = req.session.userID;
        const userRole = req.session.role;

        // Users 테이블에서 id 조회
        const userRows = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const userId = userRows[0].id;

        // 권한 확인 (본인 또는 관리자)
        if (comment.author_id !== userId && !['admin', 'manager'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: '댓글을 수정할 권한이 없습니다.'
            });
        }

        if (comment.is_deleted) {
            return res.status(400).json({
                success: false,
                error: '삭제된 댓글은 수정할 수 없습니다.'
            });
        }

        // 댓글 수정
        await db.queryDatabase(
            'UPDATE BoardComments SET content = ? WHERE id = ?',
            [content.trim(), commentId]
        );

        res.json({
            success: true,
            message: '댓글이 수정되었습니다.'
        });

    } catch (error) {
        console.error('댓글 수정 오류:', error);
        res.status(500).json({
            success: false,
            error: '댓글 수정 중 오류가 발생했습니다.'
        });
    }
});

// 🔥 댓글 삭제 (soft delete)
router.delete('/comments/:commentId', async (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);

        // 로그인 확인
        if (!req.session?.userID) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        if (isNaN(commentId)) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 댓글 ID입니다.'
            });
        }

        // 댓글 조회 (권한 확인용)
        const comments = await db.queryDatabase(
            'SELECT author_id, is_deleted FROM BoardComments WHERE id = ?',
            [commentId]
        );

        if (comments.length === 0) {
            return res.status(404).json({
                success: false,
                error: '댓글을 찾을 수 없습니다.'
            });
        }

        const comment = comments[0];
        const userID = req.session.userID;
        const userRole = req.session.role;

        // Users 테이블에서 id 조회
        const userRows = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const userId = userRows[0].id;

        // 권한 확인 (본인 또는 관리자)
        if (comment.author_id !== userId && !['admin', 'manager'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: '댓글을 삭제할 권한이 없습니다.'
            });
        }

        // Soft delete
        await db.queryDatabase(
            'UPDATE BoardComments SET is_deleted = 1 WHERE id = ?',
            [commentId]
        );

        res.json({
            success: true,
            message: '댓글이 삭제되었습니다.'
        });

    } catch (error) {
        console.error('댓글 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '댓글 삭제 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 좋아요/반응 API (PAID/PONG2 공용)
// ============================================

// 🔥 반응 토글 (추가/제거)
router.post('/posts/:postId/react', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const { reaction_type } = req.body;

        // 로그인 확인
        if (!req.session?.userID) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        if (isNaN(postId)) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 게시글 ID입니다.'
            });
        }

        // 반응 타입 검증
        const validReactions = ['like', 'laugh', 'heart'];
        if (!validReactions.includes(reaction_type)) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 반응 타입입니다.'
            });
        }

        const userID = req.session.userID;
        const userType = 'PAID'; // educodingnplay는 항상 PAID

        // Users 테이블에서 id 조회
        const userRows = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const userId = userRows[0].id;

        // 기존 반응 확인
        const existingReactions = await db.queryDatabase(`
            SELECT id FROM BoardReactions
            WHERE post_id = ? AND user_id = ? AND user_type = ? AND reaction_type = ?
        `, [postId, userId, userType, reaction_type]);

        let action = '';

        if (existingReactions.length > 0) {
            // 반응 제거 (토글 off)
            await db.queryDatabase(
                'DELETE FROM BoardReactions WHERE id = ?',
                [existingReactions[0].id]
            );
            action = 'removed';
        } else {
            // 반응 추가 (토글 on)
            await db.queryDatabase(`
                INSERT INTO BoardReactions (post_id, user_id, user_type, reaction_type)
                VALUES (?, ?, ?, ?)
            `, [postId, userId, userType, reaction_type]);
            action = 'added';
        }

        // 업데이트된 반응 정보 조회
        const reactionData = await getReactionData(postId, userId, userType);

        res.json({
            success: true,
            action: action,
            message: action === 'added' ? '반응을 추가했습니다.' : '반응을 취소했습니다.',
            ...reactionData
        });

    } catch (error) {
        console.error('반응 토글 오류:', error);
        res.status(500).json({
            success: false,
            error: '반응 처리 중 오류가 발생했습니다.'
        });
    }
});

// 🔥 게시글 반응 조회
router.get('/posts/:postId/reactions', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);

        if (isNaN(postId)) {
            return res.status(400).json({
                success: false,
                error: '올바르지 않은 게시글 ID입니다.'
            });
        }

        const userType = 'PAID';
        let userId = null;

        // 로그인한 경우에만 userId 조회
        if (req.session?.userID) {
            const userRows = await db.queryDatabase(
                'SELECT id FROM Users WHERE userID = ?',
                [req.session.userID]
            );
            if (userRows.length > 0) {
                userId = userRows[0].id;
            }
        }

        const reactionData = await getReactionData(postId, userId, userType);

        res.json({
            success: true,
            ...reactionData
        });

    } catch (error) {
        console.error('반응 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '반응 정보를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 헬퍼 함수: 반응 데이터 조회
async function getReactionData(postId, userId, userType) {
    // 전체 반응 수 조회
    const reactionCounts = await db.queryDatabase(`
        SELECT reaction_type, COUNT(*) as count
        FROM BoardReactions
        WHERE post_id = ?
        GROUP BY reaction_type
    `, [postId]);

    const reactions = {
        like: 0,
        laugh: 0,
        heart: 0
    };

    reactionCounts.forEach(row => {
        reactions[row.reaction_type] = row.count;
    });

    // 내 반응 상태 조회 (로그인한 경우만)
    let myReactions = {
        like: false,
        laugh: false,
        heart: false
    };

    if (userId) {
        const myReactionRows = await db.queryDatabase(`
            SELECT reaction_type
            FROM BoardReactions
            WHERE post_id = ? AND user_id = ? AND user_type = ?
        `, [postId, userId, userType]);

        myReactionRows.forEach(row => {
            myReactions[row.reaction_type] = true;
        });
    }

    return {
        reactions,
        myReactions
    };
}

module.exports = router;