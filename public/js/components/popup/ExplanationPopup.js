/**
 * ExplanationPopup.js - 해설 팝업 컴포넌트
 * 문제 해설을 마크다운 형태로 표시하는 팝업 컴포넌트
 * 
 * 기능:
 * - 마크다운 → HTML 변환 (marked.js 사용)
 * - 코드 하이라이팅 (highlight.js 사용)
 * - 드래그 이동 가능
 * - 반응형 위치 조정
 */

class ExplanationPopup extends Component {
  /**
   * ExplanationPopup 생성자
   * @param {Object} options - 컴포넌트 옵션
   */
  constructor(options = {}) {
    super(options);
    
    // 팝업 상태
    this.visible = false;
    this.currentProblem = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    
    // 캐시된 해설 데이터
    this.explanationCache = new Map();
    
    // 로딩 상태
    this.isLoading = false;
    
    // DOM 요소 참조
    this.elements = {
      popup: null,
      header: null,
      title: null,
      closeBtn: null,
      content: null,
      body: null,
      loading: null,
      error: null
    };
    
    // 마크다운 렌더러 설정
    if (typeof marked !== 'undefined') {
      this.marked = marked;
      this.setupMarkdownRenderer();
    } else {
      console.warn('ExplanationPopup: marked.js가 로드되지 않았습니다.');
      this.marked = null;
    }
  }
  
  /**
   * 컴포넌트 초기화
   * @param {Object} data - 초기화 데이터
   */
  async init(data = null) {
    console.log('ExplanationPopup 초기화 시작');
    
    // 부모 클래스 초기화
    const initResult = await super.init(data);
    if (!initResult) {
      return false;
    }
    
    // DOM 요소 참조 설정
    this.initElements();
    
    // 이벤트 리스너 설정
    this.setupEventListeners();
    
    // EventBus 이벤트 구독
    this.subscribeToEvents();
    
    console.log('ExplanationPopup 초기화 완료');
    return true;
  }
  
