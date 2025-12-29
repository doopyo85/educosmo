require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { queryDatabase } = require('./lib_login/db');

async function runUpdates() {
    console.log('🚀 Starting Schema Updates...');

    const queries = [
        // 1. CT Nodes (Already existed, using INSERT IGNORE)
        `INSERT IGNORE INTO CT_Nodes (id, name, category, description, importance, pos_x, pos_y, pos_z) VALUES
        ('loop',       '반복문',    '제어 구조', 'for, while 등 반복을 수행하는 구조', 1.5, 0, 0, 0),
        ('condition',  '조건문',    '제어 구조', 'if, switch 등 조건에 따라 분기하는 구조', 1.5, 20, 10, 0),
        ('variable',   '변수',      '자료',     '데이터를 저장하고 사용하는 공간', 1.2, -20, 10, 0),
        ('list',       '리스트',    '자료구조',  '여러 데이터를 순서대로 저장하는 구조', 1.2, -10, -10, 10),
        ('function',   '함수',      '추상화',    '특정 동작을 수행하는 코드 묶음', 1.8, 0, 20, -10),
        ('math',       '수학연산',   '연산',     '사칙연산 및 수학적 계산', 1.0, 30, -5, 5),
        ('logic',      '논리연산',   '연산',     'AND, OR, NOT 등의 논리 판단', 1.0, 30, 5, 5),
        ('io',         '입출력',    '기타',     '사용자 입력 및 화면 출력', 1.0, -30, 0, 0),
        ('recursion',  '재귀',      '알고리즘',  '자기 자신을 호출하는 함수 패턴', 2.0, 0, 40, -20)`,

        // 2. CT Edges Table
        `CREATE TABLE IF NOT EXISTS CT_Edges (
            id INT AUTO_INCREMENT PRIMARY KEY,
            source_node_id VARCHAR(50) NOT NULL,
            target_node_id VARCHAR(50) NOT NULL,
            relationship_type VARCHAR(50) DEFAULT 'related',
            strength FLOAT DEFAULT 1.0,
            CONSTRAINT uk_edge UNIQUE (source_node_id, target_node_id)
        )`,

        // 3. CT Edges Data
        `INSERT IGNORE INTO CT_Edges (source_node_id, target_node_id, strength) VALUES
        ('loop', 'condition', 0.8),
        ('loop', 'list', 0.7),
        ('variable', 'math', 0.9),
        ('condition', 'logic', 0.9),
        ('function', 'recursion', 1.0),
        ('io', 'variable', 0.5)`,

        // 4. User Personality Table
        `CREATE TABLE IF NOT EXISTS User_Personality (
            user_id VARCHAR(50) PRIMARY KEY,
            primary_archetype VARCHAR(50) DEFAULT 'EXPLORER',
            traits JSON,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
    ];

    for (const query of queries) {
        try {
            await queryDatabase(query);
            console.log('✅ Query executed successfully');
        } catch (error) {
            console.error('❌ Query failed:', error.message);
        }
    }

    console.log('🎉 Schema Updates Completed.');
    process.exit(0);
}

runUpdates();
