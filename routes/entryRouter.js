const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticateUser, checkPageAccess } = require('../lib_login/authMiddleware');

// 🔥 디버깅: 모든 entryRouter 요청 로깅
router.use((req, res, next) => {
   console.log('\n=== ENTRY ROUTER DEBUG ===');
   console.log('🔍 [entryRouter] 요청 도착:', {
       method: req.method,
       path: req.path,
       originalUrl: req.originalUrl,
       baseUrl: req.baseUrl,
       fullUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
       query: req.query,
       sessionID: req.session?.userID || 'guest',
       isLoggedIn: req.session?.is_logined || false,
       timestamp: new Date().toISOString()
   });
   console.log('========================\n');
   next();
});

// 🔄 기본 경로 핸들러 (/entry)
router.get('/',
    authenticateUser,
    checkPageAccess('/entry/entry_editor'),
    async (req, res) => {
        try {
            console.log('✅ [entryRouter] 기본 경로 처리 시작');
            const { s3Url } = req.query;

            if (s3Url) {
                console.log('🎯 [entryRouter] S3 ENT 파일 로드 요청:', s3Url);
                const EntFileManager = require('../lib_entry/entFileManager');
                const entFileManager = new EntFileManager();
                const result = await entFileManager.loadProjectFromS3(
                    s3Url, 
                    req.session.userID, 
                    req.sessionID
                );

                if (result.success) {
                    console.log('✅ [entryRouter] ENT 파일 로드 성공, 사용자별 격리 적용:', {
                        userID: result.userID,
                        sessionID: result.sessionID,
                        userSessionPath: result.userSessionPath
                    });
                    
                    // 🔍 이미지 경로 디버깅 로그
                    if (result.projectData?.objects && result.projectData.objects.length > 0) {
                        const firstObj = result.projectData.objects[0];
                        console.log('🖼️ [entryRouter] 첫 번째 오브젝트 이미지 경로:', {
                            hasSprite: !!firstObj.sprite,
                            hasPictures: !!firstObj.sprite?.pictures,
                            pictureCount: firstObj.sprite?.pictures?.length || 0,
                            firstImageUrl: firstObj.sprite?.pictures?.[0]?.fileurl || 'none',
                            thumbnail: firstObj.thumbnail || 'none'
                        });
                    }
                    
                    const projectDataEncoded = Buffer.from(JSON.stringify(result.projectData)).toString('base64');
                    // 🔥 중요: userID, role을 앞에 배치 (URL 길이 제한으로 인한 잘림 방지)
                    const entryServerUrl = `https://app.codingnplay.co.kr/entry_editor/?userID=${req.session.userID}&role=${req.session.role}&sessionID=${result.sessionID}&project=${projectDataEncoded}`;
                    return res.redirect(entryServerUrl);
                } else {
                    console.error('❌ [entryRouter] ENT 파일 로드 실패:', result.error);
                    res.status(422).render('error', {
                        message: 'ENT 파일 로드 실패',
                        error: result.error
                    });
                }
            } else {
                const entryServerUrl = `https://app.codingnplay.co.kr/entry_editor/?userID=${req.session.userID}&role=${req.session.role}&project=new`;
                return res.redirect(entryServerUrl);
            }
        } catch (error) {
            console.error('❌ [entryRouter] 기본 경로 처리 오류:', error);
            res.status(500).render('error', {
                userID: req.session.userID,
                role: req.session.role,
                is_logined: req.session.is_logined,
                centerID: req.session.centerID,
                message: 'Entry 워크스페이스를 로드하는데 실패했습니다.',
                error: {
                    status: 500,
                    stack: error.message
                }
            });
        }
    }
);

// 🔄 /entry_editor 라우트
router.get('/entry_editor',
    authenticateUser,
    checkPageAccess('/entry/entry_editor'),
    async (req, res) => {
        try {
            const { s3Url } = req.query;
            const userID = req.session.userID;
            const role = req.session.role;

            if (s3Url) {
                console.log('🎯 [entryRouter] /entry_editor S3 ENT 파일 로드 요청:', s3Url);
                const EntFileManager = require('../lib_entry/entFileManager');
                const entFileManager = new EntFileManager();
                const result = await entFileManager.loadProjectFromS3(
                    s3Url, 
                    userID, 
                    req.sessionID
                );

                if (result.success) {
                    console.log('✅ [entryRouter] /entry_editor ENT 파일 로드 성공, 사용자별 격리 적용:', {
                        userID: result.userID,
                        sessionID: result.sessionID,
                        userSessionPath: result.userSessionPath
                    });
                    
                    // 🔥 중요: userID, role을 앞에 배치
                    const entryServerUrl = `https://app.codingnplay.co.kr/entry_editor/?userID=${userID}&role=${role}&sessionID=${result.sessionID}&s3Url=${encodeURIComponent(s3Url)}`;
                    return res.redirect(entryServerUrl);
                } else {
                    console.error('❌ [entryRouter] /entry_editor ENT 파일 로드 실패:', result.error);
                    return res.status(422).render('error', {
                        userID: userID,
                        role: role,
                        is_logined: req.session.is_logined,
                        centerID: req.session.centerID,
                        message: 'ENT 파일 로드 실패',
                        error: result.error
                    });
                }
            } else {
                const entryServerUrl = `https://app.codingnplay.co.kr/entry_editor/?userID=${userID}&role=${role}&project=new`;
                return res.redirect(entryServerUrl);
            }
        } catch (error) {
            console.error('❌ [entryRouter] entry_editor 라우트 오류:', error);
            res.status(500).render('error', {
                userID: req.session.userID,
                role: req.session.role,
                is_logined: req.session.is_logined,
                centerID: req.session.centerID,
                message: 'Entry 워크스페이스를 로드하는데 실패했습니다.',
                error: {
                    status: 500,
                    stack: error.message
                }
            });
        }
    }
);

