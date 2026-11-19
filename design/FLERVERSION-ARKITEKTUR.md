# Flerversion-arkitektur — Flash / Mellan / Skola på EN motor

*Klaras + Claudes arbetsdokument för refaktoreringen. Levande plan — uppdateras när vi beslutar om.*
*Migreras i testbara etapper (se §7). Status: Etapp 1 (byggnader), 2a (händelser), 2b–A (effektsystem + politikbank) KLARA 2026-11-11; 2b–B (config-styrt urval), 2c (dilemmabank + decisionSystem), 3a (versionskonfigurationer) KLARA 2026-11-16 — allt config-gated, Mellan live legacy. Nästa: 3b (UI/bot/server-pass → aktivera versionerna) + separat innehållsgranskning. Läs RAMVERK.md parallellt.*

---

## 0. Vad målet ÄR och inte är

- **Är:** ett gemensamt Eco Loco-system där de tre versionerna sätts samman av *konfiguration + innehållsbanker + valfria moduler*. En motor, inga duplicerade spelregler.
- **Är inte:** tre olika spel. Inte en ombalansering. Inte att färdigställa alla nya Skola-mekaniker nu — bara göra arkitekturen *redo* för dem.
- **Kärnprincip (Klaras korrigering 2026-11-11):** motorn ska vara **tom på innehåll**. Mellan är en content/config-fil precis som Flash och Skola — ingen version är "default inbakad i motorn" som de andra override:ar. Alla tre är jämbördiga lager ovanpå en innehållslös motor.

---

## 1. INVENTERING — nuläget (Steg 1)

### 1.1 Vad som redan är modulärt / data-styrt
- **Config-overrides funkar redan.** Både servern (`server/server.js:383`) och klienten (`src/ui.js:61`) gör `new EcoLoco(manifest.config)`, och motorn mergar `{ ...DEFAULT_CONFIG, ...config }` (`spec/engine.js:164`). **Allt i `DEFAULT_CONFIG` kan redan överstyras från `spec/assets.json → config` utan att röra motorn** — `rounds`, `timerSec`, `timerSecEarly`, `earlyRounds`, startresurser, trösklar, alla förslagsbelopp, `powerFromRound`, `extraProposalsPerRound` m.m.
- **`spec/assets.json`** håller redan: `config`-overrides, `onboarding`-video, `buildings` (namn + filer), `slots` (kartkoordinater), `audio`-manifest, och ett `areas`-block (som dock motorn idag **ignorerar** — se 1.3).
- **`spec/slutdel.js`** är redan ren data + en byggfunktion (podiefrågor, reveal-kort). Mönstret ("Josef/Klara redigerar direkt här, inget i logiken") är exakt det vi vill ha för förslag/händelser.
- **`config.mode`** (`tutorial | selfplay | gm`) finns och styr onboarding-lagret, aldrig regler (`src/ui.js:1388`, RAMVERK §3).

### 1.2 Vad som är HÅRDKODAT i motorn och måste ut (`spec/engine.js`)
| Hårdkodat | Rader | Blir till |
|---|---|---|
| `MATERIAL_HAND` / `PENGAR_HAND` | 131–140 | byggnadsbank (kostnad/inkomst/påverkan) |
| `NAMES` | 141–146 | → `content/buildings.js` [KLAR] |
| `MATERIAL_HAND`/`PENGAR_HAND` | 131–140 | → `content/buildings.js` [KLAR] |
| `EVENTS` + `EVENT_CONFIG` | 110–120 | → `content/events.js` [KLAR] |
| `AREAS` | 94–99 | **STANNAR i core** (fast grundstruktur, ev. `core/companies.js`) — ej bank |
| `EXTRA_PROPOSAL_POOL` | 89–90 | → `content/proposals.js` (Etapp 2b) |
| `_resolveProposal` if/else-kedjan | 300–441 | **effektsystem** (deklarativa effekter) — se §4 (Etapp 2b) |
| `_eventTargets` selektorer | 655–667 | delat selektor-system (politik + dilemman + händelser) (Etapp 2b) |

### 1.3 Beroenden som gör detta känsligt (viktigaste migrationsrisken)
`AREAS`, `handFor`, `EVENTS`, `EVENT_CONFIG` importeras som **named exports på ~8 ställen**, inte bara internt i motorn:
`src/ui.js`, `src/map.js`, `server/server.js`, `tools/simulera.js`, `spec/mock-opponents.js`, `strateg/server/game-numbers.js`, samt refereras i `spelledare.html`, `trailer.html`, `spec/slutdel.js`.

→ Flyttar vi innehåll ut ur motorn **kan vi inte bara ta bort de exporterna** — varje konsument går sönder. Migreringen måste antingen (a) behålla dem som kompatibilitets-shims som läser från den laddade banken, eller (b) uppdatera alla konsumenter. Flera av dem (ui.js, map.js) importerar **statiskt vid modul-load**, innan en motorinstans finns → banken måste gå att läsa fristående, inte bara via `engine.`.

### 1.4 Kontraktet som MÅSTE bevaras (RAMVERK §2 + ARCHITECTURE.md)
- **Actions in:** `start, selectCard, transfer, openProposal, vote, endRound, reset` (+ GM: `chooseEvent, resolveEventDecision, pengaslapp`).
- **Events ut:** `start, roundStart, build, trade, proposalOpened, proposalResolved, income, ohalsa, award, event, crisis, roundReplay, roundEnd, gameEnd`. Dessa relä-broadcastas (`server.js:393`) OCH tappas till persist (`server.js:400`) OCH listas i `FWD` i `src/ui.js`. **Payload-formen får inte ändras** utan att alla tre ställen uppdateras.
- **Interna ID:n heliga:** `aker/skog/tundra/stad` (MQTT/rigg/firmware). Ändra aldrig.
- **Server auktoritativ, klienter statslösa, full state-rebuild vid reconnect.** Motorn DOM-/nät-/MQTT-fri.
- **Inga nya npm-beroenden** (bara `ws`). Offline/LAN-först.

