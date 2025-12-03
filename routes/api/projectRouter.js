const express = require('express');
const router = express.Router();
const ProjectManager = require('../../lib_project/ProjectManager');
const { authenticateUser } = require('../../lib_login/authMiddleware');
const db = require('../../lib_login/db');

/**
 * 🔥 통합 프로젝트 저장 API
 * POST /api/projects/save
 */
router.post('/save', authenticateUser, async (req, res) => {
    try {
        const {
            platform,        // 'entry', 'scratch', 'appinventor' 등
            projectName,     // 프로젝트명
            projectData,     // 플랫폼별 프로젝트 데이터
            saveType,        // 'draft', 'final', 'autosave'
            metadata         // 플랫폼별 추가 정보
        } = req.body;

        // 필수 파라미터 검증
        if (!platform || !projectName || !projectData) {
            return res.status(400).json({
                success: false,
                error: '필수 파라미터가 누락되었습니다. (platform, projectName, projectData)'
            });
        }

        const userId = req.session.userID;
        const centerId = req.session.centerID;

        console.log(`\n📥 프로젝트 저장 요청: ${projectName} (${platform}) by ${userId}`);

        // 공통 매니저로 처리
        const projectManager = new ProjectManager();
        const result = await projectManager.saveProject({
            platform,
            projectName,
            projectData,
            saveType: saveType || 'draft',
            userId,
            centerId,
            metadata: metadata || {}
        });

        console.log(`✅ 저장 완료: submission_id=${result.submissionId}\n`);

        res.json(result);
        
    } catch (error) {
        console.error('❌ 프로젝트 저장 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🔥 프로젝트 제출 API
 * POST /api/projects/submit
 */
router.post('/submit', authenticateUser, async (req, res) => {
    try {
        const {
            platform,
            projectName,
            projectData,
            metadata
        } = req.body;

        if (!platform || !projectName || !projectData) {
            return res.status(400).json({
                success: false,
                error: '필수 파라미터가 누락되었습니다.'
            });
        }

        const userId = req.session.userID;
        const centerId = req.session.centerID;

        console.log(`\n📤 프로젝트 제출 요청: ${projectName} (${platform}) by ${userId}`);

        const projectManager = new ProjectManager();
        const result = await projectManager.saveProject({
            platform,
            projectName,
            projectData,
            saveType: 'final',  // 제출은 항상 final
            userId,
            centerId,
            metadata: metadata || {}
        });

        console.log(`✅ 제출 완료: submission_id=${result.submissionId}\n`);

        res.json(result);
        
    } catch (error) {
        console.error('❌ 프로젝트 제출 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🔥 프로젝트 목록 조회
 * GET /api/projects/list?platform=entry&saveType=draft
 */
router.get('/list', authenticateUser, async (req, res) => {
    try {
        const { platform, saveType, limit } = req.query;
        const userId = req.session.userID;

        const projectManager = new ProjectManager();
        const projects = await projectManager.listProjects({
            userId,
            platform,
            saveType,
            limit: limit ? parseInt(limit) : 100
        });

        res.json({ 
            success: true, 
            projects,
            count: projects.length
        });
        
    } catch (error) {
        console.error('❌ 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🔥 프로젝트 메타데이터 조회 (S3 URL만)
 * GET /api/projects/:id/metadata
 */
router.get('/:id/metadata', authenticateUser, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const userId = req.session.userID;
        
        console.log(`📂 메타데이터 조회: projectId=${projectId}, userId=${userId}`);
        
        const [project] = await db.queryDatabase(
            `SELECT s3_url, s3_key, project_name 
             FROM ProjectSubmissions 
             WHERE id = ? AND user_id = (SELECT id FROM Users WHERE userID = ?)`,
            [projectId, userId]
        );
        
        if (!project) {
            console.warn(`⚠️ 프로젝트를 찾을 수 없음: ID ${projectId}`);
            return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
        }
        
        console.log(`✅ 메타데이터 반환:`, {
            s3Url: project.s3_url,
            projectName: project.project_name
        });
        
        res.json({
            s3Url: project.s3_url,
            s3Key: project.s3_key,
            projectName: project.project_name
        });
        
    } catch (error) {
        console.error('❌ 프로젝트 메타데이터 조회 실패:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

/**
 * 🔥 프로젝트 불러오기
 * GET /api/projects/load/:id
 */
router.get('/load/:id', authenticateUser, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const userId = req.session.userID;

        if (!projectId || isNaN(projectId)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 프로젝트 ID입니다.'
            });
        }

        const projectManager = new ProjectManager();
        const project = await projectManager.loadProject(projectId, userId);

        res.json({
            success: true,
            projectData: project.data,
            metadata: project.metadata,
            projectInfo: project.projectInfo
        });
        
    } catch (error) {
        console.error('❌ 불러오기 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🔥 프로젝트 삭제
 * DELETE /api/projects/:id
 */
router.delete('/:id', authenticateUser, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const userId = req.session.userID;

        if (!projectId || isNaN(projectId)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 프로젝트 ID입니다.'
            });
        }

        const projectManager = new ProjectManager();
        await projectManager.deleteProject(projectId, userId);

        res.json({ 
            success: true,
            message: '프로젝트가 삭제되었습니다.'
        });
        
    } catch (error) {
        console.error('❌ 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
