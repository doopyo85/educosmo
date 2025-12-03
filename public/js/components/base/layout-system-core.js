/**
 * layout-system-core.js
 * 컴포넌트 기반 레이아웃 시스템의 핵심 로직
 */

// 레이아웃 타입 상수
const LAYOUT_TYPES = {
  HTML: 'html',
  IDE: 'ide',
  QUIZ: 'quiz',
  PPT: 'ppt',
  JUPYTER: 'jupyter'
};

/**
 * 레이아웃 시스템 클래스
 * 컴포넌트 관리 및 레이아웃 변경 처리
 */
class LayoutSystem {
  /**
   * 레이아웃 시스템 생성자
   */
  constructor() {
    // 상태 정보
    this.state = {
      examName: '',
      problemNumber: 1,
      totalProblems: 0,
      layoutType: LAYOUT_TYPES.HTML,
      initialized: false
    };
    
    // 데이터 저장소
    this.data = {
      processedMenuData: [],
      problemData: [],
      pageType: ''
    };
    
    // 컴포넌트 참조
    this.components = {};
    
    // 참조할 DOM 요소 선택자
    this.selectors = {
      mainArea: '.mainArea, #contentsArea'
    };
    
    // DOM 요소 참조
    this.elements = {};
  }
  
  /**
   * 레이아웃 시스템 초기화
   * @async
   */
  async init() {
    console.log('레이아웃 시스템 초기화 시작');
    
    // 페이지 타입 설정
    this.data.pageType = window.PAGE_TYPE || 'certification';
    console.log('페이지 타입:', this.data.pageType);
    
    // DOM 요소 참조 초기화
    this.initDomReferences();
    
    try {
      // 컴포넌트 레지스트리 초기화
      if (window.ComponentRegistry) {
        window.ComponentRegistry.init();
      } else {
        console.error('ComponentRegistry를 찾을 수 없습니다');
      }
      
      // 데이터 초기화
      await this.initializeData();
      
      // 컴포넌트 로드 및 등록
      await this.loadComponents();
      
      this.state.initialized = true;
      console.log('레이아웃 시스템 초기화 완료');
      
      // 초기화 완료 이벤트 발행
      window.EventBus.emit('layoutSystemInitialized', {
        pageType: this.data.pageType,
        layoutType: this.state.layoutType
      });
    } catch (error) {
      console.error('레이아웃 시스템 초기화 오류:', error);
    }
  }
  
  /**
   * DOM 요소 참조 초기화
   */
  initDomReferences() {
    for (const [key, selector] of Object.entries(this.selectors)) {
      if (selector.includes(',')) {
        // 다중 선택자 처리
        const selectors = selector.split(',').map(s => s.trim());
        for (const singleSelector of selectors) {
          const element = document.querySelector(singleSelector);
          if (element) {
            this.elements[key] = element;
            break;
          }
        }
      } else {
        // 단일 선택자 처리
        this.elements[key] = document.querySelector(selector);
      }
    }
  }
  
  /**
   * 컴포넌트 로드 및 등록
   * @async
   */
  async loadComponents() {
    try {
      // 컴포넌트 팩토리 가져오기
      const factory = window.ComponentFactory;
      if (!factory) {
        throw new Error('ComponentFactory를 찾을 수 없습니다');
      }
      
      // 공통 설정
      const config = {
        layoutSystem: this,
        pageType: this.data.pageType,
        eventBus: window.EventBus
      };
      
      // 컴포넌트 생성 및 등록
      this.registerComponent('navigation', 
        await factory.create('NavigationComponent', {
          ...config,
          menuData: this.data.processedMenuData,
          containerId: 'navList'
        })
      );
      
      this.registerComponent('content', 
        await factory.create('ContentComponent', {
          ...config,
          problemData: this.data.problemData,
          containerId: 'problem-container',
          iframeId: 'iframeContent'
        })
      );
      
      // 페이지 타입에 따라 IDE 컴포넌트 생성
      if (this.data.pageType === 'python' || this.data.pageType === 'algorithm') {
        this.registerComponent('ide', 
          await factory.create('IDEComponent', {
            ...config,
            containerId: 'ide-container',
            editorId: 'editor',
            language: 'python'
          })
        );
      }
      
      // 페이지 타입에 따라 Quiz 컴포넌트 생성
      if (this.data.pageType === 'certification') {
        this.registerComponent('quiz', 
          await factory.create('QuizComponent', {
            ...config,
            containerId: 'quiz-container'
          })
        );
      }
      
      // 페이지 타입에 따라 PPT 뷰어 컴포넌트 생성
      if (this.data.pageType === 'aiMath') {
        this.registerComponent('pptViewer', 
          await factory.create('PPTViewerComponent', {
            ...config,
            containerId: 'ppt-viewer'
          }

    // 페이지 타입에 따라 Jupyter 컴포넌트 생성
    if (this.data.pageType === 'dataAnalysis' || this.data.pageType === 'jupyter') {
      this.registerComponent('jupyter',
        await factory.create('JupyterComponent', {
          ...config,
          containerId: 'jupyter-component',
          autoInit: true,
          retryOnFail: true
        })
      );
    }
)
        );
      }
      
      console.log('컴포넌트 로드 완료');
      
      // 모든 컴포넌트 초기화
      await this.initializeComponents();
    } catch (error) {
      console.error('컴포넌트 로드 오류:', error);
      throw error;
    }
  }
  
