/**
 * IDEComponent.js - 메인 IDE 컴포넌트 (Multi-file 지원 버전)
 * FileTree, EditorTabs, CodeEditor, Terminal 통합 관리
 */

class IDEComponent extends Component {
  constructor(options = {}) {
    super(options);

    // 기본 옵션 설정
    this.options = {
      elementId: 'ide-component',
      submitButtonId: 'submitCodeBtn',
      ...options
    };

    // 상태 관리
    this.state = {
      currentExamName: '',
      currentProblemNumber: 1,
      isInitialized: false,

      // 🔥 Multi-file State
      files: [], // Array of { name, content, isReadOnly }
      activeFileName: null
    };

    // 하위 모듈들
    this.modules = {
      fileTree: null,
      editorTabs: null,
      codeEditor: null,
      terminal: null
    };
  }

  /**
   * IDE 컴포넌트 초기화
   */
  async init() {
    console.log('IDEComponent (Multi-file) 초기화 시작');

    try {
      await super.init();

      if (!this.element) {
        throw new Error(`IDE 컴포넌트 요소를 찾을 수 없습니다: ${this.options.elementId}`);
      }

      // 하위 모듈 초기화
      await this.initializeModules();

      // 초기 파일 설정 (main.py)
      this.initDefaultFiles();

      // EventBus 설정
      this.setupEventBusListeners();

      // 다운로드 버튼 이벤트 설정
      this.setupDownloadButton();

      this.state.isInitialized = true;
      console.log('IDEComponent 초기화 완료');
      return true;

    } catch (error) {
      console.error('IDEComponent 초기화 오류:', error);
      return false;
    }
  }

  initDefaultFiles() {
    // 초기 상태: main.py 하나만 존재
    this.state.files = [
      { name: 'main.py', content: '# Write your code here\nprint("Hello World")', isReadOnly: false }
    ];
    this.state.activeFileName = 'main.py';
    this.refreshUI();
  }

