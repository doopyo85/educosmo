// 🔧 임시 로컬 파일 업로드 설정
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateUser } = require('../../lib_login/authMiddleware');

// 로컬 저장소 설정
const localStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../public/uploads/images');
        
        // 디렉토리가 없으면 생성
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'image-' + uniqueSuffix + ext);
    }
});

// 로컬 이미지 업로드 설정
const localImageUpload = multer({
    storage: localStorage,
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// 임시 로컬 이미지 업로드 API
router.post('/upload-local', authenticateUser, (req, res) => {
    localImageUpload.single('upload')(req, res, (err) => {
        if (err) {
            console.error('로컬 이미지 업로드 오류:', err);
            return res.status(400).json({
                error: {
                    message: err.message
                }
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                error: {
                    message: '업로드할 이미지를 선택해주세요.'
                }
            });
        }
        
        // 로컬 파일 URL 생성
        const imageUrl = `/uploads/images/${req.file.filename}`;
        
        console.log('로컬 이미지 업로드 성공:', {
            originalName: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            url: imageUrl
        });
        
        // CKEditor 응답 형식
        res.json({
            url: imageUrl,
            uploaded: true,
            fileName: req.file.originalname
        });
    });
});

module.exports = router;
