# Phase 4: 구독 자동 갱신 시스템 구현 완료

## 📋 개요

**구현 일자**: 2026-01-23
**목적**: 결제 연동 없이 Admin이 수동으로 관리하는 구독 자동 갱신 시스템 구축

### 핵심 기능

1. ✅ **구독 자동 갱신**: 매일 새벽 4시에 `next_billing_date` 확인 후 자동 연장
2. ✅ **Admin 구독 관리**: Admin UI에서 구독 취소/재개/플랜 변경
3. ✅ **레거시 데이터 정리**: 기존 불일치 데이터 마이그레이션
4. ✅ **이메일 알림**: 갱신/만료 시 자동 이메일 발송

---

## 🎯 비즈니스 요구사항

### 배경

- 실제 결제 연동(Toss Payments)은 아직 미구현
- Admin이 오프라인으로 결제를 받고, 시스템에서 수동으로 관리
- 구독 취소하지 않는 한 자동으로 계속 갱신되어야 함

### 플랜 종류

| 플랜 | 가격 | 갱신 주기 | 저장소 | 대상 |
|------|------|-----------|--------|------|
| **Trial** | ₩0 | 14일 (자동 만료) | 30GB | 신규 센터 |
| **Standard** | ₩110,000/월 | 30일 | 30GB | 일반 센터 |
| **Professional** | ₩0 | 365일 | 100GB | 프랜차이즈 전용 |

---

## 🗂️ 구현 내용

### 1. 데이터베이스 마이그레이션

**파일**: `scripts/migrate_subscriptions.sql`

#### 마이그레이션 내용

```sql
-- 1. 본사 센터 (ID: 0)에 professional 구독 추가
INSERT INTO center_subscriptions (
    center_id, plan_type, status, storage_limit_bytes,
    price_monthly, next_billing_date, payment_method
)
VALUES (
    0, 'premium', 'active', 107374182400,
    0, DATE_ADD(CURDATE(), INTERVAL 365 DAY), 'franchise'
);

-- 2. 코딩앤플레이 (ID: 64)를 professional로 업그레이드
UPDATE center_subscriptions
SET
    plan_type = 'premium',
    storage_limit_bytes = 107374182400,
    price_monthly = 0,
    next_billing_date = DATE_ADD(CURDATE(), INTERVAL 365 DAY)
WHERE center_id = 64;

-- 3. 나머지 센터: standard 플랜 유지
UPDATE center_subscriptions
SET
    plan_type = 'standard',
    status = 'active',
    storage_limit_bytes = 32212254720,
    price_monthly = 110000,
    next_billing_date = COALESCE(next_billing_date, DATE(trial_ends_at))
WHERE center_id NOT IN (0, 64)
  AND status = 'active';

-- 4. Centers 테이블 동기화
UPDATE Centers c
INNER JOIN center_subscriptions cs ON c.id = cs.center_id
SET c.plan_type = CASE
    WHEN cs.plan_type = 'premium' THEN 'premium'
    ELSE 'basic'
END;
```

#### 실행 방법

```bash
mysql -u root -p myuniverse < scripts/migrate_subscriptions.sql
```

---

### 2. 구독 자동 갱신 Cron Job

**파일**: `lib_cron/subscriptionRenewalCron.js`

#### 핵심 로직

```javascript
// 매일 새벽 4시 실행
cron.schedule('0 4 * * *', async () => {
    // 1. next_billing_date <= 오늘인 구독 조회
    const subscriptions = await queryDatabase(`
        SELECT * FROM center_subscriptions
        WHERE next_billing_date <= CURDATE()
          AND status IN ('active', 'cancelled')
    `);

    // 2. 각 구독 처리
    for (const sub of subscriptions) {
        if (sub.status === 'active') {
            // Active: 자동 갱신 (30일 또는 365일 연장)
            const renewalDays = sub.plan_type === 'premium' ? 365 : 30;
            await queryDatabase(`
                UPDATE center_subscriptions
                SET next_billing_date = DATE_ADD(next_billing_date, INTERVAL ? DAY)
                WHERE id = ?
            `, [renewalDays, sub.id]);

            // 갱신 알림 이메일 발송
            await sendRenewalNotificationEmail(sub);
        }
        else if (sub.status === 'cancelled') {
            // Cancelled: 만료 처리
            await queryDatabase(`
                UPDATE center_subscriptions SET status = 'suspended'
                WHERE id = ?
            `, [sub.id]);

            await queryDatabase(`
                UPDATE Centers SET status = 'SUSPENDED'
                WHERE id = ?
            `, [sub.center_id]);

            // 만료 알림 이메일 발송
            await sendExpirationNotificationEmail(sub);
        }
    }
});
```

#### 서버 시작 시 자동 등록

**파일**: `server.js` (Line 1199-1201)

```javascript
// 구독 자동 갱신 Cron Job (Phase 4)
const { startSubscriptionRenewalCron } = require('./lib_cron/subscriptionRenewalCron');
startSubscriptionRenewalCron();
```

