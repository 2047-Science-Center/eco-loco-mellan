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
| **Motor (sanning)** | `spec/engine.js` (+ `spec/effects.js`, `spec/systems/proposal-selector.js`) | Regler, balans, state — **innehållstom**: inga hårdkodade innehålls-listor, motorn läser content-banken + config. `EcoLoco`-klassen (internt namn — behålls). Ren modul, ingen DOM/nät, kör oförändrad i webbläsare och i Node. `effects.js` = förslags-/dilemma-effekter, `systems/proposal-selector.js` = förslagsurval. |
| **Innehåll (data)** | `spec/assets.json` + `spec/content/*` | `assets.json`: config-overrides, slots, ljud-manifest (läses LIVE). `spec/content/`: byggnadsbank (`buildings.js`), lagbank (`teams.js` → motorn re-exporterar som `AREAS`), förslag (`proposals.js`), dilemman (`dilemmas.js`) och händelsebanker (`company-crises`, `company-events`, `ohalsa-events`, `gm-events`, `events.js` = bara 'rost'/sponsrat). `spec/slutdel.js` = podiefrågor + reveal-kort. Motorn importerar/re-exporterar banken (korthänder + AREAS utflyttade, migrerings-Etapp 1–2). |
| **Variant-config (flerversion)** | `spec/config/variants/*` + `server/variant-config.js` | EN motor, TRE jämbördiga varianter (Flash/Mellan/Skola, ingen är standard). Varje variant = en config-fil (`flash.js`/`mellan.js`/`skola.js`, register i `index.js`) som overridar `DEFAULT_CONFIG` (rundantal, fas-tider, bygggräns, beslutssystem, kvoter, `mode`). `server/variant-config.js` (`buildEngineConfig`) slår ihop manifest + vald variant → `new EcoLoco(config)`. Variant-specifikt INNEHÅLL taggas i content-banken (`variants[]`/`flashOnly` per post) — inte separata innehållsfiler. |
| **Server (auktoritativ)** | `server/server.js` | Äger EN motorinstans i drift, statiska filer + WebSocket, lobby/botar/klar-logik/hjärtslag, GM-flagga, award-/slutdel-stegning, vald variant. |
| **Persistens** | `server/persist.js` | Fire-and-forget JSONL + `<id>.summary.json` per session till `data/` (gitignorerad). Tappar motorns eventström. |
| **Klient-fasad** | `src/ui.js` | Vylager. Tre backends bakom SAMMA fasad via `makeProxy`: `makeLocal` (mock), `makeOnline` (`src/net.js`), `makeTutorial`. Seriell event-kö med scenpauser. |
| **Nätklient** | `src/net.js` | WebSocket mot servern; håller en replik-state (`EcoLoco` enbart som läsare). |
| **Karta** | `src/map.js` | Genererad ö-bild (`assets/Karta 1.2.png`) + slots + byggnadsdrop + öhälso-overlay + seating-clamp. |
| **Grafik** | `src/icons.js` (fasett-ikoner, `ico()/moodIco()/curIco()`), `src/logos.js` (lag-emblem). |
| **Rigg (semantik)** | `src/rigg.js` | Motor-events → semantiska cues `ecoloco/rigg/*`. `src/mqtt.js` → den fysiska riggens bänk-topics. **Ingen** direkt ljus/ljud-styrning. |
| **Hjärna** | `tools/hjarna-stubb.py` | Översätter semantiska cues → granulärt (`ecoloco/rigg/out/*`) + ljud. Python-stubb nu → Blocks sen. |
| **Sida** | `spel.html` | All DOM + CSS (`:root`-tokens). `?online=1` / `?lag=` / `?mode=` / `?slutdeltest=1`. |

**Dataflöde:** `spelarens action → engine → event → (server broadcast) → ui.js seriell kö → vy` ·
parallellt `engine event → src/rigg.js → ecoloco/rigg/* → hjärnan → ecoloco/rigg/out/* → ESP32`.

---

## 2. INVARIANTER (orubbliga — bryts bara efter beslut med Josef)

