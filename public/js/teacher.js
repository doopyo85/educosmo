// 전역 변수 선언을 파일 맨 위로 이동하고 모두 var로 변경
var currentProblemNumber = 1;
var totalProblems = 0;  // 초기값을 0으로 설정
var currentExamName = '';
var problemData = [];
var currentDomain = window.location.hostname; // 현재 도메인 저장

document.addEventListener("DOMContentLoaded", function() {
    if (!window.menuLoaded) {
        const googleApiKey = document.getElementById('googleApiKey').value;
        const spreadsheetId = document.getElementById('spreadsheetId').value;

        if (googleApiKey && spreadsheetId) {
            if (typeof gapi !== 'undefined') {
                gapi.load('client', initClient);
            } else {
                console.error('Google API not loaded');
            }
        } else {
            console.error('Required elements not found');
        }

        window.menuLoaded = true;
    }
    setupEventListeners(); // 여기에 추가
});

// 데이터 로딩을 기다리는 함수
function waitForDataLoading() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkData = () => {
            if (typeof menuData !== 'undefined' && menuData) {
                resolve();
            } else if (attempts < 20) {  // 최대 10초 대기
                attempts++;
                setTimeout(checkData, 500);
            } else {
                reject(new Error("Data loading timeout"));
            }
        };
        checkData();
    });
}
document.addEventListener("DOMContentLoaded", function() {
    loadMenuData(); // 서버에서 메뉴 데이터 로드
    setupEventListeners(); // 이벤트 리스너 설정
});

// 서버에서 메뉴 데이터 가져오기
async function loadMenuData() {
    try {
        const response = await fetch('/api/get-teachermenu-data'); // 서버의 API 호출
        const menuData = await response.json();
        if (menuData && menuData.length > 0) {
            renderMenu(menuData); // 메뉴 렌더링
            loadProblemData();    // 문제 데이터 로드
        } else {
            throw new Error('No menu data loaded');
        }
    } catch (error) {
        console.error('Error loading menu data:', error);
    }
}

function fetchUserData() {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        fetch('/api/get-user', { credentials: 'include' })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text(); // JSON.parse 대신 text()를 사용
            })
            .then(data => {
                try {
                    const jsonData = JSON.parse(data);
                    userNameElement.innerText = jsonData.username || "로그인 정보 미확인";
                } catch (error) {
                    console.error('Error parsing user data:', error);
                    userNameElement.innerText = "로그인 정보 미확인";
                }
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                userNameElement.innerText = "로그인 정보 미확인";
            });
    }
}
  
function renderMenu(data) {
    const navList = document.getElementById('navList');
    if (!navList) {
        console.error('Navigation list element not found');
        return;
    }

    navList.innerHTML = ''; // 기존 메뉴 초기화

    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error('Invalid menu data');
        return;
    }

    const topLevelMenus = new Map();
    data.forEach(function(row) {
        if (row && row.length >= 3) {
            const [topLevelMenu, subMenu, url] = row;
            if (!topLevelMenus.has(topLevelMenu)) {
                topLevelMenus.set(topLevelMenu, []);
            }
            topLevelMenus.get(topLevelMenu).push({ subMenu, url });
        }
    });

    let index = 0;
    topLevelMenus.forEach(function(subMenus, topLevelMenu) {
        const hasSubMenus = subMenus.some(item => item.subMenu.trim() !== ""); // 서브메뉴 존재 여부 확인
        const topLevelMenuItem = document.createElement('li');
        topLevelMenuItem.classList.add('menu-item');

        const link = document.createElement('a');
        link.href = hasSubMenus ? `#collapse${index}` : '#'; // 서브메뉴가 없어도 URL로 직접 이동하지 않음
        link.setAttribute('role', 'button');
        link.classList.add('d-flex', 'justify-content-between', 'align-items-center');
        link.textContent = topLevelMenu;
        
        if (hasSubMenus) {
            link.setAttribute('data-bs-toggle', 'collapse');
            link.setAttribute('aria-expanded', 'false');
            link.setAttribute('aria-controls', `collapse${index}`);
            
            const arrow = document.createElement('i');
            arrow.classList.add('bi', 'bi-chevron-down');
            link.appendChild(arrow);
        } else {
            // 서브메뉴가 없는 경우 클릭 이벤트 추가
            link.addEventListener('click', function(e) {
                e.preventDefault();
                handleNavigation(subMenus[0].url);
            });
        }

        topLevelMenuItem.appendChild(link);
        navList.appendChild(topLevelMenuItem);

        if (hasSubMenus) {
            const subMenuItems = createSubMenuItems(subMenus, index);
            navList.appendChild(subMenuItems);
        }

        index++;
    });
}
    
