/**
 * IDEWidthResize.js - IDE와 콘텐츠 사이의 너비 조절 기능
 */

class IDEWidthResize {
    constructor() {
        this.handle = document.getElementById('ide-width-resize-handle');
        // Also check for content handle just in case, though we primarily use ide handle
        this.contentHandle = document.getElementById('content-width-resize-handle');

        this.mainArea = document.querySelector('.mainArea');
        this.contentContainer = document.getElementById('content-component');
        this.ideContainer = document.getElementById('ide-component');

        this.state = {
            isResizing: false,
            containerWidth: 0,
            startX: 0,
            startContentWidth: 0
        };

        // Bind methods
        this.handleResizeStart = this.handleResizeStart.bind(this);
        this.handleResizeMove = this.handleResizeMove.bind(this);
        this.handleResizeEnd = this.handleResizeEnd.bind(this);
        this.throttledResizeMove = this.throttle(this.handleResizeMove, 16);
    }

    init() {
        console.log('IDE Width Resize Initializing...');
        // Register listeners for both handles if they exist
        if (this.handle) {
            console.log('Handle found (ide-width-resize-handle), attaching mousedown');
            this.handle.removeEventListener('mousedown', this.handleResizeStart); // Prevent duplicate
            this.handle.addEventListener('mousedown', this.handleResizeStart);
        } else {
            console.error('IDE Width Resize Handle NOT found');
        }

        if (this.contentHandle) {
            console.log('Content Handle found, attaching mousedown');
            this.contentHandle.addEventListener('mousedown', this.handleResizeStart);
        }

        console.log('IDE Width Resize Initialized');
    }

    handleResizeStart(event) {
        console.log('IDEWidthResize: Resize started', event);
        if (!this.mainArea) {
            console.error('IDEWidthResize: mainArea not found');
            return;
        }

        event.preventDefault();

        this.state.isResizing = true;
        this.state.containerWidth = this.mainArea.getBoundingClientRect().width;
        this.state.startX = event.clientX;

        // Get current content width percentage
        const contentRect = this.contentContainer.getBoundingClientRect();
        this.state.startContentWidth = contentRect.width;

        // Add resizing class for cursor
        document.body.classList.add('resizing');
        // 🔥 Add active class to handle for visual feedback
        if (this.handle) this.handle.classList.add('active');

        // Ensure custom-layout class is active so CSS variables take effect
        this.mainArea.classList.add('custom-layout');

        // 🔥 Attach events to document to catch moves outside
        console.log('Attaching global mousemove/up listeners');
        document.addEventListener('mousemove', this.throttledResizeMove);
        document.addEventListener('mouseup', this.handleResizeEnd);
        // preventDefault to stop text selection
        document.addEventListener('selectstart', this.preventDefault);

        // Publish resize start event
        if (window.EventBus) {
            window.EventBus.publish('layout:resizeStart', {});
        }
    }

    handleResizeMove(event) {
        if (!this.state.isResizing) return;
        event.preventDefault(); // Prevent text selection etc.

        // ... existing logic ...

        event.preventDefault();

        // Calculate new width relative to container
        // If handle is on the right of content (or left of IDE), delta x affects content width
        // content width + delta
        // But we need to calculate exact position

        const containerRect = this.mainArea.getBoundingClientRect();
        const relativeX = event.clientX - containerRect.left;

        let newContentPercentage = (relativeX / this.state.containerWidth) * 100;

        // Constraints (min 20%, max 80%)
        newContentPercentage = Math.max(20, Math.min(80, newContentPercentage));

        const newIdePercentage = 100 - newContentPercentage;

        // Update CSS variables
        document.documentElement.style.setProperty('--content-width', `${newContentPercentage}%`);
        document.documentElement.style.setProperty('--ide-width', `${newIdePercentage}%`);

        // Trigger editor resize if EventBus exists
        if (window.EventBus) {
            window.EventBus.publish('editor:resize', {});
        }
    }

    handleResizeEnd() {
        this.state.isResizing = false;
        document.body.classList.remove('resizing');
        // 🔥 Remove active class from handle
        if (this.handle) this.handle.classList.remove('active');

        document.removeEventListener('mousemove', this.throttledResizeMove);
        document.removeEventListener('mouseup', this.handleResizeEnd);
        document.removeEventListener('selectstart', this.preventDefault);

        // Save to localStorage
        const currentContentWidth = getComputedStyle(document.documentElement).getPropertyValue('--content-width');
        if (currentContentWidth) {
            localStorage.setItem('layout-content-width', currentContentWidth);
        }

        // Force final resize event
        if (window.EventBus) {
            window.EventBus.publish('layout:resizeEnd', {});
            // Trigger one more editor resize to be sure
            setTimeout(() => window.EventBus.publish('editor:resize', {}), 50);
        }
    }

    throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    preventDefault(e) {
        e.preventDefault();
    }
}

// Global instance
window.IDEWidthResize = IDEWidthResize;

// Auto init
document.addEventListener('DOMContentLoaded', () => {
    // Check saved preference
    const savedWidth = localStorage.getItem('layout-content-width');
    if (savedWidth) {
        document.documentElement.style.setProperty('--content-width', savedWidth);
        const ideWidth = 100 - parseFloat(savedWidth);
        document.documentElement.style.setProperty('--ide-width', `${ideWidth}%`);

        const mainArea = document.querySelector('.mainArea');
        if (mainArea) mainArea.classList.add('custom-layout');
    }

    const resizer = new IDEWidthResize();
    resizer.init();
});
