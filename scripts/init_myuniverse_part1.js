const { queryDatabase } = require('../lib_login/db');

async function initMyUniversePart1() {
    console.log('🚀 Initializing MyUniverse Database Tables (Part 1)...');

    try {
        // 1. Update Users Table (Add Account Type & Limits)
        console.log('🔄 updating Users table...');
        try {
            await queryDatabase(`
                ALTER TABLE Users 
                ADD COLUMN IF NOT EXISTS account_type ENUM('pong2', 'center_student', 'center_admin') DEFAULT 'pong2',
                ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT DEFAULT 524288000 COMMENT '500MB for free user',
                ADD COLUMN IF NOT EXISTS blog_post_limit INT DEFAULT 10 COMMENT 'Monthly post limit for free user';
            `);
            console.log('✅ Users table updated.');
        } catch (e) {
            console.log('⚠️ Users table update skipped or failed (might already exist):', e.message);
        }

        // 2. Center Subscriptions
        console.log('Creating center_subscriptions table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS center_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                center_id INT NOT NULL,
                plan_type ENUM('standard', 'premium') DEFAULT 'standard',
                storage_limit_bytes BIGINT DEFAULT 32212254720 COMMENT '30GB',
                student_limit INT DEFAULT NULL COMMENT 'NULL = unlimited',
                price_monthly INT DEFAULT 110000,
                next_billing_date DATE,
                payment_method VARCHAR(50),
                status ENUM('trial', 'active', 'suspended', 'cancelled') DEFAULT 'trial',
                trial_ends_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (center_id) REFERENCES Centers(id),
                INDEX idx_center_status (center_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ center_subscriptions table initialized.');

        // 3. Center Memberships
        console.log('Creating center_memberships table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS center_memberships (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                center_id INT NOT NULL,
                role ENUM('student', 'instructor', 'admin') DEFAULT 'student',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                left_at DATETIME,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES Users(id),
                FOREIGN KEY (center_id) REFERENCES Centers(id),
                UNIQUE KEY unique_active_membership (user_id, center_id, is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ center_memberships table initialized.');

        // 4. Center Invite Codes
        console.log('Creating center_invite_codes table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS center_invite_codes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                center_id INT NOT NULL,
                code VARCHAR(8) UNIQUE NOT NULL,
                max_uses INT DEFAULT NULL,
                used_count INT DEFAULT 0,
                expires_at DATETIME,
                created_by INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (center_id) REFERENCES Centers(id),
                FOREIGN KEY (created_by) REFERENCES Users(id),
                INDEX idx_code (code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ center_invite_codes table initialized.');

        // 5. User Blogs (Student/Personal)
        console.log('Creating user_blogs table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS user_blogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                subdomain VARCHAR(50) UNIQUE NOT NULL,
                title VARCHAR(200) DEFAULT '나의 우주',
                description TEXT,
                theme VARCHAR(50) DEFAULT 'galaxy',
                custom_css TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users(id),
                INDEX idx_subdomain (subdomain),
                INDEX idx_user_active (user_id, is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ user_blogs table initialized.');

        // 6. Center Blogs (Cloud Board)
        console.log('Creating center_blogs table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS center_blogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                center_id INT NOT NULL,
                subdomain VARCHAR(50) UNIQUE NOT NULL,
                display_name VARCHAR(100),
                description TEXT,
                logo_url VARCHAR(500),
                theme VARCHAR(50) DEFAULT 'cloud',
                custom_css TEXT,
                show_student_gallery BOOLEAN DEFAULT TRUE,
                is_public BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (center_id) REFERENCES Centers(id),
                INDEX idx_subdomain (subdomain)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ center_blogs table initialized.');

        // 7. Blog Posts
        console.log('Creating blog_posts table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS blog_posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                blog_id INT NOT NULL,
                blog_type ENUM('user', 'center') NOT NULL,
                title VARCHAR(200) NOT NULL,
                slug VARCHAR(200) NOT NULL,
                content_json JSON,
                excerpt TEXT,
                thumbnail_url VARCHAR(500),
                is_published BOOLEAN DEFAULT FALSE,
                published_at DATETIME,
                view_count INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_blog_published (blog_id, blog_type, is_published),
                INDEX idx_slug (slug),
                UNIQUE KEY unique_blog_slug (blog_id, blog_type, slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ blog_posts table initialized.');

        // 8. Center Board Cards (Padlet Style)
        console.log('Creating center_board_cards table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS center_board_cards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                center_id INT NOT NULL,
                section VARCHAR(50) DEFAULT 'general',
                title VARCHAR(200) NOT NULL,
                content TEXT,
                file_url VARCHAR(500),
                file_size BIGINT,
                author_id INT NOT NULL,
                layout_x INT DEFAULT 0,
                layout_y INT DEFAULT 0,
                pinned BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (center_id) REFERENCES Centers(id),
                FOREIGN KEY (author_id) REFERENCES Users(id),
                INDEX idx_center_section (center_id, section),
                INDEX idx_pinned (pinned, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ center_board_cards table initialized.');

        // 9. Blog Post Files (Media)
        console.log('Creating blog_post_files table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS blog_post_files (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                s3_key VARCHAR(500) NOT NULL COMMENT 'NCP S3 Key',
                s3_url VARCHAR(500) NOT NULL COMMENT 'CDN URL',
                original_name VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                file_type VARCHAR(100) NOT NULL,
                file_category ENUM('image', 'audio', 'video', 'document', 'file') NOT NULL,
                width INT,
                height INT,
                duration INT,
                is_temp BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_post_files (post_id, file_category),
                INDEX idx_user_temp (user_id, is_temp),
                FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ blog_post_files table initialized.');

        // 10. Board Temp Files (For generic uploads)
        console.log('Creating board_temp_files table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS board_temp_files (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                temp_key VARCHAR(500) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                file_type VARCHAR(100) NOT NULL,
                file_category ENUM('image', 'audio', 'video', 'document', 'file') NOT NULL,
                s3_url VARCHAR(500) NOT NULL,
                is_permanent BOOLEAN DEFAULT FALSE,
                post_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP GENERATED ALWAYS AS (created_at + INTERVAL 24 HOUR) STORED,
                INDEX idx_user_temp (user_id, is_permanent),
                INDEX idx_expires (expires_at),
                FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ board_temp_files table initialized.');

        // 11. User Storage Usage Update
        console.log('🔄 updating UserStorageUsage table...');
        try {
            await queryDatabase(`
                ALTER TABLE UserStorageUsage 
                ADD COLUMN IF NOT EXISTS blog_usage BIGINT DEFAULT 0 AFTER gallery_usage,
                ADD COLUMN IF NOT EXISTS blog_limit BIGINT DEFAULT 104857600 COMMENT '100MB for free user';
            `);
            console.log('✅ UserStorageUsage table updated.');
        } catch (e) {
            console.log('⚠️ UserStorageUsage table update skipped or failed:', e.message);
        }

        console.log('🎉 MyUniverse DB Part 1 Initialization Complete!');
        return true;

    } catch (error) {
        console.error('❌ Error initializing MyUniverse database:', error);
        return false;
    }
}

if (require.main === module) {
    initMyUniversePart1().then(() => process.exit(0));
}

module.exports = initMyUniversePart1;
