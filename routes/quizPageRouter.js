const express = require('express');
const router = express.Router();
const { authenticateUser, checkPageAccess } = require('../lib_login/authMiddleware');

// Quiz Page Router for Embedding
// Handles /quiz/:examName?p=1&embed=true

router.get('/:examName',
    authenticateUser,
    // checkPageAccess('/quiz'), // Optional: Add if specific permission needed
    (req, res) => {
        const { examName } = req.params;
        const { p, embed } = req.query;

        console.log(`Quiz Page Request: Exam=${examName}, Problem=${p}, Embed=${embed}`);

        res.render('template', {
            userID: req.session.userID,
            userRole: req.session.role,
            is_logined: req.session.is_logined,
            centerID: req.session.centerID,
            pageType: 'quiz', // Triggers QuizComponent logic in template.ejs
            pageTitle: `${examName} - Problem ${p || 1}`,
            // Pass embed config to frontend
            isEmbed: embed === 'true' || embed === '1',
            examName: examName,
            initialProblem: p || '1'
        });
    }
);

module.exports = router;
