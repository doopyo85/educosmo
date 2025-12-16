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
            onFileDelete: null,  // (filename) => {}
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

        let html = `
            <div class="file-tree-header">
                <span class="title">FILES</span>
                <div class="actions">
                    <button id="ft-add-file-btn" class="btn btn-xs btn-link" title="New File">
                        <i class="bi bi-file-earmark-plus"></i>
                    </button>
                </div>
            </div>
            <ul class="file-list">
        `;

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

            // 삭제 버튼 (readOnly가 아니고, active 상태일 때 표시 옵션 등)
            // 메인 파일 보호 로직: main.py는 삭제 불가
            if (!file.isReadOnly && file.name !== 'main.py') {
                html += `
                    <button class="delete-btn" onclick="event.stopPropagation(); window.fileTree.handleFileDelete('${file.name}')">
                        <i class="bi bi-x"></i>
                    </button>
                 `;
            }

            html += `</li>`;
        });

        html += `</ul>`;
        this.element.innerHTML = html;

        // 이벤트 바인딩
        const addBtn = this.element.querySelector('#ft-add-file-btn');
        if (addBtn) {
            addBtn.onclick = () => this.handleFileCreate();
        }
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
}

// 전역 인스턴스 접근 (HTML onclick 핸들러용)
window.FileTree = FileTree;
// 인스턴스를 저장할 공간 확보 (IDEComponent에서 할당)
window.fileTree = null;
