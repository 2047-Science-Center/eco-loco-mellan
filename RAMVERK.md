# RAMVERK — läs detta FÖRST innan du utvecklar vidare i Maktspelet

*Maktspelet (fd Eco Loco), mellanversionen. Spelet har byggts i flera parallella Claude-sessioner,
vilket skapat palett-, ikon- och namn-drift. Det här dokumentet är kartan + de orubbliga reglerna +
en konkret konflikt-checklista. **Läs det före en ändring, uppdatera det efter en ändring.** Det
ersätter inte `ARCHITECTURE.md` (mock→drift), `RIGG-KONTRAKT.md` (signalsöm) eller
`ÖVERLÄMNING-SNABBVERSION.md` (standarder) — det binder ihop dem och pekar på var sakerna krockar.*

---

## 1. Arkitektur-karta (filer & ansvar)

| Lager | Fil | Ansvar |
|---|---|---|
| **Motor (sanning)** | `spec/engine.js` | Regler, balans, state. Ren modul, ingen DOM/nät. `EcoLoco`-klassen (internt namn — behålls). Kör oförändrad i webbläsare och i Node. |
| **Innehåll (data)** | `spec/assets.json` | Config-overrides, byggnader, slots, ljud-manifest. Läses LIVE. `spec/slutdel.js` = podiefrågor + reveal-kort (ren data). `EVENTS`/`EVENT_CONFIG` ligger i engine.js. |
| **Server (auktoritativ)** | `server/server.js` | Äger EN motorinstans i drift, statiska filer + WebSocket, lobby/botar/klar-logik/hjärtslag, GM-flagga, award-/slutdel-stegning. |
| **Persistens** | `server/persist.js` | Fire-and-forget JSONL + `<id>.summary.json` per session till `data/` (gitignorerad). Tappar motorns eventström. |
| **Klient-fasad** | `src/ui.js` | Vylager. Tre backends bakom SAMMA fasad via `makeProxy`: `makeLocal` (mock), `makeOnline` (`src/net.js`), `makeTutorial`. Seriell event-kö med scenpauser. |
| **Nätklient** | `src/net.js` | WebSocket mot servern; håller en replik-state (`EcoLoco` enbart som läsare). |
| **Karta** | `src/map.js` | Genererad ö-bild (`assets/Karta 1.2.png`) + slots + byggnadsdrop + öhälso-overlay + seating-clamp. |
| **Grafik** | `src/icons.js` (fasett-ikoner, `ico()/moodIco()/curIco()`), `src/logos.js` (lag-badges). |
| **Rigg (semantik)** | `src/rigg.js` | Motor-events → semantiska cues `ecoloco/rigg/*`. `src/mqtt.js` → den fysiska riggens bänk-topics. **Ingen** direkt ljus/ljud-styrning. |
| **Hjärna** | `tools/hjarna-stubb.py` | Översätter semantiska cues → granulärt (`ecoloco/rigg/out/*`) + ljud. Python-stubb nu → Blocks sen. |
| **Sida** | `spel.html` | All DOM + CSS (`:root`-tokens). `?online=1` / `?lag=` / `?mode=` / `?slutdeltest=1`. |

**Dataflöde:** `spelarens action → engine → event → (server broadcast) → ui.js seriell kö → vy` ·
parallellt `engine event → src/rigg.js → ecoloco/rigg/* → hjärnan → ecoloco/rigg/out/* → ESP32`.

---

## 2. INVARIANTER (orubbliga — bryts bara efter beslut med Josef)

1. **Motorn = sanning.** Ändra ALDRIG balans/regler i `spec/engine.js` (siffror, kort, events, utfall)
   utan avstämning. Tunbara värden ligger i `DEFAULT_CONFIG` + `spec/assets.json`.
2. **Servern är auktoritativ, klienterna är statslösa vyer.** Varje servermeddelande bär hela state;
   återanslutning = full rebuild. Lägg ingen spel-sanning i klienten.
3. **Offline/LAN-först.** Inga CDN/molnberoenden i drift. **Inga nya npm-beroenden** — bara `ws`
   (vendrad i `node_modules`). Fonter/assets paketeras lokalt (`assets/fonts/`).
4. **All "show"-ljud/LED på riggen via semantiska cues.** Spelet sänder *betydelse* (`ecoloco/rigg/*`),
   aldrig lampvärden. Hjärnan mappar. Ambiens/soundscape är no-op på skärmen (`src/audio.js`), spelas centralt.
