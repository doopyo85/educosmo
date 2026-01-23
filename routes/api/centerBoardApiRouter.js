/**
 * Center Board API Router
 * 센터 블로그 (CloudBoard) 관련 API 엔드포인트
 */

const express = require('express');
const router = express.Router();
const { queryDatabase } = require('../../lib_login/db');

// ============================================
// 센터 멤버 권한 확인 미들웨어
// ============================================
const requireCenterMember = async (req, res, next) => {
  if (!req.session.is_logined) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const centerId = req.body.centerId || req.query.centerId || req.params.centerId;
  if (!centerId) {
    return res.status(400).json({ error: '센터 ID가 필요합니다.' });
  }

  const userId = req.session.userID;

  // Users.id 조회
  const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }

  // 센터 멤버십 확인
  const [membership] = await queryDatabase(
    'SELECT role FROM CenterMemberships WHERE center_id = ? AND user_id = ?',
    [centerId, user.id]
  );

  if (!membership) {
    return res.status(403).json({ error: '센터 멤버가 아닙니다.' });
  }

  req.centerMembership = membership;
  req.dbUserId = user.id;
  next();
};

// ============================================
// 카드 생성
// ============================================
router.post('/create-card', requireCenterMember, async (req, res) => {
  try {
    const { centerId, title, content, postType, x, y } = req.body;
    const userId = req.dbUserId;

    // center_blogs 조회 (없으면 생성)
    let [centerBlog] = await queryDatabase(
      'SELECT id FROM center_blogs WHERE center_id = ?',
      [centerId]
    );

    if (!centerBlog) {
      // 자동 생성
      const [center] = await queryDatabase('SELECT name FROM Centers WHERE id = ?', [centerId]);
      const subdomain = `center-${center.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

      const result = await queryDatabase(
        `INSERT INTO center_blogs (center_id, subdomain, title)
        VALUES (?, ?, ?)`,
        [centerId, subdomain, `${center.name} CloudBoard`]
      );

      centerBlog = { id: result.insertId };
    }

    // blog_posts에 카드 생성
    const slug = `card-${Date.now()}`;
    const layoutMeta = JSON.stringify({ x: x || 100, y: y || 100, width: 300, height: 200 });

    const insertResult = await queryDatabase(
      `INSERT INTO blog_posts
      (blog_id, blog_type, author_id, title, slug, content, post_type, layout_meta, is_published, created_at, updated_at)
      VALUES (?, 'center', ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
      [
        centerBlog.id,
        userId,
        title || '제목 없음',
        slug,
        content || '',
        postType || 'card',
        layoutMeta
      ]
    );

    res.json({
      success: true,
      cardId: insertResult.insertId,
      slug
    });

  } catch (error) {
    console.error('[Center API] Create card error:', error);
    res.status(500).json({ error: '카드 생성 실패' });
  }
});

// ============================================
// 카드 위치 업데이트
// ============================================
router.post('/update-card-position', requireCenterMember, async (req, res) => {
  try {
    const { cardId, x, y } = req.body;

    await queryDatabase(`
      UPDATE blog_posts
      SET layout_meta = JSON_SET(
        COALESCE(layout_meta, '{}'),
        '$.x', ?,
        '$.y', ?
      )
      WHERE id = ?
    `, [x, y, cardId]);

    res.json({ success: true });

  } catch (error) {
    console.error('[Center API] Update position error:', error);
    res.status(500).json({ error: '위치 업데이트 실패' });
  }
});

// ============================================
// 카드 목록 조회
// ============================================
router.get('/cards/:centerId', requireCenterMember, async (req, res) => {
  try {
    const centerId = req.params.centerId;

    // center_blogs 조회
    const [centerBlog] = await queryDatabase(
      'SELECT id FROM center_blogs WHERE center_id = ?',
      [centerId]
    );

    if (!centerBlog) {
      return res.json({ cards: [] });
    }

    // 카드 목록 조회
    const cards = await queryDatabase(
      `SELECT bp.id, bp.title, bp.content, bp.post_type, bp.layout_meta,
              bp.created_at, bp.author_id, u.name as author_name
      FROM blog_posts bp
      JOIN Users u ON bp.author_id = u.id
      WHERE bp.blog_id = ? AND bp.blog_type = 'center' AND bp.is_published = TRUE
      ORDER BY bp.created_at DESC`,
      [centerBlog.id]
    );

    // layout_meta 파싱
    const parsedCards = cards.map(card => ({
      ...card,
      layout: card.layout_meta ? JSON.parse(card.layout_meta) : { x: 0, y: 0, width: 300, height: 200 }
    }));

    res.json({ cards: parsedCards });

  } catch (error) {
    console.error('[Center API] Get cards error:', error);
    res.status(500).json({ error: '카드 조회 실패' });
  }
});

// ============================================
// 카드 삭제
// ============================================
router.delete('/card/:id', requireCenterMember, async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.dbUserId;
    const role = req.centerMembership.role;

    // 관리자이거나 본인이 작성한 카드만 삭제 가능
    if (role === 'student') {
      // 학생은 본인 카드만 삭제
      const [card] = await queryDatabase(
        'SELECT author_id FROM blog_posts WHERE id = ?',
        [cardId]
      );

      if (!card || card.author_id !== userId) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }
    }

    await queryDatabase('DELETE FROM blog_posts WHERE id = ?', [cardId]);

    res.json({ success: true, message: '카드가 삭제되었습니다.' });

  } catch (error) {
    console.error('[Center API] Delete card error:', error);
    res.status(500).json({ error: '카드 삭제 실패' });
  }
});

