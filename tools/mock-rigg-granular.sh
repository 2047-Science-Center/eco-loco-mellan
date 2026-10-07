#!/usr/bin/env bash
# mock-rigg-granular.sh — testa firmwarens renderare UTAN spel och UTAN hjärna.
# Publicerar granulära topics (lager 2) direkt till ESP32:n via din lokala broker.
# Kräver: mosquitto-clients (mosquitto_pub).
#
# Användning:
#   BROKER=192.168.1.50 ./mock-rigg-granular.sh <scen> [sida]
# Exempel:
#   ./mock-rigg-granular.sh kris
#   ./mock-rigg-granular.sh award-sab 2
#   ./mock-rigg-granular.sh wave
#   ./mock-rigg-granular.sh demo          # kör igenom allt i sekvens
#
# Scener: attract kris nastan-kris mellan ok superbra wave countdown
#         award-sab award-foretagare award-eldsjal gm-grona blackout demo

BROKER="${BROKER:-localhost}"
PORT="${PORT:-1883}"
P() { mosquitto_pub -h "$BROKER" -p "$PORT" -t "$1" -m "$2"; echo "  $1 ← $2"; }

# sätt alla fyra sidor till samma look
all_sides() { for i in 1 2 3 4; do P "ecoloco/rigg/out/led/$i" "$1"; done; }
# släck alla spots
spots_off() { for i in 1 2 3 4; do P "ecoloco/rigg/out/spot/$i" 0; done; }
fx() { P "ecoloco/rigg/out/fx" "{\"fx\":\"$1\",\"speed\":${2:-50}}"; }

# en sida färgad, övriga släckta, + spot på den sidan
award() {
  local sida="$1" look="$2"
  for i in 1 2 3 4; do
    if [ "$i" = "$sida" ]; then P "ecoloco/rigg/out/led/$i" "$look"; P "ecoloco/rigg/out/spot/$i" 1
    else P "ecoloco/rigg/out/led/$i" '{"h":0,"s":0,"v":0}'; P "ecoloco/rigg/out/spot/$i" 0; fi
  done
}

# Inget argument → interaktiv panel (dina reglage)
if [ -z "$1" ]; then
  echo "=== RIGG-REGLAGE (broker: $BROKER) ==="
  echo "Skriv en scen + Enter. Award tar siffra 1-4, t.ex: award-sab 2.  'q' = avsluta."
  echo "Scener: attract kris nastan-kris mellan ok superbra wave countdown"
  echo "        award-sab award-foretagare award-eldsjal gm-grona blackout demo"
  while true; do
    read -rp "rigg> " c a || break
    [ "$c" = "q" ] && break
    [ -z "$c" ] && continue
    "$0" "$c" "$a"
  done
  exit 0
fi

SIDA="${2:-1}"
case "$1" in
  attract)       fx none; all_sides '{"h":200,"s":60,"v":20,"puls":25}'; spots_off ;;
  kris)          fx none; all_sides '{"h":0,"s":100,"v":100,"blink":80}'; spots_off ;;
  nastan-kris)   fx none; all_sides '{"h":0,"s":100,"v":50,"puls":30}'; spots_off ;;
  mellan)        fx none; all_sides '{"h":50,"s":100,"v":35,"puls":40}'; spots_off ;;
  ok)            fx none; all_sides '{"h":110,"s":90,"v":70}'; spots_off ;;
  superbra)      fx none; all_sides '{"h":125,"s":100,"v":70,"puls":60}'; spots_off ;;
  wave)          spots_off; fx wave 60 ;;
  countdown)     all_sides '{"h":0,"s":0,"v":80}'; fx countdown 50 ;;
  award-sab)        fx none; award "$SIDA" '{"h":0,"s":100,"v":100}' ;;
  award-foretagare) fx none; award "$SIDA" '{"h":110,"s":90,"v":90}' ;;
  award-eldsjal)    fx none; award "$SIDA" '{"h":135,"s":100,"v":70}' ;;
  gm-grona)      fx none; all_sides '{"h":120,"s":100,"v":90}'; spots_off ;;
  blackout)      fx none; all_sides '{"h":0,"s":0,"v":0}'; spots_off ;;
  demo)
    for s in attract kris nastan-kris mellan ok superbra wave countdown \
             award-sab award-foretagare award-eldsjal gm-grona blackout; do
      echo "== $s =="; "$0" "$s"; sleep 2
    done ;;
  *) echo "Okänd scen: '$1'"; echo "Scener: attract kris nastan-kris mellan ok superbra wave countdown award-sab award-foretagare award-eldsjal gm-grona blackout demo"; exit 1 ;;
esac
