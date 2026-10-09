#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  reset-touch.sh — Mappa om touchpanelerna till rätt skärm EN gång.
#  Detta är målet för skrivbordsknappen "Reset touch".
#  Läser panel-paren ur touch.env. Kräver X11.
# ─────────────────────────────────────────────────────────────────────────
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/_lib.sh"

notify() {  # skrivbordsnotis om möjligt, annars tyst
  command -v notify-send >/dev/null 2>&1 && notify-send -t 2500 "Touch" "$1" 2>/dev/null || true
}

if ! load_touch_env "$HERE"; then
  notify "Fel: touch.env saknas/ofylld"
  [ -t 1 ] && read -rp "Enter för att stänga..."
  exit 1
fi

# En körning (inget watch-läge här — knappen ska vara snabb).
MAP_TOUCH_WATCH=0 MAP_TOUCH_DELAY=0 bash "$HERE/map-touch.sh" "${MAP_ARGS[@]}"
rc=$?

if [ "$rc" -eq 0 ]; then
  notify "Touch ommappad ✓"
  echo "Touch ommappad."
else
  notify "Touch-mappning misslyckades"
  echo "Något gick fel (se ovan)." >&2
fi
[ -t 1 ] && read -rp "Enter för att stänga..."
exit "$rc"
