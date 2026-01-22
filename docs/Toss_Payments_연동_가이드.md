# Toss Payments 연동 가이드

**작성일**: 2026-01-22
**대상**: 센터 구독 결제 시스템
**상태**: Phase 2 - UI 완료, 결제 연동 대기

---

## 📋 현재 구현 상태

### ✅ 완료된 작업

1. **구독 플랜 페이지 UI** (`/subscription/plans`)
   - 3가지 플랜 카드 (Trial, Standard, Professional)
   - 현재 구독 상태 표시
   - 반응형 디자인

2. **결제 페이지 UI** (`/subscription/checkout`)
   - 주문 정보 요약
   - 결제 수단 선택 (카드, 계좌이체)
   - 고객 정보 입력 폼
   - 약관 동의 체크박스

3. **Subscription Router** (`routes/subscriptionRouter.js`)
   - GET `/subscription/plans` - 플랜 선택
   - GET `/subscription/checkout` - 결제 페이지
   - POST `/subscription/process-payment` - 결제 처리 (모의)
   - GET `/subscription/success` - 결제 완료

4. **센터 대시보드 구독 상태 카드**
   - Teacher 페이지에 구독 정보 표시
   - 플랜 타입, 상태, 다음 결제일
   - "구독 관리" 버튼

---

## 🚀 Toss Payments 연동 절차

### Step 1: Toss Payments 개발자 등록

1. **Toss Payments 개발자 센터 접속**
   - URL: https://developers.tosspayments.com/
   - "시작하기" 클릭

2. **회사 정보 등록**
   - 사업자등록번호: 코딩앤플레이 사업자등록번호 입력
   - 대표자 정보 입력
   - 정산 계좌 등록

3. **API 키 발급**
   - 개발자 센터 로그인
   - 내 애플리케이션 → 새 애플리케이션 생성
   - 애플리케이션 이름: "코딩앤플레이 센터 구독"
   - 결제창 URL 설정:
     - 개발: `http://localhost:3000/subscription/checkout`
     - 프로덕션: `https://app.codingnplay.co.kr/subscription/checkout`

4. **API 키 복사**
   - **클라이언트 키** (Client Key): 프론트엔드에서 사용
   - **시크릿 키** (Secret Key): 백엔드에서 사용
   - ⚠️ 시크릿 키는 절대 프론트엔드에 노출하지 말 것

---

### Step 2: 환경 변수 설정

`.env` 파일에 Toss Payments API 키 추가:

```bash
# ========================================
# Toss Payments 설정
# ========================================
TOSS_CLIENT_KEY=test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq  # 테스트 키 (개발용)
TOSS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R  # 테스트 키 (개발용)
TOSS_MODE=test  # test 또는 production

# 프로덕션 배포 시:
# TOSS_CLIENT_KEY=live_ck_...  # 실제 발급받은 라이브 클라이언트 키
# TOSS_SECRET_KEY=live_sk_...  # 실제 발급받은 라이브 시크릿 키
# TOSS_MODE=production
```

---

### Step 3: NPM 패키지 설치

```bash
cd C:\Users\User\Documents\pioneer\educosmo

# Toss Payments SDK 설치
npm install @tosspayments/payment-sdk

# 또는 직접 브라우저 SDK 사용 (CDN 방식)
# <script src="https://js.tosspayments.com/v1/payment"></script>
```

---

### Step 4: 결제 페이지 수정

#### 4.1 Client-side 결제 위젯 초기화

`routes/subscriptionRouter.js`의 `/subscription/checkout` 라우트에서 `<script>` 부분 수정:

