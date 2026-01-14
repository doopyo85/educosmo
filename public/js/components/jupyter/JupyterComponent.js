/**
* JupyterComponent.js - 단순화된 Jupyter Notebook 컴포넌트
* 사용자별 격리된 빈 노트북 제공
*/

class JupyterComponent extends Component {
   constructor(options = {}) {
       super(options);
       
       // 기본 elementId 설정
       this.elementId = options.elementId || 'jupyter-component';
       
       this.state = {
           initialized: false,
           connected: false,
           containerReady: false,
           iframeReady: false,
           active: false,
           visible: false,
           jupyterUrl: '/jupyter', 
           currentNotebook: null,
           userID: null,
           lastError: null
       };
       
       this.elements = {
           container: null,
           iframe: null,
           loading: null,
           error: null,
           retryBtn: null
       };
       
       this.retryCount = 0;
       this.maxRetries = 5;
       this.retryDelay = 1000;
       
       console.log('JupyterComponent 생성됨 (단순화 버전):', this.elementId);
   }

   // 현재 로그인한 사용자 ID 가져오기
   getCurrentUserID() {
       // 1. HTML에서 전역 변수로 설정된 사용자 ID 확인
       const userIDFromHTML = document.getElementById('currentUserID')?.value;
       if (userIDFromHTML && userIDFromHTML !== '게스트') {
           console.log('✅ User ID from HTML:', userIDFromHTML);
           return userIDFromHTML;
       }

       // 2. 전역 변수로 설정된 사용자 ID 확인
       if (window.currentUserID && window.currentUserID !== '게스트') {
           console.log('✅ User ID from window:', window.currentUserID);
           return window.currentUserID;
       }

       // 3. 세션 또는 옆에서 사용자 이름 추출 시도
       const userNameElement = document.getElementById('userName');
       if (userNameElement && userNameElement.textContent.trim() !== '게스트') {
           console.log('✅ User ID from userName element:', userNameElement.textContent.trim());
           return userNameElement.textContent.trim();
       }

       // 🔥 4. DB 복원 전 임시: testuser 사용
       console.log('⚠️  No user session found, using testuser (DB migration in progress)');
       return 'testuser';
   }
   
   async init(data = null) {
       console.log('JupyterComponent 단순화 초기화 시작...');
       
       try {
           await super.init(data);
           
           this.state.userID = this.getCurrentUserID();
           
           // 단순한 초기화: 컨테이너 생성 → 빈 노트북 생성
           const success = await this.initializeSimpleJupyter();
           
           if (success) {
               this.state.initialized = true;
               console.log('JupyterComponent 단순화 초기화 완료');
               return true;
           } else {
               throw new Error('단순화 초기화 실패');
           }
           
       } catch (error) {
           console.error('JupyterComponent 단순화 초기화 실패:', error);
           
           // 재시도 로직
           if (this.retryCount < this.maxRetries) {
               this.retryCount++;
               console.log(`재시도 ${this.retryCount}/${this.maxRetries}...`);
               
               setTimeout(() => {
                   this.forceConnect();
               }, this.retryDelay);
           } else {
               this.showError('Jupyter 초기화에 실패했습니다.');
           }
           
           return false;
       }
   }

   // 단순화된 초기화 메서드
   async initializeSimpleJupyter() {
       console.log('JupyterComponent 단순화 초기화...');
       
       try {
           // 1. 컨테이너 설정
           await this.setupSimpleContainer();
           
           // 2. 사용자별 빈 노트북 생성 및 로드
           await this.createAndLoadBlankNotebook();
           
           // 3. 연결 상태 설정
           this.state.connected = true;
           this.state.initialized = true;
           
           console.log('JupyterComponent 단순화 초기화 완료');
           return true;
           
       } catch (error) {
           console.error('JupyterComponent 단순화 초기화 실패:', error);
           
           // 폴백: 기본 강제 연결
           console.log('폴백: 기본 강제 연결 시도...');
           const success = await this.forceConnect();
           
           if (success) {
               this.state.initialized = true;
               return true;
           } else {
               this.showError('Jupyter 초기화에 완전히 실패했습니다.');
               return false;
           }
       }
   }