  /**
   * DOM 요소 참조 초기화
   */
  initElements() {
    if (!this.element) {
      console.error('ExplanationPopup: 루트 요소를 찾을 수 없습니다.');
      return;
    }
    
    // 모든 하위 요소 참조 가져오기
    this.elements = {
      popup: this.element,
      header: this.element.querySelector('.popup-header'),
      title: this.element.querySelector('#explanation-title'),
      closeBtn: this.element.querySelector('#explanation-close-btn'),
      content: this.element.querySelector('.popup-content'),
      body: this.element.querySelector('#explanation-body'),
      loading: this.element.querySelector('#explanation-loading'),
      error: this.element.querySelector('#explanation-error')
    };
    
    // 필수 요소 확인
    const requiredElements = ['popup', 'title', 'closeBtn', 'body', 'loading', 'error'];
    for (const elementName of requiredElements) {
      if (!this.elements[elementName]) {
        console.error(`ExplanationPopup: 필수 요소를 찾을 수 없습니다: ${elementName}`);
      }
    }
    
    // 초기 위치 설정
    this.initializePosition();
  }
  
  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 닫기 버튼 이벤트
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', () => {
        this.hide();
      });
    }
    
    // ESC 키 이벤트
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.visible) {
        this.hide();
      }
    });
    
    // 외부 클릭 시 닫기 (선택적)
    document.addEventListener('click', (event) => {
      if (this.visible && !this.elements.popup.contains(event.target)) {
        // 플로팅 버튼 클릭은 제외
        if (!event.target.closest('.explanation-floating-btn')) {
          this.hide();
        }
      }
    });
    
    // 드래그 이벤트 (헤더에서만)
    if (this.elements.header) {
      this.setupDragEvents();
    }
    
    // 윈도우 리사이즈 이벤트
    window.addEventListener('resize', () => {
      if (this.visible) {
        this.adjustPosition();
      }
    });
  }
  
  /**
   * EventBus 이벤트 구독
   */
  subscribeToEvents() {
    // 해설 요청 이벤트 구독
    window.EventBus.subscribe('explanation-request', (data) => {
      console.log('ExplanationPopup: 해설 요청 받음:', data);
      this.show(data);
    });
    
    // 문제 변경 이벤트 구독
    window.EventBus.subscribe('problemChanged', (data) => {
      // 팝업이 열려있으면 닫기
      if (this.visible) {
        this.hide();
      }
    });
    
    // 레이아웃 변경 이벤트 구독
    window.EventBus.subscribe('layoutTypeChanged', () => {
      if (this.visible) {
        this.adjustPosition();
      }
    });
  }
  
  /**
   * 마크다운 렌더러 설정
   */
  setupMarkdownRenderer() {
    if (!this.marked) return;
    
    // marked.js 옵션 설정
    this.marked.setOptions({
      breaks: true,
      gfm: true,
      tables: true,
      sanitize: false,
      smartLists: true,
      smartypants: true
    });
    
    // 코드 하이라이팅 설정 (highlight.js 사용)
    if (typeof hljs !== 'undefined') {
      this.marked.setOptions({
        highlight: function(code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (error) {
              console.warn('코드 하이라이팅 실패:', error);
            }
          }
          return hljs.highlightAuto(code).value;
        }
      });
    }
  }
  
  /**
   * 팝업 표시
   * @param {Object} problemData - 문제 데이터
   */
  async show(problemData = {}) {
    try {
      console.log('ExplanationPopup: 팝업 표시 시작:', problemData);
      
      // 이미 같은 문제의 해설이 표시중이면 그냥 포커스
      if (this.visible && this.isSameProblem(problemData)) {
        this.focusPopup();
        return;
      }
      
      // 현재 문제 정보 저장
      this.currentProblem = problemData;
      
      // 팝업 표시
      this.elements.popup.style.display = 'block';
      this.visible = true;
      
      // 위치 조정
      this.adjustPosition();
      
      // 애니메이션 효과
      this.elements.popup.style.opacity = '0';
      this.elements.popup.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        if (this.visible) {
          this.elements.popup.style.opacity = '1';
          this.elements.popup.style.transform = 'scale(1)';
        }
      }, 10);
      
      // 해설 로드
      await this.loadExplanation(problemData);
      
      // 활성화 이벤트 발행
      window.EventBus.publish('explanationPopupShown', {
        problemData: problemData
      });
      
      console.log('ExplanationPopup: 팝업 표시 완료');
      
    } catch (error) {
      this.handleError(error, '팝업 표시');
    }
  }
  
  /**
   * 팝업 숨김
   */
  hide() {
    try {
      if (!this.visible) return;
      
      console.log('ExplanationPopup: 팝업 숨김');
      
      // 애니메이션 효과
      this.elements.popup.style.opacity = '0';
      this.elements.popup.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        this.elements.popup.style.display = 'none';
        this.visible = false;
        
        // 비활성화 이벤트 발행
        window.EventBus.publish('explanationPopupHidden', {
          problemData: this.currentProblem
        });
      }, 200);
      
    } catch (error) {
      this.handleError(error, '팝업 숨김');
    }
  }
  
  /**
   * 해설 로드
   * @param {Object} problemData - 문제 데이터
   */
  async loadExplanation(problemData) {
    try {
      const { examName, problemNumber } = problemData;
      
      if (!examName || !problemNumber) {
        throw new Error('시험명과 문제번호가 필요합니다.');
      }
      
      // 캐시 확인
      const cacheKey = `${examName}_${problemNumber}`;
      if (this.explanationCache.has(cacheKey)) {
        console.log('ExplanationPopup: 캐시된 해설 사용');
        const cachedData = this.explanationCache.get(cacheKey);
        this.renderExplanation(cachedData);
        return;
      }
      
      // 로딩 상태 표시
      this.showLoading(true);
      this.hideError();
      
      console.log('ExplanationPopup: 해설 로드 시작:', { examName, problemNumber });
      
      // API 호출
      const response = await fetch(`/api/get-explanation-md?examName=${encodeURIComponent(examName)}&problemNumber=${encodeURIComponent(problemNumber)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '해설을 불러올 수 없습니다.');
      }
      
      console.log('ExplanationPopup: 해설 로드 성공');
      
      // 캐시에 저장
      this.explanationCache.set(cacheKey, data);
      
      // 해설 렌더링
      this.renderExplanation(data);
      
    } catch (error) {
      console.error('ExplanationPopup: 해설 로드 실패:', error);
      this.showError(error.message);
    } finally {
      this.showLoading(false);
    }
  }
  
  /**
   * 해설 렌더링
   * @param {Object} explanationData - 해설 데이터
   */
  renderExplanation(explanationData) {
    try {
      console.log('ExplanationPopup: 해설 렌더링 시작');
      
      // 제목 설정
      if (this.elements.title && explanationData.title) {
        this.elements.title.textContent = explanationData.title;
      }
      
      // 🔥 수정: HTML 콘텐츠 처리 및 스타일 제거
      let htmlContent = '';
      
      if (explanationData.markdownContent) {
        const content = explanationData.markdownContent;
        
        // HTML 콘텐츠인지 체크
        if (content.includes('<html>') || content.includes('<div>') || content.includes('<p>')) {
          console.log('HTML 콘텐츠 감지됨, 스타일 제거 및 정리 수행');
          
          // HTML 콘텐츠에서 body 내용만 추출
          let bodyContent = content;
          const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch) {
            bodyContent = bodyMatch[1];
          }
          
          // 스타일 태그 제거
          bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          
          // 인라인 스타일 제거
          bodyContent = bodyContent.replace(/style\s*=\s*["'][^"']*["']/gi, '');
          
          // 배경색 관련 클래스 제거
          bodyContent = bodyContent.replace(/class\s*=\s*["'][^"']*bg[^"']*["']/gi, '');
          
          // div 태그를 p 태그로 변경
          bodyContent = bodyContent.replace(/<div([^>]*)>/gi, '<p$1>');
          bodyContent = bodyContent.replace(/<\/div>/gi, '</p>');
          
          // 빈 p 태그 제거
          bodyContent = bodyContent.replace(/<p[^>]*>\s*<\/p>/gi, '');
          
          htmlContent = bodyContent;
        } else {
          // 마크다운 콘텐츠 처리
          if (this.marked) {
            htmlContent = this.marked.parse(content);
          } else {
            htmlContent = `<pre>${content}</pre>`;
          }
        }
      } else {
        htmlContent = '<p>해설 내용이 없습니다.</p>';
      }
      
      // HTML 렌더링
      if (this.elements.body) {
        // 🔥 수정: markdown-content 클래스를 가진 div로 래핑
        this.elements.body.innerHTML = `<div class="markdown-content">${htmlContent}</div>`;
        
        // 코드 블록 스타일 적용
        this.styleCodeBlocks();
        
        // 링크 처리
        this.processLinks();
      }
      
      console.log('ExplanationPopup: 해설 렌더링 완료');
      
    } catch (error) {
      this.handleError(error, '해설 렌더링');
      this.showError('해설을 표시하는 중 오류가 발생했습니다.');
    }
  }
  
  /**
   * 🔥 새로 추가: 모든 요소에 강제로 깔끔한 스타일 적용
   */
  forceCleanStyles() {
    if (!this.elements.body) return;
    
    // 모든 요소에서 인라인 스타일 제거
    const allElements = this.elements.body.querySelectorAll('*');
    allElements.forEach(element => {
      // 인라인 스타일 제거
      element.removeAttribute('style');
      
      // 배경 관련 클래스 제거
      const classList = element.className.split(' ');
      const cleanClasses = classList.filter(cls => 
        !cls.includes('bg-') && 
        !cls.includes('background') && 
        !cls.includes('dark') &&
        !cls.includes('text-')
      );
      element.className = cleanClasses.join(' ');
      
      // 태그별 기본 스타일 적용
      const tagName = element.tagName.toLowerCase();
      
      switch (tagName) {
        case 'p':
        case 'div':
        case 'span':
        case 'li':
        case 'td':
        case 'th':
          element.style.color = '#2d3748';
          element.style.backgroundColor = 'transparent';
          break;
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          element.style.color = '#1a202c';
          element.style.backgroundColor = 'transparent';
          element.style.fontWeight = '600';
          break;
        case 'code':
          if (element.parentElement.tagName.toLowerCase() !== 'pre') {
            element.style.backgroundColor = '#edf2f7';
            element.style.color = '#e53e3e';
            element.style.padding = '2px 6px';
            element.style.borderRadius = '4px';
          }
          break;
        case 'pre':
          element.style.backgroundColor = '#f7fafc';
          element.style.border = '1px solid #e2e8f0';
          element.style.borderRadius = '8px';
          element.style.padding = '16px';
          element.style.overflow = 'auto';
          break;
        case 'blockquote':
          element.style.backgroundColor = '#f7fafc';
          element.style.borderLeft = '4px solid #3182ce';
          element.style.color = '#4a5568';
          element.style.padding = '12px 16px';
          element.style.margin = '16px 0';
          element.style.borderRadius = '0 8px 8px 0';
          break;
        case 'table':
          element.style.backgroundColor = '#ffffff';
          element.style.borderCollapse = 'collapse';
          element.style.width = '100%';
          break;
      }
    });
    
    console.log('ExplanationPopup: 강제 스타일 정리 완료');
  }
  
  /**
   * 코드 블록 스타일 적용 (markdown-content 내에서만)
   */
  styleCodeBlocks() {
    // markdown-content 컨테이너 내의 코드 블록만 대상으로 함
    const markdownContainer = this.elements.body.querySelector('.markdown-content');
    if (!markdownContainer) return;
    
    const codeBlocks = markdownContainer.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      // CSS에서 이미 정의된 스타일을 보완하는 정도로만 적용
      block.style.fontSize = '14px';
      block.style.lineHeight = '1.5';
    });
  }
  
  /**
   * 링크 처리 (새 창에서 열기)
   */
  processLinks() {
    const links = this.elements.body.querySelectorAll('a');
    links.forEach(link => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }
  
  /**
   * 로딩 상태 표시/숨김
   * @param {Boolean} show - 표시 여부
   */
  showLoading(show) {
    if (this.elements.loading) {
      this.elements.loading.style.display = show ? 'flex' : 'none';
    }
    
    if (this.elements.body) {
      this.elements.body.style.display = show ? 'none' : 'block';
    }
    
    this.isLoading = show;
  }
  
  /**
   * 오류 메시지 표시
   * @param {String} message - 오류 메시지
   */
  showError(message) {
    if (this.elements.error) {
      this.elements.error.style.display = 'block';
      const errorText = this.elements.error.querySelector('p');
      if (errorText) {
        errorText.textContent = message || '알 수 없는 오류가 발생했습니다.';
      }
    }
    
    if (this.elements.body) {
      this.elements.body.style.display = 'none';
    }
  }
  
  /**
   * 오류 메시지 숨김
   */
  hideError() {
    if (this.elements.error) {
      this.elements.error.style.display = 'none';
    }
  }
  
  /**
   * 같은 문제인지 확인
   * @param {Object} problemData - 문제 데이터
   * @returns {Boolean} - 같은 문제 여부
   */
  isSameProblem(problemData) {
    if (!this.currentProblem || !problemData) return false;
    
    return (
      this.currentProblem.examName === problemData.examName &&
      this.currentProblem.problemNumber === problemData.problemNumber
    );
  }
  
  /**
   * 팝업에 포커스
   */
  focusPopup() {
    if (this.elements.popup) {
      this.elements.popup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 강조 효과
      this.elements.popup.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
      setTimeout(() => {
        this.elements.popup.style.boxShadow = '';
      }, 1000);
    }
  }
  
  /**
   * 초기 위치 설정
   */
  initializePosition() {
    if (!this.elements.popup) return;
    
    // 기본 위치: 화면 중앙 우측
    this.elements.popup.style.position = 'fixed';
    this.elements.popup.style.zIndex = '1050';
    this.elements.popup.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    
    this.adjustPosition();
  }
  
  /**
   * 위치 조정 - 오른쪽에 위치하도록 수정 (문제와 나란히 보기)
   */
  adjustPosition() {
    if (!this.elements.popup) return;
    
    const popup = this.elements.popup;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 팝업 크기 설정
    const popupWidth = Math.min(700, windowWidth * 0.6);
    const popupHeight = Math.min(650, windowHeight * 0.8);
    
    popup.style.width = `${popupWidth}px`;
    popup.style.maxHeight = `${popupHeight}px`;
    
    // 🔥 수정: 오른쪽 위치 계산 (문제와 나란히 보기 위해)
    let left = windowWidth - popupWidth - 20; // 오른쪽 여백 20px
    let top = Math.max(20, (windowHeight - popupHeight) / 2); // 수직 중앙
    
    // 화면 경계 체크
    if (left < 20) {
      left = 20; // 최소 좌측 여백
    }
    
    if (top + popupHeight > windowHeight - 20) {
      top = windowHeight - popupHeight - 20; // 최소 하단 여백
    }
    
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    
    console.log('ExplanationPopup: 오른쪽 위치 설정:', {
      popupPosition: { left, top },
      popupSize: { width: popupWidth, height: popupHeight },
      windowSize: { width: windowWidth, height: windowHeight }
    });
  }
  
  /**
   * 드래그 이벤트 설정
   */
  setupDragEvents() {
    const header = this.elements.header;
    if (!header) return;
    
    header.style.cursor = 'move';
    
    header.addEventListener('mousedown', (e) => {
      this.startDrag(e);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.drag(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      this.stopDrag();
    });
  }
  
  /**
   * 드래그 시작
   * @param {MouseEvent} e - 마우스 이벤트
   */
  startDrag(e) {
    this.isDragging = true;
    
    const rect = this.elements.popup.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    this.elements.popup.style.transition = 'none';
    document.body.style.userSelect = 'none';
  }
  
  /**
   * 드래그 중
   * @param {MouseEvent} e - 마우스 이벤트
   */
  drag(e) {
    if (!this.isDragging) return;
    
    const newLeft = e.clientX - this.dragOffset.x;
    const newTop = e.clientY - this.dragOffset.y;
    
    // 화면 경계 체크
    const maxLeft = window.innerWidth - this.elements.popup.offsetWidth;
    const maxTop = window.innerHeight - this.elements.popup.offsetHeight;
    
    const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
    const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
    
    this.elements.popup.style.left = `${constrainedLeft}px`;
    this.elements.popup.style.top = `${constrainedTop}px`;
  }
  
  /**
   * 드래그 종료
   */
  stopDrag() {
    this.isDragging = false;
    this.elements.popup.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    document.body.style.userSelect = '';
  }
  
  /**
   * 캐시 클리어
   */
  clearCache() {
    this.explanationCache.clear();
    console.log('ExplanationPopup: 캐시 클리어됨');
  }
  
  /**
   * 컴포넌트 정리
   */
  destroy() {
    // 팝업 숨김
    this.hide();
    
    // 캐시 클리어
    this.clearCache();
    
    // EventBus 구독 해제는 자동으로 처리됨 (페이지 언로드 시)
    
    console.log('ExplanationPopup: 컴포넌트 정리 완료');
  }
}

// 전역 스코프에 ExplanationPopup 클래스 노출
window.ExplanationPopup = ExplanationPopup;