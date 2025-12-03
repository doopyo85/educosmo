import { uploadFail, failAlert } from './index.mjs';
import { assets } from '../mock.mjs';

function addObjects(data) {
    const objects = data.selected;
    objects.forEach((sprite) => {
        const object = {
            id: Entry.generateHash(),
            objectType: 'sprite',
            sprite,
        };
        Entry.container.addObject(object, 0);
    });
}

function addEmptyObject() {
    const object = {
        id: Entry.generateHash(),
        objectType: 'sprite',
        sprite: {
            name: Lang.Workspace.new_object + (Entry.container.getAllObjects().length + 1),
            pictures: [
                {
                    dimension: {
                        width: 960,
                        height: 540,
                    },
                    fileurl: `${Entry.mediaFilePath}_1x1.png`,
                    thumbUrl: `${Entry.mediaFilePath}_1x1.png`,
                    name: Lang.Workspace.new_picture,
                    type: '_system_',
                },
            ],
            sounds: [],
            category: {
                main: 'new',
            },
        },
    };
    Entry.container.addObject(object, 0);
    Entry.playground.changeViewMode('picture');
}

function addTextObject(data) {
    let lineBreak = true;
    if (data.writeType === 'one') {
        lineBreak = false;
    }
    const text = data.text || Lang.Blocks.TEXT;
    const object = {
        id: Entry.generateHash(),
        name: text,
        text,
        options: {
            font: data.font,
            bold: false,
            underLine: false,
            italic: false,
            strike: data.effects.through || false,
            colour: data.effects.color || '#000000',
            background: data.effects.backgroundColor || '#ffffff',
            lineBreak,
            ...data.effects,
        },
        objectType: 'textBox',
        sprite: { sounds: [], pictures: [] },
    };
    Entry.container.addObject(object, 0);
}

function uploadObjects(data) {
    // 🔥 데이터 구조 확인 및 추출
    console.log('📥 uploadObjects 호출됨:', data);
    
    // 🔥 data.uploads 배열 추출
    const objects = data.uploads || data || [];
    console.log('📊 받은 객체 개수:', objects.length);
    
    if (!Array.isArray(objects) || objects.length === 0) {
        console.warn('⚠️ 업로드할 객체가 없습니다.');
        return;
    }
    
    objects.forEach((item, index) => {
        console.log(`🗃️ 객체 [${index}]:`, item);
        
        if (!item.id) {
            item.id = Entry.generateHash();
        }

        const object = {
            id: Entry.generateHash(),
            objectType: 'sprite',
            sprite: {
                name: item.name,
                pictures: [item],
                sounds: [],
                category: {},
            },
        };
        
        console.log(`➕ Entry에 추가:`, object);
        Entry.container.addObject(object, 0);
    });
    
    console.log('✅ uploadObjects 완료');
}

