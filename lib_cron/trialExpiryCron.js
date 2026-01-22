/**
 * Trial 만료 처리 Cron Job
 *
 * 실행 시간: 매일 새벽 3시
 *
 * 기능:
 * 1. Trial 만료 7일 전 센터에 알림 이메일 발송
 * 2. Trial 만료일 도래 시 status='suspended'로 변경
 * 3. 만료된 센터의 교육 콘텐츠 접근 차단
 */

const cron = require('node-cron');
const { queryDatabase } = require('../lib_login/db');
const { sendTrialExpiryReminderEmail, sendTrialExpiredEmail } = require('../lib_auth/emailService');

// ========================================
// Trial 만료 7일 전 알림
// ========================================

async function sendTrialExpiryReminders() {
    try {
        console.log('[Cron] 📅 Trial 만료 알림 체크 시작');

        // 7일 후 만료 예정인 Trial 센터 조회
        const reminderQuery = `
            SELECT
                cs.id as subscription_id,
                cs.centerID,
                cs.trial_end_date,
                c.center_name,
                c.contact_email,
                c.contact_name
            FROM center_subscriptions cs
            JOIN Centers c ON cs.centerID = c.id
            WHERE cs.status = 'trial'
              AND cs.trial_end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
              AND c.status = 'ACTIVE'
        `;

        const reminders = await queryDatabase(reminderQuery);

        console.log(`[Cron] 📧 Trial 만료 알림 대상: ${reminders.length}개 센터`);

        for (const reminder of reminders) {
            try {
                // 알림 이메일 발송
                await sendTrialExpiryReminderEmail(
                    reminder.contact_email,
                    reminder.center_name,
                    reminder.contact_name,
                    reminder.trial_end_date
                );

                console.log(`[Cron] ✅ 센터 ${reminder.centerID} (${reminder.center_name}) - Trial 만료 알림 발송 완료`);

            } catch (error) {
                console.error(`[Cron] ❌ 센터 ${reminder.centerID} - Trial 만료 알림 발송 실패:`, error.message);
            }
        }

        return reminders.length;

    } catch (error) {
        console.error('[Cron] ❌ Trial 만료 알림 체크 오류:', error);
        throw error;
    }
}

// ========================================
// Trial 만료 처리 (자동 suspend)
// ========================================

async function processExpiredTrials() {
    try {
        console.log('[Cron] ⏰ Trial 만료 처리 시작');

        // 오늘 만료된 Trial 센터 조회
        const expiredQuery = `
            SELECT
                cs.id as subscription_id,
                cs.centerID,
                cs.trial_end_date,
                c.center_name,
                c.contact_email,
                c.contact_name
            FROM center_subscriptions cs
            JOIN Centers c ON cs.centerID = c.id
            WHERE cs.status = 'trial'
              AND cs.trial_end_date <= CURDATE()
              AND c.status = 'ACTIVE'
        `;

        const expired = await queryDatabase(expiredQuery);

        console.log(`[Cron] 🔒 Trial 만료 대상: ${expired.length}개 센터`);

        for (const exp of expired) {
            try {
                // 1. 구독 상태를 suspended로 변경
                const updateQuery = `
                    UPDATE center_subscriptions
                    SET status = 'suspended',
                        updated_at = NOW()
                    WHERE id = ?
                `;
                await queryDatabase(updateQuery, [exp.subscription_id]);

                // 2. 센터 상태를 SUSPENDED로 변경
                const updateCenterQuery = `
                    UPDATE Centers
                    SET status = 'SUSPENDED',
                        updated_at = NOW()
                    WHERE id = ?
                `;
                await queryDatabase(updateCenterQuery, [exp.centerID]);

                // 3. 만료 알림 이메일 발송
                await sendTrialExpiredEmail(
                    exp.contact_email,
                    exp.center_name,
                    exp.contact_name
                );

                console.log(`[Cron] ✅ 센터 ${exp.centerID} (${exp.center_name}) - Trial 만료 처리 완료`);

            } catch (error) {
                console.error(`[Cron] ❌ 센터 ${exp.centerID} - Trial 만료 처리 실패:`, error.message);
            }
        }

        return expired.length;

    } catch (error) {
        console.error('[Cron] ❌ Trial 만료 처리 오류:', error);
        throw error;
    }
}

// ========================================
// Cron Job 스케줄링
// ========================================

function startTrialExpiryCron() {
    // 매일 새벽 3시에 실행 (0 3 * * *)
    cron.schedule('0 3 * * *', async () => {
        console.log('\n========================================');
        console.log('🕐 Trial 만료 처리 Cron Job 시작');
        console.log(`실행 시각: ${new Date().toLocaleString('ko-KR')}`);
        console.log('========================================\n');

        try {
            // 1. Trial 만료 7일 전 알림
            const reminderCount = await sendTrialExpiryReminders();

            // 2. Trial 만료 처리
            const expiredCount = await processExpiredTrials();

            console.log('\n========================================');
            console.log('✅ Trial 만료 처리 Cron Job 완료');
            console.log(`📧 알림 발송: ${reminderCount}건`);
            console.log(`🔒 만료 처리: ${expiredCount}건`);
            console.log('========================================\n');

        } catch (error) {
            console.error('\n========================================');
            console.error('❌ Trial 만료 처리 Cron Job 실패');
            console.error('오류:', error);
            console.error('========================================\n');
        }
    });

    console.log('✅ Trial 만료 Cron Job 스케줄 등록 완료 (매일 03:00)');
}

// ========================================
// 수동 실행 함수 (테스트용)
// ========================================

async function runTrialExpiryCheckNow() {
    console.log('🔧 Trial 만료 체크 수동 실행\n');

    try {
        const reminderCount = await sendTrialExpiryReminders();
        const expiredCount = await processExpiredTrials();

        console.log('\n✅ 수동 실행 완료');
        console.log(`📧 알림 발송: ${reminderCount}건`);
        console.log(`🔒 만료 처리: ${expiredCount}건`);

        return { reminderCount, expiredCount };

    } catch (error) {
        console.error('❌ 수동 실행 실패:', error);
        throw error;
    }
}

// ========================================
// 통계 조회 함수
// ========================================

async function getTrialStatistics() {
    try {
        const statsQuery = `
            SELECT
                COUNT(*) as total_trials,
                COUNT(CASE WHEN trial_end_date >= CURDATE() THEN 1 END) as active_trials,
                COUNT(CASE WHEN trial_end_date < CURDATE() THEN 1 END) as expired_trials,
                COUNT(CASE WHEN trial_end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as expiring_in_7days,
                COUNT(CASE WHEN trial_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as expiring_this_week
            FROM center_subscriptions
            WHERE status = 'trial'
        `;

        const [stats] = await queryDatabase(statsQuery);

        return {
            totalTrials: stats.total_trials || 0,
            activeTrials: stats.active_trials || 0,
            expiredTrials: stats.expired_trials || 0,
            expiringIn7Days: stats.expiring_in_7days || 0,
            expiringThisWeek: stats.expiring_this_week || 0
        };

    } catch (error) {
        console.error('[Cron] Trial 통계 조회 오류:', error);
        throw error;
    }
}

module.exports = {
    startTrialExpiryCron,
    runTrialExpiryCheckNow,
    sendTrialExpiryReminders,
    processExpiredTrials,
    getTrialStatistics
};
