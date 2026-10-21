#!/usr/bin/env bash
# starta-om-riggen.sh — startar om rigg-dirigenten (hjärnan). Vanligast när LED:en slutat lysa
# men spelet funkar. Inget lösenord (--user-tjänst). Mål för skrivbordsknappen "Starta om riggen".
set -u
pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; }
if systemctl --user list-unit-files 2>/dev/null | grep -q eco-loco-hjarna; then
  echo "== Startar om rigg-hjärnan =="
  systemctl --user restart eco-loco-hjarna && echo "  ✓ eco-loco-hjarna omstartad" || echo "  ! kunde inte starta om hjärnan"
else
  echo "Ingen rigg-hjärna på denna dator — den kör bara på navet (spelledar-NUC:en)."
fi
echo; pause
