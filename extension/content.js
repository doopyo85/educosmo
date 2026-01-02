/**
 * 코딩앤플레이 확장프로그램 - Content Script (에디터 페이지)
 *
 * 역할:
 * - 플로팅 제출 버튼 표시
 * - 프로젝트 파일 수집
 * - 제출 처리
 */

(function() {
  'use strict';

  // ============================================
  // 상수 및 설정
  // ============================================
  const PLATFORMS = {
    'playentry.org': {
      id: 'entry',
      name: 'Entry',
      fileExtension: '.ent',
      exportGuide: '파일 → 내 컴퓨터에 저장하기'
    },
    'scratch.mit.edu': {
      id: 'scratch',
      name: 'Scratch',
      fileExtension: '.sb3',
      exportGuide: '파일 → 컴퓨터에 저장하기'
    },
    'appinventor.mit.edu': {
      id: 'appinventor',
      name: 'App Inventor',
      fileExtension: '.aia',
      exportGuide: 'Projects → Export selected project (.aia) to my computer'
    }
  };

  // ============================================
  // 플랫폼 감지
  // ============================================
  function detectPlatform() {
    const hostname = window.location.hostname;

    for (const [domain, config] of Object.entries(PLATFORMS)) {
      if (hostname.includes(domain.split('.')[0])) {
        return config;
      }
    }
    return null;
  }

  // ============================================
  // 프로젝트 ID 추출
  // ============================================
  function extractProjectId(platform) {
    const url = window.location.href;

    switch (platform.id) {
      case 'scratch': {
        const match = url.match(/\/projects\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'entry': {
        const match = url.match(/\/ws\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
      }
      case 'appinventor': {
        // App Inventor는 URL에 프로젝트 ID가 없음
        return null;
      }
      default:
        return null;
    }
  }

  // ============================================
  // 플로팅 버튼 UI 생성
  // ============================================
  function createFloatingButton(platform) {
    // 이미 존재하면 스킵
    if (document.getElementById('cnp-floating-container')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'cnp-floating-container';
    container.innerHTML = `
      <div class="cnp-floating-wrapper">
        <div class="cnp-mission-info" id="cnp-mission-info">
          <span class="cnp-mission-badge">과제 진행중</span>
          <span class="cnp-mission-title" id="cnp-mission-title">-</span>
        </div>
        <div class="cnp-buttons">
          <button class="cnp-btn cnp-btn-submit" id="cnp-submit-btn">
            <span class="cnp-icon">📤</span>
            <span class="cnp-text">제출하기</span>
          </button>
          <button class="cnp-btn cnp-btn-info" id="cnp-info-btn">
            <span class="cnp-icon">ℹ️</span>
          </button>
        </div>
      </div>

      <!-- 파일 업로드 모달 -->
      <div class="cnp-modal" id="cnp-upload-modal" style="display: none;">
        <div class="cnp-modal-backdrop"></div>
        <div class="cnp-modal-content">
          <div class="cnp-modal-header">
            <h3>📁 프로젝트 파일 제출</h3>
            <button class="cnp-modal-close" id="cnp-modal-close">&times;</button>
          </div>
          <div class="cnp-modal-body">
            <div class="cnp-guide">
              <p><strong>1단계:</strong> ${platform.name} 에디터에서</p>
              <p class="cnp-guide-highlight">"${platform.exportGuide}"</p>
              <p><strong>2단계:</strong> 아래에서 저장된 파일 선택</p>
            </div>
            <div class="cnp-file-input-wrapper">
              <input type="file"
                     id="cnp-file-input"
                     accept="${platform.fileExtension}"
                     style="display: none;" />
              <button class="cnp-btn cnp-btn-file" id="cnp-select-file-btn">
                📂 ${platform.fileExtension} 파일 선택
              </button>
              <span class="cnp-file-name" id="cnp-file-name">선택된 파일 없음</span>
            </div>
          </div>
          <div class="cnp-modal-footer">
            <button class="cnp-btn cnp-btn-cancel" id="cnp-cancel-btn">취소</button>
            <button class="cnp-btn cnp-btn-confirm" id="cnp-confirm-btn" disabled>
              제출하기
            </button>
          </div>
        </div>
      </div>

      <!-- 진행 상태 모달 -->
      <div class="cnp-modal" id="cnp-progress-modal" style="display: none;">
        <div class="cnp-modal-backdrop"></div>
        <div class="cnp-modal-content cnp-modal-progress">
          <div class="cnp-spinner"></div>
          <p id="cnp-progress-text">제출 중...</p>
        </div>
      </div>

      <!-- 완료 모달 -->
      <div class="cnp-modal" id="cnp-complete-modal" style="display: none;">
        <div class="cnp-modal-backdrop"></div>
        <div class="cnp-modal-content cnp-modal-complete">
          <div class="cnp-complete-icon">✅</div>
          <h3>제출 완료!</h3>
          <p>과제가 성공적으로 제출되었습니다.</p>
          <button class="cnp-btn cnp-btn-confirm" id="cnp-complete-close-btn">확인</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // 이벤트 바인딩
    bindEvents(platform);

    // 과제 정보 로드
    loadMissionInfo();
  }

  // ============================================
  // 이벤트 바인딩
  // ============================================
  function bindEvents(platform) {
    const submitBtn = document.getElementById('cnp-submit-btn');
    const infoBtn = document.getElementById('cnp-info-btn');
    const uploadModal = document.getElementById('cnp-upload-modal');
    const closeBtn = document.getElementById('cnp-modal-close');
    const cancelBtn = document.getElementById('cnp-cancel-btn');
    const confirmBtn = document.getElementById('cnp-confirm-btn');
    const selectFileBtn = document.getElementById('cnp-select-file-btn');
    const fileInput = document.getElementById('cnp-file-input');
    const fileNameSpan = document.getElementById('cnp-file-name');
    const completeCloseBtn = document.getElementById('cnp-complete-close-btn');

    let selectedFile = null;

    // 제출 버튼 클릭
    submitBtn.addEventListener('click', async () => {
      // Scratch 공유 프로젝트인 경우 자동 추출 시도
      if (platform.id === 'scratch') {
        const projectId = extractProjectId(platform);
        if (projectId) {
          const autoResult = await tryAutoFetchScratch(projectId);
          if (autoResult.success) {
            await submitProject(autoResult.data, platform, true);
            return;
          }
        }
      }

      // 파일 선택 모달 표시
      uploadModal.style.display = 'flex';
    });

    // 정보 버튼 클릭
    infoBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'GET_MISSION_INFO' }, (response) => {
        if (response?.data) {
          alert(`현재 과제: ${response.data.missionTitle || response.data.missionId}\n시작 시간: ${new Date(response.data.startedAt).toLocaleString()}`);
        } else {
          alert('진행 중인 과제가 없습니다.');
        }
      });
    });

    // 모달 닫기
    closeBtn.addEventListener('click', () => {
      uploadModal.style.display = 'none';
      resetFileInput();
    });

    cancelBtn.addEventListener('click', () => {
      uploadModal.style.display = 'none';
      resetFileInput();
    });

    // 파일 선택 버튼
    selectFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    // 파일 선택됨
    fileInput.addEventListener('change', (e) => {
      selectedFile = e.target.files[0];
      if (selectedFile) {
        fileNameSpan.textContent = selectedFile.name;
        fileNameSpan.classList.add('selected');
        confirmBtn.disabled = false;
      } else {
        resetFileInput();
      }
    });

    // 제출 확인
    confirmBtn.addEventListener('click', async () => {
      if (selectedFile) {
        uploadModal.style.display = 'none';
        await submitProject(selectedFile, platform, false);
        resetFileInput();
      }
    });

    // 완료 모달 닫기
    completeCloseBtn.addEventListener('click', () => {
      document.getElementById('cnp-complete-modal').style.display = 'none';
    });

    // 모달 백드롭 클릭
    document.querySelectorAll('.cnp-modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        uploadModal.style.display = 'none';
        document.getElementById('cnp-complete-modal').style.display = 'none';
        resetFileInput();
      });
    });

    function resetFileInput() {
      selectedFile = null;
      fileInput.value = '';
      fileNameSpan.textContent = '선택된 파일 없음';
      fileNameSpan.classList.remove('selected');
      confirmBtn.disabled = true;
    }
  }

  // ============================================
  // 과제 정보 로드
  // ============================================
  function loadMissionInfo() {
    chrome.runtime.sendMessage({ action: 'GET_MISSION_INFO' }, (response) => {
      const missionInfo = document.getElementById('cnp-mission-info');
      const missionTitle = document.getElementById('cnp-mission-title');

      if (response?.data) {
        missionTitle.textContent = response.data.missionTitle || `과제 #${response.data.missionId}`;
        missionInfo.style.display = 'flex';
      } else {
        missionInfo.style.display = 'none';
      }
    });
  }

  // ============================================
  // Scratch 자동 추출 시도
  // ============================================
  async function tryAutoFetchScratch(projectId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'FETCH_SCRATCH_PROJECT', projectId },
        (response) => {
          resolve(response || { success: false });
        }
      );
    });
  }

  // ============================================
  // 프로젝트 제출
  // ============================================
  async function submitProject(fileOrData, platform, isAutoFetch) {
    const progressModal = document.getElementById('cnp-progress-modal');
    const progressText = document.getElementById('cnp-progress-text');
    const completeModal = document.getElementById('cnp-complete-modal');

    try {
      progressModal.style.display = 'flex';
      progressText.textContent = '과제 정보 확인 중...';

      // 과제 정보 가져오기
      const missionResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'GET_MISSION_INFO' }, resolve);
      });

      if (!missionResponse?.data) {
        throw new Error('진행 중인 과제가 없습니다. 코딩앤플레이에서 과제를 선택해주세요.');
      }

      const { missionId, userId } = missionResponse.data;
      const projectId = extractProjectId(platform);
      const projectUrl = window.location.href;

      // 파일 데이터 준비
      let fileData, fileName, fileType;

      if (isAutoFetch) {
        // Scratch 자동 추출 데이터
        progressText.textContent = '프로젝트 데이터 변환 중...';
        const jsonString = JSON.stringify(fileOrData);
        fileData = new Blob([jsonString], { type: 'application/json' });
        fileName = `project_${projectId || Date.now()}${platform.fileExtension}`;
        fileType = 'application/json';
      } else {
        // 사용자가 선택한 파일
        fileData = fileOrData;
        fileName = fileOrData.name;
        fileType = fileOrData.type || 'application/octet-stream';
      }

      // S3 업로드 URL 발급
      progressText.textContent = '업로드 준비 중...';
      const uploadUrlResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'GET_UPLOAD_URL',
          data: { platform: platform.id, missionId, userId, fileName, fileType }
        }, resolve);
      });

      if (!uploadUrlResponse?.success) {
        throw new Error('업로드 URL 발급 실패: ' + (uploadUrlResponse?.error || '알 수 없는 오류'));
      }

      const { uploadUrl, s3Key } = uploadUrlResponse.data;

      // S3에 파일 업로드
      progressText.textContent = '파일 업로드 중...';
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': fileType },
        body: fileData
      });

      if (!uploadResponse.ok) {
        throw new Error('파일 업로드 실패');
      }

      // 제출 정보 서버에 저장
      progressText.textContent = '제출 정보 저장 중...';
      const submitResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'SUBMIT_PROJECT',
          data: {
            platform: platform.id,
            missionId,
            userId,
            projectUrl,
            projectId,
            s3Key,
            fileName
          }
        }, resolve);
      });

      if (!submitResponse?.success) {
        throw new Error('제출 정보 저장 실패: ' + (submitResponse?.error || '알 수 없는 오류'));
      }

      // 완료
      progressModal.style.display = 'none';
      completeModal.style.display = 'flex';

    } catch (error) {
      console.error('[CNP] 제출 오류:', error);
      progressModal.style.display = 'none';
      alert('제출 실패: ' + error.message);
    }
  }

  // ============================================
  // 초기화
  // ============================================
  function init() {
    const platform = detectPlatform();

    if (!platform) {
      console.log('[CNP] 지원하지 않는 플랫폼');
      return;
    }

    console.log('[CNP] 플랫폼 감지:', platform.name);

    // DOM 로드 완료 후 버튼 생성
    if (document.readyState === 'complete') {
      createFloatingButton(platform);
    } else {
      window.addEventListener('load', () => createFloatingButton(platform));
    }
  }

  // 초기화 실행
  init();

})();