---

## 2. MÅLARKITEKTUR — fyra lager (Steg 2)

```
A. CORE ENGINE   — exekverar regler + state + FAST grundstruktur (företag/områden/ID, pengar/
                   material/kapital, öhälsa). INGET versionsspecifikt/utbytbart innehåll. Ingen DOM/nät/MQTT.
B. CONFIG        — per variant: vilka funktioner på, hur spelet körs (tid, antal, trösklar, decisionSystem).
C. CONTENT BANKS — byggnader + TRE beslutsrelaterade banker: politik, händelser, dilemman. Ren data.
D. MODULES       — valfria mekaniker (trade, upgrades, dependencies, prod-stopp, gm-events).
```

**Nyansering 2026-11-11 (Josef):** motorn ska vara fri från *versionsspecifikt och utbytbart* innehåll —
men spelets **fasta grundstruktur** får bo i Core. De fyra företagen, deras områden, interna ID:n
(aker/skog/tundra/stad), kopplingen företag↔område↔rigg, samt pengar/material/kapital/öhälsa är
identiska i alla tre versioner → de görs INTE till en konfigurerbar bank. (Företags- och
områdesdefinitionerna får gärna flyttas till `spec/core/companies.js` för renare struktur, men det är
inget krav.) Byggnader, produktion och balansvärden ska däremot fortfarande kunna variera per version
→ innehållsbank/config.

**Tre logiska innehållsbanker för beslut/situationer** (justerat 2026-11-11 — dilemman är en EGEN bank, inte en politik-kategori):
1. **Politik** — direkta beslut, framtida beslut, investeringar. Används i Ö-rådet när `decisionSystem = politics`.
2. **Händelser** — öhälsostyrda, företagsstyrda, spelledarstyrda. Utlöses löpande, inte i Ö-rådet.
3. **Dilemman** — berättelsedrivna situationer med alternativa utfall (erbjudande/kris/möjlighet/konflikt). Återanvänds i två sammanhang (se §3.4).

Motorn tar emot ett **sammansatt spelpaket** = `defaults ⊕ variant-config ⊕ content-banker ⊕ aktiva moduler`, och exekverar det. Den vet inte vad "Mellan" är — den kör det paket den fått.

### 2.1 Föreslagen mappstruktur (anpassad till repots nuvarande `spec/` + `src/`)
Josefs konceptuella träd (`src/core/`, `src/config/`…) är bra, men repot har idag motorn i `spec/` importerad som `../spec/engine.js` på många ställen. För att **minimera path-churn** (= trasiga imports) föreslår jag att bygga ut `spec/` i stället för att flytta allt till `src/core/`:

```
spec/
  engine.js            ← CORE: behålls på samma path (alla imports överlever). Fast grundstruktur kvar.
  core/
    companies.js       ← FAST: aker/skog/tundra/stad (= AREAS). Grundstruktur, ingen bank. (flytt valfri)
  effects.js           ← effektsystem: tolkar deklarativa effekter (delas av politik + dilemman + händelser)
  selectors.js         ← lag-selektorer (yesVoters, richest, sector, greenest, worstPolluter, …)
  loader.js            ← bygger spelpaketet: defaults ⊕ variant ⊕ content ⊕ moduler, + validering
  config/
    defaults.js        ← nuvarande DEFAULT_CONFIG (ren baslinje, ingen version)
    variants/
      flash.js         ← 4 år, feature-flaggor, urvalsregler, innehållsurval
      mellan.js        ← 8 år  (= dagens beteende, men nu EXPLICIT, inte motor-default)
      skola.js         ← 10 år, avancerade moduler på
  content/
    buildings.js       ← byggnadskatalog (ersätter MATERIAL_HAND/PENGAR_HAND/NAMES)   [KLAR Etapp 1]
    events.js          ← HÄNDELSEbank: öhälso-/företags-/gm-styrda (ersätter EVENTS/EVENT_CONFIG)  [KLAR Etapp 2a]
    proposals.js       ← POLITIKbank: direkt/framtida/investering (ersätter EXTRA_PROPOSAL_POOL + grund-3)
    dilemmas.js        ← DILEMMAbank: berättelsedrivna situationer med alternativa utfall (egen typ, se §3.4)
    slutdel.js         ← finns redan (flyttas hit, oförändrad)
    story.js           ← intro/uppdragsinramning per variant (valfritt, senare)
  modules/
    trading.js         ← handel (Mellan/Skola på, Flash av)
    upgrades.js        ← byggnadsuppgraderingar (Skola)
    dependencies.js    ← byggnadsberoenden (Skola)
    production-effects.js ← driftkostnad / produktionsstopp / långsiktiga effekter (Skola)
  mock-opponents.js    ← finns (uppdateras att läsa banken i stället för handFor-exporten)

src/                   ← OFÖRÄNDRAT lager: ui.js, net.js, map.js, audio.js, rigg.js, mqtt.js, icons.js …
server/                ← OFÖRÄNDRAT: server.js, persist.js (utom variant-val, se §5)
```

**Gräns mot överfragmentering (Josefs varning):** grundläggande mekanik (bygga, byta, öhälsa, bokslut, politik-röstning, vinstvillkor) ligger i **core**, styrs av **config-flaggor**. En egen **modul** blir det bara när mekaniken har eget state/egen logik som en version kan sakna helt (handel, uppgraderingar, beroenden, produktionseffekter). En enskild regel-ratt (t.ex. "grön satsning gratis för pank") blir en **config-flagga**, inte en modul.

