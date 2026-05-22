const path = require("node:path");

const rootDir = __dirname;
const logDir = path.join(rootDir, "logs");

module.exports = {
  apps: [
    {
      name: "campus-room-backend",
      cwd: path.join(rootDir, "backend"),
      script: "./src/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      restart_delay: 1500,
      kill_timeout: 5000,
      max_memory_restart: "180M",
      node_args: "--max-old-space-size=256",
      time: true,
      merge_logs: true,
      out_file: path.join(logDir, "backend-out.log"),
      error_file: path.join(logDir, "backend-error.log"),
      env_production: {
        NODE_ENV: "production"
      }
    },
    {
      name: "campus-room-frontend",
      cwd: path.join(rootDir, "frontend"),
      script: "./server.mjs",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      restart_delay: 1500,
      kill_timeout: 3000,
      max_memory_restart: "96M",
      node_args: "--max-old-space-size=128",
      time: true,
      merge_logs: true,
      out_file: path.join(logDir, "frontend-out.log"),
      error_file: path.join(logDir, "frontend-error.log"),
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
