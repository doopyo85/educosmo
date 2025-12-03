/**
 * PPTViewerComponent.js (하이브리드 방식)
 * PPT 뷰어 기능을 담당하는 컴포넌트
 * Layout-System의 동적 생성 방식 + Component-System의 모듈성
 */

class PPTViewerComponent extends Component {
  /**
   * PPT 뷰어 컴포넌트 생성자
   * @param {Object} config - 설정 객체
   */
  constructor(config = {}) {
    // 기본 설정과 병합
    const mergedConfig = {
      ...config,
      id: config.id || 'ppt-viewer-component',
      type: 'PPTVIEWER',
      visible: config.visible !== undefined ? config.visible : false
    };
    
    // 부모 클래스 생성자 호출
    super(mergedConfig);
    
    // 상태 정보
    this.state = {
      currentUrl: '',
      isFullscreen: false,
      isLoading: false,
      initialized: false,
      dynamicViewer: null // 동적으로 생성된 뷰어 참조
    };
    
    // 컨테이너 ID (template.ejs의 실제 ID)
    this.containerId = 'ppt-viewer-component';
    
    // 요소 참조
    this.elements = {
      container: null,
      dynamicViewer: null,
      iframe: null,
      loading: null,
      fullscreenButton: null
    };
    
    // 이벤트 바인딩
    this.setupEventBindings();
  }
  
  /**
   * 컴포넌트 초기화
   * @async
   */
  async init() {
    console.log('PPT 뷰어 컴포넌트 초기화');
    
    // DOM 요소 참조 설정
    this.initElements();
    
    this.state.initialized = true;
    console.log('PPT 뷰어 컴포넌트 초기화 완료');
    
    // 초기화 이벤트 발생 (Layout-System 호환)
    if (window.EventBus) {
      window.EventBus.publish('pptViewerComponentInitialized', {
        component: this,
        id: this.id
      });
    }
    
    return true;
  }
  
  /**
   * DOM 요소 참조 설정
   */
  initElements() {
    this.elements.container = document.getElementById(this.containerId);
    
    // 컨테이너가 없으면 경고
    if (!this.elements.container) {
      console.error(`PPT 뷰어 컨테이너(${this.containerId})를 찾을 수 없습니다`);
    }
  }
  
  /**
   * 이벤트 바인딩 설정 (Layout-System 호환)
   */
  setupEventBindings() {
    // Layout-System 호환 이벤트 처리
    if (window.EventBus) {
      window.EventBus.subscribe('layoutTypeChanged', (data) => {
        if (data.type === 'ppt') {
          this.show();
          // PPT URL이 있으면 로드
          if (data.data && data.data.pptUrl) {
            this.loadPPT(data.data.pptUrl);
          }
        } else {
          this.hide();
        }
      });
      
      // 메뉴 선택 이벤트 처리
      window.EventBus.subscribe('menuSelected', (data) => {
        if (data.layoutType === 'ppt' && data.pptUrl) {
          this.loadPPT(data.pptUrl);
        }
      });
    } else {
      console.error('EventBus가 정의되지 않았습니다. 이벤트를 구독할 수 없습니다.');
    }
  }
  
