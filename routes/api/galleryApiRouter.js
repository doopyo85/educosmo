/**
 * 갤러리 API 라우터
 * 스크래치/엔트리 프로젝트 공유 갤러리 시스템
 * 
 * @route /api/gallery
 */

const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');

// ============================================================
// 미들웨어
// ============================================================

// 인증 필수
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.is_logined) {
        return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    }
    next();
};

// 인증 선택 (조회용)
const optionalAuth = (req, res, next) => {
    // 세션이 있으면 사용자 정보 설정, 없으면 그냥 진행
    next();
};

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 플랫폼별 임베드 URL 생성
 */
function generateEmbedUrl(platform, s3Url) {
    const encodedUrl = encodeURIComponent(s3Url);

    switch (platform) {
        case 'entry':
            return `/entry_editor/?s3Url=${encodedUrl}&mode=play&embed=1`;
        case 'scratch':
            return `/scratch/?project_file=${encodedUrl}&mode=player&embed=1`;
        case 'python':
            return `/python-viewer/?file=${encodedUrl}&embed=1`;
        default:
            return null;
    }
}

/**
 * 사용자 DB ID 조회
 */
async function getUserDbId(userID) {
    const [user] = await db.queryDatabase(
        'SELECT id FROM Users WHERE userID = ?',
        [userID]
    );
    return user?.id;
}

/**
 * 공개 범위에 따른 접근 권한 체크
 */
function canAccessProject(project, sessionUser, sessionCenterId) {
    if (project.visibility === 'public') return true;
    if (!sessionUser) return false;

    if (project.visibility === 'private') {
        return project.userID === sessionUser;
    }

    if (project.visibility === 'class') {
        return project.center_id === sessionCenterId || project.userID === sessionUser;
    }

    return false;
}

// ============================================================
// API 엔드포인트
// ============================================================

/**
 * 프로젝트 공유 등록
 * POST /api/gallery/share
 */
