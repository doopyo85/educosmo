const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const EntFileManager = require('../../lib_entry/entFileManager');

// EntFileManager 인스턴스 생성
const entFileManager = new EntFileManager();

/**
 * POST /api/entry/save-ent
 * ENT 파일 생성 및 다운로드 URL 반환
 */
router.post('/save-ent', async (req, res) => {
    try {
        console.log('ENT 파일 저장 요청 받음');
        
        const { projectData, fileName, includeAssets = false } = req.body;
        const userID = req.session?.userID || 'anonymous';

        // 입력 검증
        if (!projectData) {
            return res.status(400).json({
                success: false,
                error: '프로젝트 데이터가 필요합니다.'
            });
        }

        if (!fileName || typeof fileName !== 'string') {
            return res.status(400).json({
                success: false,
                error: '유효한 파일명이 필요합니다.'
            });
        }

        console.log(`ENT 파일 생성 시작: ${fileName}, 사용자: ${userID}`);

        // Phase 1: Assets 포함하지 않음
        if (includeAssets) {
            console.log('Phase 1에서는 Assets 포함하지 않습니다. project.json만 생성합니다.');
        }

        // ENT 파일 생성
        const result = await entFileManager.createEntFile(projectData, fileName, userID);

        // 성공 응답
        const response = {
            success: true,
            downloadUrl: `/api/entry/download-ent/${encodeURIComponent(result.fileName)}`,
            fileName: result.fileName,
            fileSize: result.fileSize,
            expiresAt: result.expiresAt,
            message: 'ENT 파일이 성공적으로 생성되었습니다.'
        };

        console.log('ENT 파일 생성 성공:', response);
        res.json(response);

    } catch (error) {
        console.error('ENT 파일 생성 API 오류:', error);
        
        res.status(500).json({
            success: false,
            error: 'ENT 파일 생성 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * GET /api/entry/download-ent/:fileName
 * ENT 파일 다운로드
 */
router.get('/download-ent/:fileName', async (req, res) => {
    try {
        const fileName = decodeURIComponent(req.params.fileName);
        console.log(`ENT 파일 다운로드 요청: ${fileName}`);

        // 파일 존재 확인
        const fileInfo = await entFileManager.checkEntFileExists(fileName);
        
        if (!fileInfo.exists) {
            console.log(`파일을 찾을 수 없음: ${fileName}`);
            return res.status(404).json({
                success: false,
                error: '파일을 찾을 수 없습니다. 파일이 만료되었거나 존재하지 않습니다.'
            });
        }

        // 파일 크기 검증
        try {
            entFileManager.validateFileSize(fileInfo.filePath);
        } catch (error) {
            console.error('파일 크기 검증 실패:', error);
            return res.status(413).json({
                success: false,
                error: error.message
            });
        }

        // 다운로드용 파일명 생성 (사용자 친화적)
        const originalProjectName = fileName
            .replace(/^[^_]*_[^_]*_/, '') // userID_timestamp_ 제거
            .replace(/\.ent$/, ''); // .ent 제거
        
        const downloadFileName = `${originalProjectName}.ent`;

        // 파일 다운로드 헤더 설정
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);
        res.setHeader('Content-Length', fileInfo.fileSize);
        res.setHeader('Cache-Control', 'no-cache');

        console.log(`파일 다운로드 시작: ${fileName} → ${downloadFileName}`);

        // 파일 스트리밍
        const fileStream = require('fs').createReadStream(fileInfo.filePath);
        
        fileStream.on('error', (error) => {
            console.error('파일 스트리밍 오류:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: '파일 다운로드 중 오류가 발생했습니다.'
                });
            }
        });

        fileStream.on('end', () => {
            console.log(`파일 다운로드 완료: ${fileName}`);
        });

        // 파일 전송
        fileStream.pipe(res);

    } catch (error) {
        console.error('ENT 파일 다운로드 API 오류:', error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: '파일 다운로드 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    }
});

/**
 * GET /api/entry/check-ent/:fileName
 * ENT 파일 존재 여부 확인 (디버깅용)
 */
router.get('/check-ent/:fileName', async (req, res) => {
    try {
        const fileName = decodeURIComponent(req.params.fileName);
        console.log(`ENT 파일 존재 확인: ${fileName}`);

        const fileInfo = await entFileManager.checkEntFileExists(fileName);
        
        res.json({
            success: true,
            fileName: fileName,
            exists: fileInfo.exists,
            fileInfo: fileInfo.exists ? {
                filePath: fileInfo.filePath,
                fileSize: fileInfo.fileSize,
                createdAt: fileInfo.createdAt,
                modifiedAt: fileInfo.modifiedAt
            } : null,
            error: fileInfo.error || null
        });

    } catch (error) {
        console.error('ENT 파일 확인 API 오류:', error);
        
        res.status(500).json({
            success: false,
            error: '파일 확인 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 🔥 GET /api/entry/load-project
 * S3 ENT 파일 로드 API - 심볼릭 링크 버전
 */
router.get('/load-project', async (req, res) => {
    try {
        const { s3Url } = req.query;

        console.log('🚀 S3 ENT 파일 로드 시작:', s3Url);

        // 1. 유효성 검사
        if (!s3Url) {
            return res.status(400).json({
                success: false,
                error: 'S3 URL이 필요합니다.',
                code: 'MISSING_S3_URL'
            });
        }

        // 2. ENT 파일 로드 실행 (심볼릭 링크 방식)
        const result = await entFileManager.loadProjectFromS3(s3Url);

        if (result.success) {
            // ✅ 심볼릭 링크 생성 완료 - 추가 처리 불필요
            console.log(`✅ 심볼릭 링크 생성됨: ${result.linkPath}`);

            // ✅ 썸네일 경로 "/entry/temp/..." 로 보정
            if (result.projectData && Array.isArray(result.projectData.objects)) {
                result.projectData.objects.forEach(obj => {
                    // 썸네일 경로를 Apache Alias와 매칭되도록 수정
                    if (obj.thumbnail && !obj.thumbnail.startsWith('/entry/temp/')) {
                        if (obj.thumbnail.startsWith('temp/')) {
                            obj.thumbnail = '/entry/' + obj.thumbnail;
                        } else if (obj.thumbnail.startsWith('/temp/')) {
                            obj.thumbnail = '/entry' + obj.thumbnail;
                        }
                    }
                    
                    // pictures 배열의 경로도 수정
                    if (obj.pictures && Array.isArray(obj.pictures)) {
                        obj.pictures.forEach(pic => {
                            if (pic.filename && !pic.fileurl) {
                                // EntryJS 표준 경로 생성
                                const prefix = pic.filename.substr(0, 4);
                                const pathPrefix = `${prefix.substr(0, 2)}/${prefix.substr(2, 2)}`;
                                pic.fileurl = `/entry/temp/${pathPrefix}/image/${pic.filename}.${pic.imageType || 'png'}`;
                            }
                        });
                    }
                });
            }

            // ✅ 결과 응답
            res.json({
                success: true,
                projectData: result.projectData,
                metadata: {
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    fileSizeKB: Math.round(result.fileSize / 1024 * 100) / 100,
                    loadTime: result.loadTime,
                    loadedAt: result.loadedAt,
                    s3Url: s3Url,
                    linkPath: result.linkPath,
                    linkType: 'symbolic_link',
                    stats: result.metadata
                },
                message: 'ENT 파일이 성공적으로 로드되었습니다. (심볼릭 링크)'
            });

        } else {
            console.error('❌ ENT 파일 로드 실패:', result.error);

            res.status(422).json({
                success: false,
                error: result.error || 'ENT 파일 로드 실패',
                code: 'LOAD_FAIL'
            });
        }

    } catch (err) {
        console.error('❌ ENT 파일 로드 처리 중 오류:', err);

        res.status(500).json({
            success: false,
            error: 'ENT 파일을 로드하는 중 서버 오류가 발생했습니다.',
            details: err.message
        });
    }
});



/**
 * POST /api/entry/cleanup-temp-files
 * 임시 파일 수동 정리 (관리자용)
 */
router.post('/cleanup-temp-files', async (req, res) => {
    try {
        // 관리자 권한 확인
        if (!['admin', 'manager'].includes(req.session?.role)) {
            return res.status(403).json({
                success: false,
                error: '관리자 권한이 필요합니다.'
            });
        }

        console.log('임시 파일 수동 정리 요청');
        
        const cleanedCount = await entFileManager.cleanupExpiredFiles();
        
        res.json({
            success: true,
            message: `${cleanedCount}개의 만료된 파일이 정리되었습니다.`,
            cleanedCount: cleanedCount
        });

    } catch (error) {
        console.error('임시 파일 정리 API 오류:', error);
        
        res.status(500).json({
            success: false,
            error: '파일 정리 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * GET /api/entry/temp-files-status
 * 임시 파일 상태 조회 (관리자용)
 */
router.get('/temp-files-status', async (req, res) => {
    try {
        // 관리자 권한 확인
        if (!['admin', 'manager'].includes(req.session?.role)) {
            return res.status(403).json({
                success: false,
                error: '관리자 권한이 필요합니다.'
            });
        }

        const tempDir = path.join(__dirname, '..', '..', 'temp', 'ent_files');
        
        try {
            const files = await fs.readdir(tempDir);
            const entFiles = files.filter(file => file.endsWith('.ent'));
            
            let totalSize = 0;
            let expiredCount = 0;
            const now = Date.now();
            const fileDetails = [];

            for (const file of entFiles) {
                const filePath = path.join(tempDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    const fileAge = now - stats.birthtime.getTime();
                    const isExpired = fileAge > (30 * 60 * 1000); // 30분

                    totalSize += stats.size;
                    if (isExpired) expiredCount++;

                    fileDetails.push({
                        fileName: file,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        age: Math.round(fileAge / 1000 / 60), // 분 단위
                        isExpired: isExpired
                    });
                } catch (statError) {
                    console.error(`파일 상태 확인 오류: ${file}`, statError);
                }
            }

            res.json({
                success: true,
                status: {
                    totalFiles: entFiles.length,
                    totalSize: totalSize,
                    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                    expiredCount: expiredCount,
                    activeCount: entFiles.length - expiredCount
                },
                files: fileDetails.sort((a, b) => b.createdAt - a.createdAt) // 최신순
            });

        } catch (dirError) {
            console.error('임시 디렉토리 읽기 오류:', dirError);
            res.json({
                success: true,
                status: {
                    totalFiles: 0,
                    totalSize: 0,
                    expiredCount: 0,
                    activeCount: 0,
                    error: '임시 디렉토리에 접근할 수 없습니다.'
                },
                files: []
            });
        }

    } catch (error) {
        console.error('임시 파일 상태 조회 API 오류:', error);
        
        res.status(500).json({
            success: false,
            error: '상태 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 에러 핸들링 미들웨어
 */
router.use((err, req, res, next) => {
    console.error('EntryFileRouter 오류:', err);
    
    res.status(500).json({
        success: false,
        error: '서버 내부 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = router;
