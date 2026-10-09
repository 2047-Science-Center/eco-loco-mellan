# Överlämning: Eco Loco snabbversion (5-minutersvariant)

*Detta dokument är skrivet för att klistras in i (eller läsas av) en Claude-session hos dig som
ska bygga snabbversionen. Det är självbärande: all kontext, alla standarder och alla repolänkar
finns här. Skrivet 2026-10-09 av Josef Sjönneby + Claude utifrån bygget av mellanversionen.*

---

## 0. Repokarta — allt ligger i GitHub-organisationen 2047-Science-Center

| Repo | Vad det är för dig |
|---|---|
| **https://github.com/2047-Science-Center/eco-loco-mellan** | Förlagan. Mellanversionen (~15 min) komplett byggd: motor, UI, multiplayer, ljud, drift. Alla standarder nedan är implementerade här — läs koden som facit. |
| **https://github.com/2047-Science-Center/ecolocoo** — gren **`Short-verison`** | Den snabbvariant som faktiskt redan är byggd: **"5 minutes to collapse"** (Unreal Engine). Din designreferens för spelkänslan — se §1. Koden under `Source/Eco_Loco/5 minutes to collapse/` är läsbar C++; `Content/`-blueprints är binära. |
| https://github.com/2047-Science-Center/ecolocoo (main) | Fullspelet (~60 min, UE). Bakgrund, inte förlaga. |
| **https://github.com/2047-Science-Center/nuc-fjarratkomst** | Station-oberoende fjärråtkomst (SSH + Tailscale + RustDesk). Körs på varje NUC. |
| https://github.com/2047-Science-Center/ecolocooMicrocontrollerMqttClient | Firmware för den fysiska riggens displayer/LED (MQTT). Rör inte — men topic-namnen är heliga (§7). |
| https://github.com/2047-Science-Center/mqtt-websocket-broker | Brygga MQTT↔WebSocket om webbklient ska prata med mosquitto. |

Viktiga dokument i eco-loco-mellan: `SPELINFO.md` (spelet i sin helhet), `ARCHITECTURE.md`
(mock→multiplayer), `design/` (speldesign, UI-brief, ljud-brief med färdiga prompts),
`drift/DRIFT.md`, `tools/simulera.js` (balanssimulator), `tools/generera-ljud.js` (ljudpipeline).

---

## 1. Spelets DNA — verifierat mot "5 minutes to collapse"

Snabbvarianten som redan byggts (och speltestats i UE) fungerar så här — verifierat direkt i
källkoden på `Short-verison`-grenen:

- **Beslutskort i stället för ekonomi.** Varje runda = ett scenario med text + **exakt tre val**.
  Varje val har bara två tal: `_Points` (poäng till dig) och `_IslandDamage` (påverkan på ön).
  Inga valutor, ingen byteshandel, inga byggnader.
- **En delad ö-mätare** (start 70 i den versionen). Individuell poängjakt vs. gemensam överlevnad
  är hela spänningen — samma kärna som stora spelet, destillerad.
- **Rundtimer + "klar"-knapp**: rundan går vidare när alla tryckt klart eller tiden gått ut, och
  spelare som somnar får ett **auto-val** (`GetAutoChoice`) så spelet aldrig fastnar.
- **Enstaka kollektiva beslut**: kort kan vara `Collaborative` med `RequiredVotes` och olika utfall
  för ja- och nej-röstare — röstmekaniken överlever alltså i miniformat.
- **Trafikljusgrammatik**: röd/gul/grön på knappar och lampor, rundlampor som visar förlopp,
  siren vid kris, leaderboard och väntrum mellan spel.

**Det heliga** (behåll oavsett hur du vidareutvecklar): alltid exakt tre val · en delad mätare som
alla ser · individuell vinst i spänning mot kollektiv överlevnad · svenska · minimal text, bärande
piktogram · självfaciliterande (ingen spelledare krävs, auto-val, ingen återvändsgränd).

**Din frihet:** referensen är golv, inte tak. Josef är uttrycklig med att du får utveckla
spelkänsla, scenarier och form utifrån eget huvud — det som ska ärvas är kärnan ovan plus
standarderna nedan, inte UE-versionens exakta utformning.

## 2. Arkitekturstandard (bygg som mellan, inte som UE)

Detta är standarden som gör stationerna Claude-redigerbara, testbara och driftsäkra:

