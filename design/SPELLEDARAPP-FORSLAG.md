# Spelledarapp — färdigt förslag (spec + UI)

> Status: **förslag, ej byggt.** Underlag för beslut. Verifierat mot koden 2026-10-15
> (`server/server.js`, `src/rigg.js`, `tools/hjarna-stubb.py`, `spec/engine.js`,
> `spec/slutdel.js`, `spec/assets.json`, `RIGG-KONTRAKT.md`, `ARCHITECTURE.md`).
> Mockup: [`design/spelledarapp-mockup.html`](spelledarapp-mockup.html).

---

## 1. Syfte

En **femte, fristående webbapp** (`spelledare.html`) som ersätter PixiLab Blocks helt.
Spelledaren styr från telefon/surfplatta/dator både **spelet** och **förstärkningsriggen**.
Appen samlar varje kommando som idag finns utspritt i tre lager:

- **Grupp A — in i SPELET** (idag kanalen `ecoloco/spel/gm`, hanteras i `server.js → handleGmCmd`).
- **Grupp B — bara FÖRSTÄRKNINGSRIGGEN** (idag `ecoloco/rigg/gm/*` + semantiska cues `ecoloco/rigg/*`, hanteras i `tools/hjarna-stubb.py`).
- **Admin/uppstart** (idag WS-meddelanden: `startGame`, med/utan spelledare).

Appen byggs i **samma anda som spelet**: statisk vanilla-HTML/JS, inga byggsteg, serverad av
samma Node-process (`server.js` serverar redan alla filer via HTTP), lätt att driftsätta på NUC.

Bakgrund (kontext, inte krav): tre oberoende "lägen" existerar i koden och ska inte blandas ihop —

| Begrepp | Var | Vad det styr | Hur det sätts idag |
|---|---|---|---|
| `config.mode` (`selfplay`/`gm`/`tutorial`) | klient `spel.html` | onboarding-lagret på **spelskärmen** (tutorial-reveal m.m.), aldrig reglerna | `spec/assets.json` eller `?mode=` i URL |
| `gmMode` (serverflagga) | `server.js` | DRIFT-flödet: händelser via ja/nej vs 50 %-auto, + award-takt manuell vs 10 s-klocka | `{cmd:'gm',on}` |
| `riggSilent` ("med spelledare") | `server.js` | om spelet skickar rigg-cues alls (av = spelledaren driver riggen manuellt) | `startGame {spelledare}` eller `{cmd:'spelledare',on}` |

Appens stora **SPELLEDARLÄGE PÅ**-reglage slår lämpligen på `gmMode` **och** `riggSilent`
tillsammans (två kommandon). `config.mode` sätts per skärm (se §6, känd lucka).

---

## 2. Arkitektur & koppling

### Två kommandovägar finns i koden

**Grupp A (spelet)** går till `server.js`. Servern lyssnar på TVÅ sätt, med identisk payload:
- **MQTT:** `attachGmChannel()` prenumererar via `mosquitto_sub` på `ecoloco/spel/gm` + `ecoloco/spel/pause`.
- **WebSocket (additivt):** meddelande `{type:'gmcmd', ...}` → `handleGmCmd`, samt `{type:'pause', on}` → `setPaused`.

**Grupp B (riggen)** går INTE genom spelservern. Den konsumeras direkt av hjärnan
(`hjarna-stubb.py` → sen Blocks) på topics `ecoloco/rigg/gm/*` och de semantiska cuesen `ecoloco/rigg/*`.
Spelservern reläar inte dessa.

**Admin/uppstart** (`startGame`, claim, med/utan spelledare) finns ENDAST över WebSocket.

### Rekommendation: EN WebSocket till servern + tunt rigg-relä