  /**
   * PPT 뷰어 동적 생성 (Layout-System 방식)
   */
  createPdfViewer(url) {
    console.log('PPT 뷰어 동적 생성 시작...');
    
    // 컨테이너 확인
    if (!this.elements.container) {
      console.error('PPT 뷰어 컨테이너를 찾을 수 없습니다.');
      return;
    }
    
    // 기존 동적 뷰어 제거
    if (this.state.dynamicViewer) {
      this.state.dynamicViewer.remove();
      this.state.dynamicViewer = null;
    }
    
    // 컨테이너 초기화
    this.elements.container.innerHTML = '';
    
    // PPT 뷰어 생성
    const pptViewer = document.createElement('div');
    pptViewer.id = 'ppt-viewer-dynamic';
    pptViewer.className = 'ppt-viewer-dynamic';
    pptViewer.style.cssText = "position: relative; width: 100%; height: 100%; display: block; background-color: #f5f5f5; overflow: hidden; z-index: 100;";
    
    // 뷰어 프레임 컨테이너
    const frameContainer = document.createElement('div');
    frameContainer.id = 'ppt-frame-container';
    frameContainer.className = 'ppt-frame-container';
    frameContainer.style.cssText = "width: 100%; height: 100%; position: relative;";
    
    // PDF/PPT iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'ppt-iframe-dynamic';
    iframe.style.cssText = "width: 100%; height: 100%; border: none; background-color: white;";
    frameContainer.appendChild(iframe);
    
    // 로딩 인디케이터
    const loading = document.createElement('div');
    loading.id = 'ppt-loading';
    loading.className = 'ppt-loading';
    loading.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: rgba(255, 255, 255, 0.8); z-index: 2;";
    
    // 로딩 스피너
    const spinner = document.createElement('div');
    spinner.style.cssText = "border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;";
    
    // 애니메이션 키프레임 스타일 추가 (중복 방지)
    if (!document.getElementById('ppt-animation-style')) {
      const keyframesStyle = document.createElement('style');
      keyframesStyle.id = 'ppt-animation-style';
      keyframesStyle.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(keyframesStyle);
    }
    
    // 로딩 텍스트
    const loadingText = document.createElement('p');
    loadingText.style.cssText = "margin-top: 10px; font-size: 18px; color: #333;";
    loadingText.textContent = '문서를 불러오는 중입니다...';
    
    loading.appendChild(spinner);
    loading.appendChild(loadingText);
    
    // 플레이스홀더 (PDF가 없을 때 표시)
    const placeholder = document.createElement('div');
    placeholder.id = 'ppt-placeholder';
    placeholder.className = 'ppt-placeholder';
    placeholder.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; justify-content: center; align-items: center; background-color: #f8f9fa; z-index: 1;";
    
    const placeholderContent = document.createElement('div');
    placeholderContent.className = 'placeholder-content';
    placeholderContent.style.cssText = "text-align: center; padding: 20px; max-width: 400px;";
    
    const placeholderIcon = document.createElement('i');
    placeholderIcon.className = 'bi bi-file-earmark-text';
    placeholderIcon.style.cssText = "font-size: 5rem; color: #adb5bd; margin-bottom: 20px;";
    
    const placeholderText = document.createElement('p');
    placeholderText.style.cssText = "font-size: 1rem; color: #6c757d; margin-bottom: 10px;";
    placeholderText.textContent = '선택된 PDF가 없습니다.';
    
    placeholderContent.appendChild(placeholderIcon);
    placeholderContent.appendChild(placeholderText);
    placeholder.appendChild(placeholderContent);
    
    // 전체화면 버튼
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'fullscreen-ppt-btn';
    fullscreenBtn.style.cssText = "position: absolute; bottom: 20px; right: 20px; width: 40px; height: 40px; border-radius: 50%; background-color: rgba(0, 0, 0, 0.5); color: white; border: none; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 3; transition: background-color 0.2s;";
    
    const fullscreenIcon = document.createElement('i');
    fullscreenIcon.className = 'bi bi-fullscreen';
    fullscreenIcon.style.cssText = "font-size: 20px;";
    fullscreenBtn.appendChild(fullscreenIcon);
    
    // 요소 조립
    pptViewer.appendChild(frameContainer);
    pptViewer.appendChild(loading);
    pptViewer.appendChild(placeholder);
    pptViewer.appendChild(fullscreenBtn);
    
    // 컨테이너에 추가
    this.elements.container.appendChild(pptViewer);
    
    // 요소 참조 업데이트
    this.state.dynamicViewer = pptViewer;
    this.elements.dynamicViewer = pptViewer;
    this.elements.iframe = iframe;
    this.elements.loading = loading;
    this.elements.fullscreenButton = fullscreenBtn;
    
    // 이벤트 리스너 설정
    this.setupDynamicEventListeners(iframe, fullscreenBtn);
    
    // iframe에 PDF 로드
    if (url) {
      this.loadUrlToIframe(url, iframe, loading, placeholder);
    }
    
    console.log('PPT 뷰어 동적 생성 완료. URL:', url);
  }
  
  /**
   * 동적 생성된 뷰어의 이벤트 리스너 설정
   */
  setupDynamicEventListeners(iframe, fullscreenBtn) {
    // iframe 로드 이벤트
    iframe.addEventListener('load', () => {
      this.hideLoading();
    });
    
    iframe.addEventListener('error', () => {
      this.hideLoading();
      this.showPlaceholder();
    });
    
    // 전체 화면 버튼 이벤트
    fullscreenBtn.addEventListener('click', () => {
      this.toggleFullscreen();
    });
    
    // 키보드 이벤트 (ESC 키로 전체 화면 종료)
    const keydownHandler = (event) => {
      if (event.key === 'Escape' && this.state.isFullscreen) {
        this.exitFullscreen();
      }
    };
    
    document.addEventListener('keydown', keydownHandler);
    
    // 컴포넌트 제거 시 이벤트 리스너도 제거하기 위해 참조 저장
    this._keydownHandler = keydownHandler;
  }
  
  /**
   * iframe에 URL 로드
   */
  loadUrlToIframe(url, iframe, loading, placeholder) {
    // 로딩 표시
    loading.style.display = 'flex';
    placeholder.style.display = 'none';
    
    // URL 설정
    iframe.src = url;
    this.state.currentUrl = url;
    
    console.log('PPT 로드:', url);
  }
  
  /**
   * PPT URL 로드 (외부 인터페이스)
   * @param {string} url - PPT URL
   */
  loadPPT(url) {
    if (!url || url.trim() === '') {
      console.error('유효한 PPT URL이 없습니다.');
      return;
    }
    
    // 이전 URL과 같으면 중단
    if (this.state.currentUrl === url) {
      console.log('이미 로드된 URL입니다:', url);
      return;
    }
    
    // PPT 뷰어 동적 생성
    this.createPdfViewer(url);
  }
  