// 아이콘 변경
function updateToggleIcon(element) {
    const icon = element.querySelector('.bi');
    if (icon) {
        if (element.getAttribute('aria-expanded') === 'true') {
            icon.classList.remove('bi-chevron-down');
            icon.classList.add('bi-chevron-up');
        } else {
            icon.classList.remove('bi-chevron-up');
            icon.classList.add('bi-chevron-down');
        }
    }
}


function createTopLevelMenuItem(topLevelMenu, index) {
    const topLevelMenuItem = document.createElement('li');
    topLevelMenuItem.classList.add('menu-item');

    const link = document.createElement('a');
    link.href = `#collapse${index}`;
    link.setAttribute('data-bs-toggle', 'collapse');
    link.setAttribute('role', 'button');
    link.setAttribute('aria-expanded', 'false');
    link.setAttribute('aria-controls', `collapse${index}`);
    link.textContent = topLevelMenu;
    link.classList.add('d-flex', 'justify-content-between', 'align-items-center');

    const arrow = document.createElement('i');
    arrow.classList.add('bi', 'bi-chevron-down');
    link.appendChild(arrow);

    topLevelMenuItem.appendChild(link);

    // 화살표 아이콘 회전을 위한 이벤트 리스너 추가
    link.addEventListener('click', function() {
        arrow.classList.toggle('rotate');
    });

    return topLevelMenuItem;
}

function createSubMenuItems(subMenus, index) {
    const subMenuContainer = document.createElement('div');
    subMenuContainer.id = `collapse${index}`;
    subMenuContainer.classList.add('collapse');

    const subMenuList = document.createElement('ul');
    subMenuList.classList.add('list-unstyled', 'pl-3');

    subMenus.forEach(function({ subMenu, url }) {
        if (subMenu.trim() === "") return; // 서브메뉴가 없으면 추가하지 않음

        const subMenuItem = document.createElement('li');
        subMenuItem.classList.add('menu-item');

        const link = document.createElement('a');
        link.href = '#';
        link.textContent = subMenu;
        link.style.textDecoration = "none";
        link.style.color = "inherit";
        
        // URL 처리 로직 변경 - 내부/외부 URL 구분
        link.addEventListener('click', function(e) {
            e.preventDefault();
            handleNavigation(url);
            
            // 선택된 메뉴 하이라이트
            applySubMenuHighlight(subMenuItem);
        });

        subMenuItem.appendChild(link);
        subMenuList.appendChild(subMenuItem);
    });

    subMenuContainer.appendChild(subMenuList);
    return subMenuContainer;
}

// URL에 따라 내부/외부 페이지 구분하여 처리하는 함수
function handleNavigation(url) {
    // URL이 없으면 아무 작업 안함
    if (!url) return;
    
    // URL 객체 생성 시도 (올바른 URL 형식인지 확인)
    let urlObj;
    try {
        // 프로토콜이 없는 경우 (상대 경로) 프로토콜 추가
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
            urlObj = new URL(url, window.location.origin);
        } else {
            urlObj = new URL(url);
        }
    } catch (e) {
        // URL 파싱 오류 - 상대 경로로 가정
        console.log('Invalid URL format, treating as relative path');
        urlObj = new URL(url, window.location.origin);
    }
    
    // 내부 페이지 체크 (같은 도메인 또는 app.codingnplay.co.kr 도메인)
    const isInternalUrl = 
        urlObj.hostname === window.location.hostname || 
        urlObj.hostname === 'app.codingnplay.co.kr' || 
        urlObj.hostname === 'www.app.codingnplay.co.kr';
    
    console.log(`URL: ${url}, isInternal: ${isInternalUrl}`);
    
    if (isInternalUrl) {
        // 내부 URL - iframe에 로드
        loadContentInIframe(url);
    } else {
        // 외부 URL - 새 창에서 열기
        window.open(url, '_blank');
    }
}