> **Appen öppnar en enda WebSocket till `server.js` (samma som `src/net.js`).**
> Grupp A + admin går som WS-meddelanden rakt in. För Grupp B läggs ett **litet relä** till
> i `server.js`: ett nytt WS-meddelande `{type:'rigcmd', topic, payload}` som anropar den
> redan befintliga `riggSend(topic, payload)` (servern kör redan `mosquitto_pub` mot brokern).

**Motivering:**
1. **Statisk app, en origin, noll extra infrastruktur.** En webbläsare kan inte öppna en rå
   MQTT-TCP-socket; MQTT från browser kräver en MQTT-över-WebSocket-brygga (mosquitto 9001 +
   repo `mqtt-websocket-broker`). WS-reläet slipper den bryggan — appen talar bara med den server
   som ändå serverar dess filer.
2. **Servern når redan brokern.** `riggSend` → `mosquitto_pub -h $RIGG_BROKER` finns och fungerar.
   Reläet är ~5 rader och återanvänder den. Rigg-brokerns IP bor på ETT ställe (servern), inte i klienten.
3. **Live-återkoppling gratis.** Varje server-broadcast bär hela `state` (se `send()` i `server.js`).
   En WS-ansluten panel läser runda, öhälsa, lag, `pendingEvent`, `proposal`, `over`, award-/slutdel-events
   utan egen pollning — exakt som spelskärmarna.
4. **Robust som spelet.** Återanslutning + full state-synk är redan löst i `net.js`-mönstret; panelen
   ärver det.

**Alternativ (dokumenteras, väljs bort):** appen talar WS till servern för Grupp A/admin OCH
MQTT-över-WS (`ws://192.168.0.23:9001`, biblioteket `mqtt.js`) direkt till brokern för Grupp B —
samma topics som Blocks använde. Fördel: servern rörs inte alls. Nackdel: kräver 9001-bryggan igång,
broker-IP hårdkodad i klienten, två anslutningar att hålla vid liv. Välj detta bara om reläet i
servern inte får läggas till.

```
                         ┌───────────────── server.js (äger engine.js = sanning) ─────────────────┐
  spelledare.html ──WS──►│ {type:'startGame'|'claim'}          → admin                             │
   (en WebSocket,        │ {type:'gmcmd',cmd:...} / {type:'pause'} → handleGmCmd  (GRUPP A)         │
    statisk vanilla)     │ {type:'rigcmd',topic,payload} → riggSend → mosquitto_pub (NYTT RELÄ)    │
        ▲                └──────────────────────────────────┬──────────────────────┬──────────────┘
        │  broadcasts (state + events)                      │ ecoloco/spel/*        │ ecoloco/rigg/*
        └───────────────────────────────────────────────────┘ (oförändrat)          ▼
                                                                        hjarna-stubb.py / Blocks  (GRUPP B)
```

Drift: samma offline/LAN-först som spelet. Panelen öppnas på
`http://<server-ip>:8765/spelledare.html`. `RIGG_BROKER`/`RIGG_PORT` styrs av serverns env
(idag default `localhost:1883`; i drift brokern genom tunneln).

---

## 3. GRUPP A — kommandon in i spelet (exakt, ur koden)

Alla går som WS `{type:'gmcmd', ...}` **eller** MQTT `ecoloco/spel/gm` (JSON-payload).
Paus går dessutom som WS `{type:'pause', on}` / MQTT `ecoloco/spel/pause` (`1`/`0`/annat=toggla).
Källa: `handleGmCmd()` i `server.js`, rad 425–504.

