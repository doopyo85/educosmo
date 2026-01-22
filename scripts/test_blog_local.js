const http = require('http');

function testUrl(port, host, path) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: path || '/',
            method: 'GET',
            headers: {
                'Host': host
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[Port ${port} Host ${host}] Status: ${res.statusCode}`);
                console.log(`[Port ${port} Host ${host}] Body Length: ${data.length}`);
                if (res.statusCode !== 200) {
                    console.log(`[Port ${port} Host ${host}] Body Preview: ${data.substring(0, 300).replace(/\n/g, ' ')}`);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`[Port ${port} Host ${host}] Error: ${e.message}`);
            resolve();
        });

        req.end();
    });
}

async function run() {
    console.log('--- Testing Direct Blog Server (3001) ---');
    await testUrl(3001, 'minho.pong2.app');

    console.log('\n--- Testing Main Server Proxy (3000) ---');
    await testUrl(3000, 'minho.pong2.app');
}

run();
