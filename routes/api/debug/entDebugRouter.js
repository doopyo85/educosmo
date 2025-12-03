const express = require('express');
const router = express.Router();
const entFileManager = require('../../../lib_entry/entFileManager');

/**
 * 🔧 ENT 파일 디버깅 전용 라우터
 * 개발자 콘솔에서 상세 로그 확인용
 */

/**
 * GET /api/debug/ent/test-s3
 * S3 ENT 파일 테스트 (상세 로그 포함)
 */
router.get('/test-s3', async (req, res) => {
    try {
        const { s3Url } = req.query;
        
        console.log('\n🧪 === ENT 파일 디버그 테스트 시작 ===');
        console.log('🎯 테스트 S3 URL:', s3Url);
        console.log('⏰ 시작 시간:', new Date().toISOString());
        
        if (!s3Url) {
            return res.status(400).json({
                success: false,
                error: 'S3 URL이 필요합니다.',
                usage: '/api/debug/ent/test-s3?s3Url=https://...'
            });
        }
        
        // EntFileManager 인스턴스 생성
        const entFileManager = new EntFileManager();
        
        // 단계별 진행 상황 저장
        const debugLog = [];
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        
        // 콘솔 로그 캡처
        console.log = (...args) => {
            const message = args.join(' ');
            debugLog.push({
                type: 'info',
                timestamp: new Date().toISOString(),
                message: message
            });
            originalConsoleLog(...args);
        };
        
        console.error = (...args) => {
            const message = args.join(' ');
            debugLog.push({
                type: 'error',
                timestamp: new Date().toISOString(),
                message: message
            });
            originalConsoleError(...args);
        };
        
        const startTime = Date.now();
        
        try {
            // S3 ENT 파일 로드 실행
            const result = await entFileManager.loadProjectFromS3(s3Url);
            const loadTime = Date.now() - startTime;
            
            // 콘솔 복원
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            
            console.log('🧪 === ENT 파일 디버그 테스트 완료 ===\n');
            
            // 상세 결과 반환
            res.json({
                success: true,
                testResult: result,
                debugInfo: {
                    loadTime: loadTime,
                    totalSteps: debugLog.length,
                    debugLog: debugLog,
                    s3Url: s3Url,
                    testedAt: new Date().toISOString()
                },
                summary: {
                    downloadSucceeded: debugLog.some(log => log.message.includes('S3 다운로드 완료')),
                    tarExtractionAttempted: debugLog.some(log => log.message.includes('TAR 압축 해제')),
                    tarExtractionSucceeded: debugLog.some(log => log.message.includes('TAR 압축 해제 완료')),
                    projectJsonFound: debugLog.some(log => log.message.includes('project.json 발견')),
                    parsingSucceeded: debugLog.some(log => log.message.includes('project.json 파싱 완료'))
                }
            });
            
        } catch (testError) {
            // 콘솔 복원
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            
            console.error('🧪 === ENT 파일 디버그 테스트 오류 ===');
            console.error('❌ 테스트 오류:', testError);
            
            res.status(500).json({
                success: false,
                error: testError.message,
                debugInfo: {
                    loadTime: Date.now() - startTime,
                    totalSteps: debugLog.length,
                    debugLog: debugLog,
                    s3Url: s3Url,
                    testedAt: new Date().toISOString()
                },
                summary: {
                    downloadSucceeded: debugLog.some(log => log.message.includes('S3 다운로드 완료')),
                    tarExtractionAttempted: debugLog.some(log => log.message.includes('TAR 압축 해제')),
                    tarExtractionSucceeded: debugLog.some(log => log.message.includes('TAR 압축 해제 완료')),
                    projectJsonFound: debugLog.some(log => log.message.includes('project.json 발견')),
                    parsingSucceeded: debugLog.some(log => log.message.includes('project.json 파싱 완료'))
                }
            });
        }
        
    } catch (error) {
        console.error('🧪 디버그 테스트 설정 오류:', error);
        res.status(500).json({
            success: false,
            error: '디버그 테스트 설정 오류',
            details: error.message
        });
    }
});

/**
 * GET /api/debug/ent/download-only
 * S3 다운로드만 테스트
 */
