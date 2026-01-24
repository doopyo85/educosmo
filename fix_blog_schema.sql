USE educodingnplay;

-- 1. Check/Add file_type column
-- (에러가 나면 이미 컬럼이 있는 것이므로 다음 줄로 넘어가세요)
ALTER TABLE blog_posts ADD COLUMN file_type ENUM('md', 'py', 'pdf', 'html', 'text') DEFAULT NULL COMMENT '원본 파일 타입' AFTER content_json;

-- 2. Check/Add published_to_platform columns
ALTER TABLE blog_posts ADD COLUMN published_to_platform BOOLEAN DEFAULT FALSE COMMENT '문제은행 등록 여부' AFTER file_type;
ALTER TABLE blog_posts ADD COLUMN platform_published_at TIMESTAMP NULL COMMENT '문제은행 등록 시각' AFTER published_to_platform;
ALTER TABLE blog_posts ADD COLUMN platform_id VARCHAR(100) NULL COMMENT '문제은행 ID' AFTER platform_published_at;

-- 3. Update blog_type ENUM
ALTER TABLE blog_posts MODIFY COLUMN blog_type ENUM('user', 'teacher', 'center') NOT NULL COMMENT '블로그 타입: user(학생), teacher(교사), center(센터)';

-- 4. Create teacher_blogs table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
