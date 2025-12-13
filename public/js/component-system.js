/**
 * component-system.js - 표준화된 컴포넌트 시스템
 * 레이아웃 변경 로직 단순화 및 ID 참조 표준화 완료 버전
 */

// 컴포넌트 시스템 네임스페이스
window.ComponentSystem = {
  // 상태 데이터
  state: {
    initialized: false,
    pageType: 'template',
    currentLayoutType: 'html',  // html, ide, quiz, ppt
    activeComponents: [],
    dataLoaded: false,
    menuData: [],
    problemData: []
  },
  
  // 컴포넌트 참조 - ID 표준화
  components: {
    navigation: null,
    content: null,
    ide: null,
    quiz: null,
    pptViewer: null,
    explanationPopup: null
  },
  
  // 레이아웃 타입 상수
  LAYOUT_TYPES: {
    HTML: 'html',
    IDE: 'ide',
    QUIZ: 'quiz',
    PPT: 'ppt',
    JUPYTER: 'jupyter'
  },

  // API 엔드포인트 매핑
  API_ENDPOINTS: {
    // 각 페이지 타입별 메뉴 데이터 API
    menuData: {
      'python': '/api/get-python-data',
      'pythontest': '/api/get-python-data',  // 🔥 Pyodide 테스트 - python과 동일 데이터 사용
      'algorithm': '/api/get-algorithm-data',
      'aiMath': '/api/get-aimath-data',
      'dataAnalysis': '/api/get-dataanalysis-data',
      'certification': '/api/get-certification-data',
      'template': '/template/api/data'
    },
    // 문제 데이터는 공통 API 사용
    problemData: '/api/get-problem-data',
    // Python 코드 실행 API
    pythonExecution: '/api/run-python'
  },

  // 초기화
  init: async function() {
    console.log('컴포넌트 시스템 초기화 시작');
    
    try {
      // 페이지 타입 설정
      this.setPageType();
      
      // 필수 의존성 확인
      if (!this.checkDependencies()) {
        throw new Error('필수 의존성을 찾을 수 없습니다.');
      }
      
      // 컴포넌트 등록
      this.registerComponents();
      
      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 데이터 로드
      await this.loadData();
      
      // 컴포넌트 초기화
      await this.initializeComponents();
      
      // 레이아웃 시스템 설정
      this.setupLayoutSystem();
      
      // 초기화 완료 처리
      this.state.initialized = true;
      console.log('컴포넌트 시스템 초기화 완료');
      
      // 초기화 완료 이벤트 발행
      window.EventBus.publish('componentSystemInitialized', {
        pageType: this.state.pageType,
        layoutType: this.state.currentLayoutType
      });
      
      // 초기 메뉴 선택 실행
      await this.selectInitialMenu();
      
      return true;
    } catch (error) {
      console.error('컴포넌트 시스템 초기화 실패:', error);
      this.showErrorMessage('컴포넌트 시스템 초기화에 실패했습니다: ' + error.message);
      return false;
    }
  },

  // 페이지 타입 설정
  setPageType: function() {
    const getPageTypeFromURL = () => {
      const path = window.location.pathname;
      console.log('현재 URL 경로:', path);
      
      if (path.includes('/pythontest')) return 'pythontest';  // 🔥 Pyodide 테스트 페이지
      if (path.includes('/python_project')) return 'python';
      if (path.includes('/algorithm')) return 'algorithm';
      if (path.includes('/aiMath')) return 'aiMath';
      if (path.includes('/dataAnalysis')) return 'dataAnalysis';  // 🔥 추가
      if (path.includes('/certification')) return 'certification';
      return null;
    };
    
    // 페이지 타입 우선순위: URL > dataset > window > 기본값
    const urlPageType = getPageTypeFromURL();
    this.state.pageType = urlPageType || 
                          document.body.dataset.pageType || 
                          window.PAGE_TYPE || 
                          'template';
    
    console.log(`페이지 타입 설정: ${this.state.pageType}`);
    
    // HTML 요소와 동기화
    if (document.body) {
      document.body.dataset.pageType = this.state.pageType;
    }
  },

  // 필수 의존성 확인
  checkDependencies: function() {
    const required = ['EventBus', 'ComponentRegistry', 'ComponentFactory'];
    const missing = required.filter(dep => !window[dep]);
    
    if (missing.length > 0) {
      console.error('누락된 의존성:', missing);
      return false;
    }
    
    return true;
  },

// component-system.js의 registerComponents 함수를 다음으로 교체

registerComponents: function() {
  console.log('컴포넌트 등록 시작');
  
  try {
    // ComponentFactory가 있는지 확인
    if (!window.ComponentFactory) {
      console.error('ComponentFactory를 찾을 수 없습니다');
      return;
    }
    
    const componentConfigs = {
      navigation: {
        className: 'NavigationComponent',
        options: {
          elementId: 'navigation-component',
          navListId: 'navList',
          pageType: this.state.pageType
        }
      },
      content: {
        className: 'ContentComponent',
        options: {
          elementId: 'content-component',
          containerId: 'problem-container',
          iframeId: 'iframeContent',
          problemTitleId: 'problem-title',
          problemNavigationId: 'problem-navigation',
          prevButtonId: 'prev-problem',
          nextButtonId: 'next-problem'
        }
      },
      ide: {
        className: 'IDEComponent',
        options: {
          elementId: 'ide-component',
          editorId: 'editor',
          outputId: 'output-content',
          runButtonId: 'runCodeBtn',
          clearButtonId: 'clearOutputBtn'
        }
      },
      jupyter: {
        className: 'JupyterComponent',
        options: {
          elementId: 'jupyter-component',
          autoInit: true,
          retryOnFail: true
        }
      },
      quiz: {  
        className: 'QuizComponent',
        options: {
          elementId: 'quiz-component',
          quizContentId: 'quiz-content'
        }
      },
      pptViewer: {
        className: 'PPTViewerComponent',
        options: {
          elementId: 'ppt-viewer-component',
          iframeId: 'ppt-iframe',
          fullscreenButtonId: 'fullscreen-ppt-btn'
        }
      },
      explanationPopup: { 
        className: 'ExplanationPopup',
        options: {
          elementId: 'explanation-popup'
        }
      }
    };
    
    // 각 컴포넌트 등록
    Object.entries(componentConfigs).forEach(([componentName, config]) => {
      try {
        console.log(`🔧 ${componentName} 컴포넌트 등록 시도 중...`);
        
        // 클래스가 존재하는지 확인
        if (!window[config.className]) {
          console.warn(`⚠️ ${config.className} 클래스를 찾을 수 없습니다`);
          return;
        }
        
        // Jupyter 컴포넌트 사전 검증
        if (componentName === 'jupyter') {
          const elementExists = document.getElementById(config.options.elementId);
          if (!elementExists) {
            console.error(`Jupyter 컴포넌트 DOM 요소 누락: ${config.options.elementId}`);
            return;
          }
          console.log(`Jupyter DOM 요소 확인: ${config.options.elementId}`);
        }
       
        // ComponentFactory를 통해 컴포넌트 생성
        const component = window.ComponentFactory.create(componentName, config.options);
        
        if (component) {
          // 컴포넌트 저장
          this.components[componentName] = component;
          
          // ComponentRegistry에 등록
          if (window.ComponentRegistry && window.ComponentRegistry.register) {
            window.ComponentRegistry.register(componentName, component);
          }
          
          console.log(`✅ ${componentName} 컴포넌트 등록 성공`);
          
          // 🔥 추가: Jupyter 컴포넌트 자동 초기화
          if (componentName === 'jupyter' && config.options.autoInit) {
            // DOM 준비 후 자동 초기화
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                  this.initializeJupyterComponent(component);
                }, 1000);
              });
            } else {
              setTimeout(() => {
                this.initializeJupyterComponent(component);
              }, 1000);
            }
          }
        } else {
          console.error(`❌ ${componentName} 컴포넌트 생성 실패`);
        }
      } catch (error) {
        console.error(`❌ ${componentName} 컴포넌트 등록 실패:`, error);
        // 🔥 추가: JupyterComponent 실패 시 대체 처리
        if (componentName === 'jupyter') {
          console.log('🔄 JupyterComponent 등록 실패 - 대체 처리 시도');
          this.handleJupyterComponentFailure(config);
        }
      }
    });
    
    // 등록 완료 확인
    const registeredCount = Object.keys(this.components).filter(key => this.components[key]).length;
    console.log(`컴포넌트 등록 완료: ${registeredCount}개 등록됨`);
    
    // 🔥 중요: 등록된 컴포넌트 목록 출력
    console.log('등록된 컴포넌트:', Object.keys(this.components).filter(key => this.components[key]));
    
  } catch (error) {
    console.error('컴포넌트 등록 중 오류 발생:', error);
  }
},


