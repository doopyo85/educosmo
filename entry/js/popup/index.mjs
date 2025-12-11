import { setSpritePopupEvent } from './sprite.mjs';
import { setPicturePopupEvent } from './picture.mjs';
import { setSoundPopupEvent } from './sound.mjs';
import { setTablePopupEvent } from './table.mjs';
import { getExpansionBlocks, setExpansionPopupEvent } from './expansion.mjs';
import { getAiUtilizeBlocks, setAIUtilizePopupEvent } from './aIUtilize.mjs';
import { getSidebarTemplate } from '../util.mjs';
import { assets } from '../mock.mjs';

var popup;
var isPopupOpen = false;  // 🔥 팝업 상태 추적

export function getAsset(category) {
    const { type, subMenu, sidebar } = category;
    return assets[type];
}

export function uploadFail(data) {
    EntryModal.alert(Lang[data.messageParent][data.message]);
}
export function failAlert() {
    window.EntryModal.alert(Lang.Msgs.error_occured);
}

export function installPopup() {
    const container = document.getElementById('EntryPopupContainer');
    popup = new EntryTool.Popup({
        container,
        isShow: false,
        theme: 'entry',
        data: { data: { data: [] } },
    });
    popup.setData({
        projectNavOptions: {
            categoryOptions: ['all', 'game', 'living', 'storytelling', 'arts', 'knowledge', 'etc'],
            sortOptions: ['updated', 'visit', 'likeCnt', 'comment'],
            periodOptions: ['all', 'today', 'week', 'month', 'quarter'],
        },
        imageBaseUrl: '/resources/uploads/'
    });
    
    // 🔥 팝업 닫힘 이벤트 추적
    popup.on('close', () => {
        console.log('🚪 팝업 닫힘');
        isPopupOpen = false;
    });
    
    popup.on('hide', () => {
        console.log('🚪 팝업 숨김');
        isPopupOpen = false;
    });
    
    console.log('✅ Entry 팝업 시스템 설치 완료');
}

export async function openSpriteManager() {
    console.log('🎭 openSpriteManager 호출됨');
    
    // 🔥 팝업이 초기화되지 않은 경우 대기
    if (!popup) {
        console.error('❌ 팝업이 초기화되지 않았습니다');
        return;
    }
    
    // 🔥 기존 리스너 제거 (close/hide 제외)
    try {
        popup.removeAllListeners('fetch');
        popup.removeAllListeners('search');
        popup.removeAllListeners('submit');
        popup.removeAllListeners('draw');
        popup.removeAllListeners('uploads');
        popup.removeAllListeners('dummyUploads');
        popup.removeAllListeners('uploadFail');
        popup.removeAllListeners('fail');
        popup.removeAllListeners('error');
    } catch (e) {
        console.log('⚠️ 리스너 제거 중 오류 (무시):', e.message);
        popup.removeAllListeners();
        // close/hide 리스너 다시 등록
        popup.on('close', () => {
            console.log('🚪 팝업 닫힘');
            isPopupOpen = false;
        });
        popup.on('hide', () => {
            console.log('🚪 팝업 숨김');
            isPopupOpen = false;
        });
    }
    
    setSpritePopupEvent(popup);
    
    // Entry 리소스가 로드되었는지 확인
    if (!assets.sprite || assets.sprite.length === 0) {
        console.log('⏳ Entry 리소스 로드 중...');
        await assets.loadResources();
    }
    
    // 🔥 Entry 공식 카테고리 순서 및 한글 이름
    const OFFICIAL_CATEGORIES = [
        { id: 'entrybot_friends', name: '엔트리봇', order: 1 },
        { id: 'new_friends', name: '우엔보', order: 2 },
        { id: 'people', name: '사람', order: 3 },
        { id: 'animal', name: '동물', order: 4 },
        { id: 'plant', name: '식물', order: 5 },
        { id: 'vehicles', name: '탈것', order: 6 },
        { id: 'architect', name: '건물', order: 7 },
        { id: 'food', name: '음식', order: 8 },
        { id: 'environment', name: '환경', order: 9 },
        { id: 'stuff', name: '물건', order: 10 },
        { id: 'fantasy', name: '판타지', order: 11 },
        { id: 'interface', name: '인터페이스', order: 12 },
        { id: 'background', name: '배경', order: 13 }
    ];
    
    // 🔥 숨길 카테고리
    const HIDDEN_CATEGORIES = [
        'EBS15회', 'EBS20회', 'EBS21회', 'EBS24회', 'EBS25회',
        'main_IYYpuwnMXN', 'other', 'thing', 'characters', 'all'
    ];
    
    // sprites.json에서 실제 존재하는 카테고리만 추출
    const existingCategories = new Set();
    assets.sprite.forEach(sprite => {
        if (sprite.category?.main) {
            existingCategories.add(sprite.category.main);
        }
    });
    
    // 공식 순서대로 카테고리 생성 (실제 존재하는 것만)
    const categories = OFFICIAL_CATEGORIES
        .filter(cat => existingCategories.has(cat.id))
        .map(cat => ({
            id: cat.id,
            name: cat.name,
            value: cat.id,
            label: { ko: cat.name, en: cat.id },
            categoryType: 'sprite',
            depth: 1,
            children: []
        }));
    
    console.log('📂 공식 순서 카테고리:', categories.map(c => c.name));
    
    const sidebar = getSidebarTemplate({ category: categories });
    popup.setData({ 
        sidebar,
        imageBaseUrl: '/resources/uploads/'
    });
    
    // 초기 데이터 로드 (첫 번째 카테고리 기준)
    const firstCategory = categories[0]?.id || 'entrybot_friends';
    const filteredSprites = assets.sprite.filter(s => s.category?.main === firstCategory);
    
    popup.show({ type: 'sprite' }, {
        data: {
            data: filteredSprites.slice(0, 50),
            imageBaseUrl: '/resources/uploads/'
        }
    });
}

