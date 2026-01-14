# Pong2 백엔드 구현 명세서

## 1. 개요
본 문서는 Pong2 프로젝트의 백엔드 API 구현 명세서입니다. educosmo 서버에서 실행되며, pong2.app 프론트엔드와 통신합니다.

---

## 2. 시스템 아키텍처

### 2.1 서버 환경
| 구분 | 내용 |
|------|------|
| **호스팅** | AWS EC2 (Ubuntu) |
| **서버** | Node.js + Express.js |
| **프로세스 관리** | PM2 |
| **API Base URL** | `https://app.codingnplay.co.kr/api/pong2` |
| **CORS** | `pong2.app`, `www.pong2.app` 허용 |

### 2.2 데이터베이스
| 구분 | 내용 |
|------|------|
| **DB** | MySQL 8.0 |
| **테이블** | `board_posts`, `BoardComments`, `BoardReactions`, `UserActivityLogs`, `Pong2Users`, `Users` |
| **구글 시트** | `pong!` (학습 콘텐츠 링크 저장) |

---

## 3. API 라우터 구조

### 3.1 파일 위치
```
educosmo/
├── routes/api/
│   ├── pong2Router.js              # Pong2 메인 API 라우터
│   └── pong2PortfolioRouter.js     # 포트폴리오 전용 API
├── lib_login/
│   └── pong2_auth.js               # 인증 미들웨어
├── lib_pong/
│   └── thumbnailExtractor.js       # 썸네일 추출 유틸리티
└── lib_google/
    └── sheetService.js             # 구글 시트 연동
```

### 3.2 라우터 등록 (apiRouter.js)
```javascript
// 🔥 Pong2 메인 API 라우터 연결
const pong2Router = require('./api/pong2Router');
router.use('/pong2', pong2Router);

// 🔥 Pong2 포트폴리오 API 라우터 연결
const pong2PortfolioRouter = require('./api/pong2PortfolioRouter');
router.use('/pong2/portfolio', pong2PortfolioRouter);
```

---

## 4. 인증 시스템 (Hybrid Auth)

### 4.1 인증 미들웨어 (`pong2_auth.js`)

**지원하는 인증 방식**:
1. **JWT (Bearer Token)**: Pong2 전용 회원.
2. **Session Cookie**: 기존 유료 회원 (educodingnplay).

**미들웨어 함수**:
- `pong2Auth`: JWT 또는 Session 자동 감지.
- `requireAuth`: 인증 필수 (비로그인 시 401).
- `requireDbUser`: DB 유저 필수 (게스트 차단).

**사용 예시**:
```javascript
router.get('/auth/me', requireAuth, async (req, res) => {
    res.json({ user: req.user });
});

router.post('/boards', requireDbUser, async (req, res) => {
    // 게시글 작성 (로그인 필수)
});
```

### 4.2 JWT 토큰 발급
```javascript
const token = jwt.sign(
    { id: user.id, type: 'PONG2' },
    JWT.SECRET,
    { expiresIn: JWT.EXPIRES_IN }
);
```

---

## 5. API 엔드포인트 명세

### 5.1 인증 API

#### **POST /api/pong2/auth/login**
Pong2 로컬 로그인 (JWT 발급).

**요청**:
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**응답**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "nickname": "테스터"
  }
}
```

#### **POST /api/pong2/auth/signup**
Pong2 회원가입.

**요청**:
```json
{
  "email": "test@example.com",
  "password": "password123",
  "nickname": "테스터"
}
```

**응답**:
```json
{
  "success": true,
  "userId": 1
}
```

#### **GET /api/pong2/auth/me**
현재 사용자 정보 조회 (인증 필수).

**응답**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "nickname": "테스터",
    "type": "PONG2",
    "role": "student"
  }
}
```

---

### 5.2 게시판 API

#### **GET /api/pong2/boards**
게시글 목록 조회.

**쿼리 파라미터**:
- `type`: `community`, `teacher`, `portfolio`.
- `limit`: 목록 개수 (기본: 20).
- `nestId`: 카테고리 ID (community 전용).

**응답**:
```json
[
  {
    "id": 1,
    "title": "게시글 제목",
    "author": "작성자",
    "created": "2026-01-15 10:00:00",
    "views": 10,
    "author_type": "PONG2",
    "board_scope": "COMMUNITY"
  }
]
```

#### **GET /api/pong2/boards/:id**
게시글 상세 조회.

**응답**:
```json
{
  "success": true,
  "post": {
    "id": 1,
    "title": "게시글 제목",
    "content": "게시글 내용",
    "author": "작성자",
    "created": "2026-01-15 10:00:00",
    "views": 11
  },
  "comments": [],
  "reactions": { "like": 5, "heart": 2 },
  "myReactions": ["like"]
}
```

