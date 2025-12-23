/**
 * 🎨 Entry Paint Editor 저장 함수 커스터마이징
 * Paint Editor의 저장하기 버튼을 S3 업로드 API와 연동
 * 
 * 수정일: 2025-12-23 v4
 * - 🔥 핵심 변경: Entry 원본 save 로직을 활용하고 S3 URL만 교체
 * - Entry의 썸네일 업데이트 로직을 그대로 유지
 * - 저장 후 picture의 fileurl만 S3 URL로 변경
 */

(function() {
    console.log('🎨 Custom Painter Save v4 초기화 중...');

    // Entry가 로드될 때까지 대기
    function waitForEntry() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100;
            
            const check = () => {
                attempts++;
                if (window.Entry && Entry.playground) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Entry 로드 타임아웃'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    waitForEntry().then(() => {
        console.log('✅ Entry 로드 완료, Painter 저장 함수 오버라이드 시작');
        setupPainterOverride();
    }).catch(error => {
        console.error('❌ Custom Painter Save 초기화 실패:', error);
    });

    function setupPainterOverride() {
        const checkPainter = setInterval(() => {
            if (Entry.playground && Entry.playground.painter) {
                clearInterval(checkPainter);
                overridePainterSave();
            }
        }, 500);
        
        setTimeout(() => clearInterval(checkPainter), 30000);
    }

    function overridePainterSave() {
        const painter = Entry.playground.painter;
        
        if (!painter) {
            console.warn('⚠️ Entry.playground.painter를 찾을 수 없습니다.');
            return;
        }
        
        console.log('🔧 Painter 객체 발견');
        
        // 🔥 원본 save 함수 백업 (매우 중요!)
        const originalSave = painter.save ? painter.save.bind(painter) : null;
        
        console.log('📋 원본 save 함수 존재 여부:', !!originalSave);
        
        /**
         * 🔥 하이브리드 저장 함수: Entry 원본 + S3 업로드
         * 
         * 전략:
         * 1. Entry 원본 save 함수 호출 (썸네일 업데이트 등 모든 내부 로직 수행)
         * 2. 저장된 picture의 이미지 URL을 S3 URL로 교체
         */
        async function hybridSaveImage() {
            try {
                console.log('💾 ========== 하이브리드 저장 시작 ==========');
                
                const currentObject = Entry.playground.object;
                if (!currentObject) {
                    throw new Error('현재 오브젝트를 찾을 수 없습니다.');
                }
                
                // 저장 전 picture 목록 기록
                const picturesBefore = currentObject.pictures ? 
                    currentObject.pictures.map(p => p.id) : [];
                
                console.log('📋 저장 전 pictures:', picturesBefore.length);
                
                // 🔥 1단계: Entry 원본 save 함수 호출
                // 이렇게 하면 Entry의 모든 내부 로직(썸네일, UI 등)이 정상 작동
                if (originalSave) {
                    console.log('📌 Entry 원본 save 함수 호출...');
                    await originalSave();
                    console.log('✅ Entry 원본 save 완료');
                } else {
                    console.warn('⚠️ 원본 save 함수가 없음, 대체 로직 실행');
                    await fallbackSave();
                    return;
                }
                
                // 🔥 2단계: 새로 추가된 picture 찾기
                await new Promise(resolve => setTimeout(resolve, 200)); // Entry 처리 대기
                
                const picturesAfter = currentObject.pictures || [];
                let newPicture = null;
                
                // 새로 추가된 picture 또는 수정된 picture 찾기
                for (const pic of picturesAfter) {
                    if (!picturesBefore.includes(pic.id)) {
                        newPicture = pic;
                        console.log('🆕 새로 추가된 picture 발견:', pic.id);
                        break;
                    }
                }
                
                // 편집 모드인 경우 현재 선택된 picture
                if (!newPicture && painter.file?.id) {
                    newPicture = picturesAfter.find(p => p.id === painter.file.id);
                    console.log('✏️ 편집된 picture:', newPicture?.id);
                }
                
                // 마지막 picture (새로 그리기의 경우)
                if (!newPicture && picturesAfter.length > 0) {
                    newPicture = picturesAfter[picturesAfter.length - 1];
                    console.log('📌 마지막 picture 사용:', newPicture?.id);
                }
                
                if (!newPicture) {
                    console.warn('⚠️ 저장된 picture를 찾을 수 없음');
                    return true;
                }
                
                // 🔥 3단계: picture의 이미지를 S3에 업로드하고 URL 교체
                const imageUrl = newPicture.fileurl || newPicture.filename;
                
                if (imageUrl) {
                    console.log('📤 S3 업로드 시작, 원본 URL:', imageUrl);
                    
                    // 이미지 데이터 가져오기
                    const imageData = await fetchImageAsDataUrl(imageUrl);
                    
                    if (imageData) {
                        // S3 업로드
                        const urlParams = new URLSearchParams(window.location.search);
                        const sessionID = urlParams.get('sessionID') || Date.now().toString();
                        
                        const response = await fetch(`/entry/data/upload-drawing?sessionID=${sessionID}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imageData: imageData,
                                fileName: `drawing_${Date.now()}.png`
                            }),
                            credentials: 'include'
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            console.log('✅ S3 업로드 성공:', result.fileurl);
                            
                            // 🔥 picture URL 교체
                            newPicture.filename = result.filename;
                            newPicture.fileurl = result.fileurl;
                            newPicture.thumbUrl = result.thumbUrl || result.fileurl;
                            
                            // Entity 이미지도 업데이트
                            if (currentObject.entity) {
                                currentObject.entity.setImage(newPicture);
                            }
                            
                            console.log('✅ Picture URL S3로 교체 완료');
                        } else {
                            console.error('❌ S3 업로드 실패:', response.status);
                        }
                    }
                }
                
                console.log('🎉 하이브리드 저장 완료!');
                showNotification('✅ 그림이 저장되었습니다!', 'success');
                
                return true;
                
            } catch (error) {
                console.error('❌ 하이브리드 저장 실패:', error);
                showNotification('❌ 저장 실패: ' + error.message, 'error');
                return false;
            }
        }
        
        /**
         * 이미지 URL을 Data URL로 변환
         */
        async function fetchImageAsDataUrl(url) {
            try {
                // Blob URL 또는 Data URL인 경우
                if (url.startsWith('blob:') || url.startsWith('data:')) {
                    if (url.startsWith('data:')) {
                        return url;
                    }
                    
                    // Blob URL을 Data URL로 변환
                    const response = await fetch(url);
                    const blob = await response.blob();
                    
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                }
                
                // 일반 URL인 경우
                const response = await fetch(url);
                const blob = await response.blob();
                
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                
            } catch (e) {
                console.error('❌ 이미지 로드 실패:', e);
                return null;
            }
        }
        
        /**
         * 원본 save가 없을 때 대체 로직 (기존 코드 유지)
         */
        async function fallbackSave() {
            console.log('⚠️ Fallback 저장 로직 실행...');
            
            const currentObject = Entry.playground.object;
            if (!currentObject) {
                throw new Error('현재 오브젝트를 찾을 수 없습니다.');
            }
            
            // 캔버스에서 이미지 추출
            const paintCanvas = document.getElementById('paint_canvas') || 
                               painter.paperScope?.view?.element;
            
            if (!paintCanvas) {
                throw new Error('캔버스를 찾을 수 없습니다.');
            }
            
            const imageData = paintCanvas.toDataURL('image/png');
            
            // S3 업로드
            const urlParams = new URLSearchParams(window.location.search);
            const sessionID = urlParams.get('sessionID') || Date.now().toString();
            
            const response = await fetch(`/entry/data/upload-drawing?sessionID=${sessionID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageData: imageData,
                    fileName: `drawing_${Date.now()}.png`
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`API 오류: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Picture 생성
            const picture = {
                id: Entry.generateHash(),
                name: `새그림_${Date.now()}`,
                filename: result.filename,
                fileurl: result.fileurl,
                thumbUrl: result.thumbUrl || result.fileurl,
                imageType: 'png',
                dimension: { 
                    width: paintCanvas.width, 
                    height: paintCanvas.height 
                }
            };
            
            currentObject.addPicture(picture);
            currentObject.selectPicture(picture.id);
            
            // UI 갱신
            if (Entry.playground.injectPicture) {
                Entry.playground.injectPicture();
            }
            if (Entry.playground.selectPicture) {
                Entry.playground.selectPicture(picture);
            }
            
            // modified 플래그 해제
            if (painter.file) {
                painter.file.modified = false;
            }
            
            // Paint Editor 닫기
            if (Entry.playground.togglePainter) {
                Entry.playground.togglePainter();
            }
            
            showNotification('✅ 그림이 저장되었습니다!', 'success');
        }
        
        // 🔥 save 함수 오버라이드 (원본 호출 포함)
        painter.save = hybridSaveImage;
        console.log('✅ painter.save 오버라이드 (하이브리드 모드)');
        
        // 저장 버튼 후킹
        hookSaveButton(hybridSaveImage);
    }
    
    /**
     * 저장하기 버튼 후킹
     */
    function hookSaveButton(saveFunction) {
        const observer = new MutationObserver(() => {
            const buttons = document.querySelectorAll('button');
            
            for (const btn of buttons) {
                const text = btn.textContent?.trim();
                if ((text === '저장하기' || text === '저장') && !btn._customHooked) {
                    const isPainterBtn = btn.closest('.entryPlaygroundPainter, .entryPainter, .painterContainer, [class*="painter"]');
                    
                    if (isPainterBtn) {
                        console.log('✅ 저장 버튼 후킹:', text);
                        
                        btn._customHooked = true;
                        
                        // 기존 이벤트 리스너 제거를 위해 clone
                        const newBtn = btn.cloneNode(true);
                        newBtn._customHooked = true;
                        btn.parentNode?.replaceChild(newBtn, btn);
                        
                        newBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            
                            console.log('🖱️ 저장 버튼 클릭');
                            await saveFunction();
                            
                            return false;
                        }, true);
                    }
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 30000);
    }
    
    /**
     * 알림 표시
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 100000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: opacity 0.3s;
        `;
        
        notification.style.backgroundColor = 
            type === 'success' ? '#28a745' : 
            type === 'error' ? '#dc3545' : '#17a2b8';
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

})();
