const express = require('express');
const router = express.Router();
// Phase 1: Judge0 Integration
const PythonRunner = require('../lib_execution/PythonRunner');
// const Judge0Adapter = require('../lib_execution/Judge0Adapter');

const PythonProblemManager = require('../lib_problem/PythonProblemManager');
const db = require('../lib_login/db'); // 🔥 Add DB module

const runner = new PythonRunner();
// const runner = new Judge0Adapter(); // Judge0Adapter implements same interface for executeWithInput
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
// 4. Submit Solution (Run against Test Cases)
router.post('/:id/submit', async (req, res) => {
    try {
        const problemId = req.params.id;
        const { code } = req.body;
        const userId = req.session.user ? req.session.user.id : (req.session.dbId || null);

        if (!userId && req.session.userID) {
            // Try to resolve ID if missing
            try {
                const [u] = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [req.session.userID]);
                if (u) req.session.dbId = u.id;
            } catch (e) { }
        }

        const problem = await problemManager.getProblem(problemId);
        if (!problem) {
            return res.status(404).json({ success: false, error: 'Problem not found' });
        }

        const results = await runner.runTestCases(code, problem.test_cases);
        const allPassed = results.every(r => r.passed);

        // Map results
        const finalResults = results.map((r, index) => {
            const originalTc = problem.test_cases[index];
            const isHidden = originalTc ? originalTc.is_hidden : false;
            return isHidden ? { passed: r.passed, hidden: true } : r;
        });

        // 🔥 Log to QuizResults instead of StudentLogs
        if (req.session.userID) {
            try {
                // Resolve numeric ID
                let dbId = req.session.dbId;
                if (!dbId) {
                    const [u] = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [req.session.userID]);
                    if (u) dbId = u.id;
                }

                if (dbId) {
                    const executionJson = JSON.stringify({ results: finalResults });
                    const isCorrect = allPassed ? 1 : 0;

                    // 1. Insert into QuizResults
                    await db.queryDatabase(`
                        INSERT INTO QuizResults 
                        (user_id, exam_name, problem_number, user_answer, is_correct, execution_results, timestamp)
                        VALUES (?, 'CTRpython', ?, ?, ?, ?, NOW())
                    `, [dbId, problemId, code, isCorrect, executionJson]);

                    console.log(`✅ [QuizResults] Logged solution for User ${dbId}, Problem ${problemId}`);

                    // 2. Update CT Scores
                    if (allPassed) {
                        const { updateCTFromProblem } = require('../lib_problem/ctScoringService');
                        updateCTFromProblem(dbId, problemId).catch(e => console.error('CT Update Error:', e));
                    }
                }
            } catch (dbError) {
                console.error('Failed to log solution to DB:', dbError);
            }
        }

        res.json({
            success: true,
            allPassed,
            results: finalResults
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


module.exports = router;