#### **POST /api/pong2/boards**
게시글 작성 (인증 필수).

**요청**:
```json
{
  "title": "게시글 제목",
  "content": "게시글 내용",
  "board_type": "COMMUNITY",
  "nest_id": 3,
  "image_url": "https://..."
}
```

**응답**:
```json
{
  "success": true,
  "postId": 1
}
```

---

### 5.3 프로젝트 링크 추가 API 🆕

#### **POST /api/pong2/sheets/add-project**
구글 시트에 프로젝트 링크 추가 (인증 필수).

**요청 헤더**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**요청 바디**:
```json
{
  "category": "아케이드",
  "title": "나의 게임",
  "description": "재미있는 게임입니다",
  "url": "https://studio.code.org/...",
  "tags": "게임, 액션"
}
```

**응답 (성공)**:
```json
{
  "success": true,
  "message": "프로젝트가 성공적으로 추가되었습니다.",
  "thumbnailUrl": "https://img.youtube.com/vi/abc123/sddefault.jpg",
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
1. JWT 토큰 검증 (`requireDbUser`).
2. 입력 검증 (category, title, url 필수).
3. 썸네일 자동 추출:
   - 플랫폼별 패턴 (YouTube, Scratch, Entry).
   - Open Graph 메타 태그 (`og:image`).
   - 실패 시 기본 이미지.
4. 구글 시트 `pong!`에 데이터 추가.
5. JSON 응답 반환.

**구글 시트 스키마** (`pong!` 시트, range: `A:F`):
| 컬럼 | 필드명 | 설명 |
|------|--------|------|
| A | category | 카테고리 |
| B | title | 콘텐츠명 |
| C | description | 한줄요약 |
| D | url | 프로젝트 URL |
| E | thumbnailUrl | 썸네일 URL |
| F | tags | 태그 (쉼표 구분) |

---

## 6. 썸네일 자동 추출 (`thumbnailExtractor.js`)

### 6.1 추출 방법

**방법 A: Open Graph 메타 태그**
```javascript
// HTML 크롤링 (axios 사용, 5초 타임아웃)
const response = await axios.get(url, { timeout: 5000 });
const html = response.data;

// og:image 패턴 매칭
const ogImagePattern = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
const match = html.match(ogImagePattern);
```

**방법 C: 플랫폼별 API 패턴**
| 플랫폼 | URL 패턴 | 썸네일 URL |
|--------|----------|------------|
| YouTube | `youtube.com/watch?v={ID}` | `https://img.youtube.com/vi/{ID}/sddefault.jpg` |
| Scratch | `scratch.mit.edu/projects/{ID}` | `https://cdn2.scratch.mit.edu/get_image/project/{ID}_480x360.png` |
| Entry | `playentry.org/project/{ID}` | `https://playentry.org/uploads/{ID}.thumb.png` |

### 6.2 추출 우선순위
1. **플랫폼별 패턴** (빠르고 정확).
2. **Open Graph** (범용).
3. **기본 이미지** (실패 시).

### 6.3 코드 예시
```javascript
const { extractThumbnail } = require('../../lib_pong/thumbnailExtractor');

let thumbnailUrl = await extractThumbnail(url);
if (!thumbnailUrl) {
    thumbnailUrl = 'https://kr.object.ncloudstorage.com/educodingnplaycontents/thumbs/default.png';
}
```

---

## 7. 구글 시트 연동 (`sheetService.js`)

### 7.1 기존 함수

**`getSheetData(range, customSpreadsheetId)`**
구글 시트에서 데이터 조회.

```javascript
const data = await getSheetData('pong!!A2:F');
// [[카테고리, 제목, 설명, URL, 썸네일, 태그], ...]
```

### 7.2 신규 함수 🆕

**`appendSheetData(range, values, customSpreadsheetId)`**
구글 시트에 데이터 추가.

```javascript
const rowData = [
    ['아케이드', '게임 제목', '설명', 'https://...', 'https://...thumb.jpg', '게임, 액션']
];
await appendSheetData('pong!!A:F', rowData);
```

**Google Sheets API v4 옵션**:
- `valueInputOption`: `RAW` (수식 해석 안함).
- `insertDataOption`: `INSERT_ROWS` (새 행으로 추가).

**응답**:
```javascript
{
    success: true,
    updatedRange: 'pong!!A123',
    updatedRows: 1
}
```

---

## 8. CORS 설정