// 수정된 JupyterComponent 초기화 메서드
initializeJupyterComponent: function(component) {
 console.log('JupyterComponent 자동 초기화 시작');
 
 if (!component) {
   console.error('JupyterComponent 인스턴스가 없음');
   return;
 }
 
 try {
   // 1. 컨테이너 참조 설정
   if (!component.elements || !component.elements.container) {
     const container = document.getElementById(component.elementId || 'jupyter-component');
     if (component.elements) {
       component.elements.container = container;
     }
     console.log('컨테이너 참조 설정:', !!container);
   }
   
   // 2. 새로운 JupyterComponent의 초기화 메서드 호출
   if (component.initializeSimpleJupyter) {
     component.initializeSimpleJupyter().then(() => {
       console.log('Jupyter 단순화 초기화 완료');
     }).catch(error => {
       console.error('Jupyter 단순화 초기화 실패:', error);
       // 재시도
       setTimeout(() => {
         if (component.forceConnect) {
           component.forceConnect();
         }
       }, 2000);
     });
   } else if (component.forceConnect) {
     // 폴백: 강제 연결 시도
     component.forceConnect().then(() => {
       console.log('Jupyter 강제 연결 완료');
     }).catch(error => {
       console.error('Jupyter 강제 연결 실패:', error);
     });
   } else {
     console.error('Jupyter 초기화 메서드를 찾을 수 없음');
   }
   
 } catch (error) {
   console.error('Jupyter 자동 초기화 중 오류:', error);
 }
},

