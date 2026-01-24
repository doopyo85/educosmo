-- [1단계] 데이터 확인 (마이그레이션 대상 데이터 미리보기)
-- 이 쿼리를 먼저 실행해서 데이터가 제대로 조회되는지 확인하세요.
SELECT 
    user_id,
    -- 프로젝트 이름 추출 (없으면 파일명이나 기본값 사용)
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.projectName')), 
        SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.s3Url')), '/', -1),
        '이름 없는 프로젝트'
    ) as project_name,
    -- 플랫폼 정규화
    CASE 
        WHEN action_type LIKE '%entry%' THEN 'entry' 
        WHEN action_type LIKE '%scratch%' THEN 'scratch'
        WHEN action_type LIKE '%python%' THEN 'python'
        ELSE 'other' 
    END as platform,
    -- URL 추출
    JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.s3Url')) as s3_url,
    JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.thumbnailUrl')) as thumbnail_url,
    created_at
FROM UserActivityLogs 
WHERE 
    (action_type LIKE '%entry%' OR action_type LIKE '%scratch%' OR action_type LIKE '%python%')
    AND action_detail LIKE '%s3Url%' -- S3 URL이 있는 데이터만 유효
    -- 이미 ProjectSubmissions에 있는 데이터 중복 방지 (선택 사항)
    AND NOT EXISTS (
        SELECT 1 FROM ProjectSubmissions ps 
        WHERE ps.user_id = UserActivityLogs.user_id 
        AND ps.created_at = UserActivityLogs.created_at
    )
LIMIT 100;

-- [2단계] 데이터 이관 실행 (실제 데이터 복사)
-- 위 조회 결과가 정상이면 이 쿼리를 실행하세요.
INSERT INTO ProjectSubmissions (user_id, project_name, platform, s3_url, thumbnail_url, created_at, save_type)
SELECT 
    user_id,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.projectName')), 
        SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.s3Url')), '/', -1),
        '이름 없는 프로젝트'
    ) as project_name,
    CASE 
        WHEN action_type LIKE '%entry%' THEN 'entry' 
        WHEN action_type LIKE '%scratch%' THEN 'scratch'
        WHEN action_type LIKE '%python%' THEN 'python'
        ELSE 'other' 
    END as platform,
    JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.s3Url')) as s3_url,
    JSON_UNQUOTE(JSON_EXTRACT(action_detail, '$.thumbnailUrl')) as thumbnail_url,
    created_at,
    'final' as save_type -- 기본값 
FROM UserActivityLogs 
WHERE 
    (action_type LIKE '%entry%' OR action_type LIKE '%scratch%' OR action_type LIKE '%python%')
    AND action_detail LIKE '%s3Url%'
    AND NOT EXISTS (
        SELECT 1 FROM ProjectSubmissions ps 
        WHERE ps.user_id = UserActivityLogs.user_id 
        AND ps.created_at = UserActivityLogs.created_at
    );
