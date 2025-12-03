/**
 * IDEComponent.js - 메인 IDE 컴포넌트 (리팩토링 버전)
 * CodeEditor와 Terminal 모듈을 통합 관리
 */

class IDEComponent extends Component {
  constructor(options = {}) {
    super(options);
    
    // 기본 옵션 설정
    this.options = {
      elementId: 'ide-component',
      ...options
    };
    
    // 상태 관리
    this.state = {
      currentExamName: '',
      currentProblemNumber: 1,
      isInitialized: false
    };
    
    // 하위 모듈들
    this.modules = {
      codeEditor: null,
      terminal: null
    };
  }
  
  /**
   * IDE 컴포넌트 초기화
   */
  async init() {
    console.log('IDEComponent 초기화 시작');
    
    try {
      await super.init();
      
      if (!this.element) {
        throw new Error(`IDE 컴포넌트 요소를 찾을 수 없습니다: ${this.options.elementId}`);
      }
      
      // 하위 모듈 초기화
      await this.initializeModules();
      
      // EventBus 설정
      this.setupEventBusListeners();
      
      // 🔥 추가: 다운로드 버튼 이벤트 설정
      this.setupDownloadButton();
      
      this.state.isInitialized = true;
      console.log('IDEComponent 초기화 완료');
      return true;
      
    } catch (error) {
      console.error('IDEComponent 초기화 오류:', error);
      return false;
    }
  }
  
  /**
   * 하위 모듈 초기화
   */
  async initializeModules() {
    try {
      // CodeEditor 모듈 초기화
      if (window.CodeEditor) {
        this.modules.codeEditor = new window.CodeEditor({
          editorId: 'editor',
          showAnswerButtonId: 'showAnswerBtn',
          aceButtonId: 'ace-btn',
          jupyterButtonId: 'jupyter-btn',
          loadExampleButtonId: 'loadExampleBtn' // 🔥 추가: 기본 코드 불러오기 버튼
        });
        
        const codeEditorInit = await this.modules.codeEditor.init();
        if (!codeEditorInit) {
          throw new Error('CodeEditor 모듈 초기화 실패');
        }
        
        // 전역 참조 설정 (임시로 EventBus 대신 사용)
        window.codeEditor = this.modules.codeEditor;
        
        console.log('✅ CodeEditor 모듈 초기화 완료');
      } else {
        console.error('❌ CodeEditor 클래스를 찾을 수 없습니다');
      }
      
      // Terminal 모듈 초기화 (TerminalInput 포함)
      if (window.Terminal) {
        this.modules.terminal = new window.Terminal({
          outputId: 'output-content',
          runButtonId: 'runCodeBtn',
          clearButtonId: 'clearOutputBtn'
        });
        
        const terminalInit = await this.modules.terminal.init();
        if (!terminalInit) {
          throw new Error('Terminal 모듈 초기화 실패');
        }
        
        console.log('✅ Terminal 모듈 초기화 완료');
      } else {
        console.error('❌ Terminal 클래스를 찾을 수 없습니다');
      }
      
    } catch (error) {
      console.error('모듈 초기화 오류:', error);
      throw error;
    }
  }
  
  /**
   * EventBus 리스너 설정
   */
  setupEventBusListeners() {
    if (window.EventBus) {
      // 에디터 크기 조정 요청 처리
      window.EventBus.subscribe('editor:resize', () => {
        if (this.modules.codeEditor && typeof this.modules.codeEditor.resizeEditor === 'function') {
          this.modules.codeEditor.resizeEditor();
        }
      });
      
      // 코드 가져오기 요청 처리
      window.EventBus.subscribe('editor:getCode', () => {
        if (this.modules.codeEditor && typeof this.modules.codeEditor.getCurrentCode === 'function') {
          const code = this.modules.codeEditor.getCurrentCode();
          window.EventBus.publish('editor:codeResponse', { code: code });
        }
      });
      
      console.log('✅ EventBus 리스너 설정 완료');
    }
  }
  
