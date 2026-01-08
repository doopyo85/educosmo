# 갤러리 디버깅 가이드

## 🐛 보고된 문제

### 1. 공유 기능 오류 (400 에러)
```
공유 실패: 필수 파라미터가 누락되었습니다. (title, platform, s3Url)
```

**원인**: `/gallery/share` 페이지가 수동 공유를 위한 것인데, 이제는 자동 등록이 기본이므로 혼란 발생

**해결 방법**:
- 자동 등록이 제대로 작동하면 수동 공유 페이지는 필요 없음
- 또는 수동 공유 페이지를 업데이트하여 `ProjectSubmissions`에서 프로젝트 선택 후 공유하도록 개선

---

### 2. 갤러리에 통계가 0, 0, 0으로 표시

**증상**:
- S3에 파일은 있음 (제출 성공)
- 갤러리 페이지에서 통계가 "0 공유한 작품, 0 총 조회수, 0 총 좋아요"

**가능한 원인**:
1. **자동 등록이 실패함** → `gallery_projects` 테이블에 데이터 없음
2. **필드명 불일치** → `blocksCount` vs `blocks_count`
3. **API 호출 오류** → 프론트엔드가 데이터를 못 받음

---

## ✅ 적용된 수정

### 1. 필드명 불일치 수정

**파일**: `lib_storage/galleryManager.js`

**문제**:
- `parallelSave.analyzeEntryProject()`는 `{ blocksCount, spritesCount }` 반환
- `galleryManager`는 `analysis.blocks_count`를 기대

**수정**:
```javascript
// 이전
const metadata = {
    blocks_count: analysis.blocks_count || 0,
    sprites_count: analysis.sprites_count || 0,
    ...
};

// 수정 후 (camelCase와 snake_case 모두 지원)
const blocksCount = analysis.blocks_count || analysis.blocksCount || 0;
const spritesCount = analysis.sprites_count || analysis.spritesCount || 0;

const metadata = {
    blocks_count: blocksCount,
    sprites_count: spritesCount,
    ...
};
```

---

### 2. 상세 로깅 추가

**파일**: `routes/entryRouter.js`

**추가된 로그**:
1. `🔍 [Entry] 갤러리 자동 등록 체크` - 조건 확인
2. `📤 [Entry] 갤러리 자동 등록 시작` - 파라미터 출력
3. `🎨 [Entry] 갤러리 자동 등록 결과` - 성공/실패 여부
4. `✨ [Entry] 갤러리 자동 등록 완료` - 성공 시
5. `⏭️ [Entry] 갤러리 자동 등록 조건 미충족` - 스킵 시

**확인 방법**:
```bash
# 서버 콘솔에서 로그 확인
# Entry 제출 시 다음과 같은 로그 출력되어야 함:

🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'submitted', hasProjectSubmissionId: true, projectSubmissionId: 456 }
📤 [Entry] 갤러리 자동 등록 시작: { userId: 123, userID: 'student1', ... }
🎨 [Entry] 갤러리 자동 등록 결과: { galleryProjectId: 789, isNew: true }
✨ [Entry] 갤러리 자동 등록 완료: Gallery# 789
```

---

## 🔍 디버깅 절차

### Step 1: 서버 재시작
```bash
# 수정된 코드 반영을 위해 서버 재시작
```

### Step 2: Entry 프로젝트 제출
1. Entry 에디터 접속
2. 간단한 프로젝트 작성
3. **"제출" 버튼 클릭** (`saveType: 'submitted'`)
4. 서버 콘솔 로그 확인

### Step 3: 로그 분석

**예상되는 로그 패턴**:

#### ✅ 정상 작동 (자동 등록 성공)
```
💾 [Entry 저장] 요청: { userID: 'student1', projectName: 'MyProject', saveType: 'submitted' }
📊 파일 크기: 12.34 KB
📤 S3 업로드 시작: users/student1/entry/submitted/MyProject_123.ent
✅ S3 업로드 완료: https://...
✅ [parallelSave] 병렬 저장 완료: { userFileId: 456, projectSubmissionId: 789 }
🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'submitted', hasProjectSubmissionId: true, projectSubmissionId: 789 }
📤 [Entry] 갤러리 자동 등록 시작: { userId: 123, userID: 'student1', platform: 'entry', ... }
🎨 [Gallery Auto-Register] 시작: { userID: 'student1', platform: 'entry', projectName: 'MyProject' }
✅ [Gallery Auto-Register] 완료: Gallery# 101
🎨 [Entry] 갤러리 자동 등록 결과: { galleryProjectId: 101, isNew: true }
✨ [Entry] 갤러리 자동 등록 완료: Gallery# 101
```

#### ❌ 문제 패턴 1: projectSubmissionId 없음
```
✅ [parallelSave] 병렬 저장 완료: { userFileId: 456 }  ← projectSubmissionId 없음!
🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'submitted', hasProjectSubmissionId: false }
⏭️ [Entry] 갤러리 자동 등록 조건 미충족
```
**해결**: `parallelSave.js` 확인

