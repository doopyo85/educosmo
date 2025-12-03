/**
 * Entry 표준 데이터 API 라우터
 * EntryJS가 기대하는 표준 형식으로 S3 데이터 제공
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 🔥 Entry 이미지 업로드 매니저
const EntryImageUploader = require('../../lib_entry/entryImageUploader');
const { authenticateUser } = require('../../lib_login/authMiddleware');

// EntryAssetManager 가져오기
const EntryAssetManager = require('../../lib_entry/entryAssetManager');

// 🔥 Multer 메모리 스토리지 설정 (S3 직접 업로드용)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Entry 허용 확장자
    const allowedExts = /\.(jpg|jpeg|png|bmp|svg|eo)$/i;
    const ext = path.extname(file.originalname);
    
    if (allowedExts.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않는 파일 형식입니다. (jpg, png, bmp, svg, eo만 가능)'));
    }
  }
});

// EntryAssetManager 인스턴스 생성
const assetManager = new EntryAssetManager(path.join(__dirname, '../../metadata.json'));

/**
 * 🔥 POST /entry/data/upload-image
 * Entry 오브젝트 이미지 업로드 (파일 올리거)
 * Content-Type: multipart/form-data
 */
router.post('/upload-image', 
  upload.single('image'), // Multer 미들웨어
  async (req, res) => {
    try {
      // 🔥 인증 체크 (유연하게)
      let userID = req.session?.userID;
      let sessionID = req.query.sessionID || req.sessionID;
      
      // 비로그인 사용자도 허용 (guest 처리)
      if (!userID) {
        userID = 'guest';
        sessionID = sessionID || `guest_${Date.now()}`;
        console.log('⚠️ 비로그인 사용자 업로드 (guest 모드)');
      }
      
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: '업로드할 파일을 선택해주세요.'
        });
      }

      console.log(`📷 Entry 이미지 업로드 요청: ${file.originalname} (User: ${userID}, Session: ${sessionID})`);

      // 1. 파일 검증 및 S3 업로드
      const uploader = new EntryImageUploader();
      const result = await uploader.uploadFile(file, userID, sessionID);

      // 2. Entry 응답 형식 반환
      res.json({
        success: true,
        filename: result.filename,
        fileurl: result.s3Url,  // 🔥 S3 직접 경로 (절대 URL)
        thumbUrl: result.s3Url, // 🔥 썰네일도 S3 직접
        s3Url: result.s3Url,
        imageType: result.imageType,
        dimension: result.dimension,
        message: '파일 업로드 완료'
      });

    } catch (error) {
      console.error('❌ 이미지 업로드 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message || '이미지 업로드에 실패했습니다.'
      });
    }
  }
);

/**
 * 🔥 POST /entry/data/upload-drawing
 * Entry 그리기 도구 저장 (Base64)
 * Content-Type: application/json
 */
router.post('/upload-drawing',
  async (req, res) => {
    try {
      const { imageData, fileName } = req.body;
      
      // 🔥 인증 체크 (유연하게)
      let userID = req.session?.userID;
      let sessionID = req.query.sessionID || req.sessionID;
      
      // 비로그인 사용자도 허용
      if (!userID) {
        userID = 'guest';
        sessionID = sessionID || `guest_${Date.now()}`;
        console.log('⚠️ 비로그인 사용자 그리기 저장 (guest 모드)');
      }

      // 1. Base64 검증
      if (!imageData || !imageData.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          error: '올바른 이미지 데이터가 아닙니다.'
        });
      }

      console.log(`🎨 Entry 그리기 저장 요청 (User: ${userID}, Session: ${sessionID})`);

      // 2. S3 업로드
      const uploader = new EntryImageUploader();
      const result = await uploader.uploadBase64Drawing(
        imageData, 
        userID, 
        sessionID, 
        fileName || `drawing_${Date.now()}.png`
      );

      // 3. Entry 응답 형식
      res.json({
        success: true,
        filename: result.filename,
        fileurl: result.s3Url,  // 🔥 S3 직접 경로
        thumbUrl: result.s3Url, // 🔥 썰네일
        s3Url: result.s3Url,
        imageType: 'png',
        dimension: result.dimension,
        message: '그림 저장 완료'
      });

    } catch (error) {
      console.error('❌ 그림 저장 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message || '그림 저장에 실패했습니다.'
      });
    }
  }
);

