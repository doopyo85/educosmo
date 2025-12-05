/**
 * card_project.js
 * Entry, Scratch, AppInventor 프로젝트 카드 공통 JS 파일
 */

class ProjectCardManager {
    constructor(config) {
        this.config = {
            projectType: 'scratch', // 'scratch', 'entry', 또는 'appinventor'
            contentContainerId: 'content-container',
            categoryTabsId: 'categoryTabs',
            apiEndpoints: {
                scratch: {
                    teacher: '/api/sheets/sb2',
                    student: '/api/sheets/sb3'
                },
                entry: '/api/sheets/ent',
                appinventor: '/api/sheets/aia' // 앱인벤터 엔드포인트 추가
            },
            ...config
        };

        this.userRole = '';
        this.userID = '';
        this.centerID = '';
        this.viewConfig = {};
        this.projectData = [];
    }

    /**
     * Entry 파일 다운로드 (순수 다운로드만)
     */
    downloadEntryFile(projectUrl) {
        if (!projectUrl) {
            console.error('프로젝트 URL이 없습니다');
            return;
        }

        try {
            // 파일명 추출
            const fileName = projectUrl.split('/').pop();
            console.log('✅ Entry 파일 다운로드:', fileName);

            // 브라우저 기본 다운로드 기능 사용
            const downloadLink = document.createElement('a');
            downloadLink.href = projectUrl;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';

            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

        } catch (error) {
            console.error('Entry 파일 다운로드 실패:', error);
        }
    }