1. **Ren spelmotor utan DOM** — en modul med *actions in, events ut* (`spec/engine.js` i mellan är
   mallen). Vyn lyssnar bara på events. Samma motorfil kör i webbläsaren OCH server-side i Node.
2. **All balans i JSON som läses live** — siffror, texter, assets i en manifest-/configfil
   (`spec/assets.json`-mönstret). Tuning = redigera JSON + ladda om, aldrig omkompilering.
3. **Fasad-mönstret lokal/online** — vyn pratar med en spelfasad; bakom den finns antingen lokal
   motor + botar eller en nätverksklient. Mellan: `src/ui.js` (fasaden), `src/net.js` (klienten).
4. **Server-auktoritativ multiplayer** — EN Node-process äger motorn och serverar även filerna
   (`server/server.js`): klienter är statslösa vyer över WebSocket, varje meddelande bär hela
   state, återanslutning = full rebuild. Lobby: gå med → starta; lag utan spelare blir botar;
   ta över bot mitt i spel med notis; ws-hjärtslag rensar spökanslutningar.
5. **Offline/LAN-först** — inga CDN, inga molnberoenden i drift. `node_modules` (endast `ws`)
   checkas medvetet in så `git clone` räcker även utan internet.

## 3. Vad som kan återanvändas rakt av från eco-loco-mellan

| Återanvänd | Anpassa | Skriv nytt |
|---|---|---|
| `server/server.js`-mönstret (lobby, botar, klar-logik, hjärtslag, state-broadcast) | `spec/engine.js` → ny, enklare motor (beslutskort i stället för ekonomi) — behåll action/event-formen | Beslutskorten/scenarierna (innehållet) |
| `src/net.js`, `src/audio.js`, fasad-upplägget i `src/ui.js` | UI-layouten (snabbversionen behöver mindre skärmyta per runda) | Egen grafisk form om du vill |
| `tools/generera-ljud.js` (byt prompts) | `tools/simulera.js` (byt strategier mot dina kortval) | |
| `drift/`-mönstret (se §8 för Mint-versionen) | | |

Låst vs fritt: motor-REGLER ändras bara efter avstämning med Josef när de väl är satta
(samma princip som i mellan); bot-logik, UI och allt innehåll är fritt.

## 4. Visuell standard och asset-pipeline

- **Estetik:** retro kontrollpanel från den fysiska riggen — mörk oliv/brun, LED-siffror,
  guldaccenter, chunky knappar. Se `spel.html`:s CSS i mellan.
- **Färgsystem:** lagfärger (gul/grön/orange/grå) finns BARA som badges/loggor; signalfärger
  (röd/gul/grön för status) finns BARA i mätar-/lampform. Blanda aldrig. I snabbversionen är
  trafikljusfärgerna på valen etablerade från 5mtc.
- **Lagidentitet:** fasetterade djurbadges (bison/björn/varg/örn) i `src/logos.js` — återanvänd.
- **Asset-pipeline:** AI-generera i enhetlig stil. Arbetsgången som togs fram för kartan:
  skriv prompt med bildreferens (beskuren referensbild + explicita avvikelser), generera 4–6
  varianter, välj mot checklista. Byggnads- och kartpromptar finns i `design/` och i
  sessionsloggarna. Slots/positioner på en genererad bild kan auto-placeras med
  canvas-pixelsampling (metoden ligger dokumenterad i minnet och är återskapbar — fråga Claude
  med `src/map.js` som utgångspunkt).

## 5. Ljudstandard

- Generera med **ElevenLabs Sound Effects-API** via `tools/generera-ljud.js`-mönstret: en lista
  [filnamn, engelsk prompt, sekunder], filnamnen pekas ut i manifestet, spelet sväljer saknade
  filer tyst (bygg ljudlöst först, ljud sen).
- **Tonal trappa-principen:** valens ljud ska avslöja valet — dåligt val = lågt/dissonant,
  bra val = ljust/konsonant. Prompts för hela mellan-paletten finns i `design/AUDIO.md`.
- **Ambiens per ö-läge** med mjuk korsfadning (`src/audio.js` gör detta färdigt).

## 6. UX-mönster (beprövade i mellan — ärv dem)