// ============================================
// 과제 카드 생성 (교사만)
// ============================================
router.post('/homework/create', requireCenterMember, async (req, res) => {
  try {
    const role = req.centerMembership.role;

    if (role !== 'teacher' && role !== 'manager' && role !== 'admin') {
      return res.status(403).json({ error: '교사 권한이 필요합니다.' });
    }

    const { centerId, title, description, dueDate, x, y } = req.body;
    const userId = req.dbUserId;

    // center_blogs 조회
    let [centerBlog] = await queryDatabase(
      'SELECT id FROM center_blogs WHERE center_id = ?',
      [centerId]
    );

    if (!centerBlog) {
      return res.status(404).json({ error: '센터 블로그를 찾을 수 없습니다.' });
    }

    // 과제 카드 생성
    const slug = `homework-${Date.now()}`;
    const layoutMeta = JSON.stringify({ x: x || 100, y: y || 100, width: 350, height: 250 });
    const metadata = JSON.stringify({ dueDate, submittedStudents: [] });

    const insertResult = await queryDatabase(
      `INSERT INTO blog_posts
      (blog_id, blog_type, author_id, title, slug, content, post_type, layout_meta, metadata, is_published, created_at, updated_at)
      VALUES (?, 'center', ?, ?, ?, ?, 'homework', ?, ?, TRUE, NOW(), NOW())`,
      [
        centerBlog.id,
        userId,
        title,
        slug,
        description,
        layoutMeta,
        metadata
      ]
    );

    res.json({
      success: true,
      homeworkId: insertResult.insertId
    });

  } catch (error) {
    console.error('[Center API] Create homework error:', error);
    res.status(500).json({ error: '과제 생성 실패' });
  }
});

// ============================================
// 과제 제출 현황 조회
// ============================================
router.get('/homework/:id/submissions', requireCenterMember, async (req, res) => {
  try {
    const homeworkId = req.params.id;

    // 과제 정보 조회
    const [homework] = await queryDatabase(
      'SELECT * FROM blog_posts WHERE id = ? AND post_type = "homework"',
      [homeworkId]
    );

    if (!homework) {
      return res.status(404).json({ error: '과제를 찾을 수 없습니다.' });
    }

    const metadata = JSON.parse(homework.metadata || '{}');

    // 제출한 학생들의 프로젝트 조회
    const submissions = await queryDatabase(
      `SELECT ps.*, u.username, u.name
      FROM ProjectSubmissions ps
      JOIN Users u ON ps.user_id = u.id
      WHERE JSON_EXTRACT(ps.metadata, '$.missionId') = ?
      OR JSON_EXTRACT(ps.metadata, '$.homeworkId') = ?`,
      [homeworkId, homeworkId]
    );

    res.json({
      homework,
      submissions,
      stats: {
        total: metadata.submittedStudents?.length || 0,
        submitted: submissions.length
      }
    });

  } catch (error) {
    console.error('[Center API] Get submissions error:', error);
    res.status(500).json({ error: '제출 현황 조회 실패' });
  }
});

// ============================================
// 스토리지 사용량 조회
// ============================================
const quotaManager = require('../../lib_blog/quotaManager');

router.get('/storage/:centerId', requireCenterMember, async (req, res) => {
  try {
    const centerId = req.params.centerId;

    const usage = await quotaManager.getCenterStorageUsage(centerId);

    res.json({
      success: true,
      usage
    });

  } catch (error) {
    console.error('[Center API] Storage usage error:', error);
    res.status(500).json({ error: '스토리지 조회 실패' });
  }
});

// 스토리지 통계 조회 (관리자만)
router.get('/storage/:centerId/stats', requireCenterMember, async (req, res) => {
  try {
    const centerId = req.params.centerId;
    const role = req.centerMembership.role;

    // 관리자 권한 체크
    if (role !== 'manager' && role !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const stats = await quotaManager.getCenterStorageStats(centerId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('[Center API] Storage stats error:', error);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

module.exports = router;
