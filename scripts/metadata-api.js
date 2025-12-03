// routes/entryRouter.js에 추가할 메타데이터 생성 API

// 🔥 NEW: 메타데이터 생성 API 추가
router.post('/api/generate-metadata', async (req, res) => {
  try {
    console.log('🔍 S3 에셋 스캔 및 메타데이터 생성 시작...');
    
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
      baseUrl: "https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads",
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
    
    console.log(`📁 S3에서 발견된 파일: ${listResult.Contents?.length || 0}개`);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      for (const object of listResult.Contents) {
        if (!object.Key.endsWith('/')) {
          const filename = path.basename(object.Key);
          const ext = path.extname(filename).toLowerCase();
          
          if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
            const baseName = path.parse(filename).name;
            const spriteId = baseName.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_');
            
            // 카테고리 추정
            let category = 'other';
            const name = filename.toLowerCase();
            if (name.includes('entrybot')) category = 'entrybot_friends';
            else if (name.includes('cat') || name.includes('dog') || name.includes('bird') || name.includes('fish')) category = 'animal';
            else if (name.includes('car') || name.includes('book') || name.includes('ball')) category = 'thing';
            else if (name.includes('background') || name.includes('bg')) category = 'background';
            else if (name.includes('character')) category = 'characters';
            
            // 한글 이름 생성
            let spriteName = baseName;
            if (name.includes('entrybot')) spriteName = '엔트리봇';
            else if (name.includes('cat')) spriteName = '고양이';
            else if (name.includes('dog')) spriteName = '강아지';
            else if (name.includes('bird')) spriteName = '새';
            else if (name.includes('fish')) spriteName = '물고기';
            else if (name.includes('car')) spriteName = '자동차';
            else if (name.includes('book')) spriteName = '책';
            else if (name.includes('ball')) spriteName = '공';
            
            console.log(`📄 처리 중: ${filename} -> ${spriteName} (${category})`);
            
            metadata.sprites[spriteId] = {
              id: spriteId,
              name: spriteName,
              category: category,
              label: {
                ko: spriteName,
                en: baseName
              },
              pictures: [{
                id: `${spriteId}_pic1`,
                name: spriteName,
                filename: filename,
                imageType: ext.substring(1),
                dimension: { width: 80, height: 80 },
                scale: 100,
                fileurl: `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads/images/${filename}`
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
    
    // 카테고리별 통계
    const categoryStats = {};
    Object.values(metadata.sprites).forEach(sprite => {
      categoryStats[sprite.category] = (categoryStats[sprite.category] || 0) + 1;
    });
    
    res.json({
      success: true,
      message: '메타데이터가 성공적으로 생성되었습니다.',
      totalAssets: metadata.totalAssets,
      categories: categoryStats,
      savedTo: metadataPath
    });
    
  } catch (error) {
    console.error('❌ 메타데이터 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: '메타데이터 생성 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});