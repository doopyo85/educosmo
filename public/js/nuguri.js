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
    const chatInput = document.getElementById('nuguriInput');
    const sendBtn = document.getElementById('nuguriSendBtn');
    const chatList = document.getElementById('nuguriChatList');

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

    // Send Message
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });


    // --- Functions ---

    function toggleModal(show) {
        isOpen = show;
        if (show) {
            modal.classList.add('open');
            unreadCount = 0;
            updateBadge();
            scrollToBottom();
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

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        if (socket) {
            const payload = {
                text: text,
                user: currentUser.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            // Emit to server
            socket.emit('chat_message', payload);

            // Optimistic update
            // appendMessage(payload, true);

            chatInput.value = '';
        }
    }

    function appendMessage(data, isMine) {
        // Remove empty state if exists
        const emptyState = chatList.querySelector('.empty-state');
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
        chatList.appendChild(bubble);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatList.scrollTop = chatList.scrollHeight;
    }

    function initSocketEvents() {
        socket.on('connect', () => {
            console.log('✅ Connected to Nuguri Talk');

            // Join with user info
            socket.emit('join', {
                id: currentUser.id,
                name: currentUser.id, // Can be improved if name is available separately
                role: currentUser.role,
                centerID: currentUser.centerID
            });
        });

        socket.on('chat_history', (messages) => {
            // Clear current list to avoid duplicates if reconnecting
            const emptyState = chatList.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            // Append history
            messages.forEach(msg => {
                const isMine = msg.user == currentUser.id; // Loose equality
                appendMessage(msg, isMine);
            });
            scrollToBottom();
        });

        socket.on('chat_message', (data) => {
            const isMine = data.user === currentUser.id;
            appendMessage(data, isMine);

            if (!isOpen && !isMine) {
                unreadCount++;
                updateBadge();
            }
        });

        socket.on('user_list_update', (users) => {
            renderUserList(users);
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Nuguri Talk');
        });
    }

    function renderUserList(users) {
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