### 2.2 Variant vs mode — två skilda dimensioner
- **variant** = `flash | mellan | skola` → vilket spel som byggs (år, innehåll, moduler, urvalsregler).
- **mode** = `tutorial | selfplay | gm` → hur det faciliteras (onboarding/ceremoni/spelledare). Rör **aldrig** regler.
De kombineras fritt: t.ex. `variant=flash, mode=selfplay` eller `variant=mellan, mode=gm`.

---

## 3. EXEMPEL-DATASTRUKTURER (Steg 2, deliverable 4)

### 3.1 Byggnad (`content/buildings.js`)
Ersätter `MATERIAL_HAND`/`PENGAR_HAND`/`NAMES`. Samma balansvärden som idag bevaras.
```js
{
  id: 'aker_gron',          // stabilt ID (= dagens card.asset, matchar assets.json buildings-nyckel)
  company: 'aker',          // internt region-ID — ÄNDRAS ALDRIG
  tier: 'gron',             // smutsig | standard | gron (byggnadskategori)
  namn: 'Ekologiskt jordbruk',
  cost:       { pengar: 14, material: 10 },   // = kp/km idag
  production: { pengar: 0,  material: 5  },   // = gp/gm idag (passiv inkomst/år)
  impact: 3,                // = oh idag (engångs öhälso-effekt)
  asset: 'assets/aker_gron.png',
  variants: ['flash','mellan','skola'],       // var byggnaden är tillgänglig
  // framtida (Skola), tomt/ignoreras tills modulerna finns:
  dependsOn: [],            // byggnadsberoenden (modules/dependencies)
  upgradesTo: null,         // byggnadsuppgradering (modules/upgrades)
}
```

### 3.2 Politiskt förslag (`content/proposals.js`)
Ersätter `EXTRA_PROPOSAL_POOL` + grund-3 + if/else-grenen. Effekterna blir **data** (§4). Ja/nej-omröstning.
`category` är nu bara `direkt | framtida | investering` — **dilemma är INTE längre en förslagskategori** (egen bank, §3.4).
```js
{
  id: 'krispaket',
  namn: 'SOS Krispaket',
  beskrivning: 'Ja-röstare satsar tillsammans för att vända krisen.',
  category: 'direkt',                  // direkt | framtida | investering
  variants: ['mellan','skola'],        // vilka versioner det kan dyka upp i
  condition: { ohBelow: 20 },          // villkor för att få presenteras (annars filtreras bort)
  repeatable: false,
  effects: [                           // tolkas av effektsystemet (§4)
    { type:'resource', target:'yesVoters', pengar:-15, floor:0 },
    { type:'ohalsa',   value:+28, when:'immediate' }
  ]
}
```

### 3.3 Händelse (`content/events.js`)
Ersätter `EVENTS`/`EVENT_CONFIG`. Skiljer **innehåll / utlösare / effekter** (Josefs princip §3).
```js
{
  id: 'skogsbrand',
  rubrik: 'Det brinner i Björnens skogar',
  text: 'Elden frågade inte om lov…',
  trigger: 'company',          // ohalsa | company | random | gm   (utlösartyp)
  triggerCond: { area:'skog' },
  target: 'omrade:skog',       // samma selektor-språk som förslag (§4)
  effects: [
    { type:'resource', target:'omrade:skog', material:-15, floor:0 },
    { type:'ohalsa',   value:-8 }
  ],
  ljud: 'assets/audio/rigg/event_skogsbrand.mp3',
  variants: ['flash','mellan','skola']
}
```
### 3.4 Dilemma (`content/dilemmas.js`) — egen bank, återanvänds i två sammanhang
Ett dilemma är en berättelsedriven situation med **alternativa utfall** (inte ja/nej). Samma
dilemma-innehåll återanvänds i Flash och Mellan/Skola — **inte separata kopior**.
```js
{
  id: 'koncernerbjudande',
  rubrik: 'Ett erbjudande ni knappast kan tacka nej till',
  text: 'En vänligt sinnad koncern vill investera i ön — mot att vi blundar för lite smuts.',
  storyTag: 'erbjudande',              // erbjudande | kris | möjlighet | konflikt (+ ev. förhandling)
  variants: ['flash','mellan','skola'],
  bild: 'assets/dilemma/koncernerbjudande.png',
  alternativ: {
    A: { namn:'Ta pengarna', effects:[ {type:'resource',target:'all',pengar:+15}, {type:'ohalsa',value:-6} ] },
    B: { namn:'Tacka nej',   effects:[ {type:'ohalsa',value:+2} ] }
  }
}
```
**Två sammanhang, samma innehåll:**
- **Flash** (`decisionSystem = dilemma`): dilemman **ersätter helt** den vanliga politiken under Ö-rådet.
  Varje år hämtas automatiskt ett dilemma ur banken; alla företag röstar om alternativen (A/B).
  Flash använder **inte** politikbanken.
- **Mellan / Skola** (`decisionSystem = politics`): Ö-rådet kör den vanliga politikbanken (§3.2).
  Dilemman förekommer i stället som **spelledarstyrda händelser** som GM kan aktivera vid behov.

**Arkitekturprincip:** motorn har inga hårdkodade versionsvillkor. `config.decisionSystem`
(`dilemma | politics`) avgör vilket beslutsflöde Ö-rådet kör. Politik och dilemman **delar**
gemensamma funktioner för omröstning, villkorskontroll och effektverkställning (§4) — bara
**urval och presentation** skiljer (ja/nej mot A/B; auto-draw mot ordförande-väljer).

---

## 4. EFFEKTSYSTEM — hjärtat i refaktoreringen

