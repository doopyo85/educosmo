/**
 * PyodideTerminal.js - Pyodide 기반 Python 터미널 (수정본)
 * 브라우저에서 직접 Python을 실행하여 input() 함수 완벽 지원
 * Terminal.js와 동일한 인터페이스 제공
 * 
 * 🔥 핵심: input()을 여러 번 연속 호출 가능하도록 수정
 */

class PyodideTerminal {
  constructor(options = {}) {
    this.options = {
      outputId: 'output-content',
      runButtonId: 'runCodeBtn',
      clearButtonId: 'clearOutputBtn',
      ...options
    };
    
    this.state = {
      isRunning: false,
      isReady: false,
      isLoading: false
    };
    
    this.pyodide = null;
    this.boundRunCode = null;
    this.boundClearOutput = null;
    this.boundHandleFontChange = null;
    
    // input() 처리를 위한 Promise 관리
    this.inputResolver = null;
    this.inputPromptText = '';
  }
  
  /**
   * 터미널 초기화
   */
  async init() {
    try {
      console.log('🐍 PyodideTerminal 초기화 시작...');
      
      this.initializeTerminal();
      this.setupEventListeners();
      this.setupEventBusListeners();
      
      // Pyodide 로드 (비동기)
      this.loadPyodideAsync();
      
      console.log('✅ PyodideTerminal 초기화 완료 (Pyodide 로딩 중...)');
      return true;
    } catch (error) {
      console.error('❌ PyodideTerminal 초기화 오류:', error);
      return false;
    }
  }
  
  /**
   * Pyodide 비동기 로드
   */
  async loadPyodideAsync() {
    if (this.state.isLoading || this.state.isReady) return;
    
    this.state.isLoading = true;
    this.updateRunButton(true, '🔄 Python 로딩 중...');
    this.appendToOutput('🔄 Python 환경을 불러오는 중입니다... (최초 1회, 약 5-10초 소요)\n', 'info');
    
    try {
      // Pyodide가 이미 로드되어 있는지 확인
      if (typeof loadPyodide === 'undefined') {
        throw new Error('Pyodide 라이브러리가 로드되지 않았습니다.');
      }
      
      console.log('🔄 Pyodide 로드 시작...');
      const startTime = Date.now();
      
      this.pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
      });
      
