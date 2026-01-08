const CryptoJS = require('crypto-js');
const axios = require('axios');

/**
 * NCP (네이버 클라우드 플랫폼) SMS API 서비스
 *
 * 필요한 환경 변수:
 * - NCP_SERVICE_ID: SMS 서비스 ID
 * - NCP_ACCESS_KEY: Access Key
 * - NCP_SECRET_KEY: Secret Key
 * - NCP_SENDER_PHONE: 발신번호 (예: 01012345678)
 */

class NCPSmsService {
  constructor() {
    this.serviceId = process.env.NCP_SERVICE_ID;
    this.accessKey = process.env.NCP_ACCESS_KEY;
    this.secretKey = process.env.NCP_SECRET_KEY;
    this.senderPhone = process.env.NCP_SENDER_PHONE;
    this.baseUrl = `https://sens.apigw.ntruss.com/sms/v2/services/${this.serviceId}`;
  }

  /**
   * NCP API 요청 서명 생성
   */
  makeSignature(method, url, timestamp) {
    const space = ' ';
    const newLine = '\n';

    const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, this.secretKey);
    hmac.update(method);
    hmac.update(space);
    hmac.update(url);
    hmac.update(newLine);
    hmac.update(timestamp);
    hmac.update(newLine);
    hmac.update(this.accessKey);

    const hash = hmac.finalize();
    return hash.toString(CryptoJS.enc.Base64);
  }

  /**
   * SMS 전송
   * @param {string} to - 수신자 전화번호 (01012345678 형식)
   * @param {string} content - 메시지 내용
   * @returns {Promise<{success: boolean, message: string, requestId?: string}>}
   */
  async sendSMS(to, content) {
    // 환경 변수 확인
    if (!this.serviceId || !this.accessKey || !this.secretKey || !this.senderPhone) {
      console.error('NCP SMS 환경 변수가 설정되지 않았습니다.');
      console.log('설정 필요: NCP_SERVICE_ID, NCP_ACCESS_KEY, NCP_SECRET_KEY, NCP_SENDER_PHONE');

      // 개발 모드: 콘솔에 출력하고 성공 처리
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[개발 모드] SMS 발송 시뮬레이션:`);
        console.log(`  수신: ${to}`);
        console.log(`  내용: ${content}`);
        return {
          success: true,
          message: 'SMS 발송 완료 (개발 모드 시뮬레이션)',
          requestId: 'dev-' + Date.now()
        };
      }

      return {
        success: false,
        message: 'SMS 서비스 설정이 완료되지 않았습니다.'
      };
    }

    try {
      const timestamp = Date.now().toString();
      const method = 'POST';
      const uri = `/sms/v2/services/${this.serviceId}/messages`;
      const signature = this.makeSignature(method, uri, timestamp);

      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': this.accessKey,
        'x-ncp-apigw-signature-v2': signature
      };

      const body = {
        type: 'SMS',  // SMS (90바이트) 또는 LMS (2000바이트)
        contentType: 'COMM',  // COMM: 일반, AD: 광고
        countryCode: '82',
        from: this.senderPhone,
        content: content,
        messages: [
          {
            to: to,
            content: content  // 개별 메시지 내용 (선택)
          }
        ]
      };

      const response = await axios.post(`${this.baseUrl}/messages`, body, { headers });

      if (response.status === 202) {
        console.log(`SMS 발송 성공: ${to}`);
        return {
          success: true,
          message: 'SMS 발송이 완료되었습니다.',
          requestId: response.data.requestId
        };
      } else {
        console.error('SMS 발송 실패:', response.data);
        return {
          success: false,
          message: 'SMS 발송에 실패했습니다.'
        };
      }
    } catch (error) {
      console.error('NCP SMS API 오류:', error.response?.data || error.message);

      // 개발 모드: 에러 발생 시에도 성공 처리
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[개발 모드] SMS 발송 시뮬레이션 (에러 발생):`);
        console.log(`  수신: ${to}`);
        console.log(`  내용: ${content}`);
        return {
          success: true,
          message: 'SMS 발송 완료 (개발 모드 시뮬레이션)',
          requestId: 'dev-error-' + Date.now()
        };
      }

      return {
        success: false,
        message: 'SMS 발송 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 인증 코드 SMS 전송
   * @param {string} phone - 수신자 전화번호
   * @param {string} code - 인증 코드 (6자리)
   * @param {string} purpose - 'register', 'reset_password', 'phone_verify'
   */
  async sendVerificationSMS(phone, code, purpose = 'phone_verify') {
    let content = '';

    switch (purpose) {
      case 'register':
        content = `[코딩앤플레이] 센터 가입 인증번호는 [${code}]입니다.`;
        break;
      case 'reset_password':
        content = `[코딩앤플레이] 비밀번호 재설정 인증번호는 [${code}]입니다.`;
        break;
      case 'phone_verify':
      default:
        content = `[코딩앤플레이] 본인확인 인증번호는 [${code}]입니다.`;
        break;
    }

    return await this.sendSMS(phone, content);
  }

  /**
   * 전화번호 형식 검증
   * @param {string} phone - 전화번호
   * @returns {boolean}
   */
  validatePhoneNumber(phone) {
    // 한국 전화번호 형식: 010-1234-5678, 01012345678 등
    const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 전화번호 정규화 (하이픈 제거)
   * @param {string} phone - 전화번호
   * @returns {string}
   */
  normalizePhoneNumber(phone) {
    return phone.replace(/-/g, '');
  }

  /**
   * 발송 가능한 전화번호로 변환
   * @param {string} phone - 전화번호
   * @returns {string|null} 정규화된 전화번호 또는 null (유효하지 않은 경우)
   */
  formatPhoneNumber(phone) {
    const normalized = this.normalizePhoneNumber(phone);
    if (this.validatePhoneNumber(normalized)) {
      return normalized;
    }
    return null;
  }
}

// 싱글톤 인스턴스
const smsService = new NCPSmsService();

module.exports = smsService;