```javascript
<script src="https://js.tosspayments.com/v1/payment"></script>
<script>
    // Toss Payments 초기화
    const clientKey = '<%= process.env.TOSS_CLIENT_KEY %>';
    const tossPayments = TossPayments(clientKey);

    // 결제 처리
    document.getElementById('paymentForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!document.getElementById('agreeTerms').checked) {
            alert('구독 약관에 동의해주세요.');
            return;
        }

        const button = document.getElementById('paymentButton');
        button.disabled = true;
        button.textContent = '결제 처리 중...';

        const formData = new FormData(this);
        const orderId = 'ORDER_' + Date.now();
        const orderName = '${plan.displayName} 구독';
        const customerName = formData.get('customerName');
        const customerEmail = formData.get('customerEmail');

        try {
            // 결제 요청
            await tossPayments.requestPayment('카드', {
                amount: ${plan.price},
                orderId: orderId,
                orderName: orderName,
                customerName: customerName,
                customerEmail: customerEmail,
                successUrl: window.location.origin + '/subscription/payment/success',
                failUrl: window.location.origin + '/subscription/payment/fail',
            });
        } catch (error) {
            console.error('Payment error:', error);
            alert('결제 요청 중 오류가 발생했습니다: ' + error.message);
            button.disabled = false;
            button.textContent = '결제하기 (₩${plan.price.toLocaleString()})';
        }
    });
</script>
```

---

### Step 5: 결제 성공/실패 콜백 라우트 추가

`routes/subscriptionRouter.js`에 추가:

