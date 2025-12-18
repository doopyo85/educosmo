const axios = require('axios');

class Judge0Adapter {
    constructor(options = {}) {
        // Judge0 API Endpoint (from env or default internal docker service)
        this.apiUrl = process.env.JUDGE0_API_URL || 'http://judge0-server:2358';
        this.timeout = options.timeout || 5000; // API wait timeout
        this.pythonLanguageId = 71; // Python 3.8.1 (Judge0 default ID)
    }

    /**
     * Executes code via Judge0
     * @param {Array<{path: string, content: string}>} files - Main file + modules
     * @param {string|null} inputData - stdin
     * @param {string} entryPoint - Ignored for simple script, usually main.py is assumed content
     * @returns {Promise<{stdout: string, stderr: string, exitCode: number, time: string, memory: number}>}
     */
    async executeWithInput(files, inputData = '', entryPoint = 'main.py') {
        try {
            // Setup Main Source Code
            // Judge0 Free plan typically accepts single 'source_code'.
            // For multiple files, we might need to merge them or use 'additional_files' (if supported by plan/version).
            // Basic Judge0 (CE) supports 'additional_files' as base64 encoded zip or individual fields?
            // Actually, for typical Python problems, we usually flatten or just send the main code.
            // If entryPoint is main.py, let's find it.

            const mainFile = files.find(f => f.path === entryPoint) || files[0];
            const sourceCode = mainFile ? mainFile.content : '';

            // Submission Data
            const submission = {
                language_id: this.pythonLanguageId,
                source_code: sourceCode,
                stdin: inputData || '',
                // cpu_time_limit: 2, // seconds
            };

            // Call Judge0 API (Create Submission)
            // wait=true enables synchronous response (blocking until done)
            const response = await axios.post(`${this.apiUrl}/submissions?base64_encoded=false&wait=true`, submission, {
                timeout: this.timeout
            });

            const result = response.data;

            // Normalize response to match existing PythonRunner interface
            // result.stdout, result.stderr, result.status.id (3 = Accepted)
            return {
                stdout: result.stdout || '',
                stderr: result.stderr || (result.compile_output || ''), // Compile error often in compile_output
                exitCode: result.status.id === 3 ? 0 : 1, // 3 is Accepted
                statusDescription: result.status.description,
                time: result.time,
                memory: result.memory
            };

        } catch (error) {
            console.error('Judge0 Execution Error:', error.message);
            // Fallback error format
            return {
                stdout: '',
                stderr: `Judge0 Error: ${error.message}\nCheck if Judge0 service is running.`,
                exitCode: -1
            };
        }
    }

    /**
     * Batch Execution for Test Cases
     * @param {string} code 
     * @param {Array<{input: string, output: string}>} testCases 
     */
    async runTestCases(code, testCases) {
        // Prepare Batch Submissions
        const submissions = testCases.map(tc => ({
            language_id: this.pythonLanguageId,
            source_code: code,
            stdin: tc.input || '',
            expected_output: tc.output // Judge0 can check expected output directly!
        }));

        try {
            const batchResponse = await axios.post(`${this.apiUrl}/submissions/batch?base64_encoded=false&wait=true`, {
                submissions: submissions
            }, { timeout: this.timeout * testCases.length }); // Increased timeout for batch

            // batchResponse.data allows access to array of results
            const results = batchResponse.data;

            return results.map((res, index) => {
                const passed = res.status.id === 3; // 3 = Accepted
                return {
                    input: testCases[index].input,
                    expected: testCases[index].output,
                    actual: res.stdout || '',
                    passed: passed,
                    error: res.stderr || res.compile_output || '',
                    executionTime: res.time
                };
            });

        } catch (error) {
            console.error('Judge0 Batch Error:', error);
            // Return all failed
            return testCases.map(tc => ({
                input: tc.input,
                expected: tc.output,
                actual: '',
                passed: false,
                error: 'Judge0 Batch Failed: ' + error.message
            }));
        }
    }
}

module.exports = Judge0Adapter;
