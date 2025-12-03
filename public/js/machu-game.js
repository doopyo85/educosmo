// 마추기 게임 메인 페이지 JavaScript

class MachuGame {
    constructor() {
        this.series = [];
        this.init();
    }

    async init() {
        console.log('마추기 게임 초기화 시작');
        await this.loadSeries();
    }

    async loadSeries() {
        const loadingSpinner = document.getElementById('loading-spinner');
        const errorMessage = document.getElementById('error-message');
        const seriesContainer = document.getElementById('series-container');

        try {
            console.log('시리즈 목록 로딩 중...');
            
            const response = await fetch('/machu/api/series');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || '시리즈 목록을 불러올 수 없습니다.');
            }

            this.series = data.data;
            console.log('시리즈 로드 완료:', this.series.length);

            this.renderSeries();
            
            // UI 업데이트
            loadingSpinner.classList.add('d-none');
            seriesContainer.classList.remove('d-none');

        } catch (error) {
            console.error('시리즈 로딩 오류:', error);
            
            // 에러 표시
            loadingSpinner.classList.add('d-none');
            errorMessage.classList.remove('d-none');
            document.getElementById('error-text').textContent = error.message;
        }
    }

    renderSeries() {
        const container = document.getElementById('series-container');
        container.innerHTML = '';

        if (this.series.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info text-center">
                        <i class="bi bi-info-circle"></i>
                        아직 등록된 시리즈가 없습니다.
                    </div>
                </div>
            `;
            return;
        }

        this.series.forEach(series => {
            const cardHtml = this.createSeriesCard(series);
            container.appendChild(cardHtml);
        });
    }

    createSeriesCard(series) {
        const col = document.createElement('div');
        col.className = 'col-lg-3 col-md-4 col-sm-6 col-12';

        const thumbnailUrl = series.thumbnail.startsWith('http') 
            ? series.thumbnail 
            : `/resource/machu-thumbnails/${series.thumbnail}`;

        col.innerHTML = `
            <div class="series-card card h-100" onclick="window.location.href='/machu/${series.id}'">
                <div class="card-body">
                    <img src="${thumbnailUrl}" 
                         alt="${series.name}" 
                         class="series-thumbnail"
                         onerror="this.src='/resource/no-image.png'">
                    <h5 class="series-title">${series.name}</h5>
                    <p class="series-description">${series.description}</p>
                    <div class="series-meta">
                        <span class="question-count">${series.questionCount}문제</span>
                        <span class="play-text">
                            <i class="bi bi-play-circle"></i> 플레이
                        </span>
                    </div>
                </div>
            </div>
        `;

        // 카드 클릭 이벤트 추가
        const card = col.querySelector('.series-card');
        card.addEventListener('click', () => {
            this.goToSeries(series.id);
        });

        // 호버 효과 추가
        card.addEventListener('mouseenter', () => {
            card.classList.add('pulse');
        });
        
        card.addEventListener('mouseleave', () => {
            card.classList.remove('pulse');
        });

        return col;
    }

    goToSeries(seriesId) {
        console.log(`시리즈 선택: ${seriesId}`);
        
        // 로딩 효과 추가
        const loadingOverlay = this.createLoadingOverlay();
        document.body.appendChild(loadingOverlay);
        
        // 페이지 이동
        setTimeout(() => {
            window.location.href = `/machu/${seriesId}`;
        }, 500);
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">로딩 중...</span>
            </div>
        `;
        return overlay;
    }

    // 에러 처리
    handleError(error, context = '') {
        console.error(`마추기 게임 에러 ${context}:`, error);
        
        const errorMessage = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        
        if (errorMessage && errorText) {
            errorText.textContent = error.message || '알 수 없는 오류가 발생했습니다.';
            errorMessage.classList.remove('d-none');
        }
    }
}

// 페이지 로드 완료 시 게임 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('마추기 게임 페이지 로드 완료');
    window.machuGame = new MachuGame();
});

// 전역 에러 핸들러
window.addEventListener('error', (event) => {
    console.error('페이지 에러:', event.error);
    if (window.machuGame) {
        window.machuGame.handleError(event.error, '페이지 에러');
    }
});
