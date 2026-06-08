#!/usr/bin/env bash
# One-time installer for the auto-redeploy timer. Run on the VM after you've
# created /opt/raeon/.env. Enables a 5-min poll that deploys new release tags.
#
#   sudo /opt/raeon/deploy/install.sh
set -euo pipefail

APP_DIR="${RAEON_DIR:-/opt/raeon}"

if [ "$(id -u)" -ne 0 ]; then
  echo "run with sudo" >&2
  exit 1
fi

if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env missing. Create it first (DISCORD_TOKEN, DB_PASSWORD, LAVALINK_PASSWORD)." >&2
  exit 1
fi

chmod +x "$APP_DIR/deploy/redeploy.sh"

cp "$APP_DIR/deploy/raeon-deploy.service" /etc/systemd/system/raeon-deploy.service
cp "$APP_DIR/deploy/raeon-deploy.timer"   /etc/systemd/system/raeon-deploy.timer

systemctl daemon-reload
systemctl enable --now raeon-deploy.timer

echo "Timer installed. Running first deploy now (this builds images — give it a few minutes)..."
systemctl start raeon-deploy.service

echo
echo "Done. Useful commands:"
echo "  systemctl list-timers raeon-deploy.timer"
echo "  journalctl -u raeon-deploy.service -f"
echo "  cd $APP_DIR && docker compose ps"
