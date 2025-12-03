// 월간 학습 리포트 POD 기능을 위한 라우터
const express = require('express');
const router = express.Router();
const { getSheetData } = require('../server'); // server.js에서 내보낸 함수 사용
const { authenticateUser } = require('../lib_login/authMiddleware');

// 캐시 저장소
let booksDataCache = null;
let reportDataCache = null;
let lastCacheUpdate = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간(1일) 캐시 유효기간

// 캐시 업데이트 함수
async function updateCaches() {
    try {
        console.log('Updating books and report data cache from Google Sheets...');
        
        // books 시트에서 교재 정보 가져오기
        const booksData = await getSheetData('books!A1:F1000');
        
        if (!booksData || !Array.isArray(booksData) || booksData.length === 0) {
            console.error('Failed to fetch books data: Empty or invalid response');
            return false;
        }
        
        // report 시트에서 CT요소 정보 가져오기
        const reportData = await getSheetData('report!A1:G1000');
        
        if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
            console.error('Failed to fetch report data: Empty or invalid response');
            return false;
        }
        
        // 헤더 행 추출
        const booksHeaders = booksData[0];
        const reportHeaders = reportData[0];
        
        // 데이터 객체로 변환 (헤더를 키로 사용)
        const parsedBooksData = booksData.slice(1).map(row => {
            const item = {};
            booksHeaders.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            return item;
        });
        
        const parsedReportData = reportData.slice(1).map(row => {
            const item = {};
            reportHeaders.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            return item;
        });
        
        // 캐시 저장 및 타임스탬프 업데이트
        booksDataCache = parsedBooksData;
        reportDataCache = parsedReportData;
        lastCacheUpdate = Date.now();
        console.log(`Books and report data cache updated successfully`);
        
        // 디버깅용 - 데이터 샘플 출력
        if (parsedReportData.length > 0) {
            console.log("Report 데이터 샘플:", JSON.stringify(parsedReportData[0]));
        }
        
        return true;
    } catch (error) {
        console.error('Error updating caches:', error);
        return false;
    }
}

// 서버 시작 시 캐시 초기화
updateCaches().catch(err => {
    console.error('Initial cache update failed:', err);
});

// 일별 새벽 4시에 캐시 자동 갱신
setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 4 && now.getMinutes() === 0) {
        console.log('Scheduled cache update...');
        await updateCaches();
    }
}, 60000); // 1분마다 확인

// 볼륨 정규화 및 파싱 함수
const parseVolume = (vol) => {
    // LV 숫자 추출
    let level = null;
    const lvMatch = vol.match(/lv(\d+)/i);
    if (lvMatch) {
        level = parseInt(lvMatch[1]);
    }
    
    // 호수 추출
    let issueNumber = null;
    let issueMatch = vol.match(/[-_](\d+)호$/);
    if (!issueMatch) {
        issueMatch = vol.match(/(\d+)호$/);
    }
    if (!issueMatch) {
        issueMatch = vol.match(/(\d+)$/);
    }
    
    if (issueMatch) {
        issueNumber = parseInt(issueMatch[1]);
    }
    
    return { level, issueNumber };
};

// 카테고리 정규화 함수
const normalizeCategory = (cat) => {
    if (!cat) return '';
    if (cat.toLowerCase().includes('preschool') || cat.toLowerCase().includes('프리스쿨')) {
        return '프리스쿨';
    } else if (cat.toLowerCase().includes('junior') || cat.toLowerCase().includes('주니어')) {
        return '주니어';
    }
    return cat;
};

// 웹 페이지: 교재 목록 페이지 (간소화된 테이블 뷰)
router.get('/books-page', authenticateUser, (req, res) => {
    console.log('books-page 라우트 처리');
    res.render('report/report_bookslist', { 
        userID: req.session?.userID || null,
        is_logined: req.session?.is_logined || false,
        role: req.session?.role || 'guest'
    });
});