Idag är varje förslag ett `else if`-specialfall (`engine.js:321–429`). Målet: motorn tolkar **deklarativa effekter** så nytt innehåll inte kräver ny motorkod.

**Selektorer** (ur dagens `_eventTargets` + förslagslogik, samlade i `selectors.js`):
`all, yesVoters, richest, twoRichest, twoPoorest, greenest, worstPolluter, sectorPengar, sectorMaterial, omrade:<id>`.

**Effekt-typer** (täcker ~alla dagens förslag/händelser):
```
resource        { target, pengar?, material?, egenValuta?, floor?:0 }
pot             { from:<selector>, amountEach, to:<selector> }         // samla in → dela ut
ohalsa          { value, when:'immediate'|'bokslut' }
buildRestriction{ scope:'all'|'dirty'|'dirtySector', sector?, duration:'thisRound'|'nextRound' }
buildDiscount   { material, duration }
condition       { yesCount?:n, ohBelow?:n }   // gate på en hel effekt-lista (t.ex. marknadsavtal = exakt 3 ja)
```
**Escape-hatch:** det som inte ryms deklarativt får `handler:'<id>'` → en funktion i en **modul**, inte i core. Så advancerade/långsiktiga effekter (produktionsstopp över år, byggnadsberoende utfall) läggs till utan att röra effekt-tolken.

Detta låter oss uttrycka alla dagens 15 extra-förslag + grund-3 som data. Mekaniken (rösträkning 3/4, maktrotation, ordförande väljer) ligger kvar i core — det är *spelstruktur*, inte innehåll.

**Politik och dilemman delar detta system.** Omröstning, villkorskontroll (`condition`) och effektverkställning (effekt-typerna ovan) är gemensamma. Skillnaden ligger bara i *urval* (politik: ordförande väljer 1 av N via `politics.mix`; dilemma: auto-draget 1/år via `storyRotation`) och *presentation* (ja/nej mot A/B-alternativ). `config.decisionSystem` väljer vilket flöde Ö-rådet kör — motorn har inga versionsvillkor.

---

## 5. HUR VERSIONERNA KONFIGURERAS (Steg 2, deliverable 5)

En **variant-config** väljer funktioner + urvalsregler, inte innehåll (innehållet ligger i bankerna, filtrerat på `variants[]`).

```js
// config/variants/flash.js
export default {
  rounds: 4, timerSec: 90,
  phases: { bygga:90, prisutdelning:20, politik:10 },   // tid per fas (se risk §6.1)
  trade: false,                                          // modules/trading av
  decisionSystem: 'dilemma',                             // Ö-rådet kör dilemma-banken, inte politik
  dilemma: { perRound:1, pickBy:'auto',                  // ett auto-draget dilemma/Ö-råd
             storyRotation:['erbjudande','kris','möjlighet','konflikt'] },
  events: { triggers:['ohalsa'] },                       // bara öhälsostyrda kriser
  modules: [],
  intro:'flash', slut:'flash'
}

// config/variants/mellan.js  (= dagens beteende, nu explicit)
export default {
  rounds: 8, timerSec: 120,
  phases: { bygga:100, prisutdelning:30, politik:60 },
  trade: true,
  decisionSystem: 'politics',                            // Ö-rådet kör politikbanken
  politics: { pickBy:'rotation', perRound:5,             // ordförande väljer 1 av 5
              mix:{ direkt:2, framtida:1 } },            // kategorikvot — EJ låst, justeras fritt här
  events: { triggers:['ohalsa','company','gm'] },        // dilemman kan aktiveras som gm-händelse
  modules: ['trading'],
  intro:'mellan', slut:'mellan'
}

// config/variants/skola.js
export default {
  rounds: 10, timerSec: 180,
  phases: { bygga:180, prisutdelning:30, politik:60 },
  trade: true,
  decisionSystem: 'politics',
  politics: { pickBy:'rotation', perRound:5,
              mix:{ direkt:2, framtida:1, investering:1 } },  // kategorikvot ännu ej fastställd — config-styrd
  events: { triggers:['ohalsa','company','gm'], longTerm:true },
  modules: ['trading','upgrades','dependencies','production-effects'],
  intro:'skola', slut:'skola-analys'
}
```

**Kategorifördelningen är inte låst** (justering 2026-11-11): `politics.mix` anges per variant, så
vi kan ändra Mellan/Skola-fördelningen utan att röra motorn. `decisionSystem` avgör om Ö-rådet drar
ur politik- eller dilemma-banken.

**Innehållsurval i variant-config, inte per objekt** (Josefs preferens 2026-11-11): vilket innehåll
en version använder definieras hellre i respektive `variants/*.js` (t.ex. `buildings.include`,
`proposals.include`/kategorifilter) än genom att varje innehållsobjekt måste bära `variants[]`. Då
slipper vi uppdatera hela banken när en version ändras. Byggnadsbankens nuvarande `variants[]`
behålls tills vi bygger det gemensamma urvalssystemet (Etapp 4), sen kan det ersättas.

**Urval ur banker** (`systems`-lagret): urvalet drar slumpmässigt **inom ramar** (kategorikvoter ur
`politics.mix` / dilemmats `storyRotation` + `variants[]` + `condition`-filter mot speltillståndet),
inte en fast sekvens. `event-trigger` matchar händelser mot utlösare. Alla stödjer **seed**
(reproducerbar testkörning, som golden-testet) + **logg** av vad som valdes och varför.

**Val av variant i drift (ingen omstart):**
- Servern håller `variant = 'mellan'` (default), läses i `newEngine()` (`server.js:382`). `loader.js` bygger paketet för vald variant.
- Spelledarpanelen får ett nytt `gmcmd`-kommando `{ cmd:'variant', val:'flash' }` → sätter `variant` → nästa `newEngine()` (vid omstart till lobby) bygger nya paketet. Byte sker **mellan omgångar**, kräver varken kod eller NUC-omstart.
- Klienten får `variant` i `hello-ack` precis som den får `config` idag (`server.js:785`).

