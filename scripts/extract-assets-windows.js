// extract-assets-windows.js
// Windows에서 Entry-Offline 에셋 추출

const fs = require('fs');
const path = require('path');

class WindowsAssetExtractor {
    constructor() {
        // 상위 폴더의 entry_offline/extracted 폴더 참조
        this.sourceDir = path.join(__dirname, '..', '..', 'entry_offline', 'extracted');
        this.outputDir = path.join(__dirname, '..', 'public', 'entry-assets', 'offline'); // 바로 public 폴더에 저장
        this.metadata = {
            sprites: {},
            categories: {},
            extractedAt: new Date().toISOString(),
            totalAssets: 0,
            source: 'entry-offline-v1.0.0-windows',
            version: '1.0.0'
        };
    }

    // 1단계: 디렉토리 구조 분석
    analyzeDirectory() {
        console.log('🔍 Entry-Offline 디렉토리 구조 분석...');
        console.log(`📁 소스 디렉토리: ${this.sourceDir}`);
        
        if (!fs.existsSync(this.sourceDir)) {
            throw new Error(`소스 디렉토리를 찾을 수 없습니다: ${this.sourceDir}`);
        }
        
        console.log('📁 디렉토리 구조:');
        this.logDirectoryStructure(this.sourceDir, 0, 3);
        
        // Electron 앱 구조 확인
        const possiblePaths = [
            path.join(this.sourceDir, 'resources'),
            path.join(this.sourceDir, 'resources', 'app'),
            path.join(this.sourceDir, 'resources', 'app.asar'),
            path.join(this.sourceDir, 'app'),
            path.join(this.sourceDir, 'src'),
            path.join(this.sourceDir, 'assets'),
            path.join(this.sourceDir, 'media'),
            path.join(this.sourceDir, 'static')
        ];
        
        console.log('\n🎯 중요 경로 확인:');
        possiblePaths.forEach(p => {
            if (fs.existsSync(p)) {
                console.log(`✅ 발견: ${p}`);
            } else {
                console.log(`❌ 없음: ${p}`);
            }
        });
    }

    // 2단계: ASAR 파일 추출 (Electron 앱인 경우)
    async extractAsar() {
        const asarPath = path.join(this.sourceDir, 'resources', 'app.asar');
        
        if (fs.existsSync(asarPath)) {
            console.log('📦 ASAR 파일 발견, 추출 시도...');
            
            try {
                // asar 모듈이 있으면 사용
                const asar = require('asar');
                const extractedPath = path.join(this.sourceDir, 'resources', 'app-extracted');
                
                asar.extractAll(asarPath, extractedPath);
                console.log(`✅ ASAR 추출 완료: ${extractedPath}`);
                
                // 추출된 폴더를 새로운 소스로 설정
                this.sourceDir = extractedPath;
                
            } catch (error) {
                console.log('⚠️ ASAR 추출 실패, asar 모듈이 없습니다.');
                console.log('💡 설치 방법: npm install -g asar');
                console.log('🔄 ASAR 없이 진행합니다...');
            }
        } else {
            console.log('📦 ASAR 파일 없음, 일반 폴더 구조로 진행...');
        }
    }

