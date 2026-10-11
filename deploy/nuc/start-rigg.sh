#!/usr/bin/env bash
# start-rigg.sh — startar RIGG-HJÄRNAN i den grafiska sessionen (behövs för ljudet).
# Körs via autostart vid inloggning. Broker + spelserver körs som systemd-tjänster.
set -u
DIR="$(cd "$(dirname "$0")/../.." && pwd)"          # repo-roten
source "$DIR/deploy/nuc/rigg.env"
cd "$DIR"

exec >> "${HOME}/.eco-loco-rigg.log" 2>&1     # all logg hit (följ med: tail -f ~/.eco-loco-rigg.log)
log(){ echo "[$(date '+%F %T')] $*"; }

# Standard-ut = skärmen, så spelets webbläsar-klick hamnar där (hjärnan pinnas separat).
pactl set-default-sink "$SCREEN_SINK" 2>/dev/null || true

# Vänta tills brokern svarar (systemd-mosquitto startar parallellt).
for i in $(seq 1 30); do
  mosquitto_pub -h "$RIGG_BROKER" -t rigg/ping -m 1 2>/dev/null && break
  sleep 1
done

# Hjärnan, pinnad till Anker, med keep-alive.
log "startar hjärnan (ljud → $AUDIO_SINK)"
while true; do
  AUDIO_SINK="$AUDIO_SINK" BROKER="$RIGG_BROKER" python3 tools/hjarna-stubb.py
  log "hjärnan avslutades — startar om om 2 s"
  sleep 2
done
