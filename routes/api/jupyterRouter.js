// /routes/api/jupyterRouter.js - NCP S3 통합 버전 (사용자별 격리)

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Jupyter Notebook 서버 설정
const JUPYTER_HOST = process.env.JUPYTER_HOST || 'localhost';
const JUPYTER_PORT = process.env.JUPYTER_PORT || 8889;
const JUPYTER_URL = `http://${JUPYTER_HOST}:${JUPYTER_PORT}`;
const NOTEBOOKS_DIR = path.join(__dirname, '../../jupyter_notebooks');
const SESSIONS_DIR = path.join(NOTEBOOKS_DIR, 'sessions');

// S3 Manager 인스턴스
const S3Manager = require('../../lib_storage/s3Manager');
const s3Manager = new S3Manager();

// 권한 체크 미들웨어 (임시로 완화)
const requireAuth = (req, res, next) => {
    // 🔥 임시: 세션 없어도 진행 (개발 중)
    if (!req.session) {
        req.session = {};
    }
    next();
};

// =====================================================================
// 유틸리티 함수들
// =====================================================================

/**
 * 세션 ID 생성
 */
function generateSessionID() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * 빈 노트북 템플릿 생성
 */
function createBlankNotebookTemplate(userID) {
    return {
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    `# ${userID}님의 Jupyter Notebook\n`,
                    `\n`,
                    `생성일: ${new Date().toLocaleString('ko-KR')}\n`,
                    `\n`,
                    `이 노트북은 자동으로 NCP Object Storage에 저장됩니다.`
                ]
            },
            {
                "cell_type": "code",
                "execution_count": null,
                "metadata": {},
                "outputs": [],
                "source": [
                    "# 여기에 코드를 입력하세요\n",
                    "print('Hello, Jupyter!')"
                ]
            }
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "name": "python",
                "version": "3.10.0"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 4
    };
}

/**
 * S3에서 노트북 다운로드 또는 새로 생성
 */
async function getOrCreateNotebookFromS3(userID) {
    const filename = `${userID}.ipynb`;
    const s3Key = `users/${userID}/jupyter/${filename}`;

    try {
        // S3에서 노트북 다운로드 시도
        console.log(`📥 S3에서 노트북 다운로드 시도: ${s3Key}`);
        const buffer = await s3Manager.downloadProject(s3Key);
        const notebookContent = JSON.parse(buffer.toString('utf-8'));

        console.log(`✅ S3에서 노트북 다운로드 성공: ${s3Key}`);
        return {
            content: notebookContent,
            filename: filename,
            s3Key: s3Key,
            isNew: false
        };
    } catch (error) {
        // 파일이 없으면 새로 생성
        console.log(`📝 S3에 노트북이 없음, 새로 생성: ${s3Key}`);
        const blankNotebook = createBlankNotebookTemplate(userID);

        return {
            content: blankNotebook,
            filename: filename,
            s3Key: s3Key,
            isNew: true
        };
    }
}

/**
 * 세션별 임시 디렉토리에 노트북 저장
 */
async function saveNotebookToSession(sessionID, filename, content) {
    const sessionDir = path.join(SESSIONS_DIR, sessionID);
    const filePath = path.join(sessionDir, filename);

    // 디렉토리 생성
    await fs.mkdir(sessionDir, { recursive: true });

    // 노트북 저장
    const notebookJson = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await fs.writeFile(filePath, notebookJson, 'utf8');

    console.log(`💾 세션 디렉토리에 노트북 저장: ${filePath}`);

    return {
        sessionDir: sessionDir,
        filePath: filePath,
        relativePath: `sessions/${sessionID}/${filename}`
    };
}

/**
 * 세션 디렉토리의 노트북을 S3에 업로드
 */
async function uploadNotebookToS3(sessionID, filename, s3Key) {
    const filePath = path.join(SESSIONS_DIR, sessionID, filename);

    try {
        // 로컬 파일 읽기
        const fileContent = await fs.readFile(filePath, 'utf8');
        const buffer = Buffer.from(fileContent, 'utf8');

        // S3 업로드
        console.log(`📤 S3에 노트북 업로드 시작: ${s3Key}`);
        const s3Url = await s3Manager.uploadProject(s3Key, buffer, 'application/json');

        console.log(`✅ S3에 노트북 업로드 완료: ${s3Url}`);

        return {
            success: true,
            s3Url: s3Url,
            s3Key: s3Key,
            fileSize: buffer.length
        };
    } catch (error) {
        console.error(`❌ S3 업로드 실패: ${s3Key}`, error);
        throw error;
    }
}

/**
 * 세션 정리 (임시 파일 삭제)
 */
async function cleanupSession(sessionID) {
    const sessionDir = path.join(SESSIONS_DIR, sessionID);

    try {
        await fs.rm(sessionDir, { recursive: true, force: true });
        console.log(`🗑️ 세션 정리 완료: ${sessionID}`);
        return true;
    } catch (error) {
        console.error(`❌ 세션 정리 실패: ${sessionID}`, error);
        return false;
    }
}

/**
 * 오래된 세션 자동 정리 (1시간 이상)
 */
