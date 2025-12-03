/**
 * CodeEditor.js - 코드 편집 환경 전담 모듈 (거터 CSS 전용)
 * ACE 에디터, Jupyter, 정답 코드, Python 문법 등 편집 관련 모든 기능
 */

class CodeEditor {
  constructor(options = {}) {
    // 기본 옵션 설정
    this.options = {
      editorId: 'editor',
      showAnswerButtonId: 'showAnswerBtn',
      aceButtonId: 'ace-btn',
      jupyterButtonId: 'jupyter-btn',
      loadExampleButtonId: 'loadExampleBtn',
      restoreButtonId: 'restore-example-btn',
      ...options
    };
    
    // 상태 관리
    this.state = {
      editor: null,
      currentExamName: '',
      currentProblemNumber: 1,
      currentMode: 'ace', // 'ace' or 'jupyter'
      isInitialized: false
    };
    
    // 🔥 폰트 크기 관리 - 향상된 버전
    this.fontState = {
      currentFontSize: parseInt(localStorage.getItem('ide-font-size') || '14'),
      minFontSize: 10,
      maxFontSize: 24
    };
    
    // 예제 코드 상태 관리
    this.exampleCodeState = {
      originalCode: null,
      hasExampleFile: false,
      currentProblem: null
    };
    
    // 바인딩
    this.boundShowAnswer = null;
    this.boundResizeEditor = null;
    this.boundToggleMode = null;
    this.boundLoadExample = null;
    this.boundRestoreExample = null;
    this.restoreButton = null;
    this.boundHandleProblemChanged = null;
    
    // 🔥 폰트 크기 조절 바인딩
    this.boundFontIncrease = null;
    this.boundFontDecrease = null;
  }
  
  /**
   * 코드 에디터 초기화
   */
  async init() {
    console.log('CodeEditor 초기화 시작');
    
    try {
      await this.initializeAceEditor();
      this.setupEventListeners();
      this.setupJupyterInterface();
      this.createRestoreButton();
      
      // 🔥 폰트 크기 조절 초기화
      this.initFontControls();
      
      this.setupEventBusListeners();
      
      this.state.isInitialized = true;
      console.log('✅ CodeEditor 초기화 완료');
      return true;
      
    } catch (error) {
      console.error('❌ CodeEditor 초기화 오류:', error);
      return false;
    }
  }
  
  /**
   * ACE 에디터 초기화
   */
  async initializeAceEditor() {
    const editorElement = document.getElementById(this.options.editorId);
    if (!editorElement) {
      throw new Error(`에디터 요소를 찾을 수 없습니다: ${this.options.editorId}`);
    }
    
    try {
      this.state.editor = ace.edit(this.options.editorId);
      
      // VSCode 스타일 테마 설정
      this.state.editor.setTheme("ace/theme/monokai");
      this.state.editor.session.setMode("ace/mode/python");
      
      // 에디터 옵션 설정
      this.state.editor.setOptions({
        fontSize: this.fontState.currentFontSize + "px",
        showPrintMargin: false,
        highlightActiveLine: true,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true,
        wrap: true,
        showGutter: true,
        showLineNumbers: true,
        displayIndentGuides: true,
        tabSize: 4,
        useSoftTabs: true
      });
      
      // Python 자동완성 설정
      if (window.PythonAutoCompleter) {
        const autoCompleter = new window.PythonAutoCompleter({
          elementId: 'python-autocompleter-instance'
        });
        
        const setupResult = autoCompleter.setupForEditor(this.state.editor);
        if (setupResult) {
          this.pythonAutoCompleter = autoCompleter;
          
          if (autoCompleter.forceGutterWidth) {
            autoCompleter.forceGutterWidth();
          }
          
          console.log('✅ Python 자동완성 설정 완료');
        } else {
          console.error('❌ Python 자동완성 설정 실패');
        }
      }
      
      // 초기 코드 설정
      this.state.editor.setValue(`# Python 코드를 입력하세요\nprint("Hello, World!")`, -1);
      
      // 기본 렌더링 완료 대기
      setTimeout(() => {
        this.state.editor.resize();
      }, 200);
      
      console.log('✅ ACE 에디터 초기화 완료');
      
    } catch (error) {
      console.error('❌ ACE 에디터 초기화 오류:', error);
      throw error;
    }
  }
  
  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 정답보기 버튼
    const showAnswerButton = document.getElementById(this.options.showAnswerButtonId);
    if (showAnswerButton) {
      showAnswerButton.removeEventListener('click', this.boundShowAnswer);
      this.boundShowAnswer = () => this.showAnswer();
      showAnswerButton.addEventListener('click', this.boundShowAnswer);
      console.log('✅ 정답보기 버튼 이벤트 리스너 등록 완료');
    }

