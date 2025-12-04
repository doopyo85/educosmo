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

router.post('/api/save-project', authenticateUser, async (req, res) => {
    const { projectData, fileName } = req.body;
    const userID = req.session.userID;

    if (!projectData || !fileName) {
        return res.status(400).json({
            success: false,
            error: '프로젝트 데이터와 파일명이 필요합니다.'
        });
    }

    res.json({
        success: true,
        fileName: fileName,
        fileUrl: `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/ent/projects/${userID}/${fileName}`,
        message: `프로젝트 ${fileName} 저장 (구현 예정)`
    });
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
        
        if (!userID) {
            return res.status(400).json({ 
                success: false, 
                error: '사용자 ID가 필요합니다.' 
            });
        }

        console.log(`📂 [불러오기] 사용자 프로젝트 조회 요청: ${userID}`);

        const db = require('../lib_login/db');

        // 🔥 수정: user_id를 Users 테이블에서 먼저 조회
        const userQuery = 'SELECT id FROM Users WHERE userID = ?';
        const [user] = await db.queryDatabase(userQuery, [userID]);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }

        const userId = user.id;

        // 🔥 수정: 파라미터 3개 모두 제공 (user_id, platform, LIMIT)
        const query = `
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
                metadata,
                created_at,
                updated_at
            FROM ProjectSubmissions
            WHERE user_id = ?
              AND platform = ?
            ORDER BY created_at DESC 
            LIMIT ?
        `;

        // 🔥 중요: 파라미터 배열에 3개 값 모두 전달
        const projects = await db.queryDatabase(query, [
            userId,           // user_id
            'entry',          // platform (Entry 프로젝트만 조회)
            50                // LIMIT (최대 50개)
        ]);

        console.log(`✅ [불러오기] ${projects.length}개 프로젝트 조회 성공`);

        res.json({
            success: true,
            projects: projects.map(p => ({
                id: p.id,
                projectName: p.project_name,
                saveType: p.save_type,
                s3Url: p.s3_url,
                s3Key: p.s3_key,
                fileSizeKb: p.file_size_kb,
                blocksCount: p.blocks_count,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                metadata: p.metadata ? JSON.parse(p.metadata) : null
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

module.exports = router;
