const db = require('../lib_login/db');
const { getSheetData } = require('../lib_google/sheetService');

// Cache for Problem Metadata (Tags)
let problemMetaCache = null;
let lastMetaCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Loads problem metadata (tags) from Google Sheet
 * Returns a Map: problemId -> { tags: ['loop', 'sum'], difficulty: 1 }
 */
async function getProblemMetaMap() {
    const now = Date.now();
    if (problemMetaCache && (now - lastMetaCacheTime < CACHE_TTL)) {
        return problemMetaCache;
    }

    try {
        // Problems!A2:N range (based on update_excel_gamified.py)
        // Col B (1): key (problem_id)
        // Col M (12): tags (comma separated)
        // Col E (4): level (difficulty)? - need to verify, assume 1 for now if missing

        // Let's grab specific columns to be safe. 
        // Based on update_excel_p06.py: 
        // df.iloc[idx, 12] = data['tags'] -> Col M is tags.
        // df.iloc[idx, 1] = key -> Col B is key.

        const rows = await getSheetData('Problems!A2:N');
        const map = new Map();

        if (rows && rows.length) {
            rows.forEach(row => {
                const problemId = row[1] ? row[1].trim() : null;
                const tagString = row[12]; // Col M (index 12)

                if (problemId && tagString) {
                    const tags = tagString.split(',').map(t => t.trim().toLowerCase());
                    map.set(problemId, { tags, difficulty: 1 }); // Default diff 1
                }
            });
        }

        problemMetaCache = map;
        lastMetaCacheTime = now;
        console.log(`[CT Service] Problem Metadata Cached: ${map.size} items`);
        return map;
    } catch (e) {
        console.error('[CT Service] Failed to load problem metadata:', e);
        return new Map();
    }
}

/**
 * Updates user's CT scores based on a solved problem.
 * @param {number} userId 
 * @param {string} problemId (e.g., 'cospro_3-1_p06')
 */
async function updateCTFromProblem(userId, problemId) {
    try {
        const metaMap = await getProblemMetaMap();
        const problemData = metaMap.get(problemId);

        if (!problemData || !problemData.tags) {
            console.log(`[CT Service] No tags found for problem ${problemId}`);
            return;
        }

        const { tags, difficulty } = problemData;
        const scoreGain = difficulty * 10; // Base score per tag

        console.log(`[CT Service] Updating Node Scores for User ${userId}:`, tags);

        // Update each tag
        for (const tag of tags) {
            // Upsert into user_connectome
            // activation_level increases (sigmoid-like or linear accumulation)
            // For now, simpler logic: increase activation by 0.1, cap at 1.0

            const query = `
                INSERT INTO user_connectome (user_id, node_id, activation_level, last_activated_at)
                VALUES (?, ?, 0.1, NOW())
                ON DUPLICATE KEY UPDATE
                    activation_level = LEAST(activation_level + 0.1, 1.0),
                    last_activated_at = NOW()
            `;
            await db.queryDatabase(query, [userId, tag]);
        }

    } catch (error) {
        console.error(`[CT Service] Error updating CT scores for ${userId}/${problemId}:`, error);
    }
}

/**
 * Updates user's CT scores based on project complexity
 * @param {number} userId 
 * @param {object} analysisData { blocks_count, complexity_score, sprites_count }
 */
async function updateCTFromProject(userId, analysisData) {
    try {
        const score = parseFloat(analysisData.complexity_score) || 0;
        const blocks = parseInt(analysisData.blocks_count) || 0;

        if (score <= 0 && blocks <= 0) return;

        // Simple mapping: 
        // High blocks -> 'implementation'
        // High complexity -> 'structural_thinking' (custom tag)
        // For now, just boost a generic 'coding' node if it existed, 
        // but strictly we should parse the block types if available.
        // Since we only have aggregate counts currently, we will skip detailed mapping 
        // until 'blocks_json' is available.

        console.log(`[CT Service] Project analysis update skipped (pending detailed block JSON)`);

    } catch (error) {
        console.error(`[CT Service] Error updating project scores:`, error);
    }
}

module.exports = {
    updateCTFromProblem,
    updateCTFromProject
};
