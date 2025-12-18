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
    // Secret Toggle (Optional)
    const secretToggle = document.getElementById('secretToggle');

    // Online Indicator
    const onlineIndicator = document.getElementById('nuguriOnlineIndicator');

    // ... (User Data Code) ...

    // ... (Socket Setup) ...

    // ... (Event Listeners) ...

    // Send Message
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // ... (Tabs, Workroom, ToggleModal, etc.) ...

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Check if Secret Mode is ON
        const isSecret = secretToggle && secretToggle.checked;

        if (socket) {
            const eventName = isSecret ? 'secret_chat_message' : 'chat_message';
            const payload = {
                text: text,
                user: currentUser.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: isSecret ? 'secret' : 'public'
            };

            // Emit to server
            socket.emit(eventName, payload);

            chatInput.value = '';
            // Don't uncheck toggle - teacher might want to maintain conversation
        }
    }

    function appendMessage(targetList, data, isMine) {
        if (!targetList) return;

        // Remove empty state if exists
        const emptyState = targetList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const bubble = document.createElement('div');
        let bubbleClass = `chat-bubble ${isMine ? 'mine' : 'others'}`;

        // Add secret style if applicable
        if (data.type === 'secret') {
            bubbleClass += ' secret';
        }

        bubble.className = bubbleClass;

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

    // ... (ScrollToBottom) ...

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
                // Currently history is only public, but we handle it generally
                appendMessage(chatList, msg, isMine);
            });
            scrollToBottom(chatList);
        });

        socket.on('chat_message', (data) => {
            const isMine = data.user == currentUser.id;
            data.type = 'public'; // Ensure type
            appendMessage(chatList, data, isMine);

            if (!isOpen && !isMine) {
                unreadCount++;
                updateBadge();
            }
        });

        // Secret Chat Events - Merged into Main List
        socket.on('secret_chat_message', (data) => {
            const isMine = data.user == currentUser.id;
            data.type = 'secret'; // Mark as secret
            appendMessage(chatList, data, isMine);
        });

        // ... (User List, Disconnect) ...

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