  /**
   * 컴포넌트 등록
   * @param {string} name - 컴포넌트 이름
   * @param {Component} component - 컴포넌트 인스턴스
   */
  registerComponent(name, component) {
    if (!component) {
      console.warn(`컴포넌트 등록 실패: ${name} - 컴포넌트가 null입니다`);
      return;
    }
    
    this.components[name] = component;
    console.log(`컴포넌트 등록: ${name}`);
    
    // 컴포넌트 레지스트리에도 등록
    if (window.ComponentRegistry) {
      window.ComponentRegistry.register(component);
    }
  }
  
  /**
   * 컴포넌트 가져오기
   * @param {string} name - 컴포넌트 이름
   * @returns {Component|null} 컴포넌트 인스턴스 또는 null
   */
  getComponent(name) {
    return this.components[name] || null;
  }
  
  /**
   * 등록된 모든 컴포넌트 초기화
   * @async
   */
  async initializeComponents() {
    const componentNames = Object.keys(this.components);
    console.log(`${componentNames.length}개 컴포넌트 초기화 시작`);
    
    for (const name of componentNames) {
      const component = this.components[name];
      if (component && typeof component.init === 'function') {
        try {
          await component.init();
          console.log(`컴포넌트 초기화 완료: ${name}`);
        } catch (error) {
          console.error(`컴포넌트 초기화 오류: ${name}`, error);
        }
      }
    }
    
    // 컴포넌트 간 연결 설정
    this.connectComponents();
  }
  
  /**
   * 컴포넌트 간 연결 설정
   */
  connectComponents() {
    const navigation = this.getComponent('navigation');
    const content = this.getComponent('content');
    const ide = this.getComponent('ide');
    const quiz = this.getComponent('quiz');
    const pptViewer = this.getComponent('pptViewer');
    
    // 이벤트 리스너 설정
    if (navigation) {
      // 네비게이션 선택 변경 시
      window.EventBus.on('menuSelected', (data) => {
        this.onMenuSelect(data.examName, data.layoutType, data.pptUrl);
      });
    }
    
    // 문제 변경 이벤트 처리
    window.EventBus.on('problemChanged', (data) => {
      this.onProblemChanged(data.examName, data.problemNumber);
    });
    
    // 레이아웃 타입 변경 이벤트 처리
    window.EventBus.on('layoutTypeChanged', (data) => {
      this.onLayoutTypeChanged(data.type, data.data);
    });
  }
  
  /**
   * 데이터 초기화 함수
   * @async
   */
  async initializeData() {
    try {
      // 메뉴 데이터 로드
      const menuData = await this.fetchMenuData();
      this.data.processedMenuData = this.processMenuData(menuData);
      
      console.log('처리된 메뉴 데이터:', this.data.processedMenuData.length, '개 항목');
      
      // 문제 데이터 로드
      this.data.problemData = await this.fetchProblemData();
      console.log('문제 데이터 로드 완료:', this.data.problemData.length, '개 항목');
      
      return true;
    } catch (error) {
      console.error('데이터 초기화 오류:', error);
      return false;
    }
  }
  