router.post('/share', requireAuth, async (req, res) => {
    try {
        const {
            title,
            description,
            platform,
            s3Url,
            s3Key,
            thumbnailUrl,
            visibility = 'class',
            tags = [],
            submissionId,
            metadata = {}
        } = req.body;

        // 필수 파라미터 검증
        if (!title || !platform || !s3Url) {
            return res.status(400).json({
                success: false,
                error: '필수 파라미터가 누락되었습니다. (title, platform, s3Url)'
            });
        }

        // 플랫폼 검증
        const validPlatforms = ['entry', 'scratch', 'appinventor', 'python', 'jupyter'];
        if (!validPlatforms.includes(platform)) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 플랫폼입니다.'
            });
        }

        const userDbId = await getUserDbId(req.session.userID);
        if (!userDbId) {
            return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
        }

        // 임베드 URL 생성
        const embedUrl = generateEmbedUrl(platform, s3Url);

        // 갤러리에 등록
        const result = await db.queryDatabase(
            `INSERT INTO gallery_projects 
             (user_id, submission_id, title, description, platform, s3_url, s3_key, 
              thumbnail_url, embed_url, visibility, tags, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userDbId,
                submissionId || null,
                title,
                description || null,
                platform,
                s3Url,
                s3Key || null,
                thumbnailUrl || null,
                embedUrl,
                visibility,
                JSON.stringify(tags),
                JSON.stringify(metadata)
            ]
        );

        console.log(`✅ 갤러리 등록 완료: ${title} (${platform}) by ${req.session.userID}`);

        res.json({
            success: true,
            galleryId: result.insertId,
            embedUrl,
            message: '작품이 갤러리에 등록되었습니다.'
        });

    } catch (error) {
        console.error('❌ 갤러리 등록 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 공유된 프로젝트 목록 조회
 * GET /api/gallery/projects
 * 
 * Query params:
 * - platform: 플랫폼 필터 (entry, scratch, python)
 * - visibility: 공개 범위 필터
 * - userId: 특정 사용자 작품만
 * - featured: 추천 작품만
 * - page, limit: 페이지네이션
 * - sort: 정렬 (latest, popular, views)
 */
router.get('/projects', optionalAuth, async (req, res) => {
    try {
        const {
            platform,
            visibility,
            userId,
            featured,
            page = 1,
            limit = 20,
            sort = 'latest'
        } = req.query;

        const sessionUser = req.session?.userID;
        const sessionCenterId = req.session?.centerID || null;

        let whereConditions = ['gp.is_active = 1'];
        let params = [];

        // 공개 범위 필터링
        if (sessionUser) {
            // 로그인 사용자: public + 같은 센터(class) + 본인 작품
            whereConditions.push(`(
                gp.visibility = 'public' 
                OR (gp.visibility = 'class' AND u.centerID = ?)
                OR u.userID = ?
            )`);
            params.push(sessionCenterId, sessionUser);
        } else {
            // 비로그인: public만
            whereConditions.push(`gp.visibility = 'public'`);
        }

        // 플랫폼 필터
        if (platform) {
            whereConditions.push('gp.platform = ?');
            params.push(platform);
        }

        // 특정 사용자 필터
        if (userId) {
            whereConditions.push('u.userID = ?');
            params.push(userId);
        }

        // 추천 작품 필터
        if (featured === 'true') {
            whereConditions.push('gp.is_featured = 1');
        }

        // 정렬
        let orderBy;
        switch (sort) {
            case 'popular':
                orderBy = 'gp.like_count DESC, gp.view_count DESC';
                break;
            case 'views':
                orderBy = 'gp.view_count DESC';
                break;
            case 'latest':
            default:
                orderBy = 'gp.created_at DESC';
        }

        // 페이지네이션 (Safe Parsing)
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const finalPage = Math.max(1, pageNum);
        const finalLimit = Math.max(1, limitNum);
        const offset = (finalPage - 1) * finalLimit;

        // 쿼리 실행
        const query = `
            SELECT 
                gp.id,
                gp.title,
                gp.description,
                gp.platform,
                gp.s3_url,
                gp.thumbnail_url,
                gp.embed_url,
                gp.visibility,
                gp.view_count,
                gp.like_count,
                gp.play_count,
                gp.is_featured,
                gp.tags,
                gp.created_at,
                u.userID,
                u.name as userName,
                u.profile_image,
                u.centerID as center_id
            FROM gallery_projects gp
            JOIN Users u ON gp.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `;

        params.push(finalLimit, offset);

        const projects = await db.queryDatabase(query, params);

        // 총 개수 조회
        const countQuery = `
            SELECT COUNT(*) as total
            FROM gallery_projects gp
            JOIN Users u ON gp.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
        `;
        const [countResult] = await db.queryDatabase(countQuery, params.slice(0, -2));

        // 현재 사용자의 좋아요 여부 확인
        let likedIds = [];
        if (sessionUser) {
            const userDbId = await getUserDbId(sessionUser);
            if (userDbId) {
                const likes = await db.queryDatabase(
                    `SELECT gallery_id FROM gallery_likes WHERE user_id = ?`,
                    [userDbId]
                );
                likedIds = likes.map(l => l.gallery_id);
            }
        }

        // 응답 데이터 가공
        const responseProjects = projects.map(p => ({
            ...p,
            tags: typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : (p.tags || []),
            isLiked: likedIds.includes(p.id),
            isOwner: sessionUser === p.userID
        }));

        res.json({
            success: true,
            data: responseProjects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ 갤러리 목록 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 프로젝트 상세 조회
 * GET /api/gallery/projects/:id
 */
router.get('/projects/:id', optionalAuth, async (req, res) => {
    try {
        const galleryId = parseInt(req.params.id);
        const sessionUser = req.session?.userID;
        const sessionCenterId = req.session?.centerID;

        // 프로젝트 조회
        const [project] = await db.queryDatabase(
            `SELECT 
                gp.*,
                u.userID,
                u.name as userName,
                u.profile_image,
                u.centerID as center_id
             FROM gallery_projects gp
             JOIN Users u ON gp.user_id = u.id
             WHERE gp.id = ? AND gp.is_active = 1`,
            [galleryId]
        );

        if (!project) {
            return res.status(404).json({ success: false, error: '작품을 찾을 수 없습니다.' });
        }

        // 접근 권한 체크
        if (!canAccessProject(project, sessionUser, sessionCenterId)) {
            return res.status(403).json({ success: false, error: '접근 권한이 없습니다.' });
        }

        // 조회수 증가 (중복 방지)
        const sessionId = req.sessionID || req.ip;
        const [existingView] = await db.queryDatabase(
            `SELECT id FROM gallery_views 
             WHERE gallery_id = ? AND (session_id = ? OR ip_address = ?)
             AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
            [galleryId, sessionId, req.ip]
        );

        if (!existingView) {
            await db.queryDatabase(
                `INSERT INTO gallery_views (gallery_id, user_id, ip_address, session_id)
                 VALUES (?, ?, ?, ?)`,
                [galleryId, sessionUser ? await getUserDbId(sessionUser) : null, req.ip, sessionId]
            );
            await db.queryDatabase(
                `UPDATE gallery_projects SET view_count = view_count + 1 WHERE id = ?`,
                [galleryId]
            );
            project.view_count++;
        }

        // 좋아요 여부 확인
        let isLiked = false;
        if (sessionUser) {
            const userDbId = await getUserDbId(sessionUser);
            const [like] = await db.queryDatabase(
                `SELECT id FROM gallery_likes WHERE gallery_id = ? AND user_id = ?`,
                [galleryId, userDbId]
            );
            isLiked = !!like;
        }

        res.json({
            success: true,
            data: {
                ...project,
                tags: typeof project.tags === 'string' ? JSON.parse(project.tags || '[]') : (project.tags || []),
                metadata: typeof project.metadata === 'string' ? JSON.parse(project.metadata || '{}') : (project.metadata || {}),
                isLiked,
                isOwner: sessionUser === project.userID
            }
        });

    } catch (error) {
        console.error('❌ 갤러리 상세 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 좋아요 토글
 * POST /api/gallery/projects/:id/like
 */
router.post('/projects/:id/like', requireAuth, async (req, res) => {
    try {
        const galleryId = parseInt(req.params.id);
        const userDbId = await getUserDbId(req.session.userID);

        // 기존 좋아요 확인
        const [existingLike] = await db.queryDatabase(
            `SELECT id FROM gallery_likes WHERE gallery_id = ? AND user_id = ?`,
            [galleryId, userDbId]
        );

        let isLiked;
        if (existingLike) {
            // 좋아요 취소
            await db.queryDatabase(
                `DELETE FROM gallery_likes WHERE gallery_id = ? AND user_id = ?`,
                [galleryId, userDbId]
            );
            await db.queryDatabase(
                `UPDATE gallery_projects SET like_count = GREATEST(0, like_count - 1) WHERE id = ?`,
                [galleryId]
            );
            isLiked = false;
        } else {
            // 좋아요 추가
            await db.queryDatabase(
                `INSERT INTO gallery_likes (gallery_id, user_id) VALUES (?, ?)`,
                [galleryId, userDbId]
            );
            await db.queryDatabase(
                `UPDATE gallery_projects SET like_count = like_count + 1 WHERE id = ?`,
                [galleryId]
            );
            isLiked = true;
        }

        // 업데이트된 좋아요 수 조회
        const [updated] = await db.queryDatabase(
            `SELECT like_count FROM gallery_projects WHERE id = ?`,
            [galleryId]
        );

        res.json({
            success: true,
            isLiked,
            likeCount: updated.like_count
        });

    } catch (error) {
        console.error('❌ 좋아요 처리 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 실행 횟수 증가
 * POST /api/gallery/projects/:id/play
 */
router.post('/projects/:id/play', optionalAuth, async (req, res) => {
    try {
        const galleryId = parseInt(req.params.id);

        await db.queryDatabase(
            `UPDATE gallery_projects SET play_count = play_count + 1 WHERE id = ?`,
            [galleryId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('❌ 실행 횟수 업데이트 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 프로젝트 수정 (공개 범위, 제목, 설명 등)
 * PUT /api/gallery/projects/:id
 */
router.put('/projects/:id', requireAuth, async (req, res) => {
    try {
        const galleryId = parseInt(req.params.id);
        const { title, description, visibility, tags, thumbnailUrl } = req.body;
        const userDbId = await getUserDbId(req.session.userID);

        // 소유권 확인
        const [project] = await db.queryDatabase(
            `SELECT id FROM gallery_projects WHERE id = ? AND user_id = ?`,
            [galleryId, userDbId]
        );

        if (!project) {
            return res.status(404).json({ success: false, error: '작품을 찾을 수 없거나 권한이 없습니다.' });
        }

        // 업데이트
        const updates = [];
        const params = [];

        if (title) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (visibility) {
            updates.push('visibility = ?');
            params.push(visibility);
        }
        if (tags) {
            updates.push('tags = ?');
            params.push(JSON.stringify(tags));
        }
        if (thumbnailUrl) {
            updates.push('thumbnail_url = ?');
            params.push(thumbnailUrl);
        }

        if (updates.length > 0) {
            params.push(galleryId);
            await db.queryDatabase(
                `UPDATE gallery_projects SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        res.json({ success: true, message: '작품 정보가 수정되었습니다.' });

    } catch (error) {
        console.error('❌ 갤러리 수정 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 공유 취소 (삭제)
 * DELETE /api/gallery/projects/:id
 */
router.delete('/projects/:id', requireAuth, async (req, res) => {
    try {
        const galleryId = parseInt(req.params.id);
        const userDbId = await getUserDbId(req.session.userID);
        const isAdmin = req.session.role === 'admin';

        // 소유권 확인 (관리자는 모두 삭제 가능)
        let query = `SELECT id FROM gallery_projects WHERE id = ?`;
        let params = [galleryId];

        if (!isAdmin) {
            query += ` AND user_id = ?`;
            params.push(userDbId);
        }

        const [project] = await db.queryDatabase(query, params);

        if (!project) {
            return res.status(404).json({ success: false, error: '작품을 찾을 수 없거나 권한이 없습니다.' });
        }

        // 소프트 삭제
        await db.queryDatabase(
            `UPDATE gallery_projects SET is_active = 0 WHERE id = ?`,
            [galleryId]
        );

        res.json({ success: true, message: '작품이 갤러리에서 삭제되었습니다.' });

    } catch (error) {
        console.error('❌ 갤러리 삭제 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 내 갤러리 작품 목록
 * GET /api/gallery/my
 */
router.get('/my', requireAuth, async (req, res) => {
    try {
        const userDbId = await getUserDbId(req.session.userID);

        if (!userDbId) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }

        const { platform, page = 1, limit = 20 } = req.query;

        let whereConditions = ['gp.user_id = ?', 'gp.is_active = 1'];
        let params = [userDbId];

        if (platform) {
            whereConditions.push('gp.platform = ?');
            params.push(platform);
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const finalPage = Math.max(1, pageNum);
        const finalLimit = Math.max(1, limitNum);
        const offset = (finalPage - 1) * finalLimit;

        const projects = await db.queryDatabase(
            `SELECT
                gp.*,
                u.userID,
                u.name as userName
             FROM gallery_projects gp
             JOIN Users u ON gp.user_id = u.id
             WHERE ${whereConditions.join(' AND ')}
             ORDER BY gp.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, finalLimit, offset]
        );

        const [countResult] = await db.queryDatabase(
            `SELECT COUNT(*) as total FROM gallery_projects gp WHERE ${whereConditions.join(' AND ')}`,
            params
        );

        res.json({
            success: true,
            data: projects.map(p => ({
                ...p,
                tags: typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : (p.tags || [])
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ 내 갤러리 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 공유 가능한 프로젝트 목록 (아직 공유 안 된 것)
 * GET /api/gallery/shareable
 */
router.get('/shareable', requireAuth, async (req, res) => {
    try {
        const userDbId = await getUserDbId(req.session.userID);
        const { platform } = req.query;

        let whereConditions = [
            'ps.user_id = ?',
            'ps.save_type IN ("final", "draft")'
        ];
        let params = [userDbId];

        if (platform) {
            whereConditions.push('ps.platform = ?');
            params.push(platform);
        }

        // ProjectSubmissions에서 아직 갤러리에 등록 안 된 프로젝트
        const projects = await db.queryDatabase(
            `SELECT 
                ps.id,
                ps.project_name,
                ps.platform,
                ps.s3_url,
                ps.s3_key,
                ps.save_type,
                ps.thumbnail_url,
                ps.created_at,
                CASE WHEN gp.id IS NOT NULL THEN 1 ELSE 0 END as is_shared
             FROM ProjectSubmissions ps
             LEFT JOIN gallery_projects gp ON ps.id = gp.submission_id AND gp.is_active = 1
             WHERE ${whereConditions.join(' AND ')}
             ORDER BY ps.created_at DESC
             LIMIT 100`,
            params
        );

        res.json({
            success: true,
            data: projects
        });

    } catch (error) {
        console.error('❌ 공유 가능 목록 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 갤러리 통계 (유저별)
 * GET /api/gallery/users
 */
router.get('/users', optionalAuth, async (req, res) => {
    try {
        const { platform } = req.query;
        const sessionCenterId = req.session?.centerID;

        let whereConditions = ['gp.is_active = 1'];
        let params = [];

        // 공개 범위 필터
        if (req.session?.is_logined) {
            whereConditions.push(`(gp.visibility = 'public' OR (gp.visibility = 'class' AND u.centerID = ?))`);
            params.push(sessionCenterId);
        } else {
            whereConditions.push(`gp.visibility = 'public'`);
        }

        if (platform) {
            whereConditions.push('gp.platform = ?');
            params.push(platform);
        }

        const users = await db.queryDatabase(
            `SELECT 
                u.id,
                u.userID,
                u.name,
                u.profile_image,
                COUNT(gp.id) as project_count,
                SUM(gp.view_count) as total_views,
                SUM(gp.like_count) as total_likes
             FROM Users u
             JOIN gallery_projects gp ON u.id = gp.user_id
             WHERE ${whereConditions.join(' AND ')}
             GROUP BY u.id
             ORDER BY project_count DESC, total_likes DESC
             LIMIT 50`,
            params
        );

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('❌ 유저 통계 조회 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