```javascript
// ========================================
// Toss Payments 결제 성공 콜백
// ========================================

router.get('/payment/success', requireLogin, requireCenterAdmin, async (req, res) => {
    try {
        const { paymentKey, orderId, amount } = req.query;

        if (!paymentKey || !orderId || !amount) {
            return res.status(400).send('잘못된 결제 요청입니다.');
        }

        // Toss Payments API로 결제 승인 요청
        const secretKey = process.env.TOSS_SECRET_KEY;
        const encodedKey = Buffer.from(secretKey + ':').toString('base64');

        const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${encodedKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                paymentKey: paymentKey,
                orderId: orderId,
                amount: parseInt(amount)
            })
        });

        const payment = await response.json();

        if (!response.ok) {
            console.error('Payment confirmation failed:', payment);
            return res.redirect('/subscription/payment/fail?message=' + encodeURIComponent(payment.message));
        }

        // 결제 성공 → center_subscriptions 업데이트
        const centerID = req.session.user.centerID;

        const updateQuery = `
            UPDATE center_subscriptions
            SET plan_type = 'standard',
                status = 'active',
                subscription_start_date = NOW(),
                subscription_end_date = DATE_ADD(NOW(), INTERVAL 30 DAY),
                next_billing_date = DATE_ADD(NOW(), INTERVAL 30 DAY),
                payment_method = 'card',
                last_payment_date = NOW(),
                last_payment_amount = ?
            WHERE centerID = ?
        `;
        await queryDatabase(updateQuery, [amount, centerID]);

        // 결제 내역 저장 (선택 사항)
        const insertPaymentQuery = `
            INSERT INTO center_payment_history
            (centerID, order_id, payment_key, amount, status, payment_method, created_at)
            VALUES (?, ?, ?, ?, 'completed', 'card', NOW())
        `;
        await queryDatabase(insertPaymentQuery, [centerID, orderId, paymentKey, amount]);

        // 성공 페이지로 리다이렉트
        res.redirect('/subscription/success?orderId=' + orderId);

    } catch (error) {
        console.error('Payment success callback error:', error);
        res.redirect('/subscription/payment/fail?message=' + encodeURIComponent('결제 처리 중 오류가 발생했습니다.'));
    }
});

// ========================================
// Toss Payments 결제 실패 콜백
// ========================================

router.get('/payment/fail', requireLogin, requireCenterAdmin, (req, res) => {
    const errorMessage = req.query.message || req.query.code || '결제가 취소되었습니다.';

    const title = '결제 실패';
    const body = `
        <style>
            .fail-container {
                max-width: 600px;
                margin: 100px auto;
                text-align: center;
                padding: 40px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .fail-icon {
                font-size: 5em;
                margin-bottom: 20px;
                color: #ff6b6b;
            }
            .fail-title {
                font-size: 2em;
                color: #333;
                margin-bottom: 10px;
            }
            .fail-message {
                font-size: 1.2em;
                color: #666;
                margin-bottom: 30px;
            }
            .fail-button {
                padding: 15px 40px;
                background: #667eea;
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-size: 1.1em;
                font-weight: bold;
                display: inline-block;
                transition: all 0.3s;
                margin: 0 10px;
            }
            .fail-button:hover {
                background: #5568d3;
            }
            .fail-button.secondary {
                background: #f0f0f0;
                color: #333;
            }
        </style>

        <div class="fail-container">
            <div class="fail-icon">❌</div>
            <h1 class="fail-title">결제 실패</h1>
            <p class="fail-message">
                ${errorMessage}
            </p>
            <a href="/subscription/checkout?plan=standard" class="fail-button">다시 시도</a>
            <a href="/subscription/plans" class="fail-button secondary">플랜 선택</a>
        </div>
    `;

    const html = template.HTML(title, body);
    res.send(html);
});
```

---

### Step 6: 결제 내역 테이블 생성 (선택 사항)

결제 내역을 저장하려면 DB 테이블 추가:

```sql
CREATE TABLE IF NOT EXISTS center_payment_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    centerID INT NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    payment_key VARCHAR(255),
    amount INT NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_centerID (centerID),
    INDEX idx_order_id (order_id),
    FOREIGN KEY (centerID) REFERENCES Centers(id) ON DELETE CASCADE
);
```

---

## 📝 테스트 가이드

### 개발 환경 테스트

1. **환경 변수 확인**
   ```bash
   TOSS_MODE=test
   TOSS_CLIENT_KEY=test_ck_...
   TOSS_SECRET_KEY=test_sk_...
   ```

2. **서버 재시작**
   ```bash
   npm start
   ```

3. **결제 테스트**
   - URL: https://app.codingnplay.co.kr/subscription/plans
   - "Standard 플랜" 선택
   - 결제 정보 입력:
     - 카드번호: `4000-0000-0000-0001` (테스트 카드)
     - 유효기간: 미래 날짜
     - CVC: 아무 3자리
   - 결제 완료 확인

### 테스트 카드 번호

Toss Payments 제공 테스트 카드:

| 카드사 | 카드번호 | 용도 |
|--------|----------|------|
| 테스트 성공 | 4000-0000-0000-0001 | 정상 결제 테스트 |
| 테스트 실패 | 4000-0000-0000-0002 | 결제 실패 테스트 |
| 테스트 거부 | 4000-0000-0000-0003 | 카드사 거부 테스트 |

---

## 🔐 보안 고려사항

### 1. 시크릿 키 보안

```javascript
// ❌ 절대 프론트엔드에 노출하지 말 것
// <script>const secretKey = '<%= process.env.TOSS_SECRET_KEY %>';</script>

// ✅ 백엔드에서만 사용
const secretKey = process.env.TOSS_SECRET_KEY;
```

### 2. 결제 금액 검증

```javascript
// 클라이언트에서 보낸 금액과 서버의 실제 플랜 금액 비교
const plan = PLANS[planId];
if (parseInt(amount) !== plan.price) {
    return res.status(400).json({ error: '결제 금액이 일치하지 않습니다.' });
}
```

### 3. 중복 결제 방지

```javascript
// orderId 중복 체크
const existingPayment = await queryDatabase(
    'SELECT id FROM center_payment_history WHERE order_id = ?',
    [orderId]
);

if (existingPayment.length > 0) {
    return res.status(400).json({ error: '이미 처리된 결제입니다.' });
}
```

---

## 🔄 정기 결제 (빌링키) 구현

### 개요

Standard 플랜은 매월 자동 결제가 필요합니다. Toss Payments의 **빌링키(Billing Key)** 기능 사용.

### 구현 방법

#### 1. 첫 결제 시 빌링키 발급

```javascript
// 첫 결제 시 billingKey 요청
await tossPayments.requestBillingAuth('카드', {
    customerKey: 'CENTER_' + centerID,  // 고유 고객 식별자
    successUrl: '/subscription/billing/success',
    failUrl: '/subscription/billing/fail'
});
```

#### 2. 빌링키 저장

```javascript
// 빌링키 저장 (DB)
const updateQuery = `
    UPDATE center_subscriptions
    SET billing_key = ?,
        billing_customer_key = ?
    WHERE centerID = ?
`;
await queryDatabase(updateQuery, [billingKey, customerKey, centerID]);
```

#### 3. Cron Job으로 정기 결제 실행

```javascript
// lib_cron/billingCron.js (신규 파일)
const cron = require('node-cron');

// 매일 새벽 2시에 실행
cron.schedule('0 2 * * *', async () => {
    console.log('📅 정기 결제 스케줄 시작');

    // 오늘 결제일인 구독 조회
    const query = `
        SELECT id, centerID, billing_key, billing_customer_key
        FROM center_subscriptions
        WHERE status = 'active'
          AND next_billing_date = CURDATE()
          AND billing_key IS NOT NULL
    `;
    const subscriptions = await queryDatabase(query);

    for (const sub of subscriptions) {
        try {
            // Toss Payments 빌링키 결제 API 호출
            const response = await fetch('https://api.tosspayments.com/v1/billing/' + sub.billing_key, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customerKey: sub.billing_customer_key,
                    amount: 110000,
                    orderId: 'AUTO_' + Date.now(),
                    orderName: 'Standard 플랜 월 구독',
                    customerEmail: '...',
                    customerName: '...'
                })
            });

            const payment = await response.json();

            if (response.ok) {
                // 결제 성공 → 다음 결제일 갱신
                await queryDatabase(`
                    UPDATE center_subscriptions
                    SET next_billing_date = DATE_ADD(next_billing_date, INTERVAL 30 DAY),
                        last_payment_date = NOW(),
                        last_payment_amount = 110000
                    WHERE id = ?
                `, [sub.id]);

                console.log(`✅ 센터 ${sub.centerID} 정기 결제 성공`);
            } else {
                console.error(`❌ 센터 ${sub.centerID} 정기 결제 실패:`, payment.message);

                // 결제 실패 → 센터에 알림 이메일 발송
                // TODO: sendPaymentFailureEmail(sub.centerID);
            }

        } catch (error) {
            console.error(`❌ 센터 ${sub.centerID} 정기 결제 오류:`, error);
        }
    }
});
```

---

## 📊 결제 관리 대시보드 (향후 추가)

### 센터 관리자용 결제 내역 페이지

```javascript
// GET /subscription/payments - 결제 내역 조회
router.get('/payments', requireLogin, requireCenterAdmin, async (req, res) => {
    const centerID = req.session.user.centerID;

    const paymentsQuery = `
        SELECT order_id, amount, status, payment_method, created_at
        FROM center_payment_history
        WHERE centerID = ?
        ORDER BY created_at DESC
        LIMIT 50
    `;
    const payments = await queryDatabase(paymentsQuery, [centerID]);

    // ... 결제 내역 UI 렌더링
});
```

---

## 🔗 참고 자료

- **Toss Payments 개발자 문서**: https://developers.tosspayments.com/
- **결제창 연동 가이드**: https://docs.tosspayments.com/guides/payment-widget/integration
- **빌링키 API**: https://docs.tosspayments.com/reference/billing
- **테스트 카드**: https://docs.tosspayments.com/resources/test-card

---

## ✅ 체크리스트

### Phase 2 완료 항목

- [x] 플랜 선택 페이지 UI
- [x] 결제 페이지 UI
- [x] 센터 대시보드 구독 상태 표시
- [x] Subscription Router 생성
- [x] server.js 라우터 등록

### Phase 2 남은 작업 (Toss Payments 실제 연동)

- [ ] Toss Payments 개발자 등록
- [ ] API 키 발급 (.env 추가)
- [ ] 결제 페이지에 Toss SDK 통합
- [ ] 결제 성공/실패 콜백 라우트 추가
- [ ] center_payment_history 테이블 생성
- [ ] 결제 테스트 (테스트 카드)
- [ ] 빌링키 발급 로직 추가
- [ ] 정기 결제 Cron Job 구현
- [ ] 결제 내역 페이지 추가

---

## 📞 문의

**구현 담당**: Claude Sonnet 4.5
**작성일**: 2026-01-22
**버전**: Phase 2 (UI 완료, 결제 연동 대기)
