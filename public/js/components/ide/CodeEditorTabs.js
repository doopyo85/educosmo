/**
 * CodeEditorTabs.js - 에디터 상단 탭 컴포넌트
 * 열린 파일 목록을 탭으로 표시하고 전환
 */
class CodeEditorTabs {
    constructor(options = {}) {
        this.options = {
            containerId: 'editor-tabs-container',
            onTabSelect: null, // (filename) => {}
            onTabClose: null,  // (filename) => {}
            ...options
        };

        this.tabs = []; // Array of { name: 'main.py' }
        this.activeTabName = null;
        this.element = null;
    }

    init() {
        this.element = document.getElementById(this.options.containerId);
        if (!this.element) {
            console.error(`Tabs container not found: ${this.options.containerId}`);
            return false;
        }
        this.render();
        return true;
    }

    /**
     * 탭 목록 설정
     * @param {Array} fileNames - ['main.py', 'utils.py']
     */
    setTabs(fileNames) {
        this.tabs = fileNames.map(name => ({ name }));
        this.render();
    }

    addTab(fileName) {
        if (!this.tabs.find(t => t.name === fileName)) {
            this.tabs.push({ name: fileName });
            this.render();
        }
        this.setActiveTab(fileName);
    }

    removeTab(fileName) {
        this.tabs = this.tabs.filter(t => t.name !== fileName);
        if (this.activeTabName === fileName) {
            // 닫은 탭이 활성 탭이었으면, 마지막 탭을 활성화 (또는 없음)
            this.activeTabName = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].name : null;
            // 탭 닫힘 이벤트 시, 활성 탭 변경 알림도 필요할 수 있음
            if (this.options.onTabSelect && this.activeTabName) {
                this.options.onTabSelect(this.activeTabName);
            }
        }
        this.render();
    }

    setActiveTab(fileName) {
        this.activeTabName = fileName;
        this.render();
    }

    render() {
        if (!this.element) return;

        let html = `<ul class="editor-tabs">`;

        this.tabs.forEach(tab => {
            const isActive = tab.name === this.activeTabName;
            html += `
                <li class="tab-item ${isActive ? 'active' : ''}" onclick="window.editorTabs.handleTabClick('${tab.name}')">
                    <span class="name">${tab.name}</span>
            `;

            // main.py는 닫기 불가 (옵션)
            if (tab.name !== 'main.py') {
                html += `
                    <span class="close-btn" onclick="event.stopPropagation(); window.editorTabs.handleTabClose('${tab.name}')">
                        <i class="bi bi-x"></i>
                    </span>
                 `;
            }
            html += `</li>`;
        });

        html += `</ul>`;
        this.element.innerHTML = html;
    }

    // --- Event Handlers ---

    handleTabClick(fileName) {
        this.setActiveTab(fileName);
        if (this.options.onTabSelect) {
            this.options.onTabSelect(fileName);
        }
    }

    handleTabClose(fileName) {
        if (this.options.onTabClose) {
            this.options.onTabClose(fileName);
        } else {
            this.removeTab(fileName);
        }
    }
}

window.CodeEditorTabs = CodeEditorTabs;
window.editorTabs = null;