// JupyterComponent 실패 처리
handleJupyterComponentFailure: function(config) {
  console.log('JupyterComponent 실패 처리 시작');
 
  try {
    // 대체 컴포넌트 생성 (기본 Component 상속)
    const fallbackComponent = {
      elementId: config.options.elementId,
      element: null,
      initialized: false,
      active: false,
      
      async init() {
        console.log('Jupyter 대체 컴포넌트 초기화');
        
        this.element = document.getElementById(this.elementId);
        if (this.element) {
          this.element.innerHTML = `
            <div class="jupyter-fallback-container">
              <div class="fallback-message">
                <h5><i class="bi bi-exclamation-triangle text-warning"></i> Jupyter 서비스 준비 중</h5>
                <p>Jupyter Notebook 서비스를 준비하고 있습니다. 잠시만 기다려주세요.</p>
                <button class="btn btn-primary" onclick="window.location.reload()">
                  <i class="bi bi-arrow-clockwise"></i> 새로고침
                </button>
              </div>
            </div>
          `;
          
          this.initialized = true;
          console.log('Jupyter 대체 컴포넌트 초기화 완료');
          return true;
        } else {
          console.error('Jupyter 대체 컴포넌트 DOM 요소 누락');
          return false;
        }
      },
     
      activate() {
        console.log('Jupyter 대체 컴포넌트 활성화');
        this.active = true;
        if (this.element) {
          this.element.classList.remove('component-hidden');
          this.element.classList.add('component-visible');
        }
      },
     
      deactivate() {
        console.log('Jupyter 대체 컴포넌트 비활성화');
        this.active = false;
        if (this.element) {
          this.element.classList.add('component-hidden');
          this.element.classList.remove('component-visible');
        }
      }
    };
   
    // 대체 컴포넌트 저장
    this.components.jupyter = fallbackComponent;
    
    // ComponentRegistry에 등록
    if (window.ComponentRegistry && window.ComponentRegistry.register) {
      window.ComponentRegistry.register('jupyter', fallbackComponent);
    }
   
    console.log('Jupyter 대체 컴포넌트 등록 완료');
   
  } catch (error) {
    console.error('Jupyter 대체 컴포넌트 생성 실패:', error);
  }
},

  // 데이터 로드
  loadData: async function() {
    console.log('데이터 로드 시작');
    
    try {
      // 로딩 메시지 표시
      this.showLoadingMessage('데이터를 불러오는 중...');
      
      // 메뉴 데이터와 문제 데이터를 병렬로 로드
      const [menuData, problemData] = await Promise.all([
        this.loadMenuData(),
        this.loadProblemData()
      ]);
      
      // 데이터 설정
      this.state.menuData = menuData;
      this.state.problemData = problemData;
      this.state.dataLoaded = true;
      
      // 로딩 메시지 숨기기
      this.hideLoadingMessage();
      
      console.log(`데이터 로드 완료 - 메뉴: ${menuData.length}개, 문제: ${problemData.length}개`);
      return true;
      
    } catch (error) {
      console.error('데이터 로드 중 오류 발생:', error);
      
      // 오류 시 임시 데이터 사용
      this.loadFallbackData();
      this.hideLoadingMessage();
      this.showErrorMessage('일부 데이터 로드에 실패했습니다. 임시 데이터를 사용합니다.');
      
      return false;
    }
  },

  // 메뉴 데이터 로드
  loadMenuData: async function() {
    const pageType = this.state.pageType;
    const endpoint = this.getMenuDataEndpoint();
    
    console.log(`메뉴 데이터 로드 - 페이지: ${pageType}, API: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('JSON 응답을 받지 못했습니다');
      }
      
      const result = await response.json();
      
      // 응답 형식 확인 및 데이터 추출
      if (Array.isArray(result)) {
        return result;
      } else if (result.success && Array.isArray(result.data)) {
        return result.data;
      } else {
        console.warn('예상하지 못한 응답 형식:', result);
        throw new Error('올바르지 않은 데이터 형식');
      }
      
    } catch (error) {
      console.error('메뉴 데이터 로드 오류:', error);
      throw error;
    }
  },

  // 문제 데이터 로드
  loadProblemData: async function() {
    const endpoint = this.API_ENDPOINTS.problemData;
    
    console.log(`문제 데이터 로드 - API: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (Array.isArray(result)) {
        return result;
      } else if (result.success && Array.isArray(result.data)) {
        return result.data;
      } else {
        throw new Error('올바르지 않은 문제 데이터 형식');
      }
      
    } catch (error) {
      console.error('문제 데이터 로드 오류:', error);
      throw error;
    }
  },

  // 메뉴 데이터 API 엔드포인트 결정
  getMenuDataEndpoint: function() {
    const pageType = this.state.pageType;
    const endpoint = this.API_ENDPOINTS.menuData[pageType];
    
    if (endpoint) {
      return endpoint;
    }
    
    console.warn(`페이지 타입 '${pageType}'에 대한 전용 API가 없습니다. 기본 템플릿 API를 사용합니다.`);
    return this.API_ENDPOINTS.menuData['template'] + `?pageType=${pageType}`;
  },

  // 임시 데이터 로드
  loadFallbackData: function() {
    console.log('임시 데이터 로드 중...');
    
    const fallbackMenuData = this.getFallbackMenuData();
    const fallbackProblemData = this.getFallbackProblemData();
    
    this.state.menuData = fallbackMenuData;
    this.state.problemData = fallbackProblemData;
    this.state.dataLoaded = true;
    
    console.log(`임시 데이터 로드 완료 - 메뉴: ${fallbackMenuData.length}개, 문제: ${fallbackProblemData.length}개`);
  },

  // 페이지 타입별 임시 메뉴 데이터
  getFallbackMenuData: function() {
    const pageType = this.state.pageType;
    
    const fallbackData = {
      'python': [
        ["Python 기초", "변수와 자료형", "python_basic_01", "", "ide"],
        ["Python 기초", "조건문과 반복문", "python_basic_02", "", "ide"],
        ["Python 고급", "함수와 모듈", "python_advanced_01", "", "ide"]
      ],
      'pythontest': [
        ["Pyodide 테스트", "input() 함수 테스트", "pyodide_input_test", "", "ide"],
        ["Pyodide 테스트", "기본 출력 테스트", "pyodide_print_test", "", "ide"],
        ["Pyodide 테스트", "반복문 테스트", "pyodide_loop_test", "", "ide"]
      ],
      'algorithm': [
        ["알고리즘 기초", "정렬 알고리즘", "algorithm_sort_01", "", "ide"],
        ["알고리즘 기초", "탐색 알고리즘", "algorithm_search_01", "", "ide"],
        ["자료구조", "스택과 큐", "datastructure_01", "", "ide"]
      ],
      'certification': [
        ["TCP 기출문제", "TCP 2급", "tcp_2-1", "", "quiz"],
        ["TCP 기출문제", "TCP 3급", "tcp_3-1", "", "quiz"],
        ["ITQ 한글", "기출문제 A형", "itq_hangeul_a", "", "quiz"]
      ],
      'aiMath': [
        ["AI 수학 기초", "1. 선형대수", "", "https://example.com/ai_math_01.pdf", "ppt"],
        ["AI 수학 기초", "2. 미적분학", "", "https://example.com/ai_math_02.pdf", "ppt"],
        ["AI 수학 응용", "3. 확률과 통계", "", "https://example.com/ai_math_03.pdf", "ppt"]
      ],
      'dataAnalysis': [
        ["데이터 분석 기초", "1. 데이터 수집", "", "https://example.com/data_analysis_01.pdf", "ppt"],
        ["데이터 분석 기초", "2. 데이터 정제", "", "https://example.com/data_analysis_02.pdf", "ppt"],
        ["데이터 분석 응용", "3. 시각화", "", "https://example.com/data_analysis_03.pdf", "ppt"]
      ],
      'template': [
        ["템플릿 테스트", "HTML 콘텐츠", "template_html", "", "html"],
        ["템플릿 테스트", "IDE 테스트", "template_ide", "", "ide"],
        ["템플릿 테스트", "퀴즈 테스트", "template_quiz", "", "quiz"],
        ["템플릿 테스트", "PPT 테스트", "", "https://example.com/test.pdf", "ppt"]
      ]
    };
    
    return fallbackData[pageType] || fallbackData['template'];
  },

  // 임시 문제 데이터
  getFallbackProblemData: function() {
    return [
      ["template_html_p01.html", "template_html", "p01"],
      ["template_ide_p01.html", "template_ide", "p01"],
      ["template_quiz_p01.html", "template_quiz", "p01"],
      ["python_basic_01_p01.html", "python_basic_01", "p01"],
      ["python_basic_01_p02.html", "python_basic_01", "p02"],
      ["algorithm_sort_01_p01.html", "algorithm_sort_01", "p01"],
      ["tcp_2_p01.html", "tcp_2-1", "p01"],
      ["tcp_2_p02.html", "tcp_2-1", "p02"]
    ];
  },

  // component-system.js의 initializeComponents 함수를 다음으로 교체

