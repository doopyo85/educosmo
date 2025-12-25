/**
 * pong2 포트폴리오 API 라우터
 * pong2.app에서 호출하는 공개 포트폴리오 조회 API
 * 
 * 엔드포인트:
 * GET  /api/pong2/portfolio/users              - 공개 프로젝트 보유 학생 목록
 * GET  /api/pong2/portfolio/user/:userId       - 특정 학생의 공개 프로젝트
 * GET  /api/pong2/portfolio/project/:id        - 프로젝트 상세
 * POST /api/pong2/portfolio/project/:id/view   - 조회수 증가
 * GET  /api/pong2/portfolio/featured           - 추천/인기 프로젝트
 */

const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');

// ============================================================
// CORS 미들웨어 (pong2.app 전용)
// ============================================================
router.use((req, res, next) => {
    // pong2.app 도메인 허용
    const allowedOrigins = [
        'https://pong2.app',
        'https://www.pong2.app',
        'http://localhost:3000',  // 로컬 개발용
        'http://localhost:5500',  // Live Server용
        'http://127.0.0.1:5500'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// ============================================================
// 플랫폼별 설정
// ============================================================
const PLATFORM_CONFIG = {
    scratch: {
        name: '스크래치',
        color: '#FF9800',
        icon: 'puzzle',
        embedType: 'iframe'
    },
    entry: {
        name: '엔트리',
        color: '#00C853',
        icon: 'box',
        embedType: 'iframe'
    },
    python: {
        name: '파이썬',
        color: '#3776AB',
        icon: 'filetype-py',
        embedType: 'code'
    },
    appinventor: {
        name: '앱인벤터',
        color: '#E91E63',
        icon: 'phone',
        embedType: 'download'
    },
    jupyter: {
        name: '주피터',
        color: '#F37626',
        icon: 'journal-code',
        embedType: 'code'
    }
};

// ============================================================
// API 1: 공개 프로젝트 보유 학생 목록
// GET /api/pong2/portfolio/users
// ============================================================
router.get('/users', async (req, res) => {
    try {
        // 파라미터 정수 변환 (LIMIT/OFFSET은 직접 삽입)
        const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const offsetNum = Math.max(parseInt(req.query.offset) || 0, 0);
        
        // 공개 프로젝트가 있는 학생만 조회
        const query = `
            SELECT 
                u.id,
                u.userID,
                u.name,
                u.profile_image,
                COUNT(ps.id) as project_count,
                MAX(ps.created_at) as latest_project_at,
                SUM(ps.view_count) as total_views,
                SUM(ps.like_count) as total_likes
            FROM Users u
            INNER JOIN ProjectSubmissions ps ON u.id = ps.user_id
            WHERE ps.is_public = 1 
              AND ps.is_deleted = 0
              AND u.role = 'student'
            GROUP BY u.id
            HAVING project_count > 0
            ORDER BY latest_project_at DESC
            LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
        
        const users = await db.queryDatabase(query);
        
        // 프로필 이미지 기본값 처리 + 프론트엔드 형식으로 변환
        const formattedUsers = users.map(user => ({
            id: user.id,
            userId: user.userID,           // 소문자 d (card_link.js 요구사항)
            userID: user.userID,           // 대문자 D (호환성)
            userName: user.name || user.userID,
            name: user.name || user.userID,
            profileImage: user.profile_image || '/resource/profiles/default.webp',
            projectCount: user.project_count,
            latestProjectAt: user.latest_project_at,
            totalViews: user.total_views || 0,
            totalLikes: user.total_likes || 0
        }));
        
        res.json({
            success: true,
            data: formattedUsers,
            pagination: {
                limit: limitNum,
                offset: offsetNum,
                hasMore: users.length === limitNum
            }
        });
        
    } catch (error) {
        console.error('포트폴리오 사용자 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// ============================================================
// API 2: 특정 학생의 공개 프로젝트 목록
// GET /api/pong2/portfolio/user/:userId
// :userId는 숫자 ID 또는 userID(문자열) 모두 지원
// ============================================================
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { platform } = req.query;
        
        // 파라미터 정수 변환
        const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const offsetNum = Math.max(parseInt(req.query.offset) || 0, 0);
        
        // 사용자 정보 조회 - 숫자 ID 또는 userID(문자열) 지원
        let userInfo;
        const isNumericId = /^\d+$/.test(userId);
        
        if (isNumericId) {
            // 숫자 ID로 조회
            [userInfo] = await db.queryDatabase(
                'SELECT id, userID, name, profile_image FROM Users WHERE id = ?',
                [userId]
            );
        } else {
            // userID(문자열)로 조회
            [userInfo] = await db.queryDatabase(
                'SELECT id, userID, name, profile_image FROM Users WHERE userID = ?',
                [userId]
            );
        }
        
        if (!userInfo) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }
        
        // 프로젝트 목록 조회
        let projectQuery = `
            SELECT 
                id, platform, project_name, description, thumbnail_url,
                s3_url, file_size_kb, blocks_count, sprites_count,
                view_count, like_count, created_at, updated_at
            FROM ProjectSubmissions
            WHERE user_id = ?
              AND is_public = 1
              AND is_deleted = 0
        `;
        
        const queryParams = [userId];
        
        // 플랫폼 필터
        if (platform && PLATFORM_CONFIG[platform]) {
            projectQuery += ' AND platform = ?';
            queryParams.push(platform);
        }
        
        projectQuery += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;
        
        const projects = await db.queryDatabase(projectQuery, queryParams);
        
        // 프로젝트 포맷팅
        const formattedProjects = projects.map(project => ({
            id: project.id,
            platform: project.platform,
            platformInfo: PLATFORM_CONFIG[project.platform] || {},
            projectName: project.project_name,
            description: project.description || '',
            thumbnailUrl: project.thumbnail_url || getDefaultThumbnail(project.platform),
            s3Url: project.s3_url,
            fileSizeKb: project.file_size_kb,
            blocksCount: project.blocks_count,
            spritesCount: project.sprites_count,
            viewCount: project.view_count || 0,
            likeCount: project.like_count || 0,
            createdAt: project.created_at,
            updatedAt: project.updated_at
        }));
        
        res.json({
            success: true,
            data: {
                user: {
                    id: userInfo.id,
                    userID: userInfo.userID,
                    name: userInfo.name || userInfo.userID,
                    profileImage: userInfo.profile_image || '/resource/profiles/default.webp'
                },
                projects: formattedProjects,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: projects.length === parseInt(limit)
                }
            }
        });
        
    } catch (error) {
        console.error('사용자 프로젝트 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 목록을 불러오는 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// ============================================================
// API 3: 프로젝트 상세
// GET /api/pong2/portfolio/project/:id
// ============================================================
router.get('/project/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 프로젝트 + 작성자 정보 조회
        const query = `
            SELECT 
                ps.*,
                u.userID as author_userID,
                u.name as author_name,
                u.profile_image as author_profile_image
            FROM ProjectSubmissions ps
            INNER JOIN Users u ON ps.user_id = u.id
            WHERE ps.id = ?
              AND ps.is_public = 1
              AND ps.is_deleted = 0
        `;
        
        const [project] = await db.queryDatabase(query, [id]);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없거나 비공개 상태입니다.'
            });
        }
        
        // 임베드 정보 생성
        const embedInfo = generateEmbedInfo(project);
        
        // metadata JSON 파싱
        let parsedMetadata = null;
        if (project.metadata) {
            try {
                parsedMetadata = typeof project.metadata === 'string' 
                    ? JSON.parse(project.metadata) 
                    : project.metadata;
            } catch (e) {
                console.error('metadata 파싱 오류:', e);
            }
        }
        
        res.json({
            success: true,
            data: {
                id: project.id,
                platform: project.platform,
                platformInfo: PLATFORM_CONFIG[project.platform] || {},
                projectName: project.project_name,
                description: project.description || '',
                thumbnailUrl: project.thumbnail_url || getDefaultThumbnail(project.platform),
                
                // 파일 정보
                s3Url: project.s3_url,
                s3Key: project.s3_key,
                fileSizeKb: project.file_size_kb,
                originalFilename: project.original_filename,
                
                // 프로젝트 분석 정보
                blocksCount: project.blocks_count,
                spritesCount: project.sprites_count,
                complexityScore: project.complexity_score,
                metadata: parsedMetadata,
                
                // 통계
                viewCount: project.view_count || 0,
                likeCount: project.like_count || 0,
                
                // 시간
                createdAt: project.created_at,
                updatedAt: project.updated_at,
                
                // 작성자 정보
                author: {
                    id: project.user_id,
                    userID: project.author_userID,
                    name: project.author_name || project.author_userID,
                    profileImage: project.author_profile_image || '/resource/profiles/default.webp'
                },
                
                // 임베드 정보
                embed: embedInfo
            }
        });
        
    } catch (error) {
        console.error('프로젝트 상세 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트를 불러오는 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// ============================================================
// API 4: 조회수 증가
// POST /api/pong2/portfolio/project/:id/view
// ============================================================
router.post('/project/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 조회수 증가
        await db.queryDatabase(
            'UPDATE ProjectSubmissions SET view_count = view_count + 1 WHERE id = ? AND is_public = 1',
            [id]
        );
        
        // 현재 조회수 반환
        const [result] = await db.queryDatabase(
            'SELECT view_count FROM ProjectSubmissions WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            viewCount: result?.view_count || 0
        });
        
    } catch (error) {
        console.error('조회수 증가 오류:', error);
        res.status(500).json({
            success: false,
            message: '조회수 업데이트 중 오류가 발생했습니다.'
        });
    }
});

// ============================================================
// API 5: 추천/인기 프로젝트
// GET /api/pong2/portfolio/featured
// ============================================================
router.get('/featured', async (req, res) => {
    try {
        const { limit = 12, sort = 'popular' } = req.query;
        
        let orderBy;
        switch (sort) {
            case 'recent':
                orderBy = 'ps.created_at DESC';
                break;
            case 'views':
                orderBy = 'ps.view_count DESC';
                break;
            case 'likes':
                orderBy = 'ps.like_count DESC';
                break;
            case 'popular':
            default:
                // 인기도 = 조회수 + (좋아요 * 3) + 최근성 보정
                orderBy = '(ps.view_count + ps.like_count * 3) DESC, ps.created_at DESC';
                break;
        }
        
        const query = `
            SELECT 
                ps.id, ps.platform, ps.project_name, ps.description, 
                ps.thumbnail_url, ps.view_count, ps.like_count, ps.created_at,
                u.id as author_id, u.userID as author_userID, 
                u.name as author_name, u.profile_image as author_profile_image
            FROM ProjectSubmissions ps
            INNER JOIN Users u ON ps.user_id = u.id
            WHERE ps.is_public = 1
              AND ps.is_deleted = 0
            ORDER BY ${orderBy}
            LIMIT ?
        `;
        
        const projects = await db.queryDatabase(query, [parseInt(limit)]);
        
        const formattedProjects = projects.map(project => ({
            id: project.id,
            platform: project.platform,
            platformInfo: PLATFORM_CONFIG[project.platform] || {},
            projectName: project.project_name,
            description: project.description || '',
            thumbnailUrl: project.thumbnail_url || getDefaultThumbnail(project.platform),
            viewCount: project.view_count || 0,
            likeCount: project.like_count || 0,
            createdAt: project.created_at,
            author: {
                id: project.author_id,
                userID: project.author_userID,
                name: project.author_name || project.author_userID,
                profileImage: project.author_profile_image || '/resource/profiles/default.webp'
            }
        }));
        
        res.json({
            success: true,
            data: formattedProjects
        });
        
    } catch (error) {
        console.error('추천 프로젝트 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '추천 프로젝트를 불러오는 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// ============================================================
// 헬퍼 함수들
// ============================================================

/**
 * 플랫폼별 기본 썸네일 URL 반환
 */
function getDefaultThumbnail(platform) {
    const defaults = {
        scratch: '/resource/thumbnails/scratch_default.png',
        entry: '/resource/thumbnails/entry_default.png',
        python: '/resource/thumbnails/python_default.png',
        appinventor: '/resource/thumbnails/appinventor_default.png',
        jupyter: '/resource/thumbnails/jupyter_default.png'
    };
    return defaults[platform] || '/resource/thumbnails/default.png';
}

/**
 * 프로젝트 임베드 정보 생성
 */
function generateEmbedInfo(project) {
    const platform = project.platform;
    
    switch (platform) {
        case 'scratch':
            return {
                type: 'iframe',
                canEmbed: true,
                // Scratch GUI 서버로 로드
                iframeUrl: `https://app.codingnplay.co.kr/scratch/?project_file=${encodeURIComponent(project.s3_url)}`,
                downloadUrl: project.s3_url,
                instructions: '스크래치 프로젝트를 실행하려면 녹색 깃발을 클릭하세요.'
            };
            
        case 'entry':
            return {
                type: 'iframe',
                canEmbed: true,
                // Entry 서버로 로드
                iframeUrl: `https://app.codingnplay.co.kr/entry_editor?project=${encodeURIComponent(project.s3_key)}`,
                downloadUrl: project.s3_url,
                instructions: '엔트리 프로젝트를 실행하려면 시작 버튼을 클릭하세요.'
            };
            
        case 'python':
            return {
                type: 'code',
                canEmbed: true,
                codeUrl: project.s3_url,
                language: 'python',
                instructions: '파이썬 코드를 확인하세요. 실행은 별도 환경이 필요합니다.'
            };
            
        case 'jupyter':
            return {
                type: 'code',
                canEmbed: true,
                codeUrl: project.s3_url,
                language: 'jupyter',
                instructions: '주피터 노트북을 다운로드하여 실행하세요.'
            };
            
        case 'appinventor':
            return {
                type: 'download',
                canEmbed: false,
                downloadUrl: project.s3_url,
                instructions: 'APK 파일을 다운로드하여 Android 기기에서 실행하세요.'
            };
            
        default:
            return {
                type: 'download',
                canEmbed: false,
                downloadUrl: project.s3_url,
                instructions: '파일을 다운로드하세요.'
            };
    }
}

module.exports = router;