export function setSpritePopupEvent(popup) {
    popup.on('fetch', async (category) => {
        try {
            const { sidebar, subMenu } = category;
            console.log('🎭 스프라이트 페치 요청:', { sidebar, subMenu });
            
            // 리소스가 로드되었는지 확인
            if (!assets.sprite || assets.sprite.length === 0) {
                console.log('⏳ Entry 리소스 로드 대기 중...');
                await assets.loadResources();
            }
            
            // 로컬 데이터 사용
            let data = assets.sprite || [];
            
            // 카테고리 필터링
            if (sidebar && sidebar !== 'all') {
                data = data.filter(item => {
                    const mainCategory = item.category?.main;
                    const subCategory = item.category?.sub;
                    return mainCategory === sidebar || subCategory === sidebar;
                });
                console.log(`📂 카테고리 필터링 (${sidebar}):`, data.length);
            }
            
            console.log('✅ 스프라이트 데이터 로드:', data.length);
            popup.setData({ 
                data: { 
                    data: data,
                    imageBaseUrl: '/resources/uploads/'
                } 
            });
            
        } catch (error) {
            console.error('❌ 스프라이트 페치 오류:', error);
            // 오류 시 빈 배열 대신 기본 엔트리봇만이라도 표시
            const fallbackData = [{
                id: 'entrybot',
                name: '엔트리봇',
                label: { ko: '엔트리봇', en: 'Entrybot' },
                category: { main: 'entrybot_friends' },
                pictures: [{
                    name: '엔트리봇',
                    fileurl: '/images/entrybot1.png',
                    thumbUrl: '/images/entrybot1.png',
                    dimension: { width: 284, height: 350 }
                }],
                sounds: []
            }];
            popup.setData({ data: { data: fallbackData } });
        }
    });
    
    popup.on('search', async ({ searchQuery }) => {
        try {
            console.log('🔍 스프라이트 검색:', searchQuery);
            
            // 리소스 확인
            if (!assets.sprite || assets.sprite.length === 0) {
                await assets.loadResources();
            }
            
            // 로컬 데이터에서 검색
            let data = assets.sprite || [];
            
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                data = data.filter(item => {
                    const name = (item.name || '').toLowerCase();
                    const labelKo = (item.label?.ko || '').toLowerCase();
                    const labelEn = (item.label?.en || '').toLowerCase();
                    return name.includes(query) || labelKo.includes(query) || labelEn.includes(query);
                });
            }
            
            console.log(`🔍 검색 결과 (${searchQuery}):`, data.length);
            popup.setData({ 
                data: { 
                    data: data,
                    imageBaseUrl: '/resources/uploads/'
                } 
            });
            
        } catch (error) {
            console.error('❌ 스프라이트 검색 오류:', error);
            popup.setData({ data: { data: [] } });
        }
    });
    
    popup.on('dummyUploads', async ({ formData }) => {
        try {
            console.log('📤 스프라이트 업로드 시작');
            
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
                uploadFormData.append('image', file);
                
                // sessionID 추출 (현재 URL에서)
                const urlParams = new URLSearchParams(window.location.search);
                const sessionID = urlParams.get('sessionID') || Date.now().toString();
                
                console.log(`🚀 API 업로드: ${file.name}`);
                
                // 3000번 포트의 Entry 데이터 API 호출
                const response = await fetch(`/entry/data/upload-image?sessionID=${sessionID}`, {
                    method: 'POST',
                    body: uploadFormData,
                    credentials: 'include' // 쿠키 포함
                });
                
                console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    // 상세한 에러 정보 추출
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
                
                // 🔥 Entry 형식으로 변환 (정확한 구조)
                return {
                    id: Entry.generateHash(),
                    name: file.name.replace(/\.[^/.]+$/, ''), // 확장자 제거
                    filename: result.filename,
                    fileurl: result.fileurl,
                    thumbUrl: result.fileurl, // 🔥 썰네일 URL 추가
                    imageType: result.imageType || 'png',
                    dimension: result.dimension || { width: 80, height: 80 },
                    // 🔥 Entry가 필요로 하는 추가 필드
                    type: 'user',
                    mode: 'image'
                };
            });
            
            const uploads = await Promise.all(uploadPromises);
            console.log(`🎉 모든 업로드 완료: ${uploads.length}개`);
            console.log('📦 최종 데이터:', uploads);
            
            // Entry 팝업에 데이터 전달
            popup.setData({ data: { uploads: uploads, data: [] } });
            console.log('✅ popup.setData 호출 완료');
            
        } catch (error) {
            console.error('❌ 스프라이트 업로드 오류:', error);
            alert(`이미지 업로드에 실패했습니다: ${error.message}`);
            popup.setData({ data: { uploads: [], data: [] } });
        }
    });
    
    popup.on('submit', addObjects);
    popup.on('draw', addEmptyObject);
    popup.on('write', addTextObject);
    popup.on('uploads', uploadObjects);
    popup.on('uploadFail', uploadFail);
    popup.on('fail', failAlert);
    popup.on('error', failAlert);
}