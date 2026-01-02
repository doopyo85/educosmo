/**
 * 코딩앤플레이 확장프로그램 - Content Script (코딩앤플레이 페이지)
 *
 * 역할:
 * - "프로젝트 열기" 버튼 감지
 * - 과제 정보 추출 후 에디터 열기
 */

(function () {
  'use strict';

  // ============================================
  // 프로젝트 열기 버튼 감지 및 처리
  // ============================================
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
      console.log('[CNP-EXT] 에디터 열기 요청 수신:', e.detail);
      const data = e.detail;
      if (data) {
        chrome.runtime.sendMessage({
          action: 'OPEN_EDITOR',
          data: data
        });
      }
    });
  }

  // ============================================
  // 프로젝트 열기 버튼 감지 (Click)
  // ============================================
  function setupProjectOpenListener() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action="open-editor"]');

      if (button) {
        e.preventDefault();

        const platform = button.dataset.platform;
        const missionId = button.dataset.missionId;
        const userId = button.dataset.userId;
        const templateUrl = button.dataset.templateUrl;
        const missionTitle = button.dataset.missionTitle;

        if (platform && missionId && userId) {
          chrome.runtime.sendMessage({
            action: 'OPEN_EDITOR',
            data: { platform, missionId, userId, templateUrl, missionTitle }
          });
        }
      }
    });
  }

  // 초기화
  injectStatusMarker();
  setupCustomEventListener();
  setupProjectOpenListener();

})();
