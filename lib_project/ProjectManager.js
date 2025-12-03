const EntryAdapter = require('./adapters/EntryAdapter');
const S3Manager = require('../lib_storage/s3Manager');
const db = require('../lib_login/db');

class ProjectManager {
    constructor() {
        // 플랫폼별 어댑터 등록
        this.adapters = {
            entry: new EntryAdapter()
            // 나중에 scratch, appinventor 등 추가
        };
        
        this.s3Manager = new S3Manager();
    }

    /**
     * 🔥 통합 프로젝트 저장
     */
    async saveProject(options) {
        const {
            platform,      // 'entry', 'scratch', 'appinventor' 등
            projectName,   // 프로젝트명
            projectData,   // 플랫폼별 프로젝트 데이터
            saveType,      // 'draft', 'final', 'autosave'
            userId,        // 사용자 ID
            centerId,      // 센터 ID
            metadata = {}  // 추가 메타데이터
        } = options;

        console.log(`\n=== PROJECT SAVE START ===`);
        console.log(`플랫폼: ${platform}, 프로젝트명: ${projectName}, 타입: ${saveType}`);

        try {
            // 1. 플랫폼별 어댑터 선택
            const adapter = this.adapters[platform];
            if (!adapter) {
                throw new Error(`지원하지 않는 플랫폼: ${platform}`);
            }

            // 2. 플랫폼별 검증
            await adapter.validate(projectData);

            // 3. 플랫폼별 전처리
            const processedData = await adapter.process(projectData);

            // 4. S3 키 생성
            const s3Key = this.generateS3Key(platform, userId, projectName, saveType);
            console.log(`S3 키 생성: ${s3Key}`);

            // 5. S3에 업로드
            const s3Url = await this.s3Manager.uploadProject(
                s3Key,
                processedData,
                adapter.getContentType()
            );

            // 6. 플랫폼별 분석
            const analysis = await adapter.analyze(projectData);
            console.log(`프로젝트 분석:`, analysis);

            // 7. DB에 저장
            const submissionId = await this.saveToDatabase({
                userId,
                centerId,
                platform,
                projectName,
                saveType,
                s3Url,
                s3Key,
                fileSize: processedData.length,
                metadata: {
                    ...metadata,
                    analysis
                },
                complexityScore: analysis.complexity,
                blocksCount: analysis.blocks
            });

            console.log(`✅ DB 저장 완료: submission_id=${submissionId}`);

            // 8. 학습 로그 기록
            await this.logLearningActivity(userId, centerId, platform, submissionId, saveType);

            console.log(`=== PROJECT SAVE COMPLETE ===\n`);

            return {
                success: true,
                submissionId,
                s3Url,
                s3Key,
                projectName,
                platform,
                saveType,
                analysis
            };

        } catch (error) {
            console.error(`❌ 프로젝트 저장 실패:`, error);
            throw error;
        }
    }

    /**
     * 🔥 S3 키 생성 (통일된 규칙)
     * users/{userID}/{platform}/{saveType}/{projectName}_{timestamp}.{ext}
     */
    generateS3Key(platform, userId, projectName, saveType) {
        const timestamp = Date.now();
        // 특수문자 제거
        const sanitized = projectName
            .replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
            .substring(0, 100); // 최대 길이 제한
        
        const extension = this.adapters[platform].getExtension();
        
        // 🔥 수정: users/ 방식으로 변경 (S3 브라우저와 통일)
        return `users/${userId}/${platform}/${saveType}/${sanitized}_${timestamp}.${extension}`;
    }

    /**
     * 🔥 DB 저장
     */
    async saveToDatabase(data) {
        // 1. userID(문자열)을 Users.id(숫자)로 변환
        let numericUserId = data.userId;
        
        // userId가 문자열이면 Users 테이블에서 id 조회
        if (typeof data.userId === 'string') {
            const [user] = await db.queryDatabase(
                'SELECT id FROM Users WHERE userID = ?',
                [data.userId]
            );
            
            if (!user) {
                throw new Error(`사용자를 찾을 수 없습니다: ${data.userId}`);
            }
            
            numericUserId = user.id;
            console.log(`✅ userID 변환: ${data.userId} → ${numericUserId}`);
        }
        
        // 2. DB 저장
        const query = `
            INSERT INTO ProjectSubmissions 
            (user_id, center_id, platform, project_name, save_type, 
             s3_url, s3_key, file_size_kb, metadata, 
             complexity_score, blocks_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const fileSizeKb = Math.round(data.fileSize / 1024);

        const result = await db.queryDatabase(query, [
            numericUserId,  // 🔥 숫자 ID 사용
            data.centerId,
            data.platform,
            data.projectName,
            data.saveType,
            data.s3Url,
            data.s3Key,
            fileSizeKb,
            JSON.stringify(data.metadata),
            data.complexityScore || 0,
            data.blocksCount || 0
        ]);

        return result.insertId;
    }

    /**
     * 🔥 학습 로그 기록
     */
    async logLearningActivity(userId, centerId, platform, submissionId, saveType) {
        try {
            // userID(문자열)을 Users.id(숫자)로 변환
            let numericUserId = userId;
            
            if (typeof userId === 'string') {
                const [user] = await db.queryDatabase(
                    'SELECT id FROM Users WHERE userID = ?',
                    [userId]
                );
                
                if (!user) {
                    console.warn(`⚠️ 사용자 찾기 실패, 로그 기록 생략: ${userId}`);
                    return;
                }
                
                numericUserId = user.id;
            }
            
            const contentName = `${platform}_${saveType}`;
            
            const query = `
                INSERT INTO LearningLogs 
                (user_id, center_id, content_type, content_name, 
                 start_time, end_time, duration, project_id)
                VALUES (?, ?, ?, ?, NOW(), NOW(), 0, ?)
            `;

            await db.queryDatabase(query, [
                numericUserId,  // 🔥 숫자 ID 사용
                centerId,
                platform,
                contentName,
                submissionId.toString()
            ]);

            console.log(`✅ 학습 로그 기록 완료`);
        } catch (error) {
            console.error('⚠️ 학습 로그 기록 실패 (무시):', error.message);
        }
    }

    /**
     * 🔥 프로젝트 목록 조회
     */
    async listProjects(options) {
        const { userId, platform, saveType, limit = 100 } = options;

        // userID(문자열)을 Users.id(숫자)로 변환
        let numericUserId = userId;
        
        if (typeof userId === 'string') {
            const [user] = await db.queryDatabase(
                'SELECT id FROM Users WHERE userID = ?',
                [userId]
            );
            
            if (!user) {
                throw new Error(`사용자를 찾을 수 없습니다: ${userId}`);
            }
            
            numericUserId = user.id;
        }

        let query = `
            SELECT 
                id,
                platform,
                project_name,
                save_type,
                s3_url,
                s3_key,
                file_size_kb,
                complexity_score,
                blocks_count,
                metadata,
                created_at,
                updated_at
            FROM ProjectSubmissions
            WHERE user_id = ?
        `;

        const params = [numericUserId];  // 🔥 숫자 ID 사용

        if (platform) {
            query += ` AND platform = ?`;
            params.push(platform);
        }

        if (saveType) {
            query += ` AND save_type = ?`;
            params.push(saveType);
        }

        // 🔥 LIMIT는 문자열 보간으로 처리 (prepared statement 파라미터 아님)
        query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit, 10)}`;

        return await db.queryDatabase(query, params);
    }

