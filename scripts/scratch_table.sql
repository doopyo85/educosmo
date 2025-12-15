-- =====================================================================
-- 스크래치 프로젝트 테이블 생성 SQL
-- 
-- 실행 방법:
-- mysql -u root -p educodingnplay < scratch_table.sql
-- 또는 MySQL 클라이언트에서 직접 실행
-- =====================================================================

-- 스크래치 프로젝트 테이블
CREATE TABLE IF NOT EXISTS ScratchProjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL UNIQUE COMMENT '프로젝트 고유 ID (타임스탬프_랜덤)',
    user_id VARCHAR(255) NOT NULL COMMENT 'Users 테이블의 userID',
    center_id INT COMMENT '센터 ID',
    title VARCHAR(255) DEFAULT '제목 없음' COMMENT '프로젝트 제목',
    s3_path VARCHAR(500) NOT NULL COMMENT 'S3 파일 경로',
    thumbnail_url VARCHAR(500) COMMENT '썸네일 URL (선택)',
    is_copy TINYINT(1) DEFAULT 0 COMMENT '복사본 여부',
    is_remix TINYINT(1) DEFAULT 0 COMMENT '리믹스 여부',
    original_id VARCHAR(100) COMMENT '원본 프로젝트 ID (복사/리믹스인 경우)',
    is_public TINYINT(1) DEFAULT 0 COMMENT '공개 여부',
    view_count INT DEFAULT 0 COMMENT '조회수',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    
    INDEX idx_user_id (user_id),
    INDEX idx_center_id (center_id),
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='스크래치 프로젝트 메타데이터';

-- 확인용 쿼리
SHOW CREATE TABLE ScratchProjects;
SELECT 'ScratchProjects 테이블이 생성되었습니다.' AS message;
