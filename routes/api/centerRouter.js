// routes/api/centerRouter.js
// 센터 관리 API 라우터

const express = require('express');
const router = express.Router();
const { queryDatabase } = require('../../lib_login/db');
const { authenticateUser, checkAdminRole, checkResourcePermission } = require('../../lib_login/authMiddleware');
const {
  getUserCenter,
  getCenterUsers,
  getCenterUserCount,
  getCenterStats,
  getAccessibleCenters,
  moveUserToCenter
} = require('../../lib_login/accountHelper');

/**
 * GET /api/centers
 * 센터 목록 조회 (admin만 가능)
 */
router.get('/', authenticateUser, checkAdminRole, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT
        c.*,
        cs.plan_type as subscription_plan,
        cs.status as subscription_status,
        cs.next_billing_date,
        cs.price_monthly,
        cs.trial_ends_at
      FROM Centers c
      LEFT JOIN center_subscriptions cs ON c.id = cs.center_id
      WHERE 1=1
    `;
    const params = [];

    // 상태 필터링
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    // 검색 필터링
    if (search) {
      query += ' AND (c.center_name LIKE ? OR c.contact_name LIKE ? OR c.contact_email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // 정렬
    query += ' ORDER BY c.created_at DESC';

    // 페이지네이션
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const centers = await queryDatabase(query, params);

    // 총 센터 수 조회
    let countQuery = 'SELECT COUNT(*) as total FROM Centers WHERE 1=1';
    const countParams = [];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (search) {
      countQuery += ' AND (center_name LIKE ? OR contact_name LIKE ? OR contact_email LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    const [{ total }] = await queryDatabase(countQuery, countParams);

    res.json({
      success: true,
      centers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('센터 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 목록 조회에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * GET /api/centers/accessible
 * 현재 사용자가 접근 가능한 센터 목록 조회
 */
router.get('/accessible', authenticateUser, async (req, res) => {
  try {
    const centers = await getAccessibleCenters(req.session.userID, req.session.role);

    res.json({
      success: true,
      centers
    });

  } catch (error) {
    console.error('접근 가능한 센터 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 목록 조회에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * GET /api/centers/:id
 * 특정 센터 상세 정보 조회
 */
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const centerId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userID;

    // admin이 아니면 본인 센터만 조회 가능
    if (userRole !== 'admin') {
      const [user] = await queryDatabase(
        'SELECT centerID FROM Users WHERE userID = ?',
        [userId]
      );

      if (!user || user.centerID !== parseInt(centerId)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    const [center] = await queryDatabase(
      'SELECT * FROM Centers WHERE id = ?',
      [centerId]
    );

    if (!center) {
      return res.status(404).json({
        success: false,
        message: '센터를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      center
    });

  } catch (error) {
    console.error('센터 상세 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 정보 조회에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * GET /api/centers/:id/subscription
 * 특정 센터의 구독 정보 조회
 */
router.get('/:id/subscription', authenticateUser, async (req, res) => {
  try {
    const centerId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userID;

    // admin이 아니면 본인 센터만 조회 가능
    if (userRole !== 'admin') {
      const [user] = await queryDatabase(
        'SELECT centerID FROM Users WHERE userID = ?',
        [userId]
      );

      if (!user || user.centerID !== parseInt(centerId)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    // 구독 정보 조회
    const [subscription] = await queryDatabase(`
      SELECT
        id,
        center_id,
        plan_type,
        status,
        storage_limit_bytes,
        student_limit,
        price_monthly,
        next_billing_date,
        payment_method,
        trial_ends_at,
        created_at
      FROM center_subscriptions
      WHERE center_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [centerId]);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: '구독 정보를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      subscription
    });

  } catch (error) {
    console.error('구독 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '구독 정보 조회에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * POST /api/centers
 * 새 센터 생성 (admin만 가능)
 */
router.post('/', authenticateUser, checkAdminRole, async (req, res) => {
  try {
    const {
      center_name,
      contact_name,
      contact_email,
      plan_type = 'basic',
      storage_limit_bytes = 32212254720, // 30GB
      status = 'ACTIVE'
    } = req.body;

    // 필수 필드 검증
    if (!center_name || !contact_name || !contact_email) {
      return res.status(400).json({
        success: false,
        message: '센터명, 담당자명, 담당자 이메일은 필수입니다.'
      });
    }

    // plan_type 검증
    const validPlanTypes = ['free', 'basic', 'premium'];
    if (!validPlanTypes.includes(plan_type)) {
      return res.status(400).json({
        success: false,
        message: 'plan_type은 free, basic, premium 중 하나여야 합니다.'
      });
    }

    // status 검증
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status는 ACTIVE, INACTIVE, SUSPENDED 중 하나여야 합니다.'
      });
    }

    const result = await queryDatabase(
      `INSERT INTO Centers
       (center_name, contact_name, contact_email, plan_type, storage_limit_bytes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [center_name, contact_name, contact_email, plan_type, storage_limit_bytes, status]
    );

    const centerId = result.insertId;

    const [newCenter] = await queryDatabase(
      'SELECT * FROM Centers WHERE id = ?',
      [centerId]
    );

    // 센터 블로그 자동 생성
    try {
      // 센터명을 기반으로 서브도메인 생성 (영문/숫자만, 소문자, 4-20자)
      let subdomain = center_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // 영문, 숫자만 남김
        .substring(0, 20); // 최대 20자

      // 최소 4자 체크
      if (subdomain.length < 4) {
        subdomain = `center${centerId}`;
      }

      // 서브도메인 중복 체크 및 고유값 생성
      let finalSubdomain = subdomain;
      let counter = 1;
      let isDuplicate = true;

      while (isDuplicate) {
        const [existingUserBlog] = await queryDatabase(
          'SELECT id FROM user_blogs WHERE subdomain = ?',
          [finalSubdomain]
        );
        const [existingCenterBlog] = await queryDatabase(
          'SELECT id FROM center_blogs WHERE subdomain = ?',
          [finalSubdomain]
        );

        if (!existingUserBlog && !existingCenterBlog) {
          isDuplicate = false;
        } else {
          finalSubdomain = `${subdomain}${counter}`;
          counter++;
        }
      }

      // center_blogs 테이블에 INSERT
      await queryDatabase(
        `INSERT INTO center_blogs
         (center_id, subdomain, title, description, theme, is_public, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          centerId,
          finalSubdomain,
          `${center_name} 클라우드`,
          `${center_name}의 학습 자료실`,
          'cloud',
          true
        ]
      );

      console.log(`✅ 센터 블로그 자동 생성 완료: ${finalSubdomain}.pong2.app (센터 ID: ${centerId})`);

      // 응답에 블로그 URL 추가
      newCenter.blogUrl = `https://${finalSubdomain}.pong2.app`;
      newCenter.blogSubdomain = finalSubdomain;

    } catch (blogError) {
      console.error('❌ 센터 블로그 자동 생성 실패:', blogError);
      // 센터는 생성되었으므로 에러를 로그만 하고 계속 진행
    }

    // CenterStorageUsage 초기화
    try {
      await queryDatabase(
        `INSERT INTO CenterStorageUsage (center_id, plan_type, storage_limit, total_usage, object_count)
         VALUES (?, ?, ?, 0, 0)`,
        [centerId, plan_type, storage_limit_bytes]
      );
      console.log(`✅ 센터 스토리지 초기화 완료: ${(storage_limit_bytes / 1073741824).toFixed(0)}GB (${plan_type})`);
    } catch (storageError) {
      console.error('❌ 센터 스토리지 초기화 실패:', storageError);
    }

    // center_subscriptions Trial 생성 (14일 무료 체험)
    try {
      await queryDatabase(
        `INSERT INTO center_subscriptions
         (center_id, plan_type, status, storage_limit_bytes, student_limit, price_monthly, trial_ends_at, next_billing_date, created_at)
         VALUES (?, ?, 'trial', ?, NULL, 110000, DATE_ADD(NOW(), INTERVAL 14 DAY), DATE_ADD(NOW(), INTERVAL 14 DAY), NOW())`,
        [centerId, plan_type, storage_limit_bytes]
      );

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      console.log(`✅ Trial 구독 생성 완료: 14일 무료 체험 (만료일: ${trialEndsAt.toISOString().split('T')[0]})`);

      newCenter.trialEndsAt = trialEndsAt.toISOString();
    } catch (subscriptionError) {
      console.error('❌ Trial 구독 생성 실패:', subscriptionError);
    }

    res.json({
      success: true,
      message: '센터가 생성되었습니다.',
      center: newCenter
    });

  } catch (error) {
    console.error('센터 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 생성에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * PUT /api/centers/:id
 * 센터 정보 수정
 */
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const centerId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userID;

    // admin이 아니면 본인 센터만 수정 가능
    if (userRole !== 'admin') {
      if (!['kinder', 'school', 'manager'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }

      const [user] = await queryDatabase(
        'SELECT centerID FROM Users WHERE userID = ?',
        [userId]
      );

      if (!user || user.centerID !== parseInt(centerId)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    const {
      center_name,
      contact_name,
      contact_email,
      plan_type,
      storage_limit_bytes,
      status
    } = req.body;

    // plan_type 검증
    if (plan_type) {
      const validPlanTypes = ['free', 'basic', 'premium'];
      if (!validPlanTypes.includes(plan_type)) {
        return res.status(400).json({
          success: false,
          message: 'plan_type은 free, basic, premium 중 하나여야 합니다.'
        });
      }
    }

    // status 검증 (admin만 변경 가능)
    if (status && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'status는 admin만 변경할 수 있습니다.'
      });
    }

    if (status) {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'status는 ACTIVE, INACTIVE, SUSPENDED 중 하나여야 합니다.'
        });
      }
    }

    // 업데이트 쿼리 동적 생성
    const updates = [];
    const params = [];

    if (center_name) {
      updates.push('center_name = ?');
      params.push(center_name);
    }
    if (contact_name) {
      updates.push('contact_name = ?');
      params.push(contact_name);
    }
    if (contact_email) {
      updates.push('contact_email = ?');
      params.push(contact_email);
    }
    if (plan_type) {
      updates.push('plan_type = ?');
      params.push(plan_type);
    }
    if (storage_limit_bytes !== undefined) {
      updates.push('storage_limit_bytes = ?');
      params.push(storage_limit_bytes);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '수정할 내용이 없습니다.'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(centerId);

    await queryDatabase(
      `UPDATE Centers SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [updatedCenter] = await queryDatabase(
      'SELECT * FROM Centers WHERE id = ?',
      [centerId]
    );

    res.json({
      success: true,
      message: '센터 정보가 수정되었습니다.',
      center: updatedCenter
    });

  } catch (error) {
    console.error('센터 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 수정에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * DELETE /api/centers/:id
 * 센터 삭제 (admin만 가능, soft delete - status를 INACTIVE로 변경)
 */
router.delete('/:id', authenticateUser, checkAdminRole, async (req, res) => {
  try {
    const centerId = req.params.id;

    // 센터에 속한 사용자가 있는지 확인
    const [userCount] = await queryDatabase(
      'SELECT COUNT(*) as count FROM Users WHERE centerID = ?',
      [centerId]
    );

    if (userCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `센터에 ${userCount.count}명의 사용자가 있습니다. 사용자를 먼저 다른 센터로 이동시켜주세요.`
      });
    }

    // Soft delete (status를 INACTIVE로 변경)
    await queryDatabase(
      'UPDATE Centers SET status = "INACTIVE", updated_at = NOW() WHERE id = ?',
      [centerId]
    );

    res.json({
      success: true,
      message: '센터가 비활성화되었습니다.'
    });

  } catch (error) {
    console.error('센터 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * GET /api/centers/:id/users
 * 센터 소속 사용자 목록 조회
 */
router.get('/:id/users', authenticateUser, async (req, res) => {
  try {
    const centerId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userID;
    const { role, subscription_status, page = 1, limit = 50 } = req.query;

    // admin이 아니면 본인 센터만 조회 가능
    if (userRole !== 'admin') {
      if (!['kinder', 'school', 'manager'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }

      const [user] = await queryDatabase(
        'SELECT centerID FROM Users WHERE userID = ?',
        [userId]
      );

      if (!user || user.centerID !== parseInt(centerId)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    const options = {};
    if (role) options.role = role;
    if (subscription_status) options.subscription_status = subscription_status;

    const users = await getCenterUsers(centerId, options);

    // 페이지네이션
    const offset = (page - 1) * limit;
    const paginatedUsers = users.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.length,
        totalPages: Math.ceil(users.length / limit)
      }
    });

  } catch (error) {
    console.error('센터 사용자 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * GET /api/centers/:id/stats
 * 센터 통계 정보 조회
 */
router.get('/:id/stats', authenticateUser, async (req, res) => {
  try {
    const centerId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userID;

    // admin이 아니면 본인 센터만 조회 가능
    if (userRole !== 'admin') {
      if (!['kinder', 'school', 'manager'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }

      const [user] = await queryDatabase(
        'SELECT centerID FROM Users WHERE userID = ?',
        [userId]
      );

      if (!user || user.centerID !== parseInt(centerId)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    const stats = await getCenterStats(centerId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('센터 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 통계 조회에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * POST /api/centers/:id/users/:userId/move
 * 사용자를 다른 센터로 이동 (admin만 가능)
 */
router.post('/:id/users/:userId/move', authenticateUser, checkAdminRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetCenterId } = req.body;

    if (!targetCenterId) {
      return res.status(400).json({
        success: false,
        message: '이동할 센터 ID가 필요합니다.'
      });
    }

    const result = await moveUserToCenter(userId, targetCenterId);

    if (result) {
      res.json({
        success: true,
        message: '사용자가 이동되었습니다.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '사용자 이동에 실패했습니다.'
      });
    }

  } catch (error) {
    console.error('사용자 센터 이동 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 이동에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * POST /api/centers/:id/invite-code
 * 센터 초대 코드 생성 (admin, manager, teacher 가능)
 */
router.post('/:id/invite-code', authenticateUser, checkResourcePermission('center:invite'), async (req, res) => {
  try {
    const { id: centerId } = req.params;
    const { expiresInDays = 7, maxUses = 100, codePrefix } = req.body;
    const user = req.user; // authMiddleware에서 주입됨

    // 권한 확인: Admin이 아닌 경우 본인 센터인지 확인
    if (user.role !== 'admin' && user.centerID !== parseInt(centerId)) {
      return res.status(403).json({
        success: false,
        message: '본인의 센터에 대해서만 초대 코드를 생성할 수 있습니다.'
      });
    }

    // 센터 존재 확인
    const [center] = await queryDatabase('SELECT * FROM Centers WHERE id = ?', [centerId]);
    if (!center) {
      return res.status(404).json({
        success: false,
        message: '센터를 찾을 수 없습니다.'
      });
    }

    // 초대 코드 생성 (센터장 아이디 + 랜덤 4자리)
    let inviteCode;
    if (codePrefix) {
      // 센터장 아이디를 접두사로 사용하고 랜덤 4자리 추가
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      inviteCode = `${codePrefix.toUpperCase()}_${randomSuffix}`;
    } else {
      // 기본: 8자리 랜덤 코드
      inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const result = await queryDatabase(
      `INSERT INTO center_invite_codes (center_id, code, expires_at, max_uses, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [centerId, inviteCode, expiresAt.toISOString().slice(0, 19).replace('T', ' '), maxUses, req.session.userID]
    );

    res.json({
      success: true,
      inviteCode: {
        id: result.insertId,
        code: inviteCode,
        centerId,
        expiresAt: expiresAt.toISOString(),
        maxUses,
        currentUses: 0
      }
    });

  } catch (error) {
    console.error('초대 코드 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '초대 코드 생성에 실패했습니다.',
      error: error.message
    });
  }
});


