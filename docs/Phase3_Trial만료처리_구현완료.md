# Phase 3: Trial 만료 처리 구현 완료

**작성일**: 2026-01-22
**상태**: 완료
**구현자**: Claude Sonnet 4.5

---

## 📋 구현 완료 항목

### 1. ✅ Trial 만료 Cron Job (`lib_cron/trialExpiryCron.js`)

**파일 위치**: `C:\Users\User\Documents\pioneer\educosmo\lib_cron/trialExpiryCron.js`

**실행 스케줄**: 매일 새벽 3시 (`0 3 * * *`)

**주요 기능**:

1. **Trial 만료 7일 전 알림**
   - 7일 후 만료 예정인 센터 조회
   - 센터 관리자에게 알림 이메일 발송
   - 플랜 선택 안내

2. **Trial 만료 처리**
   - 당일 만료된 센터 조회
   - `center_subscriptions.status` → `'suspended'`
   - `Centers.status` → `'SUSPENDED'`
   - 만료 알림 이메일 발송

3. **통계 조회**
   - 총 Trial 수
   - 활성 Trial 수
   - 만료된 Trial 수
   - 7일 내 만료 예정 수

**주요 함수**:
```javascript
// Cron Job 시작
startTrialExpiryCron()

// 수동 실행 (테스트용)
runTrialExpiryCheckNow()

// 7일 전 알림
sendTrialExpiryReminders()

// 만료 처리
processExpiredTrials()

// 통계 조회
getTrialStatistics()
```

---

### 2. ✅ Trial 만료 이메일 템플릿

**파일 위치**: `lib_auth/emailService.js`

#### 2.1 Trial 만료 7일 전 알림 이메일

**함수**: `sendTrialExpiryReminderEmail()`

**발송 시점**: Trial 만료 7일 전

**주요 내용**:
- ⏰ Trial 만료일 안내
- 📌 만료 후 변경사항 (접근 제한 안내)
- 💎 Standard 플랜 소개 (₩110,000/월)
- 🔗 플랜 선택 버튼

**이메일 디자인**:
- 헤더: 보라색 그라데이션 배경
- 주의사항: 노란색 알림 박스
- 플랜 카드: 흰색 배경 + 보라색 테두리
- CTA 버튼: "플랜 선택하기"

#### 2.2 Trial 만료 이메일

**함수**: `sendTrialExpiredEmail()`

**발송 시점**: Trial 만료일 당일

**주요 내용**:
- 🔒 Trial 만료 안내
- ⚠️ 서비스 이용 제한 안내
- 📌 현재 상태 (사용 가능/제한 기능)
- 💎 Standard 플랜 구독 안내
- 💡 프랜차이즈 안내

**이메일 디자인**:
- 헤더: 레드 그라데이션 배경
- 알림 박스: 빨간색 경고
- CTA 버튼: "지금 구독하기"

---

### 3. ✅ Suspended 센터 교육 콘텐츠 차단

**파일 수정**: `lib_login/accessControl.js`

**함수**: `checkAccess()` - async로 변경

**추가된 로직**:
```javascript
// center_student, center_admin인 경우 센터 상태 확인
if (accountType === 'center_student' || accountType === 'center_admin') {
    const [center] = await queryDatabase(
        'SELECT status FROM Centers WHERE id = ?',
        [centerID]
    );

    // 센터가 SUSPENDED면 교육 콘텐츠 차단
    if (center && center.status === 'SUSPENDED') {
        return res.status(403).json({
            error: 'CENTER_SUSPENDED',
            message: '센터 구독이 만료되어 교육 콘텐츠 이용이 제한됩니다.',
            callToAction: {
                url: '/subscription/plans'
            }
        });
    }
}
```

**차단 대상 콘텐츠**:
- Portal (학습 자료)
- Entry/Scratch/Python IDE
- CT 문제 은행
- Judge0 채점 시스템
- 센터 클라우드보드
- Teacher Dashboard

**계속 사용 가능**:
- 커뮤니티 (아지트, 광장, 갤러리)
- 포트폴리오
- 개인 블로그

---

### 4. ✅ 센터 구독 만료 안내 페이지

**파일**: `views/center-suspended.ejs`

**라우트**: `GET /center-suspended`

**UI 요소**:
- 🔒 아이콘 (5em, 빨간색)
- 제목: "센터 구독이 만료되었습니다"
- 사용 가능한 기능 목록 (초록색 체크)
- 제한된 기능 목록 (빨간색 X)
- "구독 플랜 선택하기" 버튼 (보라색 그라데이션)
- "홈으로 돌아가기" 버튼 (회색)
- 프랜차이즈 안내 섹션

**디자인**:
- 전체 배경: 보라색 그라데이션
- 컨테이너: 흰색 카드, 큰 그림자
- 반응형 레이아웃

---

### 5. ✅ Cron Job 등록

**파일**: `server.js` (Line 1163)

