// S3 이미지 스캔 및 EntryJS 메타데이터 생성 스크립트
const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const fs = require('fs');
const path = require('path');

class S3ImageMetadataGenerator {
    constructor() {
        this.s3Client = new S3Client({
            region: config.S3.REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        
        this.bucketName = config.S3.BUCKET_NAME;
        this.imagePrefix = 'ent/uploads/images/';
        this.soundPrefix = 'ent/uploads/sounds/';
        
        // EntryJS 표준 카테고리 매핑
        this.categoryMapping = {
            // 파일명 패턴으로 카테고리 자동 분류
            'entrybot': { main: 'entrybot_friends', sub: 'all', name: '엔트리봇' },
            'ani_': { main: 'animal', sub: 'all', name: '동물' },
            'icon_': { main: 'thing', sub: 'icon', name: '아이콘' },
            'entry_bg': { main: 'background', sub: 'all', name: '배경' },
            'entry_icon': { main: 'thing', sub: 'icon', name: '블록 아이콘' },
            'start_icon': { main: 'thing', sub: 'icon', name: '시작 아이콘' },
            'ui-': { main: 'thing', sub: 'ui', name: 'UI 요소' },
            'workspace': { main: 'background', sub: 'workspace', name: '작업공간' }
        };
        
        // 기본 카테고리
        this.defaultCategories = {
            entrybot_friends: { id: "entrybot_friends", name: "엔트리봇", order: 1 },
            animal: { id: "animal", name: "동물", order: 2 },
            thing: { id: "thing", name: "사물", order: 3 },
            background: { id: "background", name: "배경", order: 4 },
            other: { id: "other", name: "기타", order: 5 }
        };
    }
    
    /**
     * S3에서 이미지 목록 스캔
     */
    async scanS3Images() {
        console.log('🔍 S3 이미지 스캔 시작...');
        
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: this.imagePrefix,
                MaxKeys: 1000
            });
            
            const response = await this.s3Client.send(command);
            const objects = response.Contents || [];
            
            console.log(`📋 총 ${objects.length}개 객체 발견`);
            
            // 이미지 파일만 필터링
            const imageFiles = objects.filter(obj => {
                const ext = path.extname(obj.Key).toLowerCase();
                return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
            });
            
            console.log(`🖼️ 이미지 파일 ${imageFiles.length}개 필터링 완료`);
            
            return imageFiles;
            
        } catch (error) {
            console.error('❌ S3 이미지 스캔 실패:', error);
            throw error;
        }
    }
    
    /**
     * 파일명으로 카테고리 분류
     */
    categorizeImage(filename) {
        const lowerFilename = filename.toLowerCase();
        
        // 패턴 매칭으로 카테고리 결정
        for (const [pattern, category] of Object.entries(this.categoryMapping)) {
            if (lowerFilename.includes(pattern.toLowerCase())) {
                return category;
            }
        }
        
        // 기본 카테고리
        return { main: 'other', sub: 'all', name: '기타' };
    }
    
    /**
     * 이미지 메타데이터 생성
     */
    async generateImageMetadata(imageFile) {
        const filename = path.basename(imageFile.Key);
        const nameWithoutExt = path.parse(filename).name;
        const ext = path.extname(filename).substring(1); // 확장자에서 . 제거
        
        // 카테고리 분류
        const category = this.categorizeImage(filename);
        
        // EntryJS 표준 메타데이터 형식
        const metadata = {\n            id: `img_${nameWithoutExt}_${Date.now()}`,\n            name: nameWithoutExt.replace(/_/g, ' ').replace(/\\d+$/, '').trim() || filename,\n            filename: nameWithoutExt,\n            imageType: ext,\n            fileurl: `https://${this.bucketName}.s3.${config.S3.REGION}.amazonaws.com/${imageFile.Key}`,\n            category: {\n                main: category.main,\n                sub: category.sub || 'all'\n            },\n            dimension: {\n                width: 100,  // 기본값, 실제로는 이미지 분석 필요\n                height: 100\n            },\n            size: imageFile.Size,\n            lastModified: imageFile.LastModified\n        };\n        \n        return metadata;\n    }\n    \n    /**\n     * EntryJS 표준 스프라이트 메타데이터 생성\n     */\n    generateSpriteMetadata(images) {\n        const sprites = [];\n        const imagesByCategory = {};\n        \n        // 카테고리별 이미지 그룹화\n        images.forEach(img => {\n            const categoryKey = img.category.main;\n            if (!imagesByCategory[categoryKey]) {\n                imagesByCategory[categoryKey] = [];\n            }\n            imagesByCategory[categoryKey].push(img);\n        });\n        \n        // 각 카테고리별로 스프라이트 생성 (단순화: 이미지 1개 = 스프라이트 1개)\n        Object.entries(imagesByCategory).forEach(([categoryKey, categoryImages]) => {\n            categoryImages.forEach((img, index) => {\n                const sprite = {\n                    id: `sprite_${img.filename}`,\n                    name: img.name,\n                    label: {\n                        ko: img.name,\n                        en: img.name\n                    },\n                    category: {\n                        main: categoryKey,\n                        sub: img.category.sub\n                    },\n                    pictures: [{\n                        id: img.id,\n                        name: img.name,\n                        filename: img.filename,\n                        imageType: img.imageType,\n                        dimension: img.dimension,\n                        fileurl: img.fileurl\n                    }],\n                    sounds: [], // 현재는 사운드 없음\n                    objectType: 'sprite'\n                };\n                \n                sprites.push(sprite);\n            });\n        });\n        \n        return sprites;\n    }\n    \n    /**\n     * EntryJS 표준 카테고리 메타데이터 생성\n     */\n    generateCategoryMetadata(sprites) {\n        const categories = {};\n        \n        // 기본 카테고리 추가\n        Object.entries(this.defaultCategories).forEach(([key, cat]) => {\n            categories[key] = {\n                id: key,\n                name: cat.name,\n                value: key,\n                order: cat.order,\n                sub: {\n                    all: { id: \"\", name: \"전체\", value: \"all\" }\n                },\n                sprites: []\n            };\n        });\n        \n        // 스프라이트를 카테고리에 배정\n        sprites.forEach(sprite => {\n            const categoryKey = sprite.category.main;\n            if (categories[categoryKey]) {\n                categories[categoryKey].sprites.push(sprite.id);\n                \n                // 서브 카테고리 추가\n                const subKey = sprite.category.sub;\n                if (subKey !== 'all' && !categories[categoryKey].sub[subKey]) {\n                    categories[categoryKey].sub[subKey] = {\n                        id: subKey,\n                        name: subKey,\n                        value: subKey\n                    };\n                }\n            }\n        });\n        \n        return categories;\n    }\n    \n    /**\n     * 완전한 EntryJS 메타데이터 생성\n     */\n    async generateCompleteMetadata() {\n        console.log('🚀 EntryJS 메타데이터 생성 시작...');\n        \n        try {\n            // 1. S3 이미지 스캔\n            const imageFiles = await this.scanS3Images();\n            \n            // 2. 각 이미지의 메타데이터 생성\n            console.log('📝 이미지 메타데이터 생성 중...');\n            const images = [];\n            \n            for (const imageFile of imageFiles) {\n                try {\n                    const metadata = await this.generateImageMetadata(imageFile);\n                    images.push(metadata);\n                } catch (error) {\n                    console.error(`이미지 메타데이터 생성 실패 (${imageFile.Key}):`, error.message);\n                }\n            }\n            \n            console.log(`✅ ${images.length}개 이미지 메타데이터 생성 완료`);\n            \n            // 3. 스프라이트 메타데이터 생성\n            console.log('🎭 스프라이트 메타데이터 생성 중...');\n            const sprites = this.generateSpriteMetadata(images);\n            console.log(`✅ ${sprites.length}개 스프라이트 생성 완료`);\n            \n            // 4. 카테고리 메타데이터 생성\n            console.log('📂 카테고리 메타데이터 생성 중...');\n            const categories = this.generateCategoryMetadata(sprites);\n            console.log(`✅ ${Object.keys(categories).length}개 카테고리 생성 완료`);\n            \n            // 5. 최종 메타데이터 구조 생성\n            const completeMetadata = {\n                version: '1.0.0',\n                generatedAt: new Date().toISOString(),\n                baseUrl: `https://${this.bucketName}.s3.${config.S3.REGION}.amazonaws.com/${this.imagePrefix}`,\n                totalImages: images.length,\n                totalSprites: sprites.length,\n                totalCategories: Object.keys(categories).length,\n                \n                // EntryJS 표준 구조\n                categories: categories,\n                sprites: sprites,\n                images: images,\n                sounds: [], // 향후 구현\n                \n                // 통계 정보\n                stats: {\n                    imagesByCategory: Object.entries(categories).map(([key, cat]) => ({\n                        category: key,\n                        name: cat.name,\n                        count: cat.sprites.length\n                    }))\n                }\n            };\n            \n            return completeMetadata;\n            \n        } catch (error) {\n            console.error('❌ EntryJS 메타데이터 생성 실패:', error);\n            throw error;\n        }\n    }\n    \n    /**\n     * 메타데이터를 파일로 저장\n     */\n    async saveMetadataToFile(metadata, filename = 'entryjs-metadata.json') {\n        try {\n            const metadataDir = path.join(__dirname, '..', 'public', 'entry-metadata');\n            \n            // 디렉토리 생성\n            if (!fs.existsSync(metadataDir)) {\n                fs.mkdirSync(metadataDir, { recursive: true });\n            }\n            \n            const filePath = path.join(metadataDir, filename);\n            \n            // JSON 형식으로 저장 (보기 좋게 포맷팅)\n            fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf8');\n            \n            console.log(`💾 메타데이터 저장 완료: ${filePath}`);\n            console.log(`📊 파일 크기: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`);\n            \n            return filePath;\n            \n        } catch (error) {\n            console.error('❌ 메타데이터 파일 저장 실패:', error);\n            throw error;\n        }\n    }\n}\n\n// 스크립트 실행 함수\nasync function generateMetadata() {\n    const generator = new S3ImageMetadataGenerator();\n    \n    try {\n        console.log('🎨 S3 이미지 메타데이터 생성 시작...');\n        \n        const metadata = await generator.generateCompleteMetadata();\n        const savedPath = await generator.saveMetadataToFile(metadata);\n        \n        console.log('\\n📋 생성 완료 요약:');\n        console.log(`- 총 이미지: ${metadata.totalImages}개`);\n        console.log(`- 총 스프라이트: ${metadata.totalSprites}개`);\n        console.log(`- 총 카테고리: ${metadata.totalCategories}개`);\n        console.log(`- 저장 경로: ${savedPath}`);\n        \n        console.log('\\n📂 카테고리별 통계:');\n        metadata.stats.imagesByCategory.forEach(stat => {\n            console.log(`  - ${stat.name}: ${stat.count}개`);\n        });\n        \n        return metadata;\n        \n    } catch (error) {\n        console.error('❌ 메타데이터 생성 실패:', error);\n        process.exit(1);\n    }\n}\n\n// 직접 실행 시\nif (require.main === module) {\n    generateMetadata();\n}\n\nmodule.exports = S3ImageMetadataGenerator;