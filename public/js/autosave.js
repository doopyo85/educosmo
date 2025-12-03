/**
 * 🔄 자동저장 관리자
 * - 3분마다 localStorage에 프로젝트 자동저장
 * - 페이지 재접속 시 복구 가능
 */
class AutoSaveManager {
  constructor(platform, getProjectDataFn, options = {}) {
    this.platform = platform; // 'scratch' or 'entry'
    this.getProjectDataFn = getProjectDataFn; // 프로젝트 데이터 추출 함수
    this.interval = options.interval || 3 * 60 * 1000; // 기본 3분
    this.intervalId = null;
    this.lastSaveTime = null;
    this.saveCount = 0;
    
    // 저장 키 생성 (사용자+플랫폼 기준, 날짜 제거로 복구 가능성 향상)
    this.userID = options.userID || window.EDUCODINGNPLAY_USER?.userID || 'anonymous';
    this.storageKey = `autosave_${platform}_${this.userID}`;
    
    console.log(`[AutoSave] 초기화 완료 - 플랫폼: ${platform}, 사용자: ${this.userID}, 키: ${this.storageKey}`);
  }
  
  /**
   * 자동저장 시작
   */
  startAutoSave() {
    console.log(`[AutoSave] 자동저장 시작 - 간격: ${this.interval / 1000}초`);
    
    this.intervalId = setInterval(() => {
      this.performSave();
    }, this.interval);
  }
  
  /**
   * 실제 저장 수행
   */
  performSave() {
    try {
      const projectData = this.getProjectDataFn();
      
      // 🔥 데이터 유효성 검증 강화
      if (!projectData) {
        console.warn('[AutoSave] ⚠️ 프로젝트 데이터가 null/undefined입니다.');
        return false;
      }
      
      // objects 배열 검증 (Entry 프로젝트 기준)
      if (this.platform === 'entry') {
        if (!projectData.objects || projectData.objects.length === 0) {
          console.warn('[AutoSave] ⚠️ 프로젝트에 오브젝트가 없습니다. 저장 건너뜀.');
          return false;
        }
      }
      
      // localStorage에 저장
      const saveData = {
        timestamp: new Date().toISOString(),
        userID: this.userID,
        platform: this.platform,
        projectData: projectData,
        // 메타데이터 추가
        meta: {
          objectCount: projectData.objects?.length || 0,
          sceneCount: projectData.scenes?.length || 0,
          version: '2.0'
        }
      };
      
      const dataString = JSON.stringify(saveData);
      
      // 데이터 크기 체크 (localStorage 제한: 약 5MB)
      const dataSizeKB = (dataString.length / 1024).toFixed(2);
      if (dataString.length > 4 * 1024 * 1024) { // 4MB 이상이면 경고
        console.warn(`[AutoSave] ⚠️ 데이터가 너무 큽니다: ${dataSizeKB}KB`);
      }
      
      localStorage.setItem(this.storageKey, dataString);
      
      this.lastSaveTime = new Date();
      this.saveCount++;
      
      const time = this.lastSaveTime.toLocaleTimeString('ko-KR');
      console.log(`[AutoSave] ✅ 저장 완료 #${this.saveCount} - ${time} (${dataSizeKB}KB)`);
      
      // UI 피드백
      this.showSaveIndicator();
      
      return true;
      
    } catch (error) {
      console.error('[AutoSave] ❌ 저장 실패:', error);
      
      // QuotaExceededError 처리
      if (error.name === 'QuotaExceededError') {
        console.error('[AutoSave] ⚠️ localStorage 용량 초과. 이전 데이터 삭제 시도...');
        this.cleanupOldData();
      }
      
      return false;
    }
  }
  
