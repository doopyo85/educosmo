/**
 * Terminal.js - 터미널 코어 (폰트 크기 변경 기능 추가)
 * Python 실행, 터미널 출력, 모듈 통합, 폰트 크기 동기화
 */

class Terminal {
  constructor(options = {}) {
    this.options = {
      outputId: 'output-content',
      runButtonId: 'runCodeBtn',
      clearButtonId: 'clearOutputBtn',
      ...options
    };

    this.state = {
      isRunning: false,
      isInteractiveMode: false,
      sessionId: null
    };

    this.modules = {
      input: null,
      resize: null
    };

    this.boundRunCode = null;
    this.boundClearOutput = null;
    this.boundHandleFontChange = null;
  }

  /**
   * 터미널 초기화
   */
  async init() {
    try {
      this.initializeTerminal();
      this.setupEventListeners();
      this.setupEventBusListeners();
      await this.initializeModules();

      console.log('✅ Terminal 초기화 완료');
      return true;
    } catch (error) {
      console.error('❌ Terminal 초기화 오류:', error);
      return false;
    }
  }

  /**
   * 하위 모듈 초기화
   */
  async initializeModules() {
    // TerminalInput 모듈
    if (window.TerminalInput) {
      this.modules.input = new window.TerminalInput({
        outputId: this.options.outputId
      });
      console.log('✅ TerminalInput 모듈 초기화 완료');
    }

    // TerminalResize 모듈
    if (window.TerminalResize) {
      this.modules.resize = new window.TerminalResize();
      this.modules.resize.init();
      console.log('✅ TerminalResize 모듈 초기화 완료');
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

    this.clearOutput();
    this.appendToOutput("Python 터미널 준비됨. 코드를 실행하세요.\n", "normal");
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    const runButton = document.getElementById(this.options.runButtonId);
    if (runButton) {
      runButton.removeEventListener('click', this.boundRunCode);
      this.boundRunCode = () => this.runCode();
      runButton.addEventListener('click', this.boundRunCode);
    }

    // Clear button functionality removed
  }

  /**
   * EventBus 리스너 설정
   */
  setupEventBusListeners() {
    if (window.EventBus) {
      // 터미널 출력 이벤트 구독
      window.EventBus.subscribe('terminal:output', (data) => {
        this.appendToOutput(data.text, data.type || 'normal');
      });

      // Python 실행 재개 이벤트 구독
      window.EventBus.subscribe('terminal:resumeExecution', (data) => {
        this.resumePythonExecution(data.input, data.context);
      });

      // 실행 취소 이벤트 구독
      window.EventBus.subscribe('terminal:cancelExecution', () => {
        this.finishExecution();
      });

      // 🔥 폰트 크기 변경 이벤트 구독
      this.boundHandleFontChange = (data) => this.handleFontChange(data);
      window.EventBus.subscribe('font:change', this.boundHandleFontChange);

      console.log('✅ EventBus 구독 설정 완료');
    }
  }

  /**
   * 🔥 폰트 크기 변경 핸들러
   */
  handleFontChange(data) {
    const { terminalSize } = data;

    if (terminalSize) {
      this.applyFontSize(terminalSize);
      console.log(`🖥️ 터미널 폰트 크기 변경: ${terminalSize}px`);
    }
  }

  /**
   * 🔥 터미널 폰트 크기 적용
   */
  applyFontSize(fontSize) {
    const terminalFontSize = `${fontSize}px`;

    // CSS 변수 업데이트
    document.documentElement.style.setProperty('--terminal-font-size', terminalFontSize);

    // 메인 출력 요소에 폰트 크기 적용
    const outputElement = document.getElementById(this.options.outputId);
    if (outputElement) {
      outputElement.style.fontSize = terminalFontSize;

      // 기존 출력 라인들에 폰트 크기 적용
      const outputLines = outputElement.querySelectorAll('.output-line');
      outputLines.forEach(line => {
        line.style.fontSize = terminalFontSize;

        // pre 요소에도 폰트 크기 적용
        const preElements = line.querySelectorAll('pre');
        preElements.forEach(pre => {
          pre.style.fontSize = terminalFontSize;
        });
      });

      // 입력 요소들에 폰트 크기 적용
      const terminalInputs = outputElement.querySelectorAll('.terminal-input, .terminal-input-field');
      terminalInputs.forEach(input => {
        input.style.fontSize = terminalFontSize;
      });

      // 프롬프트 라인들에 폰트 크기 적용
      const promptLines = outputElement.querySelectorAll('.prompt-line, .input-prompt');
      promptLines.forEach(prompt => {
        prompt.style.fontSize = terminalFontSize;
      });
    }

    console.log(`✅ 터미널 폰트 크기 적용 완료: ${terminalFontSize}`);
  }

  /**
   * 코드 실행 (EventBus 통신 개선)
   */
  async runCode() {
    // 🔥 실행 중이면 중지 기능 수행
    if (this.state.isRunning) {
      await this.stopCode();
      return;
    }

    console.log('🚀 코드 실행 시작');

    let code = '';

    // CodeEditor에서 코드 가져오기
    if (window.codeEditor && typeof window.codeEditor.getCurrentCode === 'function') {
      code = window.codeEditor.getCurrentCode();
    }

    console.log('📄 실행할 코드:', code ? code.length + '자' : '없음');

    if (!code || !code.trim()) {
      this.clearOutput();
      this.appendToOutput('실행할 코드를 입력해주세요.\n', 'warning');
      return;
    }

    try {
      this.state.isRunning = true;
      this.updateRunButton(true);
      this.clearOutput();

      const hasInput = this.modules.input ? this.modules.input.hasInputFunction(code) : false;

      if (hasInput) {
        this.state.isInteractiveMode = true;
        this.state.sessionId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        await this.runInteractiveCode(code);
      } else {
        this.state.isInteractiveMode = false;
        await this.runNormalCode(code);
      }

    } catch (error) {
      console.error('❌ 코드 실행 오류:', error);
      this.clearOutput();
      this.appendToOutput(`실행 오류: ${error.message}\n`, 'error');
      this.finishExecution();
    }
  }

  /**
   * 🔥 코드 실행 중지
   */
  async stopCode() {
    if (!this.state.sessionId) {
      this.finishExecution();
      return;
    }

    console.log('🛑 코드 실행 중지 요청');
    this.appendToOutput('실행을 중지하는 중...\n', 'warning');

    try {
      await fetch('/python/api/stop-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.state.sessionId })
      });
      this.appendToOutput('사용자에 의해 실행이 중지되었습니다.\n', 'error');
    } catch (error) {
      console.error('중지 요청 실패:', error);
      this.appendToOutput('중지 요청 실패\n', 'error');
    } finally {
      this.finishExecution();
    }
  }