export async function openPictureManager() {
    console.log('🖼️ openPictureManager 호출됨, isPopupOpen:', isPopupOpen);
    
    // 🔥 팝업이 초기화되지 않은 경우 대기
    if (!popup) {
        console.error('❌ 팝업이 초기화되지 않았습니다');
        return;
    }
    
    // 🔥 기존 리스너 제거 (close/hide 제외)
    try {
        popup.removeAllListeners('fetch');
        popup.removeAllListeners('search');
        popup.removeAllListeners('submit');
        popup.removeAllListeners('draw');
        popup.removeAllListeners('uploads');
        popup.removeAllListeners('dummyUploads');
        popup.removeAllListeners('uploadFail');
        popup.removeAllListeners('fail');
        popup.removeAllListeners('error');
    } catch (e) {
        console.log('⚠️ 리스너 제거 중 오류 (무시):', e.message);
        popup.removeAllListeners();
        // close/hide 리스너 다시 등록
        popup.on('close', () => {
            console.log('🚪 팝업 닫힘');
            isPopupOpen = false;
        });
        popup.on('hide', () => {
            console.log('🚪 팝업 숨김');
            isPopupOpen = false;
        });
    }
    
    setPicturePopupEvent(popup);
    
    // Entry 리소스 로드 확인
    if (!assets.sprite || assets.sprite.length === 0) {
        console.log('⏳ Entry 리소스 로드 중...');
        await assets.loadResources();
    }
    
    // 🔥 Entry 공식 카테고리 순서 및 한글 이름
    const OFFICIAL_CATEGORIES = [
        { id: 'entrybot_friends', name: '엔트리봇', order: 1 },
        { id: 'new_friends', name: '우엔보', order: 2 },
        { id: 'people', name: '사람', order: 3 },
        { id: 'animal', name: '동물', order: 4 },
        { id: 'plant', name: '식물', order: 5 },
        { id: 'vehicles', name: '탈것', order: 6 },
        { id: 'architect', name: '건물', order: 7 },
        { id: 'food', name: '음식', order: 8 },
        { id: 'environment', name: '환경', order: 9 },
        { id: 'stuff', name: '물건', order: 10 },
        { id: 'fantasy', name: '판타지', order: 11 },
        { id: 'interface', name: '인터페이스', order: 12 },
        { id: 'background', name: '배경', order: 13 }
    ];
    
    // sprites에서 실제 존재하는 카테고리만 추출
    const existingCategories = new Set();
    assets.sprite.forEach(sprite => {
        if (sprite.category?.main) {
            existingCategories.add(sprite.category.main);
        }
    });
    
    // 공식 순서대로 카테고리 생성
    const categories = OFFICIAL_CATEGORIES
        .filter(cat => existingCategories.has(cat.id))
        .map(cat => ({
            id: cat.id,
            name: cat.name,
            value: cat.id,
            label: { ko: cat.name, en: cat.id },
            categoryType: 'picture',
            depth: 1,
            children: []
        }));
    
    console.log('🖼️ 모양 추가 팝업 카테고리:', categories.map(c => c.name));
    
    const sidebar = getSidebarTemplate({ category: categories });
    popup.setData({ 
        sidebar,
        imageBaseUrl: '/resources/uploads/'
    });
    
    // sprites에서 pictures 추출
    const firstCategory = categories[0]?.id || 'entrybot_friends';
    let allPictures = [];
    assets.sprite.forEach(sprite => {
        if (sprite.category?.main === firstCategory && sprite.pictures) {
            sprite.pictures.forEach(pic => {
                allPictures.push({
                    ...pic,
                    id: pic.id || Entry.generateHash(),
                    name: pic.name || sprite.name,
                    category: sprite.category
                });
            });
        }
    });
    
    console.log('📸 초기 그림 데이터:', allPictures.length, '개');
    
    // 🔥 팝업 열기
    isPopupOpen = true;
    popup.show({ type: 'picture' }, {
        data: {
            data: allPictures.slice(0, 50),
            imageBaseUrl: '/resources/uploads/'
        }
    });
    
    console.log('✅ 모양 추가 팝업 열림');
}

