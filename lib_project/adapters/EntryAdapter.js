const BaseAdapter = require('./BaseAdapter');
const tar = require('tar-stream');
const { Readable } = require('stream');
const EntFileManager = require('../../lib_entry/entFileManager');
const S3Manager = require('../../lib_storage/s3Manager');
const axios = require('axios');
const path = require('path');

/**
 * 🎮 Entry 플랫폼 어댑터
 */
class EntryAdapter extends BaseAdapter {
    constructor() {
        super('entry');
        this.entFileManager = new EntFileManager();
        this.s3Manager = new S3Manager();
    }

    async validate(projectData) {
        if (!projectData) {
            throw new Error('프로젝트 데이터가 없습니다.');
        }

        // Entry 프로젝트의 필수 구조 검증
        if (!projectData.objects && !Array.isArray(projectData.objects)) {
            console.warn('⚠️ Entry 프로젝트에 objects 배열이 없습니다.');
        }

        return true;
    }

    async process(projectData) {
        try {
            console.log('📦 Entry 프로젝트 저장 시작 (이미지 포함 tar 압축)');
            
            // 1. project.json 생성
            const projectJson = JSON.stringify(projectData, null, 2);
            
            // 2. tar 스트림 생성
            const pack = tar.pack();
            const chunks = [];
            
            // 데이터 수집
            pack.on('data', chunk => chunks.push(chunk));
            
            // 3. project.json 추가
            pack.entry(
                { name: 'temp/project.json' },
                projectJson,
                (err) => {
                    if (err) console.error('❌ project.json 추가 실패:', err);
                    else console.log('✅ project.json 추가 완료');
                }
            );
            
            // 4. 이미지 파일 추가
            const imagePromises = [];
            
            if (projectData.objects && Array.isArray(projectData.objects)) {
                for (const obj of projectData.objects) {
                    if (obj.sprite && obj.sprite.pictures) {
                        for (const pic of obj.sprite.pictures) {
                            if (pic.fileurl && pic.fileurl.startsWith('/temp/')) {
                                // 로컬 /temp/ 이미지인 경우
                                const promise = this._addImageToTar(pack, pic.fileurl);
                                imagePromises.push(promise);
                            }
                        }
                    }
                }
            }
            
            // 5. 모든 이미지 추가 대기
            await Promise.all(imagePromises);
            console.log(`✅ ${imagePromises.length}개 이미지 tar에 추가 완료`);
            
            // 6. tar 종료
            pack.finalize();
            
            // 7. tar Buffer 반환
            return new Promise((resolve, reject) => {
                pack.on('end', () => {
                    const tarBuffer = Buffer.concat(chunks);
                    console.log(`✅ tar 압축 완료: ${tarBuffer.length} bytes`);
                    resolve(tarBuffer);
                });
                pack.on('error', reject);
            });
            
        } catch (error) {
            console.error('❌ Entry 프로젝트 저장 실패:', error);
            // 실패 시 JSON만 저장 (Fallback)
            console.warn('⚠️ Fallback: JSON만 저장');
            const jsonString = JSON.stringify(projectData, null, 2);
            return Buffer.from(jsonString, 'utf-8');
        }
    }
    
    /**
     * 🔥 tar에 이미지 파일 추가
     */
    async _addImageToTar(pack, imagePath) {
        try {
            const fs = require('fs').promises;
            const localPath = path.join('/var/www/html', imagePath);
            
            // 파일 읽기
            const imageBuffer = await fs.readFile(localPath);
            
            // tar에 추가 (temp/ 제거)
            const tarPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
            
            return new Promise((resolve, reject) => {
                pack.entry(
                    { name: tarPath },
                    imageBuffer,
                    (err) => {
                        if (err) {
                            console.error(`❌ 이미지 추가 실패: ${imagePath}`, err);
                            reject(err);
                        } else {
                            console.log(`✅ 이미지 추가: ${tarPath}`);
                            resolve();
                        }
                    }
                );
            });
            
        } catch (error) {
            console.warn(`⚠️ 이미지 파일 없음: ${imagePath}`);
            // 오류 무시하고 계속 진행
        }
    }

    async analyze(projectData) {
        try {
            const objects = projectData.objects || [];
            
            // 블록 수 계산
            let totalBlocks = 0;
            let totalSprites = objects.length;
            
            objects.forEach(obj => {
                if (obj.script && Array.isArray(obj.script)) {
                    totalBlocks += obj.script.length;
                }
            });

            // 변수 개수
            const variables = projectData.variables?.length || 0;
            
            // 함수 개수
            const functions = projectData.functions?.length || 0;

            // 복잡도 계산 (1-5 단계)
            const complexity = this.calculateComplexity(totalBlocks, variables, functions);

            return {
                complexity,
                blocks: totalBlocks,
                sprites: totalSprites,
                variables,
                functions,
                scenes: projectData.scenes?.length || 0
            };
        } catch (error) {
            console.error('Entry 프로젝트 분석 오류:', error);
            return {
                complexity: 0,
                blocks: 0,
                sprites: 0,
                variables: 0,
                functions: 0
            };
        }
    }

