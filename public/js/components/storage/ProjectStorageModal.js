/**
 * 통합 프로젝트 저장소 모달 컴포넌트
 * 스크래치, 엔트리, 파이썬 등 여러 플랫폼에서 공용으로 사용
 * 
 * 사용법:
 * const modal = new ProjectStorageModal({ platform: 'scratch' });
 * modal.openLoadModal(); // 불러오기 모달
 * modal.openSaveModal(projectData, thumbnail); // 저장 모달
 */

class ProjectStorageModal {
    constructor(options = {}) {
        this.platform = options.platform || 'scratch';
        this.onLoad = options.onLoad || null;       // 불러오기 콜백
        this.onSave = options.onSave || null;       // 저장 완료 콜백
        this.onDelete = options.onDelete || null;   // 삭제 콜백
        
        // 플랫폼별 API 엔드포인트 설정
        this.apiEndpoints = this._getApiEndpoints();
        
        // 플랫폼별 설정
        this.platformConfig = {
            scratch: {
                name: '스크래치',
                extension: '.sb3',
                icon: 'bi-puzzle',
                color: '#FF8C1A'
            },
            entry: {
                name: '엔트리',
                extension: '.ent',
                icon: 'bi-box',
                color: '#00B894'
            },
            python: {
                name: '파이썬',
                extension: '.py',
                icon: 'bi-file-code',
                color: '#3776AB'
            },
            appinventor: {
                name: '앱인벤터',
                extension: '.aia',
                icon: 'bi-phone',
                color: '#A4C639'
            }
        };
        
        // 상태
        this.state = {
            projects: [],
            currentFileId: null,        // 현재 열린 프로젝트 ID (덮어쓰기용)
            currentProjectTitle: '',    // 현재 프로젝트 제목
            isLoading: false,
            selectedProjectId: null
        };
        
        // 모달 요소 참조
        this.modalElement = null;
        this.initialized = false;
    }
    
    /**
     * 플랫폼별 API 엔드포인트 반환
     */
    _getApiEndpoints() {
        // 🔥 Entry는 별도 라우터 사용 (/entry/api/)
        if (this.platform === 'entry') {
            return {
                list: '/entry/api/user-projects',
                save: '/entry/api/save-project',
                load: (fileId) => `/entry/api/project/${fileId}`,
                delete: (fileId) => `/entry/api/project/${fileId}`
            };
        }
        
        const baseMap = {
            scratch: '/api/scratch',
            python: '/api/python-storage',
            appinventor: '/api/appinventor-storage'
        };
        
        const base = baseMap[this.platform] || `/api/${this.platform}-storage`;
        
        return {
            list: `${base}/projects`,
            save: `${base}/save-project`,
            load: (fileId) => `${base}/project/${fileId}`,
            delete: (fileId) => `${base}/project/${fileId}`
        };
    }
    
