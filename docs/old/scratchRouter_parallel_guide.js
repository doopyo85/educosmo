/**
 * scratchRouter.js 병렬 모델 적용 가이드
 * ==========================================
 * 
 * 적용 위치: routes/scratchRouter.js (또는 Scratch GUI 백엔드)
 * 
 * 기존: UserFiles만 저장
 * 변경: UserFiles + ProjectSubmissions 동시 저장 (병렬 모델)
 */

// ==========================================
// 1. 상단에 모듈 import 추가
// ==========================================
const { 
    saveProjectParallel, 
    analyzeScratchProject,
    SUBMISSION_TYPES 
} = require('../lib_storage/parallelSave');


// ==========================================
// 2. 프로젝트 저장 라우트 수정 예시
// ==========================================

/**
 * [기존 코드 예시 - UserFiles만 저장]
 * 
 * router.post('/api/projects/save', async (req, res) => {
 *     // S3 업로드
 *     const s3Result = await s3Manager.uploadFile(...);
 *     
 *     // UserFiles만 저장 (quotaChecker)
 *     await recordFile(userId, centerId, {
 *         file_category: 'scratch',
 *         ...
 *     });
 * });
 */

/**
 * [병렬 모델 적용 코드]
 */
router.post('/api/projects/save', async (req, res) => {
    try {
        const userID = req.session.userID;
        const { projectName, projectData } = req.body;
        
        // 1. 사용자 정보 조회
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(401).json({ success: false, message: '로그인 필요' });
        }
        
        // 2. SB3 파일 생성 및 S3 업로드
        const sb3Buffer = await createSB3Buffer(projectData);  // 기존 함수 사용
        const fileName = `${projectName}_${Date.now()}.sb3`;
        const s3Key = `users/${user.id}/scratch/projects/${fileName}`;
        
        const s3Result = await s3Manager.uploadFile({
            bucket: process.env.S3_BUCKET,
            key: s3Key,
            body: sb3Buffer,
            contentType: 'application/x-scratch'
        });
        
        // 3. 프로젝트 분석 (블록 수, 스프라이트 수 등)
        let analysisData = {};
        try {
            // SB3 내부의 project.json 파싱
            const projectJson = JSON.parse(projectData);
            analysisData = analyzeScratchProject(projectJson);
        } catch (e) {
            console.warn('Scratch 프로젝트 분석 실패:', e.message);
        }
        
        // 4. 🔥 병렬 저장 실행 (핵심!)
        const saveResult = await saveProjectParallel({
            userId: user.id,
            centerId: user.centerID,
            platform: 'scratch',
            projectName: projectName,
            s3FilePath: s3Key,
            s3Url: s3Result.Location,
            fileSize: sb3Buffer.length,
            fileType: 'application/x-scratch',
            originalName: fileName,
            submissionType: SUBMISSION_TYPES.PROJECTS,
            thumbnailUrl: null,  // 썸네일 (있다면)
            contentMapId: null,  // 학습 콘텐츠 ID (있다면)
            analysisData: analysisData
        });
        
        // 5. 응답
        if (saveResult.success) {
            res.json({
                success: true,
                message: '프로젝트 저장 완료',
                projectId: saveResult.submissionId,
                fileId: saveResult.userFileId,
                url: s3Result.Location
            });
        } else {
            res.status(500).json({
                success: false,
                message: '저장 실패',
                errors: saveResult.errors
            });
        }
        
    } catch (error) {
        console.error('[Scratch Save Error]', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ==========================================
// 3. 프로젝트 목록 조회 (병렬 모델용)
// ==========================================
router.get('/api/projects', async (req, res) => {
    try {
        const userID = req.session.userID;
        
        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(401).json({ success: false });
        }
        
        // ProjectSubmissions에서 조회 (학습 데이터 포함)
        const projects = await db.queryDatabase(
            `SELECT 
                ps.id,
                ps.project_name,
                ps.s3_file_path,
                ps.thumbnail_url,
                ps.blocks_count,
                ps.sprites_count,
                ps.variables_count,
                ps.complexity_score,
                ps.submitted_at,
                ps.is_shared,
                uf.file_size
             FROM ProjectSubmissions ps
             LEFT JOIN UserFiles uf ON uf.user_id = ps.user_id 
                AND uf.stored_name = ps.s3_file_path
                AND uf.is_deleted = 0
             WHERE ps.user_id = ? AND ps.platform = 'scratch'
               AND ps.submission_type IN ('projects', 'submitted')
             ORDER BY ps.submitted_at DESC`,
            [user.id]
        );
        
        res.json({ success: true, projects });
        
    } catch (error) {
        console.error('[Scratch Projects Error]', error);
        res.status(500).json({ success: false });
    }
});


// ==========================================
// 4. 프로젝트 삭제 (병렬 모델용)
// ==========================================
router.delete('/api/projects/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        const userID = req.session.userID;
        
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?',
            [userID]
        );
        
        // 프로젝트 소유권 확인
        const [project] = await db.queryDatabase(
            'SELECT * FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
            [projectId, user.id]
        );
        
        if (!project) {
            return res.status(404).json({ success: false, message: '프로젝트 없음' });
        }
        
        // 병렬 삭제
        const { deleteProjectParallel } = require('../lib_storage/parallelSave');
        await deleteProjectParallel(user.id, 'scratch', project.s3_file_path);
        
        // S3에서도 삭제 (선택)
        // await s3Manager.deleteFile(project.s3_file_path);
        
        res.json({ success: true, message: '프로젝트 삭제 완료' });
        
    } catch (error) {
        console.error('[Scratch Delete Error]', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ==========================================
// 5. 갤러리 조회 (공유된 프로젝트)
// ==========================================
router.get('/api/gallery', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        // is_shared = 1인 프로젝트만 조회
        const projects = await db.queryDatabase(
            `SELECT 
                ps.id,
                ps.project_name,
                ps.thumbnail_url,
                ps.blocks_count,
                ps.sprites_count,
                ps.submitted_at,
                u.userID as author,
                u.profile_image as author_image
             FROM ProjectSubmissions ps
             JOIN Users u ON ps.user_id = u.id
             WHERE ps.platform = 'scratch' 
               AND ps.is_shared = 1
               AND ps.submission_type = 'submitted'
             ORDER BY ps.submitted_at DESC
             LIMIT ? OFFSET ?`,
            [parseInt(limit), offset]
        );
        
        // 전체 개수
        const [countResult] = await db.queryDatabase(
            `SELECT COUNT(*) as total FROM ProjectSubmissions 
             WHERE platform = 'scratch' AND is_shared = 1`
        );
        
        res.json({
            success: true,
            projects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / limit)
            }
        });
        
    } catch (error) {
        console.error('[Scratch Gallery Error]', error);
        res.status(500).json({ success: false });
    }
});


// ==========================================
// 6. 썸네일 생성 및 업로드 (선택)
// ==========================================
async function generateAndUploadThumbnail(userId, projectName, svgData) {
    try {
        if (!svgData) return null;
        
        // SVG를 PNG로 변환 (sharp 라이브러리 사용)
        const sharp = require('sharp');
        const pngBuffer = await sharp(Buffer.from(svgData))
            .resize(200, 150)
            .png()
            .toBuffer();
        
        const thumbnailKey = `users/${userId}/scratch/thumbnails/${projectName}_${Date.now()}.png`;
        
        const result = await s3Manager.uploadFile({
            bucket: process.env.S3_BUCKET,
            key: thumbnailKey,
            body: pngBuffer,
            contentType: 'image/png'
        });
        
        return result.Location;
    } catch (error) {
        console.error('썸네일 생성 실패:', error);
        return null;
    }
}