| Payload (JSON) | Effekt | Guard / villkor |
|---|---|---|
| `{"cmd":"gm","on":true\|false}` | Serverns GM-läge: `gmMode`, speglas till `engine.setGm()` + `rigg.setGm()`. Styr händelse-flöde (ja/nej vs 50 %-auto) och award-takt (manuell vs 10 s-klocka). | — (kan sättas när som helst) |
| `{"cmd":"pause","on":true\|false}` | Fryser BARA spelmotorn (nedräkning + bokslut). Ambience/rigg loopar vidare. `on` utelämnad = toggla. Skickar `ecoloco/rigg/paus` 1/0 som systemsignal. | kräver `started` |
| `{"cmd":"spelledare","on":true\|false}` | Med/utan spelledare: `riggSilent`. `on`=spelet skickar INGA rigg-cues (spelledaren driver riggen manuellt). | — |
| `{"cmd":"pengaslapp"}` | +10 pengar & +10 material till ALLA fyra lag (`engine.pengaslapp()`), eget event-kort på skärmen. | `started` && inte `over` && inte mitt i bokslut (`resolvingNow`) |
| `{"cmd":"event","beslut":"ja"\|"nej"}` | Kör (`ja`) eller hoppar (`nej`) rundans dragna händelseförslag. Loggas i summaryn. Idempotent via `pendingEvent`. | `gmMode` && `started` && inte `over` && `pendingEvent` finns |
| `{"cmd":"award_next"}` | Stegar prisutdelningen ETT pris. Skärm + rigg i exakt takt (`awardStep`/`awardDone`). Efter sista priset: återuppta runda (`startTimer`) eller avsluta. | `gmMode` && pågående ceremoni (`cer`) |
| `{"cmd":"slutdel_start"}` | Startar den spelledarstegade SLUTDELEN (podium + reveal). Bygger steglista ur `spec/slutdel.js` (version A = q1–q6 + nf1–nf3). | partiet måste vara **slut** (`engine.getState().over === true`) |
| `{"cmd":"slutdel_next"}` | Stegar slutdelen ETT steg. Fråge-steg → fråga+alternativ till skärmarna. Reveal-steg → kort (+ ev. central-ljud). Efter sista steget → `slutdelDone`. | pågående slutdel |

**Händelse-förslaget att visa vid `event`-beslutet:** i GM-läge drar motorn alltid rundans förslag
vid rundstart men applicerar det inte. Panelen läser det ur `state.pendingEvent`
(`{id, rubrik, text, typ, ...}`) — över MQTT finns det även på `ecoloco/rigg/eventforslag`.
De 8 händelserna: storm, skogsbrand, uppror, torka, godskord, sponsrat (röst-frestelse), gronafonden,
marknadskrasch (`EVENTS` i `engine.js`).

**Slutdelens steg (version A, `spec/slutdel.js`):** 6 podiefrågor (inga rätta svar, bara live-fördelning
färgad per lagfärg) följt av 3 Newfoundland-kort (nf1, nf2 reveal + nf3 regi-text). Version B (El Hierro
+ återkoppling till egen session) är stubbar, ingår ej.

### Live-feedback appen får tillbaka (broadcasts, bär `state`)
`lobby`, `timer {left,full}`, `paused {paused,left}`, `notis`, och `event`-strömmen:
`roundStart`, `ohalsa`, `award`/`awardCeremony {total}` / `awardStep {typ,w,i,total}` / `awardDone {over}`,
`event`, `roundEnd`, `gameEnd`, samt slutdel: `slutdelStart {total,version}`, `slutdelQuestion`,
`slutdelReveal`, `slutdelDist {counts,tokens}`, `slutdelDone`. Panelen renderar runda X/8, öhälsa,
timer, lag-kapital, pågående förslag och stegnings-progress direkt ur dessa.

---

## 4. GRUPP B — kommandon som bara styr riggen (exakt, ur koden)

Två underkategorier. Källa: `handle_gm()` + `on_semantic()` i `tools/hjarna-stubb.py`, `RIGG-KONTRAKT.md`.

### 4a. GM-master-override (`ecoloco/rigg/gm/*`) — bryter spelet

