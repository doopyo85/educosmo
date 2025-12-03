/**
 * EventBus.js - 개선된 이벤트 버스 구현
 * Component-System과 Layout-System 호환성을 위한 통합 이벤트 시스템
 */

// 이벤트 버스 싱글톤 - 표준화된 메서드명 사용
window.EventBus = {
  // 이벤트 목록 (이벤트명 => 콜백 배열)
  events: {},
  
  // 디버그 모드
  debug: false,
  
  // 이벤트 처리 통계
  stats: {
    published: 0,
    subscribed: 0,
    errors: 0
  },
  
  /**
   * 이벤트 구독 (표준 메서드)
   * @param {String} event - 이벤트명
   * @param {Function} callback - 콜백 함수
   * @returns {Function} - 구독 취소 함수
   */
  subscribe: function(event, callback) {
    // 파라미터 검증
    if (typeof event !== 'string' || typeof callback !== 'function') {
      console.error('EventBus.subscribe: 잘못된 파라미터', { event, callback });
      this.stats.errors++;
      return () => {};
    }
    
    // 이벤트가 없으면 배열 생성
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    // 콜백 추가
    this.events[event].push(callback);
    this.stats.subscribed++;
    
    if (this.debug) {
      console.log(`EventBus: '${event}' 이벤트 구독됨 (총 ${this.events[event].length}개 구독자)`);
    }
    
    // 구독 취소 함수 반환
    return () => {
      this.unsubscribe(event, callback);
    };
  },
  
  /**
   * 이벤트 발행 (표준 메서드)
   * @param {String} event - 이벤트명
   * @param {*} data - 이벤트 데이터
   */
  publish: function(event, data) {
    // 파라미터 검증
    if (typeof event !== 'string') {
      console.error('EventBus.publish: 잘못된 이벤트명', event);
      this.stats.errors++;
      return;
    }
    
    // 이벤트가 없으면 종료
    if (!this.events[event] || this.events[event].length === 0) {
      if (this.debug) {
        console.log(`EventBus: '${event}' 이벤트 발행됨 (구독자 없음)`);
      }
      return;
    }
    
    this.stats.published++;
    
    if (this.debug) {
      console.log(`EventBus: '${event}' 이벤트 발행됨`, data, `(${this.events[event].length}개 구독자)`);
    }
    
    // 모든 콜백 호출 (안전한 실행)
    this.events[event].forEach((callback, index) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`EventBus: '${event}' 이벤트 처리 중 오류 (구독자 ${index}):`, error);
        this.stats.errors++;
      }
    });
  },
  
  /**
   * 이벤트 구독 취소
   * @param {String} event - 이벤트명
   * @param {Function} callback - 콜백 함수
   */
  unsubscribe: function(event, callback) {
    if (!this.events[event]) return;
    
    // 콜백 찾아서 제거
    const index = this.events[event].indexOf(callback);
    if (index !== -1) {
      this.events[event].splice(index, 1);
      
      if (this.debug) {
        console.log(`EventBus: '${event}' 이벤트 구독 취소됨 (남은 구독자: ${this.events[event].length}개)`);
      }
    }
  },
  
  /**
   * 이벤트 구독 한 번만 (자동 구독 취소)
   * @param {String} event - 이벤트명
   * @param {Function} callback - 콜백 함수
   * @returns {Function} - 구독 취소 함수
   */
  subscribeOnce: function(event, callback) {
    // 래퍼 함수 생성 (한 번 실행 후 구독 취소)
    const wrappedCallback = (data) => {
      // 먼저 구독 취소
      unsub();
      // 그 다음 콜백 실행
      try {
        callback(data);
      } catch (error) {
        console.error(`EventBus: '${event}' 일회성 이벤트 처리 중 오류:`, error);
        this.stats.errors++;
      }
    };
    
    // 구독 후 취소 함수 받아오기
    const unsub = this.subscribe(event, wrappedCallback);
    
    // 구독 취소 함수 반환
    return unsub;
  },
  
  // === 레거시 호환성을 위한 별칭 메서드들 ===
  
  /**
   * 이벤트 구독 (Vue.js 스타일)
   * @deprecated subscribe() 사용 권장
   */
  on: function(event, callback) {
    return this.subscribe(event, callback);
  },
  
  /**
   * 이벤트 발행 (Vue.js 스타일)
   * @deprecated publish() 사용 권장
   */
  emit: function(event, data) {
    this.publish(event, data);
  },
  
  /**
   * 이벤트 구독 취소 (Vue.js 스타일)
   * @deprecated unsubscribe() 사용 권장
   */
  off: function(event, callback) {
    this.unsubscribe(event, callback);
  },
  
  // === 관리 메서드들 ===
  
  /**
   * 디버그 모드 설정
   * @param {Boolean} enabled - 활성화 여부
   */
  setDebug: function(enabled) {
    this.debug = !!enabled;
    
    if (this.debug) {
      console.log('EventBus: 디버그 모드 활성화됨');
      console.log('EventBus 통계:', this.getStats());
    }
  },
  
  /**
   * 모든 이벤트 구독 취소
   */
  clear: function() {
    const eventCount = Object.keys(this.events).length;
    this.events = {};
    
    if (this.debug) {
      console.log(`EventBus: 모든 이벤트 구독 취소됨 (${eventCount}개 이벤트)`);
    }
  },
  
  /**
   * 특정 이벤트 구독 취소
   * @param {String} event - 이벤트명
   */
  clearEvent: function(event) {
    if (this.events[event]) {
      const subscriberCount = this.events[event].length;
      delete this.events[event];
      
      if (this.debug) {
        console.log(`EventBus: '${event}' 이벤트의 모든 구독 취소됨 (${subscriberCount}개 구독자)`);
      }
    }
  },
  
  /**
   * 현재 등록된 모든 이벤트 목록 반환
   * @returns {Object} - 이벤트 목록과 구독자 수
   */
  getEvents: function() {
    const eventNames = Object.keys(this.events);
    const eventCounts = {};
    
    eventNames.forEach(name => {
      eventCounts[name] = this.events[name].length;
    });
    
    return eventCounts;
  },
  
  /**
   * EventBus 통계 정보 반환
   * @returns {Object} - 통계 정보
   */
  getStats: function() {
    return {
      ...this.stats,
      activeEvents: Object.keys(this.events).length,
      totalSubscribers: Object.values(this.events).reduce((sum, subscribers) => sum + subscribers.length, 0)
    };
  },
  
  /**
   * 특정 이벤트의 구독자 수 반환
   * @param {String} event - 이벤트명
   * @returns {Number} - 구독자 수
   */
  getSubscriberCount: function(event) {
    return this.events[event] ? this.events[event].length : 0;
  },
  
  /**
   * 이벤트 존재 여부 확인
   * @param {String} event - 이벤트명
   * @returns {Boolean} - 존재 여부
   */
  hasEvent: function(event) {
    return !!this.events[event] && this.events[event].length > 0;
  },
  
  /**
   * EventBus 상태 리셋 (테스트용)
   */
  reset: function() {
    this.events = {};
    this.stats = {
      published: 0,
      subscribed: 0,
      errors: 0
    };
    this.debug = false;
    
    console.log('EventBus: 상태가 리셋되었습니다.');
  }
};

// 개발 환경에서 디버그 모드 활성화
if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.includes('192.168'))) {
  window.EventBus.setDebug(true);
}

// 전역 오류 처리기에서 EventBus 오류 모니터링
if (typeof window !== 'undefined') {
  window.addEventListener('error', function(event) {
    if (event.message && event.message.includes('EventBus')) {
      window.EventBus.stats.errors++;
      console.error('EventBus 관련 전역 오류 감지:', event);
    }
  });
}

// 페이지 언로드 시 통계 출력 (디버그 모드)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', function() {
    if (window.EventBus.debug) {
      console.log('EventBus 최종 통계:', window.EventBus.getStats());
    }
  });
}