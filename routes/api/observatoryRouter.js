const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const PythonProblemManager = require('../../lib_problem/PythonProblemManager');

// Initialize Manager
const problemManager = new PythonProblemManager();

/**
 * GET /api/connectome-data
 * Returns Nodes (Problems) and Edges (Connections) with Activation Status
 */
router.get('/connectome-data', async (req, res) => {
    try {
        const userID = req.session.userID;
        let solvedProblemIds = new Set();

        // 1. Fetch User Progress (if logged in)
        if (userID) {
            try {
                // Get numeric ID first
                const [user] = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [userID]);
                if (user) {
                    const logs = await db.queryDatabase(`
                        SELECT description FROM StudentLogs 
                        WHERE student_id = ? AND log_type = 'PROBLEM_SOLVED'
                    `, [user.id]);

                    // Parse "Solved Problem {id}" to extract ID
                    logs.forEach(log => {
                        const match = log.description.match(/Solved Problem (.+)/);
                        if (match && match[1]) {
                            solvedProblemIds.add(match[1]);
                        }
                    });
                }
            } catch (err) {
                console.error('Error fetching user progress:', err);
            }
        }

        // 2. Fetch All Problems (Nodes)
        const problems = await problemManager.listProblems();

        // 3. Construct Graph Data
        const nodes = [];
        const edges = [];
        const POSITION_SCALE = 100;

        // Sort problems to create sequential edges
        // Assuming IDs are sortable or they come in order. 
        // If not, we might need to parse filenames like "3-1_p01".
        const sortedProblems = problems.sort((a, b) => a.id.localeCompare(b.id));

        sortedProblems.forEach((p, index) => {
            // Determine Activation
            const isSolved = solvedProblemIds.has(p.id);
            const activation = isSolved ? 1.0 : 0.1;

            // Deterministic Random Position (based on string hash)
            // Or use a spiral layout for now
            const angle = index * 0.5;
            const radius = 10 + (index * 2);
            const x = Math.cos(angle) * radius * 3;
            const y = Math.sin(angle) * radius * 3;
            const z = (Math.random() - 0.5) * 50;

            nodes.push({
                id: p.id,
                name: p.title || p.id,
                activation: activation,
                position_x: x,
                position_y: y,
                position_z: z,
                // Extra metadata
                category: p.category,
                difficulty: p.difficulty
            });

            // Create Edge to previous problem (Sequence)
            if (index > 0) {
                const prev = sortedProblems[index - 1];
                edges.push({
                    from: prev.id,
                    to: p.id,
                    weight: 1
                });
            }
        });

        res.json({
            success: true,
            nodes,
            edges
        });

    } catch (error) {
        console.error('Observatory Data Error:', error);
        res.status(500).json({ success: false, error: 'Failed to load observatory data' });
    }
});

module.exports = router;
