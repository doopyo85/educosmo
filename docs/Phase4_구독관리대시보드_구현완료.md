# Phase 4: 구독 관리 대시보드 구현 완료

**작성일**: 2026-01-22
**상태**: 완료
**구현자**: Claude Sonnet 4.5

---

## 📋 구현 완료 항목

### 1. ✅ 구독 관리 대시보드 (`/subscription/manage`)

**파일**: `routes/subscriptionRouter.js`

**라우트**: `GET /subscription/manage`

**권한**: `requireCenterAdmin` (센터 관리자 전용)

**주요 기능**:

#### 1.1 현재 구독 정보 표시
- 플랜 타입 (Trial, Standard, Professional)
- 구독 상태 배지 (무료 체험 중, 활성, 일시 정지, 취소됨)
- 체험 종료일 / 다음 결제일
- 최근 결제 정보 (날짜 + 금액)

#### 1.2 액션 버튼
- **Trial 상태**: "플랜 선택하기"
- **Suspended 상태**: "구독 재개하기"
- **Active 상태**:
  - "플랜 변경"
  - "구독 취소"
- "대시보드로 돌아가기"

#### 1.3 결제 내역 테이블
- 최근 10건 표시
- 컬럼: 주문번호, 결제일, 금액, 결제수단, 상태
- 빈 상태 메시지 ("📭 결제 내역이 없습니다")

#### 1.4 센터 정보 표시
- 센터명
- 이메일
- 연락처

---

### 2. ✅ 구독 취소 API (`/subscription/cancel`)

**라우트**: `POST /subscription/cancel`

**권한**: `requireCenterAdmin`

**처리 로직**:
1. 현재 구독 조회
2. 상태 검증 (Trial, 이미 취소된 구독은 차단)
3. `center_subscriptions.status` → `'cancelled'`
4. 성공 응답 반환

**응답**:
```json
{
  "success": true,
  "message": "구독이 취소되었습니다. 다음 결제일까지는 서비스를 이용하실 수 있습니다."
}
```

**에러 처리**:
- 구독 정보 없음: 404
- Trial 취소 시도: 400 (불가)
- 이미 취소됨: 400

---

### 3. ✅ Teacher 대시보드 링크 업데이트

**파일**: `views/teacher.ejs` (Line 115)

**변경 사항**:
```html
<!-- 변경 전 -->
<a href="/subscription/plans" class="btn btn-light btn-sm w-100 mt-2">
    <i class="bi bi-gear me-1"></i>구독 관리
</a>

<!-- 변경 후 -->
<a href="/subscription/manage" class="btn btn-light btn-sm w-100 mt-2">
    <i class="bi bi-gear me-1"></i>구독 관리
</a>
```

**효과**: 사이드바 구독 카드의 "구독 관리" 버튼이 대시보드로 이동

---

## 🎨 UI 디자인

### 구독 관리 대시보드 Layout

```
+-----------------------------------------------+
|  ⚙️ 구독 관리                                 |
|  [센터명]                                      |
+-----------------------------------------------+
|                                               |
|  [현재 구독 카드]                              |
|  - 플랜: Standard                             |
|  - 상태: 활성 (초록 배지)                      |
|  - 다음 결제일: 2026-02-22                    |
|  - 최근 결제: 2026-01-22 (₩110,000)          |
|                                               |
|  [플랜 변경] [구독 취소] [대시보드로]          |
|                                               |
+-----------------------------------------------+
|                                               |
|  [결제 내역 카드]                              |
|  +-------------------------------------------+|
|  | 주문번호 | 결제일 | 금액 | 결제수단 | 상태 ||
|  |---------|-------|------|---------|------||
|  | ORDER_x | 01-22 | 110k | 카드    | 완료 ||
|  | ...     | ...   | ...  | ...     | ...  ||
|  +-------------------------------------------+|
|                                               |
+-----------------------------------------------+
|                                               |
|  [센터 정보 카드]                              |
|  - 센터명: 코딩앤플레이 본점                   |
|  - 이메일: center@example.com                |
|  - 연락처: 010-1234-5678                     |
|                                               |
+-----------------------------------------------+
```

### 색상 팔레트

- **상태 배지**:
  - Trial: `#fff3cd` (노란색 배경)
  - Active: `#d4edda` (초록색 배경)
  - Suspended: `#f8d7da` (빨간색 배경)

- **버튼**:
  - Primary: 보라색 그라데이션 (`#667eea` → `#764ba2`)
  - Secondary: 회색 (`#6c757d`)
  - Danger: 빨강 (`#dc3545`)

---

## 📊 데이터 흐름

### 1. 구독 정보 조회

