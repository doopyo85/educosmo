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
                    time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

        // 💬 Chat Message Handler
        socket.on('chat_message', async (data) => {
            // Validate data
            if (!data || !data.text) return;

            try {
                // 🔥 Save to DB
                let authorName = data.user;
                if (socket.userData && socket.userData.name) {
                    authorName = socket.userData.name;
                }

                await db.queryDatabase(`
                    INSERT INTO nuguritalk_posts (title, content, author, author_id)
                    VALUES (?, ?, ?, ?)
                `, [data.text, data.text, authorName, data.user]);

                // Broadcast
                io.emit('chat_message', {
                    user: data.user,
                    userName: authorName,
                    text: data.text,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });

            } catch (err) {
                console.error('Error saving chat message:', err);
            }
        });

        // Helper: Broadcast User List
        const broadcastUserList = () => {
            const users = [];
            for (const [id, skt] of io.of("/").sockets) {
                if (skt.userData) {
                    users.push({
                        socketId: id,
                        id: skt.userData.id,
                        name: skt.userData.name || skt.userData.id,
                        role: skt.userData.role,
                        centerID: skt.userData.centerID
                    });
                }
            }
            io.emit('user_list_update', users);
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
