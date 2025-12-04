const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const config = require('../config');

class S3Manager {
    constructor() {
        // 🔐 IAM Role 기반 인증
        // EC2 인스턴스에 IAM Role이 있으면 자동으로 자격 증명을 가져옴
        const s3Config = {
            region: config.S3.REGION
        };
        console.log('🔍 S3Manager 생성 - NODE_ENV:', process.env.NODE_ENV);
        console.log('🔍 AWS_ACCESS_KEY_ID 존재:', !!process.env.AWS_ACCESS_KEY_ID);
        console.log('🔍 AWS_SECRET_ACCESS_KEY 존재:', !!process.env.AWS_SECRET_ACCESS_KEY);

        // 개발 환경에서만 환경 변수 사용 (프로덕션에서는 IAM Role 사용)
        if (process.env.NODE_ENV === 'development' && process.env.AWS_ACCESS_KEY_ID) {
            console.warn('⚠️  개발 환경: 환경 변수로 AWS 자격 증명 사용');
            s3Config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };
        } else {
            console.log('🔐 프로덕션 환경: IAM Role로 AWS 자격 증명 사용');
        }

        this.s3Client = new S3Client(s3Config);
        this.bucketName = config.S3.BUCKET_NAME;
    }

    /**
     * 🔥 S3 폴더 브라우징
     * @param {string} prefix - S3 경로 (폴더)
     * @param {string} delimiter - 구분자 (기본: '/')
     * @returns {Promise<Object>} { folders: [], files: [] }
     */
    async browse(prefix = '', delimiter = '/') {
        try {
            // 🔥 prefix가 scope, prefix, filters 형태로 오는 경우 처리 (S3BrowserRouter 호환)
            let actualPrefix = prefix;
            let actualDelimiter = delimiter;

            // scope, prefix, filters 형태로 호출되었을 경우
            if (typeof delimiter === 'object') {
                // browse(scope, prefix, filters) 형태
                actualPrefix = delimiter;  // 2번째 인자가 prefix
                actualDelimiter = '/';  // delimiter 기본값
                // filters는 무시 (권한 필터링은 라우터에서 처리)
            }

            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: actualPrefix,
                Delimiter: actualDelimiter,
                MaxKeys: 1000
            });

            const response = await this.s3Client.send(command);

            // 폴더 목록
            const folders = (response.CommonPrefixes || []).map(item => {
                const rawName = item.Prefix.replace(actualPrefix, '').replace(/\/$/, '');
                return {
                    name: decodeURIComponent(rawName),  // 🔥 한글 디코딩
                    path: item.Prefix,
                    fullPath: item.Prefix,  // 🔥 추가 (호환성)
                    type: 'folder'
                };
            });

            // 파일 목록 (🔥 JSON 파일 숨김 처리)
            const files = (response.Contents || [])
                .filter(item => {
                    // 현재 폴더 자체는 제외
                    if (item.Key === actualPrefix) return false;

                    // 🔥 .json, .meta.json 파일 숨김
                    const fileName = item.Key.toLowerCase();
                    if (fileName.endsWith('.json') || fileName.endsWith('.meta.json')) {
                        return false;
                    }

                    return true;
                })
                .map(item => {
                    const rawName = item.Key.replace(actualPrefix, '');
                    return {
                        name: decodeURIComponent(rawName),  // 🔥 한글 디코딩
                        path: item.Key,
                        key: item.Key,  // 🔥 추가 (S3Explorer에서 사용)
                        size: item.Size,
                        sizeFormatted: this.formatFileSize(item.Size),  // 🔥 추가
                        lastModified: item.LastModified,
                        type: 'file',
                        icon: this.getFileIcon(item.Key),  // 🔥 추가
                        url: `https://${this.bucketName}.s3.${config.S3.REGION}.amazonaws.com/${item.Key}`
                    };
                });

            console.log(`✅ S3 브라우징 완료: ${actualPrefix} (폴더: ${folders.length}, 파일: ${files.length})`);

            // 🔥 Breadcrumbs 생성
            const breadcrumbs = this.generateBreadcrumbs(actualPrefix);

            return {
                success: true,
                prefix: actualPrefix,
                currentPath: actualPrefix,
                breadcrumbs,
                folders,
                files,
                isTruncated: response.IsTruncated || false
            };
        } catch (error) {
            console.error('❌ S3 브라우징 실패:', error);
            throw new Error(`S3 브라우징 실패: ${error.message}`);
        }
    }

    /**
     * 🔥 Breadcrumbs 생성
     * @param {string} path - S3 경로
     * @returns {Array} Breadcrumbs 배열
     */
    generateBreadcrumbs(path) {
        const breadcrumbs = [{ name: 'Root', path: '' }];

        if (!path || path === '') {
            return breadcrumbs;
        }

        const parts = path.split('/').filter(p => p);
        let currentPath = '';

        parts.forEach(part => {
            currentPath += part + '/';
            breadcrumbs.push({
                name: decodeURIComponent(part),  // 🔥 한글 디코딩
                path: currentPath
            });
        });

        return breadcrumbs;
    }

    /**
     * 🔥 프로젝트 업로드
     */
    async uploadProject(s3Key, data, contentType = 'application/json') {
        try {
            // 🔥 이미지 파일인 경우 CORS 관련 메타데이터 추가
            const isImage = contentType.startsWith('image/');
            
            const commandParams = {
                Bucket: this.bucketName,
                Key: s3Key,
                Body: data,
                ContentType: contentType,
                ServerSideEncryption: 'AES256'
            };
            
            // 🔥 이미지 파일에 CORS 캐시 제어 헤더 추가
            if (isImage) {
                commandParams.CacheControl = 'no-cache, no-store, must-revalidate';
                commandParams.Metadata = {
                    'Access-Control-Allow-Origin': '*'
                };
                console.log('🖼️ 이미지 업로드 - CORS 헤더 추가');
            }

            const command = new PutObjectCommand(commandParams);

            await this.s3Client.send(command);

            const s3Url = `https://${this.bucketName}.s3.${config.S3.REGION}.amazonaws.com/${s3Key}`;
            console.log(`✅ S3 업로드 완료: ${s3Url}`);

            return s3Url;
        } catch (error) {
            console.error('❌ S3 업로드 실패:', error);
            throw new Error(`S3 업로드 실패: ${error.message}`);
        }
    }

    /**
     * 🔥 프로젝트 다운로드
     */
    async downloadProject(s3Key) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            });

            const response = await this.s3Client.send(command);

            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }

            const buffer = Buffer.concat(chunks);
            console.log(`✅ S3 다운로드 완료: ${s3Key}`);

            return buffer;
        } catch (error) {
            console.error('❌ S3 다운로드 실패:', error);
            throw new Error(`S3 다운로드 실패: ${error.message}`);
        }
    }

    /**
     * 🔥 프로젝트 삭제
     */
    async deleteProject(s3Key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            });

            await this.s3Client.send(command);
            console.log(`✅ S3 삭제 완료: ${s3Key}`);
        } catch (error) {
            console.error('❌ S3 삭제 실패:', error);
            throw new Error(`S3 삭제 실패: ${error.message}`);
        }
    }

    /**
     * 🔥 S3 URL에서 키 추출
     */
    extractKeyFromUrl(s3Url) {
        try {
            const url = new URL(s3Url);
            return url.pathname.substring(1);
        } catch (error) {
            console.error('S3 URL 파싱 실패:', error);
            throw new Error('잘못된 S3 URL 형식입니다.');
        }
    }

    /**
     * 🔥 파일 크기 포맷팅
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * 🔥 파일 아이콘 반환
     */
    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const icons = {
            'ent': '<img src="/resource/entry.png" alt="Entry" style="width:18px;height:18px;vertical-align:middle;">',
            'sb3': '<img src="/resource/scratch.png" alt="Scratch" style="width:18px;height:18px;vertical-align:middle;">',
            'sb2': '<img src="/resource/scratch.png" alt="Scratch" style="width:18px;height:18px;vertical-align:middle;">',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'webp': '🖼️',
            'mp4': '🎬',
            'pdf': '📄',
            'zip': '📦',
            'html': '🌐',
            'js': '📜'
        };
        return icons[ext] || '📄';
    }

    /**
     * 🔥 사용자 프로젝트 삭제 (단일 파일)
     * @param {string} s3Key - S3 키 (예: users/sean/entry/draft/file.ent)
     */
    async deleteUserProject(s3Key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            });

            await this.s3Client.send(command);
            console.log(`✅ S3 사용자 프로젝트 삭제 완료: ${s3Key}`);

            return {
                success: true,
                message: '파일이 삭제되었습니다.',
                deletedKey: s3Key
            };
        } catch (error) {
            console.error('❌ S3 사용자 프로젝트 삭제 실패:', error);
            throw new Error(`S3 삭제 실패: ${error.message}`);
        }
    }

    /**
     * 🔥 사용자 프로젝트 일괄 삭제 (여러 파일)
     * @param {string[]} s3Keys - S3 키 배열
     */
    async deleteUserProjects(s3Keys) {
        try {
            if (!s3Keys || s3Keys.length === 0) {
                throw new Error('삭제할 파일이 없습니다.');
            }

            // AWS S3는 한 번에 최대 1000개까지 삭제 가능
            const deleteObjects = s3Keys.map(key => ({ Key: key }));

            const command = new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: {
                    Objects: deleteObjects,
                    Quiet: false
                }
            });

            const response = await this.s3Client.send(command);

            const deletedCount = response.Deleted?.length || 0;
            const errorCount = response.Errors?.length || 0;

            console.log(`✅ S3 일괄 삭제 완료 - 성공: ${deletedCount}, 실패: ${errorCount}`);

            return {
                success: true,
                message: `${deletedCount}개 파일 삭제 완료${errorCount > 0 ? `, ${errorCount}개 실패` : ''}`,
                deleted: response.Deleted || [],
                errors: response.Errors || [],
                stats: {
                    total: s3Keys.length,
                    deleted: deletedCount,
                    failed: errorCount
                }
            };
        } catch (error) {
            console.error('❌ S3 일괄 삭제 실패:', error);
            throw new Error(`S3 일괄 삭제 실패: ${error.message}`);
        }
    }

    /**
     * 🔥 사용자 프로젝트 다운로드
     * @param {string} s3Key - S3 키
     */
    async downloadUserProject(s3Key) {
        return await this.downloadProject(s3Key);
    }

    /**
     * 🔥 사용자 프로젝트 업로드
     * @param {string} userID - 사용자 ID
     * @param {string|null} platform - 플랫폼 (entry, scratch 등) - null이면 현재 경로 사용
     * @param {string} filename - 파일명
     * @param {Buffer} buffer - 파일 데이터
     * @param {string} targetFolder - 대상 폴더 경로
     */
    async uploadUserProject(userID, platform, filename, buffer, targetFolder = '') {
        try {
            let s3Key;

            // targetFolder가 있으면 그 경로 사용, 없으면 기본 경로 생성
            if (targetFolder) {
                // targetFolder 끝에 / 없으면 추가
                const folder = targetFolder.endsWith('/') ? targetFolder : targetFolder + '/';
                s3Key = folder + filename;
            } else if (platform) {
                // 기본 경로: users/{userID}/{platform}/draft/
                s3Key = `users/${userID}/${platform}/draft/${filename}`;
            } else {
                // platform도 없으면 users/{userID}/ 하위에 저장
                s3Key = `users/${userID}/${filename}`;
            }

            const contentType = this.getContentType(filename);

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
                Body: buffer,
                ContentType: contentType,
                ServerSideEncryption: 'AES256'
            });

            await this.s3Client.send(command);

            const s3Url = `https://${this.bucketName}.s3.${config.S3.REGION}.amazonaws.com/${s3Key}`;

            console.log(`✅ S3 사용자 프로젝트 업로드 완료: ${s3Key}`);

            return {
                success: true,
                s3Key: s3Key,
                s3Url: s3Url,
                fileSize: buffer.length,
                contentType: contentType
            };
        } catch (error) {
            console.error('❌ S3 사용자 프로젝트 업로드 실패:', error);
            throw new Error(`S3 업로드 실패: ${error.message}`);
        }
    }

    /**
     * 🔥 파일 MIME 타입 반환
     * @param {string} filename - 파일명
     */
    getContentType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'ent': 'application/x-entryjs',
            'sb3': 'application/x-scratch3',
            'sb2': 'application/x-scratch2',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'mp4': 'video/mp4',
            'pdf': 'application/pdf',
            'zip': 'application/zip',
            'html': 'text/html',
            'js': 'application/javascript',
            'json': 'application/json',
            'css': 'text/css',
            'txt': 'text/plain',
            'ipynb': 'application/x-ipynb+json'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

module.exports = S3Manager;
