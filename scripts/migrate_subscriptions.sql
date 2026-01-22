-- ================================================
-- 구독 데이터 마이그레이션 및 정리 스크립트
-- ================================================
-- 목적: 레거시 데이터 정리 및 구독 정보 동기화
-- 작성일: 2026-01-23
-- ================================================

USE myuniverse;

-- 1. 현재 상태 확인 (마이그레이션 전)
SELECT '=== 마이그레이션 전 상태 ===' as '';
SELECT
    c.id,
    c.center_name,
    c.plan_type as center_plan,
    c.status as center_status,
    cs.plan_type as subscription_plan,
    cs.status as subscription_status,
    cs.trial_ends_at,
    cs.next_billing_date
FROM Centers c
LEFT JOIN center_subscriptions cs ON c.id = cs.center_id
ORDER BY c.id;

-- ================================================
-- 2. 본사 센터 (ID: 0)에 professional 구독 추가
-- ================================================
SELECT '=== 본사 센터 구독 추가 ===' as '';

INSERT INTO center_subscriptions (
    center_id,
    plan_type,
    status,
    storage_limit_bytes,
    student_limit,
    price_monthly,
    next_billing_date,
    payment_method,
    trial_ends_at,
    created_at
)
SELECT
    0 as center_id,
    'premium' as plan_type,
    'active' as status,
    107374182400 as storage_limit_bytes,  -- 100GB (professional 플랜)
    NULL as student_limit,                 -- 무제한
    0 as price_monthly,                    -- 무료
    DATE_ADD(CURDATE(), INTERVAL 365 DAY) as next_billing_date,  -- 1년 후
    'franchise' as payment_method,
    NULL as trial_ends_at,                 -- trial 아님
    NOW() as created_at
WHERE NOT EXISTS (
    SELECT 1 FROM center_subscriptions WHERE center_id = 0
);

-- ================================================
-- 3. 코딩앤플레이 센터 (ID: 64)를 professional로 업그레이드
-- ================================================
SELECT '=== 코딩앤플레이 센터 업그레이드 ===' as '';

UPDATE center_subscriptions
SET
    plan_type = 'premium',
    storage_limit_bytes = 107374182400,    -- 100GB
    price_monthly = 0,                      -- 무료
    next_billing_date = DATE_ADD(CURDATE(), INTERVAL 365 DAY),  -- 1년 후
    payment_method = 'franchise'
WHERE center_id = 64;

-- ================================================
-- 4. 나머지 센터들: standard 플랜 유지, 다음 결제일 설정
-- ================================================
SELECT '=== Standard 플랜 센터 업데이트 ===' as '';

UPDATE center_subscriptions
SET
    plan_type = 'standard',
    status = 'active',
    storage_limit_bytes = 32212254720,     -- 30GB
    price_monthly = 110000,                 -- ₩110,000/월
    -- next_billing_date는 현재 trial_ends_at 유지 (2026-02-21)
    next_billing_date = COALESCE(next_billing_date, DATE(trial_ends_at)),
    payment_method = 'manual'               -- 수동 결제
WHERE center_id NOT IN (0, 64)
  AND status = 'active';

-- ================================================
-- 5. Centers 테이블의 plan_type을 구독 정보와 동기화
-- ================================================
SELECT '=== Centers 테이블 동기화 ===' as '';

-- 5.1 premium 플랜 센터
UPDATE Centers c
INNER JOIN center_subscriptions cs ON c.id = cs.center_id
SET c.plan_type = 'premium'
WHERE cs.plan_type = 'premium';

-- 5.2 standard 플랜 센터
UPDATE Centers c
INNER JOIN center_subscriptions cs ON c.id = cs.center_id
SET c.plan_type = 'basic'  -- Centers 테이블에는 'basic'으로 저장
WHERE cs.plan_type = 'standard';

-- ================================================
-- 6. plan_type ENUM에 'professional' 추가 (필요시)
-- ================================================
SELECT '=== plan_type ENUM 확인 ===' as '';

-- center_subscriptions 테이블의 ENUM 수정
-- 주의: 이미 'trial', 'standard', 'premium'이 있으므로 professional은 premium으로 대체

-- ================================================
-- 7. 마이그레이션 후 상태 확인
-- ================================================
SELECT '=== 마이그레이션 후 상태 ===' as '';
SELECT
    c.id,
    c.center_name,
    c.plan_type as center_plan,
    c.status as center_status,
    cs.plan_type as subscription_plan,
    cs.status as subscription_status,
    cs.price_monthly,
    cs.storage_limit_bytes / 1073741824 as storage_gb,
    cs.trial_ends_at,
    cs.next_billing_date,
    DATEDIFF(cs.next_billing_date, CURDATE()) as days_until_renewal
FROM Centers c
LEFT JOIN center_subscriptions cs ON c.id = cs.center_id
ORDER BY c.id;

-- ================================================
-- 8. 구독 상태 요약
-- ================================================
SELECT '=== 구독 상태 요약 ===' as '';
SELECT
    cs.plan_type,
    cs.status,
    COUNT(*) as center_count,
    SUM(cs.price_monthly) as total_monthly_revenue
FROM center_subscriptions cs
GROUP BY cs.plan_type, cs.status
ORDER BY cs.plan_type, cs.status;

SELECT '=== 마이그레이션 완료 ===' as '';