  /**
   * 하위 모듈 초기화
   */
  async initializeModules() {
    try {
      // 1. FileTree
      if (window.FileTree) {
        this.modules.fileTree = new window.FileTree({
          containerId: 'file-tree-container',
          onFileSelect: (file) => this.switchFile(file.name),
          onFileRename: (oldName, newName) => this.renameFile(oldName, newName), // 🔥 Rename Handler
          onFileDelete: (name) => this.deleteFile(name),

          // 🔥 Footer Actions Handlers (mapped to IDE methods)
          onFontIncrease: () => this.adjustFontSize(1),
          onFontDecrease: () => this.adjustFontSize(-1),
          onRestore: () => this.restoreCode(),
          onDownload: () => this.downloadCode(),
          onRefresh: () => {
            // 🔥 Refresh = Force reload example code (Reset)
            if (this.modules.codeEditor) {
              this.modules.codeEditor.loadExampleCodeFromAPI(this.state.currentExamName, this.state.currentProblemNumber);
            }
          }
        });
        // 전역 참조 (onclick용)
        window.fileTree = this.modules.fileTree;
        await this.modules.fileTree.init();
      }

      // 2. EditorTabs
      if (window.CodeEditorTabs) {
        this.modules.editorTabs = new window.CodeEditorTabs({
          containerId: 'editor-tabs-container',
          onTabSelect: (name) => this.switchFile(name),
          onTabClose: (name) => this.closeFileTab(name), // 탭 닫기는 파일 삭제가 아님 (화면에서만 닫음)
          onTabRename: (oldName, newName) => this.renameFile(oldName, newName), // 🔥 Tab Rename
          onTabAdd: () => this.createInstantFile() // 🔥 새 파일 생성 (Instant)
        });
        window.editorTabs = this.modules.editorTabs;
        await this.modules.editorTabs.init();
      }

      // 3. CodeEditor
      if (window.CodeEditor) {
        this.modules.codeEditor = new window.CodeEditor({
          editorId: 'editor',
          showAnswerButtonId: 'showAnswerBtn',
          aceButtonId: 'ace-btn',
          jupyterButtonId: 'jupyter-btn',
          loadExampleButtonId: 'loadExampleBtn'
        });

        // 에디터 내용 변경 감지 -> state 업데이트
        // CodeEditor에 onChange 이벤트를 주입하거나, 주기적으로 가져와야 함.
        // 여기서는 saveCurrentFile() 메서드를 이용해 전환 직전에 저장.

        const codeEditorInit = await this.modules.codeEditor.init();
        if (!codeEditorInit) throw new Error('CodeEditor 모듈 초기화 실패');

        // 에디터 내용 변경 시 실시간 상태 동기화 (간단한 구현)
        const editorInstance = this.modules.codeEditor.state.editor;
        if (editorInstance) {
          editorInstance.on('change', () => {
            const content = editorInstance.getValue();
            this.updateFileContent(this.state.activeFileName, content);
          });
        }

        window.codeEditor = this.modules.codeEditor;
      }

      // 4. Terminal
      if (window.Terminal) {
        this.modules.terminal = new window.Terminal({
          outputId: 'output-content',
          runButtonId: 'runCodeBtn',
          clearButtonId: 'clearOutputBtn'
        });

        await this.modules.terminal.init();

        // 터미널 실행 버튼 오버라이드 -> 멀티 파일 전송 로직
        // Terminal.js가 runCode()를 호출할 때, IDEComponent의 runCode()가 호출되도록 연결
        // 현재 구조상 Terminal.js 내부에서 runCode를 호출하므로, 
        // Terminal 인스턴스의 runCode 메서드를 여기서 덮어쓰거나, 
        // Terminal이 IDEComponent.runCode를 호출하게 해야 함.
        // 가장 깔끔한 건 Terminal.js의 onRun 설정을 사용하는 것이지만, 
        // 지금은 IDEComponent.runCode() 메서드를 직접 호출하는 구조가 아니므로
        // Terminal.js의 run 로직을 가로채야 함.

        /**
         * 🔥 중요: 기존 Terminal.js는 단일 코드 실행만 가정하고 있음.
         * 이를 멀티 파일 실행으로 바꾸기 위해, Terminal 클래스를 수정하지 않고
         * 여기서 runCode 동작을 재정의함.
         */
        this.modules.terminal.runCode = () => this.runMultiFileCode();
      }

      // 5. Submit Button
      const submitBtn = document.getElementById(this.options.submitButtonId);
      if (submitBtn) {
        submitBtn.addEventListener('click', () => this.submitSolution());
      }

    } catch (error) {
      console.error('모듈 초기화 오류:', error);
      throw error;
    }
  }

  // --- Multi-file Logic ---

  /**
   * 파일 내용 업데이트 (State 동기화)
   */
  updateFileContent(fileName, content) {
    const file = this.state.files.find(f => f.name === fileName);
    if (file) {
      file.content = content;
    }
  }

  /**
   * 파일 전환 (Switching)
   */
  switchFile(fileName) {
    if (this.state.activeFileName === fileName) return;

    // 1. 현재 파일 내용 저장 (이미 change 리스너로 되지만 안전장치)
    const currentContent = this.modules.codeEditor.getCurrentCode();
    this.updateFileContent(this.state.activeFileName, currentContent);

    // 3. 대상 파일 찾기
    const targetFile = this.state.files.find(f => f.name === fileName);
    if (!targetFile) return;

    // 4. activeFileName 업데이트 (순서 중요: setCode보다 먼저 변경해야 함)
    // setCode()가 change 이벤트를 발생시키는데, 이때 activeFileName이 변경되어 있어야
    // 대상 파일(targetFile)에 변경사항이 반영됨 (혹은 의도치 않은 old file 덮어쓰기 방지)
    this.state.activeFileName = fileName;

    // 5. 에디터 내용 교체 (이벤트 발생 -> activeFileName인 새 파일에 업데이트됨 - 안전함)
    this.modules.codeEditor.setCode(targetFile.content);

    this.refreshUI();
  }

