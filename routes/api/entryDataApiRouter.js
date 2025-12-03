/**
 * Entry 표준 DataAPI URL 라우터
 * Entry가 기대하는 URL 엔드포인트를 제공
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const EntryAssetManager = require('../../lib_entry/entryAssetManager');

// EntryAssetManager 인스턴스 생성
const assetManager = new EntryAssetManager(path.join(__dirname, '../../metadata.json'));

/**
 * 🎯 Entry DataAPI 카테고리 엔드포인트
 * GET /api/entry/dataApi/category
 */
router.get('/category', async (req, res) => {
    try {
        console.log('📁 Entry DataAPI 카테고리 요청');
        
        const categories = assetManager.getCategories();
        
        // Entry가 기대하는 형식
        const response = categories.map(category => ({
            id: category.id,
            name: category.name,
            visible: true,
            type: 'sprite'
        }));
        
        console.log('📁 Entry DataAPI 카테고리 응답:', response);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Entry DataAPI 카테고리 오류:', error);
        res.status(500).json([]);
    }
});

/**
 * 🎨 Entry DataAPI 스프라이트 엔드포인트
 * GET /api/entry/dataApi/sprite?category=characters
 */
router.get('/sprite', async (req, res) => {
    try {
        const { category = 'characters', page = 1, limit = 20 } = req.query;
        
        console.log('🎨 Entry DataAPI 스프라이트 요청:', { category, page, limit });
        
        const result = assetManager.getSpritesByCategory(category, Number(page), Number(limit));
        
        // Entry가 기대하는 형식으로 변환
        const entrySprites = result.sprites.map(sprite => ({
            _id: sprite.id,
            name: sprite.name,
            category: sprite.category,
            pictures: sprite.pictures ? sprite.pictures.map(pic => ({
                _id: pic.id || `${sprite.id}_pic`,
                name: pic.name || sprite.name,
                filename: pic.filename || `${sprite.name}.png`,
                imageType: pic.imageType || 'png',
                fileurl: pic.fileurl || sprite.thumbnail || sprite.image,
                scale: pic.scale || 100,
                dimension: pic.dimension || { width: 80, height: 80 }
            })) : [{
                _id: `${sprite.id}_pic`,
                name: sprite.name,
                filename: `${sprite.name}.png`,
                imageType: 'png',
                fileurl: sprite.thumbnail || sprite.image,
                scale: 100,
                dimension: { width: 80, height: 80 }
            }],
            sounds: sprite.sounds || [],
            objectType: 'sprite',
            sprite: {
                name: sprite.name,
                pictures: sprite.pictures || [],
                sounds: sprite.sounds || []
            }
        }));
        
        console.log(`🎨 Entry DataAPI 스프라이트 응답: ${entrySprites.length}개`);
        
        res.json(entrySprites);
        
    } catch (error) {
        console.error('❌ Entry DataAPI 스프라이트 오류:', error);
        res.status(500).json([]);
    }
});

/**
 * 🖼️ Entry DataAPI 그림 엔드포인트
 * GET /api/entry/dataApi/picture
 */
router.get('/picture', async (req, res) => {
    try {
        console.log('🖼️ Entry DataAPI 그림 요청');
        
        // 모든 스프라이트의 그림들 수집
        const categories = assetManager.getCategories();
        let allPictures = [];
        
        for (const category of categories) {
            const result = assetManager.getSpritesByCategory(category.id);
            result.sprites.forEach(sprite => {
                if (sprite.pictures) {
                    allPictures = allPictures.concat(sprite.pictures.map(pic => ({
                        _id: pic.id || `${sprite.id}_pic`,
                        name: pic.name || sprite.name,
                        filename: pic.filename || `${sprite.name}.png`,
                        imageType: pic.imageType || 'png',
                        fileurl: pic.fileurl || sprite.thumbnail || sprite.image,
                        scale: pic.scale || 100,
                        dimension: pic.dimension || { width: 80, height: 80 }
                    })));
                }
            });
        }
        
        console.log(`🖼️ Entry DataAPI 그림 응답: ${allPictures.length}개`);
        
        res.json(allPictures);
        
    } catch (error) {
        console.error('❌ Entry DataAPI 그림 오류:', error);
        res.status(500).json([]);
    }
});

/**
 * 🔊 Entry DataAPI 사운드 엔드포인트
 * GET /api/entry/dataApi/sound
 */
router.get('/sound', async (req, res) => {
    try {
        console.log('🔊 Entry DataAPI 사운드 요청');
        
        // 사운드 데이터 (현재는 빈 배열)
        const sounds = [];
        
        console.log(`🔊 Entry DataAPI 사운드 응답: ${sounds.length}개`);
        
        res.json(sounds);
        
    } catch (error) {
        console.error('❌ Entry DataAPI 사운드 오류:', error);
        res.status(500).json([]);
    }
});

/**
 * 🔄 Entry DataAPI 상태 확인 엔드포인트
 * GET /api/entry/dataApi/status
 */
router.get('/status', (req, res) => {
    try {
        const status = {
            status: 'OK',
            message: 'Entry DataAPI 서버가 정상 작동 중입니다.',
            timestamp: new Date().toISOString(),
            endpoints: {
                category: '/api/entry/dataApi/category',
                sprite: '/api/entry/dataApi/sprite?category=characters',
                picture: '/api/entry/dataApi/picture',
                sound: '/api/entry/dataApi/sound'
            }
        };
        
        console.log('🔍 Entry DataAPI 상태 확인');
        
        res.json(status);
        
    } catch (error) {
        console.error('❌ Entry DataAPI 상태 오류:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

module.exports = router;