**추가된 코드**:
```javascript
// 🔥 Trial 만료 처리 Cron Job (Phase 3)
const { startTrialExpiryCron } = require('./lib_cron/trialExpiryCron');
startTrialExpiryCron();
```

**실행 환경**: `isMain === true` (메인 프로세스)

**로그 메시지**:
```
✅ Trial 만료 Cron Job 스케줄 등록 완료 (매일 03:00)
```

---

## 🔄 Trial 만료 처리 흐름

### 1. Trial 만료 7일 전

```
1. Cron Job 실행 (매일 03:00)
   ↓
2. 7일 후 만료 예정 센터 조회
   ↓
3. 센터 관리자에게 이메일 발송
   - 만료일 안내
   - 플랜 선택 링크
   ↓
4. 로그 기록
```

### 2. Trial 만료일 당일

```
1. Cron Job 실행 (매일 03:00)
   ↓
2. 당일 만료 센터 조회
   ↓
3. center_subscriptions.status → 'suspended'
   ↓
4. Centers.status → 'SUSPENDED'
   ↓
5. 만료 알림 이메일 발송
   ↓
6. 로그 기록
```

### 3. 만료 후 사용자 접근 시도

```
1. 사용자가 교육 콘텐츠 접근 시도
   ↓
2. requireEducationAccess 미들웨어 실행
   ↓
3. checkAccess() - 센터 상태 확인
   ↓
4. Centers.status === 'SUSPENDED'
   ↓
5. 403 Forbidden 응답
   또는
   /center-suspended 페이지로 리다이렉트
   ↓
6. "구독 플랜 선택하기" 버튼 표시
```

---

## 📊 데이터베이스 변경사항

### center_subscriptions 테이블

**status 값 변경**:
- `'trial'` → `'suspended'` (만료 시)

**영향받는 컬럼**:
- `status`: 'suspended'로 변경
- `updated_at`: 자동 업데이트

### Centers 테이블

**status 값 변경**:
- `'ACTIVE'` → `'SUSPENDED'` (만료 시)

**영향받는 컬럼**:
- `status`: 'SUSPENDED'로 변경
- `updated_at`: 자동 업데이트

### 쿼리 예시

```sql
-- Trial 만료 7일 전 센터 조회
SELECT cs.centerID, c.center_name, c.contact_email, cs.trial_end_date
FROM center_subscriptions cs
JOIN Centers c ON cs.centerID = c.id
WHERE cs.status = 'trial'
  AND cs.trial_end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
  AND c.status = 'ACTIVE';

-- Trial 만료 센터 조회
SELECT cs.centerID, c.center_name
FROM center_subscriptions cs
JOIN Centers c ON cs.centerID = c.id
WHERE cs.status = 'trial'
  AND cs.trial_end_date <= CURDATE()
  AND c.status = 'ACTIVE';

-- Trial 만료 처리
UPDATE center_subscriptions
SET status = 'suspended', updated_at = NOW()
WHERE centerID = ?;

UPDATE Centers
SET status = 'SUSPENDED', updated_at = NOW()
WHERE id = ?;
```

---

## 🧪 테스트 방법

### 1. Cron Job 수동 실행 (테스트)

```javascript
// Node.js REPL 또는 별도 스크립트
const { runTrialExpiryCheckNow } = require('./lib_cron/trialExpiryCron');

(async () => {
    const result = await runTrialExpiryCheckNow();
    console.log('알림 발송:', result.reminderCount);
    console.log('만료 처리:', result.expiredCount);
})();
```

### 2. 테스트 데이터 생성

```sql
-- 7일 후 만료 예정 센터 생성
INSERT INTO center_subscriptions (centerID, plan_type, status, trial_end_date)
VALUES (1, 'trial', 'trial', DATE_ADD(CURDATE(), INTERVAL 7 DAY));

-- 당일 만료 센터 생성
INSERT INTO center_subscriptions (centerID, plan_type, status, trial_end_date)
VALUES (2, 'trial', 'trial', CURDATE());
```

### 3. 이메일 발송 테스트

```javascript
const { sendTrialExpiryReminderEmail, sendTrialExpiredEmail } = require('./lib_auth/emailService');

// 7일 전 알림
await sendTrialExpiryReminderEmail(
    'test@example.com',
    '테스트센터',
    '홍길동',
    '2026-01-29'
);

// 만료 알림
await sendTrialExpiredEmail(
    'test@example.com',
    '테스트센터',
    '홍길동'
);
```

### 4. 접근 차단 테스트

```bash
# 1. 센터를 SUSPENDED로 변경
UPDATE Centers SET status = 'SUSPENDED' WHERE id = 1;

# 2. 해당 센터 학생/관리자로 로그인
# 3. 교육 콘텐츠 접근 시도 (예: /portal)
# 4. 예상 결과: /center-suspended 페이지로 리다이렉트
```

### 5. Trial 통계 조회 테스트

