// scripts/generate-metadata.js - 서버용 S3 에셋 스캔 스크립트

require('dotenv').config();

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// S3 클라이언트 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'educodingnplaycontents';
const BASE_URL = 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads';

// 파일명으로 카테고리 추정
function guessCategory(filename) {
  const name = filename.toLowerCase();
  
  if (name.includes('entrybot') || name.includes('entry_bot')) return 'entrybot_friends';
  if (name.includes('cat') || name.includes('dog') || name.includes('bird') || 
      name.includes('animal') || name.includes('fish') || name.includes('rabbit')) return 'animal';
  if (name.includes('car') || name.includes('book') || name.includes('ball') ||
      name.includes('thing') || name.includes('object')) return 'thing';
  if (name.includes('background') || name.includes('bg') || name.includes('scene')) return 'background';
  if (name.includes('character') || name.includes('person') || name.includes('people')) return 'characters';
  
  return 'other';
}

// ID 생성 (파일명에서 확장자 제거 및 특수문자 처리)
function generateId(filename) {
  return path.parse(filename).name
    .replace(/[^a-zA-Z0-9가-힣]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// 이름 생성 (한글화)
function generateName(filename) {
  const baseName = path.parse(filename).name;
  
  // 일반적인 변환
  const nameMap = {
    'entrybot': '엔트리봇',
    'entrybot1_69': '엔트리봇',
    'cat': '고양이',
    'dog': '강아지',
    'bird': '새',
    'fish': '물고기',
    'rabbit': '토끼',
    'car': '자동차',
    'book': '책',
    'ball': '공',
    'background': '배경',
    'character': '캐릭터'
  };
  
  const lowerName = baseName.toLowerCase();
  for (const [eng, kor] of Object.entries(nameMap)) {
    if (lowerName.includes(eng)) {
      return kor;
    }
  }
  
  // 기본적으로 파일명 그대로 (숫자 제거)
  return baseName.replace(/[0-9_-]/g, ' ').trim() || baseName;
}

async function generateMetadata() {
  try {
    console.log('🔍 S3 에셋 스캔 시작...');
    
    // S3에서 ent/uploads/ 폴더의 이미지 파일 목록 가져오기
    const listParams = {
      Bucket: S3_BUCKET,
      Prefix: 'ent/uploads/images/',
      MaxKeys: 1000
    };
    
    const listCommand = new ListObjectsV2Command(listParams);
    const listResult = await s3Client.send(listCommand);
    
    const metadata = {
      version: "2.0",
      lastUpdated: new Date().toISOString().split('T')[0],
      totalAssets: 0,
      baseUrl: BASE_URL,
      categories: [
        { id: "entrybot_friends", name: "엔트리봇", visible: true },
        { id: "animal", name: "동물", visible: true },
        { id: "thing", name: "사물", visible: true },
        { id: "background", name: "배경", visible: true },
        { id: "characters", name: "캐릭터", visible: true },
        { id: "other", name: "기타", visible: true }
      ],
      sprites: {}
    };
    
    console.log(`📁 발견된 파일: ${listResult.Contents?.length || 0}개`);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      for (const object of listResult.Contents) {
        // 폴더가 아닌 이미지 파일만 처리
        if (!object.Key.endsWith('/')) {
          const filename = path.basename(object.Key);
          const ext = path.extname(filename).toLowerCase();
          
          // 이미지 파일만 처리
          if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
            const spriteId = generateId(filename);
            const spriteName = generateName(filename);
            const category = guessCategory(filename);
            
            console.log(`📄 처리 중: ${filename} -> ${spriteName} (${category})`);
            
            metadata.sprites[spriteId] = {
              id: spriteId,
              name: spriteName,
              category: category,
              label: {
                ko: spriteName,
                en: path.parse(filename).name
              },
              pictures: [{
                id: `${spriteId}_pic1`,
                name: spriteName,
                filename: filename,
                imageType: ext.substring(1),
                dimension: { width: 80, height: 80 }, // 기본값
                scale: 100,
                fileurl: `${BASE_URL}/images/${filename}`
              }],
              sounds: []
            };
            
            metadata.totalAssets++;
          }
        }
      }
    }
    
    // metadata.json 파일 저장
    const metadataPath = path.join(__dirname, '..', 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    console.log(`✅ 메타데이터 생성 완료: ${metadata.totalAssets}개 에셋`);
    console.log(`💾 저장 위치: ${metadataPath}`);
    
    // 카테고리별 통계
    const categoryStats = {};
    Object.values(metadata.sprites).forEach(sprite => {
      categoryStats[sprite.category] = (categoryStats[sprite.category] || 0) + 1;
    });
    
    console.log('📊 카테고리별 통계:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      const categoryName = metadata.categories.find(c => c.id === category)?.name || category;
      console.log(`  - ${categoryName}: ${count}개`);
    });
    
    return metadata;
    
  } catch (error) {
    console.error('❌ 메타데이터 생성 오류:', error);
    throw error;
  }
}

// 직접 실행시
if (require.main === module) {
  generateMetadata()
    .then(() => {
      console.log('🎉 메타데이터 생성 작업 완료!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 메타데이터 생성 실패:', error);
      process.exit(1);
    });
}

module.exports = { generateMetadata };