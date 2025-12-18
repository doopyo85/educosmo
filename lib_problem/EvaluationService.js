const { queryDatabase } = require('../lib_login/db');

class EvaluationService {

    /**
     * Evaluates the health and quality of a problem based on submission history.
     * @param {string|number} problemId 
     */
    async evaluateProblem(problemId) {
        if (!problemId) return;

        console.log(`⚖️ Auditor Engine: Evaluating Problem ${problemId}...`);

        try {
            // 1. Fetch Submissions with User Ability (Stability Score)
            // stability_score comes from ProfilingService (User_Personality)
            const submissions = await queryDatabase(`
                SELECT 
                    s.status, 
                    s.score, 
                    s.user_id,
                    COALESCE(p.stability_score, 50) as user_ability
                FROM ProblemSubmissions s
                LEFT JOIN User_Personality p ON s.user_id = p.user_id
                WHERE s.problem_id = ?
            `, [problemId]);

            // Need minimum sample size
            if (submissions.length < 5) {
                console.log('Skipping evaluation: Insufficient sample size.');
                return;
            }

            // 2. Calculate Basic Metrics (Pass Rate)
            const total = submissions.length;
            const passed = submissions.filter(s => s.status === 'PASS').length;
            const passRate = (passed / total) * 100;

            // 3. Calculate Discrimination Index (D)
            // Sort by User Ability (High to Low)
            submissions.sort((a, b) => b.user_ability - a.user_ability);

            const groupSize = Math.max(1, Math.floor(total * 0.27)); // Top/Bottom 27%
            const topGroup = submissions.slice(0, groupSize);
            const bottomGroup = submissions.slice(total - groupSize);

            // Pass Rate for Groups
            const topPass = topGroup.filter(s => s.status === 'PASS').length / groupSize;
            const bottomPass = bottomGroup.filter(s => s.status === 'PASS').length / groupSize;

            const discriminationIndex = topPass - bottomPass;
            // Range: -1.0 to 1.0. 
            // > 0.4: Excellent
            // 0.2 - 0.4: Good
            // 0 - 0.2: Poor
            // < 0: Negative (Low ability students did BETTER -> Bad Question)

            // 4. Calculate Health Score (0-100)
            // Base score 100
            // Penalize very low discrimination
            // Penalize extreme pass rates (0% or 100% are usually not ideal for training)

            let healthScore = 100;

            if (discriminationIndex < 0) healthScore -= 50; // Critical failure
            else if (discriminationIndex < 0.2) healthScore -= 20;

            if (passRate < 10) healthScore -= 10; // Too hard
            if (passRate > 90) healthScore -= 5;  // Too easy (less penalty)

            // 5. Determine Status
            let healthStatus = 'HEALTHY';
            if (healthScore < 50) healthStatus = 'QUARANTINE'; // Bad problem
            else if (passRate < 15) healthStatus = 'HARD';
            else if (passRate > 85) healthStatus = 'EASY';

            console.log(`📊 Problem ${problemId} Result: PassRate=${passRate.toFixed(1)}%, D-Index=${discriminationIndex.toFixed(2)}, Health=${healthScore} (${healthStatus})`);

            // 6. Persist to DB
            await queryDatabase(`
                INSERT INTO Problem_Analytics 
                (problem_id, pass_rate, discrimination_index, health_score, health_status, last_analyzed)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    pass_rate = ?,
                    discrimination_index = ?,
                    health_score = ?,
                    health_status = ?,
                    last_analyzed = NOW()
            `, [
                problemId, passRate, discriminationIndex, healthScore, healthStatus,
                passRate, discriminationIndex, healthScore, healthStatus
            ]);

        } catch (error) {
            console.error('❌ Evaluation Error:', error);
        }
    }
}

module.exports = EvaluationService;
