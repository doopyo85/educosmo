/**
 * 코딩앤플레이 확장프로그램 - Content Script (코딩앤플레이 페이지)
 *
 * 역할:
 * - "프로젝트 열기" 버튼 감지
 * - 과제 정보 추출 후 에디터 열기
 */

(function () {
  'use strict';

  console.log('[CNP-EXT] 코딩앤플레이 Content Script 로드됨');

  // ============================================
  // 페이지에 설치 여부 알림 (DOM 주입)
  // ============================================
  function injectStatusMarker() {
    const marker = document.createElement('div');
    marker.id = 'codingnplay-extension-installed';
    marker.style.display = 'none';
    marker.dataset.version = '1.0.0';
    document.body.appendChild(marker);
    console.log('[CNP-EXT] 설치 마커 주입 완료');
  }

  // ============================================
  // 페이지からの 요청 리스너 (CustomEvent)
  // ============================================
  function setupCustomEventListener() {
    window.addEventListener('cnp-open-editor', (e) => {
      console.log('[CNP-EXT] CustomEvent 에디터 열기 요청 수신:', e.detail);
      const data = e.detail;
      if (data) {
        console.log('[CNP-EXT] → 전달할 데이터:', {
          platform: data.platform,
          missionId: data.missionId,
          userId: data.userId,
          missionTitle: data.missionTitle || '(없음)',
          templateUrl: data.templateUrl || '(없음)'
        });
        
        chrome.runtime.sendMessage({
          action: 'OPEN_EDITOR',
          data: data
        });
      }
    });
    console.log('[CNP-EXT] CustomEvent 리스너 설정 완료');
  }

  // ============================================
  // 프로젝트 열기 버튼 감지 (Click)
  // ============================================
  function setupProjectOpenListener() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action="open-editor"]');

      if (button) {
        e.preventDefault();
        
        // 버튼의 모든 data 속성 로깅
        console.log('[CNP-EXT] 에디터 열기 버튼 클릭됨');
        console.log('[CNP-EXT] 버튼 element:', button);
        console.log('[CNP-EXT] 버튼 dataset 전체:', { ...button.dataset });

        const platform = button.dataset.platform;
        const missionId = button.dataset.missionId;
        const userId = button.dataset.userId;
        const templateUrl = button.dataset.templateUrl;
        const missionTitle = button.dataset.missionTitle;

        console.log('[CNP-EXT] 추출된 데이터:', {
          platform: platform || '(없음)',
          missionId: missionId || '(없음)',
          userId: userId || '(없음)',
          missionTitle: missionTitle || '(없음)',
          templateUrl: templateUrl || '(없음)'
        });

        if (platform && missionId && userId) {
          const messageData = { 
            platform, 
            missionId, 
            userId, 
            templateUrl: templateUrl || null, 
            missionTitle: missionTitle || null 
          };
          
          console.log('[CNP-EXT] Background로 메시지 전송:', messageData);
          
          chrome.runtime.sendMessage({
            action: 'OPEN_EDITOR',
            data: messageData
          });
        } else {
          console.error('[CNP-EXT] 필수 데이터 누락:', { platform, missionId, userId });
        }
      }
    });
    console.log('[CNP-EXT] 클릭 리스너 설정 완료');
  }

  // ============================================
  // 페이지 내 에디터 열기 버튼 스캔 (디버깅용)
  // ============================================
  function scanEditorButtons() {
    setTimeout(() => {
      const buttons = document.querySelectorAll('[data-action="open-editor"]');
      console.log('[CNP-EXT] 발견된 에디터 열기 버튼 수:', buttons.length);
      
      buttons.forEach((btn, idx) => {
        console.log(`[CNP-EXT] 버튼 #${idx + 1} dataset:`, { ...btn.dataset });
      });
    }, 2000); // 페이지 로드 후 2초 대기
  }

  // ============================================
  // 초기화
  // ============================================
  injectStatusMarker();
  setupCustomEventListener();
  setupProjectOpenListener();
  scanEditorButtons();
  
  console.log('[CNP-EXT] 초기화 완료');

})();
