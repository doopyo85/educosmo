// lib_login/rbacMiddleware.js
// Phase 2: 강화된 역할 기반 접근 제어 미들웨어

const {
    hasResourcePermission,
    hasAnyResourcePermission,
    canAccessResource,
    canManageUserInCenter,
    isCenterAdmin,
    isCenterManager
} = require('./permissions');

const { queryDatabase } = require('./db');

/**
 * 리소스 권한 검증 미들웨어
 * 특정 리소스 작업에 대한 권한 확인
 * @param {string|string[]} requiredPermissions - 필요한 권한 (단일 또는 배열)
 * @param {object} options - 추가 옵션
 * @returns {Function} Express 미들웨어
 */
function checkResourcePermission(requiredPermissions, options = {}) {
    return (req, res, next) => {
        const userRole = req.session?.role;

        if (!userRole) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        // 단일 권한 또는 배열 권한 처리
        const permissions = Array.isArray(requiredPermissions)
            ? requiredPermissions
            : [requiredPermissions];

        // 하나라도 권한이 있으면 통과 (OR 조건)
        const hasPermission = options.requireAll
            ? permissions.every(p => hasResourcePermission(userRole, p))
            : hasAnyResourcePermission(userRole, permissions);

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: '이 작업을 수행할 권한이 없습니다.',
                requiredPermissions: permissions
            });
        }

        next();
    };
}

/**
 * 센터 소속 확인 미들웨어
 * 사용자가 특정 센터에 속해있는지 확인
 */
function checkCenterMembership() {
    return async (req, res, next) => {
        const userId = req.session?.userID;
        const userRole = req.session?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        // admin은 모든 센터 접근 가능
        if (userRole === 'admin') {
            return next();
        }

        try {
            // 센터 ID 확인 (URL 파라미터 또는 요청 본문에서)
            const centerId = req.params.centerId || req.params.id || req.body.centerId;

            if (!centerId) {
                // 센터 ID가 없으면 사용자의 센터만 접근 가능
                const [user] = await queryDatabase(
                    'SELECT centerID FROM Users WHERE userID = ?',
                    [userId]
                );

                if (!user || !user.centerID) {
                    return res.status(403).json({
                        success: false,
                        message: '센터에 속해있지 않습니다.'
                    });
                }

                req.userCenter = user.centerID;
                return next();
            }

            // 특정 센터 접근 시 사용자의 센터 확인
            const [user] = await queryDatabase(
                'SELECT centerID FROM Users WHERE userID = ?',
                [userId]
            );

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '사용자를 찾을 수 없습니다.'
                });
            }

            if (user.centerID !== parseInt(centerId)) {
                return res.status(403).json({
                    success: false,
                    message: '해당 센터에 접근할 권한이 없습니다.'
                });
            }

            req.userCenter = user.centerID;
            next();

        } catch (error) {
            console.error('센터 소속 확인 오류:', error);
            res.status(500).json({
                success: false,
                message: '센터 소속 확인에 실패했습니다.',
                error: error.message
            });
        }
    };
}

/**
 * 리소스 소유권 확인 미들웨어
 * 사용자가 리소스의 소유자이거나 관리 권한이 있는지 확인
 * @param {Function} getResourceOwnerId - 리소스 소유자 ID를 반환하는 함수
 */
function checkResourceOwnership(getResourceOwnerId) {
    return async (req, res, next) => {
        const userId = req.session?.userID;
        const userRole = req.session?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        try {
            // 리소스 소유자 ID 가져오기
            const resourceOwnerId = await getResourceOwnerId(req);

            if (!resourceOwnerId) {
                return res.status(404).json({
                    success: false,
                    message: '리소스를 찾을 수 없습니다.'
                });
            }

            // 소유권 확인
            if (!canAccessResource(userId, resourceOwnerId, userRole)) {
                return res.status(403).json({
                    success: false,
                    message: '이 리소스에 접근할 권한이 없습니다.'
                });
            }

            req.resourceOwner = resourceOwnerId;
            next();

        } catch (error) {
            console.error('리소스 소유권 확인 오류:', error);
            res.status(500).json({
                success: false,
                message: '리소스 소유권 확인에 실패했습니다.',
                error: error.message
            });
        }
    };
}

/**
 * 사용자 관리 권한 확인 미들웨어
 * 대상 사용자를 관리할 권한이 있는지 확인
 */
