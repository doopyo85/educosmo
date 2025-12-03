const { queryDatabase } = require('./db');

// 구독 상태 업데이트 함수
async function updateSubscriptionStatus(userID, status, expiryDate) {
    const query = `
        UPDATE Users
        SET subscription_status = ?, subscription_expiry = ?
        WHERE id = ?
    `;
    await queryDatabase(query, [status, expiryDate, userID]);
}

// 결제 정보 추가 함수
async function addPaymentRecord(userID, centerID, productName, amount, expiryDate) {
    const query = `
        INSERT INTO Payments (userID, centerID, product_name, payment_date, expiry_date, amount, status)
        VALUES (?, ?, ?, CURDATE(), ?, ?, 'active')
    `;
    await queryDatabase(query, [userID, centerID, productName, amount, expiryDate]);
}

// 최신 결제 정보 확인 함수
async function getLatestPayment(userID) {
    const query = `
        SELECT * FROM Payments
        WHERE userID = ?
        ORDER BY payment_date DESC
        LIMIT 1
    `;
    return queryDatabase(query, [userID]);
}

// 만료일 계산 함수
function calculateExpiryDate(months = 1) {
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);
    return expiryDate;
}

// 결제 성공 처리 API
router.post('/payment-success', async (req, res) => {
    const { userID, centerID, product_name, amount } = req.body;

    try {
        // 구독 만료일 계산
        const expiryDate = calculateExpiryDate(1);

        // 기존 결제 확인 및 중복 방지
        const existingPayment = await getLatestPayment(userID);
        if (existingPayment && new Date(existingPayment.expiry_date) > new Date()) {
            return res.status(400).json({ error: '이미 활성화된 구독이 있습니다.' });
        }

        // 결제 정보 저장
        await addPaymentRecord(userID, centerID, product_name, amount, expiryDate);

        // 구독 상태 업데이트
        await updateSubscriptionStatus(userID, 'active', expiryDate);

        res.status(200).json({ message: '구독이 활성화되었습니다.' });
    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({ error: '결제 처리 중 오류가 발생했습니다.' });
    }
});

module.exports = { updateSubscriptionStatus, addPaymentRecord, getLatestPayment, calculateExpiryDate };
