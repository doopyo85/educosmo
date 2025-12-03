document.addEventListener("DOMContentLoaded", async function() {
    try {
        await loadClassData(); 
    } catch (error) {
        console.error('Error loading data:', error);
        displayErrorMessage("데이터를 불러오는 중 오류가 발생했습니다.");
    }
});

// 서버 API를 통해 클래스데이터를 가져오는 함수
async function loadClassData() {
    try {
        // API 경로가 라우터 설정과 일치하는지 확인
        const response = await fetch('/api/get-onlineclass-data');
        
        if (!response.ok) {
            console.error(`API 요청 실패: ${response.status}`);
            throw new Error(`API 응답이 정상이 아닙니다: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const projects = groupByCategory(data);
            displayTabsAndProjects(projects);
        } else {
            displayErrorMessage("스프레드시트에서 데이터를 찾을 수 없습니다.");
        }
    } catch (error) {
        console.error('온라인 클래스 데이터 로딩 오류:', error);
        displayErrorMessage("온라인 클래스 데이터를 불러오는 중 오류가 발생했습니다.");
    }
}

// 데이터를 카테고리별로 그룹화하는 함수
function groupByCategory(data) {
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

// 동적으로 탭과 프로젝트 데이터를 HTML에 표시하는 함수
function displayTabsAndProjects(projects) {
    const tabsContainer = document.getElementById('categoryTabs');
    const contentContainer = document.getElementById('content-container');
    
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

            const cardContent = `
                <div class="card h-100">
                    <img src="${project.imgURL}" class="card-img-top" alt="${project.name}">
                    <div class="card-body">
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
}

// 오류 메시지를 표시하는 함수
function displayErrorMessage(message) {
    const container = document.getElementById('content-container');
    if (!container) {
        console.error('Element with id "content-container" not found.');
        return;
    }

    container.innerHTML = `<div class="alert alert-danger" role="alert">${message}</div>`;
}