| Topic | Payload | Effekt i hjärnan/Blocks |
|---|---|---|
| `ecoloco/rigg/gm/master` | `1` / `0` | `1` = GM tar över: hjärnan **ignorerar alla spel-cues** (`scen/ohalsa/award/ljud/wave/countdown/ceremoni`) tills `0`. Paus (`ecoloco/rigg/paus`) går ändå alltid igenom. |
| `ecoloco/rigg/gm/alla_grona` | `1` (`0` = no-op) | Alla fyra sidor gröna (`h120 s100 v90`), spots släckta. |
| `ecoloco/rigg/gm/spot/<1-4>` | `0` / `1` | Enskild spot (relä) av/på. Sida: 1=åker, 2=skog, 3=tundra, 4=stad. |
| `ecoloco/rigg/gm/blandare` | `0` / `1` | Saftblandar-reläet av/på. |
| `ecoloco/rigg/gm/ljud` | ljud-id (sträng) | Spelar ett ljud centralt (lägger till `.wav` om `.`-löst). **Appen exponerar detta ALDRIG som en ren "spela ljud"-knapp** — ljud används bara inuti CUE-paket (§4c). |

> **Viktigt (ur `on_semantic()`):** `gm/*`-kommandon hanteras FÖRE master-kontrollen → **alla gm/\***
> (spot, blandare, alla_grona, ljud) **går alltid igenom**, även medan spelet driver riggen. De
> **semantiska** cuesen i §4b gatas däremot av master: när `master=1` ignoreras de helt, och när
> `master=0` konkurrerar de med spelets egna cues. Rena slutsatsen för UX:
> - **Individuellt ljus** (tänd en spot, saftblandaren, alla grön) → `gm/*` → **fungerar alltid**,
>   mitt i spelet, utan att ta över något. Perfekt för "peka ut ett lag".
> - **CUE-paket med look/fx** (rött blink, chase, nedräkning) rider på den semantiska kanalen. De
>   är rena när spelet ändå är tyst mot riggen — dvs i läget **"med spelledare"** (`riggSilent`),
>   där spelet INTE skickar några rigg-cues och spelledaren äger kanalen. Master-override behövs då inte;
>   master är nödhandtaget för att slita åt sig riggen mitt i ett "utan spelledare"-parti.

### 4b. Semantiska cues riggen förstår (`ecoloco/rigg/*`)
Spelets normala språk till riggen. Kan skickas manuellt (via reläet) när master är AV, eller användas
för en "regissera look"-sektion. Konsumeras i `on_semantic()`.

| Topic | Payload | Vad det gör |
|---|---|---|
| `ecoloco/rigg/scen` | `attract` \| `runda` \| `awards` \| `slut` | Fasbyte (attract=grön puls+ambience, runda=öhälso-look, awards=tyst, slut=släckt). |
| `ecoloco/rigg/ohalsa` | `1`–`100` | Sätter öhälso-looken (5 lägen) + rätt soundscape-loop. |
| `ecoloco/rigg/award` | `{"typ":"sabotor\|foretagare\|eldsjal","lag":"aker\|skog\|tundra\|stad"}` | Tänder vinnarsidan + spot + award-ljud. |
| `ecoloco/rigg/wave` | `1` / `0` | Tombola-wave-overlay på/av. |
| `ecoloco/rigg/countdown` | `1` / `0` | 10 s-nedräkning: vita sidor + countdown-fx + ljud / av. |
| `ecoloco/rigg/ceremoni` | `countdown` \| `climax` \| `runda1` | Startceremoni: riser+LED-chase → vitt ljus 3 s → rundans look. |
| `ecoloco/rigg/blandare` | `1` / `0` | Blandar-reläet (semantisk variant). |
| `ecoloco/rigg/ljud` | ljud-id/filnamn | Centralt "show"-ljud. |
| `ecoloco/rigg/paus` | `1` / `0` | Systemsignal (lugn blå bas + wave). Går igenom även i master-/spelledarläge. |

### 4c. CUE-paket — ljud ALLTID tillsammans med ljus (designbeslut, Josef)
> **Ljud får aldrig köras ensamt.** Det finns ingen "spela ett ljud"-kontroll i panelen. Allt ljud
> ligger i **cue-paket** som tänder ljud OCH ljus samtidigt. Ljus däremot FÅR köras ensamt (§4d).

