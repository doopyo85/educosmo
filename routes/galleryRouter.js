/**
 * 갤러리 페이지 라우터
 * 스크래치/엔트리 프로젝트 공유 갤러리
 * 
 * @route /gallery
 */

const express = require('express');
const router = express.Router();

// 인증 필수
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.is_logined) {
        return res.redirect('/auth/login');
    }
    next();
};

// 인증 선택 (비로그인도 공개 갤러리 조회 가능)
const optionalAuth = (req, res, next) => {
    next();
};

/**
 * 갤러리 메인 페이지 - 프로젝트 카드 그리드
 * GET /gallery
 */
router.get('/', optionalAuth, (req, res) => {
    res.render('gallery', {
        userID: req.session?.userID || null,
        role: req.session?.role || 'guest',
        is_logined: req.session?.is_logined || false,
        centerID: req.session?.centerID || null,
        pageTitle: '친구들 갤러리'
    });
});

/**
 * 특정 유저의 갤러리 페이지
 * GET /gallery/user/:userId
 */
router.get('/user/:userId', optionalAuth, (req, res) => {
    const { userId } = req.params;
    
    res.render('gallery-user', {
        userID: req.session?.userID || null,
        role: req.session?.role || 'guest',
        is_logined: req.session?.is_logined || false,
        centerID: req.session?.centerID || null,
        targetUserId: userId,
        pageTitle: `${userId}님의 갤러리`
    });
});

/**
 * 프로젝트 상세 페이지 (임베드 플레이어)
 * GET /gallery/project/:id
 */
router.get('/project/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    
    res.render('gallery-detail', {
        userID: req.session?.userID || null,
        role: req.session?.role || 'guest',
        is_logined: req.session?.is_logined || false,
        centerID: req.session?.centerID || null,
        projectId: id,
        pageTitle: '작품 보기'
    });
});

/**
 * 내 포트폴리오 페이지 (공유 관리)
 * GET /gallery/my
 */
router.get('/my', requireAuth, (req, res) => {
    res.render('gallery-my', {
        userID: req.session.userID,
        role: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID,
        pageTitle: '내 포트폴리오'
    });
});

/**
 * 공유하기 페이지
 * GET /gallery/share
 */
router.get('/share', requireAuth, (req, res) => {
    res.render('gallery-share', {
        userID: req.session.userID,
        role: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID,
        pageTitle: '작품 공유하기'
    });
});

module.exports = router;
