// permissions.js - 업데이트된 권한 설정
const ACCESS_POLICIES = {
    PAGES: {
        // 관리자 페이지
        '/admin': {
            name: '관리자 대시보드',
            roles: ['admin']
        },
        
        // 교육 단계별 페이지
        '/kinder': {
            name: '유치원',
            roles: ['admin', 'kinder']
        },
        '/school': {
            name: '학교',
            roles: ['admin', 'school']
        },
        
        // 기본 학습 콘텐츠 페이지
        '/computer': {
            name: '컴퓨터 기초활용',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/scratch_project': {
            name: '스크래치',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/entry_project': {
            name: '엔트리',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/appinventor_project': {
            name: '앱인벤터',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/machinelearning': {
            name: '인공지능',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        
        // 템플릿 기반 학습 페이지
        '/python_project': {
            name: '파이썬',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/algorithm': {
            name: '알고리즘 연습',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/certification': {
            name: '자격증 과정',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/aiMath': {
            name: 'AI 수학',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/dataAnalysis': {
            name: '데이터 분석',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/template': {
            name: '템플릿',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        
        // 교사 및 관리 페이지
        '/teacher': {
            name: '교사 교육',
            roles: ['admin', 'manager', 'teacher']
        },
        '/board': {
            name: '게시판',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/learning': {
            name: '학습 관리',
            roles: ['admin', 'manager', 'teacher']
        },
        '/report': {
            name: '리포트 생성',
            roles: ['admin', 'manager', 'teacher']
        },
        '/onlineclass': {
            name: '온라인 클래스',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/portfolio': {
            name: '포트폴리오',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        
        // 라우터 기반 페이지들 (와일드카드 지원)
        '/entry/*': {
            name: '엔트리 관련',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/appinventor/*': {
            name: '앱인벤터 관련',
            roles: ['admin', 'manager', 'teacher', 'student']
        },
        '/python/*': {
            name: '파이썬 관련',
            roles: ['admin', 'manager', 'teacher', 'student']
        }
    },
    
    FEATURES: {
        'PPT_BUTTON': ['admin', 'teacher', 'manager', 'school'],
        'USER_MANAGE': ['admin'],
        'CONTENT_EDIT': ['admin', 'manager', 'teacher'],
        'ANSWER_VIEW': ['admin', 'manager', 'teacher'],
        'CODE_EXECUTION': ['admin', 'manager', 'teacher', 'student'],
        'QUIZ_CREATION': ['admin', 'manager', 'teacher'],
        'REPORT_GENERATION': ['admin', 'manager', 'teacher'],
        'PORTFOLIO_MANAGE': ['admin', 'manager', 'teacher', 'student']
    }
};

// 권한 캐시
const permissionCache = new Map();

// 권한 캐시 업데이트
function updatePermissionCache(newPermissions) {
    permissionCache.clear();
    
    // permissions.json 구조에 맞춰 캐시 업데이트
    if (newPermissions.pages) {
        Object.entries(newPermissions.pages).forEach(([page, config]) => {
            permissionCache.set(page, config.roles);
        });
    }
    
    console.log('권한 캐시 업데이트 완료:', permissionCache.size, '개 페이지');
}

// 페이지 접근 권한 확인 (개선된 버전)
function hasPageAccess(userRole, page) {
    console.log(`hasPageAccess 호출 - 역할: ${userRole}, 페이지: ${page}`);
    
    // 1. 직접 매칭 확인
    if (permissionCache.has(page)) {
        const roles = permissionCache.get(page);
        const hasAccess = roles.includes(userRole);
        console.log(`직접 매칭 결과: ${hasAccess} (허용 역할: ${roles.join(', ')})`);
        return hasAccess;
    }
    
    // 2. 와일드카드 매칭 확인 (라우터 기반 페이지용)
    for (const [cachedPage, roles] of permissionCache.entries()) {
        if (cachedPage.endsWith('/*')) {
            const basePath = cachedPage.replace('/*', '');
            if (page.startsWith(basePath)) {
                const hasAccess = roles.includes(userRole);
                console.log(`와일드카드 매칭 결과: ${hasAccess} (${cachedPage} -> ${page})`);
                return hasAccess;
            }
        }
    }
    
    // 3. ACCESS_POLICIES 폴백 확인
    if (ACCESS_POLICIES.PAGES[page]) {
        const roles = ACCESS_POLICIES.PAGES[page].roles;
        const hasAccess = roles.includes(userRole);
        console.log(`폴백 정책 결과: ${hasAccess} (허용 역할: ${roles.join(', ')})`);
        return hasAccess;
    }
    
    console.log(`페이지 ${page}에 대한 권한 정보 없음 - 접근 거부`);
    return false;
}

// 특정 기능에 대한 접근 권한 확인
function hasFeatureAccess(userRole, feature) {
    const allowedRoles = ACCESS_POLICIES.FEATURES[feature];
    if (!allowedRoles) {
        console.log(`기능 ${feature}에 대한 권한 정보 없음`);
        return false;
    }
    
    const hasAccess = allowedRoles.includes(userRole);
    console.log(`기능 권한 확인 - ${feature}: ${hasAccess} (허용 역할: ${allowedRoles.join(', ')})`);
    return hasAccess;
}

// 접근 권한 확인 (캐시 우선 사용)
function hasAccess(userRole, page) {
    return hasPageAccess(userRole, page);
}

// 사용자 역할별 접근 가능한 페이지 목록 반환
function getAccessiblePages(userRole) {
    const accessiblePages = [];
    
    for (const [page, roles] of permissionCache.entries()) {
        if (roles.includes(userRole)) {
            accessiblePages.push(page);
        }
    }
    
    return accessiblePages;
}

// 디버깅을 위한 권한 정보 출력
function debugPermissions() {
    console.log('=== 권한 설정 디버그 정보 ===');
    console.log('캐시된 페이지 수:', permissionCache.size);
    console.log('설정된 기능 수:', Object.keys(ACCESS_POLICIES.FEATURES).length);
    
    console.log('\n페이지 권한:');
    for (const [page, roles] of permissionCache.entries()) {
        console.log(`  ${page}: ${roles.join(', ')}`);
    }
    
    console.log('\n기능 권한:');
    for (const [feature, roles] of Object.entries(ACCESS_POLICIES.FEATURES)) {
        console.log(`  ${feature}: ${roles.join(', ')}`);
    }
}

/**
 * 역할 계층 구조 (Phase 2 추가)
 * admin > kinder/school > manager > student/parent
 */
const ROLE_HIERARCHY = {
    admin: 100,
    kinder: 50,
    school: 50,
    manager: 30,
    teacher: 30,
    student: 10,
    parent: 10
};

/**
 * 리소스별 권한 매트릭스 (Phase 2 추가)
 * 각 역할이 수행할 수 있는 작업 정의
 */
const RESOURCE_PERMISSIONS = {
    // 센터 관리 권한
    'center:create': ['admin'],
    'center:read': ['admin', 'kinder', 'school', 'manager'],
    'center:update': ['admin', 'kinder', 'school'],
    'center:delete': ['admin'],
    'center:invite_code': ['admin'],
    'center:stats': ['admin', 'kinder', 'school', 'manager'],

    // 사용자 관리 권한
    'user:create': ['admin', 'kinder', 'school', 'manager'],
    'user:read': ['admin', 'kinder', 'school', 'manager', 'student', 'parent'],
    'user:update': ['admin', 'kinder', 'school', 'manager'],
    'user:delete': ['admin', 'kinder', 'school'],
    'user:move_center': ['admin'],
    'user:change_role': ['admin', 'kinder', 'school'],

    // 콘텐츠 관리 권한
    'content:create': ['admin', 'kinder', 'school', 'manager', 'teacher', 'student'],
    'content:read': ['admin', 'kinder', 'school', 'manager', 'teacher', 'student', 'parent'],
    'content:update_own': ['admin', 'kinder', 'school', 'manager', 'teacher', 'student'],
    'content:update_any': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'content:delete_own': ['admin', 'kinder', 'school', 'manager', 'teacher', 'student'],
    'content:delete_any': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'content:publish': ['admin', 'kinder', 'school', 'manager', 'teacher'],

    // 수업 관리 권한
    'class:create': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'class:read': ['admin', 'kinder', 'school', 'manager', 'teacher', 'student', 'parent'],
    'class:update': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'class:delete': ['admin', 'kinder', 'school'],
    'class:assign_students': ['admin', 'kinder', 'school', 'manager', 'teacher'],

    // 과제 관리 권한
    'assignment:create': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'assignment:read': ['admin', 'kinder', 'school', 'manager', 'teacher', 'student', 'parent'],
    'assignment:update': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'assignment:delete': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'assignment:submit': ['student'],
    'assignment:grade': ['admin', 'kinder', 'school', 'manager', 'teacher'],

    // 보고서 권한
    'report:view_all': ['admin', 'kinder', 'school'],
    'report:view_center': ['admin', 'kinder', 'school', 'manager', 'teacher'],
    'report:view_own': ['student', 'parent'],
    'report:export': ['admin', 'kinder', 'school', 'manager', 'teacher'],

    // 결제 관련 권한
    'payment:view': ['admin', 'kinder', 'school', 'parent'],
    'payment:manage': ['admin'],

    // 통계 권한
    'stats:view_all': ['admin'],
    'stats:view_center': ['admin', 'kinder', 'school', 'manager'],
    'stats:view_own': ['student', 'parent']
};

/**
 * 특정 역할이 특정 리소스 권한을 가지고 있는지 확인
 * @param {string} role - 사용자 역할
 * @param {string} permission - 확인할 권한
 * @returns {boolean}
 */
function hasResourcePermission(role, permission) {
    if (!role || !permission) return false;

    // admin은 모든 권한 보유
    if (role === 'admin') return true;

    const allowedRoles = RESOURCE_PERMISSIONS[permission];
    if (!allowedRoles) return false;

    return allowedRoles.includes(role);
}

/**
 * 여러 권한 중 하나라도 있는지 확인
 * @param {string} role - 사용자 역할
 * @param {string[]} permissions - 확인할 권한 배열
 * @returns {boolean}
 */
function hasAnyResourcePermission(role, permissions) {
    if (!role || !permissions || !Array.isArray(permissions)) return false;
    return permissions.some(permission => hasResourcePermission(role, permission));
}

/**
 * 모든 권한을 가지고 있는지 확인
 * @param {string} role - 사용자 역할
 * @param {string[]} permissions - 확인할 권한 배열
 * @returns {boolean}
 */
function hasAllResourcePermissions(role, permissions) {
    if (!role || !permissions || !Array.isArray(permissions)) return false;
    return permissions.every(permission => hasResourcePermission(role, permission));
}

/**
 * 역할 비교 (role1이 role2보다 높은 권한인지)
 * @param {string} role1 - 비교할 역할 1
 * @param {string} role2 - 비교할 역할 2
 * @returns {boolean}
 */
function isHigherRole(role1, role2) {
    const level1 = ROLE_HIERARCHY[role1] || 0;
    const level2 = ROLE_HIERARCHY[role2] || 0;
    return level1 > level2;
}

/**
 * 역할이 동등한지 확인
 * @param {string} role1 - 비교할 역할 1
 * @param {string} role2 - 비교할 역할 2
 * @returns {boolean}
 */
function isEqualRole(role1, role2) {
    const level1 = ROLE_HIERARCHY[role1] || 0;
    const level2 = ROLE_HIERARCHY[role2] || 0;
    return level1 === level2;
}

/**
 * 역할이 동등하거나 높은지 확인
 * @param {string} role1 - 비교할 역할 1
 * @param {string} role2 - 비교할 역할 2
 * @returns {boolean}
 */
function isHigherOrEqualRole(role1, role2) {
    return isHigherRole(role1, role2) || isEqualRole(role1, role2);
}

/**
 * 리소스 소유권 확인 (센터 내에서)
 * @param {number} userId - 사용자 ID
 * @param {number} resourceOwnerId - 리소스 소유자 ID
 * @param {string} userRole - 사용자 역할
 * @returns {boolean}
 */
function canAccessResource(userId, resourceOwnerId, userRole) {
    // 본인 리소스는 항상 접근 가능
    if (userId === resourceOwnerId) return true;

    // admin, kinder, school, manager, teacher는 같은 센터 내 모든 리소스 접근 가능
    if (['admin', 'kinder', 'school', 'manager', 'teacher'].includes(userRole)) return true;

    return false;
}

/**
 * 센터 관리자인지 확인
 * @param {string} role - 사용자 역할
 * @returns {boolean}
 */
function isCenterAdmin(role) {
    return ['kinder', 'school'].includes(role);
}

/**
 * 센터 매니저 이상인지 확인
 * @param {string} role - 사용자 역할
 * @returns {boolean}
 */
function isCenterManager(role) {
    return ['admin', 'kinder', 'school', 'manager', 'teacher'].includes(role);
}

/**
 * 역할별 리소스 권한 목록 반환
 * @param {string} role - 사용자 역할
 * @returns {string[]}
 */
function getRoleResourcePermissions(role) {
    if (role === 'admin') {
        return Object.keys(RESOURCE_PERMISSIONS);
    }

    return Object.keys(RESOURCE_PERMISSIONS).filter(permission =>
        hasResourcePermission(role, permission)
    );
}

/**
 * 역할 변경 가능 여부 확인
 * @param {string} currentRole - 현재 사용자의 역할
 * @param {string} targetCurrentRole - 대상 사용자의 현재 역할
 * @param {string} targetNewRole - 대상 사용자의 새 역할
 * @returns {boolean}
 */
function canChangeRole(currentRole, targetCurrentRole, targetNewRole) {
    // admin은 모든 역할 변경 가능
    if (currentRole === 'admin') return true;

    // kinder/school은 manager, teacher, student, parent 역할 변경 가능
    if (['kinder', 'school'].includes(currentRole)) {
        const allowedTargetRoles = ['manager', 'teacher', 'student', 'parent'];
        return allowedTargetRoles.includes(targetCurrentRole) &&
               allowedTargetRoles.includes(targetNewRole);
    }

    return false;
}

/**
 * 센터 내 사용자 관리 가능 여부 확인
 * @param {string} managerRole - 관리자 역할
 * @param {string} targetRole - 대상 사용자 역할
 * @returns {boolean}
 */
function canManageUserInCenter(managerRole, targetRole) {
    // admin은 모든 사용자 관리 가능
    if (managerRole === 'admin') return true;

    // kinder/school은 manager, teacher, student, parent 관리 가능
    if (['kinder', 'school'].includes(managerRole)) {
        return ['manager', 'teacher', 'student', 'parent'].includes(targetRole);
    }

    // manager/teacher는 student, parent 관리 가능
    if (['manager', 'teacher'].includes(managerRole)) {
        return ['student', 'parent'].includes(targetRole);
    }

    return false;
}

module.exports = {
    ACCESS_POLICIES,
    updatePermissionCache,
    hasPageAccess,
    hasFeatureAccess,
    hasAccess,
    getAccessiblePages,
    debugPermissions,
    // Phase 2 추가
    ROLE_HIERARCHY,
    RESOURCE_PERMISSIONS,
    hasResourcePermission,
    hasAnyResourcePermission,
    hasAllResourcePermissions,
    isHigherRole,
    isEqualRole,
    isHigherOrEqualRole,
    canAccessResource,
    isCenterAdmin,
    isCenterManager,
    getRoleResourcePermissions,
    canChangeRole,
    canManageUserInCenter
};