const express = require('express');
const router = express.Router();
// Phase 1: Judge0 Integration
// const PythonRunner = require('../lib_execution/PythonRunner');
const Judge0Adapter = require('../lib_execution/Judge0Adapter');
const PythonProblemManager = require('../lib_problem/PythonProblemManager');

// const runner = new PythonRunner();
const runner = new Judge0Adapter(); // Judge0Adapter implements same interface for executeWithInput
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

        // Judge0 Adapter uses executeWithInput(files, input, entryPoint)
        // For general run, input isn't provided here yet (or generic stdin)
        const result = await runner.executeWithInput(files, null, entryPoint || 'main.py');
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

        // Reference: Phase 1 Judge0 Batch Execution
        // Judge0Adapter.runTestCases handles the batching logic internally.
        const results = await runner.runTestCases(code, problem.test_cases);

        const allPassed = results.every(r => r.passed);

        // Map results back to handle hidden test cases if necessary
        // Judge0Adapter returns results in same order as input
        const finalResults = results.map((r, index) => {
            const originalTc = problem.test_cases[index];
            const isHidden = originalTc ? originalTc.is_hidden : false;
            return isHidden ? { passed: r.passed, hidden: true } : r;
        });

        res.json({
            success: true,
            allPassed,
            results: finalResults
        });

        // Remove old loop logic to avoid duplication
        return;
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


module.exports = router;
