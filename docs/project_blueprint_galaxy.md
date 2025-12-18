# 🌌 코딩앤플레이 프로젝트 청사진: 은하수와 세 개의 엔진 (The Galaxy Blueprint)

본 문서는 프로젝트의 기술적 아키텍처를 **"은하수(Galaxy)", "세 개의 엔진(Engines)", "영혼과 기억(Soul & Memory)"**이라는 세 가지 핵심 개념으로 정의하고, 이에 대한 상세한 기술 명세를 통합한 마스터 설계도입니다.

---

# 1. 🌌 더 갤럭시 (The Galaxy: CT Connectome)
**"모든 지식은 연결되어 있다"**

갤럭시는 이 플랫폼이 제공하는 방대한 **교육 콘텐츠의 우주**이자, 학생들의 학습 경로가 그려지는 **지도**입니다.

### 1.1 구성 요소 (Stars & Constellations)
*   **별 (Nodes):** 개별 학습 콘텐츠 (문제, 퀴즈, 영상, 개념).
    *   *구성:* `ContentMap` 테이블의 데이터.
*   **별자리 (Constellations):** 커리큘럼과 코스 (Python Basic, AI Data Analysis).
*   **연결 (Edges):** 지식의 선후행 관계 (선수 학습 → 심화 학습).

### 1.2 관측소 (The Observatory)
*   **기능:** 학생의 학습 상태를 3D로 시각화하여 보여주는 컴포넌트 (`ObservatoryComponent.js`).
*   **역할:** 나의 위치(현재 학습 중인 문제)와 정복한 별(완료한 문제)을 직관적으로 탐색.

### 1.3 교육 콘텐츠 구조
*   **초등 과정:**
    *   컴퓨터 기초활용
    *   스크래치 (Port 8601)
    *   엔트리 (Port 8070 프록시)
    *   자격증 과정
*   **중고등 과정:**
    *   앱인벤터 (Port 8888)
    *   파이썬
    *   인공지능
    *   알고리즘

---

# 2. ⚙️ 세 개의 엔진 (The Three Engines)
**"세상을 움직이는 동력"**

플랫폼을 구동하는 기술적 심장은 서로 다른 역할을 수행하는 세 개의 강력한 엔진으로 구성됩니다. 이들은 상호 연결되어 있으면서도 독립적으로 작동합니다.

## 엔진 1: 상호작용 엔진 (Interaction Engine) - The Host
*   **정체:** **Node.js (PM2)** - Port 3000
*   **역할:** 사용자 접점, 웹사이트 렌더링, 실시간 통신, 중앙 관제.
*   **기술 스택:** Express.js + EJS + Socket.io + Redis.
*   **핵심 기능:**
    *   **하이브리드 아키텍처:** Server(MVC) + Client(Component System).
    *   **Google Sheets 연동:** 살아있는 CMS (콘텐츠 관리).
    *   **4대 핵심 컴포넌트:**
        1.  `NavigationComponent`: 사이드바/문제목록.
        2.  `ContentComponent`: 문제 내용/해설 표시.
        3.  `IDEComponent`: Python 전용 코드 에디터 (ACE 기반).
        4.  `JupyterComponent`: 격리된 노트북 환경 통합.

## 엔진 2: 실행 엔진 (Execution Engine) - The Docker
*   **정체:** **Jupyter Notebook & Python** - Port 8888
*   **역할:** 코드를 실제로 살아 움직이게 하는 격리된 실행 환경.
*   **상세 아키텍처:**
    *   **사용자별 격리 시스템:** `/jupyter_notebooks/{userID}/` 경로로 파일시스템 격리.
    *   **템플릿 시스템:** `jupyter_templates/`에서 사용자별로 자동 복제 및 변수 치환.
    *   **통신:** iframe + `http-proxy-middleware`를 통한 안전한 연결.
    *   **안정성:** Host(PM2)와 Docker 간 IPv4(`127.0.0.1`) 명시적 내부 통신.

## 엔진 3: 평가 엔진 (Evaluation Engine) - The Judge
*   **정체:** **Judge0** - Port 2358
*   **역할:** 코드의 정확성을 판단하고 CT(Computational Thinking) 능력을 분석.
*   **기능:**
    *   **다국어 채점:** Python, C, Java 등 지원.
    *   **ProjectAnalyzer:** 코드 구조(AST) 분석을 통한 CT 요소(분해, 패턴, 추상화, 알고리즘) 점수화.
    *   **피드백 생성:** 단순 정오답을 넘어선 개선점 제안.

