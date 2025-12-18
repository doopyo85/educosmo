/**
 * 💾 Entry 프로젝트 저장 클라이언트
 * 🔄 기존 API 사용: /entry/api/ (ProjectSubmissions 테이블)
 * 
 * 📋 정책 문서: /docs/플랫폼_통합저장소_정책명세서.md
 */

class EntryProjectSaver {
  constructor(options = {}) {
    this.saveInProgress = false;
    this.projectName = options.projectName || '내작품';
    this.userID = options.userID || window.EDUCODINGNPLAY_USER?.userID || 'anonymous';
    this.role = options.role || window.EDUCODINGNPLAY_USER?.role || 'student';
    
    // 🔥 불러온 프로젝트 ID 추적 (덮어쓰기용)
    this.loadedProjectId = null;
    this.loadedProjectName = null;
    
    // 🔥 기존 API 베이스 URL
    this.apiBase = '/entry/api';
    
    console.log('💾 EntryProjectSaver 초기화:', {
        projectName: this.projectName,
        userID: this.userID,
        role: this.role,
        loadedProjectId: this.loadedProjectId,
        apiBase: this.apiBase
    });
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
   * URL에서 projectId 파라미터 확인 (새로고침 대비)
   */
  checkUrlForProjectId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const projectIdParam = urlParams.get('projectId');
      const projectNameParam = urlParams.get('projectName');
      
      if (projectIdParam && !this.loadedProjectId) {
        this.loadedProjectId = parseInt(projectIdParam, 10);
        this.loadedProjectName = projectNameParam || null;
        console.log(`🔄 URL에서 projectId 복원: ${this.loadedProjectId}`);
      }
    } catch (error) {
      console.warn('⚠️ URL projectId 확인 실패:', error);
    }
  }
  
  /**
   * URL에 projectId 파라미터 추가
   */
  updateUrlWithProjectId() {
    try {
      if (!this.loadedProjectId) return;
      
      const url = new URL(window.location.href);
      url.searchParams.set('projectId', this.loadedProjectId);
      if (this.loadedProjectName) {
        url.searchParams.set('projectName', this.loadedProjectName);
      }
      
      window.history.replaceState({}, '', url.toString());
      console.log(`🔗 URL 업데이트 완료`);
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
   * 🔥 프로젝트 저장 (기존 API 사용)
   * POST /entry/api/save-project
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
      console.log('📦 프로젝트 데이터 추출 완료:', {
        objects: projectData.objects?.length || 0,
        scenes: projectData.scenes?.length || 0
      });

      // URL에서 projectId 확인 (새로고침 대비)
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

      console.log(`📤 서버로 전송 중: ${this.apiBase}/save-project`);
      
      // 3. 🔥 기존 API 호출
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
          projectName: projectName,
          userID: this.userID,
          centerID: window.EDUCODINGNPLAY_USER?.centerID || null,
          isUpdate: !!this.loadedProjectId,
          projectId: this.loadedProjectId
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 저장 성공:', result);
        
        // 새 저장 시 projectId 저장 (다음 저장부터 덮어쓰기)
        if (result.projectId) {
          this.loadedProjectId = result.projectId;
          this.loadedProjectName = projectName;
          console.log(`📌 프로젝트 ID 저장: ${this.loadedProjectId}`);
          
          this.updateUrlWithProjectId();
        }
        
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
   * 🔥 프로젝트 목록 불러오기 모달 (기존 API 사용)
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
   * 불러오기 모달 생성
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
      max-width: 700px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
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
      projectListHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">
          ${projects.map(project => `
            <div class="project-item" 
                 data-project-id="${project.id}" 
                 data-project-name="${project.projectName}"
                 data-s3-url="${project.s3Url || ''}"
                 style="
              border: 2px solid #e0e0e0;
              border-radius: 8px;
              overflow: hidden;
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.borderColor='#00B894'; this.style.transform='translateY(-2px)'" 
               onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='none'">
              <div style="
                height: 100px;
                background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
              ">
                <div style="font-size: 36px; color: #00B894;">📦</div>
              </div>
              <div style="padding: 12px;">
                <div style="font-weight: bold; font-size: 14px; color: #333; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${project.projectName}">
                  ${project.projectName}
                </div>
                <div style="font-size: 12px; color: #999;">
                  ${project.createdAt ? new Date(project.createdAt).toLocaleDateString('ko-KR') : ''}
                  ${project.fileSizeKb ? ` · ${this.formatSize(project.fileSizeKb * 1024)}` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #333;">📂 내 프로젝트 불러오기</h3>
        <span style="color: #666; font-size: 14px;">${projects.length}개 프로젝트</span>
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
    
    // 프로젝트 클릭 이벤트
    modalContent.querySelectorAll('.project-item').forEach(item => {
      item.onclick = async () => {
        const projectId = item.getAttribute('data-project-id');
        const projectName = item.getAttribute('data-project-name');
        const s3Url = item.getAttribute('data-s3-url');
        await this.loadProject(projectId, projectName, s3Url);
        document.body.removeChild(modal);
      };
    });
    
    return modal;
  }

  /**
   * 🔥 프로젝트 불러오기 (기존 API 사용)
   * 에디터로 이동하여 S3 URL에서 프로젝트 로드
   */
  async loadProject(projectId, projectName, s3Url) {
    try {
      console.log(`📂 프로젝트 불러오기 시작: ID ${projectId}, URL: ${s3Url}`);
      
      if (!s3Url) {
        throw new Error('프로젝트 URL이 없습니다.');
      }
      
      // 불러온 프로젝트 ID 저장 (덮어쓰기용)
      this.loadedProjectId = projectId;
      this.loadedProjectName = projectName;
      
      // 에디터로 이동 (S3 URL 사용)
      const editorUrl = `/entry/entry_editor?s3Url=${encodeURIComponent(s3Url)}&projectId=${projectId}&projectName=${encodeURIComponent(projectName)}&userID=${this.userID}&role=${this.role}`;
      
      console.log(`✅ 에디터로 이동`);
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

console.log('✅ EntryProjectSaver 로드 완료 (기존 API: /entry/api/)');
