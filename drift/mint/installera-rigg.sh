#!/usr/bin/env bash
# installera-rigg.sh — kopplar förstärkningsriggen till spelet via en MQTT-broker.
# Kör på SAMMA NUC som spelservern (efter installera-mint.sh server).
#
# Kedjan den sätter upp:
#   spel (server.js -> src/rigg.js, semantik) -> BROKER -> hjarna-stubb.py (semantik -> granulärt + ljud) -> ESP32
#
# Riktar BÅDE spelservern (RIGG_BROKER) OCH hjärnan (BROKER) mot samma broker, så de aldrig
# hamnar på olika brokers (then renderas inget).
#
#   bash drift/mint/installera-rigg.sh 192.168.0.23   # EXTERN broker (t.ex. 2047-brokern) — INGEN lokal broker
#   bash drift/mint/installera-rigg.sh                # lokal, självständig broker på denna NUC (localhost)
#
# ESP32:ns firmware (MQTT_BROKER) och Blocks-enheterna ska peka på SAMMA broker.
# AUDIO_SINK=<sink> framför kommandot → rigg-ljudet på en viss utgång (pactl list short sinks).

set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BROKER="${1:-localhost}"

echo "▸ Installerar mosquitto-clients + mpg123 (hjärnan triggar via mosquitto_pub/sub; mpg123 = riggljud)…"
sudo apt-get update -qq
sudo apt-get install -y mosquitto-clients mpg123

if [ "$BROKER" = "localhost" ] || [ "$BROKER" = "127.0.0.1" ]; then
  echo "▸ LOKAL broker: installerar mosquitto på denna NUC (lyssnar på hela LAN:et)…"
  sudo apt-get install -y mosquitto
  sudo cp "${REPO_DIR}/tools/mosquitto-rigg.conf" /etc/mosquitto/conf.d/eco-loco-rigg.conf
  sudo systemctl enable --now mosquitto
  sudo systemctl restart mosquitto
  ESP_BROKER="$(hostname -I | awk '{print $1}')"   # ESP/Blocks pekar på denna NUC:s LAN-IP
else
  echo "▸ EXTERN broker: $BROKER — installerar INGEN lokal broker."
  if timeout 4 mosquitto_sub -h "$BROKER" -t '$SYS/broker/version' -C 1 >/dev/null 2>&1; then
    echo "   ✓ brokern $BROKER svarar på 1883"
  else
    echo "   ⚠ fick inget svar från $BROKER:1883 — kontrollera att brokern kör och är nåbar (forts. ändå)."
  fi
  ESP_BROKER="$BROKER"
fi

echo "▸ Riktar SPELSERVERN mot brokern (RIGG_BROKER=$BROKER) via drop-in…"
mkdir -p "$HOME/.config/systemd/user/eco-loco-server.service.d"
printf '[Service]\nEnvironment=RIGG_BROKER=%s\n' "$BROKER" > "$HOME/.config/systemd/user/eco-loco-server.service.d/broker.conf"

echo "▸ --user-tjänst för hjärnan (hjarna-stubb.py, BROKER=$BROKER)…"
AUDIO_SINK="${AUDIO_SINK:-}"
SINK_LINE=""
[ -n "$AUDIO_SINK" ] && { SINK_LINE="Environment=AUDIO_SINK=${AUDIO_SINK}"; echo "   rigg-ljud → $AUDIO_SINK"; }
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/eco-loco-hjarna.service" <<EOF
[Unit]
Description=Eco Loco rigg-hjärna (hjarna-stubb)
After=network-online.target

[Service]
WorkingDirectory=${REPO_DIR}
Environment=BROKER=${BROKER}
${SINK_LINE}
ExecStart=$(command -v python3) ${REPO_DIR}/tools/hjarna-stubb.py
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
# Städa ev. gammal manuell drop-in som annars överrider BROKER i huvudfilen.
rm -f "$HOME/.config/systemd/user/eco-loco-hjarna.service.d/broker.conf" 2>/dev/null || true

systemctl --user daemon-reload
systemctl --user enable eco-loco-hjarna
systemctl --user restart eco-loco-hjarna
systemctl --user restart eco-loco-server 2>/dev/null || true   # så RIGG_BROKER-drop-in slår igenom
sudo loginctl enable-linger "$USER" 2>/dev/null || true

sleep 1
echo
echo "✔ Spelserver + hjärna pekar nu på brokern: $BROKER"
echo "  Hjärn-logg:   journalctl --user -u eco-loco-hjarna -f"
[ "$BROKER" = "localhost" ] || [ "$BROKER" = "127.0.0.1" ] && echo "  Broker-logg:  journalctl -u mosquitto -f"
echo
echo "  → ESP32:ns  MQTT_BROKER = $ESP_BROKER   (firmware/rigg_arduino/config.h) → flasha om."
echo "  → Blocks-enheterna (EcolocoRigg/EcolocoSpel) ska peka på samma broker: $ESP_BROKER"
echo "  → Testa utan spel:  BROKER=$BROKER bash tools/mock-rigg-semantisk.sh kris"