Ett cue = en liten ordnad sekvens topics som appen publicerar så att ljud och ljus alltid följs åt.
Paketen är härledda ur det hjärnan redan buntar ihop (`hjarna-stubb.py`) + ljud-id:na i `assets.json`:

| CUE (knapp) | Ljud | Ljus | Topics appen skickar (i ordning) |
|---|---|---|---|
| **HAPPENING** | `happening` (jingle) | kort ljussvep över riggen | `rigg/ljud happening` → `rigg/wave 1` → (efter ~3 s) `rigg/wave 0` |
| **KRIS / LARM** | `larm` + `kris` | rött blink på alla sidor + saftblandaren | `rigg/gm/ljud larm` + `rigg/ohalsa 10` (hjärnan: rött blink `h0 s100 v100 blink80`) + `rigg/gm/blandare 1` |
| **NEDRÄKNING** | `countdown` | vita sidor + nedräknings-fx | `rigg/countdown 1` (allt i ett) … `rigg/countdown 0` |
| **STARTCEREMONI** | `spanning` → `round_start` | LED-chase → vitt ljus 3 s | `rigg/ceremoni countdown` → `rigg/ceremoni climax` |
| **FANFAR (seger)** | `win` | festgrönt på alla sidor | `rigg/gm/ljud win` + `rigg/gm/alla_grona 1` |

Noter:
- KRIS använder `ohalsa 10` för det röda blinket (hjärnans `apply_ohalsa`). Looken ligger kvar tills
  en ny look skickas — avsluta med **RUNDA** / ny `ohalsa` i "Regissera look", eller genom att släppa
  riggen till spelet igen. Saftblandaren släcks separat (BLANDARE-knappen).
- Look/fx-delarna (wave, ohalsa, countdown, ceremoni) rider på den semantiska kanalen → tänk som
  "med spelledare"-läget (riggSilent), där spelet är tyst och spelledaren äger riggen. Ljud- och
  blandar-/alla_grona-delarna går via `gm/*` och landar alltid.
- Fler cue-paket är lätt att lägga till — det är bara en ny rad med topics. Josef/Klara kan tuna
  ljud-id och look per cue.

### 4d. Individuellt LJUS — helt utan ljud (`gm/*`, fungerar alltid)
Rena ljuskontroller för när spelledaren förklarar eller pekar ut någon. Inget ljud, bypassar master:
- **SPOT 1–4** (`gm/spot/<1-4>` 0/1) — tänd en enskild sidas spot (1=åker, 2=skog, 3=tundra, 4=stad).
- **SAFTBLANDAREN** (`gm/blandare` 0/1) — snurra igång/stäng blandaren, tyst.
- **ALLA GRÖNA** (`gm/alla_grona` 1) · **SLÄCK ALLT** (`rigg/scen slut` / spots av).

---

## 5. Admin / uppstart (WS-only)

Ur `server.js`-meddelandehanteraren + `net.js`.

| Handling | WS-meddelande | Not |
|---|---|---|
| Starta / starta om spel | `{type:'startGame', spelledare:true\|false}` | Lediga/döda/bot-platser fylls med botar. `spelledare` sätter `riggSilent`. **Ignoreras om ett parti pågår och inte är slut.** |
| Ta / lämna lag | `{type:'claim', lag:'aker'…}` | Mest för test; spelledaren behöver sällan claima. |
| Paus / fortsätt | `{type:'pause', on?:bool}` | Se Grupp A. |
| Handskakning / spectator | `{type:'hello', lag:null}` | Panelen ansluter som åskådare (inget lag) → får alla broadcasts med state. |

**Byta version (`config.mode` selfplay/gm/tutorial):** se §6 (känd lucka — sätts per skärm idag).
**Välja scenario:** finns inte i nuvarande bygge (spelets regeluppsättning är fast; slutdel-version
hårdkodad 'A'). Panelen kan visa aktivt läge men bör inte låtsas kunna byta det förrän servern stödjer det.

