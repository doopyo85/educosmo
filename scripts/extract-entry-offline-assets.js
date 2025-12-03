// scripts/extract-entry-offline-assets.js
// Entry-Offline v1.0.0에서 에셋 추출 및 S3 업로드

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const axios = require('axios');
const extractZip = require('extract-zip');

// AWS S3 설정
const s3 = new AWS.S3({
    region: process.env.AWS_REGION || 'ap-northeast-2'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'educodingnplaycontents';

class EntryOfflineExtractor {
    constructor() {
        this.downloadDir = 'temp/entry-offline';
        this.extractDir = 'temp/entry-offline-extracted';
        this.metadata = {
            sprites: {},
            categories: {},
            extractedAt: new Date().toISOString(),
            totalAssets: 0,
            source: 'entry-offline-v1.0.0'
        };
        this.uploadedCount = 0;
        this.errorCount = 0;
    }

    // 1단계: Entry-Offline v1.0.0 다운로드
    async downloadEntryOffline() {
        console.log('🚀 Entry-Offline v1.0.0 다운로드 시작...');
        
        try {
            // v1.0.0 릴리즈 정보 직접 가져오기
            const releaseResponse = await axios.get(
                'https://api.github.com/repos/entrylabs/entry-offline/releases/tags/v1.0.0'
            );
            
            const release = releaseResponse.data;
            console.log(`📦 버전: ${release.tag_name} (${release.published_at})`);
            
            if (!release.assets || release.assets.length === 0) {
                throw new Error('v1.0.0 릴리즈에 에셋이 없습니다.');
            }
            
            // Windows .exe 파일 우선 찾기
            let asset = release.assets.find(asset => 
                asset.name.includes('Setup.exe') || 
                asset.name.includes('win') ||
                asset.name.includes('.exe')
            );
            
            // .exe가 없으면 다른 파일 찾기
            if (!asset) {
                asset = release.assets.find(asset => 
                    asset.name.includes('.zip') || 
                    asset.name.includes('.tar.gz') ||
                    asset.name.includes('.dmg') ||
                    asset.name.includes('.AppImage')
                );
            }
            
            if (!asset) {
                console.log('📋 사용 가능한 에셋 목록:');
                release.assets.forEach(a => {
                    console.log(`   - ${a.name} (${(a.size / 1024 / 1024).toFixed(1)}MB)`);
                });
                throw new Error('적합한 Entry-Offline 패키지를 찾을 수 없습니다.');
            }
            
            console.log(`📥 다운로드: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)}MB)`);
            
            // 디렉토리 생성
            fs.mkdirSync(this.downloadDir, { recursive: true });
            
            // 파일 다운로드
            const downloadPath = path.join(this.downloadDir, asset.name);
            const response = await axios({
                method: 'GET',
                url: asset.browser_download_url,
                responseType: 'stream',
                timeout: 600000, // 10분 타임아웃
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const writer = fs.createWriteStream(downloadPath);
            
            // 다운로드 진행률 표시
            let downloadedBytes = 0;
            const totalBytes = parseInt(response.headers['content-length'] || '0');
            
            response.data.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                    const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                    process.stdout.write(`\r📦 다운로드 진행률: ${progress}%`);
                }
            });
            
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('\n✅ Entry-Offline v1.0.0 다운로드 완료');
                    resolve(downloadPath);
                });
                writer.on('error', reject);
            });
            
        } catch (error) {
            console.error('❌ Entry-Offline 다운로드 실패:', error.message);
            throw error;
        }
    }

    // 2단계: 압축 파일 또는 .exe 추출
    async extractArchive(downloadPath) {
        console.log('📂 파일 추출 중...');
        
        try {
            fs.mkdirSync(this.extractDir, { recursive: true });
            
            const fileName = path.basename(downloadPath).toLowerCase();
            
            if (fileName.endsWith('.zip')) {
                // ZIP 파일 추출
                await extractZip(downloadPath, { dir: path.resolve(this.extractDir) });
                console.log('✅ ZIP 파일 추출 완료');
            } 
            else if (fileName.endsWith('.tar.gz')) {
                // TAR.GZ 파일 추출
                const tar = require('tar');
                await tar.x({
                    file: downloadPath,
                    cwd: this.extractDir
                });
                console.log('✅ TAR.GZ 파일 추출 완료');
            }
            else if (fileName.endsWith('.exe')) {
                // .exe 파일을 7zip으로 추출 시도
                await this.extractExeFile(downloadPath);
                console.log('✅ EXE 파일 추출 완료');
            }
            else {
                // 알 수 없는 형식 - 7zip으로 시도
                console.log('⚠️ 알 수 없는 파일 형식, 7zip으로 추출 시도...');
                await this.extractWithSevenZip(downloadPath);
                console.log('✅ 7zip 추출 완료');
            }
            
            return this.extractDir;
            
        } catch (error) {
            console.error('❌ 파일 추출 실패:', error.message);
            throw error;
        }
    }

    // .exe 파일 추출 (7zip 사용)
    async extractExeFile(exePath) {
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
            // 7zip 경로 찾기
            const sevenZipPaths = [
                'C:\\Program Files\\7-Zip\\7z.exe',
                'C:\\Program Files (x86)\\7-Zip\\7z.exe',
                '7z',
                '7za'
            ];
            
            let sevenZipPath = null;
            for (const testPath of sevenZipPaths) {
                try {
                    if (fs.existsSync(testPath)) {
                        sevenZipPath = testPath;
                        break;
                    }
                } catch (e) {
                    // 경로가 명령어인 경우 (PATH에 등록된 경우)
                    if (testPath === '7z' || testPath === '7za') {
                        sevenZipPath = testPath;
                        break;
                    }
                }
            }
            
            if (!sevenZipPath) {
                console.log('⚠️ 7zip을 찾을 수 없습니다. NODE 기본 압축 해제 시도...');
                this.extractWithNode(exePath).then(resolve).catch(reject);
                return;
            }
            
            console.log(`🔧 7zip 사용: ${sevenZipPath}`);
            
            const process7z = spawn(sevenZipPath, [
                'x',                    // 추출 명령
                exePath,               // 입력 파일
                `-o${this.extractDir}`, // 출력 디렉토리
                '-y'                   // 모든 질문에 yes
            ]);
            
            process7z.stdout.on('data', (data) => {
                console.log(`7z: ${data.toString().trim()}`);
            });
            
            process7z.stderr.on('data', (data) => {
                console.error(`7z 오류: ${data.toString().trim()}`);
            });
            
            process7z.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`7zip 추출 실패 (코드: ${code})`));
                }
            });
            
            process7z.on('error', (error) => {
                console.log('⚠️ 7zip 실행 실패, NODE 기본 압축 해제 시도...');
                this.extractWithNode(exePath).then(resolve).catch(reject);
            });
        });
    }

    // Node.js 기본 압축 해제 (ZIP으로 시도)
    async extractWithNode(filePath) {
        try {
            await extractZip(filePath, { dir: path.resolve(this.extractDir) });
            console.log('✅ Node.js 기본 압축 해제 성공');
        } catch (error) {
            throw new Error(`모든 압축 해제 방법 실패: ${error.message}`);
        }
    }

    // 3단계: 에셋 파일 찾기 (개선된 버전)
    async findAssets() {
        console.log('🔍 에셋 파일 검색 중...');
        
        const assetFiles = {
            images: [],
            sounds: [],
            metadata: [],
            others: []
        };
        
        // 재귀적으로 파일 검색
        const searchDirectory = (dir) => {
            try {
                const items = fs.readdirSync(dir);
                
                for (const item of items) {
                    try {
                        const fullPath = path.join(dir, item);
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            // 특정 디렉토리명을 우선 검색 (Entry 에셋이 있을 가능성이 높은 폴더)
                            const dirName = item.toLowerCase();
                            if (['assets', 'resources', 'images', 'sounds', 'sprites', 'entry', 'src'].includes(dirName)) {
                                console.log(`📁 에셋 디렉토리 발견: ${fullPath}`);
                            }
                            searchDirectory(fullPath);
                        } else {
                            const ext = path.extname(item).toLowerCase();
                            const filename = path.basename(item, ext);
                            
                            // 이미지 파일
                            if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
                                assetFiles.images.push({
                                    fullPath,
                                    filename,
                                    ext: ext.replace('.', ''),
                                    relativePath: path.relative(this.extractDir, fullPath),
                                    size: stat.size,
                                    directory: path.dirname(path.relative(this.extractDir, fullPath))
                                });
                            }
                            // 사운드 파일
                            else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
                                assetFiles.sounds.push({
                                    fullPath,
                                    filename,
                                    ext: ext.replace('.', ''),
                                    relativePath: path.relative(this.extractDir, fullPath),
                                    size: stat.size,
                                    directory: path.dirname(path.relative(this.extractDir, fullPath))
                                });
                            }
                            // 메타데이터 파일
                            else if (['.json', '.xml'].includes(ext)) {
                                // Entry 관련 메타데이터로 보이는 파일
                                if (item.toLowerCase().includes('sprite') || 
                                    item.toLowerCase().includes('object') || 
                                    item.toLowerCase().includes('asset') ||
                                    item.toLowerCase().includes('entry') ||
                                    item.toLowerCase().includes('category')) {
                                    assetFiles.metadata.push({
                                        fullPath,
                                        filename,
                                        relativePath: path.relative(this.extractDir, fullPath),
                                        directory: path.dirname(path.relative(this.extractDir, fullPath))
                                    });
                                }
                            }
                            // 기타 관심 파일
                            else if (['.js', '.css', '.html'].includes(ext)) {
                                assetFiles.others.push({
                                    fullPath,
                                    filename,
                                    ext: ext.replace('.', ''),
                                    relativePath: path.relative(this.extractDir, fullPath),
                                    directory: path.dirname(path.relative(this.extractDir, fullPath))
                                });
                            }
                        }
                    } catch (itemError) {
                        console.warn(`⚠️ 파일 처리 중 오류 (${item}):`, itemError.message);
                    }
                }
            } catch (dirError) {
                console.warn(`⚠️ 디렉토리 읽기 오류 (${dir}):`, dirError.message);
            }
        };
        
        searchDirectory(this.extractDir);
        
        console.log(`📊 발견된 파일:`);
        console.log(`   이미지: ${assetFiles.images.length}개`);
        console.log(`   사운드: ${assetFiles.sounds.length}개`);
        console.log(`   메타데이터: ${assetFiles.metadata.length}개`);
        console.log(`   기타: ${assetFiles.others.length}개`);
        
        // 에셋이 없는 경우 경고
        if (assetFiles.images.length === 0 && assetFiles.sounds.length === 0) {
            console.log('⚠️ 에셋 파일이 발견되지 않았습니다.');
            console.log('📁 추출된 디렉토리 구조:');
            this.logDirectoryStructure(this.extractDir, 0, 3); // 최대 3단계까지 표시
        }
        
        return assetFiles;
    }

    // 디렉토리 구조 로깅 (디버깅용)
    logDirectoryStructure(dir, depth = 0, maxDepth = 3) {
        if (depth > maxDepth) return;
        
        try {
            const items = fs.readdirSync(dir);
            const indent = '  '.repeat(depth);
            
            for (const item of items.slice(0, 10)) { // 최대 10개까지만 표시
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    console.log(`${indent}📁 ${item}/`);
                    this.logDirectoryStructure(fullPath, depth + 1, maxDepth);
                } else {
                    const size = stat.size > 1024 ? `(${(stat.size / 1024).toFixed(1)}KB)` : `(${stat.size}B)`;
                    console.log(`${indent}📄 ${item} ${size}`);
                }
            }
            
            if (items.length > 10) {
                console.log(`${indent}... (${items.length - 10}개 더)`);
            }
        } catch (error) {
            console.warn(`${' '.repeat(depth * 2)}⚠️ 디렉토리 읽기 실패: ${error.message}`);
        }
    }

    // 4단계: 메타데이터 분석 및 생성 (에셋이 없어도 동작)
    async analyzeMetadata(assetFiles) {
        console.log('📋 메타데이터 분석 중...');
        
        // 메타데이터 파일 읽기
        for (const metaFile of assetFiles.metadata) {
            try {
                const content = fs.readFileSync(metaFile.fullPath, 'utf8');
                const data = JSON.parse(content);
                
                console.log(`📄 메타데이터 파일 분석: ${metaFile.filename}`);
                
                // Entry 구조에 맞는 메타데이터인지 확인
                if (data.sprites || data.objects || Array.isArray(data)) {
                    console.log(`   - 유효한 Entry 메타데이터`);
                    this.parseEntryMetadata(data, metaFile.filename);
                }
                
            } catch (error) {
                console.error(`❌ 메타데이터 파일 읽기 실패 (${metaFile.filename}):`, error.message);
            }
        }
        
        // 파일 기반 메타데이터 생성 (메타데이터가 없거나 부족한 경우)
        if (assetFiles.images.length > 0 || assetFiles.sounds.length > 0) {
            await this.generateMetadataFromFiles(assetFiles);
        } else {
            console.log('⚠️ 에셋 파일이 없어서 기본 메타데이터만 생성합니다.');
            this.generateDefaultMetadata();
        }
        
        console.log(`✅ 메타데이터 분석 완료: ${Object.keys(this.metadata.sprites).length}개 스프라이트`);
    }

    // 기본 메타데이터 생성 (에셋이 없는 경우)
    generateDefaultMetadata() {
        this.metadata.sprites = {};
        this.metadata.categories = {
            'not_found': {
                id: 'not_found',
                name: '에셋 없음',
                value: 'not_found'
            }
        };
        this.metadata.totalAssets = 0;
        this.metadata.note = 'Entry-Offline v1.0.0에서 에셋을 찾을 수 없었습니다.';
    }

    // Entry 메타데이터 파싱
    parseEntryMetadata(data, source) {
        if (data.sprites) {
            // Entry 표준 형식
            Object.values(data.sprites).forEach(sprite => {
                this.metadata.sprites[sprite.id || sprite.name] = {
                    ...sprite,
                    source: `entry-offline-v1.0.0:${source}`
                };
            });
        } else if (Array.isArray(data)) {
            // 배열 형식
            data.forEach((item, index) => {
                if (item.name || item.id) {
                    const id = item.id || `offline_${index}`;
                    this.metadata.sprites[id] = {
                        ...item,
                        id,
                        source: `entry-offline-v1.0.0:${source}`
                    };
                }
            });
        }
    }

    // 파일 기반 메타데이터 생성
    async generateMetadataFromFiles(assetFiles) {
        console.log('🏗️ 파일 기반 메타데이터 생성 중...');
        
        // 카테고리별로 파일 그룹핑
        const categories = {
            'entrybot_friends': { patterns: ['entrybot', 'entry', 'bot'], name: '엔트리봇 친구들' },
            'people': { patterns: ['person', 'people', 'human', 'man', 'woman'], name: '사람' },
            'animal': { patterns: ['animal', 'cat', 'dog', 'bird', 'fish'], name: '동물' },
            'vehicle': { patterns: ['car', 'truck', 'plane', 'ship', 'vehicle'], name: '탈것' },
            'thing': { patterns: ['object', 'item', 'tool'], name: '사물' },
            'background': { patterns: ['background', 'bg', 'scene'], name: '배경' },
            'other': { patterns: [], name: '기타' }
        };
        
        // 이미지 파일 기반 스프라이트 생성
        assetFiles.images.forEach((imageFile, index) => {
            const filename = imageFile.filename.toLowerCase();
            
            // 카테고리 추정
            let category = 'other';
            for (const [catKey, catInfo] of Object.entries(categories)) {
                if (catInfo.patterns.some(pattern => filename.includes(pattern))) {
                    category = catKey;
                    break;
                }
            }
            
            const spriteId = `offline_${category}_${index}`;
            
            // 해당 이미지의 사운드 파일 찾기
            const relatedSounds = assetFiles.sounds.filter(soundFile => 
                soundFile.filename.toLowerCase().includes(imageFile.filename.toLowerCase()) ||
                imageFile.filename.toLowerCase().includes(soundFile.filename.toLowerCase())
            );
            
            this.metadata.sprites[spriteId] = {
                id: spriteId,
                name: imageFile.filename,
                label: {
                    ko: imageFile.filename,
                    en: imageFile.filename
                },
                category: {
                    main: category,
                    sub: null
                },
                pictures: [{
                    id: `${spriteId}_pic_1`,
                    name: imageFile.filename,
                    filename: imageFile.filename,
                    imageType: imageFile.ext,
                    dimension: { width: 100, height: 100 }, // 실제 크기는 나중에 측정
                    relativePath: imageFile.relativePath
                }],
                sounds: relatedSounds.map((soundFile, soundIndex) => ({
                    id: `${spriteId}_sound_${soundIndex + 1}`,
                    name: soundFile.filename,
                    filename: soundFile.filename,
                    ext: `.${soundFile.ext}`,
                    duration: 1, // 실제 길이는 나중에 측정
                    relativePath: soundFile.relativePath
                })),
                source: 'entry-offline-v1.0.0:generated'
            };
        });
        
        // 카테고리 메타데이터 설정
        Object.entries(categories).forEach(([key, info]) => {
            this.metadata.categories[key] = {
                id: key,
                name: info.name,
                value: key
            };
        });
        
        this.metadata.totalAssets = Object.keys(this.metadata.sprites).length;
    }

    // 5단계: 에셋을 Entry 구조로 S3 업로드
    async uploadAssetsToS3(assetFiles) {
        if (Object.keys(this.metadata.sprites).length === 0) {
            console.log('⚠️ 업로드할 에셋이 없습니다.');
            return;
        }
        
        console.log('☁️ S3에 에셋 업로드 시작...');
        
        for (const sprite of Object.values(this.metadata.sprites)) {
            try {
                // 이미지 업로드
                for (const picture of sprite.pictures || []) {
                    if (picture.relativePath) {
                        const localPath = path.join(this.extractDir, picture.relativePath);
                        if (fs.existsSync(localPath)) {
                            await this.uploadSingleAsset(localPath, picture.filename, 'image', picture.imageType);
                            // 썸네일도 동일한 이미지로 생성
                            await this.uploadSingleAsset(localPath, picture.filename, 'thumb', picture.imageType);
                        }
                    }
                }
                
                // 사운드 업로드
                for (const sound of sprite.sounds || []) {
                    if (sound.relativePath) {
                        const localPath = path.join(this.extractDir, sound.relativePath);
                        if (fs.existsSync(localPath)) {
                            await this.uploadSingleAsset(localPath, sound.filename, 'sound', sound.ext.replace('.', ''));
                        }
                    }
                }
                
            } catch (error) {
                console.error(`❌ 스프라이트 ${sprite.id} 업로드 오류:`, error.message);
                this.errorCount++;
            }
        }
        
        console.log(`✅ 에셋 업로드 완료: ${this.uploadedCount}개 성공, ${this.errorCount}개 실패`);
    }

    // 개별 에셋 업로드
    async uploadSingleAsset(localPath, filename, type, ext) {
        try {
            // Entry 구조에 맞는 랜덤 파일명 생성
            const { uid } = require('uid');
            const Puid = require('puid');
            const puid = new Puid();
            const entryFilename = uid(8) + puid.generate();
            
            // Entry 구조: 첫 2자/다음 2자
            const dir1 = entryFilename.substr(0, 2);
            const dir2 = entryFilename.substr(2, 2);
            
            const finalExt = ext || (type === 'sound' ? 'mp3' : 'png');
            const fullFilename = `${entryFilename}.${finalExt}`;
            const s3Key = `entry-assets/uploads/${dir1}/${dir2}/${type}/${fullFilename}`;
            
            // 파일 읽기
            const fileBuffer = fs.readFileSync(localPath);
            const contentType = type === 'sound' ? 'audio/mpeg' : `image/${finalExt}`;
            
            // S3 업로드
            await s3.putObject({
                Bucket: BUCKET_NAME,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000'
            }).promise();
            
            console.log(`✅ 업로드: ${s3Key}`);
            this.uploadedCount++;
            
            // 메타데이터 업데이트 (Entry 파일명으로 변경)
            this.updateMetadataFilename(filename, entryFilename, type);
            
            return { success: true, s3Key, entryFilename };
            
        } catch (error) {
            throw new Error(`${filename} (${type}) 업로드 실패: ${error.message}`);
        }
    }

    // 메타데이터의 파일명을 Entry 형식으로 업데이트
    updateMetadataFilename(originalFilename, entryFilename, type) {
        Object.values(this.metadata.sprites).forEach(sprite => {
            if (type === 'image' || type === 'thumb') {
                sprite.pictures?.forEach(picture => {
                    if (picture.filename === originalFilename || 
                        picture.relativePath?.includes(originalFilename)) {
                        picture.filename = entryFilename;
                        delete picture.relativePath;
                    }
                });
            } else if (type === 'sound') {
                sprite.sounds?.forEach(sound => {
                    if (sound.filename === originalFilename ||
                        sound.relativePath?.includes(originalFilename)) {
                        sound.filename = entryFilename;
                        delete sound.relativePath;
                    }
                });
            }
        });
    }

    // 6단계: 메타데이터 S3 업로드
    async uploadMetadata() {
        try {
            console.log('📤 메타데이터 S3 업로드...');
            
            const metadataJson = JSON.stringify(this.metadata, null, 2);
            
            // 로컬 백업
            const localPath = 'temp/entry-offline-v1.0.0-metadata.json';
            fs.mkdirSync(path.dirname(localPath), { recursive: true });
            fs.writeFileSync(localPath, metadataJson);
            
            // S3 업로드
            await s3.putObject({
                Bucket: BUCKET_NAME,
                Key: 'entry-assets/metadata-v1.0.0.json',
                Body: metadataJson,
                ContentType: 'application/json'
            }).promise();
            
            console.log('✅ 메타데이터 업로드 완료');
            console.log(`📄 로컬 백업: ${localPath}`);
            
        } catch (error) {
            console.error('❌ 메타데이터 업로드 실패:', error);
            throw error;
        }
    }

    // 메인 실행 함수
    async execute() {
        try {
            console.log('🎯 Entry-Offline v1.0.0 에셋 추출 시작!');
            console.log('📌 ChatGPT 권장사항: v1.0.0에서만 에셋 파일이 포함됨');
            
            // 1단계: v1.0.0 다운로드
            const downloadPath = await this.downloadEntryOffline();
            
            // 2단계: 추출 (exe, zip 등 지원)
            await this.extractArchive(downloadPath);
            
            // 3단계: 에셋 검색 (에러 처리 강화)
            const assetFiles = await this.findAssets();
            
            // 4단계: 메타데이터 분석 (에셋이 없어도 동작)
            await this.analyzeMetadata(assetFiles);
            
            // 5단계: S3 업로드 (에셋이 있는 경우만)
            if (Object.keys(this.metadata.sprites).length > 0) {
                await this.uploadAssetsToS3(assetFiles);
            }
            
            // 6단계: 메타데이터 업로드 (항상 실행)
            await this.uploadMetadata();
            
            console.log('🎉 Entry-Offline v1.0.0 에셋 추출 완료!');
            console.log(`📊 결과:`);
            console.log(`   - 소스 버전: ${this.metadata.source}`);
            console.log(`   - 총 스프라이트: ${this.metadata.totalAssets}개`);
            console.log(`   - 업로드 성공: ${this.uploadedCount}개`);
            console.log(`   - 업로드 실패: ${this.errorCount}개`);
            
            if (this.metadata.totalAssets === 0) {
                console.log('');
                console.log('💡 에셋을 찾을 수 없는 경우 해결책:');
                console.log('   1. Entry-Offline v1.0.0 이외의 버전에는 에셋이 없을 수 있습니다');
                console.log('   2. 수동으로 GitHub에서 Entry_1.0.0_Setup.exe 다운로드 시도');
                console.log('   3. 7-Zip을 설치하여 .exe 파일 추출 개선');
                console.log('   4. Entry 공식 에셋 라이브러리 사용 고려');
            }
            
            return this.metadata;
            
        } catch (error) {
            console.error('💥 Entry-Offline 에셋 추출 실패:', error);
            console.log('');
            console.log('🔧 문제 해결 가이드:');
            console.log('   1. 인터넷 연결 확인');
            console.log('   2. GitHub API 제한 확인 (1시간 후 재시도)');
            console.log('   3. AWS S3 권한 확인');
            console.log('   4. 7-Zip 설치 여부 확인');
            console.log('   5. temp/ 디렉토리 쓰기 권한 확인');
            throw error;
        } finally {
            // 임시 파일 정리
            this.cleanup();
        }
    }

    // 임시 파일 정리
    cleanup() {
        try {
            if (fs.existsSync(this.downloadDir)) {
                fs.rmSync(this.downloadDir, { recursive: true, force: true });
            }
            if (fs.existsSync(this.extractDir)) {
                fs.rmSync(this.extractDir, { recursive: true, force: true });
            }
            console.log('🧹 임시 파일 정리 완료');
        } catch (error) {
            console.error('⚠️ 임시 파일 정리 실패:', error.message);
        }
    }

    // 추가: 7zip으로 압축 해제 (범용)
    async extractWithSevenZip(filePath) {
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
            const sevenZipPaths = [
                'C:\\Program Files\\7-Zip\\7z.exe',
                'C:\\Program Files (x86)\\7-Zip\\7z.exe',
                '7z',
                '7za'
            ];
            
            let sevenZipPath = null;
            for (const testPath of sevenZipPaths) {
                try {
                    if (fs.existsSync(testPath) || testPath === '7z' || testPath === '7za') {
                        sevenZipPath = testPath;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!sevenZipPath) {
                throw new Error('7-Zip을 찾을 수 없습니다. https://www.7-zip.org/ 에서 설치하세요.');
            }
            
            const process7z = spawn(sevenZipPath, [
                'x',
                filePath,
                `-o${this.extractDir}`,
                '-y'
            ]);
            
            process7z.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`7zip 추출 실패 (코드: ${code})`));
                }
            });
            
            process7z.on('error', reject);
        });
    }
}

// 실행
async function main() {
    const extractor = new EntryOfflineExtractor();
    
    try {
        await extractor.execute();
        console.log('');
        console.log('✨ 전체 작업 완료!');
        console.log('🔗 다음 단계: 팝업에서 메타데이터를 로드하여 에셋 사용');
    } catch (error) {
        console.error('❌ 실행 중 오류 발생:', error);
        process.exit(1);
    }
}

// 직접 실행시
if (require.main === module) {
    main();
}

module.exports = EntryOfflineExtractor;