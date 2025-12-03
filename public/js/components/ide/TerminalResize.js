/**
 * TerminalResize.js - 터미널 리사이즈 전담
 * 드래그, 최대화, 높이 조정만
 */

class TerminalResize {
  constructor() {
    this.state = {
      isResizing: false,
      startY: 0,
      startTerminalHeight: 0,
      minTerminalHeight: 120,
      maxTerminalHeight: 0,
      isMaximized: false
    };
    
    this.handleResizeStart = this.handleResizeStart.bind(this);
    this.handleResizeMove = this.handleResizeMove.bind(this);
    this.handleResizeEnd = this.handleResizeEnd.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.throttledResizeMove = this.throttle(this.handleResizeMove, 16);
  }
  
  /**
   * 리사이즈 초기화
   */
  init() {
    const resizeHandle = document.getElementById('ide-resize-handle');
    const maximizeBtn = document.getElementById('terminal-maximize-btn');
    
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', this.handleResizeStart);
      resizeHandle.addEventListener('dblclick', this.handleDoubleClick);
      resizeHandle.setAttribute('tabindex', '0');
      resizeHandle.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', this.toggleMaximize.bind(this));
    }
    
    this.setInitialHeight();
  }
  
  /**
   * 드래그 시작
   */
  handleResizeStart(event) {
    event.preventDefault();
    
    const outputContainer = document.querySelector('.output-container');
    const ideContainer = document.querySelector('#ace-editor-inner');
    
    if (!outputContainer || !ideContainer) return;
    
    const containerRect = ideContainer.getBoundingClientRect();
    const outputRect = outputContainer.getBoundingClientRect();
    
    this.state.isResizing = true;
    this.state.startY = event.clientY;
    this.state.startTerminalHeight = outputRect.height;
    this.state.maxTerminalHeight = containerRect.height * 0.8;
    
    ideContainer.classList.add('resizing');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', this.throttledResizeMove);
    document.addEventListener('mouseup', this.handleResizeEnd);
    document.addEventListener('selectstart', this.preventDefault);
  }

  /**
   * 드래그 중
   */
  handleResizeMove(event) {
    if (!this.state.isResizing) return;
    
    event.preventDefault();
    
    const deltaY = event.clientY - this.state.startY;
    const newHeight = this.state.startTerminalHeight - deltaY;
    
    const clampedHeight = Math.max(
      this.state.minTerminalHeight,
      Math.min(newHeight, this.state.maxTerminalHeight)
    );
    
    this.setTerminalHeight(clampedHeight);
  }

  /**
   * 드래그 종료
   */
  handleResizeEnd = () => {
    if (!this.state.isResizing) return;
    
    this.state.isResizing = false;
    
    const ideContainer = document.querySelector('#ace-editor-inner');
    if (ideContainer) {
      ideContainer.classList.remove('resizing');
    }
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    document.removeEventListener('mousemove', this.throttledResizeMove);
    document.removeEventListener('mouseup', this.handleResizeEnd);
    document.removeEventListener('selectstart', this.preventDefault);
    
    this.saveHeight();
  }

  /**
   * 터미널 높이 설정
   */
  setTerminalHeight(heightPx) {
    const outputContainer = document.querySelector('.output-container');
    const editor = document.querySelector('#editor');
    
    if (!outputContainer || this.state.isMaximized) return;
    
    outputContainer.style.setProperty('flex', `0 0 ${heightPx}px`, 'important');
    outputContainer.style.setProperty('min-height', `${Math.max(heightPx, this.state.minTerminalHeight)}px`, 'important');
    outputContainer.style.setProperty('max-height', `${Math.min(heightPx, this.state.maxTerminalHeight)}px`, 'important');
    
    const remainingHeight = `calc(100% - ${heightPx + 4}px)`;
    if (editor) {
      editor.style.setProperty('flex', `1 1 auto`, 'important');
      editor.style.setProperty('height', remainingHeight, 'important');
    }
    
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      if (window.EventBus) {
        window.EventBus.publish('editor:resize', {});
      }
    }, 50);
  }

  /**
   * 초기 높이 설정
   */
  setInitialHeight() {
    const savedHeight = localStorage.getItem('terminal-height');
    
    setTimeout(() => {
      const ideContainer = document.querySelector('#ace-editor-inner');
      if (ideContainer) {
        const containerHeight = ideContainer.getBoundingClientRect().height;
        let targetHeight;
        
        if (savedHeight && !isNaN(savedHeight)) {
          targetHeight = parseInt(savedHeight);
        } else {
          targetHeight = containerHeight * 0.2; // 20%
        }
        
        const finalHeight = Math.max(targetHeight, this.state.minTerminalHeight);
        this.setTerminalHeight(finalHeight);
      }
    }, 100);
  }

  /**
   * 더블클릭으로 최대화/복원
   */
  handleDoubleClick(event) {
    event.preventDefault();
    this.toggleMaximize();
  }

  /**
   * 키보드 접근성
   */
  handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleMaximize();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.adjustHeight(20);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.adjustHeight(-20);
    }
  }

  /**
   * 최대화/복원 토글
   */
  toggleMaximize() {
    const outputContainer = document.querySelector('.output-container');
    const maximizeBtn = document.getElementById('terminal-maximize-btn');
    
    if (!outputContainer) return;
    
    this.state.isMaximized = !this.state.isMaximized;
    
    if (this.state.isMaximized) {
      outputContainer.classList.add('maximized');
      if (maximizeBtn) {
        maximizeBtn.innerHTML = '<i class="bi bi-arrows-collapse"></i>';
        maximizeBtn.title = '복원';
      }
    } else {
      outputContainer.classList.remove('maximized');
      if (maximizeBtn) {
        maximizeBtn.innerHTML = '<i class="bi bi-arrows-expand"></i>';
        maximizeBtn.title = '최대화';
      }
    }
    
    setTimeout(() => {
      if (window.EventBus) {
        window.EventBus.publish('editor:resize', {});
      }
    }, 100);
  }

  /**
   * 높이 조정
   */
  adjustHeight(deltaPixels) {
    const outputContainer = document.querySelector('.output-container');
    if (!outputContainer) return;
    
    const currentHeight = outputContainer.getBoundingClientRect().height;
    const newHeight = currentHeight + deltaPixels;
    
    this.setTerminalHeight(newHeight);
    this.saveHeight();
  }

  /**
   * 높이 저장
   */
  saveHeight() {
    const outputContainer = document.querySelector('.output-container');
    if (outputContainer && !this.state.isMaximized) {
      const height = outputContainer.getBoundingClientRect().height;
      localStorage.setItem('terminal-height', height.toString());
    }
  }

  /**
   * throttle 유틸리티
   */
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * preventDefault 유틸리티
   */
  preventDefault(event) {
    event.preventDefault();
  }
  
  /**
   * 창 크기 변경 대응
   */
  handleWindowResize() {
    const ideContainer = document.querySelector('#ace-editor-inner');
    if (ideContainer) {
      const containerHeight = ideContainer.getBoundingClientRect().height;
      this.state.maxTerminalHeight = containerHeight * 0.8;
    }
    
    if (window.EventBus) {
      window.EventBus.publish('editor:resize', {});
    }
  }
}

window.TerminalResize = TerminalResize;