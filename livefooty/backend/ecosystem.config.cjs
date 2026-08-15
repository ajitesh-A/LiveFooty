// PM2 process manager config (VPS without Docker)
// Usage: npm i -g pm2 && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'livefooty',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
}