/**
 * 🎮 Scratch 프로젝트 관리 라우터
 * - 저장/불러오기/삭제 API
 * - ProjectSubmissions 테이블 사용 (platform='scratch')
 * - 자동저장 지원
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../lib_login/authMiddleware');
const db = require('../lib_login/db');

// =============================================================================
// 🔥 Scratch 프로젝트 저장 API
// =============================================================================

router.post('/api/save-project', authenticateUser, async (req, res) => {
    try {
        const { projectData, projectId, title, isNew, isCopy, isRemix, originalId, saveType, thumbnailBase64 } = req.body;
        const userID = req.session.userID;
        
        if (!projectData) {
            return res.status(400).json({
                success: false,
                error: '프로젝트 데이터가 필요합니다.'
            });
        }

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
        const centerId = user.centerID || req.session.centerID;
        const actualSaveType = saveType || (isNew ? 'projects' : 'autosave');
        const projectName = title || 'Untitled';

        console.log('💾 [Scratch 저장] 요청:', {
            userID,
            projectName,
            isNew,
            projectId,
            saveType: actualSaveType
        });

        // 2. 프로젝트 데이터 → JSON → Buffer
        const projectJson = JSON.stringify(projectData);
        const projectBuffer = Buffer.from(projectJson, 'utf8');
        const fileSize = projectBuffer.length;

        console.log(`📊 파일 크기: ${(fileSize / 1024).toFixed(2)} KB`);

        // 3. 🔥 자동저장 특별 처리: 기존 autosave 레코드가 있으면 UPDATE
        let effectiveIsUpdate = !isNew && projectId;
        let effectiveProjectId = projectId;

        if (actualSaveType === 'autosave') {
            const existingAutosave = await db.queryDatabase(
                `SELECT id, file_size_kb FROM ProjectSubmissions 
                 WHERE user_id = ? AND platform = 'scratch' AND save_type = 'autosave'
                   AND (is_deleted = FALSE OR is_deleted IS NULL)
                 ORDER BY updated_at DESC LIMIT 1`,
                [userId]
            );
            
            if (existingAutosave.length > 0) {
                effectiveIsUpdate = true;
                effectiveProjectId = existingAutosave[0].id;
                console.log(`🔄 [자동저장] 기존 autosave 발견 (ID: ${effectiveProjectId}), UPDATE 모드로 전환`);
            }
        }

        // 4. 용량 체크
        let oldFileSize = 0;
        if (effectiveIsUpdate && effectiveProjectId) {
            const [oldProject] = await db.queryDatabase(
                'SELECT file_size_kb FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
                [effectiveProjectId, userId]
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
                    message: canSave.message || '저장 공간이 부족합니다.'
                });
            }
        }

        // 5. S3 키 생성 및 업로드
        const timestamp = Date.now();
        const safeName = (projectName || 'project').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
        const fileName = `${safeName}_${timestamp}.sb3`;
        const s3Key = `users/${userID}/scratch/${actualSaveType}/${fileName}`;

        console.log(`📤 S3 업로드 시작: ${s3Key}`);

        const s3Url = await s3Manager.uploadProject(s3Key, projectBuffer, 'application/json');
        console.log(`✅ S3 업로드 완료: ${s3Url}`);

        // 6. 썸네일 업로드 (있는 경우)
        let thumbnailUrl = null;
        if (thumbnailBase64) {
            try {
                const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
                const thumbnailBuffer = Buffer.from(base64Data, 'base64');
                const thumbKey = `users/${userID}/scratch/${actualSaveType}/thumbnails/${safeName}_${timestamp}.png`;
                thumbnailUrl = await s3Manager.uploadProject(thumbKey, thumbnailBuffer, 'image/png');
                console.log(`📸 썸네일 업로드 완료: ${thumbnailUrl}`);
            } catch (thumbError) {
                console.warn(`⚠️ 썸네일 업로드 실패 (무시):`, thumbError.message);
            }
        }

        // 7. DB 저장
        let dbProjectId;
        
        // 프로젝트 분석
        const spritesCount = projectData.targets?.filter(t => !t.isStage).length || 0;
        const blocksCount = projectData.targets?.reduce((sum, target) => {
            return sum + Object.keys(target.blocks || {}).length;
        }, 0) || 0;

        if (effectiveIsUpdate && effectiveProjectId) {
            // UPDATE
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
                projectName,
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

            if (netFileSize !== 0) {
                if (netFileSize > 0) {
                    await quotaChecker.increaseUsage(userId, centerId, netFileSize, 'scratch');
                } else {
                    await quotaChecker.decreaseUsage(userId, centerId, Math.abs(netFileSize), 'scratch');
                }
            }
            
        } else {
            // INSERT
            const insertResult = await db.queryDatabase(`
                INSERT INTO ProjectSubmissions 
                (user_id, center_id, platform, project_name, save_type, s3_url, s3_key, file_size_kb, blocks_count, sprites_count, thumbnail_url, created_at, updated_at)
                VALUES (?, ?, 'scratch', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                userId,
                centerId,
                projectName,
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

            await quotaChecker.increaseUsage(userId, centerId, fileSize, 'scratch');
        }

        res.json({
            success: true,
            projectId: dbProjectId,
            id: dbProjectId,
            fileName: fileName,
            s3Url: s3Url,
            thumbnailUrl: thumbnailUrl,
            message: effectiveIsUpdate ? '프로젝트가 업데이트되었습니다.' : '프로젝트가 저장되었습니다.'
        });

    } catch (error) {
        console.error('❌ [Scratch 저장] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// PUT 메서드 지원 (기존 프로젝트 업데이트)
router.put('/api/save-project/:projectId', authenticateUser, async (req, res) => {
    req.body.projectId = req.params.projectId;
    req.body.isNew = false;
    // POST 핸들러로 전달
    router.handle(Object.assign({}, req, { method: 'POST', url: '/api/save-project' }), res);
});

// =============================================================================
// 🔥 Scratch 프로젝트 목록 조회 API
// =============================================================================

router.get('/api/user-projects', authenticateUser, async (req, res) => {
    try {
        const userID = req.session.userID;
        const { saveType } = req.query;

        console.log(`📂 [Scratch 불러오기] 프로젝트 목록 조회: ${userID}`);

        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?', 
            [userID]
        );

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }

        let query = `
            SELECT 
                id,
                project_name,
                save_type,
                s3_url,
                s3_key,
                file_size_kb,
                blocks_count,
                sprites_count,
                thumbnail_url,
                created_at,
                updated_at
            FROM ProjectSubmissions
            WHERE user_id = ?
              AND platform = 'scratch'
              AND (is_deleted = FALSE OR is_deleted IS NULL)
        `;
        
        const params = [user.id];
        
        if (saveType) {
            query += ` AND save_type = ?`;
            params.push(saveType);
        }
        
        query += ` ORDER BY updated_at DESC LIMIT 100`;

        const projects = await db.queryDatabase(query, params);

        const saveTypeCounts = projects.reduce((acc, p) => {
            const type = p.save_type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        console.log(`✅ [Scratch 불러오기] ${projects.length}개 프로젝트 조회됨`);

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
                thumbnailUrl: p.thumbnail_url || null
            }))
        });

    } catch (error) {
        console.error('❌ [Scratch 불러오기] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// =============================================================================
// 🔥 Scratch 프로젝트 삭제 API
// =============================================================================

router.delete('/api/project/:projectId', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { permanent } = req.query;
        const userID = req.session.userID;

        console.log(`🗑️ [Scratch 삭제] 요청: projectId=${projectId}, userID=${userID}`);

        const quotaChecker = require('../lib_storage/quotaChecker');
        const S3Manager = require('../lib_storage/s3Manager');
        const s3Manager = new S3Manager();

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

        const [project] = await db.queryDatabase(
            `SELECT id, s3_key, s3_url, file_size_kb 
             FROM ProjectSubmissions 
             WHERE id = ? AND user_id = ? AND platform = 'scratch' AND (is_deleted = FALSE OR is_deleted IS NULL)`,
            [projectId, user.id]
        );

        if (!project) {
            return res.status(404).json({ 
                success: false, 
                error: '프로젝트를 찾을 수 없습니다.' 
            });
        }

        const fileSize = (project.file_size_kb || 0) * 1024;

        if (permanent === 'true') {
            // 하드 삭제
            if (project.s3_key) {
                try {
                    await s3Manager.deleteProject(project.s3_key);
                    console.log(`✅ S3 파일 삭제: ${project.s3_key}`);
                } catch (s3Error) {
                    console.warn(`⚠️ S3 삭제 실패:`, s3Error.message);
                }
            }

            await db.queryDatabase(
                'DELETE FROM ProjectSubmissions WHERE id = ? AND user_id = ?',
                [projectId, user.id]
            );
        } else {
            // 소프트 삭제
            await db.queryDatabase(
                `UPDATE ProjectSubmissions 
                 SET is_deleted = TRUE, deleted_at = NOW() 
                 WHERE id = ? AND user_id = ?`,
                [projectId, user.id]
            );
        }

        if (fileSize > 0) {
            await quotaChecker.decreaseUsage(user.id, user.centerID, fileSize, 'scratch');
        }

        res.json({
            success: true,
            message: permanent === 'true' ? '완전히 삭제되었습니다.' : '휴지통으로 이동되었습니다.',
            deletedId: projectId,
            freedSpace: fileSize
        });

    } catch (error) {
        console.error('❌ [Scratch 삭제] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// =============================================================================
// 🔥 Scratch 프로젝트 불러오기 (S3에서 데이터 가져오기)
// =============================================================================

router.get('/api/load-project/:projectId', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userID = req.session.userID;

        console.log(`📂 [Scratch 로드] 프로젝트 로드: ${projectId}`);

        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?', 
            [userID]
        );

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }

        const [project] = await db.queryDatabase(
            `SELECT id, project_name, s3_url, s3_key 
             FROM ProjectSubmissions 
             WHERE id = ? AND user_id = ? AND platform = 'scratch' AND (is_deleted = FALSE OR is_deleted IS NULL)`,
            [projectId, user.id]
        );

        if (!project) {
            return res.status(404).json({ 
                success: false, 
                error: '프로젝트를 찾을 수 없습니다.' 
            });
        }

        // S3에서 프로젝트 데이터 가져오기
        const axios = require('axios');
        const response = await axios.get(project.s3_url);

        res.json({
            success: true,
            projectId: project.id,
            projectName: project.project_name,
            projectData: response.data
        });

    } catch (error) {
        console.error('❌ [Scratch 로드] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// =============================================================================
// 🔥 썸네일 업데이트 API
// =============================================================================

router.put('/api/project/:projectId/thumbnail', authenticateUser, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { thumbnailBase64 } = req.body;
        const userID = req.session.userID;

        if (!thumbnailBase64) {
            return res.status(400).json({
                success: false,
                error: '썸네일 데이터가 필요합니다.'
            });
        }

        const S3Manager = require('../lib_storage/s3Manager');
        const s3Manager = new S3Manager();

        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?', 
            [userID]
        );

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }

        const [project] = await db.queryDatabase(
            `SELECT id, project_name, save_type FROM ProjectSubmissions 
             WHERE id = ? AND user_id = ? AND platform = 'scratch'`,
            [projectId, user.id]
        );

        if (!project) {
            return res.status(404).json({ 
                success: false, 
                error: '프로젝트를 찾을 수 없습니다.' 
            });
        }

        // 썸네일 업로드
        const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
        const thumbnailBuffer = Buffer.from(base64Data, 'base64');
        const timestamp = Date.now();
        const safeName = project.project_name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
        const thumbKey = `users/${userID}/scratch/${project.save_type}/thumbnails/${safeName}_${timestamp}.png`;
        
        const thumbnailUrl = await s3Manager.uploadProject(thumbKey, thumbnailBuffer, 'image/png');

        // DB 업데이트
        await db.queryDatabase(
            'UPDATE ProjectSubmissions SET thumbnail_url = ? WHERE id = ?',
            [thumbnailUrl, projectId]
        );

        res.json({
            success: true,
            thumbnailUrl: thumbnailUrl
        });

    } catch (error) {
        console.error('❌ [Scratch 썸네일] 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
