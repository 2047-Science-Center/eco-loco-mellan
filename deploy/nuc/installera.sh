#!/usr/bin/env bash
# installera.sh — sätter upp hela rigg-stacken på huvud-NUC:en (Linux Mint).
# Kör EN gång från repo-roten:  bash deploy/nuc/installera.sh
# Efteråt: starta om NUC:en → broker + spelserver (systemd) + hjärnan (session) går igång själva.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
USER_NAME="$(whoami)"
cd "$REPO"

echo "== Installerar beroenden =="
sudo apt update
sudo apt install -y mosquitto mosquitto-clients mpg123 nodejs

NODE="$(command -v node || command -v nodejs || true)"
[ -z "$NODE" ] && { echo "FEL: node/nodejs hittas inte efter apt. Installera Node ≥18 och kör om."; exit 1; }
NODE_MAJOR="$("$NODE" -v | sed 's/^v//;s/\..*//')"
[ "$NODE_MAJOR" -lt 18 ] && echo "VARNING: Node $($NODE -v) < 18. Servern vill ha ≥18 — installera nyare (nodesource) om den strular."

echo "== Broker: LAN-listener via conf.d =="
sudo tee /etc/mosquitto/conf.d/rigg.conf >/dev/null <<'EOF'
listener 1883 0.0.0.0
allow_anonymous true
EOF
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

echo "== Spelserver som systemd-tjänst =="
sudo tee /etc/systemd/system/eco-loco-server.service >/dev/null <<EOF
[Unit]
Description=Eco Loco Mellan game server
After=network-online.target mosquitto.service
Wants=network-online.target
[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$REPO
Environment=RIGG_BROKER=localhost
ExecStart=$NODE server/server.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now eco-loco-server

echo "== Hjärnan som autostart i sessionen (behövs för ljudet) =="
chmod +x "$REPO/deploy/nuc/start-rigg.sh"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/eco-loco-rigg.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Eco Loco rigg (hjärna + ljud)
Exec=$REPO/deploy/nuc/start-rigg.sh
X-GNOME-Autostart-enabled=true
EOF

echo
echo "KLART. Verifiera sink-namnen i deploy/nuc/rigg.env mot:  pactl list short sinks"
echo "Starta om NUC:en. Sen:"
echo "  systemctl status eco-loco-server     (spelservern)"
echo "  tail -f ~/.eco-loco-rigg.log         (hjärnans logg: award/soundscape/GM)"
echo "Spelet öppnas på:  http://localhost:8765/spel.html?online=1"