```sql
-- 현재 구독
SELECT id, plan_type, status, trial_end_date,
       subscription_start_date, subscription_end_date,
       next_billing_date, last_payment_date, last_payment_amount
FROM center_subscriptions
WHERE centerID = ?
ORDER BY created_at DESC
LIMIT 1;

-- 센터 정보
SELECT center_name, contact_email, contact_phone
FROM Centers
WHERE id = ?;

-- 결제 내역 (최근 10건)
SELECT order_id, amount, status, payment_method, created_at
FROM center_payment_history
WHERE centerID = ?
ORDER BY created_at DESC
LIMIT 10;
```

### 2. 구독 취소

```sql
-- 현재 구독 조회
SELECT id, status, plan_type
FROM center_subscriptions
WHERE centerID = ?
ORDER BY created_at DESC
LIMIT 1;

-- 상태 업데이트
UPDATE center_subscriptions
SET status = 'cancelled', updated_at = NOW()
WHERE id = ?;
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 구독 관리 페이지 접속

**URL**: `https://app.codingnplay.co.kr/subscription/manage`

**전제 조건**:
- 센터 관리자(`center_admin`) 계정으로 로그인
- centerID가 있어야 함

**예상 결과**:
- 현재 구독 정보 표시
- 플랜 타입, 상태 배지
- 액션 버튼 (플랜 변경, 구독 취소)
- 결제 내역 테이블 (없으면 빈 상태 메시지)
- 센터 정보

### 시나리오 2: 구독 취소

**단계**:
1. `/subscription/manage` 접속
2. "구독 취소" 버튼 클릭
3. 확인 대화상자 → "확인" 클릭

**예상 결과**:
- "구독이 취소되었습니다" 알림
- 페이지 새로고침
- 구독 상태 배지 → "취소됨"
- 액션 버튼 숨김

**DB 확인**:
```sql
SELECT status FROM center_subscriptions WHERE centerID = 1;
-- 예상: status = 'cancelled'
```

### 시나리오 3: Trial 구독 취소 시도 (에러 케이스)

**단계**:
1. Trial 상태 센터로 로그인
2. "구독 취소" 버튼이 없음 (UI에서 숨김)
3. 직접 API 호출 시도 (`POST /subscription/cancel`)

**예상 결과**:
- 400 Bad Request
- `{ error: "Trial 구독은 취소할 수 없습니다." }`

### 시나리오 4: 결제 내역 표시

**전제 조건**:
- `center_payment_history` 테이블에 데이터 존재

**테스트 데이터 삽입**:
```sql
INSERT INTO center_payment_history
(centerID, order_id, amount, status, payment_method, created_at)
VALUES
(1, 'ORDER_001', 110000, 'completed', 'card', '2026-01-15'),
(1, 'ORDER_002', 110000, 'completed', 'card', '2026-01-22');
```

**예상 결과**:
- 결제 내역 테이블에 2건 표시
- 최근 날짜 순으로 정렬
- 금액 포맷: `₩110,000`
- 상태: "완료" (초록 배지)

---

## 🔄 사용자 흐름 (User Flow)

### Flow 1: Trial → Standard 구독

```
1. Teacher 대시보드 접속
   ↓
2. 사이드바 "구독 관리" 버튼 클릭
   ↓
3. 구독 관리 대시보드 표시
   - 현재: Trial (노란색 배지)
   - 체험 종료일: 7일 후
   ↓
4. "플랜 선택하기" 버튼 클릭
   ↓
5. /subscription/plans 페이지로 이동
   ↓
6. Standard 플랜 "선택하기" 클릭
   ↓
7. /subscription/checkout 페이지
   ↓
8. 결제 정보 입력 + 결제
   ↓
9. 결제 완료 → /subscription/success
   ↓
10. 구독 관리 대시보드로 돌아가기
    - 현재: Standard (초록색 배지)
    - 다음 결제일: 30일 후
```

### Flow 2: Active 구독 취소

```
1. 구독 관리 대시보드 접속
   - 현재: Standard (활성)
   ↓
2. "구독 취소" 버튼 클릭
   ↓
3. 확인 대화상자:
   "정말 구독을 취소하시겠습니까?
    다음 결제일까지는 서비스 이용 가능"
   ↓
4. "확인" 클릭
   ↓
5. POST /subscription/cancel 호출
   ↓
6. 성공 응답
   ↓
7. 알림: "구독이 취소되었습니다"
   ↓
8. 페이지 새로고침
   - 현재: Standard (취소됨, 빨간색 배지)
   - 액션 버튼 숨김
```

---

## 📂 파일 구조

