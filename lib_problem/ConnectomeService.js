const { queryDatabase } = require('../lib_login/db');

class ConnectomeService {

    /**
     * Updates the user's CT Connectome based on a solved problem.
     * @param {string} userId - The ID of the student.
     * @param {string} problemId - The ID of the problem.
     * @param {number} score - The score obtained (0-100).
     */
    async updateUserConnectome(userId, problemId, score) {
        if (!userId || !problemId || score <= 0) return;

        console.log(`🧠 Updating Connectome for User ${userId}, Problem ${problemId}, Score ${score}`);

        try {
            // 1. Find related CT Nodes (Stars)
            const mappings = await queryDatabase(`
                SELECT ct_node_id, contribution_weight 
                FROM Problem_Map 
                WHERE problem_id = ?
            `, [problemId]);

            if (mappings.length === 0) {
                console.log('⚠️ No CT mappings found for this problem.');
                return;
            }

            // 2. Brighten each star
            for (const map of mappings) {
                const activationGain = (score / 100) * map.contribution_weight * 0.1; // 0.1 is a learning rate factor

                await queryDatabase(`
                    INSERT INTO User_Connectome (user_id, ct_node_id, activation_level, total_exp, last_activated_at)
                    VALUES (?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE 
                        activation_level = LEAST(activation_level + ?, 1.0), -- Max 1.0
                        total_exp = total_exp + ?,
                        last_activated_at = NOW()
                `, [
                    userId,
                    map.ct_node_id,
                    activationGain,
                    score,
                    // Update values
                    activationGain,
                    score
                ]);
            }

            console.log(`✨ Connectome updated: ${mappings.length} nodes activated.`);

        } catch (error) {
            console.error('❌ Connectome Update Failed:', error);
        }
    }

    /**
     * (Optional) Decay logic to simulate forgetting curve
     */
    async applyTimeDecay(userId) {
        // To be implemented: Reduce activation_level based on time since last_activated_at
    }
}

module.exports = ConnectomeService;
