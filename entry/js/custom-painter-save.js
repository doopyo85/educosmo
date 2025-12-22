/**
 * 🎨 Entry Paint Editor 저장 함수 커스터마이징
 * Paint Editor의 저장하기 버튼을 S3 업로드 API와 연동
 * 
 * 수정일: 2025-12-22 v2
 * - 🔥 Paper.js bounds 기반 정확한 트림
 * - 스케일 로직 단순화 (항상 1로 설정)
 * - 모든 저장 경로 통일
 * - 투명 배경 유지
 */

(function() {
    console.log('🎨 Custom Painter Save 초기화 중...');

    // 저장 함수 참조 (전역)
    let customSaveFunction = null;
    
    // 원본 저장 함수 백업
    let originalEntrySave = null;

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
                hookConfirmDialog();
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
        
        console.log('🔧 Painter 객체 발견, 구조 분석');
        console.log('📋 Painter 속성들:', Object.keys(painter));
        
        // 원본 save 백업
        originalEntrySave = painter.save;

        /**
         * 🔥 캔버스 빈 영역 클릭으로 선택 해제
         */
        function clickCanvasToDeselect(painter) {
            return new Promise((resolve) => {
                try {
                    console.log('🔓 캔버스 클릭으로 선택 해제 시작...');
                    
                    // 캔버스 찾기
                    const canvas = document.getElementById('paint_canvas') || 
                                   painter.paperScope?.view?.element;
                    
                    if (canvas) {
                        const rect = canvas.getBoundingClientRect();
                        const clickX = rect.left + 5;
                        const clickY = rect.top + 5;
                        
                        const mousedownEvent = new MouseEvent('mousedown', {
                            bubbles: true, cancelable: true, view: window,
                            clientX: clickX, clientY: clickY, button: 0
                        });
                        const mouseupEvent = new MouseEvent('mouseup', {
                            bubbles: true, cancelable: true, view: window,
                            clientX: clickX, clientY: clickY, button: 0
                        });
                        
                        canvas.dispatchEvent(mousedownEvent);
                        canvas.dispatchEvent(mouseupEvent);
                        console.log('  ✓ 캔버스 클릭 이벤트 발생');
                    }
                    
                    // Paper.js 선택 해제
                    if (painter.paperScope && painter.paperScope.project) {
                        const project = painter.paperScope.project;
                        if (project.deselectAll) project.deselectAll();
                        if (project.selectedItems && project.selectedItems.length > 0) {
                            while (project.selectedItems.length > 0) {
                                project.selectedItems[0].selected = false;
                            }
                        }
                        if (painter.paperScope.view) painter.paperScope.view.update();
                    }
                    
                    if (painter.selectNone) painter.selectNone();
                    if (painter.clearSelection) painter.clearSelection();
                    
                    console.log('✅ 선택 해제 완료');
                    setTimeout(resolve, 150);
                    
                } catch (e) {
                    console.warn('⚠️ 선택 해제 중 오류:', e);
                    setTimeout(resolve, 150);
                }
            });
        }

        /**
         * 🔥 커스텀 이미지 저장 함수 (핵심)
         */
        async function customSaveImage() {
            try {
                console.log('💾 ========== 커스텀 저장 함수 시작 ==========');
                
                const fileInfo = painter.file;
                const isEditMode = fileInfo && fileInfo.mode === 'edit';
                const editingPictureId = fileInfo?.id;
                
                console.log('📋 모드:', { isEditMode, editingPictureId, fileInfo });
                
                const currentObject = Entry.playground.object;
                if (!currentObject) {
                    throw new Error('현재 오브젝트를 찾을 수 없습니다.');
                }
                
                // 🔥 저장 전 캔버스 클릭으로 선택 해제
                await clickCanvasToDeselect(painter);
                
                // 🔥 이미지 추출 (Paper.js bounds 기반)
                const extractResult = await extractPaperImage(painter);
                
                if (!extractResult || !extractResult.dataUrl) {
                    throw new Error('이미지를 추출할 수 없습니다.');
                }
                
                const imageData = extractResult.dataUrl;
                const newWidth = extractResult.width;
                const newHeight = extractResult.height;
                
                console.log('📐 추출된 이미지 크기:', newWidth, 'x', newHeight);
                console.log('📸 이미지 추출 완료, 길이:', imageData.length);
                
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
                console.log('✅ 업로드 성공:', result);
                
                // Picture 객체 생성/업데이트
                if (isEditMode && editingPictureId) {
                    console.log('✏️ 편집 모드 - 기존 모양 업데이트');
                    const existingPicture = currentObject.pictures?.find(p => p.id === editingPictureId);
                    
                    if (existingPicture) {
                        existingPicture.filename = result.filename;
                        existingPicture.fileurl = result.fileurl;
                        existingPicture.thumbUrl = result.thumbUrl || result.fileurl;
                        existingPicture.dimension = { width: newWidth, height: newHeight };
                        
                        if (Entry.playground.injectPicture) {
                            Entry.playground.injectPicture();
                        }
                        
                        applyImageToEntity(currentObject, existingPicture, newWidth, newHeight);
                    } else {
                        createNewPicture(currentObject, result, newWidth, newHeight, fileInfo?.name);
                    }
                } else {
                    console.log('🆕 새로 그리기 모드');
                    createNewPicture(currentObject, result, newWidth, newHeight, null);
                }
                
                // modified 플래그 해제
                if (painter.file) {
                    painter.file.modified = false;
                }
                
                // Paint Editor 닫기
                if (Entry.playground.togglePainter) {
                    Entry.playground.togglePainter();
                }
                
                if (Entry.stage && Entry.stage.update) {
                    Entry.stage.update();
                }
                
                console.log('🎉 저장 완료!');
                showNotification('✅ 그림이 저장되었습니다!', 'success');
                
                return true;
                
            } catch (error) {
                console.error('❌ 저장 실패:', error);
                showNotification('❌ 저장 실패: ' + error.message, 'error');
                return false;
            }
        }
        
        // 전역 참조 저장
        customSaveFunction = customSaveImage;
        
        /**
         * 🔥 Paper.js에서 그림 추출 (bounds 기반 정확한 트림)
         */
        async function extractPaperImage(painter) {
            console.log('🖼️ ========== 이미지 추출 시작 ==========');
            
            // 방법 1: Paper.js bounds 사용 (가장 정확)
            if (painter.paperScope && painter.paperScope.project) {
                const result = extractUsingPaperBounds(painter);
                if (result) {
                    console.log('✅ Paper.js bounds 방식으로 추출 성공');
                    return result;
                }
            }
            
            // 방법 2: 캔버스 직접 스캔 (백업)
            const paintCanvas = document.getElementById('paint_canvas') || 
                               painter.paperScope?.view?.element ||
                               painter.canvas;
            
            if (paintCanvas) {
                console.log('📋 캔버스 직접 스캔 방식 사용');
                return extractByPixelScan(paintCanvas);
            }
            
            console.error('❌ 이미지 추출 실패: 캔버스를 찾을 수 없음');
            return null;
        }
        
        /**
         * 🔥 Paper.js bounds를 사용한 정확한 트림
         */
        function extractUsingPaperBounds(painter) {
            try {
                const project = painter.paperScope.project;
                const view = painter.paperScope.view;
                
                if (!project || !view) {
                    console.warn('⚠️ Paper.js project 또는 view가 없음');
                    return null;
                }
                
                // 모든 레이어의 children 확인
                let allItems = [];
                project.layers.forEach(layer => {
                    if (layer.children && layer.children.length > 0) {
                        layer.children.forEach(child => {
                            // 배경이 아닌 실제 그림 아이템만 수집
                            if (child.visible && child.bounds && child.bounds.width > 0) {
                                allItems.push(child);
                            }
                        });
                    }
                });
                
                console.log(`📊 발견된 아이템 수: ${allItems.length}`);
                
                if (allItems.length === 0) {
                    console.warn('⚠️ 그려진 아이템이 없음');
                    return createEmptyImage();
                }
                
                // 전체 아이템의 bounds 계산
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;
                
                allItems.forEach(item => {
                    const bounds = item.bounds;
                    minX = Math.min(minX, bounds.x);
                    minY = Math.min(minY, bounds.y);
                    maxX = Math.max(maxX, bounds.x + bounds.width);
                    maxY = Math.max(maxY, bounds.y + bounds.height);
                });
                
                const contentWidth = Math.ceil(maxX - minX);
                const contentHeight = Math.ceil(maxY - minY);
                
                console.log(`📐 콘텐츠 bounds: (${minX.toFixed(1)}, ${minY.toFixed(1)}) ~ (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
                console.log(`📐 콘텐츠 크기: ${contentWidth} x ${contentHeight}`);
                
                if (contentWidth <= 0 || contentHeight <= 0) {
                    console.warn('⚠️ 유효하지 않은 bounds');
                    return createEmptyImage();
                }
                
                // 새 캔버스에 해당 영역만 그리기
                const resultCanvas = document.createElement('canvas');
                resultCanvas.width = contentWidth;
                resultCanvas.height = contentHeight;
                const resultCtx = resultCanvas.getContext('2d');
                
                // 투명 배경
                resultCtx.clearRect(0, 0, contentWidth, contentHeight);
                
                // 원본 캔버스에서 해당 영역 복사
                const sourceCanvas = view.element;
                
                // Paper.js 좌표를 캔버스 좌표로 변환
                const pixelRatio = view.pixelRatio || 1;
                const viewBounds = view.bounds;
                
                // view.bounds 기준으로 캔버스 좌표 계산
                const scaleX = sourceCanvas.width / viewBounds.width;
                const scaleY = sourceCanvas.height / viewBounds.height;
                
                const srcX = (minX - viewBounds.x) * scaleX;
                const srcY = (minY - viewBounds.y) * scaleY;
                const srcWidth = contentWidth * scaleX;
                const srcHeight = contentHeight * scaleY;
                
                console.log(`📐 소스 좌표: (${srcX.toFixed(1)}, ${srcY.toFixed(1)}) ${srcWidth.toFixed(1)}x${srcHeight.toFixed(1)}`);
                
                resultCtx.drawImage(
                    sourceCanvas,
                    srcX, srcY, srcWidth, srcHeight,
                    0, 0, contentWidth, contentHeight
                );
                
                // 배경 픽셀을 투명으로 변환
                const imageData = resultCtx.getImageData(0, 0, contentWidth, contentHeight);
                convertBackgroundToTransparent(imageData);
                resultCtx.putImageData(imageData, 0, 0);
                
                return {
                    dataUrl: resultCanvas.toDataURL('image/png'),
                    width: contentWidth,
                    height: contentHeight,
                    hasContent: true
                };
                
            } catch (e) {
                console.error('❌ Paper.js bounds 추출 실패:', e);
                return null;
            }
        }
        
        /**
         * 🔥 픽셀 스캔 방식 트림 (백업)
         */
        function extractByPixelScan(canvas) {
            console.log('🖼️ 픽셀 스캔 방식 트림 시작');
            console.log(`📐 캔버스 크기: ${canvas.width}x${canvas.height}`);
            
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 콘텐츠 영역 찾기
            let minX = canvas.width, minY = canvas.height;
            let maxX = 0, maxY = 0;
            let hasContent = false;
            
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    const a = data[idx + 3];
                    
                    // 알파값이 있는 픽셀만 콘텐츠로 인식 (더 엄격한 기준)
                    if (a > 20) {
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];
                        
                        // 격자 배경 제외 (흰색/회색 체크)
                        const isWhiteOrGray = (r > 200 && g > 200 && b > 200) && 
                                              (Math.abs(r - g) < 10 && Math.abs(g - b) < 10);
                        
                        if (!isWhiteOrGray) {
                            hasContent = true;
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }
            }
            
            console.log(`📊 스캔 결과: hasContent=${hasContent}, bounds=(${minX},${minY})~(${maxX},${maxY})`);
            
            if (!hasContent) {
                return createEmptyImage();
            }
            
            // 여백 추가 (1px)
            minX = Math.max(0, minX - 1);
            minY = Math.max(0, minY - 1);
            maxX = Math.min(canvas.width - 1, maxX + 1);
            maxY = Math.min(canvas.height - 1, maxY + 1);
            
            const trimWidth = maxX - minX + 1;
            const trimHeight = maxY - minY + 1;
            
            // 트림된 이미지 생성
            const resultCanvas = document.createElement('canvas');
            resultCanvas.width = trimWidth;
            resultCanvas.height = trimHeight;
            const resultCtx = resultCanvas.getContext('2d');
            
            resultCtx.clearRect(0, 0, trimWidth, trimHeight);
            
            const trimmedImageData = ctx.getImageData(minX, minY, trimWidth, trimHeight);
            convertBackgroundToTransparent(trimmedImageData);
            resultCtx.putImageData(trimmedImageData, 0, 0);
            
            console.log(`✅ 트림 완료: ${trimWidth}x${trimHeight}`);
            
            return {
                dataUrl: resultCanvas.toDataURL('image/png'),
                width: trimWidth,
                height: trimHeight,
                hasContent: true
            };
        }
        
        /**
         * 배경 픽셀을 투명으로 변환
         */
        function convertBackgroundToTransparent(imageData) {
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                
                // 투명하거나 거의 투명한 픽셀
                if (a < 30) {
                    data[i + 3] = 0;
                    continue;
                }
                
                // 격자 배경 (흰색/밝은 회색)
                const isGrayish = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
                if (isGrayish && r >= 200 && g >= 200 && b >= 200) {
                    data[i + 3] = 0;
                }
            }
        }
        
        /**
         * 빈 이미지 생성
         */
        function createEmptyImage() {
            console.warn('⚠️ 그려진 내용이 없어 빈 이미지 생성');
            const emptyCanvas = document.createElement('canvas');
            emptyCanvas.width = 100;
            emptyCanvas.height = 100;
            return {
                dataUrl: emptyCanvas.toDataURL('image/png'),
                width: 100,
                height: 100,
                hasContent: false
            };
        }
        
        /**
         * 🔥 새 Picture 생성 및 Entity에 적용
         */
        function createNewPicture(currentObject, result, width, height, name) {
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
            
            console.log('🖼️ 새 Picture 생성:', picture);
            
            currentObject.addPicture(picture);
            
            if (currentObject.selectPicture) {
                currentObject.selectPicture(picture.id);
            }
            
            applyImageToEntity(currentObject, picture, width, height);
        }
        
        /**
         * 🔥 Entity에 이미지 적용 (스케일 1 유지)
         */
        function applyImageToEntity(currentObject, picture, width, height) {
            if (!currentObject || !currentObject.entity) {
                console.warn('⚠️ Entity를 찾을 수 없습니다.');
                return;
            }
            
            const entity = currentObject.entity;
            
            console.log('📐 ========== Entity 이미지 적용 ==========');
            console.log('📐 적용할 이미지 크기:', width, 'x', height);
            console.log('📐 적용 전 Entity 상태:', {
                width: entity.getWidth(),
                height: entity.getHeight(),
                scaleX: entity.getScaleX(),
                scaleY: entity.getScaleY()
            });
            
            // 🔥 핵심: dimension을 이미지 크기와 동일하게 설정
            picture.dimension = { width, height };
            
            // Entity 크기 설정 (이미지 실제 크기)
            entity.setWidth(width);
            entity.setHeight(height);
            
            // 이미지 적용
            entity.setImage(picture);
            
            // 🔥 스케일을 1로 강제 설정 (Entry 자동 조정 방지)
            // 여러 번 시도하여 Entry의 자동 조정을 무효화
            const forceScale = () => {
                entity.setScaleX(1);
                entity.setScaleY(1);
            };
            
            forceScale();
            setTimeout(forceScale, 10);
            setTimeout(forceScale, 50);
            setTimeout(forceScale, 100);
            setTimeout(() => {
                forceScale();
                
                console.log('📐 적용 후 Entity 상태:', {
                    width: entity.getWidth(),
                    height: entity.getHeight(),
                    scaleX: entity.getScaleX(),
                    scaleY: entity.getScaleY()
                });
                
                // 스테이지 갱신
                if (Entry.stage && Entry.stage.update) {
                    Entry.stage.update();
                }
            }, 150);
            
            console.log('📐 ========== Entity 업데이트 완료 ==========');
        }
        
        // 🔥 모든 저장 경로 오버라이드
        painter.save = customSaveImage;
        console.log('✅ painter.save 오버라이드');
        
        if (painter.file) {
            painter.file.save = customSaveImage;
            console.log('✅ painter.file.save 오버라이드');
        }
        
        if (Entry.Painter && Entry.Painter.prototype) {
            Entry.Painter.prototype.save = customSaveImage;
            console.log('✅ Entry.Painter.prototype.save 오버라이드');
        }
        
        hookSaveButton();
    }
    
    /**
     * 🔥 변경사항 저장 팝업 후킹 (동일한 저장 함수 사용)
     */
    function hookConfirmDialog() {
        console.log('🔔 팝업 후킹 시작');
        
        // Entry의 confirm 함수 오버라이드
        if (Entry.toast && Entry.toast.confirm) {
            const originalConfirm = Entry.toast.confirm;
            Entry.toast.confirm = function(title, message, onConfirm, onCancel) {
                console.log('🚫 Entry.toast.confirm 가로채기:', title, message);
                
                if (message && (message.includes('저장') || message.includes('변경'))) {
                    console.log('🔔 저장 팝업 감지 - customSaveFunction 호출');
                    if (customSaveFunction) {
                        customSaveFunction();
                    }
                    return;
                }
                
                return originalConfirm.call(this, title, message, onConfirm, onCancel);
            };
            console.log('✅ Entry.toast.confirm 오버라이드');
        }
        
        // DOM 기반 팝업 감지
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    
                    const text = node.textContent || '';
                    if (text.includes('저장하지 않은') || text.includes('변경사항') || text.includes('저장할까요')) {
                        console.log('📢 저장 팝업 감지 (DOM)');
                        
                        setTimeout(() => {
                            const buttons = node.querySelectorAll('button, .btn, [role="button"], div[class*="btn"]');
                            
                            buttons.forEach(btn => {
                                const btnText = btn.textContent?.trim();
                                
                                if (btnText === '저장' || btnText === 'Save' || btnText === '확인') {
                                    console.log('🔔 확인/저장 버튼 후킹');
                                    
                                    const newBtn = btn.cloneNode(true);
                                    btn.parentNode?.replaceChild(newBtn, btn);
                                    
                                    newBtn.addEventListener('click', async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.stopImmediatePropagation();
                                        
                                        console.log('🔔 팝업 확인 버튼 클릭 - customSaveFunction 호출');
                                        
                                        if (customSaveFunction) {
                                            await customSaveFunction();
                                        }
                                        
                                        node.style.display = 'none';
                                        node.remove();
                                        
                                        return false;
                                    }, true);
                                }
                                
                                if (btnText === '취소' || btnText === 'Cancel' || btnText === '저장 안 함') {
                                    btn.addEventListener('click', () => {
                                        console.log('🔔 취소 버튼 클릭');
                                        if (Entry.playground?.painter?.file) {
                                            Entry.playground.painter.file.modified = false;
                                        }
                                    });
                                }
                            });
                        }, 50);
                    }
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    /**
     * 저장하기 버튼 후킹
     */
    function hookSaveButton() {
        const observer = new MutationObserver(() => {
            const buttons = document.querySelectorAll('button');
            
            for (const btn of buttons) {
                const text = btn.textContent?.trim();
                if ((text === '저장하기' || text === '저장') && !btn._customHooked) {
                    const isPainterBtn = btn.closest('.entryPlaygroundPainter, .entryPainter, .painterContainer');
                    
                    if (isPainterBtn) {
                        console.log('✅ 저장 버튼 후킹:', text);
                        
                        const newBtn = btn.cloneNode(true);
                        btn.parentNode?.replaceChild(newBtn, btn);
                        newBtn._customHooked = true;
                        
                        newBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🖱️ 저장 버튼 클릭');
                            
                            if (customSaveFunction) {
                                await customSaveFunction();
                            }
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
        `;
        
        notification.style.backgroundColor = 
            type === 'success' ? '#28a745' : 
            type === 'error' ? '#dc3545' : '#17a2b8';
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

})();