initializeComponents: async function() {
  console.log('컴포넌트 초기화 시작 (데이터 로드 완료 후)');
  
  try {
    // 🔥 중요: 데이터가 로드되었는지 확인
    if (!this.state.dataLoaded) {
      console.error('데이터 로드가 완료되지 않아 컴포넌트 초기화를 중단합니다.');
      return false;
    }
    
    console.log('사용 가능한 데이터:', {
      menuData: this.state.menuData.length,
      problemData: this.state.problemData.length
    });
    
    // 네비게이션 컴포넌트 초기화 - 메뉴 데이터 전달
    if (this.components.navigation) {
      console.log('네비게이션 컴포넌트 초기화 중...');
      
      // 🔥 수정: 메뉴 데이터 처리 후 전달
      const processedMenuData = this.processMenuData(this.state.menuData);
      console.log('처리된 메뉴 데이터:', processedMenuData.length, '개 항목');
      console.log('첫 번째 메뉴 항목:', processedMenuData[0]);
      
      // 네비게이션 컴포넌트에 데이터 설정
      if (this.components.navigation.setMenuData) {
        this.components.navigation.setMenuData(processedMenuData);
      }
      
      await this.components.navigation.init(processedMenuData);
    } else {
      console.warn('네비게이션 컴포넌트가 등록되지 않았습니다.');
    }
    
    // 콘텐츠 컴포넌트 초기화 - 문제 데이터 전달
    if (this.components.content) {
      console.log('콘텐츠 컴포넌트 초기화 중...');
      
      // 🔥 중요: 문제 데이터를 확실히 설정
      if (!this.components.content.state) {
        this.components.content.state = {};
      }
      
      this.components.content.state.problemData = this.state.problemData;
      console.log('콘텐츠 컴포넌트에 문제 데이터 설정:', this.state.problemData.length, '개 항목');
      
      await this.components.content.init();
    } else {
      console.warn('콘텐츠 컴포넌트가 등록되지 않았습니다.');
    }
    
    // IDE 컴포넌트 초기화
    if (this.components.ide) {
      console.log('IDE 컴포넌트 초기화 중...');
      await this.components.ide.init();
      
      // 🔥 pythontest 페이지에서는 PyodideTerminal 사용
      if (this.state.pageType === 'pythontest' && window.PyodideTerminal) {
        console.log('🐍 Pyodide 터미널로 교체 중...');
        
        // 기존 Terminal 모듈 비활성화
        if (this.components.ide.modules && this.components.ide.modules.terminal) {
          if (this.components.ide.modules.terminal.destroy) {
            this.components.ide.modules.terminal.destroy();
          }
        }
        
        // PyodideTerminal로 교체
        const pyodideTerminal = new window.PyodideTerminal({
          outputId: 'output-content',
          runButtonId: 'runCodeBtn',
          clearButtonId: 'clearOutputBtn'
        });
        
        await pyodideTerminal.init();
        
        // IDE 컴포넌트의 terminal 모듈 교체
        if (this.components.ide.modules) {
          this.components.ide.modules.terminal = pyodideTerminal;
        }
        
        console.log('✅ Pyodide 터미널 교체 완료');
      }
    } else {
      console.warn('IDE 컴포넌트가 등록되지 않았습니다.');
    }
    
    // 퀴즈 컴포넌트 초기화
    if (this.components.quiz) {
      console.log('퀴즈 컴포넌트 초기화 중...');
      // 퀴즈 컴포넌트에 문제 데이터 전달
      if (!this.components.quiz.state) {
        this.components.quiz.state = {};
      }
    }

    // PPT 뷰어 컴포넌트 초기화
    if (this.components.pptViewer) {
      console.log('PPT 뷰어 컴포넌트 초기화 중...');
      await this.components.pptViewer.init();
    } else {
      console.warn('PPT 뷰어 컴포넌트가 등록되지 않았습니다.');
    }
    
    // 🔥 추가: ExplanationPopup 컴포넌트 초기화
    if (this.components.explanationPopup) {
      console.log('ExplanationPopup 컴포넌트 초기화 중...');
      await this.components.explanationPopup.init();
    } else {
      console.warn('ExplanationPopup 컴포넌트가 등록되지 않았습니다.');
    }
    
    console.log('컴포넌트 초기화 완료');
    return true;
  } catch (error) {
    console.error('컴포넌트 초기화 중 오류 발생:', error);
    return false;
  }
},

  // 레이아웃 시스템 설정
  setupLayoutSystem: function() {
    console.log('레이아웃 시스템 설정 시작');
    
    // 페이지 타입별 기본 레이아웃 설정
    const defaultLayouts = {
      'python': 'ide',
      'pythontest': 'ide',  // 🔥 Pyodide 테스트 페이지
      'algorithm': 'ide',
      'certification': 'quiz',
      'aiMath': 'html',
      'dataAnalysis': 'html',
      'template': 'html'
    };
    
    const defaultLayout = defaultLayouts[this.state.pageType] || 'html';
    this.state.currentLayoutType = defaultLayout;
    
    // 초기 레이아웃 적용
    this.applyLayout(defaultLayout);
    
    console.log(`레이아웃 시스템 설정 완료 - 기본 레이아웃: ${defaultLayout}`);
  },

