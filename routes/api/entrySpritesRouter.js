const express = require('express');
const router = express.Router();
const path = require('path');
const EntryAssetManager = require('../../lib_entry/entryAssetManager');

// EntryAssetManager 인스턴스 생성
const assetManager = new EntryAssetManager(path.join(__dirname, '../../metadata.json'));

/**
 * 🔧 미들웨어: CORS 및 응답 헤더 설정
 */
router.use((req, res, next) => {
  // EntryJS에서 요구하는 CORS 헤더
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Content-Type', 'application/json; charset=utf-8');
  
  // OPTIONS 프리플라이트 요청 처리
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

/**
 * 📁 GET /entry/api/sprite/categories
 * EntryJS 오브젝트 추가 팝업의 카테고리 목록 제공
 */
router.get('/categories', (req, res) => {
  try {
    const categories = assetManager.getCategories();
    
    console.log(`📁 카테고리 요청 - 반환 개수: ${categories.length}`);
    
    res.json(categories);
  } catch (error) {
    console.error('❌ 카테고리 조회 오류:', error);
    res.status(500).json({ 
      error: 'Failed to load categories',
      details: error.message 
    });
  }
});

/**
 * 🎨 GET /entry/api/sprite/list
 * 특정 카테고리의 스프라이트 목록 제공 (페이징 지원)
 * 쿼리 파라미터: category, page, limit, search
 */
router.get('/list', (req, res) => {
  try {
    const { 
      category, 
      page = 1, 
      limit = 20, 
      search 
    } = req.query;

    console.log(`🎨 스프라이트 목록 요청 - 카테고리: ${category}, 페이지: ${page}`);

    // 검색 기능
    if (search) {
      const searchResults = assetManager.searchSprites(search, category);
      return res.json({
        sprites: searchResults.slice((page - 1) * limit, page * limit),
        total: searchResults.length,
        page: parseInt(page),
        totalPages: Math.ceil(searchResults.length / limit),
        isSearch: true,
        searchTerm: search
      });
    }

    // 카테고리 파라미터 필수 체크
    if (!category) {
      return res.status(400).json({ 
        error: 'category 파라미터가 필요합니다.',
        example: '/entry/api/sprite/list?category=characters'
      });
    }

    const result = assetManager.getSpritesByCategory(category, Number(page), Number(limit));
    
    console.log(`✅ 스프라이트 반환 - ${result.sprites.length}개 (전체: ${result.total})`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ 스프라이트 목록 조회 오류:', error);
    res.status(500).json({ 
      error: 'Failed to load sprites',
      details: error.message 
    });
  }
});

/**
 * 🔍 GET /entry/api/sprite/:spriteId
 * 특정 스프라이트의 상세 정보 제공
 */
router.get('/:spriteId', (req, res) => {
  try {
    const { spriteId } = req.params;
    
    console.log(`🔍 스프라이트 상세 요청 - ID: ${spriteId}`);
    
    const sprite = assetManager.getSpriteDetail(spriteId);
    
    if (!sprite) {
      return res.status(404).json({ 
        error: 'Sprite not found',
        spriteId: spriteId 
      });
    }
    
    console.log(`✅ 스프라이트 상세 반환 - ${sprite.name}`);
    
    res.json(sprite);
  } catch (error) {
    console.error('❌ 스프라이트 상세 조회 오류:', error);
    res.status(500).json({ 
      error: 'Failed to load sprite detail',
      details: error.message 
    });
  }
});

/**
 * 🔄 POST /entry/api/sprite/refresh
 * 메타데이터 새로고침 (S3 동기화 후 호출)
 */
router.post('/refresh', (req, res) => {
  try {
    assetManager.refreshMetadata();
    
    console.log('🔄 메타데이터 새로고침 완료');
    
    res.json({ 
      success: true, 
      message: 'Metadata refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 메타데이터 새로고침 오류:', error);
    res.status(500).json({ 
      error: 'Failed to refresh metadata',
      details: error.message 
    });
  }
});

/**
 * 🧪 GET /entry/api/sprite/status
 * 시스템 상태 및 디버그 정보 제공
 */
router.get('/status', (req, res) => {
  try {
    const status = assetManager.getStatus();
    
    console.log('🧪 시스템 상태 요청');
    
    res.json(status);
  } catch (error) {
    console.error('❌ 시스템 상태 조회 오류:', error);
    res.status(500).json({ 
      error: 'Failed to get system status',
      details: error.message 
    });
  }
});

/**
 * 🐛 에러 핸들링 미들웨어
 */
router.use((err, req, res, next) => {
  console.error('🐛 EntrySprites Router 오류:', err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;