    // 기본 코드 불러오기 버튼
    const loadExampleButton = document.getElementById(this.options.loadExampleButtonId);
    if (loadExampleButton) {
      loadExampleButton.removeEventListener('click', this.boundLoadExample);
      this.boundLoadExample = () => this.loadExampleCode();
      loadExampleButton.addEventListener('click', this.boundLoadExample);
      console.log('✅ 기본 코드 불러오기 버튼 이벤트 리스너 등록 완료');
    }

    // ACE/Jupyter 토글 버튼
    const aceButton = document.getElementById(this.options.aceButtonId);
    const jupyterButton = document.getElementById(this.options.jupyterButtonId);
    
    if (aceButton && jupyterButton) {
      aceButton.removeEventListener('click', this.boundToggleMode);
      jupyterButton.removeEventListener('click', this.boundToggleMode);
      
      this.boundToggleMode = (e) => this.toggleEditorMode(e.target.id);
      aceButton.addEventListener('click', this.boundToggleMode);
      jupyterButton.addEventListener('click', this.boundToggleMode);
      
      console.log('✅ IDE 모드 토글 버튼 이벤트 리스너 등록 완료');
    }
    
    // 창 크기 변경 이벤트
    window.removeEventListener('resize', this.boundResizeEditor);
    this.boundResizeEditor = () => this.resizeEditor();
    window.addEventListener('resize', this.boundResizeEditor);
    
