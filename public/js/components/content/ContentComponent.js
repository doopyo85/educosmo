/**
 * ContentComponent.js
 * 콘텐츠 표시 및 문제 로드를 담당하는 컴포넌트
 * 🔥 수정: 해설 버튼을 problem-navigation 영역으로 이동
 */

class ContentComponent extends Component {
  constructor(options = {}) {
    const mergedConfig = {
      ...options,
      id: options.id || 'content-component',
      type: 'CONTENT',
      visible: true
    };

    super(mergedConfig);

    this.state = {
      currentExamName: '',
      currentProblemNumber: 1,
      totalProblems: 0,
      problemData: options.problemData || [],
      initialized: false
    };

    this.isLoading = false;
    this.lastLoadedKey = '';

    this.containerId = options.containerId || 'problem-container';
    this.iframeId = options.iframeId || 'iframeContent';
    this.problemTitleId = options.problemTitleId || 'problem-title';
    this.problemNavigationId = options.problemNavigationId || 'problem-navigation';
    this.prevButtonId = options.prevButtonId || 'prev-problem';
    this.nextButtonId = options.nextButtonId || 'next-problem';

    this.elements = {
      container: null,
      iframe: null,
      problemTitle: null,
      problemNavigation: null,
      prevButton: null,
      nextButton: null,
      explanationBtn: null // 🔥 수정: 네비게이션 해설 버튼
    };

    this.explanationState = {
      hasExplanation: false,
      currentProblemData: null
    };

    this.eventBus = window.EventBus;
    this.setupEventBindings();
  }

  async init() {
    console.log('콘텐츠 컴포넌트 초기화');

    this.initElements();
    this.setupEventListeners();

    this.state.initialized = true;
    console.log('콘텐츠 컴포넌트 초기화 완료');

    if (window.EventBus) {
      window.EventBus.publish('contentComponentInitialized', {
        component: this,
        id: this.id
      });
    }
  }

  initElements() {
    this.elements.container = document.getElementById(this.containerId);
    this.elements.iframe = document.getElementById(this.iframeId);
    this.elements.problemTitle = document.getElementById(this.problemTitleId);
    this.elements.problemNavigation = document.getElementById(this.problemNavigationId);
    this.elements.prevButton = document.getElementById(this.prevButtonId);
    this.elements.nextButton = document.getElementById(this.nextButtonId);
    this.elements.explanationBtn = document.getElementById('explanation-btn'); // 🔥 추가: 해설 버튼

    if (!this.elements.container) {
      console.error(`콘텐츠 컨테이너(${this.containerId})를 찾을 수 없습니다`);
    }

    if (!this.elements.iframe) {
      console.error(`iframe(${this.iframeId})을 찾을 수 없습니다`);
    }

    this.setupExplanationButton();
  }

  setupEventBindings() {
    if (window.EventBus) {
      window.EventBus.subscribe('menuSelected', (data) => {
        console.log('콘텐츠 컴포넌트: 메뉴 선택 이벤트 받음', data);

        if (data.layoutType === 'quiz') {
          this.handleQuizMenuSelected(data);
        } else if (data.layoutType !== 'ppt') {
          if (data.examName) {
            // ✅ 로딩 화면 먼저 표시
            // this.showLoadingScreen(); // 사용자 요청으로 로딩 화면 제거

            this.state.currentExamName = data.examName;
            this.state.currentProblemNumber = 1;

            // ✅ 150ms 후 데이터 확인하고 로드
            setTimeout(() => {
              this.updateProblemCount();

              if (this.state.totalProblems > 0) {
                console.log(`문제 데이터 준비 완료: ${this.state.totalProblems}개 문제`);
                this.loadProblem(1);
              } else {
                console.warn('문제 데이터가 아직 준비되지 않음, 재시도 중...');
                // 한 번 더 재시도 (총 300ms 대기)
                setTimeout(() => {
                  this.updateProblemCount();
                  if (this.state.totalProblems > 0) {
                    this.loadProblem(1);
                  } else {
                    this.showErrorScreen('문제 데이터를 불러올 수 없습니다.');
                  }
                }, 150);
              }
            }, 150);
          }
        }
      });

      window.EventBus.subscribe('layoutTypeChanged', (data) => {
        if (data.type !== 'ppt') {
          if (data.data && data.data.examName) {
            // ✅ 로딩 화면 먼저 표시
            // this.showLoadingScreen(); // 사용자 요청으로 로딩 화면 제거

            this.state.currentExamName = data.data.examName;
            this.state.currentProblemNumber = 1;

            // ✅ 150ms 후 데이터 확인하고 로드
            setTimeout(() => {
              this.updateProblemCount();

              if (this.state.totalProblems > 0) {
                console.log(`문제 데이터 준비 완료: ${this.state.totalProblems}개 문제`);
                this.loadProblem(1);
              } else {
                console.warn('문제 데이터가 아직 준비되지 않음, 재시도 중...');
                // 한 번 더 재시도
                setTimeout(() => {
                  this.updateProblemCount();
                  if (this.state.totalProblems > 0) {
                    this.loadProblem(1);
                  } else {
                    this.showErrorScreen('문제 데이터를 불러올 수 없습니다.');
                  }
                }, 150);
              }
            }, 150);
          }
        }
      });

      window.EventBus.subscribe('problemChanged', (data) => {
        if (data.examName === this.state.currentExamName) {
          this.loadProblem(data.problemNumber);
        }
      });
    }
  }

