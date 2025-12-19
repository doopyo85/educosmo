# 🌌 코딩앤플레이 전체 청사진: 로직의 은하수와 살아있는 생태계 (The Grand Blueprint)

본 문서는 프로젝트의 철학, 아키텍처, 데이터베이스 구조, 그리고 미래 로드맵을 포괄하는 최종 설계도입니다.

---

## Part 1. CT Connectome: 로직의 은하수 (The Galaxy of Logic)

### 1. 교육 철학 (Philosophy)
**"문제 해결 능력은 선형적인 사다리가 아니라, 무수히 얽힌 리좀(Rhizome)이자 살아있는 신경망(Connectome)이다."**

기존의 LMS가 **"진도율(Progress Bar)"**이라는 1차원적 지표에 머물렀다면, 우리는 지식의 구조를 3차원 입체 공간으로 시각화합니다.

*   **CT Atom (논리 원자):** 반복, 조건, 변수, 재귀 등 가장 기초적인 컴퓨팅 사고의 단위. (뉴런/별)
*   **Problems (분자/위성):** 여러 CT Atom이 결합하여 해결해야 하는 구체적인 과제. (검증 도구)
*   **Projects (행성):** 이러한 분자들이 모여 만들어진 거대한 결과물. (탐험의 목적지)
*   **Constellation (별자리):** 학생이 문제를 풀며 밝힌 CT Atom들이 연결되어 만들어내는 고유의 지식 지도.

학생은 **"빈 화면을 채우는 게 아니라, 어두운 우주에 자신만의 별자리를 밝혀나가는 탐험가"**가 됩니다.

### 2. 데이터베이스 구조 (DB Schema)
이 비전을 구현하기 위해 그래프 데이터베이스(Graph DB) 모델을 관계형 DB에 차용합니다.

#### A. 메타 데이터 (지식의 지도)

**1. CT_Nodes (뉴런/별)**
컴퓨팅 사고력의 최소 단위입니다.
```sql
CREATE TABLE CT_Nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,          -- 예: 'Loop', 'If-Else', 'List Indexing'
    category VARCHAR(50),               -- 예: 'Flow Control', 'Data Structure'
    
    -- 3D 좌표 (비주얼라이제이션 초기값)
    pos_x FLOAT DEFAULT 0,
    pos_y FLOAT DEFAULT 0,
    pos_z FLOAT DEFAULT 0,
    
    importance FLOAT DEFAULT 1.0        -- 노드 크기 (중요도)
);
```

**2. CT_Edges (시냅스/연결)**
개념 간의 연관성입니다. (예: 반복문을 알면 배열 순회를 배우기 쉽다)
```sql
CREATE TABLE CT_Edges (
    source_id INT,
    target_id INT,
    weight FLOAT,                       -- 연관성 강도 (0.0 ~ 1.0)
    relation_type VARCHAR(20),          -- 'prerequisite', 'related'
    PRIMARY KEY (source_id, target_id)
);
```

**3. Problem_Map (검증 가중치)**
하나의 문제는 단 하나의 개념이 아니라, 여러 개념의 '복합체'입니다.
```sql
CREATE TABLE Problem_Map (
    problem_id VARCHAR(50),             -- 문제 ID
    ct_node_id INT,                     -- CT 노드 ID
    contribution_weight FLOAT,          -- 이 문제를 풀면 해당 CT 능력이 얼마나 검증되는가 (0.0 ~ 1.0)
    
    PRIMARY KEY (problem_id, ct_node_id)
);
```

#### B. 학생 데이터 (활성화 상태)

**4. User_Connectome (활성화 맵)**
학생의 뇌 활성화 상태를 저장합니다.
```sql
CREATE TABLE User_Connectome (
    user_id INT,
    ct_node_id INT,
    
    activation_level FLOAT DEFAULT 0,   -- 활성화 정도 (0.0: 어둠 ~ 1.0: 빛남)
    decay_rate FLOAT DEFAULT 0.05,      -- 망각 곡선 (시간이 지나면 희미해짐)
    last_activated_at TIMESTAMP,
    
    PRIMARY KEY (user_id, ct_node_id)
);
```

### 3. 시각화 전략 (Visual Strategy)
**"1000개의 고원, 1000개의 별"**
단순 차트가 아닌 WebGL (Three.js) 기반의 인터랙티브 3D 경험을 제공합니다.

*   **Macroscopic View (거시적 관점):**
    *   화면 중앙에 은하수처럼 펼쳐진 CT Connectome이 회전합니다.
    *   학생이 마스터한 영역은 황금색/네온 블루로 빛나고(Bloom Effect), 미지의 영역은 희미한 회색 점으로 떠 있습니다.
    *   "활성화 네트워크"가 마치 뇌신경 발화처럼 펄럭입니다.

