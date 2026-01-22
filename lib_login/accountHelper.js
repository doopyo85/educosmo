// lib_login/accountHelper.js
// 센터 기반 계정 관리 헬퍼 함수들

const { queryDatabase } = require('./db');

/**
 * 사용자가 속한 센터 정보를 가져옵니다
 * @param {string} userID - 사용자 ID (username)
 * @returns {Promise<Object|null>} 센터 정보 또는 null
 */
async function getUserCenter(userID) {
  try {
    const [user] = await queryDatabase(
      'SELECT centerID FROM Users WHERE userID = ?',
      [userID]
    );

    if (!user || !user.centerID) {
      return null;
    }

    const [center] = await queryDatabase(
      'SELECT * FROM Centers WHERE id = ?',
      [user.centerID]
    );

    return center || null;
  } catch (error) {
    console.error('Error fetching user center:', error);
    throw error;
  }
}

/**
 * 센터의 모든 사용자를 가져옵니다
 * @param {number} centerID - 센터 ID
 * @param {Object} options - 필터링 옵션 { role: 'teacher', status: 'active' }
 * @returns {Promise<Array>} 사용자 목록
 */
async function getCenterUsers(centerID, options = {}) {
  try {
    let query = 'SELECT id, userID, email, name, phone, role, subscription_status, created_at FROM Users WHERE centerID = ?';
    const params = [centerID];

    if (options.role) {
      query += ' AND role = ?';
      params.push(options.role);
    }

    if (options.subscription_status) {
      query += ' AND subscription_status = ?';
      params.push(options.subscription_status);
    }

    query += ' ORDER BY created_at DESC';

    const users = await queryDatabase(query, params);
    return users;
  } catch (error) {
    console.error('Error fetching center users:', error);
    throw error;
  }
}

/**
 * 센터의 사용자 수를 가져옵니다
 * @param {number} centerID - 센터 ID
 * @param {Object} options - 필터링 옵션 { role: 'student', status: 'active' }
 * @returns {Promise<number>} 사용자 수
 */
async function getCenterUserCount(centerID, options = {}) {
  try {
    let query = 'SELECT COUNT(*) as count FROM Users WHERE centerID = ?';
    const params = [centerID];

    if (options.role) {
      query += ' AND role = ?';
      params.push(options.role);
    }

    if (options.subscription_status) {
      query += ' AND subscription_status = ?';
      params.push(options.subscription_status);
    }

    const [result] = await queryDatabase(query, params);
    return result.count;
  } catch (error) {
    console.error('Error fetching center user count:', error);
    throw error;
  }
}

/**
 * 사용자가 특정 센터에 속해있는지 확인합니다
 * @param {string} userID - 사용자 ID (username)
 * @param {number} centerID - 센터 ID
 * @returns {Promise<boolean>} 소속 여부
 */
async function isUserInCenter(userID, centerID) {
  try {
    const [user] = await queryDatabase(
      'SELECT centerID FROM Users WHERE userID = ? AND centerID = ?',
      [userID, centerID]
    );

    return !!user;
  } catch (error) {
    console.error('Error checking user center membership:', error);
    throw error;
  }
}

/**
 * 사용자를 다른 센터로 이동시킵니다
 * @param {string} userID - 사용자 ID (username)
 * @param {number} newCenterID - 새로운 센터 ID
 * @returns {Promise<boolean>} 성공 여부
 */
