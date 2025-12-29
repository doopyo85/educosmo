const { queryDatabase } = require('./db');

async function initSchema() {
    console.log('🔍 Checking DB Schema for Observatory...');

    try {
        // 1. CT_Nodes (Check if exists, if not, create via script logic or assume done)
        // Since CT_Nodes was likely created manually or via previous script, we focus on missing ones.

        // 2. CT_Edges
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS CT_Edges (
                id INT AUTO_INCREMENT PRIMARY KEY,
                source_node_id VARCHAR(50) NOT NULL,
                target_node_id VARCHAR(50) NOT NULL,
                relationship_type VARCHAR(50) DEFAULT 'related',
                strength FLOAT DEFAULT 1.0,
                CONSTRAINT uk_edge UNIQUE (source_node_id, target_node_id)
            )
        `);

        // Check if data exists
        const edgeCount = await queryDatabase('SELECT COUNT(*) as count FROM CT_Edges');
        if (edgeCount[0].count === 0) {
            console.log('🌱 Seeding CT_Edges...');
            await queryDatabase(`
                INSERT INTO CT_Edges (source_node_id, target_node_id, strength) VALUES
                ('loop', 'condition', 0.8),
                ('loop', 'list', 0.7),
                ('variable', 'math', 0.9),
                ('condition', 'logic', 0.9),
                ('function', 'recursion', 1.0),
                ('io', 'variable', 0.5)
            `);
        } else {
            // console.log('✅ CT_Edges already seeded.');
        }

        // 3. User_Personality
        await queryDatabase(`
            CREATE TABLE IF NOT EXISTS User_Personality (
                user_id VARCHAR(50) PRIMARY KEY,
                primary_archetype VARCHAR(50) DEFAULT 'EXPLORER',
                traits JSON,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Observatory Schema Verified.');

    } catch (error) {
        console.error('❌ Schema Initialization Failed:', error);
    }
}

module.exports = initSchema;
