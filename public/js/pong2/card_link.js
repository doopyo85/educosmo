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

    setupMainMenuListeners() {
        const links = document.querySelectorAll('.mode-icons .icon-btn');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                links.forEach(l => l.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                const mode = target.dataset.mode;
                this.switchMode(mode);
            });
        });
    }

    async switchMode(mode) {
        this.currentMode = mode;
        this.showLoading();

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
            if (mode === 'portal') {
                const data = await window.googleSheetsAPI.getData('PORTAL');
                this.currentData = data;
                this.extractCategoriesForPortal(data);
            }
            else if (mode === 'community') {
                const boards = await window.pong2API.getBoards('community', 50);
                this.currentData = boards;
                this.categories = new Set(['전체글', '공지사항']);
            }
            else if (mode === 'youtube') {
                const data = await window.googleSheetsAPI.getData('YOUTUBE');
                this.currentData = data.map(row => {
                    if (!row[1] || row[1].trim() === '') row[1] = row[6] || 'YouTube Video';
                    if (!row[4] || row[4].trim() === '') {
                        const ytId = this.extractYouTubeId(row[3]);
                        if (ytId) row[4] = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
                    }
                    return row;
                });
                this.extractCategoriesForPortal(this.currentData);
            }
            else if (mode === 'portfolio') {
                const boards = await window.pong2API.getBoards('portfolio', 50);
                this.currentData = boards;
                this.categories = new Set(['Student Works']);
            }

            if (['community', 'portfolio'].includes(mode)) {
                this.renderCommunityList();
            } else {
                this.createTabs();
                this.renderTabContents();
            }

        } catch (error) {
            console.error('Mode switch error:', error);
            this.showError(error.message);
        }
    }

    // ==========================================
    // Community & Portfolio Logic
    // ==========================================

    renderCommunityList() {
        const container = document.getElementById('content-container');
        if (!container) return;

        let html = `
            <div class="d-flex justify-content-between align-items-center mb-4 text-white">
                <h2 class="fw-bold">${this.currentMode === 'portfolio' ? 'Student Portfolio' : 'Community Board'}</h2>
                ${this.currentMode === 'community' ?
                `<button class="btn btn-primary" onclick="window.cardManager.renderWritePage()">
                     <i class="bi bi-pencil-square me-2"></i>글쓰기
                   </button>` : ''}
            </div>
            <div class="row">
        `;

        if (this.currentData.length === 0) {
            html += '<div class="col-12 text-center text-muted p-5">게시글이 없습니다.</div>';
        } else {
            html += this.currentData.map(post => {
                const date = new Date(post.created).toLocaleDateString();
                const clickAction = `window.cardManager.showPostDetail(${post.id})`;
                let thumbUrl = post.content && post.content.match(/<img[^>]+src="([^">]+)"/)
                    ? post.content.match(/<img[^>]+src="([^">]+)"/)[1]
                    : '/resource/default-image.png';

                return `
                    <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                        <div class="card h-100 shadow-sm border-0" onclick="${clickAction}" style="cursor:pointer; transition: transform 0.2s;">
                            <img src="${thumbUrl}" class="card-img-top object-fit-cover" style="height: 160px;" alt="${post.title}" 
                                 onerror="this.src='/resource/default-image.png'">
                            <div class="card-body">
                                <h6 class="card-title fw-bold text-truncate">${post.title}</h6>
                                <p class="card-text small text-secondary mb-2">
                                    <i class="bi bi-person me-1"></i>${post.author}
                                </p>
                                <div class="d-flex justify-content-between small text-muted">
                                    <span>${date}</span>
                                    <span><i class="bi bi-eye me-1"></i>${post.views || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.card').forEach(card => {
            card.onmouseenter = () => card.style.transform = 'translateY(-5px)';
            card.onmouseleave = () => card.style.transform = 'translateY(0)';
        });
    }

    async showPostDetail(id) {
        this.showLoading();
        try {
            const result = await window.pong2API.getPost(id);
            const post = result.post;
            const container = document.getElementById('content-container');
            const date = new Date(post.created).toLocaleString();

            container.innerHTML = `
                <div class="card shadow-lg border-0 rounded-4 overflow-hidden">
                    <div class="card-header bg-white border-bottom p-4">
                        <div class="d-flex justify-content-between align-items-start">
                             <h2 class="fw-bold mb-0 text-dark">${post.title}</h2>
                             <button class="btn btn-outline-secondary btn-sm" onclick="window.cardManager.switchMode('${this.currentMode}')">
                                <i class="bi bi-x-lg"></i>
                             </button>
                        </div>
                        <div class="text-muted small mt-2">
                            <span class="me-3"><i class="bi bi-person-circle me-1"></i> ${post.author}</span>
                            <span class="me-3"><i class="bi bi-calendar3 me-1"></i> ${date}</span>
                            <span><i class="bi bi-eye me-1"></i> ${post.views}</span>
                        </div>
                    </div>
                    <div class="card-body p-4 bg-light" style="min-height: 400px;">
                        <div class="post-content text-dark">
                            ${post.content}
                        </div>
                    </div>
                    <div class="card-footer bg-white p-3 text-end">
                        <button class="btn btn-secondary px-4" onclick="window.cardManager.switchMode('${this.currentMode}')">목록으로</button>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(error);
            this.showError('게시글을 불러오는데 실패했습니다.');
        }
    }

    async renderWritePage() {
        const user = window.pong2API.getCurrentUser();
        if (!user) {
            alert('로그인이 필요한 서비스입니다.');
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
            return;
        }

        const container = document.getElementById('content-container');
        container.innerHTML = `
            <div class="card shadow border-0">
                <div class="card-body p-4">
                    <h3 class="fw-bold mb-4 text-dark">글쓰기</h3>
                    <form id="pong2-post-form">
                        <div class="mb-3">
                            <input type="text" id="post-title" class="form-control form-control-lg" placeholder="제목을 입력하세요" required>
                        </div>
                        <div class="mb-3">
                            <div id="editor"></div>
                        </div>
                        <div class="text-end">
                            <button type="button" class="btn btn-secondary me-2" onclick="window.cardManager.switchMode('community')">취소</button>
                            <button type="submit" class="btn btn-primary px-4">등록</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        if (typeof ClassicEditor === 'undefined') {
            await this.loadCKEditor();
        }

        try {
            this.editor = await ClassicEditor.create(document.querySelector('#editor'), {
                toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote'],
                placeholder: '내용을 즐겁게 작성해주세요!'
            });
            document.querySelector('.ck-editor__editable').style.minHeight = '300px';
            document.querySelector('.ck-editor__editable').style.color = 'black';
            this.setupWritePostListeners();
        } catch (error) {
            console.error('Editor init error:', error);
            this.showError('에디터 로딩 실패');
        }
    }

    loadCKEditor() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.ckeditor.com/ckeditor5/39.0.1/classic/ckeditor.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setupWritePostListeners() {
        const form = document.getElementById('pong2-post-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('post-title').value;
            const content = this.editor.getData();

            if (!title.trim() || !content.trim()) {
                alert('제목과 내용을 모두 입력해주세요.');
                return;
            }

            try {
                const result = await window.pong2API.createPost(title, content, 'PONG2');
                if (result.success) {
                    await this.switchMode('community');
                } else {
                    alert('글 등록 실패: ' + result.error);
                }
            } catch (error) {
                console.error(error);
                alert('오류가 발생했습니다.');
            }
        });
    }

    extractYouTubeId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    extractCategoriesForPortal(data) {
        this.categories.clear();
        data.forEach(row => {
            const category = row[0] || '기타';
            this.categories.add(category);
        });
    }

    extractTags(category) {
        const tags = new Set();
        const categoryData = this.currentData.filter(row => (row[0] || '기타') === category);
        categoryData.forEach(row => {
            if (row[5]) {
                const rowTags = row[5].split(',').map(t => t.trim());
                rowTags.forEach(t => tags.add(t));
            }
        });
        return Array.from(tags).sort();
    }

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
            const icon = this.getCategoryIcon(category);
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
        let iconName = 'bi-caret-right-fill';
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

        if (this.currentMode === 'youtube') {
            const cards = this.createSwiperSlidesForYouTube();
            container.innerHTML = `
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
            this.initSwiper();
            return;
        }

        const contentHTML = Array.from(this.categories).map((category, index) => {
            const tabId = `tab-${this.sanitizeId(category)}`;
            const tags = this.extractTags(category);
            const tagFilterHTML = this.createTagFilterHTML(category, tags);
            const cards = this.createCardsForCategory(category, null);

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

        container.innerHTML = contentHTML;
        this.attachTagListeners();
    }

    initSwiper() {
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
                const container = e.target.closest('.tag-container');
                container.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
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
            if (linkUrl !== '#' && !linkUrl.startsWith('http')) linkUrl = 'https://' + linkUrl;
            const tags = row[5] ? row[5].split(',').map(t => `<span class="badge bg-light text-secondary border me-1">#${t.trim()}</span>`).join('') : '';
            const clickAction = `window.open('${linkUrl}', '_blank')`;

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
            if (linkUrl !== '#' && !linkUrl.startsWith('http')) linkUrl = 'https://' + linkUrl;
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
            player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            modalEl.addEventListener('hidden.bs.modal', () => {
                player.src = '';
            });
        }
    }

    sanitizeId(str) {
        return str.replace(/[^a-zA-Z0-9가-힣]/g, '-').toLowerCase();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cardManager = new CardLinkManager();
    window.cardManager.init();
});
