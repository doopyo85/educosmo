// public/js/entryjs-webspeech-tts.js
// EntryJS TTS 블록을 Web Speech API로 구현

class EntryJSWebSpeechTTS {
    constructor() {
        this.isSupported = 'speechSynthesis' in window;
        this.currentUtterance = null;
        this.isPlaying = false;
        this.voices = [];
        this.defaultVoice = null;
        
        this.init();
    }
    
    init() {
        if (!this.isSupported) {
            console.warn('⚠️ Web Speech API가 지원되지 않는 브라우저입니다.');
            return;
        }
        
        // 음성 목록 로드
        this.loadVoices();
        
        // 음성 목록이 동적으로 로드되는 경우 대비
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                this.loadVoices();
            };
        }
        
        console.log('✅ EntryJS Web Speech TTS 초기화 완료');
    }
    
    loadVoices() {
        this.voices = speechSynthesis.getVoices();
        
        // 한국어 음성 우선 선택
        this.defaultVoice = this.voices.find(voice => 
            voice.lang.includes('ko-KR') || 
            voice.lang.includes('ko') ||
            voice.name.includes('Korean') ||
            voice.name.includes('한국')
        );
        
        console.log('🎤 사용 가능한 음성:', this.voices.length + '개');
        console.log('🇰🇷 기본 한국어 음성:', this.defaultVoice?.name || '없음');
    }
    
    // EntryJS read_text 블록 구현
    readText(text, voiceProps = {}) {
        if (!this.isSupported || !text) {
            console.warn('⚠️ TTS 실행 불가:', { supported: this.isSupported, text: !!text });
            return Promise.resolve();
        }
        
        // 이전 음성 중지
        this.stop();
        
        // 브라우저 음성 로드 대기 (중요!)
        if (!this.voices.length) {
            console.log('🔄 음성 로드 대기 중...');
            // 음성 로드 대기 후 재시도
            setTimeout(() => {
                this.loadVoices();
                if (this.voices.length > 0) {
                    this.readText(text, voiceProps);
                } else {
                    console.warn('⚠️ 사용 가능한 음성이 없습니다.');
                }
            }, 500);
            return Promise.resolve();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // EntryJS 속성을 Web Speech API 속성으로 변환
        utterance.lang = 'ko-KR';
        utterance.rate = this.convertSpeed(voiceProps.speed || 0);
        utterance.pitch = this.convertPitch(voiceProps.pitch || 0);
        utterance.volume = Math.max(0, Math.min(1, voiceProps.volume || 1));
        
        // 음성 선택 (강제 실행 + 디버깅)
        console.log('🔍 음성 선택 디버깅:', {
            hasSpeaker: !!voiceProps.speaker,
            speaker: voiceProps.speaker,
            speakerType: typeof voiceProps.speaker,
            voicesCount: this.voices.length,
            voicesAvailable: this.voices.length > 0
        });
        
        if (voiceProps.speaker && this.voices.length > 0) {
            console.log('✅ 음성 선택 조건 통과 - selectVoice 호출');
            const selectedVoice = this.selectVoice(voiceProps.speaker);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log(`🎤 음성 적용 성공: ${voiceProps.speaker} -> ${selectedVoice.name}`);
            } else {
                console.warn(`⚠️ 음성 선택 실패: ${voiceProps.speaker}`);
                utterance.voice = this.defaultVoice;
            }
        } else {
            console.log('⚠️ 음성 선택 조건 미통과 - 기본 음성 사용');
            if (this.defaultVoice) {
                utterance.voice = this.defaultVoice;
                console.log(`🎤 기본 음성 사용: ${this.defaultVoice.name}`);
            }
        }
        
        // 상태 관리
        this.currentUtterance = utterance;
        this.isPlaying = true;
        
        // 오류 처리 강화
        utterance.onend = () => {
            this.isPlaying = false;
            this.currentUtterance = null;
            console.log('✅ TTS 재생 완료');
        };
        
        utterance.onerror = (error) => {
            console.error('❌ TTS 오류 상세 정보:', {
                error: error.error,
                message: error.message,
                text: text.substring(0, 30),
                voiceProps: voiceProps,
                selectedVoice: utterance.voice?.name,
                rate: utterance.rate,
                pitch: utterance.pitch
            });
            
            this.isPlaying = false;
            this.currentUtterance = null;
            
            // 오류 유형별 처리
            switch(error.error) {
                case 'network':
                    console.warn('⚠️ 네트워크 오류 - 인터넷 연결을 확인하세요.');
                    break;
                case 'not-allowed':
                    console.warn('⚠️ 브라우저에서 TTS 사용을 차단했습니다.');
                    break;
                case 'interrupted':
                    console.warn('⚠️ TTS 재생이 중단되었습니다.');
                    break;
                case 'synthesis-failed':
                    console.warn('⚠️ 음성 합성 실패 - 다시 시도해주세요.');
                    break;
                default:
                    console.warn(`⚠️ 알 수 없는 TTS 오류: ${error.error}`);
            }
        };
        
        // 사용자 상호작용 후 재생 (브라우저 자동재생 정책 대응)
        try {
            speechSynthesis.speak(utterance);
            
            console.log('🔊 TTS 실행:', {
                text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
                rate: utterance.rate.toFixed(2),
                pitch: utterance.pitch.toFixed(2),
                voice: utterance.voice?.name || 'default',
                lang: utterance.lang,
                voicePropsReceived: JSON.stringify(voiceProps)
            });
        } catch (synthError) {
            console.error('❌ speechSynthesis.speak() 오류:', synthError);
            this.isPlaying = false;
            this.currentUtterance = null;
        }
        
        return Promise.resolve();
    }
    
    // EntryJS read_text_wait_with_block 블록 구현
    readTextAndWait(text, voiceProps = {}) {
        if (!this.isSupported || !text) {
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            this.stop();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            utterance.lang = 'ko-KR';
            utterance.rate = this.convertSpeed(voiceProps.speed || 0);
            utterance.pitch = this.convertPitch(voiceProps.pitch || 0);
            utterance.volume = voiceProps.volume || 1;
            
            if (this.defaultVoice) {
                utterance.voice = this.defaultVoice;
            }
            
            this.currentUtterance = utterance;
            this.isPlaying = true;
            
            utterance.onend = () => {
                this.isPlaying = false;
                this.currentUtterance = null;
                resolve(); // 읽기 완료 후 다음 블록 실행
            };
            
            utterance.onerror = (error) => {
                console.error('TTS 오류:', error);
                this.isPlaying = false;
                this.currentUtterance = null;
                resolve(); // 오류 시에도 다음 블록 실행
            };
            
            speechSynthesis.speak(utterance);
            
            console.log('⏳ TTS 실행 및 대기:', text.substring(0, 20) + '...');
        });
    }
    
    // EntryJS 속도 값(-100~100)을 Web Speech API 속도(0.1~10)로 변환 (개선)
    convertSpeed(entrySpeed) {
        // EntryJS: -100(매우 느림) ~ 0(보통) ~ 100(매우 빠름)
        // Web Speech: 0.1(최소) ~ 1(보통) ~ 10(최대)
        
        const speed = Number(entrySpeed) || 0;
        const normalizedSpeed = Math.max(-100, Math.min(100, speed)) / 100; // -1 ~ 1
        
        if (normalizedSpeed >= 0) {
            // 빠른 쪽: 1 ~ 2.5 (너무 빠르면 알아듣기 어려움)
            const result = 1 + (normalizedSpeed * 1.5);
            console.log(`💨 속도 변환: EntryJS(${speed}) -> WebSpeech(${result.toFixed(2)})`);
            return result;
        } else {
            // 느린 쪽: 0.3 ~ 1 (너무 느리면 답답함)
            const result = 1 + (normalizedSpeed * 0.7);
            console.log(`🐌 속도 변환: EntryJS(${speed}) -> WebSpeech(${result.toFixed(2)})`);
            return result;
        }
    }
    
    // EntryJS 음높이 값(-100~100)을 Web Speech API 음높이(0~2)로 변환 (개선)
    convertPitch(entryPitch) {
        // EntryJS: -100(낮음) ~ 0(보통) ~ 100(높음)
        // Web Speech: 0(최소) ~ 1(보통) ~ 2(최대)
        
        const pitch = Number(entryPitch) || 0;
        const normalizedPitch = Math.max(-100, Math.min(100, pitch)) / 100; // -1 ~ 1
        const result = Math.max(0, Math.min(2, 1 + normalizedPitch)); // 0 ~ 2 사이로 제한
        
        console.log(`🎵 피치 변환: EntryJS(${pitch}) -> WebSpeech(${result.toFixed(2)})`);
        return result;
    }
    
    // 음성 선택 (개선된 로직 - EntryJS 실제 값 반영)
    selectVoice(speakerName) {
        if (!this.voices.length) {
            console.warn('⚠️ 사용 가능한 음성이 없습니다.');
            return this.defaultVoice;
        }
        
        console.log('🔍 음성 선택 시도:', speakerName);
        console.log('🎤 사용 가능한 음성 리스트:', this.voices.map(v => v.name));
        
        // EntryJS AI TTS 블록의 실제 speaker 값을 Web Speech API 음성으로 매핑
        const voiceMap = {
            // EntryJS 기본 음성
            'default': this.defaultVoice,
            'nmammon': this.defaultVoice,
            
            // EntryJS AI TTS 블록의 실제 음성 이름 (수정됨)
            'kyuri': this.voices.find(v => 
                v.lang.includes('ko') && (
                    v.name.includes('Heami') || 
                    v.name.includes('Female') ||
                    v.name.includes('여성')
                )
            ),
            'jinho': this.voices.find(v => 
                v.lang.includes('ko') && (
                    v.name.includes('Seunghyun') || 
                    v.name.includes('Male') ||
                    v.name.includes('남성')
                )
            ),
            'clara': this.voices.find(v => 
                v.lang.includes('en') && (
                    v.name.includes('Female') ||
                    v.name.includes('Clara')
                )
            ),
            'matt': this.voices.find(v => 
                v.lang.includes('en') && (
                    v.name.includes('Male') ||
                    v.name.includes('Matt')
                )
            ),
            
            // 한국어 대체 이름
            '여성': this.voices.find(v => 
                v.lang.includes('ko') && (
                    v.name.includes('Heami') || 
                    v.name.includes('Female') ||
                    v.name.includes('여성')
                )
            ) || this.defaultVoice, // fallback
            '남성': this.voices.find(v => 
                v.lang.includes('ko') && (
                    v.name.includes('Male') ||
                    v.name.includes('남성') ||
                    v.name.includes('Seunghyun')
                )
            ),
            
            // 영어 대체 이름
            'male': this.voices.find(v => 
                v.name.includes('Male') && !v.lang.includes('ko')
            ),
            'female': this.voices.find(v => 
                v.name.includes('Female') && !v.lang.includes('ko')
            )
        };
        
        // 1단계: 직접 매핑 확인
        const selectedVoice = voiceMap[speakerName];
        if (selectedVoice) {
            console.log(`✅ 음성 선택 성공: ${speakerName} -> ${selectedVoice.name}`);
            return selectedVoice;
        }
        
        // 2단계: 부분 매칭 시도 (강화)
        if (!selectedVoice) {
            // 한국어 음성 우선 처리
            if (speakerName === '남성' || speakerName === 'jinho') {
                // 남성 음성 찾기 (한국어 우선)
                const maleVoice = this.voices.find(v => 
                    v.lang.includes('ko') && v.name.toLowerCase().includes('male')
                ) || this.voices.find(v => 
                    v.name.toLowerCase().includes('male') && v.name.toLowerCase().includes('korean')
                ) || this.voices.find(v => 
                    v.name.includes('Seunghyun') || v.name.includes('Minho')
                );
                
                if (maleVoice) {
                    console.log(`✅ 남성 음성 부분 매칭: ${speakerName} -> ${maleVoice.name}`);
                    return maleVoice;
                }
            }
            
            // 일반 부분 매칭
            const partialMatch = this.voices.find(voice => 
                voice.name.toLowerCase().includes(speakerName.toLowerCase()) ||
                (voice.lang.includes('ko') && speakerName.includes('여성'))
            );
            
            if (partialMatch) {
                console.log(`✅ 부분 매칭 성공: ${speakerName} -> ${partialMatch.name}`);
                return partialMatch;
            }
        }
        
        // 3단계: 기본 음성 사용
        console.log(`⚠️ 매칭 실패, 기본 음성 사용: ${speakerName} -> ${this.defaultVoice?.name || 'System Default'}`);
        return this.defaultVoice;
    }
    
    // 음성 중지
    stop() {
        if (this.isPlaying) {
            speechSynthesis.cancel();
            this.isPlaying = false;
            this.currentUtterance = null;
        }
    }
    
    // 사용 가능한 음성 목록 반환
    getAvailableVoices() {
        return this.voices.filter(voice => 
            voice.lang.includes('ko') || voice.lang.includes('en')
        ).map(voice => ({
            name: voice.name,
            lang: voice.lang,
            isDefault: voice === this.defaultVoice
        }));
    }
    
    // 상태 확인
    getStatus() {
        return {
            supported: this.isSupported,
            playing: this.isPlaying,
            voicesCount: this.voices.length,
            defaultVoice: this.defaultVoice?.name,
            browserEngine: this.getBrowserEngine()
        };
    }
    
    getBrowserEngine() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Whale')) return 'Whale (Chromium)';
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Edg')) return 'Edge';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        return 'Unknown';
    }
    
    // app.mjs에서 호출할 수 있는 공개 메서드
    initializeEntryBlocks() {
        console.log('🔊 EntryJSWebSpeechTTS.initializeEntryBlocks() 호출');
        
        // Entry 객체 로드 대기
        if (!window.Entry || !Entry.block) {
            console.warn('⚠️ Entry 객체가 아직 로드되지 않음 - 500ms 후 재시도');
            setTimeout(() => this.initializeEntryBlocks(), 500);
            return;
        }
        
        // TTS 블록 교체 실행
        this.replaceTTSBlocks();
    }
    
    // TTS 블록 교체 메서드
    replaceTTSBlocks() {
        if (!window.Entry || !Entry.block) {
            console.warn('⚠️ Entry.block이 아직 로드되지 않음');
            return;
        }
        
        let replacedCount = 0;
        
        // EntryJS 오브젝트에 setVoiceProp, getVoiceProp 메서드 추가
        this.addVoicePropMethods();
        
        // read_text 블록 교체
        if (Entry.block.read_text) {
            Entry.block.read_text.func = (sprite, script) => {
                const text = script.getStringValue('TEXT', script);
                
                // 음성 속성 가져오기 (개선된 로직)
                let voiceProps = {
                    speaker: '여성',
                    speed: 0,
                    pitch: 0,
                    volume: 1
                };
                
                // sprite.getVoiceProp() 메서드 사용
                if (sprite && typeof sprite.getVoiceProp === 'function') {
                    try {
                        const props = sprite.getVoiceProp();
                        if (props && typeof props === 'object') {
                            Object.assign(voiceProps, props);
                            console.log('✅ sprite.getVoiceProp() 성공:', JSON.stringify(props));
                        }
                    } catch (error) {
                        console.warn('⚠️ getVoiceProp 오류:', error);
                    }
                } else {
                    console.log('⚠️ getVoiceProp 메서드가 없어 기본값 사용');
                }
                
                console.log('🔊 TTS 속성:', {
                    text: text.substring(0, 20) + '...',
                    voicePropsFound: JSON.stringify(voiceProps),
                    spriteId: sprite?.id || 'unknown',
                    spriteType: sprite?.constructor?.name || 'unknown'
                });
                
                this.readText(text, voiceProps);
                return script.callReturn();
            };
            replacedCount++;
            console.log('✅ read_text 블록 교체 완료');
        }
        
        // read_text_wait_with_block 블록 교체
        if (Entry.block.read_text_wait_with_block) {
            Entry.block.read_text_wait_with_block.func = async (sprite, script) => {
                const text = script.getStringValue('TEXT', script);
                
                // 음성 속성 가져오기 (개선된 로직)
                let voiceProps = {
                    speaker: '여성',
                    speed: 0,
                    pitch: 0,
                    volume: 1
                };
                
                // sprite.getVoiceProp() 메서드 사용
                if (sprite && typeof sprite.getVoiceProp === 'function') {
                    try {
                        const props = sprite.getVoiceProp();
                        if (props && typeof props === 'object') {
                            Object.assign(voiceProps, props);
                            console.log('✅ sprite.getVoiceProp() 성공 (대기):', JSON.stringify(props));
                        }
                    } catch (error) {
                        console.warn('⚠️ getVoiceProp 오류 (대기):', error);
                    }
                } else {
                    console.log('⚠️ getVoiceProp 메서드가 없어 기본값 사용 (대기)');
                }
                
                console.log('🔊 TTS 속성 (대기):', {
                    text: text.substring(0, 20) + '...',
                    voicePropsFound: JSON.stringify(voiceProps)
                });
                
                await this.readTextAndWait(text, voiceProps);
                return script.callReturn();
            };
            replacedCount++;
            console.log('✅ read_text_wait_with_block 블록 교체 완료');
        }
        
        console.log(`🎉 TTS 블록 교체 완료: ${replacedCount}개 블록`);
        
        return replacedCount;
    }
    
    // EntryJS 오브젝트에 setVoiceProp, getVoiceProp 메서드 추가
    addVoicePropMethods() {
        if (!window.Entry || !Entry.container) {
            console.warn('⚠️ Entry.container가 없어 메서드 추가 불가');
            return;
        }
        
        try {
            // 모든 오브젝트에 메서드 추가
            const allObjects = Entry.container.getAllObjects();
            
            allObjects.forEach(obj => {
                // setVoiceProp 메서드 추가
                if (!obj.setVoiceProp) {
                    obj.setVoiceProp = function(props) {
                        if (props && typeof props === 'object') {
                            this.speaker = props.speaker || this.speaker || '여성';
                            this.speed = props.speed !== undefined ? props.speed : (this.speed || 0);
                            this.pitch = props.pitch !== undefined ? props.pitch : (this.pitch || 0);
                            this.volume = props.volume !== undefined ? props.volume : (this.volume || 1);
                            
                            // 디버깅 로그
                            console.log(`✅ setVoiceProp 성공 (${this.name}):`, {
                                speaker: this.speaker,
                                speed: this.speed,
                                pitch: this.pitch,
                                volume: this.volume
                            });
                        }
                    };
                }
                
                // getVoiceProp 메서드 추가
                if (!obj.getVoiceProp) {
                    obj.getVoiceProp = function() {
                        const props = {
                            speaker: this.speaker || '여성',
                            speed: this.speed !== undefined ? this.speed : 0,
                            pitch: this.pitch !== undefined ? this.pitch : 0,
                            volume: this.volume !== undefined ? this.volume : 1
                        };
                        
                        // 디버깅 로그
                        console.log(`✅ getVoiceProp 성공 (${this.name}):`, props);
                        return props;
                    };
                }
            });
            
            console.log(`✅ ${allObjects.length}개 오브젝트에 VoiceProp 메서드 추가 완료`);
            
        } catch (error) {
            console.error('❌ VoiceProp 메서드 추가 실패:', error);
        }
    }
}