---

## 6. Vad spelledaren kan påverka i spelet — och vad som INTE går

**Kan påverka (konkret, ur motorn):**
- **Händelse-flödet:** varje runda dras ett förslag; spelledaren kör eller hoppar (`event ja/nej`).
  Auto-typ slår på träffade lag; röst-typ (sponsrat) öppnar individuell frestelse-omröstning.
- **Award-takten:** stega de tre prisen (🏆 ledande, 🌱 eldsjäl, 💀 sabotör) i egen takt (`award_next`).
  Led/eld hoppas över om de saknas; sab-kortet visas alltid.
- **Ekonomisk livlina:** `pengaslapp` (+10/+10 till alla) för att hålla ön flytande under en runda.
- **Tempo:** paus (frys motorn) när/hur länge som helst; ambience fortsätter.
- **Rigg-cues av/på:** med/utan spelledare (`spelledare`).
- **Slutdelen:** starta + stega 6 podiefrågor + 3 Newfoundland-kort efter partiets slut.
- **Partistart:** ny ren omgång (botar fyller tomma lag).

**Kan INTE påverka (medvetna gränser):** balanssiffror/regler (ligger i `engine.js`/`assets.json`),
enskilt lags kortval eller röster (styrs av spelare/botar), vilken händelse som dras (slumpas),
spelets scenario, samt `config.mode` live (se nedan).

**Kända luckor att flagga för Josef (rekommendationer, inte uppfunna kommandon):**
1. **Ingen omstart mitt i parti.** `startGame` är gardat till `!started || over`. Vill man kunna
   avbryta/nollställa ett pågående parti från panelen behövs ett nytt server-kommando
   (t.ex. `{cmd:'reset'}`). Idag: panelen kan starta om först när partiet är slut.
2. **`config.mode` är per skärm.** selfplay/gm/tutorial läses ur `assets.json` (eller `?mode=` i
   skärmens URL) vid sidladdning — går inte att fjärrväxla. Antingen: redigera `assets.json` + ladda
   om skärmarna, eller starta varje skärm med rätt `?mode=`. Panelen bör visa aktivt läge och, om
   fjärrväxling önskas, så behövs ett litet server-endpoint — flagga som framtid.
3. **Grupp B kräver reläet** (§2) eller en MQTT-WS-brygga; en ren browser når inte brokern direkt.

---

## 7. UI-förslag

### Designhållning
Panelen är ett **operatörs-pult** — ett verktyg spelledaren använder om och om igen under drift,
ofta i halvmörkt rum, på surfplatta eller telefon. Därför:
- **Samma visuella familj som spelet** (medvetet val, inte mall): house-tokens ur `spel.html`
  (`--bg #121009`, `--panel`, `--gold #C9A94F`, `--led`, lagfärgerna), typsnitten **Oxanium**
  (display) + **Chakra Petch** (siffror/tabulärt). Panelen ska kännas som baksidan av samma
  kontrollbord, inte som en främmande SaaS-dashboard.
- **Hierarki = frekvens × konsekvens.** Det spelledaren gör oftast och mest tidskänsligt (stega
  prisutdelning, svara ja/nej på händelse, pausa) är störst och överst. Sällan-knappar (rigg-finish,
  omstart) är mindre och längre ned.
- **Tydliga lägen.** Ett stort **SPELLEDARLÄGE**-reglage högst upp med otvetydig PÅ/AV-look (guld
  ifylld vs mörk kontur). GM-master-override för riggen har en egen, röd-tonad "du har tagit över"-look
  så man aldrig är osäker på om spelet eller spelledaren driver riggen.
