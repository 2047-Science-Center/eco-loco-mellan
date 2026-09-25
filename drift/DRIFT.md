# Drift på NUC (Ubuntu) — steg för steg

Spelet är OS-agnostiskt: en Node-process (servern, äger spelet) + Chromium i kioskläge
(en per bänk/skärm). Ubuntu LTS (22.04/24.04) är rekommenderad och testad väg.
Internet behövs bara för själva installationen — i drift räcker LAN
(`node_modules` är incheckat, alla assets ligger i repot).

## Topologi

En NUC är server (kan samtidigt vara kioskskärm), övriga är bara kiosk:

```
NUC 1: server + kiosk (lag aker)      NUC 2: kiosk (lag tundra)
             └────────── LAN (wifi eller kabel — samma sak) ─────────┘
```

I skarp rigg: statiska IP (172.20.1.x-planen finns), 4 bänkar, servern på central-lådan eller NUC 1.

## Installation (per NUC)

```bash
sudo apt-get install -y git
git clone <REPO-URL>
cd eco-loco-mellan
```

**Server-NUC:en:**
```bash
bash drift/installera-nuc.sh server
```
Installerar Node 22 om det behövs, skapar systemd-tjänsten `eco-loco-server`
(autostart vid boot, omstart inom 3 s vid krasch) och skriver ut NUC:ens IP.

**Varje kioskskärm** (även på server-NUC:en om den ska visa en bänk):
```bash
bash drift/installera-nuc.sh kiosk http://<server-ip>:8765 aker
```
Lag-id: `aker` | `skog` | `tundra` | `stad` — utelämna för lobbyn (välj lag på skärmen).
Installerar Chromium + unclutter (dold muspekare), skriver kiosk-skript med watchdog
(startar om webbläsaren om den dör), autostart vid inloggning, stänger av skärmsläckaren.

**Sist:** slå på automatisk inloggning (Inställningar → Användare → Automatisk inloggning)
och starta om — då bootar NUC:en rakt in i spelet.

## Vardagskommandon

| Vad | Kommando |
|---|---|
| Serverlogg live | `journalctl -u eco-loco-server -f` |
| Starta om servern (= nollställ spel) | `sudo systemctl restart eco-loco-server` |
| Uppdatera till senaste version | `cd eco-loco-mellan && git pull && sudo systemctl restart eco-loco-server` |
| Testa kiosken utan omstart | `~/.local/bin/eco-loco-kiosk.sh` |
| Ur kioskläget tillfälligt | Alt+F4 (watchdogen startar om) · döda helt: `pkill -f eco-loco-kiosk` |
| Tuna balans/config | redigera `spec/assets.json` → ladda om skärmarna (ingen serveromstart behövs för assets; `config`-blocket läses vid serverstart → restart) |

## Felsökning

- **Skärmen visar "Ingen kontakt med servern"** → servern nere eller fel IP i kiosk-URL:en.
  Kolla `systemctl status eco-loco-server` på server-NUC:en och `ping <server-ip>` från kiosken.
- **Alla lag visas som "Spelare ansluten" fast skärmarna är få** → gamla webbläsarfönster
  (även på andra datorer) ligger kvar anslutna. Stäng dem eller starta om servern.
  Servern pingar var 10:e sekund och rensar döda anslutningar själv efter ~20 s.
- **Rundan avslutas inte fast alla tryckt AVSLUTA** → samma orsak som ovan: ett kvarglömt
  fönster räknas som mänskligt lag. ✅-markeringarna i lagpanelen visar vilka som är klara.
- **Inget ljud** → ljud kräver ett tryck först (webbläsarpolicy) — STARTA-knappen låser upp.
  I kioskläget skickas `--autoplay-policy`-flaggan som mildrar detta.
- **Spel fastnat/konstigt läge** → `sudo systemctl restart eco-loco-server` ger rent bord;
  skärmarna återansluter själva och hamnar i lobbyn.

## Kvar innan skarp rigg (fas 4-rest)

- MQTT-brygga till fysiska displayer/LED: byt mock-publish i `src/mqtt.js` mot riktig
  mosquitto-klient; bekräfta bänk-mappningen (aker=eco1 …) mot firmware.
- Sessionslogg per omgång (för speltest/statistik).
- Spelledarläge (`config.mode='gm'`) och tutorial-läge.
- Balansombalansering enligt simuleringsrapporten (sektorsymmetri + svårighetsgrader).
