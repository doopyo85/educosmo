const express = require('express');
const router = express.Router();
const db = require('../lib_login/db');
const { checkPageAccess } = require('../lib_login/authMiddleware');
const multer = require('multer');
const path = require('path');

// 멀터 설정 (메모리 스토리지)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 제한
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
        }
    }
});

// 날짜 포맷 함수
function formatDate(date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// 너구리톡 메인 페이지
router.get('/', checkPageAccess('/nuguritalk'), async (req, res) => {
    try {
        // 너구리톡 메시지들 가져오기 (최신순)
        const messagesQuery = `
            SELECT p.*, u.name as author_name
            FROM nuguritalk_posts p
            LEFT JOIN Users u ON p.author_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 100
        `;
        
        const messages = await db.queryDatabase(messagesQuery);
        
        const formattedMessages = messages.map(msg => ({
            ...msg,
            created_at: formatDate(msg.created_at),
            canDelete: (req.session.userID == msg.author_id) || 
                      ['admin', 'manager'].includes(req.session.role)
        }));
        
        res.render('nuguritalk', {
            messages: formattedMessages,
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID
        });
        
    } catch (error) {
        console.error('너구리톡 페이지 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

// 메시지 작성 처리
router.post('/write', checkPageAccess('/nuguritalk'), upload.single('image'), async (req, res) => {
    try {
        const { title } = req.body;
        
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: '메시지를 입력해주세요.' });
        }
        
        // 사용자 정보 가져오기
        const userResult = await db.queryDatabase(
            'SELECT id, name FROM Users WHERE userID = ?',
            [req.session.userID]
        );
        
        if (userResult.length === 0) {
            return res.status(401).json({ error: '사용자 정보를 찾을 수 없습니다.' });
        }
        
        const userId = userResult[0].id;
        const userName = userResult[0].name || req.session.userID;
        
        // 이미지 처리 (TODO: S3 업로드 구현)
        let imagePath = null;
        if (req.file) {
            imagePath = `uploads/nuguritalk/${Date.now()}_${req.file.originalname}`;
            // TODO: S3에 파일 업로드
        }
        
        // 메시지 저장
        await db.queryDatabase(`
            INSERT INTO nuguritalk_posts (title, content, author, author_id, image)
            VALUES (?, ?, ?, ?, ?)
        `, [title, title, userName, userId, imagePath]);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('메시지 작성 오류:', error);
        res.status(500).json({ error: '메시지 작성 중 오류가 발생했습니다.' });
    }
});

// 메시지 수정 페이지
router.get('/edit/:id', checkPageAccess('/nuguritalk'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // 메시지 정보 조회
        const messageQuery = `
            SELECT p.*, u.name as author_name
            FROM nuguritalk_posts p
            LEFT JOIN Users u ON p.author_id = u.id
            WHERE p.id = ?
        `;
        
        const messages = await db.queryDatabase(messageQuery, [id]);
        
        if (messages.length === 0) {
            return res.status(404).send('메시지를 찾을 수 없습니다.');
        }
        
        const message = messages[0];
        
        // 권한 체크
        const canEdit = (req.session.userID == message.author_id) || 
                       ['admin', 'manager'].includes(req.session.role);
        
        if (!canEdit) {
            return res.status(403).send('수정 권한이 없습니다.');
        }
        
        res.render('nuguritalk_edit', {
            message: {
                ...message,
                created_at: formatDate(message.created_at)
            },
            userID: req.session.userID,
            role: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID
        });
        
    } catch (error) {
        console.error('메시지 수정 페이지 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

// 메시지 수정 처리
router.post('/edit/:id', checkPageAccess('/nuguritalk'), upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        
        if (!title || title.trim() === '') {
            return res.status(400).json({ error: '메시지를 입력해주세요.' });
        }
        
        // 메시지 존재 및 권한 확인
        const messageQuery = `
            SELECT * FROM nuguritalk_posts WHERE id = ?
        `;
        
        const messages = await db.queryDatabase(messageQuery, [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
        }
        
        const message = messages[0];
        
        // 권한 체크
        const canEdit = (req.session.userID == message.author_id) || 
                       ['admin', 'manager'].includes(req.session.role);
        
        if (!canEdit) {
            return res.status(403).json({ error: '수정 권한이 없습니다.' });
        }
        
        // 이미지 처리
        let imagePath = message.image; // 기존 이미지 유지
        if (req.file) {
            imagePath = `uploads/nuguritalk/${Date.now()}_${req.file.originalname}`;
            // TODO: S3에 새 파일 업로드 및 기존 파일 삭제
        }
        
        // 메시지 업데이트
        await db.queryDatabase(`
            UPDATE nuguritalk_posts 
            SET title = ?, content = ?, image = ?
            WHERE id = ?
        `, [title, title, imagePath, id]);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('메시지 수정 오류:', error);
        res.status(500).json({ error: '메시지 수정 중 오류가 발생했습니다.' });
    }
});

// 메시지 삭제
router.get('/delete/:id', checkPageAccess('/nuguritalk'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // 메시지 존재 및 권한 확인
        const messageQuery = `
            SELECT * FROM nuguritalk_posts WHERE id = ?
        `;
        
        const messages = await db.queryDatabase(messageQuery, [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
        }
        
        const message = messages[0];
        
        // 권한 체크
        const canDelete = (req.session.userID == message.author_id) || 
                         ['admin', 'manager'].includes(req.session.role);
        
        if (!canDelete) {
            return res.status(403).json({ error: '삭제 권한이 없습니다.' });
        }
        
        // 메시지 삭제
        await db.queryDatabase('DELETE FROM nuguritalk_posts WHERE id = ?', [id]);
        
        // TODO: S3에서 이미지 파일 삭제
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('메시지 삭제 오류:', error);
        res.status(500).json({ error: '메시지 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;