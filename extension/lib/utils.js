/**
 * 코딩앤플레이 확장프로그램 - 공통 유틸리티
 */

const CNPUtils = {
  /**
   * Base64 인코딩
   */
  toBase64: function(str) {
    return btoa(unescape(encodeURIComponent(str)));
  },

  /**
   * 파일을 Base64로 읽기
   */
  readFileAsBase64: function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * 파일을 ArrayBuffer로 읽기
   */
  readFileAsArrayBuffer: function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * 날짜 포맷팅
   */
  formatDate: function(date) {
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * 디바운스
   */
  debounce: function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

// 전역 노출
if (typeof window !== 'undefined') {
  window.CNPUtils = CNPUtils;
}