*   **Microscopic View (미시적 관점):**
    *   특정 '별(CT Node)'을 클릭하면 줌인(Zoom-in) 됩니다.
    *   그 별의 주위를 공전하는 **위성(문제들)**이 보입니다.
    *   "이 별을 더 밝게 하려면 이 위성(문제)을 탐사하세요."라는 메시지가 뜹니다.

*   **UI Interaction:**
    *   **"Connect the Dots":** 문제를 풀 때마다 해당 문제와 연결된 CT Node들 사이에 광선이 발사되어 연결선이 강화됩니다.
    *   **"Orbit Control":** 마우스로 자유롭게 우주를 회전하고 탐험합니다.

---

## Part 2. The 3-Engine Architecture & The Living Ecosystem

### 1. The Three Layers of Universe
교육 시스템을 3개의 층위(Layer)로 정의합니다.

1.  **CT Connectome (The Universe - 존재와 논리의 차원):**
    *   **정의:** 컴퓨팅 사고력(CT)의 자연 법칙과 구조가 존재하는 불변의 영역.
    *   **메타포:** 은하수(Galaxy), 신경망(Brain), 리좀(Rhizome).
    *   **역할:** 학습의 목적지이자 지도.
2.  **Vector Map (The Navigation - 전략과 탐사의 차원):**
    *   **정의:** CT 맵을 정복하기 위해 보내는 탐사선(문제)들의 궤적 지도.
    *   **메타포:** 탐사선(Probe), 위성(Satellite), 벡터(Vector).
    *   **역할:** CT를 검증하고, 길을 안내하며, 스스로 자신의 유효성을 증명함.
3.  **Content Map (The Civilization - 문명과 경험의 차원):**
    *   **정의:** 실제 사용자가 경험하는 커리큘럼, 프로젝트, 스토리.
    *   **메타포:** 행성(Planet), 문명(Civilization).
    *   **역할:** 학습자에게 동기를 부여하고 맥락을 제공함.

### 2. The Three Driving Engines
이 생태계를 움직이는 3가지 핵심 동력입니다.

#### A. Grading Engine (The Judge - 심판)
*   **역할:** 학생의 답안을 평가합니다. (기존 Judge0)
*   **Input:** 학생 코드, 테스트 케이스.
*   **Output:** Pass/Fail, Execution Time, Memory Usage.
*   **핵심 가치:** 정확성(Accuracy).

#### B. Generation Engine (The Creator - 창조자)
*   **역할:** CT 맵의 빈 공간(Void)을 발견하고, 이를 채울 새로운 문제를 생성합니다.
*   **Input:** 타겟 CT Node, 난이도, 모체 문제(Parent Problem).
*   **Output:** 새로운 문제(Code, Test Cases, Description).
*   **핵심 가치:** 다양성(Diversity).

#### C. Evaluation Engine (The Auditor - 감시자)
*   **역할:** **"이 문제는 좋은 문제인가?"**를 평가합니다. 문제가 CT 능력을 제대로 검증하고 있는지 역으로 감시합니다.
*   **Input:** 학생들의 풀이 통계, CT 활성화 상관관계, 사용자 피드백.
*   **Output:** 문제 건강도(Health Score), 변별력 지수(Discrimination Index).
*   **핵심 가치:** 유효성(Validity).
*   *예시:* Loop 마스터 학생들이 오히려 많이 틀리는 Loop 문제는 "나쁜 문제(Misleading Problem)"로 판정하여 퇴출.

### 3. Database Schema Upgrade
기존 설계에 엔진을 위한 데이터를 추가합니다.

#### A. 문제 평가 데이터 (Problem_Analytics)
Evaluation Engine이 사용하는 데이터입니다.
```sql
CREATE TABLE Problem_Analytics (
    problem_id VARCHAR(50) PRIMARY KEY,
    
    -- 통계적 지표
    pass_rate FLOAT,                    -- 정답률
    discrimination_index FLOAT,         -- 변별력 (상위권 정답률 - 하위권 정답률)
    ct_correlation FLOAT,               -- 타겟 CT 능력과 점수의 상관계수
    
    -- 사용자 반응
    avg_rating FLOAT,                   -- 학생 평점 (1~5)
    report_count INT DEFAULT 0,         -- 신고 횟수
    
    -- 엔진 판정
    health_score INT DEFAULT 100,       -- 문제 건강도 (건강함/주의/폐기대상)
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, QUARANTINE(격리), RETIRED(은퇴)
    
    last_audited_at TIMESTAMP           -- 마지막 평가 시점
);
```

