# 스크래치 저장/불러오기/세션관리 시스템 명세서

> **작성일**: 2024-12-24  
> **버전**: 1.0  
> **작성자**: Claude AI Assistant

---

## 📋 개요

스크래치(Scratch) 프로젝트의 저장, 불러오기, 세션 관리 시스템에 대한 기술 명세서입니다.
educodingnplay 메인 서버(3000번 포트)와 scratch-gui(8601번 포트)가 연동되어 동작합니다.

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Apache Proxy (:80)                           │
├─────────────────────────────────────────────────────────────────────┤
│  /scratch/*  →  localhost:8601 (scratch-gui)                        │
│  /api/scratch/*  →  localhost:3000 (educodingnplay)                 │
│  /*  →  localhost:3000 (educodingnplay)                             │
└─────────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐    ┌─────────────────────────────────────────┐
│   scratch-gui       │    │        educodingnplay (Express)         │
│   (React + Redux)   │    │                                         │
│   Port: 8601        │    │   Port: 3000                            │
├─────────────────────┤    ├─────────────────────────────────────────┤
│ • app-state-hoc.jsx │───▶│ • scratchRouter.js                      │
│ • save-project-to-  │    │   - /api/scratch/auth/session           │
│   server.js         │    │   - /api/scratch/projects               │
│ • session.js        │    │   - /api/scratch/save-project           │
│   (Redux reducer)   │    │   - /api/scratch/project/:fileId        │
└─────────────────────┘    └─────────────────────────────────────────┘
                                         │
                                         ▼
                           ┌─────────────────────────┐
                           │      AWS S3 Storage     │
                           │  scratch/projects/      │
                           │  scratch/thumbnails/    │
                           └─────────────────────────┘
```

---

## 📁 관련 파일 구조

### 서버 측 (educodingnplay)

```
educodingnplay/
├── server.js                              # 라우터 마운트
├── routes/
│   └── api/
│       └── scratchRouter.js               # 스크래치 API 엔드포인트
├── lib_storage/
│   └── quotaChecker.js                    # 용량 관리 모듈
├── public/
│   └── js/
│       └── components/
│           └── storage/
│               └── ProjectStorageModal.js # 불러오기 모달 컴포넌트
└── views/
    └── scratch_project.ejs                # 스크래치 프로젝트 목록 페이지
```

### 클라이언트 측 (scratch-gui)

```
scratch-gui/
└── src/
    ├── lib/
    │   ├── app-state-hoc.jsx              # 세션 초기화 (Redux Store)
    │   └── save-project-to-server.js      # 프로젝트 저장 API 호출
    ├── reducers/
    │   └── session.js                     # 세션 상태 관리 (Redux)
    └── containers/
        └── my-projects-modal.jsx          # 내 프로젝트 모달 (선택)
```

---

## 🔌 API 엔드포인트 명세

### 기본 정보

| 항목 | 값 |
|------|-----|
| Base URL | `/api/scratch` |
| 인증 방식 | 세션 쿠키 (`credentials: 'include'`) |
| 마운트 위치 | `server.js` → `app.use('/api/scratch', scratchRouter)` |

---

### 1. 세션 정보 조회

```
GET /api/scratch/auth/session
```

**인증**: 불필요 (세션 존재 여부 확인용)

**응답 (로그인 상태)**:
```json
{
  "loggedIn": true,
  "user": {
    "id": 123,
    "userID": "student01",
    "name": "홍길동",
    "role": "student",
    "centerID": 11,
    "profileImage": "/resource/profiles/default.webp"
  }
}
```

**응답 (비로그인 상태)**:
```json
{
  "loggedIn": false,
  "user": null
}
```

---

### 2. 프로젝트 목록 조회

```
GET /api/scratch/projects
```

**인증**: 필수 (requireAuth 미들웨어)

**쿼리 파라미터**:
| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| page | number | 1 | 페이지 번호 |
| limit | number | 20 | 페이지당 항목 수 |

**응답**:
```json
{
  "success": true,
  "projects": [
    {
      "fileId": 45,
      "title": "내 첫 게임",
      "s3Key": "scratch/projects/student01/1703123456_abc123.sb3",
      "size": 524288,
      "url": "https://bucket.s3.region.amazonaws.com/...",
      "thumbnailUrl": "https://bucket.s3.region.amazonaws.com/.../thumb.png",
      "createdAt": "2024-12-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 3. 새 프로젝트 저장

```
POST /api/scratch/save-project
```

**인증**: 필수

**요청 본문**:
```json
{
  "projectData": "UEsDBBQAAAAI...",  // Base64 인코딩된 .sb3 파일
  "title": "내 프로젝트",
  "thumbnail": "data:image/png;base64,iVBORw0KGgo..."  // (선택) 썸네일
}
```

**응답**:
```json
{
  "success": true,
  "projectId": "1703123456_abc123",
  "fileId": 46,
  "thumbnailUrl": "https://bucket.s3.../scratch/thumbnails/.../thumb.png",
  "message": "프로젝트가 저장되었습니다."
}
```

**에러 응답 (용량 초과)**:
```json
{
  "success": false,
  "message": "저장 공간이 부족합니다. 현재 사용량: 450MB / 500MB"
}
```
HTTP Status: `413 Payload Too Large`

---

### 4. 프로젝트 업데이트 (덮어쓰기)

```
PUT /api/scratch/save-project/:fileId
```

**인증**: 필수

**경로 파라미터**:
| 파라미터 | 설명 |
|----------|------|
| fileId | UserFiles 테이블의 id |

**요청 본문**: POST와 동일

**응답**:
```json
{
  "success": true,
  "fileId": 46,
  "thumbnailUrl": "https://bucket.s3.../...",
  "message": "프로젝트가 업데이트되었습니다."
}
```

---

### 5. 프로젝트 불러오기

```
GET /api/scratch/project/:fileId
```

**인증**: 필수

**응답**:
```json
{
  "success": true,
  "project": {
    "fileId": 46,
    "title": "내 프로젝트",
    "size": 524288,
    "createdAt": "2024-12-20T10:30:00.000Z"
  },
  "url": "https://bucket.s3.../signed-url?..."  // Presigned URL (1시간 유효)
}
```

---

### 6. 프로젝트 삭제

```
DELETE /api/scratch/project/:fileId
```

**인증**: 필수

**응답**:
```json
{
  "success": true,
  "message": "프로젝트가 삭제되었습니다."
}
```

---

### 7. 템플릿 불러오기 (교육용)

```
GET /api/scratch/template/:templateId
```

**인증**: 불필요 (공개 템플릿)

**응답**:
```json
{
  "success": true,
  "templateId": "maze-game",
  "url": "https://bucket.s3.../scratch/templates/maze-game.sb3?..."
}
```

---

## 🗄️ 데이터베이스 테이블

### UserFiles 테이블 (스크래치 프로젝트 저장)

```sql
CREATE TABLE UserFiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                    -- Users.id 참조
    center_id INT,                           -- 센터 ID
    file_category ENUM('entry','scratch','python','appinventor','gallery','board'),
    original_name VARCHAR(255),              -- 원본 파일명 (프로젝트 제목.sb3)
    stored_name VARCHAR(500),                -- S3 키
    file_size BIGINT,                        -- 파일 크기 (bytes)
    file_type VARCHAR(100),                  -- MIME 타입
    s3_url VARCHAR(500),                     -- S3 URL
    thumbnail_url VARCHAR(500),              -- 썸네일 URL
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_user_category (user_id, file_category),
    INDEX idx_center (center_id)
);
```

### S3 저장 경로 규칙

| 유형 | 경로 패턴 |
|------|-----------|
| 프로젝트 파일 | `scratch/projects/{userID}/{projectId}.sb3` |
| 썸네일 이미지 | `scratch/thumbnails/{userID}/{projectId}.png` |
| 템플릿 파일 | `scratch/templates/{templateId}.sb3` |

---

## 🔧 주요 메서드 상세

### 서버 측 (scratchRouter.js)

#### `requireAuth` 미들웨어
```javascript
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.is_logined) {
        return res.status(401).json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }
    next();
};
```

#### `getUserDbId(userID)` - 사용자 DB ID 조회
```javascript
async function getUserDbId(userID) {
    const [user] = await db.queryDatabase(
        'SELECT id, centerID FROM Users WHERE userID = ?',
        [userID]
    );
    return user;
}
```

#### 용량 관리 함수 (quotaChecker.js)
| 함수 | 설명 |
|------|------|
| `canUpload(userId, centerId, fileSize)` | 업로드 가능 여부 확인 |
| `increaseUsage(userId, centerId, size, category)` | 사용량 증가 |
| `decreaseUsage(userId, centerId, size, category)` | 사용량 감소 |
| `recordFile(userId, centerId, fileInfo)` | UserFiles 테이블에 기록 |
| `markFileDeleted(fileId)` | 파일 삭제 표시 |

---

### 클라이언트 측 (scratch-gui)

#### `app-state-hoc.jsx` - 세션 초기화

```javascript
// 컴포넌트 마운트 시 세션 정보 가져오기
componentDidMount() {
    if (!this.localesOnly) {
        this.fetchSessionFromServer();
    }
}

fetchSessionFromServer() {
    const {setSession} = require('../reducers/session');
    
    fetch('/api/scratch/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.loggedIn && data.user) {
            this.store.dispatch(setSession(
                {
                    username: data.user.userID,
                    id: data.user.id,
                    thumbnailUrl: data.user.profileImage,
                    classroomId: data.user.centerID
                },
                {
                    educator: ['teacher', 'admin', 'manager'].includes(data.user.role),
                    student: data.user.role === 'student'
                }
            ));
        }
    });
}
```

#### `save-project-to-server.js` - 프로젝트 저장

```javascript
export default function saveProject(projectId, vmState, params) {
    const creatingProject = projectId === null || typeof projectId === 'undefined';
    
    const requestBody = {
        projectData: vmState,          // Base64 인코딩된 프로젝트 데이터
        title: params.title || 'Untitled',
        thumbnail: params.thumbnailBase64 || null
    };

    const url = creatingProject 
        ? '/api/scratch/save-project'
        : `/api/scratch/save-project/${projectId}`;
    
    const method = creatingProject ? 'POST' : 'PUT';

    return fetch(url, {
        method: method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) throw new Error(data.message);
        return {
            id: data.projectId,
            'content-name': data.projectId,
            thumbnailUrl: data.thumbnailUrl
        };
    });
}
```

#### `session.js` - Redux 세션 리듀서

```javascript
// Action Types
const SET_SESSION = 'scratch-gui/session/SET_SESSION';
const CLEAR_SESSION = 'scratch-gui/session/CLEAR_SESSION';
const SET_SESSION_ERROR = 'scratch-gui/session/SET_SESSION_ERROR';

// Initial State
const sessionInitialState = {
    session: { user: null },
    permissions: { educator: false, student: false },
    status: 'NOT_FETCHED',
    error: null
};

// Action Creators
const setSession = (user, permissions) => ({
    type: SET_SESSION,
    user: user,
    permissions: permissions
});

const clearSession = () => ({ type: CLEAR_SESSION });

const setSessionError = (error) => ({
    type: SET_SESSION_ERROR,
    error: error
});
```

---

### ProjectStorageModal.js - 불러오기 모달

#### 플랫폼별 API 엔드포인트 설정

```javascript
_getApiEndpoints() {
    // Entry는 별도 라우터 사용
    if (this.platform === 'entry') {
        return {
            list: '/entry/api/user-projects',
            save: '/entry/api/save-project',
            load: (fileId) => `/entry/api/project/${fileId}`,
            delete: (fileId) => `/entry/api/project/${fileId}`
        };
    }
    
    // Scratch 및 기타 플랫폼
    const baseMap = {
        scratch: '/api/scratch',
        python: '/api/python-storage',
        appinventor: '/api/appinventor-storage'
    };
    
    const base = baseMap[this.platform];
    
    return {
        list: `${base}/projects`,
        save: `${base}/save-project`,
        load: (fileId) => `${base}/project/${fileId}`,
        delete: (fileId) => `${base}/project/${fileId}`
    };
}
```

#### 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `init()` | 모달 DOM 생성 및 이벤트 바인딩 |
| `openLoadModal()` | 불러오기 모달 열기 |
| `openSaveModal(projectData, thumbnail)` | 저장 모달 열기 |
| `_loadProjects()` | 프로젝트 목록 API 호출 |
| `_renderProjects()` | 프로젝트 카드 렌더링 |
| `_selectProject(fileId)` | 프로젝트 선택 |
| `_loadProject()` | 선택된 프로젝트 불러오기 |
| `_saveProject()` | 프로젝트 저장 |
| `_handleDelete()` | 프로젝트 삭제 |
| `setCurrentProject(fileId, title)` | 현재 프로젝트 정보 설정 (덮어쓰기용) |

---

## 🔄 데이터 흐름

### 1. 세션 초기화 흐름

```
[scratch-gui 로드]
    │
    ▼
app-state-hoc.jsx::componentDidMount()
    │
    ▼
fetchSessionFromServer()
    │
    ▼
GET /api/scratch/auth/session
    │
    ▼
scratchRouter.js::'/auth/session'
    │
    ▼
req.session 확인
    │
    ▼
응답: { loggedIn, user }
    │
    ▼
Redux dispatch(setSession())
    │
    ▼
session.js reducer 상태 업데이트
    │
    ▼
컴포넌트에서 useSelector로 사용
```

### 2. 프로젝트 저장 흐름

```
[사용자: 저장 버튼 클릭]
    │
    ▼
vm.saveProjectSb3() → ArrayBuffer
    │
    ▼
ArrayBuffer → Base64 변환
    │
    ▼
save-project-to-server.js
    │
    ▼
POST /api/scratch/save-project
    │
    ▼
scratchRouter.js
    │
    ├── 1. getUserDbId(userID)
    ├── 2. canUpload() 용량 체크
    ├── 3. S3 업로드 (프로젝트 + 썸네일)
    ├── 4. increaseUsage() 용량 증가
    └── 5. recordFile() DB 기록
    │
    ▼
응답: { success, projectId, fileId }
    │
    ▼
UI 업데이트 (저장 완료 표시)
```

### 3. 프로젝트 불러오기 흐름

```
[사용자: scratch_project.ejs에서 불러오기 클릭]
    │
    ▼
openScratchProjectLoadModal()
    │
    ▼
new ProjectStorageModal({ platform: 'scratch' })
    │
    ▼
modal.openLoadModal()
    │
    ▼
GET /api/scratch/projects (목록 조회)
    │
    ▼
프로젝트 카드 렌더링
    │
    ▼
[사용자: 프로젝트 선택]
    │
    ▼
[사용자: 불러오기 버튼 클릭]
    │
    ▼
GET /api/scratch/project/:fileId
    │
    ▼
Presigned URL 반환
    │
    ▼
onLoad 콜백 실행
    │
    ▼
window.open('/scratch?projectId={fileId}')
    │
    ▼
[scratch-gui에서 프로젝트 로드]
```

---

## ⚙️ 서버 설정

### server.js 라우터 마운트

```javascript
// 🔥 스크래치 API 라우터 (8601 스크래치 GUI 계정 연동용)
if (isMain || SERVICE_TYPE === 'scratch') {
  app.use('/api/scratch', require('./routes/api/scratchRouter'));
}
```

### Apache 프록시 설정 (참고)

```apache
# Scratch 서버 설정 (8601 포트)
ProxyPass /scratch/ http://localhost:8601/
ProxyPassReverse /scratch/ http://localhost:8601/

# 메인 서버 (3000 포트) - API 포함
ProxyPass / http://localhost:3000/
ProxyPassReverse / http://localhost:3000/
```

---

## 🔐 인증 및 보안

### 세션 기반 인증

- 모든 API 요청에 `credentials: 'include'` 사용
- Express 세션이 Redis에 저장됨
- 세션 쿠키: `connect.sid`

### 권한 체크

| 역할 | 권한 |
|------|------|
| student | 본인 프로젝트만 접근 |
| teacher | 본인 프로젝트 + 같은 센터 학생 열람 (구현 예정) |
| admin | 전체 접근 |

### 소유권 검증

```javascript
// 파일 조회 시 소유권 확인
const [file] = await db.queryDatabase(
    'SELECT * FROM UserFiles WHERE id = ? AND user_id = ? AND file_category = ? AND is_deleted = FALSE',
    [fileId, user.id, 'scratch']
);

if (!file) {
    return res.status(404).json({
        success: false,
        message: '프로젝트를 찾을 수 없거나 권한이 없습니다.'
    });
}
```

---

## 📊 용량 관리

### 플랜별 제한

| 플랜 | 사용자당 용량 | 센터당 용량 |
|------|---------------|-------------|
| Free | 500 MB | 10 GB |
| Basic | 2 GB | 50 GB |
| Pro | 5 GB | 200 GB |
| Enterprise | 무제한 | 1 TB |

### 용량 체크 로직

```javascript
// 업로드 전 용량 체크
const quotaCheck = await canUpload(user.id, user.centerID, fileSize);
if (!quotaCheck.allowed) {
    return res.status(413).json({
        success: false,
        message: quotaCheck.message
    });
}

// 저장 후 용량 증가
await increaseUsage(user.id, user.centerID, fileSize, 'scratch');

// 삭제 후 용량 감소
await decreaseUsage(user.id, user.centerID, file.file_size, 'scratch');
```

---

## 🐛 트러블슈팅

### 1. 세션 정보가 안 불러와짐

**원인**: API 경로 불일치
- scratch-gui: `/api/auth/session` 호출
- server.js: `/api/scratch` 마운트

**해결**: `app-state-hoc.jsx`에서 `/api/scratch/auth/session`으로 수정

### 2. CORS 오류

**원인**: 크로스 도메인 요청 시 쿠키 전달 안됨

**해결**: 
```javascript
fetch(url, {
    credentials: 'include',  // 필수
    // ...
});
```

### 3. 저장 후 목록에 안 보임

**원인**: UserFiles 테이블에 file_category가 잘못 저장됨

**확인**: 
```sql
SELECT * FROM UserFiles WHERE user_id = ? AND file_category = 'scratch';
```

### 4. 프로젝트 로드 실패

**원인**: Presigned URL 만료 (1시간)

**해결**: 불러오기 시점에 새 Presigned URL 발급

---

## 📝 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2024-12-24 | 1.0 | 최초 작성 |

---

## 🔗 관련 문서

- [S3_스토리지_API_명세서.txt](./S3_스토리지_API_명세서.txt)
- [플랫폼_통합저장소_정책명세서.md](./플랫폼_통합저장소_정책명세서.md)
- [entryjs 저장불러오기_통합시스템_명세서.md](./entryjs%20저장불러오기_통합시스템_명세서.md)
