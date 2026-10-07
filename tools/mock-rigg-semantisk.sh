#!/usr/bin/env bash
# mock-rigg-semantisk.sh — spela SPELET. Publicerar semantiska cues (lager 1) som rigg.js
# kommer skicka. Kräver att hjarna-stubb.py körs (den översätter → firmware).
#
#   BROKER=localhost ./tools/mock-rigg-semantisk.sh            # interaktiv panel
#   ./tools/mock-rigg-semantisk.sh oh 15                        # en cue
#   ./tools/mock-rigg-semantisk.sh ceremoni                     # hela award-sekvensen
#
# Kommandon:
#   oh <1-100>                     öns hälsa (ger ett av 5 lägen)
#   attract | runda | awards | slut
#   wave on|off                    tombola
#   countdown on|off               nedräkning (vit puls)
#   award <sabotor|foretagare|eldsjal> <aker|skog|tundra|stad>
#   gm-master on|off               GM tar över / släpper
#   gm-grona on|off                GM: alla sidor gröna
#   gm-spot <1-4> on|off           GM: tänd spot
#   gm-ljud <id>                   GM: spela ljud
#   spel                           ramp genom alla 5 öhälso-lägen
#   ceremoni                       wave + tre awards i följd (som rigg.js, Option A)

BROKER="${BROKER:-localhost}"; PORT="${PORT:-1883}"
P() { mosquitto_pub -h "$BROKER" -p "$PORT" -t "$1" -m "$2"; echo "  $1 ← $2"; }

run() {
  case "$1" in
    oh)        P ecoloco/rigg/ohalsa "${2:-50}" ;;
    attract|runda|awards|slut) P ecoloco/rigg/scen "$1" ;;
    wave)      P ecoloco/rigg/wave      "$([ "$2" = off ] && echo 0 || echo 1)" ;;
    countdown) P ecoloco/rigg/countdown "$([ "$2" = off ] && echo 0 || echo 1)" ;;
    award)     P ecoloco/rigg/award "{\"typ\":\"${2:-sabotor}\",\"lag\":\"${3:-stad}\"}" ;;
    gm-master) P ecoloco/rigg/gm/master   "$([ "$2" = off ] && echo 0 || echo 1)" ;;
    gm-grona)  P ecoloco/rigg/gm/alla_grona "$([ "$2" = off ] && echo 0 || echo 1)" ;;
    gm-spot)   P "ecoloco/rigg/gm/spot/${2:-1}" "$([ "$3" = off ] && echo 0 || echo 1)" ;;
    gm-ljud)   P ecoloco/rigg/gm/ljud "${2:-ding}" ;;
    spel)      for v in 90 70 50 30 10 45; do echo "== öhälsa $v =="; P ecoloco/rigg/ohalsa $v; sleep 2; done ;;
    ceremoni)
      P ecoloco/rigg/scen awards
      P ecoloco/rigg/wave 1;  sleep 3; P ecoloco/rigg/wave 0
      P ecoloco/rigg/award '{"typ":"sabotor","lag":"stad"}';    sleep 4
      P ecoloco/rigg/award '{"typ":"foretagare","lag":"aker"}'; sleep 4
      P ecoloco/rigg/award '{"typ":"eldsjal","lag":"skog"}';    sleep 4
      P ecoloco/rigg/scen runda; P ecoloco/rigg/ohalsa 55 ;;
    *) echo "Okänt: '$1'. Se kommandolistan högst upp i scriptet." ;;
  esac
}

if [ -z "$1" ]; then
  echo "=== SPEL-MOCK (semantik, broker: $BROKER) — kräver att hjarna-stubb.py körs ==="
  echo "Ex: oh 15 | runda | wave on | countdown on | award eldsjal skog | ceremoni | spel | gm-grona on | q"
  while true; do
    read -rp "spel> " a b c || break
    [ "$a" = "q" ] && break
    [ -z "$a" ] && continue
    run "$a" "$b" "$c"
  done
  exit 0
fi
run "$@"