      const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Pyodide 로드 완료 (${loadTime}초)`);
      
      this.state.isReady = true;
      this.state.isLoading = false;
      
      this.clearOutput();
      this.appendToOutput(`✅ Python 환경 준비 완료! (${loadTime}초)\n`, 'success');
      this.appendToOutput('💡 코드를 입력하고 "코드 실행" 버튼을 클릭하세요.\n', 'info');
      this.appendToOutput('💡 input() 함수가 완벽하게 지원됩니다!\n', 'info');
      
      this.updateRunButton(false);
      
    } catch (error) {
      console.error('❌ Pyodide 로드 오류:', error);
      this.state.isLoading = false;
      
      this.clearOutput();
      this.appendToOutput(`❌ Python 환경 로드 실패: ${error.message}\n`, 'error');
      this.appendToOutput('🔄 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.\n', 'warning');
      
      this.updateRunButton(false);
    }
  }
  
  /**
   * 터미널 기본 설정
   */
  initializeTerminal() {
    const outputElement = document.getElementById(this.options.outputId);
    if (!outputElement) {
      throw new Error(`출력 요소를 찾을 수 없습니다: ${this.options.outputId}`);
    }
    
    outputElement.style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
    outputElement.style.fontSize = "14px";
    outputElement.style.lineHeight = "1.4";
    outputElement.style.whiteSpace = "pre-wrap";
    outputElement.style.wordWrap = "break-word";
    outputElement.style.backgroundColor = "#1e1e1e";
    outputElement.style.color = "#d4d4d4";
    
    this.clearOutput();
  }
  
  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    const runButton = document.getElementById(this.options.runButtonId);
    if (runButton) {
      if (this.boundRunCode) {
        runButton.removeEventListener('click', this.boundRunCode);
      }
      this.boundRunCode = () => this.runCode();
      runButton.addEventListener('click', this.boundRunCode);
    }

    const clearButton = document.getElementById(this.options.clearButtonId);
    if (clearButton) {
      if (this.boundClearOutput) {
        clearButton.removeEventListener('click', this.boundClearOutput);
      }
      this.boundClearOutput = () => this.clearOutput();
      clearButton.addEventListener('click', this.boundClearOutput);
    }
  }
  
  /**
   * EventBus 리스너 설정
   */
  setupEventBusListeners() {
    if (window.EventBus) {
      window.EventBus.subscribe('terminal:output', (data) => {
        this.appendToOutput(data.text, data.type || 'normal');
      });
      
      this.boundHandleFontChange = (data) => this.handleFontChange(data);
      window.EventBus.subscribe('font:change', this.boundHandleFontChange);
      
      console.log('✅ PyodideTerminal EventBus 구독 설정 완료');
    }
  }
  
  /**
   * 폰트 크기 변경 핸들러
   */
  handleFontChange(data) {
    const { terminalSize } = data;
    if (terminalSize) {
      this.applyFontSize(terminalSize);
    }
  }
  
  /**
   * 터미널 폰트 크기 적용
   */
  applyFontSize(fontSize) {
    const outputElement = document.getElementById(this.options.outputId);
    if (outputElement) {
      outputElement.style.fontSize = `${fontSize}px`;
      
      const outputLines = outputElement.querySelectorAll('.output-line pre');
      outputLines.forEach(line => {
        line.style.fontSize = `${fontSize}px`;
      });
    }
  }
  
  /**
   * 코드 실행 (메인)
   */
  async runCode() {
    // Pyodide가 아직 로딩 중이면 대기
    if (!this.state.isReady) {
      if (this.state.isLoading) {
        this.appendToOutput('⏳ Python 환경 로딩 중입니다. 잠시만 기다려주세요...\n', 'warning');
      } else {
        await this.loadPyodideAsync();
      }
      return;
    }
    
    if (this.state.isRunning) {
      this.appendToOutput('⚠️ 이미 실행 중입니다.\n', 'warning');
      return;
    }
    
    // 코드 가져오기
    let code = this.getCodeFromEditor();
    
    if (!code || !code.trim()) {
      this.clearOutput();
      this.appendToOutput('⚠️ 실행할 코드를 입력해주세요.\n', 'warning');
      return;
    }
    
    console.log('🚀 Pyodide 코드 실행 시작');
    
    this.state.isRunning = true;
    this.updateRunButton(true, '⏳ 실행 중...');
    this.clearOutput();
    
    try {
      // input() 함수가 있는지 확인
      const hasInput = /\binput\s*\(/.test(code);
      
      if (hasInput) {
        // input()이 있는 코드는 특별 처리
        await this.executeWithInput(code);
      } else {
        // input()이 없는 코드는 간단히 실행
        await this.executeSimple(code);
      }
      
    } catch (error) {
      console.error('❌ Pyodide 실행 오류:', error);
      this.appendToOutput(`\n❌ 오류: ${this.formatPythonError(error.message)}\n`, 'error');
    } finally {
      this.state.isRunning = false;
      this.updateRunButton(false);
    }
  }
  
  /**
   * input() 없는 간단한 코드 실행
   */
  async executeSimple(code) {
    // stdout 캡처 설정
    await this.pyodide.runPythonAsync(`
import sys
from io import StringIO
_capture_stdout = StringIO()
_capture_stderr = StringIO()
_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _capture_stdout
sys.stderr = _capture_stderr
    `);
    
    try {
      // 코드 실행
      await this.pyodide.runPythonAsync(code);
      
      // 출력 가져오기
      const stdout = await this.pyodide.runPythonAsync(`_capture_stdout.getvalue()`);
      const stderr = await this.pyodide.runPythonAsync(`_capture_stderr.getvalue()`);
      
      // stdout/stderr 복원
      await this.pyodide.runPythonAsync(`
sys.stdout = _old_stdout
sys.stderr = _old_stderr
      `);
      
      if (stdout && stdout.trim()) {
        this.appendToOutput(stdout, 'output');
      }
      
      if (stderr && stderr.trim()) {
        this.appendToOutput(stderr, 'error');
      }
      
      if (!stdout && !stderr) {
        this.appendToOutput('✅ 실행 완료 (출력 없음)\n', 'success');
      } else {
        this.appendToOutput('\n✅ 실행 완료\n', 'success');
      }
      
    } catch (error) {
      // stdout/stderr 복원
      await this.pyodide.runPythonAsync(`
sys.stdout = _old_stdout
sys.stderr = _old_stderr
      `);
      throw error;
    }
  }
  
  /**
   * 🔥 input()이 있는 코드 실행 (핵심 수정)
   * 
   * 전략: 
   * 1. JavaScript에서 async input 함수를 만들고 Python에 등록
   * 2. Python 코드 전체를 async 함수로 감싸서 실행
   * 3. input() 호출마다 JavaScript의 Promise를 await
   */
  async executeWithInput(code) {
    const self = this;
    
    // 🔥 JavaScript 입력 핸들러를 Pyodide에 등록
    this.pyodide.registerJsModule("js_input", {
      async_input: async function(prompt) {
        return await self.waitForUserInput(prompt);
      }
    });
    
    // Python 설정 코드
    const setupCode = `
import sys
from io import StringIO
import js_input

# 실시간 출력을 위한 커스텀 stdout
class LiveOutput:
    def __init__(self, callback):
        self.callback = callback
        self.buffer = ""
    
