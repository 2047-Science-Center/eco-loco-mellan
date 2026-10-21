#!/usr/bin/env bash
# testa-riggen.sh — fyrar en test-cue: hela LED-listen GRÖN i 2 s, återställer sen till neutralt.
# Ser du grönt lever kedjan broker→hjärna→ESP. Mål för skrivbordsknappen "Testa riggen".
set -u
pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; }
# Broker = samma som hjärnan pekar på (annars localhost).
B="$(systemctl --user show eco-loco-hjarna -p Environment 2>/dev/null | grep -oE 'BROKER=[^ ]+' | cut -d= -f2)"
B="${B:-localhost}"
command -v mosquitto_pub >/dev/null 2>&1 || { echo "mosquitto-clients saknas här (kör drift/mint/installera-rigg.sh)."; pause; exit 1; }
echo "== Testar riggen mot broker: $B =="
mosquitto_pub -h "$B" -t ecoloco/rigg/gm/alla_grona -m 1 && echo "  ✓ skickade 'alla gröna' — listen ska bli GRÖN nu"
sleep 2
mosquitto_pub -h "$B" -t ecoloco/rigg/ohalsa -m 50 2>/dev/null   # återställ neutral grundlook
echo "  (återställt till neutralt läge)"
echo
echo "Blev listen grön? → kedjan funkar. Mörkt? → kör HÄLSOKOLL, och kolla att ESP:n är på + ansluten."
pause
