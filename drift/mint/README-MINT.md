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

## 2. Låt spelet TRIGGA riggen (på server-NUC:en)

```bash
bash drift/mint/installera-rigg.sh
```

Sätter upp hela kedjan **spel → broker → hjärna → ESP32**:
- `mosquitto` (broker, lyssnar på hela LAN:et) + `mpg123` (riggljud).
- **--user-tjänsten `eco-loco-hjarna`** (översätter semantiska cues → granulärt + ljud).
- Spelservern har redan `RIGG_BROKER=localhost` → publicerar hit automatiskt.

👉 **Sätt sedan ESP32:ns `MQTT_BROKER` = den här NUC:ens IP** (i firmware `config.h`) och flasha om.
Då följer riggen spelet live. Testa utan spel: `BROKER=localhost bash tools/mock-rigg-semantisk.sh kris`.

> Hoppar du över steg 2 funkar spelet ändå — riggen styrs bara inte härifrån.
> I final kan brokern i stället bo på Blocks-servern; peka då `RIGG_BROKER` + ESP dit.

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

Touch hanteras av det delade paketet **`mint-touchstation-bas/`** (self-healing mappning +
"Reset touch"-knapp). Kopiera mappen till NUC:en och:

```bash
cd ~/mint-touchstation-bas
bash install-base.sh
./find-touch.sh          # skriver ut panel-ID + skärmar
nano touch.env           # klistra in raderna find-touch.sh gav
./reset-touch.sh
```

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
| Knappen "untrusted" på Cinnamon | Högerklicka → *Allow Launching* (eller kör `installera-knappar.sh` igen). |
| Touch på fel skärm | Byt skärmnamn i `mint-touchstation-bas/touch.env`, `./reset-touch.sh`. |
| Inget ljud från riggen | `sudo apt install mpg123`; ljudfiler i `assets/audio/rigg/`. |
| Node för gammal | Installeraren hämtar Node 22 från NodeSource automatiskt. |
