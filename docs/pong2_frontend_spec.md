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

#### (5) 프로젝트 링크 추가 (Project Submission) 🆕
*   **목적**: 특정 카테고리에서 학생들이 자신의 프로젝트 링크를 직접 등록.
*   **대상 카테고리**: 아케이드, 메타버스, HTML바이브코딩.
*   **UI 구성**:
    *   원형 Floating 버튼 (우측 하단 고정, 보라색 그라데이션).
    *   로그인한 사용자만 표시.
    *   호버 시 확대 + 90도 회전 애니메이션.
*   **입력 모달**:
    *   콘텐츠명 (필수).
    *   한줄요약 (필수).
    *   프로젝트 링크 (필수, URL 형식).
    *   태그 (선택, 쉼표 구분).
*   **동작 흐름**:
    1. 학생이 프로젝트 정보 입력.
    2. API 호출 (`POST /api/pong2/sheets/add-project`).
    3. 백엔드에서 썸네일 자동 추출 (Open Graph + 플랫폼별 API).
    4. 구글 시트 `pong!`에 데이터 추가.
    5. 성공 시 카드 목록 자동 새로고침.
*   **썸네일 추출 지원 플랫폼**:
    *   YouTube: `https://img.youtube.com/vi/{VIDEO_ID}/sddefault.jpg`
    *   Scratch: `https://cdn2.scratch.mit.edu/get_image/project/{PROJECT_ID}_480x360.png`
    *   Entry: `https://playentry.org/uploads/{PROJECT_ID}.thumb.png`
    *   기타: Open Graph 메타 태그 (`og:image`).
*   **구글 시트 스키마** (`pong!` 시트):
    | 컬럼 | 필드명 | 설명 |
    |------|--------|------|
    | A | category | 카테고리 (예: 아케이드) |
    | B | title | 콘텐츠명 |
    | C | description | 한줄요약 |
    | D | url | 프로젝트 URL |
    | E | thumbnailUrl | 썸네일 이미지 URL |
    | F | tags | 태그 (쉼표 구분) |

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

## 5. 백엔드 API 명세 (Backend API Spec)

### 5.1 기존 API

| 엔드포인트 | 메소드 | 설명 | 인증 |
| :--- | :--- | :--- | :--- |
| `/auth/login` | POST | Pong2 로컬 로그인 (JWT 발급) | 불필요 |
| `/auth/signup` | POST | Pong2 회원가입 | 불필요 |
| `/auth/me` | GET | 현재 사용자 정보 조회 | 필수 (JWT) |
| `/boards` | GET | 게시글 목록 조회 | 선택 |
| `/boards/:id` | GET | 게시글 상세 조회 | 선택 |
| `/boards` | POST | 게시글 작성 | 필수 (JWT/Session) |

### 5.2 프로젝트 링크 추가 API 🆕

**엔드포인트**: `POST /api/pong2/sheets/add-project`

**요청 헤더**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**요청 바디**:
```json
{
  "category": "아케이드",
  "title": "나의 게임 프로젝트",
  "description": "재미있는 게임입니다",
  "url": "https://studio.code.org/projects/...",
  "tags": "게임, 액션"
}
```

**응답 (성공)**:
```json
{
  "success": true,
  "message": "프로젝트가 성공적으로 추가되었습니다.",
  "thumbnailUrl": "https://...",
  "updatedRange": "pong!!A123"
}
```

**응답 (실패)**:
```json
{
  "success": false,
  "error": "Failed to add project",
  "message": "..."
}
```

**처리 흐름**:
1. JWT 토큰 검증 (`requireDbUser` 미들웨어).
2. 입력 검증 (category, title, url 필수).
3. 썸네일 자동 추출:
   - 플랫폼별 패턴 확인 (YouTube, Scratch, Entry).
   - Open Graph 메타 태그 추출 (`og:image`).
   - 실패 시 기본 이미지 사용.
4. 구글 시트 `pong!`에 데이터 추가 (`appendSheetData`).
5. 성공 응답 반환.

**에러 처리**:
- 썸네일 추출 실패 → 기본 이미지 사용 (에러 무시).
- 구글 시트 추가 실패 → 500 에러 반환.
- 인증 실패 → 401 에러 반환.

---

## 6. 백엔드 구현 세부 사항

### 6.1 프로젝트 구조 (educosmo/)

```
educosmo/
├── lib_pong/
│   └── thumbnailExtractor.js     # 썸네일 자동 추출 유틸리티
├── lib_google/
│   └── sheetService.js            # 구글 시트 연동 (appendSheetData 추가)
├── routes/api/
│   └── pong2Router.js             # Pong2 API 라우터 (add-project 엔드포인트)
└── config.js                      # 구글 시트 설정
```

### 6.2 썸네일 추출 로직 (`thumbnailExtractor.js`)

**방법 A: Open Graph 메타 태그 추출**
```javascript
// HTML에서 og:image 추출
const ogImagePattern = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
```

**방법 C: 플랫폼별 API 패턴**
| 플랫폼 | URL 패턴 | 썸네일 URL |
|--------|----------|------------|
| YouTube | `youtube.com/watch?v={ID}` | `img.youtube.com/vi/{ID}/sddefault.jpg` |
| Scratch | `scratch.mit.edu/projects/{ID}` | `cdn2.scratch.mit.edu/get_image/project/{ID}_480x360.png` |
| Entry | `playentry.org/project/{ID}` | `playentry.org/uploads/{ID}.thumb.png` |