1. **Motorn = sanning, och innehållstom.** Ändra ALDRIG balans/regler i `spec/engine.js` (siffror,
   utfall) utan avstämning. Innehåll (kort, events, förslag, dilemman, lag) bor i `spec/content/*` —
   aldrig hårdkodat i motorn. Tunbara värden: `DEFAULT_CONFIG` (versionsneutral baslinje) +
   `spec/assets.json`; **per-variant-värden i `spec/config/variants/*`** (Flash/Mellan/Skola).
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
- **Lagfärg (KANONISK, för badges/karta/slutdel-marker):** `spec/content/teams.js → TEAMS.farg`
  (motorn re-exporterar som `AREAS.farg`): aker `#E7C24C` · skog `#3F8F4A` · tundra `#D98A3C` ·
  stad `#8A8F96`. **`TEAMS.farg`/`AREAS.farg` är sanningen** — `src/map.js AREA_COLORS`, `src/logos.js`
  och slutdel-markern ska matcha den. (Se öppen tråd §6: stad driftar.)

### Typsnitt
- `--font-disp` = **Oxanium** (rubriker, knappar, UI-text). `--font-num` = **Chakra Petch**
  (siffror, mätare, gauge, resurser, timer). **Hårdkoda aldrig `Menlo`/`monospace`** — använd `var(--font-num)`.

### Ikoner
- **Chrome och spel-copy ska gå via `src/icons.js`** (`ico()/moodIco()/curIco()`), inte emoji.
  Tillgängliga id: pengar, material, tillvaxt, industri, on, byt, rosta, krona, varning, trofe,
  sabotor, borsen, lage1–5 (moods). Nya symboler ritas som fasett-ikon där, inte som ny emoji.
  **`on` (ön) är en illustrerad flat-scen (2026-11-23):** nordisk ö — grå spetsiga snötoppar (vänster
  högre), gröna kullar, gul strand + stenar, mjukt hav med ljust grund-vatten-band. Mjuka path-kurvor,
  lagren överlappar (ingen glipa), ingen himmel. Avviker medvetet från de enkla symbol-ikonerna.
  **Lag-emblemen (`src/logos.js`, 2026-11-23):** INTE längre ritade silhuetter — nu de riktiga
  väggemblemen (`assets/makt/*` / `assets/trailer/emblem-vagg-fargad.png`) vektoriserade och omfärgade
  så djurytan fått sitt `AREA_COLORS`-kartfärg (oxe=guld, björn=grön, räv=orange, örn=grå; mörk platta +
  vita highlights orörda). Källa: `design/emblem-svg/{aker,skog,tundra,stad}.svg` (+ `emblem1-4.svg` =
  original). `logoSVG(id, size)` lägger emblemet på en liggande (1.25:1) **blek lagfärg-platta** med
  lagfärgad ram. Löser §6-tråden om stad-gråtonerna (allt utgår nu från `AREA_COLORS`).
  **Politik-förslagens ikoner (2026-11-19):** forbud, naturreservat, gron, krispaket, marknadsavtal,
  gronstod, allians, skatt, utslappshandel, solidaritet, grannskatt, sektorskatt, naturbruksskatt,
  kustvakt, skogsvard — en per förslag, satta i `propDefs()` (`src/ui.js`) via `ico(id, 64)`. Vote-rutan
  renderar `def.pic` med `innerHTML` (SVG-sträng), inte `textContent`.
  **Chrome-ikoner (2026-11-19):** vag (dilemma), orad (öråd/politik), mal (KRIS-mål), happening,
  bot (dator), bygge (logg), bok (årsberättelse). Emoji utbytt i logg, prisutdelning, slutbild,
  klimatregister, banner, lobby. Statiska ikoner i `spel.html` sätts via `<span data-ico="id" data-sz="px">`
  som `src/ui.js` fyller på load.
  **Status-ikoner (2026-11-19):** ja (grön bock), nej (rött kryss) — ersätter ✅/❌/✓ i logg,
  omröstningsresultat, toasts och lobby. Kvar som vanliga tecken (ej fasett): 😮‍💨, 🎬, ⏳, CSS-stämpeln
  "BYGGT ✓" (`spel.html` `.card.picked::after`), samt enstaka prosa-emoji i tutorial. Spelledarpanelen
  (`spelledare.html`, internt) rör vi separat.