// 전역 TTS 인스턴스 생성
window.EntryJSWebSpeechTTS = new EntryJSWebSpeechTTS();

// EntryJS 이벤트 리스너 등록 (Entry 로드 후)
document.addEventListener('DOMContentLoaded', () => {
    // Entry가 로드될 때까지 대기
    const waitForEntry = setInterval(() => {
        if (window.Entry && Entry.addEventListener) {
            clearInterval(waitForEntry);
            
            // EntryJS 로드 완료 후 TTS 블록 교체
            Entry.addEventListener('entryLoaded', () => {
                console.log('🚀 EntryJS 로드 완료 - TTS 블록 교체 시작');
                replaceEntryTTSBlocks();
            });
            
            // 즉시 교체 시도 (이미 로드된 경우)
            setTimeout(() => {
                if (Entry.block) {
                    replaceEntryTTSBlocks();
                }
            }, 1000);
        }
    }, 100);
});

// EntryJS TTS 블록을 Web Speech API로 교체
function replaceEntryTTSBlocks() {
    if (!window.Entry || !Entry.block) {
        console.warn('Entry.block이 아직 로드되지 않았습니다.');
        setTimeout(replaceEntryTTSBlocks, 500); // 재시도
        return;
    }
    
    const tts = window.EntryJSWebSpeechTTS;
    let replacedCount = 0;
    
    // read_text 블록 교체
    if (Entry.block.read_text) {
        const originalFunc = Entry.block.read_text.func;
        Entry.block.read_text.func = function(sprite, script) {
            const text = script.getStringValue('TEXT', script);
            const voiceProps = sprite.getVoiceProp ? sprite.getVoiceProp() : {};
            
            tts.readText(text, voiceProps);
            return script.callReturn();
        };
        replacedCount++;
        console.log('✅ read_text 블록 교체 완료');
    }
    
    // read_text_wait_with_block 블록 교체
    if (Entry.block.read_text_wait_with_block) {
        Entry.block.read_text_wait_with_block.func = async function(sprite, script) {
            const text = script.getStringValue('TEXT', script);
            const voiceProps = sprite.getVoiceProp ? sprite.getVoiceProp() : {};
            
            await tts.readTextAndWait(text, voiceProps);
            return script.callReturn();
        };
        replacedCount++;
        console.log('✅ read_text_wait_with_block 블록 교체 완료');
    }
    
    // set_tts_property 블록은 원래 기능 유지 (sprite에 속성 저장)
    console.log(`✅ EntryJS TTS 블록 Web Speech API 교체 완료 (${replacedCount}개 블록)`);
    // 알림 제거 - 콘솔 로그만 유지
}

