const { queryDatabase } = require('../lib_login/db');

class ProfilingService {

    /**
     * Analyzes and updates the user's personality profile.
     * @param {string} userId 
     */
    async analyzeUserPersona(userId) {
        if (!userId) return;

        console.log(`🕵️ Analyzing Persona for User ${userId}...`);

        try {
            // 1. Fetch recent activity stats
            // Get submissions count, success rate, average retries, efficiency
            const stats = await queryDatabase(`
                SELECT 
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as passed_count,
                    AVG(score) as avg_score,
                    AVG(execution_time) as avg_time,
                    COUNT(DISTINCT problem_id) as solved_unique
                FROM ProblemSubmissions
                WHERE user_id = ?
            `, [userId]);

            if (!stats || stats.length === 0 || stats[0].total_attempts === 0) {
                return; // Not enough data
            }

            const { total_attempts, passed_count, avg_time } = stats[0];
            const passRate = passed_count / total_attempts;

            // 2. Fetch specific metrics for Traits

            // [Persistence]: Ratio of (Total Attempts / Solved Unique Problems). Higher means they try more per problem.
            // Simplified logic: Just normalized attempt count for now
            const persistenceScore = Math.min(100, Math.round((total_attempts / (stats[0].solved_unique || 1)) * 20));

            // [Efficiency]: Inverse of execution time (normalized against some constant, e.g. 50ms)
            // If avg_time is low, efficiency is high.
            const efficiencyScore = Math.min(100, Math.max(0, 100 - (avg_time * 2)));

            // [Stability]: Pass rate. High pass rate means they write correct code on first few tries.
            const stabilityScore = Math.round(passRate * 100);

            // [Logic]: Based on difficulty level of solved problems (Mock query for now)
            // In future, join with Problem_Map or Problem difficulty
            const logicScore = 50; // Default baseline

            // 3. Determine Archetype
            let primaryArchetype = 'EXPLORER'; // Default
            let maxScore = -1;

            // Simple heuristic to pick archetype
            // ARCHITECT: High Stability
            if (stabilityScore > 80 && stabilityScore > maxScore) {
                primaryArchetype = 'ARCHITECT';
                maxScore = stabilityScore;
            }
            // HACKER: High Efficiency
            if (efficiencyScore > 80 && efficiencyScore > maxScore) {
                primaryArchetype = 'HACKER';
                maxScore = efficiencyScore;
            }
            // EXPLORER: High Persistence
            if (persistenceScore > 80 && persistenceScore > maxScore) {
                primaryArchetype = 'EXPLORER';
                maxScore = persistenceScore;
            }
            // ARTIST: (Reserved for Project-heavy users)

            console.log(`🧩 User ${userId} Profile: [Stable:${stabilityScore}, Efficient:${efficiencyScore}, Persist:${persistenceScore}] -> ${primaryArchetype}`);

            // 4. Update Database
            await queryDatabase(`
                INSERT INTO User_Personality 
                (user_id, primary_archetype, logic_score, efficiency_score, persistence_score, stability_score, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    primary_archetype = ?,
                    logic_score = ?,
                    efficiency_score = ?,
                    persistence_score = ?,
                    stability_score = ?,
                    last_updated = NOW()
            `, [
                userId, primaryArchetype, logicScore, efficiencyScore, persistenceScore, stabilityScore,
                primaryArchetype, logicScore, efficiencyScore, persistenceScore, stabilityScore
            ]);

        } catch (error) {
            console.error('❌ Profiling Analysis Failed:', error);
        }
    }
}

module.exports = ProfilingService;