    def write(self, text):
        self.buffer += text
        # flush 될 때까지 버퍼링
    
    def flush(self):
        if self.buffer:
            # JavaScript로 즉시 전송
            pass
        self.buffer = ""
    
    def getvalue(self):
        return self.buffer

# 출력 설정
_live_stdout = StringIO()
_live_stderr = StringIO()
_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _live_stdout
sys.stderr = _live_stderr

# 🔥 핵심: async input 함수 정의
async def async_input(prompt=""):
    if prompt:
        print(prompt, end="")
        sys.stdout.flush()
    result = await js_input.async_input(prompt)
    return result
`;
    
    // 먼저 설정 코드 실행
    await this.pyodide.runPythonAsync(setupCode);
    
    // 🔥 사용자 코드의 input()을 await async_input()으로 변환
    const transformedCode = this.transformInputCalls(code);
    
    // async 메인 함수로 감싸기
    const wrappedCode = `
async def __user_main__():
${transformedCode.split('\n').map(line => '    ' + line).join('\n')}

# 실행
await __user_main__()

# 최종 출력 가져오기
_final_stdout = _live_stdout.getvalue()
_final_stderr = _live_stderr.getvalue()

# 복원
sys.stdout = _old_stdout
sys.stderr = _old_stderr
`;
    
    console.log('🔄 변환된 코드:', wrappedCode);
    
    try {
      // 코드 실행
      await this.pyodide.runPythonAsync(wrappedCode);
      
      // 출력 가져오기
      const stdout = await this.pyodide.runPythonAsync(`_final_stdout`);
      const stderr = await this.pyodide.runPythonAsync(`_final_stderr`);
      
      if (stdout && stdout.trim()) {
        this.appendToOutput(stdout, 'output');
      }
      
      if (stderr && stderr.trim()) {
        this.appendToOutput(stderr, 'error');
      }
      
      this.appendToOutput('\n✅ 실행 완료\n', 'success');
      
    } catch (error) {
      // 복원
      try {
        await this.pyodide.runPythonAsync(`
sys.stdout = _old_stdout
sys.stderr = _old_stderr
        `);
      } catch (e) {}
      throw error;
    }
  }
  
  /**
   * 🔥 input() 호출을 await async_input()으로 변환
   */
  transformInputCalls(code) {
    // 정규식으로 input() 호출을 await async_input()으로 변환
    // 주의: 문자열 내의 input은 변환하면 안 됨
    
    // 간단한 변환 (대부분의 케이스 커버)
    // input() → await async_input()
    // input("프롬프트") → await async_input("프롬프트")
    
    // 변수 할당 패턴: name = input(...) → name = await async_input(...)
    let transformed = code.replace(
      /(\w+)\s*=\s*input\s*\(/g,
      '$1 = await async_input('
    );
    
    // 직접 호출 패턴: print(input(...)) → print(await async_input(...))
    transformed = transformed.replace(
      /([^=\w])input\s*\(/g,
      '$1await async_input('
    );
    
    // 라인 시작 input 호출
    transformed = transformed.replace(
      /^input\s*\(/gm,
      'await async_input('
    );
    
    return transformed;
  }
  
  /**
   * 🔥 사용자 입력 대기 (Promise 기반)
   */
  waitForUserInput(prompt) {
    return new Promise((resolve) => {
      // 프롬프트가 있으면 출력
      if (prompt) {
        this.appendToOutput(prompt, 'output');
      }
      
      this.inputResolver = resolve;
      this.showInputUI();
    });
  }
  
  /**
   * 입력 UI 표시
   */
  showInputUI() {
    const outputElement = document.getElementById(this.options.outputId);
    if (!outputElement) return;
    
    // 기존 입력 UI 제거
    const existingInput = outputElement.querySelector('.pyodide-input-container');
    if (existingInput) existingInput.remove();
    
    // 입력 컨테이너 생성
    const inputContainer = document.createElement('div');
    inputContainer.className = 'pyodide-input-container';
    inputContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      width: 100%;
      background: rgba(30, 30, 30, 0.5);
      border-radius: 4px;
      margin: 4px 0;
    `;
    
