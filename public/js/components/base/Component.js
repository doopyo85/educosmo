/**
 * Component.js - 기본 컴포넌트 클래스
 * 모든 컴포넌트의 기본이 되는 클래스입니다.
 */

class Component {
  /**
   * 컴포넌트 생성자
   * @param {Object} options - 컴포넌트 옵션
   * @param {String} options.elementId - 컴포넌트 루트 요소 ID
   */
  constructor(options = {}) {
    this.options = options || {};
    this.elementId = options.elementId;
    this.element = null;
    this.initialized = false;
    this.active = false;
    this.data = {};
  }
  
  /**
   * 컴포넌트 초기화
   * @param {*} data - 컴포넌트에 전달할 초기 데이터
   * @returns {Promise<Boolean>} - 초기화 성공 여부
   */
  async init(data = null) {
    console.log(`${this.constructor.name} 초기화 시작`);
    
    // 루트 요소 참조 가져오기
    this.element = document.getElementById(this.elementId);
    
    if (!this.element) {
      console.error(`${this.constructor.name}: 요소를 찾을 수 없습니다. (ID: ${this.elementId})`);
      return false;
    }
    
    // 데이터 저장
    if (data) {
      this.data = data;
    }
    
    // 이벤트 리스너 설정
    this.setupEventListeners();
    
    // 초기화 완료
    this.initialized = true;
    console.log(`${this.constructor.name} 초기화 완료`);
    
    return true;
  }
  
  /**
   * 이벤트 리스너 설정 (하위 클래스에서 재정의)
   */
  setupEventListeners() {
    // 기본 구현은 비어있음 (하위 클래스에서 구현)
  }
  
  /**
   * 컴포넌트 활성화
   */
  activate() {
    if (!this.initialized) {
      console.warn(`${this.constructor.name}: 초기화되지 않은 컴포넌트를 활성화할 수 없습니다.`);
      return;
    }
    
    this.active = true;
    
    // 활성화 이벤트 발행
    window.EventBus.publish('componentActivated', {
      component: this.constructor.name,
      elementId: this.elementId
    });
    
    console.log(`${this.constructor.name} 활성화됨`);
  }
  
  /**
   * 컴포넌트 비활성화
   */
  deactivate() {
    if (!this.initialized) {
      console.warn(`${this.constructor.name}: 초기화되지 않은 컴포넌트를 비활성화할 수 없습니다.`);
      return;
    }
    
    this.active = false;
    
    // 비활성화 이벤트 발행
    window.EventBus.publish('componentDeactivated', {
      component: this.constructor.name,
      elementId: this.elementId
    });
    
    console.log(`${this.constructor.name} 비활성화됨`);
  }
  
  /**
   * 요소 참조 가져오기
   * @param {String} id - 요소 ID
   * @returns {HTMLElement|null} - HTML 요소 또는 null
   */
  getElement(id) {
    return document.getElementById(id);
  }
  
  /**
   * 오류 처리
   * @param {Error} error - 오류 객체
   * @param {String} context - 오류 컨텍스트
   */
  handleError(error, context = '') {
    const errorMessage = `${this.constructor.name} 오류${context ? ` (${context})` : ''}: ${error.message}`;
    console.error(errorMessage, error);
    
    // 오류 이벤트 발행
    window.EventBus.publish('componentError', {
      component: this.constructor.name,
      elementId: this.elementId,
      error: errorMessage,
      context: context
    });
  }
  
  /**
   * 템플릿 렌더링
   * @param {String} templateId - 템플릿 요소 ID
   * @param {Object} data - 템플릿 데이터
   * @returns {String} - 렌더링된 HTML
   */
  renderTemplate(templateId, data = {}) {
    const templateElement = document.getElementById(templateId);
    
    if (!templateElement) {
      console.error(`템플릿을 찾을 수 없습니다. (ID: ${templateId})`);
      return '';
    }
    
    let html = templateElement.innerHTML;
    
    // 간단한 템플릿 변수 치환
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, value);
    }
    
    return html;
  }
}

// 전역 스코프에 Component 클래스 노출
window.Component = Component;