/*
router.get('/:id/invite-codes', authenticateUser, checkResourcePermission('center:invite'), async (req, res) => {
  try {
    const { id: centerId } = req.params;
    const user = req.user;

    // 권한 확인: Admin이 아닌 경우 본인 센터인지 확인
    if (user.role !== 'admin' && user.centerID !== parseInt(centerId)) {
      return res.status(403).json({
        success: false,
        message: '본인의 센터에 대해서만 초대 코드를 조회할 수 있습니다.'
      });
    }

    // 만료된 코드 처리 (선택사항: 만료된지 30일 지난건 자동 삭제 등)
    // 여기서는 조회 시 만료 여부를 계산하여 전달

    const codes = await queryDatabase(
      `SELECT * FROM center_invite_codes 
       WHERE center_id = ? 
       ORDER BY created_at DESC`,
      [centerId]
    );

    // 가공: 만료 여부 플래그 추가
    const now = new Date();
    const processedCodes = codes.map(code => {
      const expiresAt = new Date(code.expires_at);
      const isExpired = expiresAt < now;
      const isMaxedOut = code.current_uses >= code.max_uses;

      return {
        ...code,
        isExpired,
        isMaxedOut
      };
    });

    res.json({
      success: true,
      inviteCodes: processedCodes
    });

  } catch (error) {
});
*/

