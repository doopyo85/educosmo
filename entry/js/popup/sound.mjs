import { uploadFail, failAlert } from './index.mjs';
import { fetchUploadWithBaseUrl } from '../util/index.mjs';
import { assets } from '../mock.mjs';

function addSounds(data) {
    const sounds = data.selected;
    sounds.forEach((item) => {
        item.id = Entry.generateHash();
        Entry.playground.addSound(item, true);
    });
    Entry.Utils.forceStopSounds();
}

function loadSound(items) {
    items.forEach((item) => {
        if (!Entry.soundQueue.getItem(item.id) && (item.path || item.fileurl)) {
            Entry.soundQueue.loadFile({
                id: item.id,
                src: item.fileurl || item.path,
                type: createjs.LoadQueue.SOUND,
            });
        }
    });
}

function stopAllSound() {
    Entry.Utils.forceStopSounds();
}

function stopSound(sound) {
    const { instance, callback } = sound;
    instance && instance.stop();
    callback({
        status: false,
    });
}

function soundLoadAndPlay(item) {
    const { id, callback } = item;
    if (!Entry.soundQueue.getItem(item.id)) {
        let playFunc;
        const soundPlay = () => {
            if (Entry.soundQueue.getResult(id)) {
                const instance = Entry.Utils.playSound(id);
                Entry.Utils.addSoundInstances(instance);
                callback({ instance, status: true });
                instance.on('complete', () => callback({ status: false }));
            }
            Entry.soundQueue.off('fileload', playFunc);
        };
        playFunc = Entry.soundQueue.on('fileload', soundPlay);
        Entry.soundQueue.loadFile({
            id: item.id,
            src: item.fileurl || item.path,
            type: createjs.LoadQueue.SOUND,
        });
    }
    return item;
}

function playSound(item) {
    const { id, callback } = item;
    if (id) {
        if (Entry.soundQueue.getResult(id)) {
            const instance = Entry.Utils.playSound(id);
            Entry.Utils.addSoundInstances(instance);
            callback({ instance, status: true });
            instance.on('complete', () => callback({ status: false }));
        } else {
            soundLoadAndPlay(item);
        }
    } else {
        console.log('no sound', id);
    }
}

function uploadSounds(data) {
    console.log('📥 uploadSounds 호출됨:', data);
    const sounds = data.uploads || data || [];
    
    if (!Array.isArray(sounds) || sounds.length === 0) {
        console.warn('⚠️ 업로드할 소리가 없습니다.');
        return;
    }
    
    sounds.forEach((item) => {
        item.id = Entry.generateHash();
        Entry.playground.addSound(item, true);
    });
    Entry.Utils.forceStopSounds();
    console.log('✅ uploadSounds 완료');
}

// 🔥 사운드 경로 생성 헬퍼 함수
function generateSoundPath(filename, ext) {
    if (!filename) return '';
    const folder = `${filename.substr(0,2)}/${filename.substr(2,2)}`;
    return `/resources/uploads/${folder}/sound/${filename}${ext}`;
}