### Kontrollrum + popup-visuellt (2026-11-23)
- **Kontrollrummet** = FYRA exakt matchande bilder (`assets/kontrollrum_{neutral,guld,gron,rod}.png`, 3840×2160,
  samma rum/lampor/perspektiv, bara karta/paneler/skärmar/ljus skiljer). Prisbilderna (`AWARD_BILD` i `src/ui.js`)
  = guld (ledande) / grön (eldsjäl) / röd (sabotör). `#room-bg` (neutral) ligger kvar bakom hela örådet
  (prisutdelning → "har ordet" → förslag → omröstning/dilemma) och rivs direkt när örådet är klart (`rivRummet()`).
  Overlay-bakgrunder fyller hela skärmen via `--ex/--ey` (satt av `fit()`), så inga svarta kanter oavsett skärmformat.
- **Prisbanderollen** (`.aw-ban`, A2+ 65 %): logga + pristitel + lagnamn + värde som siffra + symbol (pengar/tillvaxt/industri).
  Ingen "tryck för att fortsätta": priset går på timer (5 s) eller styrs av spelledaren (`awardStep`).
- **Animationsprincip (ska hållas nere):** full animation bara på topparna (prisutdelning, kris, slut); övriga popups
  får EN mjuk inglidning, allt innehåll samtidigt, inga effekter på själva texten. `prefers-reduced-motion` ska stänga av
  animationer (slutläget syns ändå). Bilder i originalproportion (16:9) — beskär inte.
- **Intro efter introfilmen** (`runIntro` i `src/ui.js`, overlay `#ov-intro`, tutorial-steget `mission`): svart → tomt kontrollrum →
  kronbild (`kontrollrum_krona.jpg`) + CENTRALMAKTEN-meddelande → rummet släcks → emblemvägg (`vagg_*.jpg`) → "DU ÄR [LAG]" →
  "ERT UPPDRAG" (Bygg/Handla/Påverka ön + `cfg.rounds` år). Ersätter gamla `ov-mission`/`ov-roll`/år-/hälsa-bubblorna. Tryck efter 2 s hoppar över.
- **Övningsrutor** (`#tutbox`, `spec/content/tutorial.js` + `ui.js tutBeat/tutSay/tutResolver`): panel med guldram, valfri ikon (`ic:`), en kort rad
  (siffror/ikoner före ord), räknare med 4 guldprickar (`ix` 0 Bygg · 1 Byt · 2 Ring+Coach · 3 Öråd/Avsluta) och stillastående dubbelpil ›› i stället för NÄSTA.
  Färger: öns hälsa röd/grön, pengar guld, material silver. Ingen text i grått. AVSLUTA ÅR-knappen pulserar när rutan pekar på den.
- **Byten** (`#ov-trade`, `#ov-tradein`, `#ov-traderes`, logg-raden `lg-byte`): grå modal, stora lagrutor, ikon + stor siffra (pengar guld `#E8C96A`, material silver `#C9D3DC`),
  väntrad med prickar, stor grön BYTT!/röd NEJ TACK-ruta mitt på skärmen (ej under övningen). Byt-pilen roteras 180° när du ger material (silver överst).
  Typsnitt: `button, input… { font-family: inherit }` globalt — knappar får aldrig systemtypsnitt.
- **Loggen** (`logg()` i `src/ui.js`, rad `.loggrad.lr`): fast radformat `[laglogga] [typikon] [namn] [utfall]`, 52 px, inga meningar. Bygge = logga + bygg-ikon + namn + öns hälsa
  (röd/grön + ikon); byte = logga −X ikon ⇄ +Y ikon logga; förslag/dilemma = **ingen laglogga**, bara förslagets egen ikon + namn + ✓/✕ och röster (A/B-cirkel för dilemma).
  Vänsterpanelen: stora pengar/material-rutor (ikon 64 px, guld/silver) + "DU GÖR / DU SAKNAR"-rader med ikon.
