/**
 * Extension Bridge
 *
 * 코딩앤플레이 확장프로그램과의 통신 브리지
 */

class ExtensionBridge {
  constructor() {
    this.isExtensionInstalled = false;
    this.checkExtension();
  }

  /**
   * 확장프로그램 설치 여부 확인
   */
  checkExtension() {
    // 1. 즉시 확인
    const marker = document.getElementById('codingnplay-extension-installed');
    this.isExtensionInstalled = !!marker;

    if (this.isExtensionInstalled) {
      console.log('✅ 코딩앤플레이 확장프로그램 감지됨 (DOM Marker)');
    } else {
      // 2. 늦은 로딩을 위해 주기적 확인 (최대 3초)
      let attempts = 0;
      const interval = setInterval(() => {
        const lateMarker = document.getElementById('codingnplay-extension-installed');
        if (lateMarker) {
          this.isExtensionInstalled = true;
          console.log('✅ 코딩앤플레이 확장프로그램 감지됨 (Late Load)');
          clearInterval(interval);
        }
        attempts++;
        if (attempts > 30) clearInterval(interval); // 3초 후 중단
      }, 100);
    }

    return this.isExtensionInstalled;
  }

  /**
   * 에디터 열기 (확장프로그램 사용)
   */
  openEditor(options) {
    // 호출 시점 재확인
    if (!this.isExtensionInstalled) {
      const marker = document.getElementById('codingnplay-extension-installed');
      if (marker) this.isExtensionInstalled = true;
    }

    /* 
    if (!this.isExtensionInstalled) {
      this.showInstallGuide();
      return false;
    } 
    */

    // Fallback: 확장프로그램이 없으면 새 탭으로 열기 시도
    if (!this.isExtensionInstalled) {
      const targetUrl = options.openUrl || options.templateUrl;
      if (targetUrl) {
        console.log('NOTICE: Extension missing, opening URL directly:', targetUrl);
        window.open(targetUrl, '_blank');
        return true;
      }
    }

    const { platform, missionId, userId, missionTitle, templateUrl, openUrl, problemImageUrl, grade, sample, problem } = options;

    // Validation
    if (!platform || !missionId || !userId) {
      console.error('필수 파라미터가 누락되었습니다:', options);
      alert('에디터를 열 수 없습니다. 필수 정보가 누락되었습니다.');
      return false;
    }

    try {
      // CustomEvent Dispatch
      const event = new CustomEvent('cnp-open-editor', {
        detail: {
          platform,
          missionId,
          userId,
          missionTitle: missionTitle || `과제 ${missionId}`,
          templateUrl: templateUrl || null,
          openUrl: openUrl || null,
          problemImageUrl: problemImageUrl || null,  // COS 문제 이미지 URL
          grade: grade || null,                      // COS 급수
          sample: sample || null,                    // COS 샘플 번호
          problem: problem || null                   // COS 문제 번호
        }
      });
      window.dispatchEvent(event);

      console.log('🚀 확장프로그램으로 요청 전송 (Event):', options);
      return true;

    } catch (error) {
      console.error('이벤트 발송 실패:', error);
      alert('확장프로그램 통신 오류가 발생했습니다.');
      return false;
    }
  }

  /**
   * 확장프로그램 설치 안내 표시
   */
  showInstallGuide() {
    const modalHtml = `
      <div class="modal fade" id="extensionInstallModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-puzzle"></i> 확장프로그램 설치 필요
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">
                <strong>코딩앤플레이 학습도우미 확장프로그램</strong>이 설치되지 않았습니다.
              </p>
              <p class="mb-3">
                확장프로그램을 설치하면 Entry, Scratch, App Inventor에서 작성한 프로젝트를
                쉽고 빠르게 제출할 수 있습니다.
              </p>
              <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                <small>
                  설치 후 이 페이지를 새로고침해주세요.
                </small>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
              <a href="/extension-guide" target="_blank" class="btn btn-primary">
                <i class="bi bi-download"></i> 설치 가이드 보기
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // 모달이 이미 있는지 확인
    let modal = document.getElementById('extensionInstallModal');
    if (!modal) {
      // 모달 HTML 추가
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modal = document.getElementById('extensionInstallModal');
    }

    // Bootstrap Modal 표시
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  /**
   * "프로젝트 열기" 버튼 생성
   *
   * @param {Object} options - openEditor와 동일한 옵션
   * @param {string} [className] - 추가 CSS 클래스
   * @param {string} [buttonText] - 버튼 텍스트
   * @returns {HTMLElement} 버튼 요소
   */
  createOpenButton(options, className = '', buttonText = '프로젝트 열기') {
    const button = document.createElement('button');
    button.className = `btn btn-primary ${className}`.trim();
    button.innerHTML = `<i class="bi bi-box-arrow-up-right"></i> ${buttonText}`;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.openEditor(options);
    });

    return button;
  }

  /**
   * data-* 속성을 가진 버튼에 자동으로 이벤트 바인딩
   */
  initializeButtons() {
    const buttons = document.querySelectorAll('[data-action="open-editor"]');

    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();

        const options = {
          platform: button.dataset.platform,
          missionId: button.dataset.missionId,
          userId: button.dataset.userId,
          missionTitle: button.dataset.missionTitle,
          templateUrl: button.dataset.templateUrl,
          openUrl: button.dataset.openUrl
        };

        // openUrl이 있으면 Extension으로 전달만 하고, Extension이 탭을 열도록 함
        this.openEditor(options);
      });
    });

    console.log(`✅ ${buttons.length}개의 확장프로그램 버튼이 초기화되었습니다.`);
  }
}

// 전역 인스턴스 생성
window.extensionBridge = new ExtensionBridge();

// DOM 로드 후 자동 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.extensionBridge.initializeButtons();
  });
} else {
  window.extensionBridge.initializeButtons();
}
