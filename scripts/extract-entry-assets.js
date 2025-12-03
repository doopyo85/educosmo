// scripts/extract-entry-assets.js
// Entry 공식 구조 호환 에셋 추출 및 S3 업로드

const AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// AWS S3 설정
const s3 = new AWS.S3({
    region: process.env.AWS_REGION || 'ap-northeast-2'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'educodingnplaycontents';
const ENTRY_BASE_URL = 'https://playentry.org';
const GRAPHQL_URL = 'https://playentry.org/graphql';

class EntryAssetExtractor {
    constructor() {
        this.metadata = {
            sprites: {},
            categories: {},
            extractedAt: new Date().toISOString(),
            totalAssets: 0
        };
        this.downloadedCount = 0;
        this.errorCount = 0;
    }

    // Entry GraphQL API로 스프라이트 목록 가져오기
    async fetchSprites(category = 'all', offset = 0, limit = 50) {
        try {
            const query = `
                query GET_SPRITES($category: String!, $offset: Int!, $limit: Int!) {
                    sprites(category: $category, offset: $offset, limit: $limit) {
                        id
                        name
                        label {
                            ko
                            en
                        }
                        category {
                            main
                            sub
                        }
                        pictures {
                            id
                            name
                            filename
                            imageType
                            dimension {
                                width
                                height
                            }
                        }
                        sounds {
                            id
                            name
                            filename
                            ext
                            duration
                        }
                    }
                }
            `;

            const response = await axios.post(GRAPHQL_URL, {
                query,
                variables: { category, offset, limit }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
                    'Referer': 'https://playentry.org/',
                    'Origin': 'https://playentry.org'
                },
                timeout: 30000
            });

            return response.data.data.sprites || [];
        } catch (error) {
            console.error(`Error fetching sprites (category: ${category}, offset: ${offset}):`, error.message);
            
            // 🔥 더 자세한 오류 정보
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            }
            
            return [];
        }
    }

    // Entry 파일명에서 폴더 구조 생성
    getEntryPath(filename, type) {
        if (!filename || filename.length < 4) {
            throw new Error(`Invalid filename: ${filename}`);
        }
        
        const dir1 = filename.substr(0, 2);
        const dir2 = filename.substr(2, 2);
        
        return {
            s3Key: `entry-assets/uploads/${dir1}/${dir2}/${type}/${filename}`,
            localPath: `temp/uploads/${dir1}/${dir2}/${type}`,
            url: `${ENTRY_BASE_URL}/uploads/${dir1}/${dir2}/${type}/${filename}`
        };
    }

    // 파일 다운로드 및 S3 업로드
    async downloadAndUploadAsset(filename, type, imageType = 'png') {
        try {
            const ext = type === 'sound' ? (imageType || 'mp3') : (imageType || 'png');
            const fullFilename = filename.includes('.') ? filename : `${filename}.${ext}`;
            
            const pathInfo = this.getEntryPath(fullFilename, type);
            
            // 이미 존재하는지 확인
            try {
                await s3.headObject({
                    Bucket: BUCKET_NAME,
                    Key: pathInfo.s3Key
                }).promise();
                
                console.log(`✓ Already exists: ${pathInfo.s3Key}`);
                return true;
            } catch (error) {
                // 파일이 없으면 다운로드 진행
            }

            // Entry 서버에서 파일 다운로드
            const response = await axios.get(pathInfo.url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // S3에 업로드
            const contentType = type === 'sound' ? 'audio/mpeg' : `image/${ext}`;
            
            await s3.putObject({
                Bucket: BUCKET_NAME,
                Key: pathInfo.s3Key,
                Body: Buffer.from(response.data),
                ContentType: contentType,
                // ACL: 'public-read',  // 🔥 삭제됨
                CacheControl: 'public, max-age=31536000'
            }).promise();

            console.log(`✅ Uploaded: ${pathInfo.s3Key}`);
            this.downloadedCount++;
            return true;

        } catch (error) {
            console.error(`❌ Failed to download ${filename} (${type}):`, error.message);
            this.errorCount++;
            return false;
        }
    }

    // 스프라이트 에셋 처리
    async processSprite(sprite) {
        console.log(`\n📦 Processing sprite: ${sprite.name} (${sprite.id})`);
        
        // 메타데이터 저장
        this.metadata.sprites[sprite.id] = {
            id: sprite.id,
            name: sprite.name,
            label: sprite.label,
            category: sprite.category,
            pictures: sprite.pictures || [],
            sounds: sprite.sounds || []
        };

        // 이미지 처리
        if (sprite.pictures && sprite.pictures.length > 0) {
            for (const picture of sprite.pictures) {
                if (picture.filename) {
                    // 메인 이미지
                    await this.downloadAndUploadAsset(
                        picture.filename, 
                        'image', 
                        picture.imageType
                    );
                    
                    // 썸네일
                    await this.downloadAndUploadAsset(
                        picture.filename, 
                        'thumb', 
                        picture.imageType
                    );
                    
                    // 1초 대기 (서버 부하 방지)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // 사운드 처리  
        if (sprite.sounds && sprite.sounds.length > 0) {
            for (const sound of sprite.sounds) {
                if (sound.filename) {
                    await this.downloadAndUploadAsset(
                        sound.filename, 
                        'sound', 
                        sound.ext?.replace('.', '') || 'mp3'
                    );
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    }

    // 전체 추출 실행
    async extractAllAssets() {
        console.log('🚀 Entry 에셋 추출 시작...');
        
        // 주요 카테고리들
        const categories = [
            'entrybot_friends',
            'people', 
            'animal',
            'plant',
            'vehicle',
            'thing',
            'nature',
            'background'
        ];

        for (const category of categories) {
            console.log(`\n📂 카테고리: ${category}`);
            
            let offset = 0;
            let hasMore = true;
            
            while (hasMore) {
                const sprites = await this.fetchSprites(category, offset, 50);
                
                if (sprites.length === 0) {
                    hasMore = false;
                    break;
                }
                
                for (const sprite of sprites) {
                    await this.processSprite(sprite);
                }
                
                offset += sprites.length;
                console.log(`  📊 진행률: ${offset}개 처리 완료`);
                
                // 다음 요청 전 대기
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // 메타데이터 저장
        await this.saveMetadata();
        
        console.log(`\n🎉 추출 완료!`);
        console.log(`✅ 성공: ${this.downloadedCount}개`);
        console.log(`❌ 실패: ${this.errorCount}개`);
        console.log(`📋 총 스프라이트: ${Object.keys(this.metadata.sprites).length}개`);
    }

    // 메타데이터를 S3와 로컬에 저장
    async saveMetadata() {
        this.metadata.totalAssets = Object.keys(this.metadata.sprites).length;
        const metadataJson = JSON.stringify(this.metadata, null, 2);
        
        // 로컬 백업
        const localPath = 'temp/entry-assets-metadata.json';
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, metadataJson);
        
        // S3 업로드
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: 'entry-assets/metadata.json',
            Body: metadataJson,
            ContentType: 'application/json'
            // ACL: 'public-read'  // 🔥 삭제됨
        }).promise();
        
        console.log('💾 메타데이터 저장 완료');
    }
}

// 실행
async function main() {
    const extractor = new EntryAssetExtractor();
    
    try {
        await extractor.extractAllAssets();
    } catch (error) {
        console.error('❌ 추출 중 오류 발생:', error);
        process.exit(1);
    }
}

// 직접 실행시
if (require.main === module) {
    main();
}

module.exports = EntryAssetExtractor;