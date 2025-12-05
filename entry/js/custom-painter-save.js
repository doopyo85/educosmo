/**
 * 🎨 Entry Paint Editor 저장 함수 커스터마이징
 * Paint Editor의 저장하기 버튼을 S3 업로드 API와 연동
 * 
 * 수정일: 2025-12-05
 * - 🔥 배경 제거 로직 제거 (Entry 원본 투명 배경 방식 사용)
 * - Paper.js 캔버스 직접 접근
 * - 팝업 저장 버튼 완전 차단
 * - 모양 가져오기 후킹 비활성화 (클릭 충돌 문제)
 */

(function() {
    console.log('🎨 Custom Painter Save 초기화 중...');

    // 저장 함수 참조 (전역)
    let customSaveFunction = null;
    
    // 원본 저장 함수 백업 (호출 차단용)
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
                // 🔥 hookImportButton 호출 제거 - 클릭 충돌 문제
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
        
        console.log('🔧 Painter 객체 발견, 구조 분석 시작');
        
        // 🔥 Painter 구조 디버깅
        console.log('📋 Painter 속성들:', Object.keys(painter));
        
        // 원본 save 백업
        originalEntrySave = painter.save;

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
                
                // 🔥 Paper.js에서 그림만 추출 (배경 제거 로직 없이)
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
         * 🔥 Paper.js에서 그림 추출 (배경 제거 없이 - Entry 원본 방식)
         */
        async function extractPaperImage(painter) {
            console.log('🖼️ Paper.js 이미지 추출 시작 (배경 제거 비활성화)');
            
            // 방법 1: Paper.js project의 exportSVG/rasterize 사용
            if (painter.paperScope && painter.paperScope.project) {
                const project = painter.paperScope.project;
                const view = painter.paperScope.view;
                
                console.log('📋 레이어 수:', project.layers.length);
                project.layers.forEach((layer, i) => {
                    console.log(`  레이어 ${i}: ${layer.name || '이름없음'}, children: ${layer.children?.length || 0}`);
                });
                
                // 그림 레이어만 내보내기 (Entry 기본 구조 활용)
                if (view) {
                    const canvas = view.element;
                    return extractFromCanvas(canvas);
                }
            }
            
            // 방법 2: 캔버스 직접 탐색
            const canvasSelectors = [
                '#entryPainterCanvas',
                '.entryPainterCanvas',
                '#paint_canvas',
                'canvas[data-paper-scope]',
                '.entryPlaygroundPainter canvas',
                '.entryPainter canvas'
            ];
            
            for (const selector of canvasSelectors) {
                const canvas = document.querySelector(selector);
                if (canvas) {
                    console.log(`📋 캔버스 발견: ${selector}, 크기: ${canvas.width}x${canvas.height}`);
                    return extractFromCanvas(canvas);
                }
            }
            
            // 방법 3: painter 내부 캔버스
            if (painter.canvas) {
                console.log('📋 painter.canvas 사용');
                return extractFromCanvas(painter.canvas);
            }
            
            // 방법 4: 모든 캔버스 탐색
            const allCanvases = document.querySelectorAll('canvas');
            console.log(`📋 페이지 내 모든 캔버스: ${allCanvases.length}개`);
            
            for (const canvas of allCanvases) {
                if (canvas.width > 100 && canvas.height > 100) {
                    console.log(`  체크: ${canvas.id || canvas.className}, ${canvas.width}x${canvas.height}`);
                    return extractFromCanvas(canvas);
                }
            }
            
            console.warn('⚠️ 적절한 캔버스를 찾지 못함');
            return null;
        }
        
        /**
         * 🔥 캔버스에서 이미지 추출 (배경 제거 없이 - Entry 원본 로직 사용)
         * Entry Paint Editor는 자체적으로 투명 배경을 처리함
         */
        function extractFromCanvas(canvas) {
            console.log('🖼️ 캔버스에서 이미지 추출 (배경 제거 비활성화)');
            console.log(`📐 캔버스 크기: ${canvas.width}x${canvas.height}`);
            
            // 캔버스를 그대로 PNG로 내보내기
            const dataUrl = canvas.toDataURL('image/png');
            
            console.log('✅ 이미지 추출 완료 (원본 그대로)');
            
            return {
                dataUrl: dataUrl,
                width: canvas.width,
                height: canvas.height,
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
                    height: entity.getHeight(),
                    scaleX: entity.getScaleX(),
                    scaleY: entity.getScaleY()
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
                
                // 저장 관련 팝업이면 커스텀 저장 실행
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
                            // 모든 버튼 찾기
                            const buttons = node.querySelectorAll('button, .btn, [role="button"], div[class*="btn"]');
                            
                            buttons.forEach(btn => {
                                const btnText = btn.textContent?.trim();
                                console.log('  버튼 발견:', btnText);
                                
                                if (btnText === '저장' || btnText === 'Save' || btnText === '확인') {
                                    // 기존 이벤트 제거
                                    const newBtn = btn.cloneNode(true);
                                    btn.parentNode?.replaceChild(newBtn, btn);
                                    
                                    newBtn.addEventListener('click', async (e) => {
                                        console.log('🖱️ 팝업 저장 버튼 클릭 (가로채기)');
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.stopImmediatePropagation();
                                        
                                        // 커스텀 저장 실행
                                        if (customSaveFunction) {
                                            await customSaveFunction();
                                        }
                                        
                                        // 팝업 닫기
                                        node.style.display = 'none';
                                        node.remove();
                                        
                                        return false;
                                    }, true);
                                }
                                
                                if (btnText === '취소' || btnText === 'Cancel' || btnText === '저장 안 함') {
                                    btn.addEventListener('click', () => {
                                        // modified 플래그 해제
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
