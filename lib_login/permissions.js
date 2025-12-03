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

module.exports = {
    ACCESS_POLICIES,
    updatePermissionCache,
    hasPageAccess,
    hasFeatureAccess,
    hasAccess,
    getAccessiblePages,
    debugPermissions
};