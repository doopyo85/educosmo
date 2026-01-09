const socketIo = require('socket.io');
const db = require('../lib_login/db');

let io;

const initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: [
                'https://app.codingnplay.co.kr',
                'https://cosmoedu.co.kr',
                'http://localhost:3000',
                'https://localhost:3000'
            ],
            methods: ["GET", "POST"],
            credentials: true
        },
        path: '/socket.io'
    });

    io.on('connection', (socket) => {
        console.log(`[Socket.io] New connection: ${socket.id}`);

        // 👥 User Presence
        socket.on('join', async (userData) => {
            if (!userData) return;

            // Store user info
            socket.userData = userData; // { id, name, role, centerID }
            // Join Center Room (for future Center-based isolation)
            // Join Center Room (for future Center-based isolation)
            if (userData.centerID) {
                socket.join(`center_${userData.centerID}`);
            }

            broadcastUserList();

            // 🔥 Send Recent Chat History
            try {
                // Using existing nuguritalk_posts table structure based on router
                const history = await db.queryDatabase(`
                    SELECT p.*, u.name as author_name 
                    FROM nuguritalk_posts p 
                    LEFT JOIN Users u ON p.author_id = u.id 
                    ORDER BY p.created_at DESC LIMIT 50
                `);

                // Reverse to show oldest first in chat flow
                socket.emit('chat_history', history.reverse().map(msg => ({
                    id: msg.id,
                    user: msg.author_id, // Use ID for comparison
                    userName: msg.author_name || msg.author,
                    text: msg.title, // 'title' column contains the message text based on router code
                    time: new Date(msg.created_at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: true })
                })));
            } catch (err) {
                console.error('Error fetching chat history:', err);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket.io] Disconnected: ${socket.id}`);
            broadcastUserList();
        });

        // Basic ping test
        socket.on('ping', () => {
            socket.emit('pong', 'Alive');
        });

        // 🔒 Secret Chat (Teachers Only)
        socket.on('join_secret', () => {
            if (socket.userData &&
                (socket.userData.role === 'teacher' || socket.userData.role === 'admin' || socket.userData.role === 'manager')) {
                socket.join('secret_room');
            }
        });

        socket.on('secret_chat_message', (data) => {
            // Validate & Auth Check
            if (!data || !data.text) return;
            // Double check permission (though room limits recipients, sender must be auth'd)
            // In real app, we check socket.userData.role again but room isolation is okay for now

            // Broadcast to 'secret_room' only
            io.to('secret_room').emit('secret_chat_message', {
                user: data.user,
                userName: socket.userData ? socket.userData.name : data.user,
                text: data.text,
                time: data.time || new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: true })
            });
        });

        // 🗑️ Delete Message Handler
        socket.on('delete_message', async (data) => {
            if (!socket.userData) return;
            const messageId = data.id;
            const userId = socket.userData.id; // String ID
            const userRole = socket.userData.role;

            try {
                // Check Message Ownership
                const msg = await db.queryDatabase('SELECT author_id FROM nuguritalk_posts WHERE id = ?', [messageId]);
                if (!msg || msg.length === 0) return;

                // Resolve integer ID for comparison
                const userResult = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [userId]);
                if (!userResult || userResult.length === 0) return;
                const userIntId = userResult[0].id;

                if (userRole === 'admin' || userRole === 'manager' || msg[0].author_id === userIntId) {
                    await db.queryDatabase('DELETE FROM nuguritalk_posts WHERE id = ?', [messageId]);
                    io.emit('message_deleted', { id: messageId });
                }
            } catch (e) {
                console.error('Delete message error:', e);
            }
        });

        // 💬 Chat Message Handler
        socket.on('chat_message', async (data) => {
            // Validate data
            if (!data || !data.text) return;

            // 🛑 Rate Limiting Logic
            const now = Date.now();

            // Initialize user tracking
            if (!socket.userData.msgLog) {
                socket.userData.msgLog = [];
                socket.userData.blockedUntil = 0;
            }

            // Check if blocked
            if (now < socket.userData.blockedUntil) {
                const remaining = Math.ceil((socket.userData.blockedUntil - now) / 1000);
                socket.emit('spam_warning', {
                    message: `도배 방지를 위해 30초간 대화가 제한됩니다. (${remaining}초 남음)`,
                    remaining: remaining
                });
                return;
            }

            // Cleanup old logs (> 5 seconds ago)
            socket.userData.msgLog = socket.userData.msgLog.filter(time => now - time < 5000);

            // Add current message
            socket.userData.msgLog.push(now);

            // Check limit (5 messages in 5 seconds)
            if (socket.userData.msgLog.length > 5) {
                socket.userData.blockedUntil = now + 30000; // Block for 30s
                socket.emit('spam_warning', {
                    message: '너무 빠르게 입력하셨습니다. 도배 방지를 위해 30초간 입력이 차단됩니다.',
                    remaining: 30
                });
                return;
            }

            // 🤬 Profanity Filter Logic
            // Replace bad words with '너구리'
            const badWords = [
                '시발', '씨발', '개새끼', '병신', '지랄', '좆', '씹', '년', '놈', '닥쳐', '꺼져',
                '니미', '엠창', '느금마', '애미', '애비', '섹스', '보지', '자지', '야동', '성관계'
            ];

            let filteredText = data.text;
            badWords.forEach(word => {
                const regex = new RegExp(word, 'gi'); // Simple check, can be improved
                filteredText = filteredText.replace(regex, '너구리');
            });

            // Use filtered text
            const finalContent = filteredText;

            try {
                // 🔥 Save to DB
                let authorName = data.user;
                let authorIdStr = data.user;

                if (socket.userData) {
                    authorName = socket.userData.name || data.user;
                    authorIdStr = socket.userData.id || data.user;
                }

                // Resolve Integer ID from Users table
                const userResult = await db.queryDatabase('SELECT id FROM Users WHERE userID = ?', [authorIdStr]);

                if (!userResult || userResult.length === 0) {
                    console.error('User not found for chat insertion:', authorIdStr);
                    return; // Cannot insert without valid FK
                }

                const userIntId = userResult[0].id;

                const result = await db.queryDatabase(`
                    INSERT INTO nuguritalk_posts (title, content, author, author_id)
                    VALUES (?, ?, ?, ?)
                `, [finalContent, finalContent, authorName, userIntId]);

                // Broadcast
                io.emit('chat_message', {
                    id: result.insertId,
                    user: data.user,
                    userName: authorName,
                    text: finalContent,
                    time: new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: true })
                });

            } catch (err) {
                console.error('Error saving chat message:', err);
            }
        });

        // 👁️ 원격 모니터링 핸들러 (Remote Monitoring)
        // 1. 교사가 모니터링 요청
        socket.on('request_monitor', (targetUserId) => {
            // 권한 체크: 교사/관리자만 요청 가능
            if (!socket.userData || !['teacher', 'admin', 'manager'].includes(socket.userData.role)) {
                socket.emit('error', '권한이 없습니다.');
                return;
            }

            console.log(`[Monitor] ${socket.userData.id} requests to monitor ${targetUserId}`);

            // 대상 찾기
            let targetSocketId = null;
            for (const [id, skt] of io.of("/").sockets) {
                if (skt.userData && skt.userData.id === targetUserId) {
                    targetSocketId = id;
                    break;
                }
            }

            if (targetSocketId) {
                // 학생에게 모니터링 시작 명령 전송
                // 교사의 Socket ID를 함께 보내서 학생이 누구에게 데이터를 보낼지 알게 함 (혹은 서버 릴레이)
                io.to(targetSocketId).emit('cmd_monitor_start', {
                    monitorId: socket.id, // 교사의 소켓 ID
                    monitorName: socket.userData.name
                });

                // 교사에게 성공 응답 (필요시)
                socket.emit('monitor_connected', { targetUserId });
            } else {
                socket.emit('error', '해당 사용자를 찾을 수 없거나 오프라인입니다.');
            }
        });

        // 2. 교사가 모니터링 중단
        socket.on('stop_monitor', (targetUserId) => {
            if (!socket.userData || !['teacher', 'admin', 'manager'].includes(socket.userData.role)) return;

            // 대상 찾기
            let targetSocketId = null;
            for (const [id, skt] of io.of("/").sockets) {
                if (skt.userData && skt.userData.id === targetUserId) {
                    targetSocketId = id;
                    break;
                }
            }

            if (targetSocketId) {
                io.to(targetSocketId).emit('cmd_monitor_stop', { monitorId: socket.id });
            }
        });

        // 3. 학생이 코드 데이터 전송 (릴레이)
        socket.on('monitor_data', (data) => {
            // data: { targetSocketId (monitor), code, cursor }
            if (!data || !data.targetSocketId) return;

            // 교사에게 데이터 전달
            io.to(data.targetSocketId).emit('monitor_update', {
                userId: socket.userData ? socket.userData.id : 'unknown',
                code: data.code,
                cursor: data.cursor
            });
        });

        // 4. 💌 Direct Message Relay (Teacher -> Student)
        socket.on('send_direct_message', (data) => {
            // data: { targetUserId, type, content, senderName }
            const targetUserId = data.targetUserId;

            // Find Target Socket
            let targetSocketId = null;
            let targetSocket = null; // We need the socket object to check role

            for (const [id, skt] of io.of("/").sockets) {
                if (skt.userData && skt.userData.id === targetUserId) {
                    targetSocketId = id;
                    targetSocket = skt;
                    break;
                }
            }

            if (!targetSocketId || !targetSocket) {
                socket.emit('error', '해당 사용자를 찾을 수 없거나 오프라인입니다.');
                return;
            }

            // Validate Permissions
            // 1. Sender is Teacher/Admin (Can send to anyone)
            // 2. Sender is Student AND Recipient is Teacher/Admin (Can send to teachers)
            const isSenderAuthorized = socket.userData && ['teacher', 'admin', 'manager'].includes(socket.userData.role);
            const isRecipientTeacher = targetSocket.userData && ['teacher', 'admin', 'manager'].includes(targetSocket.userData.role);

            if (!isSenderAuthorized && !isRecipientTeacher) {
                socket.emit('error', '권한이 없습니다.');
                return;
            }

            // Send to Target
            io.to(targetSocketId).emit('direct_message', {
                senderName: socket.userData.name || '학생', // Default to '학생' if name missing (though expected)
                type: data.type,
                content: data.content,
                time: new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: true })
            });
        });

        // Helper: Broadcast User List
        const broadcastUserList = () => {
            const usersMap = new Map();
            for (const [id, skt] of io.of("/").sockets) {
                if (skt.userData) {
                    // Deduplicate by User ID
                    if (!usersMap.has(skt.userData.id)) {
                        usersMap.set(skt.userData.id, {
                            socketId: id,
                            id: skt.userData.id,
                            name: skt.userData.name || skt.userData.id,
                            role: skt.userData.role,
                            centerID: skt.userData.centerID,
                            centerName: skt.userData.centerName
                        });
                    }
                }
            }
            io.emit('user_list_update', Array.from(usersMap.values()));
        };
    });


    console.log('✅ Socket.io initialized');
    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = { initSocket, getIo };
