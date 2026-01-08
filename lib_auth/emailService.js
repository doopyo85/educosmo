const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// AWS SES 클라이언트 설정
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * 이메일 전송 함수
 * @param {string} to - 수신자 이메일
 * @param {string} subject - 이메일 제목
 * @param {string} htmlBody - HTML 본문
 * @param {string} textBody - 텍스트 본문 (fallback)
 * @returns {Promise<boolean>} 성공 여부
 */
async function sendEmail(to, subject, htmlBody, textBody = '') {
  const params = {
    Source: process.env.SES_FROM_EMAIL || 'noreply@codingnplay.co.kr',
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: textBody || htmlBody.replace(/<[^>]*>/g, ''),
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    const command = new SendEmailCommand(params);
    await sesClient.send(command);
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

/**
 * 인증 코드 이메일 전송
 * @param {string} email - 수신자 이메일
 * @param {string} code - 인증 코드 (6자리)
 * @param {string} purpose - 'verify' (이메일 인증) 또는 'reset' (비밀번호 재설정)
 */
async function sendVerificationEmail(email, code, purpose = 'verify') {
  const subject = purpose === 'verify'
    ? '[코딩앤플레이] 이메일 인증 코드'
    : '[코딩앤플레이] 비밀번호 재설정 인증 코드';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: white; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
        .code-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
        .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace; }
        .warning { color: #dc3545; font-size: 14px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 코딩앤플레이</h1>
        </div>
        <div class="content">
          <h2>${purpose === 'verify' ? '이메일 인증' : '비밀번호 재설정'}</h2>
          <p>안녕하세요,</p>
          <p>${purpose === 'verify'
            ? '회원가입을 완료하기 위해 아래 인증 코드를 입력해주세요.'
            : '비밀번호 재설정을 위해 아래 인증 코드를 입력해주세요.'}</p>

          <div class="code-box">
            <div class="code">${code}</div>
          </div>

          <p>이 코드는 <strong>10분간 유효</strong>합니다.</p>
          <p class="warning">
            ⚠️ 본인이 요청하지 않은 경우, 이 이메일을 무시하시기 바랍니다.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 코딩앤플레이. All rights reserved.</p>
          <p>이 이메일은 자동 발송되었습니다. 회신하지 마세요.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
[코딩앤플레이] ${purpose === 'verify' ? '이메일 인증' : '비밀번호 재설정'}

인증 코드: ${code}

이 코드는 10분간 유효합니다.
본인이 요청하지 않은 경우, 이 이메일을 무시하시기 바랍니다.

© 2026 코딩앤플레이
  `;

  return await sendEmail(email, subject, htmlBody, textBody);
}

/**
 * 센터 가입 완료 이메일 전송
 * @param {string} email - 수신자 이메일
 * @param {string} centerName - 센터명
 * @param {string} userID - 사용자 ID
 */
async function sendCenterWelcomeEmail(email, centerName, userID) {
  const subject = '[코딩앤플레이] 센터 가입이 완료되었습니다';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: white; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
        .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 가입 완료</h1>
        </div>
        <div class="content">
          <h2>환영합니다!</h2>
          <p><strong>${centerName}</strong> 센터 가입이 완료되었습니다.</p>

          <div class="info-box">
            <strong>가입 정보</strong><br>
            아이디: <strong>${userID}</strong><br>
            센터명: <strong>${centerName}</strong>
          </div>

          <p>지금 바로 로그인하여 코딩앤플레이의 다양한 서비스를 이용해보세요!</p>

          <a href="https://app.codingnplay.co.kr/auth/login" class="button">로그인하기</a>

          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            문의사항이 있으시면 언제든지 고객센터로 연락주세요.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 코딩앤플레이. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
[코딩앤플레이] 가입 완료

${centerName} 센터 가입이 완료되었습니다.

가입 정보:
- 아이디: ${userID}
- 센터명: ${centerName}

로그인 URL: https://app.codingnplay.co.kr/auth/login

© 2026 코딩앤플레이
  `;

  return await sendEmail(email, subject, htmlBody, textBody);
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendCenterWelcomeEmail
};