// 디버깅용 전역 함수
window.testEntryTTS = function(text = '안녕하세요, EntryJS Web Speech TTS 테스트입니다.') {
    const tts = window.EntryJSWebSpeechTTS;
    tts.readText(text, { speed: 0, pitch: 0, volume: 1 });
};

// TTS 속도/피치 테스트 함수
window.testTTSWithSettings = function(text = '속도와 음높이 테스트입니다.', speed = 0, pitch = 0, speaker = '여성') {
    console.log('🧪 TTS 속성 테스트:', { text, speed, pitch, speaker });
    
    const tts = window.EntryJSWebSpeechTTS;
    if (tts) {
        tts.readText(text, { 
            speed: speed, 
            pitch: pitch, 
            volume: 1,
            speaker: speaker
        });
    } else {
        console.error('❌ TTS 객체가 로드되지 않았습니다.');
    }
};

// EntryJS 음성 속성 디버깅 함수 (안전한 방법)
window.debugEntryVoiceProps = function() {
    console.log('🔍 EntryJS 음성 속성 디버깅 시작...');
    
    try {
        // 현재 오브젝트 가져오기
        const objects = Entry.container.getCurrentObjects();
        console.log('📋 현재 오브젝트 수:', objects.length);
        
        if (objects.length > 0) {
            const sprite = objects[0];
            console.log('🎨 첫 번째 오브젝트:', sprite);
            
            // 여러 방법으로 음성 속성 찾기
            const methods = [
                { name: 'getVoiceProp()', value: () => sprite.getVoiceProp?.() },
                { name: 'voiceProp', value: () => sprite.voiceProp },
                { name: 'voice', value: () => sprite.voice },
                { name: 'tts', value: () => sprite.tts },
                { name: 'sound', value: () => sprite.sound }
            ];
            
            methods.forEach(method => {
                try {
                    const result = method.value();
                    console.log(`✅ ${method.name}:`, result);
                } catch (error) {
                    console.log(`❌ ${method.name}: 오류 - ${error.message}`);
                }
            });
            
            // Entry 전역 음성 속성 확인
            console.log('🌐 Entry 전역 음성 속성:');
            console.log('Entry.playground.object:', Entry.playground?.object?.voiceProp);
            console.log('Entry.engine.project.voice:', Entry.engine?.project?.voice);
            
        } else {
            console.warn('⚠️ 오브젝트가 없습니다.');
        }
        
    } catch (error) {
        console.error('❌ 디버깅 오류:', error);
    }
};

// 빠른 TTS 테스트 (속성 무시)
window.quickTTSTest = function(text = '빠른 테스트') {
    if (window.EntryJSWebSpeechTTS) {
        window.EntryJSWebSpeechTTS.readText(text, {
            speaker: '여성',
            speed: 0,
            pitch: 0,
            volume: 1
        });
    }
};

window.getEntryTTSStatus = function() {
    return window.EntryJSWebSpeechTTS.getStatus();
};