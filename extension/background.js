/**
 * 코딩앤플레이 확장프로그램 - Background Service Worker
 *
 * 역할:
 * - 메시지 라우팅
 * - API 통신
 * - 탭 관리
 */

// ============================================
// 상수 정의
// ============================================
const CONFIG = {
  API_BASE: 'https://app.codingnplay.co.kr/api/extension',
  PLATFORMS: {
    scratch: {
      name: 'Scratch',
      editorUrl: 'https://scratch.mit.edu/projects/editor',
      projectUrlPattern: /scratch\.mit\.edu\/projects\/(\d+)/,
      fileExtension: '.sb3'
    },
    entry: {
      name: 'Entry',
      editorUrl: 'https://playentry.org/ws/new',
      projectUrlPattern: /playentry\.org\/ws\/([a-zA-Z0-9]+)/,
      fileExtension: '.ent'
    },
    appinventor: {
      name: 'App Inventor',
      editorUrl: 'https://ai2.appinventor.mit.edu',
      projectUrlPattern: /appinventor\.mit\.edu/,
      fileExtension: '.aia'
    }
  }
};

// ============================================
// 메시지 핸들러
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] 메시지 수신:', message.action);

  switch (message.action) {
    case 'OPEN_EDITOR':
      handleOpenEditor(message.data);
      sendResponse({ success: true });
      break;

    case 'GET_MISSION_INFO':
      handleGetMissionInfo(sendResponse);
      return true; // 비동기 응답

    case 'SUBMIT_PROJECT':
      handleSubmitProject(message.data, sendResponse);
      return true; // 비동기 응답

    case 'GET_UPLOAD_URL':
      handleGetUploadUrl(message.data, sendResponse);
      return true; // 비동기 응답

    case 'FETCH_SCRATCH_PROJECT':
      handleFetchScratchProject(message.projectId, sendResponse);
      return true; // 비동기 응답

    default:
      console.warn('[Background] 알 수 없는 액션:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// ============================================
// 에디터 열기
// ============================================
async function handleOpenEditor(data) {
  const { platform, missionId, userId, templateUrl, missionTitle } = data;

  // 과제 정보 저장
  await chrome.storage.local.set({
    currentMission: {
      platform,
      missionId,
      userId,
      missionTitle,
      templateUrl,
      startedAt: new Date().toISOString()
    }
  });

  // 에디터 URL 결정
  let editorUrl = CONFIG.PLATFORMS[platform]?.editorUrl;
  let shouldDownload = false;

  if (templateUrl) {
    if (platform === 'entry' || platform === 'appinventor' || templateUrl.match(/\.(ent|sb3|aia)$/i)) {
      // 파일인 경우: 에디터를 열고 파일은 다운로드
      shouldDownload = true;
    } else {
      // 웹 페이지인 경우 (예: Scratch 프로젝트 페이지): 해당 URL로 이동
      editorUrl = templateUrl;
    }
  }

  if (!editorUrl) {
    console.error('[Background] 알 수 없는 플랫폼:', platform);
    return;
  }

  // 새 탭으로 에디터 열기
  chrome.tabs.create({ url: editorUrl });

  // 파일 다운로드 트리거
  if (shouldDownload && templateUrl) {
    console.log('[Background] 템플릿 파일 다운로드 시작:', templateUrl);
    chrome.downloads.download({
      url: templateUrl,
      filename: missionTitle ? `${missionTitle}${CONFIG.PLATFORMS[platform].fileExtension}` : undefined
    }).catch(err => console.error('[Background] 다운로드 실패:', err));
  }

  console.log('[Background] 에디터 열기:', { platform, editorUrl, missionId, downloaded: shouldDownload });
}

// ============================================
// 과제 정보 조회
// ============================================
async function handleGetMissionInfo(sendResponse) {
  try {
    const result = await chrome.storage.local.get('currentMission');
    sendResponse({
      success: true,
      data: result.currentMission || null
    });
  } catch (error) {
    console.error('[Background] 과제 정보 조회 실패:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// S3 업로드 URL 발급
// ============================================
async function handleGetUploadUrl(data, sendResponse) {
  const { platform, missionId, userId, fileName, fileType } = data;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        platform,
        missionId,
        userId,
        fileName,
        fileType
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    sendResponse({ success: true, data: result });

  } catch (error) {
    console.error('[Background] 업로드 URL 발급 실패:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// 프로젝트 제출
// ============================================
async function handleSubmitProject(data, sendResponse) {
  const { platform, missionId, userId, projectUrl, s3Key, fileName } = data;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        platform,
        missionId,
        userId,
        projectUrl,
        s3Key,
        fileName,
        submittedAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // 과제 정보 클리어 (선택적)
    // await chrome.storage.local.remove('currentMission');

    sendResponse({ success: true, data: result });

  } catch (error) {
    console.error('[Background] 제출 실패:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// Scratch 프로젝트 데이터 추출 (공유된 프로젝트)
// ============================================
async function handleFetchScratchProject(projectId, sendResponse) {
  try {
    const response = await fetch(
      `https://projects.scratch.mit.edu/${projectId}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      // 공유되지 않은 프로젝트
      sendResponse({
        success: false,
        error: 'NOT_SHARED',
        message: '프로젝트가 공유되지 않았습니다. 파일을 직접 업로드해주세요.'
      });
      return;
    }

    const data = await response.json();
    sendResponse({ success: true, data });

  } catch (error) {
    console.error('[Background] Scratch 프로젝트 추출 실패:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// 확장프로그램 설치 시
// ============================================
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] 확장프로그램 설치/업데이트:', details.reason);

  // 초기 설정
  chrome.storage.local.set({
    extensionVersion: chrome.runtime.getManifest().version,
    installedAt: new Date().toISOString()
  });
});
