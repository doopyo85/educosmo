/**
 * 💾 Entry 프로젝트 저장 클라이언트
 */

class EntryProjectSaver {
  constructor(options = {}) {
    this.saveInProgress = false;
    this.projectName = options.projectName || '내작품';
    this.userID = options.userID || window.EDUCODINGNPLAY_USER?.userID || 'anonymous';
    this.role = options.role || window.EDUCODINGNPLAY_USER?.role || 'student';
    
    // 🔥 불러온 프로젝트 ID 추적 (덮어쓰기용)
    this.loadedFileId = null;
    this.loadedProjectName = null;
    
    console.log('💾 EntryProjectSaver 초기화:', {
        projectName: this.projectName,
        userID: this.userID,
        role: this.role,
        loadedFileId: this.loadedFileId
    });
  }

  /**
   * 🔥 프로젝트 데이터 검증 및 필수 속성 추가
   * @param {Object} projectData - 원본 프로젝트 데이터
   * @returns {Object} 검증된 프로젝트 데이터
   */
  validateProjectData(projectData) {
    if (!projectData || typeof projectData !== 'object') {
      throw new Error('유효하지 않은 프로젝트 데이터입니다.');
    }
    
    // 필수 속성 기본값 설정
    const validated = {
      ...projectData,
      objects: projectData.objects || [],
      scenes: projectData.scenes || [{
        name: '장면1',
        id: this.generateId()
      }],
      variables: projectData.variables || [],
      messages: projectData.messages || [],
      functions: projectData.functions || [],
      tables: projectData.tables || [],
      speed: projectData.speed || 60,
      expansionBlocks: projectData.expansionBlocks || [],
      externalModules: projectData.externalModules || [],
      
      // 🔥 Entry.js가 요구하는 추가 속성
      interface: projectData.interface || 'practical',
      canvasWidth: projectData.canvasWidth || 480,
      canvasHeight: projectData.canvasHeight || 270,
      category: projectData.category || 'default'
    };
    
    // objects 각 요소 검증
    validated.objects = validated.objects.map(obj => this.validateObject(obj));
    
    console.log('✅ 프로젝트 데이터 검증 완료:', {
      objects: validated.objects.length,
      scenes: validated.scenes.length,
      variables: validated.variables.length
    });
    
    return validated;
  }
  
  /**
   * 🔥 오브젝트 데이터 검증
   */
  validateObject(obj) {
    return {
      ...obj,
      id: obj.id || this.generateId(),
      name: obj.name || '오브젝트1',
      script: obj.script || [],
      sprite: obj.sprite ? this.validateSprite(obj.sprite) : this.createDefaultSprite()
    };
  }
  
  /**
   * 🔥 스프라이트 데이터 검증
   */
  validateSprite(sprite) {
    return {
      ...sprite,
      name: sprite.name || '스프라이트1',
      pictures: sprite.pictures || [],
      sounds: sprite.sounds || []
    };
  }
  
  /**
   * 🔥 기본 스프라이트 생성
   */
  createDefaultSprite() {
    return {
      name: '스프라이트1',
      pictures: [],
      sounds: []
    };
  }
  
