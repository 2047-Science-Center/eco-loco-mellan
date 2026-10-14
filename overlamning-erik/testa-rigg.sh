#!/usr/bin/env bash
# testa-rigg.sh — trigga LED, pil, fx, saftblandare och ljud från terminalen via MQTT.
#
#   LED / pil / fx / blandare  → direkt till ESP32 (granulärt). Kräver bara broker + ESP32.
#   ljud / ohalsa              → via hjärnan (hjarna-stubb.py). Kräver att den körs (för högtalaren).
#
# Interaktiv panel:   ./testa-rigg.sh
# En rad:             BROKER=192.168.1.50 ./testa-rigg.sh led 1 grön
#
# Broker-IP: sätt BROKER=<ip> om brokern inte kör på samma dator som du står på.

BROKER="${BROKER:-localhost}"; PORT="${PORT:-1883}"
P(){ mosquitto_pub -h "$BROKER" -p "$PORT" -t "$1" -m "$2"; echo "  $1 ← $2"; }

farg(){ case "$1" in
  rod|röd)   echo '{"h":0,"s":100,"v":100}';;
  gron|grön) echo '{"h":120,"s":100,"v":80}';;
  gul)       echo '{"h":50,"s":100,"v":60}';;
  bla|blå)   echo '{"h":220,"s":100,"v":60}';;
  vit)       echo '{"h":0,"s":0,"v":80}';;
  av|off)    echo '{"h":0,"s":0,"v":0}';;
  *)         echo '{"h":120,"s":100,"v":80}';;
esac; }

run(){ case "$1" in
  led)      P "ecoloco/rigg/out/led/${2:-1}"  "$(farg "${3:-grön}")";;     # ambient-segment 1-4
  pil)      P "ecoloco/rigg/out/spot/${2:-1}" "$([ "$3" = off ] && echo 0 || echo 1)";;  # pil-segment 1-4
  fx)       P ecoloco/rigg/out/fx "{\"fx\":\"${2:-wave}\",\"speed\":${3:-60}}";;          # wave|countdown|none
  blandare) P ecoloco/rigg/out/blandare "$([ "$2" = off ] && echo 0 || echo 1)";;         # saftblandar-relä
  ljud)     P ecoloco/rigg/gm/ljud "${2:-ding}";;        # KRÄVER hjärnan → spelar i högtalaren
  ohalsa)   P ecoloco/rigg/ohalsa "${2:-50}";;           # KRÄVER hjärnan → öhälso-look + soundscape
  demo)
    for n in 1 2 3 4; do P "ecoloco/rigg/out/led/$n" "$(farg grön)"; done
    for n in 1 2 3 4; do P "ecoloco/rigg/out/spot/$n" 1; sleep 1; done
    P ecoloco/rigg/out/fx '{"fx":"wave","speed":60}'; sleep 3; P ecoloco/rigg/out/fx '{"fx":"none"}'
    P ecoloco/rigg/out/blandare 1; sleep 1; P ecoloco/rigg/out/blandare 0;;
  av|allt-av)
    for n in 1 2 3 4; do P "ecoloco/rigg/out/led/$n" "$(farg av)"; P "ecoloco/rigg/out/spot/$n" 0; done
    P ecoloco/rigg/out/fx '{"fx":"none"}'; P ecoloco/rigg/out/blandare 0;;
  *) echo "Okänt: '$1'. Se listan i testa-rigg.sh eller README.";;
esac; }

if [ -z "$1" ]; then
  echo "=== RIGG-TEST (broker: $BROKER) ==="
  echo "  led <1-4> <röd|grön|gul|blå|vit|av>   ambient-segment"
  echo "  pil <1-4> on|off                      pil-segment (chevron sveper inåt)"
  echo "  fx wave|countdown|none                effekt över ambient-delen"
  echo "  blandare on|off                       saftblandar-relä"
  echo "  ljud [id]       högtalaren (KRÄVER hjärnan)      ohalsa <1-100>  öhälsa+soundscape (KRÄVER hjärnan)"
  echo "  demo | allt-av | q"
  while true; do read -rp "rigg> " a b c || break; [ "$a" = q ] && break; [ -z "$a" ] && continue; run "$a" "$b" "$c"; done
  exit 0
fi
run "$@"
