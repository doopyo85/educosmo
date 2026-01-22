/**
 * 구독 자동 갱신 테스트 스크립트
 *
 * 목적: Cron Job 로직을 수동으로 테스트
 *
 * 실행 방법:
 *   node scripts/test_subscription_renewal.js
 */

const { runSubscriptionRenewalNow } = require('../lib_cron/subscriptionRenewalCron');

(async () => {
    console.log('========================================');
    console.log('구독 자동 갱신 테스트 시작');
    console.log('========================================\n');

    try {
        const result = await runSubscriptionRenewalNow();

        console.log('\n========================================');
        console.log('테스트 결과:');
        console.log('========================================');
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ 테스트 성공!');
            console.log(`  - 갱신된 구독: ${result.renewed}개`);
            console.log(`  - 만료된 구독: ${result.expired}개`);
            console.log(`  - 오류: ${result.errors.length}개`);

            if (result.errors.length > 0) {
                console.log('\n오류 상세:');
                result.errors.forEach((err, idx) => {
                    console.log(`  ${idx + 1}. Center ${err.center_id}: ${err.error}`);
                });
            }
        } else {
            console.log('\n❌ 테스트 실패!');
            console.log(`  오류: ${result.error}`);
        }

        process.exit(0);

    } catch (error) {
        console.error('\n❌ 치명적 오류 발생:', error);
        process.exit(1);
    }
})();
