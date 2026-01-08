const db = require('../lib_login/db');
const { sendVerificationEmail } = require('./emailService');
const smsService = require('./smsService');

/**
 * 6자리 랜덤 인증 코드 생성
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 인증 코드 생성 및 저장
 * @param {string} contact - 이메일 또는 전화번호
 * @param {string} contactType - 'email' 또는 'phone'
 * @param {string} purpose - 'register', 'reset_password', 'phone_verify'
 * @returns {Promise<string>} 생성된 인증 코드
 */
async function createVerificationCode(contact, contactType, purpose) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

  // 기존 미인증 코드 삭제
  await db.queryDatabase(`
    DELETE FROM VerificationCodes
    WHERE contact = ? AND contact_type = ? AND purpose = ? AND verified = FALSE
  `, [contact, contactType, purpose]);

  // 새 코드 저장
  await db.queryDatabase(`
    INSERT INTO VerificationCodes (contact, contact_type, code, purpose, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `, [contact, contactType, code, purpose, expiresAt]);

  console.log(`Verification code created for ${contact}: ${code}`);
  return code;
}

/**
 * 이메일 인증 코드 발송
 * @param {string} email - 수신자 이메일
 * @param {string} purpose - 'register' 또는 'reset_password'
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendEmailVerification(email, purpose = 'register') {
  try {
    const code = await createVerificationCode(email, 'email', purpose);
    const sent = await sendVerificationEmail(email, code, purpose === 'reset_password' ? 'reset' : 'verify');

    if (sent) {
      return {
        success: true,
        message: '인증 코드가 이메일로 전송되었습니다. (10분간 유효)'
      };
    } else {
      return {
        success: false,
        message: '이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.'
      };
    }
  } catch (error) {
    console.error('Email verification error:', error);
    return {
      success: false,
      message: '인증 코드 생성에 실패했습니다.'
    };
  }
}

/**
 * SMS 인증 코드 발송 (NCP SMS 연동)
 * @param {string} phone - 수신자 전화번호
 * @param {string} purpose - 'phone_verify', 'register', 'reset_password'
 * @returns {Promise<{success: boolean, message: string, code?: string}>}
 */
async function sendPhoneVerification(phone, purpose = 'phone_verify') {
  try {
    // 전화번호 형식 검증 및 정규화
    const normalizedPhone = smsService.formatPhoneNumber(phone);
    if (!normalizedPhone) {
      return {
        success: false,
        message: '유효하지 않은 전화번호 형식입니다.'
      };
    }

    // 인증 코드 생성 및 DB 저장
    const code = await createVerificationCode(normalizedPhone, 'phone', purpose);

    // NCP SMS 발송
    const result = await smsService.sendVerificationSMS(normalizedPhone, code, purpose);

    // 개발 모드에서만 코드 반환
    if (process.env.NODE_ENV !== 'production' && result.success) {
      return {
        ...result,
        code: code  // 개발 중에만 반환
      };
    }

    return result;
  } catch (error) {
    console.error('Phone verification error:', error);
    return {
      success: false,
      message: '인증 코드 발송에 실패했습니다.'
    };
  }
}

/**
 * 인증 코드 검증
 * @param {string} contact - 이메일 또는 전화번호
 * @param {string} contactType - 'email' 또는 'phone'
 * @param {string} code - 입력된 인증 코드
 * @param {string} purpose - 용도
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function verifyCode(contact, contactType, code, purpose) {
  try {
    const result = await db.queryDatabase(`
      SELECT * FROM VerificationCodes
      WHERE contact = ? AND contact_type = ? AND code = ? AND purpose = ?
        AND verified = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [contact, contactType, code, purpose]);

    if (result.length === 0) {
      return {
        success: false,
        message: '유효하지 않거나 만료된 인증 코드입니다.'
      };
    }

    // 인증 완료 표시
    await db.queryDatabase(`
      UPDATE VerificationCodes
      SET verified = TRUE, verified_at = NOW()
      WHERE id = ?
    `, [result[0].id]);

    return {
      success: true,
      message: '인증이 완료되었습니다.'
    };
  } catch (error) {
    console.error('Code verification error:', error);
    return {
      success: false,
      message: '인증 확인 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 인증 완료 여부 확인
 * @param {string} contact - 이메일 또는 전화번호
 * @param {string} contactType - 'email' 또는 'phone'
 * @param {string} purpose - 용도
 * @returns {Promise<boolean>} 인증 완료 여부
 */
async function isVerified(contact, contactType, purpose) {
  try {
    const result = await db.queryDatabase(`
      SELECT * FROM VerificationCodes
      WHERE contact = ? AND contact_type = ? AND purpose = ?
        AND verified = TRUE AND verified_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY verified_at DESC
      LIMIT 1
    `, [contact, contactType, purpose]);

    return result.length > 0;
  } catch (error) {
    console.error('Verification check error:', error);
    return false;
  }
}

/**
 * 만료된 인증 코드 정리 (크론 작업용)
 */
async function cleanupExpiredCodes() {
  try {
    const result = await db.queryDatabase(`
      DELETE FROM VerificationCodes
      WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);
    console.log(`Cleaned up ${result.affectedRows} expired verification codes`);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

module.exports = {
  generateCode,
  createVerificationCode,
  sendEmailVerification,
  sendPhoneVerification,
  verifyCode,
  isVerified,
  cleanupExpiredCodes
};
