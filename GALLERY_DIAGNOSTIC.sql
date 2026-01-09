-- 갤러리 문제 진단 SQL 스크립트
-- 사용법: userID를 실제 값으로 변경 후 실행

SET @target_userID = 'test85';  -- 여기에 확인할 사용자 ID 입력

-- ========================================
-- 1️⃣ 사용자 확인
-- ========================================
SELECT '=== 1. 사용자 확인 ===' as step;
SELECT id, userID, name, role
FROM Users
WHERE userID = @target_userID;

-- ========================================
-- 2️⃣ 제출 기록 확인 (ProjectSubmissions)
-- ========================================
SELECT '=== 2. 제출 기록 (ProjectSubmissions) ===' as step;
SELECT
    id,
    user_id,
    project_name,
    platform,
    save_type,
    file_size_kb,
    s3_url,
    thumbnail_url,
    created_at
FROM ProjectSubmissions
WHERE user_id = (SELECT id FROM Users WHERE userID = @target_userID)
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- 3️⃣ 갤러리 등록 확인 (gallery_projects)
-- ========================================
SELECT '=== 3. 갤러리 등록 (gallery_projects) ===' as step;
SELECT
    id,
    user_id,
    title,
    platform,
    s3_url,
    thumbnail_url,
    project_submission_id,
    is_active,
    visibility,
    view_count,
    like_count,
    play_count,
    created_at
FROM gallery_projects
WHERE user_id = (SELECT id FROM Users WHERE userID = @target_userID)
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- 4️⃣ 연결 상태 확인 (JOIN)
-- ========================================
SELECT '=== 4. 제출-갤러리 연결 상태 ===' as step;
SELECT
    ps.id as submission_id,
    ps.project_name,
    ps.save_type,
    ps.platform,
    ps.created_at as submitted_at,
    gp.id as gallery_id,
    gp.title as gallery_title,
    gp.is_active,
    gp.visibility,
    CASE
        WHEN gp.id IS NULL THEN '❌ 갤러리 미등록'
        WHEN gp.is_active = 0 THEN '⚠️ 비활성화됨'
        WHEN gp.visibility = 'private' THEN '🔒 비공개'
        WHEN gp.visibility = 'class' THEN '👥 클래스 공개'
        WHEN gp.visibility = 'public' THEN '🌍 전체 공개'
        ELSE '✅ 정상'
    END as status
FROM ProjectSubmissions ps
LEFT JOIN gallery_projects gp ON ps.id = gp.project_submission_id
WHERE ps.user_id = (SELECT id FROM Users WHERE userID = @target_userID)
ORDER BY ps.created_at DESC
LIMIT 10;

-- ========================================
-- 5️⃣ submitted 타입만 필터링
-- ========================================
SELECT '=== 5. submitted 타입 제출 기록 ===' as step;
SELECT
    ps.id as submission_id,
    ps.project_name,
    ps.platform,
    ps.created_at as submitted_at,
    gp.id as gallery_id,
    CASE
        WHEN gp.id IS NULL THEN '❌ 자동 등록 실패'
        ELSE '✅ 자동 등록 완료'
    END as auto_register_status
FROM ProjectSubmissions ps
LEFT JOIN gallery_projects gp ON ps.id = gp.project_submission_id
WHERE ps.user_id = (SELECT id FROM Users WHERE userID = @target_userID)
  AND ps.save_type = 'submitted'
ORDER BY ps.created_at DESC
LIMIT 10;

-- ========================================
-- 6️⃣ gallery_projects 테이블 스키마 확인
-- ========================================
SELECT '=== 6. gallery_projects 테이블 스키마 ===' as step;
SHOW CREATE TABLE gallery_projects;

-- ========================================
-- 7️⃣ is_active 컬럼 존재 여부 확인
-- ========================================
SELECT '=== 7. is_active 컬럼 확인 ===' as step;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'gallery_projects'
  AND COLUMN_NAME = 'is_active';

-- ========================================
-- 8️⃣ 통계 요약
-- ========================================
SELECT '=== 8. 통계 요약 ===' as step;
SELECT
    (SELECT COUNT(*) FROM ProjectSubmissions WHERE user_id = (SELECT id FROM Users WHERE userID = @target_userID)) as total_submissions,
    (SELECT COUNT(*) FROM ProjectSubmissions WHERE user_id = (SELECT id FROM Users WHERE userID = @target_userID) AND save_type = 'submitted') as submitted_count,
    (SELECT COUNT(*) FROM gallery_projects WHERE user_id = (SELECT id FROM Users WHERE userID = @target_userID)) as total_gallery,
    (SELECT COUNT(*) FROM gallery_projects WHERE user_id = (SELECT id FROM Users WHERE userID = @target_userID) AND is_active = 1) as active_gallery,
    (SELECT COUNT(*) FROM gallery_projects WHERE user_id = (SELECT id FROM Users WHERE userID = @target_userID) AND visibility = 'private') as private_gallery;

-- ========================================
-- 9️⃣ 최근 활동 타임라인
-- ========================================
SELECT '=== 9. 최근 활동 타임라인 ===' as step;
SELECT
    ps.created_at,
    ps.platform,
    ps.project_name,
    ps.save_type,
    CASE
        WHEN gp.id IS NOT NULL THEN '✅ 갤러리 등록됨'
        WHEN ps.save_type = 'submitted' THEN '❌ 갤러리 미등록 (자동등록 실패)'
        ELSE '- 자동등록 대상 아님'
    END as gallery_status
FROM ProjectSubmissions ps
LEFT JOIN gallery_projects gp ON ps.id = gp.project_submission_id
WHERE ps.user_id = (SELECT id FROM Users WHERE userID = @target_userID)
ORDER BY ps.created_at DESC
LIMIT 20;

-- ========================================
-- 🔧 문제 해결 SQL (필요 시 실행)
-- ========================================

-- is_active 컬럼이 없는 경우 추가
-- ALTER TABLE gallery_projects
-- ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT '활성화 상태 (1=활성, 0=삭제됨)';

-- 기존 데이터 활성화
-- UPDATE gallery_projects SET is_active = 1 WHERE is_active IS NULL OR is_active = 0;

-- 테스트: 수동으로 갤러리 등록 (자동 등록 실패 시)
-- INSERT INTO gallery_projects (
--     user_id, title, description, platform, s3_url, thumbnail_url, embed_url,
--     visibility, is_active, tags, metadata, project_submission_id, created_at, updated_at
-- )
-- SELECT
--     ps.user_id,
--     ps.project_name as title,
--     CONCAT('Entry로 만든 작품입니다.') as description,
--     ps.platform,
--     ps.s3_url,
--     ps.thumbnail_url,
--     CONCAT('/entry_editor/?s3Url=', REPLACE(ps.s3_url, '&', '%26'), '&mode=play&embed=1') as embed_url,
--     'private' as visibility,
--     1 as is_active,
--     '[]' as tags,
--     '{}' as metadata,
--     ps.id as project_submission_id,
--     NOW() as created_at,
--     NOW() as updated_at
-- FROM ProjectSubmissions ps
-- WHERE ps.user_id = (SELECT id FROM Users WHERE userID = @target_userID)
--   AND ps.save_type = 'submitted'
--   AND NOT EXISTS (
--       SELECT 1 FROM gallery_projects gp WHERE gp.project_submission_id = ps.id
--   );