- **Säkra vs snabba knappar.** Snabba (ett tryck): award_next, paus, spot, scen. Säkra (kräver
  bekräfta / håll in 600 ms): pengasläpp, omstart, master-override, slutdel_start. En rad feedback
  ("✓ Pengasläpp skickat") bekräftar alltid att kommandot gick iväg.
- **Liggande (landscape) skärm.** Spelledarpulten körs på en **liggande** surfplatta/skärm —
  layouten utnyttjar bredden: statusfält över hela toppen, 3-kolumns innehållsrutnät, allt viktigt
  utan vertikal scroll. (Telefon stående faller tillbaka till en kolumn, men landscape är måttet.)
- **Touch först.** Alla mål ≥ 64 px höga, generöst mellanrum, inga hover-beroende kontroller.
- **Rörelse sparsamt** (emil-design-eng): knappar skalar `scale(0.97)` på `:active` med
  ~140 ms `ease-out`; inga inslidande sektioner, ingen dekorrörelse. Live-värden (öhälsa, timer)
  uppdateras utan hoppig animation. `prefers-reduced-motion` respekteras.

### Topp-statusfält (alltid synligt)
En rad med LED-siffror: **anslutning** (grön prick/röd), **RUNDA x/8**, **ÖHÄLSA** (värde + färgzon),
**TIMER** (mm:ss, blinkar rött ≤10 s), och två lägesindikatorer: **GM PÅ/AV** och **MED/UTAN
spelledare**. Vid paus läggs en tydlig "PAUSAD"-banner över fältet.

### Vyer (flikar längst ned, tumvänligt)

**Vy 1 — START/ADMIN** (default före spel):
- Stor primärknapp **STARTA SPEL** (säker: bekräfta).
- Segmenterad toggle **Utan / Med spelledare** (= `startGame.spelledare`).
- Info-kort: aktivt `config.mode` per skärm (läses, ej växlas) + påminnelse om hur man sätter det.
- Efter partislut byter knappen till **STARTA OM** (samma guard).

**Vy 2 — SPEL (Grupp A)** (default under spel), prioritetsordnad uppifrån:
1. **PRISUTDELNING** — stor stegknapp **NÄSTA PRIS** med progress "pris 2/3", visar vilket pris +
   vinnande lag (ur `awardStep`). Enbart aktiv i GM-läge under ceremoni.
2. **HÄNDELSE** — kort som visar rundans `pendingEvent` (rubrik + text), och två stora knappar
   **KÖR (JA)** / **HOPPA (NEJ)**. Grått/dolt när ingen händelse väntar.
3. **PAUS / FORTSÄTT** — en stor toggle.
4. **PENGASLÄPP** — säker knapp (+10/+10 till alla), med bekräfta; disablad utanför pågående runda.
5. **SPELLEDARLÄGE** — master-reglaget (gm + spelledare tillsammans).

**Vy 3 — RIGG (Grupp B)**, tydligt avskild (annan sektionsfärg/etikett "RIGG — MANUELL"), tre block:
- **CUES (ljud + ljus tillsammans)** — en rad stora cue-knappar: **HAPPENING · KRIS/LARM ·
  NEDRÄKNING · STARTCEREMONI · FANFAR** (§4c). Varje knapp fyrar hela paketet (jingle+ljus osv).
  Ingen ren "spela ljud"-knapp finns.
- **INDIVIDUELLT LJUS (utan ljud)** — **SPOT 1–4** (var sin lagfärg-list), **SAFTBLANDAREN**,
  **ALLA GRÖNA**, **SLÄCK ALLT**. Dessa går via `gm/*` och **fungerar alltid**, även mitt i spelet,
  utan att ta över — för att peka ut ett lag eller lysa upp när man förklarar.
- **TA ÖVER RIGGEN (MASTER)** — röd-tonad toggle (`gm/master` 1/0), nödhandtag för "utan
  spelledare"-partier: tystar spelets cues så spelledaren kan regissera fritt. En notis förklarar läget.
  (I "med spelledare" behövs den inte — spelet är redan tyst mot riggen.)