applyLayout: function(layoutType) {
    console.log(`레이아웃 적용: ${layoutType} (강제 적용)`);
    
    if (!this.LAYOUT_TYPES.hasOwnProperty(layoutType.toUpperCase())) {
        console.error(`알 수 없는 레이아웃 타입: ${layoutType}`);
        return;
    }
    
    // 🔥 수정: 중복 체크 제거, 항상 DOM 조작 수행
    
    // 이전 레이아웃 클래스 제거
    Object.values(this.LAYOUT_TYPES).forEach(type => {
        document.body.classList.remove(`layout-${type}`);
    });
    
    // 새 레이아웃 클래스 추가
    document.body.classList.add(`layout-${layoutType}`);
    console.log(`Body 클래스 적용됨: layout-${layoutType}`);
    
    // 상태 업데이트
    this.state.currentLayoutType = layoutType;
    
    // 🔥 추가: DOM 강제 표시
    this.forceShowComponents(layoutType);
    
    // 컴포넌트 활성화
    this.activateComponents(layoutType);
    
    // 🔥 추가: 레이아웃 적용 확인
    this.verifyLayoutApplication(layoutType);
},

activateComponents: function(layoutType) {
    // 레이아웃별 활성 컴포넌트 정의
    const activeComponents = {
        'html': ['navigation', 'content'],
        'ide': ['navigation', 'content', 'ide'],  
        'quiz': ['navigation', 'content', 'quiz'], 
        'ppt': ['navigation', 'pptViewer'],         
        'jupyter': ['navigation', 'content', 'jupyter']
    };

    
    const componentsToActivate = activeComponents[layoutType] || ['content'];
    
    console.log(`활성화할 컴포넌트: ${componentsToActivate.join(', ')}`);
    
     // 🔥 수정: 네비게이션은 절대 숨기지 않음
    Object.keys(this.components).forEach(name => {
        if (name === 'navigation') {
            // 네비게이션은 항상 표시 상태 유지
            const element = document.getElementById(`${name}-component`);
            if (element) {
                element.classList.remove('component-hidden');
                element.classList.add('component-visible');
            }
            return; // 네비게이션은 비활성화하지 않음
        }
        
        const element = document.getElementById(`${name}-component`);
        if (element) {
            element.classList.add('component-hidden');
            element.classList.remove('component-visible');
        }
        
        if (this.components[name] && this.components[name].deactivate) {
            this.components[name].deactivate();
        }
    });
    
     // 지정된 컴포넌트만 강제 표시
    componentsToActivate.forEach(name => {
        const element = document.getElementById(`${name}-component`);
        if (element) {
            element.classList.remove('component-hidden');
            element.classList.add('component-visible');
            console.log(`컴포넌트 DOM 표시: ${name}`);
        }
        
        if (this.components[name] && this.components[name].activate) {
            this.components[name].activate();
            console.log(`컴포넌트 활성화: ${name}`);
        }
    });
    
    // IDE 레이아웃인 경우 에디터 리사이즈 및 Gutter 수정
    if (layoutType === 'ide' && this.components.ide && this.components.ide.resizeEditor) {
        setTimeout(() => {
            this.components.ide.resizeEditor();
            // 🔥 추가: Gutter 강제 표시
            if (this.components.ide.forceShowGutter) {
                this.components.ide.forceShowGutter();
            }
            console.log('IDE 에디터 리사이즈 완료');
        }, 200); // 지연시간 증가
    }

     // 🔥 추가: 퀴즈 레이아웃인 경우 퀴즈 활성화
    if (layoutType === 'quiz' && this.components.quiz) {
      setTimeout(() => {
        // 현재 선택된 문제가 있으면 퀴즈 로드
        const currentExamName = window.currentExamName;
        const currentProblemNumber = window.currentProblemNumber;
        
        if (currentExamName && currentProblemNumber && this.components.quiz.loadQuizForProblem) {
          console.log('퀴즈 레이아웃 활성화 - 현재 문제 로드:', currentExamName, currentProblemNumber);
          this.components.quiz.loadQuizForProblem(currentExamName, currentProblemNumber);
        }
      }, 100);
    }
  },

// 🔥 추가: DOM 강제 표시 함수
forceShowComponents: function(layoutType) {
    console.log(`DOM 강제 표시 시작: ${layoutType}`);
    
    if (layoutType === 'ide') {
        const ideElement = document.getElementById('ide-component');
        if (ideElement) {
            // CSS 클래스로 강제 표시
            ideElement.style.display = 'flex';
            ideElement.style.visibility = 'visible';
            ideElement.style.opacity = '1';
            console.log('IDE 컴포넌트 DOM 강제 표시 완료');
        } else {
            console.error('IDE 컴포넌트 DOM 요소를 찾을 수 없음');
        }
    }
},

// 🔥 추가: 레이아웃 적용 확인 함수
verifyLayoutApplication: function(layoutType) {
    console.log(`레이아웃 적용 확인: ${layoutType}`);
    
    // Body 클래스 확인
    const hasLayoutClass = document.body.classList.contains(`layout-${layoutType}`);
    console.log(`Body layout-${layoutType} 클래스 적용됨: ${hasLayoutClass}`);
    
    // IDE 컴포넌트 가시성 확인
    if (layoutType === 'ide') {
        const ideElement = document.getElementById('ide-component');
        if (ideElement) {
            const computedStyle = window.getComputedStyle(ideElement);
            console.log('IDE 컴포넌트 상태:', {
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                opacity: computedStyle.opacity,
                classes: Array.from(ideElement.classList)
            });
        }
    }
},

  // 이벤트 리스너 설정
  setupEventListeners: function() {
    console.log('이벤트 리스너 설정 시작');
    
    // 메뉴 선택 이벤트
    window.EventBus.subscribe('menuSelected', this.handleMenuSelected.bind(this));
    
    // 레이아웃 변경 이벤트
    window.EventBus.subscribe('layoutChanged', this.handleLayoutChanged.bind(this));
    
    // 문제 변경 이벤트
    window.EventBus.subscribe('problemChanged', this.handleProblemChanged.bind(this));
    
    // 🔥 추가: 토글 버튼 이벤트 리스너
    this.setupToggleButton();
    
    // 🔥 추가: 폰트사이즈 조절 버튼 이벤트 리스너
    this.setupFontSizeControls();
    
    console.log('이벤트 리스너 설정 완료');
  },

