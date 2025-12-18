const { queryDatabase } = require('../lib_login/db');
const PythonRunner = require('../lib_execution/PythonRunner');
const ConnectomeService = require('./ConnectomeService');
const EvaluationService = require('./EvaluationService');

class PythonProblemManager {
    constructor() {
        this.useMock = true; // Default to true since DB is unstable
        this.runner = new PythonRunner();
        this.connectomeService = new ConnectomeService();
        this.evaluationService = new EvaluationService();
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

    async submitSolution(problemId, userCode, userId) {
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
        const score = Math.round((passedTests / totalTests) * 100);

        // Aggregate Metrics (Average)
        const avgTime = results.reduce((sum, r) => sum + (r.time || 0), 0) / totalTests || 0;
        const avgMemory = results.reduce((sum, r) => sum + (r.memory || 0), 0) / totalTests || 0;

        // DB Logging (Grading Engine)
        if (!this.useMock && userId) {
            try {
                // Determine Status
                let status = isSuccess ? 'PASS' : 'FAIL';
                // Check for errors
                if (results.some(r => r.error)) status = 'ERROR';

                await queryDatabase(`
                    INSERT INTO ProblemSubmissions 
                    (user_id, problem_id, code, language, status, score, execution_time, memory_usage, submitted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [userId, problemId, userCode, 'python', status, score, avgTime, avgMemory]);

                console.log(`✅ Submission saved for User ${userId}, Problem ${problemId}`);

                // Trigger Score Propagation (Connectome Update)
                if (status === 'PASS') {
                    // Fire and forget (don't await to keep response fast)
                    this.connectomeService.updateUserConnectome(userId, problemId, score)
                        .catch(err => console.error('Connectome update background error:', err));
                }

                // Trigger Evaluation Engine (The Auditor) - 10% chance or every Nth time
                // This updates Pass Rate, Discrimination Index, etc.
                if (Math.random() < 0.1) {
                    this.evaluationService.evaluateProblem(problemId)
                        .catch(err => console.error('Evaluation background error:', err));
                }

            } catch (dbError) {
                console.error('❌ Failed to save submission to DB:', dbError);
                // Don't fail the request if logging fails
            }
        }

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
                    error: r.error,
                    time: r.time,
                    memory: r.memory
                };
            }
        });

        return {
            success: isSuccess,
            total: totalTests,
            passed: passedTests,
            score: score,
            results: clientResults
        };
    }
}

module.exports = PythonProblemManager;
