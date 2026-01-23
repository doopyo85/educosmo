const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runSeed() {
    const seedFile = path.join(__dirname, '../migrations/seed_admissions.sql');

    if (!fs.existsSync(seedFile)) {
        console.error('❌ Seed file not found:', seedFile);
        process.exit(1);
    }

    console.log('📖 Reading seed file...');
    const sql = fs.readFileSync(seedFile, 'utf8');

    const dbConfig = {
        host: process.env.DB_HOST === 'localhost' ? '127.0.0.1' : (process.env.DB_HOST || '127.0.0.1'),
        user: process.env.DB_USER || 'root',
        password: 'fq84cod3#@', // Hardcoded
        database: process.env.DB_NAME || 'educodingnplay',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    };

    console.log('🔌 Connecting to database with:', {
        host: dbConfig.host,
        user: dbConfig.user,
        database: dbConfig.database,
        port: dbConfig.port
    });

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('🚀 Executing seed SQL...');
        const [results] = await connection.query(sql);
        console.log('✅ Seed executed successfully!');

        if (Array.isArray(results)) {
            console.log(`Executed ${results.length} statements.`);
        }
    } catch (error) {
        console.error('❌ Error executing seed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

runSeed();
