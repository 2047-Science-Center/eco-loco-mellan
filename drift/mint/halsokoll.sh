#!/usr/bin/env bash
# halsokoll.sh — visar om spelserver, rigg-hjärna och broker lever, + maskinens IP:er.
# Felsökningskitet som en knapp. Fungerar på vilken NUC som helst. Mål för "Hälsokoll".
set -u
pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; }
has() { systemctl --user list-unit-files 2>/dev/null | grep -q "$1"; }
st()  { systemctl --user is-active "$1" 2>/dev/null; }
echo "═════════ ECO LOCO — HÄLSOKOLL ═════════"
has eco-loco-server && echo "Spelserver:   $(st eco-loco-server)"  || echo "Spelserver:   (ej installerad här — körs bara på navet)"
has eco-loco-hjarna && echo "Rigg-hjärna:  $(st eco-loco-hjarna)"  || echo "Rigg-hjärna:  (ej installerad här — körs bara på navet)"
B="$(systemctl --user show eco-loco-hjarna -p Environment 2>/dev/null | grep -oE 'BROKER=[^ ]+' | cut -d= -f2)"; B="${B:-localhost}"
if command -v mosquitto_sub >/dev/null 2>&1; then
  if timeout 4 mosquitto_sub -h "$B" -t '$SYS/broker/version' -C 1 >/dev/null 2>&1; then
    echo "Broker ($B): svarar ✓"
  else
    echo "Broker ($B): INGET SVAR ✗  — kolla broker-IP / att brokern kör"
  fi
else
  echo "Broker:       (mosquitto-clients saknas här)"
fi
ss -ltn 2>/dev/null | grep -q ':8765' && echo "Server lyssnar på 8765:  ja ✓" || echo "Server lyssnar på 8765:  nej (normalt på en bänk)"
echo "Denna dators IP:er:  $(hostname -I)"
echo "════════════════════════════════════════"
echo "Allt grönt/✓ = kedjan är hel. Ett ✗ = börja felsöka där (se FELSÖKNINGSKIT i startkitet)."
pause