5. **MQTT-topics är heliga.** `ecoloco/<bänk>/*` och `ecoloco/rigg/*` byter aldrig namn (firmware/hjärna lyssnar).
6. **Svensk copy, minimal text, touch-först, igenkänning > minne.** Alltid exakt 3 val (smutsig/standard/grön).
7. **Namn:** **Maktspelet** utåt (UI). **EcoLoco / `ecoloco/*`** internt (klass, topics, filnamn, kommentarer) — rör inte.

---

## 3. KONVENTIONER

### Palett-tokens (`spel.html :root` = kanonisk för chromet)
- **Signal (öns hälsa, status):** `--oh-red #F0564B` · `--oh-yellow #F5C518` · `--oh-green #3DD68C`
  (= `--led-red/--led-green`; `--led #F0B33C`). Signalfärger **får aldrig** användas som lagfärg.
- **Valuta:** `--pengar #F0B33C` (guld) · `--material #8FB3C4` (blå).
- **Guld/ram/panel:** `--gold #C9A94F` · `--edge #4A443A` · `--edge2 #5C5547` · `--panel/--panel2/--panel3`.
- **Kort-tiers:** `--smutsig #8A4A38` · `--standard #7A7263` · `--gron #4E9C58`.
- **Lagfärg (spine/accent i chromet, dämpad):** `--team-aker #D4A53C` · `--team-skog #1F6E57` ·
  `--team-tundra #C96F2E` · `--team-stad #7E8794`.
- **Lagfärg (KANONISK, för badges/karta/slutdel-marker):** `spec/engine.js → AREAS.farg`:
  aker `#E7C24C` · skog `#3F8F4A` · tundra `#D98A3C` · stad `#8A8F96`. **`AREAS.farg` är sanningen** —
  `src/map.js AREA_COLORS`, `src/logos.js` och slutdel-markern ska matcha den. (Se öppen tråd §6: stad driftar.)

### Typsnitt
- `--font-disp` = **Oxanium** (rubriker, knappar, UI-text). `--font-num` = **Chakra Petch**
  (siffror, mätare, gauge, resurser, timer). **Hårdkoda aldrig `Menlo`/`monospace`** — använd `var(--font-num)`.

### Ikoner
- **Chrome och spel-copy ska gå via `src/icons.js`** (`ico()/moodIco()/curIco()`), inte emoji.
  Tillgängliga id: pengar, material, tillvaxt, industri, on, byt, rosta, krona, varning, trofe,
  sabotor, borsen, lage1–5 (moods). Nya symboler ritas som fasett-ikon där, inte som ny emoji.

### Karta/seating
- Koordinatsystem = kartbildens pixlar `0–1536 × 0–1024` (samma som `assets.json → slots`).
  Byggnader droppar i slot-index-ordning; `clampToIsland` håller foten innanför ön. Byt inte bild utan
  att verifiera att slot-koordinaterna fortfarande ligger rätt.

### Mode / online-matris
- `config.mode` ∈ `tutorial | selfplay | gm` (URL `?mode=` vinner). Styr onboarding-lagret, **aldrig regler**.
- `tutorial`: döljer howto-boxen, kör runda 0 + startceremoni (ÄR DU REDO→nedräkning→RUNDA 1) + rig-cue `ceremoni`.
- `selfplay`: howto visas, ingen ceremoni. `gm`: servern dirigerar award/slutdel via `ecoloco/spel/gm`.
- Online: `?online=1` (lobby), `?lag=<id>` (kiosk-autoclaim). Lokalt: mock-opponents styr 3 lag.
- Slutdelen (`spec/slutdel.js`, `#ov-slutdel`) stegas av servern; testas lokalt med `?slutdeltest=1`.

---

## 4. KONFLIKT-CHECKLISTA (kör IGENOM före + efter en ändring)

- [ ] **Ny färg?** → Använd en `:root`-token, hårdkoda aldrig hex. Lagfärg: utgå från `AREAS.farg`.
- [ ] **Ny siffra/text/mätare?** → `var(--font-num)`, aldrig `Menlo`/`monospace`.
- [ ] **Ny symbol i chrome/copy?** → `ico()`/`curIco()`/`moodIco()`, inte ny emoji.
- [ ] **Rör ändringen `spec/engine.js`-regler/balans?** → STOPP. Kräver beslut med Josef. Tuna via config/assets.json.
- [ ] **Nytt npm-beroende?** → FÖRBJUDET. Lös med inbyggt/`ws`.
- [ ] **Ny rig-cue?** → Dokumentera i `RIGG-KONTRAKT.md` OCH lägg till subscribe + mappning i `tools/hjarna-stubb.py`
      (annars droppas den — se §6). Spelet sänder semantik, aldrig lampvärden.
