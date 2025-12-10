import { installPopup } from './popup/index.mjs';
import { installListTool } from './listTool/index.mjs';
import { installEntryEvent } from './event.mjs';
import { installModalProgress } from './modalProgress/index.mjs';

document.addEventListener('DOMContentLoaded', function() {
   // 사용자 정보 가져오기
   const userInfo = window.EDUCODINGNPLAY_USER || {
       userID: 'guest',
       role: 'guest',
       centerID: '',
       project: 'new',
       baseUrl: 'https://app.codingnplay.co.kr'
   };
   
   // URL 파라미터에서 프로젝트 데이터 확인
   const urlParams = new URLSearchParams(window.location.search);
   const projectParam = urlParams.get('project');
   const s3UrlParam = urlParams.get('s3Url');
   const userIDParam = urlParams.get('userID') || 'guest';
   const roleParam = urlParams.get('role') || 'guest';
   
   // 사용자 정보 설정
   if (!userInfo.userID || userInfo.userID === 'guest') {
       userInfo.userID = userIDParam;
       userInfo.role = roleParam;
   }
   
   console.log('🚀 EntryJS Base + TTS 초기화 시작:', {
       userInfo,
       projectParam: projectParam ? projectParam.substring(0, 50) + '...' : null,
       s3UrlParam,
       webSpeechAPI: 'speechSynthesis' in window
   });
   
   var initOption = {
       type: 'workspace',
       textCodingEnable: true,
       backpackDisable: true,
       exportObjectEnable: false,
       blockSaveImageEnable: false,
       iframeDomAccess: 'none',
       
       // 리소스 경로 설정
       defaultDir: '/resources',
       mediaFilePath: '/resources/uploads/',
       soundDir: '/resources/uploads/',
       
       // 사용자 정보 추가
       userID: userInfo.userID,
       userRole: userInfo.role,
       centerID: userInfo.centerID,
       baseUrl: userInfo.baseUrl
   };
   
   Entry.creationChangedEvent = new Entry.Event(window);
   Entry.init(document.getElementById('workspace'), initOption);
   
   // 팝업 시스템 설치
   installPopup();
   installModalProgress();
   installListTool();
   installEntryEvent();
   
   // TTS 시스템 초기화 (조용히 - 알림 없음)
   initializeTTSSystem();
   
   // 🔥 세션 Heartbeat 시작 (30분마다)
   startSessionHeartbeat(userInfo);
   
   // 🔥 프로젝트 로드 (자동저장 복구 체크 포함)
   loadProjectWithAutoSaveCheck(projectParam, s3UrlParam, userInfo);
   
   console.log('✅ EntryJS Base + TTS 초기화 완료!');
});

// =================================================================
// 🔥 세션 Heartbeat 함수 (30분마다 3000 서버로 전송)
// =================================================================
function startSessionHeartbeat(userInfo) {
    const HEARTBEAT_INTERVAL = 30 * 60 * 1000; // 30분
    
    async function sendHeartbeat() {
        try {
            const baseUrl = userInfo?.baseUrl || window.location.origin || 'https://app.codingnplay.co.kr';
            const response = await fetch(`${baseUrl}/api/session/heartbeat`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform: 'entry',
                    userID: userInfo?.userID || 'guest',
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                console.log('💓 [Entry] 세션 Heartbeat 전송 완료:', new Date().toLocaleTimeString('ko-KR'));
            } else {
                console.warn('⚠️ [Entry] 세션 Heartbeat 응답 오류:', response.status);
            }
        } catch (error) {
            console.error('❌ [Entry] 세션 Heartbeat 전송 실패:', error.message);
        }
    }
    
    // 즉시 한 번 전송
    sendHeartbeat();
    
    // 30분마다 반복
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    console.log('💓 [Entry] 세션 Heartbeat 시작 (30분 간격)');
}

