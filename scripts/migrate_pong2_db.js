const { queryDatabase } = require('../lib_login/db');

async function migrate() {
    console.log('Starting Pong2 DB Migration...');

    try {
        // 1. Create Pong2Users table
        console.log('Checking Pong2Users table...');
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS Pong2Users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                nickname VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
        console.log('✅ Pong2Users table ready.');

        // 2. Alter board_posts table
        console.log('Checking board_posts columns...');
        const columns = await queryDatabase("SHOW COLUMNS FROM board_posts");
        const columnNames = columns.map(c => c.Field);

        // board_scope
        if (!columnNames.includes('board_scope')) {
            console.log('Adding board_scope column...');
            await queryDatabase(`
                ALTER TABLE board_posts 
                ADD COLUMN board_scope ENUM('COMMUNITY', 'PAID_ONLY') DEFAULT 'COMMUNITY' AFTER id
            `);
            console.log('✅ board_scope added.');
        } else {
            console.log('ℹ️ board_scope already exists.');
        }

        // author_type
        if (!columnNames.includes('author_type')) {
            console.log('Adding author_type column...');
            await queryDatabase(`
                ALTER TABLE board_posts 
                ADD COLUMN author_type ENUM('PAID', 'PONG2') DEFAULT 'PAID' AFTER author
            `);
            // Update existing rows to PAID (explicitly, though default handles it)
            // await queryDatabase("UPDATE board_posts SET author_type = 'PAID' WHERE author_type IS NULL");
            console.log('✅ author_type added.');
        } else {
            console.log('ℹ️ author_type already exists.');
        }

        // is_public
        if (!columnNames.includes('is_public')) {
            console.log('Adding is_public column...');
            await queryDatabase(`
                ALTER TABLE board_posts 
                ADD COLUMN is_public BOOLEAN DEFAULT 1 AFTER views
            `);
            console.log('✅ is_public added.');
        } else {
            console.log('ℹ️ is_public already exists.');
        }

        // author_id index (Composite index suggestion)
        // We probably need an index on (author_type, author_id) for performance, but skipping for now to strict scope.

        console.log('Migration completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
