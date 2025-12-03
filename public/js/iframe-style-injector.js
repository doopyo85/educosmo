/**
 * iframe-style-injector.js - 개선된 iframe 스타일 주입기
 * 이미지 반응형 처리 및 콘텐츠 최적화
 */

class IframeStyleInjector {
  constructor() {
    this.injectedIframes = new Set();
    this.retryAttempts = 3;
    this.retryDelay = 500;
  }

  /**
   * iframe에 반응형 이미지 스타일 주입
   * @param {HTMLIFrameElement} iframe - 대상 iframe 요소
   * @param {Object} options - 옵션 설정
   */
  async injectResponsiveImageStyles(iframe, options = {}) {
    const defaultOptions = {
      maxWidth: '100%',
      height: 'auto',
      objectFit: 'contain',
      enableZoom: false,
      addScrollbars: true,
      fontSize: '14px',
      lineHeight: '1.6',
      padding: '20px',
      backgroundColor: '#ffffff'
    };

    const config = { ...defaultOptions, ...options };
    
    try {
      if (!iframe || !iframe.contentWindow) {
        console.warn('유효하지 않은 iframe입니다.');
        return false;
      }

      const iframeId = iframe.id || iframe.src || 'unnamed';
      if (this.injectedIframes.has(iframeId)) {
        console.log('이미 스타일이 주입된 iframe입니다:', iframeId);
        return true;
      }

      await this.waitForIframeLoad(iframe);
      const success = await this.tryInjectStyles(iframe, config);
      
      if (success) {
        this.injectedIframes.add(iframeId);
        console.log('iframe 스타일 주입 성공:', iframeId);
      }
      
      return success;
    } catch (error) {
      console.error('iframe 스타일 주입 중 오류:', error);
      return false;
    }
  }

