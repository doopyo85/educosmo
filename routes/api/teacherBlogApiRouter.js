/**
 * Teacher Blog API Router
 * 교사 블로그 관련 API 엔드포인트
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { queryDatabase } = require('../../lib_login/db');
const { MarkdownParser } = require('../../lib_blog/parsers/MarkdownParser');
const { PythonParser } = require('../../lib_blog/parsers/PythonParser');
const { appendSheetData } = require('../../lib_google/sheetService');

// Multer 설정 (메모리 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.md', '.py', '.txt'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. (.md, .py만 지원)'));
    }
  }
});

// ============================================
// 교사 권한 확인 미들웨어
// ============================================
const requireTeacher = (req, res, next) => {
  if (!req.session.is_logined) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const role = req.session.role;
  if (role !== 'teacher' && role !== 'manager' && role !== 'admin') {
    return res.status(403).json({ error: '교사 권한이 필요합니다.' });
  }

  next();
};

// ============================================
// 파일 업로드 (.md, .py)
// ============================================
router.post('/upload-file', requireTeacher, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.session.userID;

    // Users.id 조회
    const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 파일 타입 결정
    const ext = originalname.toLowerCase().substring(originalname.lastIndexOf('.'));
    const fileType = ext === '.md' ? 'md' : ext === '.py' ? 'py' : 'text';

    // 파일 내용 파싱
    const content = buffer.toString('utf-8');
    let parsed;
    let title = originalname.replace(ext, '');
    let excerpt = '';
    let thumbnail = null;

    if (fileType === 'md') {
      const parser = new MarkdownParser();
      parser.validate(content);
      parsed = parser.parse(content);
      title = parsed.metadata.title || title;
      excerpt = parsed.excerpt;
      thumbnail = parsed.thumbnail;
    } else if (fileType === 'py') {
      const parser = new PythonParser();
      parser.validate(content);
      parsed = parser.parse(content);
      title = parsed.metadata.title || title;
      excerpt = parsed.description.substring(0, 200);
    }

    // teacher_blogs 조회 (없으면 생성)
    let [teacherBlog] = await queryDatabase(
      'SELECT id FROM teacher_blogs WHERE user_id = ?',
      [user.id]
    );

    if (!teacherBlog) {
      // 자동 생성
      const subdomain = `teacher-${req.session.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const result = await queryDatabase(
        `INSERT INTO teacher_blogs (user_id, subdomain, title)
        VALUES (?, ?, ?)`,
        [user.id, subdomain, `${req.session.name || req.session.username}의 교안 저장소`]
      );
      teacherBlog = { id: result.insertId };
    }

    // blog_posts에 저장
    const slug = `draft-${Date.now()}`;
    const htmlContent = parsed.content || parsed.html || content;
    const jsonContent = JSON.stringify(parsed);

    const insertResult = await queryDatabase(
      `INSERT INTO blog_posts
      (blog_id, blog_type, author_id, title, slug, content, content_json, file_type, excerpt, thumbnail_url, is_published, created_at, updated_at)
      VALUES (?, 'teacher', ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW(), NOW())`,
      [
        teacherBlog.id,
        user.id,
        title,
        slug,
        htmlContent,
        jsonContent,
        fileType,
        excerpt,
        thumbnail
      ]
    );

    res.json({
      success: true,
      postId: insertResult.insertId,
      title,
      fileType,
      parsed: {
        title: parsed.metadata?.title || parsed.metadata?.title || title,
        excerpt,
        difficulty: parsed.difficulty || parsed.metadata?.difficulty || 1
      }
    });

  } catch (error) {
    console.error('[Teacher API] File upload error:', error);
    res.status(500).json({ error: error.message || '파일 업로드 실패' });
  }
});

// ============================================
// 내 교안 목록 조회
// ============================================
router.get('/my-posts', requireTeacher, async (req, res) => {
  try {
    const userId = req.session.userID;

    // Users.id 조회
    const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // teacher_blogs 조회
    const [teacherBlog] = await queryDatabase(
      'SELECT id FROM teacher_blogs WHERE user_id = ?',
      [user.id]
    );

    if (!teacherBlog) {
      return res.json({ posts: [], stats: { totalPosts: 0, publishedCount: 0 } });
    }

    // 교안 목록 조회
    const posts = await queryDatabase(
      `SELECT id, title, slug, file_type, excerpt, is_published,
              published_to_platform, platform_published_at, created_at, updated_at
      FROM blog_posts
      WHERE blog_id = ? AND blog_type = 'teacher'
      ORDER BY created_at DESC`,
      [teacherBlog.id]
    );

    // 통계
    const stats = {
      totalPosts: posts.length,
      publishedCount: posts.filter(p => p.published_to_platform).length,
      draftCount: posts.filter(p => !p.is_published).length
    };

    res.json({ posts, stats });

  } catch (error) {
    console.error('[Teacher API] My posts error:', error);
    res.status(500).json({ error: '교안 목록 조회 실패' });
  }
});

// ============================================
// 교안 상세 조회
// ============================================
router.get('/post/:id', requireTeacher, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.userID;

    // Users.id 조회
    const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 게시글 조회
    const [post] = await queryDatabase(
      `SELECT * FROM blog_posts WHERE id = ? AND author_id = ?`,
      [postId, user.id]
    );

    if (!post) {
      return res.status(404).json({ error: '교안을 찾을 수 없습니다.' });
    }

    // content_json 파싱
    let parsed = null;
    if (post.content_json) {
      try {
        parsed = JSON.parse(post.content_json);
      } catch (e) {
        console.warn('[Teacher API] JSON parse warning:', e);
      }
    }

    res.json({ post, parsed });

  } catch (error) {
    console.error('[Teacher API] Post detail error:', error);
    res.status(500).json({ error: '교안 조회 실패' });
  }
});

// ============================================
// 교안 삭제
// ============================================
router.delete('/post/:id', requireTeacher, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.userID;

    // Users.id 조회
    const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 소유권 확인 및 삭제
    const result = await queryDatabase(
      `DELETE FROM blog_posts WHERE id = ? AND author_id = ?`,
      [postId, user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '교안을 찾을 수 없거나 권한이 없습니다.' });
    }

    res.json({ success: true, message: '교안이 삭제되었습니다.' });

  } catch (error) {
    console.error('[Teacher API] Delete error:', error);
    res.status(500).json({ error: '교안 삭제 실패' });
  }
});

// ============================================
// 교안 게시 토글
// ============================================
router.patch('/post/:id/publish', requireTeacher, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.userID;
    const { is_published } = req.body;

    // Users.id 조회
    const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 게시 상태 업데이트
    const result = await queryDatabase(
      `UPDATE blog_posts
      SET is_published = ?, updated_at = NOW()
      WHERE id = ? AND author_id = ?`,
      [is_published ? 1 : 0, postId, user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '교안을 찾을 수 없거나 권한이 없습니다.' });
    }

    res.json({ success: true, is_published });

  } catch (error) {
    console.error('[Teacher API] Publish toggle error:', error);
    res.status(500).json({ error: '게시 상태 변경 실패' });
  }
});

// ============================================
// 문제은행에 퍼블리싱 (Python 파일만)
// ============================================
router.post('/post/:id/publish-to-platform', requireTeacher, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.userID;

    // Users.id 조회
    const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 게시글 조회
    const [post] = await queryDatabase(
      `SELECT * FROM blog_posts WHERE id = ? AND author_id = ?`,
      [postId, user.id]
    );

    if (!post) {
      return res.status(404).json({ error: '교안을 찾을 수 없습니다.' });
    }

    // Python 파일만 문제은행 등록 가능
    if (post.file_type !== 'py') {
      return res.status(400).json({ error: 'Python 파일만 문제은행에 등록할 수 있습니다.' });
    }

    // 이미 등록된 경우
    if (post.published_to_platform) {
      return res.status(400).json({ error: '이미 문제은행에 등록된 교안입니다.' });
    }

    // content_json 파싱
    let parsed;
    try {
      parsed = JSON.parse(post.content_json || '{}');
    } catch (e) {
      return res.status(400).json({ error: 'JSON 파싱 실패. 파일을 다시 업로드해주세요.' });
    }

    // Google Sheets 'problems' 시트에 추가
    const problemId = `prob-${Date.now()}`;
    const rowData = [
      problemId, // ID
      post.title, // exam_name
      '1', // problem_number
      parsed.description || '', // concept
      '', '', '', '', '', // 빈 컬럼들 (기존 스키마 맞춤)
      JSON.stringify(parsed.testCases || []), // test_cases
      parsed.difficulty?.toString() || '1', // difficulty
      'code', // question_type
      parsed.metadata?.tags?.join(', ') || '', // tags
      user.id.toString() // author
    ];

    await appendSheetData('problems!A:N', [rowData]);

    // blog_posts 업데이트
    await queryDatabase(
      `UPDATE blog_posts
      SET published_to_platform = TRUE,
          platform_published_at = NOW(),
          platform_id = ?
      WHERE id = ?`,
      [problemId, postId]
    );

    res.json({
      success: true,
      message: '문제은행에 등록되었습니다.',
      problemId
    });

  } catch (error) {
    console.error('[Teacher API] Publish to platform error:', error);
    res.status(500).json({ error: error.message || '문제은행 등록 실패' });
  }
});

// ============================================
// 문제은행 등록 취소
// ============================================
router.delete('/post/:id/unpublish-from-platform', requireTeacher, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.userID;

    // Users.id 조회
    const [user] = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // blog_posts 업데이트 (등록 취소)
    const result = await queryDatabase(
      `UPDATE blog_posts
      SET published_to_platform = FALSE,
          platform_id = NULL
      WHERE id = ? AND author_id = ?`,
      [postId, user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '교안을 찾을 수 없거나 권한이 없습니다.' });
    }

    // 참고: Google Sheets에서는 실제로 삭제하지 않음 (수동 관리 필요)
    res.json({
      success: true,
      message: '문제은행 등록이 취소되었습니다. (Google Sheets에서는 수동 삭제 필요)'
    });

  } catch (error) {
    console.error('[Teacher API] Unpublish error:', error);
    res.status(500).json({ error: '등록 취소 실패' });
  }
});

module.exports = router;
