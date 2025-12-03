// /var/www/html/lib/s3EntryAssetManager.js
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class S3EntryAssetManager {
    constructor() {
        // 🔐 S3 클라이언트 초기화 - IAM Role 기반 인증
        // EC2 인스턴스에 IAM Role이 있으면 자동으로 자격 증명을 가져옴
        const s3Config = {
            region: process.env.AWS_REGION || 'ap-northeast-2'
        };

        // 개발 환경에서만 환경 변수 사용 (프로덕션에서는 IAM Role 사용)
        if (process.env.NODE_ENV === 'development' && process.env.AWS_ACCESS_KEY_ID) {
            console.warn('⚠️  [S3EntryAssetManager] 개발 환경: 환경 변수로 AWS 자격 증명 사용');
            s3Config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };
        } else {
            console.log('🔐 [S3EntryAssetManager] 프로덕션 환경: IAM Role로 AWS 자격 증명 사용');
        }

        this.s3Client = new S3Client(s3Config);
        
        this.bucketName = process.env.S3_BUCKET_NAME || 'educodingnplaycontents';
        this.basePrefix = 'entry_assets/';
        
        console.log('✅ S3EntryAssetManager 초기화 완료 (AWS SDK v3)');
        console.log('📦 버킷:', this.bucketName);
        console.log('📁 기본 경로:', this.basePrefix);
        console.log('🔐 인증 방식:', s3Config.credentials ? '환경변수' : 'IAM Role');
    }

    // 파일 업로드
    async uploadAsset(fileBuffer, fileName, contentType, category = 'general') {
        try {
            const key = `${this.basePrefix}${category}/${fileName}`;
            
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: fileBuffer,
                    ContentType: contentType,
                    ACL: 'public-read'
                }
            });

            const result = await upload.done();
            
            const publicUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${key}`;
            
            console.log('✅ 파일 업로드 성공:', fileName);
            return {
                success: true,
                url: publicUrl,
                key: key,
                location: result.Location
            };
            
        } catch (error) {
            console.error('❌ 파일 업로드 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 파일 다운로드
    async getAsset(key) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const response = await this.s3Client.send(command);
            
            // 스트림을 버퍼로 변환
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            return {
                success: true,
                data: buffer,
                contentType: response.ContentType,
                lastModified: response.LastModified
            };
            
        } catch (error) {
            console.error('❌ 파일 다운로드 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 파일 목록 조회
    async listAssets(category = '', maxKeys = 1000) {
        try {
            const prefix = category ? `${this.basePrefix}${category}/` : this.basePrefix;
            
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                MaxKeys: maxKeys
            });

            const response = await this.s3Client.send(command);
            
            const assets = (response.Contents || []).map(item => ({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                url: `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${item.Key}`
            }));

            return {
                success: true,
                assets: assets,
                count: assets.length
            };
            
        } catch (error) {
            console.error('❌ 파일 목록 조회 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 파일 삭제
    async deleteAsset(key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            await this.s3Client.send(command);
            
            console.log('✅ 파일 삭제 성공:', key);
            return {
                success: true,
                key: key
            };
            
        } catch (error) {
            console.error('❌ 파일 삭제 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 서명된 URL 생성 (임시 접근)
    async getSignedUrl(key, expiresIn = 3600) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const signedUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn: expiresIn
            });

            return {
                success: true,
                signedUrl: signedUrl,
                expiresIn: expiresIn
            };
            
        } catch (error) {
            console.error('❌ 서명된 URL 생성 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Entry 스프라이트 업로드 (특화 메서드)
    async uploadEntrySprite(spriteData, spriteId) {
        try {
            const key = `${this.basePrefix}sprites/${spriteId}.json`;
            
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: JSON.stringify(spriteData, null, 2),
                    ContentType: 'application/json',
                    ACL: 'public-read'
                }
            });

            const result = await upload.done();
            
            return {
                success: true,
                spriteId: spriteId,
                url: result.Location,
                key: key
            };
            
        } catch (error) {
            console.error('❌ Entry 스프라이트 업로드 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Entry 프로젝트 파일 업로드
    async uploadEntryProject(projectData, projectId) {
        try {
            const key = `${this.basePrefix}projects/${projectId}.ent`;
            
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: projectData,
                    ContentType: 'application/octet-stream',
                    ACL: 'public-read'
                }
            });

            const result = await upload.done();
            
            return {
                success: true,
                projectId: projectId,
                url: result.Location,
                key: key
            };
            
        } catch (error) {
            console.error('❌ Entry 프로젝트 업로드 실패:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = S3EntryAssetManager;