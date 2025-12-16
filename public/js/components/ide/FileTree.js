/**
 * FileTree.js - 좌측 파일 탐색기 컴포넌트
 * 파일 목록 표시, 선택, 추가, 삭제 이벤트 처리
 */
class FileTree {
    constructor(options = {}) {
        this.options = {
            containerId: 'file-tree-container',
            onFileSelect: null,  // (file) => {}
            onFileCreate: null,  // (filename) => {}
            onFileRename: null,  // (old, new) => {}
            onFileDelete: null,  // (filename) => {}
            onFontIncrease: null,
            onFontDecrease: null,
            onRestore: null,
            onDownload: null,
            onRefresh: null,
            ...options
        };

        this.files = []; // Array of { name: 'main.py', content: '...', isReadOnly: false }
        this.activeFileName = null;
        this.element = null;
    }

    init() {
        this.element = document.getElementById(this.options.containerId);
        if (!this.element) {
            console.error(`FileTree container not found: ${this.options.containerId}`);
            return false;
        }
        this.render();
        return true;
    }

    /**
     * 파일 목록 설정
     * @param {Array} files - [{ name, content, isReadOnly }]
     */
    setFiles(files) {
        this.files = files || [];
        // 만약 활성 파일이 목록에 없으면 첫 번째 파일 선택
        if (!this.files.find(f => f.name === this.activeFileName)) {
            this.activeFileName = this.files.length > 0 ? this.files[0].name : null;
        }
        this.render();
    }

    /**
     * 활성 파일 설정
     */
    setActiveFile(fileName) {
        this.activeFileName = fileName;
        this.render(); // Re-render to highlight selection
    }

    /**
     * UI 렌더링
     */
    render() {
        if (!this.element) return;

        // 접힘 상태 확인
        const isCollapsed = this.element.classList.contains('collapsed');

        // Main HTML Structure
        let html = `
            <div class="file-tree-header" style="justify-content: flex-start; padding: 0;">
                <!-- Fixed Width Logo Container (always 60px) -->
                <div class="branding-logo" style="width: 60px; height: 100%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="fab fa-python" style="color: #3776ab; font-size: 24px;"></i>
                </div>
                
                <!-- Title Text (Hidden when collapsed) -->
                <div class="branding-text" style="display: ${isCollapsed ? 'none' : 'flex'}; align-items: center; flex: 1; overflow: hidden;">
                    <span class="title" style="font-weight: 600; color: #3776ab; font-size: 16px;">Python</span>
                </div>
            </div>
            
            <div class="file-tree-content" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column;">
                <ul class="file-list" style="display: ${isCollapsed ? 'none' : 'block'}; flex: 1; margin: 0;">
        `;

        // File Items
        if (!isCollapsed) {
            this.files.forEach(file => {
                const isActive = file.name === this.activeFileName;
                const iconClass = this.getFileIcon(file.name);

                html += `
                <li class="file-item ${isActive ? 'active' : ''}" data-filename="${file.name}">
                    <div class="file-info" onclick="window.fileTree.handleFileClick('${file.name}')">
                        <i class="${iconClass}"></i>
                        <span class="name">${file.name}</span>
                    </div>
                `;

                if (!file.isReadOnly && file.name !== 'main.py') {
                    html += `
                    <button class="delete-btn" onclick="event.stopPropagation(); window.fileTree.handleFileDelete('${file.name}')">
                        <i class="bi bi-x"></i>
                    </button>
                    `;
                }
                html += `</li>`;
            });
        }

        html += `</ul>`;

        // Controls Section (Bottom of content)
        // Hidden when collapsed? Or icon only? User implies full buttons at bottom.
        // If collapsed, 60px width is too small for row of buttons. Hide them or stack?
        // Let's hide controls when collapsed for now to keep it clean.

        if (!isCollapsed) {
            html += `
                <div class="file-tree-footer-section" style="padding: 10px; border-top: 1px solid #3e3e42; background-color: #252526;">
                    <div style="font-size: 11px; color: #858585; margin-bottom: 8px; font-weight: 600; text-transform: uppercase;">Functions</div>
                    <div class="ide-footer-controls" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="footer-btn" onclick="window.fileTree.handleFontIncrease()" title="Font Size +">
                            <i class="bi bi-plus-lg"></i>
                        </button>
                        <button class="footer-btn" onclick="window.fileTree.handleFontDecrease()" title="Font Size -">
                            <i class="bi bi-dash-lg"></i>
                        </button>
                        <button class="footer-btn" onclick="window.fileTree.handleRefresh()" title="Refresh">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button class="footer-btn" onclick="window.fileTree.handleDownload()" title="Download">
                            <i class="bi bi-download"></i>
                        </button>
                    </div>
                </div>
             `;
        }

        html += `</div>`; // End of file-tree-content

        // Toggle Button Footer (Absolute Bottom)
        // Fixed syntax error here: Removed spaces in tags
        html += `
            <div class="file-tree-footer" style="padding: 0; min-height: 40px; display: flex; align-items: center; justify-content: ${isCollapsed ? 'center' : 'flex-end'}; border-top: 1px solid #3e3e42; background-color: #252526;">
                <button id="ft-toggle-btn" class="btn btn-xs btn-link" title="${isCollapsed ? 'Expand' : 'Collapse'}" style="color: #ccc; width: 60px; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0;">
                    <i class="bi ${isCollapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}" style="font-size: 16px;"></i>
                </button>
            </div>
        `;

        this.element.innerHTML = html;
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';

        // Event Binding (Toggle is handled by global onclick or re-binding? 
        // We need to re-bind because we replaced innerHTML)
        const toggleBtn = this.element.querySelector('#ft-toggle-btn');
        if (toggleBtn) {
            toggleBtn.onclick = () => this.handleToggle();
        }
    }

