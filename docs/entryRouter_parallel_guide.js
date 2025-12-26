/**
 * entryRouter.js 병렬 모델 적용 가이드
 * ==========================================
 * 
 * 적용 위치: routes/entryRouter.js
 * 
 * 기존: ProjectSubmissions만 저장
 * 변경: UserFiles + ProjectSubmissions 동시 저장 (병렬 모델)
 */

// ==========================================
// 1. 상단에 모듈 import 추가
// ==========================================
const { 
    saveProjectParallel, 
    analyzeEntryProject,
    SUBMISSION_TYPES 
} = require('../lib_storage/parallelSave');


// ==========================================
// 2. 프로젝트 저장 라우트 수정 예시
// ==========================================

/**
 * [기존 코드 예시]
 * 
 * router.post('/api/save', async (req, res) => {
 *     const { projectData, projectName } = req.body;
 *     
 *     // S3 업로드
 *     const s3Result = await uploadToS3(projectData);
 *     
 *     // ProjectSubmissions만 저장
 *     await db.queryDatabase(
 *         'INSERT INTO ProjectSubmissions ...',
 *         [...]
 *     );
 * });
 */

/**
 * [병렬 모델 적용 코드]
 */
router.post('/api/save', async (req, res) => {
    try {
        const { projectData, projectName, submissionType } = req.body;
        const userID = req.session.userID;
        
        // 1. 사용자 정보 조회
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(401).json({ success: false, message: '로그인 필요' });
        }
        
        // 2. ENT 파일 생성 및 S3 업로드
        const entBuffer = Buffer.from(JSON.stringify(projectData));
        const fileName = `${projectName}_${Date.now()}.ent`;
        const s3Key = `users/${user.id}/entry/projects/${fileName}`;
        
        const s3Result = await uploadToS3({
            bucket: process.env.S3_BUCKET,
            key: s3Key,
            body: entBuffer,
            contentType: 'application/json'
        });
        
        // 3. 프로젝트 분석 (블록 수, 스프라이트 수 등)
        const analysisData = analyzeEntryProject(projectData);
        
        // 4. 🔥 병렬 저장 실행 (핵심!)
        const saveResult = await saveProjectParallel({
            userId: user.id,
            centerId: user.centerID,
            platform: 'entry',
            projectName: projectName,
            s3FilePath: s3Key,
            s3Url: s3Result.Location,
            fileSize: entBuffer.length,
            fileType: 'application/json',
            originalName: fileName,
            submissionType: submissionType || SUBMISSION_TYPES.PROJECTS,
            thumbnailUrl: null,  // 썸네일 URL (있다면)
            contentMapId: null,  // 학습 콘텐츠 ID (있다면)
            analysisData: analysisData
        });
        
        // 5. 응답
        if (saveResult.success) {
            res.json({
                success: true,
                message: '프로젝트 저장 완료',
                data: {
                    userFileId: saveResult.userFileId,
                    submissionId: saveResult.submissionId,
                    s3Url: s3Result.Location
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: '저장 실패',
                errors: saveResult.errors
            });
        }
        
    } catch (error) {
        console.error('[Entry Save Error]', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ==========================================
// 3. 자동저장 라우트 (3분 간격)
// ==========================================
router.post('/api/autosave', async (req, res) => {
    try {
        const { projectData, projectName } = req.body;
        const userID = req.session.userID;
        
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(401).json({ success: false });
        }
        
        // 자동저장은 UserFiles에는 저장하지 않음 (용량 관리 제외)
        // ProjectSubmissions에만 autosave 타입으로 저장
        const entBuffer = Buffer.from(JSON.stringify(projectData));
        const fileName = `autosave_${projectName}_${Date.now()}.ent`;
        const s3Key = `users/${user.id}/entry/autosave/${fileName}`;
        
        const s3Result = await uploadToS3({
            bucket: process.env.S3_BUCKET,
            key: s3Key,
            body: entBuffer,
            contentType: 'application/json'
        });
        
        // ProjectSubmissions만 저장 (autosave)
        await db.queryDatabase(
            `INSERT INTO ProjectSubmissions 
             (user_id, platform, project_name, submission_type, s3_file_path, 
              file_size_kb, submitted_at)
             VALUES (?, 'entry', ?, 'autosave', ?, ?, NOW())`,
            [user.id, projectName, s3Key, Math.round(entBuffer.length / 1024)]
        );
        
        res.json({ success: true, message: '자동저장 완료' });
        
    } catch (error) {
        console.error('[Entry Autosave Error]', error);
        res.status(500).json({ success: false });
    }
});


// ==========================================
// 4. 갤러리 공유 라우트
// ==========================================
router.post('/api/share-to-gallery', async (req, res) => {
    try {
        const { submissionId } = req.body;
        const userID = req.session.userID;
        
        // 권한 확인
        const [submission] = await db.queryDatabase(
            `SELECT ps.*, u.userID 
             FROM ProjectSubmissions ps
             JOIN Users u ON ps.user_id = u.id
             WHERE ps.id = ?`,
            [submissionId]
        );
        
        if (!submission || submission.userID !== userID) {
            return res.status(403).json({ success: false, message: '권한 없음' });
        }
        
        // is_shared 플래그 업데이트
        await db.queryDatabase(
            'UPDATE ProjectSubmissions SET is_shared = 1 WHERE id = ?',
            [submissionId]
        );
        
        res.json({ success: true, message: '갤러리에 공유되었습니다' });
        
    } catch (error) {
        console.error('[Entry Share Error]', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ==========================================
// 5. 내 작품 목록 조회 (병렬 모델용)
// ==========================================
router.get('/api/my-projects', async (req, res) => {
    try {
        const userID = req.session.userID;
        
        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(401).json({ success: false });
        }
        
        // ProjectSubmissions에서 조회 (autosave 제외)
        const projects = await db.queryDatabase(
            `SELECT id, project_name, s3_file_path, thumbnail_url,
                    blocks_count, sprites_count, complexity_score,
                    submitted_at, is_shared
             FROM ProjectSubmissions
             WHERE user_id = ? AND platform = 'entry' 
               AND submission_type IN ('projects', 'submitted')
             ORDER BY submitted_at DESC`,
            [user.id]
        );
        
        res.json({ success: true, projects });
        
    } catch (error) {
        console.error('[Entry Projects Error]', error);
        res.status(500).json({ success: false });
    }
});
