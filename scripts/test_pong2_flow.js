const axios = require('axios');
const { queryDatabase } = require('../lib_login/db');

const BASE_URL = 'http://localhost:3000/api/pong2'; // Adjust port if needed based on local env

async function testFlow() {
    try {
        console.log('Test Flow: Pong2 Backend Integration');

        // 0. Cleanup Test User
        const email = `testuser_${Date.now()}@pong2.app`;
        const password = 'password123';
        const nickname = 'TestUserPong2';

        // 1. Signup
        console.log(`\n1. Signing up user: ${email}`);
        const signupRes = await axios.post(`${BASE_URL}/auth/signup`, {
            email, password, nickname
        });
        console.log('✅ Signup Success:', signupRes.data);

        // 2. Login
        console.log('\n2. Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email, password
        });
        const token = loginRes.data.token;
        console.log('✅ Login Success. Token received.');

        // 3. Create Post
        console.log('\n3. Creating Community Post...');
        const createRes = await axios.post(`${BASE_URL}/boards`, {
            title: 'Hello Pong2 Community',
            content: 'This is a test post from the verification script.',
            board_type: 'community'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const postId = createRes.data.postId;
        console.log(`✅ Post Created. ID: ${postId}`);

        // 4. Verify DB Logic (Direct DB Check)
        console.log('\n4. Verifying Database Record...');
        const posts = await queryDatabase(
            'SELECT author_type, board_scope, is_public FROM board_posts WHERE id = ?',
            [postId]
        );
        if (posts.length > 0) {
            const p = posts[0];
            console.log('Legacy DB Record:', p);
            if (p.author_type === 'PONG2' && p.board_scope === 'COMMUNITY' && p.is_public === 1) {
                console.log('✅ DB Verification PASSED: Correct Scope and Type.');
            } else {
                console.error('❌ DB Verification FAILED:', p);
            }
        } else {
            console.error('❌ Post not found in DB!');
        }

        // 5. List Boards (Viewer)
        console.log('\n5. Listing Boards (API Check)...');
        const listRes = await axios.get(`${BASE_URL}/boards?limit=5`);
        const found = listRes.data.find(p => p.id === postId);
        if (found) {
            console.log('✅ API Verification PASSED: Post is visible.');
            console.log('Post Data:', found);
        } else {
            console.error('❌ API Verification FAILED: Created post not listed.');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
    }
    process.exit(0);
}

// Check if server is running before test
testFlow();
