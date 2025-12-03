const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const BASE_NOTEBOOK_DIR = path.join(__dirname, '..', 'jupyter_notebooks');

// 사용자 디렉토리 경로 생성기
const getUserNotebookDir = (userId) => {
    return path.join(BASE_NOTEBOOK_DIR, userId);
};

// 노트북 목록 반환
const getNotebookList = async (userId) => {
    const userDir = getUserNotebookDir(userId);

    // 디렉토리가 없다면 빈 배열 반환
    if (!fs.existsSync(userDir)) {
        return [];
    }

    const files = await fs.promises.readdir(userDir);
    return files.filter(file => file.endsWith('.ipynb'));
};

// 노트북 삭제
const deleteNotebook = async (userId, filename) => {
    const filePath = path.join(getUserNotebookDir(userId), filename);
    if (!fs.existsSync(filePath)) {
        throw new Error('Notebook not found');
    }
    await fs.promises.unlink(filePath);
};

// 노트북 저장 (쓰기)
const saveNotebook = async (userId, filename, content) => {
    const userDir = getUserNotebookDir(userId);
    await fse.ensureDir(userDir); // 디렉토리 없으면 생성
    const filePath = path.join(userDir, filename);
    await fs.promises.writeFile(filePath, content, 'utf-8');
};

// 노트북 읽기
const readNotebook = async (userId, filename) => {
    const filePath = path.join(getUserNotebookDir(userId), filename);
    if (!fs.existsSync(filePath)) {
        throw new Error('Notebook not found');
    }
    return fs.promises.readFile(filePath, 'utf-8');
};

// 사용자 디렉토리 강제로 생성 (최초 접속 시 호출용)
const ensureUserDir = async (userId) => {
    const dir = getUserNotebookDir(userId);
    await fse.ensureDir(dir);
};

module.exports = {
    getNotebookList,
    deleteNotebook,
    saveNotebook,
    readNotebook,
    ensureUserDir,
    getUserNotebookDir,
};
