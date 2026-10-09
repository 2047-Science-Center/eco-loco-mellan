#!/usr/bin/env bash
# installera-knappar.sh — lägger skrivbordsknappar så stationen sköts UTAN terminal:
#   • "Starta om spelet"  -> starta-om.sh   (nollställer, inget lösenord)
#   • "Uppdatera spelet"  -> uppdatera.sh   (git pull + omstart, körs i terminal)
# "Reset touch"-knappen kommer från mint-touchstation-bas (install-base.sh), om touch används.
#
#   bash drift/mint/installera-knappar.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$HERE"/*.sh

apps="$HOME/.local/share/applications"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
mkdir -p "$apps"

lagg_knapp() {  # <desktop-mall> <målskript>
  local mall="$HERE/$1" skript="$HERE/$2" namn="$1"
  local tmp; tmp="$(mktemp)"
  sed "s|@EXEC@|bash \"$skript\"|g" "$mall" > "$tmp"
  install -m 0755 "$tmp" "$apps/$namn"                       # appmenyn
  if [ -d "$desktop_dir" ]; then
    install -m 0755 "$tmp" "$desktop_dir/$namn"              # skrivbordet
    gio set "$desktop_dir/$namn" metadata::trusted true 2>/dev/null || true  # Cinnamon: tillåt dubbelklick
  fi
  rm -f "$tmp"
  echo "  ✓ $namn"
}

echo "== Lägger skrivbordsknappar =="
lagg_knapp "eco-loco-starta-om.desktop" "starta-om.sh"
lagg_knapp "eco-loco-uppdatera.desktop" "uppdatera.sh"
update-desktop-database "$apps" 2>/dev/null || true

echo
echo "✔ Klart. Knapparna 'Starta om spelet' och 'Uppdatera spelet' finns på skrivbordet + i appmenyn."
echo "  Första dubbelklicket på Cinnamon kan fråga 'Trust & Launch' — svara ja en gång."
echo "  Touch-station? Kör även mint-touchstation-bas/install-base.sh för 'Reset touch'-knappen."
