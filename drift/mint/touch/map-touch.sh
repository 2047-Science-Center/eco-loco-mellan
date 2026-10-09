#!/usr/bin/env bash
# Mappa touchpaneler till rätt skärm via deras fysiska USB-port (ID_PATH).
# Binds till porten, inte till xinput-id → håller över omstart även för
# IDENTISKA paneler (samma namn, där id kan byta plats mellan boots).
#
# Kräver X11 (Wayland stöder inte map-to-output).
#
# Användning (par av ID_PATH + skärmnamn):
#   map-touch.sh <ID_PATH> <OUTPUT> [<ID_PATH> <OUTPUT> ...]
# Ex:
#   map-touch.sh pci-0000:00:14.0-usb-0:3:1.0 DP-1 pci-0000:00:14.0-usb-0:1:1.0 DP-3
#
# ID_PATH hittas så här (för varje touch-enhet i `xinput list`):
#   node=$(xinput list-props <id> | sed -n 's/.*Device Node[^"]*"\([^"]*\)".*/\1/p')
#   udevadm info -q property "$node" | grep ID_PATH
#
# Miljövariabler:
#   MAP_TOUCH_DELAY=5   vänta N sek innan första mappning (för autostart)
#   MAP_TOUCH_WATCH=5   SJÄLVLÄKANDE: applicera om var N:e sek för alltid, så
#                       mappningen läker sig själv efter inloggnings-reset,
#                       display-hotplug eller strömblink. Rekommenderas för drift.

# Spara panel-paren (argumenten) så watch-läget kan applicera om dem.
ARGS=("$@")

map_one() {
  want="$1"
  output="$2"
  for id in $(xinput list --id-only 2>/dev/null); do
    node=$(xinput list-props "$id" 2>/dev/null | sed -n 's/.*Device Node[^"]*"\([^"]*\)".*/\1/p')
    [ -n "$node" ] || continue
    path=$(udevadm info -q property "$node" 2>/dev/null | sed -n 's/^ID_PATH=//p')
    if [ "$path" = "$want" ]; then
      if xinput map-to-output "$id" "$output"; then
        [ "${QUIET:-0}" = 1 ] || echo "map-touch: $want -> $output (id $id)"
      fi
      return 0
    fi
  done
  [ "${QUIET:-0}" = 1 ] || echo "map-touch: hittade ingen enhet på USB-port $want" >&2
}

apply_all() {
  set -- "${ARGS[@]}"
  while [ "$#" -ge 2 ]; do
    map_one "$1" "$2"
    shift 2
  done
}

[ "${MAP_TOUCH_DELAY:-0}" -gt 0 ] 2>/dev/null && sleep "${MAP_TOUCH_DELAY}"

if [ "${MAP_TOUCH_WATCH:-0}" -gt 0 ] 2>/dev/null; then
  # Självläkande: håll mappningen aktiv. Tyst efter första varvet.
  apply_all
  QUIET=1
  while true; do
    sleep "${MAP_TOUCH_WATCH}"
    apply_all >/dev/null 2>&1
  done
else
  apply_all
fi
