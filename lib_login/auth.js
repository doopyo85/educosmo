const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const template = require('./template.js');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken'); // 🔥 JWT 추가
const { queryDatabase } = require('./db');
const { BASE_URL, API_ENDPOINTS, Roles, JWT } = require('../config'); // 🔥 JWT Config 추가

// 구글 시트 데이터 가져오기
async function fetchCentersFromSheet() {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: '센터목록!A2:B' // A: ID, B: Name
    });
    return response.data.values; // [[id1, name1], [id2, name2], ...]
}

// 로그인 페이지 렌더링
router.get('/login', (req, res) => {
    const title = '로그인';

    // 🔥 서비스 타입 확인 (도메인 기반)
    const hostname = req.get('host') || '';
    const isCosmoedu = hostname.includes('cosmoedu');

    // 🔥 서비스별 로고 선택
    const logoSrc = isCosmoedu ? '/resource/rocket.webp' : '/resource/logo.png';
    const logoAlt = isCosmoedu ? '코스모에듀 로고' : '코딩앤플레이 로고';

    // 🔥 SSO: redirect 파라미터 처리 (pong2 등 외부 앱에서 오는 경우)
    const redirectParam = req.query.redirect;
    if (redirectParam) {
        // 허용된 도메인만 리다이렉트 허용 (보안)
        const allowedDomains = ['pong2.app', 'www.pong2.app', 'localhost'];
        try {
            const redirectHost = new URL(redirectParam).hostname;
            if (allowedDomains.some(domain => redirectHost === domain || redirectHost.endsWith('.' + domain))) {
                req.session.ssoRedirect = redirectParam;
                console.log('[SSO] Redirect URL saved:', redirectParam);
            } else {
                console.warn('[SSO] Blocked redirect to:', redirectHost);
            }
        } catch (e) {
            console.warn('[SSO] Invalid redirect URL:', redirectParam);
        }
    }

    // 세션에서 로그인 메시지 가져오기
    const loginMessage = req.session.loginMessage || '';

    // 메시지 표시 후 세션에서 삭제
    delete req.session.loginMessage;

    // 알림 메시지 HTML (메시지가 있을 경우에만 표시)
    const alertHTML = loginMessage ?
        `<div class="alert" style="background-color: #fff3cd; color: #856404; padding: 12px; border-radius: 4px; margin-bottom: 15px; text-align: center;">
         ${loginMessage}
         <button type="button" onclick="this.parentElement.style.display='none'" style="background: none; border: none; float: right; font-weight: bold; cursor: pointer;">&times;</button>
       </div>` : '';

    const body = `
      <div style="text-align: center;">
        <img src="${logoSrc}" alt="${logoAlt}" style="width: 80px; height: auto; margin-bottom: 20px;"/>
      </div>

      <!-- 공지사항 -->
      <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 16px; font-weight: bold; text-align: center;">■ 공지안내 ■</h3>
        <div style="color: #856404; font-size: 14px; line-height: 1.8;">
          <p style="margin: 0 0 10px 0;">지난 10일 아마존 서버에서 IP 차단으로 인해 계정이 잠기는 문제가 발생하였습니다.</p>
          <p style="margin: 0 0 10px 0;">현재 서버를 복구 중에 있어 일부 기능들이 오작동하고 있습니다.</p>
          <p style="margin: 10px 0; padding: 10px; background-color: #fff; border-left: 4px solid #ffc107;">
            <strong>현재 교사계정은 활성화되었으나,<br>
            학생 계정은 다시 회원가입 또는 교사계정에서 생성해 주시기 바랍니다.</strong>
          </p>
          <p style="margin: 10px 0 0 0; text-align: center; font-size: 13px;">불편을 드려 대단히 죄송합니다.<br>감사합니다.</p>
        </div>
      </div>

      ${alertHTML}

      <form id="loginForm">
        <input class="login" type="text" name="userID" placeholder="아이디" autocomplete="username" required>
        <input class="login" type="password" name="password" placeholder="비밀번호" autocomplete="current-password" required>
        <input class="btn" type="submit" value="로그인">
      </form>
      <p class="register-link">
        계정이 없으신가요? <a href="/auth/register">회원가입</a>
      </p>

      <script>
          // 로그인 중복 방지 플래그
          let isLoggingIn = false;
          
          // 로그인 폼 제출 처리
          document.getElementById('loginForm').addEventListener('submit', function(event) {
              event.preventDefault();
              
              // 중복 제출 방지
              if (isLoggingIn) {
                  console.log('로그인 진행 중...');
                  return;
              }
              
              isLoggingIn = true;
              const submitButton = this.querySelector('input[type="submit"]');
              const originalValue = submitButton.value;
              submitButton.value = '로그인 중...';
              submitButton.disabled = true;

              const formData = new FormData(this);
              const data = Object.fromEntries(formData.entries());
              
              console.log('로그인 요청 시작:', data.userID);

              fetch('/auth/login_process', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data),
              })
              .then(response => {
                  console.log('로그인 응답 상태:', response.status);
                  return response.json();
              })
              .then(data => {
                  console.log('로그인 응답 데이터:', data);
                  
                  if (data.error) {
                      alert(data.error);
                      // 오류 시 버튼 상태 복구
                      isLoggingIn = false;
                      submitButton.value = originalValue;
                      submitButton.disabled = false;
                  } else if (data.success && data.redirect) {
                      console.log('로그인 성공, 리다이렉트:', data.redirect);
                      window.location.href = data.redirect;
                  } else {
                      console.error('예상치 못한 응답 형식:', data);
                      alert('로그인 중 예상치 못한 오류가 발생했습니다.');
                      isLoggingIn = false;
                      submitButton.value = originalValue;
                      submitButton.disabled = false;
                  }
              })
              .catch(error => {
                  console.error('로그인 요청 오류:', error);
                  alert('로그인 중 네트워크 오류가 발생했습니다.');
                  // 네트워크 오류 시 버튼 상태 복구
                  isLoggingIn = false;
                  submitButton.value = originalValue;
                  submitButton.disabled = false;
              });
          });
      </script>
    `;
    const html = template.HTML(title, body);
    res.send(html);
});


