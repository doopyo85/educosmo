const express = require('express');
const router = express.Router();
const db = require('../../lib_login/db');

// 드래그 게임 랭킹 가져오기
router.get('/drag-game/rankings', async (req, res) => {
  try {
    const tables = await db.queryDatabase(`SHOW TABLES LIKE 'DragGameScores'`);
    if (tables.length === 0) return res.json([]);

    const query = `
      SELECT Users.userID, DragGameScores.score
      FROM DragGameScores
      JOIN Users ON DragGameScores.user_id = Users.id
      ORDER BY DragGameScores.score DESC
      LIMIT 10
    `;
    const rankings = await db.queryDatabase(query);
    res.json(rankings);
  } catch (error) {
    console.error('드래그 게임 랭킹 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 드래그 게임 점수 저장
router.post('/drag-game/save-score', async (req, res) => {
  try {
    if (!req.session?.is_logined) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { score } = req.body;
    const userID = req.session.userID;

    const tables = await db.queryDatabase(`SHOW TABLES LIKE 'DragGameScores'`);
    if (tables.length === 0) {
      await db.queryDatabase(`
        CREATE TABLE IF NOT EXISTS DragGameScores (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          score INT NOT NULL,
          created_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES Users(id)
        )
      `);
      await db.queryDatabase(`CREATE INDEX idx_user_drag_score ON DragGameScores(user_id, score)`);
    }

    const [user] = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [userID]);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    const [currentHighScore] = await db.queryDatabase(
      'SELECT score FROM DragGameScores WHERE user_id = ? ORDER BY score DESC LIMIT 1',
      [user.id]
    );

    if (!currentHighScore || score > currentHighScore.score) {
      await db.queryDatabase(
        'INSERT INTO DragGameScores (user_id, score, created_at) VALUES (?, ?, NOW())',
        [user.id, score]
      );
      return res.json({ success: true, message: '새로운 최고 점수가 저장되었습니다.', newRecord: true });
    } else {
      return res.json({ success: true, message: '점수가 저장되었습니다.', newRecord: false });
    }
  } catch (error) {
    console.error('드래그 게임 점수 저장 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 클릭 게임 랭킹
router.get('/mole-game/rankings', async (req, res) => {
  try {
    const tables = await db.queryDatabase(`SHOW TABLES LIKE 'MoleGameScores'`);
    if (tables.length === 0) return res.json([]);

    const query = `
      SELECT Users.userID, MoleGameScores.score
      FROM MoleGameScores
      JOIN Users ON MoleGameScores.user_id = Users.id
      ORDER BY MoleGameScores.score DESC
      LIMIT 10
    `;
    const rankings = await db.queryDatabase(query);
    res.json(rankings);
  } catch (error) {
    console.error('클릭 게임 랭킹 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 클릭 게임 점수 저장
router.post('/mole-game/save-score', async (req, res) => {
  try {
    if (!req.session?.is_logined) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { score } = req.body;
    const userID = req.session.userID;

    const tables = await db.queryDatabase(`SHOW TABLES LIKE 'MoleGameScores'`);
    if (tables.length === 0) {
      await db.queryDatabase(`
        CREATE TABLE IF NOT EXISTS MoleGameScores (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          score INT NOT NULL,
          created_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES Users(id)
        )
      `);
      await db.queryDatabase(`CREATE INDEX idx_user_score ON MoleGameScores(user_id, score)`);
    }

    const [user] = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [userID]);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    const [currentHighScore] = await db.queryDatabase(
      'SELECT score FROM MoleGameScores WHERE user_id = ? ORDER BY score DESC LIMIT 1',
      [user.id]
    );

    if (!currentHighScore || score > currentHighScore.score) {
      await db.queryDatabase(
        'INSERT INTO MoleGameScores (user_id, score, created_at) VALUES (?, ?, NOW())',
        [user.id, score]
      );
      return res.json({ success: true, message: '새로운 최고 점수가 저장되었습니다.', newRecord: true });
    } else {
      return res.json({ success: true, message: '점수가 저장되었습니다.', newRecord: false });
    }
  } catch (error) {
    console.error('클릭 게임 점수 저장 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
