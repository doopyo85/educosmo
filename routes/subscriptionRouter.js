/**
 * 센터 구독 관리 라우터
 * - 플랜 선택 페이지
 * - 결제 페이지
 * - 구독 관리 (업그레이드, 다운그레이드, 취소)
 */

const express = require('express');
const router = express.Router();
const template = require('../lib_login/template.js');
const { queryDatabase } = require('../lib_login/db');
const { requireLogin, requireCenterAdmin } = require('../lib_login/accessControl');

// ========================================
// 플랜 정보 (가격표)
// ========================================

const PLANS = {
    trial: {
        id: 'trial',
        name: 'Trial',
        displayName: '무료 체험',
        price: 0,
        duration: 14,
        features: [
            '14일 무료 체험',
            '모든 교육 콘텐츠 접근',
            '센터 공동 저장소 30GB',
            '학생 수 무제한',
            '초대 코드 생성',
            '센터 클라우드보드'
        ],
        limitations: [
            '14일 후 자동 만료'
        ]
    },
    standard: {
        id: 'standard',
        name: 'Standard',
        displayName: 'Standard 플랜',
        price: 110000,
        duration: 30,
        features: [
            '모든 교육 콘텐츠 접근',
            '센터 공동 저장소 30GB',
            '학생 수 무제한',
            '초대 코드 무제한 생성',
            '센터 클라우드보드',
            'Teacher Dashboard',
            '학생 진도 추적',
            '과제 관리',
            '센터 통계/분석'
        ],
        limitations: []
    },
    professional: {
        id: 'professional',
        name: 'Professional',
        displayName: 'Professional 플랜',
        price: 0,
        duration: 365,
        features: [
            '1년 무료 (프랜차이즈 전용)',
            '모든 Standard 기능',
            '센터 공동 저장소 100GB',
            '우선 기술 지원',
            '커스텀 도메인 지원',
            '전용 교육 자료 제공'
        ],
        limitations: [
            '프랜차이즈 가맹점 전용'
        ]
    }
};

// ========================================
// 플랜 선택 페이지
// ========================================

