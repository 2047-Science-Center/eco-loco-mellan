#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  install-base.sh — Baspaket för X&Y-touchstationer på Linux Mint.
#  Gemensamt för Förhandlingen OCH Minnestest (och kommande stationer).
#
#  Gör tre saker:
#    1. Installerar det X11 behöver för touch  (xinput, libinput, notify).
#    2. Lägger en självläkande touch-mappning i autostart  (touch-watch).
#    3. Lägger en skrivbordsknapp "Reset touch".
#
#  Kör som vanlig användare (den frågar själv om sudo för apt-steget):
#      bash install-base.sh
#
#  OBS: fyll i touch.env FÖRST (kör ./find-touch.sh). Går även att köra
#  install-base.sh först och fylla i touch.env efteråt — knapp + autostart
#  börjar funka så fort touch.env är ifylld.
# ─────────────────────────────────────────────────────────────────────────
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== 1/3  Paket som X11-touch behöver =="
if command -v apt >/dev/null 2>&1; then
  if sudo apt update && sudo apt install -y \
        xserver-xorg-input-libinput xinput libnotify-bin x11-xserver-utils; then
    echo "  ✓ paket installerade"
  else
    echo "  ! apt misslyckades — kolla nät/DNS. Du kan köra om detta steg senare." >&2
  fi
else
  echo "  ! hittar inte apt (inte Debian/Mint?) — hoppar över paketsteget." >&2
fi

echo
echo "== 2/3  Gör skripten körbara + skapa touch.env =="
chmod +x "$HERE"/*.sh 2>/dev/null || true
if [ ! -f "$HERE/touch.env" ]; then
  cp "$HERE/touch.env.example" "$HERE/touch.env"
  echo "  ✓ skapade touch.env (MÅSTE fyllas i — kör ./find-touch.sh)"
else
  echo "  • touch.env finns redan — rör den inte"
fi

echo
echo "== 3/3  Autostart (självläkande touch) + skrivbordsknapp 'Reset touch' =="

apps="$HOME/.local/share/applications"
autostart="$HOME/.config/autostart"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
mkdir -p "$apps" "$autostart"

# --- Autostart: touch-watch ---
tmp="$(mktemp)"
sed "s|@EXEC@|bash \"$HERE/touch-watch.sh\"|g" "$HERE/touch-watch.desktop" > "$tmp"
install -m 0644 "$tmp" "$autostart/xy-touch-watch.desktop"
echo "  ✓ autostart: $autostart/xy-touch-watch.desktop"

# --- Skrivbordsknapp: Reset touch ---
sed "s|@EXEC@|bash \"$HERE/reset-touch.sh\"|g" "$HERE/reset-touch.desktop" > "$tmp"
install -m 0755 "$tmp" "$apps/xy-reset-touch.desktop"
if [ -d "$desktop_dir" ]; then
  install -m 0755 "$tmp" "$desktop_dir/xy-reset-touch.desktop"
  gio set "$desktop_dir/xy-reset-touch.desktop" metadata::trusted true 2>/dev/null || true
  echo "  ✓ skrivbordsknapp: $desktop_dir/xy-reset-touch.desktop"
else
  echo "  ✓ appmeny-knapp (inget skrivbord hittat): $apps/xy-reset-touch.desktop"
fi
rm -f "$tmp"
update-desktop-database "$apps" 2>/dev/null || true

echo
echo "──────────────────────────────────────────────────────────────────"
echo " KLART. Nästa steg:"
echo "   1. Koppla in skärmar + touchpaneler."
echo "   2. Kör:  ./find-touch.sh    och klistra in raderna i touch.env"
echo "   3. Kör:  ./reset-touch.sh   (eller dubbelklicka 'Reset touch')"
echo "   4. Logga ut/in en gång → touch-watch håller mappningen rätt automatiskt."
echo
echo " Station-specifik start (Starta spelet / Uppdatera) ligger kvar i"
echo " respektive stations deploy/nuc/ — detta paket sköter bara touch + reset."
echo "──────────────────────────────────────────────────────────────────"
