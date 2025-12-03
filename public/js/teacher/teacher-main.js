const TeacherMain = {
    currentPage: 'student-management',
    
    init() {
        this.bindEvents();
        this.loadPage('student-management');
    },
    
    bindEvents() {
        $('.menu-item').on('click', (e) => {
            e.preventDefault();
            const $item = $(e.currentTarget);
            const page = $item.data('page');
            
            // 메뉴 활성화
            $('.menu-item').removeClass('active');
            $item.addClass('active');
            
            // 페이지 로드
            this.loadPage(page);
        });
    },
    
    async loadPage(page) {
        this.currentPage = page;
        const $container = $('#content-container');
        
        // 로딩 표시
        $container.html(`
            <div class="loading-message">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `);
        
        try {
            const response = await fetch(`/teacher/${page}`);
            
            if (response.ok) {
                const html = await response.text();
                $container.html(html);
                
                // 페이지별 초기화
                this.initPageScript(page);
            } else {
                throw new Error('페이지를 불러올 수 없습니다.');
            }
        } catch (error) {
            console.error('페이지 로드 오류:', error);
            $container.html(`
                <div class="empty-content-message">
                    <i class="bi bi-exclamation-triangle fs-1 text-danger"></i>
                    <p class="mt-3">페이지를 불러올 수 없습니다.</p>
                </div>
            `);
        }
    },
    
    initPageScript(page) {
        switch(page) {
            case 'student-management':
                if (window.StudentManagement) {
                    window.StudentManagement.init();
                }
                break;
            case 'student-progress':
                if (window.StudentProgress) {
                    window.StudentProgress.init();
                }
                break;
            case 'teaching-materials':
                if (window.TeachingMaterials) {
                    window.TeachingMaterials.init();
                }
                break;
            case 'career-info':
                if (window.CareerInfo) {
                    window.CareerInfo.init();
                }
                break;
        }
    }
};

$(document).ready(() => {
    TeacherMain.init();
});