// routes/api/entryAssetRouter.js
// S3 기반 Entry 에셋 API 라우터

const express = require('express');
const router = express.Router();
const S3EntryAssetManager = require('../../lib/s3EntryAssetManager');
const AWS = require('aws-sdk');
const axios = require('axios');

const assetManager = new S3EntryAssetManager();

// 스프라이트 검색 API (Entry-Tool 팝업용)
router.get('/sprites', async (req, res) => {
    try {
        const { 
            category = 'all', 
            limit = 50, 
            offset = 0,
            search = '' 
        } = req.query;
        
        let result;
        
        if (search && search.trim()) {
            // 텍스트 검색
            result = await assetManager.searchSprites(
                search, 
                category, 
                parseInt(limit)
            );
        } else {
            // 카테고리별 조회
            result = await assetManager.getSprites(
                category, 
                parseInt(limit), 
                parseInt(offset)
            );
        }
        
        res.json({
            success: true,
            data: result.formattedData,
            totalCount: result.totalCount,
            hasMore: result.hasMore || false
        });
        
    } catch (error) {
        console.error('스프라이트 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '스프라이트 데이터를 불러오는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// Entry-Tool 팝업 전용 사이드바 데이터
router.get('/sidebar', async (req, res) => {
    try {
        const sidebar = await assetManager.getSidebarData();
        
        res.json({
            success: true,
            sidebar
        });
        
    } catch (error) {
        console.error('사이드바 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '사이드바 데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// Entry-Tool 팝업용 통합 데이터 API
router.get('/popup-data/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { category = 'all', limit = 50 } = req.query;
        
        // Entry-Tool이 요구하는 형식으로 데이터 제공
        const [spritesResult, sidebar] = await Promise.all([
            assetManager.getSprites(category, parseInt(limit), 0),
            assetManager.getSidebarData()
        ]);
        
        const response = {
            success: true,
            sidebar,
            data: spritesResult.formattedData
        };
        
        res.json(response);
        
    } catch (error) {
        console.error(`팝업 데이터 조회 오류 (${req.params.type}):`, error);
        res.status(500).json({
            success: false,
            error: '팝업 데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// Entry 설정 정보 API
router.get('/config', async (req, res) => {
    try {
        const config = assetManager.getEntryConfig();
        
        res.json({
            success: true,
            config
        });
        
    } catch (error) {
        console.error('Entry 설정 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '설정 정보를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 헬스체크 API
router.get('/health', async (req, res) => {
    try {
        const health = await assetManager.healthCheck();
        
        const statusCode = health.status === 'healthy' ? 200 : 500;
        res.status(statusCode).json(health);
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// 개별 에셋 URL 생성 API (디버깅용)
router.get('/asset-url', (req, res) => {
    try {
        const { filename, type = 'image', ext = 'png' } = req.query;
        
        if (!filename) {
            return res.status(400).json({
                success: false,
                error: 'filename 파라미터가 필요합니다.'
            });
        }
        
        const url = assetManager.getAssetUrl(filename, type, ext);
        
        res.json({
            success: true,
            url,
            filename,
            type,
            ext
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 메타데이터 조회 API (관리자용)
router.get('/metadata', async (req, res) => {
    try {
        await assetManager.loadMetadata();
        
        res.json({
            success: true,
            metadata: {
                totalAssets: assetManager.metadata.totalAssets,
                extractedAt: assetManager.metadata.extractedAt,
                categoriesCount: Object.keys(assetManager.metadata.categories).length,
                spritesCount: Object.keys(assetManager.metadata.sprites).length
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔥 NEW: 브라우저에서 수집된 메타데이터 업로드
router.post('/upload-metadata', async (req, res) => {
    try {
        const { metadata, collectionSource, timestamp } = req.body;
        
        console.log('📥 브라우저에서 메타데이터 수신:', {
            totalAssets: metadata.totalAssets,
            categories: Object.keys(metadata.categories).length,
            sprites: Object.keys(metadata.sprites).length,
            source: collectionSource,
            timestamp
        });
        
        // 메타데이터 검증
        if (!metadata || !metadata.sprites || !metadata.categories) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 메타데이터 형식입니다.'
            });
        }
        
        // S3에 메타데이터 저장
        const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'ap-northeast-2' });
        const metadataJson = JSON.stringify(metadata, null, 2);
        
        await s3.putObject({
            Bucket: process.env.S3_BUCKET_NAME || 'educodingnplaycontents',
            Key: 'entry-assets/metadata.json',
            Body: metadataJson,
            ContentType: 'application/json'
        }).promise();
        
        console.log('✅ 메타데이터 S3 저장 완료');
        
        // 캐시 무효화
        assetManager.cache.flushAll();
        console.log('🧹 에셋 매니저 캐시 클리어됨');
        
        res.json({
            success: true,
            message: '메타데이터가 성공적으로 저장되었습니다.',
            totalAssets: metadata.totalAssets,
            totalSprites: Object.keys(metadata.sprites).length,
            totalCategories: Object.keys(metadata.categories).length,
            s3Key: 'entry-assets/metadata.json',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 메타데이터 업로드 오류:', error);
        res.status(500).json({
            success: false,
            error: '메타데이터 저장 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 🔥 NEW: 에셋 파일 다운로드 시작 (백그라운드)
router.post('/download-assets', async (req, res) => {
    try {
        const { downloadImages = true, downloadSounds = true, batchSize = 10 } = req.body;
        
        console.log('🚀 에셋 다운로드 프로세스 시작...', {
            downloadImages,
            downloadSounds,
            batchSize
        });
        
        // 즉시 응답 (비동기 처리)
        res.json({
            success: true,
            message: '에셋 다운로드가 백그라운드에서 시작되었습니다.',
            estimatedTime: '10-30분',
            downloadImages,
            downloadSounds,
            batchSize
        });
        
        // 백그라운드에서 실제 다운로드 실행
        setImmediate(async () => {
            try {
                console.log('📥 백그라운드 에셋 다운로드 시작...');
                
                // 최신 메타데이터 로드
                await assetManager.loadMetadata();
                const sprites = Object.values(assetManager.metadata.sprites);
                
                console.log(`📊 다운로드 대상: ${sprites.length}개 스프라이트`);
                
                let downloadCount = 0;
                let errorCount = 0;
                
                // S3 클라이언트 설정
                const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'ap-northeast-2' });
                const bucketName = process.env.S3_BUCKET_NAME || 'educodingnplaycontents';
                
                // 스프라이트별 에셋 다운로드
                for (const sprite of sprites) {
                    try {
                        // 이미지 다운로드
                        if (downloadImages && sprite.pictures) {
                            for (const picture of sprite.pictures) {
                                if (picture.filename) {
                                    // 메인 이미지
                                    await downloadAsset(s3, bucketName, picture.filename, 'image', picture.imageType);
                                    // 썸네일
                                    await downloadAsset(s3, bucketName, picture.filename, 'thumb', picture.imageType);
                                    downloadCount += 2;
                                    
                                    // 부하 방지 대기
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                }
                            }
                        }
                        
                        // 사운드 다운로드
                        if (downloadSounds && sprite.sounds) {
                            for (const sound of sprite.sounds) {
                                if (sound.filename) {
                                    await downloadAsset(s3, bucketName, sound.filename, 'sound', sound.ext?.replace('.', '') || 'mp3');
                                    downloadCount++;
                                    
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                }
                            }
                        }
                        
                        // 진행률 로그 (100개마다)
                        if (downloadCount % 100 === 0) {
                            console.log(`📊 다운로드 진행: ${downloadCount}개 완료, 오류: ${errorCount}개`);
                        }
                        
                    } catch (error) {
                        errorCount++;
                        console.error(`❌ 스프라이트 ${sprite.id} 다운로드 오류:`, error.message);
                    }
                }
                
                console.log(`🎉 백그라운드 에셋 다운로드 완료!`);
                console.log(`✅ 성공: ${downloadCount}개, ❌ 실패: ${errorCount}개`);
                
            } catch (error) {
                console.error('❌ 백그라운드 에셋 다운로드 전체 오류:', error);
            }
        });
        
    } catch (error) {
        console.error('❌ 에셋 다운로드 시작 오류:', error);
        res.status(500).json({
            success: false,
            error: '에셋 다운로드 시작 실패',
            details: error.message
        });
    }
});

// 에셋 다운로드 헬퍼 함수
async function downloadAsset(s3, bucketName, filename, type, ext) {
    try {
        const finalExt = ext || (type === 'sound' ? 'mp3' : 'png');
        const fullFilename = filename.includes('.') ? filename : `${filename}.${finalExt}`;
        
        // Entry 구조: 첫 2자/다음 2자
        const dir1 = filename.substr(0, 2);
        const dir2 = filename.substr(2, 2);
        
        const s3Key = `entry-assets/uploads/${dir1}/${dir2}/${type}/${fullFilename}`;
        const entryUrl = `https://playentry.org/uploads/${dir1}/${dir2}/${type}/${fullFilename}`;
        
        // S3에 이미 존재하는지 확인
        try {
            await s3.headObject({
                Bucket: bucketName,
                Key: s3Key
            }).promise();
            
            // 이미 존재하면 스킵
            return { success: true, skipped: true, s3Key };
            
        } catch (headError) {
            // 파일이 없으면 다운로드 진행
        }
        
        // Entry에서 파일 다운로드
        const response = await axios.get(entryUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // S3에 업로드
        const contentType = type === 'sound' ? 'audio/mpeg' : `image/${finalExt}`;
        
        await s3.putObject({
            Bucket: bucketName,
            Key: s3Key,
            Body: Buffer.from(response.data),
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000'
        }).promise();
        
        return { success: true, downloaded: true, s3Key, size: response.data.length };
        
    } catch (error) {
        throw new Error(`${filename} (${type}) 다운로드 실패: ${error.message}`);
    }
}

// 🔥 NEW: 다운로드 진행률 조회 API
router.get('/download-status', async (req, res) => {
    try {
        // S3에서 현재 업로드된 에셋 개수 확인
        const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'ap-northeast-2' });
        const bucketName = process.env.S3_BUCKET_NAME || 'educodingnplaycontents';
        
        const result = await s3.listObjectsV2({
            Bucket: bucketName,
            Prefix: 'entry-assets/uploads/',
            MaxKeys: 1000
        }).promise();
        
        const uploadedAssets = result.Contents?.length || 0;
        const isTruncated = result.IsTruncated;
        
        res.json({
            success: true,
            uploadedAssets,
            isTruncated,
            lastModified: result.Contents?.[0]?.LastModified,
            message: isTruncated ? '1000개 이상 업로드됨' : `${uploadedAssets}개 업로드 완료`
        });
        
    } catch (error) {
        console.error('다운로드 상태 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '다운로드 상태 조회 실패',
            details: error.message
        });
    }
});

module.exports = router;