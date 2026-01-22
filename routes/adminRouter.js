const express = require('express');
const router = express.Router();
const db = require('../lib_login/db');
const { authenticateUser } = require('../lib_login/authMiddleware');
const fs = require('fs');
const path = require('path');
const { hasAccess } = require('../lib_login/permissions');
const permissions = require('../lib_login/permissions.json');
const multer = require('multer');
const Papa = require('papaparse');
const { authenticateUser } = require('../lib_login/authMiddleware');
const upload = multer({ dest: 'uploads/temp/' });

// 안전한 날짜 처리 함수
function safeFormatDate(dateValue) {
  if (!dateValue) return null;

  try {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Date formatting error:', error, 'Value:', dateValue);
    return null;
  }
}

// 관리자 권한 체크 미들웨어
const checkAdminRole = async (req, res, next) => {
  console.log('Checking admin role...');
  console.log('Session:', req.session);

  if (!req.session?.is_logined) {
    console.log('Not logged in');
    return res.redirect('/auth/login');
  }

  try {
    const [user] = await db.queryDatabase(
      'SELECT role FROM Users WHERE userID = ?',
      [req.session.userID]
    );

    console.log('User role check:', user);

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 대시보드 페이지 렌더링
router.get('/', checkAdminRole, async (req, res) => {
  try {
    // 테이블 목록 조회
    const tablesResult = await db.queryDatabase('SHOW TABLES');
    const tables = tablesResult.map(t => Object.values(t)[0]);

    res.render('admin/dashboard', {
      userID: req.session.userID,
      is_logined: req.session.is_logined,
      role: req.session.role,
      tables: tables
    });
  } catch (error) {
    console.error('Dashboard render error:', error);
    res.status(500).send('대시보드 로드 실패');
  }
});

// 센터 관리 페이지 렌더링
router.get('/centers', checkAdminRole, async (req, res) => {
  try {
    res.render('admin/centers', {
      userID: req.session.userID,
      is_logined: req.session.is_logined,
      role: req.session.role
    });
  } catch (error) {
    console.error('Centers page render error:', error);
    res.status(500).send('센터 관리 페이지 로드 실패');
  }
});

// 권한 설정 저장
router.post('/api/permissions', checkAdminRole, async (req, res) => {
  try {
    const { permissions: updatedPermissions } = req.body;
    const permissionsPath = path.join(__dirname, '../lib_login/permissions.json');

    await fs.promises.writeFile(permissionsPath, JSON.stringify(updatedPermissions, null, 2));

    require('../lib_login/permissions').updatePermissionCache(updatedPermissions);

    res.json({
      success: true,
      message: '권한 설정이 저장되었습니다.'
    });
  } catch (error) {
    console.error('Error saving permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 사용자 목록 API
router.get('/api/users', checkAdminRole, async (req, res) => {
  try {
    console.log('Fetching users list...');

    const usersQuery = `
            SELECT 
                u.id, u.userID, u.email, u.name, u.phone, 
                u.birthdate, u.role, u.created_at, u.centerID,
                c.center_name as centerName
            FROM Users u
            LEFT JOIN Centers c ON u.centerID = c.id
            ORDER BY u.created_at DESC
        `;

    const users = await db.queryDatabase(usersQuery);
    console.log(`Found ${users.length} users`);

    const usersWithDetails = users.map((user, index) => ({
      no: index + 1,
      ...user,
      birthdate: safeFormatDate(user.birthdate)
    }));

    res.json({
      success: true,
      data: usersWithDetails
    });

  } catch (error) {
    console.error('Users API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 센터 목록 조회 API (Dropdown용)
router.get('/api/centers', checkAdminRole, async (req, res) => {
  try {
    try {
      const centers = await db.queryDatabase('SELECT id, center_name as name FROM Centers WHERE status = "ACTIVE"');
      res.json({ success: true, centers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

// 사용자 센터 변경 API
router.put('/api/users/:userId/center', checkAdminRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { centerId } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // centerId가 null or empty string이면 NULL로 처리 (센터 해제)
    const newCenterId = centerId ? centerId : null;

    await db.queryDatabase(
      'UPDATE Users SET centerID = ? WHERE id = ?',
      [newCenterId, userId]
    );

    res.json({ success: true, message: '소속 센터가 변경되었습니다.' });
  } catch (error) {
    console.error('Update user center error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 페이지별 권한 확인 API
router.get('/api/pages', checkAdminRole, async (req, res) => {
  try {
    console.log('Fetching pages for permission matrix');

    const systemPages = permissions.pages;

    const pagesWithPermissions = Object.entries(systemPages).reduce((acc, [path, info]) => {
      acc[path] = {
        name: info.name,
        roles: info.roles
      };
      return acc;
    }, {});

    console.log('Response data:', pagesWithPermissions);

    res.json({
      success: true,
      data: pagesWithPermissions
    });
  } catch (error) {
    console.error('Error in /api/pages:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 통계 데이터 API
router.get('/api/stats', checkAdminRole, async (req, res) => {
  try {
    console.log('Session:', req.session);

    const statsQuery = `
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'student' THEN 1 END) as student_count,
                COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count,
                COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teacher_count,
                COUNT(DISTINCT centerID) as active_centers
            FROM Users
            WHERE centerID IS NOT NULL
        `;

    const [stats] = await db.queryDatabase(statsQuery);

    const centerQuery = `
            SELECT 
                u.centerID,
                c.center_name as centerName,
                COUNT(*) as total_users,
                COUNT(CASE WHEN u.role = 'student' THEN 1 END) as student_count,
                COUNT(CASE WHEN u.role = 'manager' THEN 1 END) as manager_count,
                COUNT(CASE WHEN u.role = 'teacher' THEN 1 END) as teacher_count
            FROM Users u
            LEFT JOIN Centers c ON u.centerID = c.id
            WHERE u.centerID IS NOT NULL
            GROUP BY u.centerID, c.center_name
        `;

    const centerStats = await db.queryDatabase(centerQuery);

    res.json({
      success: true,
      data: {
        totalStats: {
          total_users: stats.total_users || 0,
          student_count: stats.student_count || 0,
          manager_count: stats.manager_count || 0,
          teacher_count: stats.teacher_count || 0,
          active_centers: stats.active_centers || 0
        },
        centerStats: centerStats || []
      }
    });
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// SQL 관리 API
// ========================================

// 테이블 목록 조회
router.get('/api/tables', checkAdminRole, async (req, res) => {
  try {
    const tables = await db.queryDatabase('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    res.json({ success: true, tables: tableNames });
  } catch (error) {
    console.error('테이블 목록 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 테이블 구조 조회
router.get('/api/table-structure/:tableName', checkAdminRole, async (req, res) => {
  try {
    const { tableName } = req.params;
    const structure = await db.queryDatabase(`DESCRIBE ${tableName}`);
    res.json({ success: true, structure });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 테이블 데이터 조회
router.get('/api/table-data/:tableName', checkAdminRole, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const data = await db.queryDatabase(
      `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    const [countResult] = await db.queryDatabase(
      `SELECT COUNT(*) as total FROM ${tableName}`
    );

    res.json({
      success: true,
      data,
      total: countResult.total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult.total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 데이터 수정
router.put('/api/table-data/:tableName/:id', checkAdminRole, async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const updates = req.body;

    const [pkInfo] = await db.queryDatabase(
      `SHOW KEYS FROM ${tableName} WHERE Key_name = 'PRIMARY'`
    );
    const primaryKey = pkInfo.Column_name;

    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');

    const values = [...Object.values(updates), id];

    await db.queryDatabase(
      `UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey} = ?`,
      values
    );

    res.json({ success: true, message: '수정 완료' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 데이터 삭제
router.delete('/api/table-data/:tableName/:id', checkAdminRole, async (req, res) => {
  try {
    const { tableName, id } = req.params;

    const [pkInfo] = await db.queryDatabase(
      `SHOW KEYS FROM ${tableName} WHERE Key_name = 'PRIMARY'`
    );
    const primaryKey = pkInfo.Column_name;

    await db.queryDatabase(
      `DELETE FROM ${tableName} WHERE ${primaryKey} = ?`,
      [id]
    );

    res.json({ success: true, message: '삭제 완료' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CSV 업로드
router.post('/api/upload-csv/:tableName', checkAdminRole, upload.single('csvFile'), async (req, res) => {
  try {
    const { tableName } = req.params;
    const csvData = fs.readFileSync(req.file.path, 'utf-8');

    const { data } = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });

    let inserted = 0;
    let failed = 0;

    for (const row of data) {
      try {
        const columns = Object.keys(row).join(', ');
        const placeholders = Object.keys(row).map(() => '?').join(', ');
        const values = Object.values(row);

        await db.queryDatabase(
          `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
          values
        );
        inserted++;
      } catch (err) {
        console.error('행 삽입 실패:', err.message);
        failed++;
      }
    }

    // 임시 파일 삭제
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `${inserted}/${data.length}개 행 삽입 완료 (실패: ${failed}개)`
    });
  } catch (error) {
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});


// ========================================
// S3 브라우저 - 통합 라우터로 이전됨
// ========================================
// 🔥 중복 제거: /s3/browser 사용 (s3Router.js)
// Admin은 /s3/browser 또는 /s3/student-files 사용


module.exports = router;
