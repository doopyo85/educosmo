const { queryDatabase } = require('../lib_login/db');

async function initMissingTables() {
    console.log('🚀 Initializing Missing Database Tables...');

    try {
        // 1. ProjectSubmissions
        // Inferred from usage in GALLERY_DIAGNOSTIC.sql and general project structure
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS ProjectSubmissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                project_name VARCHAR(255),
                platform VARCHAR(50), -- 'entry', 'scratch', etc.
                save_type VARCHAR(50), -- 'submitted', 'auto_save', etc.
                file_size_kb FLOAT,
                s3_url VARCHAR(500),
                thumbnail_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_platform (platform),
                INDEX idx_save_type (save_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ ProjectSubmissions table initialized.');

        // 2. CT_Nodes
        // Schemas inferred from INSERT statements in apply_schema_updates.js
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS CT_Nodes (
                id VARCHAR(50) PRIMARY KEY, -- e.g., 'loop', 'condition'
                name VARCHAR(50) NOT NULL,
                category VARCHAR(50),
                description TEXT,
                importance FLOAT DEFAULT 1.0,
                pos_x FLOAT DEFAULT 0,
                pos_y FLOAT DEFAULT 0,
                pos_z FLOAT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ CT_Nodes table initialized.');

        // 3. PythonProblems
        // From scripts/init_python_db.js
        await queryDatabase(`
             CREATE TABLE IF NOT EXISTS PythonProblems (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                difficulty_level INT DEFAULT 1,
                tags JSON,
                ct_elements JSON,
                starter_code TEXT,
                solution_code TEXT,
                config JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ PythonProblems table initialized.');

        // 4. PythonTestCases
        // From scripts/init_python_db.js
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS PythonTestCases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                problem_id INT NOT NULL,
                input_data TEXT,
                expected_output TEXT,
                is_hidden BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (problem_id) REFERENCES PythonProblems(id) ON DELETE CASCADE,
                INDEX idx_problem (problem_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ PythonTestCases table initialized.');

        // ---------------------------------------------------------
        // Seed Data for CT_Nodes (if empty)
        // ---------------------------------------------------------
        const ctNodeCount = await queryDatabase('SELECT COUNT(*) as count FROM CT_Nodes');
        if (ctNodeCount[0] && ctNodeCount[0].count === 0) {
            console.log('🌱 Seeding CT_Nodes...');
            await queryDatabase(`INSERT IGNORE INTO CT_Nodes (id, name, category, description, importance, pos_x, pos_y, pos_z) VALUES
                ('loop',       '반복문',    '제어 구조', 'for, while 등 반복을 수행하는 구조', 1.5, 0, 0, 0),
                ('condition',  '조건문',    '제어 구조', 'if, switch 등 조건에 따라 분기하는 구조', 1.5, 20, 10, 0),
                ('variable',   '변수',      '자료',     '데이터를 저장하고 사용하는 공간', 1.2, -20, 10, 0),
                ('list',       '리스트',    '자료구조',  '여러 데이터를 순서대로 저장하는 구조', 1.2, -10, -10, 10),
                ('function',   '함수',      '추상화',    '특정 동작을 수행하는 코드 묶음', 1.8, 0, 20, -10),
                ('math',       '수학연산',   '연산',     '사칙연산 및 수학적 계산', 1.0, 30, -5, 5),
                ('logic',      '논리연산',   '연산',     'AND, OR, NOT 등의 논리 판단', 1.0, 30, 5, 5),
                ('io',         '입출력',    '기타',     '사용자 입력 및 화면 출력', 1.0, -30, 0, 0),
                ('recursion',  '재귀',      '알고리즘',  '자기 자신을 호출하는 함수 패턴', 2.0, 0, 40, -20)
            `);
        }

        console.log('🎉 Missing Tables Initialized Successfully!');
        return true;

    } catch (error) {
        console.error('❌ Error initializing missing tables:', error);
        // Don't exit process if imported, just return false
        if (require.main === module) process.exit(1);
        return false;
    }
}

// Allow running directly
if (require.main === module) {
    initMissingTables().then(() => process.exit(0));
}

module.exports = initMissingTables;
