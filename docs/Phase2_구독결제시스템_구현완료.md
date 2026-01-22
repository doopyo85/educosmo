# Phase 2: 구독 결제 시스템 구현 완료

**작성일**: 2026-01-22
**상태**: UI 완료, Toss Payments 연동 준비 완료
**구현자**: Claude Sonnet 4.5

---

## 📋 구현 완료 항목

### 1. ✅ Subscription Router (`routes/subscriptionRouter.js`)

**파일 위치**: `C:\Users\User\Documents\pioneer\educosmo\routes\subscriptionRouter.js`

**구현된 라우트**:

| 메소드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/subscription/plans` | 플랜 선택 페이지 | requireCenterAdmin |
| GET | `/subscription/checkout` | 결제 페이지 | requireCenterAdmin |
| POST | `/subscription/process-payment` | 결제 처리 (모의) | requireCenterAdmin |
| GET | `/subscription/success` | 결제 완료 페이지 | requireCenterAdmin |

**플랜 정보**:
```javascript
const PLANS = {
    trial: {
        price: 0,
        duration: 14,
        displayName: '무료 체험'
    },
    standard: {
        price: 110000,
        duration: 30,
        displayName: 'Standard 플랜'
    },
    professional: {
        price: 0,
        duration: 365,
        displayName: 'Professional 플랜' // 프랜차이즈 전용
    }
};
```

---

### 2. ✅ 플랜 선택 페이지 UI (`/subscription/plans`)

**주요 기능**:
- 3가지 플랜 카드 디스플레이 (Trial, Standard, Professional)
- 현재 구독 상태 배너 표시
- 현재 플랜 강조 표시
- Standard 플랜에 "추천" 배지
- 반응형 그리드 레이아웃
- 플랜별 기능 목록 표시
- 제한 사항 표시

**디자인 특징**:
- 그라데이션 배경 (보라색 계열)
- 호버 애니메이션
- 카드 그림자 효과
- 모바일 최적화

**스크린샷 예상 요소**:
```
+----------------------------------+
|    🚀 플랜 선택                  |
|    센터에 맞는 최적의 플랜 선택   |
+----------------------------------+
|  현재 플랜: Trial               |
|  상태: 무료 체험 | 종료: 2026-02-05|
+----------------------------------+
|  [무료 체험]  [Standard ⭐]  [Professional] |
|   14일          ₩110,000/월      프랜차이즈   |
|  [체험 전용]   [선택하기]      [문의하기]    |
+----------------------------------+
```

---

### 3. ✅ 결제 페이지 UI (`/subscription/checkout`)

**주요 기능**:
- 주문 정보 요약 섹션
  - 플랜명, 기간, 센터명, 구독자
  - 총 결제 금액 강조
- 결제 수단 선택
  - 카드 결제 / 계좌 이체
  - 라디오 버튼 UI
- 고객 정보 입력 폼
  - 이름, 이메일, 연락처
  - 기본값: 센터 정보 자동 입력
- 구독 약관 동의 체크박스
- 결제 버튼 (중복 방지)

**UI 레이아웃**:
```
+-------------------------------------+
|         💳 결제하기                 |
|    Standard 플랜 구독을 시작합니다   |
+-------------------------------------+
|  📋 주문 정보    |   💳 결제 수단    |
|  - 플랜: Standard |   [💳 카드결제]   |
|  - 센터: 테스트센터|   [🏦 계좌이체]   |
|  - 총액: ₩110,000 |   이름: _____     |
|                   |   이메일: _____    |
|                   |   연락처: _____    |
|                   |   □ 약관 동의      |
|                   |   [결제하기]       |
+-------------------------------------+
```

---

### 4. ✅ 센터 대시보드 구독 상태 카드

**파일 수정**:
- `routes/teacherRouter.js` - GET `/` 라우트에 구독 정보 조회 추가
- `views/teacher.ejs` - 사이드바에 구독 상태 카드 추가

**표시 정보**:
- 구독 상태 배지 (무료체험 / 활성 / 일시정지 / 취소됨)
- 플랜 타입 (Trial / Standard / Professional)
- 다음 결제일 또는 체험 종료일
- "구독 관리" 버튼 → `/subscription/plans` 이동

**UI 코드** (`views/teacher.ejs`):
```html
<div class="subscription-status-card mt-3 p-3"
     style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div class="fw-bold">🌟 구독 상태</div>
    <div class="badge">활성</div>
    <div>Standard 플랜</div>
    <div>다음 결제: 2026-02-22</div>
    <a href="/subscription/plans" class="btn btn-light btn-sm w-100">
        ⚙️ 구독 관리
    </a>