   // 단순한 컨테이너 설정
   async setupSimpleContainer() {
       console.log('단순 컨테이너 설정 시작...');
       
       // 1. 컨테이너 요소 찾기 또는 생성
       let container = document.getElementById(this.elementId);
       
       if (!container) {
           console.log('jupyter-component가 없음, 생성 시도...');
           
           container = document.createElement('div');
           container.id = this.elementId;
           container.className = 'component jupyter-component';
           container.style.cssText = 'width: 100%; height: 100%; position: relative;';
           
           // 적절한 부모 요소에 추가
           const parentElement = document.querySelector('#content-component .content-iframe-container') || 
                                document.querySelector('#content-component') || 
                                document.body;
           
           parentElement.appendChild(container);
           console.log('jupyter-component 컨테이너 생성됨');
       }

       this.elements.container = container;
       
       // 2. 단순한 UI 생성
       this.createSimpleUI();
       
       this.state.containerReady = true;
       console.log('단순 컨테이너 설정 완료');
   }

   // 단순한 UI 생성
   createSimpleUI() {
       const simpleHTML = `
           <div class="jupyter-wrapper">
               <!-- 로딩 화면 -->
               <div class="jupyter-loading" id="jupyter-loading" style="display: flex;">
                   <div class="loading-content">
                       <div class="loading-spinner"></div>
                       <p>Jupyter Notebook을 준비하고 있습니다...</p>
                       <small>사용자: ${this.state.userID}</small>
                   </div>
               </div>
               
               <!-- 에러 화면 -->
               <div class="jupyter-error" id="jupyter-error" style="display: none;">
                   <div class="error-content">
                       <h5>Jupyter Notebook 연결 실패</h5>
                       <p id="jupyter-error-message">서버에 연결할 수 없습니다.</p>
                       <button class="btn btn-primary" id="jupyter-retry-btn">다시 시도</button>
                   </div>
               </div>
               
               <!-- Jupyter iframe -->
               <iframe 
                   id="jupyter-iframe" 
                   class="jupyter-iframe" 
                   src="about:blank"
                   title="Jupyter Notebook"
                   sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                   style="width: 100%; height: 100%; border: none; background: white; display: none;"
               ></iframe>
           </div>
       `;
       
       this.elements.container.innerHTML = simpleHTML;
       
       // 요소 참조 설정
       this.elements.loading = document.getElementById('jupyter-loading');
       this.elements.error = document.getElementById('jupyter-error');
       this.elements.iframe = document.getElementById('jupyter-iframe');
       this.elements.retryBtn = document.getElementById('jupyter-retry-btn');
       
       // 이벤트 리스너 설정
       this.setupSimpleEventListeners();
   }

   // 단순한 이벤트 리스너 설정
   setupSimpleEventListeners() {
       // 재시도 버튼
       if (this.elements.retryBtn) {
           this.elements.retryBtn.addEventListener('click', () => {
               this.reconnect();
           });
       }
       
       // iframe 로드 이벤트
       if (this.elements.iframe) {
           this.elements.iframe.addEventListener('load', () => {
               this.onJupyterLoaded();
           });
           
           this.elements.iframe.addEventListener('error', () => {
               this.showError('Jupyter iframe 로드에 실패했습니다.');
           });
       }
   }

   // 🔥 S3에서 노트북 로드 (단순화 - 사용자 디렉토리 기반)
   async createAndLoadBlankNotebook() {
       try {
           console.log('📥 S3에서 노트북 로드 시도...', this.state.userID);

           const response = await fetch('/api/jupyter/load-notebook', {
               method: 'POST',
               credentials: 'include',
               headers: {
                   'Content-Type': 'application/json',
               },
               body: JSON.stringify({
                   userID: this.state.userID
               })
           });

           if (response.ok) {
               const result = await response.json();
               console.log('✅ 노트북 로드 성공:', result);

               // 사용자 노트북 정보 저장 (sessionID 제거)
               this.state.s3Key = result.s3Key;
               this.state.currentNotebook = result.notebook;
               this.state.localPath = result.localPath;

               // Jupyter 노트북으로 iframe 이동
               if (result.success && result.notebookUrl) {
                   this.loadNotebook(result.notebookUrl);

                   // 🔥 자동 저장 타이머 시작 (5분마다)
                   this.startAutoSave();

                   return true;
               } else {
                   throw new Error(result.message || '노트북 로드 실패');
               }

           } else {
               const errorData = await response.json().catch(() => ({}));
               throw new Error(errorData.error || `노트북 로드 API 호출 실패: ${response.status}`);
           }

       } catch (error) {
           console.error('❌ 노트북 로드 실패:', error);
           this.state.lastError = error.message;

           // 폴백: 기본 Jupyter 트리 뷰로 이동
           console.log('⚠️ 폴백: 기본 Jupyter 인터페이스 사용');
           this.loadNotebook('/jupyter/tree');
           return true;
       }
   }

