# 갤러리 최종 수정 (500 에러 해결)

## 🐛 발생한 오류

```
Cannot read properties of undefined (reading 'userID')
at eval ("/var/www/html/views/my-universe/gallery.ejs":15:41)
```

**원인**:
- 본인 갤러리 접근 시 `locals.student` 객체가 `undefined`
- `locals.student.userID`에 직접 접근하여 에러 발생

---

## ✅ 수정 내용

**파일**: `views/my-universe/gallery.ejs` (Line 355-356)

### 이전 코드 (에러 발생)
```javascript
const isStudentView = <%= locals.student && locals.student.userID && locals.student.userID !== locals.userID ? 'true' : 'false' %>;
const studentUserID = isStudentView ? '<%= locals.student.userID %>' : null;
```

**문제**:
- `locals.userID`가 없는지 확인하지 않음
- `studentUserID` 할당 시 `locals.student`가 undefined면 에러

### 수정 후 코드 (안전)
```javascript
const isStudentView = <%= (locals.student && locals.student.userID && locals.userID && locals.student.userID !== locals.userID) ? 'true' : 'false' %>;
const studentUserID = isStudentView ? '<%= locals.student ? locals.student.userID : "" %>' : null;
```

**개선 사항**:
1. `locals.userID` 존재 여부 확인 추가
2. `studentUserID` 할당 시 삼항 연산자로 안전하게 처리
3. `locals.student`가 없으면 빈 문자열 반환

---

## 🧪 테스트 시나리오

### 시나리오 1: 학생이 본인 갤러리 접근
```
URL: /my-universe/gallery
locals.student: undefined
locals.userID: 'student1'

결과:
isStudentView = false
studentUserID = null
API 호출: /api/gallery/my?limit=100
```

### 시나리오 2: 교사가 학생 갤러리 접근
```
URL: /my-universe/student/123/gallery
locals.student: { id: 123, userID: 'student1', ... }
locals.userID: 'teacher1'

결과:
isStudentView = true
studentUserID = 'student1'
API 호출: /api/gallery/projects?userId=student1&limit=100
```

---

## 📝 배포 체크리스트

- [x] `views/my-universe/gallery.ejs` 수정
- [ ] 서버에 파일 업로드
- [ ] 서버 재시작 (pm2 restart)
- [ ] `/my-universe/gallery` 접속 테스트
- [ ] 교사 계정으로 학생 갤러리 접속 테스트

---

## 🚀 배포 명령어

```bash
# 1. 파일 업로드 (로컬 → 서버)
scp views/my-universe/gallery.ejs ubuntu@server:/var/www/html/views/my-universe/

# 2. 서버 재시작
pm2 restart server

# 3. 로그 확인
pm2 logs server --lines 50
```

---

## 🔍 추가 디버깅 (필요 시)

EJS 변수 확인을 위한 임시 로그 추가:

```ejs
<script>
    console.log('🔍 Gallery Debug:', {
        hasStudent: <%= !!locals.student %>,
        hasUserID: <%= !!locals.userID %>,
        studentUserID: '<%= locals.student ? locals.student.userID : "none" %>',
        currentUserID: '<%= locals.userID || "none" %>'
    });
</script>
```

---

## 📊 전체 수정 사항 요약 (이번 세션)

### 1. 필드명 불일치 수정
- `lib_storage/galleryManager.js` - camelCase/snake_case 모두 지원

### 2. Entry 라우터 필드명 수정
- `routes/entryRouter.js` - `submissionId` → `projectSubmissionId`

### 3. 교사 학생 갤러리 라우트 추가
- `routes/myUniverseRouter.js` - `/student/:id/gallery` 추가

### 4. Sidebar 링크 수정
- `views/partials/my-universe-sidebar.ejs` - 갤러리 URL 통일

### 5. Gallery.ejs API 분기 및 안전성 강화
- `views/my-universe/gallery.ejs` - 학생 뷰 API 분기, undefined 체크

### 6. 상세 로깅 추가
- `routes/entryRouter.js` - 자동 등록 디버깅 로그

---

## ⚠️ 중요 사항

### EJS 템플릿 안전성
EJS에서 객체 속성 접근 시 항상 존재 여부 확인:

**❌ 위험한 패턴**:
```ejs
<%= locals.student.userID %>
```

**✅ 안전한 패턴**:
```ejs
<%= locals.student ? locals.student.userID : 'default' %>
```

또는

```ejs
<%= locals.student?.userID || 'default' %>  <!-- Optional chaining (Node 14+) -->
```

---

**수정일**: 2026-01-09
**버전**: 1.3 (500 Error Fix)
