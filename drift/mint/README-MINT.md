# Eco Loco på Linux Mint — startkit

Allt för att få en Mint-NUC att boota rakt in i Eco Loco, styra förstärkningsriggen,
och skötas utan terminal (skrivbordsknappar för omstart/uppdatering).

Bygger på samma beprövade mönster som Förhandlingen/Minnestest. **Kräver X11** (Mint
standard — `echo $XDG_SESSION_TYPE` ska säga `x11`). Internet behövs bara vid installation.

---

## 0. Ladda ner spelet

```bash
sudo apt-get install -y git
cd ~
git clone https://github.com/2047-Science-Center/eco-loco-mellan.git
cd eco-loco-mellan
```

Allt följer med (även `node_modules` + assets är incheckade). Endast per-maskin-filer
saknas och skapas lokalt (firmware `config.h`, touch `touch.env`).

---

## 1. Server-NUC:en (kör spelet)

```bash
bash drift/mint/installera-mint.sh server
```

- Installerar Node 22 vid behov, skapar **--user-tjänsten `eco-loco-server`** (autostart
  vid inloggning, omstart vid krasch), skriver ut NUC:ens IP. **Anteckna IP:t** — kiosk­skärmarna pekar hit.
- `--user`-tjänst = skrivbordsknapparna kan starta om spelet **utan lösenord**.

## 2. Koppla riggen till spelet (på server-NUC:en)

Mot **2047-brokern** (rekommenderat — allt på en gemensam broker, ingen lokal):
```bash
bash drift/mint/installera-rigg.sh 192.168.0.23
```
…eller en **lokal, självständig broker** på denna NUC (utelämna IP:t):
```bash
bash drift/mint/installera-rigg.sh
```

Sätter upp kedjan **spel → broker → hjärna → ESP32** och riktar **både spelservern (`RIGG_BROKER`)
och hjärnan (`BROKER`) mot samma broker** (så de aldrig hamnar på olika → då renderas inget):
- `mosquitto-clients` + `mpg123` (riggljud) alltid; en lokal `mosquitto`-broker **bara** i localhost-läget.
- **--user-tjänsten `eco-loco-hjarna`** översätter semantiska cues → granulärt + ljud.

👉 **Sätt ESP32:ns `MQTT_BROKER` och Blocks-enheterna (EcolocoRigg/EcolocoSpel) till samma broker**
(IP:t skriptet skriver ut) och flasha om. Testa utan spel:
`BROKER=192.168.0.23 bash tools/mock-rigg-semantisk.sh kris`.

> Hoppar du över steg 2 funkar spelet ändå — riggen styrs bara inte.
> **Viktigt:** server, hjärna, ESP och Blocks måste alla peka på **samma** broker, annars renderas inget.

## 3. Varje kioskskärm (en per bänk)

Även på server-NUC:en om den också ska visa en bänk:

```bash
bash drift/mint/installera-mint.sh kiosk http://<server-ip>:8765 aker
```

Lag-id: `aker` | `skog` | `tundra` | `stad` — utelämna för lobbyn (välj lag på skärmen).
Installerar Chromium (apt) + unclutter, skärmsläckare av, och lägger en **skrivbordsikon
"Starta Eco Loco"**. **Ingen autostart** — du bootar till skrivbordet och öppnar spelet
själv via ikonen. Stänger du fönstret (Alt+F4) är du tillbaka på skrivbordet.

## 4. Skrivbordsknappar (skötsel utan terminal)

```bash
bash drift/mint/installera-knappar.sh
```

Lägger **"Starta om spelet"** (nollställ, inget lösenord) och **"Uppdatera spelet"**
(git pull + omstart, körs i terminal) på skrivbordet + i appmenyn. Första dubbelklicket på
Cinnamon kan fråga *Trust & Launch* — svara ja en gång.

## 5. Touch (om bänkarna är touchskärmar)

Touch hanteras av touch-paketet (self-healing mappning + **"Reset touch"-knapp**). Det
följer med repot i **`drift/mint/touch/`** (kopia av det delade `mint-touchstation-bas`):