  /**
   * 새 파일 생성 프롬프트
   */
  /**
   * 새 파일 생성 프롬프트 (deprecated in favor of instant)
   */
  createFilePrompt() {
    // fileTree가 있으면 fileTree의 handleFileCreate를 호출해서 로직 재사용
    if (this.modules.fileTree) {
      this.modules.fileTree.handleFileCreate();
    }
  }

  /**
   * 즉시 새 파일 생성 (이름 자동 생성) - Chrome Tab Style
   */
  createInstantFile() {
    let baseName = 'new';
    let ext = '.py';
    let count = 0;
    let fileName = baseName + ext;

    // 중복되지 않는 이름 찾기
    while (this.state.files.find(f => f.name === fileName)) {
      count++;
      fileName = `${baseName}${count}${ext}`;
    }

    this.createFile(fileName);
  }

  /**
   * 새 파일 생성 (실제 로직)
   */
  createFile(fileName) {
    if (this.state.files.find(f => f.name === fileName)) return;

    const newFile = {
      name: fileName,
      content: '# New File\n',
      isReadOnly: false
    };
    this.state.files.push(newFile);

    // 새 파일을 열고 탭에도 추가
    if (window.editorTabs) {
      window.editorTabs.addTab(fileName);
    }
    this.switchFile(fileName);
  }

  /**
   * 파일 삭제
   */
  deleteFile(fileName) {
    this.state.files = this.state.files.filter(f => f.name !== fileName);

    if (window.editorTabs) {
      window.editorTabs.removeTab(fileName);
    }

    // 만약 보고 있던 파일을 삭제했다면 main.py 등으로 이동
    if (this.state.activeFileName === fileName) {
      this.switchFile(this.state.files[0].name);
    } else {
      this.refreshUI();
    }
  }

  /**
   * 탭 닫기 (파일은 유지하지만 탭바에서만 제거 - 실제로는 파일이 닫히는 개념이 아님)
   * 여기서는 탭을 닫으면 자동으로 다른 탭을 보여주는 UI 로직만 수행
   */
  closeFileTab(fileName) {
    if (window.editorTabs) {
      window.editorTabs.removeTab(fileName);
    }
    // 탭을 닫았는데 그게 활성 탭이었다면? EditorTabs.removeTab이 activeTabName을 업데이트해줌.
    // 우리는 업데이트된 activeTabName으로 에디터를 갱신해야 함.
    if (window.editorTabs) {
      const nextActive = window.editorTabs.activeTabName;
      if (nextActive && nextActive !== this.state.activeFileName) {
        this.switchFile(nextActive);
      }
    }
  }

  /**
   * UI 갱신 (FileTree Highlight, Tabs Highlight)
   */
  refreshUI() {
    if (this.modules.fileTree) {
      this.modules.fileTree.setFiles(this.state.files);
      this.modules.fileTree.setActiveFile(this.state.activeFileName);
    }
    if (this.modules.editorTabs) {
      // 모든 파일을 탭으로? 혹은 열린 파일만?
      // 편의상 모든 파일을 탭에 띄우거나, FileTree에서 더블클릭 시 탭 추가 방식
      // 여기서는 간단하게 "모든 사용자 파일 = 탭"으로 동기화 (VSCode 스타일은 복잡함)
      // 아니면 FileTree 목록과 Tabs 목록을 별도로 관리해야 함.
      // 사용자 경험상, 파일을 생성하면 탭에 추가.
      // 여기서 setTabs는 현재 열려있는 탭 목록이어야 하는데, state.files 전체를 넣으면 너무 많을 수 있음.
      // -> 단순화를 위해 "FileTree에 있는 모든 파일이 Tabs에 뜸"으로 시작 (추후 개선)
      this.modules.editorTabs.setTabs(this.state.files.map(f => f.name));
      this.modules.editorTabs.setActiveTab(this.state.activeFileName);
    }
  }

