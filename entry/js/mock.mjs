// Entry Offline 에셋 로더
let spriteData = [];
let pictureData = [];
let soundData = [];
let isResourcesLoaded = false;

// 🔥 Entry 공식 카테고리 순서 및 한글 이름 매핑
const OFFICIAL_SPRITE_CATEGORIES = [
    { id: 'entrybot_friends', name: '엔트리봇', order: 1 },
    { id: 'new_friends', name: '우엔보', order: 2 },  // 우엔보 (우리 엔트리 봇)
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

// 🔥 숨길 카테고리 (EBS 회차, 기타 등)
const HIDDEN_CATEGORIES = [
    'EBS15회', 'EBS20회', 'EBS21회', 'EBS24회', 'EBS25회',
    'main_IYYpuwnMXN', 'other', 'thing', 'characters'
];

// 카테고리 이름 변환 함수
function getCategoryInfo(categoryId) {
    const official = OFFICIAL_SPRITE_CATEGORIES.find(c => c.id === categoryId);
    if (official) {
        return official;
    }
    // 매핑되지 않은 카테고리는 기본값 반환 (숨김 처리될 수 있음)
    return { id: categoryId, name: categoryId, order: 999 };
}

// JSON 데이터 로드 함수
async function loadEntryResources() {
    if (isResourcesLoaded) return;
    
    try {
        console.log('🚀 Entry 리소스 로드 시작...');
        
        // sprites.json 로드 (objects가 아닌 sprites!)
        const spritesResponse = await fetch('/resources/db/sprites.json');
        const sprites = await spritesResponse.json();
        
        // pictures.json 로드
        const picturesResponse = await fetch('/resources/db/pictures.json');
        const pictures = await picturesResponse.json();
        
        // sounds.json 로드
        const soundsResponse = await fetch('/resources/db/sounds.json');
        const sounds = await soundsResponse.json();
        
        // 데이터 처리
        spriteData = processSpritesData(sprites);
        pictureData = processPicturesData(pictures);
        soundData = processSoundsData(sounds);
        
        isResourcesLoaded = true;
        
        console.log('✅ Entry 리소스 로드 완료:', {
            sprites: spriteData.length,
            pictures: pictureData.length,
            sounds: soundData.length
        });
        
        return true;
    } catch (error) {
        console.error('❌ Entry 리소스 로드 실패:', error);
        return false;
    }
}

// 스프라이트 데이터 처리
function processSpritesData(sprites) {
    if (!Array.isArray(sprites)) {
        console.warn('sprites.json이 배열이 아닙니다:', typeof sprites);
        return [];
    }
    
    return sprites.map(sprite => ({
        ...sprite,
        // 이미지 경로 변환
        pictures: sprite.pictures?.map(pic => ({
            ...pic,
            fileurl: pic.fileurl || generateImagePath(pic.filename, pic.imageType || 'png'),
            thumbUrl: pic.thumbUrl || generateThumbPath(pic.filename, pic.imageType || 'png')
        })),
        // 사운드 경로 변환
        sounds: sprite.sounds?.map(sound => ({
            ...sound,
            fileurl: sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3')
        }))
    }));
}

// 이미지 데이터 처리
function processPicturesData(pictures) {
    if (!Array.isArray(pictures)) {
        console.warn('pictures.json이 배열이 아닙니다:', typeof pictures);
        return [];
    }
    
    return pictures.map(pic => ({
        ...pic,
        fileurl: pic.fileurl || generateImagePath(pic.filename, pic.imageType || 'png'),
        thumbUrl: pic.thumbUrl || generateThumbPath(pic.filename, pic.imageType || 'png')
    }));
}

// 사운드 데이터 처리
function processSoundsData(sounds) {
    if (!Array.isArray(sounds)) {
        console.warn('sounds.json이 배열이 아닙니다:', typeof sounds);
        return [];
    }
    
    return sounds.map(sound => ({
        ...sound,
        fileurl: sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3')
    }));
}

// 이미지 경로 생성
function generateImagePath(filename, imageType) {
    if (!filename) return '/images/_1x1.png';
    const folder = `${filename.substr(0,2)}/${filename.substr(2,2)}`;
    return `/resources/uploads/${folder}/image/${filename}.${imageType}`;
}

// 썸네일 경로 생성
function generateThumbPath(filename, imageType) {
    if (!filename) return '/images/_1x1.png';
    const folder = `${filename.substr(0,2)}/${filename.substr(2,2)}`;
    return `/resources/uploads/${folder}/thumb/${filename}.${imageType}`;
}

// 사운드 경로 생성
function generateSoundPath(filename, ext) {
    if (!filename) return '';
    const folder = `${filename.substr(0,2)}/${filename.substr(2,2)}`;
    return `/resources/uploads/${folder}/sound/${filename}${ext}`;
}

// 카테고리 추출 (sprites.json에서) - 공식 순서 및 한글 이름 적용
export function extractCategories() {
    const categoryMap = new Map();
    
    // sprites.json에서 카테고리 수집
    spriteData.forEach(sprite => {
        if (sprite.category?.main) {
            const main = sprite.category.main;
            
            // 숨길 카테고리 제외
            if (HIDDEN_CATEGORIES.includes(main)) {
                return;
            }
            
            if (!categoryMap.has(main)) {
                const info = getCategoryInfo(main);
                categoryMap.set(main, {
                    id: main,
                    name: info.name,  // 🔥 한글 이름 사용
                    value: main,
                    label: { ko: info.name, en: main },
                    categoryType: 'sprite',
                    depth: 1,
                    order: info.order,  // 🔥 순서 정보
                    children: []
                });
            }
        }
    });
    
    // 🔥 공식 순서대로 정렬하여 반환
    return Array.from(categoryMap.values())
        .sort((a, b) => a.order - b.order);
}

// 초기 로드 실행
loadEntryResources();

// Export - getter로 변경하여 동적 로드 지원
export const assets = {
    get sprite() { return spriteData; },
    get picture() { return pictureData; },
    get sound() { return soundData; },
    loadResources: loadEntryResources
};

assets.loadResources = loadEntryResources;

// 카테고리 export
export const spriteCategory = extractCategories();
export const soundCategory = [
    {
        id: 'people',
        name: '사람',
        value: 'people',
        label: { ko: '사람' },
        categoryType: 'sound',
        depth: 1,
        children: []
    },
    {
        id: 'nature',
        name: '자연',
        value: 'nature',
        label: { ko: '자연' },
        categoryType: 'sound',
        depth: 1,
        children: []
    }
];

// 디버깅용 전역 함수
window.debugEntryAssets = function() {
    console.log('🔍 Entry Assets 상태:', {
        loaded: isResourcesLoaded,
        sprites: spriteData.length,
        pictures: pictureData.length,
        sounds: soundData.length,
        categories: extractCategories()
    });
    return { spriteData, pictureData, soundData };
};

