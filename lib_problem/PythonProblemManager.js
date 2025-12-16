const { queryDatabase } = require('../lib_login/db');

class PythonProblemManager {
    constructor() {
        this.useMock = false; // Set to true if DB is unavailable
        this.mockProblems = [
            {
                id: 1,
                title: 'Hello Python (Mock)',
                description: '사용자로부터 입력을 받아 인사말을 출력하세요.',
                difficulty_level: 1,
                tags: ['io', 'basic'],
                starter_code: 'name = input()',
                test_cases: [
                    { input: 'Alice', output: 'Hello, Alice!', is_hidden: false },
                    { input: 'Bob', output: 'Hello, Bob!', is_hidden: true }
                ]
            }
        ];
    }

    async getProblem(id) {
        if (this.useMock) {
            return this.mockProblems.find(p => p.id === parseInt(id));
        }

        try {
            const problems = await queryDatabase('SELECT * FROM PythonProblems WHERE id = ?', [id]);
            if (problems.length === 0) return null;

            const problem = problems[0];
            // Fetch test cases
            const testCases = await queryDatabase('SELECT * FROM PythonTestCases WHERE problem_id = ?', [id]);

            problem.test_cases = testCases.map(tc => ({
                input: tc.input_data,
                output: tc.expected_output,
                is_hidden: tc.is_hidden
            }));

            return problem;
        } catch (error) {
            console.error('DB Error, falling back to mock:', error);
            // Fallback for development if DB fails
            return this.mockProblems.find(p => p.id === parseInt(id));
        }
    }

    async listProblems() {
        if (this.useMock) return this.mockProblems;

        try {
            return await queryDatabase('SELECT id, title, difficulty_level, tags FROM PythonProblems');
        } catch (error) {
            console.error('DB Error, falling back to mock:', error);
            return this.mockProblems;
        }
    }

    async createProblem(data) {
        if (this.useMock) {
            const newProblem = { id: this.mockProblems.length + 1, ...data };
            this.mockProblems.push(newProblem);
            return newProblem.id;
        }

        try {
            const result = await queryDatabase(`
                INSERT INTO PythonProblems (title, description, difficulty_level, tags, starter_code)
                VALUES (?, ?, ?, ?, ?)
            `, [data.title, data.description, data.difficulty_level, JSON.stringify(data.tags), data.starter_code]);

            const problemId = result.insertId;

            if (data.test_cases && data.test_cases.length > 0) {
                for (const tc of data.test_cases) {
                    await queryDatabase(`
                        INSERT INTO PythonTestCases (problem_id, input_data, expected_output, is_hidden)
                        VALUES (?, ?, ?, ?)
                    `, [problemId, tc.input, tc.output, tc.is_hidden]);
                }
            }

            return problemId;
        } catch (error) {
            console.error('DB Create Error:', error);
            throw error;
        }
    }
}

module.exports = PythonProblemManager;