/**
 * 🔥 GET /entry/data/user-images
 * 사용자 업로드 이미지 목록 조회
 */
router.get('/user-images',
  authenticateUser,
  async (req, res) => {
    try {
      const userID = req.session.userID;
      const sessionID = req.query.sessionID;

      console.log(`📂 사용자 이미지 목록 조회 (User: ${userID}, Session: ${sessionID})`);

      const uploader = new EntryImageUploader();
      const images = await uploader.listUserImages(userID, sessionID);

      res.json({
        success: true,
        images: images,
        count: images.length
      });

    } catch (error) {
      console.error('❌ 이미지 목록 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message || '이미지 목록을 불러올 수 없습니다.'
      });
    }
  }
);

/**
 * 🎨 POST /api/picture/paint
 * Entry Paint Editor 표준 API
 * Entry Paint Editor가 저장 버튼 클릭 시 호출하는 엔드포인트
 * Content-Type: application/json
 */
router.post('/api/picture/paint', async (req, res) => {
  try {
    console.log('🎨 [Paint Editor] 저장 요청 받음');
    console.log('요청 바디:', req.body);
    
    // 1. 인증 체크 (유연하게 - guest 허용)
    let userID = req.session?.userID || 'guest';
    let sessionID = req.query.sessionID || 
                    req.body.sessionID || 
                    `guest_${Date.now()}`;
    
    console.log(`👤 사용자: ${userID}, 세션: ${sessionID}`);
    
    // 2. Base64 이미지 데이터 추출
    const { imageData, image, data, fileName, name } = req.body;
    const base64Data = imageData || image || data;
    const finalFileName = fileName || name || `drawing_${Date.now()}.png`;
    
    // 3. Base64 검증
    if (!base64Data) {
      console.error('❌ 이미지 데이터가 없습니다.');
      return res.status(400).json({
        success: false,
        error: '이미지 데이터가 전송되지 않았습니다.'
      });
    }
    
    if (!base64Data.startsWith('data:image/')) {
      console.error('❌ Base64 형식이 아닙니다.');
      return res.status(400).json({
        success: false,
        error: '올바른 이미지 데이터가 아닙니다.'
      });
    }
    
    console.log(`📦 Base64 데이터 크기: ${base64Data.length} bytes`);
    
    // 4. S3 업로드 (기존 로직 재사용)
    const uploader = new EntryImageUploader();
    const result = await uploader.uploadBase64Drawing(
      base64Data,
      userID,
      sessionID,
      finalFileName
    );
    
    console.log(`✅ Paint 저장 완료: ${result.s3Url}`);
    
    // 5. Entry 표준 응답 형식
    res.json({
      success: true,
      filename: result.filename,
      fileurl: result.s3Url,      // Entry가 기대하는 필드
      thumbUrl: result.s3Url,
      imageType: result.imageType,
      dimension: result.dimension,
      // 추가 정보
      s3Url: result.s3Url,
      message: 'Paint 이미지 저장 완료'
    });
    
  } catch (error) {
    console.error('❌ Paint 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Paint 이미지 저장에 실패했습니다.'
    });
  }
});

/**
 * 🎯 Entry 표준 오브젝트 목록 API
 * GET /entry/data/object/
 */
router.get('/object/', async (req, res) => {
    try {
        console.log('📋 Entry 표준 오브젝트 목록 요청');
        
        // 모든 카테고리의 스프라이트 가져오기
        const categories = assetManager.getCategories();
        let allSprites = [];
        
        for (const category of categories) {
            const result = assetManager.getSpritesByCategory(category.id);
            allSprites = allSprites.concat(result.sprites);
        }
        
        // Entry 표준 형식으로 변환
        const entryObjects = allSprites.map(sprite => convertSpriteToEntryObject(sprite));
        
        const response = {
            data: entryObjects,
            total: entryObjects.length
        };
        
        console.log(`✅ Entry 오브젝트 ${entryObjects.length}개 반환`);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Entry 오브젝트 목록 조회 실패:', error);
        res.status(500).json({ error: 'Failed to fetch objects' });
    }
});

/**
 * 🎯 Entry 표준 카테고리별 오브젝트 API
 * GET /entry/data/object/?category=character
 */