---

## 6. RISKER FÖR BEFINTLIGA FUNKTIONER (Steg 2, deliverable 6)

1. **Fas-timers ligger delvis i servern, inte i motor-config.** "Bygga 100s" = `timerSec` (✓ config), men "Prisutdelning 30s" (`CEREMONY_STEP_MS`) och "Politik 60s" (politik-timers) är **konstanter i `server.js`**. För config-styrd tid per fas måste de läsa från `phases`. Liten men nödvändig ändring.
2. **Named-export-kontraktet (1.3).** `AREAS/handFor/EVENTS/EVENT_CONFIG` på ~8 ställen. Plan: behåll dem som **kompat-shims** i engine.js som läser den laddade banken, migrera konsumenter stegvis, ta bort shims sist. Annars bryts ui/map/server/simulera/strateg på en gång.
3. **`strateg/server/game-numbers.js`** importerar `DEFAULT_CONFIG, AREAS, EVENT_CONFIG, EVENTS, handFor` för spelcoachens siffror. Måste pekas om mot banken/paketet.
4. **`assets.json areas` ignoreras idag** medan motorns `AREAS` används — två sanningar. Under migreringen ensas de till `content/companies.js` (RAMVERK §3: `AREAS.farg` är sanningen för färg).
5. **Event-payload `bild: 'assets/event_' + ev.id + '.png'`** byggs i motorn (`engine.js:632,648`). Stannar som datafält i banken i stället — annars läcker presentations-logik in i core (bryter §6-principen "regler ≠ presentation").
6. **Persist/summary** (`server/persist.js`) läser eventströmmen. Byter en events payload-form → kontrollera att summaryn (röster/byten/utfall för v.50-utvärderingarna) fortfarande får sitt.
7. **RAMVERK måste uppdateras** när motorns innehåll flyttas — arkitektur-kartan §1 och invariant 1 ("balans i engine.js") formuleras om: sanningen flyttar till content/config, motorn blir tolk.

---

## 7. MIGRATIONSORDNING — testbara etapper (Steg 2, deliverable 7)

Varje etapp: `node --check` på allt + `tools/simulera.js` ger **identiskt** utfall före/efter (balansen oförändrad) + manuellt `?online=1`-parti. Bevara exakt beteende tills versionssystemet läggs på.

- **Etapp 0 — Golden-test. ✅ KLAR (2026-11-11).** `tools/golden-test.js` kör ett deterministiskt parti (seedad Math.random, scriptade actions) och jämför HELA eventströmmen + slut-state mot `tools/golden/mellan-baseline.json`. Nätet under alla följande etapper.
- **Etapp 1 — Byggnader ut. ✅ KLAR (2026-11-11).** `MATERIAL_HAND/PENGAR_HAND/NAMES` → `spec/content/buildings.js` som strukturerad data (id/region/tier/cost/production/impact/variants). `handFor()` kvar som oförändrad bro (tillfällig shim). Golden-test grönt, `node --check` på alla motor-konsumenter grönt, `simulera.js` kör.  *(Nästa banker: händelser, områden, sen politik/dilemman.)*
- **Etapp 2a — Händelser ut. ✅ KLAR (2026-11-11).** `EVENTS/EVENT_CONFIG` → `spec/content/events.js` verbatim, re-exporterade från engine.js (tillfällig shim) så server.js/strateg importerar oförändrat. Nytt riktat golden-scenario (`events`-baseline) forcerar alla 8 händelser inkl. röst-vägen (sponsrat) + alla selektorer. Båda golden-scenarier grönt, `node --check` grönt. *Företag/områden stannar i core (Josefs nyansering) — flyttas ej denna etapp.*
- **Etapp 2b–A — Effektsystem + politikbank. ✅ KLAR (2026-11-11).** `_resolveProposal`-kedjan (142 rader if/else) → `spec/content/proposals.js` (18 jämbördiga förslag som data) + `spec/effects.js` (resolver: selektorer, `resource`/`pot`/`ohalsa`/`buildRestriction`/`buildDiscount`, conditions). Belopp läses ur cfg → inga balansvärden ändrade. Separerat eligibility (metadata, ej inkopplat än) / conditions / effects. Öhälso-timing explicit (`when:'immediate'`). Nytt riktat golden-scenario (`proposals`-baseline) pinnar alla 18 förslags resolution. Alla tre golden-scenarier grönt. *URVALET oförändrat (grund-3 + slumpad pool) — det ändras i Steg B.*
- **Etapp 2b–B — Config-styrt urval. ✅ KLAR (2026-11-16, config-gated).** Generell urvalsmotor i `spec/systems/proposal-selector.js` (ren funktion): alla förslag jämbördiga, `politics.proposalCount` + `selection.quotas` + `fillRemaining` + `selection.tags` styr urvalet; eligibility filtrerar mot speltillståndet; seedbar/reproducerbar (`cfg.seed`); bank-ordnings-oberoende (kanon-sortering); varnar vid otillräckligt antal. Tre begrepp separerade i banken: **category** (mekanisk: direct/future/investment) / **tags** (beskrivande: environment/economy/crisis) / **eligibility** (presentationsvillkor). Riktat test `tools/selection-test.js` (24 assertions). **CONFIG-GATED:** aktivt bara när varianten anger `politics.proposalCount`/`selection` — annars körs legacy (grund-3 + extra) oförändrat, så live-spelet, UI/bots och de tre gamla golden-baselines är opåverkade (ej överskrivna). Effekt-resolutionen oförändrad (`proposals`-golden grönt).
  - *Avsiktlig beteendeförändring, ej live än:* legacy-vägen är kvar tills vi FLIPPAR över variant-configarna. Live-flippen kräver ett UI/bot-pass: `src/ui.js` (`visibleProps` visar `[...GRUND_PROPS, ...extra]` → ska visa `S.proposalChoices`; alla 18 har redan render-kort) + bot-ordförandens `pickBotProposal` (hårdkodar grund-3 → ska välja ur `proposalChoices`) i `src/ui.js` + `server/server.js`. Gör i avstämning.
