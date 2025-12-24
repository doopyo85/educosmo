/**
 * Auth UI Manager
 * Handles Login/Signup interactions and UI state
 */

// Toggle between Login and Signup forms in Modal
window.switchAuthMode = function (mode) {
    const loginTabContent = document.getElementById('loginTabContent');
    const loginTabs = document.getElementById('loginTab');
    const signupView = document.getElementById('signup-view');
    const modalTitle = document.querySelector('#loginModal h4');

    if (mode === 'signup') {
        loginTabContent.classList.add('d-none');
        loginTabs.classList.add('d-none');
        signupView.classList.remove('d-none');
        modalTitle.textContent = '회원가입';
    } else {
        loginTabContent.classList.remove('d-none');
        loginTabs.classList.remove('d-none');
        signupView.classList.add('d-none');
        modalTitle.textContent = '환영합니다! 👋';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('auth-section');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Check Login State on Load
    updateAuthUI();

    // 1. Handle Login Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const btn = loginForm.querySelector('button');

            try {
                btn.disabled = true;
                btn.textContent = '로그인 중...';

                const user = await window.pong2API.login(email, password);
                if (user) {
                    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                    updateAuthUI();
                    alert(`반갑습니다, ${user.nickname}님!`);
                }
            } catch (error) {
                alert(error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '로그인';
            }
        });
    }

    // 2. Handle Signup Submit
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const nickname = document.getElementById('signupNickname').value;
            const btn = signupForm.querySelector('button');

            try {
                btn.disabled = true;
                btn.textContent = '가입 중...';

                // Assuming pong2API has signup method, if not we add it or call fetch directly
                const response = await fetch(`${window.CONFIG.API.BASE_URL}${window.CONFIG.API.ENDPOINTS.SIGNUP}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, nickname })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Signup failed');

                alert('회원가입이 완료되었습니다. 로그인해주세요.');
                window.switchAuthMode('login');

            } catch (error) {
                alert(error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '가입완료';
            }
        });
    }
});

// Update Sidebar UI based on Auth State
function updateAuthUI() {
    const user = window.pong2API.getCurrentUser();
    const authSection = document.getElementById('auth-section');

    if (!authSection) return;

    if (user) {
        // Logged In State
        authSection.innerHTML = `
            <div class="text-white-50 small mb-2">Logged in as</div>
            <div class="fw-bold fs-5 text-warning mb-3">${user.nickname || user.name}</div>
            <button class="btn btn-outline-light btn-sm w-100" onclick="handleLogout()">
                <i class="bi bi-box-arrow-right me-2"></i>로그아웃
            </button>
        `;
    } else {
        // Guest State
        authSection.innerHTML = `
            <button class="btn btn-outline-warning w-100" data-bs-toggle="modal" data-bs-target="#loginModal">
              <i class="bi bi-box-arrow-in-right me-2"></i>로그인
            </button>
        `;
    }
}

// Logout Handler
window.handleLogout = function () {
    window.pong2API.logout();
};
