const db = require('../lib_login/db');

async function initGalleryDB() {
    try {
        console.log('🚀 Initializing Gallery Database Tables...');

        // 1. Gallery Projects Table
        await db.queryDatabase(`
            CREATE TABLE IF NOT EXISTS gallery_projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                submission_id INT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NULL,
                platform VARCHAR(50) NOT NULL, -- entry, scratch, python, etc.
                s3_url VARCHAR(500) NOT NULL,
                s3_key VARCHAR(500) NULL,
                thumbnail_url VARCHAR(500) NULL,
                embed_url VARCHAR(500) NULL,
                visibility ENUM('public', 'class', 'private') DEFAULT 'class',
                view_count INT DEFAULT 0,
                like_count INT DEFAULT 0,
                play_count INT DEFAULT 0,
                is_featured BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                tags JSON NULL,
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_platform (platform),
                INDEX idx_visibility (visibility),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ gallery_projects table created or already exists.');

        // 2. Gallery Likes Table
        await db.queryDatabase(`
            CREATE TABLE IF NOT EXISTS gallery_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                gallery_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (gallery_id, user_id),
                FOREIGN KEY (gallery_id) REFERENCES gallery_projects(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ gallery_likes table created or already exists.');

        // 3. Gallery Views Table (for analytics and view count throttling)
        await db.queryDatabase(`
            CREATE TABLE IF NOT EXISTS gallery_views (
                id INT AUTO_INCREMENT PRIMARY KEY,
                gallery_id INT NOT NULL,
                user_id INT NULL, -- NULL for guests
                ip_address VARCHAR(45) NULL,
                session_id VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_gallery_session (gallery_id, session_id),
                FOREIGN KEY (gallery_id) REFERENCES gallery_projects(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ gallery_views table created or already exists.');

        console.log('🎉 All gallery tables initialized successfully!');
        return true;

    } catch (error) {
        console.error('❌ Error initializing database:', error);
        return false;
    }
}

module.exports = initGalleryDB;
