#!/usr/bin/env bash
# starta-om.sh — nollställ spelet: starta om servern (och hjärnan om den finns) + ladda om kiosken.
# Mål för skrivbordsknappen "Starta om spelet". Kräver inget lösenord (--user-tjänster).
set -u
pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; }

echo "== Startar om spelservern =="
systemctl --user restart eco-loco-server && echo "  ✓ eco-loco-server omstartad" || echo "  ! kunde inte starta om servern"

if systemctl --user list-unit-files 2>/dev/null | grep -q eco-loco-hjarna; then
  echo "== Startar om rigg-hjärnan =="
  systemctl --user restart eco-loco-hjarna && echo "  ✓ eco-loco-hjarna omstartad"
fi

echo "== Laddar om kiosk-skärmen =="
pkill -f chromium 2>/dev/null || pkill -f chrome 2>/dev/null || true
# watchdogen i eco-loco-kiosk.sh startar om webbläsaren automatiskt inom ~2 s.

echo; echo "✔ Klart — rent bord. Skärmarna återansluter själva och hamnar i lobbyn."
pause