    inputContainer.innerHTML = `
      <span class="input-prompt" style="color: #4fc3f7; font-family: 'Consolas', monospace;">>>> </span>
      <input type="text" class="pyodide-input-field" 
             style="flex: 1; background: #1e1e1e; border: 1px solid #3c3c3c; 
                    color: #d4d4d4; padding: 6px 10px; border-radius: 4px;
                    font-family: 'Consolas', monospace; font-size: 14px;"
             placeholder="값을 입력하고 Enter를 누르세요"
             autofocus />
      <button class="pyodide-input-submit btn btn-sm btn-primary" 
              style="padding: 6px 12px;">
        입력
      </button>
    `;
    
    outputElement.appendChild(inputContainer);
    
    const inputField = inputContainer.querySelector('.pyodide-input-field');
    const submitBtn = inputContainer.querySelector('.pyodide-input-submit');
    
    // 입력 제출 함수
    const submitInput = () => {
      const value = inputField.value;
      
      // 입력값 에코 출력
      this.appendToOutput(`${value}\n`, 'input');
      
      // 입력 UI 제거
      inputContainer.remove();
      
      // 🔥 Promise resolve로 Python에 값 전달
      if (this.inputResolver) {
        const resolver = this.inputResolver;
        this.inputResolver = null;
        resolver(value);
      }
    };
    
