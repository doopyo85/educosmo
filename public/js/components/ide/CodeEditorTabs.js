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
            onTabAdd: null,    // () => {}
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

        // 🔥 Add '+' Tab
        html += `
            <li class="tab-item add-tab-btn" onclick="window.editorTabs.handleAddClick()" title="New File" style="min-width: 40px; justify-content: center; padding: 0;">
                <i class="bi bi-plus" style="font-size: 18px;"></i>
            </li>
        `;

        html += `</ul>`;
        this.element.innerHTML = html;
    }

    // --- Event Handlers ---

    handleTabClick(fileName) {
        if (this.activeTabName === fileName) {
            // Already active -> Inline Rename
            this.startInlineRename(fileName);
            return;
        }

        this.setActiveTab(fileName);
        if (this.options.onTabSelect) {
            this.options.onTabSelect(fileName);
        }
    }

    startInlineRename(fileName) {
        // Find tab element
        // Note: fileName might need escaping if it has special chars, but for now simple selector
        // We iterate because we didn't store refs or unique IDs other than index or onclick content
        // Let's find by text content or add data attribute in render

        // In render(), we added onclick="...handleTabClick('name')" which is not a DOM selector.
        // But we re-render often.
        // Let's modify render to add data-filename to LI

        const tabEl = Array.from(this.element.querySelectorAll('.tab-item')).find(el => {
            const nameEl = el.querySelector('.name');
            return nameEl && nameEl.textContent === fileName;
        });

        if (!tabEl) return;
        if (tabEl.classList.contains('renaming')) return;

        const nameSpan = tabEl.querySelector('.name');
        const oldName = fileName;
        const currentName = nameSpan.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'rename-input'; // Re-use same css class
        input.style.width = '100px'; // Initial width
        input.style.height = '20px';
        input.style.padding = '0 4px';

        nameSpan.style.display = 'none';
        tabEl.insertBefore(input, nameSpan);
        tabEl.classList.add('renaming');

        input.focus();
        input.select();

        const commit = () => {
            const newName = input.value.trim();
            if (newName && newName !== oldName) {
                if (this.options.onTabRename) {
                    this.options.onTabRename(oldName, newName);
                }
                // If success, IDEComponent calls refreshUI -> re-renders
            } else {
                this.render(); // Revert
            }
        };

        input.onblur = commit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                this.render();
            }
        };

        input.onclick = (e) => e.stopPropagation();
    }

    handleTabClose(fileName) {
        if (this.options.onTabClose) {
            this.options.onTabClose(fileName);
        } else {
            this.removeTab(fileName);
        }
    }

    handleAddClick() {
        if (this.options.onTabAdd) {
            this.options.onTabAdd();
        }
    }
}

window.CodeEditorTabs = CodeEditorTabs;
window.editorTabs = null;
