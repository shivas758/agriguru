// PM2 Ecosystem Configuration for AgriGuru Sync Service

module.exports = {
  apps: [{
    name: 'agriguru-sync',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Auto-restart configuration
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    
    // Restart strategies
    min_uptime: '10s',
    max_restarts: 10,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 3000
  }]
};
