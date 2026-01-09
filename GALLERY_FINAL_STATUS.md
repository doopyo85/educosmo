# 갤러리 최종 수정 상태 (2026-01-09)

## 📋 적용된 모든 수정 사항

### 1. ✅ 필드명 불일치 수정
**파일**: `lib_storage/galleryManager.js`
- camelCase (`blocksCount`) / snake_case (`blocks_count`) 모두 지원
- Line 51-52: 양쪽 필드명 체크

### 2. ✅ Entry 라우터 필드명 수정
**파일**: `routes/entryRouter.js`
- `result.submissionId` → `result.projectSubmissionId`
- Line 509: 올바른 필드명 사용

### 3. ✅ 교사 학생 갤러리 라우트 추가
**파일**: `routes/myUniverseRouter.js`
- Line 645-684: `/student/:id/gallery` 추가
- 권한 체크 (teacher/manager/admin)
- 센터 소속 확인

### 4. ✅ Sidebar 링크 수정
**파일**: `views/partials/my-universe-sidebar.ejs`
- Line 117: 갤러리 URL 통일
- 학생/교사 모두 동일한 URL 패턴

### 5. ✅ Gallery.ejs API 분기 및 안전성 강화
**파일**: `views/my-universe/gallery.ejs`
- Line 355-356: undefined 안전 체크
- Line 378-380: 학생 뷰 API 분기
- isStudentView에 따라 `/api/gallery/projects` vs `/api/gallery/my`

### 6. ✅ 상세 로깅 추가
**파일**: `routes/entryRouter.js`
- Line 483-521: 자동 등록 디버깅 로그
- 조건 체크, 시작, 결과, 완료/스킵 로그

### 7. ✅ SQL Parameter 에러 수정
**파일**: `routes/api/galleryApiRouter.js`
- Line 597-602: userDbId undefined 체크
- 404 응답 반환 (사용자 찾을 수 없음)

### 8. ✅ is_active 명시적 설정 추가 (NEW!)
**파일**: `lib_storage/galleryManager.js`
- Line 78: `is_active` 컬럼 추가
- Line 96: `is_active = 1` 명시적 설정
- **효과**: DB 기본값 없어도 INSERT 성공

---

## 🐛 보고된 문제

### 증상
1. Entry 제출 완료 (타임라인 기록: `cos1-1e-01a`)
2. Scratch 저장 후 "공유하기" 클릭
3. 갤러리 페이지: 통계 0, 0, 0 표시
4. API 호출 시 SQL 에러 발생

### 타임라인 로그
```
ENTRY [제출] cos1-1e-01a          ← Entry 제출 성공
GALLERY 스크래치 프로젝트          ← 스크래치 공유하기 클릭
SCRATCH 스크래치 프로젝트.sb3     ← 스크래치 저장 성공
```

### 콘솔 에러
```
Error: Incorrect arguments to mysqld_stmt_execute
sqlMessage: 'Incorrect arguments to mysqld_stmt_execute'
```

---

## 🔍 근본 원인 분석

### 문제 1: SQL Parameter Error
**원인**: `getUserDbId(req.session.userID)` → `undefined`
- SQL 쿼리: `WHERE gp.user_id = ?` → params에 undefined
- 파라미터 개수 불일치로 에러 발생

**해결**: Line 597-602에 undefined 체크 추가

---

### 문제 2: 갤러리 데이터 없음 (가능성 높음)
**원인**: `is_active` 컬럼 문제
- `galleryManager.js`가 INSERT 시 `is_active` 미설정
- DB 테이블에 DEFAULT 값 없으면 → NULL 또는 0 저장
- SQL 쿼리 `WHERE is_active = 1` → 필터링되어 조회 안 됨

**해결**: Line 78, 96에 `is_active = 1` 명시적 추가

---

### 문제 3: Scratch 워크플로우 차이
**원인**: Scratch는 "제출" 버튼 없음
- 현재: "저장" → `saveType: 'projects'` → 자동 등록 조건 미충족
- 사용자가 수동 "공유하기" 클릭 → 400 에러 (필수 파라미터 누락)

**미해결**: Scratch 자동 등록 방식 결정 필요

---

## 🧪 확인 절차

### Step 1: 서버 재시작
```bash
pm2 restart server
pm2 logs server --lines 50
```

수정된 코드를 반영하기 위해 **반드시 재시작 필요**

---

### Step 2: 데이터베이스 진단
`GALLERY_DIAGNOSTIC.sql` 파일 사용:

```sql
SET @target_userID = 'test85';  -- 사용자 ID 변경
-- 전체 스크립트 실행
```