- Progressiv exponering: en primär handling per vy; detaljer vid första tryck, bekräfta vid andra.
- Igenkänning framför minne: ikon + färg + 1–3 ord; aldrig text som måste memoreras.
- Omedelbar återkoppling: varje handling syns/hörs direkt.
- **Bokslut/avslöjande som ceremoni**: sekvens med scenpauser, inte simultan infodump;
  popups är klick-genom med auto-fortsättning efter ~8 s så självspel aldrig fastnar.
- Rundor avslutas tidigt när alla tryckt klart — med synlighet (✓-markering, "VÄNTAR 1/2").
- Väntlägen och anslutningsstatus ska alltid synas (grön/röd indikator) — döda knappar utan
  förklaring är det värsta som finns på en publik station.

## 7. Integrationssömmar

- **Gamla riggens MQTT-topics är heliga** (firmware lyssnar på dem oförändrade):
  `ecoloco/<bänk>/money|resources|winner|looser|displaymoney|displayresources`.
  Adapter-mönster i `src/mqtt.js` (publish-funktionen utbytbar; bänk-mappning aker=eco1 osv.
  är ännu INTE firmware-bekräftad).
- **Förstärkningsriggen** (ljus/ljud i tross, under uppbyggnad): spelet publicerar **semantiskt
  MQTT** — händelser som "öläge=dåligt", "katastrof", "vinst" — och riggen (PixiLab Blocks som
  dirigent, ESP32 som muskler) tolkar. Spelet ska aldrig styra lampor direkt; det sänder betydelse.
  Samma söm gäller snabbversionen om den ska bo i en rigg/kub.
- **`config.mode`-mönstret**: `tutorial | selfplay | gm` — bygg in lägesväxeln från start även om
  bara selfplay implementeras först.

## 8. Driftstandard: Linux Mint på NUC

**OBS: standarden är Linux Mint (Cinnamon), inte Ubuntu.** Mint-beprövade installationspaket
finns i två andra stationsrepon (utanför Eco Loco, men mönstren ska kopieras därifrån):
`deploy/nuc/` + `deploy/mint-touchstation-bas/` i https://github.com/2047-Science-Center/minnestest
samt `deploy/nuc/` i https://github.com/2047-Science-Center/forhandlingen (tvåskärmsfallet).
(eco-loco-mellans `drift/installera-nuc.sh` är Ubuntu-testad och behöver Mint-anpassas på samma sätt.)

### 8a. Installera Linux Mint på en NUC
1. Ladda ner Linux Mint Cinnamon (senaste LTS) → bränn till USB med balenaEtcher.
2. Boota NUC:en på stickan (F10 för bootmeny på Intel NUC), kör "Install Linux Mint",
   radera disken, skapa stationsanvändaren (samma användarnamn på alla stationer förenklar).
3. Efter första boot: kör Uppdateringshanteraren klart, och **kontrollera att sessionen är X11**
   (`echo $XDG_SESSION_TYPE` ska svara `x11` — Mint-standard). **Wayland fungerar inte** med
   touch-mappningen.
4. Node: Mints apt-Node är för gammal — installera Node 20+/22 från NodeSource:
   `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs git curl wget`
5. Webbläsare: Chromium räcker för spel utan taligenkänning. Ska stationen någonsin använda
   Web Speech (tal) — installera **officiell Google Chrome** (Chromium på Linux saknar Googles
   röstnyckel och blir tyst).
6. Fjärråtkomst direkt: `git clone https://github.com/2047-Science-Center/nuc-fjarratkomst.git && bash nuc-fjarratkomst/setup-remote.sh`
   → SSH + Tailscale + RustDesk, så att stationen kan skötas från kontoret var den än står.

### 8b. Stationspaketet (kiosk/start/uppdatera) — mönstret från minnestest/förhandlingen
Varje station har en `deploy/nuc/`-mapp i sitt repo med:
- `install.sh` — bygger + installerar systemd-tjänster: **server-tjänst** (system, autostart +
  omstart vid krasch) och **kiosk-tjänst** (systemd *user*-tjänst som startar vid grafisk inloggning).
- `kiosk.sh` + `kiosk.env` — startar webbläsaren i helskärm mot localhost; env-filen håller
  maskinspecifikt (skärm, touchport, ev. ljudenheter) och git-ignoreras.
