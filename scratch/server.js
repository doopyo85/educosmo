const express = require('express');
const path = require('path');
const app = express();

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'build')));

// 모든 요청을 index.html로 라우팅 (SPA를 위해)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 8601;

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// 🔥 우아한 종료 (Graceful Shutdown)
// 활성 소켓 추적
const sockets = new Set();

server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => {
        sockets.delete(socket);
    });
});

const shutdown = (signal) => {
    console.log(`${signal} received: closing HTTP server`);

    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });

    // 기존 연결 강제 종료
    if (sockets.size > 0) {
        console.log(`Destroying ${sockets.size} active sockets...`);
        for (const socket of sockets) {
            socket.destroy();
            sockets.delete(socket);
        }
    }

    // 타임아웃 강제 종료 (PM2 kill_timeout=10000ms 보다 짧아야 함)
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 4000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
