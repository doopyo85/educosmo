/**
 * Resource-Based Permission System for MyUniverse
 * 
 * Defines granular permissions for resources (center, blog, post, etc.)
 * and provides helper functions to check them.
 */

const RESOURCE_PERMISSIONS = {
    // Center Resources
    'center:create': ['admin', 'manager'],
    'center:read': ['admin', 'manager', 'teacher', 'student', 'kinder'], // Public read part of it, strict check in logic
    'center:update': ['admin', 'manager'], // Owner check needed
    'center:delete': ['admin'],
    'center:invite': ['admin', 'manager', 'teacher'],

    // Blog Resources
    'blog:create': ['admin', 'manager', 'teacher', 'student'], // Everyone can create a blog
    'blog:read': ['guest', 'student', 'teacher', 'manager', 'admin'],
    'blog:update': ['owner'], // Dynamic role
    'blog:delete': ['admin', 'owner'],

    // Post Resources
    'post:create': ['owner', 'admin'],
    'post:read': ['guest', 'student', 'teacher', 'manager', 'admin'],
    'post:update': ['owner', 'admin'],
    'post:delete': ['owner', 'admin'],

    // Education Content (B2B SaaS Barrier)
    'education:access': ['center_student', 'center_admin', 'admin'] // Only center members or admin
};

/**
 * Check if a user has permission for a specific resource action.
 * @param {Object} user - The user object from session/token
 * @param {String} action - The action string (e.g., 'center:create')
 * @param {Object} resource - Optional resource object to check ownership
 * @returns {Boolean}
 */
function hasResourcePermission(user, action, resource = null) {
    if (!user) return false;
    if (user.role === 'admin') return true; // Super admin

    const allowedRoles = RESOURCE_PERMISSIONS[action];

    // 1. Basic Role Check
    if (!allowedRoles) {
        console.warn(`[Permission] Undefined action: ${action}`);
        return false;
    }

    // 2. Special Case: Owner Check
    if (allowedRoles.includes('owner')) {
        if (isResourceOwner(user, resource)) return true;
    }

    // 3. Special Case: Education Access (SaaS Check)
    if (action === 'education:access') {
        const isCenterMember = ['center_student', 'center_admin'].includes(user.account_type);
        if (allowedRoles.includes('center_student') && isCenterMember) return true;
        // Basic user role check fallback
        if (allowedRoles.includes(user.role)) return true;
        return false;
    }

    // 4. Standard Role Check
    return allowedRoles.includes(user.role);
}

/**
 * Helper to determine ownership
 */
function isResourceOwner(user, resource) {
    if (!resource) return false;

    // Check specific resource types
    if (resource.user_id && resource.user_id === user.id) return true; // Generic user ownership
    if (resource.created_by && resource.created_by === user.id) return true; // Creator ownership
    if (resource.centerID && resource.centerID === user.centerID && user.role === 'manager') return true; // Center Manager ownership

    return false;
}

module.exports = {
    RESOURCE_PERMISSIONS,
    hasResourcePermission
};
