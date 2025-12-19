/**
 * Nuguri Talk Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('nuguri-widget-container');

    // 🔥 Fix Z-Index Issue: Move widget to body to avoid stacking context traps
    if (container && container.parentElement !== document.body) {
        document.body.appendChild(container);
    }

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

    // User Data (from data attributes)
    // container is already defined at the top
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
            path: '/socket.io'
        });

        initSocketEvents();
    } catch (e) {
        console.error('Socket.io connection failed:', e);
    }

    // --- Event Listeners ---

    // Toggle Modal
    floatIcon.addEventListener('click', () => {
        toggleModal(!isOpen);
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
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
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
            // Smart Positioning Logic
            const iconRect = floatIcon.getBoundingClientRect();
            const screenW = window.innerWidth;
            const screenH = window.innerHeight;

            // Thresholds (mid-points)
            const isLeft = iconRect.left < screenW / 2;
            const isTop = iconRect.top < screenH / 2;

            // Reset styles
            modal.style.top = 'auto';
            modal.style.bottom = 'auto';
            modal.style.left = 'auto';
            modal.style.right = 'auto';
            modal.style.transformOrigin = ''; // Reset

            // Apply direction
            if (isTop) {
                modal.style.top = '90px'; // Open Downwards
                modal.style.transformOrigin = isLeft ? 'top left' : 'top right';
            } else {
                modal.style.bottom = '90px'; // Open Upwards (Default)
                modal.style.transformOrigin = isLeft ? 'bottom left' : 'bottom right';
            }

            if (isLeft) {
                modal.style.left = '0px'; // Open Rightwards
            } else {
                modal.style.right = '0px'; // Open Leftwards (Default)
            }

            modal.classList.add('open');
            unreadCount = 0;
            updateBadge();
            scrollToBottom(chatList);
            if (chatInput) chatInput.focus();
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
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;

        // Check if Secret Mode is ON
        const isSecret = secretToggle && secretToggle.checked;

        if (socket) {
            const eventName = isSecret ? 'secret_chat_message' : 'chat_message';
            const payload = {
                text: text,
                user: currentUser.id,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }),
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
        if (data.id) bubble.dataset.id = data.id; // Store ID

        let html = '';
        if (!isMine) {
            const displayName = data.userName || data.user;
            html += `<div style="font-weight:bold; font-size:12px; margin-bottom:2px;">${escapeHtml(displayName)}</div>`;
        }

        html += `
            <div class="message-text">${escapeHtml(data.text)}</div>
            <span class="chat-meta">${data.time}</span>
        `;

        // Delete Button (Mine or Admin)
        const canDelete = isMine || currentUser.role === 'admin';
        if (data.id && canDelete) {
            html += `<span class="delete-msg-btn" title="삭제" style="cursor:pointer; margin-left:5px; font-size: 0.8rem; opacity: 0.5;">&times;</span>`;
        }

        bubble.innerHTML = html;

        // Attach Delete Handler
        const deleteBtn = bubble.querySelector('.delete-msg-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('메시지를 삭제하시겠습니까?')) {
                    socket.emit('delete_message', { id: data.id });
                }
            });
        }

        targetList.appendChild(bubble);
        scrollToBottom(targetList);
    }

    function scrollToBottom(element) {
        if (element) element.scrollTop = element.scrollHeight;
    }

    function initSocketEvents() {
        if (!socket) return;

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

        socket.on('message_deleted', (data) => {
            if (!data || !data.id) return;
            const bubble = chatList.querySelector(`.chat-bubble[data-id="${data.id}"]`);
            if (bubble) {
                bubble.remove();
            }
        });

        socket.on('user_list_update', (users) => {
            renderUserList(users);
        });


        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Nuguri Talk');
        });

        // 👁️ Monitoring Events
        // For Student: Recieve Monitor Request
        socket.on('cmd_monitor_start', (data) => {
            console.log('👁️ Monitoring Started by:', data.monitorName);
            amBeingMonitored = true;

            // Show toast or indicator (Optional)
            // Hook into Editor
            if (window.ideEditor) {
                // Remove existing listener to avoid duplicates
                window.ideEditor.session.removeAllListeners('change');

                // Add listener
                window.ideEditor.session.on('change', () => {
                    if (!amBeingMonitored) return;
                    const code = window.ideEditor.getValue();
                    const cursor = window.ideEditor.getCursorPosition();

                    socket.emit('monitor_data', {
                        targetSocketId: data.monitorId,
                        code: code,
                        cursor: cursor
                    });
                });

                // Send initial state
                socket.emit('monitor_data', {
                    targetSocketId: data.monitorId,
                    code: window.ideEditor.getValue(),
                    cursor: window.ideEditor.getCursorPosition()
                });
            }
        });

        socket.on('cmd_monitor_stop', () => {
            console.log('👁️ Monitoring Stopped');
            amBeingMonitored = false;
        });

        // For Teacher: Recieve Data
        socket.on('monitor_update', (data) => {
            // Update Monitoring Editor
            if (monitorModal.style.display !== 'none' && monitorEditor) {
                const currentPos = monitorEditor.getCursorPosition();
                monitorEditor.setValue(data.code, -1);

                // Optional: Show cursor
                // monitorEditor.moveCursorToPosition(data.cursor);
                // monitorEditor.clearSelection();
            }
        });

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
                ${!isMe && ['teacher', 'admin', 'manager'].includes(currentUser.role) ?
                        `<button class="monitor-btn" onclick="startMonitoring('${user.id}')" title="모니터링" style="margin-left: auto; background: none; border: none; cursor: pointer; color: #fff;">
                        <i class="bi bi-eye"></i>
                    </button>`
                        : ''}
            `;

                // 🔥 Make startMonitoring global so onclick works
                window.startMonitoring = ((targetId) => {
                    currentMonitoredUserId = targetId;
                    startMonitoring(targetId);
                });
                userListEl.appendChild(item);
            });
        }

        // --- Draggable & Bouncing Logic ---
        makeDraggable(container, floatIcon);
        startRandomBouncing(floatIcon);

        function makeDraggable(element, handle) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

            handle.onmousedown = dragMouseDown;
            handle.ontouchstart = dragTouchStart;

            function dragMouseDown(e) {
                e.preventDefault(); // Prevent default image dragging
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                e.preventDefault();
                // Calculate new cursor position
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;

                // Set the element's new position
                // Note: Use offsetTop/Left because we are modifying standard positioning
                // Logic: We are modifying bottom/right based on delta? 
                // Better: Switch to fixed Left/Top calculation if we want full freedom, 
                // but simple transform is easier. Let's use Top/Left style modification.

                const newTop = element.offsetTop - pos2;
                const newLeft = element.offsetLeft - pos1;

                element.style.top = newTop + "px";
                element.style.left = newLeft + "px";
                element.style.bottom = 'auto'; // Clear CSS bottom
                element.style.right = 'auto';  // Clear CSS right
            }

            function closeDragElement() {
                // Stop moving when mouse button is released:
                document.onmouseup = null;
                document.onmousemove = null;
            }

            // Touch Support
            function dragTouchStart(e) {
                const touch = e.touches[0];
                pos3 = touch.clientX;
                pos4 = touch.clientY;
                document.ontouchend = closeDragElement;
                document.ontouchmove = elementTouchDrag;
            }

            function elementTouchDrag(e) {
                const touch = e.touches[0];
                pos1 = pos3 - touch.clientX;
                pos2 = pos4 - touch.clientY;
                pos3 = touch.clientX;
                pos4 = touch.clientY;

                const newTop = element.offsetTop - pos2;
                const newLeft = element.offsetLeft - pos1;

                element.style.top = newTop + "px";
                element.style.left = newLeft + "px";
                element.style.bottom = 'auto';
                element.style.right = 'auto';
            }
        }

        function startRandomBouncing(element) {
            // Random bounce every 15-40 seconds
            setInterval(() => {
                if (Math.random() > 0.3) {
                    element.classList.add('bounce-animate');
                    setTimeout(() => {
                        element.classList.remove('bounce-animate');
                    }, 2000); // Animation duration
                }
            }, 20000);
        }


        // --- Monitoring Logic ---
        let monitoringSocketId = null; // ID of the person I am monitoring
        let amBeingMonitored = false;

        // Create Monitor Modal (Teacher Side)
        const monitorModal = document.createElement('div');
        monitorModal.id = 'monitorModal';
        monitorModal.style.cssText = `
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 800px;
        height: 600px;
        background: #1e1e1e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        flex-direction: column;
    `;
        monitorModal.innerHTML = `
        <div style="padding: 10px; background: #252526; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; color: #fff;">
            <span id="monitorModalTitle" style="font-weight: bold;">모니터링 중...</span>
            <button id="closeMonitorBtn" style="background: none; border: none; color: #fff; cursor: pointer;">&times;</button>
        </div>
        <div id="monitorEditor" style="flex: 1; width: 100%; height: 100%;"></div>
    `;
        document.body.appendChild(monitorModal);

        const closeMonitorBtn = document.getElementById('closeMonitorBtn');
        let monitorEditor = null;

        closeMonitorBtn.addEventListener('click', () => {
            stopMonitoring();
        });

        function initMonitorEditor() {
            if (!monitorEditor && window.ace) {
                monitorEditor = ace.edit("monitorEditor");
                monitorEditor.setTheme("ace/theme/monokai");
                monitorEditor.session.setMode("ace/mode/python");
                monitorEditor.setReadOnly(true);
                monitorEditor.setFontSize(14);
            }
        }

        function startMonitoring(targetUserId) {
            if (!socket) return;
            socket.emit('request_monitor', targetUserId);

            monitorModal.style.display = 'flex';
            document.getElementById('monitorModalTitle').textContent = `${targetUserId} 모니터링 중...`;

            initMonitorEditor();
            if (monitorEditor) monitorEditor.setValue("학생의 입력을 기다리는 중...", -1);
        }

        function stopMonitoring() {
            monitorModal.style.display = 'none';

            // Notify server
            // We need to know who we were monitoring. 
            // Logic simplification: Just emit stop with current monitoring ID if we tracked it, 
            // but for now we rely on the teacher knowing who they clicked.
            // Better: store currentMonitoredUser
            if (monitoringSocketId) {
                // We actually need the UserID, not socket ID, for the stop_monitor event based on server implementation
                // But server expects UserID. Let's fix this later or assume we store it.
            }
            // Ideally we should track 'currentMonitoredUserId'
            if (currentMonitoredUserId) {
                socket.emit('stop_monitor', currentMonitoredUserId);
            }
            currentMonitoredUserId = null;
        }

        let currentMonitoredUserId = null;


    } // This closes the initSocketEvents function, assuming it was defined just before the comments.

    // --- Updated Utility ---
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

