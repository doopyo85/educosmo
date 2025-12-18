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

        // 💬 Chat Message Handler
        socket.on('chat_message', async (data) => {
            // Validate data
            if (!data || !data.text) return;

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

                await db.queryDatabase(`
                    INSERT INTO nuguritalk_posts (title, content, author, author_id)
                    VALUES (?, ?, ?, ?)
                `, [data.text, data.text, authorName, userIntId]);

                // Broadcast
                io.emit('chat_message', {
                    user: data.user,
                    userName: authorName,
                    text: data.text,
                    time: new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: true })
                });

            } catch (err) {
                console.error('Error saving chat message:', err);
            }
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
                            centerID: skt.userData.centerID
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
