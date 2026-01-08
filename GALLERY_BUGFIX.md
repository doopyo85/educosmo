# 갤러리 버그 수정 보고서

## 🐛 발견된 문제

### 1. 엔트리 제출 시 갤러리에 표시되지 않음
**원인**: `parallelSave.js`가 `projectSubmissionId`를 반환하는데, `entryRouter.js`에서 `result.submissionId`로 잘못된 필드명을 사용

**영향**:
- 엔트리 프로젝트 제출 시 갤러리 자동 등록 실패
- `if (actualSaveType === 'submitted' && result.submissionId)` 조건이 항상 false

### 2. 교사가 학생 갤러리 볼 때 레이아웃 다름
**원인**:
- `/my-universe/student/:id/gallery` 라우트 미존재
- `gallery.ejs`가 항상 현재 로그인 사용자의 데이터만 fetch
- Sidebar에서 학생 뷰 시 `/gallery?userId=...` (구버전 페이지)로 연결

**영향**:
- 교사가 학생 갤러리 클릭 시 잘못된 페이지로 이동
- 새로운 myUniverse 갤러리 레이아웃이 적용 안 됨

---

## ✅ 수정 내용

### 1. Entry 라우터 필드명 수정

**파일**: `routes/entryRouter.js` (Line 483, 493, 503)

```javascript
// 이전
if (actualSaveType === 'submitted' && result.submissionId)
projectSubmissionId: result.submissionId
projectId: result.submissionId || result.projectId

// 수정 후
if (actualSaveType === 'submitted' && result.projectSubmissionId)
projectSubmissionId: result.projectSubmissionId
projectId: result.projectSubmissionId || result.projectId
```

**결과**:
- 엔트리 프로젝트 제출 시 `galleryManager.autoRegisterToGallery()` 정상 호출
- `gallery_projects` 테이블에 자동 INSERT

---

### 2. 교사 학생 갤러리 라우트 추가

**파일**: `routes/myUniverseRouter.js` (Line 642-684)

```javascript
router.get('/student/:id/gallery', async (req, res) => {
    // 교사/매니저 권한 체크
    // 같은 센터 학생 확인
    res.render('my-universe/index', {
        activeTab: 'gallery',
        student,
        readOnly: true
    });
});
```

**결과**:
- `/my-universe/student/123/gallery` 접근 가능
- 학생 정보를 `student` 객체로 전달

---

### 3. Sidebar 갤러리 링크 수정

**파일**: `views/partials/my-universe-sidebar.ejs` (Line 117)

```javascript
// 이전
const galleryUrl = isStudentView
    ? ('/gallery?userId=' + locals.student.userID)
    : (baseUrl + '/gallery');

// 수정 후
const galleryUrl = baseUrl + '/gallery';
```

**결과**:
- 학생 뷰: `/my-universe/student/:id/gallery`
- 본인 뷰: `/my-universe/gallery`
- 일관된 URL 구조

---

### 4. Gallery.ejs API 호출 로직 수정

**파일**: `views/my-universe/gallery.ejs` (Line 354-380)

```javascript
// 학생 뷰인지 확인
const isStudentView = <%= locals.student && locals.student.userID && locals.student.userID !== locals.userID ? 'true' : 'false' %>;
const studentUserID = isStudentView ? '<%= locals.student.userID %>' : null;

// API URL 분기
const apiUrl = isStudentView
    ? `/api/gallery/projects?userId=${studentUserID}&limit=100`
    : '/api/gallery/my?limit=100';
```

**결과**:
- 본인 갤러리: `/api/gallery/my` (내 작품만)
- 학생 갤러리: `/api/gallery/projects?userId=학생ID` (학생 작품만)

---

## 🧪 테스트 시나리오

### 시나리오 1: 엔트리 프로젝트 제출

