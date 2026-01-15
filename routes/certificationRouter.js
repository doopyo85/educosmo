const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Path to data.json
const DATA_FILE_PATH = path.join(__dirname, '../../s3/contents/itq/data.json');

router.get('/', (req, res) => {
    let examData = [];
    try {
        if (fs.existsSync(DATA_FILE_PATH)) {
            const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf8');
            examData = JSON.parse(rawData);
        }
    } catch (err) {
        console.error('Error reading ITQ data.json:', err);
    }

    res.render('certification/index', {
        userID: req.session.userID,
        userRole: req.session.role,
        is_logined: req.session.is_logined,
        centerID: req.session.centerID,
        examData: examData
    });
});

module.exports = router;