  /**
   * 대화형 코드 실행
   */
  async runInteractiveCode(code) {
    try {
      const response = await fetch('/python/api/run-python-interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, sessionId: this.state.sessionId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.needsInput) {
        if (this.modules.input) {
          this.modules.input.setExecutionContext(result.sessionId);

          // 🔥 클라이언트 사이드 프롬프트 중복 제거 (안전장치)
          if (result.output && result.prompt) {
            let cleanOut = result.output;
            const p = result.prompt.trim();
            // 정규식이나 endsWith로 한 번 더 체크
            if (cleanOut.trim().endsWith(p)) {
              cleanOut = cleanOut.substring(0, cleanOut.lastIndexOf(result.prompt));
            }
            if (cleanOut.trim()) {
              this.appendToOutput(cleanOut + '\n', 'output');
            }
          } else if (result.output) {
            this.appendToOutput(result.output + '\n', 'output');
          }

          this.modules.input.waitForInput(result.prompt || '');
        }
      } else if (result.success) {
        if (result.output) {
          this.appendToOutput(result.output + '\n', 'output');
        }
        if (result.error) {
          this.appendToOutput(result.error + '\n', 'error');
        }
        this.finishExecution();
      } else {
        this.appendToOutput(`오류: ${result.error}\n`, 'error');
        this.finishExecution();
      }

    } catch (error) {
      console.error('❌ 대화형 코드 실행 오류:', error);
      this.appendToOutput(`네트워크 오류: ${error.message}\n`, 'error');
      this.finishExecution();
    }
  }