handleMenuSelected: function(data) {
    console.log('메뉴 선택 이벤트 처리:', data);
    
    if (!data || !data.examName) {
        console.error('유효하지 않은 메뉴 선택 데이터:', data);
        return;
    }
    
    const layoutType = data.layoutType || 'html';
    console.log(`메뉴 처리: ${data.examName} (레이아웃: ${layoutType})`);
    
    // 🔥 NEW: 현재 메뉴 데이터 저장
    this.state.currentMenuData = data;
    console.log('ComponentSystem: 현재 메뉴 데이터 저장:', data);
    
    // 레이아웃 적용
    this.applyLayout(layoutType);
    
    // 🔥 추가: ContentComponent에 examName 전달 및 문제 로드
    if (this.components.content) {
        if (!this.components.content.state) {
            this.components.content.state = {};
        }
        
        // 현재 시험명 설정
        this.components.content.state.currentExamName = data.examName;
        console.log(`ContentComponent에 examName 설정: ${data.examName}`);
        
        // 🔥 중요: 문제 개수 업데이트 및 첫 번째 문제 로드
        if (this.components.content.updateProblemCount) {
            this.components.content.updateProblemCount();
        }
        
        // 첫 번째 문제 로드
        if (this.components.content.loadProblem) {
            this.components.content.loadProblem(1);
            console.log(`첫 번째 문제 로드 요청: ${data.examName}`);
        }
        
        // 문제 제목 업데이트
        if (this.components.content.updateProblemTitle) {
            this.components.content.updateProblemTitle(1);
        }
    }
    
    // PPT URL이 있고 레이아웃이 PPT인 경우
    if (layoutType === 'ppt' && data.pptUrl && this.components.pptViewer) {
        if (this.components.pptViewer.loadPPT) {
            this.components.pptViewer.loadPPT(data.pptUrl);
        }
    }
    // 🔥 추가: 퀴즈 레이아웃인 경우
    else if (layoutType === 'quiz' && this.components.quiz) {
      console.log('퀴즈 메뉴 선택됨:', data.examName);
      if (this.components.quiz.loadQuizForExam) {
        this.components.quiz.loadQuizForExam(data.examName);
      }
    }
    
    // 전역 변수 업데이트 (하위 호환성)
    window.currentExamName = data.examName;
    window.currentLayoutType = layoutType;
},

// 레이아웃 변경 이벤트 핸들러
  handleLayoutChanged: function(data) {
    console.log('레이아웃 변경 이벤트 처리:', data);
    
    // 추가 처리가 필요한 경우 여기에 구현
  },

// 🔥 수정: 문제 변경 이벤트 핸들러 - 호출 제한 추가
handleProblemChanged: function(data) {
  console.log('문제 변경 이벤트 처리:', data);
  
  // 🔥 추가: 호출 횟수 제한 (무한 루프 방지)
  if (!this.problemChangeCount) this.problemChangeCount = 0;
  if (!this.lastProblemChangeTime) this.lastProblemChangeTime = 0;
  
  const now = Date.now();
  if (now - this.lastProblemChangeTime < 100) { // 100ms 내 중복 호출 방지
    console.log('문제 변경 이벤트 중복 호출 방지');
    return;
  }
  
  this.problemChangeCount++;
  this.lastProblemChangeTime = now;
  
  if (this.problemChangeCount > 10) {
    console.error('문제 변경 이벤트 과다 호출 감지 - 차단');
    this.problemChangeCount = 0; // 리셋
    return;
  }
  
  if (!data || !data.examName || !data.problemNumber) {
    console.error('유효하지 않은 문제 변경 데이터:', data);
    return;
  }
  
  // 🔥 추가: pythonFileUrl 정보 추출
  const pythonFileUrl = data.pythonFileUrl || null;
  console.log('Python 파일 URL:', pythonFileUrl ? '있음' : '없음');
  
  // IDE 컴포넌트에 직접 전달 (활성화 상태일 때만)
  if (this.components.ide && this.components.ide.active && this.components.ide.onProblemChanged) {
    this.components.ide.onProblemChanged(data.examName, data.problemNumber, pythonFileUrl);
  }
  
  // 전역 변수 업데이트 (하위 호환성)
  window.currentExamName = data.examName;
  window.currentProblemNumber = data.problemNumber;
  
  // 🔥 수정: problemLoaded 이벤트는 발행하지 않음 (무한 루프 방지)
  // window.EventBus.publish('problemLoaded', {...}); // 제거
},

// 초기 메뉴 선택
  selectInitialMenu: async function() {
    console.log('초기 메뉴 선택 시작');
    
    try {
      const processedMenuData = this.processMenuData(this.state.menuData);
      
      if (processedMenuData.length === 0) {
        console.warn('선택할 메뉴 항목이 없습니다.');
        return;
      }
      
      // 페이지 타입에 맞는 첫 번째 항목 찾기
      let selectedItem = null;
      
      // 페이지 타입별 선호 레이아웃
      const preferredLayouts = {
        'python': 'ide',
        'algorithm': 'ide',
        'certification': 'quiz',
        'aiMath': 'ppt',
        'dataAnalysis': 'ppt'  
      };
      
      const preferredLayout = preferredLayouts[this.state.pageType];
      
      if (preferredLayout) {
        selectedItem = processedMenuData.find(item => 
          item.layoutType === preferredLayout
        );
      }
      
      // 찾지 못하면 첫 번째 항목 선택
      if (!selectedItem) {
        selectedItem = processedMenuData[0];
      }
      
      console.log('초기 선택된 메뉴 항목:', selectedItem.subMenu);
      
      // 메뉴 선택 이벤트 발행
      setTimeout(() => {
        window.EventBus.publish('menuSelected', {
          examName: selectedItem.examName,
          layoutType: selectedItem.layoutType,
          pptUrl: selectedItem.pptUrl || ''
        });
      }, 200);
      
    } catch (error) {
      console.error('초기 메뉴 선택 중 오류:', error);
    }
  },

 // component-system.js의 processMenuData 함수를 다음으로 교체

