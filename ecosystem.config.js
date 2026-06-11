module.exports = {
  apps: [
    {
      name: "sellvpn",
      script: "app.js",
      cwd: "/root/BotVPN",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 4000,
    }
  ],
};
