const { queryDatabase } = require('./lib_login/db');

async function repairBlogTable() {
    try {
        console.log('Checking blog_posts table columns...');

        // 1. Check if columns exist
        const columns = await queryDatabase('DESCRIBE blog_posts');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('file_type')) {
            console.log('Adding file_type column...');
            await queryDatabase(`
                ALTER TABLE blog_posts
                ADD COLUMN file_type ENUM('md', 'py', 'pdf', 'html', 'text') DEFAULT NULL
                COMMENT '원본 파일 타입' AFTER content_json
            `);
        } else {
            console.log('file_type exists.');
        }

        if (!columnNames.includes('published_to_platform')) {
            console.log('Adding published_to_platform columns...');
            await queryDatabase(`
                ALTER TABLE blog_posts
                ADD COLUMN published_to_platform BOOLEAN DEFAULT FALSE COMMENT '문제은행 등록 여부' AFTER file_type,
                ADD COLUMN platform_published_at TIMESTAMP NULL COMMENT '문제은행 등록 시각' AFTER published_to_platform,
                ADD COLUMN platform_id VARCHAR(100) NULL COMMENT '문제은행 ID' AFTER platform_published_at
            `);
        } else {
            console.log('published_to_platform exists.');
        }

        // 2. Check blog_type enum
        const typeCol = columns.find(c => c.Field === 'blog_type');
        if (typeCol && !typeCol.Type.includes("'teacher'")) {
            console.log('Updating blog_type ENUM...');
            await queryDatabase(`
                ALTER TABLE blog_posts
                MODIFY COLUMN blog_type ENUM('user', 'teacher', 'center') NOT NULL
                COMMENT '블로그 타입: user(학생), teacher(교사), center(센터)'
            `);
        } else {
            console.log('blog_type ENUM is correct.');
        }

        console.log('Checking teacher_blogs table...');
        try {
            await queryDatabase('SELECT 1 FROM teacher_blogs LIMIT 1');
            console.log('teacher_blogs table exists.');
        } catch (e) {
            console.log('Creating teacher_blogs table...');
            await queryDatabase(`
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
            `);
        }

        console.log('DB Repair Completed Successfully.');
        process.exit(0);
    } catch (error) {
        console.error('DB Repair Failed:', error);
        process.exit(1);
    }
}

repairBlogTable();
