/**
 * NavigationComponent.js - 내비게이션 컴포넌트 구현 (개선 버전)
 * 왼쪽 메뉴 영역을 관리하는 컴포넌트입니다.
 */

class NavigationComponent extends Component {
  /**
   * 내비게이션 컴포넌트 생성자
   * @param {Object} options - 컴포넌트 옵션
   */
  constructor(options) {
    options = options || {};
    super(options);
    this.navListId = options.navListId || 'navList';
    this.navList = null;
    this.menuData = [];
    this.processedMenuData = [];
    this.currentMenuItem = null;
    this.initializationAttempts = 0;
    this.pageType = options.pageType || 'template'; // 기본값을 template로 설정
  }

  /**
   * 컴포넌트 초기화
   * @param {Array} menuData - 메뉴 데이터
   * @returns {Promise} - 초기화 성공 여부
   */
  init(menuData) {
    var self = this;
    menuData = menuData || null;

    return new Promise(function (resolve) {
      // 기본 초기화
      Promise.resolve(Component.prototype.init.call(self))
        .then(function (result) {
          if (!result) {
            resolve(false);
            return;
          }

          // 페이지 타입 설정 (전역 변수에서 가져오기)
          if (window.PAGE_TYPE) {
            self.pageType = window.PAGE_TYPE;
          }

          console.log('NavigationComponent 초기화 - 페이지 타입:', self.pageType);

          // 내비게이션 목록 요소 참조 가져오기
          self.navList = document.getElementById(self.navListId);

          if (!self.navList) {
            if (self.initializationAttempts >= 3) {
              console.error('내비게이션 목록 요소를 찾을 수 없어 초기화를 중단합니다.');
              resolve(false);
              return;
            }

            self.initializationAttempts++;
            console.warn('내비게이션 목록 요소(' + self.navListId + ')를 찾을 수 없습니다. 재시도합니다.');

            setTimeout(function () {
              var navContainer = document.getElementById(self.elementId);

              if (navContainer) {
                self.navList = document.getElementById(self.navListId);

                if (!self.navList) {
                  self.navList = document.createElement('ul');
                  self.navList.id = self.navListId;
                  self.navList.className = 'list-unstyled';
                  navContainer.appendChild(self.navList);
                  console.log('내비게이션 목록 요소가 생성되었습니다.');
                }

                self.setupEventListeners();

                // 메뉴 데이터가 없으면 서버에서 로드
                if (!menuData) {
                  self.loadMenuDataFromServer().then(function (loadedData) {
                    if (loadedData && loadedData.length > 0) {
                      self.menuData = loadedData;
                      self.processedMenuData = self.processMenuData(loadedData);
                      self.renderMenu();
                    }
                    resolve(true);
                  }).catch(function (error) {
                    console.error('서버에서 메뉴 데이터 로드 실패:', error);
                    resolve(false);
                  });
                } else {
                  self.menuData = menuData;
                  self.processedMenuData = self.processMenuData(menuData);
                  self.renderMenu();
                  resolve(true);
                }
              } else {
                console.error('내비게이션 컨테이너(' + self.elementId + ')를 찾을 수 없습니다.');
                resolve(false);
              }
            }, 100 * self.initializationAttempts);

            return;
          }

          self.setupEventListeners();

          // 🔥 추가: 사이드바 헤드 생성
          self.createSidebarHeader();

          // 🔥 추가: 사이드바 토글 버튼 생성
          self.createSidebarToggleButton();

          // 🔥 추가: 사이드바 하단 (아이콘 + 로그인) 생성
          self.createSidebarBottom();

          // 메뉴 데이터 처리
          if (menuData) {
            self.menuData = menuData;
            self.processedMenuData = self.processMenuData(menuData);
            self.renderMenu();
            resolve(true);
          } else {
            // 서버에서 메뉴 데이터 로드
            self.loadMenuDataFromServer().then(function (loadedData) {
              if (loadedData && loadedData.length > 0) {
                self.menuData = loadedData;
                self.processedMenuData = self.processMenuData(loadedData);
                self.renderMenu();
              }
              resolve(true);
            }).catch(function (error) {
              console.error('서버에서 메뉴 데이터 로드 실패:', error);
              resolve(false);
            });
          }
        })
        .catch(function (error) {
          console.error('NavigationComponent 초기화 중 오류:', error);
          resolve(false);
        });
    });
  }

