/**
 * ComponentFactory.js - 컴포넌트 생성 및 등록 관리
 */

window.ComponentFactory = {
  // 등록된 컴포넌트 클래스들
  componentClasses: {},
  
  /**
   * 컴포넌트 클래스 등록
   * @param {string} name - 컴포넌트 이름
   * @param {Function} componentClass - 컴포넌트 클래스
   */
  register: function(name, componentClass) {
    if (typeof componentClass !== 'function') {
      console.error(`ComponentFactory.register: ${name}은 함수가 아닙니다.`, componentClass);
      return false;
    }
    
    this.componentClasses[name] = componentClass;
    console.log(`ComponentFactory: '${name}' 컴포넌트 클래스 등록됨`);
    return true;
  },
  
  /**
   * 컴포넌트 클래스 등록 (별칭 메서드)
   * @param {string} name - 컴포넌트 이름
   * @param {Function} componentClass - 컴포넌트 클래스
   */
  registerClass: function(name, componentClass) {
    return this.register(name, componentClass);
  },
  
  /**
   * 컴포넌트 인스턴스 생성
   * @param {string} name - 컴포넌트 이름
   * @param {Object} options - 컴포넌트 옵션
   * @returns {Object} 컴포넌트 인스턴스
   */
  create: function(name, options = {}) {
    // 직접 등록된 클래스에서 찾기
    if (this.componentClasses[name]) {
      try {
        const ComponentClass = this.componentClasses[name];
        return new ComponentClass(options);
      } catch (error) {
        console.error(`ComponentFactory.create: '${name}' 컴포넌트 생성 실패:`, error);
        return null;
      }
    }
    
    // 글로벌 클래스 이름으로 찾기 (fallback)
    const globalClassNames = {
      'navigation': 'NavigationComponent',
      'content': 'ContentComponent', 
      'ide': 'IDEComponent',
      'quiz': 'QuizComponent',
      'pptViewer': 'PPTViewerComponent'
    };
    
    const className = globalClassNames[name];
    if (className && window[className]) {
      try {
        const ComponentClass = window[className];
        const instance = new ComponentClass(options);
        console.log(`ComponentFactory: '${name}' 컴포넌트 생성됨 (글로벌 클래스 사용)`);
        return instance;
      } catch (error) {
        console.error(`ComponentFactory.create: '${name}' 글로벌 클래스 생성 실패:`, error);
        return null;
      }
    }
    
    console.error(`ComponentFactory.create: '${name}' 컴포넌트 클래스를 찾을 수 없습니다.`);
    console.log('사용 가능한 컴포넌트:', Object.keys(this.componentClasses));
    console.log('사용 가능한 글로벌 클래스:', Object.keys(globalClassNames).filter(key => window[globalClassNames[key]]));
    
    return null;
  },
  
  /**
   * 등록된 컴포넌트 목록 반환
   * @returns {Array} 컴포넌트 이름 배열
   */
  getAvailableComponents: function() {
    return Object.keys(this.componentClasses);
  },
  
  /**
   * 사용 가능한 클래스 확인
   * @returns {Object} 클래스 정보 객체
   */
  getAvailableClasses: function() {
    const classes = {};
    
    // 등록된 클래스
    Object.keys(this.componentClasses).forEach(name => {
      classes[name] = this.componentClasses[name];
    });
    
    // 글로벌 클래스
    const globalClassNames = {
      'navigation': 'NavigationComponent',
      'content': 'ContentComponent',
      'ide': 'IDEComponent', 
      'quiz': 'QuizComponent',
      'pptViewer': 'PPTViewerComponent'
    };
    
    Object.entries(globalClassNames).forEach(([name, className]) => {
      if (window[className]) {
        classes[name] = window[className];
      }
    });
    
    return classes;
  },
  
  /**
   * 컴포넌트 클래스 존재 확인
   * @param {string} name - 컴포넌트 이름
   * @returns {boolean}
   */
  hasComponent: function(name) {
    // 직접 등록된 클래스 확인
    if (this.componentClasses[name]) {
      return true;
    }
    
    // 글로벌 클래스 확인
    const globalClassNames = {
      'navigation': 'NavigationComponent',
      'content': 'ContentComponent',
      'ide': 'IDEComponent',
      'quiz': 'QuizComponent', 
      'pptViewer': 'PPTViewerComponent'
    };
    
    const className = globalClassNames[name];
    return className && typeof window[className] === 'function';
  }
};

// 디버깅을 위한 정보 출력
console.log('ComponentFactory 초기화 완료');
console.log('ComponentFactory 메서드:', Object.keys(window.ComponentFactory));