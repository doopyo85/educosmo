-- ================================================================================
-- ProjectSubmissions 테이블 확장 마이그레이션
-- 작성일: 2025-12-18
-- 목적: Entry 저장소 통합을 위한 스키마 확장
-- ================================================================================

-- 1. s3_key 컬럼 추가 (S3 객체 키 저장)
-- 기존: s3_url만 저장 → 삭제 시 URL 파싱 필요
-- 변경: s3_key를 직접 저장 → S3 작업 시 바로 사용 가능
ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500) AFTER s3_url;

-- 2. center_id 컬럼 추가 (센터별 관리용)
-- 기존: user_id로만 조회
-- 변경: center_id로 센터별 통계 집계 가능
ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS center_id INT AFTER user_id;

-- 3. thumbnail_url 컬럼 추가 (프로젝트 미리보기)
ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500) AFTER s3_key;

-- 4. 소프트 삭제 컬럼 추가
ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE AFTER complexity_score;

ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL AFTER is_deleted;

-- 5. save_type 컬럼 추가 (저장 유형 구분)
-- projects: 일반 프로젝트
-- autosave: 자동 저장
-- submissions: 과제 제출
ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS save_type VARCHAR(50) DEFAULT 'projects' AFTER project_name;

-- 6. updated_at 컬럼 추가 (최종 수정 시간)
ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 7. metadata 컬럼 추가 (확장 가능한 JSON 데이터)
ALTER TABLE ProjectSubmissions 
ADD COLUMN IF NOT EXISTS metadata JSON AFTER complexity_score;

-- ================================================================================
-- 인덱스 생성
-- ================================================================================

-- 사용자별 플랫폼 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_platform ON ProjectSubmissions(user_id, platform);

-- 센터별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_center_id ON ProjectSubmissions(center_id);

-- 삭제되지 않은 항목만 조회 최적화
CREATE INDEX IF NOT EXISTS idx_not_deleted ON ProjectSubmissions(is_deleted);

-- 플랫폼별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_platform ON ProjectSubmissions(platform);

-- 저장 유형별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_save_type ON ProjectSubmissions(save_type);

-- ================================================================================
-- 기존 데이터 마이그레이션 (선택적)
-- ================================================================================

-- center_id가 NULL인 기존 레코드에 대해 Users 테이블에서 centerID 가져오기
UPDATE ProjectSubmissions ps
JOIN Users u ON ps.user_id = u.id
SET ps.center_id = u.centerID
WHERE ps.center_id IS NULL;

-- is_deleted가 NULL인 레코드 기본값 설정
UPDATE ProjectSubmissions 
SET is_deleted = FALSE 
WHERE is_deleted IS NULL;

-- save_type이 NULL인 레코드 기본값 설정
UPDATE ProjectSubmissions 
SET save_type = 'projects' 
WHERE save_type IS NULL;

-- ================================================================================
-- 확인 쿼리
-- ================================================================================

-- 테이블 구조 확인
-- DESCRIBE ProjectSubmissions;

-- 컬럼 존재 여부 확인
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'ProjectSubmissions' AND TABLE_SCHEMA = DATABASE();

-- ================================================================================
-- 롤백 스크립트 (필요 시)
-- ================================================================================

-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS s3_key;
-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS center_id;
-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS thumbnail_url;
-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS is_deleted;
-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS save_type;
-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE ProjectSubmissions DROP COLUMN IF EXISTS metadata;
-- DROP INDEX IF EXISTS idx_user_platform ON ProjectSubmissions;
-- DROP INDEX IF EXISTS idx_center_id ON ProjectSubmissions;
-- DROP INDEX IF EXISTS idx_not_deleted ON ProjectSubmissions;
