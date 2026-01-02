-- =====================================================================
-- 이미지 소실된 Pong2 게시글 삭제 스크립트
-- 실행 전 반드시 백업 권장
-- =====================================================================

-- 1. 🔍 먼저 삭제될 게시글 확인 (실행 전 검토)
SELECT
    id,
    title,
    author,
    created_at,
    content
FROM board_posts
WHERE board_scope = 'COMMUNITY'
  AND content LIKE '%board/images/temp/%'
ORDER BY created_at DESC;

-- 2. 🗑️ 이미지 소실된 게시글 삭제
-- (content에 temp 이미지 경로가 포함된 게시글)
DELETE FROM board_posts
WHERE board_scope = 'COMMUNITY'
  AND content LIKE '%board/images/temp/%';

-- 3. ✅ 삭제 결과 확인
SELECT
    COUNT(*) as remaining_posts,
    MAX(created_at) as latest_post
FROM board_posts
WHERE board_scope = 'COMMUNITY';

-- =====================================================================
-- 🔥 안전한 대안: 삭제 대신 비공개 처리
-- =====================================================================

-- 게시글을 삭제하지 않고 비공개로 변경하는 방법:
UPDATE board_posts
SET is_public = 0,
    title = CONCAT('[이미지 손실] ', title)
WHERE board_scope = 'COMMUNITY'
  AND content LIKE '%board/images/temp/%'
  AND is_public = 1;

-- =====================================================================
-- 📊 통계 확인
-- =====================================================================

-- 전체 게시글 중 temp 이미지 포함 비율
SELECT
    COUNT(*) as total_posts,
    SUM(CASE WHEN content LIKE '%board/images/temp/%' THEN 1 ELSE 0 END) as broken_posts,
    ROUND(SUM(CASE WHEN content LIKE '%board/images/temp/%' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as broken_percentage
FROM board_posts
WHERE board_scope = 'COMMUNITY';
