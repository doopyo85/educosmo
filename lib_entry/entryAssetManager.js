/**
 * Entry 에셋 관리자
 * S3에 업로드된 오프라인 Entry 에셋을 관리하고 Entry DataAPI 형식으로 제공
 */

const fs = require('fs');
const path = require('path');

class EntryAssetManager {
    constructor(metadataPath = null) {
        this.metadataPath = metadataPath || path.join(__dirname, '..', 'metadata.json');
        this.metadata = null;
        this.baseUrl = 'https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/uploads';
        
        this.loadMetadata();
    }
    
    /**
     * 메타데이터 로드
     */
    loadMetadata() {
        try {
            if (fs.existsSync(this.metadataPath)) {
                this.metadata = JSON.parse(fs.readFileSync(this.metadataPath, 'utf8'));
                console.log('✅ Entry 에셋 메타데이터 로드 성공:', this.metadataPath);
            } else {
                console.log('⚠️ Entry 에셋 메타데이터 파일이 없습니다. 기본 메타데이터를 생성합니다.');
                this.createDefaultMetadata();
            }
        } catch (error) {
            console.error('❌ Entry 에셋 메타데이터 로드 실패:', error);
            this.createDefaultMetadata();
        }
    }
    
    /**
     * 기본 메타데이터 생성
     */
    createDefaultMetadata() {
        this.metadata = {
            categories: [
                { id: 'entrybot_friends', name: '엔트리봇' },
                { id: 'animal', name: '동물' },
                { id: 'thing', name: '사물' },
                { id: 'background', name: '배경' },
                { id: 'characters', name: '캐릭터' },
                { id: 'other', name: '기타' }
            ],
            sprites: {}
        };
        
        // 샘플 스프라이트 데이터 추가
        this.addSampleSprites();
    }
    
    /**
     * 샘플 스프라이트 데이터 추가
     */
    addSampleSprites() {
        const sampleSprites = [
            {
                id: 'entrybot',
                name: '엔트리봇',
                category: 'entrybot_friends',
                pictures: [{
                    id: 'entrybot_pic1',
                    name: '엔트리봇',
                    filename: 'entrybot.png',
                    imageType: 'png',
                    dimension: { width: 80, height: 80 },
                    fileurl: `${this.baseUrl}/images/entrybot.png`
                }],
                sounds: []
            },
            {
                id: 'cat',
                name: '고양이',
                category: 'animal',
                pictures: [{
                    id: 'cat_pic1',
                    name: '고양이',
                    filename: 'cat.png',
                    imageType: 'png',
                    dimension: { width: 80, height: 80 },
                    fileurl: `${this.baseUrl}/images/cat.png`
                }],
                sounds: []
            },
            {
                id: 'dog',
                name: '강아지',
                category: 'animal',
                pictures: [{
                    id: 'dog_pic1',
                    name: '강아지',
                    filename: 'dog.png',
                    imageType: 'png',
                    dimension: { width: 80, height: 80 },
                    fileurl: `${this.baseUrl}/images/dog.png`
                }],
                sounds: []
            }
        ];
        
        sampleSprites.forEach(sprite => {
            this.metadata.sprites[sprite.id] = sprite;
        });
        
        console.log('📦 샘플 스프라이트 데이터 생성 완료');
    }
    
    /**
     * 카테고리 목록 반환
     */
    getCategories() {
        if (!this.metadata || !this.metadata.categories) {
            return [
                { id: 'entrybot_friends', name: '엔트리봇' },
                { id: 'animal', name: '동물' },
                { id: 'thing', name: '사물' },
                { id: 'background', name: '배경' },
                { id: 'characters', name: '캐릭터' },
                { id: 'other', name: '기타' }
            ];
        }
        
        return this.metadata.categories;
    }
    
    /**
     * 카테고리별 스프라이트 목록 반환
     */
    getSpritesByCategory(categoryId = 'characters', page = 1, limit = 20) {
        if (!this.metadata || !this.metadata.sprites) {
            return { sprites: [], total: 0, page: page, limit: limit };
        }
        
        // 카테고리별 필터링
        const allSprites = Object.values(this.metadata.sprites);
        const filteredSprites = allSprites.filter(sprite => 
            sprite.category === categoryId || categoryId === 'all'
        );
        
        // 페이지네이션
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const sprites = filteredSprites.slice(startIndex, endIndex);
        
        return {
            sprites: sprites,
            total: filteredSprites.length,
            page: page,
            limit: limit,
            totalPages: Math.ceil(filteredSprites.length / limit)
        };
    }
    
    /**
     * 스프라이트 검색
     */
    searchSprites(searchTerm, categoryId = null) {
        if (!this.metadata || !this.metadata.sprites) {
            return [];
        }
        
        const allSprites = Object.values(this.metadata.sprites);
        let filteredSprites = allSprites;
        
        // 카테고리 필터링
        if (categoryId && categoryId !== 'all') {
            filteredSprites = filteredSprites.filter(sprite => 
                sprite.category === categoryId
            );
        }
        
        // 검색어 필터링
        if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filteredSprites = filteredSprites.filter(sprite => 
                sprite.name.toLowerCase().includes(term) ||
                sprite.id.toLowerCase().includes(term) ||
                (sprite.label && sprite.label.ko && sprite.label.ko.toLowerCase().includes(term)) ||
                (sprite.label && sprite.label.en && sprite.label.en.toLowerCase().includes(term))
            );
        }
        
        return filteredSprites;
    }
    
    /**
     * 특정 스프라이트 반환
     */
    getSpriteById(spriteId) {
        if (!this.metadata || !this.metadata.sprites) {
            return null;
        }
        
        return this.metadata.sprites[spriteId] || null;
    }
    
    /**
     * 모든 그림(Pictures) 반환
     */
    getAllPictures() {
        if (!this.metadata || !this.metadata.sprites) {
            return [];
        }
        
        const allPictures = [];
        Object.values(this.metadata.sprites).forEach(sprite => {
            if (sprite.pictures && Array.isArray(sprite.pictures)) {
                allPictures.push(...sprite.pictures);
            }
        });
        
        return allPictures;
    }
    
    /**
     * 모든 사운드 반환
     */
    getAllSounds() {
        if (!this.metadata || !this.metadata.sprites) {
            return [];
        }
        
        const allSounds = [];
        Object.values(this.metadata.sprites).forEach(sprite => {
            if (sprite.sounds && Array.isArray(sprite.sounds)) {
                allSounds.push(...sprite.sounds);
            }
        });
        
        return allSounds;
    }
    
    /**
     * 메타데이터 상태 확인
     */
    getStatus() {
        return {
            hasMetadata: !!this.metadata,
            metadataPath: this.metadataPath,
            baseUrl: this.baseUrl,
            totalCategories: this.metadata?.categories?.length || 0,
            totalSprites: Object.keys(this.metadata?.sprites || {}).length,
            totalPictures: this.getAllPictures().length,
            totalSounds: this.getAllSounds().length
        };
    }
    
    /**
     * 메타데이터를 Entry DataAPI 표준 형식으로 변환
     */
    toEntryFormat() {
        const status = this.getStatus();
        
        return {
            categories: this.getCategories(),
            sprites: Object.values(this.metadata?.sprites || {}),
            baseUrl: this.baseUrl,
            imageBaseUrl: `${this.baseUrl}/images/`,
            soundBaseUrl: `${this.baseUrl}/sounds/`,
            ...status
        };
    }
}

module.exports = EntryAssetManager;