   // 자동 저장 시작
   startAutoSave() {
       // 기존 타이머가 있으면 정리
       if (this.autoSaveTimer) {
           clearInterval(this.autoSaveTimer);
       }

       // 5분마다 자동 저장
       this.autoSaveTimer = setInterval(() => {
           this.saveNotebook();
       }, 5 * 60 * 1000);

       console.log('🔄 자동 저장 타이머 시작 (5분 간격)');
   }

   // 노트북 저장 (S3에 업로드) - 단순화
   async saveNotebook() {
       try {
           if (!this.state.userID || !this.state.currentNotebook) {
               console.warn('저장 정보가 없습니다. 저장을 건너뜁니다.');
               return false;
           }

           console.log('💾 노트북 저장 중...');

           const response = await fetch('/api/jupyter/save-notebook', {
               method: 'POST',
               credentials: 'include',
               headers: {
                   'Content-Type': 'application/json',
               },
               body: JSON.stringify({
                   userID: this.state.userID,
                   filename: this.state.currentNotebook
               })
           });

           if (response.ok) {
               const result = await response.json();
               console.log('✅ 노트북 저장 완료:', result);
               return true;
           } else {
               const errorData = await response.json().catch(() => ({}));
               console.error('❌ 노트북 저장 실패:', errorData.error);
               return false;
           }

       } catch (error) {
           console.error('❌ 노트북 저장 오류:', error);
           return false;
       }
   }

   // 🔥 정리 작업 (단순화 - 타이머만 중지)
   cleanup() {
       try {
           console.log('🗑️ Jupyter 정리 중...');

           // 자동 저장 타이머 중지
           if (this.autoSaveTimer) {
               clearInterval(this.autoSaveTimer);
               this.autoSaveTimer = null;
           }

           console.log('✅ Jupyter 정리 완료');

       } catch (error) {
           console.error('❌ Jupyter 정리 오류:', error);
       }
   }

   // 노트북 로드
   loadNotebook(notebookUrl) {
       console.log('노트북 로드:', notebookUrl);

       if (this.elements.iframe) {
           // 🔥 Jupyter base_url 추가 (상대 경로면 /jupyter/ 추가)
           const fullUrl = notebookUrl.startsWith('/') ? notebookUrl : `/jupyter/${notebookUrl}`;
           console.log('📍 Full URL:', fullUrl);
           this.elements.iframe.src = fullUrl;
           this.setupLoadDetection();
       }
   }

   // 로드 감지 설정
   setupLoadDetection() {
       let loadTimeout;
       let hasLoaded = false;
       
       const onLoadSuccess = () => {
           if (!hasLoaded) {
               hasLoaded = true;
               clearTimeout(loadTimeout);
               this.onJupyterLoaded();
           }
       };
       
       loadTimeout = setTimeout(() => {
           if (!hasLoaded) {
               console.warn('Jupyter 로드 타임아웃 - 위젯 오류 무시하고 계속');
               if (this.elements.iframe && this.elements.iframe.contentWindow) {
                   hasLoaded = true;
                   this.hideLoading();
               }
           }
       }, 10000);
       
       if (this.elements.iframe) {
           this.elements.iframe.onload = onLoadSuccess;
           this.elements.iframe.onerror = () => {
               if (!hasLoaded) {
                   hasLoaded = true;
                   clearTimeout(loadTimeout);
                   this.showError('Jupyter iframe 로드에 실패했습니다.');
               }
           };
       }
   }
   
   // Jupyter 로드 완료 처리
   onJupyterLoaded() {
       console.log('Jupyter iframe 로드 완료');
       this.hideLoading();
       this.hideError();
   }
   
   // 로딩 화면 표시/숨김
   showLoading() {
       if (this.elements.loading) this.elements.loading.style.display = 'flex';
       if (this.elements.error) this.elements.error.style.display = 'none';
       if (this.elements.iframe) this.elements.iframe.style.display = 'none';
   }
   
   hideLoading() {
       if (this.elements.loading) this.elements.loading.style.display = 'none';
       if (this.elements.iframe) this.elements.iframe.style.display = 'block';
   }
   
   // 오류 화면 표시/숨김
   showError(message) {
       console.error('Jupyter 오류:', message);
       
       if (this.elements.loading) this.elements.loading.style.display = 'none';
       if (this.elements.iframe) this.elements.iframe.style.display = 'none';
       if (this.elements.error) {
           this.elements.error.style.display = 'flex';
           const errorMessage = document.getElementById('jupyter-error-message');
           if (errorMessage) errorMessage.textContent = message;
       }
   }
   
   hideError() {
       if (this.elements.error) this.elements.error.style.display = 'none';
   }
   
