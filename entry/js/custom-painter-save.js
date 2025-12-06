/**
 * 🎨 Entry Paint Editor 저장 함수 커스터마이징
 * Paint Editor의 저장하기 버튼을 S3 업로드 API와 연동
 * 
 * 수정일: 2025-12-06
 * - 🔥 extractTransparentImage로 배경 제거 + 트림 처리
 * - 투명 배경 유지
 * - 팝업 저장 버튼 완전 차단
 * - 저장 전 캔버스 클릭으로 선택 해제
 * - 안티앨리어싱 경계 처리
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
                        // 캔버스 좌상단 구석 클릭 (보통 빈 영역)
                        const rect = canvas.getBoundingClientRect();
                        const clickX = rect.left + 5;
                        const clickY = rect.top + 5;
                        
                        // mousedown + mouseup 이벤트 시뮬레이션
                        const mousedownEvent = new MouseEvent('mousedown', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: clickX,
                            clientY: clickY,
                            button: 0
                        });
                        
                        const mouseupEvent = new MouseEvent('mouseup', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: clickX,
                            clientY: clickY,
                            button: 0
                        });
                        
                        canvas.dispatchEvent(mousedownEvent);
                        canvas.dispatchEvent(mouseupEvent);
                        
                        console.log('  ✓ 캔버스 클릭 이벤트 발생 (5, 5)');
                    }
                    
                    // Paper.js 선택 해제도 시도
                    if (painter.paperScope && painter.paperScope.project) {
                        const project = painter.paperScope.project;
                        
                        if (project.deselectAll) {
                            project.deselectAll();
                            console.log('  ✓ project.deselectAll() 호출');
                        }
                        
                        // 선택된 아이템 직접 해제
                        if (project.selectedItems && project.selectedItems.length > 0) {
                            console.log(`  📋 선택된 아이템 ${project.selectedItems.length}개 해제 중...`);
                            while (project.selectedItems.length > 0) {
                                project.selectedItems[0].selected = false;
                            }
                        }
                        
                        // view 갱신
                        if (painter.paperScope.view) {
                            painter.paperScope.view.update();
                        }
                    }
                    
                    // Entry Painter 메서드 호출
                    if (painter.selectNone) {
                        painter.selectNone();
                        console.log('  ✓ painter.selectNone() 호출');
                    }
                    
                    if (painter.clearSelection) {
                        painter.clearSelection();
                        console.log('  ✓ painter.clearSelection() 호출');
                    }
                    
                    console.log('✅ 선택 해제 완료, 150ms 대기...');
                    
                    // UI 업데이트 대기
                    setTimeout(resolve, 150);
                    
                } catch (e) {
                    console.warn('⚠️ 선택 해제 중 오류:', e);
                    setTimeout(resolve, 150);
                }
            });
        }

        /**
         * 🔥 커스텀 이미지 저장 함수
         */
        async function customSaveImage() {
            try {
                console.log('💾 ========== 커스텀 저장 함수 시작 ==========');
                
                const fileInfo = painter.file;
                const isEditMode = fileInfo && fileInfo.mode === 'edit';
                const editingPictureId = fileInfo?.id;
                
                console.log('📋 모드:', { isEditMode, editingPictureId });
                
                // 🔥 저장 전 캔버스 클릭으로 선택 해제
                await clickCanvasToDeselect(painter);
                
                // 🔥 Paper.js에서 그림만 추출 (배경 제외)
                let imageData = null;
                let width = 480;
                let height = 270;
                
                const extractResult = await extractPaperImage(painter);
                if (extractResult) {
                    imageData = extractResult.dataUrl;
                    width = extractResult.width;
                    height = extractResult.height;
                    console.log('📐 추출된 이미지 크기:', width, 'x', height);
                }
                
                if (!imageData) {
                    throw new Error('이미지를 추출할 수 없습니다.');
                }
                
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
                
                const currentObject = Entry.playground.object;
                if (!currentObject) {
                    throw new Error('현재 오브젝트를 찾을 수 없습니다.');
                }
                
                // 편집 모드 vs 새로 그리기 모드
                if (isEditMode && editingPictureId) {
                    console.log('✏️ 편집 모드');
                    const existingPicture = currentObject.pictures?.find(p => p.id === editingPictureId);
                    
                    if (existingPicture) {
                        existingPicture.filename = result.filename;
                        existingPicture.fileurl = result.fileurl;
                        existingPicture.thumbUrl = result.thumbUrl || result.fileurl;
                        existingPicture.dimension = { width, height };
                        
                        if (Entry.playground.injectPicture) {
                            Entry.playground.injectPicture();
                        }
                        
                        updateEntitySize(currentObject, width, height, existingPicture);
                    } else {
                        addNewPicture(currentObject, result, width, height, fileInfo?.name);
                    }
                } else {
                    console.log('🆕 새로 그리기 모드');
                    addNewPicture(currentObject, result, width, height);
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
         * 🔥 Paper.js에서 그림만 추출 (핵심 함수)
         * 캔버스에서 직접 추출 후 배경 제거 + 트림 처리
         */
        async function extractPaperImage(painter) {
            console.log('🖼️ 이미지 추출 시작 (extractTransparentImage 사용)');
            
            // 방법 1: paint_canvas에서 추출 (투명 배경 처리 + 트림)
            const paintCanvas = document.getElementById('paint_canvas');
            if (paintCanvas) {
                console.log('📋 paint_canvas 사용');
                return extractTransparentImage(paintCanvas);
            }
            
            // 방법 2: Paper.js view에서 캔버스 가져오기
            if (painter.paperScope && painter.paperScope.view && painter.paperScope.view.element) {
                console.log('📋 paperScope.view.element 사용');
                return extractTransparentImage(painter.paperScope.view.element);
            }
            
            // 방법 3: 다른 캔버스 탐색
            const canvasSelectors = [
                '#entryPainterCanvas',
                '.entryPainterCanvas',
                'canvas[data-paper-scope]',
                '.entryPlaygroundPainter canvas',
                '.entryPainter canvas'
            ];
            
            for (const selector of canvasSelectors) {
                const canvas = document.querySelector(selector);
                if (canvas) {
                    console.log(`📋 캔버스 발견: ${selector}`);
                    return extractTransparentImage(canvas);
                }
            }
            
            // 방법 4: painter 내부 캔버스
            if (painter.canvas) {
                console.log('📋 painter.canvas 사용');
                return extractTransparentImage(painter.canvas);
            }
            
            console.warn('⚠️ 적절한 캔버스를 찾지 못함');
            return null;
        }
        
        /**
         * 🔥 캔버스에서 투명 배경 이미지 추출 (트림 포함)
         * 실제 그려진 콘텐츠만 추출하고 배경은 투명 처리
         */
        function extractTransparentImage(canvas) {
            console.log('🖼️ 투명 배경 이미지 추출 시작');
            console.log(`📐 원본 캔버스 크기: ${canvas.width}x${canvas.height}`);
            
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 1. 실제 콘텐츠가 있는 영역 찾기
            let minX = canvas.width, minY = canvas.height;
            let maxX = 0, maxY = 0;
            let hasContent = false;
            
            // 2. 배경색 감지 (격자 패턴 - 흰색/회색 + 안티앨리어싱 경계)
            const isBackgroundColor = (r, g, b, a) => {
                // 완전 투명
                if (a < 10) return true;
                
                // 반투명 (안티앨리어싱 경계) - 알파가 낮으면 배경으로 처리
                if (a < 128) return true;
                
                // 회색 계열인지 확인 (R, G, B 값이 비슷함)
                const isGrayish = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
                
                // 밝은 회색~흰색 범위 (Entry 격자 배경)
                if (isGrayish && r >= 195 && g >= 195 && b >= 195) return true;
                
                return false;
            };
            
            // 3. 콘텐츠 영역 스캔
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const a = data[idx + 3];
                    
                    // 배경이 아닌 픽셀 (실제 그림)
                    if (!isBackgroundColor(r, g, b, a)) {
                        hasContent = true;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            
            console.log(`📊 콘텐츠 영역: (${minX},${minY}) ~ (${maxX},${maxY}), hasContent: ${hasContent}`);
            
            // 콘텐츠가 없으면 빈 투명 이미지 반환
            if (!hasContent) {
                console.warn('⚠️ 그려진 내용이 없습니다.');
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
            
            // 4. 패딩 없이 정확한 크기로 트림
            const trimWidth = maxX - minX + 1;
            const trimHeight = maxY - minY + 1;
            
            // 5. 새 캔버스에 투명 배경으로 그림만 복사
            const resultCanvas = document.createElement('canvas');
            resultCanvas.width = trimWidth;
            resultCanvas.height = trimHeight;
            const resultCtx = resultCanvas.getContext('2d');
            
            // 투명 배경으로 시작
            resultCtx.clearRect(0, 0, trimWidth, trimHeight);
            
            // 원본에서 트림 영역만 복사
            const trimmedImageData = ctx.getImageData(minX, minY, trimWidth, trimHeight);
            const trimmedData = trimmedImageData.data;
            
            // 6. 배경색을 투명으로 변환
            for (let i = 0; i < trimmedData.length; i += 4) {
                const r = trimmedData[i];
                const g = trimmedData[i + 1];
                const b = trimmedData[i + 2];
                const a = trimmedData[i + 3];
                
                if (isBackgroundColor(r, g, b, a)) {
                    // 배경색은 완전 투명으로
                    trimmedData[i + 3] = 0;
                }
            }
            
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
         * Entity 크기 업데이트
         */
        function updateEntitySize(currentObject, width, height, picture) {
            if (currentObject.entity) {
                const entity = currentObject.entity;
                console.log('📐 Entity 크기 조정 전:', {
                    width: entity.getWidth(),
                    height: entity.getHeight()
                });
                
                entity.setWidth(width);
                entity.setHeight(height);
                entity.setScaleX(1);
                entity.setScaleY(1);
                
                if (picture) {
                    entity.setImage(picture);
                }
                
                console.log('📐 Entity 크기 조정 후:', { width, height });
            }
        }
        
        /**
         * 새 모양 추가
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
            
            console.log('🖼️ 새 Picture:', picture);
            
            currentObject.addPicture(picture);
            
            if (currentObject.selectPicture) {
                currentObject.selectPicture(picture.id);
            }
            
            updateEntitySize(currentObject, width, height, picture);
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
     * 🔥 변경사항 저장 팝업 완전 차단
     */
    function hookConfirmDialog() {
        console.log('🔔 팝업 후킹 시작');
        
        // Entry의 confirm 함수 오버라이드
        if (Entry.toast && Entry.toast.confirm) {
            const originalConfirm = Entry.toast.confirm;
            Entry.toast.confirm = function(title, message, onConfirm, onCancel) {
                console.log('🚫 Entry.toast.confirm 가로채기:', title);
                
                if (message && (message.includes('저장') || message.includes('변경'))) {
                    if (customSaveFunction) {
                        customSaveFunction();
                    }
                    return;
                }
                
                return originalConfirm.call(this, title, message, onConfirm, onCancel);
            };
        }
        
        // DOM 기반 팝업 감지
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    
                    const text = node.textContent || '';
                    if (text.includes('저장하지 않은') || text.includes('변경사항')) {
                        console.log('📢 저장 팝업 감지');
                        
                        setTimeout(() => {
                            const buttons = node.querySelectorAll('button, .btn, [role="button"], div[class*="btn"]');
                            
                            buttons.forEach(btn => {
                                const btnText = btn.textContent?.trim();
                                
                                if (btnText === '저장' || btnText === 'Save' || btnText === '확인') {
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
