-- ================================================================================
-- CT Connectome Seed Data
-- 작성일: 2025-12-19
-- 목적: 초기 CT 노드, 페르소나, 로드맵 데이터 주입
-- ================================================================================

-- 1. [Universe] CT Nodes (핵심 개념 20개)
-- 3D 좌표는 0,0,0을 중심으로 방사형으로 가상 배치 (추후 Force Graph로 자동 조정됨)

INSERT INTO CT_Nodes (name, category, description, importance, pos_x, pos_y, pos_z) VALUES
-- Level 1: Basics (Center)
('Input/Output', 'Basics', 'Standard input and output operations', 1.0, 0, 0, 0),
('Variables', 'Basics', 'Storing and retrieving data', 1.0, 10, 0, 0),
('Data Types', 'Basics', 'Integers, Floats, Strings, Booleans', 0.8, 5, 5, 0),
('Operators', 'Basics', 'Arithmetic, Comparison, Logical operators', 0.8, 5, -5, 0),

-- Level 2: Control Flow (Inner Ring)
('If-Else', 'Control Flow', 'Conditional execution paths', 1.5, 20, 10, 5),
('Loop (For)', 'Control Flow', 'Iterating over sequences', 1.5, 20, -10, 5),
('Loop (While)', 'Control Flow', 'Condition-based iteration', 1.2, 25, 0, 5),
('Nested Loop', 'Control Flow', 'Loops within loops', 1.3, 30, -5, 10),

-- Level 3: Data Structures (Middle Ring)
('List/Array', 'Data Structure', 'Ordered collection of items', 1.4, -20, 10, -5),
('String Manipulation', 'Data Structure', 'Text processing and formatting', 1.2, -20, -10, -5),
('Dictionary/Map', 'Data Structure', 'Key-value pairs', 1.3, -30, 0, -5),
('2D List', 'Data Structure', 'Matrix and grid representation', 1.1, -25, 15, -10),

-- Level 4: Functions & Logic (Outer Ring)
('Function Definition', 'Abstraction', 'Creating reusable code blocks', 1.5, 0, 30, 10),
('Parameters/Return', 'Abstraction', 'Passing data in and out of functions', 1.2, 10, 35, 10),
('recursion', 'Algorithm', 'Function calling itself', 1.4, 0, 40, 20),
('Scope', 'Abstraction', 'Global vs Local variables', 0.9, -10, 35, 10),

-- Level 5: Algorithms & Advanced (Far Outer)
('Sorting', 'Algorithm', 'Organizing data order', 1.1, 40, 20, 0),
('Searching', 'Algorithm', 'Finding elements in data', 1.1, 40, -20, 0),
('Exception Handling', 'Stability', 'Managing errors gracefully', 1.0, -40, 20, 0),
('File I/O', 'Stability', 'Reading/Writing files', 1.0, -40, -20, 0);


-- 2. [Universe] CT Edges (지식의 연결)
-- 선행 학습 관계 (Source를 알아야 Target을 배울 수 있음)

INSERT INTO CT_Edges (source_id, target_id, relation_type, weight) 
SELECT s.id, t.id, 'prerequisite', 1.0
FROM CT_Nodes s, CT_Nodes t
WHERE 
    (s.name = 'Input/Output' AND t.name = 'Variables') OR
    (s.name = 'Variables' AND t.name = 'Data Types') OR
    (s.name = 'Variables' AND t.name = 'Operators') OR
    
    (s.name = 'Operators' AND t.name = 'If-Else') OR
    (s.name = 'Variables' AND t.name = 'Loop (For)') OR
    (s.name = 'Loop (For)' AND t.name = 'Nested Loop') OR
    
    (s.name = 'Variables' AND t.name = 'List/Array') OR
    (s.name = 'List/Array' AND t.name = '2D List') OR
    (s.name = 'List/Array' AND t.name = 'Dictionary/Map') OR
    
    (s.name = 'If-Else' AND t.name = 'Function Definition') OR
    (s.name = 'Function Definition' AND t.name = 'recursion');


-- 3. [Soul] Archetypes (4대 페르소나)

INSERT INTO User_Archetypes (code, name, description, recommended_style) VALUES
('ARCHITECT', 'The Architect (설계자)', '구조적이고 안정적인 코드를 선호합니다. 재사용성과 가독성을 중시합니다.', 'Theory-first'),
('HACKER', 'The Hacker (해결사)', '문제 해결 그 자체에 집중합니다. 빠르고 효율적인 숏컷을 찾아냅니다.', 'Challenge-first'),
('ARTIST', 'The Artist (표현가)', '코드를 통해 무언가 창조해내는 것을 즐깁니다. 시각적이고 직관적인 결과물을 선호합니다.', 'Project-first'),
('EXPLORER', 'The Explorer (탐험가)', '호기심이 많고 다양한 시도를 두려워하지 않습니다. 원리를 깊이 파고듭니다.', 'Discovery-first');


-- 4. [Navigation] Initial Roadmap (표준 코스)

INSERT INTO Roadmaps (name, target_archetype, difficulty_curve, description) VALUES
('Python Essentials', NULL, 'Linear', '파이썬의 기초부터 자료구조까지 탄탄하게 다지는 정석 코스입니다.');

-- 로드맵 단계 연결 (ID 조회 후 삽입하는 방식이 안전하지만, 여기선 순서대로 가정하거나 나중에 백엔드 로직으로 처리)
-- (SQL 스크립트에서는 ID 의존성 때문에 구체적인 매핑은 생략하거나 별도 프로시저로 처리 권장)
