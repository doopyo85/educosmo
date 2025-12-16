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
        PORT: 3000
      }
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
        PORT: 8601
      }
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
        PORT: 8070
      }
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
        PORT: 8300
      }
    },
    {
      name: 'jupyter-server',
      script: '/var/www/html/jupyter_env_ubuntu/bin/python',
      args: [
        '-m', 'notebook',
        '--ip=0.0.0.0',
        '--port=8000',
        '--no-browser',
        '--allow-root',
        '--notebook-dir=/var/www/html/jupyter_notebooks',
        '--NotebookApp.base_url=/jupyter',
        '--NotebookApp.token=',
        '--NotebookApp.password=',
        '--NotebookApp.allow_origin=*',
        '--NotebookApp.disable_check_xsrf=True',
        '--NotebookApp.allow_remote_access=True'
      ],
      cwd: '/var/www/html',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PATH: '/var/www/html/jupyter_env_ubuntu/bin:/usr/bin:/bin:/usr/local/bin',
        HOME: '/home/ubuntu',
        VIRTUAL_ENV: '/var/www/html/jupyter_env_ubuntu'
      }
    }
  ]
};
