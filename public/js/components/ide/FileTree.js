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

    async init() {
        this.element = document.getElementById(this.options.containerId);
        if (!this.element) {
            console.error(`FileTree container not found: ${this.options.containerId}`);
            return false;
        }

        // 🔥 Default to Collapsed
        this.element.classList.add('collapsed');

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
            
            <!-- 1. File List Area (Top 40%) -->
            <div class="file-tree-content" style="flex: 0.4; overflow-y: auto; display: flex; flex-direction: column; border-bottom: 1px solid #3e3e42;">
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

        html += `   </ul>
            </div>`;

        // 2. Control Toolbar Area (Bottom 60%)
        // Icons fixed on left, text appears on right when expanded
        const btnStyle = `
            width: 100%; 
            height: 40px; 
            display: flex; 
            align-items: center; 
            justify-content: flex-start; 
            padding: 0; 
            border: none; 
            background: transparent; 
            color: #c5c5c5; 
            cursor: pointer;
            text-align: left;
        `;
        // Icon container fixed width 60px to match logo, centered icon
        const iconContainerStyle = "width: 60px; display: flex; justify-content: center; align-items: center; flex-shrink: 0;";
        const labelStyle = isCollapsed ? "display: none;" : "display: block; font-size: 14px; margin-left: 0px; white-space: nowrap;";

        html += `
            <div class="file-tree-toolbar" style="flex: 0.6; padding: 10px 0; background-color: #252526; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; overflow-y: auto;">
                
                <button class="footer-btn" onclick="window.fileTree.handleFontIncrease()" title="확대" style="${btnStyle}">
                    <div style="${iconContainerStyle}"><i class="bi bi-plus-lg"></i></div>
                    <span style="${labelStyle}">확대</span>
                </button>
                
                <button class="footer-btn" onclick="window.fileTree.handleFontDecrease()" title="축소" style="${btnStyle}">
                    <div style="${iconContainerStyle}"><i class="bi bi-dash-lg"></i></div>
                    <span style="${labelStyle}">축소</span>
                </button>
                
                <button class="footer-btn" onclick="window.fileTree.handleRefresh()" title="새로고침" style="${btnStyle}">
                    <div style="${iconContainerStyle}"><i class="bi bi-arrow-clockwise"></i></div>
                    <span style="${labelStyle}">새로고침</span>
                </button>
                
                <button class="footer-btn" onclick="window.fileTree.handleDownload()" title="다운로드" style="${btnStyle}">
                    <div style="${iconContainerStyle}"><i class="bi bi-download"></i></div>
                    <span style="${labelStyle}">다운로드</span>
                </button>
                
                <div style="flex: 1;"></div> <!-- Spacer to push toggle to very bottom if needed, or just keep flow -->

                 <button id="ft-toggle-btn" class="footer-btn" title="${isCollapsed ? '펼치기' : '접기'}" style="${btnStyle}">
                     <div style="${iconContainerStyle}"><i class="bi ${isCollapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}"></i></div>
                    <span style="${labelStyle}">${isCollapsed ? '펼치기' : '접기'}</span>
                </button>
            </div>
        `;


        this.element.innerHTML = html;
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';

        // Event Binding
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
        if (!confirm(`Delete '${fileName}'?`)) return;

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
