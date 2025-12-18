const { queryDatabase } = require('../lib_login/db');

class RoadmapService {

    /**
     * Assigns the default roadmap to a user if not already assigned.
     * Can be enhanced to pick roadmap based on User Archetype.
     * @param {string} userId
     */
    async assignRoadmap(userId) {
        if (!userId) return;

        try {
            // Check if user has an active roadmap
            const active = await queryDatabase(`
                SELECT * FROM User_Roadmap_Progress WHERE user_id = ?
            `, [userId]);

            if (active.length > 0) return; // Already has a roadmap

            // Assign default "Python Essentials" (ID 1 from seed)
            // In future, select ID based on User_Personality.primary_archetype
            const roadmapId = 1;

            await queryDatabase(`
                INSERT INTO User_Roadmap_Progress (user_id, roadmap_id, current_step, status, started_at)
                VALUES (?, ?, 1, 'IN_PROGRESS', NOW())
            `, [userId, roadmapId]);

            console.log(`🗺️ Assigned Roadmap ${roadmapId} to User ${userId}`);

        } catch (error) {
            console.error('Failed to assign roadmap:', error);
        }
    }

    /**
     * Gets the user's current roadmap status and next target node.
     * @param {string} userId 
     */
    async getCurrentProgress(userId) {
        if (!userId) return null;

        try {
            // Get progress
            const progress = await queryDatabase(`
                SELECT p.*, r.name as roadmap_name 
                FROM User_Roadmap_Progress p
                JOIN Roadmaps r ON p.roadmap_id = r.id
                WHERE p.user_id = ?
            `, [userId]);

            if (progress.length === 0) return null;

            const currentMap = progress[0];

            // Get current step details (CT Node)
            const stepNode = await queryDatabase(`
                SELECT n.id, n.name, n.description, rn.required_mastery
                FROM Roadmap_Nodes rn
                JOIN CT_Nodes n ON rn.ct_node_id = n.id
                WHERE rn.roadmap_id = ? AND rn.step_order = ?
            `, [currentMap.roadmap_id, currentMap.current_step]);

            return {
                roadmap: currentMap.roadmap_name,
                step: currentMap.current_step,
                target: stepNode.length > 0 ? stepNode[0] : 'COMPLETED'
            };

        } catch (error) {
            console.error('Failed to get progress:', error);
            return null;
        }
    }

    /**
     * Checks if the user has satisfied the condition to advance to the next step.
     * Called usually after a Connectome Update.
     */
    async checkAndAdvance(userId) {
        // Logic:
        // 1. Get current step target CT Node
        // 2. Check User_Connectome.activation_level for that node
        // 3. If activation > required, increment current_step
    }
}

module.exports = RoadmapService;
