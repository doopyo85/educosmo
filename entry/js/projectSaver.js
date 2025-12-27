/**
 * 💾 Entry 프로젝트 저장 클라이언트
 * 🔥 병렬 저장 모델: UserFiles + ProjectSubmissions 동시 기록
 * 🔥 fileId(UserFiles.id) 기반 업데이트/삭제
 * 
 * 📋 정책 문서: /docs/플랫폼_통합저장소_정책명세서.md
 */

class EntryProjectSaver {
  constructor(options = {}) {
    this.saveInProgress = false;
    this.projectName = options.projectName || '내작품';
    this.userID = options.userID || window.EDUCODINGNPLAY_USER?.userID || 'anonymous';
    this.role = options.role || window.EDUCODINGNPLAY_USER?.role || 'student';
    
    // 🔥 불러온 프로젝트 추적 (병렬 저장 모델)
    this.loadedProjectId = null;      // ProjectSubmissions.id
    this.loadedFileId = null;         // 🔥 UserFiles.id (업데이트/삭제용)
    this.loadedProjectName = null;
    
    // 🔥 기존 API 베이스 URL
    this.apiBase = '/entry/api';
    
    console.log('💾 EntryProjectSaver 초기화:', {
        projectName: this.projectName,
        userID: this.userID,
        role: this.role,
        loadedProjectId: this.loadedProjectId,
        loadedFileId: this.loadedFileId,
        apiBase: this.apiBase
    });
    
    // URL에서 fileId 복원 (새로고침 대비)
    this.checkUrlForProjectId();
  }

  /**
   * 프로젝트명 설정
   */
  setProjectName(name) {
    if (name && typeof name === 'string') {
      this.projectName = name.trim();
      console.log(`✅ 프로젝트명 설정됨: ${this.projectName}`);
      
      try {
        if (window.Entry && Entry.State) {
          Entry.State.name = this.projectName;
        }
      } catch (error) {
        console.warn('Entry.State.name 설정 실패:', error);
      }
    }
  }

  /**
   * 현재 프로젝트명 가져오기
   */
  getCurrentProjectName() {
    try {
      if (this.loadedProjectName && this.loadedProjectName !== '내작품') {
        return this.loadedProjectName;
      }
      
      if (this.projectName && this.projectName !== '내작품') {
        return this.projectName;
      }
      
      if (window.Entry && Entry.State && Entry.State.name) {
        const stateName = Entry.State.name;
        if (stateName && stateName !== '내작품') {
          this.projectName = stateName;
          return stateName;
        }
      }
      
      return '내작품';
      
    } catch (error) {
      console.error('프로젝트명 가져오기 실패:', error);
      return '내작품';
    }
  }

  /**
   * 자동 파일명 생성
   */
  generateAutoFileName(projectName) {
    try {
      const now = new Date();
      const dateStr = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
      
      return `${projectName}_${this.userID}_${dateStr}`;
      
    } catch (error) {
      console.error('파일명 생성 오류:', error);
      return projectName || '내작품';
    }
  }

  /**
   * 🔥 URL에서 projectId, fileId 파라미터 확인 (새로고침 대비)
   */
  checkUrlForProjectId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const projectIdParam = urlParams.get('projectId');
      const fileIdParam = urlParams.get('fileId');
      const projectNameParam = urlParams.get('projectName');
      
      if (projectIdParam && !this.loadedProjectId) {
        this.loadedProjectId = parseInt(projectIdParam, 10);
        console.log(`🔄 URL에서 projectId 복원: ${this.loadedProjectId}`);
      }
      
      // 🔥 fileId 복원 (핵심!)
      if (fileIdParam && !this.loadedFileId) {
        this.loadedFileId = parseInt(fileIdParam, 10);
        console.log(`🔄 URL에서 fileId 복원: ${this.loadedFileId}`);
      }
      