#### ❌ 문제 패턴 2: saveType이 submitted가 아님
```
💾 [Entry 저장] 요청: { userID: 'student1', saveType: 'projects' }  ← submitted가 아님!
🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'projects', hasProjectSubmissionId: true }
⏭️ [Entry] 갤러리 자동 등록 조건 미충족
```
**해결**: 클라이언트가 `saveType: 'submitted'`로 요청하는지 확인

#### ❌ 문제 패턴 3: 갤러리 등록 실패
```
📤 [Entry] 갤러리 자동 등록 시작: { ... }
❌ [Gallery Auto-Register] 실패: Error: ...
🎨 [Entry] 갤러리 자동 등록 결과: { galleryProjectId: null, isNew: false, error: '...' }
ℹ️ [Entry] 갤러리 등록 스킵: Error: ...
```
**해결**: 에러 메시지 확인 (DB 연결, 테이블 스키마 등)

---

### Step 4: 데이터베이스 확인

```sql
-- 1. ProjectSubmissions에 데이터가 있는지 확인
SELECT * FROM ProjectSubmissions
WHERE user_id = (SELECT id FROM Users WHERE userID = 'student1')
ORDER BY created_at DESC LIMIT 5;

-- 2. gallery_projects에 자동 등록되었는지 확인
SELECT * FROM gallery_projects
WHERE user_id = (SELECT id FROM Users WHERE userID = 'student1')
ORDER BY created_at DESC LIMIT 5;

-- 3. 연결 확인 (project_submission_id)
SELECT
    gp.id as gallery_id,
    gp.title,
    gp.project_submission_id,
    ps.id as submission_id,
    ps.project_name,
    ps.created_at as submitted_at
FROM gallery_projects gp
LEFT JOIN ProjectSubmissions ps ON gp.project_submission_id = ps.id
WHERE gp.user_id = (SELECT id FROM Users WHERE userID = 'student1')
ORDER BY gp.created_at DESC LIMIT 5;
```

---

### Step 5: 프론트엔드 확인

1. `/my-universe/gallery` 접속
2. 브라우저 개발자 도구 > Network 탭
3. `/api/gallery/my` 요청 확인
4. 응답 데이터 확인:

**정상 응답 예시**:
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "title": "MyProject",
      "platform": "entry",
      "view_count": 0,
      "like_count": 0,
      "play_count": 0,
      "thumbnail_url": "https://...",
      "created_at": "2026-01-08T..."
    }
  ],
  "pagination": {
    "total": 1
  }
}
```

**문제 응답 예시**:
```json
{
  "success": true,
  "data": [],  ← 빈 배열 = 데이터 없음
  "pagination": {
    "total": 0
  }
}
```

---

## 📋 체크리스트

자동 등록이 작동하려면 다음 조건이 모두 충족되어야 합니다:

- [ ] Entry 프로젝트를 "제출"로 저장 (`saveType: 'submitted'`)
- [ ] `parallelSave`가 `projectSubmissionId` 반환
- [ ] `galleryManager.autoRegisterToGallery()` 호출됨
- [ ] `gallery_projects` 테이블에 INSERT 성공
- [ ] 프론트엔드가 `/api/gallery/my` 호출
- [ ] API가 데이터 정상 반환
- [ ] 브라우저가 카드 렌더링

---

## 🚨 자주 발생하는 문제

### 1. "제출" 버튼이 아닌 "저장" 버튼 클릭
- `saveType: 'projects'` → 자동 등록 안 됨
- **해결**: "제출" 버튼 클릭 확인

### 2. 브라우저 캐시
- 이전 코드가 캐시되어 있음
- **해결**: Ctrl+Shift+R (강력 새로고침)

### 3. 서버 미재시작
- 코드 수정 후 서버 재시작 안 함
- **해결**: 서버 재시작

### 4. 데이터베이스 스키마 문제
- `gallery_projects` 테이블에 필요한 컬럼 없음
- **해결**: 테이블 스키마 확인 (`project_submission_id`, `view_count`, etc.)

---

## 💡 추가 개선 사항

### 공유 페이지 제거 또는 업데이트

**옵션 1: 제거**
- `/gallery/share` 라우트 제거
- "새 작품 공유" 버튼 제거

**옵션 2: 업데이트**
- `ProjectSubmissions`에서 프로젝트 선택
- visibility 설정 (private → public/class)
- 태그, 설명 추가

### 프론트엔드 에러 처리

`gallery.ejs`에 에러 메시지 추가:
```javascript
} catch (error) {
    console.error('갤러리 로드 오류:', error);
    document.getElementById('galleryEmpty').innerHTML = `
        <i class="bi bi-exclamation-triangle text-warning"></i>
        <h4>데이터 로드 오류</h4>
        <p>${error.message}</p>
    `;
    document.getElementById('galleryEmpty').style.display = 'block';
}
```

---

**작성일**: 2026-01-08
**버전**: 1.2 (Debug Guide)
