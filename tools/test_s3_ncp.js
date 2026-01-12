require('dotenv').config();
const S3Manager = require('../lib_storage/s3Manager');

// 🔥 테스트용 더미 자격 증명 (설정 없으면 사용)
if (!process.env.AWS_ACCESS_KEY_ID) {
    console.warn('⚠️ AWS 자격 증명 없음, 더미 자격 증명 사용');
    process.env.AWS_ACCESS_KEY_ID = 'dummy-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'dummy-secret-key';
}

async function testS3() {
    console.log('🚀 NCP S3 연결 테스트 시작...');

    try {
        const s3 = new S3Manager();
        console.log('✅ S3Manager 인스턴스 생성 완료');
        console.log(`📡 Endpoint: https://kr.object.ncloudstorage.com`);
        console.log(`📦 Bucket: ${process.env.BUCKET_NAME || 'educodingnplaycontents'}`);

        console.log('\n📂 파일 목록 조회 중...');
        const result = await s3.browse('', '/');

        console.log(`✅ 조회 성공!`);
        console.log(`📁 폴더: ${result.folders.length}개`);
        result.folders.forEach(f => console.log(`  - [DIR] ${f.name}`));

        console.log(`📄 파일: ${result.files.length}개`);
        result.files.forEach(f => console.log(`  - [FILE] ${f.name} (${f.sizeFormatted})`));

        if (result.files.length > 0) {
            console.log(`\n🔗 첫 번째 파일 URL: ${result.files[0].url}`);
        }

    } catch (error) {
        console.error('❌ 테스트 실패:', error);
    }
}

testS3();
