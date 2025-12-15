/**
 * TerminalInput.js - 터미널 입력 처리 전담
 * input() 감지, 입력 필드 생성, 히스토리 관리만
 */

class TerminalInput {
  constructor(options = {}) {
    this.options = {
      outputId: 'output-content',
      ...options
    };

    this.state = {
      waitingForInput: false,
      inputQueue: [],
      executionContext: null,
      currentPrompt: '' // 🔥 프롬프트 저장용 추가
    };

    this.history = {
      commands: [],
      currentIndex: -1,
      currentInputField: null
    };
  }

  /**
   * input() 함수 감지
   */
  hasInputFunction(code) {
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return false;
    }

    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const commentIndex = line.indexOf('#');
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex);
      }
      if (line.trim() && line.includes('input(')) {
        return true;
      }
    }
    return false;
  }

  /**
   * 입력 대기 시작
   */
  waitForInput(prompt = '') {
    this.state.waitingForInput = true;
    this.state.currentPrompt = prompt; // 🔥 프롬프트 상태 저장

    const outputElement = document.getElementById(this.options.outputId);
    if (!outputElement) return;

    const { inputContainer, inputField } = this.createInputField(prompt);
    outputElement.appendChild(inputContainer);

    setTimeout(() => inputField.focus(), 100);
    outputElement.scrollTop = outputElement.scrollHeight;
  }

  /**
   * 입력 필드 생성
   */
  createInputField(promptText = '') {
    const inputContainer = document.createElement('div');
    inputContainer.className = 'terminal-input-container';

    // Flexbox를 사용하여 프롬프트와 입력을 한 줄에 배치
    inputContainer.style.cssText = `
      display: flex; width: 100%; margin: 2px 0; padding: 0;
      clear: both; align-items: baseline;
    `;

    // 프롬프트 (동적 텍스트 사용)
    const promptLine = document.createElement('div');
    promptLine.className = 'input-prompt'; // 클래스명 변경
    promptLine.textContent = promptText; // 하드코딩된 '>>> ' 제거 및 동적 텍스트 사용
    promptLine.style.cssText = `
      margin: 0; padding: 0; white-space: pre;
      color: #d4d4d4; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px; line-height: 1.4; flex-shrink: 0;
    `;

    // 입력 필드 래퍼
    const inputLine = document.createElement('div');
    inputLine.className = 'input-line';
    inputLine.style.cssText = `
      flex-grow: 1; margin: 0; padding: 0;
    `;

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'terminal-input-field';
    inputField.autocomplete = 'off';
    inputField.spellcheck = false;
    inputField.style.cssText = `
      background: transparent; border: none; outline: none;
      color: #d4d4d4; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px; width: 100%; display: block;
      padding: 0; line-height: 1.4; margin-left: 0;
    `;

    inputLine.appendChild(inputField);
    inputContainer.appendChild(promptLine);
    inputContainer.appendChild(inputLine);

    this.history.currentInputField = inputField;
    this.setupInputEvents(inputField, inputContainer);

    return { inputContainer, inputField };
  }

  /**
   * 입력 이벤트 설정
   */
  setupInputEvents(inputField, inputContainer) {
    inputField.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          this.handleInputSubmit(inputField.value);
          inputContainer.remove();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.handleHistoryUp(inputField);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.handleHistoryDown(inputField);
          break;
        case 'Escape':
          e.preventDefault();
          this.handleInputCancel(inputContainer);
          break;
      }
    });
  }

  /**
   * 히스토리 위로
   */
  handleHistoryUp(inputField) {
    if (this.history.currentIndex > 0) {
      this.history.currentIndex--;
      inputField.value = this.history.commands[this.history.currentIndex];
    } else if (this.history.commands.length > 0 && this.history.currentIndex === -1) {
      this.history.currentIndex = this.history.commands.length - 1;
      inputField.value = this.history.commands[this.history.currentIndex];
    }
  }

  /**
   * 히스토리 아래로
   */
  handleHistoryDown(inputField) {
    if (this.history.currentIndex < this.history.commands.length - 1 && this.history.currentIndex !== -1) {
      this.history.currentIndex++;
      inputField.value = this.history.commands[this.history.currentIndex];
    } else if (this.history.currentIndex === this.history.commands.length - 1) {
      this.history.currentIndex = -1;
      inputField.value = '';
    }
  }

  /**
   * 입력 완료 처리
   */
  handleInputSubmit(inputValue) {
    if (inputValue.trim()) {
      this.history.commands.push(inputValue.trim());
      if (this.history.commands.length > 100) {
        this.history.commands.shift();
      }
    }

    this.history.currentIndex = -1;
    this.state.inputQueue.push(inputValue);
    this.state.waitingForInput = false;
    this.history.currentInputField = null;

    // 이벤트 발생 - 프롬프트와 입력을 함께 기록하여 히스토리 보존
    if (window.EventBus) {
      window.EventBus.publish('terminal:output', {
        text: `${this.state.currentPrompt}${inputValue}`, // >>> 제거하고 프롬프트 + 입력값 기록
        type: 'input'
      });

      this.state.currentPrompt = ''; // 프롬프트 초기화

      window.EventBus.publish('terminal:resumeExecution', {
        input: inputValue,
        context: this.state.executionContext
      });
    }
  }

  /**
   * 입력 취소
   */
  handleInputCancel(inputContainer) {
    this.state.waitingForInput = false;
    this.history.currentInputField = null;
    inputContainer.remove();

    if (window.EventBus) {
      window.EventBus.publish('terminal:cancelExecution', {});
    }
  }

  /**
   * 실행 컨텍스트 설정
   */
  setExecutionContext(context) {
    this.state.executionContext = context;
  }

  /**
   * 입력 큐 지우기
   */
  clearInputQueue() {
    this.state.inputQueue = [];
  }

  /**
   * 마지막 입력값
   */
  getLastInput() {
    return this.state.inputQueue.length > 0
      ? this.state.inputQueue[this.state.inputQueue.length - 1]
      : null;
  }

  /**
   * 대기 상태 확인
   */
  isWaitingForInput() {
    return this.state.waitingForInput;
  }
}

window.TerminalInput = TerminalInput;