### 8.1 허용 도메인 (pong2Router.js)
```javascript
const allowedOrigins = [
    'https://pong2.app',
    'https://www.pong2.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://app.codingnplay.co.kr'
];
```

### 8.2 CORS 헤더
```javascript
res.setHeader('Access-Control-Allow-Origin', origin);
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
res.setHeader('Access-Control-Allow-Credentials', 'true');
```

### 8.3 Preflight 요청 처리
```javascript
if (req.method === 'OPTIONS') {
    return res.status(200).end();
}
```

---

## 9. 에러 처리

### 9.1 JSON 응답 보장
```javascript
// 명시적으로 JSON Content-Type 설정
res.setHeader('Content-Type', 'application/json');
```

### 9.2 에러 핸들링 패턴
```javascript
try {
    // 메인 로직
} catch (error) {
    console.error('❌ Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
        success: false,
        error: 'Failed to process',
        message: error.message
    });
}
```

### 9.3 썸네일 추출 에러 무시
```javascript
try {
    const extracted = await extractThumbnail(url);
    if (extracted) thumbnailUrl = extracted;
} catch (thumbError) {
    console.error('⚠️ Thumbnail extraction failed:', thumbError.message);
    // 기본 이미지 사용 (에러 무시)
}
```

---

## 10. 로깅

### 10.1 요청 로깅
```javascript
console.log(`🔍 [Pong2] ${req.method} ${req.path}`, {
    hasSession: !!req.session?.is_logined,
    hasAuthHeader: !!req.headers.authorization,
    origin: req.headers.origin
});
```

### 10.2 성공 로깅
```javascript
console.log(`📝 [Pong2] 프로젝트 추가 요청 - User: ${userName}, Category: ${category}, Title: ${title}`);
console.log(`🖼️ Thumbnail: ${thumbnailUrl}`);
console.log(`✅ [Pong2] 프로젝트가 구글시트에 추가되었습니다.`);
```

### 10.3 에러 로깅
```javascript
console.error('❌ [Pong2] Add Project Error:', error);
console.error('Error stack:', error.stack);
```

---

## 11. 배포 및 테스트

### 11.1 배포 방법
```bash
cd educosmo
pm2 restart server
```

### 11.2 서버 로그 확인
```bash
pm2 logs server
```

### 11.3 테스트 체크리스트
- [ ] JWT 토큰 발급 테스트.
- [ ] 게시글 CRUD 테스트.
- [ ] 프로젝트 추가 API 테스트.
- [ ] 썸네일 추출 테스트 (YouTube, Scratch, Entry).
- [ ] Open Graph 추출 테스트.
- [ ] 구글 시트 데이터 추가 확인.
- [ ] CORS 헤더 확인.
- [ ] 에러 응답 형식 확인.

---

## 12. 개발 히스토리

### v2.1.0 (2026-01-15) - 프로젝트 링크 추가 기능 🆕
**추가된 기능**:
- 프로젝트 링크 추가 API (`POST /sheets/add-project`).
- 썸네일 자동 추출 (Open Graph + 플랫폼별 API).
- 구글 시트 연동 (`appendSheetData`).

**신규 파일**:
- `lib_pong/thumbnailExtractor.js`: 썸네일 추출 유틸리티.

**수정된 파일**:
- `lib_google/sheetService.js`: `appendSheetData` 함수 추가.
- `routes/api/pong2Router.js`: `/sheets/add-project` 엔드포인트 추가.

**의존성**:
- `axios`: HTTP 요청 (썸네일 추출용).
- `googleapis`: Google Sheets API v4.

---

## 13. 트러블슈팅

### 13.1 "Unexpected token '<'" 에러
**증상**: 프론트엔드에서 JSON 파싱 실패, HTML 응답 수신.

**원인**: 서버가 HTML을 반환 (에러 페이지 또는 리다이렉트).

**해결**:
```javascript
res.setHeader('Content-Type', 'application/json');
return res.json({ ... });
```

### 13.2 썸네일이 기본 이미지로 나옴
**원인**: URL에서 썸네일 추출 실패.

**확인**: 서버 로그에서 `⚠️ No thumbnail found` 확인.

**해결**: 해당 플랫폼의 URL 패턴을 `thumbnailExtractor.js`에 추가.

### 13.3 구글 시트 추가 실패
**원인**: 시트 ID 또는 범위 오류.

**확인**:
- `config.js`의 `GOOGLE_API.SPREADSHEET_ID`.
- 시트 이름이 `pong!` (느낌표 포함)인지 확인.

**해결**: 구글 클라우드 콘솔에서 API 키 활성화 상태 확인.

---

**문서 작성일**: 2026-01-15
**버전**: v2.1.0
**작성자**: Claude AI Assistant
