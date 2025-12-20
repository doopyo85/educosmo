// 마추기 게임 플레이 JavaScript

class MachuPlayGame {
    constructor(seriesId) {
        this.seriesId = seriesId;
        this.currentQuestion = 0;
        this.score = 0;
        this.totalQuestions = 10;
        this.questions = [];
        this.gameSessionId = null;
        this.isGameActive = false;
        
        this.init();
    }

    async init() {
        console.log('마추기 플레이 게임 초기화:', this.seriesId);
        await this.loadSeriesInfo();
        this.setupEventListeners();
    }

    async loadSeriesInfo() {
        try {
            // 시리즈 정보 로드
            const response = await fetch('/machu/api/series');
            const data = await response.json();
            
            if (data.success) {
                const series = data.data.find(s => s.id === this.seriesId);
                if (series) {
                    document.getElementById('series-title').textContent = series.name;
                    document.getElementById('series-description').textContent = series.description;
                    
                    // 전체 문제 수에 따라 옵션 조정
                    const countAllLabel = document.querySelector('label[for="countAll"]');
                    countAllLabel.textContent = `전체 (${series.questionCount}문제)`;
                }
            }
        } catch (error) {
            console.error('시리즈 정보 로드 오류:', error);
        }
    }

    setupEventListeners() {
        // 게임 시작 버튼
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });

        // 답안 제출
        document.getElementById('submit-answer').addEventListener('click', () => {
            this.submitAnswer();
        });

        // Enter 키로 답안 제출
        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitAnswer();
            }
        });

        // 힌트 버튼
        document.getElementById('hint-btn').addEventListener('click', () => {
            this.showHint();
        });

        // 다음 문제 버튼
        document.getElementById('next-question').addEventListener('click', () => {
            this.nextQuestion();
        });

        // 다시 하기 버튼
        document.getElementById('play-again').addEventListener('click', () => {
            this.resetGame();
        });
    }

    async startGame() {
        try {
            this.showLoading(true);
            
            // 선택된 문제 수 가져오기
            const selectedCount = document.querySelector('input[name="questionCount"]:checked').value;
            const questionCount = selectedCount === 'all' ? 999 : parseInt(selectedCount);
            
            console.log(`게임 시작: ${this.seriesId}, 문제 수: ${questionCount}`);
            
            // 랜덤 게임 생성 API 호출
            const response = await fetch(`/machu/api/${this.seriesId}/random-game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ count: questionCount })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || '게임을 시작할 수 없습니다.');
            }
            
            // 게임 데이터 설정
            this.questions = data.questions;
            this.totalQuestions = data.totalQuestions;
            this.gameSessionId = data.gameSessionId;
            this.currentQuestion = 0;
            this.score = 0;
            this.isGameActive = true;
            
            console.log('게임 데이터 로드 완료:', this.questions.length);
            
            // UI 전환
            this.showGameSetup(false);
            this.showGamePlay(true);
            this.loadQuestion();
            
        } catch (error) {
            console.error('게임 시작 오류:', error);
            alert(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    loadQuestion() {
        if (this.currentQuestion >= this.questions.length) {
            this.endGame();
            return;
        }

        const question = this.questions[this.currentQuestion];
        console.log('문제 로드:', this.currentQuestion + 1, question);

        // 이미지 로드
        const questionImage = document.getElementById('question-image');
        questionImage.src = question.imageUrl;
        questionImage.onerror = () => {
            questionImage.src = '/resource/no-image.png';
        };

        // 진행 상황 업데이트
        this.updateProgress();

        // 입력 필드 초기화
        document.getElementById('answer-input').value = '';
        document.getElementById('answer-input').focus();
        
        // 결과 숨기기
        document.getElementById('answer-result').classList.add('d-none');
        
        // 힌트 리셋
        this.resetHint();
    }

    updateProgress() {
        const progressText = document.getElementById('progress-text');
        const scoreText = document.getElementById('score-text');
        const progressBar = document.getElementById('progress-bar');

        progressText.textContent = `${this.currentQuestion + 1} / ${this.totalQuestions}`;
        scoreText.textContent = `점수: ${this.score}`;
        
        const progressPercent = ((this.currentQuestion + 1) / this.totalQuestions) * 100;
        progressBar.style.width = `${progressPercent}%`;
    }

    async submitAnswer() {
        if (!this.isGameActive) return;

        const answerInput = document.getElementById('answer-input');
        const userAnswer = answerInput.value.trim();

        if (!userAnswer) {
            answerInput.focus();
            return;
        }

        try {
            this.showLoading(true);
            
            const question = this.questions[this.currentQuestion];
            
            // 정답 확인 API 호출
            const response = await fetch('/machu/api/check-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    seriesId: this.seriesId,
                    questionId: question.id,
                    userAnswer: userAnswer
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || '답안을 확인할 수 없습니다.');
            }

            // 결과 표시
            this.showAnswerResult(data.correct, data.correctAnswer, userAnswer);
            
            if (data.correct) {
                this.score++;
            }

        } catch (error) {
            console.error('답안 제출 오류:', error);
            alert(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showAnswerResult(isCorrect, correctAnswer, userAnswer) {
        const resultDiv = document.getElementById('answer-result');
        const resultMessage = document.getElementById('result-message');

        if (isCorrect) {
            resultMessage.className = 'alert alert-success';
            resultMessage.innerHTML = `
                <i class="bi bi-check-circle"></i>
                <strong>정답!</strong><br>
                <span class="small">${correctAnswer}</span>
            `;
        } else {
            resultMessage.className = 'alert alert-danger';
            resultMessage.innerHTML = `
                <i class="bi bi-x-circle"></i>
                <strong>오답!</strong><br>
                정답: <strong>${correctAnswer}</strong><br>
                입력: <span class="small">${userAnswer}</span>
            `;
        }

        resultDiv.classList.remove('d-none');
        resultDiv.classList.add('slide-in');

        // 점수 업데이트
        this.updateProgress();
    }

    nextQuestion() {
        this.currentQuestion++;
        this.loadQuestion();
    }

    showHint() {
        const question = this.questions[this.currentQuestion];
        if (!question.hint) {
            alert('이 문제에는 힌트가 없습니다.');
            return;
        }

        const hintBtn = document.getElementById('hint-btn');
        
        // 힌트 표시
        let hintDiv = document.querySelector('.hint-display');
        if (!hintDiv) {
            hintDiv = document.createElement('div');
            hintDiv.className = 'hint-display';
            hintBtn.parentNode.appendChild(hintDiv);
        }
        
        hintDiv.innerHTML = `
            <i class="bi bi-lightbulb-fill"></i>
            <strong>힌트:</strong> ${question.hint}
        `;
        
        // 힌트 버튼 비활성화
        hintBtn.disabled = true;
        hintBtn.innerHTML = '<i class="bi bi-lightbulb-fill"></i> 힌트 사용됨';
    }

    resetHint() {
        const hintBtn = document.getElementById('hint-btn');
        const hintDiv = document.querySelector('.hint-display');
        
        if (hintDiv) {
            hintDiv.remove();
        }
        
        hintBtn.disabled = false;
        hintBtn.innerHTML = '<i class="bi bi-lightbulb"></i> 힌트';
    }

    endGame() {
        console.log('게임 종료, 최종 점수:', this.score);
        
        this.isGameActive = false;
        
        // 결과 화면 데이터 설정
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('total-questions').textContent = this.totalQuestions;
        
        // 결과 메시지
        const percentage = Math.round((this.score / this.totalQuestions) * 100);
        let resultMessage = '';
        
        if (percentage >= 90) {
            resultMessage = '🎉 완벽해요! 밈 마스터입니다!';
        } else if (percentage >= 70) {
            resultMessage = '👏 잘했어요! 밈에 대해 잘 알고 있네요!';
        } else if (percentage >= 50) {
            resultMessage = '👍 괜찮아요! 조금 더 연습해보세요!';
        } else {
            resultMessage = '😅 아직 익숙하지 않군요. 다시 도전해보세요!';
        }
        
        document.getElementById('result-message-text').textContent = resultMessage;
        
        // UI 전환
        this.showGamePlay(false);
        this.showGameResult(true);
    }

    resetGame() {
        this.currentQuestion = 0;
        this.score = 0;
        this.questions = [];
        this.gameSessionId = null;
        this.isGameActive = false;
        
        // UI 초기화
        this.showGameResult(false);
        this.showGameSetup(true);
        
        // 입력 필드 초기화
        document.getElementById('answer-input').value = '';
        document.querySelector('input[name="questionCount"][value="10"]').checked = true;
    }

    // UI 제어 메서드들
    showGameSetup(show) {
        const setupDiv = document.getElementById('game-setup');
        if (show) {
            setupDiv.classList.remove('d-none');
        } else {
            setupDiv.classList.add('d-none');
        }
    }

    showGamePlay(show) {
        const playDiv = document.getElementById('game-play');
        if (show) {
            playDiv.classList.remove('d-none');
        } else {
            playDiv.classList.add('d-none');
        }
    }

    showGameResult(show) {
        const resultDiv = document.getElementById('game-result');
        if (show) {
            resultDiv.classList.remove('d-none');
        } else {
            resultDiv.classList.add('d-none');
        }
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (show) {
            loadingOverlay.classList.remove('d-none');
        } else {
            loadingOverlay.classList.add('d-none');
        }
    }
}

// 페이지 로드 완료 시 게임 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('마추기 플레이 페이지 로드 완료, seriesId:', SERIES_ID);
    
    if (typeof SERIES_ID === 'undefined' || !SERIES_ID) {
        console.error('seriesId가 없습니다.');
        alert('시리즈 ID가 없습니다. 메인 페이지로 돌아갑니다.');
        window.location.href = '/machu';
        return;
    }
    
    window.machuPlayGame = new MachuPlayGame(SERIES_ID);
});

// 전역 에러 핸들러
window.addEventListener('error', (event) => {
    console.error('페이지 에러:', event.error);
});
