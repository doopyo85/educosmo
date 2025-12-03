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
            const maxAttempts = 100; // 10초 타임아웃
            
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
        
        // Painter가 열릴 때까지 대기 후 오버라이드
        setupPainterOverride();
        
    }).catch(error => {
        console.error('❌ Custom Painter Save 초기화 실패:', error);
    });

    function setupPainterOverride() {
        // Entry.playground.painter 존재 확인
        const checkPainter = setInterval(() => {
            if (Entry.playground && Entry.playground.painter) {
                clearInterval(checkPainter);
                overridePainterSave();
                // 🔥 모양 가져오기 버튼 후킹 추가
                hookImportButton();
            }
        }, 500);
        
        // 30초 후 타임아웃
        setTimeout(() => clearInterval(checkPainter), 30000);
    }

    function overridePainterSave() {
        const painter = Entry.playground.painter;
        
        if (!painter) {
            console.warn('⚠️ Entry.playground.painter를 찾을 수 없습니다.');
            return;
        }
        
        console.log('🔧 Painter 객체 발견, 저장 함수 오버라이드 시작');
        
        // 원본 저장 함수 백업
        const originalSave = painter.save;
        const originalFileSave = painter.file?.save;
        
        /**
         * 🔥 커스텀 이미지 저장 함수
         */
        async function customSaveImage() {
            try {
                console.log('💾 커스텀 저장 함수 호출됨');
                
                // 🔥 편집 모드 확인 (edit vs new)
                const fileInfo = painter.file;
                const isEditMode = fileInfo && fileInfo.mode === 'edit';
                const editingPictureId = fileInfo?.id;
                
                console.log('📋 모드 확인:', { isEditMode, editingPictureId, fileInfo });
                
                // 1. Canvas에서 이미지 데이터 추출 (투명 배경 유지)
                let imageData = null;
                let width = 480;
                let height = 270;
                
                // 🔥 paint_canvas 먼저 찾기 (Entry Paint Editor 전용)
                const paintCanvas = document.getElementById('paint_canvas');
                if (paintCanvas) {
                    console.log('📝 paint_canvas 발견');
                    
                    // 🔥 투명 배경으로 이미지 추출 (트림 처리)
                    const trimmedData = extractTransparentImage(paintCanvas);
                    imageData = trimmedData.dataUrl;
                    width = trimmedData.width;
                    height = trimmedData.height;
                    
                    console.log('📐 트림된 이미지 크기:', width, 'x', height);
                }
                // Paper.js scope에서 캔버스 찾기
                else if (painter.paperScope && painter.paperScope.view) {
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
                
                // 3. sessionID 추출
                const urlParams = new URLSearchParams(window.location.search);
                const sessionID = urlParams.get('sessionID') || Date.now().toString();
                const userID = urlParams.get('userID') || window.EDUCODINGNPLAY_USER?.userID || 'anonymous';
                
                console.log('🚀 API 업로드 시작...', { userID, sessionID });
                
                // 4. API 호출 (S3 업로드)
                const response = await fetch(`/entry/data/upload-drawing?sessionID=${sessionID}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
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
                
                // 5. 현재 오브젝트 가져오기
                const currentObject = Entry.playground.object;
                if (!currentObject) {
                    throw new Error('현재 오브젝트를 찾을 수 없습니다.');
                }
                
                // 🔥 6. 편집 모드인 경우: 기존 모양 업데이트
                if (isEditMode && editingPictureId) {
                    console.log('✏️ 편집 모드: 기존 모양 업데이트');
                    
                    // 기존 모양 찾기
                    const existingPicture = currentObject.pictures?.find(p => p.id === editingPictureId);
                    
                    if (existingPicture) {
                        // 기존 모양 정보 업데이트
                        existingPicture.filename = result.filename;
                        existingPicture.fileurl = result.fileurl;
                        existingPicture.thumbUrl = result.thumbUrl || result.fileurl;
                        existingPicture.dimension = result.dimension || { width, height };
                        
                        console.log('✅ 기존 모양 업데이트됨:', existingPicture.name);
                        
                        // 모양 목록 새로고침
                        if (Entry.playground.injectPicture) {
                            Entry.playground.injectPicture();
                        }
                        
                        // 스테이지 업데이트
                        if (currentObject.entity) {
                            currentObject.entity.setImage(existingPicture);
                        }
                    } else {
                        console.warn('⚠️ 편집 중인 모양을 찾을 수 없음, 새 모양으로 추가');
                        addNewPicture(currentObject, result, width, height, fileInfo?.name);
                    }
                } else {
                    // 🔥 7. 새로 그리기 모드: 새 모양 추가
                    console.log('🆕 새로 그리기 모드: 새 모양 추가');
                    addNewPicture(currentObject, result, width, height);
                }
                
                // 8. Paint Editor 닫기
                if (Entry.playground.togglePainter) {
                    Entry.playground.togglePainter();
                }
                
                // 9. 뷰 새로고침
                if (Entry.stage && Entry.stage.update) {
                    Entry.stage.update();
                }
                
                console.log('🎉 그림 저장 완료!');
                
                // 성공 알림
                showPainterNotification('✅ 그림이 저장되었습니다!', 'success');
                
                return true;
                
            } catch (error) {
                console.error('❌ 그림 저장 실패:', error);
                showPainterNotification('❌ 저장 실패: ' + error.message, 'error');
                
                // 에러 발생 시 원래 함수 시도 (fallback)
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
                dimension: result.dimension || { width, height },
                type: '_new_'
            };
            
            console.log('🖼️ Picture 객체 생성:', picture);
            
            currentObject.addPicture(picture);
            console.log('✅ 오브젝트에 그림 추가됨');
            
            // 추가된 그림을 선택 상태로
            if (currentObject.selectPicture) {
                currentObject.selectPicture(picture.id);
            }
        }
        
        /**
         * 🔥 투명 배경 이미지 추출 (회색 배경 제거)
         */
        function extractTransparentImage(sourceCanvas) {
            const ctx = sourceCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
            const data = imageData.data;
            
            // 경계 박스 찾기 (투명하지 않은 픽셀의 범위)
            let minX = sourceCanvas.width;
            let minY = sourceCanvas.height;
            let maxX = 0;
            let maxY = 0;
            let hasContent = false;
            
            for (let y = 0; y < sourceCanvas.height; y++) {
                for (let x = 0; x < sourceCanvas.width; x++) {
                    const idx = (y * sourceCanvas.width + x) * 4;
                    const alpha = data[idx + 3];
                    
                    // 투명하지 않은 픽셀 (알파 > 0)
                    if (alpha > 0) {
                        hasContent = true;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            
            // 콘텐츠가 없으면 기본 크기 반환
            if (!hasContent) {
                console.log('⚠️ 캔버스에 그려진 내용이 없음');
                return {
                    dataUrl: sourceCanvas.toDataURL('image/png'),
                    width: sourceCanvas.width,
                    height: sourceCanvas.height
                };
            }
            
            // 여백 추가
            const padding = 10;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(sourceCanvas.width - 1, maxX + padding);
            maxY = Math.min(sourceCanvas.height - 1, maxY + padding);
            
            const trimWidth = maxX - minX + 1;
            const trimHeight = maxY - minY + 1;
            
            console.log('✂️ 트림 영역:', { minX, minY, maxX, maxY, trimWidth, trimHeight });
            
            // 새 캔버스에 트림된 영역만 복사 (투명 배경)
            const trimCanvas = document.createElement('canvas');
            trimCanvas.width = trimWidth;
            trimCanvas.height = trimHeight;
            const trimCtx = trimCanvas.getContext('2d');
            
            // 투명 배경 유지 (기본값)
            trimCtx.clearRect(0, 0, trimWidth, trimHeight);
            
            // 원본에서 트림된 영역만 복사
            trimCtx.drawImage(
                sourceCanvas,
                minX, minY, trimWidth, trimHeight,  // 소스 영역
                0, 0, trimWidth, trimHeight          // 대상 영역
            );
            
            return {
                dataUrl: trimCanvas.toDataURL('image/png'),
                width: trimWidth,
                height: trimHeight
            };
        }
        
        // painter.save 오버라이드
        painter.save = customSaveImage;
        console.log('✅ painter.save 오버라이드 완료');
        
        // painter.file.save도 오버라이드 (있는 경우)
        if (painter.file) {
            painter.file.save = customSaveImage;
            console.log('✅ painter.file.save 오버라이드 완료');
        }
        
        // 저장하기 버튼 이벤트 후킹
        hookSaveButton();
    }
    
    /**
     * 저장하기 버튼 이벤트 후킹
     */
    function hookSaveButton() {
        // DOM 변경 감지하여 저장 버튼 찾기
        const observer = new MutationObserver((mutations) => {
            const saveBtn = findSaveButton();
            if (saveBtn && !saveBtn._customHooked) {
                console.log('✅ 저장하기 버튼 발견, 이벤트 연결');
                
                // 기존 이벤트 제거하고 새 이벤트 연결
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
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 30초 후 옵저버 해제
        setTimeout(() => observer.disconnect(), 30000);
    }
    
    /**
     * 저장하기 버튼 찾기
     */
    function findSaveButton() {
        // 다양한 방법으로 저장 버튼 찾기
        const buttons = document.querySelectorAll('button');
        
        for (const btn of buttons) {
            const text = btn.textContent?.trim();
            if (text === '저장하기' || text === '저장' || text === 'Save') {
                // Paint Editor 내부의 버튼인지 확인
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
            animation: slideIn 0.3s ease;
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
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 🔥 모양 가져오기 버튼 후킹 (개선된 버전)
     */
    function hookImportButton() {
        console.log('🖼️ 모양 가져오기 버튼 후킹 시작');
        
        let buttonFound = false;
        let observerActive = true;
        let customButtonCreated = false;
        
        // DOM 변경 감지하여 모양 가져오기 버튼 찾기
        const observer = new MutationObserver((mutations) => {
            if (!observerActive) return;
            
            // 🔥 Paint Editor 컨테이너 찾기 (entryPlaygroundPainter 추가!)
            const painterContainer = document.querySelector(
                '.entryPlaygroundPainter, .entryPainterContainer, .entryPainter'
            );
            
            if (!painterContainer) return;
            
            // 이미 버튼을 찾았거나 커스텀 버튼을 만들었으면 스킵
            if (buttonFound || customButtonCreated) return;
            
            console.log('🎨 Paint Editor 컨테이너 발견:', painterContainer.className);
            
            // 모든 버튼 로깅 (한 번만)
            if (!window._painterButtonsLogged) {
                window._painterButtonsLogged = true;
                logAllButtons(painterContainer);
            }
            
            const importBtn = findImportButton(painterContainer);
            if (importBtn && !importBtn._importHooked) {
                console.log('✅ 모양 가져오기 버튼 발견:', importBtn.textContent?.trim());
                
                importBtn._importHooked = true;
                buttonFound = true;
                
                // 클릭 이벤트 추가
                importBtn.addEventListener('click', async (e) => {
                    console.log('🖱️ 모양 가져오기 버튼 클릭됨');
                    e.preventDefault();
                    e.stopPropagation();
                    openImageFileDialog();
                }, true);
                
            } else if (!buttonFound && !customButtonCreated) {
                // 버튼을 찾지 못했으면 커스텀 버튼 생성 시도
                customButtonCreated = tryCreateCustomImportButton(painterContainer);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
        
        // 60초 후 옵저버 해제
        setTimeout(() => {
            observerActive = false;
            observer.disconnect();
            console.log('⏱️ 모양 가져오기 버튼 옵저버 해제');
        }, 60000);
    }
    
    /**
     * Paint Editor 내 모든 버튼 로깅
     */
    function logAllButtons(container) {
        const allElements = container.querySelectorAll('button, [class*="btn"], [class*="Btn"], span, div');
        console.log('🔍 Paint Editor 내 요소들:');
        allElements.forEach((el, idx) => {
            const text = el.textContent?.trim();
            const className = el.className;
            const tagName = el.tagName;
            if ((text && text.length < 30) || className) {
                console.log(`  [${idx}] <${tagName}> text="${text?.substring(0,20)}" class="${className}"`);
            }
        });
    }
    
    /**
     * 커스텀 모양 가져오기 버튼 생성
     */
    function tryCreateCustomImportButton(container) {
        // 이미 생성되었는지 확인
        if (document.getElementById('customImportImageBtn')) {
            return true;
        }
        
        // 저장하기 버튼 옆에 추가하기 위해 저장 버튼 찾기
        const saveBtn = findSaveButton();
        
        if (saveBtn && saveBtn.parentNode) {
            console.log('🔧 저장 버튼 옆에 커스텀 이미지 가져오기 버튼 생성');
            
            const customBtn = document.createElement('button');
            customBtn.id = 'customImportImageBtn';
            customBtn.innerHTML = '📁 이미지 가져오기';
            customBtn.className = saveBtn.className; // 저장 버튼과 같은 스타일 적용
            customBtn.style.cssText = `
                margin-right: 8px;
            `;
            
            customBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ 커스텀 이미지 가져오기 버튼 클릭됨');
                openImageFileDialog();
            });
            
            // 저장 버튼 앞에 삽입
            saveBtn.parentNode.insertBefore(customBtn, saveBtn);
            console.log('✅ 커스텀 이미지 가져오기 버튼 생성 완료');
            return true;
        }
        
        console.log('⚠️ 저장 버튼을 찾을 수 없어 커스텀 버튼 생성 불가');
        return false;
    }
    
    /**
     * 모양 가져오기 버튼 찾기 (개선된 버전)
     */
    function findImportButton(container) {
        if (!container) return null;
        
        // Paint Editor 내의 모든 버튼 요소 찾기
        const allElements = container.querySelectorAll('button, div[role="button"], span, a, [class*="btn"], [class*="Btn"]');
        
        for (const btn of allElements) {
            const text = (btn.textContent?.trim() || '').toLowerCase();
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const className = (btn.className || '').toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            
            // "모양 가져오기", "가져오기", "Import", "파일", "열기" 등 다양한 키워드 검색
            const keywords = ['모양가져오기', '모양 가져오기', '가져오기', 'import', '파일 가져오기', '열기', 'open', 'load'];
            
            for (const keyword of keywords) {
                if (text.includes(keyword) || title.includes(keyword) || 
                    className.includes(keyword) || ariaLabel.includes(keyword)) {
                    console.log('🎯 후보 버튼 발견:', text, className);
                    return btn;
                }
            }
        }
        
        // 클래스명으로도 검색 (Entry 전용)
        const importByClass = container.querySelector('[class*="import"], [class*="Import"]');
        if (importByClass) {
            console.log('🎯 클래스로 버튼 발견:', importByClass.className);
            return importByClass;
        }
        
        return null;
    }
    
    /**
     * 🔥 이미지 파일 선택 다이얼로그 열기
     */
    function openImageFileDialog() {
        console.log('📂 파일 선택 다이얼로그 열기');
        
        // 기존 input 제거
        const existingInput = document.getElementById('painterImageFileInput');
        if (existingInput) {
            existingInput.remove();
        }
        
        // 파일 선택 input 생성
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'painterImageFileInput';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('📁 파일 선택됨:', file.name, file.type, file.size);
                await loadImageToPainter(file);
            }
            fileInput.remove();
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }
    
    /**
     * 🔥 이미지 파일을 페인트 에디터 캔버스에 로드
     */
    async function loadImageToPainter(file) {
        try {
            console.log('🖼️ 이미지를 캔버스에 로드 중...');
            
            const painter = Entry.playground.painter;
            if (!painter) {
                throw new Error('Paint Editor를 찾을 수 없습니다.');
            }
            
            console.log('🔍 Painter 객체 구조:', Object.keys(painter));
            
            // 파일을 Data URL로 읽기
            const dataUrl = await readFileAsDataURL(file);
            
            // Image 객체 생성
            const img = new Image();
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            
            console.log('📐 이미지 크기:', img.width, 'x', img.height);
            
            // 🔥 Entry Paint Editor의 paint_canvas 찾기 (가장 먼저 시도)
            const paintCanvas = document.getElementById('paint_canvas');
            
            if (paintCanvas) {
                console.log('📝 paint_canvas 발견, 이미지 로드 시작');
                
                const ctx = paintCanvas.getContext('2d');
                
                // 캔버스 크기
                const canvasWidth = paintCanvas.width;
                const canvasHeight = paintCanvas.height;
                
                console.log('📐 캔버스 크기:', canvasWidth, 'x', canvasHeight);
                
                // 이미지 스케일 조정 (캔버스의 80%에 맞춤)
                const scale = Math.min(
                    (canvasWidth * 0.8) / img.width,
                    (canvasHeight * 0.8) / img.height,
                    1 // 원본보다 크게 확대하지 않음
                );
                
                const newWidth = img.width * scale;
                const newHeight = img.height * scale;
                const x = (canvasWidth - newWidth) / 2;
                const y = (canvasHeight - newHeight) / 2;
                
                console.log('📐 그리기 위치:', { x, y, newWidth, newHeight, scale });
                
                // 이미지 그리기
                ctx.drawImage(img, x, y, newWidth, newHeight);
                
                console.log('✅ paint_canvas에 이미지 로드 완료');
                showPainterNotification('✅ 이미지를 불러왔습니다!', 'success');
                
                // Entry Paint의 내부 상태 업데이트 시도
                if (painter.file) {
                    painter.file.modified = true;
                    console.log('📝 파일 수정 상태 업데이트');
                }
                
            } else if (painter.paperScope) {
                console.log('📝 Paper.js 방식으로 이미지 로드');
                const paper = painter.paperScope;
                
                // 기존 선택 해제
                if (paper.project && paper.project.selectedItems) {
                    paper.project.selectedItems.forEach(item => item.selected = false);
                }
                
                // Raster 이미지 생성
                const raster = new paper.Raster(img);
                raster.position = paper.view.center;
                
                // 캔버스 크기에 맞게 스케일 조정
                const viewSize = paper.view.viewSize;
                const scale = Math.min(
                    (viewSize.width * 0.8) / img.width,
                    (viewSize.height * 0.8) / img.height,
                    1
                );
                raster.scale(scale);
                raster.selected = true;
                paper.view.update();
                
                console.log('✅ Paper.js 캔버스에 이미지 로드 완료');
                showPainterNotification('✅ 이미지를 불러왔습니다!', 'success');
                
            } else if (painter.canvas) {
                console.log('📝 Canvas API 방식으로 이미지 로드');
                const ctx = painter.canvas.getContext('2d');
                
                const canvasWidth = painter.canvas.width;
                const canvasHeight = painter.canvas.height;
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
                
                console.log('✅ Canvas에 이미지 로드 완료');
                showPainterNotification('✅ 이미지를 불러왔습니다!', 'success');
                
            } else {
                console.error('❌ 지원되는 캔버스 타입을 찾을 수 없습니다.');
                throw new Error('지원되는 캔버스 타입을 찾을 수 없습니다.');
            }
            
        } catch (error) {
            console.error('❌ 이미지 로드 실패:', error);
            showPainterNotification('❌ 이미지 로드 실패: ' + error.message, 'error');
        }
    }
    
    /**
     * 파일을 Data URL로 읽기
     */
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsDataURL(file);
        });
    }

})();
