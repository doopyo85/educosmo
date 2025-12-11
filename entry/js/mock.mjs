// Entry Offline 에셋 로더
let spriteData = [];
let pictureData = [];
let soundData = [];
let isResourcesLoaded = false;

// 🔥 Entry 공식 카테고리 순서 및 한글 이름 매핑
const OFFICIAL_SPRITE_CATEGORIES = [
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

// 🔥 숨길 카테고리 (EBS 회차, 기타 등)
const HIDDEN_CATEGORIES = [
    'EBS15회', 'EBS20회', 'EBS21회', 'EBS24회', 'EBS25회',
    'main_IYYpuwnMXN', 'other', 'thing', 'characters'
];

// 🔥 categoryId → category 매핑 테이블 (sounds.json용)
const SOUND_CATEGORY_ID_MAP = {
    // 사람
    '5e20464eac9e9644cc0ab646': { main: '사람', sub: '일상생활' },
    '6315b10cbf1a34003026faa2': { main: '사람', sub: '음성' },
    '6315b10cbf1a34003026faa3': { main: '사람', sub: '음식' },
    '6315b10cbf1a34003026faa4': { main: '사람', sub: '축하/박수' },
    
    // 자연
    '5e20464eac9e9644cc0ab648': { main: '자연', sub: '동물' },
    '5e20464eac9e9644cc0ab649': { main: '자연', sub: '날씨' },
    '635a2ee522472a003034e7a0': { main: '자연', sub: '곤충' },
    
    // 사물
    '5e20464eac9e9644cc0ab64a': { main: '사물', sub: '자동차' },
    '5e20464eac9e9644cc0ab64b': { main: '사물', sub: '주방' },
    '6369f6a39784f9003033708b': { main: '사물', sub: '탈것' },
    
    // 악기
    '5e20464eac9e9644cc0ab64c': { main: '악기', sub: '피아노' },
    '5e20464eac9e9644cc0ab64d': { main: '악기', sub: '마림바' },
    '5e20464eac9e9644cc0ab64e': { main: '악기', sub: '드럼' },
    '5e20464eac9e9644cc0ab651': { main: '악기', sub: '전통악기' },
    '63acfc74af886f003138bf6a': { main: '악기', sub: '기타' },
    
    // 배경음악
    '6359e23a015caa00307b8fed': { main: '배경음악', sub: '동요' },
    '6359e23a015caa00307b8fee': { main: '배경음악', sub: '게임' },
    '6359e23a015caa00307b8fef': { main: '배경음악', sub: '시즌' },
    '6359e23a015caa00307b8ff0': { main: '배경음악', sub: '클래식' },
    '64ec30b3e8532700301bdd8e': { main: '배경음악', sub: '밝은' },
    '64ec30b3e8532700301bdd8f': { main: '배경음악', sub: '어두운' },
    
    // 레트로
    '64ec6b08e8532700301bde1f': { main: '레트로', sub: '타격' },
    '64ec6b08e8532700301bde20': { main: '레트로', sub: '공격' },
    '64ec6b08e8532700301bde21': { main: '레트로', sub: '비행' },
    '64ec6b08e8532700301bde22': { main: '레트로', sub: '로봇' },
    '64ec6b08e8532700301bde23': { main: '레트로', sub: '레이저' },
    '64ec6b08e8532700301bde24': { main: '레트로', sub: '무기' },
    '64ec6b08e8532700301bde27': { main: '레트로', sub: '효과' },
    '64ec6b08e8532700301bde28': { main: '레트로', sub: '캐릭터' },
    
    // 연출
    '6359f49122472a003034e757': { main: '연출', sub: '빛' },
    '6359f49122472a003034e758': { main: '연출', sub: '분위기' },
    '6359f49122472a003034e759': { main: '연출', sub: '등퇴장' },
    '6359f49122472a003034e75a': { main: '연출', sub: '알림' },
    '6359f49122472a003034e75b': { main: '연출', sub: '폭발' },
    '6359f49122472a003034e75c': { main: '연출', sub: '효과' },
    '6359f50a22472a003034e75e': { main: '연출', sub: '전자' },
    '64ec6b08e8532700301bde25': { main: '연출', sub: '경고' },
    '64ec6b08e8532700301bde26': { main: '연출', sub: '성공' },
    
    // EBS (숨김 처리)
    '667bb7629776a4d6c168cf0a': { main: 'EBS', sub: 'EBS' }
};

// 🔥 사운드 공식 카테고리 (playentry.org 기준)
const OFFICIAL_SOUND_CATEGORIES = [
    { id: '사람', name: '사람', order: 1 },
    { id: '자연', name: '자연', order: 2 },
    { id: '사물', name: '사물', order: 3 },
    { id: '악기', name: '악기', order: 4 },
    { id: '배경음악', name: '배경음악', order: 5 },
    { id: '레트로', name: '레트로', order: 6 },
    { id: '연출', name: '연출', order: 7 }
];

// 숨길 사운드 카테고리
const HIDDEN_SOUND_CATEGORIES = ['EBS', 'EBS15회', 'EBS18회'];

// 카테고리 이름 변환 함수
function getCategoryInfo(categoryId) {
    const official = OFFICIAL_SPRITE_CATEGORIES.find(c => c.id === categoryId);
    if (official) {
        return official;
    }
    return { id: categoryId, name: categoryId, order: 999 };
}

// JSON 데이터 로드 함수
async function loadEntryResources() {
    if (isResourcesLoaded) return;
    
    try {
        console.log('🚀 Entry 리소스 로드 시작...');
        
        // sprites.json 로드
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
        
        // 🔥 사운드 카테고리 디버그 출력
        const soundCategories = new Set();
        soundData.forEach(s => {
            if (s.category?.main) soundCategories.add(s.category.main);
        });
        console.log('🔊 사운드 카테고리 목록:', Array.from(soundCategories));
        
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
        pictures: sprite.pictures?.map(pic => ({
            ...pic,
            fileurl: pic.fileurl || generateImagePath(pic.filename, pic.imageType || 'png'),
            thumbUrl: pic.thumbUrl || generateThumbPath(pic.filename, pic.imageType || 'png')
        })),
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

// 🔥 사운드 데이터 처리 (categoryId → category 변환 추가)
function processSoundsData(sounds) {
    if (!Array.isArray(sounds)) {
        console.warn('sounds.json이 배열이 아닙니다:', typeof sounds);
        return [];
    }
    
    let mappedCount = 0;
    let unmappedCount = 0;
    
    const processed = sounds.map(sound => {
        // 🔥 category가 없고 categoryId가 있으면 매핑
        let category = sound.category;
        
        if (!category && sound.categoryId) {
            const mapped = SOUND_CATEGORY_ID_MAP[sound.categoryId];
            if (mapped) {
                category = mapped;
                mappedCount++;
            } else {
                // 매핑되지 않은 categoryId는 기타로 분류
                category = { main: '기타', sub: '기타' };
                unmappedCount++;
            }
        }
        
        // 숨길 카테고리 처리
        if (category && HIDDEN_SOUND_CATEGORIES.includes(category.main)) {
            category = { main: '기타', sub: category.sub || '기타' };
        }
        
        return {
            ...sound,
            category: category,
            fileurl: sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3'),
            path: sound.path || sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3')
        };
    });
    
    console.log(`🔊 사운드 categoryId 매핑 완료: ${mappedCount}개 매핑됨, ${unmappedCount}개 미매핑`);
    
    return processed;
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

// 카테고리 추출 (sprites.json에서)
export function extractCategories() {
    const categoryMap = new Map();
    
    spriteData.forEach(sprite => {
        if (sprite.category?.main) {
            const main = sprite.category.main;
            
            if (HIDDEN_CATEGORIES.includes(main)) {
                return;
            }
            
            if (!categoryMap.has(main)) {
                const info = getCategoryInfo(main);
                categoryMap.set(main, {
                    id: main,
                    name: info.name,
                    value: main,
                    label: { ko: info.name, en: main },
                    categoryType: 'sprite',
                    depth: 1,
                    order: info.order,
                    children: []
                });
            }
        }
    });
    
    return Array.from(categoryMap.values())
        .sort((a, b) => a.order - b.order);
}

// 🔥 사운드 카테고리 추출 함수 (신규)
export function extractSoundCategories() {
    const categoryMap = new Map();
    
    soundData.forEach(sound => {
        if (sound.category?.main) {
            const main = sound.category.main;
            
            // 숨길 카테고리 제외
            if (HIDDEN_SOUND_CATEGORIES.includes(main)) {
                return;
            }
            
            if (!categoryMap.has(main)) {
                // 공식 카테고리에서 순서 찾기
                const official = OFFICIAL_SOUND_CATEGORIES.find(c => c.id === main);
                const order = official ? official.order : 999;
                
                categoryMap.set(main, {
                    id: main,
                    name: main,
                    value: main,
                    label: { ko: main, en: main },
                    categoryType: 'sound',
                    depth: 1,
                    order: order,
                    children: []
                });
            }
        }
    });
    
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
    loadResources: loadEntryResources,
    extractSoundCategories: extractSoundCategories
};

assets.loadResources = loadEntryResources;
assets.extractSoundCategories = extractSoundCategories;

// 카테고리 export
export const spriteCategory = extractCategories();
export const soundCategory = extractSoundCategories();

// 디버깅용 전역 함수
window.debugEntryAssets = function() {
    console.log('🔍 Entry Assets 상태:', {
        loaded: isResourcesLoaded,
        sprites: spriteData.length,
        pictures: pictureData.length,
        sounds: soundData.length,
        spriteCategories: extractCategories(),
        soundCategories: extractSoundCategories()
    });
    return { spriteData, pictureData, soundData };
};