</div>
```

---

### 5. ✅ server.js 라우터 등록

**파일**: `server.js` (Line 588)

**변경 사항**:
```javascript
const routes = {
  // ... 기존 라우터들
  's3': require('./routes/s3Router'),  // 🔥 통합 S3 브라우저
  'subscription': require('./routes/subscriptionRouter')  // 🔥 센터 구독 관리 (신규)
};
```

**접근 경로**:
- `https://app.codingnplay.co.kr/subscription/plans`
- `https://app.codingnplay.co.kr/subscription/checkout`

---

## 🎨 UI 디자인 컨셉

### 색상 팔레트
- **Primary**: 보라색 그라데이션 (`#667eea` → `#764ba2`)
- **Secondary**: 화이트 / 라이트 그레이
- **Accent**: 골드 (`#ffd700`) - 추천 배지
- **Success**: 그린 (`#4caf50`) - 체크마크
- **Warning**: 오렌지 (`#ff9800`) - 제한사항

### 타이포그래피
- **제목**: 2.5em, 볼드
- **가격**: 2.5em, 보라색, 볼드
- **본문**: 1em, 일반

### 애니메이션
- **호버**: `transform: translateY(-5px)` + 그림자 효과
- **버튼 호버**: `transform: scale(1.05)`
- **트랜지션**: `all 0.3s`

---

## 📂 파일 구조

```
educosmo/
├── routes/
│   └── subscriptionRouter.js          # 🔥 신규 생성
├── views/
│   └── teacher.ejs                     # ✏️ 수정 (구독 카드 추가)
├── lib_login/
│   └── accessControl.js                # requireCenterAdmin 미들웨어 사용
├── docs/
│   ├── Toss_Payments_연동_가이드.md     # 🔥 신규 생성
│   └── Phase2_구독결제시스템_구현완료.md # 🔥 이 문서
└── server.js                           # ✏️ 수정 (라우터 등록)
```

---

## 🚀 테스트 방법

### 1. 서버 실행

```bash
cd C:\Users\User\Documents\pioneer\educosmo
npm start
```

### 2. 플랜 선택 페이지 접속

```
URL: https://app.codingnplay.co.kr/subscription/plans

전제 조건:
- 센터 관리자(center_admin) 계정으로 로그인
- centerID가 있어야 함
```

**예상 결과**:
- 3개의 플랜 카드 표시
- 현재 구독 상태 배너 (DB에 center_subscriptions 데이터 있을 경우)
- Standard 플랜에 "추천" 배지
- Trial/Professional 플랜 버튼 비활성화

### 3. 결제 페이지 접속

```
URL: https://app.codingnplay.co.kr/subscription/checkout?plan=standard
```

**예상 결과**:
- 주문 정보 요약 (Standard 플랜, ₩110,000)
- 결제 수단 선택 UI (카드/계좌이체)
- 고객 정보 자동 입력 (센터 정보)
- 결제하기 버튼

### 4. 모의 결제 테스트

1. 약관 동의 체크
2. "결제하기" 버튼 클릭
3. **현재**: 모의 결제 → center_subscriptions 업데이트
4. **예상 결과**: `/subscription/success` 페이지 리다이렉트

**DB 확인**:
```sql
SELECT plan_type, status, subscription_start_date, subscription_end_date
FROM center_subscriptions
WHERE centerID = 1;

-- 예상:
-- plan_type: 'standard'
-- status: 'active'
-- subscription_end_date: 30일 후
```

### 5. 센터 대시보드 확인

```
URL: https://app.codingnplay.co.kr/teacher
```

**예상 결과**:
- 사이드바 하단에 보라색 그라데이션 구독 카드 표시
- 플랜 정보, 상태, 다음 결제일
- "구독 관리" 버튼

---

## 🔧 다음 단계: Toss Payments 실제 연동

### Phase 2 남은 작업

Phase 2 UI는 완료되었으며, 실제 Toss Payments 연동을 위해 다음 작업이 필요합니다:

1. **Toss Payments 개발자 등록**
   - 사업자등록번호 입력
   - 정산 계좌 등록

2. **API 키 발급**
   - 클라이언트 키 (프론트엔드용)
   - 시크릿 키 (백엔드용)
   - `.env` 파일에 추가

