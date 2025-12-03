// 🔥 메타데이터 변환 스크립트 - S3 에셋을 Entry-Tool에서 사용 가능한 형식으로 변환

const fs = require('fs');
const path = require('path');

// 기존 metadata.json 읽기
const metadataPath = path.join(__dirname, '..', 'public', 'offline', 'metadata.json');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

console.log('🔄 메타데이터 변환 시작...');
console.log(`원본 스프라이트 수: ${Object.keys(metadata.sprites).length}`);

// Entry-Tool 팝업에서 사용할 수 있는 형식으로 변환
const convertedMetadata = {
    totalAssets: 0,
    baseUrl: 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads',
    entryAssetsIntegrated: true,
    extractedFrom: 'entry-offline-v1.0.0-windows',
    sprites: [], // 배열 형태로 변환
    sounds: [],  // 별도 사운드 배열
    categories: {}, // 카테고리별 구분
    imageBaseUrl: 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads/images/',
    soundBaseUrl: 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads/sounds/'
};

// 카테고리 초기화
const initCategories = () => {
    convertedMetadata.categories = {
        entrybot_friends: {
            id: "entrybot_friends",
            name: "엔트리봇",
            value: "entrybot_friends",
            sub: { all: { id: "", name: "전체", value: "all" } }
        },
        people: {
            id: "people",
            name: "사람",
            value: "people", 
            sub: { all: { id: "", name: "전체", value: "all" } }
        },
        animal: {
            id: "animal",
            name: "동물",
            value: "animal",
            sub: { all: { id: "", name: "전체", value: "all" } }
        },
        thing: {
            id: "thing", 
            name: "사물",
            value: "thing",
            sub: { all: { id: "", name: "전체", value: "all" } }
        },
        background: {
            id: "background",
            name: "배경",
            value: "background",
            sub: { all: { id: "", name: "전체", value: "all" } }
        },
        other: {
            id: "other",
            name: "기타",
            value: "other",
            sub: { all: { id: "", name: "전체", value: "all" } }
        }
    };
};

initCategories();

// 스프라이트 변환 함수
const convertSprite = (spriteId, spriteData) => {
    const categoryMain = spriteData.category?.main || 'other';
    
    // Entry-Tool 형식으로 변환
    const converted = {
        id: spriteId,
        name: spriteData.name || spriteId,
        label: {
            ko: spriteData.label?.ko || spriteData.name || spriteId,
            en: spriteData.label?.en || spriteData.name || spriteId
        },
        category: {
            main: categoryMain,
            sub: spriteData.category?.sub || null
        },
        pictures: [],
        sounds: []
    };
    
    // 그림(이미지) 변환
    if (spriteData.pictures && spriteData.pictures.length > 0) {
        spriteData.pictures.forEach(picture => {
            converted.pictures.push({
                id: picture.id || `${spriteId}_pic`,
                name: picture.name || spriteData.name,
                label: {
                    ko: picture.name || spriteData.name,
                    en: picture.name || spriteData.name
                },
                filename: picture.filename,
                imageType: picture.imageType || 'png',
                dimension: picture.dimension || { width: 100, height: 100 },
                // 🔥 S3 URL 직접 생성
                fileurl: `${convertedMetadata.imageBaseUrl}${picture.filename}.${picture.imageType}`,
                trimmed: null
            });
        });
    }
    
    // 소리 변환
    if (spriteData.sounds && spriteData.sounds.length > 0) {
        spriteData.sounds.forEach(sound => {
            const convertedSound = {
                id: sound.id || `${spriteId}_sound`,
                name: sound.name || 'sound',
                label: {
                    ko: sound.name || 'sound',
                    en: sound.name || 'sound'
                },
                filename: sound.filename,
                ext: sound.ext || '.mp3',
                duration: sound.duration || 1,
                // 🔥 S3 URL 직접 생성
                fileurl: `${convertedMetadata.soundBaseUrl}${sound.filename}${sound.ext}`
            };
            
            converted.sounds.push(convertedSound);
            convertedMetadata.sounds.push(convertedSound); // 전체 사운드 목록에도 추가
        });
    }
    
    return converted;
};

// 스프라이트 데이터 변환
Object.entries(metadata.sprites).forEach(([spriteId, spriteData]) => {
    const converted = convertSprite(spriteId, spriteData);
    convertedMetadata.sprites.push(converted);
    convertedMetadata.totalAssets++;
});

console.log(`✅ 변환 완료:`);
console.log(`- 스프라이트: ${convertedMetadata.sprites.length}개`);
console.log(`- 전체 사운드: ${convertedMetadata.sounds.length}개`);
console.log(`- 카테고리: ${Object.keys(convertedMetadata.categories).length}개`);

// 변환된 메타데이터 저장
const outputPath = path.join(__dirname, '..', 'public', 'offline', 'metadata_converted.json');
fs.writeFileSync(outputPath, JSON.stringify(convertedMetadata, null, 2), 'utf8');
console.log(`💾 변환된 메타데이터 저장: ${outputPath}`);

// 기존 metadata.json 백업 후 교체
const backupPath = path.join(__dirname, '..', 'public', 'offline', 'metadata_original.json');
if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`📦 원본 백업 저장: ${backupPath}`);
}

fs.writeFileSync(metadataPath, JSON.stringify(convertedMetadata, null, 2), 'utf8');
console.log(`🔄 기존 metadata.json 업데이트 완료`);

console.log('🎉 메타데이터 변환 및 업데이트 완료!');

module.exports = convertedMetadata;