    /**
     * 🔥 NEW: Entry 파일 다운로드 + playentry.org로 이동
     */
    downloadEntryAndOpenPlayentry(projectUrl) {
        if (!projectUrl) {
            console.error('프로젝트 URL이 없습니다');
            return;
        }

        try {
            // 파일명 추출
            const fileName = projectUrl.split('/').pop();
            console.log('🎯 Entry 파일 다운로드 + playentry.org 이동:', fileName);

            // 1. ENT 파일 다운로드
            const downloadLink = document.createElement('a');
            downloadLink.href = projectUrl;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';

            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // 2. playentry.org 워크스페이스로 이동 (약간의 지연 후)
            setTimeout(() => {
                window.open('https://playentry.org/ws/new', '_blank');

                // 사용자에게 안내 메시지 표시
                setTimeout(() => {
                    alert(`📁 Entry 프로젝트 파일(${fileName})이 다운로드되었습니다.\n\n🌐 Entry 워크스페이스에서 '프로젝트 불러오기' 메뉴를 클릭하여 다운로드된 파일을 업로드하세요.`);
                }, 1000);
            }, 500);

            // 학습 활동 기록
            try {
                fetch('/learning/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'entry_download_and_open_entry_workspace',
                        data: {
                            projectUrl: projectUrl,
                            fileName: fileName,
                            timestamp: new Date().toISOString()
                        }
                    })
                });
            } catch (error) {
                console.error('로그 기록 오류:', error);
            }

        } catch (error) {
            console.error('Entry 파일 다운로드 + playentry.org 이동 실패:', error);
        }
    }

    /**
     * 초기화 및 프로젝트 데이터 로드
     */
    async initialize() {
        try {
            // 사용자 정보 가져오기
            this.userRole = document.getElementById('currentUserRole')?.value || '';
            this.userID = document.getElementById('currentUserID')?.value || '';
            this.centerID = '';

            if (!this.userRole) {
                console.warn('사용자 권한 정보를 찾을 수 없습니다. 기본값 사용.');
                this.userRole = 'student'; // 기본값
            }

            console.log('User Info:', {
                userRole: this.userRole,
                userID: this.userID,
                centerID: this.centerID
            });

            // 권한에 따른 뷰 설정
            this.viewConfig = this.getViewConfigForRole(this.userRole);

            // 프로젝트 데이터 로드
            this.projectData = await this.loadProjectData();

            if (this.projectData && this.projectData.length > 0) {
                const projects = this.groupByProject(this.projectData);
                this.displayProjects(projects);
            } else {
                this.displayErrorMessage("프로젝트 데이터가 없습니다.");
            }
        } catch (error) {
            console.error('Error:', error);
            this.displayErrorMessage("초기화 중 오류가 발생했습니다: " + error.message);
        }
    }

    /**
     * 사용자 권한에 따른 뷰 설정 가져오기
     */
    getViewConfigForRole(userRole) {
        const isTeacherRole = ['admin', 'teacher', 'manager'].includes(userRole);

        if (this.config.projectType === 'scratch') {
            return {
                showPPTButton: isTeacherRole,
                fileType: isTeacherRole ? 'sb2' : 'sb3',
                showExtensions: isTeacherRole,
                canEdit: isTeacherRole
            };
        } else if (this.config.projectType === 'entry') {
            return {
                showPPTButton: isTeacherRole,
                showComplete: isTeacherRole,
                showExtension: true, // 🔥 모든 사용자에게 확장 버튼 표시
                canEdit: isTeacherRole
            };
        } else if (this.config.projectType === 'appinventor') {
            return {
                showPPTButton: isTeacherRole,
                showPractice: isTeacherRole,
                canEdit: isTeacherRole
            };
        } else {
            // 기본 설정
            return {
                showPPTButton: isTeacherRole,
                canEdit: isTeacherRole
            };
        }
    }

    /**
     * 프로젝트 데이터 로드
     */
    async loadProjectData() {
        try {
            let endpoint;

            if (this.config.projectType === 'scratch') {
                const isTeacherRole = ['admin', 'teacher', 'manager'].includes(this.userRole);
                endpoint = isTeacherRole
                    ? this.config.apiEndpoints.scratch.teacher
                    : this.config.apiEndpoints.scratch.student;
            } else if (this.config.projectType === 'entry') {
                endpoint = this.config.apiEndpoints.entry;
            } else if (this.config.projectType === 'appinventor') {
                endpoint = this.config.apiEndpoints.appinventor;
            } else {
                throw new Error(`지원하지 않는 프로젝트 타입: ${this.config.projectType}`);
            }

            console.log(`Loading projects from: ${endpoint}`);
            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`프로젝트 데이터 로드 성공:`, data.length, '항목');
            return data;
        } catch (error) {
            console.error('Error loading project data:', error);
            throw error;
        }
    }

    /**
     * 프로젝트 데이터를 그룹화
     */
    groupByProject(data) {
        if (this.config.projectType === 'scratch') {
            return this.groupScratchProjects(data);
        } else if (this.config.projectType === 'entry') {
            return this.groupEntryProjects(data);
        } else if (this.config.projectType === 'appinventor') {
            return this.groupAppInventorProjects(data);
        }
    }

    /**
     * Scratch 프로젝트 그룹화
     */
    groupScratchProjects(data) {
        const projects = {};

        data.forEach(row => {
            if (!Array.isArray(row) || row.length < 4) return;

            // 새로운 데이터 구조에 맞춰 인덱스 조정
            const [category, name, type, url, ctElement = '', imgUrl = ''] = row;
            const baseName = name.replace(/\([^)]*\)/g, '').trim();

            if (!projects[baseName]) {
                projects[baseName] = {
                    category: category,
                    ctElement: ctElement,
                    img: imgUrl,
                    basic: '',
                    ext1: '',
                    ext2: '',
                    ppt: ''
                };
            }

            // 기능 컬럼의 값에 따라 URL 할당
            switch (type.toLowerCase()) {
                case '기본':
                    projects[baseName].basic = url;
                    break;
                case '확장1':
                    projects[baseName].ext1 = url;
                    break;
                case '확장2':
                    projects[baseName].ext2 = url;
                    break;
                case 'ppt':
                    projects[baseName].ppt = url;
                    break;
            }
        });

        return projects;
    }

    /**
     * Entry 프로젝트 그룹화
     */
    groupEntryProjects(data) {
        const projects = {};

        data.forEach(row => {
            // 구글 시트 데이터 구조에 맞게 인덱스 조정
            const [category, name, type, url, ctElement = ''] = row;

            if (!projects[category]) {
                projects[category] = {};
            }

            const projectKey = name.trim();

            if (!projects[category][projectKey]) {
                projects[category][projectKey] = {
                    name: projectKey,
                    ctElement: ctElement,
                    basic: '',
                    complete: '',
                    extension: '',
                    ppt: ''
                };
            }

            // 타입에 따라 URL 할당
            switch (type.toLowerCase()) {
                case '기본':
                    projects[category][projectKey].basic = url;
                    break;
                case '완성':
                    projects[category][projectKey].complete = url;
                    break;
                case '확장':
                    projects[category][projectKey].extension = url;
                    break;
                case 'ppt':
                    projects[category][projectKey].ppt = url;
                    break;
            }
        });

        return projects;
    }

    /**
     * AppInventor 프로젝트 그룹화
     */
    groupAppInventorProjects(data) {
        const projects = {};

        data.forEach(row => {
            if (!Array.isArray(row) || row.length < 4) return;

            // 앱인벤터 데이터 구조: [카테고리, 콘텐츠명, 기능, aiaURL, C.T요소, IMG]
            const [category, name, type, url, ctElement = '', imgUrl = ''] = row;

            if (!projects[category]) {
                projects[category] = {};
            }

            const projectKey = name.trim();

            if (!projects[category][projectKey]) {
                projects[category][projectKey] = {
                    name: projectKey,
                    ctElement: ctElement,
                    img: imgUrl,
                    basic: '',  // 본문
                    practice: '', // 연습
                    ppt: ''     // PPT 추가
                };
            }

            // 타입에 따라 URL 할당 (본문/연습/PPT)
            if (type.toLowerCase().includes('본문')) {
                projects[category][projectKey].basic = url;
            } else if (type.toLowerCase().includes('연습')) {
                projects[category][projectKey].practice = url;
            } else if (type.toLowerCase().includes('ppt')) {
                projects[category][projectKey].ppt = url;
            }
        });

        return projects;
    }

    /**
     * 프로젝트 표시
     */
    displayProjects(projects) {
        if (this.config.projectType === 'scratch') {
            this.displayScratchProjects(projects);
        } else if (this.config.projectType === 'entry') {
            this.displayEntryProjectsWithTabs(projects);
        } else if (this.config.projectType === 'appinventor') {
            this.displayAppInventorProjectsWithTabs(projects);
        }
    }

    /**
     * Scratch 프로젝트 표시 (탭 없음)
     */
    displayScratchProjects(projects) {
        const container = document.getElementById(this.config.contentContainerId);
        if (!container) {
            console.error(`콘텐츠 컨테이너를 찾을 수 없음: #${this.config.contentContainerId}`);
            return;
        }

        container.innerHTML = '';

        // 프로젝트 카드 그리드 생성
        const gridContainer = document.createElement('div');
        gridContainer.className = 'project-card-grid';

        Object.entries(projects).forEach(([projectName, project]) => {
            const card = this.createProjectCard(projectName, project);
            gridContainer.appendChild(card);
        });

        container.appendChild(gridContainer);
    }

    /**
     * Entry 프로젝트 탭과 함께 표시
     */
    displayEntryProjectsWithTabs(projects) {
        const tabsContainer = document.getElementById(this.config.categoryTabsId);
        const contentContainer = document.getElementById(this.config.contentContainerId);

        if (!tabsContainer || !contentContainer) {
            console.error(`탭 또는 콘텐츠 컨테이너를 찾을 수 없음: #${this.config.categoryTabsId} 또는 #${this.config.contentContainerId}`);
            return;
        }

        // 초기화
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '';

        // 탭과 콘텐츠 생성
        Object.keys(projects).forEach((category, index) => {
            // 탭 생성
            const tabButton = document.createElement('li');
            tabButton.className = 'nav-item';
            tabButton.innerHTML = `
                <button class="nav-link ${index === 0 ? 'active' : ''}" 
                        id="tab-${index}" 
                        data-bs-toggle="tab" 
                        data-bs-target="#content-${index}" 
                        type="button" 
                        role="tab">
                    ${category}
                </button>
            `;
            tabsContainer.appendChild(tabButton);

            // 콘텐츠 패널 생성
            const contentPanel = document.createElement('div');
            contentPanel.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`;
            contentPanel.id = `content-${index}`;

            // 프로젝트 카드 그리드 컨테이너
            const gridContainer = document.createElement('div');
            gridContainer.className = 'project-card-grid';

            // 카테고리 내 프로젝트들에 대한 카드 생성
            Object.values(projects[category]).forEach(project => {
                gridContainer.appendChild(this.createProjectCard(project.name, project));
            });

            contentPanel.appendChild(gridContainer);
            contentContainer.appendChild(contentPanel);
        });
    }

    /**
     * AppInventor 프로젝트 탭과 함께 표시
     */
    displayAppInventorProjectsWithTabs(projects) {
        // Entry와 유사한 방식으로 구현
        this.displayEntryProjectsWithTabs(projects);
    }

    /**
     * 프로젝트 카드 생성
     */
    createProjectCard(projectName, project) {
        const card = document.createElement('div');
        card.className = 'apple-card';

        // Entry 프로젝트일 경우 특별 클래스 추가 (logic might use it)
        if (this.config.projectType === 'entry') {
            card.classList.add('entry-project');
        }

        let cardContent = '';

        if (this.config.projectType === 'scratch') {
            cardContent = this.createScratchCardContent(projectName, project);
        } else if (this.config.projectType === 'entry') {
            cardContent = this.createEntryCardContent(projectName, project);
        } else if (this.config.projectType === 'appinventor') {
            cardContent = this.createAppInventorCardContent(projectName, project);
        }

        card.innerHTML = cardContent;

        // 카드 클릭 이벤트 핸들러 추가
        if (this.config.projectType === 'scratch' && project.basic) {
            card.addEventListener('click', (e) => {
                // 이미 버튼 클릭으로 처리되지 않은 경우에만 실행
                if (!e.target.classList.contains('load-project') &&
                    !e.target.classList.contains('project-ppt-btn') &&
                    !e.target.classList.contains('entry-legacy-btn')) {
                    this.loadProjectInScratchGUI(project.basic);
                }
            });
        } else if (this.config.projectType === 'entry' && project.basic) {
            card.addEventListener('click', (e) => {
                // 🔥 모든 계정(Teacher/Student) 공통: 카드 클릭 시 다운로드 + Entry 워크스페이스 이동
                if (!e.target.classList.contains('load-project') &&
                    !e.target.classList.contains('project-ppt-btn') &&
                    !e.target.classList.contains('entry-legacy-btn')) {
                    this.downloadEntryAndOpenPlayentry(project.basic);
                }
            });
        } else if (this.config.projectType === 'appinventor' && project.basic) {
            card.addEventListener('click', (e) => {
                // 이미 버튼 클릭으로 처리되지 않은 경우에만 실행
                if (!e.target.classList.contains('load-project') &&
                    !e.target.classList.contains('project-ppt-btn')) {
                    this.loadProjectInAppInventor(project.basic);
                }
            });
        }

        return card;
    }

    /**
     * Scratch 카드 내용 생성
     */
    createScratchCardContent(projectName, project) {
        return `
            <div class="apple-card-header">
                <h3 class="apple-card-title">${projectName}</h3>
            </div>
            
            ${project.img ? `
                <div class="apple-card-image">
                    <img src="${project.img}" alt="${projectName}">
                </div>
            ` : ''}
            
            <div class="apple-tag-container">
                <span class="apple-tag">
                    <i class="bi bi-cpu"></i> ${project.ctElement || '정보 없음'}
                </span>
            </div>
            
            <div class="apple-card-actions">
                ${project.basic ? this.createProjectButton('기본', project.basic, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showExtensions && project.ext1 ? this.createProjectButton('확장1', project.ext1, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showExtensions && project.ext2 ? this.createProjectButton('확장2', project.ext2, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showPPTButton && project.ppt ? `
                    <button class="apple-btn apple-btn-ghost project-ppt-btn" 
                        onclick="window.open('${project.ppt}', '_blank'); event.stopPropagation();">
                        PPT
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Entry 카드 내용 생성 (커스터마이징 버전)
     */
    createEntryCardContent(projectName, project) {
        return `
            <div class="apple-card-header">
                <h3 class="apple-card-title">${projectName}</h3>
            </div>
            
            ${project.basic ? `
                <div class="mb-3">
                    <button class="apple-btn apple-btn-ghost entry-legacy-btn" data-url="${project.basic}" style="font-size: 12px; padding: 4px 8px;">
                        <i class="bi bi-download"></i> 다운로드
                    </button>
                </div>
            ` : ''}
            
            <div class="apple-tag-container">
                <span class="apple-tag">
                    <i class="bi bi-cpu"></i> ${project.ctElement || '정보 없음'}
                </span>
            </div>
            
            <div class="apple-card-actions">
                ${project.basic ? this.createProjectButton('기본', project.basic, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showComplete && project.complete ? this.createProjectButton('완성', project.complete, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showExtension && project.extension ? this.createProjectButton('확장', project.extension, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showPPTButton && project.ppt ? `
                    <button class="apple-btn apple-btn-ghost project-ppt-btn" 
                        onclick="window.open('${project.ppt}', '_blank'); event.stopPropagation();">
                        PPT
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * AppInventor 카드 내용 생성
     */
    createAppInventorCardContent(projectName, project) {
        return `
            <div class="apple-card-header">
                <h3 class="apple-card-title">${projectName}</h3>
            </div>
            
            ${project.img ? `
                <div class="apple-card-image">
                    <img src="${project.img}" alt="${projectName}">
                </div>
            ` : ''}
            
            <div class="apple-tag-container">
                <span class="apple-tag">
                    <i class="bi bi-cpu"></i> ${project.ctElement || '정보 없음'}
                </span>
            </div>
            
            <div class="apple-card-actions">
                ${project.basic ? this.createProjectButton('본문', project.basic, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showPractice && project.practice ? this.createProjectButton('연습', project.practice, 'apple-btn-secondary') : ''}
                ${this.viewConfig.showPPTButton && project.ppt ? `
                    <button class="apple-btn apple-btn-ghost project-ppt-btn" 
                        onclick="window.open('${project.ppt}', '_blank'); event.stopPropagation();">
                        PPT
                    </button>
                ` : ''}
            </div>
        `;
    }

    // createProjectButton 함수 수정
    createProjectButton(label, url, type) {
        return `
            <button class="apple-btn ${type} load-project" data-url="${url}">
                ${label}
            </button>
        `;
    }

    /**
     * Scratch GUI에서 프로젝트 로드
     */
    loadProjectInScratchGUI(projectUrl) {
        if (!projectUrl) {
            console.error('Project URL is missing');
            return;
        }
        window.open(`/scratch/?project_file=${encodeURIComponent(projectUrl)}`, '_blank');
    }

    /**
     * 🎯 Entry GUI에서 프로젝트 로드 (8070번 서버 연동)
     */
    loadProjectInEntryGUI(projectUrl) {
        if (!projectUrl) {
            console.error('프로젝트 URL이 없습니다');
            return;
        }

        console.log('🎯 Entry 프로젝트 로드 - 8070번 서버 연동:', projectUrl);

        // 🔥 중요: userID, role을 URL에 포함 (entryRouter가 세션에서 가져오지만, 새 창에서는 세션이 없을 수 있음)
        // 현재 사용자 정보 가져오기
        const userID = this.userID || document.getElementById('currentUserID')?.value || 'guest';
        const role = this.userRole || document.getElementById('currentUserRole')?.value || 'guest';

        const workspaceUrl = `/entry_editor/?s3Url=${encodeURIComponent(projectUrl)}&userID=${userID}&role=${role}`;
        console.log('🔍 Entry 워크스페이스 URL:', workspaceUrl);
        window.open(workspaceUrl, '_blank');

        // 학습 활동 기록
        try {
            fetch('/learning/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'entry_load_project_8070_integrated',
                    data: {
                        projectUrl: projectUrl,
                        workspaceUrl: workspaceUrl,
                        timestamp: new Date().toISOString()
                    }
                })
            });
        } catch (error) {
            console.error('로그 기록 오류:', error);
        }
    }

    /**
     * Entry GUI에서 프로젝트 로드 (기존 통합 워크스페이스 방식 - 향후 복원용)
     */
    loadProjectInEntryGUI_Integrated(projectUrl) {
        if (!projectUrl) {
            console.error('프로젝트 URL이 없습니다');
            return;
        }

        const fileName = projectUrl.split('/').pop();
        console.log('Entry 프로젝트 로드 시도:', fileName);

        // 🔥 통합 워크스페이스: EntryJS 오프라인 버전 사용
        const workspaceUrl = `/entry/workspace?project=${encodeURIComponent(fileName)}`;
        window.open(workspaceUrl, '_blank');

        // 학습 활동 기록
        try {
            fetch('/learning/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'entry_load_project_integrated',
                    data: {
                        projectUrl: projectUrl,
                        fileName: fileName,
                        workspaceUrl: workspaceUrl,
                        timestamp: new Date().toISOString()
                    }
                })
            });
        } catch (error) {
            console.error('로그 기록 오류:', error);
        }
    }

    /**
     * AppInventor에서 프로젝트 로드
     */
    loadProjectInAppInventor(projectUrl) {
        if (!projectUrl) {
            console.error('프로젝트 URL이 없습니다');
            return;
        }

        // 프로젝트 파일 다운로드
        const fileName = projectUrl.split('/').pop();
        const downloadLink = document.createElement('a');
        downloadLink.href = projectUrl;
        downloadLink.download = fileName;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);

        // 새 창에서 앱인벤터 열기
        window.open('https://appinventor.mit.edu/', '_blank');

        // 약간의 지연 후 다운로드 실행
        setTimeout(() => {
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // 사용자에게 안내 메시지 표시
            alert(`앱인벤터 프로젝트 파일(${fileName})이 다운로드되었습니다.\n앱인벤터에서 '프로젝트 가져오기' 메뉴를 선택하고 이 파일을 업로드하세요.`);
        }, 500);

        // 학습 활동 기록
        try {
            fetch('/learning/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'appinventor_load_project',
                    data: {
                        projectUrl: projectUrl,
                        timestamp: new Date().toISOString()
                    }
                })
            });
        } catch (error) {
            console.error('로그 기록 오류:', error);
        }
    }

    /**
     * 오류 메시지 표시
     */
    displayErrorMessage(message) {
        const container = document.getElementById(this.config.contentContainerId);
        if (!container) return;

        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">오류 발생</h4>
                <p>${message}</p>
            </div>
        `;
    }

    setupEventListeners() {
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('load-project')) {
                e.preventDefault();
                e.stopPropagation();

                const projectUrl = e.target.getAttribute('data-url');
                if (!projectUrl) return;

                const fileType = e.target.textContent.trim();
                const card = e.target.closest('.project-card');
                const projectName = card?.querySelector('.project-card-title')?.textContent || 'Unknown';

                // 학습 시작 기록
                try {
                    await fetch('/learning/project-load', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            platform: this.config.projectType,
                            project_name: projectName,
                            file_type: fileType,
                            s3_url: projectUrl
                        })
                    });
                } catch (error) {
                    console.error('학습 기록 실패:', error);
                }

                // 파일 로드
                if (this.config.projectType === 'scratch') {
                    this.loadProjectInScratchGUI(projectUrl);
                } else if (this.config.projectType === 'entry') {
                    this.loadProjectInEntryGUI(projectUrl);
                } else if (this.config.projectType === 'appinventor') {
                    this.loadProjectInAppInventor(projectUrl);
                }
            }

            // 다운로드 버튼 (그대로 유지)
            if (e.target.classList.contains('entry-legacy-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const projectUrl = e.target.getAttribute('data-url');
                if (projectUrl) {
                    this.downloadEntryFile(projectUrl);
                }
            }
        });
    }

}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // projectType은 각 페이지의 EJS에서 지정 (예: <script>const projectType = 'scratch';</script>)
    if (typeof projectType !== 'undefined') {
        const manager = new ProjectCardManager({
            projectType: projectType
        });

        manager.initialize();
        manager.setupEventListeners();

        // 전역 변수로 노출 (디버깅 등 필요시 사용)
        window.projectCardManager = manager;

        // 🔥 EntryJS 새로운 동작 방식 확인
        if (projectType === 'entry') {
            console.log('🎯 Entry 프로젝트 새로운 동작 방식 활성화');
            console.log('- 모든 계정: [기본][확장] 버튼 표시');
            console.log('- Teacher 계정: [완성] 버튼 추가 표시');
            console.log('- 모든 버튼: ENT 다운로드 + Entry 워크스페이스 이동');
            console.log('- [다운로드] 버튼: ENT 파일만 다운로드');
            console.log('- 기존 workspace 연동 로직은 주석 처리됨 (향후 복원 예정)');
        }
    } else {
        console.error('프로젝트 타입이 정의되지 않았습니다.');
    }
});