    /**
     * 모달 초기화 (DOM에 모달 추가)
     */
    init() {
        if (this.initialized) return;
        
        const config = this.platformConfig[this.platform] || this.platformConfig.scratch;
        
        const modalHtml = `
        <div class="modal fade" id="projectStorageModal-${this.platform}" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header" style="background: ${config.color}; color: white;">
                        <h5 class="modal-title">
                            <i class="bi ${config.icon} me-2"></i>
                            <span id="storageModalTitle-${this.platform}">${config.name} 프로젝트</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <!-- 🔥 상단 버튼 영역 (불러오기 모드용) -->
                        <div id="topButtons-${this.platform}" class="mb-3 pb-3 border-bottom" style="display: none;">
                            <div class="d-flex justify-content-end gap-2">
                                <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">
                                    <i class="bi bi-x-lg"></i> 취소
                                </button>
                                <button type="button" class="btn btn-danger btn-sm" id="deleteBtnTop-${this.platform}" style="display: none;">
                                    <i class="bi bi-trash"></i> 삭제
                                </button>
                                <button type="button" class="btn btn-primary btn-sm" id="confirmBtnTop-${this.platform}" style="background: ${config.color}; border-color: ${config.color};">
                                    <i class="bi bi-folder2-open"></i> <span id="confirmBtnTextTop-${this.platform}">불러오기</span>
                                </button>
                            </div>
                        </div>
                        
                        <!-- 저장 모드 UI -->
                        <div id="saveMode-${this.platform}" style="display: none;">
                            <div class="mb-3">
                                <label class="form-label">프로젝트 이름</label>
                                <input type="text" class="form-control" id="projectTitleInput-${this.platform}" placeholder="프로젝트 이름을 입력하세요">
                            </div>
                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="overwriteCheck-${this.platform}">
                                    <label class="form-check-label" for="overwriteCheck-${this.platform}">
                                        기존 프로젝트에 덮어쓰기
                                    </label>
                                </div>
                            </div>
                            <div id="overwriteInfo-${this.platform}" style="display: none;" class="alert alert-info">
                                <i class="bi bi-info-circle me-2"></i>
                                <span id="overwriteFileName-${this.platform}"></span>에 덮어씁니다.
                            </div>
                        </div>
                        
                        <!-- 불러오기 모드 UI -->
                        <div id="loadMode-${this.platform}" style="display: none;">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <span class="text-muted" id="projectCount-${this.platform}">0개 프로젝트</span>
                                <button class="btn btn-outline-secondary btn-sm" id="refreshBtn-${this.platform}">
                                    <i class="bi bi-arrow-clockwise"></i> 새로고침
                                </button>
                            </div>
                        </div>
                        
                        <!-- 로딩 상태 -->
                        <div id="loadingState-${this.platform}" style="display: none;" class="text-center py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">로딩중...</span>
                            </div>
                            <p class="mt-2 text-muted">프로젝트를 불러오는 중...</p>
                        </div>
                        
                        <!-- 빈 상태 -->
                        <div id="emptyState-${this.platform}" style="display: none;" class="text-center py-5">
                            <i class="bi bi-folder2-open" style="font-size: 3rem; color: #ccc;"></i>
                            <p class="mt-3 text-muted">저장된 프로젝트가 없습니다.</p>
                        </div>
                        
                        <!-- 프로젝트 목록 -->
                        <div id="projectGrid-${this.platform}" class="row g-3">
                            <!-- 프로젝트 카드들이 여기에 동적으로 추가됨 -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                        <button type="button" class="btn btn-danger" id="deleteBtn-${this.platform}" style="display: none;">
                            <i class="bi bi-trash"></i> 삭제
                        </button>
                        <button type="button" class="btn btn-primary" id="confirmBtn-${this.platform}" style="background: ${config.color}; border-color: ${config.color};">
                            <i class="bi bi-check-lg"></i> <span id="confirmBtnText-${this.platform}">확인</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // DOM에 추가
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        this.modalElement = document.getElementById(`projectStorageModal-${this.platform}`);
        
        // 이벤트 바인딩
        this._bindEvents();
        
        this.initialized = true;
        console.log(`✅ ProjectStorageModal 초기화 완료 (${this.platform})`);
    }
    
    /**
     * 이벤트 바인딩
     */
    _bindEvents() {
        const platform = this.platform;
        
        // 새로고침 버튼
        document.getElementById(`refreshBtn-${platform}`)?.addEventListener('click', () => {
            this._loadProjects();
        });
        
        // 덮어쓰기 체크박스
        document.getElementById(`overwriteCheck-${platform}`)?.addEventListener('change', (e) => {
            const overwriteInfo = document.getElementById(`overwriteInfo-${platform}`);
            if (e.target.checked && this.state.currentFileId) {
                overwriteInfo.style.display = 'block';
            } else {
                overwriteInfo.style.display = 'none';
            }
        });
        
        // 확인 버튼 (하단)
        document.getElementById(`confirmBtn-${platform}`)?.addEventListener('click', () => {
            this._handleConfirm();
        });
        
        // 🔥 확인 버튼 (상단)
        document.getElementById(`confirmBtnTop-${platform}`)?.addEventListener('click', () => {
            this._handleConfirm();
        });
        
        // 삭제 버튼 (하단)
        document.getElementById(`deleteBtn-${platform}`)?.addEventListener('click', () => {
            this._handleDelete();
        });
        
        // 🔥 삭제 버튼 (상단)
        document.getElementById(`deleteBtnTop-${platform}`)?.addEventListener('click', () => {
            this._handleDelete();
        });
        
        // 모달 닫힐 때 상태 초기화
        this.modalElement?.addEventListener('hidden.bs.modal', () => {
            this._resetState();
        });
    }
    
    /**
     * 프로젝트 목록 로드
     */
    async _loadProjects() {
        const platform = this.platform;
        
        this._showLoading(true);
        
        try {
            const response = await fetch(this.apiEndpoints.list, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // 🔥 Entry API 응답 필드명 매핑 (projectName → title, id → fileId)
                let projects = data.projects || [];
                if (this.platform === 'entry') {
                    projects = projects.map(p => ({
                        ...p,
                        fileId: p.id,
                        title: p.projectName,
                        thumbnailUrl: p.thumbnailUrl || null,
                        s3Url: p.s3Url,
                        createdAt: p.updatedAt || p.createdAt,
                        size: p.fileSizeKb ? p.fileSizeKb * 1024 : null,
                        saveType: p.saveType
                    }));
                }
                this.state.projects = projects;
                this._renderProjects();
            } else {
                throw new Error(data.message || '프로젝트 로드 실패');
            }
        } catch (error) {
            console.error('프로젝트 목록 로드 오류:', error);
            this._showError('프로젝트를 불러오는 중 오류가 발생했습니다.');
        } finally {
            this._showLoading(false);
        }
    }
    
    /**
     * 프로젝트 목록 렌더링
     */
    _renderProjects() {
        const platform = this.platform;
        const grid = document.getElementById(`projectGrid-${platform}`);
        const emptyState = document.getElementById(`emptyState-${platform}`);
        const countEl = document.getElementById(`projectCount-${platform}`);
        
        if (!grid) return;
        
        grid.innerHTML = '';
        
        if (this.state.projects.length === 0) {
            emptyState.style.display = 'block';
            grid.style.display = 'none';
            countEl.textContent = '0개 프로젝트';
            return;
        }
        
        emptyState.style.display = 'none';
        grid.style.display = 'flex';
        countEl.textContent = `${this.state.projects.length}개 프로젝트`;
        
        const config = this.platformConfig[platform] || this.platformConfig.scratch;
        
        this.state.projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'col-md-4 col-sm-6';
            card.innerHTML = `
                <div class="card project-card h-100" data-file-id="${project.fileId}" style="cursor: pointer; transition: all 0.2s;">
                    <div class="card-img-top bg-light d-flex align-items-center justify-content-center" 
                         style="height: 120px; overflow: hidden;">
                        ${project.thumbnailUrl 
                            ? `<img src="${project.thumbnailUrl}" alt="${project.title}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.parentElement.innerHTML='<i class=\\'bi ${config.icon}\\' style=\\'font-size: 3rem; color: ${config.color};\\'>'">`
                            : `<i class="bi ${config.icon}" style="font-size: 3rem; color: ${config.color};"></i>`
                        }
                    </div>
                    <div class="card-body p-2">
                        <h6 class="card-title mb-1 text-truncate" title="${project.title}">${project.title}</h6>
                        <small class="text-muted">
                            ${this._formatDate(project.createdAt)}
                            ${project.size ? ` · ${this._formatSize(project.size)}` : ''}
                        </small>
                    </div>
                </div>
            `;
            
            // 클릭 이벤트
            const cardEl = card.querySelector('.project-card');
            cardEl.addEventListener('click', () => {
                this._selectProject(project.fileId);
            });
            
            grid.appendChild(card);
        });
    }
    
    /**
     * 프로젝트 선택
     */
    _selectProject(fileId) {
        const platform = this.platform;
        
        // 이전 선택 해제
        document.querySelectorAll(`#projectGrid-${platform} .project-card`).forEach(card => {
            card.classList.remove('border-primary');
            card.style.boxShadow = '';
        });
        
        // 새 선택
        const selectedCard = document.querySelector(`#projectGrid-${platform} .project-card[data-file-id="${fileId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('border-primary');
            selectedCard.style.boxShadow = '0 0 0 3px rgba(13, 110, 253, 0.25)';
        }
        
        this.state.selectedProjectId = fileId;
        
        // 삭제 버튼 표시 (불러오기 모드일 때) - 🔥 상단/하단 모두
        if (this.mode === 'load') {
            document.getElementById(`deleteBtn-${platform}`).style.display = 'inline-block';
            document.getElementById(`deleteBtnTop-${platform}`).style.display = 'inline-block';
        }
    }
    
    /**
     * 확인 버튼 클릭 처리
     */
    async _handleConfirm() {
        if (this.mode === 'save') {
            await this._saveProject();
        } else if (this.mode === 'load') {
            await this._loadProject();
        }
    }
    
    /**
     * 프로젝트 저장
     */
    async _saveProject() {
        const platform = this.platform;
        const titleInput = document.getElementById(`projectTitleInput-${platform}`);
        const overwriteCheck = document.getElementById(`overwriteCheck-${platform}`);
        
        const title = titleInput?.value?.trim() || '제목 없음';
        const shouldOverwrite = overwriteCheck?.checked && this.state.currentFileId;
        
        this._showLoading(true);
        
        try {
            let url = this.apiEndpoints.save;
            let method = 'POST';
            
            if (shouldOverwrite) {
                url = `${this.apiEndpoints.save}/${this.state.currentFileId}`;
                method = 'PUT';
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    projectData: this.pendingProjectData,
                    title: title,
                    thumbnail: this.pendingThumbnail
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 저장 성공
                this.state.currentFileId = data.fileId;
                this.state.currentProjectTitle = title;
                
                // 모달 닫기
                this._closeModal();
                
                // 콜백 호출
                if (this.onSave) {
                    this.onSave({
                        fileId: data.fileId,
                        title: title,
                        isOverwrite: shouldOverwrite
                    });
                }
                
                alert(`프로젝트가 ${shouldOverwrite ? '업데이트' : '저장'}되었습니다!`);
            } else {
                throw new Error(data.message || '저장 실패');
            }
        } catch (error) {
            console.error('프로젝트 저장 오류:', error);
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this._showLoading(false);
        }
    }
    
    /**
     * 프로젝트 불러오기
     */
    async _loadProject() {
        if (!this.state.selectedProjectId) {
            alert('프로젝트를 선택해주세요.');
            return;
        }
        
        // 🔥 Entry는 s3Url로 에디터 이동 (페이지 리디렉트)
        if (this.platform === 'entry') {
            const project = this.state.projects.find(p => p.fileId === this.state.selectedProjectId);
            if (!project || !project.s3Url) {
                alert('프로젝트 URL을 찾을 수 없습니다.');
                return;
            }
            
            // 에디터로 이동
            const editorUrl = `/entry/entry_editor?s3Url=${encodeURIComponent(project.s3Url)}&projectId=${project.fileId}&projectName=${encodeURIComponent(project.title || '내작품')}`;
            console.log('✅ Entry 에디터로 이동:', editorUrl);
            window.location.href = editorUrl;
            return;
        }
        
        this._showLoading(true);
        
        try {
            const url = this.apiEndpoints.load(this.state.selectedProjectId);
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 불러오기 성공
                this.state.currentFileId = data.project.fileId;
                this.state.currentProjectTitle = data.project.title;
                
                // 모달 닫기
                this._closeModal();
                
                // 콜백 호출
                if (this.onLoad) {
                    this.onLoad({
                        fileId: data.project.fileId,
                        title: data.project.title,
                        url: data.url,
                        project: data.project
                    });
                }
            } else {
                throw new Error(data.message || '불러오기 실패');
            }
        } catch (error) {
            console.error('프로젝트 불러오기 오류:', error);
            alert('불러오기 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this._showLoading(false);
        }
    }
    
    /**
     * 프로젝트 삭제
     */
    async _handleDelete() {
        if (!this.state.selectedProjectId) {
            alert('삭제할 프로젝트를 선택해주세요.');
            return;
        }
        
        const project = this.state.projects.find(p => p.fileId === this.state.selectedProjectId);
        if (!confirm(`"${project?.title || '선택한 프로젝트'}"를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        
        this._showLoading(true);
        
        try {
            const url = this.apiEndpoints.delete(this.state.selectedProjectId);
            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 목록에서 제거
                this.state.projects = this.state.projects.filter(
                    p => p.fileId !== this.state.selectedProjectId
                );
                this.state.selectedProjectId = null;
                
                // 삭제 버튼 숨기기 - 🔥 상단/하단 모두
                document.getElementById(`deleteBtn-${this.platform}`).style.display = 'none';
                document.getElementById(`deleteBtnTop-${this.platform}`).style.display = 'none';
                
                // 목록 다시 렌더링
                this._renderProjects();
                
                // 콜백 호출
                if (this.onDelete) {
                    this.onDelete({ fileId: this.state.selectedProjectId });
                }
                
                alert('프로젝트가 삭제되었습니다.');
            } else {
                throw new Error(data.message || '삭제 실패');
            }
        } catch (error) {
            console.error('프로젝트 삭제 오류:', error);
            alert('삭제 중 오류가 발생했습니다: ' + error.message);
        } finally {
            this._showLoading(false);
        }
    }
    
    /**
     * 불러오기 모달 열기
     */
    openLoadModal() {
        if (!this.initialized) this.init();
        
        this.mode = 'load';
        const platform = this.platform;
        const config = this.platformConfig[platform] || this.platformConfig.scratch;
        
        // UI 설정
        document.getElementById(`storageModalTitle-${platform}`).textContent = `${config.name} 프로젝트 불러오기`;
        document.getElementById(`saveMode-${platform}`).style.display = 'none';
        document.getElementById(`loadMode-${platform}`).style.display = 'block';
        document.getElementById(`confirmBtnText-${platform}`).textContent = '불러오기';
        document.getElementById(`deleteBtn-${platform}`).style.display = 'none';
        
        // 🔥 상단 버튼 영역 표시
        document.getElementById(`topButtons-${platform}`).style.display = 'block';
        document.getElementById(`deleteBtnTop-${platform}`).style.display = 'none';
        document.getElementById(`confirmBtnTextTop-${platform}`).textContent = '불러오기';
        
        // 프로젝트 목록 로드
        this._loadProjects();
        
        // 모달 열기
        this._openModal();
    }
    
    /**
     * 저장 모달 열기
     * @param {*} projectData - 저장할 프로젝트 데이터 (Base64 또는 JSON)
     * @param {string} thumbnail - 썸네일 이미지 (Base64 data URL)
     */
    openSaveModal(projectData, thumbnail = null) {
        if (!this.initialized) this.init();
        
        this.mode = 'save';
        this.pendingProjectData = projectData;
        this.pendingThumbnail = thumbnail;
        
        const platform = this.platform;
        const config = this.platformConfig[platform] || this.platformConfig.scratch;
        
        // UI 설정
        document.getElementById(`storageModalTitle-${platform}`).textContent = `${config.name} 프로젝트 저장`;
        document.getElementById(`saveMode-${platform}`).style.display = 'block';
        document.getElementById(`loadMode-${platform}`).style.display = 'none';
        document.getElementById(`projectGrid-${platform}`).style.display = 'none';
        document.getElementById(`emptyState-${platform}`).style.display = 'none';
        document.getElementById(`confirmBtnText-${platform}`).textContent = '저장';
        document.getElementById(`deleteBtn-${platform}`).style.display = 'none';
        
        // 🔥 상단 버튼 영역 숨기기 (저장 모드에서는 불필요)
        document.getElementById(`topButtons-${platform}`).style.display = 'none';
        
        // 현재 프로젝트 제목 설정
        const titleInput = document.getElementById(`projectTitleInput-${platform}`);
        if (titleInput) {
            titleInput.value = this.state.currentProjectTitle || '';
        }
        
        // 덮어쓰기 옵션 설정
        const overwriteCheck = document.getElementById(`overwriteCheck-${platform}`);
        const overwriteInfo = document.getElementById(`overwriteInfo-${platform}`);
        const overwriteFileName = document.getElementById(`overwriteFileName-${platform}`);
        
        if (this.state.currentFileId) {
            overwriteCheck.disabled = false;
            overwriteFileName.textContent = `"${this.state.currentProjectTitle}"`;
        } else {
            overwriteCheck.checked = false;
            overwriteCheck.disabled = true;
            overwriteInfo.style.display = 'none';
        }
        
        // 모달 열기
        this._openModal();
    }
    
    /**
     * 현재 프로젝트 정보 설정 (덮어쓰기용)
     */
    setCurrentProject(fileId, title) {
        this.state.currentFileId = fileId;
        this.state.currentProjectTitle = title;
    }
    
    /**
     * 현재 프로젝트 정보 가져오기
     */
    getCurrentProject() {
        return {
            fileId: this.state.currentFileId,
            title: this.state.currentProjectTitle
        };
    }
    
    /**
     * 모달 열기
     */
    _openModal() {
        if (this.modalElement && typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(this.modalElement);
            modal.show();
        }
    }
    
    /**
     * 모달 닫기
     */
    _closeModal() {
        if (this.modalElement && typeof bootstrap !== 'undefined') {
            const modal = bootstrap.Modal.getInstance(this.modalElement);
            if (modal) {
                modal.hide();
            }
        }
    }
    
    /**
     * 로딩 상태 표시
     */
    _showLoading(show) {
        const platform = this.platform;
        const loadingState = document.getElementById(`loadingState-${platform}`);
        const projectGrid = document.getElementById(`projectGrid-${platform}`);
        
        if (show) {
            loadingState.style.display = 'block';
            projectGrid.style.display = 'none';
        } else {
            loadingState.style.display = 'none';
        }
        
        this.state.isLoading = show;
    }
    
    /**
     * 에러 표시
     */
    _showError(message) {
        const platform = this.platform;
        const emptyState = document.getElementById(`emptyState-${platform}`);
        
        emptyState.innerHTML = `
            <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: #dc3545;"></i>
            <p class="mt-3 text-danger">${message}</p>
        `;
        emptyState.style.display = 'block';
    }
    
    /**
     * 상태 초기화
     */
    _resetState() {
        this.state.selectedProjectId = null;
        this.pendingProjectData = null;
        this.pendingThumbnail = null;
        
        // 🔥 상단/하단 삭제 버튼 숨기기
        const platform = this.platform;
        const deleteBtnTop = document.getElementById(`deleteBtnTop-${platform}`);
        const deleteBtn = document.getElementById(`deleteBtn-${platform}`);
        if (deleteBtnTop) deleteBtnTop.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    
    /**
     * 날짜 포맷팅
     */
    _formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    /**
     * 파일 크기 포맷팅
     */
    _formatSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// 전역 등록
window.ProjectStorageModal = ProjectStorageModal;

console.log('✅ ProjectStorageModal 컴포넌트 로드 완료');