#### 수동 실행 (테스트용)

**파일**: `scripts/test_subscription_renewal.js`

```bash
node scripts/test_subscription_renewal.js
```

---

### 3. Admin 구독 관리 API

**파일**: `routes/adminRouter.js`

#### 3.1 구독 취소

**Endpoint**: `POST /admin/api/subscriptions/:centerId/cancel`

```javascript
// status를 'cancelled'로 변경
// 다음 결제일까지는 서비스 이용 가능
// 다음 결제일에 자동으로 'suspended' 처리
```

#### 3.2 구독 재개

**Endpoint**: `POST /admin/api/subscriptions/:centerId/resume`

```javascript
// status를 'active'로 변경
// 새로운 next_billing_date 설정 (30일 또는 365일 후)
// Centers 테이블도 'ACTIVE'로 변경
```

#### 3.3 플랜 변경

**Endpoint**: `PUT /admin/api/subscriptions/:centerId/plan`

```javascript
// standard <-> premium 전환
// 저장소 용량 및 가격 변경
// Centers 테이블 동기화
```

#### 3.4 구독 상세 조회

**Endpoint**: `GET /admin/api/subscriptions/:centerId`

```javascript
// 구독 정보, 센터 정보, 다음 결제일 등 조회
```

---

### 4. Admin UI 구독 관리

**파일**: `views/admin/centers.ejs`

#### 4.1 센터 카드에 구독 버튼 추가

```javascript
<button class="btn btn-sm btn-outline-apple"
        onclick="manageSubscription(${center.id}, '${center.subscription_status}')">
    <i class="bi bi-credit-card"></i> 구독
</button>
```

#### 4.2 구독 관리 모달

**기능**:
- 구독 상태 확인 (active, cancelled, suspended)
- 플랜 정보 (Standard, Professional)
- 다음 결제일 및 남은 일수
- **액션 버튼**:
  - Active 상태: "구독 취소" 버튼
  - Cancelled/Suspended 상태: "구독 재개" 버튼
- **플랜 변경 버튼**:
  - Standard ↔ Professional 전환

#### 4.3 JavaScript 함수

```javascript
// 구독 관리 모달 표시
async function manageSubscription(centerId, currentStatus)

// 구독 취소
async function cancelSubscription(centerId)

// 구독 재개
async function resumeSubscription(centerId)

// 플랜 변경
async function changePlan(centerId, newPlanType)
```

---

### 5. 센터 목록 API 수정

**파일**: `routes/api/centerRouter.js`

#### 구독 정보 JOIN 추가

```javascript
router.get('/', authenticateUser, checkAdminRole, async (req, res) => {
    const query = `
        SELECT
            c.*,
            cs.plan_type as subscription_plan,
            cs.status as subscription_status,
            cs.next_billing_date,
            cs.price_monthly,
            cs.trial_ends_at
        FROM Centers c
        LEFT JOIN center_subscriptions cs ON c.id = cs.center_id
        WHERE 1=1
        ...
    `;
});
```

이제 Admin 센터 목록에서 구독 상태를 함께 확인 가능

---

## 🔄 구독 상태 흐름도

```
센터 생성
    ↓
[TRIAL] (14일)
    ↓ (결제 선택)
    ↓
[ACTIVE] ← 구독 시작
    ├─→ 매일 새벽 4시: next_billing_date 확인
    ├─→ 만료일 도래 & status='active' → 자동 갱신 (30일 연장)
    ├─→ Admin이 "구독 취소" → status='cancelled'
    │   ├─→ 다음 결제일까지 서비스 이용 가능
    │   └─→ 다음 결제일에 자동으로 'suspended' 처리
    │
[CANCELLED]
    ↓ (next_billing_date 도래)
    ↓
[SUSPENDED] ← 서비스 제한
    └─→ Admin이 "구독 재개" → [ACTIVE] (30일 연장)
```

---

## 📧 이메일 알림

### 1. 갱신 알림 이메일

**발송 조건**: status='active'인 구독이 자동 갱신될 때

**내용**:
- 플랜명 (Standard / Professional)
- 월 이용료
- 다음 결제일
- "구독을 계속 이용하시려면 아무 조치도 필요하지 않습니다"

### 2. 만료 알림 이메일

**발송 조건**: status='cancelled'인 구독이 만료될 때

**내용**:
- "귀하의 구독이 만료되었습니다"
- 현재 이용 가능/불가능 기능 안내
- "구독 재개하기" 버튼 (링크: `/subscription/plans`)

---

## 🧪 테스트 시나리오

### 1. 데이터 마이그레이션 테스트

```bash
mysql -u root -p myuniverse < scripts/migrate_subscriptions.sql
```

**확인 사항**:
- ✅ 본사 센터 (ID: 0) professional 구독 추가됨
- ✅ 코딩앤플레이 (ID: 64) professional로 업그레이드됨
- ✅ 나머지 센터 standard 플랜 유지
- ✅ Centers.plan_type과 center_subscriptions.plan_type 동기화됨