#### B. 문제 생성 계보 (Problem_Genealogy)
Generation Engine이 생성한 문제의 족보를 관리합니다.
```sql
CREATE TABLE Problem_Genealogy (
    child_problem_id VARCHAR(50) PRIMARY KEY,
    parent_problem_id VARCHAR(50),      -- 모체 문제 (NULL이면 Original)
    
    generation_prompt TEXT,             -- 생성에 사용된 AI 프롬프트
    mutation_type VARCHAR(20),          -- 변형 유형
    created_by_engine_version VARCHAR(20), 
    
    UNIQUE KEY (child_problem_id)
);
```

#### C. 피드백 루프 (Problem_Feedback)
```sql
CREATE TABLE Problem_Feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    problem_id VARCHAR(50),
    user_id INT,
    feedback_type VARCHAR(20),          -- 'too_hard', 'boring', 'weird_logic'
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Visualization: The Observatory (관측소)
3가지 맵과 3가지 엔진이 만나는 비주얼 인터페이스입니다.

*   **메인 뷰 (3D Galaxy):**
    *   CT Nodes가 은하수처럼 빛납니다. (Universe)
    *   Problems가 그 주위를 위성처럼 공전합니다. (Vector Map)
    *   위성의 색상은 Problem_Analytics.health_score를 반영합니다. (녹색: 건강, 붉은색: 고장)
*   **Engine Dashboard (HUD):**
    *   **Generator:** "현재 '이중 반복문' 영역의 위성이 부족합니다. 탐사선을 추가로 발사(생성)하시겠습니까?"
    *   **Auditor:** "위성 #1024의 신호가 오작동 중입니다(변별력 저하). 수리(수정)하거나 폐기하십시오."

---

## Part 3. Educational Intelligence Architecture: The 4th Layer

### 1. The Core Philosophy (4 Layers)
우주는 4가지 차원으로 완성됩니다.

1.  **CT Connectome (Universe):** 존재와 논리의 차원. (불변의 법칙)
2.  **Vector Map (Navigation):** 문제와 탐사의 차원. (검증과 도전)
3.  **Content Map (Civilization):** 과제와 프로젝트의 차원. (경험과 동기)
4.  **Soul Layer (Knowledge & Memory):** [NEW] 아이의 페르소나와 성장의 차원.
    *   단순한 기록(Log)이 아닌, 아이의 **"정체성(Identity)"**과 **"미래(Future)"**를 정의하는 지식과 기억의 저장소입니다.

### 2. The Trinity of Measurement (3가지 측정)
모든 문제 풀이는 단일 이벤트가 아니라, 3가지 측면을 동시에 스캔하는 행위입니다.

1.  **Performance (성취도):** 문제를 맞았는가? (Result: Pass/Fail)
2.  **Understanding (이해도):** CT를 이해했는가? (Context: Why/How)
3.  **Validity (타당성):** 좋은 문제였는가? (Quality: Health Score)

### 3. The Trinity of Insight (3가지 통찰)
축적된 측정 데이터를 통해 우리는 3가지를 그려냅니다.

#### A. Persona (아이의 유형) - "Who are you?"
아이들을 정형화된 몇 가지 유형(Archetype)으로 분류하여 성향을 파악합니다.
*   **The Architect (설계자형):** 코드가 구조적이고 논리적임.
*   **The Hacker (해결사형):** 효율적이고 빠른 해결을 선호함.
*   **The Artist (표현가형):** 프로젝트 차원에서 창의성이 돋보임.
*   **The Explorer (탐험가형):** 다양한 오답을 시도하며 원리를 깨우침.

#### B. Roadmap (테크트리) - "Where to go?"
모든 아이가 같은 길을 갈 필요는 없습니다. 페르소나에 맞는 최적의 경로를 제안합니다.
*   **Standard Path:** 정석적인 커리큘럼.
*   **Deep Dive Path:** 특정 원리(예: 재귀, 포인터)를 깊게 파고드는 경로.
*   **Rapid Build Path:** 프로젝트 제작 중심의 실용 경로.

#### C. Ability (실무 능력) - "What can you do?"
단순 CT 점수가 아닌, 현실 세계에서의 해결 능력을 평가합니다.
*   **Debugging:** 오류 수정 능력.
*   **Optimization:** 효율성 개선 능력.
*   **Architecture:** 구조 설계 능력.

### 4. Database Schema Expansion

#### A. 페르소나 및 적성 (User_Profile)
```sql
CREATE TABLE User_Archetypes (
    code VARCHAR(20) PRIMARY KEY,       -- ARCHITECT, HACKER, ARTIST, EXPLORER
    name VARCHAR(50),
    description TEXT,
    recommended_style VARCHAR(50)
);

