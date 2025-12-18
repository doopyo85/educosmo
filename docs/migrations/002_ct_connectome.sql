-- ================================================================================
-- CT Connectome & Educational Intelligence Migration
-- 작성일: 2025-12-19
-- 목적: 지식 그래프(Connectome), 3가지 엔진(Judge/Gen/Eval), 영혼의 레이어(Persona/Skill) 구축
-- ================================================================================

-- 1. [Universe] CT Connectome (존재와 논리의 차원)
-- CT 개념 노드 (뉴런/별)
CREATE TABLE IF NOT EXISTS CT_Nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,          -- 예: 'Loop', 'If-Else', 'List Indexing'
    category VARCHAR(50),               -- 예: 'Flow Control', 'Data Structure'
    description TEXT,
    
    -- 3D Visualization Coordinates
    pos_x FLOAT DEFAULT 0,
    pos_y FLOAT DEFAULT 0,
    pos_z FLOAT DEFAULT 0,
    importance FLOAT DEFAULT 1.0,       -- 노드 크기
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CT 개념 간 연결 (시냅스)
CREATE TABLE IF NOT EXISTS CT_Edges (
    source_id INT,
    target_id INT,
    weight FLOAT DEFAULT 1.0,           -- 연관성 강도 (0.0 ~ 1.0)
    relation_type VARCHAR(20),          -- 'prerequisite', 'related', 'variant'
    
    PRIMARY KEY (source_id, target_id),
    FOREIGN KEY (source_id) REFERENCES CT_Nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES CT_Nodes(id) ON DELETE CASCADE
);

-- 학생별 CT 활성화 상태 (Brain Activation Map)
CREATE TABLE IF NOT EXISTS User_Connectome (
    user_id INT,
    ct_node_id INT,
    
    activation_level FLOAT DEFAULT 0,   -- 활성화 정도 (0.0 ~ 1.0)
    total_exp INT DEFAULT 0,            -- 누적 경험치
    decay_rate FLOAT DEFAULT 0.05,      -- 망각 곡선 적용 비율
    last_activated_at TIMESTAMP,
    
    PRIMARY KEY (user_id, ct_node_id),
    FOREIGN KEY (ct_node_id) REFERENCES CT_Nodes(id) ON DELETE CASCADE
    -- FOREIGN KEY (user_id) REFERENCES Users(id) -- Users 테이블 존재 가정
);


-- 2. [Vector Map] Problem Engine (탐사와 검증의 차원)
-- 문제 풀이 이력 (Grading Engine Output)
CREATE TABLE IF NOT EXISTS ProblemSubmissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    problem_id VARCHAR(50) NOT NULL,    -- 문제 ID (CosPro 등)
    
    code TEXT,
    language VARCHAR(20) DEFAULT 'python',
    
    status VARCHAR(20),                 -- PASS, FAIL, ERROR
    score INT DEFAULT 0,                -- 테스트케이스 통과 점수
    execution_time FLOAT,               -- ms
    memory_usage FLOAT,                 -- KB
    
    error_message TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_prob (user_id, problem_id),
    INDEX idx_status (status)
);

-- 문제-CT 매핑 (Vector Definition)
CREATE TABLE IF NOT EXISTS Problem_Map (
    problem_id VARCHAR(50),
    ct_node_id INT,
    contribution_weight FLOAT,          -- 이 문제 해결이 해당 CT에 기여하는 정도 (0.0 ~ 1.0)
    
    PRIMARY KEY (problem_id, ct_node_id),
    FOREIGN KEY (ct_node_id) REFERENCES CT_Nodes(id) ON DELETE CASCADE
);

-- 문제 평가 데이터 (Evaluation Engine Output)
CREATE TABLE IF NOT EXISTS Problem_Analytics (
    problem_id VARCHAR(50) PRIMARY KEY,
    
    pass_rate FLOAT DEFAULT 0,          -- 정답률
    discrimination_index FLOAT DEFAULT 0, -- 변별력
    ct_correlation FLOAT DEFAULT 0,     -- CT 상관계수
    
    avg_rating FLOAT DEFAULT 0,         -- 학생 평점
    report_count INT DEFAULT 0,
    
    health_score INT DEFAULT 100,       -- 문제 건강도
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, QUARANTINE, RETIRED
    last_audited_at TIMESTAMP
);

