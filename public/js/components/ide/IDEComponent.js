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

      // Global reference for onclick handlers
      window.ideComponent = this;

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
    this.hideResultView(); // 🔥 Force show terminal
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
  // 🔥 Confetti Effect
  async triggerConfetti() {
    if (!window.confetti) {
      // Dynamic load
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    if (window.confetti) {
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  // 🔥 Series End Confetti
  async triggerBigConfetti() {
    if (!window.confetti) {
      await this.triggerConfetti(); // Load it first
    }

    if (window.confetti) {
      var duration = 3000;
      var animationEnd = Date.now() + duration;
      var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function random(min, max) {
        return Math.random() * (max - min) + min;
      }

      var interval = setInterval(function () {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        window.confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } }));
        window.confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } }));
      }, 250);
    }
  }

  // 🔥 Sound Effect
  playSound(type) {
    const sounds = {
      success: '/resource/sound/yay.mp3',
      fail: '/resource/sound/e-oh.mp3',
      complete: '/resource/sound/tada.mp3'
    };

    const path = sounds[type];
    if (path) {
      const audio = new Audio(path);
      audio.volume = 0.7; // 🔥 Reduced volume to 70%
      audio.play().catch(e => console.log('Audio play error:', e));
    }
  }

  // 🔥 Auto Navigation
  moveToNextProblem() {
    const nextNum = parseInt(this.state.currentProblemNumber) + 1;
    console.log(`Auto-navigating to problem ${nextNum}`);

    // Update State
    this.state.currentProblemNumber = nextNum;

    // Hide Modal
    this.hideResultView();

    // Trigger Problem Change Logic
    // 1. Update UI (Sidebar?) - This is hard to reach from here without global event.
    // Try EventBus if available
    if (window.EventBus) {
      // Assuming there is a listener that handles 'problemSelection' or similar
      // For now, let's try to reload the editor content manually as a fallback
    }

    // 2. Reload Code
    if (this.modules.codeEditor) {
      this.modules.codeEditor.loadExampleCodeFromAPI(this.state.currentExamName, nextNum);
    }


    // 3. Update URL if possible (optional, might require page reload if heavy)
    // alert('Next Problem!'); 
  }

  // 🔥 Terminal Swap Logic -> Now Bottom Sheet Modal
  showResultView() {
    const resultModal = document.getElementById('submission-result-modal');
    if (resultModal) {
      resultModal.style.display = 'flex';
      resultModal.classList.remove('hiding'); // Ensure hiding class is gone

      // Force Reflow or Wait for next frame to trigger animation
      requestAnimationFrame(() => {
        resultModal.classList.add('show');
      });
    }
  }

  hideResultView() {
    const resultModal = document.getElementById('submission-result-modal');
    if (resultModal) {
      // 1. Trigger Exit Animation
      resultModal.classList.add('hiding'); // Add elastic exit easing
      resultModal.classList.remove('show'); // Slide down

      // 2. Wait for animation to finish before hiding display
      setTimeout(() => {
        resultModal.style.display = 'none';
        resultModal.classList.remove('hiding'); // Reset
      }, 800); // Back In Ease needs more time
    }
  }

  async submitSolution() {
    console.log('📝 Submitting solution...');
    const submitBtn = document.getElementById(this.options.submitButtonId);
    if (submitBtn) submitBtn.disabled = true;

    // 🔥 Show Modal & Loading
    this.showResultView();
    const resultBody = document.getElementById('submission-result-body');

    if (resultBody) {
      resultBody.innerHTML = `
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
      const problemId = this.state.currentProblemNumber;
      const examName = this.state.currentExamName;

      const response = await fetch('/api/submit-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, code, examName })
      });

      const result = await response.json();

      // Render Result
      if (result.success && result.data) {
        // 🔥 Pass specifically the body element if renderSubmissionResult expects it, 
        // or update renderSubmissionResult to look for the body ID.
        // Assuming renderSubmissionResult uses 'submission-result-content' ID internally, let's fix it there too.
        this.renderSubmissionResult(result.data);

        // 🔥 UX Logic: Sound, Confetti, Nav
        const isSuccess = result.data.success;
        const currentNum = parseInt(this.state.currentProblemNumber);

        if (isSuccess) {
          if (currentNum >= 10) {
            this.playSound('complete');
            this.triggerBigConfetti();
          } else {
            this.playSound('success');
            this.triggerConfetti();
          }
        } else {
          this.playSound('fail');
        }

      } else {
        if (resultBody) {
          resultBody.innerHTML = `
            <div class="alert alert-danger m-3">
                ${result.message || '오류가 발생했습니다.'}
                <div class="mt-3">
                    <button class="btn btn-secondary btn-sm" onclick="window.ideComponent.hideResultView()">닫기</button>
                </div>
            </div>`;
        }
      }

    } catch (e) {
      console.error(e);
      if (resultBody) {
        resultBody.innerHTML = `
            <div class="alert alert-danger m-3">
                서버 통신 오류
                <div class="mt-3">
                    <button class="btn btn-secondary btn-sm" onclick="window.ideComponent.hideResultView()">닫기</button>
                </div>
            </div>`;
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  renderSubmissionResult(data) {
    const resultContent = document.getElementById('submission-result-body');
    if (!resultContent) return;

    // 2. Calculate Pass Rate & Performance Metrics
    const passRate = (data.passed / data.total) * 100;

    // 🔥 Calculate Max Time & Memory
    let maxTime = 0;
    let maxMemory = 0;
    if (data.results && data.results.length > 0) {
      data.results.forEach(r => {
        const t = parseFloat(r.executionTime || 0);
        const m = parseInt(r.memory || 0);
        if (t > maxTime) maxTime = t;
        if (m > maxMemory) maxMemory = m;
      });
    }
    const timeDisplay = maxTime.toFixed(3) + 's';
    const memoryDisplay = (maxMemory / 1024).toFixed(2) + 'MB'; // Convert KB to MB

    const isSuccess = data.success;
    const progressColor = isSuccess ? '#34c759' : (passRate > 50 ? '#ff9f0a' : '#ff3b30'); // Apple Green, Orange, Red

    // 2. Apple Style CSS (Injected for scoped usage)
    const style = `
      <style>
        .apple-container {
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1d1d1f;
          display: flex;
          justify-content: center; /* 🔥 중앙 정렬 */
        }
        .apple-card {
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.04);
          width: 100%;
          max-width: 900px; /* 🔥 Increased width for split view */
          display: flex; /* 🔥 Horizontal Layout */
          flex-direction: row; 
          align-items: stretch;
          height: 100%; /* Ensure it fills height if needed */
        }
        .apple-header {
          width: 300px; /* 🔥 Fixed width for left panel */
          flex-shrink: 0;
          padding: 40px 20px;
          text-align: center;
          background: linear-gradient(180deg, #ffffff 0%, #fbfbfd 100%);
          border-right: 1px solid rgba(0,0,0,0.06); /* Changed bottom to right */
          border-bottom: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .apple-status-text {
          font-size: 24px; 
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-top: 20px;
          margin-bottom: 10px;
          color: #1d1d1f;
          word-break: break-word;
        }
        .apple-subtext {
          font-size: 14px;
          color: #86868b;
          font-weight: 500;
          word-break: break-word;
        }
        .apple-list {
          flex: 1; /* 🔥 Take remaining width */
          padding: 0;
          margin: 0;
          list-style: none;
          overflow-y: auto; /* 🔥 Independent scroll */
          background: #fff;
          display: flex;
          flex-direction: column;
        }
        .apple-list-item {
          padding: 15px 20px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          display: flex;
          gap: 15px; 
          align-items: flex-start;
          transition: background 0.2s;
        }
        .apple-list-item:last-child { border-bottom: none; }
        .apple-list-item:hover { background: #fafafa; }
        
        .apple-case-badge {
          font-size: 11px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          background: #f5f5f7;
          padding: 4px 8px;
          border-radius: 6px;
          min-width: 50px; 
          text-align: center;
        }
        
        .apple-code-box {
          font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
          background: #f5f5f7;
          border-radius: 6px; /* 🔥 Reduced radius */
          padding: 6px 10px; /* 🔥 Reduced padding */
          font-size: 12px; /* 🔥 Reduced font size */
          color: #1d1d1f;
          margin-top: 4px; /* 🔥 Reduced margin */
          word-break: break-all;
          white-space: pre-wrap; 
        }
        .apple-label {
          font-size: 11px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 4px;
          display: block;
        }
        .apple-diff-box {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 6px;
        }
        .apple-diff-row {
            display: flex;
            align-items: baseline;
            gap: 10px;
            font-size: 13px;
        }
        .apple-diff-label {
            width: 60px;
            font-size: 11px;
            font-weight: 600;
            color: #86868b;
            text-align: right;
            flex-shrink: 0;
        }
        .apple-diff-val {
            font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
            flex: 1;
            word-break: break-all; /* 🔥 줄바꿈 추가 */
            white-space: pre-wrap;
        }
        .val-error { color: #ff3b30; }
        .val-success { color: #34c759; }
        .progress-apple {
            height: 6px;
            background: #f2f2f7;
            border-radius: 3px;
            margin-top: 20px;
            overflow: hidden;
            width: 60%;
            margin-left: auto;
            margin-right: auto;
        }
        .progress-bar-apple {
            height: 100%;
            border-radius: 3px;
            transition: width 0.6s ease-out;
        }
      </style>`;

    // 3. Construct HTML
    let html = `
      ${style}
      <div class="apple-container">
          <div class="apple-card">
              <!-- Header -->
              <div class="apple-header">
                  <div style="font-size: 52px; color: ${progressColor};">
                      <i class="bi ${isSuccess ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
                  </div>
                  <div class="apple-status-text">${isSuccess ? '성공' : '실패'}</div>
                  <div class="apple-subtext">총 ${data.total}개 중 ${data.passed}개 테스트 케이스 통과</div>
                  <div class="apple-subtext" style="font-size: 12px; margin-top: 4px; color: #86868b;">
                      정답률: ${Math.round(passRate)}%
                  </div>
                  <div class="apple-subtext" style="font-size: 11px; margin-top: 2px; color: #86868b; font-family: monospace;">
                      ⏱ ${timeDisplay} | 💾 ${memoryDisplay}
                  </div>
                  
                  <div class="progress-apple">
                      <div class="progress-bar-apple" style="width: ${passRate}%; background: ${progressColor};"></div>
                  </div>
              </div>

              <!-- List -->
              <div class="apple-list">`;

    data.results.forEach((r, i) => {
      const statusIcon = r.passed ?
        `<i class="bi bi-check-circle-fill" style="color: #34c759; font-size: 20px;"></i>` :
        `<i class="bi bi-x-circle-fill" style="color: #ff3b30; font-size: 20px;"></i>`;

      // 🔥 Trim content to reduce vertical space
      const inputVal = (r.input || '').trim();
      const actualVal = (r.actual || '').trim();
      const expectedVal = (r.expected || '').trim();

      // Input Display
      const inputDisplay = (r.message && r.message.includes('Hidden')) ?
        '<span style="color: #86868b; font-style: italic;">Hidden Case</span>' :
        `<div class="apple-code-box">${inputVal}</div>`;

      // Output Display
      let outputDisplay = '';
      if (r.passed) {
        // Success Case
        outputDisplay = `
            <div>
                <span class="apple-label">Output</span>
                <div class="apple-code-box text-success" style="background:#f0fff4; color:#34c759;">
                    ${actualVal || '(Empty)'}
                </div>
            </div>`;
      } else {
        // Fail Case (Diff)
        if (r.error) {
          outputDisplay = `<div class="apple-code-box" style="background:#fff0f0; color:#ff3b30;">${r.error}</div>`;
        } else {
          outputDisplay = `
                <div class="apple-diff-box">
                    <div class="apple-diff-row">
                        <span class="apple-diff-label">ACTUAL</span>
                        <span class="apple-diff-val val-error">${actualVal || '(Empty)'}</span>
                    </div>
                    <div class="apple-diff-row">
                        <span class="apple-diff-label">EXPECTED</span>
                        <span class="apple-diff-val val-success">${expectedVal || '(Empty)'}</span>
                    </div>
                </div>`;
        }
      }


      html += `
        <div class="apple-list-item">
            <div class="d-flex flex-column align-items-center gap-2 pt-1">
                <span class="apple-case-badge">CASE ${i + 1}</span>
                ${statusIcon}
            </div>
            
            <div style="flex: 1;">
                <div class="mb-3">
                    <span class="apple-label">Input</span>
                    ${inputDisplay}
                </div>
                ${outputDisplay}
                ${r.message ? `<div class="mt-2" style="font-size:12px; color:#86868b;">${r.message}</div>` : ''}
            </div>
        </div>`;
    });

    html += `
      </div> <!-- End apple-list -->
      </div> <!-- End apple-card -->
    </div> <!-- End apple-container -->
    `;

    resultContent.innerHTML = html;
  }



  // --- 기존 메서드 호환 (onProblemChanged 등) ---

  onProblemChanged(examName, problemNumber) {
    console.log(`[IDEComponent] Problem Changed: ${examName} / ${problemNumber}`);

    // 1. 상태 업데이트
    this.state.currentExamName = examName;
    this.state.currentProblemNumber = problemNumber;

    // 2. Mock or Real File Loading Logic
    // If we have a loader, use it:
    if (this.modules.codeEditor && this.modules.codeEditor.loadExampleCodeFromAPI) {
      this.modules.codeEditor.loadExampleCodeFromAPI(examName, problemNumber);
    }

    // 3. Reset files state if needed (optional)
    // this.initDefaultFiles(); // careful not to overwrite user work if not intended
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
    // super.setupDownloadButton(); // Parent does not have this method
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