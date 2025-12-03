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
   
   // 프로젝트 로드
   if (projectParam && projectParam !== 'new') {
       console.log('📦 URL에서 Base64 프로젝트 데이터 감지');
       loadProjectFromBase64(projectParam);
   } else if (s3UrlParam) {
       console.log('🌎 URL에서 S3 URL 감지:', s3UrlParam);
       loadProjectFromS3Url(s3UrlParam);
   } else if (userInfo.project && userInfo.project !== 'new') {
       console.log('📁 사용자 정보에서 프로젝트 로드 시도:', userInfo.project);
       loadProjectFromS3(userInfo.project);
   } else {
       console.log('📄 새 프로젝트 시작');
       Entry.loadProject();
   }
   
   console.log('✅ EntryJS Base + TTS 초기화 완료!');
});

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