/**
 * GET /api/centers/:id/invite-codes
 * 센터의 초대 코드 목록 조회 (admin, manager, teacher 가능)
 */
router.get('/:id/invite-codes', authenticateUser, checkResourcePermission('center:invite'), async (req, res) => {
  try {
    const { id: centerId } = req.params;
    const user = req.user;

    // 권한 확인
    if (user.role !== 'admin' && user.centerID !== parseInt(centerId)) {
      return res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다.'
      });
    }

    console.log(`[API] Fetching invite codes for center ${centerId}`);
    const inviteCodes = await queryDatabase(
      `SELECT ic.*, u.username as created_by_username
       FROM center_invite_codes ic
       LEFT JOIN Users u ON ic.created_by = u.userID
       WHERE ic.center_id = ?
       ORDER BY ic.created_at DESC`,
      [centerId]
    );

    res.json({
      success: true,
      inviteCodes: inviteCodes.map(code => ({
        ...code,
        isExpired: new Date(code.expires_at) < new Date(),
        isMaxedOut: code.current_uses >= code.max_uses
      }))
    });

  } catch (error) {
    console.error('초대 코드 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '초대 코드 목록 조회에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * POST /api/centers/join
 * 초대 코드로 센터 가입
 */
router.post('/join', authenticateUser, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.session.userID;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: '초대 코드가 필요합니다.'
      });
    }

    // 초대 코드 확인
    const [code] = await queryDatabase(
      `SELECT * FROM center_invite_codes WHERE code = ?`,
      [inviteCode.toUpperCase()]
    );

    if (!code) {
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 초대 코드입니다.'
      });
    }

    // 만료 확인
    if (new Date(code.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: '만료된 초대 코드입니다.'
      });
    }

    // 사용 횟수 확인
    if (code.current_uses >= code.max_uses) {
      return res.status(400).json({
        success: false,
        message: '초대 코드 사용 가능 횟수를 초과했습니다.'
      });
    }

    // 이미 센터에 속해있는지 확인
    const [existingUser] = await queryDatabase(
      `SELECT * FROM Users WHERE userID = ?`,
      [userId]
    );

    if (existingUser && existingUser.centerID) {
      return res.status(400).json({
        success: false,
        message: '이미 다른 센터에 속해있습니다.'
      });
    }

    // 센터에 사용자 추가 (account_type을 center_student로 변경)
    await queryDatabase(
      `UPDATE Users
       SET centerID = ?,
           account_type = 'center_student',
           storage_limit_bytes = 2147483648,
           blog_post_limit = 999999
       WHERE userID = ?`,
      [code.center_id, userId]
    );

    console.log(`✅ 학생 계정 센터 가입 완료: ${userId} → 센터 ${code.center_id} (account_type: center_student, 2GB)`);

    // 초대 코드 사용 횟수 증가
    await queryDatabase(
      `UPDATE center_invite_codes SET current_uses = current_uses + 1 WHERE id = ?`,
      [code.id]
    );

    res.json({
      success: true,
      message: '센터에 성공적으로 가입되었습니다.',
      centerId: code.center_id
    });

  } catch (error) {
    console.error('센터 가입 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 가입에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * DELETE /api/centers/:id/invite-codes/:codeId
 * 초대 코드 삭제 (admin, manager, teacher 가능)
 */
router.delete('/:id/invite-codes/:codeId', authenticateUser, checkResourcePermission('center:invite'), async (req, res) => {
  try {
    const { id: centerId, codeId } = req.params;
    const user = req.user;

    // 권한 확인
    if (user.role !== 'admin' && user.centerID !== parseInt(centerId)) {
      return res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다.'
      });
    }

    const result = await queryDatabase(
      `DELETE FROM center_invite_codes WHERE id = ? AND center_id = ?`,
      [codeId, centerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '초대 코드를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      message: '초대 코드가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('초대 코드 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '초대 코드 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

/**
 * POST /api/centers/:id/users/bulk
 * 학생 일괄 생성 (admin, manager, teacher 가능)
 */
router.post('/:id/users/bulk', authenticateUser, checkResourcePermission('center:invite'), async (req, res) => {
  const connection = await require('../../lib_login/db').pool.promise().getConnection();
  try {
    const { id: centerId } = req.params;
    const { students } = req.body; // Array of { name, userId, password }
    const user = req.user;

    if (user.role !== 'admin' && user.centerID !== parseInt(centerId)) {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: '생성할 학생 목록이 없습니다.' });
    }

    // Limit bulk creation to prevent abuse (e.g., 50 at a time)
    if (students.length > 50) {
      return res.status(400).json({ success: false, message: '한 번에 최대 50명까지만 생성 가능합니다.' });
    }

    // Transaction Start
    await connection.beginTransaction();

    const results = { success: [], failed: [] };
    const bcrypt = require('bcrypt');
    const saltRounds = 10;

    for (const student of students) {
      try {
        if (!student.name || !student.userId || !student.password) {
          results.failed.push({ userId: student.userId, reason: 'Missing fields' });
          continue;
        }

        // Check existing username
        const [existing] = await connection.query('SELECT id FROM Users WHERE userID = ?', [student.userId]);
        if (existing.length > 0) {
          results.failed.push({ userId: student.userId, reason: 'ID already exists' });
          continue;
        }

        const hashedPassword = await bcrypt.hash(student.password, saltRounds);

        // Insert User (Force center_student types)
        const [resInsert] = await connection.query(`
                    INSERT INTO Users 
                    (userID, password, name, role, centerID, account_type, storage_limit_bytes, blog_post_limit)
                    VALUES (?, ?, ?, 'student', ?, 'center_student', 2147483648, 999999)
                `, [student.userId, hashedPassword, student.name, centerId]);

        // Insert Membership
        await connection.query(`
                    INSERT INTO center_memberships (user_id, center_id, role, joined_at, is_active)
                    VALUES (?, ?, 'student', NOW(), TRUE)
                `, [resInsert.insertId, centerId]);

        results.success.push({ userId: student.userId, name: student.name });

      } catch (err) {
        console.error(`Bulk create error for ${student.userId}:`, err);
        results.failed.push({ userId: student.userId, reason: 'Database error' });
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: `${results.success.length} user(s) created.`,
      results
    });

  } catch (error) {
    await connection.rollback();
    console.error('Bulk user creation error:', error);
    res.status(500).json({ success: false, message: '일괄 생성 중 오류가 발생했습니다.', error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/centers/:id/blog
 * 센터 블로그 정보 조회
 */
router.get('/:id/blog', authenticateUser, async (req, res) => {
  try {
    const centerId = req.params.id;
    const userRole = req.session.role;
    const userId = req.session.userID;

    // admin이 아니면 본인 센터만 조회 가능
    if (userRole !== 'admin') {
      const [user] = await queryDatabase(
        'SELECT centerID FROM Users WHERE userID = ?',
        [userId]
      );

      if (!user || user.centerID !== parseInt(centerId)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    // 센터 블로그 조회
    const [centerBlog] = await queryDatabase(
      'SELECT * FROM center_blogs WHERE center_id = ?',
      [centerId]
    );

    if (!centerBlog) {
      return res.status(404).json({
        success: false,
        message: '센터 블로그가 존재하지 않습니다.'
      });
    }

    // 게시글 수 조회
    const [postCount] = await queryDatabase(
      'SELECT COUNT(*) as count FROM blog_posts WHERE blog_type = ? AND blog_id = ?',
      ['center', centerBlog.id]
    );

    res.json({
      success: true,
      blog: {
        ...centerBlog,
        blogUrl: `https://${centerBlog.subdomain}.pong2.app`,
        postCount: postCount.count
      }
    });

  } catch (error) {
    console.error('센터 블로그 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '센터 블로그 조회에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