// 세션 관리 API들 추가
router.delete('/api/session/:sessionID', authenticateUser, async (req, res) => {
    try {
        const { sessionID } = req.params;
        const userID = req.session.userID;
        
        const sessionPath = path.join(__dirname, '../temp/ent_files/users', `${userID}_${sessionID}`);
        
        const fs = require('fs').promises;
        await fs.rm(sessionPath, { recursive: true, force: true });
        
        console.log(`수동 세션 정리 완료: ${sessionPath}`);
        
        res.json({
            success: true,
            message: '세션이 정리되었습니다.',
            sessionID: sessionID
        });
    } catch (error) {
        console.error('세션 정리 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/api/sessions', authenticateUser, async (req, res) => {
    try {
        const userID = req.session.userID;
        const usersDir = path.join(__dirname, '../temp/ent_files/users');
        
        const fs = require('fs').promises;
        
        try {
            const userSessions = await fs.readdir(usersDir);
            const activeSessions = [];
            
            for (const sessionDir of userSessions) {
                if (sessionDir.startsWith(`${userID}_`)) {
                    const sessionPath = path.join(usersDir, sessionDir);
                    try {
                        const stats = await fs.stat(sessionPath);
                        const sessionID = sessionDir.split('_').slice(1).join('_');
                        
                        activeSessions.push({
                            sessionID: sessionID,
                            createdAt: stats.birthtime,
                            lastAccessed: stats.mtime,
                            path: sessionPath
                        });
                    } catch (error) {
                        // 세션 디렉토리 접근 오류 무시
                    }
                }
            }
            
            res.json({
                success: true,
                userID: userID,
                activeSessions: activeSessions,
                totalSessions: activeSessions.length
            });
        } catch (error) {
            res.json({
                success: true,
                userID: userID,
                activeSessions: [],
                totalSessions: 0,
                message: 'users 디렉토리가 없거나 접근할 수 없습니다.'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/api/cleanup-expired-sessions', authenticateUser, async (req, res) => {
    try {
        const EntFileManager = require('../lib_entry/entFileManager');
        const entFileManager = new EntFileManager();
        
        // 만료된 파일들 정리
        const cleanedCount = await entFileManager.cleanupExpiredFiles();
        
        // 사용자별 오래된 세션들 정리
        const userID = req.session.userID;
        await entFileManager.cleanupUserSessions(userID, 2); // 최대 2개만 유지
        
        res.json({
            success: true,
            message: '만료된 세션 정리 완료',
            cleanedFiles: cleanedCount,
            userID: userID
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API 라우터들 유지 (변경 없음)

router.get('/api/verify-auth', (req, res) => {
    if (!req.session?.is_logined) {
        return res.status(401).json({ success: false, error: '인증되지 않은 사용자' });
    }

    res.json({
        success: true,
        userInfo: {
            userID: req.session.userID,
            role: req.session.role,
            centerID: req.session.centerID,
            timestamp: new Date().toISOString()
        }
    });
});

router.get('/api/load-project', authenticateUser, async (req, res) => {
    try {
        const { file, s3Url } = req.query;
        let targetS3Url = s3Url;

        if (!targetS3Url && file) {
            targetS3Url = `https://educodingnplaycontents.s3.amazonaws.com/ent/${file}`;
        }

        if (!targetS3Url) {
            return res.status(400).json({
                success: false,
                error: 'S3 URL 또는 프로젝트 파일명이 필요합니다.'
            });
        }

        const EntFileManager = require('../lib_entry/entFileManager');
        const entFileManager = new EntFileManager();
        const result = await entFileManager.loadProjectFromS3(
            targetS3Url,
            req.session.userID,
            req.sessionID
        );

        if (result.success) {
            res.json({
                success: true,
                projectData: result.projectData,
                fileName: result.fileName || file,
                s3Url: targetS3Url,
                loadTime: new Date().toISOString(),
                userID: result.userID,
                sessionID: result.sessionID,
                userSessionPath: result.userSessionPath,
                metadata: result.metadata,
                message: '프로젝트 로드 완료 (사용자별 격리 적용)'
            });
        } else {
            res.status(422).json({
                success: false,
                error: result.error || `프로젝트를 찾을 수 없습니다.`,
                s3Url: targetS3Url
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================================================
// 🔥 프로젝트 저장 API (quotaChecker 연동)
// =============================================================================

router.post('/api/save-project', authenticateUser, async (req, res) => {
    try {
        const { projectData, projectName, userID: clientUserID, centerID: clientCenterID, isUpdate, projectId, saveType, thumbnailBase64 } = req.body;
        const userID = clientUserID || req.session.userID;
        
        if (!projectData) {
            return res.status(400).json({
                success: false,
                error: '프로젝트 데이터가 필요합니다.'
            });
        }

        const db = require('../lib_login/db');
        const quotaChecker = require('../lib_storage/quotaChecker');
        const S3Manager = require('../lib_storage/s3Manager');
        const s3Manager = new S3Manager();

        // 1. 사용자 DB ID 조회
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?', 
            [userID]
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }

        const userId = user.id;
        const centerId = clientCenterID || user.centerID || req.session.centerID;
        const actualSaveType = saveType || 'projects';

        // 🔥 자동저장 특별 처리: 기존 autosave 레코드가 있으면 UPDATE로 전환
        let effectiveIsUpdate = isUpdate;
        let effectiveProjectId = projectId;

        if (actualSaveType === 'autosave') {
            // 해당 사용자의 기존 autosave 레코드 검색
            const existingAutosave = await db.queryDatabase(
                `SELECT id, file_size_kb FROM ProjectSubmissions 
                 WHERE user_id = ? AND platform = 'entry' AND save_type = 'autosave'
                   AND (is_deleted = FALSE OR is_deleted IS NULL)
                 ORDER BY updated_at DESC LIMIT 1`,
                [userId]
            );
            
            if (existingAutosave.length > 0) {
                // 기존 autosave가 있으면 UPDATE 모드로 전환
                effectiveIsUpdate = true;
                effectiveProjectId = existingAutosave[0].id;
                console.log(`🔄 [자동저장] 기존 autosave 발견 (ID: ${effectiveProjectId}), UPDATE 모드로 전환`);
            } else {
                console.log(`➕ [자동저장] 기존 autosave 없음, 새로 생성`);
            }
        }

        console.log('💾 [Entry 저장] 요청:', {
            userID,
            projectName,
            isUpdate: effectiveIsUpdate,
            projectId: effectiveProjectId,
            saveType: actualSaveType
        });

        // 2. 프로젝트 데이터 → JSON → Buffer
        const projectJson = JSON.stringify(projectData);
        const projectBuffer = Buffer.from(projectJson, 'utf8');
        const fileSize = projectBuffer.length;

        console.log(`📊 파일 크기: ${(fileSize / 1024).toFixed(2)} KB`);

        // 3. 🔥 용량 체크 (quotaChecker)
        let oldFileSize = 0;
        if (effectiveIsUpdate && effectiveProjectId) {
            // 덮어쓰기인 경우 기존 파일 크기 조회
            const [oldProject] = await db.queryDatabase(
                'SELECT file_size_kb FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
                [effectiveProjectId, userId]
            );
            if (oldProject) {
                oldFileSize = (oldProject.file_size_kb || 0) * 1024;
            }
        }

        const netFileSize = fileSize - oldFileSize; // 순증가분만 체크
        
        if (netFileSize > 0) {
            const canSave = await quotaChecker.canUpload(userId, centerId, netFileSize);
            if (!canSave.allowed) {
                return res.status(413).json({
                    success: false,
                    error: 'QUOTA_EXCEEDED',
                    message: canSave.message || '저장 공간이 부족합니다.',
                    details: {
                        currentUsage: canSave.currentUsage,
                        limit: canSave.limit,
                        required: netFileSize
                    }
                });
            }
        }

        // 4. S3 키 생성 (정책 준수: users/{userID}/{platform}/{saveType}/)
        const timestamp = Date.now();
        const safeName = (projectName || 'project').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
        const fileName = `${safeName}_${timestamp}.ent`;
        const s3Key = `users/${userID}/entry/${actualSaveType}/${fileName}`;

        console.log(`📤 S3 업로드 시작: ${s3Key}`);

        // 5. S3 업로드
        const s3Url = await s3Manager.uploadProject(s3Key, projectBuffer, 'application/json');
        
        console.log(`✅ S3 업로드 완료: ${s3Url}`);

        // 🔥 5-1. 썸네일 업로드 (있는 경우)
        let thumbnailUrl = null;
        if (thumbnailBase64) {
            try {
                // Base64 데이터에서 헤더 제거 (data:image/png;base64, 부분)
                const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
                const thumbnailBuffer = Buffer.from(base64Data, 'base64');
                
                // 썸네일 S3 키 생성
                const thumbKey = `users/${userID}/entry/${actualSaveType}/thumbnails/${safeName}_${timestamp}.png`;
                
                // S3에 썸네일 업로드
                thumbnailUrl = await s3Manager.uploadProject(thumbKey, thumbnailBuffer, 'image/png');
                
                console.log(`📸 썸네일 업로드 완료: ${thumbnailUrl}`);
            } catch (thumbError) {
                console.warn(`⚠️ 썸네일 업로드 실패 (무시하고 계속):`, thumbError.message);
                // 썸네일 실패해도 저장은 계속 진행
            }
        }

        // 6. DB 저장 (ProjectSubmissions)
        let dbProjectId;
        
        // 프로젝트 분석 (블록 수, 오브젝트 수 등)
        const blocksCount = projectData.objects?.reduce((sum, obj) => {
            return sum + (obj.script?.length || 0);
        }, 0) || 0;
        const spritesCount = projectData.objects?.length || 0;

        if (effectiveIsUpdate && effectiveProjectId) {
            // 덮어쓰기: 기존 레코드 업데이트 (🔥 썸네일 포함)
            await db.queryDatabase(`
                UPDATE ProjectSubmissions 
                SET project_name = ?,
                    s3_url = ?,
                    s3_key = ?,
                    file_size_kb = ?,
                    blocks_count = ?,
                    sprites_count = ?,
                    thumbnail_url = COALESCE(?, thumbnail_url),
                    updated_at = NOW()
                WHERE id = ? AND user_id = ?
            `, [
                projectName || 'Untitled',
                s3Url,
                s3Key,
                Math.ceil(fileSize / 1024),
                blocksCount,
                spritesCount,
                thumbnailUrl,
                effectiveProjectId,
                userId
            ]);
            
            dbProjectId = effectiveProjectId;
            console.log(`✅ DB 업데이트 완료: ID ${dbProjectId}`);

            // 용량 차이 업데이트
            if (netFileSize !== 0) {
                if (netFileSize > 0) {
                    await quotaChecker.increaseUsage(userId, centerId, netFileSize, 'entry');
                } else {
                    await quotaChecker.decreaseUsage(userId, centerId, Math.abs(netFileSize), 'entry');
                }
            }
            
        } else {
            // 새 저장: INSERT (🔥 썸네일 포함)
            const insertResult = await db.queryDatabase(`
                INSERT INTO ProjectSubmissions 
                (user_id, center_id, platform, project_name, save_type, s3_url, s3_key, file_size_kb, blocks_count, sprites_count, thumbnail_url, created_at, updated_at)
                VALUES (?, ?, 'entry', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                userId,
                centerId,
                projectName || 'Untitled',
                actualSaveType,
                s3Url,
                s3Key,
                Math.ceil(fileSize / 1024),
                blocksCount,
                spritesCount,
                thumbnailUrl
            ]);
            
            dbProjectId = insertResult.insertId;
            console.log(`✅ DB INSERT 완료: ID ${dbProjectId}`);

            // 🔥 용량 증가
            await quotaChecker.increaseUsage(userId, centerId, fileSize, 'entry');
        }

        res.json({
            success: true,
            projectId: dbProjectId,
            fileName: fileName,
            s3Url: s3Url,
            s3Key: s3Key,
            fileSize: fileSize,
            fileSizeKb: Math.ceil(fileSize / 1024),
            thumbnailUrl: thumbnailUrl,  // 🔥 썸네일 URL 추가
            message: effectiveIsUpdate ? '프로젝트가 업데이트되었습니다.' : '프로젝트가 저장되었습니다.'
        });

    } catch (error) {
        console.error('❌ [Entry 저장] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// =============================================================================
// 🔥 프로젝트 삭제 API (소프트 삭제 지원 + quotaChecker 용량 반환)
// =============================================================================

// S3 URL에서 키 추출 헬퍼 함수
function extractS3KeyFromUrl(s3Url) {
    if (!s3Url) return null;
    try {
        const url = new URL(s3Url);
        return url.pathname.substring(1); // 앞의 / 제거
    } catch (e) {
        return s3Url;
    }
}

router.delete('/api/project/:projectId', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { permanent } = req.query; // ?permanent=true 면 하드 삭제
        const userID = req.session.userID;
        
        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: '프로젝트 ID가 필요합니다.'
            });
        }

        console.log(`🗑️ [Entry 삭제] 요청: projectId=${projectId}, userID=${userID}, permanent=${permanent}`);

        const db = require('../lib_login/db');
        const quotaChecker = require('../lib_storage/quotaChecker');
        const S3Manager = require('../lib_storage/s3Manager');
        const s3Manager = new S3Manager();

        // 1. 사용자 DB ID 조회
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?', 
            [userID]
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }

        const userId = user.id;
        const centerId = user.centerID;

        // 2. 프로젝트 정보 조회 (삭제되지 않은 항목만)
        const [project] = await db.queryDatabase(
            `SELECT id, s3_key, s3_url, file_size_kb 
             FROM ProjectSubmissions 
             WHERE id = ? AND user_id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)`,
            [projectId, userId]
        );

        if (!project) {
            return res.status(404).json({ 
                success: false, 
                error: '프로젝트를 찾을 수 없거나 삭제 권한이 없습니다.' 
            });
        }

        const fileSize = (project.file_size_kb || 0) * 1024;

        if (permanent === 'true') {
            // 🔥 하드 삭제: S3 파일 + DB 레코드 완전 삭제
            const s3KeyToDelete = project.s3_key || extractS3KeyFromUrl(project.s3_url);
            if (s3KeyToDelete) {
                try {
                    await s3Manager.deleteProject(s3KeyToDelete);
                    console.log(`✅ S3 파일 삭제: ${s3KeyToDelete}`);
                } catch (s3Error) {
                    console.warn(`⚠️ S3 파일 삭제 실패 (무시하고 계속):`, s3Error.message);
                }
            }

            await db.queryDatabase(
                'DELETE FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
                [projectId, userId]
            );
            
            console.log(`✅ DB 하드 삭제 완료: ID ${projectId}`);

            if (fileSize > 0) {
                await quotaChecker.decreaseUsage(userId, centerId, fileSize, 'entry');
                console.log(`💾 용량 반환: ${(fileSize / 1024).toFixed(2)} KB`);
            }

            res.json({
                success: true,
                message: '프로젝트가 완전히 삭제되었습니다.',
                deletedId: projectId,
                freedSpace: fileSize,
                deleteType: 'permanent'
            });

        } else {
            // 🔥 소프트 삭제: is_deleted = TRUE, deleted_at = NOW()
            await db.queryDatabase(
                `UPDATE ProjectSubmissions 
                 SET is_deleted = TRUE, deleted_at = NOW() 
                 WHERE id = ? AND user_id = ?`,
                [projectId, userId]
            );
            
            console.log(`✅ DB 소프트 삭제 완료: ID ${projectId}`);

            // 용량 반환 (소프트 삭제에서도 용량은 반환)
            if (fileSize > 0) {
                await quotaChecker.decreaseUsage(userId, centerId, fileSize, 'entry');
                console.log(`💾 용량 반환: ${(fileSize / 1024).toFixed(2)} KB`);
            }

            res.json({
                success: true,
                message: '프로젝트가 휴지통으로 이동되었습니다.',
                deletedId: projectId,
                freedSpace: fileSize,
                deleteType: 'soft'
            });
        }

    } catch (error) {
        console.error('❌ [Entry 삭제] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.get('/api/projects', authenticateUser, async (req, res) => {
    res.json({
        success: true,
        projects: [
            {
                fileName: 'my_game.ent',
                displayName: '나의 게임',
                lastModified: '2025-01-20T10:30:00Z',
                fileSize: 1024000,
                url: `/entry/entry_editor?project=my_game.ent`
            },
            {
                fileName: 'animation.ent',
                displayName: '애니메이션 프로젝트',
                lastModified: '2025-01-19T15:45:00Z',
                fileSize: 2048000,
                url: `/entry/entry_editor?project=animation.ent`
            }
        ],
        totalCount: 2
    });
});

router.post('/api/upload', authenticateUser, async (req, res) => {
    const userID = req.session.userID;

    res.json({
        success: true,
        fileName: 'uploaded_project.ent',
        fileUrl: `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/projects/${userID}/uploaded_project.ent`,
        message: 'ENT 파일 업로드 (구현 예정)'
    });
});

router.get('/api/sprites', authenticateUser, async (req, res) => {
    const { category, subMenu, search } = req.query;
    const EntryAssetManager = require('../lib_entry/entryAssetManager');
    const path = require('path');
    const assetManager = new EntryAssetManager(path.join(__dirname, '../metadata.json'));

    if (search) {
        const searchResults = assetManager.searchSprites(search, category);
        return res.json({ success: true, sprites: searchResults });
    }

    if (category || subMenu) {
        const targetCategory = category || subMenu;
        const result = assetManager.getSpritesByCategory(targetCategory);
        return res.json({ success: true, sprites: result.sprites });
    }

    const categories = assetManager.getCategories();
    return res.json({ success: true, sprites: [], categories: categories });
});

router.get('/api/auth-check', (req, res) => {
    res.json({
        authenticated: req.session?.is_logined || false,
        userID: req.session?.userID || 'guest',
        role: req.session?.role || 'guest',
        centerID: req.session?.centerID || null,
        timestamp: new Date().toISOString()
    });
});

router.get('/api/debug/session', authenticateUser, (req, res) => {
    res.json({
        session: {
            userID: req.session?.userID,
            role: req.session?.role,
            is_logined: req.session?.is_logined,
            centerID: req.session?.centerID
        },
        headers: {
            'user-agent': req.headers['user-agent'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip']
        },
        timestamp: new Date().toISOString()
    });
});

// =============================================================================
// 🎨 페인트 에디터 이미지 업로드 API (S3Manager 사용 - IAM Role 지원)
// =============================================================================

router.post('/data/upload-drawing', authenticateUser, async (req, res) => {
    try {
        const { imageData, fileName } = req.body;
        const userID = req.session?.userID || 'anonymous';
        const sessionID = req.query.sessionID || Date.now().toString();
        
        if (!imageData) {
            return res.status(400).json({
                success: false,
                error: '이미지 데이터가 필요합니다.'
            });
        }
        
        console.log('🎨 [페인트 에디터] 이미지 업로드 요청:', {
            userID,
            sessionID,
            fileName,
            dataLength: imageData.length
        });
        
        // Base64 데이터에서 헤더 제거 (data:image/png;base64, 부분)
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // 파일명 생성
        const timestamp = Date.now();
        const finalFileName = `${timestamp}_drawing_${sessionID}.png`;
        
        const fs = require('fs').promises;
        const localPath = require('path');
        
        // 🔥 S3Manager 사용 (IAM Role 지원)
        let s3Url = null;
        let s3Key = null;
        
        try {
            const S3Manager = require('../lib_storage/s3Manager');
            const s3Manager = new S3Manager();
            
            // S3 키 생성 - ent/uploads 경로 사용 (CORS 설정된 경로)
            s3Key = `ent/uploads/${userID}_${sessionID}/${finalFileName}`;
            
            // S3Manager의 uploadProject 메서드 사용
            s3Url = await s3Manager.uploadProject(s3Key, imageBuffer, 'image/png');
            
            console.log(`✅ S3 업로드 완료 (S3Manager): ${s3Url}`);
            
        } catch (s3Error) {
            console.error('⚠️ S3 업로드 실패, 로컬 저장으로 폴백:', s3Error.message);
            
            // 🔥 S3 실패 시에만 고정 경로(current)에 로컬 저장
            const tempDir = '/var/www/html/temp/ent_files/current';
            await fs.mkdir(tempDir, { recursive: true });
            
            const localFilePath = localPath.join(tempDir, finalFileName);
            await fs.writeFile(localFilePath, imageBuffer);
            console.log(`✅ 로컬 임시 파일 저장: ${localFilePath}`);
        }
        
        // Entry가 접근할 수 있는 URL 생성
        const localUrl = `/entry/temp/${finalFileName}`;
        const finalUrl = s3Url || localUrl;
        
        console.log(`🖼️ 최종 이미지 URL: ${finalUrl}`);
        
        res.json({
            success: true,
            filename: finalFileName,
            fileurl: finalUrl,
            thumbUrl: finalUrl,
            imageType: 'png',
            dimension: {
                width: 480,
                height: 270
            },
            message: '이미지 업로드 성공'
        });
        
    } catch (error) {
        console.error('❌ 이미지 업로드 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// 🔥 사용자 저장 프로젝트 목록 조회 API (불러오기 기능)
// =============================================================================

router.get('/api/user-projects', authenticateUser, async (req, res) => {
    try {
        const userID = req.session.userID;
        const { saveType } = req.query; // 선택적 필터: 'autosave', 'projects' 등
        
        if (!userID) {
            return res.status(400).json({ 
                success: false, 
                error: '사용자 ID가 필요합니다.' 
            });
        }

        console.log(`\n📂 ========== [불러오기] 프로젝트 목록 조회 ==========`);
        console.log(`👤 사용자: ${userID}`);
        console.log(`🔍 saveType 필터: ${saveType || '전체'}`);

        const db = require('../lib_login/db');

        // 사용자 DB ID 조회
        const userQuery = 'SELECT id FROM Users WHERE userID = ?';
        const [user] = await db.queryDatabase(userQuery, [userID]);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }

        const userId = user.id;

        // 🔥 수정: updated_at DESC로 변경 (autosave는 UPDATE되므로)
        // 🔥 수정: LIMIT 100으로 증가
        // 🔥 수정: thumbnail_url 추가
        let query = `
            SELECT 
                id,
                user_id,
                platform,
                project_name,
                save_type,
                s3_url,
                s3_key,
                file_size_kb,
                complexity_score,
                blocks_count,
                sprites_count,
                metadata,
                thumbnail_url,
                created_at,
                updated_at
            FROM ProjectSubmissions
            WHERE user_id = ?
              AND platform = 'entry'
              AND (is_deleted = FALSE OR is_deleted IS NULL)
        `;
        
        const params = [userId];
        
        // saveType 필터 적용 (선택적)
        if (saveType) {
            query += ` AND save_type = ?`;
            params.push(saveType);
        }
        
        query += ` ORDER BY updated_at DESC LIMIT 100`;

        const projects = await db.queryDatabase(query, params);

        // 🔥 디버깅: save_type별 개수 집계
        const saveTypeCounts = projects.reduce((acc, p) => {
            const type = p.save_type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        console.log(`✅ [불러오기] 조회 결과:`);
        console.log(`   📊 총 ${projects.length}개 프로젝트`);
        console.log(`   📁 save_type별 개수:`, saveTypeCounts);
        
        // 최근 autosave 정보 출력
        const latestAutosave = projects.find(p => p.save_type === 'autosave');
        if (latestAutosave) {
            console.log(`   🔄 최신 autosave: "${latestAutosave.project_name}" (ID: ${latestAutosave.id})`);
            console.log(`      - created_at: ${latestAutosave.created_at}`);
            console.log(`      - updated_at: ${latestAutosave.updated_at}`);
        } else {
            console.log(`   ⚠️ autosave 파일 없음`);
        }
        console.log(`================================================\n`);

        res.json({
            success: true,
            totalCount: projects.length,
            saveTypeCounts: saveTypeCounts,
            projects: projects.map(p => ({
                id: p.id,
                projectName: p.project_name,
                saveType: p.save_type,
                s3Url: p.s3_url,
                s3Key: p.s3_key,
                fileSizeKb: p.file_size_kb,
                blocksCount: p.blocks_count,
                spritesCount: p.sprites_count,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                thumbnailUrl: null, // TODO: 썸네일 기능 추가 예정
                metadata: p.metadata ? (typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata) : null
            }))
        });

    } catch (error) {
        console.error('❌ [불러오기] 프로젝트 목록 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// =============================================================================
// 🔊 소리 업로드 API (파일 올리기)
// =============================================================================

const multer = require('multer');

// 소리 파일 업로드용 multer 설정
const soundUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        // 허용하는 오디오 확장자
        const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp4'];
        const allowedExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a'];
        
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`지원하지 않는 오디오 형식입니다: ${file.mimetype} (${ext})`), false);
        }
    }
});

router.post('/api/upload-sound', authenticateUser, soundUpload.single('sound'), async (req, res) => {
    try {
        const userID = req.session?.userID || 'anonymous';
        const sessionID = req.query.sessionID || Date.now().toString();
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '소리 파일이 필요합니다.'
            });
        }
        
        const file = req.file;
        console.log('🔊 [소리 업로드] 요청:', {
            userID,
            sessionID,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype
        });
        
        // 파일명 생성
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
        const finalFileName = `${timestamp}_${baseName}${ext}`;
        
        const fs = require('fs').promises;
        
        let s3Url = null;
        
        try {
            // 🔥 S3Manager 사용 (IAM Role 지원)
            const S3Manager = require('../lib_storage/s3Manager');
            const s3Manager = new S3Manager();
            
            // S3 키 생성 - ent/uploads 경로 사용
            const s3Key = `ent/uploads/${userID}_${sessionID}/sounds/${finalFileName}`;
            
            // S3Manager의 uploadProject 메서드 사용
            s3Url = await s3Manager.uploadProject(s3Key, file.buffer, file.mimetype);
            
            console.log(`✅ S3 업로드 완료: ${s3Url}`);
            
        } catch (s3Error) {
            console.error('⚠️ S3 업로드 실패, 로컬 저장으로 폴백:', s3Error.message);
            
            // 로컬 저장
            const tempDir = '/var/www/html/temp/ent_files/current/sounds';
            await fs.mkdir(tempDir, { recursive: true });
            
            const localFilePath = path.join(tempDir, finalFileName);
            await fs.writeFile(localFilePath, file.buffer);
            
            s3Url = `/entry/temp/sounds/${finalFileName}`;
            console.log(`✅ 로컬 저장 완료: ${s3Url}`);
        }
        
        res.json({
            success: true,
            filename: finalFileName,
            fileurl: s3Url,
            path: s3Url,
            ext: ext,
            duration: 1, // TODO: ffprobe로 실제 duration 계산
            originalName: file.originalname,
            size: file.size,
            message: '소리 파일 업로드 성공'
        });
        
    } catch (error) {
        console.error('❌ 소리 업로드 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// 🔊 편집된 소리 저장 API
// =============================================================================

router.post('/api/save-sound', authenticateUser, async (req, res) => {
    try {
        const userID = req.session?.userID || 'anonymous';
        const sessionID = req.query.sessionID || Date.now().toString();
        
        const { name, source, ext, duration } = req.body;
        
        if (!source) {
            return res.status(400).json({
                success: false,
                error: '소리 데이터가 필요합니다.'
            });
        }
        
        console.log('💾 [소리 저장] 요청:', {
            userID,
            sessionID,
            name,
            ext,
            duration,
            sourceLength: typeof source === 'string' ? source.length : 'ArrayBuffer'
        });
        
        // Base64 또는 ArrayBuffer 처리
        let audioBuffer;
        if (typeof source === 'string') {
            // Base64 데이터
            const base64Data = source.replace(/^data:audio\/\w+;base64,/, '');
            audioBuffer = Buffer.from(base64Data, 'base64');
        } else if (Array.isArray(source)) {
            // ArrayBuffer (배열로 전송된 경우)
            audioBuffer = Buffer.from(source);
        } else {
            return res.status(400).json({
                success: false,
                error: '지원하지 않는 소리 데이터 형식입니다.'
            });
        }
        
        // 파일명 생성
        const timestamp = Date.now();
        const finalExt = ext || '.mp3';
        const baseName = (name || 'edited_sound').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
        const finalFileName = `${timestamp}_${baseName}${finalExt}`;
        
        const fs = require('fs').promises;
        
        let s3Url = null;
        
        try {
            // 🔥 S3Manager 사용
            const S3Manager = require('../lib_storage/s3Manager');
            const s3Manager = new S3Manager();
            
            // S3 키 생성
            const s3Key = `ent/uploads/${userID}_${sessionID}/sounds/${finalFileName}`;
            
            // MIME 타입 결정
            const mimeTypes = {
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.webm': 'audio/webm',
                '.m4a': 'audio/mp4'
            };
            const mimeType = mimeTypes[finalExt] || 'audio/mpeg';
            
            s3Url = await s3Manager.uploadProject(s3Key, audioBuffer, mimeType);
            
            console.log(`✅ S3 저장 완료: ${s3Url}`);
            
        } catch (s3Error) {
            console.error('⚠️ S3 저장 실패, 로컬 저장으로 폴백:', s3Error.message);
            
            // 로컬 저장
            const tempDir = '/var/www/html/temp/ent_files/current/sounds';
            await fs.mkdir(tempDir, { recursive: true });
            
            const localFilePath = path.join(tempDir, finalFileName);
            await fs.writeFile(localFilePath, audioBuffer);
            
            s3Url = `/entry/temp/sounds/${finalFileName}`;
            console.log(`✅ 로컬 저장 완료: ${s3Url}`);
        }
        
        res.json({
            success: true,
            filename: finalFileName,
            fileurl: s3Url,
            path: s3Url,
            ext: finalExt,
            duration: duration || 1,
            message: '편집된 소리 저장 성공'
        });
        
    } catch (error) {
        console.error('❌ 소리 저장 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// 📊 센터별 Entry 사용량 조회 API (교사/관리자용)
// =============================================================================

router.get('/api/center-usage', authenticateUser, async (req, res) => {
    try {
        const { role, centerID: sessionCenterId } = req.session;
        
        // 권한 체크
        if (!['admin', 'manager', 'teacher'].includes(role)) {
            return res.status(403).json({ 
                success: false, 
                error: '권한이 없습니다.' 
            });
        }

        const db = require('../lib_login/db');
        
        // admin은 모든 센터, 나머지는 자기 센터만
        let query, params;
        
        if (role === 'admin') {
            query = `
                SELECT 
                    ps.center_id,
                    COUNT(*) as project_count,
                    SUM(ps.file_size_kb) as total_size_kb,
                    COUNT(DISTINCT ps.user_id) as user_count,
                    MAX(ps.created_at) as last_upload
                FROM ProjectSubmissions ps
                WHERE ps.platform = 'entry'
                  AND (ps.is_deleted = FALSE OR ps.is_deleted IS NULL)
                GROUP BY ps.center_id
            `;
            params = [];
        } else {
            query = `
                SELECT 
                    ps.center_id,
                    COUNT(*) as project_count,
                    SUM(ps.file_size_kb) as total_size_kb,
                    COUNT(DISTINCT ps.user_id) as user_count,
                    MAX(ps.created_at) as last_upload
                FROM ProjectSubmissions ps
                WHERE ps.center_id = ? 
                  AND ps.platform = 'entry'
                  AND (ps.is_deleted = FALSE OR ps.is_deleted IS NULL)
                GROUP BY ps.center_id
            `;
            params = [sessionCenterId];
        }
        
        const results = await db.queryDatabase(query, params);
        
        // 포맷팅 함수
        const formatSize = (bytes) => {
            if (!bytes) return '0 B';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        };
        
        res.json({
            success: true,
            centerUsage: results.map(r => ({
                centerId: r.center_id,
                projectCount: r.project_count || 0,
                totalSizeKb: r.total_size_kb || 0,
                totalSizeFormatted: formatSize((r.total_size_kb || 0) * 1024),
                userCount: r.user_count || 0,
                lastUpload: r.last_upload
            }))
        });

    } catch (error) {
        console.error('❌ [센터별 사용량] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// =============================================================================
// 📊 사용자 저장공간 사용량 요약 (본인용)
// =============================================================================

router.get('/api/storage-usage', authenticateUser, async (req, res) => {
    try {
        const userID = req.session.userID;
        
        const db = require('../lib_login/db');
        const quotaChecker = require('../lib_storage/quotaChecker');
        
        // 사용자 DB ID 조회
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?', 
            [userID]
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }
        
        // Entry 프로젝트 통계 (삭제되지 않은 것만)
        const [entryStats] = await db.queryDatabase(`
            SELECT 
                COUNT(*) as project_count,
                COALESCE(SUM(file_size_kb), 0) as total_size_kb
            FROM ProjectSubmissions 
            WHERE user_id = ? 
              AND platform = 'entry'
              AND (is_deleted = FALSE OR is_deleted IS NULL)
        `, [user.id]);
        
        // 전체 사용량 (모든 플랫폼)
        let totalUsage = { total_usage: 0 };
        try {
            totalUsage = await quotaChecker.getUserStorageUsage(user.id);
        } catch (e) {
            console.warn('용량 조회 실패:', e.message);
        }
        
        // 제한 용량 조회
        let limit = 500 * 1024 * 1024; // 기본 500MB
        try {
            limit = await quotaChecker.getUserStorageLimit(user.id, user.centerID);
        } catch (e) {
            console.warn('제한 조회 실패:', e.message);
        }
        
        const formatSize = (bytes) => {
            if (!bytes) return '0 B';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        };
        
        const totalBytes = totalUsage.total_usage || 0;
        const usagePercent = limit > 0 ? Math.round((totalBytes / limit) * 100) : 0;
        
        res.json({
            success: true,
            usage: {
                entry: {
                    projectCount: entryStats.project_count || 0,
                    sizeKb: entryStats.total_size_kb || 0,
                    sizeFormatted: formatSize((entryStats.total_size_kb || 0) * 1024)
                },
                total: {
                    bytes: totalBytes,
                    formatted: formatSize(totalBytes),
                    limit: limit,
                    limitFormatted: formatSize(limit),
                    percent: usagePercent
                }
            }
        });

    } catch (error) {
        console.error('❌ [사용량 조회] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
