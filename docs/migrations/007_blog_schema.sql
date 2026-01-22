-- 007_blog_schema.sql
-- Blog Feature & Center Cloud Board (Padlet Style) Schema
-- Created: 2026-01-21

-- 1. User Blogs (StarDiary)
CREATE TABLE IF NOT EXISTS user_blogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subdomain VARCHAR(50) UNIQUE NOT NULL COMMENT 'userid.pong2.app subdomain',
    title VARCHAR(100) NOT NULL DEFAULT '나의 별일기',
    description VARCHAR(255),
    theme_config JSON COMMENT 'Theme settings (color, layout)',
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    INDEX idx_subdomain (subdomain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Center Blogs (CloudBoard)
CREATE TABLE IF NOT EXISTS center_blogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    center_id INT NOT NULL,
    subdomain VARCHAR(50) UNIQUE COMMENT 'centerid.pong2.app (optional)',
    title VARCHAR(100) NOT NULL DEFAULT '우리 반 클라우드',
    description VARCHAR(255),
    theme_config JSON COMMENT 'Padlet style settings',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (center_id) REFERENCES Centers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Blog Posts (Unified for User & Center)
CREATE TABLE IF NOT EXISTS blog_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blog_type ENUM('user', 'center') NOT NULL,
    blog_id INT NOT NULL COMMENT 'Refers to user_blogs.id or center_blogs.id',
    author_id INT NOT NULL,
    
    title VARCHAR(255),
    content LONGTEXT COMMENT 'HTML content for viewer',
    content_json JSON COMMENT 'Block-based content (Notion/Padlet style)',
    
    post_type ENUM('post', 'card', 'notice', 'homework') DEFAULT 'post',
    layout_meta JSON COMMENT 'Position info for Padlet layout (x, y, w, h)',
    
    tags JSON,
    is_published BOOLEAN DEFAULT TRUE,
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_blog_listing (blog_type, blog_id, is_published, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Blog Post Files (Attachments)
CREATE TABLE IF NOT EXISTS blog_post_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    uploader_id INT NOT NULL,
    
    file_name VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500) NOT NULL COMMENT 'NCP Object Storage Key',
    file_size BIGINT NOT NULL COMMENT 'Bytes',
    file_type VARCHAR(100),
    
    is_temp BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Center Storage Statistics (Real-time Quota)
CREATE TABLE IF NOT EXISTS center_storage_stats (
    center_id INT PRIMARY KEY,
    total_used_bytes BIGINT DEFAULT 0,
    file_count INT DEFAULT 0,
    quota_limit_bytes BIGINT DEFAULT 32212254720 COMMENT '30GB Default',
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (center_id) REFERENCES Centers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trigger or logic to update stats will be handled by Application Layer (QuotaService)