1. 학생 로그인
2. 엔트리 에디터에서 프로젝트 작성
3. "제출" 버튼 클릭 (`saveType: 'submitted'`)
4. **확인**:
   - 콘솔에 "✨ [Entry] 갤러리 자동 등록 완료" 로그
   - `/my-universe/gallery`에서 카드 형태로 표시
   - `gallery_projects` 테이블에 데이터 존재

### 시나리오 2: 교사가 학생 갤러리 확인

1. 교사 로그인
2. 학습관리 > 특정 학생 > [타임라인보기] 아이콘 클릭
3. myUniverse 사이드바 > "갤러리 (Gallery)" 클릭
4. **확인**:
   - URL: `/my-universe/student/:id/gallery`
   - 학생의 갤러리 프로젝트만 표시
   - 카드 레이아웃 정상 표시
   - 통계 (작품 수, 조회, 좋아요) 정상

### 시나리오 3: 플랫폼 필터링

1. 갤러리에서 "엔트리" 탭 클릭
2. **확인**: 엔트리 프로젝트만 표시
3. "스크래치" 탭 클릭
4. **확인**: 스크래치 프로젝트만 표시

---

## 📝 변경된 파일 목록

1. **routes/entryRouter.js** - 필드명 수정 (`submissionId` → `projectSubmissionId`)
2. **routes/myUniverseRouter.js** - 학생 갤러리 라우트 추가
3. **views/partials/my-universe-sidebar.ejs** - 갤러리 URL 통일
4. **views/my-universe/gallery.ejs** - API 호출 로직 분기 처리

---

## 🔍 기술적 상세

### parallelSave 반환 구조

```javascript
{
    success: true,
    userFileId: 123,              // UserFiles.id
    projectSubmissionId: 456,     // ProjectSubmissions.id
    s3Url: "https://...",
    fileSize: 12345
}
```

### galleryManager.autoRegisterToGallery 동작

1. `project_submission_id`로 중복 체크
2. 없으면 `gallery_projects`에 INSERT
3. 기본값: `visibility = 'private'`
4. 메타데이터 자동 포함 (blocks_count, sprites_count)

### API 엔드포인트 비교

| 엔드포인트 | 용도 | 반환 데이터 |
|------------|------|-------------|
| `/api/gallery/my` | 내 갤러리 | 본인 작품만 (모든 visibility) |
| `/api/gallery/projects` | 공개 갤러리 | public + class (같은 센터) |
| `/api/gallery/projects?userId=...` | 특정 사용자 | 해당 사용자의 공개 작품 |

---

## 🎯 수정 전/후 비교

### 엔트리 제출 워크플로우

**수정 전**:
```
제출 → ProjectSubmissions 저장 → ❌ 갤러리 등록 실패 (필드명 오류)
```

**수정 후**:
```
제출 → ProjectSubmissions 저장 → ✅ gallery_projects 자동 INSERT
```

### 교사 학생 갤러리 접근

**수정 전**:
```
클릭 → /gallery?userId=student → 구버전 페이지 (테이블 레이아웃)
```

**수정 후**:
```
클릭 → /my-universe/student/123/gallery → 신규 myUniverse 갤러리 (카드 레이아웃)
```

---

## ⚠️ 주의사항

1. **캐싱**: 브라우저 캐시 클리어 필요 (Ctrl+Shift+R)
2. **데이터베이스**: `gallery_projects` 테이블에 `project_submission_id` 컬럼 필요
3. **권한**: 교사는 같은 센터 학생만 접근 가능

---

## 🚀 배포 체크리스트

- [x] Entry 필드명 수정
- [x] 학생 갤러리 라우트 추가
- [x] Sidebar URL 수정
- [x] Gallery.ejs API 분기 처리
- [ ] 서버 재시작
- [ ] 브라우저 캐시 클리어
- [ ] Entry 제출 테스트
- [ ] 교사 학생 갤러리 접근 테스트

---

**수정일**: 2026-01-08
**작성자**: Claude Sonnet 4.5
**버전**: 1.1 (Bugfix)