   // 컴포넌트 활성화
   activate() {
       console.log('JupyterComponent 단순화 활성화');
       
       super.activate();
       this.state.active = true;
       
       // 컨테이너 표시
       if (this.elements.container) {
           this.elements.container.classList.remove('component-hidden');
           this.elements.container.classList.add('component-visible');
           this.elements.container.style.display = 'block';
       }
       
       // 초기화되지 않았으면 초기화 시도
       if (!this.state.initialized) {
           console.log('초기화되지 않음, 단순화 초기화 시도...');
           this.initializeSimpleJupyter();
       }
       // 연결되지 않았으면 연결 시도  
       else if (!this.state.connected) {
           console.log('연결되지 않음, 강제 연결 시도...');
           this.forceConnect();
       }
       
       setTimeout(() => this.resizeJupyter(), 100);
   }
   
   deactivate() {
       console.log('JupyterComponent 비활성화');

       super.deactivate();
       this.state.active = false;

       // 🔥 마지막 저장 후 정리
       this.saveNotebook().finally(() => {
           this.cleanup();
       });

       if (this.elements.container) {
           this.elements.container.classList.add('component-hidden');
           this.elements.container.classList.remove('component-visible');
       }
   }
   
   show() {
       this.state.visible = true;
       this.activate();
   }
   
   hide() {
       this.state.visible = false;
       this.deactivate();
   }
   
   resizeJupyter() {
       const container = this.elements.container;
       const iframe = this.elements.iframe;
       
       if (!container || !iframe || !this.state.active) return;
       
       // 🔥 CSS에 맡김 - margin-top 강제 제거만 수행
       container.style.marginTop = '0';
       iframe.style.height = '100%';
       
       console.log('Jupyter 크기 조정: CSS 기본값 사용');
   }

   // 수동 재연결 메서드
   async reconnect() {
       console.log('Jupyter 수동 재연결...');
       this.retryCount = 0;
       this.state.initialized = false;
       this.state.connected = false;
       
       return await this.initializeSimpleJupyter();
   }

   // 완전 우회 연결 메서드 (폴백용)
   async forceConnect() {
       console.log('강제 연결 시도 (폴백)');
       
       // 1. 컨테이너 찾기 및 생성
       let container = document.getElementById(this.elementId);
       if (!container) {
           console.log('컨테이너 없음, 새로 생성');
           container = document.createElement('div');
           container.id = this.elementId;
           container.className = 'component jupyter-component';
           container.style.cssText = 'width: 100%; height: 100%; position: relative;';
           
           const parent = document.querySelector('#content-component') || document.body;
           parent.appendChild(container);
       }
       
       this.elements.container = container;
       this.state.containerReady = true;
       
       // 2. iframe 찾기 및 생성
       let iframe = document.getElementById('jupyter-iframe');
       if (!iframe) {
           console.log('iframe 없음, 새로 생성');
           
           // 로딩 메시지 먼저 표시
           container.innerHTML = `
               <div class="jupyter-loading" style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column;">
                   <div style="margin-bottom: 20px;">Jupyter Notebook 준비 중...</div>
                   <small>사용자: ${this.getCurrentUserID()}</small>
               </div>
           `;
           
           // iframe 생성
           iframe = document.createElement('iframe');
           iframe.id = 'jupyter-iframe';
           iframe.className = 'jupyter-iframe';
           iframe.src = '/jupyter/tree';
           iframe.title = 'Jupyter Notebook';
           iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: white; display: none;';
           iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals');
           
           container.appendChild(iframe);
           
           // iframe 로드 후 로딩 메시지 숨기기
           iframe.onload = () => {
               console.log('Jupyter iframe 로드 완료');
               const loading = container.querySelector('.jupyter-loading');
               if (loading) loading.style.display = 'none';
               iframe.style.display = 'block';
           };
       }
       
       this.elements.iframe = iframe;
       this.state.iframeReady = true;
       this.state.connected = true;
       this.state.initialized = true;
       
       console.log('강제 연결 완료');
       return true;
   }

   // 상태 확인 메서드
   getStatus() {
       return {
           state: this.state,
           elements: {
               container: !!this.elements.container,
               iframe: !!this.elements.iframe
           },
           retryCount: this.retryCount,
           currentUserID: this.getCurrentUserID(),
           currentNotebook: this.state.currentNotebook
       };
   }
   
   getCurrentNotebook() {
       return this.state.currentNotebook;
   }
   
   isActive() {
       return this.state.active;
   }
   
   isInitialized() {
       return this.state.initialized;
   }
}

// 전역 등록
window.JupyterComponent = JupyterComponent;

console.log('JupyterComponent 클래스 정의 완료 (단순화 버전)');