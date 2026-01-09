# 갤러리 문제 해결 가이드

## 🔍 현재 상황

### 증상
- Entry 제출 완료 (S3 업로드 성공, 타임라인 기록 확인)
- Scratch 저장 후 "공유하기" 클릭
- 갤러리 페이지: 통계 0, 0, 0 표시
- API 오류: SQL parameter error (getUserDbId undefined)

### 적용된 수정
1. ✅ `entryRouter.js` - Field name fix: `submissionId` → `projectSubmissionId`
2. ✅ `galleryManager.js` - camelCase/snake_case 호환성 추가
3. ✅ `galleryApiRouter.js` - userDbId undefined 체크 추가
4. ✅ `gallery.ejs` - 안전한 EJS 변수 접근

---

## 🚨 진단 체크리스트

### Step 1: 서버 재시작 확인
```bash
# 수정된 코드가 반영되었는지 확인
pm2 list
pm2 logs server --lines 20 | grep "갤러리"
```

**예상 결과**: 서버가 최근에 재시작되었고, 새로운 로그가 보여야 함

---

### Step 2: 데이터베이스 직접 확인

#### 2-1. 사용자 DB ID 확인
```sql
SELECT id, userID, name, role FROM Users WHERE userID = 'test85';
```

**예상 결과**:
```
| id  | userID | name   | role    |
|-----|--------|--------|---------|
| 123 | test85 | 테스트 | student |
```

만약 결과가 없다면 → **세션 userID가 잘못됨**

---

#### 2-2. ProjectSubmissions 확인
```sql
SELECT
    id,
    user_id,
    project_name,
    platform,
    save_type,
    s3_url,
    created_at
FROM ProjectSubmissions
WHERE user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY created_at DESC
LIMIT 10;
```

**예상 결과**: `cos1-1e-01a` 프로젝트가 `save_type = 'submitted'`로 보여야 함

**만약 결과가 없다면** → Entry 제출이 ProjectSubmissions에 저장 안 됨
**만약 save_type이 'projects'라면** → 자동 등록 조건 미충족

---

#### 2-3. gallery_projects 확인
```sql
SELECT
    id,
    user_id,
    title,
    platform,
    s3_url,
    project_submission_id,
    is_active,
    visibility,
    created_at
FROM gallery_projects
WHERE user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY created_at DESC
LIMIT 10;
```

**시나리오 분석**:

**A. 결과가 없음** → 자동 등록 실패
- 원인 1: `projectSubmissionId`가 없어서 auto-register 호출 안 됨
- 원인 2: `galleryManager.autoRegisterToGallery()` 실행 중 에러
- 해결: 서버 로그 확인

**B. 결과가 있지만 `is_active = 0`** → SQL 쿼리 필터링됨
- 원인: `is_active` 컬럼이 기본값 0으로 설정됨
- 해결: `gallery_projects` 테이블 스키마 확인

**C. 결과가 있지만 `visibility = 'private'`** → 정상 (프론트엔드는 보여야 함)
- 본인 갤러리는 private도 보여야 함
- API 문제 아님

---

#### 2-4. 연결 상태 확인 (JOIN)
```sql
SELECT
    ps.id as submission_id,
    ps.project_name,
    ps.save_type,
    ps.platform,
    ps.created_at as submitted_at,
    gp.id as gallery_id,
    gp.title as gallery_title,
    gp.is_active,
    gp.visibility
FROM ProjectSubmissions ps
LEFT JOIN gallery_projects gp ON ps.id = gp.project_submission_id
WHERE ps.user_id = (SELECT id FROM Users WHERE userID = 'test85')
  AND ps.save_type = 'submitted'
ORDER BY ps.created_at DESC
LIMIT 10;
```

**예상 결과 패턴**:

**패턴 1: 정상 작동**
```
submission_id | project_name   | save_type  | gallery_id | is_active
456           | cos1-1e-01a    | submitted  | 789        | 1
```
→ **문제**: 프론트엔드 또는 API 문제

