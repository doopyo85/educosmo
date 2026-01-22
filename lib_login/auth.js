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



      ${alertHTML}

      <form id="loginForm">
        <input class="login" type="text" name="userID" placeholder="아이디" autocomplete="username" required>
        <input class="login" type="password" name="password" placeholder="비밀번호" autocomplete="current-password" required>
        <input class="btn" type="submit" value="로그인">
      </form>
      <p class="register-link">
        계정이 없으신가요? <a href="/auth/register">학생 가입</a>
      </p>
      <p class="register-link" style="margin-top: 10px; font-size: 0.9em;">
        센터를 개설하시나요? <a href="/auth/register-center">센터 개설하기</a>
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
      <\/script>
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

// 회원가입 페이지 렌더링 (학생 초대 코드 가입)
router.get('/register', async (req, res) => {
    const title = '학생 가입';

    const html = template.HTML(title, `
        <h2 style="text-align: center; font-size: 18px; margin-bottom: 20px;">센터 초대 코드로 가입</h2>
        <p style="text-align: center; color: #666; margin-bottom: 30px;">학원/학교에서 받은 초대 코드를 입력하세요</p>

        <!-- Step 1: 초대 코드 입력 -->
        <div id="step1">
            <form id="codeVerifyForm">
                <input class="login" type="text" name="inviteCode" id="inviteCode" placeholder="초대 코드 (8자리)" maxlength="8" required style="text-transform: uppercase;">
                <button type="submit" class="btn" style="width: 100%; padding: 10px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">코드 확인</button>
            </form>
        </div>

        <!-- Step 2: 회원정보 입력 (코드 확인 후 표시) -->
        <div id="step2" style="display: none;">
            <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 14px;">
                    <strong>센터:</strong> <span id="centerName"></span>
                </p>
            </div>

            <form id="registerForm">
                <input type="hidden" name="inviteCode" id="inviteCodeHidden">
                <input type="hidden" name="centerID" id="centerID">

                <input class="login" type="text" name="userID" id="userID" placeholder="아이디" required>
                <input class="login" type="password" name="password" id="password" placeholder="비밀번호 (8자 이상)" required minlength="8">
                <input class="login" type="password" name="passwordConfirm" id="passwordConfirm" placeholder="비밀번호 확인" required>
                <input class="login" type="email" name="email" id="email" placeholder="이메일">
                <input class="login" type="text" name="name" id="name" placeholder="이름" required>
                <input class="login" type="tel" name="phone" id="phone" placeholder="전화번호 (선택)">

                <div style="margin: 10px 0;">
                    <input type="checkbox" id="privacyAgreement" required>
                    <label for="privacyAgreement" style="font-size: 12px;">
                        개인정보 취급방침에 동의합니다. <a href="#" id="privacyPolicyLink">자세히 보기</a>
                    </label>
                </div>

                <input class="btn" type="submit" value="가입하기" style="width: 100%; padding: 10px; background-color: black; color: white; border: none; border-radius: 4px; cursor: pointer;">
            </form>

            <p style="text-align: center; margin-top: 15px;">
                <a href="/auth/register-center" style="color: #2196F3; text-decoration: none;">센터를 개설하시나요?</a>
            </p>
        </div>

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
                // Step 1: 초대 코드 확인
                document.getElementById('codeVerifyForm').addEventListener('submit', async function(event) {
                    event.preventDefault();

                    const inviteCode = document.getElementById('inviteCode').value.trim();
                    const submitBtn = this.querySelector('button[type="submit"]');

                    if (inviteCode.length !== 8) {
                        alert('초대 코드는 8자리여야 합니다.');
                        return;
                    }

                    submitBtn.disabled = true;
                    submitBtn.textContent = '확인 중...';

                    try {
                        const response = await fetch('/auth/api/verify-invite-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ inviteCode })
                        });

                        const data = await response.json();

                        if (data.error) {
                            alert(data.error);
                            submitBtn.disabled = false;
                            submitBtn.textContent = '코드 확인';
                            return;
                        }

                        // 성공: Step 2 표시
                        document.getElementById('centerName').textContent = data.centerName;
                        document.getElementById('inviteCodeHidden').value = inviteCode;
                        document.getElementById('centerID').value = data.centerID;
                        document.getElementById('step1').style.display = 'none';
                        document.getElementById('step2').style.display = 'block';

                    } catch (error) {
                        console.error('Error:', error);
                        alert('초대 코드 확인 중 오류가 발생했습니다.');
                        submitBtn.disabled = false;
                        submitBtn.textContent = '코드 확인';
                    }
                });

                // Step 2: 회원가입 제출
                document.getElementById('registerForm').addEventListener('submit', async function(event) {
                    event.preventDefault();

                    if (!document.getElementById('privacyAgreement').checked) {
                        alert('개인정보 취급방침에 동의해야 합니다.');
                        return;
                    }

                    const formData = new FormData(this);
                    const data = Object.fromEntries(formData.entries());
                    const submitBtn = this.querySelector('button[type="submit"]');

                    submitBtn.disabled = true;
                    submitBtn.textContent = '가입 처리 중...';

                    try {
                        const response = await fetch('/auth/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();

                        if (result.error) {
                            alert(result.error);
                            submitBtn.disabled = false;
                            submitBtn.textContent = '가입하기';
                        } else {
                            alert(result.message);
                            window.location.href = '/auth/login';
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('회원가입 중 오류가 발생했습니다.');
                        submitBtn.disabled = false;
                        submitBtn.textContent = '가입하기';
                    }
                });

                // 개인정보 처리방침 모달 관련 스크립트
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
            <\/script>
    `);
    res.send(html);
});