  /**
   * 서버에서 메뉴 데이터 로드
   * @returns {Promise<Array>} - 메뉴 데이터
   */
  loadMenuDataFromServer() {
    var self = this;

    return new Promise(function (resolve, reject) {
      // API 엔드포인트 결정
      var apiUrl = self.getApiEndpoint();

      console.log('메뉴 데이터 로드 중:', apiUrl);

      fetch(apiUrl)
        .then(function (response) {
          if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
          }
          return response.json();
        })
        .then(function (data) {
          console.log('메뉴 데이터 로드 완료:', data.length + '개 항목');
          resolve(data);
        })
        .catch(function (error) {
          console.error('메뉴 데이터 로드 오류:', error);

          // 오류 시 임시 데이터 생성
          var fallbackData = [
            ['임시파일1.html', '테스트 메뉴', '테스트 항목 1', 'test1', '', 'html'],
            ['임시파일2.html', '테스트 메뉴', '테스트 항목 2', 'test2', '', 'ide'],
            ['테스트.pdf', '테스트 메뉴', 'PDF 테스트', 'pdftest', 'https://example.com/test.pdf', 'ppt']
          ];

          console.log('임시 메뉴 데이터 사용');
          resolve(fallbackData);
        });
    });
  }

  /**
   * API 엔드포인트 결정
   * @returns {String} - API URL
   */
  getApiEndpoint() {
    var endpoints = {
      'python': '/api/get-python-data',
      'algorithm': '/api/get-algorithm-data',
      'aiMath': '/api/get-aimath-data',
      'certification': '/api/get-certification-data',
      'dataAnalysis': '/api/get-dataanalysis-data', // 🔥 추가: DataAnalysis 매핑
      'quiz': '/api/get-quiz-exams',  // 🔥 추가: 퀴즈 시험지 목록 API
      'template': '/api/get-template-data'
    };

    var endpoint = endpoints[this.pageType] || '/api/get-menu-data?pageType=' + this.pageType;
    console.log(this.pageType + ' 페이지의 메뉴 데이터 엔드포인트:', endpoint);
    return endpoint;
  }

  /**
  * 메뉴 데이터 처리 (수정된 버전 - 객체와 배열 모두 처리)
  * @param {Array} data - 메뉴 데이터 (배열 또는 이미 처리된 객체)
  * @returns {Array} - 처리된 메뉴 데이터
  */
  processMenuData(data) {
    var processedMenus = [];

    if (!Array.isArray(data)) {
      console.error('유효하지 않은 메뉴 데이터입니다.');
      return processedMenus;
    }

    console.log('메뉴 데이터 처리 시작:', data.length + '개 항목');
    if (data.length > 0) {
      console.log('첫 번째 메뉴 항목 예시:', data[0]);
    }

    // 🔥 수정: 데이터 타입에 따른 처리 분기
    for (var i = 0; i < data.length; i++) {
      var item = data[i];

      console.log('[' + i + '] 원본 데이터:', item);
      console.log('[' + i + '] 데이터 타입:', typeof item, '배열 여부:', Array.isArray(item));

      // 🔥 추가: 이미 처리된 객체인지 확인
      if (typeof item === 'object' && !Array.isArray(item) &&
        item.hasOwnProperty('topLevelMenu') &&
        item.hasOwnProperty('subMenu') &&
        item.hasOwnProperty('examName')) {

        console.log('[' + i + '] ✅ 이미 처리된 객체 데이터 사용:', item.subMenu);

        // 이미 처리된 객체를 그대로 사용
        processedMenus.push({
          topLevelMenu: item.topLevelMenu || '',
          subMenu: item.subMenu || '',
          examName: item.examName || '',
          pptUrl: item.pptUrl || '',
          layoutType: item.layoutType || 'html'
        });

        continue;
      }

      // 🔥 기존: 배열 형태의 원본 데이터 처리
      if (!Array.isArray(item)) {
        console.warn('[' + i + '] 배열이 아닌 메뉴 항목 무시:', item);
        continue;
      }

      if (item.length < 3) {
        console.warn('[' + i + '] 불완전한 메뉴 항목 무시 (최소 3개 필드 필요). 실제 길이:', item.length, '내용:', item);
        continue;
      }

      // 구글 시트의 컬럼 구조에 맞게 데이터 추출
      var topLevelMenu = String(item[0] || '').trim();
      var subMenu = String(item[1] || '').trim();
      var examName = String(item[2] || '').trim();
      var pptUrl = item.length > 3 ? String(item[3] || '').trim() : '';

      console.log('[' + i + '] 추출된 필드 값:');
      console.log('  - topLevelMenu:', '"' + topLevelMenu + '"');
      console.log('  - subMenu:', '"' + subMenu + '"');
      console.log('  - examName:', '"' + examName + '"');
      console.log('  - pptUrl:', '"' + pptUrl + '"');

      // 상위 메뉴와 하위 메뉴는 필수
      if (!topLevelMenu || !subMenu) {
        console.warn('[' + i + '] 상위/하위 메뉴 필드 누락된 항목 무시:');
        console.warn('  - topLevelMenu 비어있음:', !topLevelMenu);
        console.warn('  - subMenu 비어있음:', !subMenu);
        console.warn('  - 원본 item:', item);
        continue;
      }

      // 시험지명이 비어 있지만 PPT URL이 있는 경우 자동 생성
      if ((!examName || examName === '') && pptUrl) {
        try {
          var urlParts = pptUrl.split('/');
          var fileName = urlParts[urlParts.length - 1].split('.')[0];
          examName = fileName || ('auto_generated_' + i);
          console.log('[' + i + '] 시험지명 자동 생성:', examName + ' (' + subMenu + ')');
        } catch (e) {
          examName = topLevelMenu.toLowerCase().replace(/\s+/g, '_') + '_' + i;
          console.log('[' + i + '] 시험지명 대체 생성:', examName + ' (' + subMenu + ')');
        }
      }

      // 자동 생성 후에도 시험지명이 없으면 건너뛰기
      if (!examName) {
        console.warn('[' + i + '] 시험지명 없는 항목 무시:', item);
        continue;
      }

      // 기본 레이아웃 타입은 HTML
      var layoutType = 'html';

      // PPT URL 확인
      var isPptUrl = pptUrl && (
        pptUrl.toLowerCase().indexOf('.pdf') !== -1 ||
        pptUrl.toLowerCase().indexOf('.ppt') !== -1 ||
        pptUrl.toLowerCase().indexOf('.pptx') !== -1
      );

      // E열 값 확인 (타입)
      if (item.length > 4 && item[4]) {
        var typeValue = String(item[4] || '').toLowerCase().trim();

        console.log('[' + i + '] 메뉴 항목 타입: "' + typeValue + '" (' + subMenu + ')');

        if (typeValue === 'ppt') {
          layoutType = 'ppt';
          console.log('[' + i + '] PPT 타입 감지:', subMenu);
        } else if (typeValue === 'quiz') {
          layoutType = 'quiz';
          console.log('[' + i + '] 퀴즈 타입 감지:', subMenu);
        } else if (typeValue === 'ide') {
          layoutType = 'ide';
          console.log('[' + i + '] IDE 타입 감지:', subMenu);
        } else if (typeValue === 'jupyter') {
          layoutType = 'jupyter';
          console.log('[' + i + '] 🔥 Jupyter 타입 감지:', subMenu);
        } else if (typeValue === 'html') {
          layoutType = 'html';
          console.log('[' + i + '] HTML 타입 감지:', subMenu);
        } else if (typeValue === 'md') {
          layoutType = 'html'; // 마크다운도 HTML로 처리
          console.log('[' + i + '] 마크다운 타입 감지 (HTML로 처리):', subMenu);
        }
      }

      // URL이 PDF/PPT인 경우도 PPT 타입으로 설정
      if (isPptUrl) {
        layoutType = 'ppt';
        console.log('[' + i + '] PPT URL 감지:', subMenu + ', URL:', pptUrl);
      }

      // 페이지 타입에 따른 기본 레이아웃 타입 설정
      if (layoutType !== 'ppt') {
        if (this.pageType === 'python' || this.pageType === 'algorithm') {
          layoutType = 'ide';
          console.log('[' + i + '] 페이지 타입 ' + this.pageType + '에 맞춰 IDE 레이아웃으로 변경:', subMenu);
        } else if (this.pageType === 'certification') {
          layoutType = 'quiz';
          console.log('[' + i + '] 페이지 타입 ' + this.pageType + '에 맞춰 퀴즈 레이아웃으로 변경:', subMenu);
        }
      }

      console.log('[' + i + '] ✅ 항목 처리 성공:', subMenu);

      // 메뉴 항목 추가
      processedMenus.push({
        topLevelMenu: topLevelMenu,
        subMenu: subMenu,
        examName: examName,
        pptUrl: pptUrl,
        layoutType: layoutType
      });
    }

    console.log('처리된 메뉴 항목 수:', processedMenus.length);

    // 레이아웃 타입별 항목 수 로깅
    var pptItems = [];
    var quizItems = [];
    var ideItems = [];
    var htmlItems = [];
    var jupyterItems = []; // 🔥 추가

    for (var i = 0; i < processedMenus.length; i++) {
      switch (processedMenus[i].layoutType) {
        case 'ppt': pptItems.push(processedMenus[i]); break;
        case 'quiz': quizItems.push(processedMenus[i]); break;
        case 'ide': ideItems.push(processedMenus[i]); break;
        case 'jupyter': jupyterItems.push(processedMenus[i]); break; // 🔥 추가
        default: htmlItems.push(processedMenus[i]); break;
      }
    }

    console.log('PPT 레이아웃 항목 수:', pptItems.length);
    console.log('퀴즈 레이아웃 항목 수:', quizItems.length);
    console.log('IDE 레이아웃 항목 수:', ideItems.length);
    console.log('🔥 Jupyter 레이아웃 항목 수:', jupyterItems.length);
    console.log('HTML 레이아웃 항목 수:', htmlItems.length);

    // 메뉴 항목이 없으면 임시 메뉴 항목 생성
    if (processedMenus.length === 0) {
      console.warn('처리된 메뉴 항목이 없음. 임시 메뉴 항목 생성');

      var defaultLayoutType = 'html';

      if (this.pageType === 'python' || this.pageType === 'algorithm') {
        defaultLayoutType = 'ide';
      } else if (this.pageType === 'certification') {
        defaultLayoutType = 'quiz';
      } else if (this.pageType === 'aiMath') {
        defaultLayoutType = 'ppt';
      }

      processedMenus.push({
        topLevelMenu: '기본 메뉴',
        subMenu: '임시 항목',
        examName: this.pageType + '_default',
        pptUrl: '',
        layoutType: defaultLayoutType
      });

      console.log('임시 메뉴 항목 생성됨:', processedMenus[0]);
    }

    return processedMenus;
  }

  /**
   * 메뉴 렌더링 (누락된 메서드 추가)
   */
  renderMenu() {
    if (!this.navList) {
      console.error('네비게이션 목록 요소를 찾을 수 없습니다');
      return;
    }

    if (!this.processedMenuData || !Array.isArray(this.processedMenuData) || this.processedMenuData.length === 0) {
      console.error('유효하지 않은 메뉴 데이터');
      this.navList.innerHTML = '<li class="menu-item">메뉴 데이터를 불러올 수 없습니다.</li>';
      return;
    }

    this.navList.innerHTML = ''; // 기존 메뉴 항목 제거

    // 상위 메뉴별로 그룹화
    var topLevelMenus = {};

    for (var i = 0; i < this.processedMenuData.length; i++) {
      var item = this.processedMenuData[i];
      if (!topLevelMenus[item.topLevelMenu]) {
        topLevelMenus[item.topLevelMenu] = [];
      }
      topLevelMenus[item.topLevelMenu].push(item);
    }

    var index = 0;
    var firstSubmenu = null;

    for (var topLevelMenu in topLevelMenus) {
      if (topLevelMenus.hasOwnProperty(topLevelMenu)) {
        var subMenus = topLevelMenus[topLevelMenu];
        var topLevelMenuItem = this.createTopLevelMenuItem(topLevelMenu, index);
        var subMenuContainer = this.createSubMenuContainer(subMenus, index);

        this.navList.appendChild(topLevelMenuItem);
        this.navList.appendChild(subMenuContainer);

        // 첫 번째 하위 메뉴 저장
        if (index === 0 && subMenus.length > 0) {
          firstSubmenu = subMenus[0];
        }

        index++;
      }
    }

    // Bootstrap collapse 설정
    this.setupCollapseEvents();

    // 첫 번째 메뉴 항목 자동 선택
    if (firstSubmenu) {
      this.selectFirstMenuItem(firstSubmenu);
    }
  }



  /**
   * Bootstrap collapse 이벤트 설정
   */
  setupCollapseEvents() {
    var self = this;
    var collapseElements = document.querySelectorAll('[data-bs-toggle="collapse"]');

    for (var i = 0; i < collapseElements.length; i++) {
      var el = collapseElements[i];

      el.addEventListener('click', function (event) {
        event.preventDefault();
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
          try {
            var bsCollapse = new bootstrap.Collapse(target, {
              toggle: false,
              parent: false,
              animation: false  // 🔥 추가: 애니메이션 비활성화
            });

            if (target.classList.contains('show')) {
              bsCollapse.hide();
            } else {
              // 다른 열린 메뉴 닫기
              var openMenus = document.querySelectorAll('.collapse.show');
              for (var j = 0; j < openMenus.length; j++) {
                var openMenu = openMenus[j];
                if (openMenu !== target) {
                  var openMenuCollapse = new bootstrap.Collapse(openMenu, {
                    toggle: false
                  });
                  openMenuCollapse.hide();
                }
              }
              bsCollapse.show();
            }
          } catch (error) {
            console.error('Bootstrap Collapse 작업 중 오류:', error);
          }
        }
        self.updateToggleIcon(this);
      });
    }
  }

  /**
   * 상위 메뉴 항목 생성
   */
  createTopLevelMenuItem(topLevelMenu, index) {
    var topLevelMenuItem = document.createElement('li');
    topLevelMenuItem.classList.add('menu-item');

    var link = document.createElement('a');
    link.href = '#collapse' + index;
    link.setAttribute('data-bs-toggle', 'collapse');
    link.setAttribute('role', 'button');
    link.setAttribute('aria-expanded', 'false');
    link.setAttribute('aria-controls', 'collapse' + index);
    link.textContent = topLevelMenu;
    link.classList.add('d-flex', 'justify-content-between', 'align-items-center');

    var arrow = document.createElement('i');
    arrow.classList.add('bi', 'bi-chevron-down');
    link.appendChild(arrow);

    topLevelMenuItem.appendChild(link);
    return topLevelMenuItem;
  }

  /**
   * 사이드바 토글 버튼 생성
   */
  createSidebarToggleButton() {
    // 이미 존재하는지 확인
    if (document.querySelector('.nav-toggle-btn')) return;

    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'nav-toggle-btn';
    toggleBtn.innerHTML = '<i class="bi bi-layout-sidebar"></i>';
    toggleBtn.title = '사이드바 접기/펼치기';

    toggleBtn.addEventListener('click', this.toggleSidebar.bind(this));

    // navList가 아니라 navContainer에 추가해야 함
    if (this.navList && this.navList.parentElement) {
      this.navList.parentElement.appendChild(toggleBtn);
    }
  }

  /**
   * 사이드바 헤드 생성
   */
  createSidebarHeader() {
    if (document.querySelector('.sidebar-header')) return;

    var header = document.createElement('div');
    header.className = 'sidebar-header';

    // 페이지 타입에 따른 타이틀 설정
    var pageTitle = 'Project';
    if (this.pageType) {
      if (this.pageType === 'python') pageTitle = 'Python';
      else if (this.pageType === 'algorithm') pageTitle = 'Algorithm';
      else if (this.pageType === 'aiMath') pageTitle = 'AI Math';
      else if (this.pageType === 'certification') pageTitle = 'Certification';
      else if (this.pageType === 'dataAnalysis') pageTitle = 'Data Analysis';
      else if (this.pageType === 'entry') pageTitle = 'Entry';
      else if (this.pageType === 'scratch') pageTitle = 'Scratch';
      else if (this.pageType === 'appinventor') pageTitle = 'App Inventor';
      else pageTitle = this.pageType.charAt(0).toUpperCase() + this.pageType.slice(1);
    }

    var titleSpan = document.createElement('span');
    titleSpan.className = 'sidebar-title';
    titleSpan.textContent = pageTitle;

    header.appendChild(titleSpan);

    // navList 이전에 추가
    if (this.navList && this.navList.parentElement) {
      this.navList.parentElement.insertBefore(header, this.navList);
    }
  }

  /**
   * 사이드바 하단 영역 생성 (아이콘 그룹 + 로그인 버튼)
   */
  createSidebarBottom() {
    if (document.querySelector('.sidebar-bottom')) return;

    var bottomSection = document.createElement('div');
    bottomSection.className = 'sidebar-bottom';

    // 1. 아이콘 그룹 (4개)
    var iconGroup = document.createElement('div');
    iconGroup.className = 'sidebar-icon-group';

    // 아이콘 데이터 (예시)
    var icons = [
      { icon: 'bi-grid-fill', label: 'Dashboard' },
      { icon: 'bi-gear-fill', label: 'Settings' },
      { icon: 'bi-bell-fill', label: 'Notifications' },
      { icon: 'bi-question-circle-fill', label: 'Help' }
    ];

    icons.forEach(function (item) {
      var iconBtn = document.createElement('button');
      iconBtn.className = 'sidebar-icon-btn';
      iconBtn.title = item.label;
      iconBtn.innerHTML = '<i class="bi ' + item.icon + '"></i>';
      iconGroup.appendChild(iconBtn);
    });

    bottomSection.appendChild(iconGroup);

    // 2. 로그인 섹션
    var loginSection = document.createElement('div');
    loginSection.className = 'sidebar-login-section';

    var loginBtn = document.createElement('button');
    loginBtn.className = 'btn btn-primary w-100 sidebar-login-btn';
    loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Login';

    // 로그인 페이지로 이동
    loginBtn.onclick = function () {
      window.location.href = '/auth/login';
    };

    loginSection.appendChild(loginBtn);
    bottomSection.appendChild(loginSection);

    // navContainer의 마지막에 추가
    if (this.navList && this.navList.parentElement) {
      this.navList.parentElement.appendChild(bottomSection);
    }
  }

  /**
   * 사이드바 토글
   */
  toggleSidebar() {
    var mainContainer = document.querySelector('.main-container');
    var navContainer = document.querySelector('.nav-container');
    var toggleBtnIcon = document.querySelector('.nav-toggle-btn i');

    if (navContainer) {
      navContainer.classList.toggle('collapsed');

      // 메인 컨테이너에도 클래스 토글 (레이아웃 조정을 위해)
      if (mainContainer) {
        mainContainer.classList.toggle('sidebar-collapsed');
      }

      // 아이콘 방향 변경 (햄버거 메뉴로 변경되어 회전 로직 제거)
      /*
      if (navContainer.classList.contains('collapsed')) {
        if (toggleBtnIcon) {
          toggleBtnIcon.classList.remove('bi-chevron-left');
          toggleBtnIcon.classList.add('bi-chevron-right');
        }
        // 접혔을 때 열려있던 메뉴들 닫기
        var openMenus = document.querySelectorAll('.collapse.show');
        openMenus.forEach(function (el) {
          var bsCollapse = bootstrap.Collapse.getInstance(el);
          if (bsCollapse) bsCollapse.hide();
        });
      } else {
        if (toggleBtnIcon) {
          toggleBtnIcon.classList.remove('bi-chevron-right');
          toggleBtnIcon.classList.add('bi-chevron-left');
        }
      }
      */

      // 접혔을 때 열려있던 메뉴들 닫기 기능만 유지
      if (navContainer.classList.contains('collapsed')) {
        var openMenus = document.querySelectorAll('.collapse.show');
        openMenus.forEach(function (el) {
          var bsCollapse = bootstrap.Collapse.getInstance(el);
          if (bsCollapse) bsCollapse.hide();
        });
      }

      // 리사이즈 이벤트 발생 (에디터 등 크기 조정을 위해)
      window.dispatchEvent(new Event('resize'));
    }
  }

  /**
   * 하위 메뉴 컨테이너 생성
   */
  createSubMenuContainer(subMenus, index) {
    var container = document.createElement('div');
    container.id = 'collapse' + index;
    container.classList.add('collapse');

    var subMenuList = document.createElement('ul');
    subMenuList.classList.add('list-unstyled');

    for (var i = 0; i < subMenus.length; i++) {
      var item = subMenus[i];
      var subMenuItem = document.createElement('li');
      subMenuItem.classList.add('menu-item');
      subMenuItem.setAttribute('data-exam-name', item.examName);
      subMenuItem.setAttribute('data-layout-type', item.layoutType);

      if (item.layoutType === 'ppt' && item.pptUrl) {
        subMenuItem.setAttribute('data-ppt-url', item.pptUrl);
      }

      // 레이아웃 타입에 따른 아이콘 선택
      var icon = document.createElement('i');

      switch (item.layoutType) {
        case 'ppt':
          icon.classList.add('bi', 'bi-file-earmark-slides', 'me-2');
          break;
        case 'quiz':
          icon.classList.add('bi', 'bi-clipboard-check', 'me-2');
          break;
        case 'ide':
          icon.classList.add('bi', 'bi-code-square', 'me-2');
          break;
        default:
          icon.classList.add('bi', 'bi-file-text', 'me-2');
          break;
      }

      subMenuItem.appendChild(icon);

      var text = document.createTextNode(item.subMenu);
      subMenuItem.appendChild(text);

      // 디버깅 정보 표시 (개발 중에만 사용)
      if (item.layoutType === 'ppt') {
        var debugSpan = document.createElement('span');
        debugSpan.style.fontSize = '0.8rem';
        debugSpan.style.color = '#999';
        debugSpan.style.marginLeft = '5px';
        debugSpan.textContent = '[PPT]';
        subMenuItem.appendChild(debugSpan);
      }

      subMenuList.appendChild(subMenuItem);
    }

    container.appendChild(subMenuList);
    return container;
  }


  /**
   * 토글 아이콘 업데이트
   */
  updateToggleIcon(element) {
    var icon = element.querySelector('.bi');
    if (icon) {
      var targetId = element.getAttribute('href');
      var targetElement = document.querySelector(targetId);

      if (targetElement && targetElement.classList.contains('show')) {
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
      } else {
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
      }
    }
  }


  /**
   * 첫 번째 메뉴 항목 선택 (누락된 메서드 추가)
   */
  selectFirstMenuItem(firstItem) {
    var self = this;

    setTimeout(function () {
      if (window.EventBus) {
        var eventData = {
          examName: firstItem.examName || '',
          layoutType: firstItem.layoutType || 'html',
          pptUrl: firstItem.pptUrl || ''
        };

        console.log('첫 번째 메뉴 항목 자동 선택:', eventData);
        window.EventBus.publish('menuSelected', eventData);

        // 첫 번째 메뉴 항목에 active 클래스 추가
        var firstMenuItem = document.querySelector('.menu-item[data-exam-name="' + firstItem.examName + '"]');
        if (firstMenuItem) {
          firstMenuItem.classList.add('active');
          self.currentMenuItem = firstMenuItem;

          // 상위 메뉴 펼치기
          var collapseContainer = firstMenuItem.closest('.collapse');
          if (collapseContainer && !collapseContainer.classList.contains('show')) {
            try {
              var collapse = new bootstrap.Collapse(collapseContainer, { toggle: false });
              collapse.show();
            } catch (error) {
              console.error('첫 번째 메뉴 펼치기 오류:', error);
            }
          }
        }
      }
    }, 100);
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    var self = this;

    if (!this.navList) {
      console.warn('navList 요소를 찾을 수 없습니다. 이벤트 리스너 설정을 위해 재시도합니다.');
      setTimeout(function () {
        self.navList = document.getElementById(self.navListId);
        if (self.navList) {
          self.navList.addEventListener('click', self.handleMenuClick.bind(self));
          console.log('지연 설정: navList에 이벤트 리스너 설정 완료');
        } else {
          console.error('navList 요소를 찾을 수 없습니다. 이벤트 리스너를 설정할 수 없습니다.');
        }
      }, 200);
      return;
    }

    this.navList.addEventListener('click', this.handleMenuClick.bind(this));

    if (window.EventBus) {
      window.EventBus.subscribe('dataLoaded', function (data) {
        if (data && data.menuData) {
          self.menuData = data.menuData;
          self.processedMenuData = self.processMenuData(data.menuData);
          self.renderMenu();
        }
      });
    }
  }

  /**
   * 메뉴 클릭 이벤트 처리
   */
  handleMenuClick(event) {
    var menuItem = null;
    var target = event.target;

    if (target.closest) {
      menuItem = target.closest('.menu-item[data-exam-name]');
    } else {
      while (target && target !== document) {
        if (target.classList &&
          target.classList.contains('menu-item') &&
          target.hasAttribute('data-exam-name')) {
          menuItem = target;
          break;
        }
        target = target.parentNode;
      }
    }

    if (!menuItem) {
      return;
    }

    var examName = menuItem.getAttribute('data-exam-name');
    var layoutType = menuItem.getAttribute('data-layout-type');
    var pptUrl = menuItem.getAttribute('data-ppt-url');

    if (!examName) {
      return;
    }

    if (this.currentMenuItem) {
      this.currentMenuItem.classList.remove('active');
    }

    menuItem.classList.add('active');
    this.currentMenuItem = menuItem;

    if (window.EventBus) {
      var eventData = {
        examName: examName || '',
        layoutType: layoutType || 'html',
        pptUrl: pptUrl || ''
      };

      console.log('메뉴 선택 이벤트 발행:', eventData);
      window.EventBus.publish('menuSelected', eventData);
    }
  }

  // renderMenu, createTopLevelMenuItem, createSubMenuContainer, selectFirstMenuItem 메서드들은 기존과 동일
  // (기존 코드 유지)
}

// 컴포넌트 팩토리에 등록
if (window.ComponentFactory) {
  window.ComponentFactory.registerClass('navigation', NavigationComponent);
}

// 전역 스코프에 NavigationComponent 클래스 노출
window.NavigationComponent = NavigationComponent;