- `update.sh` — **git pull + bygg + starta om**: hela uppdateringsflödet, körbart som skrivbordsknapp.
- `install-launcher.sh` / `.desktop`-filer — skrivbordsknappar ("Starta spelet", "Uppdatera").
- `setup-xorg.sh` — valfri **ren kiosk**: bar Xorg + openbox + autologin (stänger av LightDM:s
  inloggningsruta), bootar rakt in i spelet utan skrivbord. Alternativet är att behålla
  skrivbordet och bara slå på autologin (Mint: *Meny → Inloggningsfönster → Användare →
  Automatisk inloggning*).
- Hemligheter (API-nycklar) ligger ALLTID i en `.env` på NUC:en, aldrig i git.

### 8c. Touch-startpaketet (`mint-touchstation-bas/` i minnestest-repot)
Löser touch på Mint en gång för alla — ta det rakt av:
- **Touch → rätt skärm** binds till panelens **fysiska USB-port** (`ID_PATH` via udevadm), inte
  xinput-id som byter plats mellan omstarter (kritiskt med två identiska paneler).
- `find-touch.sh` listar paneler + skärmar → klistra raderna i `touch.env` (enda filen per maskin).
- `reset-touch.sh` + **skrivbordsknappen "Reset touch"** för manuell ommappning på plats.
- `touch-watch.sh` = **självläkande** bakgrundsmappning (autostart) som överlever hotplug,
  strömblink och utloggning — ingen ska behöva köra kommandon i drift.
- Vanligaste felen: fel session (Wayland i stället för X11), skärmnamn i fel ordning i
  `touch.env`, osynliga tecken från grafisk editor (använd nano).

### 8d. Vardagsdrift
- Uppdatera: skrivbordsknappen eller `bash deploy/nuc/update.sh` (= git pull + bygg + omstart).
- Loggar: `sudo journalctl -u <station>-server -f` · `systemctl --user status <station>-kiosk`.
- Nollställ spel: starta om server-tjänsten — klienterna återansluter själva till lobbyn.

## 9. Varningar och känt skuldläge (så du inte ärver fällorna)

- **Balansen i mellan är medvetet oåtgärdad:** simuleringen visade att pengarsektorn dominerar
  totalt och att överlevnaden är binär; ombalanseringsförslag finns men väntar på beslut. För
  snabbversionen: sätt poäng/ö-skada så att "själviskt hela vägen" kraschar ön men en grupp som
  vaknar halvvägs kan rädda den — och **verifiera med simulator före speltest**
  (`tools/simulera.js` som mall; riktmärken: Fishbanks = krasch som default är ok pedagogik,
  Pandemic-stegen 78/41/22 % som svårighetsgrader).
- **Spökanslutningar:** kvarglömda webbläsarfönster räknas som spelare. Mellan löser det med
  ws-hjärtslag + "ta över bot" — ärv den lösningen.
- **Ljudpolicy:** webbläsare kräver ett tryck innan ljud får spelas — lås upp ljudet på
  startknappen; kiosk-flaggan `--autoplay-policy=no-user-gesture-required` hjälper.
- **Chrome stryper timers i dolda flikar** — bra att veta vid test i flera fönster på en dator.

## 10. Arbetsprocess (så här byggdes mellan — fungerade bra)

1. **Faser med avstämningspunkter**: design/karta → UI-förslag (få OK före bygge!) → spelbar
   version → multiplayer/drift. Visa, få okej, gå vidare.
2. **Simulera balansen innan människor speltestar** — tusentals partier på sekunder avslöjar
   strukturfel som speltest aldrig hittar.
3. **Dokumentera för nästa person**: en SPELINFO.md-motsvarighet (självbärande spelbeskrivning)
   och sessionsloggar. Josefs AI-sessionsloggar ligger i hans Kontext-bibliotek.
4. **Fråga Josef** vid: regeländringar efter låsning, publika repo-beslut, allt som rör den
   fysiska riggen/firmware.

---

## Snabbstart-checklista

1. Klona `eco-loco-mellan`, kör `npm run server`, spela ett parti (`?online=1` i två fönster) —
   känn på standarden.
2. Titta på `Short-verison`-grenens `Source/Eco_Loco/5 minutes to collapse/` — känn på snabb-DNA:t.
3. Skissa dina beslutskort (scenario + 3 val + poäng/ö-påverkan) som JSON.
4. Forka motor-mönstret: ny enkel engine med actions/events, återanvänd server/net/audio/fasad.
5. Stäm av spelkänsla + UI med Josef innan storbygge.
6. Drift: Mint-NUC enligt §8, deploy-mapp enligt minnestest-mönstret, fjärråtkomst från dag ett.
