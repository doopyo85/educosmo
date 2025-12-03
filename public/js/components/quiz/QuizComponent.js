/**
 * QuizComponent.js - 간소화된 버전
 * 세션 관리는 apiRouter에 위임하고, 퀴즈 기능에만 집중
 */

class QuizComponent extends Component {
  constructor(config = {}) {
    const mergedConfig = {
      ...config,
      id: config.id || 'quiz-component',
      type: 'QUIZ',
      visible: config.visible !== undefined ? config.visible : true
    };
    
    super(mergedConfig);
    
    this.state = {
      currentProblemData: null,
      userAnswers: {},
      isAnswerSubmitted: false,
      userProgress: {},
      initialized: false
    };
    
    this.isLoading = false;
    this.lastLoadedExam = '';
    this.lastLoadedProblem = '';
    this.active = false;
    this.userId = null; // 간단한 사용자 ID 저장
    
    this.containerId = config.containerId || 'quiz-component';
    
    this.apiEndpoints = {
      getQuizProblem: '/api/quiz/get-quiz-problem',
      submitAnswer: '/api/quiz/submit-answer',
      getUserProgress: '/api/quiz/get-user-progress'
    };
    
    this.options = {
      allowRetry: config.allowRetry !== undefined ? config.allowRetry : true,
      showFeedback: config.showFeedback !== undefined ? config.showFeedback : true,
      examName: config.examName || ''
    };
    
    this.elements = {
      container: null
    };
    
    this.eventBus = config.eventBus || window.EventBus || {
      subscribe: function() { console.warn('EventBus not available'); },
      publish: function() { console.warn('EventBus not available'); }
    };
    
    console.log('✅ QuizComponent 생성됨, 컨테이너 ID:', this.containerId);
    
    this.setupEventBindings();
  }
  
  async init() {
    console.log('퀴즈 컴포넌트 초기화');
    
    this.initElements();
    
    try {
      if (!this.eventBus && window.EventBus) {
        this.eventBus = window.EventBus;
        this.setupEventBindings();
      }
      
      // 🔥 개선: 사용자 정보 가져오기 - 실패해도 계속 진행
      try {
        await this.loadUser();
        console.log('🎯 초기화 완료 후 사용자 ID:', this.userId);
      } catch (userError) {
        console.warn('⚠️ 사용자 정보 로드 실패, 나중에 재시도:', userError.message);
        // 사용자 정보 로드 실패해도 계속 진행
      }
      
      await this.loadUserProgress();
      
      this.state.initialized = true;
      console.log('퀴즈 컴포넌트 초기화 완료');
      
      if (this.eventBus && typeof this.eventBus.publish === 'function') {
        this.eventBus.publish('quizComponentInitialized', {
          component: this,
          id: this.id
        });
      }
    } catch (error) {
      console.error('퀴즈 컴포넌트 초기화 오류:', error);
      this.showError('퀴즈 컴포넌트 초기화에 실패했습니다: ' + error.message);
      
      // 🔥 초기화 실패해도 일부 기능은 유지
      this.state.initialized = true;
    }
  }
  
  /**
   * 🔥 간소화: 사용자 정보 로드 - 단순하게 API 호출만
   */
  async loadUser() {
    console.log('🔍 사용자 정보 로드 시작');
    
    try {
      console.log('📡 /api/get-user-session 호출 중...');
      const response = await fetch('/api/get-user-session');
      
      console.log('📶 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`세션 API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 사용자 세션 응답 데이터:', data);
      
      if (data.is_logined && data.userID) {
        this.userId = data.userID;
        console.log('✅ 사용자 ID 로드 성공:', this.userId);
      } else {
        console.warn('⚠️ 로그인되지 않은 사용자 또는 userID 없음');
        console.log('상세 응답:', data);
        
        // 🔥 폴백: DOM에서 사용자 정보 찾기
        await this.tryGetUserFromDOM();
      }
    } catch (error) {
      console.error('❌ 사용자 정보 로드 실패:', error);
      
      // 🔥 폴백: DOM에서 사용자 정보 찾기
      await this.tryGetUserFromDOM();
      
      if (!this.userId) {
        throw new Error('로그인이 필요합니다. 페이지를 새로고침해 주세요.');
      }
    }
  }
  
