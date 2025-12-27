# 라우터 및 API 구현 정책 v1.0

> **작성일**: 2025-12-27  
> **목적**: educodingnplay 프로젝트의 라우터/API 구조 통일성 확보  
> **적용 대상**: Entry, Scratch, AppInventor, Python 등 모든 플랫폼

---

## 📋 목차
1. [설계 원칙](#1-설계-원칙)
2. [라우터 구조](#2-라우터-구조)
3. [API 경로 규칙](#3-api-경로-규칙)
4. [병렬 저장 모델](#4-병렬-저장-모델)
5. [S3 경로 규칙](#5-s3-경로-규칙)
6. [구현 체크리스트](#6-구현-체크리스트)

---

## 1. 설계 원칙

### 1.1 역할 분리 원칙 (Separation of Concerns)

```
┌─────────────────────────────────────────────────────────────┐
│                    라우터 역할 분리                          │
├─────────────────────────────────────────────────────────────┤
│  📄 페이지 라우터        │  🔌 API 라우터                    │
│  (routes/*.js)          │  (routes/api/*.js)               │
├─────────────────────────┼───────────────────────────────────┤
│  • 페이지 렌더링        │  • 데이터 CRUD                    │
│  • 리다이렉트           │  • 파일 업로드/다운로드            │
│  • 인증 체크            │  • 용량 관리 (quotaChecker)       │
│  • 세션 관리            │  • 병렬 저장 (parallelSave)       │
└─────────────────────────┴───────────────────────────────────┘
```

### 1.2 통일성 원칙

| 원칙 | 설명 |
|------|------|
| **경로 일관성** | 모든 플랫폼은 동일한 API 경로 패턴 사용 |
| **코드 재사용** | 공통 로직은 lib 모듈로 분리 |
| **병렬 저장** | 모든 파일 저장은 UserFiles + ProjectSubmissions 동시 기록 |

### 1.3 현재 구조 (레거시 호환)

> ⚠️ **참고**: 현재 entryRouter.js에 저장 API가 직접 구현되어 있음.  
> 향후 리팩토링 시 entryStorageRouter.js로 분리 예정.

현재는 **플랫폼별 자체 API 경로**를 유지:
- Entry: `/entry/api/...` (entryRouter.js 내부)
- Scratch: `/api/scratch/...` (scratchStorageRouter.js)

---

## 2. 라우터 구조

### 2.1 현재 디렉토리 구조

```
routes/
├── entryRouter.js           → GET /entry, /entry_editor (페이지)
│                            → POST/PUT/DELETE /entry/api/... (저장 API 포함)
├── scratchRouter.js         → GET /scratch, /scratch_project (페이지)
├── appinventorRouter.js     → GET /appinventor, /appinventor_project (페이지)
├── pythonRouter.js          → GET /python, /python_project (페이지)
│
└── api/
    ├── entryStorageRouter.js    → /api/entry-storage/... (향후 이전 대상)
    ├── scratchStorageRouter.js  → /api/scratch/... (Scratch API)
    ├── storageRouter.js         → /api/storage/... (공통 용량 조회)
    └── apiRouter.js             → 모든 API 라우터 통합 등록
```

### 2.2 목표 구조 (향후 리팩토링)

```
routes/
├── entryRouter.js           → 페이지 라우팅만
├── scratchRouter.js         → 페이지 라우팅만
│
└── api/
    ├── entryStorageRouter.js    → /api/entry-storage/... (모든 Entry API)
    ├── scratchStorageRouter.js  → /api/scratch/... (모든 Scratch API)
    └── storageRouter.js         → /api/storage/... (공통)
```

---

## 3. API 경로 규칙

### 3.1 플랫폼별 API 경로 (현재)

| 플랫폼 | API 베이스 | 저장 엔드포인트 | 담당 파일 |
|--------|-----------|-----------------|-----------|
| **Entry** | `/entry/api` | `POST /entry/api/save-project` | entryRouter.js |
|           |              | `PUT /entry/api/save-project/:fileId` | entryRouter.js |
|           |              | `DELETE /entry/api/project/:projectId` | entryRouter.js |
| **Scratch** | `/api/scratch` | `POST /api/scratch/projects/save` | scratchStorageRouter.js |
|             |                | `PUT /api/scratch/projects/:projectId` | scratchStorageRouter.js |
|             |                | `DELETE /api/scratch/projects/:projectId` | scratchStorageRouter.js |

### 3.2 표준 응답 형식

```javascript
// 성공 응답
{
  success: true,
  message: "저장 완료",
  data: {
    fileId: 123,
    s3Url: "https://...",
    projectId: 456
  }
}

// 실패 응답
{
  success: false,
  error: "용량 초과",
  code: "QUOTA_EXCEEDED"
}
```

### 3.3 에러 코드 표준

| 코드 | HTTP | 설명 |
|------|------|------|
| `QUOTA_EXCEEDED` | 413 | 스토리지 용량 초과 |
| `NOT_FOUND` | 404 | 파일/프로젝트 없음 |
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `INVALID_DATA` | 400 | 잘못된 요청 데이터 |

---

## 4. 병렬 저장 모델

### 4.1 아키텍처

```
저장 요청 → S3 업로드 → 동시에 2개 테이블 기록
                    ↓
              ┌─────┴─────┐
              ↓           ↓
         UserFiles    ProjectSubmissions
         (용량관리)    (학습평가/갤러리)
```

### 4.2 테이블 역할

| 테이블 | 역할 | 연동 시스템 |
|--------|------|------------|
| **UserFiles** | 스토리지 용량 관리 | quotaChecker |
| **ProjectSubmissions** | 학습 평가, 진도관리, 갤러리 공유 | CT 분석, LMS |

### 4.3 필수 연동 모듈

```javascript
// 저장 API에서 반드시 사용해야 하는 모듈
const quotaChecker = require('../lib_storage/quotaChecker');
const { saveWithParallelRecord } = require('../lib_storage/parallelSave');

// 저장 흐름
1. quotaChecker.canUpload() → 용량 체크
2. S3 업로드
3. saveWithParallelRecord() → UserFiles + ProjectSubmissions 동시 기록
4. quotaChecker.increaseUsage() → 용량 업데이트
```

---

## 5. S3 경로 규칙

### 5.1 표준 경로 형식

```
users/{userID}/{platform}/{saveType}/{fileName}
```

### 5.2 플랫폼별 예시

| 플랫폼 | S3 경로 예시 |
|--------|-------------|
| Entry | `users/123/entry/projects/my_game.ent` |
| Scratch | `users/123/scratch/projects/animation.sb3` |
| AppInventor | `users/123/appinventor/projects/myapp.aia` |
| Python | `users/123/python/projects/calculator.py` |

### 5.3 저장 타입 (saveType)

| 타입 | 용도 |
|------|------|
| `projects` | 완성된 프로젝트 파일 |
| `drafts` | 임시 저장 |
| `thumbnails` | 썸네일 이미지 |
| `assets` | 프로젝트 내 리소스 |

---

## 6. 구현 체크리스트

### 6.1 새 플랫폼 추가 시

- [ ] `routes/{platform}Router.js` - 페이지 라우터 생성
- [ ] 저장 API 구현 (페이지 라우터 내부 또는 별도 파일)
- [ ] S3 경로 규칙 준수
- [ ] 병렬 저장 모델 적용 (UserFiles + ProjectSubmissions)
- [ ] quotaChecker 연동
- [ ] 표준 응답 형식 사용

### 6.2 API 엔드포인트 필수 항목

| 메서드 | 경로 패턴 | 기능 |
|--------|----------|------|
| `GET` | `/list` | 프로젝트 목록 조회 |
| `GET` | `/:id` | 프로젝트 상세 조회 |
| `POST` | `/save-project` | 새 프로젝트 저장 |
| `PUT` | `/save-project/:id` | 기존 프로젝트 덮어쓰기 |
| `DELETE` | `/project/:id` | 프로젝트 삭제 (soft delete) |

### 6.3 미들웨어 적용 순서

```javascript
router.post('/save-project',
  authenticateUser,              // 1. 인증
  quotaCheckMiddleware('entry'), // 2. 용량 체크 (선택)
  async (req, res) => {          // 3. 저장 처리
    // ...
  }
);
```

---

## 부록 A: Entry 저장 API 현황

### 현재 구현 상태

| 메서드 | 경로 | 파일 | 상태 |
|--------|------|------|------|
| GET | `/entry/api/projects` | entryRouter.js | ✅ 구현됨 |
| POST | `/entry/api/save-project` | entryRouter.js | ✅ 구현됨 |
| PUT | `/entry/api/save-project/:fileId` | entryRouter.js | ✅ 구현됨 |
| DELETE | `/entry/api/project/:projectId` | entryRouter.js | ✅ 구현됨 |

---

## 부록 B: 관련 문서

- `프로젝트저장정책_병렬모델_v1.0.md` - 병렬 저장 모델 상세
- `플랫폼_통합저장소_정책명세서.md` - 통합 저장소 아키텍처
- `S3_스토리지_API_명세서.txt` - S3 API 상세
- `entryRouter_parallel_guide.js` - Entry 구현 예시
- `scratchRouter_parallel_guide.js` - Scratch 구현 예시

---

**문서 버전**: 1.0  
**최종 수정**: 2025-12-27  
**작성자**: Claude AI Assistant
