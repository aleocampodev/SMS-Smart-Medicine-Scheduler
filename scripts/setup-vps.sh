#!/usr/bin/env bash
# One-shot VPS setup for the SMS Horizon Watcher.
# Run ON THE VPS with sudo, from the app directory: sudo ./scripts/setup-vps.sh
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Run with sudo: sudo $0"
  exit 1
fi

APP_USER="${SUDO_USER:-root}"
APP_DIR=$(sudo -u "$APP_USER" test -d /home/"$APP_USER"/sms && echo /home/"$APP_USER"/sms || echo "$(pwd)")
echo "[setup] App directory: $APP_DIR"

# 1. Swap (mandatory with 1 GB RAM to prevent Chromium OOM kills)
if ! swapon --show | grep -q /swapfile; then
  echo "[setup] Creating 2 GB swap..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "[setup] Swap already active."
fi

# 2. Node.js 20 LTS + system dependencies
echo "[setup] Installing Node.js 20 and browser dependencies..."
apt-get update -y
apt-get install -y curl ca-certificates
if ! command -v node > /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
fi
apt-get install -y nodejs git xvfb \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2

# 3. Install app dependencies (as the non-root user)
echo "[setup] Installing project dependencies..."
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm install && npx playwright install chromium"

# 4. systemd service with auto-restart
echo "[setup] Installing systemd service..."
cat > /etc/systemd/system/sms-horizon.service <<UNIT
[Unit]
Description=SMS Horizon Watcher
After=network-online.target

[Service]
WorkingDirectory=$APP_DIR
Environment=PLAYWRIGHT_HEADLESS=false
ExecStart=/usr/bin/xvfb-run -a npm run watch:horizon
Restart=always
RestartSec=30
User=$APP_USER

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now sms-horizon
echo "[setup] Done. Follow logs with: journalctl -u sms-horizon -f"
