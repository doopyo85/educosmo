/**
 * 갤러리 라우터
 * 친구들 작품 갤러리 페이지 렌더링
 */

const express = require('express');
const router = express.Router();

// 인증 미들웨어
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.is_logined) {
        return res.redirect('/auth/login');
    }
    next();
};

/**
 * 갤러리 메인 페이지 - 유저 프로필 격자
 * GET /gallery
 */
router.get('/', requireAuth, (req, res) => {
    res.render('gallery', {
        userID: req.session.userID,
        role: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID,
        pageTitle: '친구들 갤러리'
    });
});

/**
 * 특정 유저의 갤러리 페이지
 * GET /gallery/user/:userId
 */
router.get('/user/:userId', requireAuth, (req, res) => {
    const { userId } = req.params;
    
    res.render('gallery-user', {
        userID: req.session.userID,
        role: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID,
        targetUserId: userId,
        pageTitle: `${userId}님의 갤러리`
    });
});

/**
 * 내 포트폴리오 페이지 (공유 관리)
 * GET /gallery/my
 */
router.get('/my', requireAuth, (req, res) => {
    res.render('portfolio/my-gallery', {
        userID: req.session.userID,
        role: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID,
        pageTitle: '내 포트폴리오'
    });
});

module.exports = router;