    /**
     * 🔥 프로젝트 불러오기
     */
    async loadProject(projectId, userId) {
        try {
            // 1. DB에서 메타데이터 조회
            // userID(문자열)을 Users.id(숫자)로 변환
            let numericUserId = userId;
            
            if (typeof userId === 'string') {
                const [user] = await db.queryDatabase(
                    'SELECT id FROM Users WHERE userID = ?',
                    [userId]
                );
                
                if (!user) {
                    throw new Error(`사용자를 찾을 수 없습니다: ${userId}`);
                }
                
                numericUserId = user.id;
            }
            
            const [project] = await db.queryDatabase(
                `SELECT * FROM ProjectSubmissions WHERE id = ? AND user_id = ?`,
                [projectId, numericUserId]  // 🔥 숫자 ID 사용
            );

            if (!project) {
                throw new Error('프로젝트를 찾을 수 없습니다.');
            }

            console.log(`📂 프로젝트 불러오기: ${project.project_name} (${project.platform})`);

            // 2. S3에서 데이터 다운로드
            const projectDataBuffer = await this.s3Manager.downloadProject(project.s3_key);

            // 3. 플랫폼별 어댑터로 후처리
            const adapter = this.adapters[project.platform];
            if (!adapter) {
                throw new Error(`지원하지 않는 플랫폼: ${project.platform}`);
            }

            // 🔥 userId 전달 (entFileManager에서 이미지 격리에 사용)
            const processedData = await adapter.postProcess(
                projectDataBuffer,
                userId,  // 원본 userId (문자열) 전달
                null     // sessionID는 entFileManager에서 자동 생성
            );

            // 🔥 metadata가 이미 객체인 경우 처리
            let parsedMetadata = {};
            try {
                if (typeof project.metadata === 'string') {
                    parsedMetadata = JSON.parse(project.metadata);
                } else if (typeof project.metadata === 'object' && project.metadata !== null) {
                    parsedMetadata = project.metadata;
                }
            } catch (e) {
                console.warn('⚠️ metadata 파싱 실패, 빈 객체 사용:', e.message);
            }

            return {
                data: processedData,
                metadata: parsedMetadata,
                projectInfo: {
                    id: project.id,
                    projectName: project.project_name,
                    platform: project.platform,
                    saveType: project.save_type,
                    createdAt: project.created_at
                }
            };
        } catch (error) {
            console.error('❌ 프로젝트 불러오기 실패:', error);
            throw error;
        }
    }

    /**
     * 🔥 프로젝트 삭제
     */
    async deleteProject(projectId, userId) {
        try {
            // 1. DB 조회
            // userID(문자열)을 Users.id(숫자)로 변환
            let numericUserId = userId;
            
            if (typeof userId === 'string') {
                const [user] = await db.queryDatabase(
                    'SELECT id FROM Users WHERE userID = ?',
                    [userId]
                );
                
                if (!user) {
                    throw new Error(`사용자를 찾을 수 없습니다: ${userId}`);
                }
                
                numericUserId = user.id;
            }
            
            const [project] = await db.queryDatabase(
                `SELECT * FROM ProjectSubmissions WHERE id = ? AND user_id = ?`,
                [projectId, numericUserId]  // 🔥 숫자 ID 사용
            );

            if (!project) {
                throw new Error('프로젝트를 찾을 수 없거나 삭제 권한이 없습니다.');
            }

            console.log(`🗑️ 프로젝트 삭제 시작: ${project.project_name}`);

            // 2. S3 삭제
            await this.s3Manager.deleteProject(project.s3_key);

            // 3. DB 삭제
            await db.queryDatabase(
                `DELETE FROM ProjectSubmissions WHERE id = ?`,
                [projectId]
            );

            console.log(`✅ 프로젝트 삭제 완료`);
        } catch (error) {
            console.error('❌ 프로젝트 삭제 실패:', error);
            throw error;
        }
    }
}

module.exports = ProjectManager;
