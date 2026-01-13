const { queryDatabase } = require('../lib_login/db');

async function initCoreDB() {
    console.log('🚀 Initializing Core Database Tables...');

    try {
        // 1. Users Table
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS Users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userID VARCHAR(255) UNIQUE,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                phone VARCHAR(20),
                birthdate DATE,
                role ENUM('admin','kinder','school','manager','teacher','student','guest') NOT NULL,
                subscription_status ENUM('active','inactive','expired'),
                subscription_expiry DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                centerID INT,
                profile_image VARCHAR(255),
                last_board_visit TIMESTAMP,
                INDEX (centerID)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Users table initialized.');

        // 2. LearningLogs
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS LearningLogs (
                learning_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                content_type VARCHAR(50),
                content_name VARCHAR(255),
                start_time TIMESTAMP NULL,
                end_time TIMESTAMP NULL,
                duration INT,
                progress INT,
                center_id INT,
                INDEX (user_id),
                INDEX (center_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ LearningLogs table initialized.');

        // 3. LearningRecords
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS LearningRecords (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                platform ENUM('scratch','entry','online_judge') NOT NULL,
                record_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ LearningRecords table initialized.');

        // 4. UserActivityLogs
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS UserActivityLogs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                center_id INT,
                action_type VARCHAR(50) NOT NULL,
                action_detail TEXT,
                url VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (user_id),
                INDEX (center_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ UserActivityLogs table initialized.');

        // 5. MenuAccessLogs
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS MenuAccessLogs (
                access_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                menu_name VARCHAR(100),
                access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                duration INT,
                center_id INT,
                INDEX (user_id),
                INDEX (center_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ MenuAccessLogs table initialized.');

        // 6. quizResults (Matches usage in quizRouter.js)
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS QuizResults (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                exam_name VARCHAR(255) NOT NULL,
                problem_number VARCHAR(10) NOT NULL,
                user_answer TEXT,
                is_correct TINYINT(1) NOT NULL DEFAULT 0,
                timestamp DATETIME NOT NULL,
                execution_results TEXT,
                INDEX idx_quiz_user_problem (user_id, exam_name, problem_number)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ QuizResults table initialized.');

        // 7. PortfolioProjectLogs
        // Spec says user_id is varchar(50) here, keeping it inconsistent with others as per spec, 
        // but it might refer to userID (string) instead of id (int).
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS PortfolioProjectLogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(50) NOT NULL, 
                action VARCHAR(50) NOT NULL,
                ip_address VARCHAR(45),
                user_agent VARCHAR(255),
                created_at DATETIME NOT NULL,
                INDEX (project_id),
                INDEX (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ PortfolioProjectLogs table initialized.');

        // 8. ProjectSubmissions (Inferred from GALLERY_DIAGNOSTIC.sql)
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS ProjectSubmissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                project_name VARCHAR(255),
                platform VARCHAR(50),
                save_type VARCHAR(50),
                file_size_kb FLOAT,
                s3_url VARCHAR(500),
                thumbnail_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ ProjectSubmissions table initialized.');

        console.log('🎉 All Core Tables Initialized Successfully!');
        return true;

    } catch (error) {
        console.error('❌ Error initializing core database:', error);
        return false;
    }
}

// Allow running directly
if (require.main === module) {
    initCoreDB().then(() => process.exit(0));
}

module.exports = initCoreDB;
