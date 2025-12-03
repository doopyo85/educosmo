/**
 * EntryInitializer.js
 * Entry 통합 초기화 모듈
 * 
 * @description
 * Entry 프로젝트의 분산된 초기화 로직을 하나로 통합.
 * 사용자 정보 파싱, 프로젝트 로드, Entry 초기화를 담당.
 * 
 * @author educodingnplay
 * @version 1.0.0
 * @created 2025-10-10
 */

class EntryInitializer {
    /**
     * EntryInitializer 생성자
     * 
     * @param {Object} options - 초기화 옵션
     * @param {boolean} [options.autoInit=false] - 자동 초기화 여부
     * @param {number} [options.timeout=10000] - Entry 로드 타임아웃 (ms)
     * @param {boolean} [options.enableLogging=true] - 로깅 활성화
     */
    constructor(options = {}) {
        this.options = {
            autoInit: false,
            timeout: 10000,
            enableLogging: true,
            ...options
        };
        
        this.config = {
            userInfo: null,
            projectInfo: null,
            environment: this.detectEnvironment()
        };
        
        this.initialized = false;
        this.events = {};
        
        // 자동 초기화
        if (this.options.autoInit) {
            this.initialize();
        }
    }
    
    // ========================================
    // 핵심 초기화 메서드
    // ========================================
    
    /**
     * Entry 전체 초기화 프로세스 실행
     * 
     * @returns {Promise<Object>} 초기화 결과
     * @throws {Error} 초기화 실패 시
     */
    async initialize() {
        try {
            this.log('🚀 Entry 초기화 시작...');
            
            // 1. 사용자 정보 수집
            this.config.userInfo = this.getUserInfo();
            this.log('✅ 사용자 정보 수집 완료:', this.config.userInfo);
            
            // 2. 사용자 검증
            if (!this.validateUser(this.config.userInfo)) {
                throw new Error('사용자 정보 검증 실패');
            }
            this.log('✅ 사용자 정보 검증 완료');
            
            // 3. UI 업데이트
            this.updateUI(this.config.userInfo);
            this.log('✅ UI 업데이트 완료');
            
            // 4. 프로젝트 정보 수집
            this.config.projectInfo = this.getProjectInfo();
            this.log('✅ 프로젝트 정보 수집 완료:', this.config.projectInfo);
            
            // 5. Entry 초기화
            await this.initializeEntry();
            this.log('✅ Entry 워크스페이스 초기화 완료');
            
            // 6. 프로젝트 로드
            await this.loadProject();
            this.log('✅ 프로젝트 로드 완료');
            
            this.initialized = true;
            
            // 이벤트 발생
            this.emit('initialized', {
                userInfo: this.config.userInfo,
                projectInfo: this.config.projectInfo
            });
            
            const result = {
                success: true,
                userInfo: this.config.userInfo,
                projectInfo: this.config.projectInfo,
                message: 'Entry 초기화 완료'
            };
            
            this.log('🎉 Entry 전체 초기화 완료!', result);
            return result;
            
        } catch (error) {
            this.handleError('initialize', error);
            throw error;
        }
    }
    
    // ========================================
    // 사용자 정보 관리
    // ========================================
    
    /**
     * URL Query Params에서 사용자 정보 추출
     * 
     * @returns {Object} userInfo
     */
    getUserInfo() {
        const params = new URLSearchParams(window.location.search);
        
        return {
            userID: params.get('userID') || 'guest',
            role: params.get('role') || 'guest',
            sessionID: params.get('sessionID') || '',
            centerID: params.get('centerID') || ''
        };
    }
    