**확인 사항**:
1. Users 테이블에 사용자 존재 확인
2. ProjectSubmissions에 제출 기록 확인
3. gallery_projects에 자동 등록 확인
4. is_active 컬럼 존재 및 값 확인

**예상 결과**:

#### ✅ 정상 패턴
```
submission_id | project_name | save_type  | gallery_id | is_active | status
456           | cos1-1e-01a  | submitted  | 789        | 1         | ✅ 정상
```

#### ❌ 문제 패턴 A: 자동 등록 안 됨
```
submission_id | project_name | save_type  | gallery_id | is_active | status
456           | cos1-1e-01a  | submitted  | NULL       | NULL      | ❌ 갤러리 미등록
```
→ **원인**: 자동 등록 로직 실행 안 됨 또는 실패
→ **조치**: 서버 로그 확인

#### ❌ 문제 패턴 B: is_active = 0
```
submission_id | project_name | save_type  | gallery_id | is_active | status
456           | cos1-1e-01a  | submitted  | 789        | 0         | ⚠️ 비활성화됨
```
→ **원인**: 이전 코드로 INSERT되어 is_active = 0
→ **조치**: UPDATE 쿼리 실행
```sql
UPDATE gallery_projects SET is_active = 1 WHERE is_active = 0 OR is_active IS NULL;
```

---

### Step 3: 서버 로그 확인

#### Entry 제출 로그 확인
```bash
pm2 logs server | grep -A 5 "Entry 저장"
pm2 logs server | grep "갤러리 자동 등록"
```

**정상 로그**:
```
💾 [Entry 저장] 요청: { userID: 'test85', projectName: 'cos1-1e-01a', saveType: 'submitted' }
✅ [parallelSave] 병렬 저장 완료: { userFileId: 456, projectSubmissionId: 789 }
🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'submitted', hasProjectSubmissionId: true, projectSubmissionId: 789 }
📤 [Entry] 갤러리 자동 등록 시작: { userId: 123, userID: 'test85', ... }
🎨 [Gallery Auto-Register] 시작: { userID: 'test85', platform: 'entry', projectName: 'cos1-1e-01a' }
✅ [Gallery Auto-Register] 완료: Gallery# 101
✨ [Entry] 갤러리 자동 등록 완료: Gallery# 101
```

**로그 없으면**:
1. 서버 재시작 안 됨 → `pm2 restart server`
2. 다른 엔트리 제출 엔드포인트 사용 중
3. saveType이 'submitted' 아님

---

### Step 4: 프론트엔드 API 확인

1. 브라우저에서 `/my-universe/gallery` 접속
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
      "is_active": 1,
      "visibility": "private",
      "view_count": 0,
      "like_count": 0,
      "play_count": 0
    }
  ],
  "pagination": { "total": 1 }
}
```

**문제 응답**:
- `data: []` → 데이터 없음 (Step 2로 돌아가 DB 확인)
- 404 에러 → `getUserDbId` undefined (세션 문제)
- 500 에러 → DB 스키마 또는 쿼리 문제

---

## 🛠️ 즉시 해결 방법

### 방법 1: 기존 데이터 활성화 (is_active = 0인 경우)
```sql
UPDATE gallery_projects
SET is_active = 1
WHERE is_active = 0 OR is_active IS NULL;
```

### 방법 2: 누락된 갤러리 항목 수동 등록
```sql
-- submitted인데 gallery_projects에 없는 항목 자동 등록
INSERT INTO gallery_projects (
    user_id, title, description, platform, s3_url, thumbnail_url, embed_url,
    visibility, is_active, tags, metadata, project_submission_id, created_at, updated_at
)
SELECT
    ps.user_id,
    ps.project_name as title,
    CONCAT(
        CASE ps.platform
            WHEN 'entry' THEN '엔트리'
            WHEN 'scratch' THEN '스크래치'
            WHEN 'python' THEN '파이썬'
            ELSE ps.platform
        END,
        '로 만든 작품입니다.'
    ) as description,
    ps.platform,
    ps.s3_url,
    ps.thumbnail_url,
    CONCAT(
        CASE ps.platform
            WHEN 'entry' THEN '/entry_editor/?s3Url='
            WHEN 'scratch' THEN '/scratch/?project_file='
            WHEN 'python' THEN '/python-viewer/?file='
        END,
        REPLACE(ps.s3_url, '&', '%26'),
        CASE ps.platform
            WHEN 'entry' THEN '&mode=play&embed=1'
            WHEN 'scratch' THEN '&mode=player&embed=1'
            WHEN 'python' THEN '&embed=1'
        END
    ) as embed_url,
    'private' as visibility,
    1 as is_active,
    '[]' as tags,
    '{}' as metadata,
    ps.id as project_submission_id,
    NOW() as created_at,
    NOW() as updated_at
