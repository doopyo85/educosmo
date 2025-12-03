// EntryJS dataApi 테스트 스크립트
// 브라우저 콘솔에서 실행하여 API 테스트

async function testDataApi() {
    console.log('🧪 EntryJS DataApi 테스트 시작...');
    
    const baseUrl = '/api/entry/dataApi';
    
    try {
        // 1. 상태 확인
        console.log('📊 API 상태 확인...');
        const statusResponse = await fetch(`${baseUrl}/status`);
        const status = await statusResponse.json();
        console.log('✅ API 상태:', status);
        
        // 2. 카테고리 테스트
        console.log('📂 카테고리 API 테스트...');
        const categoryResponse = await fetch(`${baseUrl}/category`);
        const categories = await categoryResponse.json();
        console.log('✅ 카테고리:', categories);
        
        // 3. 스프라이트 테스트
        console.log('🎭 스프라이트 API 테스트...');
        const spriteResponse = await fetch(`${baseUrl}/sprite?category=entrybot_friends&limit=5`);
        const sprites = await spriteResponse.json();
        console.log('✅ 스프라이트:', sprites);
        
        // 4. 이미지 테스트
        console.log('🖼️ 이미지 API 테스트...');
        const pictureResponse = await fetch(`${baseUrl}/picture?category=entrybot_friends&limit=5`);
        const pictures = await pictureResponse.json();
        console.log('✅ 이미지:', pictures);
        
        // 5. EntryJS 설정 확인
        console.log('⚙️ EntryJS 설정 확인...');
        if (window.Entry) {
            console.log('Entry 객체:', window.Entry);
            console.log('Entry.Api:', window.Entry.Api);
            console.log('Entry.DataApi:', window.Entry.DataApi);
            console.log('Entry.playground:', window.Entry.playground);
        } else {
            console.log('❌ Entry 객체를 찾을 수 없음');
        }
        
        return {
            status: 'success',
            apis: {
                status: statusResponse.ok,
                category: categoryResponse.ok,
                sprite: spriteResponse.ok,
                picture: pictureResponse.ok
            },
            data: {
                categories: categories.length || 0,
                sprites: sprites.sprites?.length || 0,
                pictures: pictures.pictures?.length || 0
            }
        };
        
    } catch (error) {
        console.error('❌ API 테스트 실패:', error);
        return {
            status: 'error',
            error: error.message
        };
    }
}

// 사용법: 브라우저 콘솔에서 testDataApi() 실행
window.testDataApi = testDataApi;