// =================================================================
// 🔥 자동저장 복구 체크 후 프로젝트 로드
// =================================================================
async function loadProjectWithAutoSaveCheck(projectParam, s3UrlParam, userInfo) {
    // URL에서 프로젝트를 로드해야 하는 경우 (자동저장 무시)
    if (projectParam && projectParam !== 'new') {
        console.log('📦 URL에서 Base64 프로젝트 데이터 감지 - 자동저장 건너뜀');
        loadProjectFromBase64(projectParam);
        return;
    }
    
    if (s3UrlParam) {
        console.log('🌎 URL에서 S3 URL 감지 - 자동저장 건너뜀:', s3UrlParam);
        loadProjectFromS3Url(s3UrlParam);
        return;
    }
    
    if (userInfo.project && userInfo.project !== 'new') {
        console.log('📁 사용자 정보에서 프로젝트 로드 - 자동저장 건너뜀:', userInfo.project);
        loadProjectFromS3(userInfo.project);
        return;
    }
    
    // 🔥 새 프로젝트 시작 시에만 자동저장 복구 체크
    console.log('📄 새 프로젝트 시작 - 자동저장 복구 체크');
    
    const recoveryData = checkAutoSaveRecovery(userInfo.userID);
    
    if (recoveryData) {
        console.log('💾 복구 가능한 자동저장 데이터 발견!');
        
        // 복구 모달 표시
        const shouldRecover = await showRecoveryConfirmModal(recoveryData);
        
        if (shouldRecover) {
            console.log('🔄 자동저장 데이터 복구 시작...');
            try {
                Entry.loadProject(recoveryData.projectData);
                console.log('✅ 자동저장 프로젝트 복구 완료!');
                showNotification('💾 자동저장 프로젝트가 복구되었습니다!', 'success');
            } catch (error) {
                console.error('❌ 자동저장 복구 실패:', error);
                Entry.loadProject();
            }
        } else {
            console.log('🗑️ 자동저장 데이터 삭제 후 새 프로젝트 시작');
            clearAutoSaveData(userInfo.userID);
            Entry.loadProject();
        }
    } else {
        console.log('ℹ️ 복구할 자동저장 데이터 없음 - 새 프로젝트 시작');
        Entry.loadProject();
    }
}

// =================================================================
// 🔥 자동저장 데이터 체크 함수
// =================================================================
function checkAutoSaveRecovery(userID) {
    const storageKey = `autosave_entry_${userID || 'anonymous'}`;
    const saved = localStorage.getItem(storageKey);
    
    if (!saved) {
        console.log('[AutoSave] 복구할 데이터 없음');
        return null;
    }
    
    try {
        const data = JSON.parse(saved);
        
        // 데이터 유효성 검증
        if (!data.projectData) {
            console.warn('[AutoSave] 복구 데이터에 projectData가 없습니다.');
            localStorage.removeItem(storageKey);
            return null;
        }
        
        // objects 배열 검증
        if (!data.projectData.objects || data.projectData.objects.length === 0) {
            console.warn('[AutoSave] 복구 데이터에 오브젝트가 없습니다.');
            localStorage.removeItem(storageKey);
            return null;
        }
        
        // 너무 오래된 데이터 체크 (7일 이상)
        const savedTime = new Date(data.timestamp);
        const now = new Date();
        const daysDiff = (now - savedTime) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 7) {
            console.warn(`[AutoSave] 복구 데이터가 ${Math.floor(daysDiff)}일 전입니다. 삭제합니다.`);
            localStorage.removeItem(storageKey);
            return null;
        }
        
        console.log(`[AutoSave] 🔄 복구 가능한 데이터 발견 - ${data.timestamp}`);
        console.log(`[AutoSave] 📊 메타데이터:`, data.meta || '없음');
        
        return data;
        
    } catch (error) {
        console.error('[AutoSave] 복구 데이터 파싱 실패:', error);
        localStorage.removeItem(storageKey);
        return null;
    }
}

// =================================================================
// 🔥 자동저장 데이터 삭제 함수
// =================================================================
function clearAutoSaveData(userID) {
    const storageKey = `autosave_entry_${userID || 'anonymous'}`;
    localStorage.removeItem(storageKey);
    console.log('[AutoSave] 🗑️ 자동저장 데이터 삭제됨');
}