router.get('/object/', async (req, res) => {
    try {
        const { category } = req.query;
        console.log(`📋 Entry 카테고리별 오브젝트 요청: ${category}`);
        
        let sprites;
        if (category) {
            const result = assetManager.getSpritesByCategory(category);
            sprites = result.sprites;
        } else {
            // 카테고리 지정 없으면 전체
            const categories = assetManager.getCategories();
            sprites = [];
            for (const cat of categories) {
                const result = assetManager.getSpritesByCategory(cat.id);
                sprites = sprites.concat(result.sprites);
            }
        }
        
        const entryObjects = sprites.map(sprite => convertSpriteToEntryObject(sprite));
        
        const response = {
            data: entryObjects,
            total: entryObjects.length,
            category: category || 'all'
        };
        
        console.log(`✅ 카테고리 "${category}" 오브젝트 ${entryObjects.length}개 반환`);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Entry 카테고리별 오브젝트 조회 실패:', error);
        res.status(500).json({ error: 'Failed to fetch category objects' });
    }
});

/**
 * 🎯 Entry 표준 특정 오브젝트 API
 * GET /entry/data/object/:id
 */
router.get('/object/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🎯 Entry 특정 오브젝트 요청: ${id}`);
        
        // 모든 카테고리에서 해당 ID 검색
        const categories = assetManager.getCategories();
        let foundSprite = null;
        
        for (const category of categories) {
            const result = assetManager.getSpritesByCategory(category.id);
            foundSprite = result.sprites.find(sprite => sprite.id === id);
            if (foundSprite) break;
        }
        
        if (!foundSprite) {
            return res.status(404).json({ error: 'Object not found' });
        }
        
        const entryObject = convertSpriteToEntryObject(foundSprite);
        
        console.log(`✅ 오브젝트 "${id}" 반환`);
        res.json({ data: entryObject });
        
    } catch (error) {
        console.error('❌ Entry 특정 오브젝트 조회 실패:', error);
        res.status(500).json({ error: 'Failed to fetch object' });
    }
});

/**
 * 🎯 Entry 표준 카테고리 목록 API
 * GET /entry/data/category/
 */
router.get('/category/', async (req, res) => {
    try {
        console.log('📁 Entry 카테고리 목록 요청');
        
        const categories = assetManager.getCategories();
        
        // Entry 표준 카테고리 형식으로 변환
        const entryCategories = categories.map(category => ({
            id: category.id,
            name: category.name,
            type: 'object',
            visible: true
        }));
        
        const response = {
            data: entryCategories,
            total: entryCategories.length
        };
        
        console.log(`✅ Entry 카테고리 ${entryCategories.length}개 반환`);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Entry 카테고리 목록 조회 실패:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

/**
 * 🔄 S3 스프라이트를 Entry 오브젝트 형식으로 변환
 */
function convertSpriteToEntryObject(sprite) {
    return {
        id: sprite.id,
        name: sprite.name,
        category: sprite.category || 'characters',
        objectType: 'sprite',
        sprite: {
            name: sprite.name,
            pictures: sprite.pictures ? sprite.pictures.map(convertPicture) : [
                {
                    id: `${sprite.id}_pic`,
                    name: sprite.name,
                    filename: `${sprite.name}.png`,
                    imageType: 'png',
                    fileurl: sprite.thumbnail || sprite.image,
                    scale: 100,
                    dimension: {
                        width: 80,
                        height: 80
                    }
                }
            ],
            sounds: sprite.sounds ? sprite.sounds.map(convertSound) : []
        },
        // Entry가 필요로 하는 추가 필드들
        lock: false,
        entity: {
            x: 0,
            y: 0,
            regX: 0,
            regY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            direction: 90,
            visible: true
        }
    };
}

/**
 * 🖼️ 그림 데이터 변환
 */
function convertPicture(picture) {
    return {
        id: picture.id || `pic_${Date.now()}`,
        name: picture.name || 'picture',
        filename: picture.filename || 'image.png',
        imageType: picture.imageType || 'png',
        fileurl: picture.fileurl || picture.url,
        scale: picture.scale || 100,
        dimension: picture.dimension || {
            width: 80,
            height: 80
        }
    };
}

/**
 * 🔊 사운드 데이터 변환
 */
function convertSound(sound) {
    return {
        id: sound.id || `sound_${Date.now()}`,
        name: sound.name || 'sound',
        filename: sound.filename || 'sound.mp3',
        fileurl: sound.fileurl || sound.url,
        duration: sound.duration || 1
    };
}

module.exports = router;
