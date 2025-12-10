const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const tar = require('tar');
const { uid } = require('uid');
const Puid = require('puid');
const fetch = require('node-fetch'); // 🔥 S3 다운로드용 추가

/**
 * ENT 파일 생성 및 관리 모듈
 * EntryJS 표준 ENT 파일 형식을 준수하여 프로젝트를 저장
 */
class EntFileManager {
    constructor() {
        this.puid = new Puid();

        // 임시 파일 저장 경로
        this.tempDir = path.join(__dirname, '..', 'temp', 'ent_files');

        // ENT 파일 설정 (EntryJS 표준)
        this.config = {
            compressionLevel: 6, // EntryJS 표준 memLevel
            maxFileSize: 100 * 1024 * 1024, // 100MB 제한
            tempFileExpiry: 30 * 60 * 1000, // 30분 후 삭제
        };

        this.initTempDirectory();
    }

    /**
     * 사용자별 세션 디렉토리에 이미지 파일 복사
     */
    async copyAssetsToUserSession(tempParseDir, userID, sessionID = null) {
        try {
            // 세션 ID가 없으면 생성
            if (!sessionID) {
                sessionID = Date.now().toString(36) + Math.random().toString(36).substr(2);
            }

            // 사용자별 세션 경로 생성
            const userSessionPath = path.join(this.tempDir, 'users', `${userID}_${sessionID}`);

            // 기존 사용자 세션들 정리 (최대 3개까지만 유지)
            await this.cleanupUserSessions(userID, 3);

            // temp 디렉토리 확인 및 복사
            const tempDir = path.join(tempParseDir, 'temp');
            try {
                await fs.access(tempDir);

                // 사용자 세션 디렉토리 생성
                await fs.mkdir(userSessionPath, { recursive: true });

                // temp 디렉토리를 사용자 세션으로 복사
                await this.copyDirectory(tempDir, userSessionPath);

                // 퍼미션 설정
                await this.chmodRecursive(userSessionPath, 0o755);

                // current 심볼릭 링크 업데이트 (하위 호환성을 위해)
                await this.updateCurrentSymlink(userSessionPath);

                console.log(`사용자별 세션 디렉토리 생성 완료: ${userSessionPath}`);

                // 1시간 후 자동 정리 예약
                this.scheduleSessionCleanup(userSessionPath, 60 * 60 * 1000);

                return {
                    userSessionPath,
                    sessionID,
                    success: true
                };

            } catch (error) {
                console.warn(`temp 디렉토리를 찾을 수 없음: ${tempDir}`);
                throw error;
            }

        } catch (error) {
            console.error('사용자 세션 디렉토리 생성 오류:', error);
            throw error;
        }
    }

    /**
     * current 심볼릭 링크 업데이트 (하위 호환성)
     */
    async updateCurrentSymlink(targetPath) {
        try {
            const currentPath = path.join(this.tempDir, 'current');

            // 기존 current 제거
            try {
                const currentStat = await fs.lstat(currentPath);
                if (currentStat.isSymbolicLink()) {
                    await fs.unlink(currentPath);
                } else if (currentStat.isDirectory()) {
                    await fs.rm(currentPath, { recursive: true, force: true });
                }
            } catch (error) {
                // 없어도 무시
            }

            // 새로운 심볼릭 링크 생성
            await fs.symlink(targetPath, currentPath);
            console.log(`current 심볼릭 링크 업데이트: ${currentPath} -> ${targetPath}`);

        } catch (error) {
            console.error('current 심볼릭 링크 생성 실패:', error);
        }
    }

    /**
     * 사용자 세션 정리 (최대 개수 제한)
     */
    async cleanupUserSessions(userID, maxSessions = 3) {
        try {
            const usersDir = path.join(this.tempDir, 'users');

            try {
                const userSessions = await fs.readdir(usersDir);
                const userSessionDirs = userSessions
                    .filter(dir => dir.startsWith(`${userID}_`))
                    .map(dir => ({
                        name: dir,
                        path: path.join(usersDir, dir)
                    }));

                // 생성 시간 기준으로 정렬 (오래된 것부터)
                const sessionStats = await Promise.all(
                    userSessionDirs.map(async (session) => {
                        try {
                            const stats = await fs.stat(session.path);
                            return {
                                ...session,
                                mtime: stats.mtime
                            };
                        } catch (error) {
                            return null;
                        }
                    })
                );

                const validSessions = sessionStats
                    .filter(session => session !== null)
                    .sort((a, b) => a.mtime - b.mtime);

                // 최대 개수를 초과하는 오래된 세션들 삭제
                if (validSessions.length >= maxSessions) {
                    const sessionsToRemove = validSessions.slice(0, validSessions.length - maxSessions + 1);

                    for (const session of sessionsToRemove) {
                        await fs.rm(session.path, { recursive: true, force: true });
                        console.log(`오래된 사용자 세션 삭제: ${session.name}`);
                    }
                }

            } catch (error) {
                // users 디렉토리가 없어도 무시
            }

        } catch (error) {
            console.error('사용자 세션 정리 오류:', error);
        }
    }