    /**
     * 사용자 정보 유효성 검증
     * 
     * @param {Object} userInfo
     * @returns {boolean} 유효성 여부
     */
    validateUser(userInfo) {
        // 1. userID 검증
        if (!userInfo.userID || userInfo.userID.trim() === '') {
            this.log('❌ userID가 비어있습니다');
            return false;
        }
        
        // 2. XSS 방지: HTML 태그 제거
        const sanitizedUserID = this.sanitizeInput(userInfo.userID);
        if (sanitizedUserID !== userInfo.userID) {
            this.log('⚠️ userID에서 HTML 태그가 제거되었습니다');
            userInfo.userID = sanitizedUserID;
        }
        
        // 3. userID 형식 검증 (영문, 숫자, 언더스코어만 허용)
        if (!this.isValidUserID(sanitizedUserID)) {
            this.log('⚠️ userID에 유효하지 않은 문자가 포함되어 있습니다:', sanitizedUserID);
            // guest는 허용
            if (sanitizedUserID !== 'guest') {
                return false;
            }
        }
        
        // 4. Role 화이트리스트 검증
        const allowedRoles = ['admin', 'teacher', 'manager', 'student', 'guest', 'kinder', 'school'];
        if (!allowedRoles.includes(userInfo.role)) {
            this.log('⚠️ 유효하지 않은 role:', userInfo.role, '-> guest로 변경');
            userInfo.role = 'guest';
        }
        
        return true;
    }
    
    /**
     * 입력값 새니타이징 (XSS 방지)
     * 
     * @param {string} input
     * @returns {string}
     */
    sanitizeInput(input) {
        if (!input) return '';
        return input.replace(/<[^>]*>/g, '').trim();
    }
    
    /**
     * userID 형식 검증
     * 
     * @param {string} userID
     * @returns {boolean}
     */
    isValidUserID(userID) {
        // 영문, 숫자, 언더스코어, 한글만 허용
        return /^[a-zA-Z0-9_가-힣]+$/.test(userID);
    }
    
    /**
     * 사용자 정보를 UI에 반영
     * 
     * @param {Object} userInfo
     */
    updateUI(userInfo) {
        // 1. 헤더 사용자 ID 표시
        const headerUserID = document.getElementById('headerUserID');
        if (headerUserID) {
            headerUserID.textContent = userInfo.userID;
            this.log('✅ 헤더에 사용자 ID 표시:', userInfo.userID);
        } else {
            this.log('⚠️ headerUserID 요소를 찾을 수 없음');
        }
        
        // 2. 전역 객체 설정 (하위 호환성)
        window.EDUCODINGNPLAY_USER = {
            userID: userInfo.userID,
            role: userInfo.role,
            sessionID: userInfo.sessionID,
            centerID: userInfo.centerID
        };
        
        this.log('✅ window.EDUCODINGNPLAY_USER 설정 완료');
        
        // 3. 이벤트 발생
        this.emit('userInfoUpdated', { userInfo });
    }
    
    // ========================================
    // 프로젝트 정보 관리
    // ========================================
    
    /**
     * URL에서 프로젝트 정보 추출
     * 
     * @returns {Object} projectInfo
     */
    getProjectInfo() {
        const params = new URLSearchParams(window.location.search);
        
        const projectInfo = {
            type: this.detectProjectType(params),
            data: params.get('project') || null,
            s3Url: params.get('s3Url') || null,
            loadPath: params.get('loadPath') || null
        };
        
        return projectInfo;
    }
    
    /**
     * 프로젝트 로드 방식 자동 감지
     * 
     * @param {URLSearchParams} params
     * @returns {'base64'|'s3'|'local'|'new'} 프로젝트 타입
     */
    detectProjectType(params) {
        if (params.has('project') && params.get('project')) {
            return 'base64';
        }
        if (params.has('s3Url') && params.get('s3Url')) {
            return 's3';
        }
        if (params.has('loadPath') && params.get('loadPath')) {
            return 'local';
        }
        return 'new';
    }
    
    // ========================================
    // Entry 초기화
    // ========================================
    
    /**
     * EntryJS 워크스페이스 초기화
     * 
     * @returns {Promise<void>}
     */
    async initializeEntry() {
        // 1. Entry 로드 대기
        await this.waitForEntry();
        
        // 2. 워크스페이스 요소 확인
        const workspace = document.getElementById('workspace');
        if (!workspace) {
            throw new Error('workspace 요소를 찾을 수 없습니다');
        }
        
        // 3. Entry 초기화 (이미 초기화되어 있으면 스킵)
        if (window.Entry && !window.Entry.initialized) {
            this.log('Entry.init() 실행 중...');
            // Entry.init()은 보통 app.mjs에서 이미 실행됨
            // 여기서는 대기만 함
        }
        
        this.log('✅ Entry 워크스페이스 준비 완료');
    }
    