- [ ] **Ändrat/nytt DOM-id?** → Uppdatera BÅDE `spel.html` och `src/ui.js` (och ev. seriella kö-FWD-listan).
- [ ] **Nytt event?** → Lägg till i reläet + persist-tappen i `server/server.js` OCH i `FWD`-listan i `src/ui.js makeProxy`.
- [ ] **Ny vy/overlay?** → Ärver den `:root`-tokens + typsnitt? Funkar i både local/online + alla tre modes?
- [ ] **Ny copy?** → Svenska, kort, touch-vänlig. Utåt heter spelet **Maktspelet**.
- [ ] **Rört klienten?** → Är servern fortfarande sanningen? Överlever en reconnect (full state-rebuild)?

---

## 5. Verifiering (minsta rimliga)
- `node --check spec/engine.js spec/slutdel.js server/server.js server/persist.js src/*.js` efter kod-ändring.
- `node server/server.js` + `spel.html?online=1` i två fönster för multiplayer-känsla.
- Slutdel: `spel.html?slutdeltest=1` (ingen server krävs). Balans: `tools/simulera.js`.

---

## 6. Öppna trådar / kända risker (från konfliktanalysen 2026-10-15)

1. **`ecoloco/rigg/ceremoni` droppas av hjärnan.** `src/ui.js` (startceremonin) → `server.js` publicerar
   `ecoloco/rigg/ceremoni` (countdown/climax/runda1), men `tools/hjarna-stubb.py` subscribar inte på den
   (bara scen/ohalsa/award/wave/countdown/blandare/ljud/gm). Cuen når aldrig riggen. **Åtgärd:** lägg till
   topic + mappning i hjärnan (dokumenterad i `RIGG-KONTRAKT.md` §Lager 1). OBS: `ecoloco/rigg/countdown`
   (10 s kvar i rundan) ≠ `ecoloco/rigg/ceremoni countdown` (spelstart) — två olika semantiker.
2. **Stad-grått driftar i tre värden.** Kanoniskt `#8A8F96` (engine/assets/map/slutdel), men
   `src/logos.js` = `#A9AEB5` och `spel.html --team-stad` = `#7E8794`. Samma lag visas i tre gråtoner
   (badge / karta-marker vs spine). **Åtgärd:** rikta logos.js mot `AREAS.farg`; `--team-*` får vara
   medvetet dämpad men bör härledas, inte gissas.
3. **`Menlo` hårdkodat parallellt med `--font-num`.** `spel.html` rad 70/158/189/204/228 sätter
   `font-family: Menlo` och vinner över `--font-num`-regeln (rad 23) → Chakra Petch slår inte igenom på
   resurs-/timer-/stepper-/award-/ranktabell-siffror. **Åtgärd:** byt till `var(--font-num)`.
4. **Ikon vs emoji — halv migrering.** `icons.js` används i chrome + hand + topplista + bytesmodal, men
   toasts, event-popup (`🪙🧱🏝🌱🏭`), award-popup (`🏆🌱💀🏅`), politik-modal (`🌱💸🚫`), register
   (`👑⚠️`), lobby/slutskärm (`🤖👑💀`) kör fortfarande emoji — trots att motsvarande fasett-ikoner finns
   (trofe/sabotor/krona/varning/tillvaxt/industri/pengar/material). Inkonsekvent. Mest kosmetiskt. **Åtgärd:**
   ersätt stegvis; `CUR_ICON` och `fmtOh` i `src/ui.js` är de centrala emoji-källorna.
5. **Startceremonin är kopplad till tutorial-läget.** Körs bara i `runTutorial()` (mode=tutorial).
   I `selfplay`/`gm` startar spelet rakt in utan ceremoni → riggen får aldrig ceremoni-cuen vid spelstart.
   Bekräfta att det är önskat per station (annars: lyft ceremonin ur tutorial-flödet).
6. **Dokument-drift (namn).** `README.md`-titeln, `server.js`-konsolloggen (rad 504) och flera `.md`
   säger fortfarande "Eco Loco". UI:t är "Maktspelet". Rent kosmetiskt/operatörsnära — men uppdatera
   README-titeln vid tillfälle. `fas1.html`/`fas2.html` är gamla fas-prototyper (pre-restyle, egen palett +
   Menlo) — inte den spelbara filen (`spel.html`); undvik att bygga vidare i dem.
7. **Mindre:** `assets.json → slots._readme` och `src/map.js`-kommentaren säger `karta.png`, men bilden som
   faktiskt används är `Karta 1.2.png`. Slutdel version B (`elHierro`, `dinSession`) är TODO-stubbar, ej i
   version A:s steglista — ofarligt tills de byggs.
