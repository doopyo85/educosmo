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
     * 🔥 URL 정규화: /COS/ -> /cos/, /SB3/ -> /sb3/ 등
     */
    normalizeUrl(url) {
        if (!url) return '';
        return url.replace(/\/([A-Z]+)\//g, (match, folder) => {
            return '/' + folder.toLowerCase() + '/';
        });
    }

    /**
     * 🔥 COS 문제 팝업 열기 (새 창으로)
     */
    openCosProblemModal(grade, sample, problem, problems, projectUrl, openProjectTab = false) {
        // 🔥 팝업 URL 생성
        const popupUrl = `/cos-problem-popup?grade=${grade}&sample=${sample}&problem=${problem}&problems=${encodeURIComponent(problems)}`;

        // 🔥 projectUrl이 공식 페이지 URL이고 openProjectTab이 true면 먼저 새 탭으로 열기
        if (openProjectTab && projectUrl) {
            if (projectUrl.includes('playentry.org') || projectUrl.includes('scratch.mit.edu')) {
                console.log('✅ 공식 페이지 먼저 열기:', projectUrl);
                window.open(projectUrl, '_blank');

                // 🔥 약간의 딜레이 후 문제 팝업 열기 (팝업 차단 방지)
                setTimeout(() => {
                    const popupWindow = window.open(popupUrl, `cosProblem-${grade}-${sample}`, 'width=800,height=900,scrollbars=yes,resizable=yes');
                    if (!popupWindow || popupWindow.closed || typeof popupWindow.closed == 'undefined') {
                        console.warn('⚠️ 팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
                        alert('문제 이미지 팝업이 차단되었습니다.\n브라우저 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여 허용해주세요.');
                    }
                }, 100);
                return;
            }
        }

        // 🔥 공식 페이지를 열지 않는 경우 (NCP URL 등) - 팝업만 열기
        const popupWindow = window.open(popupUrl, `cosProblem-${grade}-${sample}`, 'width=800,height=900,scrollbars=yes,resizable=yes');
        if (!popupWindow || popupWindow.closed || typeof popupWindow.closed == 'undefined') {
            console.warn('⚠️ 팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
            alert('문제 이미지 팝업이 차단되었습니다.\n브라우저 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여 허용해주세요.');
        }
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
     * Scratch 프로젝트 그룹화 (카테고리별)
     */
    groupScratchProjects(data) {
        const projects = {};

        data.forEach(row => {
            if (!Array.isArray(row) || row.length < 4) return;

            // 데이터 구조: [카테고리, 콘텐츠명, 기능, D열URL, C.T요소, 활용교구, G열URL, imgURL]
            // sb3! 시트: D열 = scratch.mit.edu URL, G열 = S3 sb3 파일
            const [category, name, type, webUrl, ctElement = '', tools = '', s3Url = '', imgUrl = ''] = row;

            if (!category || !name) return;

            // 카테고리별 그룹 생성
            if (!projects[category]) {
                projects[category] = {};
            }

            const projectKey = name.trim();

            if (!projects[category][projectKey]) {
                projects[category][projectKey] = {
                    name: projectKey,
                    category: category,
                    ctElement: ctElement,
                    tools: tools,
                    img: '',  // 🔥 수정: 초기값은 빈 문자열, "문제" 타입에서만 설정
                    // CPS용 (기본/확장1/확장2)
                    basic: '',
                    basicWebUrl: '',  // D열: scratch.mit.edu URL
                    ext1: '',
                    ext2: '',
                    // COS용 (정답/풀이) - 문제는 imgUrl
                    answer: '',
                    solution: '',
                    ppt: ''
                };
            }

            // 기능 컬럼의 값에 따라 URL 할당
            const typeLower = type.toLowerCase();
            switch (typeLower) {
                case '기본':
                    projects[category][projectKey].basic = s3Url;          // G열: S3 파일 (다운로드용)
                    projects[category][projectKey].basicWebUrl = webUrl;   // D열: scratch.mit.edu URL (이동용)
                    console.log('🔍 Scratch 기본 데이터:', {
                        name: name,
                        type: type,
                        webUrl: webUrl,
                        s3Url: s3Url
                    });
                    break;
                case '확장1':
                    projects[category][projectKey].ext1 = s3Url;
                    break;
                case '확장2':
                    projects[category][projectKey].ext2 = s3Url;
                    break;
                case '문제':  // 🔥 COS 문제 이미지 URL
                    projects[category][projectKey].img = imgUrl; // H열: imgURL 컬럼 사용
                    console.log('🔍 Scratch COS 문제 이미지:', {
                        name: name,
                        imgUrl: imgUrl
                    });
                    break;
                case '정답':
                    projects[category][projectKey].answer = s3Url;
                    console.log('🔍 Scratch COS 정답:', {
                        name: name,
                        s3Url: s3Url
                    });
                    break;
                case '풀이':
                    projects[category][projectKey].solution = s3Url;
                    console.log('🔍 Scratch COS 풀이:', {
                        name: name,
                        s3Url: s3Url
                    });
                    break;
                case 'ppt':
                    projects[category][projectKey].ppt = webUrl; // PPT는 보통 웹 링크
                    break;
            }
        });

        console.log('✅ Scratch Projects 그룹핑 완료:', projects);
        return projects;
    }

    /**
     * Entry 프로젝트 그룹화 (COS 지원 추가)
     */
    groupEntryProjects(data) {
        const projects = {};

        data.forEach(row => {
            // 구글 시트 데이터 구조: [카테고리, 콘텐츠명, 기능, entURL(Web), C.T요소, 활용교구, S3entURL(File)]
            const [category, name, type, entURL = '', ctElement = '', tools = '', s3entURL = ''] = row;

            if (!category || !name) return;

            if (!projects[category]) {
                projects[category] = {};
            }

            const projectKey = name.trim();

            if (!projects[category][projectKey]) {
                projects[category][projectKey] = {
                    name: projectKey,
                    category: category,
                    ctElement: ctElement,
                    img: '',  // 🔥 수정: 초기값은 빈 문자열, "문제" 타입에서만 설정
                    // CPE용 (기본/완성/확장)
                    basic: '',
                    basicPlayEntry: '',  // playentry.org URL
                    complete: '',
                    completePlayEntry: '',
                    extension: '',
                    extensionPlayEntry: '',
                    // COS용 (정답/풀이) - 문제는 imgUrl
                    answer: '',
                    solution: '',
                    ppt: ''
                };
            }

            // 🔥 entURL(D열): playentry.org URL, s3entURL(G열): S3 다운로드 URL

            // 타입에 따라 URL 할당
            const typeLower = type.toLowerCase();
            switch (typeLower) {
                case '기본':
                    projects[category][projectKey].basicPlayEntry = entURL;  // D열: playentry.org URL
                    projects[category][projectKey].basic = s3entURL;  // G열: S3 파일 URL
                    console.log('🔍 Entry 기본 데이터:', {
                        name: name,
                        type: type,
                        entURL: entURL,
                        s3entURL: s3entURL
                    });
                    break;
                case '완성':
                    projects[category][projectKey].completePlayEntry = entURL;
                    projects[category][projectKey].complete = s3entURL;
                    break;
                case '확장':
                    projects[category][projectKey].extensionPlayEntry = entURL;
                    projects[category][projectKey].extension = s3entURL;
                    break;
                case '문제':  // 🔥 COS 문제 이미지 URL (G열 = s3entURL에 이미지 URL)
                    projects[category][projectKey].img = s3entURL;
                    console.log('🔍 Entry COS 문제 이미지:', {
                        name: name,
                        imgUrl: s3entURL
                    });
                    break;
                case '정답':
                    projects[category][projectKey].answer = s3entURL;
                    console.log('🔍 Entry COS 정답:', {
                        name: name,
                        s3entURL: s3entURL
                    });
                    break;
                case '풀이':
                    projects[category][projectKey].solution = s3entURL;
                    console.log('🔍 Entry COS 풀이:', {
                        name: name,
                        s3entURL: s3entURL
                    });
                    break;
                case 'ppt':
                    projects[category][projectKey].ppt = s3entURL;
                    break;
            }
        });

        console.log('✅ Entry Projects 그룹핑 완료:', projects);
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
     * Scratch 프로젝트 탭과 함께 표시 (COS 섹션형 지원)
     */
    displayScratchProjects(projects) {
        const tabsContainer = document.getElementById(this.config.categoryTabsId);
        const contentContainer = document.getElementById(this.config.contentContainerId);

        // 탭 컨테이너가 없으면 기존 방식으로 폴백
        if (!tabsContainer) {
            console.warn('탭 컨테이너 없음, 기존 방식으로 표시');
            this.displayScratchProjectsLegacy(projects, contentContainer);
            return;
        }

        if (!contentContainer) {
            console.error(`콘텐츠 컨테이너를 찾을 수 없음: #${this.config.contentContainerId}`);
            return;
        }

        // 🔥 COS 지원 함수 호출
        this.displayProjectsWithCOSSupport(projects, tabsContainer, contentContainer);
    }

    /**
     * Scratch 프로젝트 레거시 표시 (탭 없음 - 폴백용)
     */
    displayScratchProjectsLegacy(projects, container) {
        if (!container) {
            container = document.getElementById(this.config.contentContainerId);
        }
        if (!container) return;

        container.innerHTML = '';
        const gridContainer = document.createElement('div');
        gridContainer.className = 'project-card-grid';

        // 모든 카테고리의 프로젝트를 플랫하게 표시
        Object.values(projects).forEach(categoryProjects => {
            Object.values(categoryProjects).forEach(project => {
                gridContainer.appendChild(this.createProjectCard(project.name, project));
            });
        });

        container.appendChild(gridContainer);
    }

    /**
     * Entry 프로젝트 탭과 함께 표시 (COS 섹션형 지원)
     */
    displayEntryProjectsWithTabs(projects) {
        const tabsContainer = document.getElementById(this.config.categoryTabsId);
        const contentContainer = document.getElementById(this.config.contentContainerId);

        if (!tabsContainer || !contentContainer) {
            console.error(`탭 또는 콘텐츠 컨테이너를 찾을 수 없음: #${this.config.categoryTabsId} 또는 #${this.config.contentContainerId}`);
            return;
        }

        // 🔥 COS 지원 함수 호출
        this.displayProjectsWithCOSSupport(projects, tabsContainer, contentContainer);
    }

    /**
     * AppInventor 프로젝트 탭과 함께 표시
     */
    displayAppInventorProjectsWithTabs(projects) {
        // Entry와 유사한 방식으로 구현
        this.displayEntryProjectsWithTabs(projects);
    }

    /**
     * 🔥 COS 데이터를 급수 > 샘플 > 문제번호로 그룹핑
     * @param {Object} projects - 카테고리별 프로젝트 데이터
     * @returns {Object} - { '1': { '1': { '01': {...}, '02': {...} }, '2': {...} }, '2': {...} }
     */
    groupCOSProjects(projects) {
        const cosData = {};

        // COS 카테고리만 필터링 (COS1E, COS2S 등)
        Object.keys(projects).forEach(category => {
            if (!category.toUpperCase().startsWith('COS')) return;

            Object.values(projects[category]).forEach(project => {
                // "COS 1급 샘플1-01" 형식 파싱
                const match = project.name.match(/COS\s*(\d)급\s*샘플(\d)-(\d+)/i);
                if (!match) return;

                const [, grade, sample, problemNum] = match;

                // 계층 구조 생성
                if (!cosData[grade]) cosData[grade] = {};
                if (!cosData[grade][sample]) cosData[grade][sample] = {};

                cosData[grade][sample][problemNum] = {
                    img: project.img || '',
                    answer: project.answer || '',
                    solution: project.solution || '',
                    name: project.name
                };
            });
        });

        return cosData;
    }

    /**
     * 🔥 COS 테이블형 레이아웃 렌더링
     * 세로: 급수/샘플, 가로: 1~10번
     * @param {Object} cosData - groupCOSProjects() 결과
     * @returns {HTMLElement} - 테이블 컨테이너
     */
    createCOSTableLayout(cosData) {
        const container = document.createElement('div');
        container.className = 'cos-table-container';

        const isTeacher = ['admin', 'teacher', 'manager'].includes(this.userRole);
        const gradeOrder = ['1', '2', '3', '4'];

        gradeOrder.forEach(grade => {
            if (!cosData[grade]) return;

            // 급수별 섹션
            const section = document.createElement('div');
            section.className = 'cos-grade-section';

            // 급수 헤더
            section.innerHTML = `<h5 class="cos-grade-header">COS ${grade}급</h5>`;

            // 테이블 생성
            const table = document.createElement('table');
            table.className = 'cos-table';

            // 테이블 헤더 (1~10번)
            let headerHtml = '<thead><tr><th class="cos-th-label"></th>';
            for (let i = 1; i <= 10; i++) {
                headerHtml += `<th class="cos-th-num">${i}</th>`;
            }
            headerHtml += '</tr></thead>';

            // 테이블 바디 (샘플 1~3)
            let bodyHtml = '<tbody>';
            ['1', '2', '3'].forEach(sample => {
                if (!cosData[grade][sample]) return;

                // 🔥 해당 샘플의 전체 문제 데이터를 JSON으로 준비
                const problemsJson = JSON.stringify(cosData[grade][sample]);
                const problemsAttr = problemsJson.replace(/"/g, '&quot;');

                bodyHtml += `<tr><td class="cos-td-label">샘플 ${sample}</td>`;

                for (let i = 1; i <= 10; i++) {
                    const numKey = i.toString().padStart(2, '0');
                    const p = cosData[grade][sample][numKey];

                    if (p && p.solution) {
                        // 🔥 풀이 버튼 - 급수/샘플/문제번호/전체문제 데이터 포함
                        bodyHtml += `<td class="cos-td-btn">`;
                        bodyHtml += `<button class="btn btn-sm cos-btn cos-btn-solution cos-problem-btn" 
                                            data-url="${p.solution}" 
                                            data-img="${p.img || ''}"
                                            data-grade="${grade}"
                                            data-sample="${sample}"
                                            data-problem="${numKey}"
                                            data-button-type="solution"
                                            data-problems="${problemsAttr}"
                                            title="풀이">풀이</button>`;
                        if (isTeacher && p.answer) {
                            bodyHtml += `<button class="btn btn-sm cos-btn cos-btn-answer cos-problem-btn" 
                                                data-url="${p.answer}" 
                                                data-img="${p.img || ''}"
                                                data-grade="${grade}"
                                                data-sample="${sample}"
                                                data-problem="${numKey}"
                                                data-button-type="answer"
                                                data-problems="${problemsAttr}"
                                                title="정답">정답</button>`;
                        }
                        bodyHtml += `</td>`;
                    } else {
                        bodyHtml += `<td class="cos-td-empty">-</td>`;
                    }
                }

                bodyHtml += '</tr>';
            });
            bodyHtml += '</tbody>';

            table.innerHTML = headerHtml + bodyHtml;
            section.appendChild(table);
            container.appendChild(section);
        });

        return container;
    }

    /**
     * 🔥 COS 섹션형 레이아웃 렌더링 (deprecated - createCOSTableLayout 사용)
     * @param {Object} cosData - groupCOSProjects() 결과
     * @returns {HTMLElement} - 섹션 컨테이너
     */
    createCOSSectionLayout(cosData) {
        const container = document.createElement('div');
        container.className = 'cos-section-container';

        const isTeacher = ['admin', 'teacher', 'manager'].includes(this.userRole);
        const gradeEmojis = { '1': '🏆', '2': '🥈', '3': '🥉', '4': '📝' };
        const gradeOrder = ['1', '2', '3', '4'];

        gradeOrder.forEach(grade => {
            if (!cosData[grade]) return;

            // 급수 섹션 헤더
            const section = document.createElement('div');
            section.className = 'cos-grade-section mb-4';
            section.innerHTML = `
                <h4 class="cos-grade-title mb-3">
                    ${gradeEmojis[grade] || '📝'} COS ${grade}급
                </h4>
            `;

            // 샘플 카드 그리드
            const cardGrid = document.createElement('div');
            cardGrid.className = 'row';

            // 샘플 1~3
            ['1', '2', '3'].forEach(sample => {
                if (!cosData[grade][sample]) return;

                const card = this.createCOSSampleCard(grade, sample, cosData[grade][sample], isTeacher);
                cardGrid.appendChild(card);
            });

            section.appendChild(cardGrid);
            container.appendChild(section);
        });

        return container;
    }

    /**
     * 🔥 COS 샘플 카드 생성 (10문제 리스트)
     * @param {string} grade - 급수
     * @param {string} sample - 샘플 번호
     * @param {Object} problems - 문제 데이터 { '01': {...}, '02': {...}, ... }
     * @param {boolean} isTeacher - 교사 여부
     * @returns {HTMLElement}
     */
    createCOSSampleCard(grade, sample, problems, isTeacher) {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-3';

        // 문제 번호 정렬 (01, 02, ..., 10)
        const sortedNums = Object.keys(problems).sort((a, b) => parseInt(a) - parseInt(b));

        // 문제 리스트 HTML 생성
        let problemListHtml = '';
        sortedNums.forEach(num => {
            const p = problems[num];
            const displayNum = parseInt(num).toString().padStart(2, '0');

            // 학생: [풀이]만, 교사: [풀이][정답]
            const buttons = `
                <button class="btn btn-warning btn-sm load-project cos-btn" 
                        data-url="${p.solution}" 
                        data-img="${p.img}"
                        title="풀이 + 문제 이미지">
                    풀이
                </button>
                ${isTeacher && p.answer ? `
                <button class="btn btn-success btn-sm load-project cos-btn" 
                        data-url="${p.answer}" 
                        data-img="${p.img}"
                        title="정답 + 문제 이미지">
                    정답
                </button>
                ` : ''}
            `;

            problemListHtml += `
                <div class="cos-problem-row d-flex justify-content-between align-items-center py-1 border-bottom">
                    <span class="cos-problem-num">${displayNum}번</span>
                    <div class="cos-problem-btns">
                        ${buttons}
                    </div>
                </div>
            `;
        });

        col.innerHTML = `
            <div class="card h-100 cos-sample-card">
                <div class="card-header bg-primary text-white">
                    <strong>📝 샘플 ${sample}회</strong>
                </div>
                <div class="card-body p-2">
                    ${problemListHtml}
                </div>
            </div>
        `;

        return col;
    }

    /**
     * 🔥 COS/일반 카테고리 분리 및 표시 (공통 로직)
     * @param {Object} projects - 전체 프로젝트 데이터
     * @param {HTMLElement} tabsContainer - 탭 컨테이너
     * @param {HTMLElement} contentContainer - 콘텐츠 컨테이너
     */
    displayProjectsWithCOSSupport(projects, tabsContainer, contentContainer) {
        // COS와 일반 카테고리 분리
        const cosCategories = {};
        const normalCategories = {};

        Object.keys(projects).forEach(category => {
            if (category.toUpperCase().startsWith('COS')) {
                cosCategories[category] = projects[category];
            } else {
                normalCategories[category] = projects[category];
            }
        });

        // 초기화
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '';

        let tabIndex = 0;
        const hasCOS = Object.keys(cosCategories).length > 0;
        const hasNormal = Object.keys(normalCategories).length > 0;

        // 탭 활성화 로직: 첫 번째 일반 탭이 활성화, COS는 마지막

        // 일반 카테고리 탭들 (먼저 추가)
        Object.keys(normalCategories).forEach((category, idx) => {
            const isActive = (idx === 0);

            // 탭 생성
            const tabButton = document.createElement('li');
            tabButton.className = 'nav-item';
            tabButton.innerHTML = `
                <button class="nav-link ${isActive ? 'active' : ''}" 
                        id="tab-${tabIndex}" 
                        data-bs-toggle="tab" 
                        data-bs-target="#content-${tabIndex}" 
                        type="button" 
                        role="tab">
                    ${category}
                </button>
            `;
            tabsContainer.appendChild(tabButton);

            // 콘텐츠 패널 생성
            const contentPanel = document.createElement('div');
            contentPanel.className = `tab-pane fade ${isActive ? 'show active' : ''}`;
            contentPanel.id = `content-${tabIndex}`;

            // 프로젝트 카드 그리드
            const gridContainer = document.createElement('div');
            gridContainer.className = 'project-card-grid';

            Object.values(normalCategories[category]).forEach(project => {
                gridContainer.appendChild(this.createProjectCard(project.name, project));
            });

            contentPanel.appendChild(gridContainer);
            contentContainer.appendChild(contentPanel);
            tabIndex++;
        });

        // COS 탭 (마지막에 추가)
        if (hasCOS) {
            const isActive = !hasNormal; // 일반 카테고리가 없을 때만 활성화

            // COS 탭 생성
            const cosTab = document.createElement('li');
            cosTab.className = 'nav-item';
            cosTab.innerHTML = `
                <button class="nav-link ${isActive ? 'active' : ''}" 
                        id="tab-cos" 
                        data-bs-toggle="tab" 
                        data-bs-target="#content-cos" 
                        type="button" 
                        role="tab">
                    COS 자격증
                </button>
            `;
            tabsContainer.appendChild(cosTab);

            // COS 콘텐츠 패널
            const cosPanel = document.createElement('div');
            cosPanel.className = `tab-pane fade ${isActive ? 'show active' : ''}`;
            cosPanel.id = 'content-cos';

            // COS 데이터 그룹핑 및 테이블 레이아웃 생성
            const cosData = this.groupCOSProjects(cosCategories);
            cosPanel.appendChild(this.createCOSTableLayout(cosData));

            contentContainer.appendChild(cosPanel);
        }
    }

    // createProjectButton 함수 (imgUrl 파라미터 추가, extraAttrs 추가)
    createProjectButton(label, url, type, imgUrl = '', extraAttrs = '') {
        const imgAttr = imgUrl ? `data-img="${imgUrl}"` : '';
        return `
            <button class="btn ${type} btn-sm load-project" data-url="${url}" ${imgAttr} ${extraAttrs}>
                ${label}
            </button>
        `;
    }

    createScratchCardContent(projectName, project) {
        const pptBtn = this.viewConfig.showPPTButton && project.ppt ? `
            <button class="project-ppt-btn" 
                onclick="window.open('${project.ppt}', '_blank'); event.stopPropagation();">
                PPT
            </button>
        ` : '';

        // 🔥 COS 카테고리 여부 확인 (COS로 시작하면 COS)
        const isCOS = project.category && project.category.toUpperCase().startsWith('COS');

        // COS용 버튼 (문제/정답/풀이)
        // 문제 버튼은 이미지를 새 탭에서 열기
        // 정답/풀이 버튼은 load-project 클래스로 기존 핸들러 사용 (1486줄)
        const cosButtons = isCOS ? `
            ${project.img ? `<button class="btn btn-info btn-sm" onclick="window.open('${project.img}', '_blank'); event.stopPropagation();">문제</button>` : ''}
            ${project.answer ? `<button class="btn btn-success btn-sm load-project"
                                        data-url="${project.answer}"
                                        data-img="${project.img || ''}"
                                        data-project-name="${projectName}"
                                        title="정답">정답</button>` : ''}
            ${project.solution ? `<button class="btn btn-warning btn-sm load-project"
                                          data-url="${project.solution}"
                                          data-img="${project.img || ''}"
                                          data-project-name="${projectName}"
                                          title="풀이">풀이</button>` : ''}
        ` : '';

        // 🔥 Extension 연동 속성 - [기본] 버튼용 (data-action 제외, card_project.js에서 직접 처리)
        const scratchBasicAttrs = `
            data-platform="scratch"
            data-mission-id="${projectName}"
            data-mission-title="${projectName}"
            data-user-id="${this.userID}"
        `.replace(/\s+/g, ' ');

        // 🔥 Extension 연동 속성 - [확장1/2] 버튼용 (data-action 포함, content-codingnplay.js에서 처리)
        const scratchExtAttrs = `
            data-action="open-editor"
            data-platform="scratch"
            data-mission-id="${projectName}"
            data-mission-title="${projectName}"
            data-user-id="${this.userID}"
        `.replace(/\s+/g, ' ');

        // CPS용 버튼 (기본/확장1/확장2)
        // 🔥 [기본]: D열 → scratch.mit.edu 공식 페이지로 이동 + Extension에 과제정보 전달
        // 🔥 [확장1]/[확장2]: G열 → 8601 서버(내부 에디터)로 로드 + Extension에 과제정보 전달
        if (project.basicWebUrl) {
            console.log(`🔍 [${projectName}] basicWebUrl:`, project.basicWebUrl);
        } else {
            console.warn(`⚠️ [${projectName}] basicWebUrl이 비어있습니다!`);
        }

        const cpsButtons = !isCOS ? `
            ${project.basicWebUrl ? `<button class="btn btn-secondary btn-sm scratch-basic-btn" data-url="${project.basicWebUrl}" ${scratchBasicAttrs} data-open-url="${project.basicWebUrl}">기본</button>` : ''}
            ${this.viewConfig.showExtensions && project.ext1 ? this.createProjectButton('확장1', project.ext1, 'btn-secondary', '', scratchExtAttrs + ` data-template-url="${project.ext1}"`) : ''}
            ${this.viewConfig.showExtensions && project.ext2 ? this.createProjectButton('확장2', project.ext2, 'btn-secondary', '', scratchExtAttrs + ` data-template-url="${project.ext2}"`) : ''}
        ` : '';

        // 다운로드 버튼 (COS가 아닌 경우에만 표시)
        // 스타일을 entry-legacy-btn 클래스로 변경하여 Entry와 동일하게 맞춤
        // 🔥 Extension 연동 제거 (다운로드 전용)
        const downloadBtn = !isCOS && project.basic ? `
            <button class="entry-legacy-btn" data-url="${project.basic}" data-project-name="${projectName}">
                <i class="bi bi-download"></i> 다운로드
            </button>
        ` : '';

        return `
            ${pptBtn}
            <div class="project-card-header">
                <h3 class="project-card-title">${projectName}</h3>
            </div>

            <div class="project-card-tags">
                <span class="project-card-tag">
                    <i class="bi bi-cpu"></i> ${project.ctElement || '블록코딩'}
                </span>
                ${project.tools ? `
                    <span class="project-card-tag">
                        <i class="bi bi-tools"></i> ${project.tools}
                    </span>
                ` : ''}
            </div>

            <div class="project-card-actions">
                <div class="project-card-btn-group">
                    ${isCOS ? cosButtons : cpsButtons}
                </div>
                ${downloadBtn}
            </div>
        `;
    }

    createEntryCardContent(projectName, project) {
        const pptBtn = this.viewConfig.showPPTButton && project.ppt ? `
            <button class="project-ppt-btn" 
                onclick="window.open('${project.ppt}', '_blank'); event.stopPropagation();">
                PPT
            </button>
        ` : '';

        // 🔥 COS 카테고리 여부 확인 (COS로 시작하면 COS)
        const isCOS = project.category && project.category.toUpperCase().startsWith('COS');

        // COS용 버튼 (문제/정답/풀이)
        // 문제 버튼은 이미지를 새 탭에서 열기
        // 정답/풀이 버튼은 load-project 클래스로 기존 핸들러 사용 (1486줄)
        const cosButtons = isCOS ? `
            ${project.img ? `<button class="btn btn-info btn-sm" onclick="window.open('${project.img}', '_blank'); event.stopPropagation();">문제</button>` : ''}
            ${project.answer ? `<button class="btn btn-success btn-sm load-project"
                                        data-url="${project.answer}"
                                        data-img="${project.img || ''}"
                                        data-project-name="${projectName}"
                                        title="정답">정답</button>` : ''}
            ${project.solution ? `<button class="btn btn-warning btn-sm load-project"
                                          data-url="${project.solution}"
                                          data-img="${project.img || ''}"
                                          data-project-name="${projectName}"
                                          title="풀이">풀이</button>` : ''}
        ` : '';

        // CPE용 버튼 (기본/완성/확장)
        // 🔥 [기본]: D열 → playentry.org 공식 페이지로 이동 + Extension에 과제정보 전달
        // 🔥 [완성]/[확장]: G열 → 8070 서버(내부 에디터)로 로드 + Extension에 과제정보 전달

        // 🔥 Extension 연동 속성 - [기본] 버튼용 (data-action 제외, card_project.js에서 직접 처리)
        const entryBasicAttrs = `
            data-platform="entry"
            data-mission-id="${projectName}"
            data-mission-title="${projectName}"
            data-user-id="${this.userID}"
        `.replace(/\s+/g, ' ');

        // 🔥 Extension 연동 속성 - [완성/확장] 버튼용 (data-action 포함, content-codingnplay.js에서 처리)
        const entryExtAttrs = `
            data-action="open-editor"
            data-platform="entry"
            data-mission-id="${projectName}"
            data-mission-title="${projectName}"
            data-user-id="${this.userID}"
        `.replace(/\s+/g, ' ');

        // 디버깅 로그
        if (project.basicPlayEntry) {
            console.log(`🔍 [${projectName}] Entry basicPlayEntry:`, project.basicPlayEntry);
        } else {
            console.warn(`⚠️ [${projectName}] Entry basicPlayEntry가 비어있습니다!`);
        }

        const cpeButtons = !isCOS ? `
            ${project.basicPlayEntry ? `<button class="btn btn-secondary btn-sm entry-basic-btn" data-url="${project.basicPlayEntry}" ${entryBasicAttrs} data-open-url="${project.basicPlayEntry}">기본</button>` : ''}
            ${this.viewConfig.showComplete && project.complete ? this.createProjectButton('완성', project.complete, 'btn-secondary', '', entryExtAttrs + ` data-template-url="${project.complete}"`) : ''}
            ${this.viewConfig.showExtension && project.extension ? this.createProjectButton('확장', project.extension, 'btn-secondary', '', entryExtAttrs + ` data-template-url="${project.extension}"`) : ''}
        ` : '';

        // 다운로드 버튼 (COS가 아닌 경우에만 표시) -> Extension 연동 제거 (순수 다운로드)
        const downloadBtn = !isCOS && project.basic ? `
            <button class="entry-legacy-btn" data-url="${project.basic}" data-project-name="${projectName}">
                <i class="bi bi-download"></i> 다운로드
            </button>
        ` : '';

        return `
            ${pptBtn}
            
            <div class="project-card-header">
                <h3 class="project-card-title">${projectName}</h3>
            </div>
            
            <div class="project-card-tags">
                <span class="project-card-tag">
                    <i class="bi bi-cpu"></i> ${project.ctElement || '블록코딩'}
                </span>
            </div>
            
            <div class="project-card-actions">
                <div class="project-card-btn-group">
                    ${isCOS ? cosButtons : cpeButtons}
                </div>
                ${downloadBtn}
            </div>
        `;
    }

    createAppInventorCardContent(projectName, project) {
        const pptBtn = this.viewConfig.showPPTButton && project.ppt ? `
            <button class="project-ppt-btn" 
                onclick="window.open('${project.ppt}', '_blank'); event.stopPropagation();">
                PPT
            </button>
        ` : '';

        return `
            ${pptBtn}
            <div class="project-card-header">
                <h3 class="project-card-title">${projectName}</h3>
            </div>
            
            ${project.img ? `
                <div class="project-card-image">
                    <img src="${project.img}" alt="${projectName}">
                </div>
            ` : ''}
            
            <div class="project-card-tags">
                <span class="project-card-tag">
                    <i class="bi bi-cpu"></i> ${project.ctElement || '정보 없음'}
                </span>
            </div>
            
            <div class="project-card-actions">
                <div class="project-card-btn-group">
                    ${project.basic ? this.createProjectButton('본문', project.basic, 'btn-secondary') : ''}
                    ${this.viewConfig.showPractice && project.practice ? this.createProjectButton('연습', project.practice, 'btn-secondary') : ''}
                </div>
            </div>
        `;
    }

    /**
     * 프로젝트 카드 생성
     */
    createProjectCard(projectName, project) {
        const card = document.createElement('div');
        card.className = 'project-card';

        // Entry 프로젝트일 경우 특별 클래스 추가
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
                    !e.target.classList.contains('entry-legacy-btn') &&
                    !e.target.classList.contains('scratch-basic-btn')) {
                    this.loadProjectInScratchGUI(project.basic);
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
                    < div class="alert alert-danger" role = "alert" >
                <h4 class="alert-heading">오류 발생</h4>
                <p>${message}</p>
            </div >
                    `;
    }

    setupEventListeners() {
        document.addEventListener('click', async (e) => {
            // 🔥 COS 테이블 버튼 클릭 (cos-problem-btn 클래스)
            if (e.target.classList.contains('cos-problem-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const btn = e.target;
                const grade = btn.getAttribute('data-grade');
                const sample = btn.getAttribute('data-sample');
                const problem = btn.getAttribute('data-problem');
                const buttonType = btn.getAttribute('data-button-type');
                const problems = btn.getAttribute('data-problems');
                const projectUrl = this.normalizeUrl(btn.getAttribute('data-url'));  // 🔥 URL 정규화
                const imgUrl = this.normalizeUrl(btn.getAttribute('data-img'));      // 🔥 URL 정규화

                console.log('🎯 COS 문제 버튼 클릭:', {
                    grade, sample, problem, buttonType, imgUrl, projectUrl
                });

                // 🔥 projectUrl이 playentry.org 링크인지 확인
                if (projectUrl && projectUrl.includes('playentry.org')) {
                    // 🔥 Extension이 있으면 사이드바와 함께, 없으면 모달 표시
                    if (window.extensionBridge && window.extensionBridge.isExtensionInstalled) {
                        const missionId = `cos-${grade}-${sample}-${problem}`;
                        const missionTitle = `COS ${grade}급 샘플${sample}-${problem}번`;
                        const userId = this.userID || 'guest';

                        console.log('✅ Extension 감지 - 공식 에디터로 이동 (문제 이미지 사이드바 포함)');

                        window.extensionBridge.openEditor({
                            platform: this.config.projectType,
                            missionId: missionId,
                            userId: userId,
                            missionTitle: missionTitle,
                            openUrl: projectUrl,
                            problemImageUrl: imgUrl,  // 🔥 문제 이미지 URL 전달 (정규화됨)
                            grade: grade,             // 🔥 COS 급수
                            sample: sample,           // 🔥 샘플 번호
                            problem: problem          // 🔥 문제 번호
                        });
                    } else {
                        // 🔥 Extension 없으면 모달로 문제 표시 + 동시에 새 탭으로 공식 페이지 열기
                        console.log('📂 Extension 없음 - 문제 모달 표시 + 새 탭으로 공식 페이지 열기');
                        this.openCosProblemModal(grade, sample, problem, problems, projectUrl, true);
                    }
                } else if (projectUrl && projectUrl.includes('scratch.mit.edu')) {
                    // 🔥 Extension이 있으면 사이드바와 함께, 없으면 모달 표시
                    if (window.extensionBridge && window.extensionBridge.isExtensionInstalled) {
                        const missionId = `cos-${grade}-${sample}-${problem}`;
                        const missionTitle = `COS ${grade}급 샘플${sample}-${problem}번`;
                        const userId = this.userID || 'guest';

                        console.log('✅ Extension 감지 - 공식 에디터로 이동 (문제 이미지 사이드바 포함)');

                        window.extensionBridge.openEditor({
                            platform: this.config.projectType,
                            missionId: missionId,
                            userId: userId,
                            missionTitle: missionTitle,
                            openUrl: projectUrl,
                            problemImageUrl: imgUrl,
                            grade: grade,
                            sample: sample,
                            problem: problem
                        });
                    } else {
                        // Extension 없음: Scratch는 cos-editor, Entry는 팝업 + playentry.org
                        if (this.config.projectType === 'scratch') {
                            console.log('📂 Scratch - Extension 없음 - cos-editor로 이동');
                            let cosEditorUrl = `/cos-editor?platform=scratch&projectUrl=${encodeURIComponent(projectUrl)}&imgUrl=${encodeURIComponent(imgUrl)}&grade=${grade}&sample=${sample}&problem=${problem}&buttonType=${buttonType}&problems=${encodeURIComponent(problems)}`;
                            window.open(cosEditorUrl, '_blank');
                        } else {
                            console.log('📂 Entry - Extension 없음 - 문제 팝업 + playentry.org 이동');
                            this.openCosProblemModal(grade, sample, problem, problems, projectUrl, true);
                        }
                    }
                } else {
                    // 🔥 기존 NCP URL인 경우 - Extension이 있으면 공식 사이트로 이동 (문제 이미지 사이드바 사용)
                    if (window.extensionBridge && window.extensionBridge.isExtensionInstalled) {
                        const missionId = `cos-${grade}-${sample}-${problem}`;
                        const missionTitle = `COS ${grade}급 샘플${sample}-${problem}번`;
                        const userId = this.userID || 'guest';

                        // 플랫폼별 공식 URL 생성
                        const openUrl = this.config.projectType === 'entry'
                            ? `https://playentry.org/ws/new?type=normal&mode=block&lang=ko`
                            : `https://scratch.mit.edu/projects/editor`;

                        console.log('✅ Extension 감지 - 공식 에디터로 이동 (문제 이미지 사이드바 포함)');

                        window.extensionBridge.openEditor({
                            platform: this.config.projectType,
                            missionId: missionId,
                            userId: userId,
                            missionTitle: missionTitle,
                            openUrl: openUrl,
                            problemImageUrl: imgUrl,  // 🔥 문제 이미지 URL 전달 (정규화됨)
                            grade: grade,             // 🔥 COS 급수
                            sample: sample,           // 🔥 샘플 번호
                            problem: problem          // 🔥 문제 번호
                        });
                    } else {
                        // Extension 없음: 플랫폼별 처리
                        if (this.config.projectType === 'scratch') {
                            console.log('📂 Scratch - Extension 없음 - cos-editor로 이동');
                            let cosEditorUrl = `/cos-editor?platform=scratch&projectUrl=${encodeURIComponent(projectUrl)}&imgUrl=${encodeURIComponent(imgUrl)}&grade=${grade}&sample=${sample}&problem=${problem}&buttonType=${buttonType}&problems=${encodeURIComponent(problems)}`;
                            window.open(cosEditorUrl, '_blank');
                        } else {
                            console.log('📂 Entry - Extension 없음 - 문제 팝업 + playentry.org 이동');
                            const newWorkspaceUrl = 'https://playentry.org/ws/new?type=normal&mode=block&lang=ko';
                            this.openCosProblemModal(grade, sample, problem, problems, newWorkspaceUrl, true);
                        }
                    }
                }

                // 학습 기록
                try {
                    await fetch('/learning/project-load', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            platform: this.config.projectType,
                            project_name: `COS ${grade}급 샘플${sample} ${problem}번`,
                            file_type: buttonType,
                            s3_url: projectUrl,
                            is_cos: true
                        })
                    });
                } catch (error) {
                    console.error('학습 기록 실패:', error);
                }
                return;
            }

            // 🔥 COS 테이블 버튼 클릭 (cos-problem-btn 클래스)
            if (e.target.classList.contains('cos-problem-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const btn = e.target;
                const grade = btn.getAttribute('data-grade');
                const sample = btn.getAttribute('data-sample');
                const problem = btn.getAttribute('data-problem');
                const buttonType = btn.getAttribute('data-button-type'); // solution or answer
                const problems = btn.getAttribute('data-problems');
                const projectUrl = btn.getAttribute('data-url'); // solution/answer params -> projectUrl
                // const projectUrl = this.normalizeUrl(btn.getAttribute('data-url')); // normalize needed?

                // data-img gets the problem image
                const imgUrl = this.normalizeUrl(btn.getAttribute('data-img'));

                console.log('🎯 COS 문제 버튼 클릭:', {
                    grade, sample, problem, buttonType, imgUrl, projectType: this.config.projectType
                });

                // 🔥 플랫폼별 분기
                if (this.config.projectType === 'scratch') {
                    // Scratch: 무조건 8601 서버(내부 cos-editor) 사용
                    console.log('📂 Scratch COS - 8601 서버(내부 에디터)로 이동');

                    let cosEditorUrl = `/cos-editor?platform=${this.config.projectType}&projectUrl=${encodeURIComponent(projectUrl)}&imgUrl=${encodeURIComponent(imgUrl)}`;

                    // 파라미터가 모두 있으면 추가
                    if (grade && sample && problem) {
                        cosEditorUrl += `&grade=${grade}&sample=${sample}&problem=${problem}`;
                    }
                    // problems 데이터도 필요하면 전달 (너무 길면 생략 가능하지만 view에서 필요할 수 있음)
                    if (problems) {
                        cosEditorUrl += `&problems=${encodeURIComponent(problems)}`;
                    }

                    // buttonType 전달
                    cosEditorUrl += `&buttonType=${buttonType || 'solution'}`;

                    window.open(cosEditorUrl, '_blank');
                    return;

                } else if (this.config.projectType === 'entry') {
                    // Entry: Extension 우선 시도
                    if (window.extensionBridge && window.extensionBridge.isExtensionInstalled) {
                        const missionId = `cos-${grade}-${sample}-${problem}`;
                        const missionTitle = `COS ${grade}급 샘플${sample}-${problem}번`;

                        console.log('✅ Entry - Extension 감지 - 공식 에디터로 이동 (문제 이미지 사이드바 포함)');

                        // Entry Extension 호출
                        // data-url is typically the .ent file S3 URL.
                        // Extension expects openUrl (S3 URL or playentry URL) ??
                        // Usually for COS, data-url is the S3 .ent file URL.
                        // Extension openEditor can handle S3 URL if implemented, or we need playentry URL.
                        // But COS entries in DB usually link to S3 file.
                        // Let's assume Extension handles it or we pass a generic 'new' URL with file load?
                        // Wait, previous logic (Step 69) checked if projectUrl.includes('playentry.org').
                        // If it's an S3 URL, does Extension load it?
                        // According to lines 1544-1551 in Step 69, for 'entry-basic-btn', it passes openUrl.

                        // However, for COS table, typically the 'solution' URL IS the .ent file on S3.
                        // If so, `projectUrl` is s3Url.
                        // Does extensionBridge load S3 files?
                        // If not, we might need to rely on the fallback or download logic.
                        // BUT, the user wants "Entry -> Extension (playentry.org popup)".
                        // In educodingnplay (Step 21), the code was:
                        // window.extensionBridge.openEditor({ ... openUrl: 'https://playentry.org/ws/new', ... }) ??
                        // No, in Step 21 it was passing `projectUrl`.
                        // If the user says "Entry -> continue to open web popup and navigate to official homepage",
                        // and effectively they mean use the extension to open playentry.org workspace.

                        // Let's pass the S3 URL. If the extension handles it (by downloading and loading), great.
                        // If not, we might fall back.

                        window.extensionBridge.openEditor({
                            platform: 'entry',
                            missionId: missionId,
                            userId: this.userID || 'guest',
                            missionTitle: missionTitle,
                            openUrl: projectUrl, // S3 URL
                            problemImageUrl: imgUrl,
                            grade: grade,
                            sample: sample,
                            problem: problem
                        });
                        return;
                    } else {
                        // 🔥 Entry - Extension 없음: 팝업으로 문제 이미지 + 새 탭으로 공식 페이지
                        console.log('📂 Entry - Extension 없음 - 문제 팝업 + playentry.org 이동');

                        // projectUrl이 playentry.org 공유 링크인지 확인
                        const isPlayEntryUrl = projectUrl && projectUrl.includes('playentry.org');

                        if (isPlayEntryUrl) {
                            // 공유 프로젝트 링크가 있으면 그대로 사용
                            this.openCosProblemModal(grade, sample, problem, problems, projectUrl, true);
                        } else {
                            // S3 ENT 파일인 경우 - 새 워크스페이스로 이동
                            const newWorkspaceUrl = 'https://playentry.org/ws/new?type=normal&mode=block&lang=ko';
                            this.openCosProblemModal(grade, sample, problem, problems, newWorkspaceUrl, true);
                        }
                        return;
                    }
                }
            }

            // Scratch [기본] 버튼 (기존 코드 시작)
            if (e.target.classList.contains('scratch-basic-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const openUrl = e.target.getAttribute('data-open-url') || e.target.getAttribute('data-url');

                if (!openUrl) {
                    console.error('Scratch 기본 URL이 없습니다');
                    return;
                }

                console.log('🎯 Scratch [기본] 버튼 클릭:', openUrl);

                // Extension이 있는 경우 - Extension에서 처리 (과제 정보 전달)
                if (window.extensionBridge) {
                    console.log('✅ Extension 감지 - 과제 정보와 함께 에디터 열기');
                    const missionId = e.target.getAttribute('data-mission-id') || 'scratch-basic';
                    const missionTitle = e.target.getAttribute('data-mission-title') || 'Scratch Project';
                    const userId = e.target.getAttribute('data-user-id') || this.userID || 'guest';
                    const problemImageUrl = e.target.getAttribute('data-problem-image') || null;

                    const result = window.extensionBridge.openEditor({
                        platform: 'scratch',
                        missionId: missionId,
                        userId: userId,
                        missionTitle: missionTitle,
                        openUrl: openUrl,
                        problemImageUrl: problemImageUrl  // 🔥 문제 이미지 URL 추가
                    });

                    // 🔥 Extension이 설치되지 않아 팝업이 뜨더라도, 강제로 페이지 이동 (유저 요청)
                    if (!result) {
                        console.log('⚠️ Extension 미설치/미준비 - 강제 이동:', openUrl);
                        window.open(openUrl, '_blank');
                    }
                } else {
                    // Extension이 없는 경우 - 단순히 URL로 이동
                    console.log('📂 Extension 없음 - Scratch.mit.edu로 이동');
                    window.open(openUrl, '_blank');
                }
                return;
            }

            // Entry [기본] 버튼 처리
            if (e.target.classList.contains('entry-basic-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const openUrl = e.target.getAttribute('data-open-url') || e.target.getAttribute('data-url');

                if (!openUrl) {
                    console.error('Entry 기본 URL이 없습니다');
                    return;
                }

                console.log('🎯 Entry [기본] 버튼 클릭:', openUrl);

                // Extension이 있는 경우 - Extension에서 처리 (과제 정보 전달)
                if (window.extensionBridge) {
                    console.log('✅ Extension 감지 - 과제 정보와 함께 에디터 열기');
                    const missionId = e.target.getAttribute('data-mission-id') || 'entry-basic';
                    const missionTitle = e.target.getAttribute('data-mission-title') || 'Entry Project';
                    const userId = e.target.getAttribute('data-user-id') || this.userID || 'guest';
                    const problemImageUrl = e.target.getAttribute('data-problem-image') || null;

                    const result = window.extensionBridge.openEditor({
                        platform: 'entry',
                        missionId: missionId,
                        userId: userId,
                        missionTitle: missionTitle,
                        openUrl: openUrl,
                        problemImageUrl: problemImageUrl  // 🔥 문제 이미지 URL 추가
                    });

                    // 🔥 Extension이 설치되지 않아 팝업이 뜨더라도, 강제로 페이지 이동 (유저 요청)
                    if (!result) {
                        console.log('⚠️ Extension 미설치/미준비 - 강제 이동:', openUrl);
                        window.open(openUrl, '_blank');
                    }
                } else {
                    // Extension이 없는 경우 - 단순히 URL로 이동
                    console.log('📂 Extension 없음 - playentry.org로 이동');
                    window.open(openUrl, '_blank');
                }
                return;
            }

            // 기존 load-project 버튼 처리 (COS 카드 버튼 등)
            // 🔥 data-action="open-editor"가 있는 경우 Extension 확인 후 처리
            if (e.target.classList.contains('load-project')) {
                // data-action="open-editor"가 있는 버튼 ([완성][확장] 등)
                if (e.target.getAttribute('data-action') === 'open-editor') {
                    e.preventDefault();
                    e.stopPropagation();

                    const templateUrl = e.target.getAttribute('data-template-url');
                    const missionId = e.target.getAttribute('data-mission-id') || 'project';
                    const missionTitle = e.target.getAttribute('data-mission-title') || 'Project';
                    const userId = e.target.getAttribute('data-user-id') || this.userID || 'guest';
                    const platform = e.target.getAttribute('data-platform') || this.config.projectType;

                    console.log('🎯 [완성/확장] 버튼 클릭:', { templateUrl, missionId, platform });

                    // Extension이 있으면 Extension 처리
                    if (window.extensionBridge && window.extensionBridge.isExtensionInstalled) {
                        console.log('✅ Extension 감지 - Extension으로 처리');
                        window.extensionBridge.openEditor({
                            platform: platform,
                            missionId: missionId,
                            userId: userId,
                            missionTitle: missionTitle,
                            templateUrl: templateUrl
                        });
                    } else {
                        // Extension이 없으면 내부 에디터로 폴백
                        console.log('📂 Extension 없음 - 내부 에디터로 이동');
                        if (platform === 'entry' && templateUrl) {
                            this.loadProjectInEntryGUI(templateUrl);
                        } else if (platform === 'scratch' && templateUrl) {
                            this.loadProjectInScratchGUI(templateUrl);
                        } else {
                            console.error('프로젝트 URL이 없습니다');
                        }
                    }
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                const projectUrl = this.normalizeUrl(e.target.getAttribute('data-url'));  // 🔥 URL 정규화
                if (!projectUrl) return;

                const fileType = e.target.textContent.trim();
                const card = e.target.closest('.project-card') || e.target.closest('.cos-td-btn');
                const projectName = card?.querySelector('.project-card-title')?.textContent || 'COS 문제';

                // 🔥 COS: data-img 속성이 있으면 COS 문제
                const imgUrl = this.normalizeUrl(e.target.getAttribute('data-img'));  // 🔥 URL 정규화
                if (imgUrl) {
                    // COS 자격증 문제 - 프로젝트명에서 급수/샘플/문제번호 파싱
                    // 형식: "COS 1급 샘플1-01"
                    const projectNameAttr = e.target.getAttribute('data-project-name');
                    const match = (projectNameAttr || projectName).match(/COS\s*(\d)급\s*샘플(\d)-(\d+)/i);

                    // 🔥 projectUrl이 playentry.org 링크인지 확인 (Entry 전용)
                    if (projectUrl && projectUrl.includes('playentry.org')) {
                        // Entry만 playentry.org URL을 가짐
                        if (window.extensionBridge && window.extensionBridge.isExtensionInstalled && match) {
                            // Extension 있음: Extension으로 처리
                            const [, grade, sample, problem] = match;
                            const missionId = `cos-${grade}-${sample}-${problem}`;
                            const missionTitle = `COS ${grade}급 샘플${sample}-${problem}번`;

                            console.log('✅ Entry - Extension 감지 - 공식 에디터로 이동 (문제 이미지 사이드바 포함)');

                            window.extensionBridge.openEditor({
                                platform: this.config.projectType,
                                missionId: missionId,
                                userId: this.userID || 'guest',
                                missionTitle: missionTitle,
                                openUrl: projectUrl,
                                problemImageUrl: imgUrl,
                                grade: grade,
                                sample: sample,
                                problem: problem
                            });
                        } else if (match) {
                            // Extension 없음: Entry는 팝업 + playentry.org
                            console.log('📂 Entry - Extension 없음 - 문제 팝업 + playentry.org 이동');
                            const [, grade, sample, problem] = match;
                            const singleProblem = {};
                            singleProblem[problem] = { img: imgUrl, solution: projectUrl };
                            this.openCosProblemModal(grade, sample, problem, JSON.stringify(singleProblem), projectUrl, true);
                        } else {
                            // 파싱 실패 시 그냥 열기
                            window.open(projectUrl, '_blank');
                        }
                    } else if (projectUrl && projectUrl.includes('scratch.mit.edu')) {
                        // 🔥 Scratch.mit.edu URL 처리
                        if (window.extensionBridge && window.extensionBridge.isExtensionInstalled && match) {
                            // Extension 있음: Extension으로 처리
                            const [, grade, sample, problem] = match;
                            const missionId = `cos-${grade}-${sample}-${problem}`;
                            const missionTitle = `COS ${grade}급 샘플${sample}-${problem}번`;

                            console.log('✅ Scratch - Extension 감지 - 공식 에디터로 이동 (문제 이미지 사이드바 포함)');

                            window.extensionBridge.openEditor({
                                platform: this.config.projectType,
                                missionId: missionId,
                                userId: this.userID || 'guest',
                                missionTitle: missionTitle,
                                openUrl: projectUrl,
                                problemImageUrl: imgUrl,
                                grade: grade,
                                sample: sample,
                                problem: problem
                            });
                        } else {
                            // Extension 없음: Scratch는 cos-editor 사용
                            console.log('📂 Scratch - Extension 없음 - cos-editor로 이동');

                            let cosEditorUrl = `/cos-editor?platform=${this.config.projectType}&projectUrl=${encodeURIComponent(projectUrl)}&imgUrl=${encodeURIComponent(imgUrl)}`;

                            if (match) {
                                const [, grade, sample, problem] = match;
                                cosEditorUrl += `&grade=${grade}&sample=${sample}&problem=${problem}`;
                            }

                            window.open(cosEditorUrl, '_blank');
                        }
                    } else {
                        // 🔥 기존 NCP URL인 경우
                        if (match && window.extensionBridge && window.extensionBridge.isExtensionInstalled) {
                            const [, grade, sample, problem] = match;
                            const missionId = `cos-${grade}-${sample}-${problem}`;
                            const missionTitle = `COS ${grade}급 샘플${sample}-${problem}번`;

                            // Extension으로 에디터 열기 (문제 이미지 사이드바 포함)
                            const openUrl = this.config.projectType === 'entry'
                                ? `https://playentry.org/ws/new?type=normal&mode=block&lang=ko`
                                : `https://scratch.mit.edu/projects/editor`;

                            window.extensionBridge.openEditor({
                                platform: this.config.projectType,
                                missionId: missionId,
                                userId: this.userID || 'guest',
                                missionTitle: missionTitle,
                                openUrl: openUrl,
                                problemImageUrl: imgUrl,  // 🔥 정규화된 URL 전달
                                grade: grade,
                                sample: sample,
                                problem: problem
                            });
                        } else if (match) {
                            // 🔥 Extension 없음 - 플랫폼별 처리
                            const [, grade, sample, problem] = match;
                            const singleProblem = {};
                            singleProblem[problem] = { img: imgUrl, solution: projectUrl };

                            if (this.config.projectType === 'scratch') {
                                // Scratch: cos-editor (내부 에디터)
                                console.log('📂 Scratch - Extension 없음 - cos-editor로 이동');
                                let cosEditorUrl = `/cos-editor?platform=${this.config.projectType}&projectUrl=${encodeURIComponent(projectUrl)}&imgUrl=${encodeURIComponent(imgUrl)}`;
                                cosEditorUrl += `&grade=${grade}&sample=${sample}&problem=${problem}`;
                                window.open(cosEditorUrl, '_blank');
                            } else if (this.config.projectType === 'entry') {
                                // Entry: 팝업 + playentry.org
                                console.log('📂 Entry - Extension 없음 - 문제 팝업 + playentry.org 이동');
                                const newWorkspaceUrl = 'https://playentry.org/ws/new?type=normal&mode=block&lang=ko';
                                this.openCosProblemModal(grade, sample, problem, JSON.stringify(singleProblem), newWorkspaceUrl, true);
                            }
                        } else {
                            // match 실패 시 플랫폼별 폴백
                            if (this.config.projectType === 'scratch') {
                                let cosEditorUrl = `/cos-editor?platform=${this.config.projectType}&projectUrl=${encodeURIComponent(projectUrl)}&imgUrl=${encodeURIComponent(imgUrl)}`;
                                window.open(cosEditorUrl, '_blank');
                            } else if (this.config.projectType === 'entry') {
                                const newWorkspaceUrl = 'https://playentry.org/ws/new?type=normal&mode=block&lang=ko';
                                this.openCosProblemModal('', '', '', '{}', newWorkspaceUrl, true);
                            }
                        }
                    }

                    // 학습 기록
                    try {
                        await fetch('/learning/project-load', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                platform: this.config.projectType,
                                project_name: projectName,
                                file_type: fileType,
                                s3_url: projectUrl,
                                is_cos: true
                            })
                        });
                    } catch (error) {
                        console.error('학습 기록 실패:', error);
                    }
                    return; // COS는 여기서 종료
                }

                // 일반 프로젝트: 학습 시작 기록
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

            // Entry 다운로드 버튼
            if (e.target.classList.contains('entry-legacy-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const projectUrl = e.target.getAttribute('data-url');
                if (projectUrl) {
                    this.downloadEntryFile(projectUrl); // Entry 및 Scratch 파일 다운로드
                }
                // Scratch의 경우, 이 버튼은 순수 다운로드이므로 다른 로직으로 넘어가지 않도록 여기서 종료
                if (this.config.projectType === 'scratch') {
                    return;
                }
            }

            if (e.target.classList.contains('scratch-download-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const projectUrl = e.target.getAttribute('data-url');
                const projectName = e.target.getAttribute('data-project-name') || 'Scratch Project';

                console.log('🔍 [DEBUG] Scratch 다운로드 버튼 클릭됨');
                console.log('🔍 [DEBUG] window.extensionBridge:', window.extensionBridge);
                console.log('🔍 [DEBUG] Extension Marker:', document.getElementById('codingnplay-extension-installed'));

                if (projectUrl) {
                    // 사용자 ID 가져오기
                    const userID = this.userID || document.getElementById('user-id')?.value || 'guest';

                    console.log('🚀 Scratch 다운로드 버튼 클릭 - Extension 연동:', projectName);

                    if (window.extensionBridge) {
                        console.log('✅ ExtensionBridge 감지됨 - 확장프로그램으로 요청 전송');
                        const result = window.extensionBridge.openEditor({
                            platform: 'scratch',
                            missionId: `scratch_download_${Date.now()}`, // 고유 ID 부여
                            userId: userID,
                            missionTitle: projectName,
                            templateUrl: projectUrl
                        });
                        console.log('🔍 [DEBUG] openEditor 결과:', result);
                    } else {
                        console.warn('❌ ExtensionBridge not found, showing install guide');
                        alert('확장프로그램이 설치되지 않았습니다.\n\n확장프로그램 설치 가이드 페이지로 이동합니다.');
                        window.open('/extension-guide', '_blank');
                    }
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
