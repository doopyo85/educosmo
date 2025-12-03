const express = require('express');
const router = express.Router();
const { checkPageAccess } = require('../lib_login/authMiddleware');

router.get('/', checkPageAccess('/machinelearning'), (req, res) => {
  console.log('Machine Learning 페이지 렌더링 - 세션 정보:', {
    userID: req.session?.userID,
    role: req.session?.role
  });
  
  res.render('machinelearning', {
    userID: req.session?.userID,
    role: req.session?.role,
    is_logined: req.session?.is_logined,
    centerID: req.session?.centerID
  });
});

module.exports = router;