- **Regissera look** (vikbart, för den vane): rena semantiska cues utan ljud (scen / öhälsa / wave /
  countdown) — t.ex. återställa looken efter en KRIS-cue.

**Vy 4 — SLUTDEL** (blir tillgänglig när partiet är slut):
- **STARTA SLUTDEL** (säker). Sedan stor **NÄSTA** med progress "steg 4/9" och en etikett för
  vad nästa steg är (fråga vs reveal vs regi-text), så spelledaren vet vad hen släpper fram.
- Vid fråge-steg visas live-fördelningen (antal per alternativ, färgad per lag) ur `slutdelDist`.

### Layout (ASCII, LIGGANDE skärm — bredden används, 3 kolumner)

SPEL-vyn (grupp A):
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● ANSLUTEN   RUNDA 4/8   ÖHÄLSA 62 ▲   TIMER 01:12        GM PÅ · MED SPELLEDARE │ status
├────────────────────────────┬────────────────────────────┬────────────────────┤
│ PRISUTDELNING              │ RUNDANS HÄNDELSE           │ TEMPO              │
│ ┌────────────────────────┐ │ "Höststormen är här"       │ [ ⏸ PAUSA SPELET ] │
│ │   NÄSTA PRIS    2 / 3   │ │ kusten tar emot kostnaden… │                    │
│ └────────────────────────┘ │ [ KÖR·JA ]   [ HOPPA·NEJ ] │ LIVLINA  (bekräfta)│
│ 🏆 Ledande: Björnen        │                            │ [ 💸 PENGASLÄPP ]  │
├────────────────────────────┴────────────────────────────┴────────────────────┤
│ SPELLEDARLÄGE            styr awards + händelser själv, driver riggen   (●== PÅ)│
├──────────────────────────────────────────────────────────────────────────────┤
│  [ SPEL ]        [ RIGG ]        [ SLUTDEL ]        [ ADMIN ]                    │ flikar
└──────────────────────────────────────────────────────────────────────────────┘
```

RIGG-vyn (grupp B): rad med CUES (ljud+ljus) överst, individuellt ljus (utan ljud) under,
master-override + regissera-look sist.
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CUES  (ljud + ljus)   [HAPPENING] [KRIS/LARM] [NEDRÄKNING] [STARTCEREMONI] [FANFAR]│
├──────────────────────────────────────────────────────────────────────────────┤
│ INDIVIDUELLT LJUS (utan ljud)   [SPOT1][SPOT2][SPOT3][SPOT4]  [BLANDARE] [ALLA GRÖNA] [SLÄCK]│
├──────────────────────────────────────────────────────────────────────────────┤
│ TA ÖVER RIGGEN (master, nödhandtag)  ( == AV)        ▸ Regissera look (utan ljud)│
└──────────────────────────────────────────────────────────────────────────────┘
```

### Mockup
En statisk, klickbar mockup finns i **[`design/spelledarapp-mockup.html`](spelledarapp-mockup.html)**
(vanilla, house-tokens, touch-mål ≥64 px, `:active`-feedback, reduced-motion). Den visar de fyra
vyerna, status­fältet, säker-vs-snabb-knapparna, master-override-looken och stegnings-progress.
Mockupen är ren front — inga live-kommandon skickas.

---

## 8. Bygg-ordning (förslag)
1. `spelledare.html` + `src/net-gm.js` (återanvänd `ServerNet`-mönstret; lägg `gmcmd`/`rigcmd`-sändare).
2. Litet relä i `server.js`: `case 'rigcmd': riggSend(m.topic, m.payload)` (validera att topic börjar
   på `ecoloco/rigg/`).
3. Grupp A-kontroller + live-feedback ur broadcasts.
4. Grupp B-kontroller (master, look, spot, blandare, ljud).
5. Slutdel-vyn.
6. (Senare, om önskas) server-`reset` + fjärr-`mode`.
