/**
 * Nuguri Talk Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const floatIcon = document.getElementById('nuguriFloatIcon');
    const modal = document.getElementById('nuguriModal');
    const closeBtn = document.getElementById('closeNuguriBtn');
    const unreadBadge = document.getElementById('nuguriUnreadBadge');

    // Tabs
    const tabBtns = document.querySelectorAll('.nuguri-tab-btn');
    const tabPanes = document.querySelectorAll('.nuguri-tab-pane');

    // Chat
    // Secret Chat (if exists)
    const secretInput = document.getElementById('nuguriSecretInput');
    const secretSendBtn = document.getElementById('nuguriSecretSendBtn');
    const secretChatList = document.getElementById('nuguriSecretChatList');

    // Online Indicator
    const onlineIndicator = document.getElementById('nuguriOnlineIndicator');

    // User Data (from data attributes)
    const container = document.getElementById('nuguri-widget-container');
    const currentUser = {
        id: container.dataset.userId || 'Guest',
        role: container.dataset.userRole || 'guest',
        centerID: container.dataset.centerId || ''
    };

    let isOpen = false;
    let unreadCount = 0;

    // --- Socket.io Setup ---
    let socket;

    try {
        socket = io({
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });

        initSocketEvents();
    } catch (e) {
        console.error('Socket.io connection failed:', e);
    }

    // --- Event Listeners ---

    // Toggle Modal
    floatIcon.addEventListener('click', () => {
        toggleModal(true);
    });

    closeBtn.addEventListener('click', () => {
        toggleModal(false);
    });

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            // UI Update
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`pane-${target}`).classList.add('active');
        });
    });

    // Send Message (Public)
    sendBtn.addEventListener('click', () => sendMessage('public'));
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage('public');
    });

    // Send Message (Secret)
    if (secretSendBtn) {
        secretSendBtn.addEventListener('click', () => sendMessage('secret'));
        secretInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage('secret');
        });
    }


    // --- Functions ---
    // Workroom Logic
    function updateWorkroom() {
        if (!document.getElementById('workroomImg')) return;

        const images = [
            { src: "sleep_nuguri.webp", text: "자는 중..." },
            { src: "coffee_nuguri.webp", text: "커피 마시는 중..." },
            { src: "coding_nuguri.webp", text: "코딩 하는 중..." }
        ];
        const random = images[Math.floor(Math.random() * images.length)];

        document.getElementById('workroomImg').src = `/resource/${random.src}`;
        document.getElementById('workroomStatus').textContent = random.text;
    }
    // Update initially and periodically
    updateWorkroom();
    setInterval(updateWorkroom, 10000); // Change status every 10s

    function toggleModal(show) {
        isOpen = show;
        if (show) {
            modal.classList.add('open');
            unreadCount = 0;
            updateBadge();
            scrollToBottom(chatList);
            if (secretChatList) scrollToBottom(secretChatList);
            chatInput.focus();
        } else {
            modal.classList.remove('open');
        }
    }

    function updateBadge() {
        if (unreadCount > 0) {
            unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            unreadBadge.classList.add('show');
        } else {
            unreadBadge.classList.remove('show');
        }
    }

    function sendMessage(type = 'public') {
        const input = type === 'public' ? chatInput : secretInput;
        const text = input.value.trim();
        if (!text) return;

        if (socket) {
            const eventName = type === 'public' ? 'chat_message' : 'secret_chat_message';
            const payload = {
                text: text,
                user: currentUser.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            // Emit to server
            socket.emit(eventName, payload);

            input.value = '';
        }
    }

    function appendMessage(targetList, data, isMine) {
        if (!targetList) return;

        // Remove empty state if exists
        const emptyState = targetList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isMine ? 'mine' : 'others'}`;

        let html = '';
        if (!isMine) {
            const displayName = data.userName || data.user;
            html += `<div style="font-weight:bold; font-size:12px; margin-bottom:2px;">${escapeHtml(displayName)}</div>`;
        }

        html += `
            <div class="message-text">${escapeHtml(data.text)}</div>
            <span class="chat-meta">${data.time}</span>
        `;

        bubble.innerHTML = html;
        targetList.appendChild(bubble);
        scrollToBottom(targetList);
    }

    function scrollToBottom(element) {
        if (element) element.scrollTop = element.scrollHeight;
    }

    function initSocketEvents() {
        socket.on('connect', () => {
            console.log('✅ Connected to Nuguri Talk');

            // Join with user info
            socket.emit('join', {
                id: currentUser.id,
                name: currentUser.id,
                role: currentUser.role,
                centerID: currentUser.centerID
            });

            // If teacher, join secret room
            if (currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'manager') {
                socket.emit('join_secret');
            }
        });

        socket.on('chat_history', (messages) => {
            const emptyState = chatList.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            messages.forEach(msg => {
                const isMine = msg.user == currentUser.id;
                appendMessage(chatList, msg, isMine);
            });
            scrollToBottom(chatList);
        });

        socket.on('chat_message', (data) => {
            const isMine = data.user == currentUser.id;
            appendMessage(chatList, data, isMine);

            if (!isOpen && !isMine) {
                unreadCount++;
                updateBadge();
            }
        });

        // Secret Chat Events
        socket.on('secret_chat_message', (data) => {
            const isMine = data.user == currentUser.id;
            appendMessage(secretChatList, data, isMine);
        });

        socket.on('user_list_update', (users) => {
            renderUserList(users);
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Nuguri Talk');
        });
    }

    function renderUserList(users) {
        // Online Indicator Logic (Green Dot)
        // If more than 1 user (me + others), show green dot
        if (users.length > 1) {
            onlineIndicator.classList.add('show');
            onlineIndicator.textContent = '❇️'; // Green emoji or check
        } else {
            onlineIndicator.classList.remove('show');
        }

        const userListEl = document.getElementById('nuguriUserList');
        const countBadge = document.getElementById('userCountBadge');

        // Update Count
        if (countBadge) countBadge.textContent = `(${users.length})`;

        // Clear list
        userListEl.innerHTML = '';

        if (users.length === 0) {
            userListEl.innerHTML = '<div class="empty-state"><p>접속자가 없습니다.</p></div>';
            return;
        }

        users.forEach(user => {
            const isMe = user.id === currentUser.id;
            const item = document.createElement('div');
            item.className = 'user-list-item';
            item.innerHTML = `
                <div class="user-avatar">
                   <img src="/resource/profiles/default.webp" alt="User">
                </div>
                <div class="user-info">
                    <div class="user-name">
                        ${escapeHtml(user.name)} 
                        ${isMe ? '<span style="color:#ff9f1c; font-size:11px;">(나)</span>' : ''}
                    </div>
                    <div class="user-status">온라인</div>
                </div>
            `;
            userListEl.appendChild(item);
        });
    }

    // Utility
    function escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