    /**
     * Entry 라이브러리 로드 대기
     * 
     * @param {number} timeout - 최대 대기 시간 (ms)
     * @returns {Promise<boolean>} 로드 성공 여부
     */
    waitForEntry(timeout = this.options.timeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkInterval = setInterval(() => {
                // Entry 로드 확인
                if (window.Entry && Entry.loadProject) {
                    clearInterval(checkInterval);
                    this.log('✅ Entry 라이브러리 로드 완료');
                    resolve(true);
                    return;
                }
                
                // 타임아웃 체크
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    const error = new Error(`Entry 로드 타임아웃 (${timeout}ms)`);
                    this.log('❌ Entry 로드 실패:', error.message);
                    reject(error);
                }
            }, 100);
        });
    }
    
    // ========================================
    // 프로젝트 로드
    // ========================================
    
    /**
     * 프로젝트 로드 (분기 처리)
     * 
     * @returns {Promise<void>}
     */
    async loadProject() {
        const { type, data, s3Url, loadPath } = this.config.projectInfo;
        
        this.log(`📂 프로젝트 로드 시작 (타입: ${type})`);
        
        try {
            switch (type) {
                case 'base64':
                    await this.loadFromBase64(data);
                    break;
                case 's3':
                    await this.loadFromS3(s3Url);
                    break;
                case 'local':
                    await this.loadFromLocalPath(loadPath);
                    break;
                case 'new':
                default:
                    this.createNewProject();
                    break;
            }
            
            // 이벤트 발생
            this.emit('projectLoaded', {
                type: type,
                source: data || s3Url || loadPath || 'new'
            });
            
        } catch (error) {
            this.handleError('프로젝트 로드 실패', error);
            throw error;
        }
    }
    
    /**
     * Base64 인코딩된 프로젝트 로드
     * 
     * @param {string} base64Data
     * @returns {Promise<void>}
     */
    async loadFromBase64(base64Data) {
        try {
            this.log('📦 Base64 프로젝트 디코딩 중...');
            
            // 1. Base64 디코딩
            const jsonString = atob(base64Data);
            
            // 2. JSON 파싱
            const projectData = JSON.parse(jsonString);
            
            this.log('✅ Base64 디코딩 완료, 데이터 크기:', jsonString.length, 'bytes');
            
            // 3. Entry에 로드
            if (window.Entry && Entry.loadProject) {
                Entry.loadProject(projectData);
                this.log('✅ Base64 프로젝트 로드 완료');
            } else {
                throw new Error('Entry.loadProject() 함수를 찾을 수 없습니다');
            }
            
            // 4. 활동 로그
            this.logActivity('load_project_base64', {
                dataLength: base64Data.length,
                objectCount: projectData.objects?.length || 0
            });
            
        } catch (error) {
            throw new Error(`Base64 파싱 실패: ${error.message}`);
        }
    }
    
    /**
     * S3 URL에서 프로젝트 로드
     * 
     * @param {string} s3Url
     * @returns {Promise<void>}
     */
    async loadFromS3(s3Url) {
        try {
            this.log('☁️ S3에서 프로젝트 로드 중...', s3Url);
            
            // 1. API 호출
            const response = await fetch(
                `/entry/api/load-project?s3Url=${encodeURIComponent(s3Url)}`
            );
            
            // 2. 응답 검증
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'S3 로드 실패');
            }
            
            this.log('✅ S3 API 응답 성공:', result.fileName);
            
            // 3. Entry에 로드
            if (window.Entry && Entry.loadProject) {
                Entry.loadProject(result.projectData);
                this.log('✅ S3 프로젝트 로드 완료:', result.fileName);
            } else {
                throw new Error('Entry.loadProject() 함수를 찾을 수 없습니다');
            }
            
            // 4. 활동 로그
            this.logActivity('load_project_s3', {
                s3Url: s3Url,
                fileName: result.fileName
            });
            
        } catch (error) {
            throw new Error(`S3 로드 실패: ${error.message}`);
        }
    }
    
    /**
     * 로컬 파일 경로에서 프로젝트 로드 (8070 서버 전용)
     * 
     * @param {string} loadPath - /temp/ent_files/current/xxx.ent
     * @returns {Promise<void>}
     */
    async loadFromLocalPath(loadPath) {
        try {
            this.log('📁 로컬 파일 로드 중...', loadPath);
            
            // 1. 로컬 파일 API 호출
            const response = await fetch(
                `/entry/api/load-local?path=${encodeURIComponent(loadPath)}`
            );
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '로컬 파일 로드 실패');
            }
            
            // 2. Entry에 로드
            if (window.Entry && Entry.loadProject) {
                Entry.loadProject(result.projectData);
                this.log('✅ 로컬 파일 로드 완료:', loadPath);
            } else {
                throw new Error('Entry.loadProject() 함수를 찾을 수 없습니다');
            }
            
            // 3. 활동 로그
            this.logActivity('load_project_local', {
                loadPath: loadPath
            });
            
        } catch (error) {
            throw new Error(`로컬 파일 로드 실패: ${error.message}`);
        }
    }
    
    /**
     * 새 프로젝트 생성
     */
    createNewProject() {
        this.log('📝 새 프로젝트 생성');
        
        // Entry는 기본적으로 빈 프로젝트로 시작
        // 추가 작업 필요 없음
        
        this.logActivity('create_new_project', {
            timestamp: new Date().toISOString()
        });
    }
    
    // ========================================
    // 이벤트 시스템
    // ========================================
    
    /**
     * 이벤트 리스너 등록
     * 
     * @param {string} eventName
     * @param {Function} callback
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }
    
    /**
     * 이벤트 발생
     * 
     * @param {string} eventName
     * @param {*} data
     */
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log('❌ 이벤트 콜백 오류:', eventName, error);
                }
            });
        }
    }
    
    // ========================================
    // 에러 처리 및 로깅
    // ========================================
    
    /**
     * 에러 처리 및 사용자 알림
     * 
     * @param {string} context - 에러 발생 위치
     * @param {Error} error - 에러 객체
     */
    handleError(context, error) {
        this.log(`❌ [${context}]`, error);
        
        // 사용자에게 알림
        const message = `${context}\n${error.message}`;
        
        // 이벤트 발생
        this.emit('error', {
            context: context,
            error: error
        });
        
        // 모달 또는 알림 표시
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            // alert는 마지막 수단
            console.error(message);
        }
        
        // 에러 로그 전송
        this.logActivity('error', {
            context: context,
            error: error.message,
            stack: error.stack
        });
    }
    
    /**
     * 콘솔 로그 (옵션에 따라 활성화/비활성화)
     * 
     * @param {...any} args
     */
    log(...args) {
        if (this.options.enableLogging) {
            console.log('[EntryInitializer]', ...args);
        }
    }
    
    /**
     * 활동 로그 기록 (서버 전송)
     * 
     * @param {string} action
     * @param {Object} data
     */
    async logActivity(action, data = {}) {
        try {
            await fetch('/learning/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: `entry_${action}`,
                    userID: this.config.userInfo?.userID || 'unknown',
                    timestamp: new Date().toISOString(),
                    data: data
                })
            });
        } catch (error) {
            // 로그 실패는 무시 (핵심 기능 아님)
            this.log('⚠️ 활동 로그 기록 실패:', error.message);
        }
    }
    
    // ========================================
    // 유틸리티
    // ========================================
    
    /**
     * 환경 감지
     * 
     * @returns {Object} environment
     */
    detectEnvironment() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 인스턴스 정리
     */
    destroy() {
        this.events = null;
        this.config = null;
        this.initialized = false;
        this.log('🗑️ EntryInitializer 인스턴스 정리 완료');
    }
}

// 전역 노출 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.EntryInitializer = EntryInitializer;
}

// ES6 모듈 export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EntryInitializer;
}
