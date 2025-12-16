const { queryDatabase } = require('../lib_login/db');

async function initPythonDB() {
    try {
        console.log('Starting Python Question Bank Database Initialization...');

        // 1. PythonProblems Table
        console.log('Creating PythonProblems table...');
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
            )
        `);

        // 2. PythonTestCases Table
        console.log('Creating PythonTestCases table...');
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
            )
        `);

        // 3. Seed Data (Sample Problem)
        console.log('Checking for seed data...');
        const existing = await queryDatabase('SELECT * FROM PythonProblems WHERE title = ?', ['Hello Python']);

        if (existing.length === 0) {
            console.log('Inserting seed problem: Hello Python');
            const result = await queryDatabase(`
                INSERT INTO PythonProblems (title, description, difficulty_level, tags, starter_code, solution_code)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                'Hello Python',
                '사용자로부터 이름을 입력받아 인사말을 출력하세요.\n\n예시:\n입력: 철수\n출력: Hello, 철수!',
                1,
                JSON.stringify(['io', 'basic']),
                '# 코드를 작성하세요\nname = input()',
                'name = input()\nprint(f"Hello, {name}!")'
            ]);

            const problemId = result.insertId;

            console.log('Inserting test cases for problem', problemId);
            await queryDatabase(`
                INSERT INTO PythonTestCases (problem_id, input_data, expected_output, is_hidden)
                VALUES 
                (?, '철수', 'Hello, 철수!', false),
                (?, 'World', 'Hello, World!', true)
            `, [problemId, problemId]);
        } else {
            console.log('Seed data already exists.');
        }

        console.log('Database initialization completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
}

initPythonDB();
