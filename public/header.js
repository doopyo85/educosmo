// header.js
document.addEventListener("DOMContentLoaded", function () {
    // 중복 초기화 방지
    if (window.headerInitialized) {
        console.warn('Header already initialized, skipping duplicate initialization');
        return;
    }
    window.headerInitialized = true;

    // 현재 사용자 정보 가져오기
    const currentUserID = document.getElementById('currentUserID')?.value || '게스트';
    const currentUserRole = document.getElementById('currentUserRole')?.value || 'guest';

    // 프로필 관련 요소들
    const profileImage = document.getElementById('profileImage');
    const profileDropdownImage = document.getElementById('profileDropdownImage');
    const userNameElement = document.getElementById('userName');
    const profileDropdownUserID = document.getElementById('profileDropdownUserID');
    const profileDropdownRole = document.getElementById('profileDropdownRole');

    // 사용자 정보 업데이트
    if (userNameElement) userNameElement.textContent = currentUserID;
    if (profileDropdownUserID) profileDropdownUserID.textContent = currentUserID;
    if (profileDropdownRole) profileDropdownRole.textContent = currentUserRole;

    // 로그아웃 시 로컬 및 세션 스토리지 초기화
    if (window.location.pathname === '/logout') {
        localStorage.clear();
        sessionStorage.clear();
    }

    // 로그인 폼 처리
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function (event) {
            event.preventDefault();

            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            fetch('/auth/login_process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(result => {
                    if (result.error) {
                        alert(result.error);
                    } else {
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.href = result.redirect;
                    }
                })
                .catch(error => {
                    console.error('로그인 오류:', error);
                    alert('로그인 중 오류가 발생했습니다.');
                });
        });
    }


    const cachedProfile = sessionStorage.getItem('userProfileImage');
    if (cachedProfile) {
        if (profileImage) profileImage.src = cachedProfile;
        if (profileDropdownImage) profileDropdownImage.src = cachedProfile;
    }

    // 사용자 세션 정보 가져오기
    fetch('/api/get-user-session', {
        credentials: 'include',
        headers: {
            'Accept': 'application/json'
        }
    })
        .then(response => {
            console.log('세션 API 응답 상태:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('세션 API 응답 데이터:', data);

            if (data.is_logined && data.userID) {
                if (userNameElement) userNameElement.textContent = data.userID;
                if (profileDropdownUserID) profileDropdownUserID.textContent = data.userID;
                if (profileDropdownRole) profileDropdownRole.textContent = data.role || currentUserRole;
            } else {
                console.warn('로그인 정보 없음:', data);
                if (userNameElement) userNameElement.textContent = currentUserID;
                if (profileDropdownUserID) profileDropdownUserID.textContent = currentUserID;
            }
        })
        .catch(error => {
            console.error('사용자 정보 가져오기 오류:', error);
            // 오류 발생 시 서버에서 받은 기본값 사용
            if (userNameElement) userNameElement.textContent = currentUserID;
            if (profileDropdownUserID) profileDropdownUserID.textContent = currentUserID;
        });

    fetch('/api/get-profile-info')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.profilePath) {
                if (profileImage) profileImage.src = data.profilePath;
                if (profileDropdownImage) profileDropdownImage.src = data.profilePath;
                sessionStorage.setItem('userProfileImage', data.profilePath);
                initProfileSelector(data.profilePath);
            }
        })
        .catch(error => console.error('프로필 정보 로드 오류:', error));

    function initProfileSelector(selectedProfilePath) {
        const defaultProfiles = [
            '/resource/profiles/default.webp',
            '/resource/profiles/profile1.webp',
            '/resource/profiles/profile2.webp',
            '/resource/profiles/profile3.webp',
            '/resource/profiles/profile4.webp',
            '/resource/profiles/profile5.webp'
        ];

        const defaultProfileContainer = document.getElementById('defaultProfileContainer');
        if (defaultProfileContainer) {
            defaultProfileContainer.innerHTML = '';
            defaultProfiles.forEach(profile => {
                const profileDiv = document.createElement('div');
                profileDiv.className = `profile-image-item m-2 ${profile === selectedProfilePath ? 'selected' : ''}`;
                profileDiv.dataset.profile = profile;

                profileDiv.innerHTML = `
                    <img src="${profile}" alt="Profile" class="rounded-circle"
                         style="width: 60px; height: 60px; cursor: pointer;
                         ${profile === selectedProfilePath ? 'border: 3px solid #0d6efd;' : ''}">
                `;

                profileDiv.addEventListener('click', function () {
                    document.querySelectorAll('.profile-image-item').forEach(item => {
                        item.classList.remove('selected');
                        item.querySelector('img').style.border = 'none';
                    });
                    this.classList.add('selected');
                    this.querySelector('img').style.border = '3px solid #0d6efd';
                });

                defaultProfileContainer.appendChild(profileDiv);
            });
        }

        // 중복 이벤트 방지: 기존 버튼 제거 후 새로 바인딩
        const oldBtn = document.getElementById('saveProfileButton');
        if (oldBtn) {
            const newBtn = oldBtn.cloneNode(true);
            oldBtn.replaceWith(newBtn);

            newBtn.addEventListener('click', function () {
                const selectedItem = document.querySelector('.profile-image-item.selected');
                if (selectedItem) {
                    const selectedProfile = selectedItem.dataset.profile;
                    saveProfileToDB(selectedProfile);
                }
            });
        }
    }

    function saveProfileToDB(profilePath) {
        fetch('/api/save-profile-to-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profilePath: profilePath })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (profileImage) profileImage.src = profilePath;
                    if (profileDropdownImage) profileDropdownImage.src = profilePath;
                    sessionStorage.setItem('userProfileImage', profilePath);
                    const modal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
                    if (modal) modal.hide();
                    alert('프로필이 저장되었습니다.');
                } else {
                    alert('프로필 저장 실패: ' + (data.message || '알 수 없는 오류'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('프로필 저장 중 오류가 발생했습니다.');
            });
    }

    // 🕒 idle 타이머 기반 로그아웃
    let idleTime = 0;
    function resetIdleTimer() {
        idleTime = 0;
    }
    function checkIdleTime() {
        idleTime += 1;
        if (idleTime >= 30) {
            alert("일정시간동안 활동이 없어, 로그아웃되었습니다.");
            window.location.href = '/logout';
        }
    }
    setInterval(checkIdleTime, 60 * 1000);
    ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer)
    );

    // 문제가 되던 fetch 가로채기 부분 수정
    const originalFetch = window.fetch;
    window.fetch = function () {
        const url = arguments[0];
        if (typeof url === 'string' && url.includes('/api/get-user-session')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    userID: currentUserID,  // 정의되지 않은 변수 대신 currentUserID 사용
                    role: currentUserRole,  // 정의되지 않은 변수 대신 currentUserRole 사용
                    is_logined: true
                })
            });
        }
        return originalFetch.apply(this, arguments);
    };


    // 🔥 세션 모니터링 로직 - 프로필 모달 열릴 때 작동
    const profileModalEl = document.getElementById('profileModal');
    let sessionTimerInterval = null;

    if (profileModalEl) {
        profileModalEl.addEventListener('shown.bs.modal', function () {
            fetchAndDisplaySessionTime();
            // 1초마다 업데이트 (로컬 카운트다운)
            sessionTimerInterval = setInterval(updateLocalSessionTime, 1000);
        });

        profileModalEl.addEventListener('hidden.bs.modal', function () {
            if (sessionTimerInterval) {
                clearInterval(sessionTimerInterval);
                sessionTimerInterval = null;
            }
        });
    }

    let currentRemainingMs = 0;

    function fetchAndDisplaySessionTime() {
        const timeDisplay = document.getElementById('sessionRemainingTime');
        if (!timeDisplay) return;

        timeDisplay.textContent = '불러오는 중...';

        fetch('/api/session/remaining-time')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    currentRemainingMs = data.remainingTimeMs;
                    updateTimeDisplay(currentRemainingMs);
                } else {
                    timeDisplay.textContent = '세션 만료됨';
                    currentRemainingMs = 0;
                }
            })
            .catch(err => {
                console.error('세션 시간 조회 실패:', err);
                timeDisplay.textContent = '조회 실패';
            });
    }

    function updateLocalSessionTime() {
        if (currentRemainingMs > 0) {
            currentRemainingMs -= 1000;
            if (currentRemainingMs < 0) currentRemainingMs = 0;
            updateTimeDisplay(currentRemainingMs);
        }
    }

    function updateTimeDisplay(ms) {
        const timeDisplay = document.getElementById('sessionRemainingTime');
        if (!timeDisplay) return;

        if (ms <= 0) {
            timeDisplay.textContent = '만료됨 (로그아웃 예정)';
            timeDisplay.classList.remove('text-primary');
            timeDisplay.classList.add('text-danger');
            return;
        }

        // 분:초 변환
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        const formattedTime = `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
        timeDisplay.textContent = formattedTime;

        // 5분 미만이면 붉은색 경고
        if (minutes < 5) {
            timeDisplay.classList.remove('text-primary');
            timeDisplay.classList.add('text-danger');
        } else {
            timeDisplay.classList.remove('text-danger');
            timeDisplay.classList.add('text-primary');
        }
    }
});


// 관리자 대시보드로 이동
function goToAdmin() {
    window.location.href = '/admin';
}

// 교사 페이지로 이동
function goToTeacher() {
    window.location.href = '/teacher';
}

// 게시판으로 이동 (간단 버전)
function goToBoard() {
    // board-notification이 있으면 그쪽에서 처리 (방문 기록 업데이트)
    if (window.boardNotification && typeof window.boardNotification.goToBoard === 'function') {
        window.boardNotification.goToBoard();
    } else {
        // 없으면 그냥 이동
        window.location.href = '/board';
    }
}

// 내 프로필 열기
function openMyProfile() {
    const width = 900;
    const height = 800;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    window.open(
        '/my-profile',
        'myProfile',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
}

// 센터 정보 모달 열기 (Manager Only)
function openCenterInfoModal() {
    const modal = new bootstrap.Modal(document.getElementById('centerInfoModal'));
    modal.show();
    loadCenterInfo();
}

// 센터 정보 로드
async function loadCenterInfo() {
    try {
        // 현재 사용자의 센터 ID 가져오기
        const sessionRes = await fetch('/api/get-user-session', { credentials: 'include' });
        const sessionData = await sessionRes.json();

        // centerID가 세션에 없으면 DB에서 직접 조회
        let centerID = sessionData.centerID;

        if (!centerID) {
            // DB에서 사용자 정보를 조회하여 centerID 가져오기
            const userRes = await fetch('/api/my-profile-detail', { credentials: 'include' });
            const userData = await userRes.json();

            if (!userData.success || !userData.student || !userData.student.centerID) {
                alert('센터 정보를 찾을 수 없습니다.');
                return;
            }

            centerID = userData.student.centerID;
        }

        // 센터 정보 조회
        const centerRes = await fetch(`/api/centers/${centerID}`, { credentials: 'include' });
        const centerResult = await centerRes.json();

        if (!centerResult.success) {
            alert('센터 정보를 불러올 수 없습니다.');
            return;
        }

        const center = centerResult.center;

        // 센터 기본 정보 표시
        const centerIdField = document.getElementById('centerId');
        if (centerIdField) centerIdField.value = center.id || centerID; // 센터 ID 표시

        document.getElementById('centerName').value = center.center_name || '';
        document.getElementById('centerContactName').value = center.contact_name || '';
        document.getElementById('centerContactEmail').value = center.contact_email || '';

        // 플랜 타입 표시 (사용자 친화적 이름)
        const planNames = {
            'trial': 'Trial (무료 체험)',
            'basic': 'Basic',
            'standard': 'Standard',
            'premium': 'Professional',
            'free': 'Free'
        };
        document.getElementById('centerPlanType').value = planNames[center.plan_type] || center.plan_type;

        // 스토리지 용량
        document.getElementById('centerStorageLimit').value = formatBytes(center.storage_limit_bytes || 0);

        // 상태 배지
        const statusBadge = document.getElementById('centerStatusBadge');
        if (center.status === 'ACTIVE') {
            statusBadge.innerHTML = '<span class="badge bg-success">활성</span>';
        } else if (center.status === 'SUSPENDED') {
            statusBadge.innerHTML = '<span class="badge bg-danger">정지</span>';
        } else {
            statusBadge.innerHTML = '<span class="badge bg-secondary">비활성</span>';
        }

        // 구독 정보 조회 (center_subscriptions 테이블)
        try {
            const subRes = await fetch(`/api/centers/${centerID}/subscription`, { credentials: 'include' });
            const subResult = await subRes.json();

            if (subResult.success && subResult.subscription) {
                const sub = subResult.subscription;

                // 구독 상태 표시
                const statusNames = {
                    'trial': '무료 체험',
                    'active': '활성',
                    'cancelled': '취소됨',
                    'suspended': '만료'
                };
                document.getElementById('centerSubscriptionStatus').value = statusNames[sub.status] || sub.status;

                // 다음 결제일
                document.getElementById('centerNextBilling').value = sub.next_billing_date ?
                    new Date(sub.next_billing_date).toLocaleDateString('ko-KR') : '-';
            } else {
                document.getElementById('centerSubscriptionStatus').value = '정보 없음';
                document.getElementById('centerNextBilling').value = '-';
            }
        } catch (err) {
            console.error('구독 정보 로드 실패:', err);
            document.getElementById('centerSubscriptionStatus').value = '정보 없음';
            document.getElementById('centerNextBilling').value = '-';
        }

        // 초대 코드 목록 로드
        loadInviteCodes(centerID);

        // centerID를 전역 변수에 저장 (코드 발급 시 사용)
        window.currentCenterID = centerID;

    } catch (error) {
        console.error('센터 정보 로드 실패:', error);
        alert('센터 정보를 불러오는 중 오류가 발생했습니다.');
    }
}

// 초대 코드 목록 로드
async function loadInviteCodes(centerID) {
    const container = document.getElementById('inviteCodesContainer');

    try {
        console.log(`[header.js] Loading invite codes for Center ID: ${centerID}`);
        const res = await fetch(`/api/centers/${centerID}/invite-codes`, { credentials: 'include' });
        const result = await res.json();
        console.log('[header.js] Invite codes API response:', result);

        if (!result.success) {
            container.innerHTML = '<p class="text-danger text-center">초대 코드를 불러올 수 없습니다.</p>';
            return;
        }

        const codes = result.inviteCodes || [];
        console.log(`[header.js] Found ${codes.length} invite codes.`);

        if (codes.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-key" style="font-size: 2rem;"></i>
                    <p class="mb-0 mt-2">발급된 초대 코드가 없습니다.</p>
                    <small>새 코드 발급 버튼을 눌러 코드를 생성하세요.</small>
                </div>
            `;
            return;
        }

        let html = '<div class="list-group">';
        codes.forEach(code => {
            // 날짜 계산 디버깅
            // console.log(`Code: ${code.code}, Expires: ${code.expires_at}, Max: ${code.max_uses}`);

            const isExpired = code.isExpired;
            const isMaxedOut = code.isMaxedOut;
            const isInvalid = isExpired || isMaxedOut;

            html += `
                <div class="list-group-item ${isInvalid ? 'bg-light' : ''}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1 font-monospace fw-bold">${code.code}</h6>
                            <small class="text-muted">
                                ${code.current_uses || 0} / ${code.max_uses} 사용
                                | 만료: ${new Date(code.expires_at).toLocaleDateString('ko-KR')}
                            </small>
                            ${isExpired ? '<span class="badge bg-danger ms-2">만료됨</span>' : ''}
                            ${isMaxedOut ? '<span class="badge bg-warning ms-2">사용 완료</span>' : ''}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="copyInviteCode('${code.code}')">
                                <i class="bi bi-clipboard"></i> 복사
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteInviteCode(${centerID}, ${code.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

    } catch (error) {
        console.error('초대 코드 로드 실패:', error);
        container.innerHTML = '<p class="text-danger text-center">초대 코드를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

// 새 센터 코드 발급
async function generateNewCenterCode() {
    try {
        // 전역 변수에서 centerID 가져오기 (loadCenterInfo에서 설정)
        let centerID = window.currentCenterID;

        // 세션 정보 가져오기
        const sessionRes = await fetch('/api/get-user-session', { credentials: 'include' });
        const sessionData = await sessionRes.json();

        if (!centerID) {
            centerID = sessionData.centerID;

            if (!centerID) {
                alert('센터 정보를 찾을 수 없습니다.');
                return;
            }
        }

        // 초기값을 센터장 아이디(세션 userID)로 설정
        const res = await fetch(`/api/centers/${centerID}/invite-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                expiresInDays: 30,
                maxUses: 100,
                codePrefix: sessionData.userID // 센터장 아이디를 초대 코드 접두사로 사용
            })
        });

        const result = await res.json();
        console.log('[header.js] Generate invite code result:', result);

        if (result.success) {
            alert(`새 초대 코드가 발급되었습니다: ${result.inviteCode.code}`);
            loadInviteCodes(centerID);
        } else {
            alert('초대 코드 발급에 실패했습니다: ' + result.message);
        }

    } catch (error) {
        console.error('초대 코드 발급 실패:', error);
        alert('초대 코드 발급 중 오류가 발생했습니다.');
    }
}

// 초대 코드 복사
function copyInviteCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        alert(`초대 코드가 복사되었습니다: ${code}`);
    }).catch(err => {
        console.error('복사 실패:', err);
        alert('복사에 실패했습니다.');
    });
}

// 초대 코드 삭제
async function deleteInviteCode(centerID, codeId) {
    if (!confirm('이 초대 코드를 삭제하시겠습니까?')) {
        return;
    }

    try {
        const res = await fetch(`/api/centers/${centerID}/invite-codes/${codeId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const result = await res.json();

        if (result.success) {
            alert('초대 코드가 삭제되었습니다.');
            loadInviteCodes(centerID);
        } else {
            alert('초대 코드 삭제에 실패했습니다: ' + result.message);
        }

    } catch (error) {
        console.error('초대 코드 삭제 실패:', error);
        alert('초대 코드 삭제 중 오류가 발생했습니다.');
    }
}

// 바이트를 읽기 쉬운 형식으로 변환
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}