#!/usr/bin/env bash
# starta-om-allt.sh — startar om ALLT som finns på denna dator: spelserver + rigg-hjärna,
# och laddar om ev. skärm. Ett klick för "rent bord". Inget lösenord (--user-tjänster).
set -u
pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; }
echo "== Startar om allt som finns här =="
for U in eco-loco-server eco-loco-hjarna; do
  if systemctl --user list-unit-files 2>/dev/null | grep -q "$U"; then
    systemctl --user restart "$U" && echo "  ✓ $U omstartad" || echo "  ! $U kunde inte startas om"
  fi
done
pkill -f chromium 2>/dev/null || pkill -f chrome 2>/dev/null || true   # ladda om ev. kiosk/skärm
echo; echo "✔ Klart — rent bord. Skärmar återansluter själva och hamnar i lobbyn."
pause
