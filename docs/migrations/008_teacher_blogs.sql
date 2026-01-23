-- ===================================================================
-- Migration 008: Teacher Blogs (EduPlan)
-- 교사 블로그 및 교안 관리 시스템
-- ===================================================================

-- 1. teacher_blogs 테이블 생성
CREATE TABLE IF NOT EXISTS teacher_blogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '교사 Users.id',
    subdomain VARCHAR(50) UNIQUE COMMENT '서브도메인 (teacher-{username})',
    title VARCHAR(100) DEFAULT '나의 교안 저장소',
    description VARCHAR(255),
    is_public BOOLEAN DEFAULT FALSE COMMENT '공개 여부',
    theme_config JSON COMMENT '테마 설정',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_subdomain (subdomain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='교사 블로그 메타데이터';

-- 2. blog_posts 테이블 확장
-- blog_type ENUM 확장
ALTER TABLE blog_posts
MODIFY COLUMN blog_type ENUM('user', 'teacher', 'center') NOT NULL
COMMENT '블로그 타입: user(학생), teacher(교사), center(센터)';

-- 파일 타입 컬럼 추가
ALTER TABLE blog_posts
ADD COLUMN IF NOT EXISTS file_type ENUM('md', 'py', 'pdf', 'html', 'text') DEFAULT NULL
COMMENT '원본 파일 타입' AFTER content_json;

-- 문제은행 퍼블리싱 관련 컬럼 추가
ALTER TABLE blog_posts
ADD COLUMN IF NOT EXISTS published_to_platform BOOLEAN DEFAULT FALSE
COMMENT '문제은행 등록 여부' AFTER file_type;

ALTER TABLE blog_posts
ADD COLUMN IF NOT EXISTS platform_published_at TIMESTAMP NULL
COMMENT '문제은행 등록 시각' AFTER published_to_platform;

ALTER TABLE blog_posts
ADD COLUMN IF NOT EXISTS platform_id VARCHAR(100) NULL
COMMENT '문제은행 ID (Google Sheets row ID 등)' AFTER platform_published_at;

-- 3. 인덱스 추가 (성능 최적화)
ALTER TABLE blog_posts
ADD INDEX IF NOT EXISTS idx_file_type (file_type);

ALTER TABLE blog_posts
ADD INDEX IF NOT EXISTS idx_published (published_to_platform);

-- 4. 교사 권한 확인용 뷰 (선택사항)
CREATE OR REPLACE VIEW teacher_blog_summary AS
SELECT
    tb.id as blog_id,
    tb.user_id,
    tb.subdomain,
    tb.title,
    u.name as teacher_name,
    u.username,
    u.email,
    COUNT(DISTINCT bp.id) as total_posts,
    COUNT(DISTINCT CASE WHEN bp.published_to_platform = TRUE THEN bp.id END) as published_posts,
    COUNT(DISTINCT CASE WHEN bp.file_type = 'py' THEN bp.id END) as python_files,
    COUNT(DISTINCT CASE WHEN bp.file_type = 'md' THEN bp.id END) as markdown_files,
    tb.created_at
FROM teacher_blogs tb
JOIN Users u ON tb.user_id = u.id
LEFT JOIN blog_posts bp ON bp.blog_id = tb.id AND bp.blog_type = 'teacher'
GROUP BY tb.id, tb.user_id, tb.subdomain, tb.title, u.name, u.username, u.email, tb.created_at;

-- 5. 샘플 데이터 (개발용, 프로덕션에서는 제거)
-- INSERT INTO teacher_blogs (user_id, subdomain, title, description, is_public)
-- SELECT id, CONCAT('teacher-', username), CONCAT(name, '의 교안 저장소'), '코딩 교육 자료 모음', FALSE
-- FROM Users
-- WHERE role IN ('teacher', 'admin')
-- LIMIT 5;

-- ===================================================================
-- 마이그레이션 완료
-- ===================================================================
