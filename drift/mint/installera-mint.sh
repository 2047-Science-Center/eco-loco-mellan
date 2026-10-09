#!/usr/bin/env bash
# installera-mint.sh — sätter upp en Linux MINT-NUC för Eco Loco (Mellan).
# Mint-anpassad variant av ../installera-nuc.sh: chromium via apt (ej snap),
# servern som --user-tjänst (så skrivbordsknapparna kan starta om utan lösenord),
# skärmsläckare av via xset (robust på Cinnamon/X11).
#
# Körs som VANLIG användare (skriptet sudo:ar själv där det behövs):
#   bash drift/mint/installera-mint.sh server                               # denna NUC kör spelservern
#   bash drift/mint/installera-mint.sh kiosk http://172.20.1.10:8765 aker   # kioskskärm för ett lag
#   bash drift/mint/installera-mint.sh kiosk http://172.20.1.10:8765        # kiosk utan förvalt lag (lobby)
#
# En NUC kan vara både server och kiosk: kör båda kommandona på den.
# Lag-id: aker | skog | tundra | stad
# För att spelet ska TRIGGA riggen: kör även  drift/mint/installera-rigg.sh  på server-NUC:en.

set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROLL="${1:-}"

behover_node() {
  command -v node >/dev/null 2>&1 || return 0
  [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 18 ] && return 0
  return 1
}

if [ "$ROLL" = "server" ]; then
  if behover_node; then
    echo "▸ Installerar Node.js 22 LTS (Mints apt-Node är för gammal)…"
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  echo "▸ Skapar --user-tjänst eco-loco-server (startar vid inloggning, om vid krasch)…"
  mkdir -p "$HOME/.config/systemd/user"
  # RIGG_BROKER = dit spelet publicerar rigg-cues. localhost om mosquitto kör på samma NUC
  # (se installera-rigg.sh). Peka om till broker-lådans IP i final rigg om brokern bor någon annanstans.
  cat > "$HOME/.config/systemd/user/eco-loco-server.service" <<EOF
[Unit]
Description=Eco Loco spelserver
After=network-online.target

[Service]
WorkingDirectory=${REPO_DIR}
ExecStart=$(command -v node) ${REPO_DIR}/server/server.js
Environment=RIGG_BROKER=localhost
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now eco-loco-server
  # Låt --user-tjänsten leva även utan aktiv grafisk session (överlever boot innan inloggning).
  sudo loginctl enable-linger "$USER" 2>/dev/null || true
  sleep 1
  systemctl --user --no-pager status eco-loco-server | head -5
  echo
  echo "✔ Servern kör och startar om automatiskt vid boot/krasch."
  echo "  Logg:  journalctl --user -u eco-loco-server -f"
  echo "  Denna NUC:s IP:  $(hostname -I | awk '{print $1}')"
  echo
  echo "  Nästa steg om riggen ska styras härifrån:  bash drift/mint/installera-rigg.sh"
  echo "  Skrivbordsknappar (Starta om / Uppdatera):  bash drift/mint/installera-knappar.sh"

elif [ "$ROLL" = "kiosk" ]; then
  SERVER_URL="${2:?Ange serverns URL, t.ex. http://172.20.1.10:8765}"
  LAG="${3:-}"
  SPEL_URL="${SERVER_URL}/spel.html?online=1${LAG:+&lag=${LAG}}"

  echo "▸ Installerar Chromium (apt) + unclutter (dold muspekare)…"
  sudo apt-get update -qq
  # Mint: chromium finns i apt. Fallback till chromium-browser om paketnamnet skiljer.
  sudo apt-get install -y unclutter || true
  sudo apt-get install -y chromium 2>/dev/null || sudo apt-get install -y chromium-browser
  CHROMIUM="$(command -v chromium || command -v chromium-browser)"

  echo "▸ Skriver kiosk-skript (startas MANUELLT från skrivbordsikon — INGEN autostart)…"
  mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications"
  cat > "$HOME/.local/bin/eco-loco-kiosk.sh" <<EOF
#!/usr/bin/env bash
# Eco Loco kiosk — genererad av installera-mint.sh. Startas från skrivbordsikonen.
# Skärmsläckare/strömsparläge av (X11, robust på Mint/Cinnamon):
xset s off     2>/dev/null || true
xset -dpms     2>/dev/null || true
xset s noblank 2>/dev/null || true
unclutter -idle 1 & UNC=\$!
${CHROMIUM} --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --autoplay-policy=no-user-gesture-required --check-for-update-interval=31536000 \\
  --app="${SPEL_URL}"
kill \$UNC 2>/dev/null || true
# Körs EN gång. Stänger du fönstret (Alt+F4) är du tillbaka på skrivbordet. Ingen watchdog-loop.
EOF
  chmod +x "$HOME/.local/bin/eco-loco-kiosk.sh"

  # Skrivbordsikon "Starta Eco Loco" (ingen autostart — du öppnar själv från skrivbordet).
  apps="$HOME/.local/share/applications"
  desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
  tmp="$(mktemp)"
  cat > "$tmp" <<EOF
[Desktop Entry]
Type=Application
Name=Starta Eco Loco${LAG:+ (${LAG})}
Comment=Öppna spelet i helskärm
Exec=bash "$HOME/.local/bin/eco-loco-kiosk.sh"
Icon=input-gaming
Terminal=false
Categories=Game;
StartupNotify=false
EOF
  install -m 0755 "$tmp" "$apps/eco-loco-starta.desktop"
  if [ -d "$desktop_dir" ]; then
    install -m 0755 "$tmp" "$desktop_dir/eco-loco-starta.desktop"
    gio set "$desktop_dir/eco-loco-starta.desktop" metadata::trusted true 2>/dev/null || true
  fi
  rm -f "$tmp"
  update-desktop-database "$apps" 2>/dev/null || true

  echo
  echo "✔ Kiosk mot: ${SPEL_URL}"
  echo "  INGEN autostart. Du bootar till skrivbordet och öppnar via ikonen 'Starta Eco Loco'."
  echo "  Stänger du fönstret (Alt+F4) → tillbaka på skrivbordet."
  echo "  (Valfritt) autologin TILL SKRIVBORDET för obevakad boot:"
  echo "  Meny → Inloggningsfönster → fliken Användare → Automatisk inloggning PÅ."

else
  echo "Användning:"
  echo "  bash drift/mint/installera-mint.sh server"
  echo "  bash drift/mint/installera-mint.sh kiosk http://<server-ip>:8765 [aker|skog|tundra|stad]"
  exit 1
fi
