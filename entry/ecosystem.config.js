module.exports = {
    apps: [{
        name: 'entry-server',
        script: './server.js',
        cwd: '/var/www/html/entry',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        env: {
            NODE_ENV: 'production',
            PORT: 8070
        }
    }]
};
