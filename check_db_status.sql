-- 1. Users 테이블 구조 확인 (username 컬럼 존재 여부 확인)
DESCRIBE Users;

-- 2. ProjectSubmissions 테이블 구조 확인
DESCRIBE ProjectSubmissions;

-- 3. '민호' 또는 특정 사용자 찾기 (이름이나 ID로 확인)
SELECT id, userID, name, role, centerID FROM Users WHERE name LIKE '%민호%' LIMIT 5;

-- 4. 위에서 찾은 사용자의 ID를 이용해 프로젝트 제출 내역 확인 (예: 사용자 ID가 1인 경우)
-- *사용자 ID를 실제 ID로 바꿔서 실행하세요*
SELECT * FROM ProjectSubmissions WHERE user_id = 1 ORDER BY created_at DESC LIMIT 5;

-- 5. 전체 프로젝트 제출 수 확인 (테이블이 비어있는지 확인)
SELECT COUNT(*) FROM ProjectSubmissions;