  /**
   * 오래된 자동저장 데이터 정리
   */
  cleanupOldData() {
    try {
      // 같은 플랫폼의 다른 사용자 데이터 삭제
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(`autosave_${this.platform}_`) && key !== this.storageKey) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[AutoSave] 🗑️ 삭제됨: ${key}`);
      });
      
    } catch (error) {
      console.error('[AutoSave] ❌ 정리 실패:', error);
    }
  }
  
  /**
   * 자동저장 중지
   */
  stopAutoSave() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[AutoSave] 자동저장 중지');
    }
  }
  
  /**
   * 복구 가능한 데이터 확인
   */
  checkRecovery() {
    const saved = localStorage.getItem(this.storageKey);
    
    if (!saved) {
      console.log('[AutoSave] 복구할 데이터 없음');
      return null;
    }
    
    try {
      const data = JSON.parse(saved);
      
      // 🔥 데이터 유효성 검증
      if (!data.projectData) {
        console.warn('[AutoSave] ⚠️ 복구 데이터에 projectData가 없습니다.');
        localStorage.removeItem(this.storageKey);
        return null;
      }
      
      // 너무 오래된 데이터 체크 (7일 이상)
      const savedTime = new Date(data.timestamp);
      const now = new Date();
      const daysDiff = (now - savedTime) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 7) {
        console.warn(`[AutoSave] ⚠️ 복구 데이터가 ${Math.floor(daysDiff)}일 전입니다. 삭제합니다.`);
        localStorage.removeItem(this.storageKey);
        return null;
      }
      
      console.log(`[AutoSave] 🔄 복구 가능한 데이터 발견 - ${data.timestamp}`);
      console.log(`[AutoSave] 📊 메타데이터:`, data.meta || '없음');
      
      return data;
      
    } catch (error) {
      console.error('[AutoSave] ❌ 복구 데이터 파싱 실패:', error);
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }
  
  /**
   * 복구 팝업 표시
   */
  showRecoveryModal(recoveryData, loadProjectFn) {
    const modal = document.createElement('div');
    modal.id = 'autosave-recovery-modal';
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
      z-index: 9999;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 10px;
      max-width: 500px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    const timestamp = new Date(recoveryData.timestamp).toLocaleString('ko-KR');
    const meta = recoveryData.meta || {};
    
    modalContent.innerHTML = `
      <h2 style="margin-top: 0; color: #333;">🔄 자동저장 복구</h2>
      <p style="color: #666; line-height: 1.6;">
        <strong>${timestamp}</strong>에 자동저장된 프로젝트가 있습니다.<br>
        ${meta.objectCount ? `<span style="color: #537EC5;">오브젝트: ${meta.objectCount}개</span>` : ''}
        ${meta.sceneCount ? `, <span style="color: #537EC5;">장면: ${meta.sceneCount}개</span>` : ''}
      </p>
      <p style="color: #888; font-size: 14px;">복구하시겠습니까?</p>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button id="recover-yes" style="
          flex: 1;
          padding: 12px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        ">복구하기</button>
        <button id="recover-no" style="
          flex: 1;
          padding: 12px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        ">새로 시작</button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 복구하기 버튼
    document.getElementById('recover-yes').onclick = () => {
      try {
        loadProjectFn(recoveryData.projectData);
        console.log('[AutoSave] ✅ 프로젝트 복구 완료');
        document.body.removeChild(modal);
      } catch (error) {
        console.error('[AutoSave] ❌ 복구 실패:', error);
        alert('복구에 실패했습니다. 새로 시작해주세요.');
        document.body.removeChild(modal);
      }
    };
    
    // 새로 시작 버튼
    document.getElementById('recover-no').onclick = () => {
      localStorage.removeItem(this.storageKey);
      console.log('[AutoSave] 🗑️ 자동저장 데이터 삭제');
      document.body.removeChild(modal);
    };
  }
  
  /**
   * 저장 완료 인디케이터 표시
   */
  showSaveIndicator() {
    let indicator = document.getElementById('autosave-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'autosave-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(76, 175, 80, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9998;
        opacity: 0;
        transition: opacity 0.3s;
        font-size: 13px;
      `;
      document.body.appendChild(indicator);
    }
    
    indicator.textContent = `💾 자동저장 완료 (${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`;
    
    // 페이드 인/아웃 애니메이션
    indicator.style.opacity = '1';
    setTimeout(() => {
      indicator.style.opacity = '0';
    }, 2000);
  }
  
  /**
   * 수동 저장
   */
  manualSave() {
    console.log('[AutoSave] 📝 수동 저장 시작...');
    return this.performSave();
  }
  
  /**
   * 상태 정보 반환
   */
  getStatus() {
    return {
      platform: this.platform,
      userID: this.userID,
      storageKey: this.storageKey,
      isRunning: !!this.intervalId,
      interval: this.interval,
      lastSaveTime: this.lastSaveTime,
      saveCount: this.saveCount,
      hasRecoveryData: !!localStorage.getItem(this.storageKey)
    };
  }
}

// 전역에서 사용 가능하도록 노출
window.AutoSaveManager = AutoSaveManager;
