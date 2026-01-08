// 센터 가입 프로세스 관리
let currentStep = 1;
let userIDChecked = false;
let phoneVerified = false;
let tempData = {};

// Alert 표시 함수
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertHTML = `
        <div class="alert alert-${type}">
            ${message}
            <button type="button" onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
        </div>
    `;
    alertContainer.innerHTML = alertHTML;

    // 3초 후 자동 제거
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Step 전환 함수
function goToStep(step) {
    // 모든 step-form 숨기기
    document.querySelectorAll('.step-form').forEach(form => {
        form.classList.add('hidden');
    });

    // Step indicator 업데이트
    document.querySelectorAll('.step').forEach((el, index) => {
        el.classList.remove('active', 'completed');
        if (index < step - 1) {
            el.classList.add('completed');
        } else if (index === step - 1) {
            el.classList.add('active');
        }
    });

    // 해당 step 표시
    document.getElementById(`step${step}Form`).classList.remove('hidden');
    currentStep = step;

    // 스크롤 최상단으로
    window.scrollTo(0, 0);
}

// 아이디 중복 확인
document.getElementById('checkUserIDBtn').addEventListener('click', async function() {
    const userID = document.getElementById('userID').value.trim();
    const statusEl = document.getElementById('userIDStatus');

    if (!userID) {
        statusEl.textContent = '아이디를 입력하세요';
        statusEl.className = 'verification-status error';
        return;
    }

    if (userID.length < 4 || userID.length > 20) {
        statusEl.textContent = '아이디는 4~20자여야 합니다';
        statusEl.className = 'verification-status error';
        return;
    }

    try {
        const response = await fetch('/auth/api/check-userid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID })
        });

        const data = await response.json();

        if (data.available) {
            statusEl.textContent = '✓ 사용 가능한 아이디입니다';
            statusEl.className = 'verification-status success';
            userIDChecked = true;
        } else {
            statusEl.textContent = '✗ 이미 사용 중인 아이디입니다';
            statusEl.className = 'verification-status error';
            userIDChecked = false;
        }
    } catch (error) {
        console.error('Error:', error);
        statusEl.textContent = '확인 중 오류가 발생했습니다';
        statusEl.className = 'verification-status error';
    }
});

// 아이디 입력 시 중복 확인 상태 초기화
document.getElementById('userID').addEventListener('input', function() {
    userIDChecked = false;
    document.getElementById('userIDStatus').textContent = '';
});

// 비밀번호 확인
document.getElementById('passwordConfirm').addEventListener('input', function() {
    const password = document.getElementById('password').value;
    const confirm = this.value;
    const statusEl = document.getElementById('passwordStatus');

    if (confirm && password !== confirm) {
        statusEl.textContent = '비밀번호가 일치하지 않습니다';
        statusEl.className = 'verification-status error';
    } else if (confirm && password === confirm) {
        statusEl.textContent = '✓ 비밀번호가 일치합니다';
        statusEl.className = 'verification-status success';
    } else {
        statusEl.textContent = '';
    }
});

// Step 1: 기본 정보 입력
document.getElementById('step1Form').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!userIDChecked) {
        showAlert('아이디 중복 확인을 해주세요', 'error');
        return;
    }

    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;

    if (password.length < 8) {
        showAlert('비밀번호는 8자 이상이어야 합니다', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showAlert('비밀번호가 일치하지 않습니다', 'error');
        return;
    }

    // 데이터 임시 저장
    tempData.userID = document.getElementById('userID').value.trim();
    tempData.password = password;
    tempData.name = document.getElementById('name').value.trim();
    tempData.email = document.getElementById('email').value.trim();
    tempData.centerName = document.getElementById('centerName').value.trim();
    tempData.role = document.getElementById('role').value;

    // Step 2로 이동
    goToStep(2);
});

// Step 2: 뒤로 가기
document.getElementById('step2BackBtn').addEventListener('click', function() {
    goToStep(1);
});