**우선순위**:
1. 플랫폼별 패턴 확인 (빠르고 정확).
2. Open Graph 메타 태그 추출 (범용).
3. 실패 시 기본 이미지 반환.

### 6.3 구글 시트 연동 (`sheetService.js`)

**신규 함수**: `appendSheetData(range, values, customSpreadsheetId)`

```javascript
// 사용 예시
const rowData = [
  ['아케이드', '게임 제목', '설명', 'https://...', 'https://...thumb.jpg', '게임, 액션']
];
await appendSheetData('pong!!A:F', rowData);
```

**Google Sheets API v4 사용**:
- `valueInputOption`: `RAW` (수식 해석 안함).
- `insertDataOption`: `INSERT_ROWS` (새 행으로 추가).

### 6.4 API 엔드포인트 구현 (`pong2Router.js`)

**라우터 등록**: `router.post('/sheets/add-project', requireDbUser, ...)`

**주요 처리 로직**:
1. 입력 검증 (category, title, url 필수).
2. 썸네일 추출 (try-catch로 에러 무시).
3. 구글 시트에 데이터 추가.
4. JSON 응답 반환 (`Content-Type: application/json` 명시).

**에러 핸들링**:
- 썸네일 추출 실패 → 기본 이미지 사용.
- 구글 시트 추가 실패 → 500 에러.
- 인증 실패 → 401 에러.

---

## 7. 프론트엔드 구현 세부 사항

### 7.1 프로젝트 구조 (pong2/)

```
pong2/
├── js/managers/
│   └── PortalManager.js           # Portal 페이지 관리 (버튼 & 모달)
├── styles.css                     # 전역 스타일 (floating 버튼)
├── auth_ui.js                     # 인증 UI 업데이트
├── api-client.js                  # API 호출 클라이언트
└── config.js                      # API 엔드포인트 설정
```

### 7.2 Floating 버튼 스타일 (`styles.css`)

```css
.portal-floating-write-btn {
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    /* 호버 시 확대 + 회전 */
}
```

### 7.3 프로젝트 입력 모달 (`PortalManager.js`)

**입력 필드**:
- 콘텐츠명 (text, required).
- 한줄요약 (text, required).
- 프로젝트 링크 (url, required).
- 태그 (text, optional, 쉼표 구분).

**제출 흐름**:
1. 폼 검증 (HTML5 validation).
2. API 호출 (`window.pong2API.addProjectToSheet()`).
3. 성공 시 모달 닫기 + 카드 목록 새로고침.
4. 실패 시 에러 메시지 표시.

### 7.4 API 클라이언트 (`api-client.js`)

**신규 메서드**: `addProjectToSheet(projectData)`

```javascript
async addProjectToSheet(projectData) {
    const response = await fetch(`${this.baseUrl}/sheets/add-project`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(projectData)
    });
    return await response.json();
}
```

---

## 8. 배포 프로세스
1.  **Frontend**: Git Push (`pong2` 리포지토리) → Netlify 자동 빌드.
2.  **Backend**: `server.js` 및 `routes/api/pong2Router.js` 업데이트 후 `pm2 restart server`.
3.  **Database**: `scripts/migrate_pong2_db.js` 1회 실행 (스키마 변경 시).

---

## 9. 테스트 체크리스트

### 9.1 기능 테스트
- [ ] 로그인 후 특정 카테고리에서 +버튼 표시 확인.
- [ ] 비로그인 시 +버튼 숨김 확인.
- [ ] +버튼 클릭 시 모달 표시 확인.
- [ ] 프로젝트 정보 입력 후 등록 성공 확인.
- [ ] 구글 시트 `pong!`에 데이터 추가 확인.
- [ ] 썸네일 자동 추출 확인 (YouTube, Scratch, Entry).
- [ ] 썸네일 추출 실패 시 기본 이미지 사용 확인.

### 9.2 에러 처리 테스트
- [ ] 필수 필드 미입력 시 에러 메시지 표시.
- [ ] URL 형식 오류 시 에러 메시지 표시.
- [ ] 인증 실패 시 401 에러 처리.
- [ ] 서버 오류 시 500 에러 처리.

### 9.3 UI/UX 테스트
- [ ] Floating 버튼 호버 애니메이션 확인.
- [ ] 모달 디자인 일관성 확인.
- [ ] 모바일 반응형 디자인 확인 (버튼 크기 50x50px).

---

## 10. 개발 히스토리

### v2.1.0 (2026-01-15) - 프로젝트 링크 추가 기능 🆕
**추가된 기능**:
- 특정 카테고리(아케이드, 메타버스, HTML바이브코딩)에 원형 +글쓰기 버튼 추가.
- 로그인한 사용자만 버튼 표시.
- 프로젝트 정보 입력 모달 구현.
- 썸네일 자동 추출 (Open Graph + 플랫폼별 API).
- 구글 시트 `pong!`에 데이터 자동 추가.

**수정된 파일**:
- Frontend: `PortalManager.js`, `styles.css`, `auth_ui.js`, `api-client.js`, `config.js`.
- Backend: `thumbnailExtractor.js` (신규), `sheetService.js`, `pong2Router.js`.

**기술 스택**:
- Frontend: Vanilla JS, Bootstrap 5, Bootstrap Icons.
- Backend: Express.js, Google Sheets API v4, axios.
- 인증: JWT (Bearer Token).