- **Etapp 2c — Dilemmabank + `decisionSystem`. ✅ KLAR (2026-11-16, config-gated).** `spec/content/dilemmas.js` (4 exempel-dilemman, preliminär balans): id/namn/text/category(berättelsetyp)/tags/eligibility + `alternativ.A/B` med egna effektlistor. Delar effekt-resolvern (utökad: `ohalsa` tar nu även literalt `value`, inte bara `cfgKey`) och urvalsmotorn (`selectProposals` över DILEMMAS). `config.decisionSystem` ('politics'|'dilemma') styr Ö-rådet via dispatchern. Nya engine-actions: `openDilemma(id, by?)` + A/B-gren i `vote` + `_resolveDilemma` (flest röster, 2–2→A); gemensam öhälso-svans (`_applyQueuedOhalsa`) delas av politik + dilemma. **Samma dilemma via två vägar:** Flash auto-urval (`_rollRoundDilemma`) och GM-aktivering (`openDilemma` direkt) → samma resolution (verifierat). Nya events `dilemmaOpened`/`dilemmaResolved` (ännu ej i server-relä — del av UI/bot-passet). Riktat test `tools/dilemma-test.js`. **CONFIG-GATED:** aktivt bara när varianten sätter `decisionSystem:'dilemma'` eller `politics.*`; legacy Mellan orörd, golden grönt.
- **Etapp 3a — Versionskonfigurationer. ✅ KLAR (2026-11-16).** `spec/config/variants/{flash,mellan,skola}.js` + `index.js` (register + `loadVariant`). Tre jämbördiga configar (ingen är motorns standard), styr: år (4/8/10), timers/`phases` (⚠ preliminära), `decisionSystem` (flash=dilemma, mellan/skola=politics), urval (`politics.proposalCount`/`selection` el. `dilemma.perRound`), `features`/`modules`/`content` (framåtblickande, EJ konsumerade av motorn än). Motorn läser rounds/timerSec/decisionSystem/urval direkt; inget engine-edit behövdes. Riktat test `tools/variants-test.js` (laddning, fullständighet, konsekvens, samma motor). ⚠-markerade värden behöver avstämning (fas-tider, kvoter, Skola-rundantal, trigger-filter). **Ej kopplat till servern** → live-Mellan legacy, golden grönt. *Skolas modules deklareras men är EJ implementerade.*
- **Etapp 3b — Aktivera versionerna (större UI/bot/server-pass).** Stegvis, test mellan varje:
  - **Slice 1 — Server: versionsval. ✅ KLAR (2026-11-16).** `server/variant-config.js` (`buildEngineConfig`/`isValidVariant`, testbar); `selectedVariant`/`runningVariant` i server.js; gmcmd `variant` (val för nästa parti); `newEngine()` låser partiets version via `buildEngineConfig` → byte rör inte pågående parti; `variant`-info i varje `send()`; `net.variant` i net.js; VERSION-kort i `spelledare.html` (4 knappar + status). Test `tools/variant-select-test.js` (giltighet, config-bygge, motor-genomslag, pågående parti orört). Default = legacy → live-Mellan oförändrad, golden grönt. ⚠ panel-UI ej browser-verifierat.
  - **Slice 2 — UI: politik läser spelstatus. ✅ KLAR (2026-11-16).** `src/ui.js` `visibleProps()` visar `S.proposalChoices` (de facto valda förslagen, inga hårdkodade grund-3) när nya urvalet är på; legacy-fallback (`[...GRUND_PROPS, ...extraProposals]`) kvar när `proposalChoices` saknas → live-Mellan oförändrad. Ordförande-väljaren + ja/nej-röstningen är redan generiska (alla 18 har render-kort). node --check + full regression grön. ⚠ ej browser-verifierat; bot-ordförande i variant-läge kommer i Slice 3.
  - **Slice 3 — Bottar. ✅ KLAR (2026-11-16).** Ny `spec/bot-policy.js` (ren, version-agnostisk, INGA hårdkodade förslags-id:n): `botPickProposal` väljer ur `engine.allowedProposals()` (ny motor-metod = enda källan: proposalChoices / legacy grund-3+extra) med environment-preferens vid kris (tags); `botVoteProposal` röstar ja/nej utifrån förslagets effekter + öhälsa; `botChooseDilemma` röstar A/B (kris → bäst för ön). Wirat i server (`botMaktproposal`, `botOrdforandeLay`), `mockOpponentsVote` (ja/nej + A/B + event) och `src/ui.js pickBotProposal`. Riktat test `tools/bot-policy-test.js` (val inom tillåtna i legacy + variant, metadata-preferens, A/B, källkods-scan att inga hårdkodade id:n finns kvar i bot-logiken). Full regression grön. *Bot STRATEGI (val + röstning) är nu generisk/effekt-baserad i stället för per-id — regler/balans/utfall oförändrade; golden opåverkat (de använder fasta röstmönster).*
  - **Slice 4 — Dilemma-flöde (Flash Ö-råd). ✅ KLAR (2026-11-16).** Server: Ö-råds-dispatcher `startOrad()` (decisionSystem avgör politik vs dilemma); `startDilemma`/`tickDilemma`/`endDilemma`/`forceDilemmaVotes` auto-presenterar rundans dilemma → A/B-röstning (bot-delay 8 s + timeout) → `endDilemma` återanvänder `politicsDone`-flödet för årsbytet; `dilemmaOpened`/`dilemmaResolved` tillagda i relä + persist; vote-handlern skickar A/B för dilemma. Klient: `openDilemmaModal` återanvänder röst-overlayn (`ov-vote`) med A-knapp/B-knapp, `game.on('dilemmaOpened'/'dilemmaResolved')`, A/B i `renderVoteState`, reconnect mitt i dilemma via `dilemmaById`, FWD-listorna utökade, `net.vote` tar A/B. Riktat test `tools/dilemma-flow-test.js` (routing + auto-draget dilemma + bot-A/B + verkställt utfall + event). Mellan/Skola politik oförändrad.
  - **Slice 4b — Kombinerad beslutspool (original-dilemmat). ✅ KLAR (2026-11-16).** Flashs Ö-råd drar nu ur en KOMBINERAD pool: A/B-dilemman (`dilemmas.js`) + ALLA `'rost'`-erbjudandehändelser (`events.js`) — framtida rost-händelser ingår automatiskt (inga manuella id:n). `sponsrat` (ursprungsdilemmat) förblir sin enda definition i events.js (individuell ja/nej, +15/−6 exakt oförändrat), ingen dubblering. Motor: `_decisionPool()` + `_rollRoundDecisions()` (ersätter `_rollRoundDilemma`; fält `S.decisionChoices = [{id,kind}]`), repeat-undvikande (filter-medvetet: tillåter upprepning bara om inget annat giltigt alternativ finns), `openOradDecision(choice)` presenterar rätt mekanik (dilemma→openDilemma, event→`_runEvent` ja/nej). Server: `startDilemma` hanterar båda, `proposalResolved` avslutar även Ö-råds-händelsen → året. Klienten renderar event-fallet via befintlig `openVoteModal`. De 4 exempeldilemmana markerade `preliminary: true` inför innehållsgranskningen (`koncernerbjudande` överlappar `sponsrat` tematiskt). Riktat test `tools/orad-decision-test.js` (kombinerad pool, sponsrat individuella effekter, år avslutas, repeat-undvikande). Full regression grön. ⚠ klient-UI (A/B + event i Flash Ö-råd) ej browser-verifierat.
  - **Slice 5 — GM-dilemma under byggfasen. ✅ KLAR (2026-11-16).** Server: `autoPaused`-flagga (skild från manuell `paused`) fryser byggtimern + idle-vakten; `selectCard`/`tradeOffer` blockeras under auto-paus; gmcmd `dilemma {id}` → `startBuildDilemma` (öppnar A/B mitt i byggfasen, auto-paus, bot/timeout-röstning via befintlig tickDilemma/forceDilemmaVotes); `dilemmaResolved` → `endBuildDilemma` (visar resultat 2,5 s → återupptar). **Manuell/auto-paus-distinktion:** `endBuildDilemma` broadcastar `paused: paused` → återupptar BARA om spelledaren inte också pausat manuellt. Befintligt händelsesystem (valjEvent/event/chooseEvent) + 'rost'-ja/nej helt orört. Panel: DILEMMA-kort (dropdown ur `dilemmaKatalog` + AKTIVERA, aktiv bara under byggfasen). Klienten renderar A/B via Slice 4-overlayn. Riktat test `tools/build-dilemma-test.js`. Ingen omkategorisering av händelser (kategorierna sätts i den kommande innehållsgranskningen). ⚠ server-/panel-UI ej browser-verifierat.
  - **Klick-lås (3 s).** När en händelse/omröstning/dilemma dyker upp ignoreras klick i 3 s (`clickOrTimeout` lockMs + röst-knapps-lås `armVoteLock`) så ett pågående klick i t.ex. bytesfönstret inte råkar klicka bort den. CSS `.clicklock` i spel.html.
  - **Slice 6A — Versionsstyrning färdig (fas-timers ur config + funktions-gater). ✅ KLAR (2026-11-16).** Servern hämtar fas-timers ur `cfg.phases` via `phaseTimers()` (variant-config.js): `roundFull`→`phases.bygga`, propose/vote→`phases.politik` (politics: delas 50/50; dilemma: hela budgeten→A/B-rösten), ceremoni-steg→`phases.prisutdelning`/antal steg. Legacy (ingen `phases`) → nuvarande konstanter oförändrat. Handel gatas av `features.trade` (engine `transfer` — Flash av, Mellan/Skola/legacy på). decisionSystem/år redan per config. Riktat test `tools/phase-timers-test.js`. **Avvikelser rapporterade:** (a) Mellan-variantens bygga=100 (schema) vs Standard 120 — Standard/legacy orört, Mellan-varianten spelar 100 (bekräfta); (b) ceremoni nu total-tid/antal-steg i stället för fast 5 s/steg (bara varianter); (c) Flash politik 10 s = A/B-röstens tid. Legacy golden grön. ⚠ ej browser-verifierat; UI döljer ännu inte byt-knappen i Flash (gaten blockerar serverside).
  - **Tutorial — minimal versionsanpassning. ✅ KLAR (2026-11-18).** Övningsmotorn (`makeTutorial`) byggs nu med VALD variants config (via `runTutorial` → `VARIANTS[net.variant.selected]` merge), så år/tröskel/beslutssystem/regler följer versionen. Övningsekonomin 26/26 behållen (garanterar bygg/byt-stegen). Intro-texternas årtal + öhälsogräns är dynamiska (`cfg.rounds`/`cfg.threshold`) — övrig text/dramaturgi/stegordning/Ö-rådsintro OFÖRÄNDRAD (större omarbetning uppskjuten: mindre text, snabbare, för yngre barn). Riktat test `tools/tutorial-config-test.js` (config-genomslag + bygg/byt/avsluta-år i alla tre + övergång = samma årtal som riktiga partiet). Fixade även en pre-existerande flakighet i dilemma-flow-testet (auto-händelse i örådet → `autoEventAtStart:false`, speglar servern).
  - **Slice 6B — Legacy borttaget. ✅ KLAR (2026-11-16).** Motorns legacy-urval helt bort: `_useSelection`-gaten, `_rollExtraProposals`, grund-3-undantaget i `_proposalAllowed`/`allowedProposals`, `extraProposals`-state, `extraProposalsFromRound/PerRound`. `DEFAULT_CONFIG` har nu ett default-urval (`decisionSystem:'politics'`, `politics.proposalCount:5`) så en naken motor är config-styrd — alla 18 förslag jämbördiga. Server: `selectedVariant` default **'mellan'** (förvald standardversion; Flash/Skola jämbördiga valbara). Panel: STANDARD-knappen borttagen. UI `visibleProps` läser bara `S.proposalChoices` (ingen grund-3-fallback). Historiska golden-baselines (v1/v2) behållna orörda; ny aktiv `mellan-baseline-v3.json` (config-styrt urval). Alla 10 testsviter gröna; Flash/Mellan/Skola spelar hela partier oberoende. Tutorial oförändrad (görs om separat). ⚠ ej browser-verifierat.
