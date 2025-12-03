/**
 * EntryJS Base용 단순 DataAPI 설정
 * S3 연동 대신 로컬 스프라이트 사용
 */

(function() {
    'use strict';
    
    console.log('🎯 EntryJS Base DataAPI 설정 시작...');
    
    // 중복 실행 방지
    if (window.ENTRY_BASE_API_LOADED) {
        console.log('✅ EntryJS Base DataAPI 이미 로드됨');
        return;
    }
    
    // Base용 고정 스프라이트 데이터
    const BASE_SPRITES = {
        categories: [
            {
                id: 'entrybot_friends',
                name: '엔트리봇',
                visible: true
            },
            {
                id: 'new',
                name: '새로 만들기',
                visible: true
            }
        ],
        sprites: {
            entrybot_friends: [
                {
                    id: 'entrybot_basic',
                    name: '엔트리봇',
                    category: 'entrybot_friends',
                    pictures: [{
                        id: 'entrybot_basic_pic1',
                        name: '엔트리봇',
                        filename: 'entrybot_basic.png',
                        imageType: 'png',
                        fileurl: '/images/sprites/entrybot_walk1.png',
                        dimension: { width: 100, height: 100 }
                    }],
                    sounds: []
                }
            ]
        }
    };
    
    /**
     * Entry 객체 로드 대기
     */
    function waitForEntry() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 30;
            
            const checkEntry = () => {
                attempts++;
                
                if (window.Entry && typeof Entry === 'object') {
                    console.log('✅ Entry 객체 발견');
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    console.warn('⚠️ Entry 로드 시간 초과');
                    resolve(false);
                } else {
                    setTimeout(checkEntry, 100);
                }
            };
            checkEntry();
        });
    }
    
    /**
     * Base용 DataAPI 설정
     */
    async function setupBaseDataAPI() {
        const entryLoaded = await waitForEntry();
        
        if (!entryLoaded) {
            console.error('❌ Entry 객체를 찾을 수 없음');
            return false;
        }
        
        try {
            console.log('🔧 Entry.dataApi Base 설정 중...');
            
            // 단순한 Base DataAPI
            Entry.dataApi = {
                async getCategories() {
                    console.log('📁 Base 카테고리 반환');
                    return { data: BASE_SPRITES.categories };
                },
                
                async getSprites(options = {}) {
                    const category = options.category || 'entrybot_friends';
                    const sprites = BASE_SPRITES.sprites[category] || [];
                    console.log('🎨 Base 스프라이트 반환:', sprites.length, '개');
                    return { data: sprites, total: sprites.length };
                },
                
                object: {
                    async category() {
                        return { status: 'success', data: BASE_SPRITES.categories };
                    },
                    
                    async list(options) {
                        const category = options?.category || 'entrybot_friends';
                        const sprites = BASE_SPRITES.sprites[category] || [];
                        return { status: 'success', data: sprites, total: sprites.length };
                    }
                }
            };
            
            // API 호환성
            if (!Entry.Api) Entry.Api = {};
            Entry.Api.object = Entry.dataApi.object;
            
            console.log('✅ Entry.dataApi Base 설정 완료');
            return true;
            
        } catch (error) {
            console.error('❌ Entry.dataApi Base 설정 실패:', error);
            return false;
        }
    }
    
    /**
     * 초기화 실행
     */
    async function initialize() {
        try {
            const success = await setupBaseDataAPI();
            
            if (success) {
                window.ENTRY_BASE_API_LOADED = true;
                console.log('🎉 EntryJS Base DataAPI 설정 완료!');
            } else {
                console.error('❌ EntryJS Base DataAPI 설정 실패');
            }
            
        } catch (error) {
            console.error('❌ EntryJS Base DataAPI 초기화 오류:', error);
        }
    }
    
    // DOM 로드 완료 후 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    console.log('📦 EntryJS Base DataAPI 스크립트 로드 완료');
    
})();