processMenuData: function(data) {
  console.log('메뉴 데이터 처리 시작:', data);
  var processedMenus = [];
  
  if (!Array.isArray(data)) {
    console.error('유효하지 않은 메뉴 데이터입니다:', typeof data, data);
    return processedMenus;
  }
  
  console.log('원본 메뉴 데이터 첫 3개 항목:', data.slice(0, 3));
  
  // 구글 시트에서 가져온 데이터 처리
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    
    if (!Array.isArray(row) || row.length < 3) {
      console.warn(`행 ${i} 건너뜀 - 유효하지 않은 데이터:`, row);
      continue;
    }
    
    var topLevelMenu = String(row[0] || '').trim();
    var subMenu = String(row[1] || '').trim();
    var examName = String(row[2] || '').trim();
    
    console.log(`행 ${i} 처리:`, {
      topLevelMenu, 
      subMenu, 
      examName,
      rawRow: row
    });
    
    // 상위 메뉴나 하위 메뉴가 비어있으면 건너뛰기
    if (!topLevelMenu || !subMenu) {
      console.warn(`행 ${i} 건너뜀 - 필수 필드 누락:`, {topLevelMenu, subMenu});
      continue;
    }
    
    // 시험명이 비어있으면 하위 메뉴를 사용
    if (!examName) {
      examName = subMenu.toLowerCase().replace(/\s+/g, '_');
      console.log(`행 ${i} - examName 자동 생성:`, examName);
    }
    
    // PPT URL 확인
    var pptUrl = row.length > 3 ? String(row[3] || '').trim() : '';
    
    // 레이아웃 타입 결정
    var layoutType = 'html';  // 기본값
    
    // 레이아웃 타입 필드 확인 (5번째 컬럼)
    if (row.length > 4 && row[4]) {
      var typeValue = String(row[4]).toLowerCase().trim();
      if (['html', 'ide', 'quiz', 'ppt', 'jupyter'].includes(typeValue)) {
        layoutType = typeValue;
      }
    }
    
    // PPT URL이 있으면 PPT 타입으로 설정
    if (pptUrl) {
      var isPptUrl = false;
      var extensions = ['pdf', 'ppt', 'pptx'];
      for (var j = 0; j < extensions.length; j++) {
        var ext = '.' + extensions[j];
        if (pptUrl.toLowerCase().endsWith(ext)) {
          isPptUrl = true;
          break;
        }
      }
      
      if (isPptUrl) {
        layoutType = 'ppt';
        console.log(`행 ${i} - PPT URL 감지, 레이아웃 타입 변경:`, layoutType);
      }
    }
    
    // 메뉴 항목 추가
    var menuItem = {
      topLevelMenu: topLevelMenu,
      subMenu: subMenu,
      examName: examName,
      pptUrl: pptUrl,
      layoutType: layoutType
    };
    
    processedMenus.push(menuItem);
    console.log(`행 ${i} 처리 완료:`, menuItem);
  }
  
  console.log('메뉴 데이터 처리 완료:', processedMenus.length, '개 항목');
  console.log('처리된 메뉴 항목들:', processedMenus);
  
  return processedMenus;
},

  // PPT URL 확인
  isPptUrl: function(url) {
    const pptExtensions = ['pdf', 'ppt', 'pptx'];
    return pptExtensions.some(ext => url.toLowerCase().endsWith('.' + ext));
  },

  // 메시지 표시 함수들
  showLoadingMessage: function(message) {
    if (typeof window.showSystemMessage === 'function') {
      window.showSystemMessage(message, 'info');
    } else {
      console.log('로딩:', message);
    }
  },

  hideLoadingMessage: function() {
    // 로딩 메시지는 자동으로 사라지도록 구현됨
  },

  showErrorMessage: function(message) {
    if (typeof window.showSystemMessage === 'function') {
      window.showSystemMessage(message, 'warning');
    } else {
      console.warn('오류:', message);
    }
  },

  // 🔥 추가: 토글 버튼 설정
  setupToggleButton: function() {
    console.log('토글 버튼 설정 시작');
    
    const toggleBtn = document.getElementById('layout-toggle-btn');
    const toggleIcon = document.getElementById('layout-toggle-icon');
    
    if (!toggleBtn || !toggleIcon) {
      console.warn('토글 버튼 요소들을 찾을 수 없습니다.');
      return;
    }
    
    // 초기 상태 설정
    this.updateToggleButtonState(toggleIcon, null);
    
    // 클릭 이벤트
    toggleBtn.addEventListener('click', () => {
      console.log('토글 버튼 클릭 이벤트');
      this.toggleLayout();
      // 버튼 상태 업데이트
      setTimeout(() => {
        this.updateToggleButtonState(toggleIcon, null);
      }, 100);
    });
    
    console.log('토글 버튼 설정 완료');
  },

  // 🔥 추가: 레이아웃 토글 기능
  toggleLayout: function() {
    const currentLayout = this.state.currentLayoutType;
    console.log('현재 레이아웃:', currentLayout);
    
    let newLayout;
    
    // 현재 레이아웃에 따라 전환
    if (currentLayout === 'html') {
      newLayout = 'ide';
    } else if (currentLayout === 'ide') {
      newLayout = 'html';
    } else {
      // quiz, ppt 등에서는 html로 전환
      newLayout = 'html';
    }
    
    console.log('레이아웃 전환:', currentLayout, '->', newLayout);
    
    // 레이아웃 적용
    this.applyLayout(newLayout);
    
    // 토글 버튼 UI 업데이트
    const toggleIcon = document.getElementById('layout-toggle-icon');
    const toggleText = document.getElementById('layout-toggle-text');
    this.updateToggleButtonState(toggleIcon, toggleText);
  },

  // 🔥 추가: 토글 버튼 상태 업데이트
  updateToggleButtonState: function(toggleIcon, toggleText) {
    const currentLayout = this.state.currentLayoutType;
    const toggleIconAlt = document.getElementById('layout-toggle-icon-alt');
    
    if (currentLayout === 'html') {
      // IDE 숨김 상태 - 펼치기 아이콘 표시 (->|)
      if (toggleIcon) {
        toggleIcon.className = 'bi bi-chevron-bar-right';
        toggleIcon.style.display = 'inline-block';
      }
      if (toggleIconAlt) {
        toggleIconAlt.style.display = 'none';
      }
    } else if (currentLayout === 'ide') {
      // IDE 표시 상태 - 접기 아이콘 표시 (|<-)
      if (toggleIcon) {
        toggleIcon.style.display = 'none';
      }
      if (toggleIconAlt) {
        toggleIconAlt.className = 'bi bi-chevron-bar-left';
        toggleIconAlt.style.display = 'inline-block';
      }
    } else {
      // 기타 레이아웃에서는 펼치기 아이콘 (->|)
      if (toggleIcon) {
        toggleIcon.className = 'bi bi-chevron-bar-right';
        toggleIcon.style.display = 'inline-block';
      }
      if (toggleIconAlt) {
        toggleIconAlt.style.display = 'none';
      }
    }
  },

  // 🔥 추가: 폰트사이즈 조절 기능 설정
  setupFontSizeControls: function() {
    console.log('폰트사이즈 조절 기능 설정 시작');
    
    // 콘텐츠 폰트사이즈 조절
    const contentDecrease = document.getElementById('content-font-decrease');
    const contentIncrease = document.getElementById('content-font-increase');
    const contentDisplay = document.getElementById('content-font-size-display');
    
    if (contentDecrease && contentIncrease && contentDisplay) {
      this.setupContentFontSizeControls(contentDecrease, contentIncrease, contentDisplay);
    } else {
      console.warn('콘텐츠 폰트사이즈 조절 버튼을 찾을 수 없습니다.');
    }
    
    console.log('폰트사이즈 조절 기능 설정 완료');
  },

  // 🔥 추가: 콘텐츠 폰트사이즈 조절
  setupContentFontSizeControls: function(decreaseBtn, increaseBtn, displaySpan) {
    let currentFontSize = 16; // 기본 폰트 사이즈
    const minFontSize = 12;
    const maxFontSize = 24;
    
    // 폰트사이즈 표시 업데이트
    const updateDisplay = () => {
      displaySpan.textContent = currentFontSize + 'px';
    };
    
    // 폰트사이즈 적용
    const applyFontSize = () => {
      const iframe = document.getElementById('iframeContent');
      if (iframe && iframe.contentDocument) {
        try {
          const iframeBody = iframe.contentDocument.body;
          if (iframeBody) {
            iframeBody.style.fontSize = currentFontSize + 'px';
            console.log('콘텐츠 폰트사이즈 적용:', currentFontSize + 'px');
          }
        } catch (error) {
          console.error('콘텐츠 폰트사이즈 적용 오류:', error);
        }
      }
    };
    
    // 감소 버튼 이벤트
    decreaseBtn.addEventListener('click', () => {
      if (currentFontSize > minFontSize) {
        currentFontSize -= 1;
        updateDisplay();
        applyFontSize();
      }
    });
    
    // 증가 버튼 이벤트
    increaseBtn.addEventListener('click', () => {
      if (currentFontSize < maxFontSize) {
        currentFontSize += 1;
        updateDisplay();
        applyFontSize();
      }
    });
    
    // 초기 표시 설정
    updateDisplay();
    
    // iframe 로드 완료 시 폰트사이즈 적용
    const iframe = document.getElementById('iframeContent');
    if (iframe) {
      iframe.addEventListener('load', () => {
        setTimeout(() => {
          applyFontSize();
        }, 100);
      });
    }
  }
};

