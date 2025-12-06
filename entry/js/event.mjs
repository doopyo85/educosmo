import { openImportListModal, openExportListModal } from './listTool/index.mjs';
import {
    openSpriteManager,
    openPictureManager,
    openSoundManager,
    openTableManager,
    openExpansionBlockManager,
    openAIUtilizeBlockManager,
} from './popup/index.mjs';

import { saveCanvasImage } from './picture/index.mjs';

export function installEntryEvent() {
    Entry.addEventListener('dismissModal');
    Entry.addEventListener('openSpriteManager', openSpriteManager);
    
    // 🔥 openPictureManager 이벤트를 래핑하여 중복 호출 방지
    Entry.addEventListener('openPictureManager', (e) => {
        console.log('🖼️ Entry openPictureManager 이벤트 발생');
        
        // Entry 내부의 기본 동작 방지 시도
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        // 커스텀 팝업 열기
        openPictureManager();
    });
    
    // 🔥 openSoundManager 이벤트를 래핑하여 중복 호출 방지
    Entry.addEventListener('openSoundManager', (e) => {
        console.log('🔊 Entry openSoundManager 이벤트 발생');
        
        // Entry 내부의 기본 동작 방지 시도
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        // 커스텀 팝업 열기
        openSoundManager();
    });
    Entry.addEventListener('openImportListModal', openImportListModal);
    Entry.addEventListener('openExportListModal', openExportListModal);
    Entry.addEventListener('openTableManager', openTableManager);
    Entry.addEventListener('openExpansionBlockManager', openExpansionBlockManager);
    Entry.addEventListener('openAIUtilizeBlockManager', openAIUtilizeBlockManager);

    //그림판 이미지 저장
    Entry.addEventListener('saveCanvasImage', saveCanvasImage);
}