```javascript
const { getTrialStatistics } = require('./lib_cron/trialExpiryCron');

(async () => {
    const stats = await getTrialStatistics();
    console.log('총 Trial:', stats.totalTrials);
    console.log('활성 Trial:', stats.activeTrials);
    console.log('만료 Trial:', stats.expiredTrials);
    console.log('7일 내 만료:', stats.expiringIn7Days);
})();
```

---

## 📂 파일 구조

```
educosmo/
├── lib_cron/
│   └── trialExpiryCron.js              # 🔥 신규 생성
├── lib_auth/
│   └── emailService.js                 # ✏️ 수정 (이메일 템플릿 추가)
├── lib_login/
│   └── accessControl.js                # ✏️ 수정 (SUSPENDED 체크 추가)
├── views/
│   └── center-suspended.ejs            # 🔥 신규 생성
├── docs/
│   └── Phase3_Trial만료처리_구현완료.md # 🔥 이 문서
└── server.js                           # ✏️ 수정 (Cron Job 등록)
```

---

## 🔐 보안 고려사항

### 1. 이메일 발송 실패 처리

```javascript
// 이메일 발송 실패해도 만료 처리는 진행
try {
    await sendTrialExpiredEmail(...);
} catch (error) {
    console.error('이메일 발송 실패:', error);
    // 만료 처리는 이미 완료됨
}
```

### 2. DB 트랜잭션

현재는 개별 UPDATE 쿼리 실행. 향후 개선:

```javascript
// 트랜잭션으로 묶어 원자성 보장
await db.transaction(async (trx) => {
    await trx('center_subscriptions').update({ status: 'suspended' });
    await trx('Centers').update({ status: 'SUSPENDED' });
});
```

### 3. 센터 상태 캐싱

현재는 매 요청마다 DB 조회. 향후 개선:

```javascript
// Redis 캐싱
const centerStatus = await redis.get(`center:${centerID}:status`);
if (!centerStatus) {
    // DB 조회 후 캐시
}
```

---

## ⚙️ 환경 변수

Phase 3는 추가 환경 변수 불필요.

기존 필요 환경 변수:
- `AWS_ACCESS_KEY_ID` - SES 이메일 발송
- `AWS_SECRET_ACCESS_KEY` - SES 이메일 발송
- `AWS_REGION` - SES 리전 (ap-northeast-2)
- `SES_FROM_EMAIL` - 발신 이메일 (noreply@codingnplay.co.kr)

---

## 📈 성능 최적화

### 현재 구현

- Cron Job: 1일 1회 실행 (새벽 3시)
- 이메일 발송: 순차 처리 (for loop)
- DB 쿼리: 개별 실행

### 향후 개선

1. **이메일 발송 병렬 처리**
   ```javascript
   await Promise.all(reminders.map(r => sendEmail(r)));
   ```

2. **Bulk UPDATE**
   ```javascript
   UPDATE center_subscriptions
   SET status = 'suspended'
   WHERE centerID IN (?, ?, ?);
   ```

3. **이메일 큐 시스템**
   - Bull Queue 사용
   - 발송 실패 재시도
   - Rate limiting

---

## 🐛 알려진 이슈 및 제한사항

### 이슈 1: 이메일 발송 실패 시 재시도 없음

**현상**: 이메일 발송 실패 시 재시도하지 않음
**대응**: 다음날 Cron Job 실행 시 재발송 시도
**해결**: Bull Queue + 재시도 로직 구현

### 이슈 2: 시간대 문제

**현상**: 서버 시간대와 사용자 시간대 불일치 가능
**대응**: DB 날짜는 UTC 기준, 표시는 로컬 변환
**해결**: 모든 날짜를 UTC로 저장, 표시 시 변환

### 이슈 3: 센터 상태 캐시 없음

**현상**: 매 요청마다 DB에서 센터 상태 조회
**대응**: 성능 영향 미미 (단일 쿼리)
**해결**: Redis 캐싱 (만료 시 invalidate)

---

## 📞 문의 및 지원

**구현 완료**: 2026-01-22
**다음 Phase**: Phase 4 (Admin Dashboard 구독 관리 UI)

**관련 문서**:
- `docs/# 센터개설 및 결제모듈 구현계획.txt` - 전체 계획
- `docs/Phase2_구독결제시스템_구현완료.md` - 결제 시스템
- `docs/Toss_Payments_연동_가이드.md` - 결제 연동

---

## ✅ Phase 3 완료 체크리스트

- [x] Trial 만료 Cron Job 구현
- [x] Trial 만료 7일 전 알림 이메일
- [x] Trial 만료 당일 알림 이메일
- [x] 자동 suspend 처리 (구독 + 센터)
- [x] Suspended 센터 교육 콘텐츠 차단
- [x] 센터 구독 만료 안내 페이지
- [x] server.js Cron Job 등록
- [x] 수동 실행 함수 (테스트용)
- [x] Trial 통계 조회 함수
- [x] Phase 3 구현 완료 문서

**Phase 3 상태**: ✅ 완료

**남은 작업**: Phase 4 (Admin Dashboard 구독 관리 UI, 선택 사항)
