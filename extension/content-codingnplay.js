/**
 * 코딩앤플레이 확장프로그램 - Content Script (코딩앤플레이 페이지)
 *
 * 역할:
 * - "프로젝트 열기" 버튼 감지
 * - 과제 정보 추출 후 에디터 열기
 */

(function() {
  'use strict';

  // ============================================
  // 프로젝트 열기 버튼 감지 및 처리
  // ============================================
  function setupProjectOpenListener() {
    // 방법 1: 특정 클래스/ID를 가진 버튼 감지
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action="open-editor"]');

      if (button) {
        e.preventDefault();

        const platform = button.dataset.platform;      // 'scratch', 'entry', 'appinventor'
        const missionId = button.dataset.missionId;
        const userId = button.dataset.userId;
        const templateUrl = button.dataset.templateUrl;
        const missionTitle = button.dataset.missionTitle;

        if (platform && missionId && userId) {
          chrome.runtime.sendMessage({
            action: 'OPEN_EDITOR',
            data: { platform, missionId, userId, templateUrl, missionTitle }
          });
        } else {
          console.error('[CNP] 필수 데이터 누락:', { platform, missionId, userId });
        }
      }
    });

    console.log('[CNP] 코딩앤플레이 페이지 리스너 설정 완료');
  }

  // ============================================
  // 전역 함수 노출 (선택적)
  // ============================================
  window.CodingnplayExtension = {
    openEditor: function(data) {
      chrome.runtime.sendMessage({
        action: 'OPEN_EDITOR',
        data: data
      });
    }
  };

  // 초기화
  setupProjectOpenListener();

})();