router.get('/download-only', async (req, res) => {
    try {
        const { s3Url } = req.query;
        
        if (!s3Url) {
            return res.status(400).json({
                success: false,
                error: 'S3 URL이 필요합니다.'
            });
        }
        
        console.log('🌐 S3 다운로드 테스트:', s3Url);
        
        const entFileManager = new EntFileManager();
        const startTime = Date.now();
        
        try {
            const buffer = await entFileManager.downloadFromS3(s3Url);
            const downloadTime = Date.now() - startTime;
            
            // 파일 헤더 분석 (처음 100바이트)
            const header = buffer.slice(0, 100);
            const headerHex = header.toString('hex');
            const headerText = header.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
            
            res.json({
                success: true,
                downloadInfo: {
                    fileSize: buffer.length,
                    fileSizeKB: Math.round(buffer.length / 1024 * 100) / 100,
                    downloadTime: downloadTime,
                    s3Url: s3Url
                },
                fileAnalysis: {
                    headerHex: headerHex,
                    headerText: headerText,
                    isTarFile: headerHex.includes('7573746172') || headerText.includes('ustar'),
                    firstBytes: Array.from(header.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')
                }
            });
            
        } catch (downloadError) {
            res.status(502).json({
                success: false,
                error: 'S3 다운로드 실패',
                details: downloadError.message,
                downloadTime: Date.now() - startTime
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/debug/ent/parse-only
 * 다운로드된 파일의 TAR 파싱만 테스트
 */
router.get('/parse-only', async (req, res) => {
    try {
        const { s3Url } = req.query;
        
        if (!s3Url) {
            return res.status(400).json({
                success: false,
                error: 'S3 URL이 필요합니다.'
            });
        }
        
        console.log('🔧 TAR 파싱 테스트:', s3Url);
        
        const entFileManager = new EntFileManager();
        
        try {
            // 1단계: 다운로드
            const buffer = await entFileManager.downloadFromS3(s3Url);
            console.log('✅ 다운로드 완료:', buffer.length, 'bytes');
            
            // 2단계: 파싱 시도
            const parseStartTime = Date.now();
            const projectData = await entFileManager.parseEntFile(buffer);
            const parseTime = Date.now() - parseStartTime;
            
            res.json({
                success: true,
                parseResult: {
                    parseTime: parseTime,
                    projectDataKeys: Object.keys(projectData),
                    objectCount: projectData.objects?.length || 0,
                    sceneCount: projectData.scenes?.length || 0,
                    variableCount: projectData.variables?.length || 0,
                    functionCount: projectData.functions?.length || 0
                },
                projectSample: {
                    // 프로젝트 데이터의 일부만 미리보기
                    objects: projectData.objects?.slice(0, 2).map(obj => ({
                        id: obj.id,
                        name: obj.name,
                        objectType: obj.objectType
                    })) || [],
                    scenes: projectData.scenes?.slice(0, 2).map(scene => ({
                        id: scene.id,
                        name: scene.name
                    })) || []
                }
            });
            
        } catch (parseError) {
            res.status(422).json({
                success: false,
                error: 'TAR 파싱 실패',
                details: parseError.message,
                stage: parseError.message.includes('다운로드') ? 'download' : 'parse'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/debug/ent/info
 * 디버그 도구 사용법 안내
 */
router.get('/info', (req, res) => {
    res.json({
        success: true,
        message: 'ENT 파일 디버깅 도구',
        endpoints: [
            {
                path: '/api/debug/ent/test-s3',
                description: '전체 S3 ENT 파일 로드 테스트 (상세 로그 포함)',
                usage: '/api/debug/ent/test-s3?s3Url=https://...',
                method: 'GET'
            },
            {
                path: '/api/debug/ent/download-only',
                description: 'S3 다운로드만 테스트',
                usage: '/api/debug/ent/download-only?s3Url=https://...',
                method: 'GET'
            },
            {
                path: '/api/debug/ent/parse-only',
                description: 'TAR 파싱만 테스트',
                usage: '/api/debug/ent/parse-only?s3Url=https://...',
                method: 'GET'
            }
        ],
        sampleS3Url: 'https://educodingnplaycontents.s3.amazonaws.com/ent/cpe1-1a.ent'
    });
});

module.exports = router;
