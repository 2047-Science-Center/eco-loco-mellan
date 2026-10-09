#!/usr/bin/env bash
# installera-rigg.sh — gör att SPELET triggar förstärkningsriggen från server-NUC:en.
# Kör på SAMMA NUC som kör spelservern (efter installera-mint.sh server).
#
# Kedjan den sätter upp:
#   spel (server.js -> src/rigg.js, semantiska cues) -> mosquitto (localhost)
#     -> hjarna-stubb.py (översätter semantik -> granulärt + ljud) -> ESP32 renderar
#
# ESP32:ns firmware ska då ha  MQTT_BROKER = <denna NUC:s IP>.
#
#   bash drift/mint/installera-rigg.sh

set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "▸ Installerar mosquitto (broker) + klienter + mpg123 (riggljud)…"
sudo apt-get update -qq
sudo apt-get install -y mosquitto mosquitto-clients mpg123

echo "▸ Broker lyssnar på hela LAN:et (så ESP32:n kan ansluta över wifi/kabel)…"
# Återbruk av repots prototyp-config: listener 0.0.0.0:1883, anonymt (prototyp).
sudo cp "${REPO_DIR}/tools/mosquitto-rigg.conf" /etc/mosquitto/conf.d/eco-loco-rigg.conf
sudo systemctl enable --now mosquitto
sudo systemctl restart mosquitto

echo "▸ --user-tjänst för hjärnan (hjarna-stubb.py, BROKER=localhost)…"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/eco-loco-hjarna.service" <<EOF
[Unit]
Description=Eco Loco rigg-hjärna (hjarna-stubb)
After=network-online.target

[Service]
WorkingDirectory=${REPO_DIR}
Environment=BROKER=localhost
ExecStart=$(command -v python3) ${REPO_DIR}/tools/hjarna-stubb.py
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now eco-loco-hjarna
sudo loginctl enable-linger "$USER" 2>/dev/null || true

sleep 1
echo
echo "✔ Broker + hjärna kör. Spelet (RIGG_BROKER=localhost) triggar nu riggen."
echo "  Broker-logg:  journalctl -u mosquitto -f"
echo "  Hjärn-logg:   journalctl --user -u eco-loco-hjarna -f"
echo
echo "  → Sätt ESP32:ns  MQTT_BROKER = $(hostname -I | awk '{print $1}')  och flasha om."
echo "  → Testa utan spel:  BROKER=localhost bash tools/mock-rigg-semantisk.sh kris"
