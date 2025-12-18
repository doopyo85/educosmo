# 🌌 코딩앤플레이 프로젝트 청사진: 은하수와 세 개의 엔진 (The Galaxy Blueprint)

본 문서는 프로젝트의 기술적 아키텍처를 **"은하수(Galaxy)", "세 개의 엔진(Engines)", "영혼과 기억(Soul & Memory)"**이라는 세 가지 핵심 개념으로 정의한 전체 청사진입니다.

---

## 1. 🌌 더 갤럭시 (The Galaxy: CT Connectome)
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

---

## 2. ⚙️ 세 개의 엔진 (The Three Engines)
**"세상을 움직이는 동력"**

플랫폼을 구동하는 기술적 심장은 서로 다른 역할을 수행하는 세 개의 강력한 엔진으로 구성됩니다. 이들은 상호 연결되어 있으면서도 독립적으로 작동합니다.

### 엔진 1: 상호작용 엔진 (Interaction Engine) - The Host
*   **정체:** **Node.js (PM2)** - Port 3000
*   **역할:** 사용자 접점, 웹사이트 렌더링, 실시간 통신.
*   **핵심 부품:**
    *   `Server.js`: 중앙 관제탑.
    *   `Socket.io`: 실시간 신경망 (클라이언트-서버 통신).
    *   **Google Sheets 연동:** 살아있는 CMS (콘텐츠 관리).

### 엔진 2: 실행 엔진 (Execution Engine) - The Docker
*   **정체:** **Jupyter Notebook & Python** - Port 8888
*   **역할:** 코드를 실제로 살아 움직이게 하는 격리된 실행 환경.
*   **특징:**
    *   사용자별 독립된 우주(컨테이너) 제공.
    *   안전한 샌드박스 환경에서 파이썬 코드 실행.
    *   *최근 업데이트:* 호스트와 완전히 분리되어 안정성 확보 (IPv4/IPv6 충돌 해결).

### 엔진 3: 평가 엔진 (Evaluation Engine) - The Judge
*   **정체:** **Judge0** - Port 2358
*   **역할:** 코드의 정확성을 판단하고 CT(Computational Thinking) 능력을 분석.
*   **기능:**
    *   다국어 코드 채점 (Python, C, Java 등).
    *   `ProjectAnalyzer`: 코드 구조 분석 및 피드백 생성.
    *   **ProfilingService**: 학생의 강점과 약점 분석.

---

## 3. 👻 영혼과 기억 (Soul and Memory)
**"데이터는 사라지지 않는다"**

사용자의 아이덴티티와 그들이 남긴 모든 발자취는 영구적으로 기록되고 보존됩니다.

### 3.1 영혼 (Soul: User Identity)
*   **정체:** `Users` 테이블 & 세션
*   **특징:**
    *   **7단계 계급:** Guest부터 Admin까지 부여된 권한 체계.
    *   **하이브리드 인증:** DB 로그인 + Redis 세션 관리.
    *   **페르소나:** 학생, 교사, 관리자로서의 역할 수행.

### 3.2 기억 (Memory: Data Persistence)
*   **정체:** `LearningLogs`, `ProjectSubmissions`, `S3`
*   **단기 기억 (Redis):** 현재 실행 중인 코드, 임시 세션 데이터.
*   **장기 기억 (MySQL):**
    *   `LearningLogs`: 언제, 무엇을, 얼마나 공부했는가.
    *   `CTAssessments`: 컴퓨팅 사고력의 성장 기록.
*   **아카이브 (S3):**
    *   학생이 작성한 소중한 프로젝트 파일(`ipynb`, `py`) 영구 보관.
    *   "내가 만든 우주"를 언제든 다시 꺼내볼 수 있음.

---

## 4. 🚀 현재 상태 (Status Quo)
*2025-12-19 기준*

*   **엔진 1 (Web)**과 **엔진 2, 3 (Docker)**의 **동기화 완료**.
*   이전의 충돌(Port Conflict)로 인한 시스템 불안정 해소.
*   **갤럭시(콘텐츠)**와 **기억(DB)**의 연결 통로(로그인) 복구 완료.
*   이제 **관측소(Observatory)**를 통해 이 모든 데이터를 시각화할 준비가 되었습니다.
