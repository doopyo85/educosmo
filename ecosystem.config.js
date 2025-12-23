module.exports = {
  apps: [
    {
      name: 'server',
      script: './server.js',
      cwd: '/var/www/html',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        SERVICE_TYPE: 'main',
        JUPYTER_HOST: '127.0.0.1',
        JUPYTER_PORT: 8889,
        JUDGE0_API_URL: 'http://localhost:2358'
      },
      kill_timeout: 10000
    },
    {
      name: 'scratch',
      script: './server.js',
      cwd: '/var/www/html/scratch',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8601,
        SERVICE_TYPE: 'scratch'
      },
      kill_timeout: 10000
    },
    {
      name: 'entry-server',
      script: './server.js',
      cwd: '/var/www/html/entry',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8070,
        SERVICE_TYPE: 'entry'
      },
      kill_timeout: 10000
    },
    {
      name: 'appinventor-server',
      script: './server.js',
      cwd: '/var/www/html/appinventor',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8300,
        SERVICE_TYPE: 'appinventor'
      },
      kill_timeout: 10000
    },
    {
      name: 'jupyter',
      script: 'jupyter',
      args: 'lab --port=8889 --no-browser --ip=0.0.0.0 --allow-root --NotebookApp.token="" --NotebookApp.password=""',
      cwd: '/var/www/html/python', // Python Project Root
      interpreter: 'python3', // or 'none' if jupyter is in path, but safer to let PM2 handle binary if possible, or use 'bash' script 
      // Better approach: Execute shell command
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
