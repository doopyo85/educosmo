// 편집 모드 수정 부분만 포함
// 기존 코드의 163-194 라인을 다음으로 교체:

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
                        existingPicture.dimension = { width, height };  // 🔥 원본 크기로 업데이트
                        
                        console.log('✅ 기존 모양 업데이트됨:', existingPicture.name);
                        console.log('📐 업데이트된 크기:', width, 'x', height);
                        
                        // 모양 목록 새로고침
                        if (Entry.playground.injectPicture) {
                            Entry.playground.injectPicture();
                        }
                        
                        // 🔥 Entity 크기를 원본 이미지 크기로 조정
                        if (currentObject.entity) {
                            const entity = currentObject.entity;
                            
                            entity.setWidth(width);
                            entity.setHeight(height);
                            entity.setScaleX(1);
                            entity.setScaleY(1);
                            
                            console.log('📐 Entity 크기 조정됨 (편집 모드):', { width, height });
                            
                            // 스테이지 업데이트
                            entity.setImage(existingPicture);
                        }
                    } else {
                        console.warn('⚠️ 편집 중인 모양을 찾을 수 없음, 새 모양으로 추가');
                        addNewPicture(currentObject, result, width, height, fileInfo?.name);
                    }
                } else {