  /**
   * 🔥 멀티 파일 실행 로직
   */
  async runMultiFileCode() {
    console.log('🚀 멀티 파일 코드 실행 중...');

    // 1. 현재 에디터 내용 저장
    const currentContent = this.modules.codeEditor.getCurrentCode();
    this.updateFileContent(this.state.activeFileName, currentContent);

    // 2. 실행 요청 준비
    // 파일 배열 생성: [{ path: 'main.py', content: '...' }]
    const filesPayload = this.state.files.map(f => ({
      path: f.name,
      content: f.content
    }));

    // 3. 서버 전송
    try {
      // Terminal UI 초기화
      this.modules.terminal.clearOutput();
      this.modules.terminal.appendToOutput('Running...\n', 'info');

      // TerminalInput 상태 초기화
      if (this.modules.terminal.terminalInput) {
        this.modules.terminal.terminalInput.clearInputQueue();
        this.modules.terminal.terminalInput.setExecutionContext(null);
      }

      // API 호출
      const response = await fetch('/api/python-problems/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filesPayload,
          entryPoint: 'main.py' // 항상 main.py 실행
        })
      });

      const result = await response.json();

      if (result.success) {
        // 결과 출력
        if (result.result.stdout) {
          this.modules.terminal.appendToOutput(result.result.stdout + '\n');
        }
        if (result.result.stderr) {
          this.modules.terminal.appendToOutput(result.result.stderr + '\n', 'error');
        }

        // 프로세스 정보가 있다면(대화형) 별도 처리 필요하지만, 
        // 현재 /run API는 단발성 실행(exec)임.
        // 대화형(interactive)을 지원하려면 /run-interactive API를 멀티파일 지원하도록 수정해야 함.
        // Phase 1 기본 실행은 여기까지.

      } else {
        this.modules.terminal.appendToOutput(`Error: ${result.error}\n`, 'error');
      }

    } catch (error) {
      console.error('Execution error:', error);
      this.modules.terminal.appendToOutput(`Client Error: ${error.message}\n`, 'error');
    }
  }

  /**
   * 🔥 솔루션 제출
   */
  async submitSolution() {
    console.log('📝 Submitting solution...');
    const submitBtn = document.getElementById(this.options.submitButtonId);
    if (submitBtn) submitBtn.disabled = true;

    // Show Modal
    const modalEl = document.getElementById('submissionResultModal');
    const modalBody = document.getElementById('submissionResultBody');
    if (modalEl && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
      // Reset modal content
      modalBody.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">채점 중...</span>
                </div>
                <p class="mt-2">채점 중입니다...</p>
            </div>
         `;
    }

    try {
      const code = this.modules.codeEditor.getCurrentCode();
      // Use currentProblemNumber as problemId (assuming backend handles it)
      const problemId = this.state.currentProblemNumber;

      const response = await fetch('/api/submit-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, code })
      });

      const result = await response.json();

      // Render Result
      if (result.success && result.data) {
        this.renderSubmissionResult(result.data);
      } else {
        if (modalBody) {
          modalBody.innerHTML = `<div class="alert alert-danger">${result.message || '오류가 발생했습니다.'}</div>`;
        }
      }

    } catch (e) {
      console.error(e);
      if (modalBody) modalBody.innerHTML = `<div class="alert alert-danger">서버 통신 오류</div>`;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  renderSubmissionResult(data) {
    const modalBody = document.getElementById('submissionResultBody');
    if (!modalBody) return;

    let html = `<div class="mb-3 text-center">
        <h4>${data.success ? '<span class="text-success"><i class="bi bi-check-circle"></i> 통과</span>' : '<span class="text-danger"><i class="bi bi-x-circle"></i> 실패</span>'}</h4>
        <p>총 ${data.total}개 중 ${data.passed}개 테스트 케이스 통과</p>
      </div>`;

    html += '<ul class="list-group">';
    data.results.forEach((r, i) => {
      const statusClass = r.passed ? 'list-group-item-success' : 'list-group-item-danger';
      const icon = r.passed ? 'bi-check' : 'bi-x';

      let detail = '';
      if (!r.passed) {
        if (r.message) detail += `<br><small>${r.message}</small>`;
        if (r.expected) detail += `<br><small>Expected: ${r.expected}</small>`;
        if (r.actual !== undefined) detail += `<br><small>Actual: ${r.actual}</small>`;
        if (r.error) detail += `<br><small class="text-danger">Error: ${r.error}</small>`;
      }

      html += `<li class="list-group-item ${statusClass} d-flex justify-content-between align-items-center">
              <div>
                  <strong>테스트 케이스 ${i + 1}</strong>: ${r.passed ? '통과' : '실패'}
                  ${detail}
              </div>
              <i class="bi ${icon}" style="font-size: 1.5rem;"></i>
          </li>`;
    });
    html += '</ul>';

    modalBody.innerHTML = html;
  }

  // --- 기존 메서드 호환 (onProblemChanged 등) ---

  onProblemChanged(examName, problemNumber) {
    // 문제 로드 시 파일 목록 초기화 로직 필요
    // (API에서 문제의 starter_code 등을 가져와서 main.py에 세팅)
    super.onProblemChanged(examName, problemNumber);

    // 예시: 문제 변경 시 main.py 리셋
    // 실제로는 loadExampleCodeFromAPI 등이 호출되면서 codeEditor 값을 바꿈.
    // 그 값을 잡아서 main.py content로 업데이트해야 함.
  }

  setupEventBindings() {
    super.setupEventBusListeners(); // Assuming Component class has this, or use super.setupEventBindings() if it exists? Wait, the original code had setupEventBusListeners calling super.setupEventBusListeners(). 
    // Let's stick to modifying setupEventBusListeners method which is at line 505.
  }

  // Override setupEventBusListeners to add our custom listener
  setupEventBusListeners() {
    // super.setupEventBusListeners(); // Parent class does not have this method

    if (window.EventBus) {
      window.EventBus.subscribe('problemChanged', (data) => {
        console.log('IDEComponent: Problem changed', data);
        this.updateProblemBankUI(data.answerType);
      });
    }
  }

  updateProblemBankUI(answerType) {
    const controls = document.getElementById('problem-bank-controls');
    if (!controls) return;

    // Check if answerType exists and is not empty (Problem Bank Mode)
    // answerType can be 'io', 'function.solution', etc.
    // 🔥 FORCED: If PAGE_TYPE is 'algorithm', assume Problem Bank Mode
    if ((window.PAGE_TYPE === 'algorithm') || (answerType && typeof answerType === 'string' && answerType.trim() !== '')) {
      console.log('IDEComponent: Problem Bank Mode activated (' + (answerType || 'algorithm') + ')');
      controls.style.display = 'flex';
    } else {
      console.log('IDEComponent: Problem Bank Mode deactivated');
      controls.style.display = 'none';
    }
  }

  // 다운로드 등...
  setupDownloadButton() {
    // 전체 파일 압축 다운로드? 아니면 현재 파일만?
    // 우선 현재 파일만 다운로드하도록 유지
    super.setupDownloadButton();
  }
  // --- Footer Control Methods ---

  adjustFontSize(delta) {
    if (this.modules.codeEditor && this.modules.codeEditor.changeFontSize) {
      this.modules.codeEditor.changeFontSize(delta);
    }
  }

  restoreCode() {
    if (this.modules.codeEditor && this.modules.codeEditor.restoreExampleCode) {
      this.modules.codeEditor.restoreExampleCode();
    } else {
      // Fallback
      alert('Restore function not available.');
    }
  }

  downloadCode() {
    if (this.modules.codeEditor && this.modules.codeEditor.downloadCode) {
      this.modules.codeEditor.downloadCode();
    } else {
      // Fallback: simple download for single file content
      const content = this.modules.codeEditor.getCurrentCode ? this.modules.codeEditor.getCurrentCode() : '';
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = this.state.activeFileName || "code.py";
      a.click();
    }
  }
}

// 전역 스코프에 노출
window.IDEComponent = IDEComponent;