async function moveUserToCenter(userID, newCenterID) {
  try {
    // 새 센터가 존재하는지 확인
    const [center] = await queryDatabase(
      'SELECT id FROM Centers WHERE id = ?',
      [newCenterID]
    );

    if (!center) {
      throw new Error('Target center does not exist');
    }

    // 사용자 이동
    const result = await queryDatabase(
      'UPDATE Users SET centerID = ? WHERE userID = ?',
      [newCenterID, userID]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error moving user to center:', error);
    throw error;
  }
}

/**
 * 센터의 스토리지 사용량을 계산합니다
 * @param {number} centerID - 센터 ID
 * @returns {Promise<Object>} { used: number, limit: number, percentage: number }
 */
async function getCenterStorageUsage(centerID) {
  try {
    // 센터의 스토리지 제한 가져오기
    const [center] = await queryDatabase(
      'SELECT storage_limit_bytes FROM Centers WHERE id = ?',
      [centerID]
    );

    if (!center) {
      throw new Error('Center not found');
    }

    // 센터 소속 사용자들의 파일 크기 합계 계산
    const [usage] = await queryDatabase(`
      SELECT COALESCE(SUM(f.size), 0) as total_size
      FROM Files f
      INNER JOIN Users u ON f.user_id = u.id
      WHERE u.centerID = ?
    `, [centerID]);

    const used = parseInt(usage.total_size) || 0;
    const limit = parseInt(center.storage_limit_bytes) || 0;
    const percentage = limit > 0 ? (used / limit * 100).toFixed(2) : 0;

    return {
      used,
      limit,
      percentage: parseFloat(percentage)
    };
  } catch (error) {
    console.error('Error calculating center storage usage:', error);
    throw error;
  }
}

/**
 * 센터의 활동 로그를 가져옵니다
 * @param {number} centerID - 센터 ID
 * @param {Object} options - 필터 옵션 { limit: 100, actionType: 'LOGIN' }
 * @returns {Promise<Array>} 활동 로그 목록
 */
async function getCenterActivityLogs(centerID, options = {}) {
  try {
    let query = `
      SELECT
        l.id,
        l.user_id,
        u.userID as username,
        u.name as user_name,
        l.action_type,
        l.url,
        l.action_detail,
        l.status,
        l.created_at
      FROM UserActivityLogs l
      INNER JOIN Users u ON l.user_id = u.id
      WHERE l.center_id = ?
    `;
    const params = [centerID];

    if (options.actionType) {
      query += ' AND l.action_type = ?';
      params.push(options.actionType);
    }

    if (options.userId) {
      query += ' AND l.user_id = ?';
      params.push(options.userId);
    }

    query += ' ORDER BY l.created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const logs = await queryDatabase(query, params);
    return logs;
  } catch (error) {
    console.error('Error fetching center activity logs:', error);
    throw error;
  }
}

/**
 * 센터의 요약 통계를 가져옵니다
 * @param {number} centerID - 센터 ID
 * @returns {Promise<Object>} 센터 통계 정보
 */
async function getCenterStats(centerID) {
  try {
    // 전체 사용자 수
    const totalUsers = await getCenterUserCount(centerID);

    // 역할별 사용자 수
    const [roleStats] = await queryDatabase(`
      SELECT
        role,
        COUNT(*) as count
      FROM Users
      WHERE centerID = ?
      GROUP BY role
    `, [centerID]);

    // 활성 구독 사용자 수
    const activeSubscriptions = await getCenterUserCount(centerID, {
      subscription_status: 'active'
    });

    // 스토리지 사용량
    const storage = await getCenterStorageUsage(centerID);

    // 최근 30일 활동 수
    const [recentActivity] = await queryDatabase(`
      SELECT COUNT(*) as count
      FROM UserActivityLogs
      WHERE center_id = ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [centerID]);

    // 센터 구독 정보 (Phase 4 Add)
    const [subscription] = await queryDatabase(`
      SELECT plan_type, status, trial_ends_at, next_billing_date
      FROM center_subscriptions
      WHERE center_id = ? AND status IN ('active', 'trial', 'suspended')
      ORDER BY created_at DESC LIMIT 1
    `, [centerID]);

    return {
      totalUsers,
      roleDistribution: roleStats || [],
      activeSubscriptions,
      storage,
      recentActivityCount: recentActivity?.count || 0,
      subscription: subscription || null
    };
  } catch (error) {
    console.error('Error fetching center stats:', error);
    throw error;
  }
}

/**
 * 관리자가 접근 가능한 센터 목록을 가져옵니다
 * @param {string} userID - 사용자 ID (username)
 * @param {string} role - 사용자 역할
 * @returns {Promise<Array>} 센터 목록
 */
async function getAccessibleCenters(userID, role) {
  try {
    // admin은 모든 센터에 접근 가능
    if (role === 'admin') {
      const centers = await queryDatabase(
        'SELECT * FROM Centers WHERE status = "ACTIVE" ORDER BY center_name'
      );
      return centers;
    }

    // kinder, school, manager는 자신의 센터만
    if (['kinder', 'school', 'manager'].includes(role)) {
      const [user] = await queryDatabase(
        'SELECT centerID FROM Users WHERE userID = ?',
        [userID]
      );

      if (!user || !user.centerID) {
        return [];
      }

      const [center] = await queryDatabase(
        'SELECT * FROM Centers WHERE id = ? AND status = "ACTIVE"',
        [user.centerID]
      );

      return center ? [center] : [];
    }

    // teacher, student, guest는 센터 목록 접근 불가
    return [];
  } catch (error) {
    console.error('Error fetching accessible centers:', error);
    throw error;
  }
}

module.exports = {
  getUserCenter,
  getCenterUsers,
  getCenterUserCount,
  isUserInCenter,
  moveUserToCenter,
  getCenterStorageUsage,
  getCenterActivityLogs,
  getCenterStats,
  getAccessibleCenters
};
