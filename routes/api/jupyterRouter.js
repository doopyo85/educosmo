// /routes/api/jupyterRouter.js - 심플 버전 (사용자별 빈 노트북 생성 전용)

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Jupyter Notebook 서버 설정
const JUPYTER_HOST = process.env.JUPYTER_HOST || 'localhost';
const JUPYTER_PORT = process.env.JUPYTER_PORT || 8889;
const JUPYTER_URL = `http://${JUPYTER_HOST}:${JUPYTER_PORT}`;
const NOTEBOOKS_DIR = path.join(__dirname, '../../jupyter_notebooks');

// 권한 체크 미들웨어
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.is_logined) {
        return res.status(401).json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }
    next();
};

// Jupyter 프로세스 관리 (제거됨 - Docker 서비스로 대체)
// let jupyterProcess = null;

// S3 Manager 인스턴스 (필요 시 require 위치 조정)
const S3Manager = require('../../lib_storage/s3Manager');
const s3Manager = new S3Manager();

// 사용자별 디렉토리 생성 함수 (S3에서는 폴더 개념이 가상이므로 실제 생성 불필요, 체크만)
async function ensureUserDir(userID) {
    const userPrefix = `users/${userID}/jupyter/`;
    try {
        // S3에서는 폴더를 명시적으로 생성할 필요가 없지만, 
        // 사용자 존재 여부나 권한 체크를 위해 list를 한번 해볼 수 있음.
        // 여기서는 단순히 경로만 반환.
        return userPrefix;
    } catch (error) {
        console.error('사용자 디렉토리 확인 오류:', error);
        throw error;
    }
}

// Import checkFileExists
const { uploadBufferToS3, checkFileExists } = require('../../lib_board/s3Utils');

// 빈 노트북 생성 함수 (S3 업로드) -> 이제는 "사용자 노트북 가져오기/생성" 역할
async function createBlankNotebook(userID) {
    // 🔥 Timestamp 제거 -> 고정 파일명 사용
    const filename = `${userID}.ipynb`;
    // 🔥 유저 폴더 내 jupyter 서브 폴더에 저장
    const s3Key = `users/${userID}/jupyter/${filename}`;
    const relativePath = path.join('users', userID, 'jupyter', filename);

    try {
        // 1. 이미 존재하는지 확인 (Persistent Storage)
        const exists = await checkFileExists(s3Key);

        if (exists) {
            console.log(`기존 노트북 발견: ${s3Key}`);
            return {
                filename: filename,
                s3Key: s3Key,
                relativePath: relativePath,
                isNew: false
            };
        }

        // 2. 없으면 생성
        // 빈 노트북 구조
        const blankNotebook = {
            "cells": [
                {
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": [
                        `# ${userID}님의 노트북\n`,
                        `\n`,
                        `생성일: ${new Date().toLocaleString('ko-KR')}\n`,
                        `\n`,
                        `이 파일은 고정된 개인 노트북입니다.`
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

        const buffer = Buffer.from(JSON.stringify(blankNotebook, null, 2));

        // S3에 직접 업로드
        await uploadBufferToS3(buffer, s3Key, 'application/json');

        console.log(`새 고정 노트북 S3 생성 완료: ${s3Key}`);

        return {
            filename: filename,
            s3Key: s3Key,
            relativePath: relativePath,
            isNew: true
        };
    } catch (error) {
        console.error('노트북 확인/생성 오류 (S3):', error);
        throw error;
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
            message: 'External Jupyter Server (PM2 Managed)',
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

// 사용자별 빈 노트북 생성 (핵심 API)
router.post('/create-blank-notebook', requireAuth, async (req, res) => {
    try {
        const userID = req.session?.userID || req.body.userID || 'guest';

        console.log(`빈 노트북 생성 요청: ${userID}`);

        // 사용자별 빈 노트북 생성
        const result = await createBlankNotebook(userID);

        res.json({
            success: true,
            notebook: result.filename,
            notebookUrl: `/jupyter/notebooks/${result.relativePath}`,
            userID: userID,
            message: `${userID}님의 새 노트북이 생성되었습니다.`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('빈 노트북 생성 API 오류:', error);
        res.status(500).json({
            success: false,
            error: '노트북 생성에 실패했습니다.',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 사용자 노트북 목록 조회
router.get('/user-notebooks', requireAuth, async (req, res) => {
    try {
        const userID = req.session?.userID || req.query.userID || 'guest';
        const userDir = path.join(NOTEBOOKS_DIR, userID);

        console.log(`사용자 노트북 목록 조회: ${userID}`);

        try {
            const files = await fs.readdir(userDir);
            const notebooks = files.filter(file => file.endsWith('.ipynb'));

            res.json({
                success: true,
                userID: userID,
                notebooks: notebooks,
                count: notebooks.length
            });
        } catch (error) {
            // 디렉토리가 없으면 빈 배열 반환
            res.json({
                success: true,
                userID: userID,
                notebooks: [],
                count: 0
            });
        }

    } catch (error) {
        console.error('사용자 노트북 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '노트북 목록을 가져올 수 없습니다.',
            details: error.message
        });
    }
});

// Jupyter 서버 재시작
router.post('/restart', (req, res) => {
    console.log('Jupyter 서버 재시작 요청');

    stopJupyterServer();

    setTimeout(() => {
        startJupyterServer();
        res.json({
            success: true,
            message: 'Jupyter 서버가 재시작되었습니다.'
        });
    }, 2000);
});

module.exports = router;