// iframe에 컨텐츠 로드하는 함수
function loadContentInIframe(url) {
    // 컨텐츠 컨테이너 확인
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        console.error('Content container not found');
        return;
    }

    // 로딩 메시지 표시 (선택적)
    contentContainer.innerHTML = `
        <div class="loading-message" style="display: flex; justify-content: center; align-items: center; height: 100%;">
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">페이지를 불러오는 중...</p>
            </div>
        </div>
    `;

    // iframe 생성 및 로드
    setTimeout(() => {
        const iframe = document.createElement('iframe');
        iframe.id = 'iframeContent';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.position = 'absolute'; // 절대 위치로 설정
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        
        // 컨테이너의 position을 설정하여 iframe이 컨테이너 내에 상대적으로 배치되도록 함
        contentContainer.style.position = 'relative';
        
        // iframe 로드 이벤트 설정
        iframe.onload = function() {
            resizeIframe(iframe);
        };
        
        // URL이 상대 경로인지 확인
        if (!url.startsWith('http') && !url.startsWith('//')) {
            // 상대 경로는 현재 도메인 기준으로 조정
            iframe.src = url.startsWith('/') ? url : `/${url}`;
        } else {
            // 외부 URL은 그대로 사용
            iframe.src = url;
        }
        
        contentContainer.innerHTML = '';
        contentContainer.appendChild(iframe);
    }, 300); // 로딩 표시를 잠시 보여주기 위한 지연
}

// 아이콘을 변경하는 함수
function toggleArrow(arrow, isOpen) {
    if (isOpen) {
        arrow.classList.remove('bi-chevron-down');
        arrow.classList.add('bi-chevron-up');
    } else {
        arrow.classList.remove('bi-chevron-up');
        arrow.classList.add('bi-chevron-down');
    }
}

// 하위 메뉴 클릭 시 상위 메뉴에 active 클래스 제거, 클릭된 메뉴에 active 클래스 추가
function applySubMenuHighlight(selectedItem) {
    // 모든 메뉴 아이템에서 active 클래스 제거
    document.querySelectorAll('.nav-container .menu-item, .nav-container .sub-menu .menu-item').forEach(item => item.classList.remove('active'));
    
    // 선택된 하위 메뉴 아이템에 active 클래스 추가
    selectedItem.classList.add('active');
    
    // 상위 메뉴 아이템에 active 클래스 제거
    let parentCollapse = selectedItem.closest('.collapse');
    if (parentCollapse) {
        let parentMenuItem = document.querySelector(`[href="#${parentCollapse.id}"]`).closest('.menu-item');
        parentMenuItem.classList.remove('active');
    }
}



function resizeIframe(iframe) {
    if (!iframe) return;

    const container = document.getElementById('content-container');
    if (!container) return;

    // iframe이 컨테이너를 꽉 채우도록 설정
    iframe.style.width = '100%';
    iframe.style.height = '100%';
}

// 창 크기가 변경될 때마다 iframe 크기를 조정합니다
window.addEventListener('resize', function() {
    const iframe = document.getElementById('iframeContent');
    if (iframe) {
        resizeIframe(iframe);
    }
});

// Ensure content and IDE are loaded and displayed side by side
window.addEventListener('load', function() {
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer) {
        contentContainer.style.display = 'flex'; // Set the display as flex for horizontal layout
    }
});

// 이벤트 리스너 설정 함수
function setupEventListeners() {
    // 상위 메뉴 클릭 시 아이콘 변경
    document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(toggle => {
        toggle.addEventListener('click', function() {
            updateToggleIcon(this);
        });
    });
}