    // 3단계: 에셋 파일 찾기
    findAssets() {
        console.log('🔍 에셋 파일 검색 중...');
        
        const assetFiles = {
            images: [],
            sounds: [],
            metadata: [],
            asar: []
        };
        
        const searchDirectory = (dir, level = 0) => {
            if (level > 8) return; // 너무 깊이 들어가지 않도록 제한
            
            try {
                const items = fs.readdirSync(dir);
                
                for (const item of items) {
                    try {
                        const fullPath = path.join(dir, item);
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            // Entry 관련 폴더명 우선 검색
                            const dirName = item.toLowerCase();
                            if (['assets', 'resources', 'images', 'sounds', 'sprites', 'entry', 'src', 'static', 'media', 'pictures'].includes(dirName)) {
                                console.log(`📁 에셋 폴더 발견: ${fullPath}`);
                            }
                            searchDirectory(fullPath, level + 1);
                        } else {
                            const ext = path.extname(item).toLowerCase();
                            const filename = path.basename(item, ext);
                            
                            // 이미지 파일
                            if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
                                // 너무 작은 이미지는 제외 (아이콘 등)
                                if (stat.size > 1000) {
                                    assetFiles.images.push({
                                        fullPath,
                                        filename,
                                        ext: ext.replace('.', ''),
                                        relativePath: path.relative(this.sourceDir, fullPath),
                                        size: stat.size,
                                        directory: path.dirname(path.relative(this.sourceDir, fullPath))
                                    });
                                }
                            }
                            // 사운드 파일
                            else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
                                assetFiles.sounds.push({
                                    fullPath,
                                    filename,
                                    ext: ext.replace('.', ''),
                                    relativePath: path.relative(this.sourceDir, fullPath),
                                    size: stat.size,
                                    directory: path.dirname(path.relative(this.sourceDir, fullPath))
                                });
                            }
                            // 메타데이터 파일
                            else if (['.json'].includes(ext)) {
                                if (item.toLowerCase().includes('sprite') || 
                                    item.toLowerCase().includes('object') || 
                                    item.toLowerCase().includes('asset') ||
                                    item.toLowerCase().includes('entry') ||
                                    item.toLowerCase().includes('category') ||
                                    item.toLowerCase().includes('picture') ||
                                    item.toLowerCase().includes('sound')) {
                                    assetFiles.metadata.push({
                                        fullPath,
                                        filename,
                                        relativePath: path.relative(this.sourceDir, fullPath),
                                        directory: path.dirname(path.relative(this.sourceDir, fullPath))
                                    });
                                }
                            }
                            // ASAR 파일
                            else if (['.asar'].includes(ext)) {
                                assetFiles.asar.push({
                                    fullPath,
                                    filename,
                                    relativePath: path.relative(this.sourceDir, fullPath),
                                    size: stat.size
                                });
                            }
                        }
                    } catch (itemError) {
                        // 권한 오류 등은 무시
                    }
                }
            } catch (dirError) {
                // 디렉토리 접근 오류는 무시
            }
        };
        
        searchDirectory(this.sourceDir);
        
        console.log(`📊 발견된 파일:`);
        console.log(`   이미지: ${assetFiles.images.length}개`);
        console.log(`   사운드: ${assetFiles.sounds.length}개`);
        console.log(`   메타데이터: ${assetFiles.metadata.length}개`);
        console.log(`   ASAR: ${assetFiles.asar.length}개`);
        
        // 상위 몇 개 파일 미리보기
        if (assetFiles.images.length > 0) {
            console.log('\n📷 이미지 파일 예시:');
            assetFiles.images.slice(0, 5).forEach(img => {
                console.log(`   - ${img.filename}.${img.ext} (${(img.size/1024).toFixed(1)}KB) - ${img.directory}`);
            });
        }
        
        if (assetFiles.sounds.length > 0) {
            console.log('\n🔊 사운드 파일 예시:');
            assetFiles.sounds.slice(0, 5).forEach(sound => {
                console.log(`   - ${sound.filename}.${sound.ext} (${(sound.size/1024).toFixed(1)}KB) - ${sound.directory}`);
            });
        }
        
        return assetFiles;
    }

    // 4단계: 에셋을 Git 업로드용 폴더로 복사
    copyAssetsToOutput(assetFiles) {
        console.log('📂 에셋 파일 복사 중...');
        
        // 출력 디렉토리 생성
        const dirs = [
            this.outputDir,
            path.join(this.outputDir, 'images'),
            path.join(this.outputDir, 'sounds'),
            path.join(this.outputDir, 'metadata')
        ];
        
        dirs.forEach(dir => {
            fs.mkdirSync(dir, { recursive: true });
        });
        
        let copiedCount = 0;
        
        // 이미지 파일 복사 (최대 100개로 제한)
        assetFiles.images.slice(0, 100).forEach((imageFile, index) => {
            try {
                const outputFilename = `${imageFile.filename}_${index}.${imageFile.ext}`;
                const outputPath = path.join(this.outputDir, 'images', outputFilename);
                fs.copyFileSync(imageFile.fullPath, outputPath);
                copiedCount++;
                
                // 메타데이터에 추가
                this.addToMetadata('image', imageFile, index, outputFilename);
                
            } catch (error) {
                console.error(`❌ 이미지 복사 실패 (${imageFile.filename}):`, error.message);
            }
        });
        
        // 사운드 파일 복사 (최대 50개로 제한)
        assetFiles.sounds.slice(0, 50).forEach((soundFile, index) => {
            try {
                const outputFilename = `${soundFile.filename}_${index}.${soundFile.ext}`;
                const outputPath = path.join(this.outputDir, 'sounds', outputFilename);
                fs.copyFileSync(soundFile.fullPath, outputPath);
                copiedCount++;
                
                // 메타데이터에 추가
                this.addToMetadata('sound', soundFile, index, outputFilename);
                
            } catch (error) {
                console.error(`❌ 사운드 복사 실패 (${soundFile.filename}):`, error.message);
            }
        });
        
        // 메타데이터 파일 복사
        assetFiles.metadata.forEach((metaFile, index) => {
            try {
                const outputFilename = `${metaFile.filename}_${index}.json`;
                const outputPath = path.join(this.outputDir, 'metadata', outputFilename);
                fs.copyFileSync(metaFile.fullPath, outputPath);
                
            } catch (error) {
                console.error(`❌ 메타데이터 복사 실패 (${metaFile.filename}):`, error.message);
            }
        });
        
        console.log(`✅ 총 ${copiedCount}개 파일 복사 완료`);
        return copiedCount;
    }

    // 메타데이터에 파일 정보 추가
    addToMetadata(type, file,