  /**
   * iframe 로드 완료 대기
   */
  waitForIframeLoad(iframe) {
    return new Promise((resolve, reject) => {
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 10;
      
      const checkLoad = () => {
        attempts++;
        try {
          if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error('iframe 로드 타임아웃'));
          } else {
            setTimeout(checkLoad, 200);
          }
        } catch (error) {
          console.warn('iframe 접근 제한, 스타일 주입 시도:', error.message);
          resolve();
        }
      };

      iframe.addEventListener('load', resolve, { once: true });
      setTimeout(checkLoad, 100);
    });
  }

  /**
   * 스타일 주입 시도 (재시도 로직 포함)
   */
  async tryInjectStyles(iframe, config) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const success = await this.injectStyles(iframe, config);
        if (success) return true;
        
        console.log(`스타일 주입 시도 ${attempt}/${this.retryAttempts} 실패`);
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      } catch (error) {
        console.warn(`스타일 주입 시도 ${attempt} 오류:`, error.message);
      }
    }
    return false;
  }

  /**
   * 실제 스타일 주입 로직
   */
  async injectStyles(iframe, config) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc) throw new Error('iframe 문서에 접근할 수 없습니다.');

      const styleElement = iframeDoc.createElement('style');
      styleElement.id = 'responsive-content-styles';
      const cssStyles = this.generateResponsiveCSS(config);
      styleElement.textContent = cssStyles;

      const existingStyle = iframeDoc.getElementById('responsive-content-styles');
      if (existingStyle) existingStyle.remove();

      const head = iframeDoc.head || iframeDoc.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(styleElement);
      } else if (iframeDoc.body) {
        iframeDoc.body.insertBefore(styleElement, iframeDoc.body.firstChild);
      }

      this.handleImageLoad(iframeDoc, config);
      console.log('CSS 스타일 주입 완료');
      return true;
    } catch (error) {
      throw new Error(`스타일 주입 실패: ${error.message}`);
    }
  }

  /**
   * ✅ 반응형 CSS 생성 (코드 블럭 스타일 개선 포함)
   */
  generateResponsiveCSS(config) {
    return `
      /* 반응형 이미지 스타일 */
      img {
        max-width: ${config.maxWidth} !important;
        height: ${config.height} !important;
        width: auto !important;
        object-fit: ${config.objectFit} !important;
        display: block !important;
        margin: 10px auto !important;
        box-sizing: border-box !important;  
        ${config.enableZoom ? 'cursor: zoom-in !important;' : ''}
      }

      img[width], img[height] {
        max-width: ${config.maxWidth} !important;
        height: auto !important;
        width: auto !important;
      }

      body {
        font-size: ${config.fontSize} !important;
        line-height: ${config.lineHeight} !important;
        padding: ${config.padding} !important;
        margin: 0 !important;
        background-color: ${config.backgroundColor} !important;
        overflow-x: auto !important;
        ${config.addScrollbars ? 'overflow-y: auto !important;' : ''}
        word-wrap: break-word !important;
        box-sizing: border-box !important;
      }

      table {
        max-width: 100% !important;
        table-layout: fixed !important;
        word-wrap: break-word !important;
      }

      video, embed, object, iframe {
        max-width: 100% !important;
        height: auto !important;
      }

      pre {
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow-x: auto !important;
      }

      code {
        word-wrap: break-word !important;
        white-space: pre-wrap !important;
      }

      /* ✅ 코드 블럭 배경/테두리 제거 */
      pre, code, pre code {
        background-color: transparent !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
        font-family: inherit !important;
      }

      span.string, span.keyword, span.builtin, span.comment, span.operator {
        background-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }

      .container, .content, .main {
        max-width: 100% !important;
        padding: 10px !important;
      }

      ${config.enableZoom ? `
        img:hover {
          transform: scale(1.05) !important;
          transition: transform 0.3s ease !important;
        }

        img.zoomed {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) scale(1.5) !important;
          z-index: 9999 !important;
          background: rgba(255, 255, 255, 0.9) !important;
          padding: 20px !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
          cursor: zoom-out !important;
        }
      ` : ''}

      @media (max-width: 768px) {
        body {
          padding: 10px !important;
          font-size: 13px !important;
        }

        img {
          margin: 5px auto !important;
        }
      }

      @media print {
        img {
          max-width: 100% !important;
          page-break-inside: avoid !important;
        }
      }
    `;
  }

  handleImageLoad(iframeDoc, config) {
    try {
      const images = iframeDoc.querySelectorAll('img');
      images.forEach((img) => {
        if (img.complete) {
          this.processImage(img, config);
        } else {
          img.addEventListener('load', () => this.processImage(img, config));
          img.addEventListener('error', () => {
            console.warn(`이미지 로드 실패: ${img.src}`);
            img.style.display = 'none';
          });
        }

        if (config.enableZoom) this.addImageZoomHandler(img, iframeDoc);
      });

      console.log(`${images.length}개 이미지 처리 완료`);
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
    }
  }

  processImage(img, config) {
    try {
      if (!img.dataset.originalWidth) {
        img.dataset.originalWidth = img.naturalWidth || img.width;
        img.dataset.originalHeight = img.naturalHeight || img.height;
      }

      const naturalWidth = img.naturalWidth || img.width;
      if (naturalWidth > 800) {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.title = `원본 크기: ${naturalWidth}px (클릭하여 확대)`;
      }

      if (!img.alt) img.alt = '콘텐츠 이미지';
    } catch (error) {
      console.error('이미지 개별 처리 오류:', error);
    }
  }

  addImageZoomHandler(img, iframeDoc) {
    img.addEventListener('click', (e) => {
      e.preventDefault();
      if (img.classList.contains('zoomed')) {
        img.classList.remove('zoomed');
      } else {
        iframeDoc.querySelectorAll('img.zoomed').forEach(el => el.classList.remove('zoomed'));
        img.classList.add('zoomed');
        setTimeout(() => img.classList.remove('zoomed'), 3000);
      }
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async injectAllIframes(options = {}) {
    const iframes = document.querySelectorAll('iframe');
    const results = [];
    for (const iframe of iframes) {
      try {
        const success = await this.injectResponsiveImageStyles(iframe, options);
        results.push({ iframe: iframe.id || iframe.src, success });
      } catch (error) {
        console.error('iframe 처리 오류:', error);
        results.push({ iframe: iframe.id || iframe.src, success: false, error: error.message });
      }
    }
    console.log('전체 iframe 스타일 주입 결과:', results);
    return results;
  }

  removeStyles(iframe) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const styleElement = iframeDoc.getElementById('responsive-content-styles');
      if (styleElement) {
        styleElement.remove();
        console.log('iframe 스타일 제거 완료');
        return true;
      }
      return false;
    } catch (error) {
      console.error('스타일 제거 오류:', error);
      return false;
    }
  }

  reset() {
    this.injectedIframes.clear();
    console.log('IframeStyleInjector 리셋 완료');
  }
}

// 전역 인스턴스
window.IframeStyleInjector = new IframeStyleInjector();
window.injectIframeStyles = (iframe, options) => window.IframeStyleInjector.injectResponsiveImageStyles(iframe, options);
window.injectAllIframeStyles = (options) => window.IframeStyleInjector.injectAllIframes(options);

console.log('IframeStyleInjector 로드 완료');
