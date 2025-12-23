require('dotenv').config();
const { queryDatabase, executeNoFKCheck } = require('../lib_login/db');

async function migrate() {
    console.log('Starting Pong2 Schema Migration...');

    try {
        // 1. Create Pong2Users Table
        console.log('Creating Pong2Users table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS Pong2Users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                nickname VARCHAR(100) NOT NULL,
                linked_user_id INT NULL, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_pong2_link FOREIGN KEY (linked_user_id) REFERENCES Users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Pong2Users table created (or already exists).');

        // 2. Modify board_posts Table
        console.log('Checking board_posts columns...');
        const columns = await queryDatabase("SHOW COLUMNS FROM board_posts");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('author_type')) {
            console.log('Adding author_type column...');
            await queryDatabase(`
                ALTER TABLE board_posts
                ADD COLUMN author_type ENUM('PAID', 'PONG2') NOT NULL DEFAULT 'PAID' AFTER author
            `);
        }

        if (!columnNames.includes('author_pong2_id')) {
            console.log('Adding author_pong2_id column...');
            await queryDatabase(`
                ALTER TABLE board_posts
                ADD COLUMN author_pong2_id INT NULL AFTER author_type
            `);
        }

        if (!columnNames.includes('is_public')) {
            console.log('Adding is_public column...');
            await queryDatabase(`
                ALTER TABLE board_posts
                ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1
            `);
        }

        // 3. Add Index
        console.log('Adding index idx_posts_type_public...');
        try {
            await queryDatabase(`
                CREATE INDEX idx_posts_type_public ON board_posts (author_type, is_public)
            `);
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log('Index idx_posts_type_public already exists.');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    }
    process.exit();
}

migrate();