**패턴 2: 자동 등록 실패**
```
submission_id | project_name   | save_type  | gallery_id | is_active
456           | cos1-1e-01a    | submitted  | NULL       | NULL
```
→ **문제**: `galleryManager.autoRegisterToGallery()` 호출 안 됨 또는 실패

**패턴 3: is_active 문제**
```
submission_id | project_name   | save_type  | gallery_id | is_active
456           | cos1-1e-01a    | submitted  | 789        | 0
```
→ **문제**: `is_active` 기본값 0으로 설정됨

---

### Step 3: 서버 로그 분석

#### 3-1. Entry 제출 로그 확인
```bash
pm2 logs server | grep -A 5 "Entry 저장"
```

**정상 로그 패턴**:
```
💾 [Entry 저장] 요청: { userID: 'test85', projectName: 'cos1-1e-01a', saveType: 'submitted' }
✅ [parallelSave] 병렬 저장 완료: { userFileId: 456, projectSubmissionId: 789 }
🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'submitted', hasProjectSubmissionId: true, projectSubmissionId: 789 }
📤 [Entry] 갤러리 자동 등록 시작: { userId: 123, userID: 'test85', platform: 'entry', ... }
🎨 [Gallery Auto-Register] 시작: { userID: 'test85', platform: 'entry', projectName: 'cos1-1e-01a' }
✅ [Gallery Auto-Register] 완료: Gallery# 101
✨ [Entry] 갤러리 자동 등록 완료: Gallery# 101
```

**문제 로그 패턴 1**: projectSubmissionId 없음
```
✅ [parallelSave] 병렬 저장 완료: { userFileId: 456 }  ← projectSubmissionId 누락!
🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'submitted', hasProjectSubmissionId: false }
⏭️ [Entry] 갤러리 자동 등록 조건 미충족
```
→ **해결**: `parallelSave.js` 버그 확인

**문제 로그 패턴 2**: saveType이 submitted가 아님
```
💾 [Entry 저장] 요청: { userID: 'test85', saveType: 'projects' }  ← submitted 아님!
```
→ **해결**: 클라이언트가 제출 버튼 클릭 시 `saveType: 'submitted'` 전송 확인

**문제 로그 패턴 3**: 갤러리 등록 실패
```
📤 [Entry] 갤러리 자동 등록 시작: { ... }
❌ [Gallery Auto-Register] 실패: Error: Column 'is_active' doesn't have a default value
```
→ **해결**: DB 스키마 문제 (is_active 컬럼)

---

### Step 4: gallery_projects 테이블 스키마 확인

```sql
SHOW CREATE TABLE gallery_projects;
```

**확인 사항**:
1. `is_active` 컬럼 존재 여부
2. `is_active` DEFAULT 값 설정
3. `project_submission_id` 컬럼 존재 여부

**문제 시나리오**:
- `is_active` 컬럼 없음 → SQL 쿼리 수정 필요
- `is_active` DEFAULT 값 0 → INSERT 시 1로 설정 필요
- `project_submission_id` 없음 → 테이블 마이그레이션 필요

---

### Step 5: API 응답 확인 (브라우저)

1. `/my-universe/gallery` 접속
2. 개발자 도구 > Network 탭
3. `/api/gallery/my?limit=100` 요청 확인

**정상 응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "title": "cos1-1e-01a",
      "platform": "entry",
      "s3_url": "https://...",
      "thumbnail_url": null,
      "embed_url": "/entry_editor/?s3Url=...",
      "view_count": 0,
      "like_count": 0,
      "play_count": 0,
      "is_active": 1,
      "visibility": "private",
      "created_at": "2026-01-09T..."
    }
  ],
  "pagination": { "total": 1 }
}
```

**문제 응답 1**: 빈 배열
```json
{
  "success": true,
  "data": [],
  "pagination": { "total": 0 }
}
```
→ 데이터베이스에 데이터 없음 또는 SQL 필터링됨

**문제 응답 2**: 404 에러
```json
{
  "success": false,
  "error": "사용자를 찾을 수 없습니다."
}
```
→ `getUserDbId()` 반환값 undefined (세션 문제)

**문제 응답 3**: 500 에러
```json
{
  "success": false,
  "error": "Column 'is_active' doesn't exist"
}
```
→ 테이블 스키마 문제

---

## 🛠️ 해결 방안

### 방안 1: is_active 컬럼 문제

**만약 `is_active` 컬럼이 없다면**:

#### 옵션 A: 컬럼 추가
```sql
ALTER TABLE gallery_projects
ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT '활성화 상태 (1=활성, 0=삭제됨)';