  /**
   * 메뉴 데이터 가져오기
   * @async
   * @returns {Array} 메뉴 데이터 배열
   */
  async fetchMenuData() {
    try {
      const apiUrl = this.getApiEndpoint(this.data.pageType);
      console.log('메뉴 데이터 API 요청:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP 오류: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('메뉴 데이터 로드 완료:', data.length, '개 항목');
      
      return data;
    } catch (error) {
      console.error('메뉴 데이터 로드 오류:', error);
      return [];
    }
  }
  
  /**
   * 문제 데이터 가져오기
   * @async
   * @returns {Array} 문제 데이터 배열
   */
  async fetchProblemData() {
    try {
      const apiUrl = this.getProblemDataEndpoint(this.data.pageType);
      console.log('문제 데이터 API 요청:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP 오류: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('문제 데이터 로드 완료:', data.length, '개 항목');
      
      return data;
    } catch (error) {
      console.error('문제 데이터 로드 오류:', error);
      return [];
    }
  }
  
  /**
   * 메뉴 데이터 처리
   * @param {Array} data - 원본 메뉴 데이터
   * @returns {Array} 처리된 메뉴 데이터
   */
  processMenuData(data) {
    const processedMenus = [];
    
    console.log(`메뉴 데이터 처리 시작: ${data.length}개 항목`);
    
    data.forEach((row, index) => {
      if (!Array.isArray(row) || row.length < 3) {
        console.warn(`[${index}] 불완전한 메뉴 항목 무시:`, row);
        return;
      }
      
      // 구글 시트의 컬럼 구조에 맞게 데이터 추출 및 기본값 처리
      const topLevelMenu = String(row[0] || '').trim();
      const subMenu = String(row[1] || '').trim();
      let examName = String(row[2] || '').trim();
      
      // D열: URL (pptUrl)
      const pptUrl = row.length > 3 ? String(row[3] || '').trim() : '';
      
      // 상위 메뉴와 하위 메뉴는 필수
      if (!topLevelMenu || !subMenu) {
        console.warn(`[${index}] 상위/하위 메뉴 필드 누락된 항목 무시:`, row);
        return;
      }
      
      // 시험지명이 비어 있지만 PPT URL이 있는 경우 자동 생성
      if ((!examName || examName === '') && pptUrl) {
        try {
          const urlParts = pptUrl.split('/');
          const fileName = urlParts[urlParts.length - 1].split('.')[0];
          examName = fileName || `auto_generated_${index}`;
        } catch (e) {
          // URL 파싱 실패 시 인덱스 기반 고유명 생성
          examName = `${topLevelMenu.toLowerCase().replace(/\s+/g, '_')}_${index}`;
        }
      }
      
      // 자동 생성 후에도 시험지명이 없으면 건너뛰기
      if (!examName) {
        console.warn(`[${index}] 시험지명 없는 항목 무시:`, row);
        return;
      }
      
      // 기본 레이아웃 타입은 HTML
      let layoutType = LAYOUT_TYPES.HTML;
      
      // PPT URL 확인 - URL이 PDF/PPT/PPTX 확장자를 가지면 PPT 타입으로 설정
      const isPptUrl = pptUrl && (
        pptUrl.toLowerCase().endsWith('.pdf') || 
        pptUrl.toLowerCase().endsWith('.ppt') || 
        pptUrl.toLowerCase().endsWith('.pptx')
      );
      
      // E열 값 확인 (타입) - PPT 타입이 우선시됨
      if (row.length > 4 && row[4]) {
        const typeValue = String(row[4] || '').toLowerCase().trim();
        
        if (typeValue === 'ppt') {
          layoutType = LAYOUT_TYPES.PPT;
        } else if (typeValue === 'quiz') {
          layoutType = LAYOUT_TYPES.QUIZ;
        } else if (typeValue === 'ide') {
          layoutType = LAYOUT_TYPES.IDE;
        }
      }

      // URL이 PDF/PPT인 경우도 항상 PPT 타입으로 설정 (타입 설정보다 우선)
      if (isPptUrl) {
        layoutType = LAYOUT_TYPES.PPT;
      }
      
      // PPT 타입이 아닌 경우에만 페이지 타입에 따라 기본값 설정
      if (layoutType !== LAYOUT_TYPES.PPT) {
        const pageType = this.data.pageType;
        if (pageType === 'python' || pageType === 'algorithm') {
          layoutType = LAYOUT_TYPES.IDE;
        } else if (pageType === 'certification') {
          layoutType = LAYOUT_TYPES.QUIZ;
        }
      }
      
      // 메뉴 항목 추가
      processedMenus.push({
        topLevelMenu,
        subMenu,
        examName,
        pptUrl,
        layoutType
      });
    });
    
    // 메뉴 항목이 없으면 임시 메뉴 항목 생성
    if (processedMenus.length === 0) {
      console.warn('처리된 메뉴 항목이 없음. 임시 메뉴 항목 생성');
      
      const pageType = this.data.pageType;
      let defaultLayoutType = LAYOUT_TYPES.HTML;
      
      // 페이지 타입에 맞는 레이아웃 선택
      if (pageType === 'python' || pageType === 'algorithm') {
        defaultLayoutType = LAYOUT_TYPES.IDE;
      } else if (pageType === 'certification') {
        defaultLayoutType = LAYOUT_TYPES.QUIZ;
      } else if (pageType === 'aiMath') {
        defaultLayoutType = LAYOUT_TYPES.PPT;
      }
      
      // 임시 메뉴 항목 추가
      processedMenus.push({
        topLevelMenu: '기본 메뉴',
        subMenu: '임시 항목',
        examName: pageType + '_default',
        pptUrl: '',
        layoutType: defaultLayoutType
      });
    }
    
    return processedMenus;
  }
  
  /**
   * 메뉴 선택 이벤트 처리
   * @param {string} examName - 선택된 시험지명
   * @param {string} layoutType - 레이아웃 타입
   * @param {string} pptUrl - PPT URL (PPT 레이아웃인 경우)
   */
  onMenuSelect(examName, layoutType, pptUrl) {
    console.log('메뉴 선택:', examName, layoutType);
    
    // 이전 선택과 같은지 확인
    if (this.state.examName === examName) {
      console.log('이미 선택된 항목입니다.');
      return;
    }
    
    // 현재 상태 업데이트
    this.state.examName = examName;
    this.state.problemNumber = 1;
    this.state.layoutType = layoutType;
    
    // 레이아웃 클래스 업데이트
    this.updateBodyLayoutClass(layoutType);
    
    // 레이아웃 타입에 따른 컴포넌트 가시성 설정
    if (layoutType === LAYOUT_TYPES.PPT) {
      // PPT 레이아웃 적용
      this.applyPptLayout(pptUrl);
    } else {
      // 비 PPT 레이아웃 적용
      this.applyNonPptLayout(layoutType);
    }
  }
  
  /**
   * 레이아웃 타입 변경 이벤트 처리
   * @param {string} type - 레이아웃 타입
   * @param {Object} data - 추가 데이터
   */
  onLayoutTypeChanged(type, data) {
    console.log('레이아웃 타입 변경:', type, data);
    
    // 이전 선택과 같은지 확인
    if (this.state.layoutType === type && this.state.examName === data.examName) {
      console.log('이미 적용된 레이아웃입니다.');
      return;
    }
    
    // 현재 상태 업데이트
    this.state.layoutType = type;
    this.state.examName = data.examName;
    this.state.problemNumber = 1;
    
    // 레이아웃 클래스 업데이트
    this.updateBodyLayoutClass(type);
    
    // 레이아웃 타입에 따른 컴포넌트 가시성 설정
    if (type === LAYOUT_TYPES.PPT) {
      // PPT 레이아웃 적용
      this.applyPptLayout(data.pptUrl);
    } else {
      // 비 PPT 레이아웃 적용
      this.applyNonPptLayout(type);
    }
  }
  
  /**
   * 문제 변경 이벤트 처리
   * @param {string} examName - 시험지명
   * @param {number} problemNumber - 문제 번호
   */
  onProblemChanged(examName, problemNumber) {
    console.log('문제 변경:', examName, problemNumber);
    
    // 상태 업데이트
    this.state.examName = examName;
    this.state.problemNumber = problemNumber;
    
    // 모든 컴포넌트에 문제 변경 알림
    for (const name in this.components) {
      const component = this.components[name];
      if (component && typeof component.onProblemChanged === 'function') {
        component.onProblemChanged(examName, problemNumber);
      }
    }
  }
  
  /**
   * 레이아웃 클래스 업데이트
   * @param {string} layoutType - 레이아웃 타입
   */
  updateBodyLayoutClass(layoutType) {
    // 기존 레이아웃 클래스 제거
    document.body.classList.remove('layout-html', 'layout-ide', 'layout-quiz', 'layout-ppt');
    
    // 새 레이아웃 클래스 추가
    document.body.classList.add(`layout-${layoutType}`);
  }
  
  /**
   * PPT 레이아웃 적용
   * @param {string} pptUrl - PPT URL
   */
  applyPptLayout(pptUrl) {
    // PPT 뷰어 컴포넌트 가져오기
    const pptViewer = this.getComponent('pptViewer');
    
    if (pptViewer && typeof pptViewer.loadUrl === 'function') {
      pptViewer.loadUrl(pptUrl);
      pptViewer.show();
    } else {
      console.warn('PPT 뷰어 컴포넌트를 찾을 수 없습니다');
    }
    
    // 다른 컴포넌트 숨기기
    const contentComponent = this.getComponent('content');
    const ideComponent = this.getComponent('ide');
    const quizComponent = this.getComponent('quiz');
    
    if (contentComponent) contentComponent.hide();
    if (ideComponent) ideComponent.hide();
    if (quizComponent) quizComponent.hide();
  }
  
  /**
   * 비 PPT 레이아웃 적용
   * @param {string} layoutType - 레이아웃 타입
   */
  applyNonPptLayout(layoutType) {
    // PPT 뷰어 컴포넌트 숨기기
    const pptViewer = this.getComponent('pptViewer');
    if (pptViewer) pptViewer.hide();
    
    // 콘텐츠 컴포넌트 표시 (항상 표시)
    const contentComponent = this.getComponent('content');
    if (contentComponent) contentComponent.show();
    
    // 레이아웃 타입에 따른 컴포넌트 표시/숨김
    const ideComponent = this.getComponent('ide');
    const quizComponent = this.getComponent('quiz');
    
    if (layoutType === LAYOUT_TYPES.IDE) {
      // IDE 레이아웃
      if (ideComponent) ideComponent.show();
      if (quizComponent) quizComponent.hide();
    } else if (layoutType === LAYOUT_TYPES.QUIZ) {
      // 퀴즈 레이아웃
      if (ideComponent) ideComponent.hide();
      if (quizComponent) quizComponent.show();
    } else {
      // HTML 레이아웃
      if (ideComponent) ideComponent.hide();
      if (quizComponent) quizComponent.hide();
    }
  }
  
  /**
   * API 엔드포인트 가져오기
   * @param {string} type - 페이지 타입
   * @returns {string} API 엔드포인트 URL
   */
  getApiEndpoint(type) {
    const endpoints = {
      'python': '/api/sheets/menu?pageType=python',
      'algorithm': '/api/sheets/menu?pageType=algorithm',
      'aiMath': '/api/sheets/menu?pageType=aiMath',
      'certification': '/api/sheets/menu?pageType=Default',
      'default': '/api/sheets/menu'
    };
    
    return endpoints[type] || endpoints.default;
  }
  
  /**
   * 문제 데이터 엔드포인트 가져오기
   * @param {string} type - 페이지 타입
   * @returns {string} API 엔드포인트 URL
   */
  getProblemDataEndpoint(type) {
    const endpoints = {
      'python': '/api/get-python-problem-data',
      'algorithm': '/api/get-algorithm-problem-data',
      'aiMath': '/api/get-aimath-problem-data',
      'certification': '/api/get-certification-problem-data',
      'default': '/api/get-problem-data'
    };
    
    return endpoints[type] || endpoints.default;
  }
}

// 싱글톤 인스턴스 생성
window.LayoutSystem = new LayoutSystem();

// 문서 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  // 이벤트 버스 초기화 검사
  if (!window.EventBus) {
    console.error('EventBus가 초기화되지 않았습니다');
    return;
  }
  
  // 컴포넌트 레지스트리 초기화 검사
  if (!window.ComponentRegistry) {
    console.error('ComponentRegistry가 초기화되지 않았습니다');
    return;
  }
  
  // 컴포넌트 팩토리 초기화 검사
  if (!window.ComponentFactory) {
    console.error('ComponentFactory가 초기화되지 않았습니다');
    return;
  }
  
  // 레이아웃 시스템 초기화
  window.LayoutSystem.init().catch(error => {
    console.error('레이아웃 시스템 초기화 중 오류 발생:', error);
  });
});