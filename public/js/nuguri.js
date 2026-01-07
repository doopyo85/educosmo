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
        centerID: container.dataset.centerId || '',
        centerName: container.dataset.centerName || ''
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
                centerID: currentUser.centerID,
                centerName: currentUser.centerName
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

        // 🛑 Spam Warning Handler
        socket.on('spam_warning', (data) => {
            // Option 1: Alert
            alert(data.message);

            // Option 2: System Message in Chat (Optional)
            appendMessage(chatList, {
                text: data.message,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }),
                type: 'system',
                user: 'System' // Or 'Nuguri'
            }, false);

            // Disable input temporarily? The backend blocks it anyway, but UI feedback is good.
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = `도배 방지: ${data.remaining}초 후 입력 가능`;

                setTimeout(() => {
                    chatInput.disabled = false;
                    chatInput.placeholder = '메시지를 입력하세요...';
                    chatInput.focus();
                }, data.remaining * 1000);
            }
        });


        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Nuguri Talk');
        });

        // 👁️ Monitoring Events
        // 👁️ Monitoring Events
        let monitoringChangeHandler = null;

        // Simple Throttle Function
        function throttle(func, limit) {
            let inThrottle;
            return function () {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            }
        }

        // For Student: Recieve Monitor Request
        socket.on('cmd_monitor_start', (data) => {
            console.log('👁️ Monitoring Started by:', data.monitorName);
            amBeingMonitored = true;

            // Hook into Editor
            if (window.ideEditor) {
                // FIXED: Do NOT remove all listeners, as it breaks the IDE itself
                // window.ideEditor.session.removeAllListeners('change');

                // If a handler already exists, remove it first to avoid duplicates
                if (monitoringChangeHandler) {
                    window.ideEditor.session.off('change', monitoringChangeHandler);
                }

                // Define the handler with throttling (300ms)
                monitoringChangeHandler = throttle(() => {
                    if (!amBeingMonitored) return;
                    const code = window.ideEditor.getValue();
                    const cursor = window.ideEditor.getCursorPosition();

                    socket.emit('monitor_data', {
                        targetSocketId: data.monitorId,
                        code: code,
                        cursor: cursor
                    });
                }, 300);

                // Add listener
                window.ideEditor.session.on('change', monitoringChangeHandler);

                // Send initial state immediately
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

            // Clean up listener
            if (window.ideEditor && monitoringChangeHandler) {
                window.ideEditor.session.off('change', monitoringChangeHandler);
                monitoringChangeHandler = null;
            }
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
                        ${user.centerName ? `<span style="font-size: 11px; color: #999; margin-left: 4px;">${escapeHtml(user.centerName)}</span>` : ''}
                        ${isMe ? '<span style="color:#ff9f1c; font-size:11px;">(나)</span>' : ''}
                    </div>
                    <div class="user-status">온라인</div>
                </div>
                ${!isMe && ['teacher', 'admin', 'manager'].includes(currentUser.role) ?
                        `<div style="display: flex; align-items: center; margin-left: auto; gap: 5px;">
                            <button class="monitor-btn" onclick="startMonitoring('${user.id}')" title="모니터링" style="background: none; border: none; cursor: pointer; color: #000;">
                                <i class="bi bi-eye-fill"></i>
                            </button>
                            <button class="msg-btn" onclick="openMessageModal('${user.id}', '${escapeHtml(user.name)}')" title="메시지 보내기" style="background: none; border: none; cursor: pointer; color: #000;">
                                <i class="bi bi-chat-text-fill"></i>
                            </button>
                        </div>`
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

    // --- Message Modal Logic ---
    let messageTargetId = null;
    let messageTargetName = null;

    // Create Message Modal
    const msgModal = document.createElement('div');
    msgModal.id = 'teacherMsgModal';
    msgModal.style.cssText = `
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 500px;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 8px;
        z-index: 10001;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        flex-direction: column;
        overflow: hidden;
        color: #333;
    `;
    msgModal.innerHTML = `
        <div style="padding: 10px 15px; background: #f8f9fa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <span id="msgModalTitle" style="font-weight: bold;">메시지 보내기</span>
            <button id="closeMsgBtn" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
        </div>
        <div style="display: flex; border-bottom: 1px solid #eee;">
            <button class="msg-tab-btn active" data-tab="text" style="flex: 1; padding: 10px; border: none; background: none; cursor: pointer;">텍스트</button>
            <button class="msg-tab-btn" data-tab="draw" style="flex: 1; padding: 10px; border: none; background: none; cursor: pointer;">그리기</button>
            <button class="msg-tab-btn" data-tab="screen" style="flex: 1; padding: 10px; border: none; background: none; cursor: pointer;">화면 캡처</button>
        </div>
        <div style="padding: 15px; flex: 1;">
            <!-- Text Tab -->
            <div id="msg-pane-text" class="msg-pane active">
                <textarea id="teacherMsgInput" placeholder="50자 이내로 입력하세요..." maxlength="50" style="width: 100%; height: 100px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: none;"></textarea>
                <div style="text-align: right; font-size: 12px; color: #666; margin-top: 5px;">
                    <span id="charCount">0</span>/50
                </div>
            </div>
            
            <!-- Draw Tab -->
            <div id="msg-pane-draw" class="msg-pane" style="display: none; text-align: center;">
                <canvas id="drawCanvas" width="450" height="300" style="border: 1px solid #ddd; cursor: crosshair; background: #fff;"></canvas>
                <div style="margin-top: 10px; display: flex; justify-content: center; gap: 10px;">
                    <button id="clearCanvasBtn" style="padding: 5px 10px; border: 1px solid #ccc; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">지우기</button>
                    <input type="color" id="penColor" value="#000000">
                    <input type="range" id="penSize" min="1" max="10" value="2" style="width: 80px;">
                </div>
            </div>

            <!-- Screen Capture Tab -->
            <div id="msg-pane-screen" class="msg-pane" style="display: none; text-align: center;">
                <div id="previewContainer" style="width: 100%; height: 250px; background: #eee; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; border: 1px solid #ddd;">
                    <span style="color: #999;">캡처된 화면이 여기에 표시됩니다.</span>
                    <img id="screenPreview" style="max-width: 100%; max-height: 100%; display: none;">
                </div>
                <button id="captureBtn" style="padding: 8px 15px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="bi bi-camera"></i> 화면 캡처하기
                </button>
            </div>
        </div>
        <div style="padding: 10px 15px; border-top: 1px solid #eee; text-align: right;">
            <button id="sendDirectMsgBtn" style="padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">전송</button>
        </div>
    `;
    document.body.appendChild(msgModal);

    // Expose openMessageModal globally
    window.openMessageModal = (targetId, targetName) => {
        messageTargetId = targetId;
        messageTargetName = targetName;
        document.getElementById('msgModalTitle').textContent = `${targetName}에게 메시지 보내기`;
        msgModal.style.display = 'flex';

        // Reset Inputs
        document.getElementById('teacherMsgInput').value = '';
        document.getElementById('charCount').innerText = '0';
        clearCanvas();
        document.getElementById('screenPreview').src = '';
        document.getElementById('screenPreview').style.display = 'none';

        // Default to Text Tab
        switchMsgTab('text');
    };

    // Close Button
    document.getElementById('closeMsgBtn').addEventListener('click', () => {
        msgModal.style.display = 'none';
    });

    // Tab Switching
    const msgTabBtns = msgModal.querySelectorAll('.msg-tab-btn');
    const msgPanes = msgModal.querySelectorAll('.msg-pane');

    msgTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchMsgTab(btn.dataset.tab);
        });
    });

    function switchMsgTab(tabName) {
        msgTabBtns.forEach(b => {
            if (b.dataset.tab === tabName) b.classList.add('active'); // Wait, need style for active class
            else b.classList.remove('active');
            // Manual style toggle for simplicity
            b.style.borderBottom = b.dataset.tab === tabName ? '2px solid #007bff' : 'none';
            b.style.color = b.dataset.tab === tabName ? '#007bff' : '#333';
        });

        msgPanes.forEach(p => {
            p.style.display = p.id === `msg-pane-${tabName}` ? 'block' : 'none';
        });
    }

    // Text Input Counter
    const textInput = document.getElementById('teacherMsgInput');
    textInput.addEventListener('input', () => {
        document.getElementById('charCount').textContent = textInput.value.length;
    });

    // Canvas Logic
    const canvas = document.getElementById('drawCanvas');
    const ctx = canvas.getContext('2d');
    let painting = false;

    function startPosition(e) {
        painting = true;
        draw(e);
    }
    function finishedPosition() {
        painting = false;
        ctx.beginPath();
    }
    function draw(e) {
        if (!painting) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = document.getElementById('penSize').value;
        ctx.lineCap = 'round';
        ctx.strokeStyle = document.getElementById('penColor').value; // Color

        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }

    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', finishedPosition);
    canvas.addEventListener('mousemove', draw);

    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    document.getElementById('clearCanvasBtn').addEventListener('click', clearCanvas);


    // Screen Capture Logic
    const captureBtn = document.getElementById('captureBtn');
    const previewImg = document.getElementById('screenPreview');

    captureBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false
            });
            const track = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();

            // Draw to a temp canvas to convert to Blob/DataURL
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bitmap.width;
            tempCanvas.height = bitmap.height;
            const tCtx = tempCanvas.getContext('2d');
            tCtx.drawImage(bitmap, 0, 0);

            // Stop stream immediately after capture
            track.stop();

            // Set Preview
            const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.7); // Compress slightly
            previewImg.src = dataUrl;
            previewImg.style.display = 'block';

        } catch (err) {
            console.error("Error capturing screen:", err);
            alert("화면 캡처에 실패했습니다.");
        }
    });

    // Send Button Logic
    document.getElementById('sendDirectMsgBtn').addEventListener('click', () => {
        if (!socket || !messageTargetId) return;

        // Determine active tab
        let activeTab = 'text';
        msgTabBtns.forEach(b => {
            if (b.style.borderBottom.includes('solid')) activeTab = b.dataset.tab;
        });

        let payload = {
            targetUserId: messageTargetId,
            senderName: currentUser.name || currentUser.id,
            type: activeTab,
            content: ''
        };

        if (activeTab === 'text') {
            const text = textInput.value.trim();
            if (!text) { alert('내용을 입력해주세요.'); return; }
            payload.content = text;
        } else if (activeTab === 'draw') {
            payload.content = canvas.toDataURL('image/png');
        } else if (activeTab === 'screen') {
            if (!previewImg.src || previewImg.style.display === 'none') {
                alert('화면을 먼저 캡처해주세요.');
                return;
            }
            payload.content = previewImg.src;
        }

        // Emit
        socket.emit('send_direct_message', payload);
        alert('전송되었습니다.');
        msgModal.style.display = 'none';
    });

    // --- Recieve Direct Message ---
    socket.on('direct_message', (data) => {
        // data: { senderName, type, content, time }

        // Append to chat list but with distinct style
        const chatList = document.getElementById('nuguriChatList');

        // If chat is closed, open it or show badge? 
        // Force open or notification? Let's treat like normal message first but ensure it routes to chat.
        // Wait, 'direct_message' logic in socketHandler needs to exist.

        // We reuse appendMessage but create a special "teacher-msg" type or style.
        // Actually, let's create a custom bubble for this.

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble others teacher-direct-msg';
        bubble.style.border = '2px solid #ff9f1c'; // Highlight
        bubble.style.backgroundColor = '#fff8e1';

        let contentHtml = '';
        if (data.type === 'text') {
            contentHtml = `<div class="message-text" style="font-weight:bold; color:#d35400;">[선생님 메시지]</div>
                           <div class="message-text">${escapeHtml(data.content)}</div>`;
        } else {
            contentHtml = `<div class="message-text" style="font-weight:bold; color:#d35400;">[선생님 ${data.type === 'draw' ? '그림' : '화면'}]</div>
                            <img src="${data.content}" style="max-width: 100%; border-radius: 4px; border: 1px solid #ccc; margin-top: 5px;" onclick="window.open(this.src)">`;
        }

        bubble.innerHTML = `
            <div style="font-weight:bold; font-size:12px; margin-bottom:2px;">${escapeHtml(data.senderName)}</div>
            ${contentHtml}
            <span class="chat-meta">${data.time}</span>
        `;

        chatList.appendChild(bubble);
        scrollToBottom(chatList);

        if (!isOpen) {
            unreadCount++;
            updateBadge();
        }
    });


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

