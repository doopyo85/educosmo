const socketIo = require('socket.io');

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
        socket.on('join', (userData) => {
            if (!userData) return;

            // Store user info
            socket.userData = userData; // { id, name, role, centerID }
            // Join Center Room (for future Center-based isolation)
            if (userData.centerID) {
                socket.join(`center_${userData.centerID}`);
            }

            broadcastUserList();
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
        socket.on('chat_message', (data) => {
            // Validate data
            if (!data || !data.text) return;

            // Broadcast to all connected clients (Global for now)
            io.emit('chat_message', {
                user: data.user,
                // If we have stored name, use it, otherwise fallback
                userName: socket.userData ? socket.userData.name : data.user,
                text: data.text,
                time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
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