    calculateComplexity(blocks, variables, functions) {
        // 간단한 복잡도 점수 계산
        let score = 0;
        
        // 블록 수 기준
        if (blocks < 10) score += 1;
        else if (blocks < 30) score += 2;
        else if (blocks < 50) score += 3;
        else if (blocks < 100) score += 4;
        else score += 5;
        
        // 변수/함수 사용 가산점
        if (variables > 0) score += 1;
        if (functions > 0) score += 1;
        
        // 최대 5점
        return Math.min(score, 5);
    }

    getContentType() {
        return 'application/json; charset=utf-8';
    }

    getExtension() {
        return 'ent';
    }

    /**
     * 🔥 S3에서 받은 Buffer를 Entry 프로젝트 JSON으로 변환 (이미지 파일 포함)
     * @param {Buffer} buffer - ENT 파일 버퍼
     * @param {string} userId - 사용자 ID (이미지 격리용)
     * @param {string} sessionID - 세션 ID (선택)
     */
    async postProcess(buffer, userId = 'anonymous', sessionID = null) {
        try {
            console.log('📦 ENT 파일 후처리 시작');
            
            // Buffer 타입 확인
            if (!Buffer.isBuffer(buffer)) {
                console.log('⚠️ Buffer가 아님, 타입:', typeof buffer);
                
                // 문자열인 경우
                if (typeof buffer === 'string') {
                    return JSON.parse(buffer);
                }
                
                // 이미 객체인 경우
                if (typeof buffer === 'object') {
                    return buffer;
                }
                
                throw new Error('지원하지 않는 데이터 타입입니다.');
            }
            
            // 🔥 1. ENT 파일이 JSON인지 tar인지 확인
            const firstByte = buffer[0];
            
            // JSON 파일인 경우 ('{' 또는 '[')
            if (firstByte === 0x7B || firstByte === 0x5B) {
                console.log('✅ JSON 형식 감지, 이미지 경로 검증 중...');
                const projectData = JSON.parse(buffer.toString('utf-8'));
                
                // 🔥 이미지 경로 검증 및 수정
                if (projectData.objects && Array.isArray(projectData.objects)) {
                    let needsImageFix = false;
                    let totalImages = 0;
                    
                    // 🔥 이미지 경로를 비동기로 처리하기 위해 Promise.all 사용
                    const imageFixPromises = [];
                    
                    projectData.objects.forEach(obj => {
                        // sprite 이미지 확인
                        if (obj.sprite && obj.sprite.pictures) {
                            totalImages += obj.sprite.pictures.length;
                            
                            obj.sprite.pictures.forEach(pic => {
                                console.log(`🖼️ 이미지 발견: ${pic.fileurl || 'undefined'}`);
                                
                                if (pic.fileurl && pic.fileurl.startsWith('/temp/')) {
                                    needsImageFix = true;
                                    console.log(`⚠️ /temp/ 경로 발견, S3 업로드 준비: ${pic.fileurl}`);
                                    
                                    // S3 업로드 Promise 추가
                                    const uploadPromise = this._uploadImageToS3(pic, userId);
                                    imageFixPromises.push(uploadPromise);
                                }
                            });
                        }
                    });
                    
                    console.log(`📊 전체 이미지: ${totalImages}개, /temp/ 이미지: ${imageFixPromises.length}개`);
                    
                    // 모든 이미지 업로드 완료 대기
                    if (imageFixPromises.length > 0) {
                        console.log(`🔄 ${imageFixPromises.length}개 이미지를 S3에 업로드 중...`);
                        await Promise.all(imageFixPromises);
                        console.log('✅ 모든 이미지 S3 업로드 완료');
                    } else if (needsImageFix) {
                        console.warn('⚠️ /temp/ 경로가 있지만 업로드할 이미지가 없음');
                    }
                    
                    if (needsImageFix) {
                        console.warn('⚠️ 이미지 경로에 /temp/ 포함됨. S3에서 원본 tar 파일을 불러오거나 이미지를 재업로드해야 합니다.');
                    } else {
                        console.log('✅ 모든 이미지 경로가 유효함 (S3 URL 또는 외부 URL)');
                    }
                }
                
                return projectData;
            }
            
            // 🔥 2. tar 압축 파일인 경우 - entFileManager 사용하여 이미지도 추출!
            console.log('📦 tar 압축 파일 감지, entFileManager로 처리 (이미지 포함)...');
            
            const parseResult = await this.entFileManager.parseEntFile(
                buffer, 
                userId, 
                sessionID
            );
            
            console.log('✅ entFileManager 처리 완료:', {
                objects: parseResult.projectData.objects?.length || 0,
                sessionPath: parseResult.userSessionPath,
                sessionID: parseResult.sessionID
            });
            
            return parseResult.projectData; // 이미지 경로가 수정된 projectData 반환
            
        } catch (error) {
            console.error('❌ ENT 파일 후처리 실패:', error);
            throw new Error(`ENT 파일 처리 실패: ${error.message}`);
        }
    }
    