// 기본 컴포넌트 클래스 폴백
if (!window.Component) {
  class Component {
    constructor(options = {}) {
      this.options = options;
      this.elementId = options.elementId;
      this.element = null;
      this.initialized = false;
    }
    
    async init() {
      this.element = document.getElementById(this.elementId);
      this.initialized = true;
      return true;
    }
    
    activate() {
      console.log(`${this.elementId} 컴포넌트 활성화`);
    }
    
    deactivate() {
      console.log(`${this.elementId} 컴포넌트 비활성화`);
    }
  }
  
  window.Component = Component;
}

// 컴포넌트 레지스트리 폴백
if (!window.ComponentRegistry) {
  window.ComponentRegistry = {
    components: {},
    
    register: function(name, component) {
      this.components[name] = component;
      return component;
    },
    
    get: function(name) {
      return this.components[name];
    },
    
    getAll: function() {
      return this.components;
    }
  };
}

// 이벤트 버스 폴백
if (!window.EventBus) {
  window.EventBus = {
    events: {},
    
    subscribe: function(event, callback) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(callback);
      return () => {
        this.events[event] = this.events[event].filter(cb => cb !== callback);
      };
    },
    
    publish: function(event, data) {
      if (!this.events[event]) return;
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`'${event}' 이벤트 처리 중 오류:`, error);
        }
      });
    }
  };
}

// ComponentFactory 폴백
if (!window.ComponentFactory) {
  window.ComponentFactory = {
    components: {},
    
    register: function(name, componentClass) {
      this.components[name] = componentClass;
    },
    
    create: function(name, options) {
      // 🔥 추가: JupyterComponent 예외 처리
      if (name === 'jupyter') {
        try {
          const JupyterComponentClass = window.JupyterComponent;
          if (JupyterComponentClass) {
            console.log('📱 JupyterComponent 생성 시도');
            return new JupyterComponentClass(options);
          } else {
            console.error('❌ JupyterComponent 클래스를 찾을 수 없음');
            return null;
          }
        } catch (error) {
          console.error('❌ JupyterComponent 생성 실패:', error);
          return null;
        }
      }
      
      // 기본 컴포넌트 처리
      const ComponentClass = this.components[name] || window[name] || window[name + 'Component'];
      if (!ComponentClass) {
        console.error(`컴포넌트 '${name}'을 찾을 수 없습니다.`);
        return null;
      }
      return new ComponentClass(options);
    },
    
    hasComponent: function(name) {
      return !!this.components[name] || !!window[name] || !!window[name + 'Component'];
    },
    
    getAvailableComponents: function() {
      return Object.keys(this.components);
    }
  };
}

// 문서 로드 완료 시 컴포넌트 시스템 초기화
document.addEventListener('DOMContentLoaded', function() {
  // 약간의 지연 후 초기화 (다른 스크립트가 로드될 시간 확보)
  setTimeout(() => {
    if (window.ComponentSystem) {
      window.ComponentSystem.init().catch(error => {
        console.error('컴포넌트 시스템 초기화 실패:', error);
        if (typeof window.showSystemMessage === 'function') {
          window.showSystemMessage('컴포넌트 시스템 초기화에 실패했습니다.', 'danger');
        }
      });
    } else {
      console.error('ComponentSystem을 찾을 수 없습니다!');
    }
  }, 100);
});