  async handleQuizMenuSelected(data) {
    this.state.currentExamName = data.examName;
    this.state.currentProblemNumber = 1;

    if (window.ComponentSystem && window.ComponentSystem.state && window.ComponentSystem.state.problemData) {
      const allProblemData = window.ComponentSystem.state.problemData;
      this.state.problemData = allProblemData;
      this.updateProblemCount();

      if (this.state.totalProblems > 0) {
        setTimeout(() => {
          this.loadProblem(1);
        }, 100);
      }
    }
  }

  setupEventListeners() {
    if (this.elements.prevButton) {
      this.elements.prevButton.addEventListener('click', () => {
        if (this.state.currentProblemNumber > 1) {
          this.navigateToProblem(this.state.currentProblemNumber - 1);
        }
      });
    }

    if (this.elements.nextButton) {
      this.elements.nextButton.addEventListener('click', () => {
        if (this.state.currentProblemNumber < this.state.totalProblems) {
          this.navigateToProblem(this.state.currentProblemNumber + 1);
        }
      });
    }
  }

  setupExplanationButton() {
    // 🔥 수정: IDE 헤더 영역의 해설 버튼 연결
    this.connectIDEExplanationButton();
  }

  connectIDEExplanationButton() {
    // 🔥 수정: IDE 헤더의 해설 버튼에 연결
    const ideExplanationBtn = document.getElementById('ide-explanation-btn');

    if (ideExplanationBtn) {
      this.elements.explanationBtn = ideExplanationBtn;

      // 클릭 이벤트 설정
      ideExplanationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showExplanationPopup();
      });