-- 문제 생성 계보 (Generation Engine Output)
CREATE TABLE IF NOT EXISTS Problem_Genealogy (
    child_problem_id VARCHAR(50) PRIMARY KEY,
    parent_problem_id VARCHAR(50),      -- 모체 문제
    
    generation_prompt TEXT,
    mutation_type VARCHAR(50),          -- 'Parameter', 'Logic-Reversal', 'Context-Switch'
    created_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 문제 피드백 (User Voice)
CREATE TABLE IF NOT EXISTS Problem_Feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    problem_id VARCHAR(50),
    user_id INT,
    feedback_type VARCHAR(20),          -- 'too_hard', 'good', 'boring'
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 3. [Soul Layer] Knowledge & Memory (유형과 성장의 차원)
-- 페르소나 정의 (Archetypes)
CREATE TABLE IF NOT EXISTS User_Archetypes (
    code VARCHAR(20) PRIMARY KEY,       -- ARCHITECT, HACKER, ARTIST, EXPLORER
    name VARCHAR(50),
    description TEXT,
    recommended_style VARCHAR(50)
);

-- 학생 성향 프로필 (Persona Profile)
CREATE TABLE IF NOT EXISTS User_Personality (
    user_id INT PRIMARY KEY,
    primary_archetype VARCHAR(20),
    secondary_archetype VARCHAR(20),
    
    logic_score INT DEFAULT 0,
    creativity_score INT DEFAULT 0,
    persistence_score INT DEFAULT 0,
    efficiency_score INT DEFAULT 0,
    stability_score INT DEFAULT 0,
    
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (primary_archetype) REFERENCES User_Archetypes(code)
);

-- 테크트리/로드맵 정의 (Roadmaps)
CREATE TABLE IF NOT EXISTS Roadmaps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_archetype VARCHAR(20),
    difficulty_curve VARCHAR(20),       -- 'Linear', 'Exponential'
    description TEXT
);

-- 로드맵 단계 (Nodes)
CREATE TABLE IF NOT EXISTS Roadmap_Nodes (
    roadmap_id INT,
    step_order INT,
    ct_node_id INT,
    required_mastery INT DEFAULT 70,    -- 통과 기준 점수
    
    PRIMARY KEY (roadmap_id, step_order),
    FOREIGN KEY (roadmap_id) REFERENCES Roadmaps(id) ON DELETE CASCADE,
    FOREIGN KEY (ct_node_id) REFERENCES CT_Nodes(id) ON DELETE CASCADE
);

-- 학생 로드맵 진행도
CREATE TABLE IF NOT EXISTS User_Roadmap_Progress (
    user_id INT,
    roadmap_id INT,
    current_step INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'IN_PROGRESS',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, roadmap_id),
    FOREIGN KEY (roadmap_id) REFERENCES Roadmaps(id) ON DELETE CASCADE
);

-- 실무 능력 평가 (User Skills)
CREATE TABLE IF NOT EXISTS User_Skills (
    user_id INT,
    skill_category VARCHAR(50),         -- 'Debugging', 'Optimization', 'Clean Code'
    level INT DEFAULT 1,
    exp_points INT DEFAULT 0,
    
    verified_count INT DEFAULT 0,       -- 프로젝트에서 검증된 횟수
    last_assessed_at TIMESTAMP,
    
    PRIMARY KEY (user_id, skill_category)
);

-- 인덱스 최적화
CREATE INDEX idx_edges_source ON CT_Edges(source_id);
CREATE INDEX idx_problem_map_ct ON Problem_Map(ct_node_id);
CREATE INDEX idx_genealogy_parent ON Problem_Genealogy(parent_problem_id);
