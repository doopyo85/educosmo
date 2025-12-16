const express = require('express');
const router = express.Router();
const PythonRunner = require('../lib_execution/PythonRunner');
const PythonProblemManager = require('../lib_problem/PythonProblemManager');

const runner = new PythonRunner();
const problemManager = new PythonProblemManager();

// 1. List Problems
router.get('/', async (req, res) => {
    try {
        const problems = await problemManager.listProblems();
        res.json({ success: true, problems });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Get Problem Details
router.get('/:id', async (req, res) => {
    try {
        const problem = await problemManager.getProblem(req.params.id);
        if (!problem) {
            return res.status(404).json({ success: false, error: 'Problem not found' });
        }
        res.json({ success: true, problem });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Raw Execution (Arbitrary Code)
router.post('/run', async (req, res) => {
    try {
        const { files, entryPoint } = req.body;

        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ success: false, error: 'Files array is required' });
        }

        const result = await runner.execute(files, entryPoint || 'main.py');
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Submit Solution (Run against Test Cases)
router.post('/:id/submit', async (req, res) => {
    try {
        const problemId = req.params.id;
        const { code } = req.body; // User's main code

        const problem = await problemManager.getProblem(problemId);
        if (!problem) {
            return res.status(404).json({ success: false, error: 'Problem not found' });
        }

        const results = [];
        let allPassed = true;

        for (const tc of problem.test_cases) {
            // Create a wrapper to inject input and capture output
            // This is a simplified approach. For production, we might want to use a proper test runner.
            // Here, we just pipe the input to the script.

            // Note: PythonRunner doesn't support stdin injection yet in the 'execute' method directly via argument,
            // but we can modify the user's code to read from a file or just modify PythonRunner to support input.
            // A better way for Phase 1 basic IO:
            // We'll wrap the user code in a script that sets sys.stdin or we just use the raw runner and Python's input().
            // Wait, PythonRunner currently just runs the script. stdout capture is there.
            // BUT, `input()` in Python waits for stdin. My PythonRunner implementation does NOT pipe stdin.

            // FIX: I need to update PythonRunner to support stdin input for test cases.
            // For now, I will skip the test case execution logic validation until I fix PythonRunner or 
            // I can use a file-based input approach: 'sys.stdin = open("input.txt", "r")'

            // Strategy: Create 'input.txt' with the test case input.
            // Prepend setup code to redirect stdin.

            const inputContent = tc.input;
            const files = [
                { path: 'main.py', content: code },
                { path: 'input.txt', content: inputContent },
                {
                    path: 'runner_wrapper.py', content: `
import sys
sys.stdin = open('input.txt', 'r')
import main
` }
            ];

            // If the user code is a script (not a module with functions), importing it executes it.
            // However, if it uses 'if __name__ == "__main__":', import won't run it.
            // Better: Just run main.py and pipe input? 
            // My PythonRunner `spawn` doesn't expose stdin writing.

            // Workaround: Modify user code? No.
            // Alternative: Modify PythonRunner to accept 'stdin' content.

            // For this step, I'll return a "Not Implemented" for submission and fix Runner in next step.
            // Actually, I can use the 'input.txt' trick but run 'main.py' directly? 
            // If I run 'main.py', how do I make it read from 'input.txt'?
            // I can change entryPoint to a wrapper that sets sys.stdin then execs the user code.

            const wrapperCode = `
import sys
# Redirect stdin to input.txt
sys.stdin = open('input.txt', 'r')

# Execute user code
with open('main.py', 'r', encoding='utf-8') as f:
    exec(f.read())
`;
            const runFiles = [
                { path: 'main.py', content: code },
                { path: 'input.txt', content: inputContent },
                { path: 'wrapper.py', content: wrapperCode }
            ];

            const result = await runner.execute(runFiles, 'wrapper.py');

            const passed = result.stdout.trim() === tc.output.trim();
            if (!passed) allPassed = false;

            results.push({
                input: tc.input,
                expected: tc.output,
                actual: result.stdout.trim(),
                passed,
                error: result.stderr,
                hidden: tc.is_hidden
            });
        }

        res.json({
            success: true,
            allPassed,
            results: results.map(r => r.hidden ? { passed: r.passed, hidden: true } : r)
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