- **Innehållsgranskning (separat etapp, EFTER tekniska migreringen).** Gå igenom alla förslag/dilemman/händelser: kategorier, tags, eligibility/triggers, när de får förekomma, repeterbarhet, vilka versioner, effekter (omedelbara/framtida), balans/variation, pedagogiskt/dramaturgiskt syfte. Kategorier/tags/kvoter är medvetet PRELIMINÄRA tills dess. Datastrukturen stödjer en samlad översiktsvy (alla banker har id/category/tags/eligibility) — byggs vid behov.
- **Etapp 3 — `config/defaults.js` + `variants/mellan.js`.** Lyft DEFAULT_CONFIG till `defaults.js`; gör Mellan till en *explicit* variant-fil (inte motor-default). `loader.js` bygger paketet. Mellan oförändrad.
- **Etapp 4 — Versionsval.** `loader` laddar flash/mellan/skola; `gmcmd variant`; klient får `variant`. Fas-timers (risk 6.1) blir config. Flash körbar (färre år, urval, inget trade).
- **Etapp 5 — Banker + moduler utbyggbara.** Stabilisera schema för förslag/händelser + modul-API (trading extraheras först som referensmodul). Lägg INTE till massa nytt innehåll/mekanik än — bara strukturen. Skola-modulerna (upgrades/dependencies/prod-effects) är stubbar med tydligt API.

