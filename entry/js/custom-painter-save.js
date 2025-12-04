/**
 * 🎨 Entry Paint Editor 저장 함수 커스터마이징
 * Paint Editor의 저장하기 버튼을 S3 업로드 API와 연동
 * + 🔥 모양 가져오기 기능 추가
 */

(function() {
    console.log('🎨 Custom Painter Save 초기화 중...');

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
                hookImportButton();
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
        
        console.log('🔧 Painter 객체 발견, 저장 함수 오버라이드 시작');
        
        const originalSave = painter.save;

        /**
         * 🔥 커스텀 이미지 저장 함수
         */
        async function customSaveImage() {
            try {
                console.log('💾 커스텀 저장 함수 호출됨');
                
                const fileInfo = painter.file;
                const isEditMode = fileInfo && fileInfo.mode === 'edit';
                const editingPictureId = fileInfo?.id;
                
                console.log('📋 모드 확인:', { isEditMode, editingPictureId, fileInfo });
                
                let imageData = null;
                let width = 480;
                let height = 270;
                
                const paintCanvas = document.getElementById('paint_canvas');
                if (paintCanvas) {
                    console.log('📝 paint_canvas 발견');
                    const trimmedData = extractTransparentImage(paintCanvas);
                    imageData = trimmedData.dataUrl;
                    width = trimmedData.width;
                    height = trimmedData.height;
                    console.log('📐 트림된 이미지 크기:', width, 'x', height);
                } else if (painter.paperScope && painter.paperScope.view) {
                    const canvas = painter.paperScope.view.element;
                    const trimmedData = extractTransparentImage(canvas);
                    imageData = trimmedData.dataUrl;
                    width = trimmedData.width;
                    height = trimmedData.height;
                } else if (painter.canvas) {
                    const trimmedData = extractTransparentImage(painter.canvas);
                    imageData = trimmedData.dataUrl;
                    width = trimmedData.width;
                    height = trimmedData.height;
                } else if (painter.stage && painter.stage.toDataURL) {
                    imageData = painter.stage.toDataURL('image/png');
                    width = painter.stage.canvas?.width || 480;
                    height = painter.stage.canvas?.height || 270;
                }
                
                if (!imageData) {
                    throw new Error('Canvas에서 이미지를 추출할 수 없습니다.');
                }
                
                console.log('📸 Canvas에서 이미지 추출 완료, 길이:', imageData.length);
                
                const urlParams = new URLSearchParams(window.location.search);
                const sessionID = urlParams.get('sessionID') || Date.now().toString();
                
                console.log('🚀 API 업로드 시작...');
                
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
                    const errorText = await response.text();
                    throw new Error(`API 오류: ${response.status} - ${errorText}`);
                }
                
                const result = await response.json();
                console.log('✅ API 업로드 성공:', result);
                
                const currentObject = Entry.playground.object;
                if (!currentObject) {
                    throw new Error('현재 오브젝트를 찾을 수 없습니다.');
                }
                
                // 🔥 편집 모드 vs 새로 그리기 모드
                if (isEditMode && editingPictureId) {
                    console.log('✏️ 편집 모드: 기존 모양 업데이트');
                    
                    const existingPicture = currentObject.pictures?.find(p => p.id === editingPictureId);
                    
                    if (existingPicture) {
                        existingPicture.filename = result.filename;
                        existingPicture.fileurl = result.fileurl;
                        existingPicture.thumbUrl = result.thumbUrl || result.fileurl;
                        existingPicture.dimension = { width, height };
                        
                        console.log('✅ 기존 모양 업데이트됨:', existingPicture.name);
                        console.log('📐 업데이트된 크기:', width, 'x', height);
                        
                        if (Entry.playground.injectPicture) {
                            Entry.playground.injectPicture();
                        }
                        
                        // 🔥 Entity 크기 조정
                        if (currentObject.entity) {
                            const entity = currentObject.entity;
                            entity.setWidth(width);
                            entity.setHeight(height);
                            entity.setScaleX(1);
                            entity.setScaleY(1);
                            console.log('📐 Entity 크기 조정됨 (편집 모드):', { width, height });
                            entity.setImage(existingPicture);
                        }
                    } else {
                        console.warn('⚠️ 편집 중인 모양을 찾을 수 없음, 새 모양으로 추가');
                        addNewPicture(currentObject, result, width, height, fileInfo?.name);
                    }
                } else {
                    // 🔥 새로 그리기 모드
                    console.log('🆕 새로 그리기 모드: 새 모양 추가');
                    addNewPicture(currentObject, result, width, height);
                }
                
                // Paint Editor 닫기
                if (Entry.playground.togglePainter) {
                    Entry.playground.togglePainter();
                }
                
                if (Entry.stage && Entry.stage.update) {
                    Entry.stage.update();
                }
                
                console.log('🎉 그림 저장 완료!');
                showPainterNotification('✅ 그림이 저장되었습니다!', 'success');
                
                return true;
                
            } catch (error) {
                console.error('❌ 그림 저장 실패:', error);
                showPainterNotification('❌ 저장 실패: ' + error.message, 'error');
                
                if (originalSave) {
                    console.log('🔄 원래 저장 함수로 폴백 시도');
                    try {
                        return originalSave.call(painter);
                    } catch (fallbackError) {
                        console.error('원래 저장 함수도 실패:', fallbackError);
                    }
                }
                return false;
            }
        }
        
        /**
         * 🔥 새 모양 추가 헬퍼 함수
         */
        function addNewPicture(currentObject, result, width, height, name) {
            const picture = {
                id: Entry.generateHash(),
                name: name || `새그림_${Date.now()}`,
                filename: result.filename,
                fileurl: result.fileurl,
                thumbUrl: result.thumbUrl || result.fileurl,
                imageType: result.imageType || 'png',
                dimension: { width, height },
                type: '_new_'
            };
            
            console.log('🖼️ Picture 객체 생성:', picture);
            console.log('📐 원본 이미지 크기:', width, 'x', height);
            
            currentObject.addPicture(picture);
            console.log('✅ 오브젝트에 그림 추가됨');
            
            if (currentObject.selectPicture) {
                currentObject.selectPicture(picture.id);
            }
            
            // 🔥 Entity 크기 조정
            if (currentObject.entity) {
                const entity = currentObject.entity;
                entity.setWidth(width);
                entity.setHeight(height);
                entity.setScaleX(1);
                entity.setScaleY(1);
                console.log('📐 Entity 크기 조정됨:', { width, height });
                entity.setImage(picture);
            }
        }
        
        /**
         * 🔥 투명 배경 이미지 추출 (격자 배경 제거)
         */
        function extractTransparentImage(sourceCanvas) {
            const ctx = sourceCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
            const data = imageData.data;
            
            const isBackgroundPixel = (r, g, b, a) => {
                if (a < 10) return true;
                const isGray = Math.abs(r - g) < 5 && Math.abs(g - b) < 5;
                if (isGray) {
                    if ((r >= 225 && r <= 255) || (r >= 195 && r <= 215)) {
                        return true;
                    }
                }
                return false;
            };
            
            let minX = sourceCanvas.width;
            let minY = sourceCanvas.height;
            let maxX = 0;
            let maxY = 0;
            let hasContent = false;
            
            const newImageData = ctx.createImageData(sourceCanvas.width, sourceCanvas.height);
            const newData = newImageData.data;
            
            for (let y = 0; y < sourceCanvas.height; y++) {
                for (let x = 0; x < sourceCanvas.width; x++) {
                    const idx = (y * sourceCanvas.width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const a = data[idx + 3];
                    
                    if (isBackgroundPixel(r, g, b, a)) {
                        newData[idx] = 0;
                        newData[idx + 1] = 0;
                        newData[idx + 2] = 0;
                        newData[idx + 3] = 0;
                    } else {
                        newData[idx] = r;
                        newData[idx + 1] = g;
                        newData[idx + 2] = b;
                        newData[idx + 3] = a;
                        
                        hasContent = true;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            
            if (!hasContent) {
                console.log('⚠️ 캔버스에 그려진 내용이 없음');
                return {
                    dataUrl: sourceCanvas.toDataURL('image/png'),
                    width: sourceCanvas.width,
                    height: sourceCanvas.height
                };
            }
            
            const padding = 10;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(sourceCanvas.width - 1, maxX + padding);
            maxY = Math.min(sourceCanvas.height - 1, maxY + padding);
            
            const trimWidth = maxX - minX + 1;
            const trimHeight = maxY - minY + 1;
            
            console.log('✂️ 트림 영역:', { minX, minY, maxX, maxY, trimWidth, trimHeight });
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sourceCanvas.width;
            tempCanvas.height = sourceCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(newImageData, 0, 0);
            
            const trimCanvas = document.createElement('canvas');
            trimCanvas.width = trimWidth;
            trimCanvas.height = trimHeight;
            const trimCtx = trimCanvas.getContext('2d');
            trimCtx.clearRect(0, 0, trimWidth, trimHeight);
            trimCtx.drawImage(tempCanvas, minX, minY, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);
            
            return {
                dataUrl: trimCanvas.toDataURL('image/png'),
                width: trimWidth,
                height: trimHeight
            };
        }
        
        // painter.save 오버라이드
        painter.save = customSaveImage;
        console.log('✅ painter.save 오버라이드 완료');
        
        if (painter.file) {
            painter.file.save = customSaveImage;
            console.log('✅ painter.file.save 오버라이드 완료');
        }
        
        hookSaveButton();
    }
    
    /**
     * 저장하기 버튼 이벤트 후킹
     */
    function hookSaveButton() {
        const observer = new MutationObserver((mutations) => {
            const saveBtn = findSaveButton();
            if (saveBtn && !saveBtn._customHooked) {
                console.log('✅ 저장하기 버튼 발견, 이벤트 연결');
                
                const newBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newBtn, saveBtn);
                
                newBtn._customHooked = true;
                newBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ 저장하기 버튼 클릭됨');
                    
                    if (Entry.playground && Entry.playground.painter) {
                        await Entry.playground.painter.save();
                    }
                });
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 30000);
    }
    
    /**
     * 저장하기 버튼 찾기
     */
    function findSaveButton() {
        const buttons = document.querySelectorAll('button');
        
        for (const btn of buttons) {
            const text = btn.textContent?.trim();
            if (text === '저장하기' || text === '저장' || text === 'Save') {
                const isPainterBtn = btn.closest('.entryPlaygroundPainter') ||
                                    btn.closest('.entryPainterContainer') ||
                                    btn.closest('.entryPainter') ||
                                    btn.className.includes('paint') ||
                                    btn.className.includes('save');
                if (isPainterBtn || btn.className.includes('BaseCommonBtn')) {
                    return btn;
                }
            }
        }
        return null;
    }
    
    /**
     * 알림 메시지 표시
     */
    function showPainterNotification(message, type = 'info') {
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

    /**
     * 🔥 모양 가져오기 버튼 후킹
     */
    function hookImportButton() {
        console.log('🖼️ 모양 가져오기 버튼 후킹 시작');
        
        let buttonFound = false;
        let observerActive = true;
        
        const observer = new MutationObserver((mutations) => {
            if (!observerActive || buttonFound) return;
            
            const painterContainer = document.querySelector(
                '.entryPlaygroundPainter, .entryPainterContainer, .entryPainter'
            );
            
            if (!painterContainer) return;
            
            console.log('🎨 Paint Editor 컨테이너 발견:', painterContainer.className);
            
            const importBtn = findImportButton(painterContainer);
            if (importBtn && !importBtn._importHooked) {
                console.log('✅ 모양 가져오기 버튼 발견:', importBtn.textContent?.trim());
                
                importBtn._importHooked = true;
                buttonFound = true;
                
                importBtn.addEventListener('click', async (e) => {
                    console.log('🖱️ 모양 가져오기 버튼 클릭됨');
                    e.preventDefault();
                    e.stopPropagation();
                    openImageFileDialog();
                }, true);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        
        setTimeout(() => {
            observerActive = false;
            observer.disconnect();
            console.log('⏱️ 모양 가져오기 버튼 옵저버 해제');
        }, 60000);
    }
    
    /**
     * 모양 가져오기 버튼 찾기
     */
    function findImportButton(container) {
        if (!container) return null;
        
        const allElements = container.querySelectorAll('button, div[role="button"], span, a, [class*="btn"], [class*="Btn"]');
        
        for (const btn of allElements) {
            const text = (btn.textContent?.trim() || '').toLowerCase();
            const keywords = ['모양가져오기', '모양 가져오기', '가져오기', 'import'];
            
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    console.log('🎯 후보 버튼 발견:', text);
                    return btn;
                }
            }
        }
        return null;
    }
    
    /**
     * 이미지 파일 선택 다이얼로그 열기
     */
    function openImageFileDialog() {
        console.log('📂 파일 선택 다이얼로그 열기');
        
        const existingInput = document.getElementById('painterImageFileInput');
        if (existingInput) existingInput.remove();
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'painterImageFileInput';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('📁 파일 선택됨:', file.name);
                await loadImageToPainter(file);
            }
            fileInput.remove();
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }
    
    /**
     * 이미지 파일을 페인트 에디터 캔버스에 로드
     */
    async function loadImageToPainter(file) {
        try {
            const painter = Entry.playground.painter;
            if (!painter) throw new Error('Paint Editor를 찾을 수 없습니다.');
            
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('파일 읽기 실패'));
                reader.readAsDataURL(file);
            });
            
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            
            const paintCanvas = document.getElementById('paint_canvas');
            if (paintCanvas) {
                const ctx = paintCanvas.getContext('2d');
                const canvasWidth = paintCanvas.width;
                const canvasHeight = paintCanvas.height;
                
                const scale = Math.min(
                    (canvasWidth * 0.8) / img.width,
                    (canvasHeight * 0.8) / img.height,
                    1
                );
                
                const newWidth = img.width * scale;
                const newHeight = img.height * scale;
                const x = (canvasWidth - newWidth) / 2;
                const y = (canvasHeight - newHeight) / 2;
                
                ctx.drawImage(img, x, y, newWidth, newHeight);
                showPainterNotification('✅ 이미지를 불러왔습니다!', 'success');
                
                if (painter.file) painter.file.modified = true;
            }
        } catch (error) {
            console.error('❌ 이미지 로드 실패:', error);
            showPainterNotification('❌ 이미지 로드 실패: ' + error.message, 'error');
        }
    }

})();