  /**
   * 🔥 고유 ID 생성
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * 🔥 프로젝트명 설정 (외부에서 호출 가능)
   * @param {string} name - 설정할 프로젝트명
   */
  setProjectName(name) {
    if (name && typeof name === 'string') {
      this.projectName = name.trim();
      console.log(`✅ 프로젝트명 설정됨: ${this.projectName}`);
      
      // Entry.State에도 저장 시도
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
   * 🔥 사용자 ID 설정
   * @param {string} userID - 설정할 사용자 ID
   */
  setUserID(userID) {
    if (userID && typeof userID === 'string') {
      this.userID = userID.trim();
      console.log(`✅ 사용자 ID 설정됨: ${this.userID}`);
    }
  }

  /**
   * 🔥 역할 설정
   * @param {string} role - 설정할 역할
   */
  setRole(role) {
    if (role && typeof role === 'string') {
      this.role = role.trim();
      console.log(`✅ 역할 설정됨: ${this.role}`);
    }
  }

  /**
   * 🔥 현재 프로젝트명 가져오기 (우선순위 적용)
   * 1. 로컬 저장된 프로젝트명
   * 2. Entry.State.name
   * 3. 기본값 "내작품"
   */
  getCurrentProjectName() {
    try {
      // 1순위: 로컬 저장된 프로젝트명
      if (this.projectName && this.projectName !== '내작품') {
        console.log(`📌 로컬 프로젝트명 사용: ${this.projectName}`);
        return this.projectName;
      }
      
      // 2순위: Entry.State에서 프로젝트명 가져오기
      if (window.Entry && Entry.State && Entry.State.name) {
        const stateName = Entry.State.name;
        if (stateName && stateName !== '내작품') {
          console.log(`📌 Entry.State 프로젝트명 사용: ${stateName}`);
          this.projectName = stateName; // 로컬에도 저장
          return stateName;
        }
      }
      
      // 3순위: 기본값
      console.log('📌 기본 프로젝트명 사용: 내작품');
      return '내작품';
      
    } catch (error) {
      console.error('프로젝트명 가져오기 실패:', error);
      return '내작품';
    }
  }

  /**
   * 🔥 파일명에서 프로젝트명 추출 (확장자 제거)
   * @param {string} fileName - 파일명 (예: "cpe1-1a.ent")
   * @returns {string} 프로젝트명 (예: "cpe1-1a")
   */
  extractProjectNameFromFile(fileName) {
    try {
      if (!fileName) return '내작품';
      
      // 확장자 제거 (.ent)
      let projectName = fileName;
      if (projectName.endsWith('.ent')) {
        projectName = projectName.slice(0, -4);
      }
      
      // 타임스탬프 제거 (예: "_1234567890" 형태)
      projectName = projectName.replace(/_\d{10,}$/, '');
      
      console.log(`🔍 파일명에서 추출: ${fileName} → ${projectName}`);
      return projectName || '내작품';
      
    } catch (error) {
      console.error('파일명 추출 실패:', error);
      return '내작품';
    }
  }

  /**
   * 🔥 자동 파일명 생성 (프로젝트명_사용자명_날짜)
   */
  generateAutoFileName(projectName) {
    try {
      // 날짜 생성 (YYYYMMDD 형식)
      const now = new Date();
      const dateStr = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
      
      // 파일명 조합
      const fileName = `${projectName}_${this.userID}_${dateStr}`;
      
      console.log(`🔤 자동 파일명 생성: ${fileName}`);
      return fileName;
      
    } catch (error) {
      console.error('파일명 생성 오류:', error);
      return projectName || '내작품';
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
          background: #4CAF50;
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

    // 이벤트 리스너
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

    // Enter 키로 저장
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      }
    };

    return modal;
  }

  /**
   * 🔥 프로젝트 저장 (draft) - 덮어쓰기/새저장 자동 분기
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

      // 🔥 URL에서 fileId 파라미터 확인 (페이지 새로고침 대비)
      this.checkUrlForFileId();
      
      // 2. 불러온 프로젝트인지 확인 (POST vs PUT)
      const isUpdate = !!this.loadedFileId;
      
      // 3. 프로젝트명 결정
      let projectName;
      if (isUpdate) {
        // 덮어쓰기: 기존 프로젝트명 사용 또는 변경
        const defaultName = this.loadedProjectName || this.getCurrentProjectName();
        projectName = await this.promptProjectName(defaultName);
      } else {
        // 새 저장: 자동 파일명 생성
        const currentProjectName = this.getCurrentProjectName();
        const autoFileName = this.generateAutoFileName(currentProjectName);
        projectName = await this.promptProjectName(autoFileName);
      }
      
      if (!projectName) {
        console.log('❌ 저장 취소됨');
        return;
      }

      console.log(`🔍 저장 시도 - 모드: ${isUpdate ? '덮어쓰기' : '새저장'}, 프로젝트명: ${projectName}, 사용자: ${this.userID}`);

      // 4. 🔥 POST/PUT 분기
      const url = isUpdate 
        ? `/api/projects/save/${this.loadedFileId}`
        : '/api/projects/save';
      const method = isUpdate ? 'PUT' : 'POST';
      
      console.log(`📤 서버로 전송 중 (${method}): ${url}`);
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: 'entry',
          projectName: projectName,
          projectData: projectData,
          saveType: 'draft'
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 저장 성공:', result);
        
        // 🔥 새 저장 시 반환된 fileId 저장 (다음 저장부터 덮어쓰기)
        if (!isUpdate && result.submissionId) {
          this.loadedFileId = result.submissionId;
          this.loadedProjectName = projectName;
          console.log(`📌 새 프로젝트 ID 저장: ${this.loadedFileId}`);
          
          // URL 업데이트 (페이지 새로고침 대비)
          this.updateUrlWithFileId();
        }
        
        this.showNotification(`💾 ${isUpdate ? '덮어쓰기' : '저장'} 완료!`, 'success');
        return result;
      } else {
        throw new Error(result.error || '저장 실패');
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
   * 🔥 URL에서 fileId 파라미터 확인 (페이지 새로고침 시 복원)
   */
  checkUrlForFileId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fileIdParam = urlParams.get('fileId');
      const projectNameParam = urlParams.get('projectName');
      
      if (fileIdParam && !this.loadedFileId) {
        this.loadedFileId = parseInt(fileIdParam, 10);
        this.loadedProjectName = projectNameParam || null;
        console.log(`🔄 URL에서 fileId 복원: ${this.loadedFileId}`);
      }
    } catch (error) {
      console.warn('⚠️ URL fileId 확인 실패:', error);
    }
  }
  
  /**
   * 🔥 URL에 fileId 파라미터 추가 (새로고침 대비)
   */
  updateUrlWithFileId() {
    try {
      if (!this.loadedFileId) return;
      
      const url = new URL(window.location.href);
      url.searchParams.set('fileId', this.loadedFileId);
      if (this.loadedProjectName) {
        url.searchParams.set('projectName', this.loadedProjectName);
      }
      
      // URL 변경 (페이지 새로고침 없이)
      window.history.replaceState({}, '', url.toString());
      console.log(`🔗 URL 업데이트: ${url.toString()}`);
    } catch (error) {
      console.warn('⚠️ URL 업데이트 실패:', error);
    }
  }

  /**
   * 🔥 프로젝트 제출 (final) - 자동 파일명, 팝업 없음
   */
  async submitProject() {
    if (!confirm('정말 제출하시겠습니까?\n제출 후에는 수정할 수 없습니다.')) {
      return;
    }

    if (this.saveInProgress) {
      console.log('⚠️ 이미 제출 중입니다.');
      return;
    }

    try {
      this.saveInProgress = true;

      // 1. Entry 프로젝트 데이터 추출
      if (!window.Entry || !Entry.exportProject) {
        throw new Error('Entry가 로드되지 않았습니다.');
      }

      const projectData = Entry.exportProject();
      
      // 2. 🔥 자동 파일명 생성 (입력 팝업 없음)
      const currentProjectName = this.getCurrentProjectName();
      const autoFileName = this.generateAutoFileName(currentProjectName);
      
      console.log(`📤 제출 중 - 프로젝트명: ${currentProjectName}, 사용자: ${this.userID}, 파일명: ${autoFileName}`);

      // 3. 서버로 전송 (통합 API - final)
      const response = await fetch('/api/projects/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: 'entry',        // 🔥 플랫폼 구분
          projectName: autoFileName,  // 🔥 자동 생성된 파일명
          projectData: projectData,
          saveType: 'final'  // 🔥 제출 타입
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 제출 완료:', result);
        this.showNotification(`✅ 제출 완료!\n파일명: ${autoFileName}`, 'success');
        return result;
      } else {
        throw new Error(result.error || '제출 실패');
      }

    } catch (error) {
      console.error('❌ 제출 실패:', error);
      this.showNotification('❌ 제출 실패: ' + error.message, 'error');
      throw error;
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * 프로젝트 불러오기 모달 표시
   */
  async showLoadProjectModal() {
    try {
      // 1. 사용자의 프로젝트 목록 가져오기
      console.log('📂 프로젝트 목록 로딩 중...');
      
      // 🔥 수정: 통합 API 사용
      const response = await fetch('/api/projects/list?platform=entry');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '프로젝트 목록 불러오기 실패');
      }
      
      const projects = result.projects || [];
      console.log(`📁 총 ${projects.length}개 프로젝트 발견`);
      
      // 🔥 프로젝트 목록 저장 (loadProject에서 사용)
      this.currentProjects = projects;
      
      // 2. 모달 생성
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
      max-width: 600px;
      max-height: 70vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    // 프로젝트 목록 HTML 생성
    let projectListHTML = '';
    
    if (projects.length === 0) {
      projectListHTML = '<p style="color: #999; text-align: center; padding: 20px;">저장된 프로젝트가 없습니다.</p>';
    } else {
      projectListHTML = projects.map((project, index) => `
        <div class="project-item" 
             data-project-id="${project.id}" 
             data-project-name="${project.project_name}"
             data-s3-url="${project.s3_url}" 
             style="
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 15px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#f5f5f5'; this.style.borderColor='#537EC5'" onmouseout="this.style.background='white'; this.style.borderColor='#ddd'">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: bold; font-size: 16px; color: #333; margin-bottom: 5px;">
                ${project.project_name}
              </div>
              <div style="font-size: 13px; color: #999;">
                ${new Date(project.created_at).toLocaleString('ko-KR')}
              </div>
            </div>
            <div style="
              padding: 4px 12px;
              background: ${project.save_type === 'final' ? '#FF6B35' : '#537EC5'};
              color: white;
              border-radius: 3px;
              font-size: 12px;
              font-weight: 500;
            ">
              ${project.save_type === 'final' ? '✅ 제출됨' : '💾 저장됨'}
            </div>
          </div>
        </div>
      `).join('');
    }
    
    modalContent.innerHTML = `
      <h3 style="margin-top: 0; color: #333;">📂 프로젝트 불러오기</h3>
      <p style="color: #666; margin-bottom: 20px;">불러오고 싶은 프로젝트를 선택하세요:</p>
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
        await this.loadProject(projectId, projectName);
        document.body.removeChild(modal);
      };
    });
    
    return modal;
  }

  /**
   * 🔥 프로젝트 불러오기 (S3 Browser 방식)
   */
  async loadProject(projectId, projectName) {
    try {
        console.log(`📂 프로젝트 불러오기 시작: ID ${projectId}`);
        
        // 1. 메타데이터 API로 S3 URL 직접 가져오기
        const metaResponse = await fetch(`/api/projects/${projectId}/metadata`);
        
        if (!metaResponse.ok) {
            console.error(`❌ 메타데이터 API 오류: ${metaResponse.status}`);
            throw new Error(`API 오류: ${metaResponse.status}`);
        }
        
        const metaData = await metaResponse.json();
        
        console.log('📦 메타데이터 수신:', metaData);
        
        // 2. S3 URL 추출
        const s3Url = metaData.s3Url;
        
        if (!s3Url) {
            console.error('❌ S3 URL 없음:', metaData);
            throw new Error('프로젝트 파일을 찾을 수 없습니다');
        }
        
        console.log('🔗 S3 URL:', s3Url);
        
        // 🔥 불러온 프로젝트 ID 저장 (덮어쓰기용)
        this.loadedFileId = projectId;
        this.loadedProjectName = projectName || metaData.projectName;
        console.log(`📌 불러온 프로젝트 ID 저장: ${this.loadedFileId}, 이름: ${this.loadedProjectName}`);
        
        // 3. S3 Browser 방식으로 에디터 열기 (s3Url + fileId 파라미터 사용)
        const editorUrl = `/entry/entry_editor?s3Url=${encodeURIComponent(s3Url)}&fileId=${projectId}&projectName=${encodeURIComponent(this.loadedProjectName)}`;
        
        console.log(`✅ 에디터로 이동: ${editorUrl}`);
        
        // 현재 창에서 열기
        window.location.href = editorUrl;
        
    } catch (error) {
        console.error('❌ 프로젝트 불러오기 실패:', error);
        alert('프로젝트를 불러오는데 실패했습니다: ' + error.message);
    }
  }

  /**
   * 알림 표시
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 15px 25px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 9999;
      font-size: 16px;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  /**
   * 🔥 ENT 파일로 다운로드 (오프라인 엔트리 호환)
   */
  async downloadProject() {
    try {
      console.log('⬇️ ENT 파일 다운로드 시작...');
      
      // 1. Entry 프로젝트 데이터 추출
      if (!window.Entry || !Entry.exportProject) {
        throw new Error('Entry가 로드되지 않았습니다.');
      }

      const projectData = Entry.exportProject();
      console.log('📦 프로젝트 데이터 추출 완료:', {
        objects: projectData.objects?.length || 0,
        scenes: projectData.scenes?.length || 0
      });

      // 2. 파일명 입력 받기
      const currentProjectName = this.getCurrentProjectName();
      const defaultFileName = this.generateAutoFileName(currentProjectName);
      
      const fileName = await this.promptDownloadFileName(defaultFileName);
      if (!fileName) {
        console.log('❌ 다운로드 취소됨');
        return;
      }

      // 3. 오브젝트에서 이미지 데이터 추출
      const images = this.extractImagesFromProject(projectData);
      const sounds = this.extractSoundsFromProject(projectData);
      
      console.log(`🖼️ 이미지: ${images.length}개, 🔊 사운드: ${sounds.length}개`);

      // 4. ENT 파일 생성 (tar.gz 형식)
      this.showNotification('📦 ENT 파일 생성 중...', 'info');
      
      const entBlob = await this.createEntFile(projectData, images, sounds);
      
      // 5. 다운로드 실행
      const downloadFileName = fileName.endsWith('.ent') ? fileName : `${fileName}.ent`;
      this.triggerDownload(entBlob, downloadFileName);
      
      console.log(`✅ 다운로드 완료: ${downloadFileName}`);
      this.showNotification(`⬇️ 다운로드 완료: ${downloadFileName}`, 'success');
      
    } catch (error) {
      console.error('❌ 다운로드 실패:', error);
      this.showNotification('❌ 다운로드 실패: ' + error.message, 'error');
    }
  }

  /**
   * 🔥 다운로드 파일명 입력 모달
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
        <p style="color: #666; margin-bottom: 10px;">오프라인 엔트리에서 열 수 있는 .ent 파일로 저장합니다.</p>
        <p style="color: #888; font-size: 13px; margin-bottom: 20px;">파일명을 입력하세요:</p>
        <input type="text" id="download-name-input" value="${defaultName}" 
          style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box;">
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button id="download-confirm" style="
            flex: 1;
            padding: 12px;
            background: #4f80ff;
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
   * 🔥 프로젝트에서 이미지 데이터 추출
   */
  extractImagesFromProject(projectData) {
    const images = [];
    
    try {
      // 모든 오브젝트의 스프라이트에서 이미지 추출
      if (projectData.objects) {
        projectData.objects.forEach(obj => {
          if (obj.sprite && obj.sprite.pictures) {
            obj.sprite.pictures.forEach(picture => {
              if (picture.fileurl || picture.filename) {
                images.push({
                  filename: picture.filename,
                  fileurl: picture.fileurl,
                  name: picture.name,
                  id: picture.id
                });
              }
            });
          }
        });
      }
    } catch (error) {
      console.warn('이미지 추출 중 오류:', error);
    }
    
    return images;
  }

  /**
   * 🔥 프로젝트에서 사운드 데이터 추출
   */
  extractSoundsFromProject(projectData) {
    const sounds = [];
    
    try {
      if (projectData.objects) {
        projectData.objects.forEach(obj => {
          if (obj.sprite && obj.sprite.sounds) {
            obj.sprite.sounds.forEach(sound => {
              if (sound.fileurl || sound.filename) {
                sounds.push({
                  filename: sound.filename,
                  fileurl: sound.fileurl,
                  name: sound.name,
                  id: sound.id
                });
              }
            });
          }
        });
      }
    } catch (error) {
      console.warn('사운드 추출 중 오류:', error);
    }
    
    return sounds;
  }

  /**
   * 🔥 ENT 파일 생성 (간단 버전 - JSON 데이터만)
   * 주의: 실제 ENT 파일은 tar.gz 형식이지만,
   * 브라우저에서 tar.gz 생성은 복잡하므로 서버 API 사용 권장
   */
  async createEntFile(projectData, images, sounds) {
    // 방법 1: 서버 API를 통한 ENT 생성 (권장)
    try {
      const response = await fetch('/entry/api/create-ent-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectData: projectData,
          images: images,
          sounds: sounds
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        console.log('✅ 서버에서 ENT 파일 생성 완료');
        return blob;
      } else {
        console.warn('⚠️ 서버 API 응답 오류, 클라이언트 생성으로 대체');
        throw new Error('Server API failed');
      }
    } catch (error) {
      console.log('🔄 클라이언트에서 JSON 파일로 대체 생성...');
      
      // 방법 2: 클라이언트에서 JSON으로 저장 (대체)
      // 주의: 이 방식은 오프라인 엔트리에서 바로 열 수 없을 수 있음
      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      console.log('⚠️ JSON 형식으로 저장됨 (오프라인 엔트리 호환성 제한)');
      return blob;
    }
  }

  /**
   * 🔥 파일 다운로드 트리거
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
}

// 전역에서 사용 가능하도록 노출
window.EntryProjectSaver = EntryProjectSaver;
