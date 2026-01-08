/**
 * Gallery Manager
 * Handles automatic gallery registration for submitted projects
 */

const db = require('../lib_login/db');

/**
 * Auto-register project to gallery when submitted
 * @param {Object} params - Registration parameters
 * @param {number} params.userId - User DB ID
 * @param {string} params.userID - User login ID
 * @param {string} params.platform - Platform (entry/scratch/python)
 * @param {string} params.projectName - Project title
 * @param {string} params.s3Url - S3 file URL
 * @param {string} params.thumbnailUrl - Thumbnail URL (optional)
 * @param {Object} params.analysis - Project analysis data (optional)
 * @param {number} params.projectSubmissionId - ProjectSubmissions ID for linking
 * @returns {Promise<Object>} Gallery project info
 */
async function autoRegisterToGallery({
    userId,
    userID,
    platform,
    projectName,
    s3Url,
    thumbnailUrl = null,
    analysis = {},
    projectSubmissionId = null
}) {
    try {
        console.log('🎨 [Gallery Auto-Register] 시작:', { userID, platform, projectName });

        // Check if already registered
        if (projectSubmissionId) {
            const [existing] = await db.queryDatabase(
                'SELECT id FROM gallery_projects WHERE project_submission_id = ?',
                [projectSubmissionId]
            );

            if (existing) {
                console.log('ℹ️ [Gallery] 이미 등록된 프로젝트:', existing.id);
                return { galleryProjectId: existing.id, isNew: false };
            }
        }

        // Generate embed URL
        const embedUrl = generateEmbedUrl(platform, s3Url);

        // Prepare metadata
        const metadata = {
            blocks_count: analysis.blocks_count || 0,
            sprites_count: analysis.sprites_count || 0,
            complexity: analysis.complexity || 'simple',
            ...analysis
        };

        // Default description based on analysis
        let description = `${platform === 'entry' ? '엔트리' : platform === 'scratch' ? '스크래치' : '파이썬'}로 만든 작품입니다.`;
        if (metadata.blocks_count > 0) {
            description += ` (블록 수: ${metadata.blocks_count}개)`;
        }

        // Insert into gallery_projects
        const insertQuery = `
            INSERT INTO gallery_projects (
                user_id,
                title,
                description,
                platform,
                s3_url,
                thumbnail_url,
                embed_url,
                visibility,
                tags,
                metadata,
                project_submission_id,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const insertParams = [
            userId,
            projectName,
            description,
            platform,
            s3Url,
            thumbnailUrl,
            embedUrl,
            'private', // Default to private, user can change later
            JSON.stringify([]), // Empty tags initially
            JSON.stringify(metadata),
            projectSubmissionId
        ];

        const result = await db.queryDatabase(insertQuery, insertParams);
        const galleryProjectId = result.insertId;

        console.log('✅ [Gallery Auto-Register] 완료: Gallery#', galleryProjectId);

        return {
            galleryProjectId,
            isNew: true,
            visibility: 'private'
        };

    } catch (error) {
        console.error('❌ [Gallery Auto-Register] 실패:', error);
        // Don't throw - gallery registration failure shouldn't block project save
        return { galleryProjectId: null, isNew: false, error: error.message };
    }
}

/**
 * Generate embed URL for player
 * @param {string} platform - Platform name
 * @param {string} s3Url - S3 file URL
 * @returns {string} Embed URL
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
            return `/viewer/?file=${encodedUrl}&platform=${platform}`;
    }
}

module.exports = {
    autoRegisterToGallery,
    generateEmbedUrl
};