      if (projectNameParam && !this.loadedProjectName) {
        this.loadedProjectName = decodeURIComponent(projectNameParam);
      }
    } catch (error) {
      console.warn('⚠️ URL 파라미터 확인 실패:', error);
    }
  }
  
  /**
   * 🔥 URL에 projectId, fileId 파라미터 추가
   */
  updateUrlWithProjectId() {
    try {
      if (!this.loadedProjectId && !this.loadedFileId) return;
      
      const url = new URL(window.location.href);
      
      if (this.loadedProjectId) {
        url.searchParams.set('projectId', this.loadedProjectId);
      }
      if (this.loadedFileId) {
        url.searchParams.set('fileId', this.loadedFileId);
      }
      if (this.loadedProjectName) {
        url.searchParams.set('projectName', this.loadedProjectName);
      }
      
      window.history.replaceState({}, '', url.toString());
      console.log(`🔗 URL 업데이트 완료 (projectId=${this.loadedProjectId}, fileId=${this.loadedFileId})`);
    } catch (error) {
      console.warn('⚠️ URL 업데이트 실패:', error);
    }
  }

  /**
   * 프로젝트 이름 입력 팝업
   */
  async promptProjectName(defaultName = '내작품') {
    return new Promise((resolve) => {
      const modal = this.createPromptModal(defaultName, resolve);
      document.body.appendChild(modal);
    });
  }

  /**
   * 프로젝트 이름 입력 모달 생성
   */
  createPromptModal(defaultName, resolve) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 10px;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

    modalContent.innerHTML = `
      <h3 style="margin-top: 0; color: #333;">💾 프로젝트 저장</h3>
      <p style="color: #666; margin-bottom: 20px;">프로젝트 이름을 입력하세요:</p>
      <input type="text" id="project-name-input" value="${defaultName}" 
        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box;">
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button id="save-confirm" style="
          flex: 1;
          padding: 12px;
          background: #00B894;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        ">저장</button>
        <button id="save-cancel" style="
          flex: 1;
          padding: 12px;
          background: #999;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        ">취소</button>
      </div>
    `;

    modal.appendChild(modalContent);

    const input = modalContent.querySelector('#project-name-input');
    const confirmBtn = modalContent.querySelector('#save-confirm');
    const cancelBtn = modalContent.querySelector('#save-cancel');

    input.focus();
    input.select();

    confirmBtn.onclick = () => {
      const projectName = input.value.trim();
      if (projectName) {
        document.body.removeChild(modal);
        resolve(projectName);
      } else {
        alert('프로젝트 이름을 입력해주세요.');
      }
    };

    cancelBtn.onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };

    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      }
    };

    return modal;
  }

  /**
   * 🔥 스테이지 썸네일 캡처 (Base64)
   * Entry 캔버스를 이미지로 캡처하여 반환
   */
  async captureStageThumb() {
    try {
      // Entry 스테이지 캔버스 찾기
      const stageCanvas = document.querySelector('#entryCanvas') || 
                          document.querySelector('.entryCanvas') ||
                          document.querySelector('canvas[class*="entry"]') ||
                          document.querySelector('#canvas');
      
      if (!stageCanvas) {
        console.warn('⚠️ Entry 캔버스를 찾을 수 없습니다.');
        return null;
      }
      
      // 썸네일 크기 (180x135 = 4:3 비율)
      const thumbWidth = 180;
      const thumbHeight = 135;
      
      // 임시 캔버스 생성
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = thumbWidth;
      tempCanvas.height = thumbHeight;
      const ctx = tempCanvas.getContext('2d');
      
      // 원본 캔버스를 썸네일 크기로 축소하여 그리기
      ctx.drawImage(stageCanvas, 0, 0, thumbWidth, thumbHeight);
      
      // Base64 PNG로 변환 (품질 조절로 용량 최적화)
      const thumbnailBase64 = tempCanvas.toDataURL('image/png', 0.8);
      
      console.log('📸 썸네일 캡처 완료:', {
        originalSize: `${stageCanvas.width}x${stageCanvas.height}`,
        thumbSize: `${thumbWidth}x${thumbHeight}`,
        dataLength: thumbnailBase64.length
      });
      
      return thumbnailBase64;
      
    } catch (error) {
      console.error('❌ 썸네일 캡처 실패:', error);
      return null;
    }
  }

  /**
   * 🔥 프로젝트 저장 (병렬 저장 모델)
   * - 새 프로젝트: POST /entry/api/save-project
   * - 기존 프로젝트: PUT /entry/api/save-project/:fileId
   */
  async saveProject() {
    if (this.saveInProgress) {
      console.log('⚠️ 이미 저장 중입니다.');
      return;
    }

    try {
      this.saveInProgress = true;

      // 1. Entry 프로젝트 데이터 추출
      if (!window.Entry || !Entry.exportProject) {
        throw new Error('Entry가 로드되지 않았습니다.');
      }

      const projectData = Entry.exportProject();
      
      // 🔥 썸네일 캡처
      const thumbnailBase64 = await this.captureStageThumb();
      
      console.log('📦 프로젝트 데이터 추출 완료:', {
        objects: projectData.objects?.length || 0,
        scenes: projectData.scenes?.length || 0,
        hasThumbnail: !!thumbnailBase64
      });

      // URL에서 fileId 확인 (새로고침 대비)
      this.checkUrlForProjectId();
      
      // 2. 프로젝트명 결정
      const currentProjectName = this.getCurrentProjectName();
      const autoFileName = this.generateAutoFileName(currentProjectName);
      const projectName = await this.promptProjectName(
        this.loadedProjectName || autoFileName
      );
      
      if (!projectName) {
        console.log('❌ 저장 취소됨');
        return;
      }

      // 🔥 3. 저장 방식 결정: 새 저장 vs 업데이트
      let url;
      let method;
      
      if (this.loadedFileId) {
        // 🔥 기존 프로젝트: fileId로 업데이트
        url = `${this.apiBase}/save-project/${this.loadedFileId}`;
        method = 'PUT';
        console.log(`📤 업데이트 요청: PUT ${url} (fileId=${this.loadedFileId})`);
      } else {
        // 새 프로젝트 생성
        url = `${this.apiBase}/save-project`;
        method = 'POST';
        console.log(`📤 새 저장 요청: POST ${url}`);
      }
      
      // 4. 🔥 API 호출
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.userID,
          'X-User-Role': this.role
        },
        credentials: 'include',
        body: JSON.stringify({
          projectData: projectData,
          projectName: projectName,
          userID: this.userID,
          centerID: window.EDUCODINGNPLAY_USER?.centerID || null,
          thumbnailBase64: thumbnailBase64
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 저장 성공:', result);
        
        // 🔥 projectId와 fileId 모두 저장 (다음 저장부터 덮어쓰기)
        if (result.projectId) {
          this.loadedProjectId = result.projectId;
        }
        if (result.fileId) {
          this.loadedFileId = result.fileId;
          console.log(`📌 fileId 저장됨: ${this.loadedFileId}`);
        }
        this.loadedProjectName = projectName;
        
        this.updateUrlWithProjectId();
        
        this.showNotification(`💾 저장 완료!`, 'success');
        return result;
      } else {
        throw new Error(result.message || result.error || '저장 실패');
      }

    } catch (error) {
      console.error('❌ 저장 실패:', error);
      this.showNotification('❌ 저장 실패: ' + error.message, 'error');
      throw error;
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * 🔥 프로젝트 목록 불러오기 모달
   * GET /entry/api/user-projects
   */
  async showLoadProjectModal() {
    try {
      console.log('📂 프로젝트 목록 로딩 중...');
      
      const response = await fetch(`${this.apiBase}/user-projects`, {
        credentials: 'include'
      });
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '프로젝트 목록 불러오기 실패');
      }
      
      const projects = result.projects || [];
      console.log(`📁 총 ${projects.length}개 프로젝트 발견`);
      
      this.currentProjects = projects;
      
      const modal = this.createLoadModal(projects);
      document.body.appendChild(modal);
      
    } catch (error) {
      console.error('❌ 불러오기 오류:', error);
      this.showNotification('❌ 프로젝트 목록 불러오기 실패: ' + error.message, 'error');
    }
  }
  
  /**
   * 불러오기 모달 생성 (자동저장 표시 + 썸네일 + 삭제 버튼)
   */
  createLoadModal(projects) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 10px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    // 🔥 자동저장과 일반 저장 분리
    const autosaveProjects = projects.filter(p => p.saveType === 'autosave');
    const normalProjects = projects.filter(p => p.saveType !== 'autosave');
    
    // 프로젝트 목록 HTML 생성
    let projectListHTML = '';
    
    if (projects.length === 0) {
      projectListHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
          <p>저장된 프로젝트가 없습니다.</p>
        </div>
      `;
    } else {
      // 🔥 자동저장 섹션
      let autosaveHTML = '';
      if (autosaveProjects.length > 0) {
        autosaveHTML = `
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="background: #FF9800; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">🔄 자동저장</span>
              <span style="color: #666; font-size: 12px; margin-left: 8px;">${autosaveProjects.length}개</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
              ${autosaveProjects.map(project => this.createProjectCard(project, true)).join('')}
            </div>
          </div>
        `;
      }
      
      // 🔥 일반 저장 섹션
      let normalHTML = '';
      if (normalProjects.length > 0) {
        normalHTML = `
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="background: #00B894; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">💾 내 프로젝트</span>
              <span style="color: #666; font-size: 12px; margin-left: 8px;">${normalProjects.length}개</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
              ${normalProjects.map(project => this.createProjectCard(project, false)).join('')}
            </div>
          </div>
        `;
      }
      
      projectListHTML = autosaveHTML + normalHTML;
    }
    
    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #333;">📂 내 프로젝트 불러오기</h3>
        <span style="color: #666; font-size: 14px;">총 ${projects.length}개</span>
      </div>
      <div style="margin-bottom: 20px;">
        ${projectListHTML}
      </div>
      <div style="text-align: right;">
        <button id="load-cancel" style="
          padding: 12px 24px;
          background: #999;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        ">닫기</button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    
    // 닫기 버튼 이벤트
    modalContent.querySelector('#load-cancel').onclick = () => {
      document.body.removeChild(modal);
    };
    
    // 🔥 프로젝트 카드 클릭 이벤트 (삭제 버튼 제외)
    modalContent.querySelectorAll('.project-item').forEach(item => {
      item.onclick = async (e) => {
        // 삭제 버튼 클릭 시 무시
        if (e.target.closest('.delete-btn')) return;
        
        const projectId = item.getAttribute('data-project-id');
        const fileId = item.getAttribute('data-file-id');  // 🔥 fileId 추가
        const projectName = item.getAttribute('data-project-name');
        const s3Url = item.getAttribute('data-s3-url');
        await this.loadProject(projectId, fileId, projectName, s3Url);
        document.body.removeChild(modal);
      };
    });
    
    // 🔥 삭제 버튼 이벤트
    modalContent.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const projectId = btn.getAttribute('data-project-id');
        const fileId = btn.getAttribute('data-file-id');  // 🔥 fileId 사용
        const projectName = btn.getAttribute('data-project-name');
        await this.deleteProject(fileId, projectName, modal);
      };
    });
    
    return modal;
  }

  /**
   * 🔥 프로젝트 카드 HTML 생성 (썸네일 + 삭제 버튼 + fileId)
   */
  createProjectCard(project, isAutosave) {
    const borderColor = isAutosave ? '#FF9800' : '#e0e0e0';
    const hoverColor = isAutosave ? '#FF9800' : '#00B894';
    const iconColor = isAutosave ? '#FF9800' : '#00B894';
    const icon = isAutosave ? '🔄' : '📦';
    
    // 썸네일 URL (있으면 사용, 없으면 기본 아이콘)
    const thumbnailHtml = project.thumbnailUrl 
      ? `<img src="${project.thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentNode.innerHTML='<div style=font-size:36px;color:${iconColor}>${icon}</div>'">`
      : `<div style="font-size: 36px; color: ${iconColor};">${icon}</div>`;
    
    return `
      <div class="project-item" 
           data-project-id="${project.id}" 
           data-file-id="${project.fileId || ''}"
           data-project-name="${project.projectName}"
           data-s3-url="${project.s3Url || ''}"
           style="
        border: 2px solid ${borderColor};
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      " onmouseover="this.style.borderColor='${hoverColor}'; this.style.transform='translateY(-2px)'; this.querySelector('.delete-btn').style.opacity='1';" 
         onmouseout="this.style.borderColor='${borderColor}'; this.style.transform='none'; this.querySelector('.delete-btn').style.opacity='0';">
        
        <!-- 🔥 삭제 버튼 (hover 시 표시) -->
        <button class="delete-btn" 
                data-project-id="${project.id}" 
                data-file-id="${project.fileId || ''}"
                data-project-name="${project.projectName}"
                style="
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(220, 53, 69, 0.9);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          z-index: 10;
          opacity: 0;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        " title="삭제">✕</button>
        
        <!-- 썸네일 영역 -->
        <div style="
          height: 100px;
          background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        ">
          ${thumbnailHtml}
        </div>
        
        <!-- 정보 영역 -->
        <div style="padding: 10px;">
          <div style="font-weight: bold; font-size: 13px; color: #333; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${project.projectName}">
            ${project.projectName}
          </div>
          <div style="font-size: 11px; color: #999;">
            ${project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('ko-KR') : (project.createdAt ? new Date(project.createdAt).toLocaleDateString('ko-KR') : '')}
            ${project.fileSizeKb ? ` · ${this.formatSize(project.fileSizeKb * 1024)}` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 🔥 프로젝트 삭제 (fileId 기반)
   */
  async deleteProject(fileId, projectName, modal) {
    if (!fileId) {
      this.showNotification('❌ 삭제할 수 없습니다: 파일 ID가 없습니다.', 'error');
      return;
    }
    
    const confirmed = confirm(`"${projectName}" 프로젝트를 삭제하시겠습니까?\n\n삭제된 프로젝트는 휴지통으로 이동됩니다.`);
    if (!confirmed) return;
    
    try {
      // 🔥 fileId로 삭제 요청
      const response = await fetch(`${this.apiBase}/project/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-User-ID': this.userID,
          'X-User-Role': this.role
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showNotification(`🗑️ "${projectName}" 삭제됨`, 'success');
        
        // 현재 열려있는 프로젝트가 삭제된 경우 초기화
        if (this.loadedFileId == fileId) {
          this.loadedProjectId = null;
          this.loadedFileId = null;
          this.loadedProjectName = null;
        }
        
        // 모달 새로고침
        if (modal && modal.parentNode) {
          document.body.removeChild(modal);
        }
        await this.showLoadProjectModal(); // 목록 다시 로드
      } else {
        throw new Error(result.error || '삭제 실패');
      }
    } catch (error) {
      console.error('❌ 프로젝트 삭제 실패:', error);
      this.showNotification('❌ 삭제 실패: ' + error.message, 'error');
    }
  }

  /**
   * 🔥 프로젝트 불러오기 (fileId 포함)
   * 에디터로 이동하여 S3 URL에서 프로젝트 로드
   */
  async loadProject(projectId, fileId, projectName, s3Url) {
    try {
      console.log(`📂 프로젝트 불러오기 시작: projectId=${projectId}, fileId=${fileId}, URL: ${s3Url}`);
      
      if (!s3Url) {
        throw new Error('프로젝트 URL이 없습니다.');
      }
      
      // 🔥 projectId와 fileId 모두 저장 (덮어쓰기용)
      this.loadedProjectId = projectId;
      this.loadedFileId = fileId;
      this.loadedProjectName = projectName;
      
      // 🔥 에디터로 이동 (fileId 포함)
      const editorUrl = `/entry/entry_editor?s3Url=${encodeURIComponent(s3Url)}&projectId=${projectId}&fileId=${fileId}&projectName=${encodeURIComponent(projectName)}&userID=${this.userID}&role=${this.role}`;
      
      console.log(`✅ 에디터로 이동 (fileId=${fileId})`);
      window.location.href = editorUrl;
      
    } catch (error) {
      console.error('❌ 프로젝트 불러오기 실패:', error);
      alert('프로젝트를 불러오는데 실패했습니다: ' + error.message);
    }
  }

  /**
   * 파일 크기 포맷팅
   */
  formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * 알림 표시
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
      success: '#00B894',
      error: '#f44336',
      info: '#2196F3',
      warning: '#FF9800'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      font-size: 16px;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * 🔥 ENT 파일로 다운로드
   */
  async downloadProject() {
    try {
      console.log('⬇️ ENT 파일 다운로드 시작...');
      
      if (!window.Entry || !Entry.exportProject) {
        throw new Error('Entry가 로드되지 않았습니다.');
      }

      const projectData = Entry.exportProject();
      
      const currentProjectName = this.getCurrentProjectName();
      const defaultFileName = this.generateAutoFileName(currentProjectName);
      
      const fileName = await this.promptDownloadFileName(defaultFileName);
      if (!fileName) {
        console.log('❌ 다운로드 취소됨');
        return;
      }

      this.showNotification('📦 ENT 파일 생성 중...', 'info');
      
      // 서버 API로 ENT 파일 생성
      try {
        const response = await fetch('/entry/api/create-ent-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            projectData: projectData
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const downloadFileName = fileName.endsWith('.ent') ? fileName : `${fileName}.ent`;
          this.triggerDownload(blob, downloadFileName);
          this.showNotification(`⬇️ 다운로드 완료: ${downloadFileName}`, 'success');
          return;
        }
      } catch (e) {
        console.warn('서버 ENT 생성 실패, JSON으로 대체:', e);
      }
      
      // 대체: JSON으로 저장
      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const downloadFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
      this.triggerDownload(blob, downloadFileName);
      this.showNotification(`⬇️ JSON으로 다운로드 완료`, 'warning');
      
    } catch (error) {
      console.error('❌ 다운로드 실패:', error);
      this.showNotification('❌ 다운로드 실패: ' + error.message, 'error');
    }
  }

  /**
   * 다운로드 파일명 입력 모달
   */
  async promptDownloadFileName(defaultName) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 400px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `;

      modalContent.innerHTML = `
        <h3 style="margin-top: 0; color: #333;">⬇️ ENT 파일 다운로드</h3>
        <p style="color: #666; margin-bottom: 20px;">파일명을 입력하세요:</p>
        <input type="text" id="download-name-input" value="${defaultName}" 
          style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box;">
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button id="download-confirm" style="
            flex: 1;
            padding: 12px;
            background: #00B894;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          ">다운로드</button>
          <button id="download-cancel" style="
            flex: 1;
            padding: 12px;
            background: #999;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          ">취소</button>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      const input = modalContent.querySelector('#download-name-input');
      const confirmBtn = modalContent.querySelector('#download-confirm');
      const cancelBtn = modalContent.querySelector('#download-cancel');

      input.focus();
      input.select();

      confirmBtn.onclick = () => {
        const fileName = input.value.trim();
        if (fileName) {
          document.body.removeChild(modal);
          resolve(fileName);
        } else {
          alert('파일명을 입력해주세요.');
        }
      };

      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      input.onkeypress = (e) => {
        if (e.key === 'Enter') {
          confirmBtn.click();
        }
      };
    });
  }

  /**
   * 파일 다운로드 트리거
   */
  triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 🔥 제출하기 (교사에게 제출)
   */
  async submitProject() {
    try {
      if (!window.Entry || !Entry.exportProject) {
        throw new Error('Entry가 로드되지 않았습니다.');
      }

      const confirmed = confirm('현재 프로젝트를 제출하시겠습니까?\n제출된 작품은 선생님이 확인할 수 있습니다.');
      if (!confirmed) {
        return;
      }

      const projectData = Entry.exportProject();
      const projectName = this.getCurrentProjectName();

      this.showNotification('📤 제출 중...', 'info');

      const response = await fetch(`${this.apiBase}/save-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.userID,
          'X-User-Role': this.role
        },
        credentials: 'include',
        body: JSON.stringify({
          projectData: projectData,
          projectName: `[제출] ${projectName}`,
          userID: this.userID,
          centerID: window.EDUCODINGNPLAY_USER?.centerID || null,
          saveType: 'submissions'
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showNotification('✅ 제출 완료! 선생님이 확인할 수 있습니다.', 'success');
        return result;
      } else {
        throw new Error(result.message || '제출 실패');
      }

    } catch (error) {
      console.error('❌ 제출 실패:', error);
      this.showNotification('❌ 제출 실패: ' + error.message, 'error');
      throw error;
    }
  }
}

// 전역에서 사용 가능하도록 노출
window.EntryProjectSaver = EntryProjectSaver;

console.log('✅ EntryProjectSaver 로드 완료 (병렬 저장 모델: fileId 기반)');
