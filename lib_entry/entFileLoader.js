const fs = require('fs').promises;
const path = require('path');
const tar = require('tar');
const fetch = require('node-fetch');

class EntFileManager {
    constructor() {
        this.tempDir = path.join(__dirname, '..', 'temp', 'ent_files');
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
        this.maxAge = 30 * 60 * 1000; // 30분
        
        // 초기화 시 임시 디렉토리 생성
        this.initTempDir();
    }

    /**
     * 임시 디렉토리 생성
     */
    async initTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('임시 디렉토리 생성 실패:', error);
        }
    }

    /**
     * S3에서 ENT 파일 다운로드 및 파싱
     */
    async loadProjectFromS3(s3Url) {
        const startTime = Date.now();
        
        try {
            console.log('🚀 S3 ENT 파일 로드 시작:', s3Url);
            
            // 1. S3에서 ENT 파일 다운로드
            const downloadResult = await this.downloadFromS3(s3Url);
            
            // 2. ENT 파일 파싱
            const parseResult = await this.parseEntFile(downloadResult.buffer, downloadResult.fileName);
            
            // 3. 기존 복사본들 정리 (최초 한 번)
            await this.cleanupOldCopies();
            
            // 4. 심볼릭 링크로 이미지 연결
            const linkResult = await this.createSymbolicLink(parseResult.parseDir);
            console.log('✅ 이미지 파일들을 심볼릭 링크로 연결 완료:', linkResult.linkPath);
            
            const loadTime = Date.now() - startTime;
            
            console.log(`🎉 S3 ENT 파일 로드 성공! {
  fileName: '${downloadResult.fileName}',
  fileSize: '${(downloadResult.buffer.length / 1024).toFixed(1)} KB',
  objects: ${parseResult.projectData.objects?.length || 0},
  scenes: ${parseResult.projectData.scenes?.length || 0}
}`);

            return {
                success: true,
                projectData: parseResult.projectData,
                fileName: downloadResult.fileName,
                fileSize: downloadResult.buffer.length,
                loadTime: loadTime,
                loadedAt: new Date().toISOString(),
                parseDir: parseResult.parseDir,
                linkPath: linkResult.linkPath,
                metadata: {
                    objects: parseResult.projectData.objects?.length || 0,
                    scenes: parseResult.projectData.scenes?.length || 0,
                    variables: parseResult.projectData.variables?.length || 0
                }
            };
            
        } catch (error) {
            console.error('❌ S3 ENT 파일 로드 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * S3에서 파일 다운로드
     */
    async downloadFromS3(s3Url) {
        try {
            console.log('🌐 S3 다운로드 시작:', s3Url);
            
            const response = await fetch(s3Url);
            
            if (!response.ok) {
                throw new Error(`S3 다운로드 실패: ${response.status} ${response.statusText}`);
            }
            
            const buffer = await response.buffer();
            console.log(`✅ S3 다운로드 완료: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`);
            
            // 파일명 추출
            const fileName = s3Url.split('/').pop() || 'unknown.ent';
            
            return {
                buffer: buffer,
                fileName: fileName
            };
            
        } catch (error) {
            throw new Error(`S3 다운로드 오류: ${error.message}`);
        }
    }

    /**
     * ENT 파일 파싱 (TAR 압축 해제)
     */
    async parseEntFile(buffer, fileName) {
        try {
            console.log('🔧 ENT 파일 파싱 시작:', fileName);
            console.log('📦 ENT 버퍼 크기:', buffer.length, 'bytes');
            
            // 고유한 임시 디렉토리 생성
            const parseId = `parse_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
            const parseDir = path.join(this.tempDir, parseId);
            
            console.log('📁 임시 디렉토리 생성:', parseDir);
            await fs.mkdir(parseDir, { recursive: true });
            
            // ENT 파일 임시 저장
            const entFilePath = path.join(parseDir, 'downloaded.ent');
            await fs.writeFile(entFilePath, buffer);
            console.log('💾 ENT 파일 저장 완료:', entFilePath);
            
            // TAR 압축 해제
            console.log('🗜️ TAR 압축 해제 시작...');
            
            await tar.x({
                file: entFilePath,
                cwd: parseDir,
                filter: (path, entry) => {
                    console.log(`📄 압축 해제 중: ${path} (${entry.type}, ${entry.size} bytes)`);
                    return entry.type !== 'SymbolicLink' && entry.size < this.maxFileSize;
                }
            });
            
            console.log('✅ TAR 압축 해제 완료');
            
            // 압축 해제된 파일 확인
            const extractedFiles = await fs.readdir(parseDir);
            console.log('📂 압축 해제된 파일들:', extractedFiles);
            
            // project.json 찾기 및 파싱
            const projectJsonPath = path.join(parseDir, 'temp', 'project.json');
            console.log('📄 project.json 발견:', projectJsonPath);
            
            const projectJsonContent = await fs.readFile(projectJsonPath, 'utf8');
            console.log('📖 project.json 크기:', projectJsonContent.length, '문자');
            
            const projectData = JSON.parse(projectJsonContent);
            console.log('✅ project.json 파싱 완료:', {
                objects: projectData.objects?.length || 0,
                scenes: projectData.scenes?.length || 0,
                variables: projectData.variables?.length || 0
            });
            
            // 🔥 이미지 경로를 HTTPS로 변경
            if (projectData && projectData.objects) {
                console.log('🔧 이미지 경로를 HTTPS로 변경 중...');
                let imageCount = 0;
                
                projectData.objects.forEach(obj => {
                    if (obj.sprite && obj.sprite.pictures) {
                        obj.sprite.pictures.forEach(picture => {
                            if (picture.fileurl && picture.fileurl.startsWith('/entry/temp/')) {
                                // HTTP 경로를 HTTPS로 변경
                                const oldUrl = picture.fileurl;
                                picture.fileurl = `https://app.codingnplay.co.kr${picture.fileurl}`;
                                imageCount++;
                                console.log(`📸 이미지 경로 변경: ${oldUrl} → ${picture.fileurl}`);
                            }
                        });
                    }
                    
                    // 썸네일 경로도 변경
                    if (obj.sprite && obj.sprite.sounds) {
                        obj.sprite.sounds.forEach(sound => {
                            if (sound.fileurl && sound.fileurl.startsWith('/entry/temp/')) {
                                const oldUrl = sound.fileurl;
                                sound.fileurl = `https://app.codingnplay.co.kr${sound.fileurl}`;
                                console.log(`🔊 사운드 경로 변경: ${oldUrl} → ${sound.fileurl}`);
                            }
                        });
                    }
                });
                
                console.log(`✅ 총 ${imageCount}개 이미지 경로가 HTTPS로 변경됨`);
            }

            return {
                projectData: projectData,
                parseDir: parseDir,
                entFilePath: entFilePath
            };
            
        } catch (error) {
            throw new Error(`ENT 파일 파싱 오류: ${error.message}`);
        }
    }

    /**
     * 심볼릭 링크로 이미지 파일 연결
     */
    async createSymbolicLink(parseDir) {
        try {
            const currentPath = path.join(this.tempDir, 'current');
            const sourcePath = path.join(parseDir, 'temp');
            
            console.log(`🔗 심볼릭 링크 생성: ${sourcePath} → ${currentPath}`);
            
            // 1. 기존 current 디렉토리/링크 제거
            try {
                const currentStat = await fs.lstat(currentPath);
                if (currentStat.isSymbolicLink()) {
                    await fs.unlink(currentPath);
                    console.log('🗑️ 기존 심볼릭 링크 제거됨');
                } else if (currentStat.isDirectory()) {
                    await fs.rm(currentPath, { recursive: true, force: true });
                    console.log('🗑️ 기존 디렉토리 제거됨');
                }
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.log('기존 current 경로 없음 (정상)');
                }
            }
            
            // 2. 새로운 심볼릭 링크 생성
            await fs.symlink(sourcePath, currentPath);
            console.log(`✅ 심볼릭 링크 생성 완료: ${currentPath} → ${sourcePath}`);
            
            // 3. 링크 검증
            const linkStat = await fs.lstat(currentPath);
            if (!linkStat.isSymbolicLink()) {
                throw new Error('심볼릭 링크 생성 실패');
            }
            
            // 4. 실제 파일 접근 테스트
            const realPath = await fs.realpath(currentPath);
            console.log(`🔍 심볼릭 링크 대상: ${realPath}`);
            
            return {
                success: true,
                linkPath: currentPath,
                targetPath: realPath
            };
            
        } catch (error) {
            console.error('❌ 심볼릭 링크 생성 실패:', error);
            throw new Error(`심볼릭 링크 생성 실패: ${error.message}`);
        }
    }

    /**
     * 이전 버전 호환을 위한 기존 복사본 정리
     */
    async cleanupOldCopies() {
        try {
            console.log('🧹 기존 복사본 정리 시작...');
            
            const cleanupPaths = [
                path.join('/var/www/html/temp/ent_files', 'anonymous'),
                path.join('/var/www/html/temp/ent_files', 'backup'),
                // 사용자 해시 디렉토리들도 정리
            ];
            
            // 임시 디렉토리에서 parse_로 시작하지 않는 디렉토리들 찾기
            try {
                const tempDirContents = await fs.readdir(this.tempDir);
                for (const item of tempDirContents) {
                    const itemPath = path.join(this.tempDir, item);
                    const stat = await fs.lstat(itemPath);
                    
                    // parse_로 시작하지 않고 current가 아닌 디렉토리들
                    if (stat.isDirectory() && !stat.isSymbolicLink() && 
                        !item.startsWith('parse_') && item !== 'current') {
                        cleanupPaths.push(itemPath);
                    }
                }
            } catch (err) {
                console.log('임시 디렉토리 스캔 중 오류 (무시):', err.message);
            }
            
            for (const cleanupPath of cleanupPaths) {
                try {
                    const stat = await fs.lstat(cleanupPath);
                    if (stat.isDirectory() && !stat.isSymbolicLink()) {
                        await fs.rm(cleanupPath, { recursive: true, force: true });
                        console.log(`🧹 기존 복사본 디렉토리 삭제: ${cleanupPath}`);
                    }
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        console.log(`기존 복사본 없음: ${cleanupPath}`);
                    }
                }
            }
            
            console.log('✅ 기존 복사본 정리 완료');
            
        } catch (error) {
            console.error('기존 복사본 정리 중 오류:', error);
            // 정리 실패는 치명적이지 않으므로 에러를 던지지 않음
        }
    }

    /**
     * ENT 파일 생성 (향후 저장 기능용)
     */
    async createEntFile(projectData, fileName, userID = 'anonymous') {
        try {
            const timestamp = Date.now();
            const safeFileName = `${userID}_${timestamp}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.ent`;
            const entFilePath = path.join(this.tempDir, safeFileName);
            
            // project.json 임시 생성
            const tempProjectDir = path.join(this.tempDir, `create_${timestamp}`);
            await fs.mkdir(tempProjectDir, { recursive: true });
            
            const projectJsonPath = path.join(tempProjectDir, 'project.json');
            await fs.writeFile(projectJsonPath, JSON.stringify(projectData, null, 2));
            
            // TAR 압축 생성
            await tar.c({
                file: entFilePath,
                gzip: { memLevel: 6 },
                cwd: tempProjectDir,
                portable: true
            }, ['project.json']);
            
            // 임시 디렉토리 정리
            await fs.rm(tempProjectDir, { recursive: true, force: true });
            
            const stats = await fs.stat(entFilePath);
            
            // 30분 후 자동 삭제 예약
            setTimeout(async () => {
                try {
                    await fs.unlink(entFilePath);
                    console.log(`자동 삭제됨: ${safeFileName}`);
                } catch (err) {
                    console.error(`자동 삭제 실패: ${safeFileName}`, err);
                }
            }, this.maxAge);
            
            return {
                fileName: safeFileName,
                filePath: entFilePath,
                fileSize: stats.size,
                expiresAt: new Date(Date.now() + this.maxAge).toISOString()
            };
            
        } catch (error) {
            throw new Error(`ENT 파일 생성 오류: ${error.message}`);
        }
    }

    /**
     * ENT 파일 존재 확인
     */
    async checkEntFileExists(fileName) {
        try {
            const filePath = path.join(this.tempDir, fileName);
            const stats = await fs.stat(filePath);
            
            return {
                exists: true,
                filePath: filePath,
                fileSize: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime
            };
            
        } catch (error) {
            return {
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * 파일 크기 검증
     */
    validateFileSize(filePath) {
        const stats = require('fs').statSync(filePath);
        
        if (stats.size > this.maxFileSize) {
            throw new Error(`파일 크기가 너무 큽니다. (${(stats.size / 1024 / 1024).toFixed(1)}MB > ${this.maxFileSize / 1024 / 1024}MB)`);
        }
        
        return true;
    }

    /**
     * 만료된 파일들 정리
     */
    async cleanupExpiredFiles() {
        try {
            const files = await fs.readdir(this.tempDir);
            const now = Date.now();
            let cleanedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                
                try {
                    const stats = await fs.stat(filePath);
                    const age = now - stats.birthtime.getTime();
                    
                    if (age > this.maxAge && file.endsWith('.ent')) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                        console.log(`만료된 파일 삭제: ${file}`);
                    }
                } catch (statError) {
                    console.error(`파일 상태 확인 오류: ${file}`, statError);
                }
            }
            
            return cleanedCount;
            
        } catch (error) {
            console.error('만료된 파일 정리 오류:', error);
            throw error;
        }
    }
}

module.exports = EntFileManager;