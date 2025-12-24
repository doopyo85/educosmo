// Pong2 API 설정 (Backend: app.codingnplay.co.kr)
const CONFIG = {
    API: {
        BASE_URL: 'https://app.codingnplay.co.kr/api/pong2',
        ENDPOINTS: {
            BOARDS: '/boards',
            PORTFOLIO: '/portfolio',
            LOGIN: '/auth/login',
            SIGNUP: '/auth/signup'
        }
    },

    // 기타 설정
    APP: {
        NAME: 'Pong Education Platform',
        VERSION: '2.0.0 (Hybrid Auth)'
    }
};

// 전역으로 설정 노출
window.CONFIG = CONFIG;
