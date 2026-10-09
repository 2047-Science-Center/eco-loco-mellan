#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  find-touch.sh — Hitta touchpanelernas USB-port (ID_PATH) och dina skärmar,
#  och skriv ut färdiga rader att klistra in i touch.env.
#
#  Kör med skärmarna OCH touchpanelerna inkopplade:
#      ./find-touch.sh
#  Rör INGET på maskinen — den bara läser och skriver ut.
#  Kräver X11 (Wayland stöder inte touch→skärm-mappning).
# ─────────────────────────────────────────────────────────────────────────
set -u

if ! command -v xinput >/dev/null 2>&1; then
  echo "xinput saknas. Kör install-base.sh först (installerar xinput + libinput)." >&2
  exit 1
fi

echo "=================================================================="
echo " SKÄRMAR  (xrandr --listmonitors)"
echo "=================================================================="
if command -v xrandr >/dev/null 2>&1; then
  # Skriv ut skärmnamn + var de sitter, så vänster/höger går att avgöra.
  xrandr --listmonitors | sed '1d' | while read -r idx name rest; do
    geom="$(echo "$rest" | grep -oE '[0-9]+/[0-9]+x[0-9]+/[0-9]+\+[0-9]+\+[0-9]+' | head -1)"
    pos="$(echo "$geom" | grep -oE '\+[0-9]+\+[0-9]+$')"
    printf "  %-10s  position %s\n" "${name#+}" "${pos:-?}"
  done
  echo
  echo "  (position +0+0 = längst till vänster; större +X = längre åt höger)"
else
  echo "  xrandr saknas."
fi

echo
echo "=================================================================="
echo " TOUCHPANELER  (namn + fysisk USB-port = ID_PATH)"
echo "=================================================================="
found=0
for id in $(xinput list --id-only 2>/dev/null); do
  name="$(xinput list --name-only "$id" 2>/dev/null)"
  # Bara pekdon/touch — hoppa över tangentbord, styrplattor, virtuella enheter.
  echo "$name" | grep -qiE 'touch|pen|panel|cooltouch|hi-tech|weida' || continue
  node="$(xinput list-props "$id" 2>/dev/null | sed -n 's/.*Device Node[^"]*"\([^"]*\)".*/\1/p')"
  [ -n "$node" ] || continue
  path="$(udevadm info -q property "$node" 2>/dev/null | sed -n 's/^ID_PATH=//p')"
  [ -n "$path" ] || continue
  found=1
  printf "  panel: %-30s  (xinput id %s)\n" "$name" "$id"
  printf "    ID_PATH = %s\n\n" "$path"
done

if [ "$found" = 0 ]; then
  echo "  Hittade ingen touchpanel. Är de inkopplade? Sitter du i en X11-session?"
  echo "  (Kolla: echo \$XDG_SESSION_TYPE  → ska säga 'x11', inte 'wayland'.)"
  exit 1
fi

echo "=================================================================="
echo " KLISTRA IN I touch.env"
echo "=================================================================="
echo "  Para ihop varje ID_PATH ovan med rätt SKÄRM (testa vänster/höger),"
echo "  t.ex.:"
echo
echo '    TOUCH_PAIRS="'
echo '    <ID_PATH-för-vänster-panel>=DP-1'
echo '    <ID_PATH-för-höger-panel>=DP-3'
echo '    "'
echo
echo "  Vet du inte vilken panel som är vilken? Sätt en gissning, kör"
echo "  ./reset-touch.sh, tryck på en skärm — hamnar pekaren fel, byt plats."