// 회원가입 처리 (초대 코드 기반 학생 가입)
router.post('/register', async (req, res) => {
    try {
        const { userID, password, email, name, inviteCode, centerID } = req.body;

        // 필수 필드 검증
        if (!userID || userID.trim() === '') {
            return res.status(400).json({ error: '아이디를 입력해주세요.' });
        }

        if (!password || password.length < 8) {
            return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: '이름을 입력해주세요.' });
        }

        if (!inviteCode || inviteCode.trim().length !== 8) {
            return res.status(400).json({ error: '유효하지 않은 초대 코드입니다.' });
        }

        if (!centerID) {
            return res.status(400).json({ error: '센터 정보가 없습니다.' });
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

        // 초대 코드 재검증 (최종 확인)
        const codeQuery = `
            SELECT id, centerID, max_uses, used_count, expires_at
            FROM center_invite_codes
            WHERE code = ? AND is_active = 1 AND centerID = ?
        `;
        const codeResult = await queryDatabase(codeQuery, [inviteCode, centerID]);

        if (codeResult.length === 0) {
            return res.status(404).json({ error: '유효하지 않은 초대 코드입니다.' });
        }

        const inviteCodeData = codeResult[0];

        // 만료 및 사용 횟수 재확인
        if (inviteCodeData.expires_at && new Date(inviteCodeData.expires_at) < new Date()) {
            return res.status(400).json({ error: '만료된 초대 코드입니다.' });
        }

        if (inviteCodeData.max_uses && inviteCodeData.used_count >= inviteCodeData.max_uses) {
            return res.status(400).json({ error: '사용 가능 횟수를 초과한 초대 코드입니다.' });
        }

        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);

        // 사용자 생성 (account_type='center_student', role='student')
        const insertUserQuery = `
            INSERT INTO Users (userID, password, email, name, role, centerID, account_type)
            VALUES (?, ?, ?, ?, 'student', ?, 'center_student')
        `;
        const userValues = [userID, hashedPassword, email || null, name, centerID];

        await queryDatabase(insertUserQuery, userValues);

        // 초대 코드 사용 횟수 증가
        const updateCodeQuery = `
            UPDATE center_invite_codes
            SET used_count = used_count + 1
            WHERE id = ?
        `;
        await queryDatabase(updateCodeQuery, [inviteCodeData.id]);

        res.status(201).json({
            message: '회원가입이 완료되었습니다. 로그인해주세요.',
            success: true
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
});

// ========================================
// 학생 초대 코드 확인 API
// ========================================

// 초대 코드 검증 API
router.post('/api/verify-invite-code', async (req, res) => {
    try {
        const { inviteCode } = req.body;

        if (!inviteCode || inviteCode.trim().length !== 8) {
            return res.status(400).json({ error: '유효하지 않은 초대 코드입니다.' });
        }

        // 초대 코드 조회
        const codeQuery = `
            SELECT cic.id, cic.centerID, cic.code, cic.max_uses, cic.used_count, cic.expires_at,
                   c.center_name, c.status as center_status
            FROM center_invite_codes cic
            LEFT JOIN Centers c ON cic.centerID = c.id
            WHERE cic.code = ? AND cic.is_active = 1
        `;
        const codeResult = await queryDatabase(codeQuery, [inviteCode]);

        if (codeResult.length === 0) {
            return res.status(404).json({ error: '존재하지 않거나 비활성화된 초대 코드입니다.' });
        }

        const inviteCodeData = codeResult[0];

        // 센터 상태 확인
        if (inviteCodeData.center_status !== 'ACTIVE') {
            return res.status(403).json({ error: '현재 이용이 중지된 센터입니다.' });
        }

        // 만료 확인
        if (inviteCodeData.expires_at && new Date(inviteCodeData.expires_at) < new Date()) {
            return res.status(400).json({ error: '만료된 초대 코드입니다.' });
        }

        // 사용 횟수 확인
        if (inviteCodeData.max_uses && inviteCodeData.used_count >= inviteCodeData.max_uses) {
            return res.status(400).json({ error: '사용 가능 횟수를 초과한 초대 코드입니다.' });
        }

        // 성공 응답
        res.json({
            success: true,
            centerID: inviteCodeData.centerID,
            centerName: inviteCodeData.center_name
        });

    } catch (error) {
        console.error('Error verifying invite code:', error);
        res.status(500).json({ error: '초대 코드 확인 중 오류가 발생했습니다.' });
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

        // 2. 센터 블로그 자동 생성
        try {
            // 센터명을 기반으로 서브도메인 생성 (영문/숫자만, 소문자, 4-20자)
            let subdomain = centerName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '') // 영문, 숫자만 남김
                .substring(0, 20); // 최대 20자

            // 최소 4자 체크
            if (subdomain.length < 4) {
                subdomain = `center${newCenterID}`;
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
                    newCenterID,
                    finalSubdomain,
                    `${centerName} 클라우드`,
                    `${centerName}의 학습 자료실`,
                    'cloud',
                    true
                ]
            );

            console.log(`✅ 센터 블로그 자동 생성 완료: ${finalSubdomain}.pong2.app (센터 ID: ${newCenterID})`);

        } catch (blogError) {
            console.error('❌ 센터 블로그 자동 생성 실패:', blogError);
            // 센터는 생성되었으므로 에러를 로그만 하고 계속 진행
        }

        // 3. 사용자 생성 (센터 관리자 권한)
        const hashedPassword = await bcrypt.hash(password, 10);
        await queryDatabase(`
            INSERT INTO Users (userID, password, email, name, phone, role, centerID, account_type, storage_limit_bytes, blog_post_limit)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'center_admin', 5368709120, 999999)
        `, [userID, hashedPassword, email, name, phone, role, newCenterID]);

        console.log(`✅ 센터 관리자 계정 생성 완료: ${userID} (account_type: center_admin, 5GB)`);

        // 4. CenterStorageUsage 초기화 (30GB)
        await queryDatabase(`
            INSERT INTO CenterStorageUsage (center_id, plan_type, storage_limit, total_usage, object_count)
            VALUES (?, 'standard', 32212254720, 0, 0)
        `, [newCenterID]);

        console.log(`✅ 센터 스토리지 초기화 완료: 30GB (standard)`);

        // 5. center_subscriptions Trial 생성 (14일 무료 체험)
        await queryDatabase(`
            INSERT INTO center_subscriptions
            (center_id, plan_type, status, storage_limit_bytes, student_limit, price_monthly, trial_ends_at, next_billing_date, created_at)
            VALUES (?, 'standard', 'trial', 32212254720, NULL, 110000, DATE_ADD(NOW(), INTERVAL 14 DAY), DATE_ADD(NOW(), INTERVAL 14 DAY), NOW())
        `, [newCenterID]);

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);
        console.log(`✅ Trial 구독 생성 완료: 14일 무료 체험 (만료일: ${trialEndsAt.toISOString().split('T')[0]})`);


        // 6. 가입 환영 이메일 발송
        try {
            await sendCenterWelcomeEmail(email, centerName, userID);
        } catch (emailError) {
            console.error('Welcome email send error:', emailError);
            // 이메일 실패해도 가입은 성공 처리
        }

        // 7. Google Sheets에 센터 추가 (선택 사항 - 수동으로 관리할 수도 있음)
        console.log(`✅ 새 센터 등록 완료: [${newCenterID}] ${centerName}`);

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