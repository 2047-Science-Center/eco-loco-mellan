#!/usr/bin/env bash
# installera-nuc.sh — sätter upp en Ubuntu-NUC för Eco Loco (Mellan).
# Körs som VANLIG användare (skriptet sudo:ar själv där det behövs).
#
#   bash drift/installera-nuc.sh server                          # denna NUC kör spelservern
#   bash drift/installera-nuc.sh kiosk http://172.20.1.10:8765 aker   # kioskskärm för ett lag
#   bash drift/installera-nuc.sh kiosk http://172.20.1.10:8765        # kiosk utan förvalt lag (lobby)
#
# En NUC kan vara både server och kiosk: kör båda kommandona på den.
# Lag-id: aker | skog | tundra | stad

set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROLL="${1:-}"

behover_node() {
  command -v node >/dev/null 2>&1 || return 0
  [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 18 ] && return 0
  return 1
}

if [ "$ROLL" = "server" ]; then
  if behover_node; then
    echo "▸ Installerar Node.js 22 LTS (apt:ens version är för gammal)…"
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  echo "▸ Skapar systemd-tjänst eco-loco-server (autostart + omstart vid krasch)…"
  sudo tee /etc/systemd/system/eco-loco-server.service >/dev/null <<EOF
[Unit]
Description=Eco Loco spelserver
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=${REPO_DIR}
ExecStart=$(command -v node) ${REPO_DIR}/server/server.js
Restart=always
RestartSec=3
User=${USER}

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now eco-loco-server
  sleep 1
  systemctl --no-pager status eco-loco-server | head -5
  echo
  echo "✔ Servern kör och startar om automatiskt vid boot/krasch."
  echo "  Logg:  journalctl -u eco-loco-server -f"
  echo "  Denna NUC:s IP:  $(hostname -I | awk '{print $1}')"

elif [ "$ROLL" = "kiosk" ]; then
  SERVER_URL="${2:?Ange serverns URL, t.ex. http://172.20.1.10:8765}"
  LAG="${3:-}"
  SPEL_URL="${SERVER_URL}/spel.html?online=1${LAG:+&lag=${LAG}}"

  echo "▸ Installerar Chromium + unclutter (dold muspekare)…"
  sudo apt-get update -qq
  sudo apt-get install -y unclutter
  command -v chromium >/dev/null 2>&1 || command -v chromium-browser >/dev/null 2>&1 || sudo snap install chromium
  CHROMIUM="$(command -v chromium || command -v chromium-browser)"

  echo "▸ Skriver kiosk-skript med watchdog (startar om webbläsaren om den dör)…"
  mkdir -p "$HOME/.local/bin" "$HOME/.config/autostart"
  cat > "$HOME/.local/bin/eco-loco-kiosk.sh" <<EOF
#!/usr/bin/env bash
# Eco Loco kiosk — genererad av installera-nuc.sh
unclutter -idle 1 &
sleep 3   # låt nätet/servern hinna upp vid boot
while true; do
  ${CHROMIUM} --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --autoplay-policy=no-user-gesture-required --check-for-update-interval=31536000 \\
    "${SPEL_URL}"
  sleep 2   # kraschade/stängdes → starta om
done
EOF
  chmod +x "$HOME/.local/bin/eco-loco-kiosk.sh"

  cat > "$HOME/.config/autostart/eco-loco-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Eco Loco Kiosk
Exec=$HOME/.local/bin/eco-loco-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

  echo "▸ Stänger av skärmsläckare/lås…"
  gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
  gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || true

  echo
  echo "✔ Kiosk mot: ${SPEL_URL}"
  echo "  Startar automatiskt vid inloggning. Slå på AUTOLOGIN för användaren ${USER}:"
  echo "  Inställningar → Användare → Automatisk inloggning PÅ  (eller: sudo ändra /etc/gdm3/custom.conf)"
  echo "  Testa direkt utan omstart:  ~/.local/bin/eco-loco-kiosk.sh"
  echo "  Ta dig ur kioskläget:  Alt+F4 (watchdogen startar om den — döda med: pkill -f eco-loco-kiosk)"

else
  echo "Användning:"
  echo "  bash drift/installera-nuc.sh server"
  echo "  bash drift/installera-nuc.sh kiosk http://<server-ip>:8765 [aker|skog|tundra|stad]"
  exit 1
fi