function checkUserManagementPermission() {
    return async (req, res, next) => {
        const managerRole = req.session?.role;
        const managerId = req.session?.userID;
        const targetUserId = req.params.userId || req.body.userId;

        if (!managerRole || !managerId) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: '대상 사용자 ID가 필요합니다.'
            });
        }

        try {
            // 대상 사용자 정보 조회
            const [targetUser] = await queryDatabase(
                'SELECT role, centerID FROM Users WHERE userID = ?',
                [targetUserId]
            );

            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: '대상 사용자를 찾을 수 없습니다.'
                });
            }

            // admin이 아니면 같은 센터인지 확인
            if (managerRole !== 'admin') {
                const [manager] = await queryDatabase(
                    'SELECT centerID FROM Users WHERE userID = ?',
                    [managerId]
                );

                if (!manager || manager.centerID !== targetUser.centerID) {
                    return res.status(403).json({
                        success: false,
                        message: '같은 센터의 사용자만 관리할 수 있습니다.'
                    });
                }
            }

            // 사용자 관리 권한 확인
            if (!canManageUserInCenter(managerRole, targetUser.role)) {
                return res.status(403).json({
                    success: false,
                    message: '해당 역할의 사용자를 관리할 권한이 없습니다.'
                });
            }

            req.targetUser = targetUser;
            next();

        } catch (error) {
            console.error('사용자 관리 권한 확인 오류:', error);
            res.status(500).json({
                success: false,
                message: '사용자 관리 권한 확인에 실패했습니다.',
                error: error.message
            });
        }
    };
}

/**
 * 센터 관리자 권한 확인 미들웨어
 */
function checkCenterAdminRole() {
    return (req, res, next) => {
        const userRole = req.session?.role;

        if (!userRole) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        if (!isCenterAdmin(userRole) && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '센터 관리자 권한이 필요합니다.'
            });
        }

        next();
    };
}

/**
 * 센터 매니저 이상 권한 확인 미들웨어
 */
function checkCenterManagerRole() {
    return (req, res, next) => {
        const userRole = req.session?.role;

        if (!userRole) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        if (!isCenterManager(userRole)) {
            return res.status(403).json({
                success: false,
                message: '센터 매니저 이상의 권한이 필요합니다.'
            });
        }

        next();
    };
}

/**
 * 역할 변경 권한 확인 미들웨어
 */
function checkRoleChangePermission() {
    return async (req, res, next) => {
        const currentUserRole = req.session?.role;
        const targetUserId = req.params.userId || req.body.userId;
        const newRole = req.body.role;

        if (!currentUserRole) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        if (!targetUserId || !newRole) {
            return res.status(400).json({
                success: false,
                message: '대상 사용자 ID와 새 역할이 필요합니다.'
            });
        }

        try {
            // 대상 사용자의 현재 역할 조회
            const [targetUser] = await queryDatabase(
                'SELECT role FROM Users WHERE userID = ?',
                [targetUserId]
            );

            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: '대상 사용자를 찾을 수 없습니다.'
                });
            }

            // 역할 변경 권한 확인
            const { canChangeRole } = require('./permissions');
            if (!canChangeRole(currentUserRole, targetUser.role, newRole)) {
                return res.status(403).json({
                    success: false,
                    message: '해당 사용자의 역할을 변경할 권한이 없습니다.'
                });
            }

            req.targetUser = targetUser;
            next();

        } catch (error) {
            console.error('역할 변경 권한 확인 오류:', error);
            res.status(500).json({
                success: false,
                message: '역할 변경 권한 확인에 실패했습니다.',
                error: error.message
            });
        }
    };
}

/**
 * 센터 접근 로그 기록
 */
function logCenterAccess() {
    return async (req, res, next) => {
        const userId = req.session?.userID;
        const centerId = req.params.centerId || req.params.id;
        const action = req.method;
        const resource = req.path;

        // 로그는 비동기로 기록하고 요청은 계속 진행
        if (userId && centerId) {
            queryDatabase(
                `INSERT INTO center_access_logs (user_id, center_id, action, resource, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [userId, centerId, action, resource]
            ).catch(error => {
                console.error('센터 접근 로그 기록 오류:', error);
            });
        }

        next();
    };
}

module.exports = {
    checkResourcePermission,
    checkCenterMembership,
    checkResourceOwnership,
    checkUserManagementPermission,
    checkCenterAdminRole,
    checkCenterManagerRole,
    checkRoleChangePermission,
    logCenterAccess
};