// SMS 인증번호 전송
document.getElementById('sendSMSBtn').addEventListener('click', async function() {
    const phone = document.getElementById('phone').value.trim().replace(/-/g, '');
    const btn = this;

    if (!phone || !/^01[0-9]{8,9}$/.test(phone)) {
        showAlert('유효한 휴대폰 번호를 입력하세요 (예: 01012345678)', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '전송 중...';

    try {
        const response = await fetch('/auth/api/send-sms-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, purpose: 'register' })
        });

        const data = await response.json();

        if (data.success) {
            showAlert(data.message, 'success');
            document.getElementById('verificationCodeGroup').classList.remove('hidden');
            tempData.phone = phone;

            // 개발 모드: 코드 표시
            if (data.code) {
                console.log('🔐 인증 코드 (개발용):', data.code);
                document.getElementById('verificationStatus').textContent = `개발 모드: ${data.code}`;
                document.getElementById('verificationStatus').className = 'help-text';
            }

            // 3분 후 재전송 가능
            let countdown = 180;
            btn.textContent = `재전송 (${countdown}초)`;
            const interval = setInterval(() => {
                countdown--;
                btn.textContent = `재전송 (${countdown}초)`;
                if (countdown <= 0) {
                    clearInterval(interval);
                    btn.disabled = false;
                    btn.textContent = '재전송';
                }
            }, 1000);
        } else {
            showAlert(data.message || '전송 실패', 'error');
            btn.disabled = false;
            btn.textContent = '인증번호 전송';
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('전송 중 오류가 발생했습니다', 'error');
        btn.disabled = false;
        btn.textContent = '인증번호 전송';
    }
});

// 인증번호 확인
document.getElementById('verifyCodeBtn').addEventListener('click', async function() {
    const phone = tempData.phone;
    const code = document.getElementById('verificationCode').value.trim();
    const statusEl = document.getElementById('verificationStatus');
    const btn = this;

    if (!code || code.length !== 6) {
        statusEl.textContent = '6자리 인증번호를 입력하세요';
        statusEl.className = 'verification-status error';
        return;
    }

    btn.disabled = true;
    btn.textContent = '확인 중...';

    try {
        const response = await fetch('/auth/api/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contact: phone,
                contactType: 'phone',
                code: code,
                purpose: 'register'
            })
        });

        const data = await response.json();

        if (data.success) {
            statusEl.textContent = '✓ 인증 완료';
            statusEl.className = 'verification-status success';
            phoneVerified = true;
            document.getElementById('step2NextBtn').disabled = false;
            document.getElementById('verificationCodeGroup').querySelector('input').disabled = true;
            btn.disabled = true;
            btn.textContent = '인증 완료';
            showAlert('휴대폰 인증이 완료되었습니다', 'success');
        } else {
            statusEl.textContent = '✗ ' + (data.message || '인증 실패');
            statusEl.className = 'verification-status error';
            btn.disabled = false;
            btn.textContent = '인증 확인';
        }
    } catch (error) {
        console.error('Error:', error);
        statusEl.textContent = '확인 중 오류가 발생했습니다';
        statusEl.className = 'verification-status error';
        btn.disabled = false;
        btn.textContent = '인증 확인';
    }
});

// Step 2: 가입 완료
document.getElementById('step2Form').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!phoneVerified) {
        showAlert('휴대폰 인증을 완료해주세요', 'error');
        return;
    }

    const btn = document.getElementById('step2NextBtn');
    btn.disabled = true;
    btn.textContent = '가입 처리 중...';

    try {
        const response = await fetch('/auth/register-center', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tempData)
        });

        const data = await response.json();

        if (data.success) {
            goToStep(3);
        } else {
            showAlert(data.message || '가입 처리 중 오류가 발생했습니다', 'error');
            btn.disabled = false;
            btn.textContent = '가입 완료';
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('가입 처리 중 오류가 발생했습니다', 'error');
        btn.disabled = false;
        btn.textContent = '가입 완료';
    }
});