  /**
   * 🔥 새로 추가: DOM에서 사용자 정보 가져오기
   */
  async tryGetUserFromDOM() {
    console.log('🔄 DOM에서 사용자 정보 찾기 시도');
    
    // 방법 1: hidden input에서 찾기
    const currentUserElement = document.getElementById('currentUserID');
    if (currentUserElement && currentUserElement.value && currentUserElement.value !== '게스트') {
      this.userId = currentUserElement.value;
      console.log('✅ hidden input에서 사용자 ID 찾음:', this.userId);
      return;
    }
    
    // 방법 2: userName 엘리먼트에서 찾기
    const userNameElement = document.getElementById('userName');
    if (userNameElement && userNameElement.textContent.trim() !== '게스트') {
      this.userId = userNameElement.textContent.trim();
      console.log('✅ userName에서 사용자 ID 찾음:', this.userId);
      return;
    }
    
    // 방법 3: 다른 API 시도
    try {
      console.log('📡 /api/get-user 호출 중...');
      const response = await fetch('/api/get-user');
      if (response.ok) {
        const data = await response.json();
        if (data.username) {
          this.userId = data.username;
          console.log('✅ 대체 API로 사용자 ID 로드 성공:', this.userId);
          return;
        }
      }
    } catch (e) {
      console.warn('대체 API 호출 실패:', e);
    }
    
    console.warn('⚠️ 모든 방법으로 사용자 ID를 찾을 수 없습니다');
  }
  
  initElements() {
    console.log('🔍 퀴즈 컨테이너 찾는 중:', this.containerId);
    
    this.elements.container = document.getElementById(this.containerId);
    
    if (!this.elements.container) {
      console.error(`❌ 퀴즈 컨테이너(${this.containerId})를 찾을 수 없습니다`);
      
      // 대체 컨테이너 찾기
      const possibleIds = ['quiz-component', 'quiz-container', 'quizComponent'];
      for (const id of possibleIds) {
        const element = document.getElementById(id);
        if (element) {
          console.log(`✅ 대체 컨테이너 발견: ${id}`);
          this.containerId = id;
          this.elements.container = element;
          break;
        }
      }
    } else {
      console.log(`✅ 퀴즈 컨테이너 찾음: ${this.containerId}`);
    }
  }
  