router.get('/plans', requireLogin, requireCenterAdmin, async (req, res) => {
    try {
        const centerID = req.session.user.centerID;

        // 현재 구독 정보 조회
        const subscriptionQuery = `
            SELECT id, plan_type, status, trial_end_date, subscription_start_date,
                   subscription_end_date, next_billing_date
            FROM center_subscriptions
            WHERE centerID = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const [currentSubscription] = await queryDatabase(subscriptionQuery, [centerID]);

        const title = '플랜 선택';
        const body = `
            <style>
                .plans-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }
                .plans-header {
                    text-align: center;
                    margin-bottom: 50px;
                }
                .plans-header h1 {
                    font-size: 2.5em;
                    margin-bottom: 10px;
                    color: #333;
                }
                .plans-header p {
                    font-size: 1.2em;
                    color: #666;
                }
                .current-plan-banner {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                    text-align: center;
                }
                .plans-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 30px;
                    margin-bottom: 40px;
                }
                .plan-card {
                    background: white;
                    border: 2px solid #e0e0e0;
                    border-radius: 15px;
                    padding: 30px;
                    transition: all 0.3s;
                    position: relative;
                }
                .plan-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                .plan-card.current {
                    border-color: #667eea;
                    box-shadow: 0 5px 20px rgba(102, 126, 234, 0.3);
                }
                .plan-card.recommended {
                    border-color: #ffd700;
                    border-width: 3px;
                }
                .plan-badge {
                    position: absolute;
                    top: -15px;
                    right: 20px;
                    background: #ffd700;
                    color: #333;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-weight: bold;
                    font-size: 0.9em;
                }
                .plan-badge.current {
                    background: #667eea;
                    color: white;
                }
                .plan-name {
                    font-size: 1.8em;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #333;
                }
                .plan-price {
                    font-size: 2.5em;
                    font-weight: bold;
                    color: #667eea;
                    margin-bottom: 5px;
                }
                .plan-price .currency {
                    font-size: 0.5em;
                    vertical-align: super;
                }
                .plan-price .period {
                    font-size: 0.4em;
                    color: #999;
                    font-weight: normal;
                }
                .plan-duration {
                    color: #666;
                    margin-bottom: 20px;
                    font-size: 1.1em;
                }
                .plan-features {
                    list-style: none;
                    padding: 0;
                    margin: 20px 0;
                }
                .plan-features li {
                    padding: 10px 0;
                    border-bottom: 1px solid #f0f0f0;
                    display: flex;
                    align-items: center;
                }
                .plan-features li:before {
                    content: "✓";
                    color: #4caf50;
                    font-weight: bold;
                    margin-right: 10px;
                    font-size: 1.2em;
                }
                .plan-limitations {
                    list-style: none;
                    padding: 0;
                    margin: 20px 0;
                }
                .plan-limitations li {
                    padding: 10px 0;
                    display: flex;
                    align-items: center;
                    color: #ff9800;
                }
                .plan-limitations li:before {
                    content: "⚠";
                    margin-right: 10px;
                    font-size: 1.2em;
                }
                .plan-button {
                    width: 100%;
                    padding: 15px;
                    border: none;
                    border-radius: 8px;
                    font-size: 1.1em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-top: 20px;
                }
                .plan-button.primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .plan-button.primary:hover {
                    transform: scale(1.05);
                }
                .plan-button.secondary {
                    background: #f0f0f0;
                    color: #666;
                }
                .plan-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            </style>

            <div class="plans-container">
                <div class="plans-header">
                    <h1>🚀 플랜 선택</h1>
                    <p>센터에 맞는 최적의 플랜을 선택하세요</p>
                </div>

                ${currentSubscription ? `
                    <div class="current-plan-banner">
                        <h2>현재 플랜: ${PLANS[currentSubscription.plan_type]?.displayName || currentSubscription.plan_type}</h2>
                        <p>상태: ${getStatusText(currentSubscription.status)} |
                        ${currentSubscription.status === 'trial'
                            ? `체험 종료: ${formatDate(currentSubscription.trial_end_date)}`
                            : `다음 결제일: ${formatDate(currentSubscription.next_billing_date)}`
                        }</p>
                    </div>
                ` : ''}

                <div class="plans-grid">
                    ${Object.values(PLANS).map(plan => `
                        <div class="plan-card ${currentSubscription?.plan_type === plan.id ? 'current' : ''} ${plan.id === 'standard' ? 'recommended' : ''}">
                            ${currentSubscription?.plan_type === plan.id
                                ? '<span class="plan-badge current">현재 플랜</span>'
                                : plan.id === 'standard'
                                    ? '<span class="plan-badge">추천</span>'
                                    : ''
                            }
                            <div class="plan-name">${plan.displayName}</div>
                            <div class="plan-price">
                                ${plan.price === 0
                                    ? '무료'
                                    : `<span class="currency">₩</span>${plan.price.toLocaleString()}<span class="period">/월</span>`
                                }
                            </div>
                            <div class="plan-duration">${plan.duration}일</div>

                            <ul class="plan-features">
                                ${plan.features.map(f => `<li>${f}</li>`).join('')}
                            </ul>

                            ${plan.limitations.length > 0 ? `
                                <ul class="plan-limitations">
                                    ${plan.limitations.map(l => `<li>${l}</li>`).join('')}
                                </ul>
                            ` : ''}

                            ${getButtonHTML(plan, currentSubscription)}
                        </div>
                    `).join('')}
                </div>

                <div style="text-align: center; margin-top: 40px;">
                    <a href="/center/dashboard" style="color: #667eea; text-decoration: none;">← 대시보드로 돌아가기</a>
                </div>
            </div>

            <script>
                function selectPlan(planId) {
                    if (planId === 'trial') {
                        alert('Trial 플랜은 센터 개설 시 자동으로 제공됩니다.');
                        return;
                    }
                    if (planId === 'professional') {
                        alert('Professional 플랜은 프랜차이즈 가맹점 전용입니다. 문의: 070-4337-4337');
                        return;
                    }
                    // Standard 플랜 선택 → 결제 페이지로 이동
                    window.location.href = '/subscription/checkout?plan=' + planId;
                }
            </script>
        `;

        const html = template.HTML(title, body);
        res.send(html);

    } catch (error) {
        console.error('Error loading plans:', error);
        res.status(500).send('플랜 정보를 불러오는 중 오류가 발생했습니다.');
    }
});

// ========================================
// 결제 페이지 (Checkout)
// ========================================

router.get('/checkout', requireLogin, requireCenterAdmin, async (req, res) => {
    try {
        const planId = req.query.plan || 'standard';
        const plan = PLANS[planId];

        if (!plan) {
            return res.status(404).send('존재하지 않는 플랜입니다.');
        }

        const centerID = req.session.user.centerID;
        const user = req.session.user;

        // 센터 정보 조회
        const centerQuery = `SELECT center_name, contact_email, contact_phone FROM Centers WHERE id = ?`;
        const [center] = await queryDatabase(centerQuery, [centerID]);

        const title = '결제하기';
        const body = `
            <style>
                .checkout-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }
                .checkout-header {
                    text-align: center;
                    margin-bottom: 40px;
                }
                .checkout-header h1 {
                    font-size: 2em;
                    color: #333;
                    margin-bottom: 10px;
                }
                .checkout-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                }
                .checkout-section {
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .section-title {
                    font-size: 1.5em;
                    font-weight: bold;
                    margin-bottom: 20px;
                    color: #333;
                    border-bottom: 2px solid #667eea;
                    padding-bottom: 10px;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 15px 0;
                    border-bottom: 1px solid #f0f0f0;
                }
                .info-label {
                    color: #666;
                    font-weight: 500;
                }
                .info-value {
                    color: #333;
                    font-weight: bold;
                }
                .total-price {
                    font-size: 2em;
                    color: #667eea;
                    text-align: right;
                    margin-top: 20px;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    color: #333;
                    font-weight: 500;
                }
                .form-group input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-size: 1em;
                    box-sizing: border-box;
                }
                .payment-method {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .payment-option {
                    padding: 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .payment-option:hover {
                    border-color: #667eea;
                    background: #f5f7ff;
                }
                .payment-option.selected {
                    border-color: #667eea;
                    background: #f5f7ff;
                }
                .payment-option input[type="radio"] {
                    display: none;
                }
                .payment-icon {
                    font-size: 2em;
                    margin-bottom: 10px;
                }
                .agreement {
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .agreement label {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                }
                .agreement input[type="checkbox"] {
                    margin-right: 10px;
                    width: 18px;
                    height: 18px;
                }
                .checkout-button {
                    width: 100%;
                    padding: 18px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 1.3em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .checkout-button:hover {
                    transform: scale(1.02);
                }
                .checkout-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .notice {
                    background: #fff3cd;
                    color: #856404;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-size: 0.9em;
                }

                @media (max-width: 768px) {
                    .checkout-content {
                        grid-template-columns: 1fr;
                    }
                }
            </style>

            <div class="checkout-container">
                <div class="checkout-header">
                    <h1>💳 결제하기</h1>
                    <p>${plan.displayName} 구독을 시작합니다</p>
                </div>

                <div class="checkout-content">
                    <!-- 주문 정보 -->
                    <div class="checkout-section">
                        <div class="section-title">📋 주문 정보</div>

                        <div class="info-row">
                            <span class="info-label">플랜</span>
                            <span class="info-value">${plan.displayName}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">기간</span>
                            <span class="info-value">${plan.duration}일</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">센터명</span>
                            <span class="info-value">${center.center_name}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">구독자</span>
                            <span class="info-value">${user.name}</span>
                        </div>

                        <div class="total-price">
                            ₩${plan.price.toLocaleString()}
                        </div>

                        <div class="notice">
                            💡 매월 자동 결제됩니다. 언제든지 취소 가능합니다.
                        </div>
                    </div>

                    <!-- 결제 수단 -->
                    <div class="checkout-section">
                        <div class="section-title">💳 결제 수단</div>

                        <form id="paymentForm">
                            <div class="payment-method">
                                <label class="payment-option selected">
                                    <input type="radio" name="paymentMethod" value="card" checked>
                                    <div class="payment-icon">💳</div>
                                    <div>카드 결제</div>
                                </label>
                                <label class="payment-option">
                                    <input type="radio" name="paymentMethod" value="transfer">
                                    <div class="payment-icon">🏦</div>
                                    <div>계좌 이체</div>
                                </label>
                            </div>

                            <div class="form-group">
                                <label>이름</label>
                                <input type="text" name="customerName" value="${user.name}" required>
                            </div>

                            <div class="form-group">
                                <label>이메일 (영수증 발송)</label>
                                <input type="email" name="customerEmail" value="${center.contact_email || ''}" required>
                            </div>

                            <div class="form-group">
                                <label>연락처</label>
                                <input type="tel" name="customerPhone" value="${center.contact_phone || ''}" required>
                            </div>

                            <div class="agreement">
                                <label>
                                    <input type="checkbox" id="agreeTerms" required>
                                    <span>구독 약관 및 자동 결제에 동의합니다</span>
                                </label>
                            </div>

                            <button type="submit" class="checkout-button" id="paymentButton">
                                결제하기 (₩${plan.price.toLocaleString()})
                            </button>
                        </form>

                        <div style="text-align: center; margin-top: 20px;">
                            <a href="/subscription/plans" style="color: #667eea; text-decoration: none;">← 플랜 선택으로 돌아가기</a>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                // 결제 수단 선택 UI
                document.querySelectorAll('.payment-option').forEach(option => {
                    option.addEventListener('click', function() {
                        document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
                        this.classList.add('selected');
                        this.querySelector('input[type="radio"]').checked = true;
                    });
                });

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
                    const data = {
                        planId: '${planId}',
                        customerName: formData.get('customerName'),
                        customerEmail: formData.get('customerEmail'),
                        customerPhone: formData.get('customerPhone'),
                        paymentMethod: formData.get('paymentMethod')
                    };

                    try {
                        // TODO: Toss Payments 연동
                        // 현재는 모의 결제 처리
                        const response = await fetch('/subscription/process-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();

                        if (result.success) {
                            alert('결제가 완료되었습니다!');
                            window.location.href = '/subscription/success?orderId=' + result.orderId;
                        } else {
                            alert('결제 실패: ' + result.error);
                            button.disabled = false;
                            button.textContent = '결제하기 (₩${plan.price.toLocaleString()})';
                        }
                    } catch (error) {
                        console.error('Payment error:', error);
                        alert('결제 처리 중 오류가 발생했습니다.');
                        button.disabled = false;
                        button.textContent = '결제하기 (₩${plan.price.toLocaleString()})';
                    }
                });
            </script>
        `;

        const html = template.HTML(title, body);
        res.send(html);

    } catch (error) {
        console.error('Error loading checkout:', error);
        res.status(500).send('결제 페이지를 불러오는 중 오류가 발생했습니다.');
    }
});

// ========================================
// 결제 처리 API (모의 결제 - Toss Payments 연동 전)
// ========================================

router.post('/process-payment', requireLogin, requireCenterAdmin, async (req, res) => {
    try {
        const { planId, customerName, customerEmail, customerPhone, paymentMethod } = req.body;
        const centerID = req.session.user.centerID;

        // TODO: Toss Payments API 호출
        // 현재는 모의 결제로 처리

        const orderId = 'ORDER_' + Date.now();

        // center_subscriptions 업데이트
        const updateQuery = `
            UPDATE center_subscriptions
            SET plan_type = ?,
                status = 'active',
                subscription_start_date = NOW(),
                subscription_end_date = DATE_ADD(NOW(), INTERVAL 30 DAY),
                next_billing_date = DATE_ADD(NOW(), INTERVAL 30 DAY)
            WHERE centerID = ?
        `;
        await queryDatabase(updateQuery, [planId, centerID]);

        res.json({
            success: true,
            orderId: orderId,
            message: '결제가 완료되었습니다.'
        });

    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({
            success: false,
            error: '결제 처리 중 오류가 발생했습니다.'
        });
    }
});

// ========================================
// 결제 성공 페이지
// ========================================

router.get('/success', requireLogin, requireCenterAdmin, (req, res) => {
    const orderId = req.query.orderId;

    const title = '결제 완료';
    const body = `
        <style>
            .success-container {
                max-width: 600px;
                margin: 100px auto;
                text-align: center;
                padding: 40px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .success-icon {
                font-size: 5em;
                margin-bottom: 20px;
            }
            .success-title {
                font-size: 2em;
                color: #333;
                margin-bottom: 10px;
            }
            .success-message {
                font-size: 1.2em;
                color: #666;
                margin-bottom: 30px;
            }
            .order-id {
                background: #f0f0f0;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 30px;
                font-family: monospace;
            }
            .success-button {
                padding: 15px 40px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-size: 1.1em;
                font-weight: bold;
                display: inline-block;
                transition: all 0.3s;
            }
            .success-button:hover {
                transform: scale(1.05);
            }
        </style>

        <div class="success-container">
            <div class="success-icon">🎉</div>
            <h1 class="success-title">결제 완료!</h1>
            <p class="success-message">
                구독이 성공적으로 활성화되었습니다.<br>
                이제 모든 기능을 자유롭게 사용하실 수 있습니다.
            </p>
            <div class="order-id">
                주문번호: ${orderId}
            </div>
            <a href="/center/dashboard" class="success-button">대시보드로 이동</a>
        </div>
    `;

    const html = template.HTML(title, body);
    res.send(html);
});

// ========================================
// Phase 4: 구독 관리 대시보드
// ========================================

router.get('/manage', requireLogin, requireCenterAdmin, async (req, res) => {
    try {
        const centerID = req.session.user.centerID;

        // 현재 구독 정보
        const subscriptionQuery = `
            SELECT id, plan_type, status, trial_end_date, subscription_start_date,
                   subscription_end_date, next_billing_date, last_payment_date, last_payment_amount
            FROM center_subscriptions
            WHERE centerID = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const [subscription] = await queryDatabase(subscriptionQuery, [centerID]);

        // 센터 정보
        const centerQuery = `SELECT center_name, contact_email, contact_phone, unique_code FROM Centers WHERE id = ?`;
        const [center] = await queryDatabase(centerQuery, [centerID]);

        if (!center) {
            return res.status(404).send('센터 정보를 찾을 수 없습니다.');
        }

        // 결제 내역 (최근 10건)
        const paymentsQuery = `
            SELECT order_id, amount, status, payment_method, created_at
            FROM center_payment_history
            WHERE centerID = ?
            ORDER BY created_at DESC
            LIMIT 10
        `;
        const payments = await queryDatabase(paymentsQuery, [centerID]);

        const title = '구독 관리';
        const body = `
            <style>
                .manage-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 30px 20px;
                }
                .manage-header {
                    margin-bottom: 25px;
                }
                .manage-header h1 {
                    font-size: 2em;
                    color: #333;
                    margin-bottom: 8px;
                }
                .subscription-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    transition: none;
                }
                .subscription-card:hover {
                    transform: none;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .card-title {
                    font-size: 1.3em;
                    font-weight: bold;
                    color: #333;
                }
                .status-badge {
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-weight: bold;
                    font-size: 0.9em;
                }
                .status-trial { background: #fff3cd; color: #856404; }
                .status-active { background: #d4edda; color: #155724; }
                .status-suspended { background: #f8d7da; color: #721c24; }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 12px;
                    margin: 15px 0;
                }
                .info-item {
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    transition: none;
                }
                .info-item:hover {
                    transform: none;
                    background: #f8f9fa;
                }
                .info-label {
                    font-size: 0.85em;
                    color: #666;
                    margin-bottom: 4px;
                }
                .info-value {
                    font-size: 1.1em;
                    font-weight: 600;
                    color: #333;
                }
                .action-buttons {
                    display: flex;
                    gap: 15px;
                    margin-top: 20px;
                    flex-wrap: wrap;
                }
                .btn {
                    padding: 12px 30px;
                    border: none;
                    border-radius: 8px;
                    font-size: 1em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-decoration: none;
                    display: inline-block;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                .btn-danger {
                    background: #dc3545;
                    color: white;
                }
                .btn:hover {
                    opacity: 0.9;
                }
                .payments-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-size: 0.95em;
                }
                .payments-table th {
                    background: #f8f9fa;
                    padding: 10px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid #dee2e6;
                }
                .payments-table td {
                    padding: 10px;
                    border-bottom: 1px solid #dee2e6;
                }
                .payment-status {
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.85em;
                    font-weight: bold;
                }
                .payment-completed { background: #d4edda; color: #155724; }
                .payment-failed { background: #f8d7da; color: #721c24; }
                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #999;
                }
            </style>

            <div class="manage-container">
                <div class="manage-header">
                    <h1>⚙️ 구독 관리</h1>
                    <p style="color: #666;">${center.center_name}</p>
                </div>

                <!-- 현재 구독 정보 -->
                <div class="subscription-card">
                    <div class="card-header">
                        <div class="card-title">현재 구독</div>
                        <span class="status-badge status-${subscription.status}">
                            ${getStatusText(subscription.status)}
                        </span>
                    </div>

                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">플랜</div>
                            <div class="info-value">
                                ${PLANS[subscription.plan_type]?.displayName || subscription.plan_type}
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">
                                ${subscription.status === 'trial' ? '체험 종료일' : '다음 결제일'}
                            </div>
                            <div class="info-value">
                                ${subscription.status === 'trial'
                                    ? formatDate(subscription.trial_end_date)
                                    : formatDate(subscription.next_billing_date)
                                }
                            </div>
                        </div>
                        ${subscription.last_payment_date ? `
                            <div class="info-item">
                                <div class="info-label">최근 결제</div>
                                <div class="info-value">
                                    ${formatDate(subscription.last_payment_date)}<br>
                                    <span style="font-size: 0.8em; color: #666;">
                                        ₩${(subscription.last_payment_amount || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="action-buttons">
                        ${subscription.status === 'trial'
                            ? '<a href="/subscription/plans" class="btn btn-primary">플랜 선택하기</a>'
                            : subscription.status === 'suspended'
                                ? '<a href="/subscription/plans" class="btn btn-primary">구독 재개하기</a>'
                                : `
                                    <a href="/subscription/plans" class="btn btn-secondary">플랜 변경</a>
                                    <button onclick="cancelSubscription()" class="btn btn-danger">구독 취소</button>
                                `
                        }
                        <a href="/teacher" class="btn btn-secondary">대시보드로 돌아가기</a>
                    </div>
                </div>

                <!-- 결제 내역 -->
                <div class="subscription-card">
                    <div class="card-header">
                        <div class="card-title">결제 내역</div>
                    </div>

                    ${payments.length > 0 ? `
                        <table class="payments-table">
                            <thead>
                                <tr>
                                    <th>주문번호</th>
                                    <th>결제일</th>
                                    <th>금액</th>
                                    <th>결제수단</th>
                                    <th>상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${payments.map(p => `
                                    <tr>
                                        <td>${p.order_id}</td>
                                        <td>${formatDate(p.created_at)}</td>
                                        <td>₩${p.amount.toLocaleString()}</td>
                                        <td>${p.payment_method === 'card' ? '카드' : '계좌이체'}</td>
                                        <td>
                                            <span class="payment-status payment-${p.status}">
                                                ${p.status === 'completed' ? '완료' : '실패'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : `
                        <div class="empty-state">
                            <p>📭 결제 내역이 없습니다</p>
                        </div>
                    `}
                </div>

                <!-- 센터 정보 -->
                <div class="subscription-card">
                    <div class="card-header">
                        <div class="card-title">센터 정보</div>
                    </div>

                    <div class="info-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                        <div class="info-item">
                            <div class="info-label">센터명</div>
                            <div class="info-value" style="font-size: 1.1em;">${center.center_name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">센터코드</div>
                            <div class="info-value" style="font-size: 1.1em; font-family: monospace;">${center.unique_code || '-'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">이메일</div>
                            <div class="info-value" style="font-size: 0.95em;">${center.contact_email || '-'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">연락처</div>
                            <div class="info-value" style="font-size: 1.1em;">${center.contact_phone || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                function cancelSubscription() {
                    if (!confirm('정말 구독을 취소하시겠습니까?\\n\\n구독 취소 시:\\n- 다음 결제일까지는 서비스 이용 가능\\n- 이후 교육 콘텐츠 접근 제한\\n- 언제든지 재구독 가능')) {
                        return;
                    }

                    fetch('/subscription/cancel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('구독이 취소되었습니다.');
                            location.reload();
                        } else {
                            alert('구독 취소 실패: ' + data.error);
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('구독 취소 중 오류가 발생했습니다.');
                    });
                }
            </script>
        `;

        const html = template.HTML(title, body);
        res.send(html);

    } catch (error) {
        console.error('Error loading subscription management:', error);
        res.status(500).send('구독 관리 페이지를 불러오는 중 오류가 발생했습니다.');
    }
});

// ========================================
// 구독 취소 API
// ========================================

router.post('/cancel', requireLogin, requireCenterAdmin, async (req, res) => {
    try {
        const centerID = req.session.user.centerID;

        // 현재 구독 조회
        const [subscription] = await queryDatabase(
            'SELECT id, status, plan_type FROM center_subscriptions WHERE centerID = ? ORDER BY created_at DESC LIMIT 1',
            [centerID]
        );

        if (!subscription) {
            return res.status(404).json({ success: false, error: '구독 정보를 찾을 수 없습니다.' });
        }

        if (subscription.status === 'trial') {
            return res.status(400).json({ success: false, error: 'Trial 구독은 취소할 수 없습니다.' });
        }

        if (subscription.status === 'cancelled') {
            return res.status(400).json({ success: false, error: '이미 취소된 구독입니다.' });
        }

        // 구독 상태를 cancelled로 변경
        await queryDatabase(
            'UPDATE center_subscriptions SET status = ?, updated_at = NOW() WHERE id = ?',
            ['cancelled', subscription.id]
        );

        res.json({
            success: true,
            message: '구독이 취소되었습니다. 다음 결제일까지는 서비스를 이용하실 수 있습니다.'
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ success: false, error: '구독 취소 중 오류가 발생했습니다.' });
    }
});

// ========================================
// 유틸리티 함수
// ========================================

function getStatusText(status) {
    const statusMap = {
        'trial': '무료 체험 중',
        'active': '활성',
        'suspended': '일시 정지',
        'cancelled': '취소됨'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

function getButtonHTML(plan, currentSubscription) {
    if (plan.id === 'trial') {
        return '<button class="plan-button secondary" disabled>체험 기간 전용</button>';
    }

    if (plan.id === 'professional') {
        return '<button class="plan-button secondary" onclick="alert(\'프랜차이즈 전용 플랜입니다. 문의: 070-4337-4337\')">문의하기</button>';
    }

    if (currentSubscription?.plan_type === plan.id) {
        return '<button class="plan-button secondary" disabled>현재 플랜</button>';
    }

    return `<button class="plan-button primary" onclick="selectPlan('${plan.id}')">선택하기</button>`;
}

module.exports = router;
