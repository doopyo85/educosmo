const { queryDatabase } = require('../lib_login/db');
const PythonRunner = require('../lib_execution/PythonRunner');

class PythonProblemManager {
    constructor() {
        this.useMock = true; // Default to true since DB is unstable
        this.runner = new PythonRunner();
        this.mockProblems = [
            {
                id: 1,
                title: 'cospro_3-1',
                description: '두 숫자를 입력받아 합을 출력하는 프로그램을 작성하세요.',
                difficulty_level: 1,
                tags: ['io', 'basic'],
                starter_code: 'num1, num2 = input("숫자 두 개를 입력하세요 ").split()\nnum1 = int(num1)\nnum2 = int(num2)\nprint( @@@ )',
                test_cases: [
                    { input: '5 3', output: '8', is_hidden: false },
                    { input: '10 20', output: '30', is_hidden: true }
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

    async submitSolution(problemId, userCode) {
        const problem = await this.getProblem(problemId);
        if (!problem) {
            throw new Error('Problem not found');
        }

        if (!problem.test_cases || problem.test_cases.length === 0) {
            throw new Error('No test cases defined for this problem');
        }

        const results = await this.runner.runTestCases(userCode, problem.test_cases);

        // Calculate summary
        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        const isSuccess = totalTests === passedTests;

        // Mask hidden test cases in the response
        const clientResults = results.map((r, index) => {
            const isHidden = problem.test_cases[index].is_hidden;
            if (isHidden && !r.passed) {
                return {
                    status: 'failed',
                    message: 'Hidden test case failed',
                    passed: false
                };
            } else if (isHidden && r.passed) {
                return {
                    status: 'passed',
                    message: 'Hidden test case passed',
                    passed: true
                };
            } else {
                return {
                    input: r.input,
                    expected: r.expected,
                    actual: r.actual,
                    passed: r.passed,
                    error: r.error
                };
            }
        });

        return {
            success: isSuccess,
            total: totalTests,
            passed: passedTests,
            results: clientResults
        };
    }
}

module.exports = PythonProblemManager;
