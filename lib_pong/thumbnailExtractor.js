/**
 * 썸네일 자동 추출 유틸리티
 * 방법 A (Open Graph) + 방법 C (플랫폼별 API) 조합
 */

const axios = require('axios');

/**
 * URL에서 썸네일 추출
 * @param {string} url - 프로젝트 URL
 * @returns {Promise<string|null>} - 썸네일 URL 또는 null
 */
async function extractThumbnail(url) {
    if (!url) return null;

    try {
        // 1. 플랫폼별 패턴 확인 (방법 C)
        const platformThumbnail = extractPlatformThumbnail(url);
        if (platformThumbnail) {
            console.log(`✅ Platform thumbnail extracted: ${platformThumbnail}`);
            return platformThumbnail;
        }

        // 2. Open Graph 메타 태그 추출 (방법 A)
        const ogThumbnail = await extractOpenGraphImage(url);
        if (ogThumbnail) {
            console.log(`✅ Open Graph thumbnail extracted: ${ogThumbnail}`);
            return ogThumbnail;
        }

        // 3. 실패 시 null 반환 (프론트엔드에서 기본 이미지 사용)
        console.log(`⚠️ No thumbnail found for: ${url}`);
        return null;

    } catch (error) {
        console.error('Thumbnail extraction error:', error.message);
        return null;
    }
}

/**
 * 플랫폼별 썸네일 URL 생성 (방법 C)
 */
function extractPlatformThumbnail(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname;

        // YouTube
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            const videoId = extractYouTubeId(url);
            if (videoId) {
                return `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
            }
        }

        // Scratch
        if (hostname.includes('scratch.mit.edu')) {
            const projectId = pathname.match(/\/projects\/(\d+)/)?.[1];
            if (projectId) {
                return `https://cdn2.scratch.mit.edu/get_image/project/${projectId}_480x360.png`;
            }
        }

        // Code.org (studio.code.org)
        if (hostname.includes('studio.code.org')) {
            // Code.org는 특정 패턴이 없으므로 Open Graph에 의존
            return null;
        }

        // Entry (playentry.org)
        if (hostname.includes('playentry.org')) {
            const projectId = pathname.match(/\/project\/([a-zA-Z0-9]+)/)?.[1];
            if (projectId) {
                // Entry 썸네일 URL 패턴
                return `https://playentry.org/uploads/${projectId}.thumb.png`;
            }
        }

        // 기타 플랫폼은 null 반환 (Open Graph로 시도)
        return null;

    } catch (error) {
        console.error('Platform thumbnail extraction error:', error.message);
        return null;
    }
}

/**
 * YouTube 비디오 ID 추출
 */
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Open Graph 이미지 추출 (방법 A)
 */
async function extractOpenGraphImage(url) {
    try {
        // Timeout 설정 (5초)
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            maxRedirects: 5
        });

        const html = response.data;

        // og:image 메타 태그 추출
        const ogImagePatterns = [
            /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
            /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
            /<meta\s+name=["']og:image["']\s+content=["']([^"']+)["']/i
        ];

        for (const pattern of ogImagePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let imageUrl = match[1];

                // 상대 URL을 절대 URL로 변환
                if (imageUrl.startsWith('//')) {
                    imageUrl = 'https:' + imageUrl;
                } else if (imageUrl.startsWith('/')) {
                    const urlObj = new URL(url);
                    imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
                }

                return imageUrl;
            }
        }

        return null;

    } catch (error) {
        // 타임아웃, 네트워크 오류 등은 조용히 실패
        if (error.code === 'ECONNABORTED') {
            console.log('⏱️ Timeout while fetching Open Graph image');
        } else {
            console.log('⚠️ Open Graph extraction failed:', error.message);
        }
        return null;
    }
}

module.exports = {
    extractThumbnail,
    extractPlatformThumbnail,
    extractOpenGraphImage
};