// API 엔드포인트: 교재 카테고리 및 목록 가져오기 (필요한 경우 유지)
router.get('/books', authenticateUser, async (req, res) => {
    try {
        if (!booksDataCache || !lastCacheUpdate || (Date.now() - lastCacheUpdate) > CACHE_TTL) {
            await updateCaches();
        }
        
        // 카테고리별로 그룹화
        const groupedBooks = {};
        
        booksDataCache.forEach(book => {
            const category = book['교재카테고리'] || '기타';
            
            if (!groupedBooks[category]) {
                groupedBooks[category] = [];
            }
            
            groupedBooks[category].push({
                volume: book['교재레벨-호'] || '',
                title: book['교재제목'] || '',
                thumbnail: book['URL'] || ''
            });
        });
        
        res.json(groupedBooks);
    } catch (error) {
        console.error('Error fetching book list:', error);
        res.status(500).json({ error: '교재 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// CT요소 API - 특정 교재의 CT요소만 가져오기 - B열/C열 기반 개선 버전
router.get('/book-ct-elements/:category/:volume', authenticateUser, async (req, res) => {
    try {
        // URL에서 카테고리(B열)와 볼륨(C열) 값 추출
        const { category, volume } = req.params;
        
        // 캐시 확인 및 업데이트
        if (!booksDataCache || !reportDataCache || !lastCacheUpdate || (Date.now() - lastCacheUpdate) > CACHE_TTL) {
            await updateCaches();
        }

        console.log(`CT 요소 검색: B열(교재카테고리)=${category}, C열(교재레벨-호)=${volume}`);
        
        // 교재 정보 찾기 - 정확히 B열과 C열이 일치하는 항목
        const bookInfo = booksDataCache.find(book => {
            // 카테고리(B열)와 볼륨(C열) 모두 정확히 일치하는지 확인
            return book['교재카테고리'] === category && book['교재레벨-호'] === volume;
        });
        
        // 교재 정보를 찾지 못한 경우, C열만으로 재시도
        let foundBookInfo = bookInfo;
        if (!foundBookInfo) {
            foundBookInfo = booksDataCache.find(book => book['교재레벨-호'] === volume);
            console.log(`B열+C열로 찾지 못해 C열만으로 검색: ${foundBookInfo ? '성공' : '실패'}`);
        }
        
        // 기본 교재 정보 설정
        const bookData = {
            category: category,
            volume: volume,
            title: `${category} ${volume}`,
            thumbnail: ''
        };
        
        // 교재 정보가 있으면 업데이트
        if (foundBookInfo) {
            bookData.category = foundBookInfo['교재카테고리'] || category;
            bookData.title = foundBookInfo['교재제목'] || `${category} ${volume}`;
            bookData.thumbnail = foundBookInfo['URL'] || '';
            console.log(`교재 정보 찾음: ${bookData.title}`);
        } else {
            console.log(`교재 정보를 찾을 수 없음. 기본 정보 사용: ${bookData.title}`);
        }
        
        // C열 기준으로 CT요소 직접 필터링
        const ctElements = reportDataCache
            .filter(item => item['교재레벨-호'] === volume)
            .map(item => ({
                id: item['NO'] || '',
                category: item['교재카테고리'] || '',
                volume: item['교재레벨-호'] || '',
                lessonName: item['차시명'] || '',
                ctElement: item['CT요소'] || '',
                evaluationItem: item['평가항목'] || ''
            }));
        
        console.log(`C열 기준으로 찾은 CT요소 데이터: ${ctElements.length}개`);
        
        // CT요소가 없다면 디버그 정보 출력
        if (ctElements.length === 0) {
            console.log('CT요소를 찾을 수 없어 데이터 샘플 출력:');
            const sampleItems = reportDataCache.slice(0, 5);
            sampleItems.forEach(item => {
                console.log(`- 교재카테고리: "${item['교재카테고리']}", 교재레벨-호: "${item['교재레벨-호']}"`);
            });
        }
        
        // 차시 순으로 정렬
        ctElements.sort((a, b) => {
            const chapterA = parseInt(a.id) || 0;
            const chapterB = parseInt(b.id) || 0;
            return chapterA - chapterB;
        });
        
        // 응답 구성
        const response = {
            book: bookData,
            ctElements: ctElements,
            meta: {
                categoryFromUrl: category,
                volumeFromUrl: volume,
                elementsFound: ctElements.length
            }
        };
        
        res.json(response);
    } catch (error) {
        console.error('CT요소 데이터 로딩 중 오류:', error);
        res.status(500).json({ 
            error: 'CT요소 데이터를 불러오는 중 오류가 발생했습니다.',
            message: error.message
        });
    }
});

// HTML 웹 페이지: 학습 리포트 생성 페이지
router.get('/generate/:category/:volume', authenticateUser, (req, res) => {
    res.render('report/report_generate', {
        userID: req.session?.userID || null,
        is_logined: req.session?.is_logined || false,
        role: req.session?.role || 'guest',
        category: req.params.category,
        volume: req.params.volume
    });
});

// CT요소 API - 특정 교재의 CT요소만 가져오기
router.get('/book-ct-elements/:category/:volume', authenticateUser, async (req, res) => {
    try {
        const { category, volume } = req.params;
        
        // 캐시 확인 및 업데이트
        if (!booksDataCache || !reportDataCache || !lastCacheUpdate || (Date.now() - lastCacheUpdate) > CACHE_TTL) {
            await updateCaches();
        }

        console.log(`CT 요소 검색: 카테고리=${category}, 볼륨=${volume}`);
        
        // 볼륨 정보 파싱
        const requestedVolume = parseVolume(volume);
        console.log(`파싱된 볼륨 정보: 레벨=${requestedVolume.level}, 호수=${requestedVolume.issueNumber}`);
        
        // 정규화된 카테고리
        const normalizedReqCategory = normalizeCategory(category);
        
        // 카테고리 매핑 및 레벨 정보 추출
        let targetCategory = '';
        let levelNum = requestedVolume.level || '';
        let volumeNum = requestedVolume.issueNumber || '';
        
        if (normalizedReqCategory === '프리스쿨') {
            targetCategory = `프리스쿨 LV${levelNum}`;
        } else if (normalizedReqCategory === '주니어') {
            targetCategory = `주니어 LV${levelNum}`;
        } else if (category.toLowerCase() === 'cps') {
            targetCategory = 'CPS';
        } else if (category.toLowerCase() === 'cpa') {
            targetCategory = 'CPA';
        } else if (category.toLowerCase() === 'ctr_appinventor') {
            targetCategory = '앱인벤터';
        } else if (category.toLowerCase() === 'ctr_python') {
            targetCategory = '파이썬';
        } else {
            targetCategory = category;
        }
        
        console.log(`변환된 검색 조건: 카테고리="${targetCategory}", 레벨=${levelNum}, 볼륨번호="${volumeNum}"`);
        
        // 교재 정보 찾기
        const bookInfo = booksDataCache.find(book => {
            const bookCategory = book['교재카테고리'] || '';
            const bookVolume = book['교재레벨-호'] || '';
            const parsedBookVolume = parseVolume(bookVolume);
            
            // 카테고리 확인
            const categoryMatch = bookCategory === targetCategory || 
                                 normalizeCategory(bookCategory) === normalizedReqCategory;
            
            // 볼륨 매칭
            let volumeMatch = false;
            
            if (normalizedReqCategory === '프리스쿨' || normalizedReqCategory === '주니어') {
                // 프리스쿨/주니어의 경우 LV와 호수 모두 확인
                volumeMatch = parsedBookVolume.level === requestedVolume.level && 
                             parsedBookVolume.issueNumber === requestedVolume.issueNumber;
            } else {
                // 다른 교재의 경우 호수만 확인
                volumeMatch = parsedBookVolume.issueNumber === requestedVolume.issueNumber;
            }
            
            const result = categoryMatch && volumeMatch;
            if (result) {
                console.log(`교재 매칭 성공: 카테고리=${bookCategory}, 볼륨=${bookVolume}`);
            }
            return result;
        });
        
        // 기본 교재 정보 설정
        const bookData = {
            category: targetCategory,
            volume: volume,
            title: `${targetCategory} ${volumeNum}호`,
            thumbnail: ''
        };
        
        // 교재 정보가 있으면 업데이트
        if (bookInfo) {
            bookData.title = bookInfo['교재제목'] || bookData.title;
            bookData.thumbnail = bookInfo['URL'] || '';
            console.log(`교재 정보 찾음: ${bookData.title}`);
        }
        
        // 해당 교재의 CT요소만 필터링
        const filteredElements = reportDataCache.filter(item => {
            const itemCategory = item['교재카테고리'] || '';
            const itemVolume = item['교재레벨-호'] || '';
            const parsedItemVolume = parseVolume(itemVolume);
            
            // 카테고리 확인
            const categoryMatch = itemCategory === targetCategory || 
                                 normalizeCategory(itemCategory) === normalizedReqCategory;
            
            // 볼륨 매칭
            let volumeMatch = false;
            
            if (normalizedReqCategory === '프리스쿨' || normalizedReqCategory === '주니어') {
                // 프리스쿨/주니어의 경우 LV와 호수 모두 확인
                volumeMatch = parsedItemVolume.level === requestedVolume.level && 
                             parsedItemVolume.issueNumber === requestedVolume.issueNumber;
            } else {
                // 다른 교재의 경우 호수만 확인
                volumeMatch = parsedItemVolume.issueNumber === requestedVolume.issueNumber;
            }
            
            const match = categoryMatch && volumeMatch;
            if (match) {
                console.log(`CT요소 매칭: 카테고리=${itemCategory}, 볼륨=${itemVolume}, 차시=${item['차시']}, CT요소=${item['CT요소']}`);
            }
            return match;
        });
        
        console.log(`필터링된 CT요소 데이터: ${filteredElements.length}개 행`);
        
        // 결과가 없는 경우 대체 필터링 시도
        if (filteredElements.length === 0) {
            console.log("정확한 매칭 결과가 없어 부분 일치로 재시도합니다.");
            
            // 부분 일치 검색
            const alternativeElements = reportDataCache.filter(item => {
                const itemCategory = normalizeCategory(item['교재카테고리'] || '');
                const itemVolume = item['교재레벨-호'] || '';
                const parsedItemVolume = parseVolume(itemVolume);
                
                // 카테고리 부분 일치
                const categoryPartialMatch = itemCategory === normalizedReqCategory;
                
                // 볼륨 부분 일치
                let volumePartialMatch = false;
                
                if (normalizedReqCategory === '프리스쿨' || normalizedReqCategory === '주니어') {
                    // 레벨 일치 및 호수 일치 여부
                    volumePartialMatch = parsedItemVolume.level === requestedVolume.level && 
                                       parsedItemVolume.issueNumber === requestedVolume.issueNumber;
                } else {
                    // 호수만 일치하는지 확인
                    volumePartialMatch = parsedItemVolume.issueNumber === requestedVolume.issueNumber;
                }
                
                return categoryPartialMatch && volumePartialMatch;
            });
            
            if (alternativeElements.length > 0) {
                console.log(`부분 일치로 ${alternativeElements.length}개 항목을 찾았습니다.`);
                const ctElements = alternativeElements.map(item => ({
                    id: item['NO'] || '',
                    category: item['교재카테고리'] || '',
                    volume: item['교재레벨-호'] || '',
                    lessonName: item['차시명'] || '',
                    ctElement: item['CT요소'] || '',
                    evaluationItem: item['평가항목'] || ''
                }));
                
                // 차시 순으로 정렬
                ctElements.sort((a, b) => {
                    const chapterA = parseInt(a.id) || 0;
                    const chapterB = parseInt(b.id) || 0;
                    return chapterA - chapterB;
                });
                
                // 응답 구성
                const response = {
                    book: bookData,
                    ctElements: ctElements,
                    meta: {
                        category: normalizedReqCategory,
                        level: requestedVolume.level,
                        issueNumber: requestedVolume.issueNumber
                    }
                };
                
                return res.json(response);
            }
        }
        
        // 결과 포맷팅
        const ctElements = filteredElements.map(item => ({
            id: item['NO'] || '',
            category: item['교재카테고리'] || '',
            volume: item['교재레벨-호'] || '',
            lessonName: item['차시명'] || '',
            ctElement: item['CT요소'] || '',
            evaluationItem: item['평가항목'] || ''
        }));
        
        // 차시 순으로 정렬
        ctElements.sort((a, b) => {
            const chapterA = parseInt(a.id) || 0;
            const chapterB = parseInt(b.id) || 0;
            return chapterA - chapterB;
        });
        
        // 응답 구성
        const response = {
            book: bookData,
            ctElements: ctElements,
            meta: {
                category: normalizedReqCategory,
                level: requestedVolume.level,
                issueNumber: requestedVolume.issueNumber
            }
        };
        
        res.json(response);
    } catch (error) {
        console.error('CT요소 데이터 로딩 중 오류:', error);
        res.status(500).json({ 
            error: 'CT요소 데이터를 불러오는 중 오류가 발생했습니다.',
            message: error.message
        });
    }
});

module.exports = router;