```bash
cd drift/mint/touch
bash install-base.sh     # paket + autostart (self-healing) + "Reset touch"-knapp på skrivbordet
./find-touch.sh          # skriver ut panel-ID + skärmar
nano touch.env           # klistra in raderna find-touch.sh gav (per maskin, git-ignoreras)
./reset-touch.sh         # applicera nu (eller dubbelklicka "Reset touch")
```

> **En skärm** = en rad i `TOUCH_PAIRS` (se `touch.env.example`). Mappas ofta rätt ändå —
> paketet behövs främst när touch hamnar på fel skärm. Logga ut/in en gång så startar
> den självläkande mappningen automatiskt.

## 6. Autologin (valfritt)

Vill du att NUC:en bootar obevakad **till skrivbordet**: **Meny → Inloggningsfönster →
Användare → Automatisk inloggning PÅ**. Servern + riggen (steg 1–2) startar ändå automatiskt
vid inloggning — bara själva spelfönstret öppnar du via **ikonen "Starta Eco Loco"**.

---

## Vardagskommandon

| Vad | Hur |
|---|---|
| Starta om / nollställ | Skrivbordsknappen **Starta om spelet** (eller `systemctl --user restart eco-loco-server`) |
| Uppdatera | Skrivbordsknappen **Uppdatera spelet** (eller `bash drift/mint/uppdatera.sh`) |
| Serverlogg | `journalctl --user -u eco-loco-server -f` |
| Hjärn-/rigglogg | `journalctl --user -u eco-loco-hjarna -f` |
| Broker-logg | `journalctl -u mosquitto -f` |
| Öppna spelet | Skrivbordsikonen **Starta Eco Loco** (eller `~/.local/bin/eco-loco-kiosk.sh`) |
| Stäng spelet | `Alt+F4` → tillbaka på skrivbordet |

---

## LED-riggens strömförsörjning i final (VIKTIGT)

ESP32:n drivs av sin USB/5V. **LED-stripen ska INTE matas från ESP:n/USB i final** — en
WS2812 drar ~60 mA/diod på full vit (360 dioder ≈ 20 A). Final:

- **Egen 5V-nätdel** till stripen (dimensionera efter antal dioder), ström injicerad i
  båda ändar/hörn vid full kvadrat.
- **Gemensam GND** mellan nätdelen och ESP:n (annars ingen datareferens → mörkt/flimmer).
- **Data** från ESP `GPIO21` → stripens `DIN` (via 74AHCT125-nivåomvandlaren i brain-boxen,
  3,3→5 V, på full längd).
- `NUM_LEDS` + `SIDE_STARTS/ENDS` i firmware `config.h` sätts för hela riggen
  (`360` / `{0,90,180,270}` / `{89,179,269,359}`).

---

## Felsökning

| Symptom | Fix |
|---|---|
| Skärm: "Ingen kontakt med servern" | Servern nere/fel IP i kiosk-URL. `systemctl --user status eco-loco-server`, `ping <server-ip>`. |
| Riggen rör sig inte med spelet | Kör `eco-loco-hjarna`? (`journalctl --user -u eco-loco-hjarna -f`). ESP:ns `MQTT_BROKER` = NUC:ens IP? Broker uppe? |
| Skrivbordsikon grå/inaktiv (Cinnamon) | Högerklicka → *Tillåt start* / *Allow Launching*. Eller starta från **Menyn** (sök namnet) — menyposten är alltid betrodd. Orsak: `.desktop` på skrivbordet är "untrusted" tills den godkänns, och `gio set metadata::trusted` fäster bara om det körs i den grafiska sessionen (ej över SSH). |
| Touch på fel skärm | Byt skärmnamn i `mint-touchstation-bas/touch.env`, `./reset-touch.sh`. |
| Inget ljud från riggen | `sudo apt install mpg123`; ljudfiler i `assets/audio/rigg/`. |
| Node för gammal | Installeraren hämtar Node 22 från NodeSource automatiskt. |
