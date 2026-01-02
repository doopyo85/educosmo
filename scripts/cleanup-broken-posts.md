# 이미지 소실 게시글 정리 가이드

## 개요
Pong2 게시판에서 temp 폴더의 이미지가 삭제되어 로드 실패하는 게시글을 정리하는 스크립트입니다.

---

## 사용 방법

### 1. 확인만 하기 (DRY-RUN)
실제 삭제하지 않고 어떤 게시글이 영향받는지만 확인:

```bash
cd /home/ubuntu/educodingnplay
node scripts/cleanup-broken-posts.js check
```

**출력 예시:**
```
=== 이미지 소실된 게시글 목록 ===

1. [ID: 123] 고양이 사진 공유
   작성자: test85 (PAID)
   작성일: 2026-01-02 12:30:00
   조회수: 5
   내용 길이: 1024 bytes

2. [ID: 124] 강아지 귀여움
   작성자: admin (PAID)
   작성일: 2026-01-02 13:00:00
   조회수: 10
   내용 길이: 2048 bytes

=== 게시글 통계 ===
전체 게시글: 50개
공개 게시글: 45개
이미지 소실: 10개 (20.00%)
```

---

### 2. 비공개 처리 (권장)
게시글을 삭제하지 않고 비공개로 변경 (복구 가능):

```bash
node scripts/cleanup-broken-posts.js hide
```

**효과:**
- `is_public = 0` (비공개)
- 제목에 `[이미지 손실]` 접두사 추가
- 데이터는 보존되므로 나중에 복구 가능

---

### 3. 완전 삭제 (주의)
게시글을 DB에서 영구 삭제:

```bash
node scripts/cleanup-broken-posts.js delete
```

**⚠️ 경고:**
- 10초 대기 후 실행 (Ctrl+C로 취소 가능)
- 삭제된 데이터는 복구 불가능
- 댓글, 반응 등 관련 데이터도 함께 삭제 (CASCADE)

---

## SQL 쿼리로 직접 실행

MySQL 클라이언트에서 직접 실행할 수도 있습니다:

### 1. 확인 쿼리
```sql
SELECT
    id,
    title,
    author,
    created_at,
    content
FROM board_posts
WHERE board_scope = 'COMMUNITY'
  AND content LIKE '%board/images/temp/%'
ORDER BY created_at DESC;
```

### 2. 비공개 처리
```sql
UPDATE board_posts
SET is_public = 0,
    title = CONCAT('[이미지 손실] ', title)
WHERE board_scope = 'COMMUNITY'
  AND content LIKE '%board/images/temp/%'
  AND is_public = 1;
```

### 3. 완전 삭제
```sql
DELETE FROM board_posts
WHERE board_scope = 'COMMUNITY'
  AND content LIKE '%board/images/temp/%';
```

---

## 실행 결과 예시

### ✅ 성공적인 실행
```bash
$ node scripts/cleanup-broken-posts.js hide

[2026-01-02T15:45:00.000Z] [INFO] ============================================================
[2026-01-02T15:45:00.001Z] [INFO] 이미지 소실 게시글 정리 스크립트 시작
[2026-01-02T15:45:00.001Z] [INFO] ============================================================
[2026-01-02T15:45:00.050Z] [INFO] 📊 게시글 통계 조회...

=== 게시글 통계 ===
전체 게시글: 50개
공개 게시글: 45개
이미지 소실: 10개 (20.00%)
최근 게시일: 2026-01-02 14:30:00
===================

[2026-01-02T15:45:00.100Z] [INFO] 🔍 이미지 소실된 게시글 검색 시작...
[2026-01-02T15:45:00.150Z] [INFO] 찾은 게시글: 10개

=== 이미지 소실된 게시글 목록 ===
(게시글 목록...)

[2026-01-02T15:45:00.200Z] [INFO] 🔒 이미지 소실된 게시글 비공개 처리 시작...
[2026-01-02T15:45:00.250Z] [SUCCESS] ✅ 비공개 처리 완료: 10개 게시글

=== 처리 후 통계 ===
전체 게시글: 50개
공개 게시글: 35개
이미지 소실: 10개 (20.00%)

[2026-01-02T15:45:00.300Z] [SUCCESS] ============================================================
[2026-01-02T15:45:00.300Z] [SUCCESS] 정리 작업 완료
[2026-01-02T15:45:00.300Z] [SUCCESS] ============================================================

✅ 작업 성공
```

---

## 주의사항

1. **백업 권장**: 실행 전 DB 백업 필수
   ```bash
   mysqldump -u root -p educodingnplay board_posts > backup_posts_$(date +%Y%m%d).sql
   ```

2. **DRY-RUN 먼저**: 항상 `check` 모드로 먼저 확인

3. **비공개 처리 우선**: 완전 삭제보다 비공개 처리 권장

4. **프로덕션 주의**: 운영 서버에서 실행 시 주의 필요

---

## 문제 해결

### 문제: "Module not found: db.js"
**원인**: 스크립트가 올바른 경로에서 실행되지 않음
**해결**: `/home/ubuntu/educodingnplay` 디렉토리에서 실행

### 문제: "Access denied for user"
**원인**: DB 접근 권한 없음
**해결**: `.env` 파일의 DB 설정 확인

### 문제: 게시글이 검색되지 않음
**원인**: temp 이미지를 사용하는 게시글이 없음
**해결**: 정상 상태입니다 (문제 없음)

---

## 향후 방지책

이 문제가 재발하지 않도록 다음이 적용되어야 합니다:

1. ✅ `pong2Router.js`에 `processContentImages()` 추가 완료
2. ✅ 매일 새벽 2시 temp 파일 정리 cron 실행
3. ⏳ 배포 대기: 위 변경사항을 프로덕션 서버에 배포 필요

**배포 후 이 문제는 더 이상 발생하지 않습니다.**