FROM ProjectSubmissions ps
WHERE ps.save_type = 'submitted'
  AND NOT EXISTS (
      SELECT 1 FROM gallery_projects gp WHERE gp.project_submission_id = ps.id
  );
```

이 쿼리는:
- 모든 `submitted` 프로젝트를 찾아
- 아직 갤러리에 없는 항목만
- 자동으로 gallery_projects에 등록

---

## 📌 Scratch 워크플로우 해결 방안

현재 Scratch는 "저장" 후 수동 "공유하기"를 눌러야 하는데, 이것이 실패하고 있음.

### 옵션 A: Scratch에 "제출" 버튼 추가
**장점**: Entry와 일관된 워크플로우
**단점**: UI 변경 필요

**구현**:
1. Scratch 에디터에 "제출하기" 버튼 추가
2. 버튼 클릭 시 `saveType: 'submitted'` 전송
3. Entry와 동일하게 자동 등록

---

### 옵션 B: "저장"도 자동 등록
**장점**: UI 변경 없음
**단점**: 모든 저장이 갤러리에 등록될 수 있음

**구현**:
`routes/scratchRouter.js` 수정:
```javascript
// Line 489 근처
if ((actualSaveType === 'submitted' || actualSaveType === 'projects') && result.projectSubmissionId) {
    // 갤러리 자동 등록
    const galleryManager = require('../lib_storage/galleryManager');
    galleryResult = await galleryManager.autoRegisterToGallery({
        userId, userID,
        platform: 'scratch',
        projectName,
        s3Url,
        thumbnailUrl,
        analysis,
        projectSubmissionId: result.projectSubmissionId
    });
}
```

---

### 옵션 C: 수동 공유 페이지 개선
**장점**: 사용자가 공유할 항목 선택 가능
**단점**: 추가 단계 필요

**구현**:
1. `/gallery/share` 페이지를 `ProjectSubmissions` 목록으로 변경
2. 제출한 프로젝트 중 선택
3. visibility 설정 (private → public/class)
4. gallery_projects에 등록

---

## ✅ 체크리스트

### 즉시 확인 사항
- [ ] 서버 재시작: `pm2 restart server`
- [ ] 서버 로그에서 자동 등록 로그 확인
- [ ] SQL 진단 스크립트 실행 (`GALLERY_DIAGNOSTIC.sql`)
- [ ] DB에서 `gallery_projects` 데이터 확인
- [ ] 브라우저에서 API 응답 확인

### 문제별 조치
- [ ] **데이터 없음** → 서버 로그 확인, 수동 등록 SQL 실행
- [ ] **is_active = 0** → UPDATE 쿼리 실행
- [ ] **API 404 에러** → 세션 확인, 로그인 다시 시도
- [ ] **Scratch 공유 실패** → 워크플로우 개선 방안 선택

---

## 📁 관련 파일

### 수정된 파일
1. `lib_storage/galleryManager.js` - is_active 명시, 필드명 호환
2. `routes/entryRouter.js` - 필드명 수정, 로깅 추가
3. `routes/api/galleryApiRouter.js` - undefined 체크
4. `views/my-universe/gallery.ejs` - 안전한 변수 접근
5. `routes/myUniverseRouter.js` - 학생 갤러리 라우트 추가
6. `views/partials/my-universe-sidebar.ejs` - URL 통일

### 생성된 문서
1. `GALLERY_TROUBLESHOOTING.md` - 상세 문제 해결 가이드
2. `GALLERY_DIAGNOSTIC.sql` - SQL 진단 스크립트
3. `GALLERY_FINAL_STATUS.md` - 이 문서 (전체 상태 요약)

### 이전 문서
1. `GALLERY_SQL_ERROR_FIX.md` - SQL 에러 수정 기록
2. `GALLERY_FINAL_FIX.md` - 500 에러 수정 기록
3. `GALLERY_DEBUG_GUIDE.md` - 디버깅 가이드

---

## 🚀 다음 단계

### 1차 검증 (필수)
1. 서버 재시작
2. SQL 진단 실행
3. Entry 다시 제출
4. 갤러리 페이지 확인

### 2차 검증 (선택)
- Scratch 워크플로우 개선 방안 결정
- 교사 계정으로 학생 갤러리 접속 테스트
- 수동 공유 페이지 개선 또는 제거

---

**작성일**: 2026-01-09
**최종 수정**: 2026-01-09 15:00
**버전**: 3.0 (Final Status)
**주요 변경**: is_active 명시적 설정 추가