  async loadUserProgress() {
    if (!this.userId) {
      console.warn('사용자 ID가 없어 진행 상황을 로드할 수 없습니다');
      return;
    }
    
    try {
      const response = await fetch(
        `${this.apiEndpoints.getUserProgress}?userID=${encodeURIComponent(this.userId)}&examName=${encodeURIComponent(this.options.examName)}`
      );
      
      if (!response.ok) {
        console.warn(`사용자 진행 상황 로드 실패: HTTP ${response.status}`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        this.state.userProgress = data.progress || {};
        console.log('사용자 진행 상황 로드 완료:', this.state.userProgress);
      } else {
        console.warn('사용자 진행 상황 로드 실패:', data.message);
      }
    } catch (error) {
      console.error('사용자 진행 상황 로드 오류:', error);
    }
  }

  setupEventBindings() {
    if (!this.eventBus || typeof this.eventBus.subscribe !== 'function') {
      console.warn('EventBus가 없거나, subscribe 메서드가 없습니다. 이벤트 바인딩을 건너뜁니다.');
      return;
    }
    
    if (this.eventsSetup) {
      console.log('QuizComponent 이벤트가 이미 설정됨 - 건너뜀');
      return;
    }
    
    // 퀴즈 모드 활성화 이벤트 처리
    this.eventBus.subscribe('quizModeActivated', (data) => {
      console.log('퀴즈 모드 활성화됨:', data);
      this.activate();
      this.options.examName = data.examName;
      this.state.totalProblems = data.totalProblems || 0;
      this.loadUserProgress();
    });
    
    // 문제 변경 이벤트 처리
    this.eventBus.subscribe('problemChanged', (data) => {
      console.log('문제 변경 이벤트 받음:', data);
      if (this.active && data.examName === this.options.examName) {
        this.loadQuizForProblem(data.examName, data.problemNumber);
      }
    });
    
    // 메뉴 선택 이벤트 처리
    this.eventBus.subscribe('menuSelected', (data) => {
      if (data.layoutType !== 'quiz') {
        this.deactivate();
      }
    });
    
    // 레이아웃 타입 변경 이벤트 처리
    this.eventBus.subscribe('layoutTypeChanged', (data) => {
      if (data.type === 'quiz') {
        this.activate();
        this.options.examName = data.data.examName;
      } else {
        this.deactivate();
      }
    });
    
    this.eventsSetup = true;
    console.log('QuizComponent 이벤트 바인딩 완료');
  }

  async loadQuizForProblem(examName, problemNumber) {
    if (this.isLoading || (this.lastLoadedExam === examName && this.lastLoadedProblem === problemNumber)) {
      console.log('퀴즈 중복 로드 방지:', examName, problemNumber);
      return;
    }
    
    if (!this.active) {
      console.log('퀴즈 컴포넌트가 비활성화 상태 - 로드 건너뜀');
      return;
    }
    
    console.log('퀴즈 데이터 로드 시작:', examName, problemNumber);
    
    this.isLoading = true;
    this.lastLoadedExam = examName;
    this.lastLoadedProblem = problemNumber;
    
    try {
      this.state.isAnswerSubmitted = false;
      this.options.examName = examName;
      
      this.showLoading();
      
      const response = await fetch(
        `${this.apiEndpoints.getQuizProblem}?examName=${encodeURIComponent(examName)}&problemNumber=${problemNumber}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP 오류: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.quizData) {
        this.state.currentProblemData = data.quizData;
        this.renderQuiz();
        
        // 이전 답변이 있는지 확인
        const problemKey = `${examName}_p${problemNumber.toString().padStart(2, '0')}`;
        if (this.state.userProgress[problemKey]) {
          this.markAsSolved(this.state.userProgress[problemKey].isCorrect);
        }
        
        console.log('퀴즈 데이터 로드 완료:', examName, problemNumber);
      } else {
        this.showError('퀴즈 데이터를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('퀴즈 데이터 로드 오류:', error);
      this.showError('퀴즈 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      this.isLoading = false;
    }
  }
  
  activate() {
    console.log('QuizComponent 활성화');
    this.active = true;
    this.show();
  }

  deactivate() {
    console.log('QuizComponent 비활성화');
    this.active = false;
    this.hide();
    this.isLoading = false;
  }

  showLoading() {
    if (!this.elements.container) return;
    
    this.elements.container.innerHTML = `
      <div class="text-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">퀴즈 데이터를 불러오는 중...</p>
      </div>
    `;
  }
  
  showError(message) {
    if (!this.elements.container) return;
    
    this.elements.container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        ${message}
        <div class="mt-2">
          <small class="text-muted">현재 사용자 ID: ${this.userId || '없음'}</small>
        </div>
      </div>
    `;
  }
  
  renderQuiz() {
    console.log('🎯 퀴즈 렌더링 시작');
    
    if (!this.elements.container) {
      console.error('❌ 퀴즈 컨테이너가 없습니다');
      return;
    }
    
    if (!this.state.currentProblemData) {
      console.error('❌ 퀴즈 데이터가 없습니다');
      this.showError('퀴즈 데이터가 없습니다.');
      return;
    }
    
    console.log('📊 현재 문제 데이터:', this.state.currentProblemData);
    
    const { answerType, correctAnswer, testCases, difficulty, questionType } = this.state.currentProblemData;
    
    let quizHTML = `
      <div class="quiz-wrapper">
        <div class="quiz-header">
          <div class="quiz-title">문제 풀이</div>
          <div class="quiz-subtitle">
            <span class="badge ${this.getDifficultyBadgeClass(difficulty)} me-2">난이도: ${difficulty}</span>
            <span class="badge bg-info">${questionType}</span>
          </div>
        </div>
        <div class="quiz-content">
    `;
    
    if (questionType === '객관식') {
      console.log('🔘 객관식 문제 렌더링 중...');
      quizHTML += this.renderMultipleChoiceQuiz(correctAnswer);
    } else if (questionType === '주관식') {
      console.log('✏️ 주관식 문제 렌더링 중...');
      quizHTML += this.renderShortAnswerQuiz(answerType);
    } else if (questionType === '코딩') {
      console.log('💻 코딩 문제 렌더링 중...');
      quizHTML += this.renderCodingQuiz(testCases);
    } else {
      console.warn('⚠️ 알 수 없는 문제 타입:', questionType);
    }
    
    quizHTML += `
        </div>
        <div class="quiz-actions">
          <button id="submit-answer-btn" class="submit-btn">
            <i class="bi bi-check-circle me-1"></i> 정답 제출
          </button>
        </div>
        <div id="feedback-container" class="feedback-container mt-3" style="display: none;"></div>
      </div>
    `;
    
    this.elements.container.innerHTML = quizHTML;
    this.setupQuizEventListeners();
    
    console.log('✅ 퀴즈 렌더링 완료');
  }
  
  getDifficultyBadgeClass(difficulty) {
    switch(Number(difficulty)) {
      case 1: return 'bg-success';
      case 2: return 'bg-primary';
      case 3: return 'bg-warning text-dark';
      case 4: return 'bg-danger';
      case 5: return 'bg-dark';
      default: return 'bg-secondary';
    }
  }
  
  renderMultipleChoiceQuiz(correctAnswer) {
    console.log('🎯 객관식 퀴즈 렌더링 시작');
    console.log('원본 correctAnswer 데이터:', correctAnswer);
    
    let choices = [];
    
    try {
      const answerData = JSON.parse(correctAnswer);
      choices = answerData.choices || [];
      console.log('✅ 객관식 데이터 파싱 성공:', answerData);
    } catch (e) {
      console.error('❌ 객관식 데이터 파싱 실패:', e);
      choices = ['①', '②', '③', '④', '⑤'];
      console.log('기본 선택지 사용:', choices);
    }
    
    if (!choices || choices.length === 0) {
      console.warn('⚠️ 선택지가 비어있음, 기본값 사용');
      choices = ['①', '②', '③', '④', '⑤'];
    }
    
    let html = `
      <div class="multiple-choice">
        <p class="instruction">정답을 선택하세요:</p>
    `;
    
    choices.forEach((choice, index) => {
      const choiceNumber = index + 1;
      html += `
        <div class="choice-item">
          <input type="radio" name="quiz-answer" id="choice-${choiceNumber}" value="${choiceNumber}" class="quiz-radio">
          <label for="choice-${choiceNumber}" class="choice-label">
            <span class="choice-number">${choiceNumber}</span>
            ${choice}
          </label>
        </div>
      `;
    });
    
    html += `</div>`;
    
    console.log('✅ 생성된 객관식 HTML 길이:', html.length);
    return html;
  }
  
  renderShortAnswerQuiz(answerType) {
    let placeholder = '정답을 입력하세요';
    let instruction = '정답을 입력하세요:';
    
    if (answerType === 'pattern') {
      instruction = '패턴에 맞는 정답을 입력하세요:';
    }
    
    return `
      <div class="short-answer">
        <p class="instruction">${instruction}</p>
        <input type="text" id="short-answer-input" class="answer-input" placeholder="${placeholder}">
      </div>
    `;
  }
  
  renderCodingQuiz(testCases) {
    let testCasesHtml = '';
    try {
      const parsedTestCases = typeof testCases === 'string' ? JSON.parse(testCases) : testCases;
      
      if (Array.isArray(parsedTestCases) && parsedTestCases.length > 0) {
        testCasesHtml = `
          <div class="test-cases mt-3">
            <p class="fw-bold">테스트 케이스:</p>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>입력</th>
                    <th>예상 출력</th>
                  </tr>
                </thead>
                <tbody>
        `;
        
        parsedTestCases.forEach(testCase => {
          testCasesHtml += `
            <tr>
              <td><code>${testCase.input}</code></td>
              <td><code>${testCase.output}</code></td>
            </tr>
          `;
        });
        
        testCasesHtml += `
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    } catch (e) {
      console.error('테스트 케이스 파싱 오류:', e);
    }
    
    return `
      <div class="coding-quiz">
        <p class="instruction">코드 에디터에 작성한 코드로 문제를 풀이하세요.</p>
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          왼쪽 코드 에디터에 코드를 작성하고 실행해본 후, 정답을 제출하세요.
        </div>
        ${testCasesHtml}
      </div>
    `;
  }
  
  setupQuizEventListeners() {
    const submitBtn = document.getElementById('submit-answer-btn');
    
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitAnswer());
    }
    
    if (this.userHasSolvedCurrentProblem() && !this.options.allowRetry) {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> 이미 정답을 맞추셨습니다';
      }
    }
  }
  
  userHasSolvedCurrentProblem() {
    if (!this.options.examName || !window.currentProblemNumber || !this.state.userProgress) {
      return false;
    }
    
    const problemKey = `${this.options.examName}_p${window.currentProblemNumber.toString().padStart(2, '0')}`;
    return this.state.userProgress[problemKey] && this.state.userProgress[problemKey].isCorrect;
  }
  
  async submitAnswer() {
    console.log('📝 정답 제출 시작');
    
    if (this.state.isAnswerSubmitted && !this.options.allowRetry) {
      console.log('❌ 이미 제출됨');
      this.showFeedback(false, '이미 정답을 제출했습니다.');
      return;
    }
    
    // 🔥 개선: 사용자 ID 확인 및 재로드 시도
    if (!this.userId) {
      console.log('❌ 사용자 ID 없음, 재로드 시도:', this.userId);
      
      try {
        await this.loadUser();
        console.log('🔄 사용자 정보 재로드 결과:', this.userId);
      } catch (error) {
        console.error('❌ 사용자 정보 재로드 실패:', error);
      }
      
      if (!this.userId) {
        console.log('❌ 재로드 후에도 사용자 ID 없음');
        this.showFeedback(false, '로그인이 필요합니다. 페이지를 새로고침해 주세요.');
        return;
      }
    }
    
    console.log('✅ 사용자 ID 확인됨:', this.userId);
    
    const userAnswer = this.getUserAnswer();
    console.log('🔍 사용자 답안 가져오기 결과:', userAnswer);
    
    if (!userAnswer) {
      console.log('❌ 사용자 답안 없음');
      this.showFeedback(false, '답변을 입력하거나 선택해주세요.');
      return;
    }
    
    console.log('📋 사용자 답안:', userAnswer);
    console.log('📋 사용자 ID:', this.userId);
    
    try {
      const { examName } = this.options;
      const problemNumber = window.currentProblemNumber;
      
      const submitData = {
        userID: this.userId,
        examName,
        problemNumber: `p${problemNumber.toString().padStart(2, '0')}`,
        userAnswer,
        answerType: this.state.currentProblemData.answerType || 'number'
      };
      
      // 코딩 문제인 경우 추가 데이터
      if (this.state.currentProblemData.questionType === '코딩') {
        submitData.editorCode = this.getEditorCode();
        submitData.testCases = this.state.currentProblemData.testCases;
      }
      
      console.log('📦 제출할 데이터:', submitData);
      
      const response = await fetch(this.apiEndpoints.submitAnswer, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(submitData),
      });
      
      console.log('📶 서버 응답 상태:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP 오류:', response.status, errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          this.showFeedback(false, errorData.message || '서버 오류가 발생했습니다.');
        } catch (parseError) {
          this.showFeedback(false, `HTTP 오류: ${response.status}`);
        }
        return;
      }
      
      const result = await response.json();
      console.log('🏆 서버 응답 데이터:', result);
      
      if (result.success) {
        this.showFeedback(result.isCorrect, result.message);
        this.state.isAnswerSubmitted = true;
        this.markAsSolved(result.isCorrect);
        
        // 진행 상황 업데이트
        const problemKey = `${examName}_p${problemNumber.toString().padStart(2, '0')}`;
        this.state.userProgress[problemKey] = {
          timestamp: new Date().toISOString(),
          isCorrect: result.isCorrect,
          userAnswer
        };
      } else {
        this.showFeedback(false, result.message || '오답입니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('❌ 정답 제출 오류:', error);
      this.showFeedback(false, '정답 제출 중 오류가 발생했습니다.');
    }
  }
  
  getUserAnswer() {
    console.log('🔍 getUserAnswer 시작');
    
    if (!this.state.currentProblemData) {
      console.error('❌ 현재 문제 데이터가 없습니다');
      return null;
    }
    
    const questionType = this.state.currentProblemData.questionType;
    console.log('📋 문제 타입:', questionType);
    
    if (questionType === '객관식') {
      console.log('🔘 객관식 답안 찾기 시작');
      
      // 모든 라디오 버튼 확인
      const allRadios = document.querySelectorAll('input[name="quiz-answer"]');
      console.log('📋 전체 라디오 버튼 개수:', allRadios.length);
      
      // 각 라디오 버튼 상태 확인
      allRadios.forEach((radio, index) => {
        console.log(`라디오 ${index + 1}:`, {
          id: radio.id,
          value: radio.value,
          checked: radio.checked,
          name: radio.name
        });
      });
      
      const selectedRadio = document.querySelector('input[name="quiz-answer"]:checked');
      
      if (selectedRadio) {
        console.log('✅ 선택된 라디오:', {
          id: selectedRadio.id,
          value: selectedRadio.value,
          checked: selectedRadio.checked
        });
        return selectedRadio.value;
      } else {
        console.log('❌ 선택된 라디오 버튼 없음');
        return null;
      }
      
    } else if (questionType === '주관식') {
      console.log('✏️ 주관식 답안 찾기');
      const inputField = document.getElementById('short-answer-input');
      if (inputField) {
        const answer = inputField.value.trim();
        console.log('📝 주관식 답안:', answer);
        return answer || null;
      } else {
        console.log('❌ 주관식 입력 필드 없음');
        return null;
      }
    } else if (questionType === '코딩') {
      console.log('💻 코딩 답안 찾기');
      const code = this.getEditorCode();
      console.log('💻 코드 길이:', code ? code.length : 0);
      return code;
    }
    
    console.log('❌ 알 수 없는 문제 타입:', questionType);
    return null;
  }
  
  getEditorCode() {
    if (window.editor) {
      return window.editor.getValue();
    } else if (window.LayoutSystem && window.LayoutSystem.components.ide) {
      const ideComponent = window.LayoutSystem.components.ide;
      if (typeof ideComponent.getCode === 'function') {
        return ideComponent.getCode();
      }
    } else if (typeof ace !== 'undefined' && ace.edit) {
      try {
        const editor = ace.edit('editor');
        return editor.getValue();
      } catch (e) {
        console.error('ACE 에디터에서 코드를 가져오는 중 오류 발생:', e);
      }
    }
    
    return '';
  }
  
  showFeedback(isCorrect, message) {
    const feedbackContainer = document.getElementById('feedback-container');
    if (!feedbackContainer) return;
    
    feedbackContainer.style.display = 'block';
    feedbackContainer.className = isCorrect 
      ? 'feedback-container correct'
      : 'feedback-container incorrect';
    
    feedbackContainer.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="bi ${isCorrect ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2 fs-4"></i>
        <div>
          <p class="mb-0 fw-bold">${isCorrect ? '정답입니다!' : '오답입니다!'}</p>
          <p class="mb-0">${message}</p>
        </div>
      </div>
    `;
    
    if (this.state.currentProblemData.questionType === '코딩' && !isCorrect) {
      feedbackContainer.innerHTML += `
        <div class="mt-2">
          <p class="fw-bold mb-1">실행 결과:</p>
          <pre class="p-2 bg-dark text-light rounded"><code id="execution-results">테스트 결과가 없습니다.</code></pre>
        </div>
      `;
    }
  }
  
  markAsSolved(isCorrect) {
    const submitBtn = document.getElementById('submit-answer-btn');
    
    if (submitBtn) {
      if (isCorrect) {
        submitBtn.classList.add('btn-success');
        submitBtn.classList.remove('btn-primary');
        
        if (!this.options.allowRetry) {
          submitBtn.disabled = true;
        }
        
        this.updateProblemNavigationStatus(true);
      } else {
        submitBtn.classList.add('btn-outline-danger');
      }
    }
    
    if (this.eventBus && typeof this.eventBus.publish === 'function') {
      this.eventBus.publish('quizAnswered', {
        examName: this.options.examName,
        problemNumber: window.currentProblemNumber,
        isCorrect: isCorrect
      });
    }
  }
  
  updateProblemNavigationStatus(solved) {
    const problemNumber = window.currentProblemNumber;
    const problemIcon = document.querySelector(`#problem-navigation .problem-icon:nth-child(${problemNumber})`);
    
    if (problemIcon && solved) {
      problemIcon.classList.add('text-success');
    }
  }

  show() {
    console.log('🔍 QuizComponent show() 호출됨');
    
    if (!this.elements.container) {
      console.error('❌ 컨테이너를 찾을 수 없어 다시 초기화합니다');
      this.initElements();
    }
    
    if (this.elements.container) {
      this.elements.container.style.display = 'flex';
      this.elements.container.style.visibility = 'visible';
      this.elements.container.classList.remove('component-hidden');
      this.elements.container.classList.add('component-visible');
      this.visible = true;
      console.log('✅ QuizComponent 표시 완료');
    } else {
      console.error('❌ QuizComponent 컨테이너를 찾을 수 없습니다');
    }
  }

  hide() {
    if (this.elements.container) {
      this.elements.container.style.display = 'none';
      this.elements.container.classList.remove('component-visible');
      this.elements.container.classList.add('component-hidden');
      this.visible = false;
      console.log('QuizComponent 숨겨짐');
    }
  }
}

// 컴포넌트 팩토리에 등록
if (window.ComponentFactory) {
  window.ComponentFactory.registerClass('quiz', QuizComponent);
}

// 전역 스코프에 QuizComponent 클래스 노출
window.QuizComponent = QuizComponent;