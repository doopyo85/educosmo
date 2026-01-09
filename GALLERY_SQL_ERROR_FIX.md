# 갤러리 SQL 에러 수정

## 🐛 발생한 오류

```
Error: Incorrect arguments to mysqld_stmt_execute
sqlMessage: 'Incorrect arguments to mysqld_stmt_execute'
```

**SQL 쿼리**:
```sql
SELECT gp.*, u.userID, u.name as userName
FROM gallery_projects gp
JOIN Users u ON gp.user_id = u.id
WHERE gp.user_id = ? AND gp.is_active = 1
ORDER BY gp.created_at DESC
LIMIT ? OFFSET ?
```

**원인**:
- `getUserDbId(req.session.userID)`가 `undefined` 반환
- params 배열에 `undefined`가 들어가서 SQL 파라미터 개수 불일치

---

## ✅ 수정 내용

**파일**: `routes/api/galleryApiRouter.js` (Line 597-602)

### 수정 전
```javascript
router.get('/my', requireAuth, async (req, res) => {
    try {
        const userDbId = await getUserDbId(req.session.userID);
        const { platform, page = 1, limit = 20 } = req.query;

        let whereConditions = ['gp.user_id = ?', 'gp.is_active = 1'];
        let params = [userDbId];  // userDbId가 undefined면 에러!
```

### 수정 후
```javascript
router.get('/my', requireAuth, async (req, res) => {
    try {
        const userDbId = await getUserDbId(req.session.userID);

        if (!userDbId) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const { platform, page = 1, limit = 20 } = req.query;

        let whereConditions = ['gp.user_id = ?', 'gp.is_active = 1'];
        let params = [userDbId];
```

---

## 🔍 근본 원인 분석

### 왜 `getUserDbId`가 undefined를 반환했는가?

**`getUserDbId` 함수** (Line 55-61):
```javascript
async function getUserDbId(userID) {
    const [user] = await db.queryDatabase(
        'SELECT id FROM Users WHERE userID = ?',
        [userID]
    );
    return user?.id;
}
```

**가능한 원인**:
1. `req.session.userID`가 `undefined` 또는 `null`
2. DB에 해당 `userID`가 존재하지 않음
3. 세션이 만료되었거나 손상됨

---

## 🧪 디버깅 절차

### 1. 세션 확인
```javascript
console.log('🔍 Session:', {
    userID: req.session.userID,
    is_logined: req.session.is_logined,
    role: req.session.role
});
```

### 2. getUserDbId 결과 확인
```javascript
const userDbId = await getUserDbId(req.session.userID);
console.log('🔍 User DB ID:', { userID: req.session.userID, userDbId });
```

### 3. 데이터베이스 직접 확인
```sql
-- 세션의 userID로 사용자 검색
SELECT id, userID, name, role FROM Users WHERE userID = 'test85';

-- gallery_projects에 데이터가 있는지 확인
SELECT COUNT(*) FROM gallery_projects WHERE user_id = 123;
```

---

## 📊 타임라인 분석

**사용자 활동 로그**:
```
ENTRY [제출] cos1-1e-01a          <- Entry 제출 성공
GALLERY 스크래치 프로젝트          <- 스크래치 공유하기 클릭
SCRATCH 스크래치 프로젝트.sb3     <- 스크래치 저장 성공
```

**문제점**:
1. Entry 제출 시 자동 갤러리 등록이 작동했는지 불명확
2. 스크래치는 "저장" 후 "공유하기" 버튼을 눌렀으나 갤러리에 표시 안 됨
3. `/api/gallery/my` 호출 시 500 에러

---

## 🔧 추가 수정 필요 사항

### 1. 스크래치 자동 등록 확인

**스크래치 제출 방식**:
- 현재: "저장" → "공유하기" 버튼 클릭
- 예상: "저장" 시 `saveType: 'projects'` → 자동 등록 안 됨
- **해결**: "제출" 버튼 추가 또는 "저장" 시 자동 등록

**확인 방법**:
```bash
# 서버 로그에서 스크래치 저장 로그 확인
pm2 logs server | grep "Scratch 저장"
```

**예상 로그**:
```
💾 [Scratch 저장] 병렬 모델 요청: { saveType: 'projects', ... }
```
→ `saveType`이 `'submitted'`가 아니면 자동 등록 안 됨!

---

### 2. Entry 자동 등록 로그 확인

**예상 로그 (정상)**:
```
💾 [Entry 저장] 요청: { saveType: 'submitted', projectName: 'cos1-1e-01a' }
✅ [parallelSave] 병렬 저장 완료: { projectSubmissionId: 456 }
🔍 [Entry] 갤러리 자동 등록 체크: { actualSaveType: 'submitted', hasProjectSubmissionId: true }
📤 [Entry] 갤러리 자동 등록 시작: { userId: 123, userID: 'test85', platform: 'entry', ... }
✅ [Gallery Auto-Register] 완료: Gallery# 789
✨ [Entry] 갤러리 자동 등록 완료: Gallery# 789
```

**로그가 없다면**:
1. 서버가 수정된 코드를 반영하지 않음 (재시작 필요)
2. Entry 제출 API가 다른 엔드포인트를 사용 중
3. `saveType`이 `'submitted'`가 아님

---

## 📝 체크리스트

### 즉시 확인 사항
- [ ] 서버 로그에서 자동 등록 로그 확인
- [ ] DB에서 `gallery_projects` 테이블 데이터 확인
- [ ] DB에서 `ProjectSubmissions` 테이블 데이터 확인

### SQL 쿼리
```sql
-- 1. test85 사용자의 DB ID 확인
SELECT id, userID, name FROM Users WHERE userID = 'test85';

-- 2. 해당 사용자의 ProjectSubmissions 확인
SELECT id, project_name, platform, save_type, created_at
FROM ProjectSubmissions
WHERE user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY created_at DESC LIMIT 10;

-- 3. 해당 사용자의 gallery_projects 확인
SELECT id, title, platform, project_submission_id, created_at
FROM gallery_projects
WHERE user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY created_at DESC LIMIT 10;

-- 4. 연결 상태 확인
SELECT
    ps.id as submission_id,
    ps.project_name,
    ps.save_type,
    gp.id as gallery_id,
    gp.title as gallery_title
FROM ProjectSubmissions ps
LEFT JOIN gallery_projects gp ON ps.id = gp.project_submission_id
WHERE ps.user_id = (SELECT id FROM Users WHERE userID = 'test85')
ORDER BY ps.created_at DESC LIMIT 10;
```

---

## 🚀 해결 방안

### 방안 1: Entry 자동 등록 확인
1. 서버 재시작: `pm2 restart server`
2. Entry 프로젝트 다시 제출
3. 로그 확인: `pm2 logs server | grep "갤러리 자동 등록"`

### 방안 2: Scratch 제출 버튼 추가 또는 자동 등록
**옵션 A**: 스크래치에 "제출" 버튼 추가
- UI에 "제출" 버튼 추가
- `saveType: 'submitted'` 전송

**옵션 B**: "저장" 시에도 자동 등록
- `scratchRouter.js` 수정
- `saveType: 'projects'`일 때도 갤러리 등록

### 방안 3: 수동 공유 페이지 개선
- `/gallery/share` 페이지를 `ProjectSubmissions` 목록으로 변경
- 제출한 프로젝트 중 선택하여 공개 설정 변경

---

## 📋 배포 파일

수정된 파일:
1. `routes/api/galleryApiRouter.js` - userDbId undefined 체크 추가

---

**작성일**: 2026-01-09
**버전**: 1.4 (SQL Error Fix)