- Händelse-/dilemma-bilder: `assets/event_<id>.png` (16:9) + `assets/dilemma/<id>.png`; stilguide `design/HANDELSE-VISUELL-STILGUIDE.md`.

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
- Händelser: `tools/ohalsa-event-test.js` (trösklar/effekter, legacy-läge) + `tools/fordrojd-ohalsa-test.js`
  (fördröjd presentation). Jämförelse före/efter: `tools/fordrojd-sim.js`.

---

## 5b. Händelsesystemet — kategorier & timing (uppdaterad 2026-11-19)
**Det GAMLA fullt slumpade systemet är BORTTAGET (2026-11-19).** `EVENT_CONFIG`/`chansPerRunda`,
slumpdragningen (`_drawEvent`), GM:s pending-flöde (`chooseEvent`/`drawRandomEvent`/`resolveEventDecision`
+ servern `event`/`valjEvent`/`slumpaEvent`/`EVENT_KATALOG`/`eventforslag`) och auto-händelserna
(storm/skogsbrand/uppror/torka/godskord/gronafonden/marknadskrasch) finns inte längre. De gamla
motsvarigheterna lever vidare i de tre kategorierna (skogsbrand → company-crisis `skog_major`,
marknadskrasch → gm `gm_marknadskrasch` osv.). KVAR i `events.js`: bara 'rost'-erbjudandet `sponsrat`
som Ö-rådets beslutspool kan dra. Rigg-cuerna är OMPEKADE till de nya händelse-id:na (`EVENT_RIGG_CUE`
i server.js), fyras av `companyEvent`-handlern; latchande cues (kris/fanfar) återställs efter pausen.

Tre händelsekategorier (motorn), presenterade som popups med ~10 s auto-paus (servern fryser byggtimern):
- **Företagshändelser** (`foretag`: kriser + prestationer) — **direkt** när villkoret uppfylls under byggfasen.
  LOKALA KRISER (2026-11-19): kräver BÅDE ackumulerad skada ≤ tröskel OCH att årskravet nåtts — config
  `companyCrisisThreshold {minor:-15,major:-25}` + `companyCrisisMinRound {minor:2,major:4}` (DEFAULT_CONFIG,
  config-styrt så gamla −10/−20 utan årskrav kan köras i samma motor). Passeras tröskeln ett tillåtet år →
  direkt vid bygget; passerades den tidigare → köas vid byggfasens START (`engine.fireDueCrises()`, servern i
  `startTimer` efter Ö-råd — aldrig under bokslut/Ö-råd). Mellan/Skola; Flash saknar kriser. Se
  `design/MELLAN-NYA-KRISGRANSER.md`.
- **Öhälsohändelser** (`ohalsa`: NATUREN BLOMSTRAR/MILJÖLYFT/VÄRMEBÖLJA/STORM) — **FÖRDRÖJDA** (`cfg.ohalsaDelayed`,
  default på): KVALIFICERAS vid bokslut (`_qualifyPendingOhalsa` → `S.pendingOhalsa`), VISAS ~`ohalsaDelaySeconds`
  (30 s) **aktiv byggtid** in i NÄSTA byggfas via `fireNextPendingOhalsa()` (servern räknar aktiv tid i byggtimerns
  tick). Effekt tillämpas vid visning, en gång/parti. RESURSBRIST (Skola) är UNDANTAGEN → alltid omedelbar vid
  bokslut (pågående produktionseffekt får ej fördröjas). Legacy omedelbart beteende: `ohalsaDelayed:false`.
- **GM-händelser** (`gm`) — när spelledaren aktiverar. **KRIS** är separat (`crisis`-event, bokslut ≤20) och orörd.
- Trösklar/effekter ligger i `spec/content/*.js` och ändras ALDRIG utan avstämning (invariant 1).
  Se `design/MELLAN-FORDROJDA-HANDELSER.md` + `design/MELLAN-HANDELSETATHET.md`.

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
   toasts, event-popup (`🪙🧱🏝🌱🏭`), award-popup (`🏆🌱💀🏅`), register (`👑⚠️`), lobby/slutskärm
   (`🤖👑💀`) kör fortfarande emoji. (Politik-modalens 15 förslag är klara 2026-11-19 → egna fasett-ikoner,
   se §Ikoner.) Trots att motsvarande fasett-ikoner finns
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
