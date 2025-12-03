import { uploadFail, failAlert } from './index.mjs';
import { fetchUploadWithBaseUrl, fetchWithBaseUrl } from '../util/index.mjs';
import { assets } from '../mock.mjs';

/**
 * 🔥 선택된 그림들을 현재 오브젝트의 모양으로 추가
 * (신규 오브젝트가 아닌, 선택된 오브젝트에 모양 추가)
 */
function addPictures(data) {
    console.log('📸 addPictures 호출됨:', data);
    
    const pictures = data?.selected || [];
    
    // 🔥 빈 배열이면 무시
    if (!pictures || pictures.length === 0) {
        console.log('⚠️ 선택된 그림이 없습니다. 무시합니다.');
        return;
    }
    
    console.log('📸 모양 추가하기:', pictures.length, '개');
    
    pictures.forEach((picture) => {
        // Entry 형식으로 정규화
        const normalizedPicture = {
            id: picture.id || Entry.generateHash(),
            name: picture.name || picture.label?.ko || '새 모양',
            filename: picture.filename,
            fileurl: picture.fileurl,
            thumbUrl: picture.thumbUrl || picture.fileurl,
            imageType: picture.imageType || 'png',
            dimension: picture.dimension || { width: 100, height: 100 }
        };
        
        console.log('➕ 추가할 모양:', normalizedPicture);
        
        // 🔥 현재 선택된 오브젝트에 그림 추가
        Entry.playground.addPicture(normalizedPicture, true);
    });
    
    console.log('✅ 모양 추가 완료');
}

function addEmptyPicture() {
    const item = {
        id: Entry.generateHash(),
        dimension: {
            height: 1,
            width: 1,
        },
        fileurl: `${Entry.mediaFilePath}_1x1.png`,
        thumbUrl: `${Entry.mediaFilePath}_1x1.png`,
        name: Lang.Workspace.new_picture,
    };
    Entry.playground.addPicture(item, true);
}

function uploadPictures(data) {
    const pictures = data.uploads;
    pictures.forEach((picture) => {
        picture.id = Entry.generateHash();
        Entry.playground.addPicture(picture, true);
    });
}

export function setPicturePopupEvent(popup) {
    // 🔥 fetch 이벤트: 로컬 sprites 데이터에서 그림 가져오기
    popup.on('fetch', async (category) => {
        try {
            const { sidebar, subMenu } = category;
            console.log('🖼️ 그림 페치 요청:', { sidebar, subMenu });
            
            // 리소스가 로드되었는지 확인
            if (!assets.sprite || assets.sprite.length === 0) {
                console.log('⏳ Entry 리소스 로드 대기 중...');
                await assets.loadResources();
            }
            
            // sprites에서 pictures 추출
            let allPictures = [];
            assets.sprite.forEach(sprite => {
                if (sprite.pictures && Array.isArray(sprite.pictures)) {
                    sprite.pictures.forEach(pic => {
                        allPictures.push({
                            ...pic,
                            id: pic.id || Entry.generateHash(),
                            name: pic.name || sprite.name,
                            category: sprite.category
                        });
                    });
                }
            });
            
            // 카테고리 필터링
            if (sidebar && sidebar !== 'all') {
                allPictures = allPictures.filter(pic => {
                    return pic.category?.main === sidebar;
                });
            }
            
            console.log(`✅ 그림 데이터 로드: ${allPictures.length}개`);
            popup.setData({ 
                data: { 
                    data: allPictures.slice(0, 100),
                    imageBaseUrl: '/resources/uploads/'
                } 
            });
            
        } catch (error) {
            console.error('❌ 그림 페치 오류:', error);
            popup.setData({ data: { data: [] } });
        }
    });
    
    // 🔥 search 이벤트: 로컬 데이터에서 검색
    popup.on('search', async ({ searchQuery }) => {
        try {
            console.log('🔍 그림 검색:', searchQuery);
            
            if (!assets.sprite || assets.sprite.length === 0) {
                await assets.loadResources();
            }
            
            // sprites에서 pictures 추출 및 검색
            let allPictures = [];
            assets.sprite.forEach(sprite => {
                if (sprite.pictures && Array.isArray(sprite.pictures)) {
                    sprite.pictures.forEach(pic => {
                        allPictures.push({
                            ...pic,
                            id: pic.id || Entry.generateHash(),
                            name: pic.name || sprite.name,
                            category: sprite.category,
                            spriteName: sprite.name,
                            spriteLabel: sprite.label
                        });
                    });
                }
            });
            
            // 검색어 필터링
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                allPictures = allPictures.filter(pic => {
                    const name = (pic.name || '').toLowerCase();
                    const spriteName = (pic.spriteName || '').toLowerCase();
                    const labelKo = (pic.spriteLabel?.ko || '').toLowerCase();
                    return name.includes(query) || spriteName.includes(query) || labelKo.includes(query);
                });
            }
            
            console.log(`🔍 검색 결과: ${allPictures.length}개`);
            popup.setData({ 
                data: { 
                    data: allPictures.slice(0, 100),
                    imageBaseUrl: '/resources/uploads/'
                } 
            });
            
        } catch (error) {
            console.error('❌ 그림 검색 오류:', error);
            popup.setData({ data: { data: [] } });
        }
    });
    popup.on('dummyUploads', async ({ formData }) => {
        try {
            console.log('📤 그림 업로드 시작');
            
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
                
                // sessionID 추출
                const urlParams = new URLSearchParams(window.location.search);
                const sessionID = urlParams.get('sessionID') || Date.now().toString();
                
                console.log(`🚀 API 업로드: ${file.name}`);
                
                const response = await fetch(`/entry/data/upload-image?sessionID=${sessionID}`, {
                    method: 'POST',
                    body: uploadFormData,
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`업로드 실패: ${response.statusText}`);
                }
                
                const result = await response.json();
                console.log(`✅ 업로드 성공:`, result);
                
                // 🔥 Entry 형식으로 변환
                return {
                    id: Entry.generateHash(),
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    filename: result.filename,
                    fileurl: result.fileurl,
                    thumbUrl: result.fileurl, // 🔥 썰네일 URL 추가
                    imageType: result.imageType || 'png',
                    dimension: result.dimension || { width: 80, height: 80 },
                    type: 'user',
                    mode: 'image'
                };
            });
            
            const uploads = await Promise.all(uploadPromises);
            console.log(`🎉 모든 업로드 완료: ${uploads.length}개`);
            
            popup.setData({ data: { uploads: uploads, data: [] } });
            
        } catch (error) {
            console.error('❌ 그림 업로드 오류:', error);
            alert(`이미지 업로드에 실패했습니다: ${error.message}`);
            popup.setData({ data: { uploads: [], data: [] } });
        }
    });
    popup.on('submit', addPictures);
    popup.on('draw', addEmptyPicture);
    popup.on('uploads', uploadPictures);
    popup.on('uploadFail', uploadFail);
    popup.on('fail', failAlert);
    popup.on('error', failAlert);
}
