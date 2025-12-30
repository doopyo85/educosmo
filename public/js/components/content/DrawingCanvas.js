/**
 * DrawingCanvas.js
 * 콘텐츠 화면 위에서 자유롭게 그리기 기능을 제공하는 클래스
 */
class DrawingCanvas {
    constructor(canvasId, options = {}) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);

        if (!this.canvas) {
            console.error(`DrawingCanvas: Canvas element with id '${canvasId}' not found.`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;

        // Default Settings
        this.currentSettings = {
            color: '#ff0000',
            size: 5,
            isEraser: false,
            ...options
        };

        this.history = []; // Undo 기능 확장 가능성 대비

        this.init();
    }

    init() {
        this.resize();
        this.setupEventListeners();

        // 반응형 리사이즈 처리
        window.addEventListener('resize', () => {
            // 리사이즈 시 그림 유지 로직 필요 시 추가 (현재는 유지 안 함 or 임시버퍼 사용)
            // 간단하게는 리사이즈 시 초기화되거나, 백업 후 복원
            this.resizeAndRestore();
        });
    }

    resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.offsetWidth;
            this.canvas.height = parent.offsetHeight;
        }
        // 리사이즈 후 Context 설정 초기화되므로 재설정
        this.updateContext();
    }

    resizeAndRestore() {
        // 현재 그림 저장
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        // 리사이즈
        this.resize();

        // 그림 복원
        this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    updateContext() {
        if (!this.ctx) return;

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (this.currentSettings.isEraser) {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.currentSettings.size * 2; // 지우개는 좀 더 크게
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentSettings.color;
            this.ctx.lineWidth = this.currentSettings.size;
        }
    }

    setupEventListeners() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        // Touch Events (Mobile/Tablet)
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault(); // 스크롤 방지
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
    }

    draw(e) {
        if (!this.isDrawing) return;

        const coords = this.getCoordinates(e);

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();

        this.lastX = coords.x;
        this.lastY = coords.y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    // --- Public Methods for Controls ---

    setColor(color) {
        this.currentSettings.color = color;
        this.currentSettings.isEraser = false;
        this.updateContext();
    }

    setSize(size) {
        this.currentSettings.size = parseInt(size, 10);
        this.updateContext();
    }

    setEraserMode(isActive) {
        this.currentSettings.isEraser = isActive;
        this.updateContext();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Global Export for usage
window.DrawingCanvas = DrawingCanvas;
