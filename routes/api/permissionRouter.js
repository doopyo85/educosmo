// routes/api/permissionRouter.js
// 권한 관리 API 라우터

const express = require('express');
const router = express.Router();
const { authenticateUser, checkAdminRole } = require('../../lib_login/authMiddleware');
const {
    ROLE_HIERARCHY,
    RESOURCE_PERMISSIONS,
    getRoleResourcePermissions,
    hasResourcePermission,
    canChangeRole,
    canManageUserInCenter
} = require('../../lib_login/permissions');

/**
 * GET /api/permissions/roles
 * 전체 역할 목록 및 계층 구조 조회
 */
router.get('/roles', authenticateUser, (req, res) => {
    try {
        const roles = Object.keys(ROLE_HIERARCHY).map(role => ({
            role,
            level: ROLE_HIERARCHY[role],
            displayName: getRoleDisplayName(role)
        })).sort((a, b) => b.level - a.level);

        res.json({
            success: true,
            roles
        });

    } catch (error) {
        console.error('역할 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '역할 목록 조회에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * GET /api/permissions/role/:role
 * 특정 역할의 권한 목록 조회
 */
router.get('/role/:role', authenticateUser, (req, res) => {
    try {
        const { role } = req.params;

        if (!ROLE_HIERARCHY[role]) {
            return res.status(404).json({
                success: false,
                message: '존재하지 않는 역할입니다.'
            });
        }

        const permissions = getRoleResourcePermissions(role);
        const groupedPermissions = groupPermissionsByResource(permissions);

        res.json({
            success: true,
            role,
            level: ROLE_HIERARCHY[role],
            displayName: getRoleDisplayName(role),
            permissions,
            groupedPermissions
        });

    } catch (error) {
        console.error('역할 권한 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '역할 권한 조회에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * GET /api/permissions/matrix
 * 전체 권한 매트릭스 조회 (admin만 가능)
 */
router.get('/matrix', authenticateUser, checkAdminRole, (req, res) => {
    try {
        // 권한별로 허용된 역할 매핑
        const matrix = {};

        for (const [permission, roles] of Object.entries(RESOURCE_PERMISSIONS)) {
            const [resource, action] = permission.split(':');

            if (!matrix[resource]) {
                matrix[resource] = {};
            }

            matrix[resource][action] = roles;
        }

        res.json({
            success: true,
            matrix,
            roleHierarchy: ROLE_HIERARCHY
        });

    } catch (error) {
        console.error('권한 매트릭스 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '권한 매트릭스 조회에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * POST /api/permissions/check
 * 특정 권한 보유 여부 확인
 */
router.post('/check', authenticateUser, (req, res) => {
    try {
        const { role, permission } = req.body;

        if (!role || !permission) {
            return res.status(400).json({
                success: false,
                message: '역할과 권한을 모두 지정해야 합니다.'
            });
        }

        const hasPermission = hasResourcePermission(role, permission);

        res.json({
            success: true,
            role,
            permission,
            hasPermission
        });

    } catch (error) {
        console.error('권한 확인 오류:', error);
        res.status(500).json({
            success: false,
            message: '권한 확인에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * POST /api/permissions/can-change-role
 * 역할 변경 가능 여부 확인
 */
router.post('/can-change-role', authenticateUser, (req, res) => {
    try {
        const { targetCurrentRole, targetNewRole } = req.body;
        const currentRole = req.session.role;

        if (!targetCurrentRole || !targetNewRole) {
            return res.status(400).json({
                success: false,
                message: '대상 사용자의 현재 역할과 새 역할을 모두 지정해야 합니다.'
            });
        }

        const canChange = canChangeRole(currentRole, targetCurrentRole, targetNewRole);

        res.json({
            success: true,
            currentRole,
            targetCurrentRole,
            targetNewRole,
            canChange
        });

    } catch (error) {
        console.error('역할 변경 가능 여부 확인 오류:', error);
        res.status(500).json({
            success: false,
            message: '역할 변경 가능 여부 확인에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * POST /api/permissions/can-manage-user
 * 사용자 관리 가능 여부 확인
 */
router.post('/can-manage-user', authenticateUser, (req, res) => {
    try {
        const { targetRole } = req.body;
        const managerRole = req.session.role;

        if (!targetRole) {
            return res.status(400).json({
                success: false,
                message: '대상 사용자의 역할을 지정해야 합니다.'
            });
        }

        const canManage = canManageUserInCenter(managerRole, targetRole);

        res.json({
            success: true,
            managerRole,
            targetRole,
            canManage
        });

    } catch (error) {
        console.error('사용자 관리 가능 여부 확인 오류:', error);
        res.status(500).json({
            success: false,
            message: '사용자 관리 가능 여부 확인에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * GET /api/permissions/my-permissions
 * 현재 사용자의 권한 목록 조회
 */
router.get('/my-permissions', authenticateUser, (req, res) => {
    try {
        const role = req.session.role;
        const permissions = getRoleResourcePermissions(role);
        const groupedPermissions = groupPermissionsByResource(permissions);

        res.json({
            success: true,
            role,
            level: ROLE_HIERARCHY[role],
            displayName: getRoleDisplayName(role),
            permissions,
            groupedPermissions
        });

    } catch (error) {
        console.error('내 권한 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '권한 조회에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * GET /api/permissions/manageable-roles
 * 현재 사용자가 관리할 수 있는 역할 목록
 */
router.get('/manageable-roles', authenticateUser, (req, res) => {
    try {
        const currentRole = req.session.role;
        const allRoles = Object.keys(ROLE_HIERARCHY);

        const manageableRoles = allRoles.filter(targetRole =>
            canManageUserInCenter(currentRole, targetRole)
        ).map(role => ({
            role,
            level: ROLE_HIERARCHY[role],
            displayName: getRoleDisplayName(role)
        })).sort((a, b) => b.level - a.level);

        res.json({
            success: true,
            currentRole,
            manageableRoles
        });

    } catch (error) {
        console.error('관리 가능한 역할 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '관리 가능한 역할 조회에 실패했습니다.',
            error: error.message
        });
    }
});

// 유틸리티 함수

/**
 * 역할 표시 이름 반환
 */
function getRoleDisplayName(role) {
    const displayNames = {
        admin: '시스템 관리자',
        kinder: '유치원 관리자',
        school: '학교 관리자',
        manager: '센터 매니저',
        teacher: '강사',
        student: '학생',
        parent: '학부모'
    };
    return displayNames[role] || role;
}

/**
 * 권한을 리소스별로 그룹화
 */
function groupPermissionsByResource(permissions) {
    const grouped = {};

    permissions.forEach(permission => {
        const [resource, action] = permission.split(':');

        if (!grouped[resource]) {
            grouped[resource] = {
                resource,
                displayName: getResourceDisplayName(resource),
                actions: []
            };
        }

        grouped[resource].actions.push({
            action,
            displayName: getActionDisplayName(action),
            permission
        });
    });

    return Object.values(grouped);
}

/**
 * 리소스 표시 이름 반환
 */
function getResourceDisplayName(resource) {
    const displayNames = {
        center: '센터',
        user: '사용자',
        content: '콘텐츠',
        class: '수업',
        assignment: '과제',
        report: '보고서',
        payment: '결제',
        stats: '통계'
    };
    return displayNames[resource] || resource;
}

/**
 * 액션 표시 이름 반환
 */
function getActionDisplayName(action) {
    const displayNames = {
        create: '생성',
        read: '조회',
        update: '수정',
        update_own: '자신의 것 수정',
        update_any: '모든 것 수정',
        delete: '삭제',
        delete_own: '자신의 것 삭제',
        delete_any: '모든 것 삭제',
        invite_code: '초대 코드 관리',
        stats: '통계 조회',
        move_center: '센터 이동',
        change_role: '역할 변경',
        publish: '게시',
        assign_students: '학생 배정',
        submit: '제출',
        grade: '채점',
        view_all: '전체 조회',
        view_center: '센터 조회',
        view_own: '자신의 것 조회',
        export: '내보내기',
        view: '조회',
        manage: '관리'
    };
    return displayNames[action] || action;
}

module.exports = router;
