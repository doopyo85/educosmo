/**
 * 🔥 스토리지 관리 API 라우터
 * 사용량 조회, 파일 목록, 관리자 기능
 */

const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');
const { authenticateUser, checkRole } = require('../../lib_login/authMiddleware');
const { 
    formatBytes, 
    calculateUsagePercent,
    STORAGE_PLANS,
    FILE_CATEGORIES 
} = require('../../lib_storage/storagePolicy');
const {
    getUserStorageUsage,
    getCenterStorageUsage,
    getUserStorageLimit
} = require('../../lib_storage/quotaChecker');

// =====================================================
// 📊 사용자 API
// =====================================================

/**
 * 내 스토리지 사용량 조회
 * GET /api/storage/usage
 */
router.get('/usage', authenticateUser, async (req, res) => {
    try {
        const userID = req.session.userID;
        
        // 사용자 DB ID 조회
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '사용자 정보를 찾을 수 없습니다.'
            });
        }
        
        // 사용량 조회
        const usage = await getUserStorageUsage(user.id);
        const limits = await getUserStorageLimit(user.id, user.centerID);
        
        // 카테고리별 상세
        const categories = {
            entry: {
                name: '엔트리',
                usage: usage.entry_usage || 0,
                usageFormatted: formatBytes(usage.entry_usage || 0)
            },
            scratch: {
                name: '스크래치',
                usage: usage.scratch_usage || 0,
                usageFormatted: formatBytes(usage.scratch_usage || 0)
            },
            python: {
                name: '파이썬',
                usage: usage.python_usage || 0,
                usageFormatted: formatBytes(usage.python_usage || 0)
            },
            appinventor: {
                name: '앱인벤터',
                usage: usage.appinventor_usage || 0,
                usageFormatted: formatBytes(usage.appinventor_usage || 0)
            },
            gallery: {
                name: '갤러리',
                usage: usage.gallery_usage || 0,
                usageFormatted: formatBytes(usage.gallery_usage || 0)
            },
            board: {
                name: '게시판',
                usage: usage.board_usage || 0,
                usageFormatted: formatBytes(usage.board_usage || 0)
            }
        };
        
        res.json({
            success: true,
            data: {
                total: {
                    usage: usage.total_usage || 0,
                    usageFormatted: formatBytes(usage.total_usage || 0),
                    limit: limits.userLimit,
                    limitFormatted: formatBytes(limits.userLimit),
                    percent: calculateUsagePercent(usage.total_usage || 0, limits.userLimit),
                    available: limits.userLimit ? limits.userLimit - (usage.total_usage || 0) : null,
                    availableFormatted: limits.userLimit 
                        ? formatBytes(limits.userLimit - (usage.total_usage || 0))
                        : '무제한'
                },
                categories,
                plan: {
                    type: limits.planType,
                    name: limits.planName
                },
                lastUpdated: usage.updated_at
            }
        });
        
    } catch (error) {
        console.error('사용량 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '사용량 조회 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 내 파일 목록 조회
 * GET /api/storage/files?category=board&page=1&limit=20
 */
router.get('/files', authenticateUser, async (req, res) => {
    try {
        const userID = req.session.userID;
        const { category, page = 1, limit = 20 } = req.query;
        
        // 사용자 DB ID 조회
        const [user] = await db.queryDatabase(
            'SELECT id, centerID FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '사용자 정보를 찾을 수 없습니다.'
            });
        }
        
        // 쿼리 조건 구성
        let whereClause = 'WHERE user_id = ? AND is_deleted = FALSE';
        const params = [user.id];
        
        if (category && FILE_CATEGORIES[category]) {
            whereClause += ' AND file_category = ?';
            params.push(category);
        }
        
        // 총 개수 조회
        const [countResult] = await db.queryDatabase(`
            SELECT COUNT(*) as total FROM UserFiles ${whereClause}
        `, params);
        
        const total = countResult.total;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // 파일 목록 조회
        const files = await db.queryDatabase(`
            SELECT 
                id, file_category, original_name, stored_name,
                file_size, file_type, s3_url, related_post_id,
                created_at
            FROM UserFiles 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);
        
        // 파일 정보 포맷팅
        const formattedFiles = files.map(file => ({
            ...file,
            fileSizeFormatted: formatBytes(file.file_size),
            categoryName: FILE_CATEGORIES[file.file_category]?.name || file.file_category
        }));
        
        res.json({
            success: true,
            data: {
                files: formattedFiles,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
        
    } catch (error) {
        console.error('파일 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '파일 목록 조회 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 카테고리별 파일 개수 조회
 * GET /api/storage/summary
 */
router.get('/summary', authenticateUser, async (req, res) => {
    try {
        const userID = req.session.userID;
        
        const [user] = await db.queryDatabase(
            'SELECT id FROM Users WHERE userID = ?',
            [userID]
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '사용자 정보를 찾을 수 없습니다.'
            });
        }
        
        // 카테고리별 파일 수 조회
        const summary = await db.queryDatabase(`
            SELECT 
                file_category,
                COUNT(*) as file_count,
                SUM(file_size) as total_size
            FROM UserFiles 
            WHERE user_id = ? AND is_deleted = FALSE
            GROUP BY file_category
        `, [user.id]);
        
        // 결과 포맷팅
        const result = {};
        for (const [key, config] of Object.entries(FILE_CATEGORIES)) {
            const categoryData = summary.find(s => s.file_category === key);
            result[key] = {
                name: config.name,
                fileCount: categoryData?.file_count || 0,
                totalSize: categoryData?.total_size || 0,
                totalSizeFormatted: formatBytes(categoryData?.total_size || 0)
            };
        }
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('파일 요약 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '파일 요약 조회 중 오류가 발생했습니다.'
        });
    }
});

// =====================================================
// 🔧 관리자 API
// =====================================================

/**
 * 센터 스토리지 사용량 조회 (관리자/센터장)
 * GET /api/storage/admin/center/:centerId
 */
router.get('/admin/center/:centerId', authenticateUser, async (req, res) => {
    try {
        const userRole = req.session.role;
        const requestedCenterId = parseInt(req.params.centerId);
        
        // 권한 확인
        if (!['admin', 'manager'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: '접근 권한이 없습니다.'
            });
        }
        
        // manager는 자기 센터만 조회 가능
        if (userRole === 'manager') {
            const [user] = await db.queryDatabase(
                'SELECT centerID FROM Users WHERE userID = ?',
                [req.session.userID]
            );
            
            if (user.centerID !== requestedCenterId) {
                return res.status(403).json({
                    success: false,
                    error: '다른 센터의 정보를 조회할 수 없습니다.'
                });
            }
        }
        
        // 센터 사용량 조회
        const centerUsage = await getCenterStorageUsage(requestedCenterId);
        const plan = STORAGE_PLANS[centerUsage.plan_type] || STORAGE_PLANS.free;
        
        // 센터 내 사용자별 사용량
        const userUsages = await db.queryDatabase(`
            SELECT 
                u.id, u.userID, u.name, u.role,
                COALESCE(s.total_usage, 0) as total_usage,
                COALESCE(s.entry_usage, 0) as entry_usage,
                COALESCE(s.scratch_usage, 0) as scratch_usage,
                COALESCE(s.python_usage, 0) as python_usage,
                COALESCE(s.board_usage, 0) as board_usage
            FROM Users u
            LEFT JOIN UserStorageUsage s ON u.id = s.user_id
            WHERE u.centerID = ?
            ORDER BY s.total_usage DESC
        `, [requestedCenterId]);
        
        // 포맷팅
        const formattedUsers = userUsages.map(u => ({
            ...u,
            total_usage_formatted: formatBytes(u.total_usage),
            percent: calculateUsagePercent(u.total_usage, plan.userLimit)
        }));
        
        res.json({
            success: true,
            data: {
                center: {
                    id: requestedCenterId,
                    totalUsage: centerUsage.total_usage,
                    totalUsageFormatted: formatBytes(centerUsage.total_usage),
                    limit: centerUsage.storage_limit,
                    limitFormatted: formatBytes(centerUsage.storage_limit),
                    percent: calculateUsagePercent(centerUsage.total_usage, centerUsage.storage_limit),
                    plan: {
                        type: centerUsage.plan_type,
                        name: plan.name,
                        expiresAt: centerUsage.plan_expires_at
                    }
                },
                users: formattedUsers,
                userCount: formattedUsers.length
            }
        });
        
    } catch (error) {
        console.error('센터 사용량 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '센터 사용량 조회 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 특정 사용자 파일 목록 조회 (관리자)
 * GET /api/storage/admin/user/:userId/files
 */
router.get('/admin/user/:userId/files', authenticateUser, async (req, res) => {
    try {
        const userRole = req.session.role;
        const targetUserId = parseInt(req.params.userId);
        
        // 권한 확인 (admin, manager만)
        if (!['admin', 'manager'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: '접근 권한이 없습니다.'
            });
        }
        
        // 대상 사용자 정보
        const [targetUser] = await db.queryDatabase(
            'SELECT id, userID, name, centerID FROM Users WHERE id = ?',
            [targetUserId]
        );
        
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다.'
            });
        }
        
        // manager는 같은 센터만
        if (userRole === 'manager') {
            const [currentUser] = await db.queryDatabase(
                'SELECT centerID FROM Users WHERE userID = ?',
                [req.session.userID]
            );
            
            if (currentUser.centerID !== targetUser.centerID) {
                return res.status(403).json({
                    success: false,
                    error: '다른 센터 사용자의 정보를 조회할 수 없습니다.'
                });
            }
        }
        
        // 파일 목록 조회
        const files = await db.queryDatabase(`
            SELECT 
                id, file_category, original_name, stored_name,
                file_size, file_type, s3_url, related_post_id,
                created_at, is_deleted, deleted_at
            FROM UserFiles 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
        `, [targetUserId]);
        
        // 사용량 조회
        const usage = await getUserStorageUsage(targetUserId);
        
        res.json({
            success: true,
            data: {
                user: {
                    id: targetUser.id,
                    userID: targetUser.userID,
                    name: targetUser.name
                },
                usage: {
                    total: usage.total_usage,
                    totalFormatted: formatBytes(usage.total_usage)
                },
                files: files.map(f => ({
                    ...f,
                    fileSizeFormatted: formatBytes(f.file_size)
                })),
                fileCount: files.length
            }
        });
        
    } catch (error) {
        console.error('사용자 파일 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '사용자 파일 조회 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 전체 센터 사용량 통계 (admin 전용)
 * GET /api/storage/admin/all-centers
 */
router.get('/admin/all-centers', authenticateUser, async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: '관리자만 접근할 수 있습니다.'
            });
        }
        
        // 모든 센터 사용량 조회
        const centers = await db.queryDatabase(`
            SELECT 
                c.center_id,
                c.total_usage,
                c.storage_limit,
                c.plan_type,
                c.plan_expires_at,
                COUNT(DISTINCT u.id) as user_count
            FROM CenterStorageUsage c
            LEFT JOIN Users u ON u.centerID = c.center_id
            GROUP BY c.center_id
            ORDER BY c.total_usage DESC
        `);
        
        // 전체 통계
        const totalUsage = centers.reduce((sum, c) => sum + (c.total_usage || 0), 0);
        
        res.json({
            success: true,
            data: {
                summary: {
                    totalCenters: centers.length,
                    totalUsage,
                    totalUsageFormatted: formatBytes(totalUsage)
                },
                centers: centers.map(c => ({
                    ...c,
                    totalUsageFormatted: formatBytes(c.total_usage),
                    limitFormatted: formatBytes(c.storage_limit),
                    percent: calculateUsagePercent(c.total_usage, c.storage_limit),
                    planName: STORAGE_PLANS[c.plan_type]?.name || c.plan_type
                }))
            }
        });
        
    } catch (error) {
        console.error('전체 센터 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '전체 센터 조회 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 센터 플랜 변경 (admin 전용)
 * PUT /api/storage/admin/center/:centerId/plan
 */
router.put('/admin/center/:centerId/plan', authenticateUser, async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: '관리자만 접근할 수 있습니다.'
            });
        }
        
        const centerId = parseInt(req.params.centerId);
        const { planType, expiresAt } = req.body;
        
        // 플랜 유효성 검사
        if (!STORAGE_PLANS[planType]) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 플랜입니다.'
            });
        }
        
        const plan = STORAGE_PLANS[planType];
        
        // 플랜 업데이트
        await db.queryDatabase(`
            UPDATE CenterStorageUsage 
            SET plan_type = ?,
                storage_limit = ?,
                plan_expires_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE center_id = ?
        `, [planType, plan.centerLimit, expiresAt || null, centerId]);
        
        res.json({
            success: true,
            message: `센터 ${centerId}의 플랜이 ${plan.name}(으)로 변경되었습니다.`,
            data: {
                centerId,
                planType,
                planName: plan.name,
                newLimit: plan.centerLimit,
                newLimitFormatted: formatBytes(plan.centerLimit)
            }
        });
        
    } catch (error) {
        console.error('플랜 변경 오류:', error);
        res.status(500).json({
            success: false,
            error: '플랜 변경 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