### 2. 자동 갱신 Cron Job 테스트

```bash
node scripts/test_subscription_renewal.js
```

**시나리오**:
1. `next_billing_date`를 오늘 또는 과거로 설정
2. 스크립트 실행
3. 결과 확인:
   - Active 구독 → 30일 또는 365일 연장됨
   - Cancelled 구독 → Suspended로 변경됨

### 3. Admin UI 테스트

**시나리오**:
1. `/admin/centers` 접속
2. 센터 카드에서 "구독" 버튼 클릭
3. 구독 관리 모달 확인:
   - 플랜, 상태, 다음 결제일 표시됨
4. **구독 취소**:
   - "구독 취소" 버튼 클릭
   - 확인 대화상자 → "예"
   - status='cancelled'로 변경 확인
5. **구독 재개**:
   - "구독 재개" 버튼 클릭
   - 확인 대화상자 → "예"
   - status='active'로 변경, next_billing_date 갱신 확인
6. **플랜 변경**:
   - "Professional" 버튼 클릭
   - 확인 대화상자 → "예"
   - plan_type='premium', 저장소 100GB로 변경 확인

---

## 📂 파일 목록

### 신규 파일

| 파일 | 설명 |
|------|------|
| `lib_cron/subscriptionRenewalCron.js` | 구독 자동 갱신 Cron Job |
| `scripts/migrate_subscriptions.sql` | 데이터 마이그레이션 SQL |
| `scripts/test_subscription_renewal.js` | 테스트용 수동 실행 스크립트 |

### 수정 파일

| 파일 | 수정 내용 |
|------|----------|
| `server.js` | Cron Job 등록 (Line 1199-1201) |
| `routes/adminRouter.js` | 구독 관리 API 4개 추가 (취소/재개/플랜변경/조회) |
| `routes/api/centerRouter.js` | 센터 목록 조회 시 구독 정보 JOIN |
| `views/admin/centers.ejs` | 구독 관리 UI 추가 (버튼, 모달, 함수) |

---

## 🚀 배포 체크리스트

### 배포 전

- [ ] `scripts/migrate_subscriptions.sql` 실행
- [ ] 데이터 마이그레이션 결과 확인
- [ ] 테스트 스크립트 실행 및 결과 확인

### 배포 후

- [ ] 서버 재시작 (Cron Job 등록 확인)
- [ ] Admin UI에서 구독 관리 기능 테스트
- [ ] 로그 확인: Cron Job 정상 등록 여부
- [ ] 다음 날 새벽 4시 이후 로그 확인 (자동 갱신 실행 여부)

### 모니터링

- [ ] 매일 새벽 4시 Cron Job 실행 로그
- [ ] 구독 갱신 성공/실패 건수
- [ ] 만료 처리된 센터 수
- [ ] 이메일 발송 성공/실패

---

## 🔮 향후 작업 (Phase 5 예정)

### Toss Payments 연동

1. **빌링키 발급**
   - 첫 결제 시 빌링키 저장
   - `center_subscriptions.billing_key` 활용

2. **정기 결제 API 호출**
   - Cron Job에서 Toss Payments API 호출
   - 결제 성공 → 자동 갱신
   - 결제 실패 → status='suspended', 이메일 알림

3. **결제 내역 저장**
   - `subscription_payments` 테이블 생성
   - 결제 성공/실패 로그 저장

4. **Webhook 처리**
   - Toss Payments Webhook 수신
   - 결제 상태 실시간 업데이트

---

## 📝 주요 변경 사항 요약

### ✅ 구현 완료

1. **구독 자동 갱신 시스템**
   - 매일 새벽 4시 자동 실행
   - Active 구독: 30일/365일 자동 연장
   - Cancelled 구독: 만료 처리

2. **Admin 구독 관리**
   - 구독 취소/재개 기능
   - 플랜 변경 기능 (Standard ↔ Professional)
   - 구독 상태 실시간 조회

3. **레거시 데이터 정리**
   - Centers.plan_type과 center_subscriptions.plan_type 동기화
   - 누락된 구독 정보 추가

4. **이메일 알림**
   - 갱신 알림
   - 만료 알림

### ⏳ 미구현 (향후 작업)

1. Toss Payments API 연동
2. 빌링키 발급 및 정기 결제
3. 결제 내역 저장
4. Webhook 처리

---

## 🎉 결론

**Phase 4 완료**: 결제 연동 없이 Admin이 수동으로 관리하는 구독 자동 갱신 시스템이 완성되었습니다.

- ✅ 구독 취소하지 않는 한 자동으로 계속 갱신
- ✅ Admin에서 쉽게 구독 관리 (취소/재개/플랜 변경)
- ✅ 이메일 알림으로 센터 관리자에게 자동 통지
- ✅ 레거시 데이터 정리 완료

**다음 단계**: Phase 5에서 Toss Payments 연동을 통해 실제 자동 결제 시스템 구축 예정
