const { queryDatabase } = require('../lib_login/db');

async function initCareerDB() {
    console.log('🚀 Initializing Career/Admissions Database Tables...');

    try {
        // 1. Admissions Universities
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS admissions_universities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                region VARCHAR(50),
                logo_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ admissions_universities table initialized.');

        // 2. Admissions Departments
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS admissions_departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                university_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (university_id) REFERENCES admissions_universities(id) ON DELETE CASCADE,
                INDEX (university_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ admissions_departments table initialized.');

        // 3. Admissions Results (Revised for Matrix View)
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS admissions_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                department_id INT NOT NULL,
                year INT NOT NULL,
                admission_type VARCHAR(50),
                recruitment_count INT,              -- 모집인원
                competition_rate FLOAT,             -- 경쟁률
                grade_cut_50 FLOAT,                 -- 50% 컷
                grade_cut_70 FLOAT,                 -- 70% 컷
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (department_id) REFERENCES admissions_departments(id) ON DELETE CASCADE,
                INDEX (department_id),
                INDEX (year),
                INDEX (grade_cut_70)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ admissions_results table initialized.');

        // 4. Career Resources
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS career_resources (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                type VARCHAR(50),
                file_url VARCHAR(500) NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ career_resources table initialized.');

        console.log('🎉 All Career Tables Initialized Successfully!');
        return true;

    } catch (error) {
        console.error('❌ Error initializing career database:', error);
        return false;
    }
}

// Allow running directly
if (require.main === module) {
    initCareerDB().then(() => process.exit(0));
}

module.exports = initCareerDB;
