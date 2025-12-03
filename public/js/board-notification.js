/**
 * 게시판 새 글 알림 시스템
 * 코딩앤플레이 프로젝트
 */

class BoardNotification {
    constructor() {
        this.checkInterval = 5 * 60 * 1000; // 5분
        this.intervalId = null;
        this.isInitialized = false;
        
        this.init();
    }

    /**
     * 초기화
     */
    init() {
        if (this.isInitialized) return;
        
        // DOM 로드 완료 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
        
        this.isInitialized = true;
    }

    /**
     * 알림 시스템 시작
     */
    start() {
        // 로그인한 사용자만 체크
        if (!this.isLoggedIn()) {
            return;
        }

        // 첫 번째 체크
        this.checkNewPosts();
        
        // 주기적 체크 시작
        this.startPeriodicCheck();
        
        // 페이지 포커스 시 체크
        this.setupFocusCheck();
        
        console.log('게시판 알림 시스템이 시작되었습니다.');
    }

    /**
     * 로그인 상태 확인
     */
    isLoggedIn() {
        const userID = document.getElementById('currentUserID')?.value;
        return userID && userID !== '게스트';
    }

    /**
     * 게시판으로 이동
     */
    goToBoard() {
        // 방문 기록 업데이트
        this.updateBoardVisit();
        // 게시판으로 이동
        window.location.href = '/board';
    }

    /**
     * 새 글 개수 확인
     */
    async checkNewPosts() {
        if (!this.isLoggedIn()) {
            return;
        }

        try {
            const response = await fetch('/api/board/new-posts-count', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateNewPostBadge(data.count);
            } else {
                console.warn('새 글 개수 확인 실패:', response.status);
            }
        } catch (error) {
            console.error('새 글 개수 확인 중 오류:', error);
        }
    }

    /**
     * 새 글 뱃지 업데이트
     */
    updateNewPostBadge(count) {
        const badge = document.getElementById('newPostBadge');
        if (!badge) {
            console.warn('새 글 뱃지 요소를 찾을 수 없습니다.');
            return;
        }

        if (count > 0) {
            // 뱃지 텍스트 설정
            badge.textContent = count > 99 ? '99+' : count.toString();
            
            // 뱃지 표시 및 애니메이션
            badge.classList.add('show', 'pulse');
            
            // 아이콘 버튼에 알림 효과 추가
            const iconBtn = document.querySelector('.board-icon-btn');
            if (iconBtn) {
                iconBtn.style.color = '#007bff';
            }
            
            console.log(`새 글 ${count}개가 있습니다.`);
        } else {
            // 뱃지 숨김
            badge.classList.remove('show', 'pulse');
            
            // 아이콘 버튼 색상 원래대로
            const iconBtn = document.querySelector('.board-icon-btn');
            if (iconBtn) {
                iconBtn.style.color = '';
            }
        }
    }

    /**
     * 게시판 방문 기록 업데이트
     */
    async updateBoardVisit() {
        if (!this.isLoggedIn()) {
            return;
        }

        try {
            const response = await fetch('/api/board/update-visit', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // 방문 기록 업데이트 후 뱃지 숨김
                this.updateNewPostBadge(0);
                console.log('게시판 방문 기록이 업데이트되었습니다.');
            } else {
                console.warn('게시판 방문 기록 업데이트 실패:', response.status);
            }
        } catch (error) {
            console.error('게시판 방문 기록 업데이트 중 오류:', error);
        }
    }

    /**
     * 주기적 체크 시작
     */
    startPeriodicCheck() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        this.intervalId = setInterval(() => {
            this.checkNewPosts();
        }, this.checkInterval);
    }

    /**
     * 주기적 체크 중지
     */
    stopPeriodicCheck() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * 페이지 포커스 시 체크 설정
     */
    setupFocusCheck() {
        let isVisible = true;

        // 페이지 가시성 변경 감지
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                isVisible = false;
                this.stopPeriodicCheck();
            } else {
                isVisible = true;
                this.checkNewPosts(); // 즉시 체크
                this.startPeriodicCheck(); // 주기적 체크 재시작
            }
        });

        // 윈도우 포커스 감지 (대안)
        window.addEventListener('focus', () => {
            if (!isVisible) {
                isVisible = true;
                this.checkNewPosts();
                this.startPeriodicCheck();
            }
        });

        window.addEventListener('blur', () => {
            isVisible = false;
            this.stopPeriodicCheck();
        });
    }

    /**
     * 알림 시스템 종료
     */
    destroy() {
        this.stopPeriodicCheck();
        this.isInitialized = false;
        console.log('게시판 알림 시스템이 종료되었습니다.');
    }
}

// 알림 시스템 인스턴스 생성 및 전역 등록
window.boardNotification = new BoardNotification();