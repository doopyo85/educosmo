// public/learning-tracker.js

class LearningTracker {
    constructor(contentType, contentName) {
        this.contentType = contentType;
        this.contentName = contentName;
        this.isTracking = false;
        this.startTime = null;
        this.setupBeforeUnload();  // 생성자에서 이벤트 리스너 설정
    }

    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.isTracking) {
                // 동기식 XMLHttpRequest 사용
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/learning/end', false);  // 동기식 요청
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify({
                    content_type: this.contentType,
                    content_name: this.contentName,
                    progress: 100  // 또는 실제 진행률 계산
                }));
            }
        });

        // visibilitychange 이벤트도 추가
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && this.isTracking) {
                this.endTracking();
            }
        });
    }

    async startTracking() {
        try {
            console.log('학습 추적 시작 시도:', {
                contentType: this.contentType,
                contentName: this.contentName
            });
    
            const response = await fetch('/learning/start', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    content_type: this.contentType,
                    content_name: this.contentName
                })
            });
    
            console.log('API 응답 상태:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API 오류 응답:', errorText);
                return;
            }
    
            const data = await response.json();
            if (data.success) {
                this.isTracking = true;
                this.startTime = new Date();
                console.log('학습 추적 시작 성공:', this.contentType, this.contentName);
            } else {
                console.error('학습 추적 시작 실패:', data.error);
            }
        } catch (error) {
            console.error('학습 추적 시작 중 오류 발생:', error);
        }
    }

    async endTracking(progress = 0) {
        if (!this.isTracking) {
            console.log('추적이 시작되지 않았습니다.');
            return;
        }

        try {
            console.log('학습 추적 종료 시도', {
                contentType: this.contentType,
                contentName: this.contentName,
                progress: progress
            });

            const response = await fetch('/learning/end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    content_type: this.contentType,
                    content_name: this.contentName,
                    progress: progress
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('종료 API 오류 응답:', errorText);
                throw new Error(`종료 API 오류: ${errorText}`);
            }

            const data = await response.json();
            if (data.success) {
                this.isTracking = false;
                console.log('학습 추적 종료됨:', this.contentName);
            } else {
                console.error('학습 추적 종료 실패:', data.error);
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('학습 추적 종료 중 오류 발생:', error);
            throw error;
        }
    }
}