      console.log('ContentComponent: IDE 헤더 해설 버튼 연결 완료');
    } else {
      console.warn('ContentComponent: IDE 헤더 해설 버튼을 찾을 수 없습니다.');
    }
  }

  showExplanationPopup() {
    if (!this.explanationState.currentProblemData) {
      console.warn('ContentComponent: 현재 문제 데이터가 없어 해설을 표시할 수 없습니다.');
      return;
    }

    console.log('ContentComponent: 해설 팝업 요청:', this.explanationState.currentProblemData);

    if (window.EventBus && window.EventBus.publish) {
      window.EventBus.publish('explanation-request', this.explanationState.currentProblemData);
    }
  }

  checkExplanationExists(problemInfo) {
    if (!Array.isArray(problemInfo) || problemInfo.length < 1) {
      return false;
    }

    const problemFileName = problemInfo[0];
    if (!problemFileName || typeof problemFileName !== 'string') {
      return false;
    }

    // 🔥 임시: 항상 true 반환 (S3에 해설 파일이 있다고 가정)
    return true;
  }

  toggleExplanationButton(show) {
    if (!this.elements.explanationBtn) {
      return;
    }

    if (show) {
      // 활성화 상태
      this.elements.explanationBtn.style.display = 'inline-flex';
      this.elements.explanationBtn.classList.remove('disabled', 'no-explanation');
      this.elements.explanationBtn.classList.add('active');
      this.elements.explanationBtn.removeAttribute('data-tooltip');

      setTimeout(() => {
        this.elements.explanationBtn.style.opacity = '1';
        this.elements.explanationBtn.style.transform = 'scale(1)';
      }, 10);
    } else {
      // 비활성화 상태 (해설 없음)
      this.elements.explanationBtn.style.display = 'inline-flex';
      this.elements.explanationBtn.classList.remove('active');
      this.elements.explanationBtn.classList.add('disabled', 'no-explanation');
      this.elements.explanationBtn.setAttribute('data-tooltip', '해설이 제공되지 않습니다');

      this.elements.explanationBtn.style.opacity = '1';
      this.elements.explanationBtn.style.transform = 'scale(1)';
    }

    this.explanationState.hasExplanation = show;
    console.log('ContentComponent: 해설 버튼', show ? '활성화' : '비활성화');
  }

  updateProblemCount() {
    // 🔥 Fallback: 로컬 데이터가 없으면 전역 ComponentSystem에서 가져오기
    if ((!this.state.problemData || this.state.problemData.length === 0) &&
      window.ComponentSystem && window.ComponentSystem.state && window.ComponentSystem.state.problemData) {
      console.log('ContentComponent: 전역 ComponentSystem에서 문제 데이터 가져옴');
      this.state.problemData = window.ComponentSystem.state.problemData;
    }

    if (!this.state.problemData || !Array.isArray(this.state.problemData)) {
      this.state.totalProblems = 0;
      return;
    }

    if (!this.state.currentExamName) {
      this.state.totalProblems = 0;
      return;
    }

    this.state.totalProblems = this.state.problemData.filter(problem => {
      if (!Array.isArray(problem) || problem.length < 2) {
        return false;
      }

      if (!problem[1] || typeof problem[1] !== 'string') {
        return false;
      }

      return problem[1].toLowerCase() === this.state.currentExamName.toLowerCase();
    }).length;

    console.log(`콘텐츠 컴포넌트: ${this.state.currentExamName}의 총 문제 수: ${this.state.totalProblems}`);
    this.renderProblemNavigation();
  }

  renderProblemNavigation() {
    if (!this.elements.problemNavigation) return;

    // 🔥 수정: 해설 버튼은 problem-navigation과 별개로 관리되므로 건드리지 않음
    this.elements.problemNavigation.innerHTML = '';

    for (let i = 1; i <= this.state.totalProblems; i++) {
      const problemBtn = document.createElement('i');
      problemBtn.classList.add('bi', 'problem-icon');

      if (i === this.state.currentProblemNumber) {
        problemBtn.classList.add(i === 10 ? 'bi-0-circle-fill' : `bi-${i}-circle-fill`);
      } else {
        problemBtn.classList.add(i === 10 ? 'bi-0-circle' : `bi-${i}-circle`);
      }

      const problemIndex = i;
      problemBtn.addEventListener('click', () => {
        this.navigateToProblem(problemIndex);
      });

      this.elements.problemNavigation.appendChild(problemBtn);
    }

    // 🔥 수정: 해설 버튼이 없으면 연결 (IDE 헤더 레벨에서)
    if (!this.elements.explanationBtn) {
      this.connectIDEExplanationButton();
    }

    this.updateNavigationButtons();
  }

  updateNavigationButtons() {
    if (this.elements.prevButton) {
      this.elements.prevButton.disabled = this.state.currentProblemNumber <= 1;
    }

    if (this.elements.nextButton) {
      this.elements.nextButton.disabled = this.state.currentProblemNumber >= this.state.totalProblems;
    }
  }

  updateProblemNavigation() {
    const icons = document.querySelectorAll('#problem-navigation .problem-icon');

    icons.forEach((icon, index) => {
      const problemNumber = index + 1;
      const isCurrentProblem = problemNumber === this.state.currentProblemNumber;
      const isTenth = problemNumber === 10;

      icon.className = 'bi problem-icon';

      if (isCurrentProblem) {
        icon.classList.add(isTenth ? 'bi-0-circle-fill' : `bi-${problemNumber}-circle-fill`);
      } else {
        icon.classList.add(isTenth ? 'bi-0-circle' : `bi-${problemNumber}-circle`);
      }
    });

    this.updateNavigationButtons();
  }

  navigateToProblem(problemNumber) {
    if (problemNumber < 1 || problemNumber > this.state.totalProblems) {
      return;
    }

    this.state.currentProblemNumber = problemNumber;
    this.loadProblem(problemNumber);
    this.updateProblemNavigation();

    if (this.eventBus && this.eventBus.publish) {
      this.eventBus.publish('problemChanged', {
        examName: this.state.currentExamName,
        problemNumber: problemNumber
      });
    }
  }

  loadProblem(problemNumber) {
    console.log('콘텐츠 컴포넌트: 문제 로드', this.state.currentExamName, problemNumber);

    const currentKey = `${this.state.currentExamName}_${problemNumber}`;
    if (this.lastLoadedKey === currentKey) {
      console.log('중복 문제 로드 방지:', currentKey);
      return;
    }

    if (this.isLoading) {
      console.log('이미 로딩 중 - 건너뜀');
      return;
    }

    this.isLoading = true;
    this.lastLoadedKey = currentKey;

    if (!this.state.problemData || !Array.isArray(this.state.problemData) || this.state.problemData.length === 0) {
      console.error('문제 데이터가 로드되지 않았습니다');
      this.showErrorInIframe('문제 데이터가 로드되지 않았습니다.');
      this.isLoading = false;
      return;
    }

    if (!this.state.currentExamName) {
      console.error('시험지명이 설정되지 않았습니다');
      this.showErrorInIframe('시험지명이 설정되지 않았습니다.');
      this.isLoading = false;
      return;
    }

    const problemCode = `p${problemNumber.toString().padStart(2, '0')}`;

    const problemInfo = this.state.problemData.find(problem => {
      if (!Array.isArray(problem) || problem.length < 3) {
        return false;
      }

      if (!problem[1] || !problem[2] || typeof problem[1] !== 'string' || typeof problem[2] !== 'string') {
        return false;
      }

      return problem[1].toLowerCase() === this.state.currentExamName.toLowerCase() &&
        problem[2].toLowerCase() === problemCode.toLowerCase();
    });

    if (!problemInfo) {
      console.error('문제를 찾을 수 없습니다:', this.state.currentExamName, problemCode);
      this.showErrorInIframe(`
        <p>요청한 문제를 찾을 수 없습니다.</p>
        <p>시험지명: ${this.state.currentExamName}</p>
        <p>문제 번호: ${problemNumber} (${problemCode})</p>
        <p>총 문제 데이터 수: ${this.state.problemData.length}</p>
      `);
      this.isLoading = false;
      return;
    }

    const [problemFileName, , , pythonFileUrl] = problemInfo;

    if (!problemFileName) {
      console.error('문제 파일명이 없습니다');
      this.showErrorInIframe('문제 파일 정보가 없습니다.');
      this.isLoading = false;
      return;
    }

    let problemUrl;

    // 현재 레이아웃 타입 확인 (메뉴 데이터에서 전달된 pptUrl 활용)
    if (window.ComponentSystem && window.ComponentSystem.state && window.ComponentSystem.state.currentMenuData && window.ComponentSystem.state.currentMenuData.pptUrl) {
      const currentMenuData = window.ComponentSystem.state.currentMenuData;
      console.log('ContentComponent: 현재 메뉴 데이터:', currentMenuData);

      // pptUrl이 .md 파일인 경우, 해당 파일명을 그대로 사용
      if (currentMenuData.pptUrl && currentMenuData.pptUrl.endsWith('.md')) {
        const mdFileName = currentMenuData.pptUrl.split('/').pop();  // 
        problemUrl = `https://educodingnplaycontents.s3.amazonaws.com/DataAnalysis/${mdFileName}`;
        console.log('ContentComponent: MD 파일 URL 사용:', problemUrl);
      } else {
        // 기본 HTML 파일 사용
        problemUrl = `https://educodingnplaycontents.s3.amazonaws.com/${problemFileName}`;
        console.log('ContentComponent: HTML 파일 URL 사용:', problemUrl);
      }
    } else {
      // 기본 로직: problemFileName 사용
      problemUrl = `https://educodingnplaycontents.s3.amazonaws.com/${problemFileName}`;
      console.log('ContentComponent: 기본 파일 URL:', problemUrl);
    }


    if (!this.elements.iframe) {
      console.error('iframe 요소를 찾을 수 없습니다');
      this.isLoading = false;
      return;
    }

    // this.elements.iframe.srcdoc = this.getLoadingHtml(); // 사용자 요청으로 로딩 화면 제거

    // 🔥 NEW: 파일 확장자 확인하여 MD 또는 HTML 처리
    this.loadContentByFileType(problemUrl, problemFileName, problemInfo, problemNumber, pythonFileUrl);
  }

  updateExplanationButton(problemInfo, problemNumber) {
    const hasExplanation = this.checkExplanationExists(problemInfo);

    console.log('ContentComponent: 해설 존재 여부:', hasExplanation, '문제:', problemNumber);

    if (hasExplanation) {
      this.explanationState.currentProblemData = {
        examName: this.state.currentExamName,
        problemNumber: problemNumber
      };
    } else {
      this.explanationState.currentProblemData = null;
    }

    this.toggleExplanationButton(hasExplanation);
  }

  updateProblemTitle(problemNumber) {
    if (!this.elements.problemTitle) return;

    // 🔥 수정: 파일명과 타이틀 분리 표시
    const examNameModified = this.state.currentExamName.substring(0, 3).toUpperCase() +
      this.state.currentExamName.substring(3);

    const mainTitle = `${examNameModified} - 문제 ${problemNumber}`;

    // 현재 문제 데이터 찾기
    let fileName = '';
    if (this.state.problemData && Array.isArray(this.state.problemData)) {
      const problemCode = `p${problemNumber.toString().padStart(2, '0')}`;
      const problemInfo = this.state.problemData.find(p =>
        Array.isArray(p) && p.length >= 3 &&
        p[1].toLowerCase() === this.state.currentExamName.toLowerCase() &&
        p[2].toLowerCase() === problemCode.toLowerCase()
      );

      if (problemInfo && problemInfo[0]) {
        // 🔥 수정: 전체 경로가 아닌 파일명만 추출
        const fullPath = problemInfo[0];
        // 경로 구분자(슬래시)로 분리하여 마지막 요소(파일명)만 사용
        const pathParts = fullPath.split(/[/\\]/);
        fileName = pathParts.pop();
      }
    }

    // HTML 구조 생성
    this.elements.problemTitle.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'problem-title-container';

    if (fileName) {
      const fileSpan = document.createElement('div');
      fileSpan.className = 'problem-filename';
      fileSpan.textContent = fileName;
      container.appendChild(fileSpan);
    }

    const titleSpan = document.createElement('div');
    titleSpan.className = 'problem-main-title';
    titleSpan.textContent = mainTitle;
    container.appendChild(titleSpan);

    this.elements.problemTitle.appendChild(container);
  }

  // 🔥 NEW: 파일 타입에 따른 콘텐츠 로드 처리
  loadContentByFileType(fileUrl, fileName, problemInfo, problemNumber, pythonFileUrl) {
    console.log('ContentComponent: 파일 타입 확인 및 로드', fileName);

    // 파일 확장자 추출
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    console.log('ContentComponent: 파일 확장자:', fileExtension);

    // 🔥 NEW: 현재 레이아웃 타입 확인
    const currentLayoutType = this.getCurrentLayoutType();
    console.log('ContentComponent: 현재 레이아웃 타입:', currentLayoutType);

    if (fileExtension === 'md') {
      // 🔥 NEW: jupyter 레이아웃에서도 마크다운으로 처리 (왼쪽에 표시용)
      console.log('ContentComponent: 마크다운 모드로 처리 (레이아웃:', currentLayoutType, ')');

      // ✅ 타이밍 보정 + 재시도 로직
      setTimeout(() => {
        this.loadMarkdownContent(fileUrl, problemInfo, problemNumber, pythonFileUrl)
          .catch((err) => {
            console.warn('첫 시도 실패, 300ms 후 재시도');
            setTimeout(() => {
              this.loadMarkdownContent(fileUrl, problemInfo, problemNumber, pythonFileUrl)
                .catch(err2 => {
                  console.error('재시도 실패:', err2);
                });
            }, 300);
          });
      }, 100); // 초기 지연은 렌더 직후 타이밍 확보용

      // 🔥 NEW: jupyter 레이아웃인 경우 Jupyter UI 활성화 신호만 발송
      if (currentLayoutType === 'jupyter') {
        console.log('ContentComponent: Jupyter UI 활성화 신호 발송');
        this.activateJupyterUI(problemInfo, problemNumber);
      }
    } else {
      // HTML 파일 처리 (기존 로직)
      console.log('ContentComponent: HTML 파일 로드 시작:', fileUrl);
      this.loadHtmlContent(fileUrl, problemInfo, problemNumber, pythonFileUrl);

      // HTML 로드 시에도 스타일 주입 시도
      setTimeout(() => this.injectHideTitleStyle(), 500); // HTML 로드는 비동기일 수 있으므로 딜레이
    }


  }

  // 🔥 NEW: 현재 레이아웃 타입 확인 함수
  getCurrentLayoutType() {
    // ComponentSystem에서 현재 레이아웃 타입 확인
    if (window.ComponentSystem && window.ComponentSystem.state && window.ComponentSystem.state.layoutType) {
      return window.ComponentSystem.state.layoutType;
    }

    // body 클래스에서 레이아웃 타입 확인 (fallback)
    const bodyClasses = document.body.classList;
    for (const className of bodyClasses) {
      if (className.startsWith('layout-')) {
        return className.replace('layout-', '');
      }
    }

    // 기본값
    return 'html';
  }

  // 🔥 NEW: Jupyter UI 활성화 신호 발송 (오른쪽 편집기 활성화용)
  activateJupyterUI(problemInfo, problemNumber) {
    console.log('ContentComponent: Jupyter UI 활성화 요청:', {
      examName: this.state.currentExamName,
      problemNumber: problemNumber
    });

    // EventBus를 통해 Jupyter 컴포넌트에 활성화 신호 발송
    if (window.EventBus && window.EventBus.publish) {
      window.EventBus.publish('jupyter-activate', {
        examName: this.state.currentExamName,
        problemNumber: problemNumber,
        mode: 'editor-only' // 서버 연결 없이 편집기만 활성화
      });

      console.log('ContentComponent: jupyter-activate 이벤트 발송 완료');
    } else {
      console.warn('ContentComponent: EventBus를 찾을 수 없음');
    }
  }

  // 🔥 NEW: iframe 내부의 h1 태그 숨기기 스타일 주입
  injectHideTitleStyle() {
    if (!this.elements.iframe) return;

    try {
      const iframeDoc = this.elements.iframe.contentDocument || this.elements.iframe.contentWindow.document;
      if (iframeDoc && iframeDoc.head) {
        const style = iframeDoc.createElement('style');
        style.textContent = `
          h1:first-of-type, h1:first-child { display: none !important; }
          body { padding-top: 20px !important; }
          img { max-width: 100%; height: auto; } /* 🔥 추가: 큰 이미지 자동 축소 */
        `;
        iframeDoc.head.appendChild(style);
        console.log('ContentComponent: iframe 내부 h1 숨김 및 이미지 스타일 주입 완료');
      }
    } catch (e) {
      console.warn('ContentComponent: iframe 스타일 주입 실패', e);
    }
  }

  // 🔥 NEW: 마크다운 파일 로드 및 렌더링
  async loadMarkdownContent(markdownUrl, problemInfo, problemNumber, pythonFileUrl) {
    console.log('ContentComponent: 마크다운 파일 로드 시작:', markdownUrl);

    try {
      // 마크다운 파일 다운로드
      const response = await fetch(markdownUrl);

      if (!response.ok) {
        throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
      }

      const markdownText = await response.text();
      console.log('ContentComponent: 마크다운 텍스트 로드 완료, 길이:', markdownText.length);

      // 마크다운을 HTML로 변환
      const htmlContent = this.convertMarkdownToHtml(markdownText);
      console.log('ContentComponent: 마크다운 → HTML 변환 완료');

      this.elements.iframe.srcdoc = this.getEnhancedMarkdownHtml(htmlContent);

      // iframe 로드 완료 후 스타일 주입
      this.elements.iframe.onload = () => {
        this.injectHideTitleStyle();
      };

      // 이미 로드되었을 경우를 대비해 즉시 시도
      setTimeout(() => this.injectHideTitleStyle(), 100);

      // 이벤트 발행 및 상태 업데이트
      this.publishProblemChangedEvent(problemNumber, pythonFileUrl);
      this.updateExplanationButton(problemInfo, problemNumber);
      this.updateProblemTitle(problemNumber);

      window.currentExamName = this.state.currentExamName;
      window.currentProblemNumber = problemNumber;

    } catch (error) {
      console.error('ContentComponent: 마크다운 로드 오류:', error);
      this.elements.iframe.srcdoc = this.getErrorHtml(error.message, markdownUrl);
    } finally {
      this.isLoading = false;
    }
  }

  // 🔥 NEW: Markdown → HTML 변환 메서드
  convertMarkdownToHtml(markdownText) {
    // marked.js 라이브러리 사용 (이미 로드됨)
    if (typeof marked !== 'undefined') {
      // 코드 하이라이팅 설정
      marked.setOptions({
        highlight: function (code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (err) {
              console.warn('코드 하이라이팅 오류:', err);
            }
          }
          return code;
        },
        breaks: true,
        gfm: true
      });

      return marked.parse(markdownText);
    } else {
      console.warn('marked.js 라이브러리가 로드되지 않음. 기본 텍스트로 표시');
      // fallback: 간단한 Markdown 처리
      return this.simpleMarkdownToHtml(markdownText);
    }
  }

  // 🔥 NEW: 간단한 Markdown 파서 (fallback)
  simpleMarkdownToHtml(markdownText) {
    return markdownText
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>')
      .replace(/^(.*)$/gim, '<p>$1</p>');
  }

  // 🔥 NEW: Jupyter 노트북 모드 로드 및 렌더링
  async loadJupyterNotebook(markdownUrl, problemInfo, problemNumber, pythonFileUrl) {
    console.log('ContentComponent: Jupyter 노트북 로드 시작:', markdownUrl);

    // Jupyter UI 요소들 참조
    const jupyterLoading = document.getElementById('jupyter-loading');
    const jupyterIframe = document.getElementById('jupyter-iframe');
    const jupyterError = document.getElementById('jupyter-error');
    const jupyterToolbar = document.getElementById('jupyter-toolbar');

    try {
      // 1. 로딩 상태 표시
      if (jupyterLoading) jupyterLoading.style.display = 'flex';
      if (jupyterError) jupyterError.style.display = 'none';
      if (jupyterIframe) jupyterIframe.style.display = 'none';
      if (jupyterToolbar) jupyterToolbar.style.display = 'none';

      // 2. 마크다운 파일 다운로드
      console.log('ContentComponent: 마크다운 파일 다운로드 시작:', markdownUrl);
      const response = await fetch(markdownUrl);

      if (!response.ok) {
        throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
      }

      const markdownContent = await response.text();
      console.log('ContentComponent: 마크다운 텍스트 로드 완료, 길이:', markdownContent.length);

      // 3. 3000번 서버에 Jupyter 세션 요청
      console.log('ContentComponent: Jupyter 세션 생성 요청 시작');
      const jupyterResponse = await fetch('/api/jupyter/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          examName: this.state.currentExamName,
          problemNumber: problemNumber,
          markdownContent: markdownContent,
          markdownUrl: markdownUrl,
          pythonFileUrl: pythonFileUrl || null
        })
      });

      if (!jupyterResponse.ok) {
        const errorText = await jupyterResponse.text();
        console.error('Jupyter 세션 생성 실패:', jupyterResponse.status, errorText);
        throw new Error(`Jupyter 세션 생성 실패: ${jupyterResponse.status}`);
      }

      const jupyterData = await jupyterResponse.json();
      console.log('ContentComponent: Jupyter 세션 생성 성공:', jupyterData);

      if (!jupyterData.success || !jupyterData.jupyterUrl) {
        throw new Error('Jupyter URL을 받지 못했습니다.');
      }

      // 4. iframe에 Jupyter 노트북 로드
      console.log('ContentComponent: iframe에 Jupyter URL 설정:', jupyterData.jupyterUrl);
      if (jupyterIframe) {
        jupyterIframe.src = jupyterData.jupyterUrl;

        // iframe 로드 완료 이벤트 설정
        jupyterIframe.onload = () => {
          console.log('ContentComponent: Jupyter iframe 로드 완료');

          // 로딩 숨기고 iframe 표시
          if (jupyterLoading) jupyterLoading.style.display = 'none';
          if (jupyterIframe) jupyterIframe.style.display = 'block';
          if (jupyterToolbar) jupyterToolbar.style.display = 'block';

          // 상태 저장 (다운로드용)
          this.currentNotebookData = {
            examName: this.state.currentExamName,
            problemNumber: problemNumber,
            notebookPath: jupyterData.notebookPath,
            jupyterUrl: jupyterData.jupyterUrl
          };
        };

        // iframe 로드 오류 이벤트 설정
        jupyterIframe.onerror = () => {
          console.error('ContentComponent: Jupyter iframe 로드 오류');
          this.showJupyterError('노트북 로드에 실패했습니다.');
        };
      }

      // 5. 이벤트 발행 및 상태 업데이트
      this.publishProblemChangedEvent(problemNumber, pythonFileUrl);
      this.updateExplanationButton(problemInfo, problemNumber);
      this.updateProblemTitle(problemNumber);

      // 전역 변수 업데이트
      window.currentExamName = this.state.currentExamName;
      window.currentProblemNumber = problemNumber;

    } catch (error) {
      console.error('ContentComponent: Jupyter 로드 오류:', error);
      this.showJupyterError(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  async loadHtmlContent(htmlUrl, problemInfo, problemNumber, pythonFileUrl) {
    console.log('ContentComponent: HTML 파일 로드 시작:', htmlUrl);

    try {
      const response = await fetch(htmlUrl);

      if (!response.ok) {
        throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
      }

      const htmlContent = await response.text();
      console.log('ContentComponent: HTML 텍스트 로드 완료');

      // iframe에 렌더링
      this.elements.iframe.srcdoc = this.getEnhancedHtml(htmlContent);

      // 이벤트 발행 및 상태 업데이트
      this.publishProblemChangedEvent(problemNumber, pythonFileUrl);
      this.updateExplanationButton(problemInfo, problemNumber);
      this.updateProblemTitle(problemNumber);

      window.currentExamName = this.state.currentExamName;
      window.currentProblemNumber = problemNumber;

    } catch (error) {
      console.error('ContentComponent: HTML 로드 오류:', error);
      this.elements.iframe.srcdoc = this.getErrorHtml(error.message, htmlUrl);
    } finally {
      this.isLoading = false;
    }
  }

  // 🔥 NEW: 공통 이벤트 발행 로직
  publishProblemChangedEvent(problemNumber, pythonFileUrl) {
    if (window.EventBus && window.EventBus.publish) {
      const eventData = {
        examName: this.state.currentExamName,
        problemNumber: problemNumber,
        pythonFileUrl: pythonFileUrl || null
      };

      console.log('problemChanged 이벤트 발행:', eventData);
      window.EventBus.publish('problemChanged', eventData);
    }
  }

  // 🔥 NEW: 고급 스타일 마크다운용 HTML 템플릿
  // 🔥 NEW: 표준화된 마크다운용 HTML 템플릿
  getEnhancedMarkdownHtml(markdownHtml) {
    const h1Match = markdownHtml.match(/<h1[^>]*>(.*?)<\/h1>/);
    const headerTitle = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : '';

    return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <base target="_parent">
      <link rel="stylesheet" href="/css/common-content.css">
      
      <!-- Highlight.js -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

      <style>
        /* Markdown Specific Overrides for common-content.css */
        body { 
          padding: 30px 40px !important;
          max-width: 900px;
          margin: 0 auto;
        }

        /* 헤더 스타일 조정 */
        h1 { font-size: 2.2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; margin-bottom: 30px; }
        h2 { font-size: 1.8em; margin-top: 40px; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        h3 { font-size: 1.5em; margin-top: 30px; }
        
        /* 테이블 스타일 */
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; }
        th { background-color: #f8f9fa; }
        
        /* 인용구 */
        blockquote { border-left: 4px solid #0d6efd; margin: 0; padding-left: 15px; color: #555; background: #f8f9fa; padding: 10px 15px; border-radius: 4px; }
        
        /* 코드 블록 */
        pre { background: #f6f8fa; padding: 15px; border-radius: 6px; position: relative; }
        code { font-family: 'Consolas', monospace; }
        p code { background: #f0f0f0; padding: 2px 5px; border-radius: 4px; color: #d63384; }

        .copy-btn {
          position: absolute; top: 5px; right: 5px;
          background: #fff; border: 1px solid #ddd; border-radius: 4px;
          padding: 3px 8px; font-size: 12px; cursor: pointer; color: #666;
        }
        .copy-btn:hover { background: #f0f0f0; color: #333; }
      </style>
    </head>
    <body class="markdown-body">
      ${markdownHtml}
      
      <script>
        document.addEventListener("DOMContentLoaded", function () {
          if (typeof hljs !== "undefined") {
            hljs.highlightAll();
          }
          
          // 코드 복사 버튼 추가
          document.querySelectorAll('pre').forEach(pre => {
             const btn = document.createElement('button');
             btn.className = 'copy-btn';
             btn.innerText = '복사';
             btn.onclick = () => {
                const code = pre.querySelector('code');
                if(code) {
                    navigator.clipboard.writeText(code.innerText);
                    btn.innerText = '완료!';
                    setTimeout(() => btn.innerText = '복사', 2000);
                }
             };
             pre.appendChild(btn);
          });
          
          // 외부 링크 새창 열기
          document.querySelectorAll('a').forEach(a => {
            if(a.href && a.href.startsWith('http')) {
                a.target = '_blank';
            }
          });
        });
      </script>
    </body>
    </html>
    `;
  }


  showErrorInIframe(message) {
    if (!this.elements.iframe) return;

    this.elements.iframe.srcdoc = `
      <html>
        <head>
          <style>
            body {
              font-family: 'Noto Sans KR', Arial, sans-serif;
              padding: 20px;
              text-align: center;
              color: #666;
              line-height: 1.6;
            }
            .error {
              color: #dc3545;
              margin: 20px 0;
            }
            .debug-info {
              background-color: #f8f9fa;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 10px;
              margin: 20px 0;
              text-align: left;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <h3 class="error">콘텐츠를 불러올 수 없습니다</h3>
          <div class="debug-info">${message}</div>
          <p>다른 메뉴를 선택하거나 페이지를 새로고침해 주세요.</p>
        </body>
      </html>
    `;
  }

  getLoadingHtml() {
    return `
      <html>
        <head>
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              font-family: 'Noto Sans KR', Arial, sans-serif;
            }
            .loading {
              text-align: center;
            }
            .spinner {
              border: 5px solid #f3f3f3;
              border-top: 5px solid #3498db;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="loading">
            <div class="spinner"></div>
            <p>문제를 불러오는 중입니다...</p>
          </div>
        </body>
      </html>
    `;
  }

  getEnhancedHtml(originalHtml) {
    return `
      <html>
        <head>
          <base target="_parent">
          <link rel="stylesheet" href="/css/common-content.css">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Noto Sans KR', Arial, sans-serif;
              padding: 15px;
              padding-bottom: 120px !important;
              line-height: 1.6;
              color: #333;
            }
            body::after {
              content: '';
              display: block;
              height: 150px;
              width: 100%;
            }
            ::-webkit-scrollbar { width: 10px; }
            ::-webkit-scrollbar-track { background: #f1f1f1; }
            ::-webkit-scrollbar-thumb { background: #888; border-radius: 5px; }
            ::-webkit-scrollbar-thumb:hover { background: #555; }
            img { max-width: 100%; height: auto; }
            pre, code {
              background-color: #f5f5f5;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 10px;
              font-family: 'Consolas', 'Monaco', monospace;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          ${originalHtml}
        </body>
      </html>
    `;
  }

  getErrorHtml(errorMessage, url) {
    return `
      <html>
        <head>
          <style>
            body {
              font-family: 'Noto Sans KR', Arial, sans-serif;
              padding: 20px;
              text-align: center;
              color: #666;
            }
            .error { color: #dc3545; margin: 20px 0; }
            .error-details {
              background-color: #f8f9fa;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 10px;
              margin: 20px 0;
              text-align: left;
              font-family: monospace;
              max-width: 600px;
              margin: 20px auto;
            }
            button {
              background-color: #0d6efd;
              color: white;
              border: none;
              padding: 10px 15px;
              border-radius: 4px;
              cursor: pointer;
              margin: 10px;
            }
          </style>
        </head>
        <body>
          <h3 class="error">문제 콘텐츠를 불러올 수 없습니다</h3>
          <p>요청한 문제 파일을 서버에서 찾을 수 없습니다.</p>
          <div class="error-details">
            <p>오류 메시지: ${errorMessage}</p>
            <p>문제 URL: ${url}</p>
          </div>
          <div>
            <button onclick="window.parent.location.reload()">페이지 새로고침</button>
          </div>
        </body>
      </html>
    `;
  }

  // 🔥 NEW: Jupyter 오류 표시 함수
  showJupyterError(errorMessage) {
    console.log('ContentComponent: Jupyter 오류 표시:', errorMessage);

    const jupyterLoading = document.getElementById('jupyter-loading');
    const jupyterIframe = document.getElementById('jupyter-iframe');
    const jupyterError = document.getElementById('jupyter-error');
    const jupyterToolbar = document.getElementById('jupyter-toolbar');

    // 로딩 및 다른 UI 숨기기
    if (jupyterLoading) jupyterLoading.style.display = 'none';
    if (jupyterIframe) jupyterIframe.style.display = 'none';
    if (jupyterToolbar) jupyterToolbar.style.display = 'none';

    // 오류 메시지 표시
    if (jupyterError) {
      jupyterError.style.display = 'flex';

      // 오류 메시지 업데이트
      const errorContent = jupyterError.querySelector('.error-content p');
      if (errorContent) {
        errorContent.textContent = errorMessage || 'Jupyter 노트북 환경을 불러올 수 없습니다.';
      }
    }

    this.isLoading = false;
  }

  // 🔥 NEW: Jupyter 로드 재시도 함수
  retryJupyterLoad() {
    console.log('ContentComponent: Jupyter 로드 재시도');

    if (this.state.currentExamName && this.state.currentProblemNumber) {
      // 현재 문제 다시 로드
      this.loadProblem(this.state.currentProblemNumber);
    } else {
      console.warn('ContentComponent: 재시도할 문제 정보가 없습니다.');
      this.showJupyterError('재시도할 문제 정보가 없습니다.');
    }
  }

  // 🔥 NEW: 현재 노트북 다운로드 함수
  downloadCurrentNotebook() {
    console.log('ContentComponent: 노트북 다운로드 시도');

    if (!this.currentNotebookData) {
      console.warn('ContentComponent: 다운로드할 노트북 데이터가 없습니다.');
      return false;
    }

    try {
      // 다운로드 URL 생성
      const downloadUrl = `/api/jupyter/download-notebook?` + new URLSearchParams({
        examName: this.currentNotebookData.examName,
        problemNumber: this.currentNotebookData.problemNumber,
        notebookPath: this.currentNotebookData.notebookPath
      }).toString();

      // 다운로드 트리거
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${this.currentNotebookData.examName}_p${this.currentNotebookData.problemNumber.toString().padStart(2, '0')}.ipynb`;
      downloadLink.style.display = 'none';

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      console.log('ContentComponent: 노트북 다운로드 완료');
      return true;

    } catch (error) {
      console.error('ContentComponent: 노트북 다운로드 오류:', error);
      return false;
    }
  }

  /**
   * 로딩 화면 표시
   */
  showLoadingScreen() {
    if (!this.elements.iframe) {
      console.warn('ContentComponent: iframe을 찾을 수 없어 로딩 화면을 표시할 수 없습니다.');
      return;
    }

    console.log('ContentComponent: 로딩 화면 표시');
    this.elements.iframe.srcdoc = this.getLoadingHtml();

  }

  /**
   * 오류 화면 표시
   */
  showErrorScreen(message) {
    if (!this.elements.iframe) {
      console.warn('ContentComponent: iframe을 찾을 수 없어 오류 화면을 표시할 수 없습니다.');
      return;
    }

    console.error('ContentComponent: 오류 화면 표시:', message);
    this.elements.iframe.srcdoc = this.getNotFoundHtml(message);
    this.isLoading = false;
  }

  show() {
    if (this.elements.container) {
      this.elements.container.style.display = 'block';
      this.elements.container.classList.remove('component-hidden');
      this.elements.container.classList.add('component-visible');
      this.visible = true;
    }
  }

  hide() {
    if (this.elements.container) {
      this.elements.container.style.display = 'none';
      this.elements.container.classList.remove('component-visible');
      this.elements.container.classList.add('component-hidden');
      this.visible = false;
    }
  }

  onProblemChanged(examName, problemNumber) {
    if (this.state.currentExamName !== examName || this.state.currentProblemNumber !== problemNumber) {
      this.state.currentExamName = examName;
      this.state.currentProblemNumber = problemNumber;
      this.loadProblem(problemNumber);
      this.updateProblemNavigation();
    }
  }
}

// 컴포넌트 팩토리에 등록
if (window.ComponentFactory) {
  window.ComponentFactory.registerClass('content', ContentComponent);
}

// 전역 스코프에 ContentComponent 클래스 노출
window.ContentComponent = ContentComponent;