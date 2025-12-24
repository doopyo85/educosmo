/**
 * 카드 링크 관리자 (v2.0 - 2-Tier Navigation)
 * Main Menu (Portal, Community, YouTube, Portfolio) switching logic
 */

class CardLinkManager {
    constructor() {
        this.currentMode = 'portal'; // portal, community, youtube, portfolio
        this.currentData = []; // Data for current mode
        this.categories = new Set();
    }

    /**
     * 초기화
     */
    async init() {
        console.log('CardLinkManager v2 Init');
        this.setupMainMenuListeners();

        // Default Load: Portal
        await this.switchMode('portal');
    }

    /**
     * 메인 메뉴 이벤트 리스너 설정
     */
    setupMainMenuListeners() {
        // Changed selector to match new index.html structure
        const links = document.querySelectorAll('.mode-icons .icon-btn');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // UI Update
                links.forEach(l => l.classList.remove('active'));

                // Handle click on icon or container
                const target = e.currentTarget;
                target.classList.add('active');

                const mode = target.dataset.mode;
                this.switchMode(mode);
            });
        });
    }

    /**
     * 모드 전환 및 데이터 로드
     */
    async switchMode(mode) {
        this.currentMode = mode;
        this.showLoading();

        // Update Sub-menu Title
        const titleEl = document.querySelector('.sub-menu-title');
        if (titleEl) {
            const titles = {
                'portal': '학습 카테고리',
                'community': '게시판 목록',
                'youtube': '추천 채널',
                'portfolio': '작품 갤러리'
            };
            titleEl.textContent = titles[mode] || '메뉴';
        }

        try {
            // Load Data based on Mode
            if (mode === 'portal') {
                // Portal: Fetch from Google Sheet (Tab 1)
                const data = await window.googleSheetsAPI.getData('PORTAL');
                this.currentData = data;
                this.extractCategoriesForPortal(data);
            }
            else if (mode === 'community') {
                // Community: Fetch Boards from API
                const boards = await window.pong2API.getBoards('community', 50);
                this.currentData = boards.map(b => [
                    '전체글',
                    b.title,
                    `작성자: ${b.author} | 조회수: ${b.views}`,
                    `/boards/${b.id}`,
                    '/resource/default-image.png'
                ]);
                this.categories = new Set(['전체글', '공지사항']);
            }
            else if (mode === 'youtube') {
                // YouTube: Fetch from Google Sheet (Tab 2 - pongtube)
                // Columns: [0]Category, [1]Title, [2]Desc, [3]URL, [4]ImgURL, [5]Tags, [6]Note
                const data = await window.googleSheetsAPI.getData('YOUTUBE');

                // Pre-process data for YouTube specifics
                this.currentData = data.map(row => {
                    // 1. Title Fallback: Title -> Note -> "YouTube Video"
                    if (!row[1] || row[1].trim() === '') {
                        row[1] = row[6] || 'YouTube Video';
                    }

                    // 2. Thumbnail Auto-generation
                    if (!row[4] || row[4].trim() === '') {
                        const ytId = this.extractYouTubeId(row[3]);
                        if (ytId) {
                            row[4] = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
                        }
                    }
                    return row;
                });

                this.extractCategoriesForPortal(this.currentData);
            }
            else if (mode === 'portfolio') {
                // Feature 4: Portfolio
                const boards = await window.pong2API.getBoards('portfolio', 50);
                this.currentData = boards.map(b => [
                    'Student Works',
                    b.title,
                    `Made by ${b.author}`,
                    `/boards/${b.id}`,
                    '/resource/default-image.png'
                ]);
                this.categories = new Set(['Student Works']);
            }

            // Render
            this.createTabs();
            this.renderTabContents();

            // Auto-select first tab
            const firstTab = document.querySelector('#categoryTabs .nav-link');
            if (firstTab) firstTab.click();

        } catch (error) {
            console.error('Mode switch error:', error);
            this.showError(error.message);
        }
    }

    /**
     * Extract YouTube ID from URL (Standard, Short, etc.)
     */
    extractYouTubeId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    /**
     * 포털용 카테고리 추출 (기존 로직)
     */
    extractCategoriesForPortal(data) {
        this.categories.clear();
        data.forEach(row => {
            const category = row[0] || '기타';
            this.categories.add(category);
        });
    }

    /**
     * Extracts unique tags from current data (Column index 5)
     */
    extractTags(category) {
        const tags = new Set();
        const categoryData = this.currentData.filter(row => (row[0] || '기타') === category);

        categoryData.forEach(row => {
            // Tags are in index 5, comma separated
            if (row[5]) {
                const rowTags = row[5].split(',').map(t => t.trim());
                rowTags.forEach(t => {
                    if (t) tags.add(t);
                });
            }
        });
        return Array.from(tags).sort();
    }

    // --- (이하 기존 Card Render 로직 재사용) ---

    showLoading() {
        const container = document.getElementById('content-container');
        if (container) {
            container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-warning"></div></div>';
        }
    }

    showError(msg) {
        const container = document.getElementById('content-container');
        if (container) container.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
    }

    createTabs() {
        const tabContainer = document.getElementById('categoryTabs');
        if (!tabContainer) return;

        const tabs = Array.from(this.categories).map((category, index) => {
            const tabId = `tab-${this.sanitizeId(category)}`;
            const icon = this.getCategoryIcon(category); // Optional: Add icons based on category name

            return `
                <li class="nav-item">
                    <button class="nav-link w-100 text-start" 
                            id="${tabId}-tab" 
                            data-bs-toggle="tab" 
                            data-bs-target="#${tabId}" 
                            type="button">
                        ${icon} ${category}
                    </button>
                </li>
            `;
        }).join('');

        tabContainer.innerHTML = tabs;
    }

    getCategoryIcon(category) {
        // Simple mapping for icons
        let iconName = 'bi-caret-right-fill'; // Default

        if (category.includes('마우스')) iconName = 'bi-mouse';
        else if (category.includes('키보드')) iconName = 'bi-keyboard';
        else if (category.includes('엔트리')) iconName = 'bi-code-square';
        else if (category.includes('유튜브')) iconName = 'bi-youtube';
        else if (category.includes('코딩 퀴즈')) iconName = 'bi-puzzle-fill';
        else if (category.includes('아케이드')) iconName = 'bi-controller';
        else if (category.includes('메타버스')) iconName = 'bi-globe';
        else if (category.includes('크리에이터')) iconName = 'bi-brush';
        else if (category.includes('머신러닝')) iconName = 'bi-cpu';
        else if (category.includes('오피스')) iconName = 'bi-file-earmark-text';
        else if (category.includes('데이터과학')) iconName = 'bi-bar-chart-fill';

        return `<i class="bi ${iconName} me-2"></i>`;
    }

    renderTabContents() {
        const container = document.getElementById('content-container');
        if (!container) return;

        const contentHTML = Array.from(this.categories).map((category, index) => {
            const tabId = `tab-${this.sanitizeId(category)}`;
            const tags = this.extractTags(category);
            const tagFilterHTML = this.createTagFilterHTML(category, tags);
            const cards = this.createCardsForCategory(category, null); // Initially no tag filter

            return `
                <div class="tab-pane fade" id="${tabId}">
                    <div class="row">
                        <div class="col-12 mb-3">
                            <h4 class="fw-bold">${category} <span class="badge bg-warning text-dark fs-6 align-middle ms-2">LIST</span></h4>
                        </div>
                        ${tagFilterHTML}
                        <div class="row" id="cards-${this.sanitizeId(category)}">
                            ${cards}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Special handling for YouTube Mode: Single Swiper Container ALL Content
        if (this.currentMode === 'youtube') {
            // For YouTube, we ignore tabs for now or treat "ALL" as the main view
            // Aggregate all cards into one Swiper for the intuitive "Coverflow" feel.

            const cards = this.createSwiperSlidesForYouTube();

            contentHTML = `
                <div class="col-12 text-center mb-4">
                    <h2 class="fw-bold text-white">PongTube <span class="badge bg-danger">Shorts</span></h2>
                </div>
                <div class="swiper pongtube-swiper pongtube-container">
                    <div class="swiper-wrapper">
                        ${cards}
                    </div>
                    <div class="swiper-pagination"></div>
                </div>
             `;
        }

        container.innerHTML = contentHTML;
        this.attachTagListeners();

        // Initialize Swiper if we are in YouTube mode
        if (this.currentMode === 'youtube') {
            this.initSwiper();
        }
    }

    initSwiper() {
        // Destroy existing instance if any (though currently we re-render full HTML)

        // Initialize Swiper with 3D Coverflow effect
        new Swiper('.pongtube-swiper', {
            effect: 'coverflow',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 'auto',
            coverflowEffect: {
                rotate: 50,
                stretch: 0,
                depth: 100,
                modifier: 1,
                slideShadows: true,
            },
            pagination: {
                el: '.swiper-pagination',
            },
            // Initial slide to center
            initialSlide: 1,
        });
    }

    createTagFilterHTML(category, tags) {
        if (!tags || tags.length === 0) return '';

        const tagButtons = tags.map(tag =>
            `<button class="tag-btn" data-category="${category}" data-tag="${tag}">#${tag}</button>`
        ).join('');

        return `
            <div class="col-12">
                <div class="tag-container">
                    <button class="tag-btn active" data-category="${category}" data-tag="ALL">ALL</button>
                    ${tagButtons}
                </div>
            </div>
        `;
    }

    attachTagListeners() {
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                const tag = e.target.dataset.tag;

                // Update active state
                const container = e.target.closest('.tag-container');
                container.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Filter cards
                const cardContainer = document.getElementById(`cards-${this.sanitizeId(category)}`);
                if (cardContainer) {
                    cardContainer.innerHTML = this.createCardsForCategory(category, tag === 'ALL' ? null : tag);
                }
            });
        });
    }

    createCardsForCategory(category, filterTag) {
        let filtered = this.currentData.filter(row => (row[0] || '기타') === category);

        if (filterTag) {
            filtered = filtered.filter(row => {
                const tags = row[5] ? row[5].split(',').map(t => t.trim()) : [];
                return tags.includes(filterTag);
            });
        }

        if (filtered.length === 0) {
            return '<div class="col-12 text-center text-muted p-5">콘텐츠가 없습니다.</div>';
        }

        return filtered.map(row => {
            const title = row[1];
            const description = row[2];
            let linkUrl = row[3] || '#';
            const imageUrl = row[4];

            // Fix Protocol
            if (linkUrl !== '#' && !linkUrl.startsWith('http')) {
                linkUrl = 'https://' + linkUrl;
            }

            const tags = row[5] ? row[5].split(',').map(t => `<span class="badge bg-light text-secondary border me-1">#${t.trim()}</span>`).join('') : '';

            // Click Handler
            let clickAction = '';
            if (this.currentMode === 'youtube') {
                const videoId = this.extractYouTubeId(linkUrl);
                if (videoId) {
                    clickAction = `window.cardManager.openVideoModal('${videoId}')`;
                } else {
                    clickAction = `window.open('${linkUrl}', '_blank')`;
                }
            } else {
                clickAction = `window.open('${linkUrl}', '_blank')`;
            }

            return `
                <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                    <div class="card h-100 shadow-sm" onclick="${clickAction}">
                         <img src="${imageUrl}" class="card-img-top object-fit-cover" alt="${title}" 
                              onerror="this.src='/resource/default-image.png'">
                        <div class="card-body">
                            <h6 class="card-title fw-bold text-truncate">${title}</h6>
                            <p class="card-text small text-secondary three-line-clamp mb-2">${description}</p>
                            <div class="mt-auto">${tags}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    createSwiperSlidesForYouTube() {
        if (this.currentData.length === 0) {
            return '<div class="swiper-slide text-white">콘텐츠가 없습니다.</div>';
        }

        return this.currentData.map(row => {
            const title = row[1];
            const description = row[2] || '';
            let linkUrl = row[3] || '#';
            const imageUrl = row[4];

            // Fix Protocol
            if (linkUrl !== '#' && !linkUrl.startsWith('http')) {
                linkUrl = 'https://' + linkUrl;
            }

            const videoId = this.extractYouTubeId(linkUrl);
            const clickAction = videoId
                ? `window.cardManager.openVideoModal('${videoId}')`
                : `window.open('${linkUrl}', '_blank')`;

            return `
                <div class="swiper-slide pongtube-slide" onclick="${clickAction}">
                    <img src="${imageUrl}" alt="${title}" onerror="this.src='/resource/default-image.png'">
                    <div class="slide-overlay">
                        <h5 class="text-truncate">${title}</h5>
                        <p class="text-truncate">${description}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    openVideoModal(videoId) {
        const modalEl = document.getElementById('videoModal');
        const player = document.getElementById('videoPlayer');
        if (modalEl && player) {
            // rel=0 strictly limits related videos to the same channel
            player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

            // Stop video on close
            modalEl.addEventListener('hidden.bs.modal', () => {
                player.src = '';
            });
        }
    }

    sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9가-힣]/g, '-').toLowerCase();
    }

    /**
     * Extract YouTube ID from URL (Standard, Short, etc.)
     */
    extractYouTubeId(url) {
        if (!url) return null;
        // Updated Regex to support shorts
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cardManager = new CardLinkManager();
    window.cardManager.init();
});