    console.log('✅ CodeEditor 이벤트 리스너 설정 완료');
  }
  
  /**
   * 🔥 폰트 크기 조절 초기화
   */
  initFontControls() {
    console.log('🔥 폰트 조절 초기화 시작');
    
    // 폰트 크기 조절 버튼 이벤트 리스너
    const fontIncreaseBtn = document.getElementById('font-increase');
    const fontDecreaseBtn = document.getElementById('font-decrease');
    
    if (fontIncreaseBtn && fontDecreaseBtn) {
      this.boundFontIncrease = () => this.changeFontSize(1);
      this.boundFontDecrease = () => this.changeFontSize(-1);
      
      fontIncreaseBtn.addEventListener('click', this.boundFontIncrease);
      fontDecreaseBtn.addEventListener('click', this.boundFontDecrease);
      
      console.log('✅ 폰트 크기 조절 버튼 이벤트 리스너 등록 완료');
    } else {
      console.warn('⚠️ 폰트 크기 조절 버튼을 찾을 수 없습니다.');
    }
    
    // 초기 폰트 크기 적용
    this.applyFontSize(this.fontState.currentFontSize);
    this.updateFontControlButtons();
  }
  
  /**
   * 🔥 폰트 크기 변경
   */
  changeFontSize(delta) {
    const newSize = this.fontState.currentFontSize + delta;
    
    if (newSize >= this.fontState.minFontSize && newSize <= this.fontState.maxFontSize) {
      this.fontState.currentFontSize = newSize;
      localStorage.setItem('ide-font-size', newSize);
      
      // 폰트 크기 적용
      this.applyFontSize(newSize);
      this.updateFontControlButtons();
      
      // 터미널에도 폰트 크기 변경 알림
      if (window.EventBus) {
        window.EventBus.publish('font:change', { 
          size: newSize,
          terminalSize: newSize - 1 
        });
      }
      
      console.log(`🎯 폰트 크기 변경: ${newSize}px`);
    }
  }
  
  /**
   * 🔥 폰트 크기 적용 (거터 코드 제거)
   */
  applyFontSize(fontSize) {
    console.log(`🎯 폰트 크기 적용 시작: ${fontSize}px`);
    
    // 1. 폰트 상태 업데이트
    this.fontState.currentFontSize = fontSize;
    
    // 2. CSS 변수 업데이트
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--terminal-font-size', `${fontSize}px`);
    
    // 3. 폰트 크기 표시 업데이트
    const fontSizeDisplay = document.getElementById('font-size-display');
    if (fontSizeDisplay) {
      fontSizeDisplay.textContent = `${fontSize}px`;
    }
    
    // 4. ACE 에디터 폰트 크기 적용
    if (this.state.editor) {
      this.state.editor.setFontSize(fontSize);
    }
    
    console.log(`✅ 폰트 크기 적용 완료: ${fontSize}px`);
  }
  
  /**
   * 🔥 폰트 조절 버튼 상태 업데이트
   */
  updateFontControlButtons() {
    const fontIncreaseBtn = document.getElementById('font-increase');
    const fontDecreaseBtn = document.getElementById('font-decrease');
    
    if (fontIncreaseBtn) {
      fontIncreaseBtn.disabled = (this.fontState.currentFontSize >= this.fontState.maxFontSize);
    }
    
    if (fontDecreaseBtn) {
      fontDecreaseBtn.disabled = (this.fontState.currentFontSize <= this.fontState.minFontSize);
    }
  }
  
  /**
   * EventBus 이벤트 구독 설정
   */
  setupEventBusListeners() {
    if (window.EventBus) {
      // 문제 변경 이벤트 구독
      this.boundHandleProblemChanged = (data) => this.handleProblemChanged(data);
      window.EventBus.subscribe('problemChanged', this.boundHandleProblemChanged);
      
      console.log('✅ EventBus 이벤트 구독 완료');
    } else {
      console.warn('⚠️ EventBus를 찾을 수 없습니다.');
    }
  }
  
  /**
   * Jupyter 인터페이스 설정
   */
  setupJupyterInterface() {
    const jupyterContainer = document.getElementById('jupyter-ide-container');
    const jupyterFrame = document.getElementById('jupyter-frame');
    const jupyterAuthMessage = document.getElementById('jupyter-auth-message');
    
    if (jupyterContainer && jupyterFrame && jupyterAuthMessage) {
      // 초기 상태 설정
      jupyterContainer.style.display = 'none';
      jupyterFrame.style.display = 'none';
      jupyterAuthMessage.style.display = 'none';
      
      console.log('✅ Jupyter 인터페이스 설정 완료');
    }
  }
  
  /**
   * 에디터 모드 토글 (ACE ↔ Jupyter)
   */
  async toggleEditorMode(buttonId) {
    const aceContainer = document.getElementById('ace-editor-inner');
    const jupyterContainer = document.getElementById('jupyter-ide-container');
    const aceButton = document.getElementById(this.options.aceButtonId);
    const jupyterButton = document.getElementById(this.options.jupyterButtonId);
    
    if (!aceContainer || !jupyterContainer || !aceButton || !jupyterButton) {
      console.error('에디터 컨테이너를 찾을 수 없습니다');
      return;
    }
    
    if (buttonId === this.options.aceButtonId) {
      // ACE 모드로 전환
      this.state.currentMode = 'ace';
      
      aceContainer.classList.add('active');
      jupyterContainer.classList.remove('active');
      aceContainer.style.display = 'flex';
      jupyterContainer.style.display = 'none';
      
      aceButton.classList.add('active');
      jupyterButton.classList.remove('active');
      
      this.resizeEditor();
      console.log('✅ ACE 에디터 모드로 전환');
      
    } else if (buttonId === this.options.jupyterButtonId) {
      // Jupyter 모드로 전환
      this.state.currentMode = 'jupyter';
      
      aceContainer.classList.remove('active');
      jupyterContainer.classList.add('active');
      aceContainer.style.display = 'none';
      jupyterContainer.style.display = 'flex';
      
      aceButton.classList.remove('active');
      jupyterButton.classList.add('active');
      
      await this.loadJupyterNotebook();
      console.log('✅ Jupyter 모드로 전환');
    }
  }
  
  /**
   * Jupyter 노트북 로드
   */
  async loadJupyterNotebook() {
    const jupyterFrame = document.getElementById('jupyter-frame');
    const jupyterAuthMessage = document.getElementById('jupyter-auth-message');
    
    if (!jupyterFrame || !jupyterAuthMessage) {
      console.error('Jupyter 요소를 찾을 수 없습니다');
      return;
    }
    
    try {
      // 인증 메시지 표시
      jupyterAuthMessage.style.display = 'block';
      jupyterAuthMessage.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">로딩 중...</span>
          </div>
          <h5>JupyterHub 연결 중...</h5>
          <p>잠시만 기다려주세요.</p>
        </div>
      `;
      
      // Jupyter 인증 및 로드
      const response = await fetch('/api/jupyter-auth-direct', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.jupyterUrl) {
          // 성공적으로 URL을 받았으면 iframe에 로드
          jupyterFrame.src = result.jupyterUrl;
          jupyterFrame.style.display = 'block';
          jupyterAuthMessage.style.display = 'none';
          
          console.log('✅ Jupyter 노트북 로드 완료:', result.jupyterUrl);
        } else {
          throw new Error(result.message || 'Jupyter URL을 가져올 수 없습니다');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('❌ Jupyter 로드 오류:', error);
      
      jupyterAuthMessage.innerHTML = `
        <div class="text-center">
          <div class="alert alert-danger">
            <h5>JupyterHub 연결 실패</h5>
            <p>${error.message}</p>
            <button class="btn btn-primary btn-sm" onclick="location.reload()">
              다시 시도
            </button>
          </div>
        </div>
      `;
    }
  }
  
  /**
   * 문제 변경 이벤트 핸들러 (거터 코드 제거)
   */
  async handleProblemChanged(data) {
    console.log('📄 CodeEditor: 문제 변경됨', data);
    
    if (data && data.examName && data.problemNumber) {
      this.exampleCodeState.currentProblem = {
        examName: data.examName,
        problemNumber: data.problemNumber
      };
      
      // 기존 상태도 업데이트 (호환성)
      this.state.currentExamName = data.examName;
      this.state.currentProblemNumber = data.problemNumber;
      
      // 예제 코드 자동 로드
      await this.loadExampleCodeFromAPI(data.examName, data.problemNumber);
    } else {
      console.warn('⚠️ 문제 데이터가 불완전합니다:', data);
    }
  }
  
  /**
   * API를 통한 예제 코드 로드
   */
  async loadExampleCodeFromAPI(examName, problemNumber) {
    try {
      // 로딩 메시지
      this.showLoadingMessage('예제 코드를 불러오는 중...');
      
      // 문제 번호 포맷 맞추기 (p01, p02 형식)
      const problemNumberStr = String(problemNumber);
      const formattedProblemNumber = problemNumberStr.startsWith('p') 
        ? problemNumberStr 
        : `p${problemNumberStr.padStart(2, '0')}`;
      
      console.log(`🔄 포맷팅된 문제 번호: ${formattedProblemNumber} (원본: ${problemNumber})`);
      
      // API 호출
      const response = await fetch(`/api/get-example-code?examName=${encodeURIComponent(examName)}&problemNumber=${encodeURIComponent(formattedProblemNumber)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📄 예제 코드 API 응답:', data);
      
      if (data.success && data.code) {
        // ACE 에디터에 예제 코드 설정
        if (this.state.editor) {
          this.state.editor.setValue(data.code);
          this.state.editor.clearSelection();
          this.state.editor.gotoLine(1);
          
          // 원본 예제 코드 저장
          this.exampleCodeState.originalCode = data.code;
          this.exampleCodeState.hasExampleFile = data.hasExampleFile || false;
          
          // 복원 버튼 활성화
          this.updateRestoreButtonState(true);
          
          // 🔥 수정: 중복 방지 - EventBus 메시지만 전송
          console.log('✅ 예제 코드 로드 완료');
          
          // 🔥 더 이상 터미널에 중복 메시지 전송하지 않음
        }
      } else {
        // 예제 파일이 없으면 기본 템플릿 사용
        console.log('📝 예제 파일이 없어 기본 템플릿 사용');
        this.setDefaultTemplate(examName, problemNumber);
      }
    } catch (error) {
      // 🔥 수정: 중복 방지 - EventBus 메시지만 전송
      console.error('❌ 예제 코드 로드 오류:', error);
      
      // 오류 시 기본 템플릿 사용
      this.setDefaultTemplate(examName, problemNumber);
      
      // 🔥 더 이상 터미널에 중복 메시지 전송하지 않음
    } finally {
      this.hideLoadingMessage();
    }
  }
  
  /**
   * 기본 템플릿 설정
   */
  setDefaultTemplate(examName = 'Unknown', problemNumber = '01') {
    const defaultCode = `# ${examName} - 문제 ${problemNumber}`;
    
    if (this.state.editor) {
      this.state.editor.setValue(defaultCode);
      this.state.editor.clearSelection();
      this.state.editor.gotoLine(1);
    }
    
    // 원본 코드로 저장 (기본 템플릿도 복원 가능)
    this.exampleCodeState.originalCode = defaultCode;
    this.exampleCodeState.hasExampleFile = false;
    
    // 복원 버튼 활성화
    this.updateRestoreButtonState(true);
  }
  
  /**
   * 🔥 수정: IDE 헤더에 복원 버튼 생성
   */
  createRestoreButton() {
    console.log('🔍 복원 버튼 생성 시도...');
    
    // 이미 복원 버튼이 있는지 확인
    const existingButton = document.getElementById(this.options.restoreButtonId);
    if (existingButton) {
      console.log('⚠️ 복원 버튼이 이미 존재합니다. 제거 후 재생성...');
      existingButton.remove();
    }
    
    // 🔥 수정: IDE 헤더 슬롯 찾기
    const restoreSlot = document.getElementById('restore-button-slot');
    if (!restoreSlot) {
      console.error('❌ #restore-button-slot을 찾을 수 없습니다.');
      return;
    }
    
    console.log('✅ restore-button-slot 찾음:', restoreSlot);
    
    // 🔥 수정: IDE 헤더 스타일에 맞는 복원 버튼 생성
    const restoreBtn = document.createElement('button');
    restoreBtn.id = this.options.restoreButtonId;
    restoreBtn.className = 'btn btn-sm btn-outline-secondary ide-control-btn';
    restoreBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
    restoreBtn.disabled = true; // 초기에는 비활성화
    restoreBtn.title = '원본 예제 코드로 되돌리기';
    
    // 클릭 이벤트
    this.boundRestoreExample = () => this.restoreExampleCode();
    restoreBtn.addEventListener('click', this.boundRestoreExample);
    
    // 🔥 수정: 슬롯에 버튼 추가
    restoreSlot.appendChild(restoreBtn);
    
    // 참조 저장
    this.restoreButton = restoreBtn;
    
    console.log('✅ IDE 헤더 복원 버튼 생성 완료:', restoreBtn);
  }
  
  /**
   * 기본 코드 복원 기능
   */
  restoreExampleCode() {
    // 🔥 수정: 복원 버튼 메시지 다시 활성화
    if (!this.exampleCodeState.originalCode) {
      console.warn('복원할 원본 코드가 없습니다.');
      
      // 터미널에 경고 메시지
      if (window.EventBus) {
        window.EventBus.publish('terminal:output', {
          text: '복원할 원본 코드가 없습니다.',
          type: 'warning'
        });
      }
      return;
    }
    
    // 확인 대화상자
    if (!confirm('현재 작성한 코드가 모두 사라집니다. 기본 코드로 복원하시겠습니까?')) {
      return;
    }
    
    // 원본 코드 복원
    if (this.state.editor) {
      this.state.editor.setValue(this.exampleCodeState.originalCode);
      this.state.editor.clearSelection();
      this.state.editor.gotoLine(1);
    }
    
    // 🔥 수정: 복원 성공 메시지 다시 활성화
    if (window.EventBus) {
      window.EventBus.publish('terminal:output', {
        text: '기본 코드로 복원되었습니다.',
        type: 'normal'
      });
    }
    
    console.log('✅ 기본 코드 복원 완료');
  }
  
  /**
   * 🔥 수정: 복원 버튼 상태 관리 (다른 버튼과 동일한 색상 유지)
   */
  updateRestoreButtonState(enabled) {
    if (this.restoreButton) {
      this.restoreButton.disabled = !enabled;
      
      if (enabled) {
        // 🔥 수정: 파란색 대신 기본 색상 유지
        this.restoreButton.classList.remove('btn-outline-secondary');
        this.restoreButton.classList.add('btn-outline-secondary'); // 기본 색상 유지
        this.restoreButton.style.opacity = '1';
        this.restoreButton.style.borderColor = 'var(--vscode-border-light)';
      } else {
        this.restoreButton.classList.remove('btn-outline-info');
        this.restoreButton.classList.add('btn-outline-secondary');
        this.restoreButton.style.opacity = '0.6';
        this.restoreButton.style.borderColor = 'var(--vscode-border)';
      }
    }
  }
  
  /**
   * 🔥 수정: 로딩 메시지 표시/숨김 (비활성화)
   */
  showLoadingMessage(message) {
    // 🔥 비활성화: 더 이상 터미널에 로딩 메시지 전송하지 않음
    console.log('🔄', message);
  }
  
  hideLoadingMessage() {
    // 🔥 비활성화: 로딩 스피너 제거 로직 비활성화
    console.log('🔄 로딩 완료');
  }
  
  /**
   * 기존 기본 코드 불러오기 (하위 호환성 유지)
   */
  async loadExampleCode() {
    if (!this.state.currentExamName || !this.state.currentProblemNumber) {
      // 🔥 수정: 중복 방지 - 메시지 전송하지 않음
      console.error('기본 코드를 가져올 문제 정보가 없습니다');
      return;
    }
    
    // 새로운 API 기반 로드 호출
    await this.loadExampleCodeFromAPI(this.state.currentExamName, this.state.currentProblemNumber);
  }
  
  /**
   * 정답 코드 가져오기 및 표시
   */
  async showAnswer() {
    if (!this.state.currentExamName || !this.state.currentProblemNumber) {
      // 🔥 수정: 중복 방지 - 메시지 전송하지 않음
      console.error('정답을 가져올 문제 정보가 없습니다');
      return;
    }
    
    try {
      console.log('📄 정답 코드 요청:', this.state.currentExamName, this.state.currentProblemNumber);
      
      const response = await fetch(`/api/get-answer-code?examName=${this.state.currentExamName}&problemNumber=${this.state.currentProblemNumber}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const answerCode = await response.text();
      
      if (this.state.editor && this.state.currentMode === 'ace') {
        this.state.editor.setValue(answerCode, -1);
        
        // 🔥 수정: 정답 코드 로드 성공 메시지 다시 활성화
        if (window.EventBus) {
          window.EventBus.publish('terminal:output', {
            text: '정답 코드가 로드되었습니다.',
            type: 'normal'
          });
        }
        
        console.log('✅ 정답 코드 로드 완료');
      } else {
        console.warn('⚠️ ACE 에디터가 활성화되지 않아 정답 코드를 로드할 수 없습니다');
      }
      
    } catch (error) {
      // 🔥 수정: 정답 코드 로드 오류 메시지 다시 활성화
      if (window.EventBus) {
        window.EventBus.publish('terminal:output', {
          text: `정답 코드 로드 실패: ${error.message}`,
          type: 'error'
        });
      }
      
      console.error('❌ 정답 코드 로드 오류:', error);
    }
  }
  
  /**
   * 현재 코드 가져오기
   */
  getCurrentCode() {
    if (this.state.editor && this.state.currentMode === 'ace') {
      return this.state.editor.getValue();
    }
    return '';
  }
  
  /**
   * 코드 설정하기
   */
  setCode(code) {
    if (this.state.editor && this.state.currentMode === 'ace') {
      this.state.editor.setValue(code, -1);
      return true;
    }
    return false;
  }
  
  /**
   * 에디터 크기 조정 (거터 코드 제거)
   */
  resizeEditor() {
    if (this.state.editor && this.state.currentMode === 'ace') {
      setTimeout(() => {
        try {
          this.state.editor.resize();
          console.log('✅ ACE 에디터 크기 조정 완료');
        } catch (error) {
          console.error('❌ ACE 에디터 크기 조정 실패:', error);
        }
      }, 100);
    }
  }
  
  /**
   * 문제 변경 시 호출
   */
  onProblemChanged(examName, problemNumber) {
    this.state.currentExamName = examName;
    this.state.currentProblemNumber = problemNumber;
    console.log(`📄 CodeEditor - 문제 변경: ${examName}, 문제 ${problemNumber}`);
  }
  
  /**
   * 활성화
   */
  activate() {
    console.log('✅ CodeEditor 활성화');
    
    // 현재 모드에 따라 적절한 컨테이너 표시
    if (this.state.currentMode === 'ace') {
      const aceContainer = document.getElementById('ace-editor-inner');
      if (aceContainer) {
        aceContainer.style.display = 'flex';
        aceContainer.classList.add('active');
      }
    } else if (this.state.currentMode === 'jupyter') {
      const jupyterContainer = document.getElementById('jupyter-ide-container');
      if (jupyterContainer) {
        jupyterContainer.style.display = 'flex';
        jupyterContainer.classList.add('active');
      }
    }
    
    this.resizeEditor();
  }
  
  /**
   * 비활성화
   */
  deactivate() {
    console.log('✅ CodeEditor 비활성화');
    
    // 모든 컨테이너 숨기기
    const aceContainer = document.getElementById('ace-editor-inner');
    const jupyterContainer = document.getElementById('jupyter-ide-container');
    
    if (aceContainer) {
      aceContainer.style.display = 'none';
      aceContainer.classList.remove('active');
    }
    
    if (jupyterContainer) {
      jupyterContainer.style.display = 'none';
      jupyterContainer.classList.remove('active');
    }
  }
  
  /**
   * 정리
   */
  destroy() {
    console.log('🗑️ CodeEditor 정리 시작');
    
    // Python 자동완성 정리
    if (this.pythonAutoCompleter && this.pythonAutoCompleter.destroy) {
      this.pythonAutoCompleter.destroy();
      this.pythonAutoCompleter = null;
    }
    
    // 폰트 크기 조절 이벤트 리스너 제거
    if (this.boundFontIncrease) {
      const fontIncreaseBtn = document.getElementById('font-increase');
      if (fontIncreaseBtn) {
        fontIncreaseBtn.removeEventListener('click', this.boundFontIncrease);
      }
    }
    
    if (this.boundFontDecrease) {
      const fontDecreaseBtn = document.getElementById('font-decrease');
      if (fontDecreaseBtn) {
        fontDecreaseBtn.removeEventListener('click', this.boundFontDecrease);
      }
    }
    
    // EventBus 리스너 제거
    if (this.boundHandleProblemChanged && window.EventBus) {
      window.EventBus.unsubscribe('problemChanged', this.boundHandleProblemChanged);
    }
    
    // 기본 코드 복원 버튼 이벤트 리스너 제거
    if (this.boundRestoreExample && this.restoreButton) {
      this.restoreButton.removeEventListener('click', this.boundRestoreExample);
    }
    
    // 기본 코드 불러오기 버튼 이벤트 리스너 제거
    if (this.boundLoadExample) {
      const loadExampleButton = document.getElementById(this.options.loadExampleButtonId);
      if (loadExampleButton) {
        loadExampleButton.removeEventListener('click', this.boundLoadExample);
      }
    }
    
    // 이벤트 리스너 제거
    if (this.boundShowAnswer) {
      const showAnswerButton = document.getElementById(this.options.showAnswerButtonId);
      if (showAnswerButton) {
        showAnswerButton.removeEventListener('click', this.boundShowAnswer);
      }
    }
    
    if (this.boundToggleMode) {
      const aceButton = document.getElementById(this.options.aceButtonId);
      const jupyterButton = document.getElementById(this.options.jupyterButtonId);
      
      if (aceButton) aceButton.removeEventListener('click', this.boundToggleMode);
      if (jupyterButton) jupyterButton.removeEventListener('click', this.boundToggleMode);
    }
    
    if (this.boundResizeEditor) {
      window.removeEventListener('resize', this.boundResizeEditor);
    }
    
    // ACE 에디터 정리
    if (this.state.editor) {
      try {
        this.state.editor.destroy();
        this.state.editor = null;
      } catch (error) {
        console.error('❌ ACE 에디터 정리 오류:', error);
      }
    }
    
    // 예제 코드 상태 초기화
    this.exampleCodeState = {
      originalCode: null,
      hasExampleFile: false,
      currentProblem: null
    };
    
    // 상태 초기화
    this.state.isInitialized = false;
    
    console.log('✅ CodeEditor 정리 완료');
  }
}

// 전역 스코프에 노출
window.CodeEditor = CodeEditor;