/**
 * DrawingCanvas.js
 * 콘텐츠 화면 위에서 자유롭게 그리기 기능을 제공하는 클래스
 * Features: Smoothing, Undo/Redo, Resize Handling
 */
class DrawingCanvas {
    constructor(canvasId, options = {}) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);

        if (!this.canvas) {
            console.error(`DrawingCanvas: Canvas element with id '${canvasId}' not found.`);
            return;
        }

        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.isDrawing = false;

        // Smoothing Variables
        this.points = [];

        // Default Settings
        this.currentSettings = {
            color: '#ff0000',
            size: 5,
            isEraser: false,
            ...options
        };

        // Undo/Redo Stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 20; // 메모리 관리

        this.init();
    }

    init() {
        this.resize();
        this.setupEventListeners();

        // 초기 상태 저장 (빈 캔버스)
        this.saveState();

        // 키보드 단축키 (Ctrl+Z, Ctrl+Y)
        window.addEventListener('keydown', (e) => {
            if (this.canvas.offsetParent === null) return; // 숨겨져 있으면 무시

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y')) {
                e.preventDefault();
                this.redo();
            }
        });

        // 반응형 리사이즈
        window.addEventListener('resize', () => {
            this.resizeAndRestore();
        });
    }

    resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.offsetWidth;
            this.canvas.height = parent.offsetHeight;
        }
        this.updateContext();
    }

    resizeAndRestore() {
        // 임시 저장
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.resize();

        // 복원
        this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    updateContext() {
        if (!this.ctx) return;

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (this.currentSettings.isEraser) {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.currentSettings.size * 2;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentSettings.color;
            this.ctx.lineWidth = this.currentSettings.size;
            // Shadow for smoother edge feel? Optional.
            // this.ctx.shadowBlur = 1;
            // this.ctx.shadowColor = this.currentSettings.color;
        }
    }

    // --- History Management ---
    saveState() {
        // 현재 상태(ImageData)를 스택에 저장
        if (this.undoStack.length >= this.maxStackSize) {
            this.undoStack.shift(); // 오래된 것 제거
        }
        this.undoStack.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
        // 새 동작이 발생했으므로 리두 스택 초기화
        // 단, startDrawing에서 호출되는 경우 중복 저장 방지 로직 필요?
        // -> 보통 mouseup(스트로크 끝)에 저장하거나, mousedown(시작 전)에 저장.
        // -> Undo를 위해서는 '변경 전' 상태가 필요하므로 mousedown 시점에 저장하는 것이 논리적.
    }

    undo() {
        if (this.undoStack.length > 0) {
            // 현재 상태를 리두 스택에 보관
            this.redoStack.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));

            // 이전 상태 복구
            const previousState = this.undoStack.pop();
            this.ctx.putImageData(previousState, 0, 0);
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            // 현재 상태(Undo된 상태)를 다시 Undo 스택에 보관
            this.undoStack.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));

            // 리두 상태 복구
            const nextState = this.redoStack.pop();
            this.ctx.putImageData(nextState, 0, 0);
        }
    }

    // --- Drawing Events ---
    setupEventListeners() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const start = (e) => {
            if (e.cancelable) e.preventDefault();
            this.isDrawing = true;
            this.points = [];

            // Undo를 위해 시작 전 상태 저장
            // (주의: 이미 undoStack에 있는 마지막 상태와 같으면 생략 가능하지만, 단순 구현)
            // 리두 스택은 새로운 액션 시작 시 비워야 함
            this.redoStack = [];
            this.saveState();

            const { x, y } = getPos(e);
            this.points.push({ x, y });
        };

        const move = (e) => {
            if (!this.isDrawing) return;
            if (e.cancelable) e.preventDefault();

            const { x, y } = getPos(e);
            this.points.push({ x, y });

            this.drawCurved();
        };

        const end = (e) => {
            this.isDrawing = false;
            this.points = [];
        };

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        this.canvas.addEventListener('mouseup', end);
        this.canvas.addEventListener('mouseout', end);

        this.canvas.addEventListener('touchstart', start, { passive: false });
        this.canvas.addEventListener('touchmove', move, { passive: false });
        this.canvas.addEventListener('touchend', end);
    }

    drawCurved() {
        // Quadcractic Curve interpolation for smoothing
        if (this.points.length < 3) {
            const b = this.points[0];
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, this.ctx.lineWidth / 2, 0, Math.PI * 2, !0);
            this.ctx.fill();
            this.ctx.closePath();
            return;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length - 2; i++) {
            const c = (this.points[i].x + this.points[i + 1].x) / 2;
            const d = (this.points[i].y + this.points[i + 1].y) / 2;
            this.ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, c, d);
        }

        // For the last 2 points
        const i = this.points.length - 2;
        this.ctx.quadraticCurveTo(
            this.points[i].x,
            this.points[i].y,
            this.points[i + 1].x,
            this.points[i + 1].y
        );
        this.ctx.stroke();
    }

    // --- Public Methods ---
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
        this.saveState(); // Clear 전 상태 저장
        this.redoStack = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Global Export
window.DrawingCanvas = DrawingCanvas;