    /**
     * 🔥 /temp/ 이미지를 S3에 업로드하고 경로 변경
     * @param {Object} picture - Entry 이미지 객체
     * @param {string} userId - 사용자 ID
     */
    async _uploadImageToS3(picture, userId) {
        try {
            const originalPath = picture.fileurl; // 예: /temp/f1/85/image/xxx.png
            
            // 로컬 파일 경로 생성
            const localPath = path.join('/var/www/html', originalPath);
            const fs = require('fs').promises;
            
            // 파일 존재 확인 및 읽기
            let imageBuffer;
            try {
                imageBuffer = await fs.readFile(localPath);
                console.log(`✅ 로컬 이미지 발견: ${localPath}`);
            } catch (error) {
                console.warn(`⚠️ 로컬 이미지 없음: ${originalPath}`);
                console.warn(`   오류: ${error.message}`);
                // Entry.js 내장 기본 이미지로 대체
                picture.fileurl = '/lib/@entrylabs/entry/images/_1x1.png';
                picture.filename = '_1x1.png';
                return;
            }
            
            // S3 키 생성: entry/images/{userId}/{filename}
            const filename = path.basename(originalPath);
            const s3Key = `entry/images/${userId}/${Date.now()}_${filename}`;
            
            // S3 업로드
            const s3Url = await this.s3Manager.uploadProject(
                s3Key,
                imageBuffer,
                this._getMimeType(filename)
            );
            
            // picture 객체의 경로 업데이트
            picture.fileurl = s3Url;
            picture.filename = filename;
            
            console.log(`✅ 이미지 S3 업로드: ${originalPath} → ${s3Url}`);
            
        } catch (error) {
            console.error(`❌ 이미지 업로드 실패: ${picture.fileurl}`);
            console.error(`   오류 내용: ${error.message}`);
            // 실패 시 Entry.js 내장 기본 이미지로 대체
            picture.fileurl = '/lib/@entrylabs/entry/images/_1x1.png';
            picture.filename = '_1x1.png';
        }
    }
    
    /**
     * 파일 확장자로 MIME 타입 결정
     */
    _getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    
    /**
     * 🔥 [DEPRECATED] tar 압축된 ENT 파일에서 project.json 추출
     * ⚠️ 이 함수는 더 이상 사용되지 않습니다. entFileManager.parseEntFile()을 사용하세요.
     * 이유: 이미지 파일을 추출하지 않아 404 오류 발생
     */
    async extractEntFile(buffer) {
        console.warn('⚠️ extractEntFile()은 deprecated되었습니다. entFileManager.parseEntFile()을 사용하세요.');
        return new Promise((resolve, reject) => {
            const extract = tar.extract();
            let projectData = null;
            
            extract.on('entry', (header, stream, next) => {
                // project.json 파일 찾기
                if (header.name === 'temp/project.json' || header.name === 'project.json') {
                    console.log(`✅ project.json 발견: ${header.name}`);
                    
                    const chunks = [];
                    stream.on('data', chunk => chunks.push(chunk));
                    stream.on('end', () => {
                        try {
                            const json = Buffer.concat(chunks).toString('utf-8');
                            projectData = JSON.parse(json);
                            next();
                        } catch (error) {
                            reject(new Error(`project.json 파싱 실패: ${error.message}`));
                        }
                    });
                } else {
                    // 다른 파일은 무시 (⚠️ 문제: 이미지 파일 포함)
                    stream.on('end', next);
                }
                
                stream.resume();
            });
            
            extract.on('finish', () => {
                if (projectData) {
                    console.log('✅ ENT 파일 압축 해제 완료 (이미지 제외)');
                    resolve(projectData);
                } else {
                    reject(new Error('project.json을 찾을 수 없습니다'));
                }
            });
            
            extract.on('error', reject);
            
            // Buffer를 Stream으로 변환하여 파싱
            const readable = new Readable();
            readable.push(buffer);
            readable.push(null);
            readable.pipe(extract);
        });
    }
}

module.exports = EntryAdapter;