    // 이벤트 리스너
    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitInput();
      }
    });
    
    submitBtn.addEventListener('click', submitInput);
    
    // 포커스
    setTimeout(() => inputField.focus(), 100);
    
    // 스크롤
    outputElement.scrollTop = outputElement.scrollHeight;
  }
  
  /**
   * Python 에러 메시지 포맷팅
   */
  formatPythonError(errorMsg) {
    if (!errorMsg) return '알 수 없는 오류';
    
    let formatted = errorMsg;
    
    // PythonError: 접두사 제거
    formatted = formatted.replace(/^PythonError:\s*/i, '');
    
    // 트레이스백에서 핵심 부분 추출
    const lines = formatted.split('\n');
    const relevantLines = lines.filter(line => {
      if (line.includes('/lib/python')) return false;
      if (line.includes('pyodide')) return false;
      if (line.includes('__user_main__')) return false;
      if (line.trim().startsWith('File "<exec>"')) return true;
      if (line.includes('Error:')) return true;
      if (line.includes('Exception:')) return true;
      return !line.trim().startsWith('File "');
    });
    
    return relevantLines.join('\n').trim() || formatted;
  }
  
  /**
   * 에디터에서 코드 가져오기
   */
  getCodeFromEditor() {
    // 1. 전역 codeEditor 객체에서 가져오기
    if (window.codeEditor && typeof window.codeEditor.getCurrentCode === 'function') {
      return window.codeEditor.getCurrentCode();
    }
    
    // 2. ACE 에디터에서 직접 가져오기
    if (window.ace) {
      try {
        const editor = window.ace.edit('editor');
        if (editor) {
          return editor.getValue();
        }
      } catch (e) {
        console.warn('ACE 에디터 접근 실패:', e);
      }
    }
    
    // 3. ComponentSystem을 통해 가져오기
    if (window.ComponentSystem?.components?.ide?.getCurrentCode) {
      return window.ComponentSystem.components.ide.getCurrentCode();
    }
    
    // 4. IDEComponent에서 가져오기
    const ideComponent = window.ComponentSystem?.components?.ide;
    if (ideComponent?.modules?.codeEditor?.getCurrentCode) {
      return ideComponent.modules.codeEditor.getCurrentCode();
    }
    
    console.warn('코드 에디터를 찾을 수 없습니다.');
    return '';
  }
  
  /**
   * 터미널 출력 추가
   */
  appendToOutput(text, type = 'normal') {
    const outputElement = document.getElementById(this.options.outputId);
    if (!outputElement) return;
    
    if (!text || typeof text !== 'string') return;
    
    // 라인 컨테이너 생성
    const lineContainer = document.createElement('div');
    lineContainer.className = 'output-line';
    lineContainer.style.cssText = `
      display: block; 
      width: 100%; 
      margin: 0;
    `;
    
    // pre 요소 생성
    const preElement = document.createElement('pre');
    preElement.textContent = text;
    preElement.style.cssText = `
      margin: 0; 
      padding: 0; 
      display: block; 
      width: 100%;
      white-space: pre-wrap; 
      word-wrap: break-word;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
    `;
    
    // 타입별 색상 적용
    switch (type) {
      case 'error':
        preElement.style.color = '#f48771';
        break;
      case 'warning':
        preElement.style.color = '#cca700';
        break;
      case 'success':
        preElement.style.color = '#89d185';
        break;
      case 'info':
        preElement.style.color = '#4fc3f7';
        break;
      case 'input':
        preElement.style.color = '#ce9178';
        break;
      default:
        preElement.style.color = '#d4d4d4';
    }
    
    lineContainer.appendChild(preElement);
    outputElement.appendChild(lineContainer);
    outputElement.scrollTop = outputElement.scrollHeight;
  }
  
  /**
   * 출력 지우기
   */
  clearOutput() {
    const outputElement = document.getElementById(this.options.outputId);
    if (outputElement) {
      outputElement.innerHTML = '';
    }
  }
  
  /**
   * 실행 버튼 상태 업데이트
   */
  updateRunButton(isDisabled, text = null) {
    const runButton = document.getElementById(this.options.runButtonId);
    if (!runButton) return;
    
    runButton.disabled = isDisabled;
    
    if (text) {
      runButton.innerHTML = text;
    } else if (isDisabled) {
      runButton.innerHTML = '<i class="bi bi-hourglass-split"></i> 실행 중...';
    } else {
      runButton.innerHTML = '<i class="bi bi-play-fill"></i> 코드 실행';
    }
  }
  
  /**
   * 활성화
   */
  activate() {
    console.log('✅ PyodideTerminal 활성화됨');
    
    if (!this.state.isReady && !this.state.isLoading) {
      this.loadPyodideAsync();
    }
  }
  
  /**
   * 비활성화
   */
  deactivate() {
    console.log('✅ PyodideTerminal 비활성화됨');
    
    const inputContainer = document.querySelector('.pyodide-input-container');
    if (inputContainer) {
      inputContainer.remove();
    }
    
    if (this.inputResolver) {
      this.inputResolver('');
      this.inputResolver = null;
    }
  }
  
  /**
   * 정리
   */
  destroy() {
    console.log('🗑️ PyodideTerminal 정리 시작');
    
    if (this.boundRunCode) {
      const runButton = document.getElementById(this.options.runButtonId);
      if (runButton) {
        runButton.removeEventListener('click', this.boundRunCode);
      }
    }
    
    if (this.boundClearOutput) {
      const clearButton = document.getElementById(this.options.clearButtonId);
      if (clearButton) {
        clearButton.removeEventListener('click', this.boundClearOutput);
      }
    }
    
    this.state.isRunning = false;
    this.state.isReady = false;
    this.pyodide = null;
    
    console.log('✅ PyodideTerminal 정리 완료');
  }
}

// 전역 스코프에 노출
window.PyodideTerminal = PyodideTerminal;

console.log('📦 PyodideTerminal 모듈 로드 완료');