---

# 3. 👻 영혼과 기억 (Soul and Memory)
**"데이터는 사라지지 않는다"**

사용자의 아이덴티티와 그들이 남긴 모든 발자취는 영구적으로 기록되고 보존됩니다.

## 3.1 영혼 (Soul: User Identity)
*   **사용자 권한 체계 (7단계):**
    *   `admin` (최고 관리자)
    *   `manager` (센터장)
    *   `teacher` (강사)
    *   `kinder` / `school` / `student`
    *   `guest`
*   **인증:** Redis 세션 기반 + JWT (API).

## 3.2 기억 (Memory: Data Persistence)

### 단기 기억 (Redis)
*   실시간 세션, 소켓 상태, 임시 코드 캐싱.

### 장기 기억 (MySQL - CT Connectome DB)
데이터베이스는 학생의 성장을 기록하는 거대한 신경망입니다.

1.  **Users:** 영혼(사용자) 정보.
2.  **LearningLogs (학습 이력):**
    *   무엇을(`content_name`), 언제(`end_time`), 얼마나(`duration`) 공부했는가.
    *   *New:* `project_id`, `file_type` 추가.
3.  **ContentMap (지식 지도):**
    *   플랫폼 내 모든 콘텐츠와 CT 요소 점수(분해, 패턴, 추상화, 알고리즘, 평가) 매핑.
4.  **ProjectSubmissions (창작물 저장소):**
    *   학생이 만든 프로젝트(`s3_file_path`)와 자동 분석 결과(`complexity_score`).
5.  **CTAssessments (성장 기록):**
    *   제출물 기반 CT 역량 점수(`ct_algorithm_score` 등) 및 종합 레벨.

### 영원한 기억 (AWS S3)
*   **역할:** 학생의 프로젝트 파일 영구 보관소.
*   **구조:** `/projects/{userId}/{platform}/{filename}`.
*   **기능:** 언제든 "내가 만든 우주"를 다시 불러와 실행(`Load Project`) 가능.

---

# 4. 📜 상세 기술 명세 (Appendix)

## A. 컴포넌트 시스템 아키텍처
**"독립적이면서도 연결된"**

### A.1 EventBus 통신
모든 컴포넌트는 서로를 직접 참조하지 않고 `EventBus`를 통해 대화합니다.
*   `menuSelected`: "사용자가 3번 문제를 선택했다."
*   `problemChanged`: "문제 내용이 로드되었다. IDE와 해설창은 준비하라."
*   `explanation-request`: "사용자가 힌트를 원한다."

### A.2 레이아웃 시스템 (5 Modes)
CSS 클래스 스위칭으로 즉각적인 화면 전환을 수행합니다.
1.  `layout-html`: 일반 웹 콘텐츠.
2.  `layout-ide`: Python 코딩 (좌:문제 / 우:에디터).
3.  `layout-jupyter`: 데이터 분석 (전체화면 노트북).
4.  `layout-quiz`: 평가 모드.
5.  `layout-ppt`: 수업 자료 모드.

## B. 데이터 흐름 (Data Flow)
**Google Sheets → API → Components**

1.  **Source:** Google Sheets (`problems` 시트)에 교사가 콘텐츠 입력.
2.  **Fetch:** `getSheetData()`가 데이터를 가져와 API로 서빙.
3.  **Route:** `server.js`가 요청을 받아 적절한 컴포넌트 렌더링.
4.  **Render:** 각 컴포넌트가 데이터를 받아 화면 구성.

## C. 디렉토리 구조 (File System)
```
educodingnplay/
├── server.js              # [Engine 1] Main Host
├── ecosystem.config.js    # PM2 Configuration
├── docker-compose.yml     # [Engine 2, 3] Docker Config
├── routes/                # API & Page Routers
├── lib_login/             # Auth Logic
├── lib_ct/                # [Judge] CT Analyzer
├── lib_storage/           # S3 Manager
├── public/
│   └── js/components/     # Client Components (IDE, Jupyter, etc)
├── jupyter_notebooks/     # User Isolated Workspace
└── docs/                  # This Blueprint
```

---
*Last Updated: 2025-12-19*
*Version: Galaxy 1.0*