-- 기존 데이터 활성화
UPDATE gallery_projects SET is_active = 1 WHERE is_active IS NULL;
```

#### 옵션 B: SQL 쿼리 수정 (컬럼 추가 없이)
`routes/api/galleryApiRouter.js` 수정:
```javascript
// Line 606
let whereConditions = ['gp.user_id = ?'];  // is_active 조건 제거
```

---

### 방안 2: galleryManager INSERT 시 is_active 명시

`lib_storage/galleryManager.js` 수정:
```javascript
// Line 68
const insertQuery = `
    INSERT INTO gallery_projects (
        user_id, title, description, platform, s3_url, thumbnail_url, embed_url,
        visibility, tags, metadata, project_submission_id,
        is_active,  -- 추가
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
`;

const insertParams = [
    userId, projectName, description, platform, s3Url, thumbnailUrl, embedUrl,
    'private', JSON.stringify([]), JSON.stringify(metadata), projectSubmissionId,
    1  // is_active = 1 명시
];
```

---

### 방안 3: Scratch 워크플로우 개선

**문제**: Scratch는 "제출" 버튼 없이 "저장" → "공유하기" 클릭

#### 옵션 A: Scratch에 "제출" 버튼 추가
- UI에 "제출하기" 버튼 추가
- `saveType: 'submitted'` 전송

#### 옵션 B: "저장"도 자동 등록
`routes/scratchRouter.js` 수정:
```javascript
// saveType이 'projects'여도 자동 등록
if ((actualSaveType === 'submitted' || actualSaveType === 'projects') && result.projectSubmissionId) {
    // 갤러리 자동 등록
}
```

#### 옵션 C: 수동 공유 페이지 개선
- `/gallery/share`를 `ProjectSubmissions` 목록으로 변경
- 제출한 프로젝트 선택 → visibility 변경

---

## 📋 최종 진단 절차 요약

1. **서버 재시작 확인**: `pm2 list`, `pm2 logs`
2. **DB 데이터 확인**: Users, ProjectSubmissions, gallery_projects
3. **DB 스키마 확인**: `SHOW CREATE TABLE gallery_projects`
4. **서버 로그 분석**: Entry 제출 로그 패턴 확인
5. **브라우저 Network**: API 응답 확인

---

## ✅ 다음 단계

### 즉시 실행 가능한 SQL 진단 쿼리
```sql
-- 1️⃣ 사용자 확인
SELECT id, userID, name FROM Users WHERE userID = 'test85';

-- 2️⃣ 제출 기록 확인
SELECT id, project_name, save_type, platform, created_at
FROM ProjectSubmissions
WHERE user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY created_at DESC LIMIT 5;

-- 3️⃣ 갤러리 등록 확인
SELECT id, title, platform, is_active, visibility, project_submission_id, created_at
FROM gallery_projects
WHERE user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY created_at DESC LIMIT 5;

-- 4️⃣ 연결 상태 확인
SELECT
    ps.id, ps.project_name, ps.save_type,
    gp.id as gallery_id, gp.is_active, gp.visibility
FROM ProjectSubmissions ps
LEFT JOIN gallery_projects gp ON ps.id = gp.project_submission_id
WHERE ps.user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY ps.created_at DESC LIMIT 5;

-- 5️⃣ 테이블 스키마 확인
SHOW CREATE TABLE gallery_projects;
```

### 결과 분석 후 조치
- **데이터 없음** → 서버 로그 확인 (자동 등록 실패 원인)
- **is_active = 0** → UPDATE 또는 INSERT 로직 수정
- **스키마 문제** → ALTER TABLE 또는 SQL 쿼리 수정

---

**작성일**: 2026-01-09
**버전**: 2.0 (Comprehensive Troubleshooting)