  /**
   * 컴포넌트 활성화
   */
  activate() {
    super.activate();
    
    // 요소 표시
    this.element.classList.add('component-visible');
    this.element.classList.remove('component-hidden');
    
    // 하위 모듈 활성화
    if (this.modules.codeEditor && typeof this.modules.codeEditor.activate === 'function') {
      this.modules.codeEditor.activate();
    }
    
    if (this.modules.terminal && typeof this.modules.terminal.activate === 'function') {
      this.modules.terminal.activate();
    }
    
    console.log('IDEComponent 활성화 완료');
  }
  
  /**
   * 컴포넌트 비활성화
   */
  deactivate() {
    super.deactivate();
    
    // 요소 숨기기
    this.element.classList.add('component-hidden');
    this.element.classList.remove('component-visible');
    
    // 하위 모듈 비활성화
    if (this.modules.codeEditor && typeof this.modules.codeEditor.deactivate === 'function') {
      this.modules.codeEditor.deactivate();
    }
    
    if (this.modules.terminal && typeof this.modules.terminal.deactivate === 'function') {
      this.modules.terminal.deactivate();
    }
    
    console.log('IDEComponent 비활성화 완료');
  }
  
  /**
   * 문제 변경 시 호출
   */
  onProblemChanged(examName, problemNumber) {
    this.state.currentExamName = examName;
    this.state.currentProblemNumber = problemNumber;
    this.clearOutput();
    
    // 하위 모듈에 전달
    if (this.modules.codeEditor && typeof this.modules.codeEditor.onProblemChanged === 'function') {
      this.modules.codeEditor.onProblemChanged(examName, problemNumber);
    }
    
    // 🔥 추가: 해설 버튼 상태 업데이트
    this.updateExplanationButton();
    
    console.log(`IDEComponent - 문제 변경: ${examName}, 문제 ${problemNumber}`);
  }
  
  /**
   * 현재 코드 가져오기
   */
  getCurrentCode() {
    if (this.modules.codeEditor && typeof this.modules.codeEditor.getCurrentCode === 'function') {
      return this.modules.codeEditor.getCurrentCode();
    }
    return '';
  }
  
  /**
   * 코드 설정하기
   */
  setCode(code) {
    if (this.modules.codeEditor && typeof this.modules.codeEditor.setCode === 'function') {
      return this.modules.codeEditor.setCode(code);
    }
    return false;
  }
  
  /**
   * 터미널 출력
   */
  appendToOutput(text, type = 'normal') {
    if (this.modules.terminal && typeof this.modules.terminal.appendToOutput === 'function') {
      this.modules.terminal.appendToOutput(text, type);
    }
  }
  
  /**
   * 터미널 지우기
   */
  clearOutput() {
    if (this.modules.terminal && typeof this.modules.terminal.clearOutput === 'function') {
      this.modules.terminal.clearOutput();
    }
  }
  
  /**
   * 코드 실행
   */
  runCode() {
    if (this.modules.terminal && typeof this.modules.terminal.runCode === 'function') {
      this.modules.terminal.runCode();
    }
  }
  
  /**
   * 🔥 추가: 기본 코드 불러오기
   */
  loadExampleCode() {
    if (this.modules.codeEditor && typeof this.modules.codeEditor.loadExampleCode === 'function') {
      return this.modules.codeEditor.loadExampleCode();
    }
    return false;
  }
  
  /**
   * 정답 코드 표시
   */
  showAnswer() {
    if (this.modules.codeEditor && typeof this.modules.codeEditor.showAnswer === 'function') {
      this.modules.codeEditor.showAnswer();
    }
  }
  
  /**
   * 에디터 크기 조정
   */
  resizeEditor() {
    if (this.modules.codeEditor && typeof this.modules.codeEditor.resizeEditor === 'function') {
      this.modules.codeEditor.resizeEditor();
    }
  }
  