    handleToggle() {
        if (!this.element) return;
        this.element.classList.toggle('collapsed');
        this.render();
    }

    getFileIcon(filename) {
        if (filename.endsWith('.py')) return 'bi bi-filetype-py';
        if (filename.endsWith('.txt')) return 'bi bi-file-text';
        if (filename.endsWith('.json')) return 'bi bi-filetype-json';
        return 'bi bi-file-earmark';
    }

    // --- Event Handlers ---

    handleFileClick(fileName) {
        console.log('File clicked:', fileName);
        this.setActiveFile(fileName);
        if (this.options.onFileSelect) {
            const file = this.files.find(f => f.name === fileName);
            this.options.onFileSelect(file);
        }
    }

    handleFileCreate() {
        // 간단한 프롬프트 사용 (추후 모달로 개선 가능)
        const fileName = prompt('Enter new file name (e.g., utils.py):');
        if (!fileName) return;

        // 유효성 검사
        if (this.files.find(f => f.name === fileName)) {
            alert('File already exists!');
            return;
        }

        if (this.options.onFileCreate) {
            this.options.onFileCreate(fileName);
        }
    }

    handleFileDelete(fileName) {
        if (!confirm(`Delete '${fileName}' ? `)) return;

        if (this.options.onFileDelete) {
            this.options.onFileDelete(fileName);
        }
    }

    // --- Control Handlers ---
    handleFontIncrease() { if (this.options.onFontIncrease) this.options.onFontIncrease(); }
    handleFontDecrease() { if (this.options.onFontDecrease) this.options.onFontDecrease(); }
    handleRefresh() { if (this.options.onRefresh) this.options.onRefresh(); }
    handleDownload() { if (this.options.onDownload) this.options.onDownload(); }

    // --- Rename Logic ---
    // Double click or similar to rename? 
    // User requested: "Click active item to rename".
    // We update handleFileClick to detect second click on active item.

    handleFileClick(fileName) {
        console.log('File clicked:', fileName);

        if (this.activeFileName === fileName) {
            // Already active, this is a second click -> Rename?
            // But we need to distinguish simple focus click vs intent to rename.
            // Let's use a small timeout or state check? 
            // Better: If it's already active, we check if we should switch to edit mode.
            // For now, let's just trigger rename prompt for simplicity as "MVP". 
            // Real in-place edit is complex (DOM replacement).
            // Let's stick to prompt for now, or build a simple in-place input replacement.

            // To prevent accidental trigger on first load/selection, maybe ensure some delay?
            // Actually, "main.py를 클릭하고 한번더 클릭하면" implies intention.

            // Simple approach: Check if element is currently in "view mode".
            // Let's implement full In-Place Edit.
            this.startInlineRename(fileName);
            return;
        }

        this.setActiveFile(fileName);
        if (this.options.onFileSelect) {
            const file = this.files.find(f => f.name === fileName);
            this.options.onFileSelect(file);
        }
    }

    startInlineRename(fileName) {
        // Find the file item element
        const item = this.element.querySelector(`.file-item[data-filename="${fileName}"]`);
        if (!item) return;

        const fileInfo = item.querySelector('.file-info');
        const nameSpan = item.querySelector('.name');

        if (item.classList.contains('renaming')) return; // Already renaming

        const oldName = fileName;
        const currentName = nameSpan.textContent;

        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'rename-input'; // Styled in CSS

        // Replace span with input
        nameSpan.style.display = 'none';
        fileInfo.insertBefore(input, nameSpan);
        item.classList.add('renaming');

        input.focus();
        input.select();

        // Handle commit
        const commit = () => {
            const newName = input.value.trim();
            if (newName && newName !== oldName) {
                if (this.options.onFileRename) {
                    this.options.onFileRename(oldName, newName);
                }
            } else {
                // Revert
                this.render(); // Simple revert
            }
        };

        input.onblur = commit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                this.render(); // Cancel
            }
        };

        input.onclick = (e) => e.stopPropagation(); // Prevent re-triggering click handlers
    }

}

// 전역 인스턴스 접근 (HTML onclick 핸들러용)
window.FileTree = FileTree;
// 인스턴스를 저장할 공간 확보 (IDEComponent에서 할당)
window.fileTree = null;