    /**
     * 세션 자동 정리 예약
     */
    scheduleSessionCleanup(sessionPath, delayMs) {
        setTimeout(async () => {
            try {
                await fs.rm(sessionPath, { recursive: true, force: true });
                console.log(`예약된 세션 정리 완료: ${sessionPath}`);
            } catch (error) {
                console.error(`예약된 세션 정리 실패: ${sessionPath}`, error);
            }
        }, delayMs);
    }

    /**
     * 디렉토리 재귀적 권한 변경
     */
    async chmodRecursive(targetPath, mode) {
        try {
            const stats = await fs.stat(targetPath);
            await fs.chmod(targetPath, mode);

            if (stats.isDirectory()) {
                const items = await fs.readdir(targetPath);
                for (const item of items) {
                    const itemPath = path.join(targetPath, item);
                    await this.chmodRecursive(itemPath, mode);
                }
            }
        } catch (err) {
            console.error(`⚠️ 퍼미션 변경 실패: ${targetPath}`, err.message);
        }
    }

    /**
     * 디렉토리 재귀적 복사
     */
    async copyDirectory(source, destination) {
        try {
            // 대상 디렉토리 생성
            await fs.mkdir(destination, { recursive: true });

            const items = await fs.readdir(source);

            for (const item of items) {
                const sourcePath = path.join(source, item);
                const destPath = path.join(destination, item);

                const stats = await fs.stat(sourcePath);

                if (stats.isDirectory()) {
                    // 디렉토리인 경우 재귀적으로 복사
                    await this.copyDirectory(sourcePath, destPath);
                } else {
                    // 파일인 경우 복사
                    await fs.copyFile(sourcePath, destPath);
                }
            }

        } catch (error) {
            console.error(`디렉토리 복사 오류 (${source} -> ${destination}):`, error);
            throw error;
        }
    }

    /**
     * 임시 디렉토리 초기화
     */
    async initTempDirectory() {
        try {
            await fs.access(this.tempDir);
        } catch (error) {
            // 디렉토리가 없으면 생성
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log(`ENT 임시 디렉토리 생성: ${this.tempDir}`);
        }
    }

    /**
     * EntryJS 표준 파일 ID 생성
     * 문서 참조: uid(8) + puid.generate()
     */
    generateFileId() {
        return uid(8) + this.puid.generate();
    }

    /**
     * 파일 ID에서 폴더 구조 생성
     * 예: e49448cd... → /e4/94/
     */
    getAssetPath(fileId, assetType = 'image') {
        const firstTwo = fileId.substring(0, 2);
        const nextTwo = fileId.substring(2, 4);
        return path.join(firstTwo, nextTwo, assetType, `${fileId}.png`);
    }

    /**
     * 프로젝트 데이터 검증
     */
    validateProjectData(projectData) {
        if (!projectData || typeof projectData !== 'object') {
            throw new Error('유효하지 않은 프로젝트 데이터입니다.');
        }

        // 필수 필드 검증
        const requiredFields = ['objects', 'scenes'];
        for (const field of requiredFields) {
            if (!projectData[field]) {
                console.warn(`경고: ${field} 필드가 없습니다. 빈 배열로 설정합니다.`);
                projectData[field] = [];
            }
        }

        return true;
    }