export async function openSoundManager() {
    console.log('🔊 openSoundManager 호출됨, isPopupOpen:', isPopupOpen);
    
    // 🔥 팝업이 이미 열린 상태면 무시
    if (isPopupOpen) {
        console.log('⚠️ 팝업이 이미 열려있어 무시');
        return;
    }
    
    // 🔥 팝업이 초기화되지 않은 경우 대기
    if (!popup) {
        console.error('❌ 팝업이 초기화되지 않았습니다');
        return;
    }
    
    // 🔥 기존 리스너 제거 (close/hide 제외)
    try {
        popup.removeAllListeners('fetch');
        popup.removeAllListeners('search');
        popup.removeAllListeners('submit');
        popup.removeAllListeners('loaded');
        popup.removeAllListeners('load');
        popup.removeAllListeners('play');
        popup.removeAllListeners('stop');
        popup.removeAllListeners('uploads');
        popup.removeAllListeners('dummyUploads');
        popup.removeAllListeners('uploadFail');
        popup.removeAllListeners('fail');
        popup.removeAllListeners('error');
    } catch (e) {
        console.log('⚠️ 리스너 제거 중 오류 (무시):', e.message);
        popup.removeAllListeners();
        // close/hide 리스너 다시 등록
        popup.on('close', () => {
            console.log('🚪 팝업 닫힘');
            isPopupOpen = false;
        });
        popup.on('hide', () => {
            console.log('🚪 팝업 숨김');
            isPopupOpen = false;
        });
    }
    
    setSoundPopupEvent(popup);
    
    // Entry 리소스 로드 확인
    if (!assets.sound || assets.sound.length === 0) {
        console.log('⏳ Entry 사운드 리소스 로드 중...');
        await assets.loadResources();
    }
    
    // 🔥 서브카테고리 포함 카테고리 추출
    const soundCategories = assets.extractSoundCategories ? 
        assets.extractSoundCategories() : 
        extractSoundCategoriesLocal();
    
    console.log('🔊 사운드 팝업 카테고리:', soundCategories.map(c => `${c.name}(${c.children?.length || 0})`));
    
    const sidebar = getSidebarTemplate({ category: soundCategories });
    popup.setData({ sidebar });
    
    // 초기 데이터 로드 (첫 번째 카테고리 기준)
    const firstCategory = soundCategories[0]?.id || 'all';
    let filteredSounds = assets.sound || [];
    if (firstCategory !== 'all') {
        filteredSounds = filteredSounds.filter(s => s.category?.main === firstCategory);
    }
    
    console.log(`🔊 초기 사운드 (${firstCategory}): ${filteredSounds.length}개`);
    
    // 🔥 팝업 열기 - 상태 먼저 설정
    isPopupOpen = true;
    
    // 🔥 약간의 딜레이 후 팝업 표시 (이벤트 버블링 방지)
    setTimeout(() => {
        popup.show({ type: 'sound' }, {
            data: {
                data: filteredSounds.slice(0, 50)
            }
        });
        console.log('✅ 사운드 추가 팝업 열림');
    }, 50);
}

// 🔥 로컬 fallback 함수
function extractSoundCategoriesLocal() {
    const SOUND_CATEGORIES = [
        { id: '사람', name: '사람', order: 1 },
        { id: '자연', name: '자연', order: 2 },
        { id: '사물', name: '사물', order: 3 },
        { id: '악기', name: '악기', order: 4 },
        { id: '배경음악', name: '배경음악', order: 5 },
        { id: '레트로', name: '레트로', order: 6 },
        { id: '연출', name: '연출', order: 7 },
        { id: '기타', name: '기타', order: 8 }
    ];
    
    const existingCategories = new Set();
    if (assets.sound && assets.sound.length > 0) {
        assets.sound.forEach(sound => {
            if (sound.category?.main) {
                existingCategories.add(sound.category.main);
            }
        });
    }
    
    return SOUND_CATEGORIES
        .filter(cat => existingCategories.has(cat.id))
        .map(cat => ({
            id: cat.id,
            name: cat.name,
            value: cat.id,
            label: { ko: cat.name, en: cat.id },
            categoryType: 'sound',
            depth: 1,
            children: []
        }));
}

export function openTableManager(data) {
    popup.removeAllListeners();
    setTablePopupEvent(popup);
    popup.setData({ sidebar: {} });
    popup.show({ type: 'table' }, { data: { data: [] } });
}

export function openExpansionBlockManager() {
    popup.removeAllListeners();
    setExpansionPopupEvent(popup);
    popup.setData({ sidebar: {} });
    popup.show(
        { type: 'expansion', imageBaseUrl: '/node_modules/@entrylabs/entry/images/hardware/' },
        { data: { data: getExpansionBlocks() } }
    );
}

export function openAIUtilizeBlockManager() {
    popup.removeAllListeners();
    setAIUtilizePopupEvent(popup);
    popup.setData({ sidebar: {} });
    popup.show(
        { type: 'aiUtilize', imageBaseUrl: '/node_modules/@entrylabs/entry/images/aiUtilize/' },
        { data: { data: getAiUtilizeBlocks() } }
    );
}
