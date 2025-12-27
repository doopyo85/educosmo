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
// 🔥 프로젝트 저장 API (병렬 저장 모델: UserFiles + ProjectSubmissions)
// =============================================================================

router.post('/api/save-project', authenticateUser, async (req, res) => {
    try {
        const { projectData, projectName, userID: clientUserID, centerID: clientCenterID, isUpdate, projectId, userFileId, saveType, thumbnailBase64 } = req.body;
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
        const parallelSave = require('../lib_storage/parallelSave');
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

        console.log('💾 [Entry 저장] 요청:', {
            userID,
            projectName,
            isUpdate,
            projectId,
            saveType: actualSaveType
        });

        // 2. 프로젝트 데이터 → JSON → Buffer
        const projectJson = JSON.stringify(projectData);
        const projectBuffer = Buffer.from(projectJson, 'utf8');
        const fileSize = projectBuffer.length;

        console.log(`📊 파일 크기: ${(fileSize / 1024).toFixed(2)} KB`);

        // 3. 🔥 용량 체크 (자동저장 제외, projects/submitted만)
        if (actualSaveType !== 'autosave') {
            let oldFileSize = 0;
            if (isUpdate && projectId) {
                const [oldProject] = await db.queryDatabase(
                    'SELECT file_size_kb FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
                    [projectId, userId]
                );
                if (oldProject) {
                    oldFileSize = (oldProject.file_size_kb || 0) * 1024;
                }
            }

            const netFileSize = fileSize - oldFileSize;

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

        // 5-1. 썸네일 업로드 (있는 경우)
        let thumbnailUrl = null;
        if (thumbnailBase64) {
            try {
                const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
                const thumbnailBuffer = Buffer.from(base64Data, 'base64');
                const thumbKey = `users/${userID}/entry/${actualSaveType}/thumbnails/${safeName}_${timestamp}.png`;
                thumbnailUrl = await s3Manager.uploadProject(thumbKey, thumbnailBuffer, 'image/png');
                console.log(`📸 썸네일 업로드 완료: ${thumbnailUrl}`);
            } catch (thumbError) {
                console.warn(`⚠️ 썸네일 업로드 실패 (무시하고 계속):`, thumbError.message);
            }
        }

        // 6. 프로젝트 분석
        const analysis = parallelSave.analyzeEntryProject(projectData);

        // 7. 🔥 병렬 저장 (UserFiles + ProjectSubmissions)
        let result;

        if (isUpdate && projectId) {
            // 덮어쓰기
            result = await parallelSave.updateProjectParallel({
                userId,
                centerId,
                platform: 'entry',
                projectId,
                userFileId,
                projectName: projectName || 'Untitled',
                s3Url,
                s3Key,
                fileSize,
                mimeType: 'application/json',
                thumbnailUrl,
                analysis
            });
        } else {
            // 새 저장 (autosave 포함)
            result = await parallelSave.saveProjectParallel({
                userId,
                centerId,
                platform: 'entry',
                projectName: projectName || 'Untitled',
                saveType: actualSaveType,
                s3Url,
                s3Key,
                fileSize,
                mimeType: 'application/json',
                thumbnailUrl,
                analysis
            });
        }

        res.json({
            success: true,
            projectId: result.submissionId || result.projectId,
            fileId: result.userFileId || null,
            userFileId: result.userFileId || null,
            fileName: fileName,
            s3Url: s3Url,
            s3Key: s3Key,
            fileSize: fileSize,
            fileSizeKb: Math.ceil(fileSize / 1024),
            thumbnailUrl: thumbnailUrl,
            message: isUpdate ? '프로젝트가 업데이트되었습니다.' : '프로젝트가 저장되었습니다.'
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
// 🔥 프로젝트 삭제 API (병렬 삭제 모델: UserFiles + ProjectSubmissions)
// =============================================================================

router.delete('/api/project/:projectId', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { permanent, userFileId } = req.query;
        const userID = req.session.userID;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: '프로젝트 ID가 필요합니다.'
            });
        }

        console.log(`🗑️ [Entry 삭제] 요청: projectId=${projectId}, userID=${userID}, permanent=${permanent}`);

        const db = require('../lib_login/db');
        const parallelSave = require('../lib_storage/parallelSave');

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

        // 2. 🔥 병렬 삭제 (UserFiles + ProjectSubmissions)
        const result = await parallelSave.deleteProjectParallel({
            userId,
            centerId,
            platform: 'entry',
            projectId: parseInt(projectId),
            userFileId: userFileId ? parseInt(userFileId) : null,
            permanent: permanent === 'true'
        });

        res.json({
            success: true,
            message: result.deleteType === 'permanent'
                ? '프로젝트가 완전히 삭제되었습니다.'
                : '프로젝트가 휴지통으로 이동되었습니다.',
            deletedId: projectId,
            freedSpace: result.freedSpace,
            deleteType: result.deleteType
        });

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
                thumbnailUrl: p.thumbnail_url || null,  // 🔥 DB에서 실제 썸네일 URL 반환
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
// 🌐 갤러리 공유 기능 API
// =============================================================================

// 📌 공유 상태 조회
router.get('/api/project/:projectId/status', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userID = req.session.userID;

        const db = require('../lib_login/db');

        // 사용자 DB ID 조회
        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );

        if (!user) {
            return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
        }

        // 프로젝트 조회 (본인 프로젝트만)
        const [project] = await db.queryDatabase(
            `SELECT id, is_public, shared_at, view_count, like_count 
             FROM ProjectSubmissions 
             WHERE id = ? AND user_id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)`,
            [projectId, user.id]
        );

        if (!project) {
            return res.status(404).json({ success: false, error: '프로젝트를 찾을 수 없습니다.' });
        }

        res.json({
            success: true,
            projectId: project.id,
            isPublic: project.is_public || false,
            sharedAt: project.shared_at,
            viewCount: project.view_count || 0,
            likeCount: project.like_count || 0
        });

    } catch (error) {
        console.error('❌ [공유 상태 조회] 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📌 공유 토글 (공개/비공개 전환)
router.put('/api/share/:projectId', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userID = req.session.userID;

        const db = require('../lib_login/db');

        // 사용자 DB ID 조회
        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );

        if (!user) {
            return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
        }

        // 프로젝트 조회 (본인 프로젝트만)
        const [project] = await db.queryDatabase(
            `SELECT id, is_public, project_name 
             FROM ProjectSubmissions 
             WHERE id = ? AND user_id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)`,
            [projectId, user.id]
        );

        if (!project) {
            return res.status(404).json({ success: false, error: '프로젝트를 찾을 수 없습니다.' });
        }

        // 현재 상태 반전
        const currentPublic = project.is_public || false;
        const newPublic = !currentPublic;

        // 상태 업데이트
        await db.queryDatabase(
            `UPDATE ProjectSubmissions 
             SET is_public = ?, 
                 shared_at = ${newPublic ? 'NOW()' : 'NULL'}
             WHERE id = ?`,
            [newPublic, projectId]
        );

        console.log(`🌐 [갤러리 공유] ${newPublic ? '공개' : '비공개'} 전환: ${project.project_name} (ID: ${projectId})`);

        res.json({
            success: true,
            message: newPublic ? '갤러리에 공개되었습니다.' : '갤러리에서 비공개로 전환되었습니다.',
            projectId: projectId,
            isPublic: newPublic,
            sharedAt: newPublic ? new Date().toISOString() : null
        });

    } catch (error) {
        console.error('❌ [공유 토글] 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📌 갤러리 목록 조회 (공개 프로젝트)
router.get('/api/gallery', async (req, res) => {
    try {
        const { page = 1, limit = 20, userId, category, sort = 'recent' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const db = require('../lib_login/db');

        // 기본 쿼리 - Entry 플랫폼의 공개 프로젝트만
        let whereClause = `ps.platform = 'entry' AND ps.is_public = TRUE AND (ps.is_deleted = FALSE OR ps.is_deleted IS NULL)`;
        const params = [];

        // userId 필터 (특정 사용자의 프로젝트만)
        if (userId) {
            whereClause += ` AND u.userID = ?`;
            params.push(userId);
        }

        // save_type 필터 (autosave 제외, projects만)
        whereClause += ` AND ps.save_type = 'projects'`;

        // 정렬 옵션
        let orderClause = 'ps.shared_at DESC'; // 기본: 최신 공유순
        if (sort === 'views') {
            orderClause = 'ps.view_count DESC, ps.shared_at DESC';
        } else if (sort === 'likes') {
            orderClause = 'ps.like_count DESC, ps.shared_at DESC';
        }

        // 전체 개수 조회
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM ProjectSubmissions ps
            JOIN Users u ON ps.user_id = u.id
            WHERE ${whereClause}
        `;
        const [countResult] = await db.queryDatabase(countQuery, params);
        const totalCount = countResult?.total || 0;

        // 프로젝트 목록 조회
        const listQuery = `
            SELECT 
                ps.id,
                ps.project_name,
                ps.thumbnail_url,
                ps.s3_url,
                ps.file_size_kb,
                ps.blocks_count,
                ps.sprites_count,
                ps.view_count,
                ps.like_count,
                ps.shared_at,
                ps.created_at,
                u.userID as author_id,
                u.name as author_name,
                u.profile_image as author_profile
            FROM ProjectSubmissions ps
            JOIN Users u ON ps.user_id = u.id
            WHERE ${whereClause}
            ORDER BY ${orderClause}
            LIMIT ? OFFSET ?
        `;

        const projects = await db.queryDatabase(listQuery, [...params, parseInt(limit), offset]);

        res.json({
            success: true,
            data: {
                projects: projects.map(p => ({
                    id: p.id,
                    projectName: p.project_name,
                    thumbnailUrl: p.thumbnail_url,
                    s3Url: p.s3_url,
                    fileSizeKb: p.file_size_kb,
                    blocksCount: p.blocks_count,
                    spritesCount: p.sprites_count,
                    viewCount: p.view_count || 0,
                    likeCount: p.like_count || 0,
                    sharedAt: p.shared_at,
                    createdAt: p.created_at,
                    author: {
                        id: p.author_id,
                        name: p.author_name || p.author_id,
                        profileImage: p.author_profile
                    }
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('❌ [갤러리 목록] 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📌 조회수 증가
router.post('/api/gallery/:projectId/view', async (req, res) => {
    try {
        const { projectId } = req.params;

        const db = require('../lib_login/db');

        // 공개 프로젝트인지 확인 후 조회수 증가
        const result = await db.queryDatabase(
            `UPDATE ProjectSubmissions 
             SET view_count = COALESCE(view_count, 0) + 1
             WHERE id = ? AND is_public = TRUE AND (is_deleted = FALSE OR is_deleted IS NULL)`,
            [projectId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: '프로젝트를 찾을 수 없습니다.' });
        }

        res.json({ success: true, message: '조회수가 증가했습니다.' });

    } catch (error) {
        console.error('❌ [조회수 증가] 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📌 갤러리 공개 유저 목록
router.get('/api/gallery/users', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const db = require('../lib_login/db');

        // 공개 프로젝트가 있는 유저 목록
        const query = `
            SELECT 
                u.userID,
                u.name,
                u.profile_image,
                COUNT(ps.id) as project_count,
                SUM(COALESCE(ps.view_count, 0)) as total_views,
                MAX(ps.shared_at) as last_shared
            FROM Users u
            JOIN ProjectSubmissions ps ON u.id = ps.user_id
            WHERE ps.platform = 'entry' 
              AND ps.is_public = TRUE 
              AND ps.save_type = 'projects'
              AND (ps.is_deleted = FALSE OR ps.is_deleted IS NULL)
            GROUP BY u.id, u.userID, u.name, u.profile_image
            HAVING project_count > 0
            ORDER BY total_views DESC, project_count DESC
            LIMIT ? OFFSET ?
        `;

        const users = await db.queryDatabase(query, [parseInt(limit), offset]);

        res.json({
            success: true,
            data: {
                users: users.map(u => ({
                    userId: u.userID,
                    name: u.name || u.userID,
                    profileImage: u.profile_image,
                    projectCount: u.project_count,
                    totalViews: u.total_views || 0,
                    lastShared: u.last_shared
                }))
            }
        });

    } catch (error) {
        console.error('❌ [갤러리 유저 목록] 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📌 특정 유저의 공개 프로젝트 목록
router.get('/api/gallery/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const db = require('../lib_login/db');

        // 유저 정보 조회
        const [user] = await db.queryDatabase(
            'SELECT id, userID, name, profile_image FROM Users WHERE userID = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
        }

        // 해당 유저의 공개 프로젝트 목록
        const projects = await db.queryDatabase(`
            SELECT 
                id, project_name, thumbnail_url, s3_url, file_size_kb,
                blocks_count, sprites_count, view_count, like_count,
                shared_at, created_at
            FROM ProjectSubmissions
            WHERE user_id = ? 
              AND platform = 'entry' 
              AND is_public = TRUE 
              AND save_type = 'projects'
              AND (is_deleted = FALSE OR is_deleted IS NULL)
            ORDER BY shared_at DESC
            LIMIT ? OFFSET ?
        `, [user.id, parseInt(limit), offset]);

        // 총 개수
        const [countResult] = await db.queryDatabase(`
            SELECT COUNT(*) as total FROM ProjectSubmissions
            WHERE user_id = ? AND platform = 'entry' AND is_public = TRUE 
              AND save_type = 'projects' AND (is_deleted = FALSE OR is_deleted IS NULL)
        `, [user.id]);

        res.json({
            success: true,
            data: {
                user: {
                    userId: user.userID,
                    name: user.name || user.userID,
                    profileImage: user.profile_image
                },
                projects: projects.map(p => ({
                    id: p.id,
                    projectName: p.project_name,
                    thumbnailUrl: p.thumbnail_url,
                    s3Url: p.s3_url,
                    fileSizeKb: p.file_size_kb,
                    blocksCount: p.blocks_count,
                    spritesCount: p.sprites_count,
                    viewCount: p.view_count || 0,
                    likeCount: p.like_count || 0,
                    sharedAt: p.shared_at,
                    createdAt: p.created_at
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult?.total || 0,
                    totalPages: Math.ceil((countResult?.total || 0) / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('❌ [유저 갤러리] 오류:', error);
        res.status(500).json({ success: false, error: error.message });
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