// =================================================================
// 🔥 복구 확인 모달 표시 (Promise 기반)
// =================================================================
function showRecoveryConfirmModal(recoveryData) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'autosave-recovery-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        const timestamp = new Date(recoveryData.timestamp).toLocaleString('ko-KR');
        const meta = recoveryData.meta || {};
        
        modalContent.innerHTML = `
            <h2 style="margin-top: 0; color: #333;">🔄 자동저장 복구</h2>
            <p style="color: #666; line-height: 1.6;">
                <strong>${timestamp}</strong>에 자동저장된 프로젝트가 있습니다.<br>
                ${meta.objectCount ? `<span style="color: #537EC5;">오브젝트: ${meta.objectCount}개</span>` : ''}
                ${meta.sceneCount ? `, <span style="color: #537EC5;">장면: ${meta.sceneCount}개</span>` : ''}
            </p>
            <p style="color: #888; font-size: 14px;">복구하시겠습니까?</p>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="recover-yes" style="
                    flex: 1;
                    padding: 12px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">복구하기</button>
                <button id="recover-no" style="
                    flex: 1;
                    padding: 12px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">새로 시작</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 복구하기 버튼
        document.getElementById('recover-yes').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
        
        // 새로 시작 버튼
        document.getElementById('recover-no').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
    });
}

// =================================================================
// 🔊 TTS 시스템 초기화 함수
// =================================================================

// TTS 시스템 초기화
function initializeTTSSystem() {
    console.log('🔊 TTS 시스템 초기화 시작');
    
    // Web Speech API 지원 확인
    if (!('speechSynthesis' in window)) {
        console.warn('⚠️ Web Speech API가 지원되지 않는 브라우저입니다.');
        console.warn('TTS 기능이 제한됩니다.');
        return false;
    }
    
    // EntryJSWebSpeechTTS 객체 존재 확인
    if (!window.EntryJSWebSpeechTTS) {
        console.warn('⚠️ EntryJSWebSpeechTTS 객체가 로드되지 않았습니다.');
        console.warn('entryjs-webspeech-tts.js 파일을 확인하세요.');
        return false;
    }
    
    console.log('✅ Web Speech API 지원 확인됨');
    console.log('✅ EntryJSWebSpeechTTS 객체 로드됨');
    
    // EntryJS 로드 대기 후 TTS 블록 교체
    const waitForEntry = setInterval(() => {
        if (window.Entry && Entry.addEventListener && Entry.block) {
            clearInterval(waitForEntry);
            
            console.log('🚀 EntryJS 로드 완료 - TTS 블록 교체 시작');
            
            // EntryJS 이벤트 리스너 등록
            Entry.addEventListener('entryLoaded', () => {
                console.log('🎉 EntryJS entryLoaded 이벤트 - TTS 블록 교체');
                if (window.EntryJSWebSpeechTTS && typeof window.EntryJSWebSpeechTTS.initializeEntryBlocks === 'function') {
                    window.EntryJSWebSpeechTTS.initializeEntryBlocks();
                } else {
                    // 대체 수동 교체
                    replaceTTSBlocks();
                }
            });
            
            // 즉시 교체 시도 (이미 로드된 경우)
            setTimeout(() => {
                if (Entry.block && Object.keys(Entry.block).length > 0) {
                    console.log('🔄 즉시 TTS 블록 교체 시도');
                    if (window.EntryJSWebSpeechTTS && typeof window.EntryJSWebSpeechTTS.initializeEntryBlocks === 'function') {
                        window.EntryJSWebSpeechTTS.initializeEntryBlocks();
                    } else {
                        replaceTTSBlocks();
                    }
                }
            }, 2000);
            
        }
    }, 500);
    
    // 5초 후 타임아웃
    setTimeout(() => {
        clearInterval(waitForEntry);
        console.log('⚠️ TTS 초기화 타임아웃 (EntryJS 로드 대기 중)');
    }, 5000);
    
    return true;
}

// TTS 테스트 함수 (전역 등록)
window.testTTSSystem = function(text = '안녕하세요, EntryJS TTS 테스트입니다.') {
    console.log('🧪 TTS 시스템 테스트 시작:', text);
    
    if (window.EntryJSWebSpeechTTS) {
        window.EntryJSWebSpeechTTS.readText(text, { speed: 0, pitch: 0, volume: 1 });
        console.log('🔊 TTS 테스트 실행 중...');
    } else {
        console.error('❌ EntryJSWebSpeechTTS 객체가 없습니다.');
    }
};

// TTS 상태 확인 함수 (전역 등록)
window.getTTSStatus = function() {
    const status = {
        webSpeechAPI: 'speechSynthesis' in window,
        entryTTSObject: !!window.EntryJSWebSpeechTTS,
        entryLoaded: !!(window.Entry && Entry.block),
        availableVoices: 'speechSynthesis' in window ? speechSynthesis.getVoices().length : 0,
        browserEngine: navigator.userAgent
    };
    
    console.log('📊 TTS 시스템 상태:', status);
    return status;
};

// Base64 인코딩된 프로젝트 데이터 직접 로드
function loadProjectFromBase64(base64ProjectData) {
   try {
       console.log('🔓 Base64 프로젝트 데이터 디코딩 시작...');
       
       const decodedJson = atob(base64ProjectData);
       const projectData = JSON.parse(decodedJson);
       
       console.log('✅ 프로젝트 데이터 디코딩 성공:', {
           type: typeof projectData,
           keys: Object.keys(projectData),
           objects: projectData.objects?.length || 0,
           scenes: projectData.scenes?.length || 0
       });
       
       Entry.loadProject(projectData);
       
       console.log('🎉 Base64 프로젝트 로드 완료!');
       // 알림 제거 - 콘솔 로그만 유지
       
   } catch (error) {
       console.error('❌ Base64 프로젝트 디코딩 오류:', error);
       console.log('🔄 새 프로젝트로 대체');
       Entry.loadProject();
       // 오류는 콘솔에만 기록
   }
}

// S3 URL로 프로젝트 로드
async function loadProjectFromS3Url(s3Url) {
   try {
       const userInfo = window.EDUCODINGNPLAY_USER;
       console.log('🌎 S3 URL로 프로젝트 로드 시도:', s3Url);
       
        const baseUrl = userInfo?.baseUrl || window.location.origin || 'https://app.codingnplay.co.kr';
        const response = await fetch(`${baseUrl}/entry/api/load-project?s3Url=${encodeURIComponent(s3Url)}`, {
           method: 'GET',
           credentials: 'include',
           headers: {
               'Content-Type': 'application/json'
           }
       });
       
       if (response.ok) {
           const result = await response.json();
           console.log('📦 S3 API 응답 받음:', result);
           
           if (result.success && result.projectData) {
               Entry.loadProject(result.projectData);
               console.log('✅ S3 URL 프로젝트 로드 완료');
               // 알림 제거 - 콘솔 로그만 유지
           } else {
               Entry.loadProject();
               console.log('📝 새 프로젝트로 시작합니다.');
           }
       } else {
           Entry.loadProject();
           console.warn('⚠️ 프로젝트 로드에 실패했습니다.');
       }
   } catch (error) {
       console.error('❌ S3 URL 프로젝트 로드 오류:', error);
       Entry.loadProject();
       // 오류는 콘솔에만 기록
   }
}

// 프로젝트 로드 (8070 프록시)
async function loadProjectFromS3(projectFile) {
   try {
       const userInfo = window.EDUCODINGNPLAY_USER;
       console.log('🔄 프로젝트 로드 시도:', projectFile);
       
       const response = await fetch(`${userInfo?.baseUrl || window.location.origin}/entry/api/load-project?file=${encodeURIComponent(projectFile)}`, {
           method: 'GET',
           credentials: 'include',
           headers: {
               'Content-Type': 'application/json',
               'X-User-ID': userInfo.userID,
               'X-User-Role': userInfo.role
           }
       });
       
       if (response.ok) {
           const result = await response.json();
           console.log('📦 API 응답 받음:', result);
           
           if (result.success && result.projectData) {
               Entry.loadProject(result.projectData);
               console.log('✅ 프로젝트 로드 완료:', projectFile);
               // 알림 제거 - 콘솔 로그만 유지
           } else {
               Entry.loadProject();
               console.log('📝 새 프로젝트로 시작합니다.');
           }
       } else {
           Entry.loadProject();
           console.warn('⚠️ 프로젝트 로드에 실패했습니다.');
       }
   } catch (error) {
       console.error('❌ 프로젝트 로드 오류:', error);
       Entry.loadProject();
       // 오류는 콘솔에만 기록
   }
}

// 프로젝트 저장
async function saveProjectToS3(projectData, projectName) {
    try {
        const userInfo = window.EDUCODINGNPLAY_USER;
        console.log('💾 프로젝트 S3 저장 시도:', projectName);
        
        const response = await fetch(`${userInfo?.baseUrl || window.location.origin}/entry/api/save-project`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userInfo.userID,
                'X-User-Role': userInfo.role
            },
            body: JSON.stringify({
                projectData: projectData,
                projectName: projectName,
                userID: userInfo.userID,
                centerID: userInfo.centerID
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ 프로젝트 저장 성공:', result);
            showNotification('💾 저장 완료!', 'success');
            return result;
        } else {
            const errorData = await response.json();
            console.error('❌ 프로젝트 저장 실패:', errorData);
            showNotification('❌ 저장 실패', 'error');
            return null;
        }
    } catch (error) {
        console.error('❌ 프로젝트 저장 오류:', error);
        showNotification('❌ 저장 오류', 'error');
        return null;
    }
}

// 알림 메시지 표시
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// 전역 함수로 내보내기
window.loadProjectFromBase64 = loadProjectFromBase64;
window.loadProjectFromS3Url = loadProjectFromS3Url;
window.loadProjectFromS3 = loadProjectFromS3;
window.saveProjectToS3 = saveProjectToS3;
window.showNotification = showNotification;
