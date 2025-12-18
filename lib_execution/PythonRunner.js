const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PythonRunner {
    constructor(options = {}) {
        this.timeout = options.timeout || 3000; // Default 3s timeout
        this.pythonPath = options.pythonPath || (process.platform === 'win32' ? 'python' : 'python3');
    }

    /**
     * Executes Python code with a virtual file system.
     * @param {Array<{path: string, content: string}>} files - List of files to create
     * @param {string} entryPoint - The main file to execute (e.g., 'main.py')
     * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
     */
    async execute(files, entryPoint = 'main.py') {
        return this.executeWithInput(files, null, entryPoint);
    }

    /**
     * Executes code with optional input.
     * @param {Array<{path: string, content: string}>} files
     * @param {string|null} inputData - Input to provide context to stdin
     * @param {string} entryPoint
     */
    async executeWithInput(files, inputData, entryPoint = 'main.py') {
        const runId = Math.random().toString(36).substring(7);
        const tempDir = path.join(os.tmpdir(), `py-run-${runId}`);

        try {
            // 1. Create Isolation Directory
            fs.mkdirSync(tempDir);

            // 2. Write all files
            for (const file of files) {
                const fullPath = path.join(tempDir, file.path);
                const dirName = path.dirname(fullPath);

                // Ensure subdirectories exist
                if (!fs.existsSync(dirName)) {
                    fs.mkdirSync(dirName, { recursive: true });
                }

                fs.writeFileSync(fullPath, file.content, 'utf8');
            }

            // 3. Execute
            return await this._runProcess(tempDir, entryPoint, inputData);

        } finally {
            // 4. Cleanup
            this._cleanup(tempDir);
        }
    }

    /**
     * Runs code against multiple test cases.
     * @param {string} code - User's python code
     * @param {Array<{input: string, output: string}>} testCases
     * @returns {Promise<Array<{input: string, expected: string, actual: string, passed: boolean, error?: string}>>}
     */
    async runTestCases(code, testCases) {
        const results = [];
        for (const testCase of testCases) {
            const files = [{ path: 'main.py', content: code }];
            try {
                const result = await this.executeWithInput(files, testCase.input, 'main.py');
                
                // Normalize outputs (trim whitespace)
                const actual = result.stdout ? result.stdout.trim() : '';
                const expected = testCase.output ? testCase.output.trim() : '';
                
                // Check if passed
                // Should also check exitCode? If non-zero, it likely failed.
                const passed = (result.exitCode === 0 || result.exitCode === null) && actual === expected;

                results.push({
                    input: testCase.input,
                    expected: testCase.output,
                    actual: result.stdout || '', // Raw output including newlines
                    passed: passed,
                    error: result.stderr,
                    executionTime: result.executionTime // If we track it
                });

            } catch (err) {
                 results.push({
                    input: testCase.input,
                    expected: testCase.output,
                    actual: '',
                    passed: false,
                    error: err.message
                });
            }
        }
        return results;
    }

    _runProcess(cwd, entryPoint, inputData = null) {
        return new Promise((resolve) => {
            const childProcess = spawn(this.pythonPath, ['-u', entryPoint], {
                cwd: cwd,
                env: { ...process.env, PYTHONUNBUFFERED: '1' } // Force unbuffered output
            });

            let stdout = '';
            let stderr = '';
            let timedOut = false;

            const timer = setTimeout(() => {
                timedOut = true;
                childProcess.kill();
                stderr += '\nExecution timed out.';
            }, this.timeout);

            if (inputData) {
                childProcess.stdin.write(inputData);
                childProcess.stdin.end();
            }

            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                clearTimeout(timer);
                resolve({
                    stdout: stdout, // Return raw for precise comparison, caller can trim
                    stderr: stderr, // Return raw
                    exitCode: timedOut ? -1 : code
                });
            });

            childProcess.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    stdout,
                    stderr: stderr + '\nProcess error: ' + err.message,
                    exitCode: -1
                });
            });
        });
    }

    _cleanup(dir) {
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch (e) {
            console.error(`Failed to cleanup temp dir ${dir}:`, e);
        }
    }
}

module.exports = PythonRunner;