export function setSoundPopupEvent(popup) {
    // 🔥 fetch 이벤트: 로컬 assets 사용
    popup.on('fetch', async (category) => {
        try {
            const { sidebar, subMenu } = category;
            console.log('🔊 사운드 페치 요청:', { sidebar, subMenu });
            
            // 리소스가 로드되었는지 확인
            if (!assets.sound || assets.sound.length === 0) {
                console.log('⏳ Entry 사운드 리소스 로드 대기 중...');
                await assets.loadResources();
            }
            
            // 로컬 데이터 사용
            let data = assets.sound || [];
            
            // 카테고리 필터링 (한글 카테고리명 사용)
            if (sidebar && sidebar !== 'all') {
                data = data.filter(item => {
                    const mainCategory = item.category?.main;
                    const subCategory = item.category?.sub;
                    return mainCategory === sidebar || subCategory === sidebar;
                });
                console.log(`📂 카테고리 필터링 (${sidebar}):`, data.length);
            }
            
            // 서브 카테고리 필터링
            if (subMenu && subMenu !== 'all') {
                data = data.filter(item => {
                    const subCategory = item.category?.sub;
                    return subCategory === subMenu;
                });
                console.log(`📂 서브 카테고리 필터링 (${subMenu}):`, data.length);
            }
            
            // 🔥 fileurl 보정 (없으면 생성)
            data = data.map(sound => ({
                ...sound,
                fileurl: sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3'),
                path: sound.path || sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3')
            }));
            
            console.log('✅ 사운드 데이터 로드:', data.length);
            popup.setData({ 
                data: { 
                    data: data.slice(0, 100) // 최대 100개
                } 
            });
            
        } catch (error) {
            console.error('❌ 사운드 페치 오류:', error);
            popup.setData({ data: { data: [] } });
        }
    });
    
    // 🔥 search 이벤트: 로컬 assets에서 검색
    popup.on('search', async ({ searchQuery }) => {
        try {
            console.log('🔍 사운드 검색:', searchQuery);
            
            // 리소스 확인
            if (!assets.sound || assets.sound.length === 0) {
                await assets.loadResources();
            }
            
            // 로컬 데이터에서 검색
            let data = assets.sound || [];
            
            if (searchQuery && searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                data = data.filter(item => {
                    const name = (item.name || '').toLowerCase();
                    const labelKo = (item.label?.ko || '').toLowerCase();
                    const labelEn = (item.label?.en || '').toLowerCase();
                    const category = (item.category?.main || '').toLowerCase();
                    const subCategory = (item.category?.sub || '').toLowerCase();
                    return name.includes(query) || 
                           labelKo.includes(query) || 
                           labelEn.includes(query) ||
                           category.includes(query) ||
                           subCategory.includes(query);
                });
            }
            
            // 🔥 fileurl 보정
            data = data.map(sound => ({
                ...sound,
                fileurl: sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3'),
                path: sound.path || sound.fileurl || generateSoundPath(sound.filename, sound.ext || '.mp3')
            }));
            
            console.log(`🔍 검색 결과 (${searchQuery}):`, data.length);
            popup.setData({ 
                data: { 
                    data: data.slice(0, 100)
                } 
            });
            
        } catch (error) {
            console.error('❌ 사운드 검색 오류:', error);
            popup.setData({ data: { data: [] } });
        }
    });
    
    // 🔥 dummyUploads 이벤트: 로컬 파일 업로드
    popup.on('dummyUploads', async ({ formData }) => {
        try {
            console.log('📤 사운드 업로드 시작');
            
            // FormData에서 파일 추출
            const files = [];
            for (let [key, value] of formData.entries()) {
                if (value instanceof File) {
                    files.push(value);
                    console.log(`📄 업로드 파일: ${value.name} (${value.size} bytes)`);
                }
            }
            
            if (files.length === 0) {
                console.warn('⚠️ 업로드할 파일이 없습니다.');
                popup.setData({ data: { uploads: [], data: [] } });
                return;
            }
            
            // 각 파일을 API로 업로드
            const uploadPromises = files.map(async (file) => {
                const uploadFormData = new FormData();
                uploadFormData.append('sound', file);
                
                // sessionID 추출
                const urlParams = new URLSearchParams(window.location.search);
                const sessionID = urlParams.get('sessionID') || Date.now().toString();
                
                console.log(`🚀 API 업로드: ${file.name}`);
                
                // 사운드 업로드 API 호출
                const response = await fetch(`/entry/data/upload-sound?sessionID=${sessionID}`, {
                    method: 'POST',
                    body: uploadFormData,
                    credentials: 'include'
                });
                
                console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        errorMessage += ` - ${errorData.error || JSON.stringify(errorData)}`;
                    } catch (e) {
                        const errorText = await response.text();
                        errorMessage += ` - ${errorText.substring(0, 200)}`;
                    }
                    console.error(`❌ 업로드 실패 상세:`, errorMessage);
                    throw new Error(errorMessage);
                }
                
                const result = await response.json();
                console.log(`✅ 업로드 성공:`, result);
                
                // Entry 형식으로 변환
                return {
                    id: Entry.generateHash(),
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    filename: result.filename,
                    fileurl: result.fileurl,
                    path: result.fileurl,
                    ext: result.ext || '.mp3',
                    duration: result.duration || 1,
                    type: 'user'
                };
            });
            
            const uploads = await Promise.all(uploadPromises);
            console.log(`🎉 모든 업로드 완료: ${uploads.length}개`);
            
            popup.setData({ data: { uploads: uploads, data: [] } });
            console.log('✅ popup.setData 호출 완료');
            
        } catch (error) {
            console.error('❌ 사운드 업로드 오류:', error);
            alert(`소리 업로드에 실패했습니다: ${error.message}`);
            popup.setData({ data: { uploads: [], data: [] } });
        }
    });
    
    popup.on('submit', addSounds);
    popup.on('loaded', loadSound);
    popup.on('load', loadSound);
    popup.on('hide', stopAllSound);
    popup.on('play', playSound);
    popup.on('stop', stopSound);
    popup.on('uploads', uploadSounds);
    popup.on('uploadFail', uploadFail);
    popup.on('fail', failAlert);
    popup.on('error', failAlert);
}
