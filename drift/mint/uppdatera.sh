#!/usr/bin/env bash
# uppdatera.sh — hämta senaste versionen och starta om stationen.
# Mål för skrivbordsknappen "Uppdatera spelet" (körs i terminal så man ser förloppet).
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
cd "$REPO" || { echo "Hittar inte repot ($REPO)"; [ -t 1 ] && read -rp "Enter..."; exit 1; }
pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; }

echo "== Hämtar senaste (git pull) =="
if ! git pull; then
  echo; echo "git pull misslyckades (se ovan). Ofta pga lokala ändringar på NUC:en."
  pause; exit 1
fi

# node_modules är incheckat i repot → normalt inget npm-steg. Kör bara om deps ändrats.
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "package-lock.json\|package.json"; then
  echo; echo "== Beroenden ändrade — npm install =="
  npm install || { echo "npm install misslyckades"; pause; exit 1; }
fi

echo; echo "== Startar om stationen =="
systemctl --user restart eco-loco-server 2>/dev/null && echo "  ✓ server omstartad"
systemctl --user list-unit-files 2>/dev/null | grep -q eco-loco-hjarna && \
  systemctl --user restart eco-loco-hjarna && echo "  ✓ hjärna omstartad"
pkill -f chromium 2>/dev/null || pkill -f chrome 2>/dev/null || true   # watchdogen laddar om kiosken

echo; echo "✔ Klart! Eco Loco är uppdaterad och omstartad."
pause
