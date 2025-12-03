/**
 * ComponentRegistry.js - 컴포넌트 레지스트리 구현
 * 모든 컴포넌트를 등록하고 관리하는 레지스트리입니다.
 */

// 컴포넌트 레지스트리 싱글톤
window.ComponentRegistry = {
  // 컴포넌트 목록 (이름 => 컴포넌트 인스턴스)
  components: {},
  
  // 디버그 모드
  debug: false,
  
  /**
   * 컴포넌트 등록
   * @param {String} name - 컴포넌트 이름
   * @param {Component} component - 컴포넌트 인스턴스
   * @returns {Component} - 등록된 컴포넌트 인스턴스
   */
  register: function(name, component) {
    if (!name) {
      throw new Error('컴포넌트 이름이 필요합니다.');
    }
    
    if (!component) {
      throw new Error('컴포넌트 인스턴스가 필요합니다.');
    }
    
    // Component 클래스 인스턴스인지 확인
    if (component instanceof Component) {
      this.components[name] = component;
      
      if (this.debug) {
        console.log('ComponentRegistry: \'' + name + '\' 컴포넌트 등록됨');
      }
      
      // 컴포넌트 등록 이벤트 발행
      if (window.EventBus) {
        window.EventBus.publish('componentRegistered', {
          name: name,
          component: component
        });
      }
      
      return component;
    } else {
      throw new Error('유효한 Component 인스턴스가 아닙니다.');
    }
  },
  
  /**
   * 컴포넌트 가져오기
   * @param {String} name - 컴포넌트 이름
   * @returns {Component|null} - 컴포넌트 인스턴스 또는 null
   */
  get: function(name) {
    return this.components[name] || null;
  },
  
  /**
   * 모든 컴포넌트 가져오기
   * @returns {Object} - 컴포넌트 목록
   */
  getAll: function() {
    return this.components;
  },
  
  /**
   * 컴포넌트 등록 해제
   * @param {String} name - 컴포넌트 이름
   * @returns {Boolean} - 성공 여부
   */
  unregister: function(name) {
    if (this.components[name]) {
      delete this.components[name];
      
      if (this.debug) {
        console.log('ComponentRegistry: \'' + name + '\' 컴포넌트 등록 해제됨');
      }
      
      // 컴포넌트 등록 해제 이벤트 발행
      if (window.EventBus) {
        window.EventBus.publish('componentUnregistered', {
          name: name
        });
      }
      
      return true;
    }
    
    return false;
  },
  
  /**
   * 특정 유형의 모든 컴포넌트 가져오기
   * @param {Function} componentClass - 컴포넌트 클래스
   * @returns {Array} - 컴포넌트 인스턴스 배열
   */
  getByType: function(componentClass) {
    var result = [];
    for (var key in this.components) {
      if (this.components.hasOwnProperty(key) && this.components[key] instanceof componentClass) {
        result.push(this.components[key]);
      }
    }
    return result;
  },
  
  /**
   * 디버그 모드 설정
   * @param {Boolean} enabled - 활성화 여부
   */
  setDebug: function(enabled) {
    this.debug = !!enabled;
    
    if (this.debug) {
      console.log('ComponentRegistry: 디버그 모드 활성화됨');
    }
  },
  
  /**
   * 모든 컴포넌트 초기화
   * @param {*} data - 컴포넌트에 전달할 초기 데이터
   * @returns {Promise} - 초기화 결과 객체
   */
  initializeAll: function(data) {
    var self = this;
    data = data || null;
    var results = {};
    
    // Promise로 변환하여 비동기 처리
    return new Promise(function(resolve) {
      var componentNames = [];
      
      // 컴포넌트 이름 목록 가져오기
      for (var name in self.components) {
        if (self.components.hasOwnProperty(name)) {
          componentNames.push(name);
        }
      }
      
      // 컴포넌트 없으면 빈 결과 반환
      if (componentNames.length === 0) {
        resolve(results);
        return;
      }
      
      // 각 컴포넌트 초기화 처리
      var processedCount = 0;
      componentNames.forEach(function(name) {
        var component = self.components[name];
        
        // 컴포넌트 초기화가 Promise를 반환하는 경우
        try {
          var initResult = component.init(data);
          
          // Promise인지 확인하고 적절히 처리
          if (initResult && typeof initResult.then === 'function') {
            initResult
              .then(function(result) {
                results[name] = result;
                handleCompletion();
              })
              .catch(function(error) {
                console.error('ComponentRegistry: \'' + name + '\' 컴포넌트 초기화 중 오류:', error);
                results[name] = false;
                handleCompletion();
              });
          } else {
            // Promise가 아닌 경우 즉시 결과 저장
            results[name] = initResult;
            handleCompletion();
          }
        } catch (error) {
          console.error('ComponentRegistry: \'' + name + '\' 컴포넌트 초기화 중 오류:', error);
          results[name] = false;
          handleCompletion();
        }
      });
      
      // 모든 컴포넌트 처리 완료 확인
      function handleCompletion() {
        processedCount++;
        if (processedCount === componentNames.length) {
          resolve(results);
        }
      }
    });
  },
  
  /**
   * 모든 컴포넌트 활성화
   */
  activateAll: function() {
    for (var name in this.components) {
      if (this.components.hasOwnProperty(name)) {
        try {
          this.components[name].activate();
        } catch (error) {
          console.error('ComponentRegistry: 컴포넌트 활성화 중 오류:', error);
        }
      }
    }
  },
  
  /**
   * 모든 컴포넌트 비활성화
   */
  deactivateAll: function() {
    for (var name in this.components) {
      if (this.components.hasOwnProperty(name)) {
        try {
          this.components[name].deactivate();
        } catch (error) {
          console.error('ComponentRegistry: 컴포넌트 비활성화 중 오류:', error);
        }
      }
    }
  }
};