// 로그인 처리
router.post('/login_process', async (req, res) => {
    const { userID, password } = req.body;

    // 로그인 시도 로깅
    console.log(`[LOGIN ATTEMPT] 사용자 ID: ${userID}, IP: ${req.ip}, UserAgent: ${req.get('User-Agent')}`);
    console.log(`[LOGIN ATTEMPT] 세션 ID: ${req.sessionID}, 기존 세션 상태:`, req.session);

    try {
        // 입력 값 검증
        if (!userID || !password) {
            console.log('[LOGIN ERROR] 아이디 또는 비밀번호 미입력');
            return res.status(400).json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' });
        }

        // 🔥 DB에서 사용자 조회
        let user = null;
        try {
            const [dbUser] = await queryDatabase(
                'SELECT id, userID, name, password, role, centerID FROM Users WHERE userID = ?',
                [userID]
            );

            if (dbUser) {
                // DB에 사용자가 있을 경우 - 비밀번호 검증
                const bcrypt = require('bcrypt');
                const passwordMatch = await bcrypt.compare(password, dbUser.password);

                if (passwordMatch) {
                    user = dbUser;
                    console.log(`[LOGIN] ✅ DB 사용자 인증 성공: ${userID}, Role: ${user.role}`);
                } else {
                    console.log(`[LOGIN] ❌ 비밀번호 불일치: ${userID}`);
                    return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
                }
            } else {
                // DB에 사용자가 없으면 로그인 거부
                console.log(`[LOGIN] ❌ 사용자 없음: ${userID}`);
                return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
            }
        } catch (dbError) {
            console.error('[LOGIN] DB 조회 오류:', dbError.message);
            return res.status(500).json({ success: false, error: '로그인 처리 중 오류가 발생했습니다.' });
        }

        // 세션 데이터 설정
        req.session.is_logined = true;
        req.session.userID = user.userID;
        req.session.role = user.role;
        req.session.userType = user.userType || user.role;
        req.session.centerID = user.centerID;

        console.log('[LOGIN] 세션에 설정된 데이터:', {
            is_logined: req.session.is_logined,
            userID: req.session.userID,
            role: req.session.role,
            userType: req.session.userType,
            centerID: req.session.centerID,
            sessionID: req.sessionID
        });

        // 세션 저장 및 응답
        req.session.save(err => {
            if (err) {
                console.error('[LOGIN ERROR] 세션 저장 실패:', err);
                return res.status(500).json({ success: false, error: '세션 저장 중 오류가 발생했습니다.' });
            }

            console.log('[LOGIN SUCCESS] 세션 저장 성공');

            // 🔥 JWT 토큰 생성 (SSO용 - 사용자 정보 포함)
            const token = jwt.sign(
                {
                    id: user.id,
                    userID: user.userID,
                    name: user.name,
                    role: user.role,
                    centerID: user.centerID,
                    type: 'PAID'
                },
                JWT.SECRET,
                { expiresIn: JWT.EXPIRES_IN }
            );

            // 🔥 SSO 리다이렉트 처리 (pong2 등 외부 앱으로 돌아가기)
            const ssoRedirect = req.session.ssoRedirect;
            if (ssoRedirect) {
                // SSO 리다이렉트 세션 정리
                delete req.session.ssoRedirect;

                // 토큰을 URL 파라미터로 전달
                const redirectWithToken = `${ssoRedirect}${ssoRedirect.includes('?') ? '&' : '?'}token=${token}`;
                console.log('[SSO] Redirecting to:', redirectWithToken);

                return res.json({
                    success: true,
                    redirect: redirectWithToken,
                    token: token,
                    sso: true
                });
            }

            // 일반 로그인: 역할별 리다이렉트 URL 설정
            let redirectUrl = '/';
            if (user.role === 'kinder') {
                redirectUrl = '/kinder';
            }

            console.log(`[LOGIN SUCCESS] 리다이렉트 URL: ${redirectUrl}`);

            res.json({ success: true, redirect: redirectUrl, token: token });
        });

    } catch (error) {
        console.error('[LOGIN ERROR] 로그인 처리 예외 발생:', error);
        res.status(500).json({ success: false, error: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// 회원가입 페이지 렌더링
router.get('/register', async (req, res) => {
    const title = '회원가입';

    try {
        const centers = await fetchCentersFromSheet();
        const centerOptions = centers
            .map(([id, name]) => `<option value="${id}">${name}</option>`)
            .join('');

        const html = template.HTML(title, `
            <h2 style="text-align: center; font-size: 18px; margin-bottom: 20px;">회원정보를 입력하세요</h2>
            <form id="registerForm">
                <input class="login" type="text" name="userID" id="userID" placeholder="아이디" required>
                <input class="login" type="password" name="password" placeholder="비밀번호" required>
                <input class="login" type="email" name="email" placeholder="이메일">
                <input class="login" type="text" name="name" placeholder="이름" required>
                <input class="login" type="tel" name="phone" placeholder="전화번호">
                <input class="login" type="date" name="birthdate" placeholder="생년월일">

                <select class="login" name="role" required>
                    <option value="student">학생</option>
                    <option value="teacher">강사</option>
                    <option value="manager">센터장</option>
                    <option value="kinder">유치원</option>
                    <option value="school">학교(기관)</option>
                </select>

                <select class="login" name="centerID" required>
                    <option value="">센터를 선택하세요</option>
                    ${centerOptions}
                </select>
                
                <div style="margin: 10px 0;">
                    <input type="checkbox" id="privacyAgreement" required>
                    <label for="privacyAgreement" style="font-size: 12px;">
                        개인정보 취급방침에 동의합니다. <a href="#" id="privacyPolicyLink">자세히 보기</a>
                    </label>
                </div>

                <input class="btn" type="submit" value="가입하기" style="width: 100%; padding: 10px; background-color: black; color: white; border: none; border-radius: 4px; cursor: pointer;">
            </form>

            <!-- 개인정보 처리방침 모달 추가 -->
            <div id="privacyModal" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.4); z-index: 1000;">
                <div class="modal-content" style="background-color: white; margin: 15% auto; padding: 20px; width: 70%; max-width: 600px; border-radius: 5px; position: relative;">
                    <span class="close" style="position: absolute; right: 10px; top: 5px; font-size: 24px; cursor: pointer;">&times;</span>
                    <h2>개인정보 처리방침</h2>
                    <div style="max-height: 400px; overflow-y: auto;">
                        <h3>1. 개인정보 수집 항목 및 목적</h3>
                        <p>필수항목: 이름, 아이디, 비밀번호, 이메일, 생년월일, 연락처<br>
                        선택항목: 소속 교육기관<br>
                        수집목적: 회원가입, 서비스 제공, 교육 진도 관리, 학습 분석</p>

                        <h3>2. 개인정보 보유 기간</h3>
                        <p>- 회원 탈퇴 시까지 보관<br>
                        - 법령에 따른 보관의무가 있는 경우 해당 기간 동안 보관</p>

                        <h3>3. 개인정보의 제3자 제공</h3>
                        <p>- 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.<br>
                        - 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차를 따르는 경우 예외</p>

                        <h3>4. 이용자의 권리</h3>
                        <p>- 개인정보 열람 요구<br>
                        - 오류 정정 요구<br>
                        - 삭제 요구<br>
                        - 처리정지 요구</p>

                        <h3>5. 개인정보 안전성 확보 조치</h3>
                        <p>- 개인정보 암호화<br>
                        - 해킹 등에 대비한 보안시스템 구축<br>
                        - 개인정보 취급자 최소화</p>

                        <h3>6. 개인정보 담당자</h3>
                        <p>- 담당부서: 교육사업부<br>
                        - 담당자명: 전두표<br>
                        - 연락처: 070-4337-4337<br>
                        - 이메일: codmoedu@cosmoedu.co.kr</p>
                        
                        <h3>7. 시행일자</h3>
                        <p>2024년 9월 1일</p>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('registerForm').addEventListener('submit', function(event) {
                    event.preventDefault();

                    if (!document.getElementById('privacyAgreement').checked) {
                        alert('개인정보 취급방침에 동의해야 합니다.');
                        return;
                    }

                    const formData = new FormData(this);
                    const data = Object.fromEntries(formData.entries());

                    fetch('/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            alert(data.error);
                        } else {
                            alert(data.message);
                            window.location.href = '/auth/login';
                        }
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                        alert('회원가입 중 오류가 발생했습니다.');
                    });
                });
            
                // 개인정보 처리방침 모달 관련 스크립트 추가
                const modal = document.getElementById('privacyModal');
                const privacyLink = document.getElementById('privacyPolicyLink');
                const closeBtn = document.getElementsByClassName('close')[0];

                privacyLink.onclick = function(e) {
                    e.preventDefault();
                    modal.style.display = 'block';
                }

                closeBtn.onclick = function() {
                    modal.style.display = 'none';
                }

                window.onclick = function(event) {
                    if (event.target == modal) {
                        modal.style.display = 'none';
                    }
                }
            </script>
        `);
        res.send(html);
    } catch (error) {
        console.error('Error rendering register page:', error);
        res.status(500).send('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
});

// 회원가입 처리
// 회원가입 처리 - 중복 체크 로직 추가
router.post('/register', async (req, res) => {
    try {
        const { userID, password, email, name, phone, birthdate, role, centerID } = req.body;

        // userID 유효성 검사
        if (!userID || userID.trim() === '') {
            return res.status(400).json({ error: '아이디를 입력해주세요.' });
        }

        // userID 중복 체크
        const checkDuplicateQuery = 'SELECT id FROM Users WHERE userID = ?';
        const existingUser = await queryDatabase(checkDuplicateQuery, [userID]);

        if (existingUser.length > 0) {
            return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
        }

        // 이메일 중복 체크 (이메일이 입력된 경우에만)
        if (email && email.trim() !== '') {
            const checkEmailQuery = 'SELECT id FROM Users WHERE email = ?';
            const existingEmail = await queryDatabase(checkEmailQuery, [email]);

            if (existingEmail.length > 0) {
                return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
            }
        }

        const allowedRoles = Object.values(Roles);
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // 빈 문자열인 경우 null로 변환 (DATE 타입 오류 방지)
        const finalBirthdate = (birthdate && birthdate.trim() !== '') ? birthdate : null;

        const query = `INSERT INTO Users (userID, password, email, name, phone, birthdate, role, centerID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [userID, hashedPassword, email, name, phone, finalBirthdate, role, centerID];

        await queryDatabase(query, values);

        res.status(201).json({ message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
});

// ========================================
// 센터 가입 관련 라우트
// ========================================

const verificationService = require('../lib_auth/verificationService');
const { sendCenterWelcomeEmail } = require('../lib_auth/emailService');

// 센터 가입 페이지 렌더링
router.get('/register-center', (req, res) => {
    res.render('auth/register-center');
});

// 아이디 중복 확인 API
router.post('/api/check-userid', async (req, res) => {
    try {
        const { userID } = req.body;

        if (!userID || userID.trim() === '') {
            return res.json({ available: false, message: '아이디를 입력하세요' });
        }

        const existingUser = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userID]);

        res.json({ available: existingUser.length === 0 });
    } catch (error) {
        console.error('Check userID error:', error);
        res.status(500).json({ available: false, message: '확인 중 오류가 발생했습니다' });
    }
});

// SMS 인증 코드 발송 API
router.post('/api/send-sms-verification', async (req, res) => {
    try {
        const { phone, purpose } = req.body;

        const result = await verificationService.sendPhoneVerification(phone, purpose || 'register');
        res.json(result);
    } catch (error) {
        console.error('Send SMS verification error:', error);
        res.status(500).json({ success: false, message: '인증 코드 발송 중 오류가 발생했습니다' });
    }
});

// 이메일 인증 코드 발송 API
router.post('/api/send-email-verification', async (req, res) => {
    try {
        const { email, purpose } = req.body;

        const result = await verificationService.sendEmailVerification(email, purpose || 'register');
        res.json(result);
    } catch (error) {
        console.error('Send email verification error:', error);
        res.status(500).json({ success: false, message: '인증 코드 발송 중 오류가 발생했습니다' });
    }
});

// 인증 코드 확인 API
router.post('/api/verify-code', async (req, res) => {
    try {
        const { contact, contactType, code, purpose } = req.body;

        const result = await verificationService.verifyCode(contact, contactType, code, purpose);
        res.json(result);
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ success: false, message: '인증 확인 중 오류가 발생했습니다' });
    }
});

// 센터 가입 처리
router.post('/register-center', async (req, res) => {
    try {
        const { userID, password, name, email, centerName, role, phone } = req.body;

        // 필수 필드 검증
        if (!userID || !password || !name || !email || !centerName || !role || !phone) {
            return res.status(400).json({ success: false, message: '모든 필수 항목을 입력해주세요' });
        }

        // 휴대폰 인증 확인
        const phoneVerified = await verificationService.isVerified(phone, 'phone', 'register');
        if (!phoneVerified) {
            return res.status(400).json({ success: false, message: '휴대폰 인증이 완료되지 않았습니다' });
        }

        // 아이디 중복 체크
        const existingUser = await queryDatabase('SELECT id FROM Users WHERE userID = ?', [userID]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: '이미 사용 중인 아이디입니다' });
        }

        // 이메일 중복 체크
        const existingEmail = await queryDatabase('SELECT id FROM Users WHERE email = ?', [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ success: false, message: '이미 사용 중인 이메일입니다' });
        }

        // 역할 검증
        const allowedRoles = ['manager', 'teacher', 'kinder', 'school'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, message: '유효하지 않은 역할입니다' });
        }

        // 1. 새 센터 생성 (Centers 테이블에 추가)
        const centerResult = await queryDatabase(`
            INSERT INTO Centers (center_name, contact_name, contact_phone, contact_email, status)
            VALUES (?, ?, ?, ?, 'ACTIVE')
        `, [centerName, name, phone, email]);

        const newCenterID = centerResult.insertId;

        // 2. 사용자 생성
        const hashedPassword = await bcrypt.hash(password, 10);
        await queryDatabase(`
            INSERT INTO Users (userID, password, email, name, phone, role, centerID)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userID, hashedPassword, email, name, phone, role, newCenterID]);

        // 3. CenterStorageUsage 초기화
        await queryDatabase(`
            INSERT INTO CenterStorageUsage (center_id, plan_type, storage_limit, total_usage, object_count)
            VALUES (?, 'free', 10737418240, 0, 0)
        `, [newCenterID]);

        // 4. 가입 환영 이메일 발송
        try {
            await sendCenterWelcomeEmail(email, centerName, userID);
        } catch (emailError) {
            console.error('Welcome email send error:', emailError);
            // 이메일 실패해도 가입은 성공 처리
        }

        // 5. Google Sheets에 센터 추가 (선택 사항 - 수동으로 관리할 수도 있음)
        console.log(`새 센터 등록 완료: [${newCenterID}] ${centerName}`);

        res.json({
            success: true,
            message: '센터 가입이 완료되었습니다',
            centerID: newCenterID
        });

    } catch (error) {
        console.error('Center registration error:', error);
        res.status(500).json({ success: false, message: '가입 처리 중 오류가 발생했습니다' });
    }
});

// 로그아웃 처리
router.get('/logout', (req, res) => {
    console.log(`[LOGOUT] 사용자 로그아웃: ${req.session.userID}`);

    req.session.destroy(err => {
        if (err) {
            console.error('[LOGOUT ERROR] 세션 삭제 실패:', err);
            return res.status(500).json({ success: false, error: '로그아웃 중 오류가 발생했습니다.' });
        }

        res.redirect('/auth/login');
    });
});

module.exports = router;