  /**
   * 🔥 추가: 해설 버튼 상태 업데이트
   */
  updateExplanationButton() {
    const explanationBtn = document.getElementById('ide-explanation-btn');
    if (explanationBtn) {
      // 현재 문제가 있을 때만 해설 버튼 표시
      if (this.state.currentExamName && this.state.currentProblemNumber) {
        explanationBtn.style.display = 'inline-block';
        explanationBtn.onclick = () => {
          window.EventBus.publish('explanation-request', {
            examName: this.state.currentExamName,
            problemNumber: this.state.currentProblemNumber
          });
        };
      } else {
        explanationBtn.style.display = 'none';
      }
    }
  }
  
  /**
   * 🔥 추가: 다운로드 버튼 이벤트 설정
   */
  setupDownloadButton() {
    const downloadBtn = document.getElementById('download-code-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.downloadCurrentCode();
      });
      console.log('IDEComponent: 다운로드 버튼 이벤트 설정 완료');
    } else {
      console.warn('IDEComponent: 다운로드 버튼을 찾을 수 없습니다.');
    }
  }
  
  /**
   * 🔥 추가: 현재 코드 다운로드 기능
   */
  downloadCurrentCode() {
    console.log('IDEComponent: 코드 다운로드 시작');
    
    // 현재 코드 가져오기
    const currentCode = this.getCurrentCode();
    
    if (!currentCode || currentCode.trim() === '') {
      alert('다운로드할 코드가 없습니다.');
      return;
    }
    
    // 파일명 생성
    const fileName = this.generateFileName();
    
    // 다운로드 실행
    this.downloadFile(currentCode, fileName);
    
    console.log(`IDEComponent: 코드 다운로드 완료 - 파일명: ${fileName}`);
  }
  
  /**
   * 🔥 추가: 다운로드 파일명 생성
   */
  generateFileName() {
    // 날짜 시간 형식으로 기본 파일명 생성
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    let fileName = `my_python_code_${year}${month}${day}_${hours}${minutes}${seconds}.py`;
    
    // 현재 문제 정보가 있으면 파일명에 포함
    if (this.state.currentExamName && this.state.currentProblemNumber) {
      const examName = this.state.currentExamName.replace(/[^a-zA-Z0-9]/g, '_');
      const problemNum = String(this.state.currentProblemNumber).padStart(2, '0');
      fileName = `${examName}_p${problemNum}_${year}${month}${day}_${hours}${minutes}${seconds}.py`;
    }
    
    return fileName;
  }
  
  /**
   * 🔥 추가: 파일 다운로드 실행
   */
  downloadFile(content, fileName) {
    try {
      // Blob 생성 (UTF-8 인코딩)
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      
      // URL 생성
      const url = URL.createObjectURL(blob);
      
      // 임시 a 태그 생성
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      
      // DOM에 추가 후 클릭
      document.body.appendChild(a);
      a.click();
      
      // 정리
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`IDEComponent: 파일 다운로드 성공 - ${fileName}`);
      
    } catch (error) {
      console.error('IDEComponent: 파일 다운로드 오류:', error);
      alert('파일 다운로드 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 정리
   */
  destroy() {
    console.log('IDEComponent 정리 시작');
    
    // 하위 모듈 정리
    if (this.modules.codeEditor && typeof this.modules.codeEditor.destroy === 'function') {
      this.modules.codeEditor.destroy();
      this.modules.codeEditor = null;
    }
    
    if (this.modules.terminal && typeof this.modules.terminal.destroy === 'function') {
      this.modules.terminal.destroy();
      this.modules.terminal = null;
    }
    
    // 전역 참조 제거
    if (window.codeEditor) {
      window.codeEditor = null;
    }
    
    // 상태 초기화
    this.state.isInitialized = false;
    
    console.log('IDEComponent 정리 완료');
  }
}

// 전역 스코프에 노출
window.IDEComponent = IDEComponent;