CREATE TABLE User_Personality (
    user_id INT PRIMARY KEY,
    primary_archetype VARCHAR(20),      -- 주 성향
    secondary_archetype VARCHAR(20),    -- 부 성향
    
    -- 5대 성향 지표 (0~100)
    logic_score INT,
    creativity_score INT,
    persistence_score INT,
    efficiency_score INT,
    stability_score INT,
    
    last_updated TIMESTAMP
);
```

#### B. 로드맵 및 테크트리 (Tech_Tree)
```sql
CREATE TABLE Roadmaps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),                  -- 예: "Python Data Scientist Path"
    target_archetype VARCHAR(20),       -- 추천 유형
    difficulty_curve VARCHAR(20),       -- 'Linear', 'Exponential'
    description TEXT
);

CREATE TABLE Roadmap_Nodes (
    roadmap_id INT,
    step_order INT,
    ct_node_id INT,                     -- 학습할 CT 개념
    required_mastery INT,               -- 통과 기준 점수
    PRIMARY KEY (roadmap_id, step_order)
);

CREATE TABLE User_Roadmap_Progress (
    user_id INT,
    roadmap_id INT,
    current_step INT DEFAULT 1,
    status VARCHAR(20),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### C. 실무 능력 평가 (Skill_Assessment)
```sql
CREATE TABLE User_Skills (
    user_id INT,
    skill_category VARCHAR(50),         -- 'Debugging', 'Optimization'
    level INT DEFAULT 1,                -- 1~10 Level
    exp_points INT DEFAULT 0,           -- 경험치
    
    verified_by_projects INT DEFAULT 0, -- 실제 프로젝트에서 검증된 횟수
    last_assessed_at TIMESTAMP,
    PRIMARY KEY (user_id, skill_category)
);
```

### 5. Integrated Workflow
1.  **Solve:** 학생이 문제를 풉니다.
2.  **Analyze (3-Engine):**
    *   **Judge:** O/X 판정.
    *   **Profiler:** 풀이 스타일(변수명, 주석, 시도 횟수, 시간)을 분석하여 User_Personality 업데이트.
    *   **Auditor:** 문제의 유효성 검증.
3.  **Update:**
    *   CT_Connectome 점수 갱신.
    *   User_Skills 경험치 획득 (예: 디버깅 시도 많았으면 Debugging Exp++).
4.  **Guide:**
    *   User_Roadmap_Progress 체크 -> 다음 문제 또는 프로젝트 추천.
    *   *"해커형인 너에게는 이론보다는 이 실전 프로젝트가 딱이야!"*

이 구조는 차가운 평가 시스템을 넘어, **아이 한 명 한 명을 깊이 이해하고 가장 빛나는 길로 안내하는 따뜻한 멘토(Memory)**가 됩니다.

---

## Part 4. Implementation Roadmap (Phase 2 & 3)

### Phase 2: CT Connectome & 3-Engine Architecture
1.  **데이터베이스 구축 (002_ct_connectome.sql)**
    *   DB 마이그레이션: CT_Nodes, CT_Edges, Problem_Map, User_Connectome 등 테이블 생성.
    *   Problem Vector Map (탐사선) 및 Analytics/Genealogy 테이블 구축.

2.  **The 3 Engines (Backend Logic)**
    *   **Grading Engine:** Judge0 연동, 상세 메타데이터 기록.
    *   **Evaluation Engine:** 문제 건강도(Health Score) 계산 알고리즘, Discrimination Index 로직.
    *   **Generation Engine:** LLM 연동 생성 파이프라인, 부족한 CT Node 자동 감지 트리거.

3.  **Visualization (The Observatory Dashboard)**
    *   CT Galaxy 렌더링 (ObservatoryComponent.js).
    *   위성 궤도 시각화 및 엔진 상태 HUD 구현.

### Phase 3: Profiling & Roadmaps (영혼과 기억)
1.  **The Insight Engine (Profiler)**
    *   **Persona System:** 4대 성향 정의 및 풀이 패턴 분석 로직.
    *   **Ability Matrix:** 실무 능력 및 프로젝트 기반 경험치 산정.

2.  **The Navigation System (Guide)**
    *   **Tech Tree:** 표준/심화/속성 코스 데이터 구축.
    *   **Algorithm:** 페르소나별 로드맵 매칭 알고리즘.
    *   **My Career Page:** "나의 캐릭터" 카드 및 로드맵 진행도 시각화.