  /**
   * 일반 코드 실행
   */
  async runNormalCode(code) {
    try {
      const response = await fetch('/api/run-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!this.state.isRunning) return;

      const isSuccess = result && (result.success === true || (result.output && !result.error && result.success !== false));

      if (isSuccess) {
        const outputText = result.output || '(출력 없음)';
        this.appendToOutput(outputText + '\n', 'output');

        if (result.warning) {
          this.appendToOutput(`\n경고: ${result.warning}\n`, 'warning');
        }
      } else {
        let errorMsg = '알 수 없는 오류가 발생했습니다';

        if (result.error && typeof result.error === 'string') {
          errorMsg = result.error;
        } else if (result.output && typeof result.output === 'string') {
          errorMsg = result.output;
        }

        this.appendToOutput(`오류: ${errorMsg}\n`, 'error');
      }

    } catch (error) {
      console.error('❌ 일반 코드 실행 오류:', error);
      if (this.state.isRunning) {
        this.appendToOutput(`네트워크 오류: ${error.message}\n`, 'error');
      }
    } finally {
      this.finishExecution();
    }
  }

  /**
   * Python 실행 재개
   */
  async resumePythonExecution(inputValue, executionContext) {
    if (!executionContext || !inputValue) {
      this.finishExecution();
      return;
    }

    try {
      const response = await fetch('/python/api/resume-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputValue, sessionId: executionContext })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('🔍 Resume Python 응답:', {
        success: result.success,
        output: JSON.stringify(result.output),
        outputLength: result.output ? result.output.length : 0,
        needsInput: result.needsInput
      });

      if (result.needsInput) {
        let cleanOutput = result.output;

        // 🔥 클라이언트 사이드 프롬프트 중복 제거 (resume 시)
        if (cleanOutput && result.prompt && !cleanOutput.includes('__PROMPT__')) {
          const p = result.prompt.trim();
          if (cleanOutput.trim().endsWith(p)) {
            cleanOutput = cleanOutput.substring(0, cleanOutput.lastIndexOf(result.prompt));
          }
        }

        if (cleanOutput && !cleanOutput.includes('__PROMPT__')) {
          // 빈 줄만 남았다면 출력하지 않음
          if (cleanOutput.trim()) {
            this.appendToOutput(cleanOutput, 'output');
          }
        }

        if (this.modules.input) {
          this.modules.input.waitForInput(result.prompt || '');
        }
      } else {
        if (result.output) {
          console.log('🔍 Input resume 원본 텍스트:', JSON.stringify(result.output));

          let cleanOutput = result.output
            .replace(/__PROMPT__:.*?\n/g, '')
            .replace(/__WAITING_FOR_INPUT__.*?\n/g, '')
            .replace(/숫자 두 개를 입력하세요.*?\n/g, '')
            .replace(/숫자 두 개를 입력하세요/g, '')
            .replace(/.*?입력하세요:\s*$/gm, '') // 줄 끝에 콜론이 있는 경우
            .replace(/^.*?입력하세요:\s*\n/gm, '') // 줄 시작에 프롬프트가 있는 경우
            .replace(/^.*?입력:\s*$/gm, '') // 단순한 '입력:' 패턴
            .replace(/^.*?입력:\s*\n/gm, ''); // 단순한 '입력:' 패턴 + 줄바꿈

          cleanOutput = cleanOutput.trim();

          console.log('🔍 Input resume 처리 후:', JSON.stringify(cleanOutput));

          if (cleanOutput) {
            this.appendToOutput(cleanOutput, 'input-resume');
          }
        }
        if (result.error) {
          this.appendToOutput(result.error + '\n', 'error');
        }

        this.finishExecution();
      }

    } catch (error) {
      console.error('❌ Python 실행 재개 오류:', error);
      this.appendToOutput(`재개 오류: ${error.message}\n`, 'error');
      this.finishExecution();
    }
  }

  /**
   * 실행 완료 처리
   */
  finishExecution() {
    this.state.isRunning = false;
    this.state.isInteractiveMode = false;
    this.state.sessionId = null;

    if (this.modules.input) {
      this.modules.input.clearInputQueue();
      this.modules.input.setExecutionContext(null);
    }

    this.updateRunButton(false);
  }

