# Pong2 프론트엔드 통합 명세서 (Final)

## 1. 개요
본 문서는 `pong2.app` (무료 커뮤니티/포트폴리오)와 `app.codingnplay.co.kr` (유료 교육 플랫폼) 간의 **이원화 인증(Dual-Track Auth)** 및 **통합 데이터(Unified Board)** 아키텍처를 기반으로 한 프론트엔드 구현 명세입니다.

---

## 2. 시스템 아키텍처

### 2.1 호스팅 및 통신
| 구분 | 내용 |
| :--- | :--- |
| **Frontend** | Netlify (정적 호스팅) |
| **Backend** | AWS EC2 (Express.js) |
| **API Base URL** | `https://app.codingnplay.co.kr/api/pong2` |
| **Protocol** | HTTPS, CORS 허용 (`pong2.app`) |

### 2.2 인증 모델 (Hybrid Auth)
두 가지 사용자 그룹을 하나의 플랫폼에서 수용합니다.

1.  **CodingNPlay 수강생 (유료)**:
    *   **방식**: 기존 세션(Session Cookie) 공유 (SSO).
    *   **흐름**: 로그인 버튼 → `app.codingnplay.co.kr`로 리다이렉트 → 인증 후 복귀.
2.  **Pong2 일반 회원 (무료)**:
    *   **방식**: JWT (Bearer Token).
    *   **흐름**: 이메일/비번 입력 → API 호출 → JWT 발급 → LocalStorage 저장.

---

## 3. 기능 명세 (Feature Spec)

### 3.1 로그인 / 회원가입 UI
*   **위치**: 사이드바 하단 (모바일: 햄버거 메뉴 하단).
*   **상태별 UI**:
    *   **Guest**: [로그인] 버튼 표시.
    *   **Logged In**: [닉네임] 및 [로그아웃] 버튼 표시.
*   **로그인 모달 (Modal)**:
    *   **Tab 1: 수강생 로그인** (Default)
        *   [코딩앤플레이 계정으로 계속하기] 버튼 (SSO 링크).
    *   **Tab 2: 일반 로그인**
        *   이메일/비밀번호 입력 폼.
        *   [회원가입] 전환 링크.
*   **회원가입 뷰**:
    *   닉네임, 이메일, 비밀번호 입력.
    *   중복 이메일 체크 (API 응답 처리).

### 3.2 게시판 (Community & Portfolio)
*   **데이터 소스**: 기존 `google-sheet` 대신 Backend API (`/boards`) 사용.
*   **카드형 리스트**:
    *   썸네일, 제목, 작성자, 조회수 표시.
    *   작성자 표기 시 `author_type`에 따라 구분 (예: 튜터, 수강생, 일반).
*   **상세 보기**:
    *   현재: 클릭 시 임시 링크 or API 호출.
    *   향후: 상세 모달 또는 페이지 이동 (`/board/:id`).

### 3.3 API 클라이언트 (`api-client.js`)
*   **역할**: Backend API와의 통신을 전담.
*   **주요 메소드**:
    *   `login(email, password)`: JWT 발급 및 저장.
    *   `getBoards(type, limit)`: 게시글 목록 조회.
    *   `getPortfolio(studentId)`: 특정 학생의 포트폴리오 조회.
*   **인증 헤더 처리**:
    *   요청 시 LocalStorage의 JWT 유무 확인 후 `Authorization: Bearer <token>` 헤더 자동 추가.

### 3.4 주요 기능별 UI/UX (New)

#### (1) 코딩퀴즈 포털 (Portal)
*   **목적**: 외부 무료 학습 콘텐츠 링크 모음 (Code.org, 엔트리 등).
*   **구성**: 카드 그리드 (이미지 + 제목 + 설명).
*   **동작**: 클릭 시 새 탭으로 외부 링크 이동.

#### (2) 커뮤니티 (Community)
*   **목적**: 유저 간 자유 소통.
*   **구성**: 게시글 리스트 (최신순).
*   **동작**:
    *   글쓰기: 로그인 유저만 가능 (Modal).
    *   읽기: 누구나 가능.

#### (3) 유튜브로 배우자 (YouTube)
*   **목적**: 코딩 교육 영상 큐레이션.
*   **구성**: 영상 썸네일 그리드.
*   **동작**: 클릭 시 유튜브 영상 재생 (Modal or New Tab).

#### (4) 포트폴리오 (Portfolio)
*   **목적**: 유료 회원(`app.*`)의 우수 작품 전시.
*   **구성**: 갤러리 뷰 (작품 썸네일 + 제작자).
*   **데이터**: `app.codingnplay` DB의 `portfolio` 타입 게시글 연동.


---

## 4. 데이터 구조 (Board Post)

| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | Integer | 게시글 고유 ID |
| `title` | String | 제목 |
| `content` | Text | 내용 (HTML/Markdown) |
| `author` | String | 작성자 닉네임 |
| `author_type` | Enum | `PAID` (유료회원), `PONG2` (무료회원) |
| `is_public` | Boolean | 공개 여부 (1=공개, 0=비공개) |
| `views` | Integer | 조회수 |
| `created` | Datetime | 작성일 |

---

## 5. 배포 프로세스
1.  **Frontend**: Git Push (`pong` 리포지토리) → Netlify 자동 빌드.
2.  **Backend**: `server.js` 및 `routes/api/pong2Router.js` 업데이트 후 `pm2 restart`.
3.  **Database**: `scripts/migrate_pong2_db.js` 1회 실행 (스키마 변경).
