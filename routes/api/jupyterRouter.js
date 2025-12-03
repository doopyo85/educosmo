// /routes/api/jupyterRouter.js - 심플 버전 (사용자별 빈 노트북 생성 전용)

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Jupyter Notebook 서버 설정
const JUPYTER_PORT = 8000;
const JUPYTER_URL = `http://localhost:${JUPYTER_PORT}`;
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

// Jupyter 프로세스 관리
let jupyterProcess = null;

function startJupyterServer() {
    if (jupyterProcess) {
        console.log('Jupyter 서버가 이미 실행 중입니다.');
        return;
    }
    
    console.log('Jupyter Notebook 서버 시작 중...');
    
    const jupyterArgs = [
        'notebook',
        '--no-browser',
        '--allow-root',
        `--port=${JUPYTER_PORT}`,
        `--notebook-dir=${NOTEBOOKS_DIR}`,
        '--ip=0.0.0.0',
        '--NotebookApp.token=""',
        '--NotebookApp.password=""',
        '--NotebookApp.disable_check_xsrf=True'
    ];
    
    jupyterProcess = spawn('jupyter', jupyterArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
    });
    
    jupyterProcess.stdout.on('data', (data) => {
        console.log('Jupyter stdout:', data.toString());
    });
    
    jupyterProcess.stderr.on('data', (data) => {
        console.log('Jupyter stderr:', data.toString());
    });
    
    jupyterProcess.on('close', (code) => {
        console.log(`Jupyter 프로세스 종료, 코드: ${code}`);
        jupyterProcess = null;
    });
    
    jupyterProcess.on('error', (error) => {
        console.error('Jupyter 프로세스 오류:', error);
        jupyterProcess = null;
    });
    
    console.log(`Jupyter 서버 시작됨 (PID: ${jupyterProcess.pid})`);
}

function stopJupyterServer() {
    if (jupyterProcess) {
        console.log('Jupyter 서버 중지 중...');
        jupyterProcess.kill('SIGTERM');
        jupyterProcess = null;
    }
}

// 서버 시작 시 Jupyter 시작
startJupyterServer();

// 프로세스 종료 시 Jupyter 정리
process.on('exit', stopJupyterServer);
process.on('SIGINT', stopJupyterServer);
process.on('SIGTERM', stopJupyterServer);

// 사용자별 디렉토리 생성 함수
async function ensureUserDir(userID) {
    const userDir = path.join(NOTEBOOKS_DIR, userID);
    try {
        await fs.mkdir(userDir, { recursive: true });
        console.log(`사용자 디렉토리 생성/확인: ${userDir}`);
        return userDir;
    } catch (error) {
        console.error('사용자 디렉토리 생성 오류:', error);
        throw error;
    }
}

// 빈 노트북 생성 함수
async function createBlankNotebook(userID) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const filename = `${userID}_${timestamp}.ipynb`;
    const userDir = await ensureUserDir(userID);
    const filePath = path.join(userDir, filename);
    
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
                    `왼쪽 Content에서 내용을 복사해서 붙여넣으세요.`
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
                "version": "3.8.5"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 4
    };
    
    try {
        await fs.writeFile(filePath, JSON.stringify(blankNotebook, null, 2));
        console.log(`빈 노트북 생성 완료: ${filename}`);
        
        return {
            filename: filename,
            userDir: userDir,
            filePath: filePath,
            relativePath: path.join(userID, filename)
        };
    } catch (error) {
        console.error('빈 노트북 생성 오류:', error);
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
            message: 'Simple Jupyter Server - User Isolation',
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