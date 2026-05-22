module.exports = {
  apps: [
    {
      name: "campus-room-backend",
      cwd: __dirname,
      script: "./src/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      time: true,
      watch: false,
      autorestart: true,
      max_memory_restart: "180M",
      node_args: "--max-old-space-size=256",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        LOG_LEVEL: "info"
      }
    }
  ]
};
