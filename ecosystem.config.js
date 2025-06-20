module.exports = {
  apps: [{
    name: 'randomchat-server',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Restart on file changes (development)
    // watch: ['server'],
    // ignore_watch: ['node_modules', 'logs', 'client'],
    // Restart delay
    restart_delay: 4000,
    // Kill timeout
    kill_timeout: 5000,
    // Listen timeout
    listen_timeout: 8000,
    // Max restart attempts
    max_restarts: 10,
    // Min uptime before considering app started
    min_uptime: '10s'
  }]
}; 