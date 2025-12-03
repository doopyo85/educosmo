/**
 * card-project.js
 * 카드 레이아웃 기반 프로젝트 목록 표시를 위한 통합 JavaScript 파일
 */

// 즉시 실행 함수로 감싸서 변수 충돌 방지
(function() {
    /**
     * 현재 페이지 경로에 따라 API 엔드포인트 및 설정 결정
     */
    function getPageConfig() {
        // 현재 페이지 경로 가져오기
        const path = window.location.pathname;
        
        // 기본 설정 객체
        const defaultConfig = {
            apiEndpoint: '/api/get-project-data',
            pageTitle: '프로젝트',
            contentType: 'default',
            enableTracking: true
        };
        
        // 페이지별 설정
        const pageConfigs = {
            '/computer': {
                apiEndpoint: '/api/get-computer-data',
                pageTitle: '컴퓨터 기초활용',
                contentType: 'computer'
            },
            '/machinelearning': {
                apiEndpoint: '/api/get-ml-data',
                pageTitle: '인공지능/머신러닝',
                contentType: 'machinelearning'
            },
            '/python_project': {
                apiEndpoint: '/api/get-python-data',
                pageTitle: '파이썬 프로젝트',
                contentType: 'python'
            },
            '/algorithm': {
                apiEndpoint: '/api/get-algorithm-data',
                pageTitle: '알고리즘',
                contentType: 'algorithm'
            },
            '/appinventor_project': {
                apiEndpoint: '/api/get-appinventor-data',
                pageTitle: '앱인벤터',
                contentType: 'appinventor'
            },
            '/certification': {
                apiEndpoint: '/api/get-certification-data',
                pageTitle: '자격증과정',
                contentType: 'certification'
            },
            // 추가 페이지 설정은 여기에 추가
        };
        
        // 현재 경로에 맞는 설정 찾기
        const pageConfig = pageConfigs[path] || {};
        
        // 기본 설정과 페이지별 설정 병합
        return Object.assign({}, defaultConfig, pageConfig);
    }

    /**
     * 카드 프로젝트 관리자 클래스
     */
    class CardProjectManager {
        constructor(options = {}) {
            // 기본 옵션과 사용자 옵션 병합
            this.options = Object.assign({
                apiEndpoint: '/api/get-project-data',  // 기본 API 엔드포인트
                categoryTabsId: 'categoryTabs',        // 탭 컨테이너 ID
                contentContainerId: 'content-container', // 콘텐츠 컨테이너 ID
                pageTitle: '프로젝트',                  // 페이지 제목
                contentType: 'default',                 // 콘텐츠 타입 (트래킹용)
                enableTracking: true                   // 트래킹 활성화 여부
            }, options);

            // 초기화
            this.init();
        }

        /**
         * 초기화 함수
         */
        async init() {
            try {
                // 데이터 로드
                await this.loadProjectData();
            } catch (error) {
                console.error(`Error initializing CardProjectManager:`, error);
                this.displayErrorMessage("데이터를 불러오는 중 오류가 발생했습니다.");
            }
        }

        /**
         * 서버 API를 통해 프로젝트 데이터를 가져오는 함수
         */
        async loadProjectData() {
            try {
                const response = await fetch(this.options.apiEndpoint);
                
                if (!response.ok) {
                    throw new Error(`API 응답 오류: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data && data.length > 0) {
                    const projects = this.groupByCategory(data);
                    this.displayTabsAndProjects(projects);
                } else {
                    this.displayErrorMessage("표시할 프로젝트 데이터가 없습니다.");
                }
            } catch (error) {
                console.error('Error loading project data:', error);
                this.displayErrorMessage("프로젝트 데이터를 불러오는 중 오류가 발생했습니다.");
            }
        }

        /**
         * 데이터를 카테고리별로 그룹화하는 함수
         */
        groupByCategory(data) {
            const projects = {};

            data.forEach(row => {
                const [category, name, description, stageURL, imgURL] = row;
                if (!projects[category]) {
                    projects[category] = [];
                }
                projects[category].push({ name, description, stageURL, imgURL });
            });

            return projects;
        }

        /**
         * 동적으로 탭과 프로젝트 데이터를 HTML에 표시하는 함수
         */
        displayTabsAndProjects(projects) {
            const tabsContainer = document.getElementById(this.options.categoryTabsId);
            const contentContainer = document.getElementById(this.options.contentContainerId);
            
            if (!tabsContainer || !contentContainer) {
                console.error('탭 또는 콘텐츠 컨테이너를 찾을 수 없습니다.');
                return;
            }
            
            let firstTab = true;

            // 기존 탭과 콘텐츠 초기화
            tabsContainer.innerHTML = '';
            contentContainer.innerHTML = '';

            Object.keys(projects).forEach((category, index) => {
                // 동적 탭 생성
                const tabId = `tab-${index}`;
                const paneId = `pane-${index}`;

                const tab = document.createElement('li');
                tab.className = 'nav-item';
                tab.innerHTML = `
                    <button class="nav-link ${firstTab ? 'active' : ''}" id="${tabId}" data-bs-toggle="tab" data-bs-target="#${paneId}" type="button" role="tab" aria-controls="${paneId}" aria-selected="${firstTab}">
                        ${category}
                    </button>
                `;
                tabsContainer.appendChild(tab);

                // 동적 콘텐츠 생성
                const tabContent = document.createElement('div');
                tabContent.className = `tab-pane fade ${firstTab ? 'show active' : ''}`;
                tabContent.id = paneId;
                tabContent.role = 'tabpanel';
                tabContent.setAttribute('aria-labelledby', tabId);

                const rowDiv = document.createElement('div');
                rowDiv.className = 'row';
                
                projects[category].forEach(project => {
                    const card = document.createElement('div');
                    card.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';

                    // 카드 콘텐츠 생성 (styles.css에 맞는 구조)
                    const cardContent = `
                        <div class="card h-100">
                            <div class="card-img-box">
                                <img src="${project.imgURL}" class="card-img-top" alt="${project.name}">
                            </div>
                            <div class="card-text-box">
                                <h5 class="card-title">${project.name}</h5>
                                <p class="card-text">${project.description}</p>
                                <a href="${project.stageURL}" class="btn btn-primary">시작하기</a>
                            </div>
                        </div>
                    `;
                    card.innerHTML = cardContent;
                    rowDiv.appendChild(card);
                });

                tabContent.appendChild(rowDiv);
                contentContainer.appendChild(tabContent);

                // 첫 번째 탭이 끝나면 false로 전환
                firstTab = false;
            });

            // 이벤트 리스너 추가 (필요한 경우)
            this.setupEventListeners();
        }

        /**
         * 이벤트 리스너 설정
         */
        setupEventListeners() {
            // 탭 변경, 카드 클릭 등의 이벤트 처리
            const tabLinks = document.querySelectorAll(`#${this.options.categoryTabsId} .nav-link`);
            
            tabLinks.forEach(tab => {
                tab.addEventListener('click', (event) => {
                    // 탭 클릭 이벤트 처리 (필요한 경우)
                    if (this.options.onTabChange) {
                        const tabId = event.target.id;
                        const category = event.target.textContent.trim();
                        this.options.onTabChange(tabId, category);
                    }
                });
            });
        }

        /**
         * 오류 메시지를 표시하는 함수
         */
        displayErrorMessage(message) {
            const container = document.getElementById(this.options.contentContainerId);
            if (!container) {
                console.error(`Element with id "${this.options.contentContainerId}" not found.`);
                return;
            }

            container.innerHTML = `<div class="alert alert-danger" role="alert">${message}</div>`;
        }
    }

    /**
     * 페이지 로드 시 카드 프로젝트 관리자 초기화
     */
    document.addEventListener("DOMContentLoaded", function() {
        // 페이지 설정 가져오기
        const pageConfig = getPageConfig();
        
        // 카드 프로젝트 관리자 초기화
        new CardProjectManager(pageConfig);
        
        console.log(`카드 프로젝트 관리자가 초기화되었습니다. 페이지: ${pageConfig.pageTitle}`);
    });

})();