  /**
   * 터미널 출력 추가 (폰트 크기 적용 개선)
   */
  appendToOutput(text, type = 'normal') {
    const outputElement = document.getElementById(this.options.outputId);
    if (!outputElement) return;

    if (!text || typeof text !== 'string' || text.trim() === '' ||
      text.includes('WAIT_FOR_INPUT') || text.includes('EXECUTION_FINISHED') || text.includes('PROMPT:')) {
      return;
    }

    // 기존 플레이스홀더 제거
    const existingPlaceholder = outputElement.querySelector('pre.text-muted');
    if (existingPlaceholder) {
      existingPlaceholder.remove();
    }

    // 라인 컨테이너 생성
    const lineContainer = document.createElement('div');
    lineContainer.className = 'output-line force-block';
    lineContainer.style.cssText = `
      display: block; width: 100%; margin: 0 0 2px 0;
      clear: both; flex-shrink: 0; box-sizing: border-box;
    `;

    // pre 요소 생성
    const preElement = document.createElement('pre');

    // 🔥 현재 폰트 크기 적용
    const currentFontSize = document.documentElement.style.getPropertyValue('--terminal-font-size') || '14px';

    // input() 재개 결과 특별 처리
    if (type === 'input-resume') {
      console.log('🔍 appendToOutput input-resume 호출:', JSON.stringify(text));
      preElement.textContent = text;
      preElement.style.cssText = `
        margin: 0; padding: 0; display: block; width: 100%;
        white-space: pre-line; word-wrap: break-word;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: ${currentFontSize};
      `;
    } else {
      // 일반적인 출력 처리
      preElement.textContent = text;
      preElement.style.cssText = `
        margin: 0; padding: 0; display: block; width: 100%;
        white-space: pre-wrap; word-wrap: break-word;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: ${currentFontSize};
      `;
    }

    // 🔥 수정: VSCode 기본 터미널 색상 사용
    switch (type) {
      case 'error': preElement.className = 'text-danger'; break;
      case 'warning': preElement.className = 'text-warning'; break;
      // 🔥 수정: info, success, normal 타입 모두 VSCode 기본 색상 사용
      case 'info': preElement.className = 'terminal-default'; break;
      case 'success': preElement.className = 'terminal-default'; break;
      case 'input': preElement.className = 'text-primary'; break;
      case 'input-resume': preElement.className = 'terminal-default'; break;
      case 'prompt': preElement.className = 'text-secondary'; break;
      default: preElement.className = 'terminal-default'; break;
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
      outputElement.style.display = 'flex';
      outputElement.style.flexDirection = 'column';
      outputElement.style.alignItems = 'flex-start';
    }
  }

  /**
   * 실행 버튼 상태 업데이트
   */
  updateRunButton(isRunning) {
    const runButton = document.getElementById(this.options.runButtonId);
    if (!runButton) return;

    if (isRunning) {
      runButton.disabled = false; // 🔥 중지 버튼 활성화를 위해 false로 변경
      runButton.innerHTML = '<i class="bi bi-stop-fill"></i> 중지'; // 텍스트 변경
      runButton.classList.add('btn-stop-execution'); // 스타일링 클래스
    } else {
      runButton.disabled = false;
      runButton.innerHTML = '<i class="bi bi-play-fill"></i> 코드 실행';
      runButton.classList.remove('btn-stop-execution');
    }
  }

  /**
   * 활성화
   */
  activate() {
    if (this.modules.resize) {
      window.addEventListener('resize', this.modules.resize.handleWindowResize.bind(this.modules.resize));
      setTimeout(() => this.modules.resize.setInitialHeight(), 100);
    }
    console.log('✅ Terminal 활성화됨');
  }

  /**
   * 비활성화
   */
  deactivate() {
    if (this.modules.input && this.modules.input.isWaitingForInput()) {
      // 입력 대기 중이면 취소
      const inputContainer = document.querySelector('.terminal-input-container');
      if (inputContainer) {
        inputContainer.remove();
      }
    }

    if (this.modules.resize) {
      window.removeEventListener('resize', this.modules.resize.handleWindowResize);
    }
    console.log('✅ Terminal 비활성화됨');
  }

  /**
   * 정리
   */
  destroy() {
    console.log('🗑️ Terminal 정리 시작');

    // 이벤트 리스너 제거
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

    // 🔥 EventBus 리스너 제거
    if (this.boundHandleFontChange && window.EventBus) {
      window.EventBus.unsubscribe('font:change', this.boundHandleFontChange);
    }

    // 상태 초기화
    this.state.isRunning = false;
    this.state.isInteractiveMode = false;
    this.state.sessionId = null;

    // 모듈 정리
    this.modules.input = null;
    this.modules.resize = null;

    console.log('✅ Terminal 정리 완료');
  }
}

// 전역 스코프에 노출
window.Terminal = Terminal;