  /**
   * 로딩 표시
   */
  showLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'flex';
    }
    this.state.isLoading = true;
  }
  
  /**
   * 로딩 숨김
   */
  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'none';
    }
    this.state.isLoading = false;
  }
  
  /**
   * 플레이스홀더 표시
   */
  showPlaceholder() {
    const placeholder = this.elements.container?.querySelector('#ppt-placeholder');
    if (placeholder) {
      placeholder.style.display = 'flex';
    }
  }
  
  /**
   * 전체 화면 전환
   */
  toggleFullscreen() {
    if (this.state.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }
  
  /**
   * 전체 화면 진입
   */
  enterFullscreen() {
    if (!this.elements.dynamicViewer) return;
    
    // 전체 화면 클래스 추가
    this.elements.dynamicViewer.classList.add('ppt-fullscreen');
    this.elements.dynamicViewer.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; background-color: #f5f5f5;";
    
    // 아이콘 변경
    if (this.elements.fullscreenButton) {
      const icon = this.elements.fullscreenButton.querySelector('i');
      if (icon) {
        icon.classList.remove('bi-fullscreen');
        icon.classList.add('bi-fullscreen-exit');
      }
    }
    
    this.state.isFullscreen = true;
  }
  
  /**
   * 전체 화면 종료
   */
  exitFullscreen() {
    if (!this.elements.dynamicViewer) return;
    
    // 전체 화면 클래스 제거
    this.elements.dynamicViewer.classList.remove('ppt-fullscreen');
    this.elements.dynamicViewer.style.cssText = "position: relative; width: 100%; height: 100%; display: block; background-color: #f5f5f5; overflow: hidden; z-index: 100;";
    
    // 아이콘 변경
    if (this.elements.fullscreenButton) {
      const icon = this.elements.fullscreenButton.querySelector('i');
      if (icon) {
        icon.classList.remove('bi-fullscreen-exit');
        icon.classList.add('bi-fullscreen');
      }
    }
    
    this.state.isFullscreen = false;
  }
  
  /**
   * 컴포넌트 표시 (Layout-System 방식)
   */
  show() {
    if (this.elements.container) {
      // Layout-System 방식: 강력한 인라인 스타일 적용
      this.elements.container.style.cssText = 
        "display: block !important; width: 100% !important; flex: 1 !important; min-width: auto !important; height: 100% !important;";
      
      // Component 방식: 상태 관리
      this.elements.container.classList.remove('component-hidden');
      this.elements.container.classList.add('component-visible');
      this.visible = true;
      
      // 문제 네비게이션 숨기기
      const navContainer = document.getElementById('problem-navigation-container');
      const problemTitle = document.getElementById('problem-title');
      
      if (navContainer) navContainer.style.display = 'none';
      if (problemTitle) problemTitle.style.display = 'none';
      
      // 콘텐츠 및 기타 컴포넌트 숨기기
      const contentContainer = document.getElementById('content-component');
      const ideContainer = document.getElementById('ide-component');
      const quizContainer = document.getElementById('quiz-component');
      
      if (contentContainer) {
        contentContainer.style.cssText = "display: none !important; width: 0 !important; flex: 0 !important; min-width: 0 !important;";
      }
      
      if (ideContainer) {
        ideContainer.style.cssText = "display: none !important; width: 0 !important; flex: 0 !important; min-width: 0 !important;";
      }
      
      if (quizContainer) {
        quizContainer.style.cssText = "display: none !important; width: 0 !important; flex: 0 !important; min-width: 0 !important;";
      }
    }
  }
  
  /**
   * 컴포넌트 숨김 (Layout-System 방식)
   */
  hide() {
    if (this.elements.container) {
      // Layout-System 방식: 강력한 인라인 스타일 적용
      this.elements.container.style.cssText = 
        "display: none !important; width: 0 !important; flex: 0 !important; min-width: 0 !important;";
      
      // Component 방식: 상태 관리
      this.elements.container.classList.remove('component-visible');
      this.elements.container.classList.add('component-hidden');
      this.visible = false;
      
      // 네비게이션 다시 표시
      const navContainer = document.getElementById('problem-navigation-container');
      const problemTitle = document.getElementById('problem-title');
      
      if (navContainer) navContainer.style.display = 'flex';
      if (problemTitle) problemTitle.style.display = 'block';
    }
  }
  
  /**
   * 컴포넌트 제거
   */
  dispose() {
    // 키보드 이벤트 리스너 제거
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
    
    // 동적 뷰어 제거
    if (this.state.dynamicViewer) {
      this.state.dynamicViewer.remove();
      this.state.dynamicViewer = null;
    }
    
    // 부모 클래스의 dispose 호출
    if (super.dispose) {
      super.dispose();
    }
  }
}

// 컴포넌트 팩토리에 등록
if (window.ComponentFactory) {
  window.ComponentFactory.registerClass('pptViewer', PPTViewerComponent);
}

// 전역 스코프에 PPTViewerComponent 클래스 노출
window.PPTViewerComponent = PPTViewerComponent;