```
educosmo/
├── routes/
│   └── subscriptionRouter.js          # ✏️ 수정 (Phase 4 추가)
│       - GET /subscription/manage     # 🔥 신규
│       - POST /subscription/cancel    # 🔥 신규
├── views/
│   └── teacher.ejs                    # ✏️ 수정 (링크 업데이트)
├── docs/
│   └── Phase4_구독관리대시보드_구현완료.md # 🔥 이 문서
```

---

## 🔐 보안 고려사항

### 1. 권한 체크

```javascript
// 센터 관리자만 접근 가능
router.get('/manage', requireLogin, requireCenterAdmin, ...);
router.post('/cancel', requireLogin, requireCenterAdmin, ...);
```

### 2. 센터 ID 검증

```javascript
// 세션의 centerID 사용 (사용자가 변조 불가)
const centerID = req.session.user.centerID;
```

### 3. 구독 취소 확인

```javascript
// 클라이언트에서 confirm() 대화상자
if (!confirm('정말 구독을 취소하시겠습니까?')) {
    return;
}

// 서버에서 상태 검증
if (subscription.status === 'trial') {
    return res.status(400).json({ error: 'Trial 구독은 취소할 수 없습니다.' });
}
```

---

## 🚀 향후 개선 사항

### 1. 결제 내역 페이지네이션

**현재**: 최근 10건만 표시
**개선**: 페이지 네이션 또는 "더 보기" 버튼

```javascript
const page = req.query.page || 1;
const limit = 10;
const offset = (page - 1) * limit;

const paymentsQuery = `
    SELECT ...
    FROM center_payment_history
    WHERE centerID = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`;
```

### 2. 구독 통계

**추가 카드**: 구독 요약 통계
- 총 결제 금액
- 평균 월 결제액
- 구독 시작일로부터 경과 일수

### 3. 결제 영수증 다운로드

**기능**: PDF 영수증 생성 및 다운로드

```javascript
router.get('/invoice/:orderId', async (req, res) => {
    // PDFKit으로 영수증 생성
    // ...
    res.download(pdfPath);
});
```

### 4. 이메일 알림 설정

**기능**: 결제 완료, 만료 알림 On/Off

```javascript
// center_subscriptions 테이블에 컬럼 추가
email_notification BOOLEAN DEFAULT TRUE
```

---

## 💡 사용자 가이드

### 구독 관리 대시보드 사용법

#### 1. 접근 방법
- Teacher 대시보드 사이드바 → "구독 관리" 버튼 클릭
- 또는 직접 URL 입력: `/subscription/manage`

#### 2. 플랜 변경
1. "플랜 변경" 버튼 클릭
2. 원하는 플랜 선택
3. 결제 진행
4. 다음 결제일부터 새 플랜 적용

#### 3. 구독 취소
1. "구독 취소" 버튼 클릭
2. 확인 대화상자에서 "확인"
3. 다음 결제일까지는 서비스 이용 가능
4. 다음 결제일 이후 교육 콘텐츠 접근 제한

#### 4. 결제 내역 확인
- 대시보드 중간의 "결제 내역" 카드에서 확인
- 최근 10건 표시
- 주문번호, 결제일, 금액, 결제수단, 상태

---

## 📞 문의 및 지원

**구현 완료**: 2026-01-22

**관련 문서**:
- `docs/# 센터개설 및 결제모듈 구현계획.txt` - 전체 계획
- `docs/Phase2_구독결제시스템_구현완료.md` - 결제 UI
- `docs/Phase3_Trial만료처리_구현완료.md` - Trial 만료
- `docs/Toss_Payments_연동_가이드.md` - 결제 연동

---

## ✅ Phase 4 완료 체크리스트

- [x] 구독 관리 대시보드 UI (`GET /subscription/manage`)
- [x] 현재 구독 정보 표시
- [x] 결제 내역 테이블 (최근 10건)
- [x] 센터 정보 표시
- [x] 구독 취소 API (`POST /subscription/cancel`)
- [x] 구독 취소 확인 대화상자
- [x] 상태별 액션 버튼 (Trial/Active/Suspended)
- [x] Teacher 대시보드 링크 업데이트
- [x] 권한 체크 (requireCenterAdmin)
- [x] Phase 4 구현 완료 문서

**Phase 4 상태**: ✅ 완료

---

## 🎉 전체 Phase 구현 완료

### Phase 1: 학생 초대 코드 가입 ✅
### Phase 2: 구독 결제 시스템 UI ✅
### Phase 3: Trial 만료 처리 ✅
### Phase 4: 구독 관리 대시보드 ✅

**남은 작업 (실제 연동)**:
- Toss Payments API 연동
- NCP SMS 인증 활성화
- 빌링키 발급 및 정기 결제 Cron

모든 UI와 로직이 완성되었으며, 외부 서비스 연동만 남았습니다!
