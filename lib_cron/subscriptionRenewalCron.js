/**
 * 구독 자동 갱신 Cron Job
 *
 * 목적: 결제 연동 없이 Admin이 수동으로 관리하는 구독 시스템
 * - 매일 자동으로 next_billing_date 확인
 * - 만료일 도래 시 자동 갱신 (status가 'active'인 경우만)
 * - Admin에서 'cancelled' 상태로 변경하지 않는 한 계속 갱신
 *
 * 스케줄: 매일 새벽 4시 실행
 *
 * @module lib_cron/subscriptionRenewalCron
 */

const cron = require('node-cron');
const { queryDatabase } = require('../lib/database_conns/queryDatabase');
const { sendEmail } = require('../lib/email');

/**
 * 구독 자동 갱신 처리
 * - status가 'active'인 구독만 갱신
 * - status가 'cancelled'인 경우 만료 처리
 */
async function processSubscriptionRenewals() {
    console.log('[Subscription Renewal Cron] Starting subscription renewal process...');

    try {
        // 1. 오늘 또는 이미 지난 next_billing_date를 가진 구독 조회
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const subscriptionsToProcess = await queryDatabase(`
            SELECT
                cs.id as subscription_id,
                cs.center_id,
                cs.plan_type,
                cs.status,
                cs.next_billing_date,
                cs.price_monthly,
                cs.payment_method,
                c.center_name,
                c.contact_email
            FROM center_subscriptions cs
            INNER JOIN Centers c ON cs.center_id = c.id
            WHERE cs.next_billing_date <= ?
              AND cs.status IN ('active', 'cancelled')
              AND cs.plan_type IN ('standard', 'premium')
            ORDER BY cs.next_billing_date ASC
        `, [today]);

        console.log(`[Subscription Renewal Cron] Found ${subscriptionsToProcess.length} subscriptions to process`);

        if (subscriptionsToProcess.length === 0) {
            console.log('[Subscription Renewal Cron] No subscriptions to process today.');
            return {
                success: true,
                renewed: 0,
                expired: 0,
                errors: []
            };
        }

        let renewedCount = 0;
        let expiredCount = 0;
        const errors = [];

        // 2. 각 구독 처리
        for (const subscription of subscriptionsToProcess) {
            try {
                const {
                    subscription_id,
                    center_id,
                    plan_type,
                    status,
                    next_billing_date,
                    price_monthly,
                    center_name,
                    contact_email
                } = subscription;

                console.log(`[Subscription Renewal Cron] Processing: Center ${center_id} (${center_name}), Status: ${status}`);

                // 2.1 Active 구독: 자동 갱신
                if (status === 'active') {
                    // 갱신 기간 계산 (standard: 30일, premium: 365일)
                    const renewalDays = plan_type === 'premium' ? 365 : 30;

                    await queryDatabase(`
                        UPDATE center_subscriptions
                        SET
                            next_billing_date = DATE_ADD(next_billing_date, INTERVAL ? DAY),
                            updated_at = NOW()
                        WHERE id = ?
                    `, [renewalDays, subscription_id]);

                    renewedCount++;
                    console.log(`  ✅ Renewed: Next billing date set to ${renewalDays} days from ${next_billing_date}`);

                    // 갱신 알림 이메일 발송 (선택사항)
                    if (contact_email) {
                        try {
                            await sendRenewalNotificationEmail(
                                contact_email,
                                center_name,
                                plan_type,
                                renewalDays,
                                price_monthly
                            );
                            console.log(`  📧 Renewal notification sent to ${contact_email}`);
                        } catch (emailError) {
                            console.error(`  ⚠️ Failed to send renewal email:`, emailError);
                            // 이메일 실패는 무시하고 계속 진행
                        }
                    }
                }

                // 2.2 Cancelled 구독: 만료 처리
                else if (status === 'cancelled') {
                    await queryDatabase(`
                        UPDATE center_subscriptions
                        SET
                            status = 'suspended',
                            updated_at = NOW()
                        WHERE id = ?
                    `, [subscription_id]);

                    // Centers 테이블도 SUSPENDED로 변경
                    await queryDatabase(`
                        UPDATE Centers
                        SET status = 'SUSPENDED'
                        WHERE id = ?
                    `, [center_id]);

                    expiredCount++;
                    console.log(`  🚫 Expired: Cancelled subscription moved to suspended`);

                    // 만료 알림 이메일 발송
                    if (contact_email) {
                        try {
                            await sendExpirationNotificationEmail(
                                contact_email,
                                center_name
                            );
                            console.log(`  📧 Expiration notification sent to ${contact_email}`);
                        } catch (emailError) {
                            console.error(`  ⚠️ Failed to send expiration email:`, emailError);
                        }
                    }
                }

            } catch (error) {
                console.error(`[Subscription Renewal Cron] Error processing subscription ${subscription.subscription_id}:`, error);
                errors.push({
                    subscription_id: subscription.subscription_id,
                    center_id: subscription.center_id,
                    error: error.message
                });
            }
        }

        // 3. 처리 결과 로깅
        console.log('[Subscription Renewal Cron] Process completed:');
        console.log(`  ✅ Renewed: ${renewedCount}`);
        console.log(`  🚫 Expired: ${expiredCount}`);
        console.log(`  ❌ Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.error('[Subscription Renewal Cron] Errors:', errors);
        }

        return {
            success: true,
            renewed: renewedCount,
            expired: expiredCount,
            errors: errors
        };

    } catch (error) {
        console.error('[Subscription Renewal Cron] Fatal error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 갱신 알림 이메일 발송
 */
async function sendRenewalNotificationEmail(email, centerName, planType, renewalDays, priceMonthly) {
    const planDisplayName = planType === 'premium' ? 'Professional' : 'Standard';
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + renewalDays);
    const formattedDate = nextBillingDate.toLocaleDateString('ko-KR');

    const subject = `[MyUniverse] ${centerName} 구독이 자동 갱신되었습니다`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">구독 자동 갱신 안내</h2>

            <p>안녕하세요, <strong>${centerName}</strong> 관리자님</p>

            <p>귀하의 MyUniverse 구독이 자동으로 갱신되었습니다.</p>

            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1F2937;">갱신 정보</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin: 10px 0;"><strong>플랜:</strong> ${planDisplayName} 플랜</li>
                    <li style="margin: 10px 0;"><strong>월 이용료:</strong> ₩${priceMonthly.toLocaleString()}</li>
                    <li style="margin: 10px 0;"><strong>다음 결제일:</strong> ${formattedDate}</li>
                </ul>
            </div>

            <p>구독을 계속 이용하시려면 아무 조치도 필요하지 않습니다. 다음 결제일에 자동으로 갱신됩니다.</p>

            <p>구독을 취소하시려면 관리자에게 문의해주세요.</p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    문의사항이 있으시면 언제든지 연락 주시기 바랍니다.<br>
                    MyUniverse 고객지원팀
                </p>
            </div>
        </div>
    `;

    await sendEmail(email, subject, html);
}

/**
 * 만료 알림 이메일 발송
 */
async function sendExpirationNotificationEmail(email, centerName) {
    const subject = `[MyUniverse] ${centerName} 구독이 만료되었습니다`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">구독 만료 안내</h2>

            <p>안녕하세요, <strong>${centerName}</strong> 관리자님</p>

            <p>귀하의 MyUniverse 구독이 취소되어 만료되었습니다.</p>

            <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                <h3 style="margin-top: 0; color: #991B1B;">현재 상태</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin: 10px 0;">✅ 커뮤니티, 포트폴리오, 블로그는 계속 이용 가능</li>
                    <li style="margin: 10px 0;">❌ 교육 콘텐츠 접근이 제한됩니다</li>
                    <li style="margin: 10px 0;">❌ 클라우드보드 접근이 제한됩니다</li>
                    <li style="margin: 10px 0;">❌ 대시보드 접근이 제한됩니다</li>
                </ul>
            </div>

            <p>서비스를 계속 이용하시려면 구독을 재개해주세요.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="https://myuniverse.com/subscription/plans"
                   style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    구독 재개하기
                </a>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 14px;">
                    문의사항이 있으시면 언제든지 연락 주시기 바랍니다.<br>
                    MyUniverse 고객지원팀
                </p>
            </div>
        </div>
    `;

    await sendEmail(email, subject, html);
}

/**
 * Cron Job 시작
 * 스케줄: 매일 새벽 4시 (0 4 * * *)
 */
function startSubscriptionRenewalCron() {
    console.log('[Subscription Renewal Cron] Initializing subscription renewal cron job...');

    // 매일 새벽 4시 실행
    cron.schedule('0 4 * * *', async () => {
        console.log('[Subscription Renewal Cron] Running scheduled job at', new Date().toISOString());
        await processSubscriptionRenewals();
    });

    console.log('[Subscription Renewal Cron] Cron job scheduled: Every day at 4:00 AM');
}

// 수동 실행용 (테스트 또는 즉시 실행)
async function runSubscriptionRenewalNow() {
    console.log('[Subscription Renewal Cron] Manual execution triggered');
    return await processSubscriptionRenewals();
}

module.exports = {
    startSubscriptionRenewalCron,
    runSubscriptionRenewalNow,
    processSubscriptionRenewals
};