async function cleanupOldSessions() {
    try {
        await fs.mkdir(SESSIONS_DIR, { recursive: true });
        const sessions = await fs.readdir(SESSIONS_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        let cleanedCount = 0;

        for (const sessionID of sessions) {
            const sessionDir = path.join(SESSIONS_DIR, sessionID);
            const stats = await fs.stat(sessionDir);
            const age = now - stats.mtimeMs;

            if (age > oneHour) {
                await cleanupSession(sessionID);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🗑️ 오래된 세션 ${cleanedCount}개 정리 완료`);
        }

        return cleanedCount;
    } catch (error) {
        console.error('세션 자동 정리 오류:', error);
        return 0;
    }
}

// =====================================================================
// API 라우트들
// =====================================================================

// Jupyter 서버 상태 확인
router.get('/status', async (req, res) => {
    try {
        res.json({
            status: 'online',
            port: JUPYTER_PORT,
            url: JUPYTER_URL,
            proxy_url: '/jupyter',
            notebooks_dir: NOTEBOOKS_DIR,
            sessions_dir: SESSIONS_DIR,
            storage: 'NCP Object Storage (S3)',
            message: 'Jupyter with NCP S3 Integration',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Jupyter 상태 확인 오류:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 🔥 핵심 API: S3에서 노트북 로드 + 세션 생성 + Jupyter 리다이렉트
 */
router.post('/load-notebook', requireAuth, async (req, res) => {
    try {
        const userID = req.session?.userID || req.body.userID || 'testuser';
        const sessionID = req.sessionID || generateSessionID();

        console.log(`\n========== Jupyter 노트북 로드 ==========`);
        console.log(`👤 사용자: ${userID}`);
        console.log(`🔑 세션: ${sessionID}`);

        // 1. S3에서 노트북 가져오기 (없으면 새로 생성)
        const notebook = await getOrCreateNotebookFromS3(userID);

        // 2. 세션별 임시 디렉토리에 저장
        const saved = await saveNotebookToSession(sessionID, notebook.filename, notebook.content);

        // 3. 새 노트북이면 S3에 업로드
        if (notebook.isNew) {
            await uploadNotebookToS3(sessionID, notebook.filename, notebook.s3Key);
        }

        // 4. Jupyter URL 생성 (base_url이 /jupyter/로 끝나므로 앞에 / 제거)
        const notebookUrl = `/jupyter/notebooks/${saved.relativePath}`;
        // 🔥 수정: iframe에서 사용할 때는 상대 경로로 (이중 슬래시 방지)
        const iframeUrl = `notebooks/${saved.relativePath}`;

        console.log(`📍 Jupyter URL: ${notebookUrl}`);
        console.log(`==========================================\n`);

        res.json({
            success: true,
            sessionID: sessionID,
            userID: userID,
            notebook: notebook.filename,
            notebookUrl: iframeUrl, // 🔥 상대 경로 사용 (이중 슬래시 방지)
            s3Key: notebook.s3Key,
            isNew: notebook.isNew,
            message: notebook.isNew ? '새 노트북이 생성되었습니다.' : '기존 노트북을 불러왔습니다.',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ 노트북 로드 실패:', error);
        res.status(500).json({
            success: false,
            error: '노트북을 불러오는데 실패했습니다.',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 노트북 저장 (임시 디렉토리 → S3)
 */
router.post('/save-notebook', requireAuth, async (req, res) => {
    try {
        const { sessionID, userID, filename } = req.body;

        if (!sessionID || !userID || !filename) {
            return res.status(400).json({
                success: false,
                error: 'sessionID, userID, filename이 필요합니다.'
            });
        }

        console.log(`💾 노트북 저장 요청: ${userID}/${filename} (세션: ${sessionID})`);

        const s3Key = `users/${userID}/jupyter/${filename}`;
        const result = await uploadNotebookToS3(sessionID, filename, s3Key);

        res.json({
            success: true,
            message: '노트북이 저장되었습니다.',
            s3Url: result.s3Url,
            s3Key: result.s3Key,
            fileSize: result.fileSize,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ 노트북 저장 실패:', error);
        res.status(500).json({
            success: false,
            error: '노트북 저장에 실패했습니다.',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 세션 종료 (임시 파일 삭제)
 */
router.delete('/session/:sessionID', requireAuth, async (req, res) => {
    try {
        const { sessionID } = req.params;

        console.log(`🗑️ 세션 종료 요청: ${sessionID}`);

        const cleaned = await cleanupSession(sessionID);

        res.json({
            success: cleaned,
            message: cleaned ? '세션이 종료되었습니다.' : '세션을 찾을 수 없습니다.',
            sessionID: sessionID,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ 세션 종료 실패:', error);
        res.status(500).json({
            success: false,
            error: '세션 종료에 실패했습니다.',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 오래된 세션 자동 정리 (관리자용)
 */
router.post('/cleanup-sessions', async (req, res) => {
    try {
        const cleanedCount = await cleanupOldSessions();

        res.json({
            success: true,
            message: `${cleanedCount}개의 세션이 정리되었습니다.`,
            cleanedCount: cleanedCount,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ 세션 정리 실패:', error);
        res.status(500).json({
            success: false,
            error: '세션 정리에 실패했습니다.',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// =====================================================================
// 백그라운드 작업: 자동 세션 정리 (1시간마다)
// =====================================================================
setInterval(() => {
    cleanupOldSessions().catch(err => {
        console.error('자동 세션 정리 오류:', err);
    });
}, 60 * 60 * 1000); // 1시간

// 초기 세션 디렉토리 생성
fs.mkdir(SESSIONS_DIR, { recursive: true }).catch(err => {
    console.error('세션 디렉토리 생성 실패:', err);
});

module.exports = router;