    /**
     * Phase 1: 기본 ENT 파일 생성 (project.json만)
     * Assets는 Phase 2에서 구현
     */
    async createEntFile(projectData, fileName, userID) {
        try {
            console.log(`ENT 파일 생성 시작: ${fileName}, 사용자: ${userID}`);

            // 1. 프로젝트 데이터 검증
            this.validateProjectData(projectData);

            // 2. 고유한 파일 ID 생성
            const fileId = this.generateFileId();
            const timestamp = Date.now();
            const safeFileName = this.sanitizeFileName(fileName);
            const entFileName = `${userID}_${timestamp}_${safeFileName}.ent`;
            const tempProjectDir = path.join(this.tempDir, `project_${fileId}`);
            const entFilePath = path.join(this.tempDir, entFileName);

            // 3. 임시 프로젝트 디렉토리 생성
            await fs.mkdir(tempProjectDir, { recursive: true });
            await fs.mkdir(path.join(tempProjectDir, 'temp'), { recursive: true });

            // 4. project.json 생성
            const projectJsonPath = path.join(tempProjectDir, 'temp', 'project.json');
            await fs.writeFile(
                projectJsonPath,
                JSON.stringify(projectData, null, 2),
                'utf8'
            );

            console.log(`project.json 생성 완료: ${projectJsonPath}`);

            // 5. ENT 파일 압축 (TAR 형식)
            await this.compressToTar(tempProjectDir, entFilePath);

            // 6. 임시 프로젝트 디렉토리 정리
            await this.removeTempDirectory(tempProjectDir);

            // 7. 파일 정보 반환
            const stats = await fs.stat(entFilePath);
            const result = {
                success: true,
                fileId: fileId,
                fileName: entFileName,
                filePath: entFilePath,
                fileSize: stats.size,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.config.tempFileExpiry).toISOString()
            };

            console.log(`ENT 파일 생성 완료:`, result);
            return result;

        } catch (error) {
            console.error('ENT 파일 생성 오류:', error);
            throw new Error(`ENT 파일 생성 실패: ${error.message}`);
        }
    }

    /**
     * TAR 압축 실행 (EntryJS 표준)
     */
    async compressToTar(sourceDir, outputPath) {
        try {
            console.log(`TAR 압축 시작: ${sourceDir} → ${outputPath}`);

            await tar.c(
                {
                    file: outputPath,
                    gzip: { memLevel: this.config.compressionLevel },
                    cwd: sourceDir,
                    filter: (path, stat) => {
                        try {
                            // 심볼릭 링크 제외 (EntryJS 표준)
                            return !stat.isSymbolicLink();
                        } catch (e) {
                            return false;
                        }
                    },
                    portable: true, // 호환성을 위한 portable 모드
                },
                ['temp'] // temp 폴더만 압축
            );

            console.log(`TAR 압축 완료: ${outputPath}`);

        } catch (error) {
            console.error('TAR 압축 오류:', error);
            throw new Error(`압축 실패: ${error.message}`);
        }
    }

    /**
     * 파일명 안전하게 정리
     */
    sanitizeFileName(fileName) {
        return fileName
            .replace(/[^a-zA-Z0-9가-힣\-_\s]/g, '') // 특수문자 제거
            .replace(/\s+/g, '_') // 공백을 언더스코어로
            .substring(0, 50); // 길이 제한
    }

    /**
     * 임시 디렉토리 삭제
     */
    async removeTempDirectory(dirPath) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`임시 디렉토리 삭제: ${dirPath}`);
        } catch (error) {
            console.error(`임시 디렉토리 삭제 오류: ${dirPath}`, error);
        }
    }

    /**
     * ENT 파일 존재 확인
     */
    async checkEntFileExists(fileName) {
        try {
            const filePath = path.join(this.tempDir, fileName);
            await fs.access(filePath);
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
     * 만료된 임시 파일 정리
     */
    async cleanupExpiredFiles() {
        try {
            console.log('만료된 ENT 파일 정리 시작...');

            const files = await fs.readdir(this.tempDir);
            const now = Date.now();
            let cleanedCount = 0;

            for (const file of files) {
                if (!file.endsWith('.ent')) continue;

                const filePath = path.join(this.tempDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    const fileAge = now - stats.birthtime.getTime();

                    // 만료 시간 확인
                    if (fileAge > this.config.tempFileExpiry) {
                        await fs.unlink(filePath);
                        console.log(`만료된 파일 삭제: ${file}`);
                        cleanedCount++;
                    }
                } catch (error) {
                    console.error(`파일 정리 오류: ${file}`, error);
                }
            }

            console.log(`임시 파일 정리 완료: ${cleanedCount}개 파일 삭제`);
            return cleanedCount;

        } catch (error) {
            console.error('파일 정리 중 오류:', error);
            throw error;
        }
    }

    /**
     * 파일 크기 검증
     */
    validateFileSize(filePath) {
        const stats = fsSync.statSync(filePath);
        if (stats.size > this.config.maxFileSize) {
            throw new Error(`파일 크기가 너무 큽니다. 최대 ${this.config.maxFileSize / 1024 / 1024}MB`);
        }
        return true;
    }

    /**
     * S3에서 ENT 파일 다운로드 및 파싱 (사용자별 격리 지원)
     */
    async loadProjectFromS3(s3Url, userID = 'anonymous', sessionID = null) {
        try {
            console.log(`🚀 S3 ENT 파일 로드 시작: ${s3Url}`);

            // URL 유효성 검사
            if (!s3Url || !s3Url.startsWith('http')) {
                throw new Error('유효하지 않은 S3 URL입니다.');
            }

            // ENT 파일 확장자 검사
            if (!s3Url.toLowerCase().endsWith('.ent')) {
                throw new Error('ENT 파일이 아닙니다. 파일 확장자를 확인해주세요.');
            }

            // 1. S3에서 ENT 파일 다운로드
            const entBuffer = await this.downloadFromS3(s3Url);

            // 2. 다운로드 검증
            if (!entBuffer || entBuffer.length === 0) {
                throw new Error('ENT 파일이 비어있습니다.');
            }

            // 3. ENT 파일 파싱 (사용자 세션 포함)
            const parseResult = await this.parseEntFile(entBuffer, userID, sessionID);
            const projectData = parseResult.projectData;

            // 4. 프로젝트 데이터 검증
            if (!projectData || typeof projectData !== 'object') {
                throw new Error('프로젝트 데이터가 올바르지 않습니다.');
            }

            console.log(`🎉 S3 ENT 파일 로드 성공!`, {
                fileName: this.extractFileNameFromUrl(s3Url),
                fileSize: `${(entBuffer.length / 1024).toFixed(1)} KB`,
                objects: projectData.objects?.length || 0,
                scenes: projectData.scenes?.length || 0
            });

            return {
                success: true,
                projectData: projectData,
                s3Url: s3Url,
                fileName: this.extractFileNameFromUrl(s3Url),
                fileSize: entBuffer.length,
                loadedAt: new Date().toISOString(),
                userID: userID,
                sessionID: parseResult.sessionID,
                userSessionPath: parseResult.userSessionPath,
                metadata: {
                    objects: projectData.objects?.length || 0,
                    scenes: projectData.scenes?.length || 0,
                    variables: projectData.variables?.length || 0,
                    functions: projectData.functions?.length || 0
                }
            };

        } catch (error) {
            console.error('❌ S3 ENT 파일 로드 오류:', error);

            return {
                success: false,
                error: error.message,
                s3Url: s3Url,
                errorType: error.name || 'UnknownError',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * S3에서 파일 다운로드 (Node.js fetch 사용)
     */
    async downloadFromS3(s3Url) {
        try {
            console.log(`🌐 S3 다운로드 시작: ${s3Url}`);

            // Node.js 환경에서 fetch 사용
            const fetch = require('node-fetch');
            const response = await fetch(s3Url, {
                method: 'GET',
                timeout: 30000, // 30초 타임아웃
                headers: {
                    'User-Agent': 'educodingnplay-server/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const buffer = await response.buffer();
            console.log(`✅ S3 다운로드 완료: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`);

            // ENT 파일 헤더 검증
            if (buffer.length < 100) {
                throw new Error('다운로드된 파일이 너무 작습니다 (100바이트 미만)');
            }

            return buffer;

        } catch (error) {
            console.error('❌ S3 다운로드 오류:', error);
            throw new Error(`S3 다운로드 실패: ${error.message}`);
        }
    }

    /**
     * ENT 파일 파싱 (TAR 압축 해제 또는 JSON 직접 파싱) - 사용자별 격리 지원
     */
    async parseEntFile(entBuffer, userID = 'anonymous', sessionID = null) {
        const tempParseDir = path.join(this.tempDir, `parse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        const entFilePath = path.join(tempParseDir, 'downloaded.ent');

        try {
            console.log(`🔧 ENT 파일 파싱 시작: ${entFilePath}`);
            console.log(`📦 ENT 버퍼 크기: ${entBuffer.length} bytes`);

            // 🔥 파일 형식 감지 (JSON vs TAR)
            const firstByte = entBuffer[0];
            const isJSON = (firstByte === 0x7B || firstByte === 0x5B); // '{' 또는 '['

            if (isJSON) {
                console.log('✅ JSON 형식 ENT 파일 감지, 직접 파싱 중...');

                // JSON 파싱
                const jsonString = entBuffer.toString('utf-8');
                const projectData = JSON.parse(jsonString);

                console.log('✅ JSON 파싱 성공:', {
                    objects: projectData.objects?.length || 0,
                    scenes: projectData.scenes?.length || 0,
                    variables: projectData.variables?.length || 0
                });

                // 세션 ID 생성
                if (!sessionID) {
                    sessionID = Date.now().toString(36) + Math.random().toString(36).substr(2);
                }

                // 사용자별 세션 경로 (빈 디렉토리만 생성)
                const userSessionPath = path.join(this.tempDir, 'users', `${userID}_${sessionID}`);
                await fs.mkdir(userSessionPath, { recursive: true });

                console.log(`📁 사용자 세션 디렉토리 생성: ${userSessionPath}`);

                return {
                    projectData: projectData,
                    userSessionPath: userSessionPath,
                    sessionID: sessionID
                };
            }

            // TAR 형식 처리 (기존 로직)
            console.log('📦 TAR 형식 ENT 파일 감지, 압축 해제 중...');

            // 1. 임시 디렉토리 생성
            await fs.mkdir(tempParseDir, { recursive: true });
            console.log(`📁 임시 디렉토리 생성: ${tempParseDir}`);

            // 2. ENT 버퍼를 파일로 저장
            await fs.writeFile(entFilePath, entBuffer);
            console.log(`💾 ENT 파일 저장 완료: ${entFilePath}`);

            // 3. TAR 압축 해제 (EntryJS 표준)
            console.log('🗜️ TAR 압축 해제 시작...');
            await tar.x({
                file: entFilePath,
                cwd: tempParseDir,
                filter: (path, entry) => {
                    const { type, size } = entry;
                    console.log(`📄 압축 해제 중: ${path} (${type}, ${size} bytes)`);

                    // EntryJS 표준: 심볼릭 링크 제외 및 크기 제한
                    const isValid = type !== 'SymbolicLink' && size < this.config.maxFileSize;
                    if (!isValid) {
                        console.log(`⚠️ 파일 제외: ${path} (타입: ${type}, 크기: ${size})`);
                    }
                    return isValid;
                },
                // EntryJS 호환성을 위한 추가 옵션
                strict: false,
                newer: false
            });

            console.log('✅ TAR 압축 해제 완료');

            // 4. 압축 해제 결과 확인
            const extractedContents = await fs.readdir(tempParseDir);
            console.log('📂 압축 해제된 파일들:', extractedContents);

            // 5. project.json 경로 탐색 (여러 경로 시도)
            const possiblePaths = [
                path.join(tempParseDir, 'temp', 'project.json'),           // 표준 경로
                path.join(tempParseDir, 'project.json'),                   // 루트 경로
                path.join(tempParseDir, 'data', 'project.json'),           // 대안 경로
            ];

            let projectJsonPath = null;
            let projectJsonContent = null;

            for (const testPath of possiblePaths) {
                try {
                    await fs.access(testPath);
                    projectJsonPath = testPath;
                    console.log(`📄 project.json 발견: ${testPath}`);
                    break;
                } catch {
                    console.log(`❌ project.json 없음: ${testPath}`);
                }
            }

            if (!projectJsonPath) {
                // 디렉토리 구조 상세 로깅
                await this.logDirectoryStructure(tempParseDir);
                throw new Error('project.json 파일을 찾을 수 없습니다. ENT 파일 구조를 확인해주세요.');
            }

            // 6. project.json 읽기 및 파싱
            projectJsonContent = await fs.readFile(projectJsonPath, 'utf8');
            console.log(`📖 project.json 크기: ${projectJsonContent.length} 문자`);

            const projectData = JSON.parse(projectJsonContent);
            console.log('✅ project.json 파싱 완료:', {
                objects: projectData.objects?.length || 0,
                scenes: projectData.scenes?.length || 0,
                variables: projectData.variables?.length || 0
            });

            // 7. 사용자별 세션 디렉토리에 이미지 파일 복사
            const sessionResult = await this.copyAssetsToUserSession(tempParseDir, userID, sessionID);

            // 8. 임시 디렉토리 정리
            await this.removeTempDirectory(tempParseDir);
            console.log('✅ 임시 디렉토리 정리 완료:', tempParseDir);

            // 🔍 프로젝트 데이터의 이미지 경로 최종 확인
            if (projectData?.objects && projectData.objects.length > 0) {
                console.log('🔍 최종 이미지 경로 확인:', {
                    totalObjects: projectData.objects.length,
                    firstObjectImages: projectData.objects[0]?.sprite?.pictures?.length || 0,
                    sampleImagePath: projectData.objects[0]?.sprite?.pictures?.[0]?.fileurl || 'none'
                });
            }
            // 🔁 이미지 경로 접두어 수정 (8070번 서버용 상대경로)
            if (projectData?.objects) {
                projectData.objects.forEach((obj, index) => {
                    // 스프라이트 이미지 경로 수정
                    if (obj.sprite && obj.sprite.pictures) {
                        obj.sprite.pictures.forEach((picture, picIndex) => {
                            // 🔥 Case 1: file:/// 로컬 경로 처리 (Windows 절대경로)
                            if (picture.fileurl && picture.fileurl.startsWith('file:///')) {
                                // 해시 추출: file:///C:/.../a2b07059405a83d7c0fcbaa1700cf6be.png
                                const hashMatch = picture.fileurl.match(/([a-f0-9]{32})\.(png|jpg|jpeg|gif|svg|webp)$/i);
                                if (hashMatch) {
                                    const imageHash = hashMatch[1];
                                    const extension = hashMatch[2];
                                    const folderPath = `${imageHash.substring(0, 2)}/${imageHash.substring(2, 4)}/image`;
                                    picture.fileurl = `/temp/${folderPath}/${imageHash}.${extension}`;

                                    console.log(`🔄 로컬경로→서버경로 변환 [${index}-${picIndex}]:`, {
                                        original: 'file:///...',
                                        converted: picture.fileurl
                                    });
                                } else {
                                    console.warn(`⚠️ 이미지 해시 추출 실패 [${index}-${picIndex}]:`, picture.fileurl);
                                }
                            }
                            // 🔥 Case 2: filename만 있고 fileurl이 없는 경우
                            else if (picture.filename && !picture.fileurl) {
                                const filename = picture.filename;
                                const imageType = picture.imageType || 'png';
                                const folderPath = `${filename.substring(0, 2)}/${filename.substring(2, 4)}/image`;
                                picture.fileurl = `/temp/${folderPath}/${filename}.${imageType}`;

                                console.log(`📸 이미지 경로 설정 [${index}-${picIndex}]:`, {
                                    filename: filename,
                                    fileurl: picture.fileurl
                                });
                            }
                            // 🔥 Case 3: temp/로 시작하는 상대경로
                            else if (picture.fileurl && picture.fileurl.startsWith('temp/')) {
                                picture.fileurl = '/' + picture.fileurl;
                                console.log(`🔄 상대경로 수정 [${index}-${picIndex}]:`, picture.fileurl);
                            }
                        });
                    }

                    // 오브젝트 썸네일 경로 수정
                    if (obj.thumbnail && typeof obj.thumbnail === 'string') {
                        // 🔥 file:/// 로컬 경로 처리
                        if (obj.thumbnail.startsWith('file:///')) {
                            const hashMatch = obj.thumbnail.match(/([a-f0-9]{32})\.(png|jpg|jpeg|gif|svg|webp)$/i);
                            if (hashMatch) {
                                const imageHash = hashMatch[1];
                                const extension = hashMatch[2];
                                const folderPath = `${imageHash.substring(0, 2)}/${imageHash.substring(2, 4)}/image`;
                                obj.thumbnail = `/temp/${folderPath}/${imageHash}.${extension}`;
                                console.log(`🖼️ 썸네일 로컬경로 변환 [${index}]:`, obj.thumbnail);
                            }
                        }
                        // temp/로 시작하는 상대경로
                        else if (obj.thumbnail.startsWith('temp/')) {
                            obj.thumbnail = '/' + obj.thumbnail;
                            console.log(`🖼️ 썸네일 경로 수정 [${index}]:`, obj.thumbnail);
                        }
                    }
                });
                console.log('✅ 오브젝트 이미지 경로를 8070번 서버용으로 수정 완료');
            }

            return {
                projectData: projectData,
                userSessionPath: sessionResult.userSessionPath,
                sessionID: sessionResult.sessionID
            };

        } catch (error) {
            console.error('❌ ENT 파일 파싱 오류:', error);

            // 디버깅을 위한 상세 로그
            if (error.message.includes('Unexpected end of data')) {
                console.error('💡 힌트: ENT 파일이 손상되었거나 완전히 다운로드되지 않았습니다.');
            } else if (error.message.includes('Invalid tar header')) {
                console.error('💡 힌트: 파일이 올바른 TAR 형식이 아닙니다.');
            }

            // 오류 시 임시 디렉토리 정리
            try {
                await this.removeTempDirectory(tempParseDir);
            } catch (cleanupError) {
                console.error('❌ 임시 디렉토리 정리 오류:', cleanupError);
            }

            throw new Error(`ENT 파일 파싱 실패: ${error.message}`);
        }
    }

    /**
     * URL에서 파일명 추출
     */
    extractFileNameFromUrl(url) {
        try {
            const urlPath = new URL(url).pathname;
            return path.basename(urlPath);
        } catch (error) {
            return 'unknown.ent';
        }
    }

    /**
     * 프로젝트에서 사용된 Assets 경로 추출
     * Phase 2에서 구현 예정
     */
    extractAssetPaths(projectData) {
        // TODO: Phase 2에서 구현
        // projectData에서 images, sounds 경로 추출
        console.log('Phase 2에서 Assets 처리 예정');
        return {
            images: [],
            sounds: []
        };
    }

    /**
     * S3에서 Assets 다운로드
     * Phase 2에서 구현 예정
     */
    async downloadAssetsFromS3(assetPaths) {
        // TODO: Phase 2에서 구현
        console.log('Phase 2에서 S3 Assets 다운로드 예정');
        return [];
    }

    /**
     * Assets 경로를 EntryJS 표준으로 변환
     * Phase 2에서 구현 예정
     */
    convertToEntryJSPaths(projectData, assetMappings) {
        // TODO: Phase 2에서 구현
        console.log('Phase 2에서 경로 변환 예정');
        return projectData;
    }

    /**
     * 디렉토리 구조 상세 로깅 (디버깅용)
     */
    async logDirectoryStructure(dirPath, depth = 0, maxDepth = 3) {
        try {
            if (depth > maxDepth) return;

            const indent = '  '.repeat(depth);
            const items = await fs.readdir(dirPath);

            console.log(`${indent}📁 ${path.basename(dirPath)}/`);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);

                if (stats.isDirectory()) {
                    await this.logDirectoryStructure(itemPath, depth + 1, maxDepth);
                } else {
                    const size = stats.size < 1024
                        ? `${stats.size}B`
                        : `${(stats.size / 1024).toFixed(1)}KB`;
                    console.log(`${indent}  📄 ${item} (${size})`);
                }
            }
        } catch (error) {
            console.error(`디렉토리 구조 로깅 오류 (${dirPath}):`, error.message);
        }
    }

    /**
     * 🔥 사용자 이미지 디렉토리 경로
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {string} 디렉토리 경로
     */
    getUserImageDir(userID, sessionID) {
        return path.join(this.tempDir, 'entry_uploads', `${userID}_${sessionID}`);
    }

    /**
     * 🔥 사용자 이미지 디렉토리 생성
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {Promise<string>} 생성된 디렉토리 경로
     */
    async ensureUserImageDir(userID, sessionID) {
        const imageDir = this.getUserImageDir(userID, sessionID);
        await fs.mkdir(imageDir, { recursive: true });
        console.log(`📁 사용자 이미지 디렉토리 생성: ${imageDir}`);
        return imageDir;
    }

    /**
     * 🔥 사용자 이미지 정리 (세션 만료 시)
     * @param {string} userID - 사용자 ID
     * @param {string} sessionID - 세션 ID
     * @returns {Promise<void>}
     */
    async cleanupUserImages(userID, sessionID) {
        try {
            const imageDir = this.getUserImageDir(userID, sessionID);
            await fs.rm(imageDir, { recursive: true, force: true });
            console.log(`🧹 사용자 이미지 정리 완료: ${imageDir}`);
        } catch (error) {
            console.error('⚠️ 이미지 정리 중 오류 (무시):', error.message);
        }
    }
}


module.exports = EntFileManager;