---

## 8. TEKNISKA KRAV — hur de möts (brief §10)
- **Seed:** `loader` tar `seed`; `proposal-selector`/`event-trigger`/`_drawEvent` använder en seedbar RNG i stället för `Math.random()` (idag `engine.js:262,597` m.fl.). Ger reproducerbara testpartier.
- **Validering vid uppstart:** `loader` kontrollerar att varje bank-post har giltigt schema (ID unikt, effekt-typer kända, `variants[]` giltiga, company-ID ∈ aker/skog/tundra/stad) och vägrar starta annars.
- **Logg:** urvalssystemen loggar valda förslag/händelser + skäl (villkor/kategori) till persist-strömmen.
- **Full reset mellan omgångar:** `newEngine()` finns redan; variant-byte går via samma väg.
- **Testbart utan UI/nät:** motorn är redan ren (RAMVERK §2) — golden-testet (etapp 0) kör i Node.

---

## 9. Skilj: bevara / stödja / möjliggöra (brief §11)

| Status | Vad |
|---|---|
| **Befintligt — ska bevaras exakt** | Mellan-beteende, alla balansvärden, actions/events-kontraktet, interna ID:n, MQTT/rigg-sömmar, mock-opponents, reconnect, offline/LAN, GM-läge, slutdel, persist/summary. |
| **Beslutad struktur — ska stödjas** | Tre varianter på en motor; fasordning Intro→Tutorial→Bygga&byta→Prisutdelning→Politik→Resultat (Skola +slutdel); år/tider per `beslut.md` 2026-11-11; variant vald från spelledarpanelen utan omstart; vinstvillkor (kapital + öhälsa ≥ 60, kollaps vid 0); **tre banker (politik/händelser/dilemman); `decisionSystem` per variant (Flash=dilemma, Mellan/Skola=politics); samma dilemma-innehåll återanvänt som Ö-råds-beslut (Flash) och gm-händelse (Mellan/Skola); kategorifördelning config-styrd, ej låst.** |
| **Framtida — ska möjliggöras, ej byggas nu** | Stackade/beroende byggnader, driftkostnad, produktionsstopp, långsiktiga effekter, investeringsförslag, Skolas slutanalys, fler händelse-/förslagskategorier. Arkitekturen (moduler + effekt-escape-hatch) gör dem möjliga utan ny core. |

---

## 10. Beslutat / nästa

**Beslutat (2026-11-11):** Alternativ A (bygg ut `spec/`, flytta inte motorn). Golden-test + seed först.
Motorn töms på innehåll; alla tre varianter är jämbördiga content/config-lager. Tre banker +
`decisionSystem` per variant (§3.4). Etapp 0 + 1 genomförda.

**Nästa etapp (väntar på klartecken):** Etapp 2 — effektsystem + politik/dilemma-banker, ELLER
fortsätt flytta "enkla" banker först (händelser → områden) innan vi tar den klurigare politik/
dilemma-refaktoreringen. Öppen fråga att välja mellan innan vi kör vidare.