3. **결제 페이지에 Toss SDK 통합**
   - `<script src="https://js.tosspayments.com/v1/payment"></script>` 추가
   - `TossPayments(clientKey)` 초기화
   - `requestPayment()` 호출

4. **결제 성공/실패 콜백 라우트 추가**
   - `GET /subscription/payment/success`
   - `GET /subscription/payment/fail`
   - Toss API로 결제 승인 요청

5. **center_payment_history 테이블 생성**
   - 결제 내역 저장용 테이블

6. **빌링키 발급 로직**
   - 첫 결제 시 빌링키 요청
   - 정기 결제용

7. **정기 결제 Cron Job**
   - 매일 새벽 2시 실행
   - 다음 결제일 도래한 구독 자동 결제

**상세 가이드**: `docs/Toss_Payments_연동_가이드.md` 참조

---

## 📊 데이터베이스 스키마

### center_subscriptions 테이블 (기존)

```sql
CREATE TABLE center_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    centerID INT NOT NULL,
    plan_type ENUM('trial', 'standard', 'professional') DEFAULT 'trial',
    status ENUM('trial', 'active', 'suspended', 'cancelled') DEFAULT 'trial',
    trial_end_date DATE,
    subscription_start_date DATE,
    subscription_end_date DATE,
    next_billing_date DATE,
    billing_key VARCHAR(255),              -- Toss 빌링키
    billing_customer_key VARCHAR(255),     -- 고객 키
    payment_method VARCHAR(50),
    last_payment_date TIMESTAMP,
    last_payment_amount INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (centerID) REFERENCES Centers(id) ON DELETE CASCADE
);
```

### center_payment_history 테이블 (추가 필요)

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

## 🔐 보안 체크리스트

- [x] requireCenterAdmin 미들웨어 적용
- [x] 결제 금액 서버 측 검증 (PLANS 상수)
- [x] 약관 동의 체크 (프론트엔드)
- [x] 중복 결제 방지 (버튼 disabled)
- [ ] orderId 중복 체크 (DB)
- [ ] 시크릿 키 환경 변수 관리
- [ ] HTTPS 강제 (프로덕션)
- [ ] CSRF 토큰 (향후 추가)

---

## 📈 성능 최적화

### 현재 구현
- 구독 정보 쿼리: 1회 (teacher 메인 페이지)
- 플랜 정보: 상수로 정의 (DB 쿼리 불필요)
- CSS: 인라인 스타일 (추후 외부 파일로 분리 가능)

### 향후 개선
- 구독 정보 캐싱 (Redis)
- CSS 파일 분리 (`/css/subscription.css`)
- 이미지 최적화 (플랜 아이콘)

---

## 🐛 알려진 이슈 및 제한사항

### 이슈 1: 모의 결제만 가능
- **현상**: Toss Payments 연동 전이므로 실제 결제 불가
- **대응**: `POST /subscription/process-payment`가 모의 결제 처리
- **해결**: Toss SDK 통합 후 실제 결제 가능

### 이슈 2: Professional 플랜 자동 가입 불가
- **현상**: Professional은 프랜차이즈 전용이므로 버튼 비활성화
- **대응**: "문의하기" 알럿 표시 (`070-4337-4337`)
- **해결**: 관리자가 수동으로 DB에서 플랜 변경

### 이슈 3: 정기 결제 미구현
- **현상**: 매월 자동 결제 기능 없음
- **대응**: 현재는 수동 결제만 가능
- **해결**: 빌링키 + Cron Job 구현 필요

---

## 📞 문의 및 지원

**구현 완료**: 2026-01-22
**다음 Phase**: Phase 3 (Trial 만료 처리 Cron Job)

**관련 문서**:
- `docs/# 센터개설 및 결제모듈 구현계획.txt` - 전체 구현 계획
- `docs/Toss_Payments_연동_가이드.md` - 결제 연동 상세 가이드
- `docs/학생_초대코드_가입_테스트.md` - Phase 1 테스트 가이드

---

## ✅ Phase 2 완료 체크리스트

- [x] Subscription Router 생성
- [x] 플랜 선택 페이지 UI
- [x] 결제 페이지 UI
- [x] 결제 완료 페이지 UI
- [x] 센터 대시보드 구독 카드
- [x] server.js 라우터 등록
- [x] Toss Payments 연동 가이드 문서
- [x] Phase 2 구현 완료 문서

**Phase 2 상태**: ✅ UI 완료, Toss Payments 연동 준비 완료
