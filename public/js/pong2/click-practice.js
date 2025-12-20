/**
 * Click Practice Game (Mole Game)
 * Users practice mouse clicking by catching animals on a grid.
 */

class ClickPracticeGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Game Settings
        this.gridSize = 3; // 3x3 grid
        this.cellSize = this.width / this.gridSize;
        this.gameTime = 30; // 30 seconds

        // Game State
        this.score = 0;
        this.timeLeft = this.gameTime;
        this.isPlaying = false;
        this.activeCell = { x: -1, y: -1, type: null, bornTime: 0 };
        this.lastFrameTime = 0;
        this.animationId = null;

        // Characters (Emojis)
        this.characters = [
            { type: 'mouse', emoji: '🐭', score: 10, probability: 0.5, duration: 1000 },
            { type: 'rabbit', emoji: '🐰', score: 20, probability: 0.3, duration: 800 },
            { type: 'fox', emoji: '🦊', score: 30, probability: 0.15, duration: 600 },
            { type: 'tiger', emoji: '🐯', score: 50, probability: 0.05, duration: 500 },
            { type: 'bomb', emoji: '💣', score: -50, probability: 0.1, duration: 1200 } // Penalty
        ];

        // Event Listeners
        this.canvas.addEventListener('mousedown', (e) => this.handleClick(e));
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());

        // Initial Render
        this.drawGrid();
        this.loadRankings();
    }

    startGame() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.score = 0;
        this.timeLeft = this.gameTime;
        this.updateUI();

        document.getElementById('overlay').classList.add('d-none');
        document.getElementById('start-btn').disabled = true;
        document.getElementById('start-btn').textContent = '게임 중...';

        this.spawnCharacter();
        this.gameLoop(0);

        // Timer
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateUI();
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    endGame() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        cancelAnimationFrame(this.animationId);

        document.getElementById('start-btn').disabled = false;
        document.getElementById('start-btn').textContent = '다시 시작';

        this.drawGameOver();
        this.saveScore(this.score);
    }

    spawnCharacter() {
        if (!this.isPlaying) return;

        // Choose random cell
        let newX, newY;
        do {
            newX = Math.floor(Math.random() * this.gridSize);
            newY = Math.floor(Math.random() * this.gridSize);
        } while (newX === this.activeCell.x && newY === this.activeCell.y);

        // Choose random character based on probability
        const rand = Math.random();
        let cumulativeProb = 0;
        let character = this.characters[0];

        // Normalizing probabilities to handle bomb separately logic if needed, 
        // but simple cumulative sum works for weighted random
        // Actually, let's normalize 'bomb' out of the probability sum first to be additive
        // Or simpler: just standard weighted random

        let typeRand = Math.random();
        let selectedChar = this.characters[0];
        let runningProb = 0;

        // Sum probabilities to normalize
        const totalProb = this.characters.reduce((sum, char) => sum + char.probability, 0);
        typeRand *= totalProb;

        for (const char of this.characters) {
            runningProb += char.probability;
            if (typeRand < runningProb) {
                selectedChar = char;
                break;
            }
        }

        this.activeCell = {
            x: newX,
            y: newY,
            type: selectedChar,
            bornTime: Date.now()
        };
    }

    handleClick(e) {
        if (!this.isPlaying) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Start scale properly
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const clickX = x * scaleX;
        const clickY = y * scaleY;

        const cellX = Math.floor(clickX / this.cellSize);
        const cellY = Math.floor(clickY / this.cellSize);

        if (cellX === this.activeCell.x && cellY === this.activeCell.y) {
            // HIT!
            this.score += this.activeCell.type.score;
            this.showHitEffect(clickX, clickY, this.activeCell.type.score);

            // Spawn new immediately
            this.spawnCharacter();
            this.updateUI();
        }
    }

    gameLoop(timestamp) {
        if (!this.isPlaying) return;

        const elapsed = timestamp - this.lastFrameTime;

        // Check character duration
        if (this.activeCell.type) {
            const aliveTime = Date.now() - this.activeCell.bornTime;
            if (aliveTime > this.activeCell.type.duration) {
                this.spawnCharacter(); // Missed, move to next
            }
        }

        this.draw();
        this.requestAnimationId = requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawGrid();
        this.drawCharacter();
    }

    drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;

        // Checkerboard Pattern
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const isDark = (x + y) % 2 === 1;
                this.ctx.fillStyle = isDark ? '#d2a679' : '#e6ccb3'; // Wood light/dark
                this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            }
        }
    }

    drawCharacter() {
        if (this.activeCell.x !== -1) {
            const centerX = this.activeCell.x * this.cellSize + this.cellSize / 2;
            const centerY = this.activeCell.y * this.cellSize + this.cellSize / 2 + 10; // +10 for emoji baseline adjustment

            this.ctx.font = `${this.cellSize * 0.6}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.activeCell.type.emoji, centerX, centerY);
        }
    }

    showHitEffect(x, y, score) {
        // Simple visual feedback (could be improved with animation list)
        // For now, let's just flash the background of the cell?
        // Actually, canvas is redrawn every frame, so simple flash is hard without state.
        // We'll trust the instant respawn is feedback enough for now.
    }

    drawGameOver() {
        const overlay = document.getElementById('overlay');
        const overlayTitle = document.getElementById('overlay-title');
        const overlayScore = document.getElementById('overlay-score');

        overlayTitle.textContent = "Time's Up!";
        overlayScore.textContent = `Final Score: ${this.score}`;
        overlay.classList.remove('d-none');
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('time').textContent = this.timeLeft;
    }

    async saveScore(score) {
        try {
            const response = await fetch('/api/mole-game/save-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score })
            });
            const data = await response.json();
            if (data.success) {
                this.loadRankings(); // Reload rankings
            } else {
                console.error('Score save failed:', data.message);
                if (data.message === '로그인이 필요합니다.') {
                    alert('로그인이 필요합니다. 점수가 저장되지 않습니다.');
                }
            }
        } catch (err) {
            console.error('Network error:', err);
        }
    }

    async loadRankings() {
        try {
            const response = await fetch('/api/mole-game/rankings');
            const rankings = await response.json();

            const tbody = document.getElementById('ranking-body');
            tbody.innerHTML = '';

            if (rankings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">아직 랭킹이 없습니다. 1등에 도전하세요!</td></tr>';
                return;
            }

            rankings.forEach((rank, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${rank.userID}</td>
                    <td>${rank.score}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ranking load error:', err);
        }
    }
}

// Initialize Game
window.addEventListener('load', () => {
    const game = new ClickPracticeGame('gameCanvas');
});
