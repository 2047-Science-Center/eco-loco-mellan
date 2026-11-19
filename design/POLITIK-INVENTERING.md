# Politik- och Ö-rådsinventering

*Rapport, ingen implementation. Skapad 2026-11-19 av Klara + Claude. Enbart analys — inga förslag,
effekter, balansvärden, urvalslogik, config-filer eller händelser har ändrats. Inget pushat.*

Syftet är att vi ska kunna gå igenom samtliga politiska förslag ett i taget och sedan besluta om
kategorier och fördelning mellan spelvarianterna. Belopp nedan läses live ur motorns
`DEFAULT_CONFIG` (`spec/engine.js`) via `cfgKey` — de citeras här, de ändras inte.

**Källor:** `spec/content/proposals.js` (banken), `src/ui.js` rad 1099–1124 (förslagstexterna),
`spec/engine.js` rad 30–123 (belopp + beslutssystem), `spec/systems/proposal-selector.js` (urvalet),
`spec/content/dilemmas.js`, `spec/config/variants/{flash,mellan,skola}.js`, `server/variant-config.js`,
`server/server.js` (politik-/dilemma-flödet).

---

## 1. Fullständig inventering av alla politiska förslag

**Antal verifierat mot koden: 18 förslag** i `PROPOSALS` (`spec/content/proposals.js`). Alla 18 är
jämbördiga poster utan särskild status (det tidigare "grund-3"-begreppet är borttaget i motorn,
"Slice 6B"). Tecken: 🪙 = pengar, 🧱 = material.

| # | ID | Namn | Fullständig text (UI) | Vilka företag/lag påverkas | Ekonomisk effekt | Öhälsa | Särskilda villkor | Kategori | Taggar |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `gron` | Grön satsning | "Alla som röstar JA betalar 8🪙. Öns hälsa går upp +14." | Ja-röstarna | Ja-röstare −8🪙 (golv 0) | **+14** | — (alltid valbart) | direct | environment |
| 2 | `skatt` | Miljöskatt | "Värsta boven (X) betalar 20🪙 som delas mellan de andra lagen." | Värsta förorenaren → övriga tre | Bov −20🪙, delas lika på övriga | 0 | — (alltid) | direct | economy |
| 3 | `forbud` | Förbjud smutsig | "Nästa år kan ingen bygga det smutsiga kortet." | Alla (byggbegränsning) | 0 | 0 | — (alltid) | direct | environment |
| 4 | `krispaket` | Krispaket (SOS) | "Alla som röstar JA betalar 15🪙 (eller allt man har). Går det igenom lyfts öns hälsa +28." | Ja-röstarna | Ja-röstare −15🪙 (eller allt, golv 0) | **+28** | **Eligibility: öhälsa < 20** (`krisProposalOh`) | direct | crisis, environment |
| 5 | `sektorskatt` | Sektorskatt | "Pengar-lagen betalar 12🪙 var som delas mellan material-lagen." | Pengar-sektorn → material-sektorn | Varje pengar-lag −12🪙 → delas på materiallagen | 0 | — | direct | economy |
| 6 | `solidaritet` | Solidaritetsskatt | "Rikaste laget (X) betalar 15🪙 + 10🧱 som delas mellan de tre andra." | Rikaste → tre andra | Rikaste −15🪙 −10🧱, delas lika | 0 | — | direct | economy |
| 7 | `lojalitet` | Grön utdelning | "Varje JA-lag får +6🪙, varje NEJ-lag betalar 8🪙. Öns hälsa +4." | Alla, efter röst | Ja +6🪙, Nej −8🪙 (golv 0) | **+4** | — | direct | environment, economy |
| 8 | `marknadsavtal` | Marknadsavtal | "Bonus +8🪙 till alla — men bara om exakt 3 av 4 röstar JA. En måste avstå." | Alla fyra | Alla +8🪙 | **+2** | **Condition: exakt 3 ja** (`yesCountEquals:3`) | direct | economy |
| 9 | `gronstod` | Riktat grönt stöd | "Alla som röstar JA betalar 8🪙 → hela potten går till grönaste laget (X)." | Ja-röstarna → grönaste | Ja-röstare −8🪙 → potten till grönaste | 0 | — | direct | environment |
| 10 | `grannskatt` | Grannskatt | "De två rikaste betalar 12🪙 var → delas på de två fattigaste." | Två rikaste → två fattigaste | Var och en av 2 rikaste −12🪙, delas på 2 fattigaste | 0 | — | direct | economy |
| 11 | `sektorblockad` | Sektorblockad | "Nästa år får motståndarsektorn inte bygga smutsigt." | En sektor (ej förslagsställarens) | 0 | 0 | — | **future** | economy |
| 12 | `allians` | Allians | "Varje JA-lag får +8🪙, varje NEJ-lag betalar 8🪙." | Alla, efter röst | Ja +8🪙, Nej −8🪙 (golv 0) | 0 | — | direct | economy |
| 13 | `kustvakt` | Kustvakt | "Räven + Örnen betalar 8🪙 var för stormskydd → ön +10." | Tundra (Räven) + Stad (Örnen) | Räven −8🪙, Örnen −8🪙 | **+10** | — | direct | environment |
| 14 | `skogsvard` | Skogsvård | "Oxen + Björnen betalar 8🪙 var för att återställa skadad skog och mark → ön +10." | Åker (Oxen) + Skog (Björnen) | Oxen −8🪙, Björnen −8🪙 | **+10** | — | direct | environment |
| 15 | `utslappshandel` | Utsläppshandel | "Värsta boven betalar 15🪙 till grönaste laget — ön −6." | Värsta boven → grönaste | Bov −15🪙 → grönaste | **−6** | — | direct | economy, environment |
| 16 | `naturreservat` | Naturreservat | "Ön +12 — men ingen får bygga nästa år." | Alla (byggstopp) | 0 | **+12** | — | **future** | environment |
| 17 | `raddningsfond` | Räddningsfond | "Alla fyra betalar 5🪙 → ön +15." | Alla fyra | Alla −5🪙 (golv 0) | **+15** | — | direct | environment |
| 18 | `byggboom` | Byggboom | "Nästa år: 5🧱 billigare per bygge, men ön −10 nu." | Alla (byggrabatt) | 0 (rabatt nästa runda, 5🧱/bygge) | **−10** | — | **future** | economy |

### Förslag som är definierade men inte används
- **Inga förslag är oanvända** — alla 18 i `PROPOSALS` är med i urvalspoolen.
- **`EXTRA_PROPOSAL_POOL`** (15 id:n i slutet av `proposals.js`) är däremot **vestigial**: motorns
  gamla legacy-urval är borttaget, och listan används numera *bara* av golden-testet för att räkna
  upp varje förslags resolution. Den speglar ingen körande urvalslogik. (Dokumenterat i filen.)

---

## 2. Nuvarande taggar och kategorier

Taggsystemet **finns redan**, infört preliminärt 2026-11-16 ("Etapp 2b–B", Josefs struktur). Tre
separata begrepp per förslag:

| Begrepp | Beskriver | Används av motorn? | Status |
|---|---|---|---|
| `category` | Förslagets **mekaniska** kategori: `direct` \| `future` (\| `investment` planerad) | **Ja** — styr `quotas` i urvalet (`politics.selection.quotas`) | Preliminär |
| `tags` | **Beskrivande/tematiska** etiketter: `environment` \| `economy` \| `crisis`. Ett förslag kan ha flera. | **Delvis** — selektorn stödjer `tags` som **whitelist-filter**, men ingen variant använder det idag | Preliminär |
| `eligibility` | **Villkor** för att förslaget får presenteras (t.ex. öhälsa under nivå). **Ingen tagg.** | **Ja** — `proposalEligible()` filtrerar poolen | Fungerande |

**Svar på de specifika frågorna:**
- **Beskriver taggarna geografi, tema eller funktion?** `tags` är **tematiska** (miljö/ekonomi/kris).
  `category` är **funktionell/mekanisk** (direkt effekt vs framtida/fördröjd effekt). Geografi finns
  *inte* som tagg — områdesträffar uttrycks i stället i `effects` (`omrade:tundra` osv.).
- **Kan ett förslag ha flera taggar?** Ja. Tre förslag har två taggar idag: `krispaket`
  (crisis+environment), `lojalitet` (environment+economy), `utslappshandel` (economy+environment).
- **Används taggarna av motorn eller bara som metadata?** `category` används aktivt (kvoter).
  `tags` har kod-stöd i selektorn (filter) men **ingen variant aktiverar det** → i praktiken metadata
  idag. `eligibility` används aktivt.
- **Finns taggbaserat urval?** **Delvis.** Selektorn (`selectProposals`) kan filtrera på en
  tagg-whitelist (`selection.tags`) och kvota på `category` (`selection.quotas`). Den kan **inte**
  kvota *per tagg* (t.ex. "minst 2 environment") — bara filtrera bort allt utan matchande tagg.

### Kategori- och taggfördelning (nuläge)

| Kategori | Antal | Förslag |
|---|---|---|
| `direct` | **15** | alla utom de tre nedan |
| `future` | **3** | `sektorblockad`, `naturreservat`, `byggboom` |

| Tagg | Antal | Förslag |
|---|---|---|
| `environment` | **10** | gron, forbud, krispaket, lojalitet, gronstod, kustvakt, skogsvard, utslappshandel, naturreservat, raddningsfond |
| `economy` | **10** | skatt, sektorskatt, solidaritet, lojalitet, marknadsavtal, grannskatt, sektorblockad, allians, utslappshandel, byggboom |
| `crisis` | **1** | krispaket |

---

## 3. Nuvarande urvalslogik per spelvariant

Gemensam motor: `selectProposals()` i `spec/systems/proposal-selector.js`. Urvalet är seedbart och
reproducerbart (rng = `seed + round`), utan dubbletter inom ett Ö-råd, kanon-sorterat på id före
blandning (oberoende av bankens ordning), och varnar i `warnings[]` om en kvot/total inte kan fyllas.

### Flash — `decisionSystem: 'dilemma'` (INGEN politik)
- **Vilka alternativ kan förekomma:** `content.proposals: false` → **politikbanken används inte alls.**
  Ö-rådet drar i stället ur `_decisionPool()` = **4 dilemman** (`dilemmas.js`) + **1 'rost'-händelse**
  (`sponsrat` ur events.js). Hanteras av `_rollRoundDecisions()`.
- **Hur många presenteras:** `dilemma.perRound: 1` → **ett** auto-draget beslut per år (ingen
  ordförande, inget val mellan flera).
- **Hur väljs det:** slumpvis via samma selektor; `algblomning` är bara valbar vid öhälsa < 45
  (eligibility).
- **Upprepning / samma under ett spel:** `_rollRoundDecisions()` undviker **förra årets** beslut
  (`_lastDecisionId`) — men *bara* om det finns tillräckligt många andra giltiga alternativ, annars
  tillåts upprepning. Samma beslut kan alltså återkomma senare under ett spel.
- **Viktning:** ingen.
- **GM:** GM aktiveras aldrig i Flash-selfplay (per `flash.js`).

### Mellan — `decisionSystem: 'politics'`
- **Vilka alternativ:** `content.proposals: 'all'` → hela 18-banken. Hanteras av
  `_rollProposalChoices()`.
- **Hur många presenteras:** `politics.proposalCount: 5` → **5 förslag** läggs i `S.proposalChoices`.
  En **ordförande** (makt-rotation, se nedan) väljer sedan **ett** av de 5 att lägga till ja/nej-röst.
- **Hur väljs de 5:** slumpvis ur alla *eligible* förslag. `quotas: {}` (tomt) och ingen tagg-filter
  → **helt slumpmässigt, ingen viktning.** `krispaket` är bara med vid öhälsa < 20.
- **Makt-rotation:** `powerFromRound: 2` (hårdkodat) → första Ö-rådet (år 1 → round 2) = Oxen, sedan
  Björnen → Räven → Örnen, runt. Round 1:s bygge har ingen ordförande.
- **Upprepning:** urvalet rullas per runda (`seed + round`), **utan minne mellan år** → samma förslag
  **kan** dyka upp flera år i rad (till skillnad från dilemma-flödet som undviker förra årets).
  `usedProposals` hindrar bara dubbletter *inom* samma runda.
- **Viktning:** ingen.
- **GM:** `content.dilemmas: 'gm'` → spelledaren kan dessutom utlösa ett A/B-dilemma eller `sponsrat`
  *mitt i byggfasen* (`gmOpenDecision` / `startGmDecision`), en gång per beslut per spel
  (`gmDecisionsUsed`). Påverkar inte politik-urvalet, ligger vid sidan av.

### Skola — `decisionSystem: 'politics'` (som Mellan)
- Identisk urvalslogik som Mellan: `proposalCount: 5`, `quotas: {}`, `fillRemaining: 'random'`, inga
  taggfilter, `dilemmas: 'gm'`. **⚠ Flera värden markerade preliminära** i `skola.js` (rundantal,
  fas-tider, kvoter). `complexEvents: true` tillkommer (Resursbrist) men rör händelser, inte politik.
- Planerad skillnad (ej implementerad): en framtida `investment`-kategori + långsiktiga förslag.

> **Viktig avgränsning (Flash får inte röras):** Flash använder ett **helt annat beslutssystem**
> (dilemma, egen bank, 1/år, ingen ordförande, ingen politikbank). När vi vidareutvecklar
> politik-mekaniken för Mellan/Skola ändras bara `politics`-vägen (`_rollProposalChoices`) och
> politikbanken — Flashs dilemma-väg (`_rollRoundDecisions`) ska lämnas orörd.

---

## 4. Befintliga config-inställningar

Servern instansierar `new EcoLoco(buildEngineConfig(manifest.config, selectedVariant))`
(`server.js:410`). **`selectedVariant` default = `'mellan'`** (`server.js:192`) → live-servern kör
**Mellan-varianten** (merge av `spec/assets.json`-config + `mellan.js`).

> ⚠ **Diskrepans att notera:** kommentaren överst i `mellan.js` säger att varianten "INTE är kopplad
> till live-servern än" och att "live-Mellan kör fortfarande legacy". Det stämmer **inte längre** —
> `selectedVariant='mellan'` som default gör att Mellan-varianten faktiskt är den som körs. Kommentaren
> är kvarbliven. (Effekten på urvalet är dock densamma: både varianten och motorns `DEFAULT_CONFIG`
> ger `proposalCount:5`, inga kvoter, all-slump.)

Inställningar som styr Ö-rådet/politiken, och var de bor:

| Inställning | Flash | Mellan | Skola | Hårdkodad i motorn? |
|---|---|---|---|---|
| `decisionSystem` | `dilemma` | `politics` | `politics` | Default `politics` i `DEFAULT_CONFIG` |
| `politics.proposalCount` | — | **5** | **5** ⚠ | Default 5 |
| `politics.selection.quotas` | — | **`{}`** (inga) | **`{}`** (inga) ⚠ | — (ingen default-kvot) |
| `politics.selection.fillRemaining` | — | `random` | `random` | Default `random` i selektorn |
| `politics.selection.tags` | — | *ej satt* | *ej satt* | — |
| `dilemma.perRound` | **1** | — | — | — |
| `content.proposals` | **false** | `all` | `all` | — |
| `content.dilemmas` | `oracle` | `gm` | `gm` | — |
| `phases.politik` (sek) | 10 | 60 | 60 ⚠ | Legacy propose/vote = 30/30 |
| `powerFromRound` (makt-rotation) | — | — | — | **Hårdkodat 2** i `DEFAULT_CONFIG` |
| `krisProposalOh` (krispaket-eligibility) | — | — | — | **Hårdkodat 20** i `DEFAULT_CONFIG` |
| Alla belopp (`gronCost`, `taxAmount`, …) | — | — | — | **Hårdkodade** i `DEFAULT_CONFIG` |

**Sammanfattning hårdkodat vs config:**
- **Config-fil (variant) styr:** vilket beslutssystem, antal förslag, kvoter, fill-regel,
  taggfilter, dilemma/år, vilka innehållsbanker, fas-tider.
- **Hårdkodat i motorns `DEFAULT_CONFIG`:** alla balansbelopp, `krisProposalOh` (öhälsa-gränsen för
  krispaket), `powerFromRound` (makt-rotationen), samt default-politiken (5 förslag, random).
- **Konfiguration som finns men inte används:** `quotas` och tagg-filter — selektorn stödjer dem,
  men **ingen variant sätter dem** → allt urval är idag rent slumpmässigt över hela eligible-poolen.
- **Skillnad Mellan vs Skola:** idag *ingen* i politik-urvalet (identiska 5/random/gm). Skola har
  bara `complexEvents` extra (händelser, ej politik) och fler markerade ⚠-preliminära värden.

---

## 5. Förslag på taggsystem och kategorisering (ej implementerat)

Grundstrukturen finns redan (category + tags + eligibility). Jag föreslår att vi **behåller de tre
begreppen** och i granskningen (a) bekräftar `category`, (b) utökar `tags` till ett rikare tematiskt
system. Nedan är ett **diskussionsunderlag**, inga slutgiltiga procent.

### 5.1 Förslag på taggar och definitioner

**Axel A — `category` (mekanik, styr kvoter):** behåll men förtydliga.
- `direct` — effekten slår samma år den röstas igenom.
- `future` — effekten gäller *nästa* runda (byggbegränsning/-rabatt): `forbud`, `sektorblockad`,
  `naturreservat`, `byggboom`. *(Obs: `forbud` är idag taggat `direct` men beter sig som `future` —
  se designproblem.)*
- `investment` (Skola, planerad) — långsiktig/ackumulerande effekt. Tomt idag.

**Axel B — `tags` (tema + funktion, för framtida blandning):** jag föreslår att utöka från 3 till
~6 orthogonala teman:
- `environment` — höjer/sänker primärt öhälsan.
- `economy` — primärt omfördelning/bonus av resurser.
- `crisis` — räddningsåtgärd som bara är relevant vid låg öhälsa.
- `redistribution` *(ny)* — tar från rika/bovar och ger till andra (maktmedel).
- `cooperation` *(ny)* — alla betalar/vinner tillsammans (kollektiv).
- `competitive` *(ny)* — skapar vinnare/förlorare efter röst (ja-bonus/nej-böter).
- `restriction` *(ny)* — byggbegränsning/-styrning.

### 5.2 Vilka taggar varje förslag skulle kunna få (utkast)

| Förslag | environment | economy | crisis | redistribution | cooperation | competitive | restriction |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| gron | ✓ | | | | ✓ | | |
| skatt | | ✓ | | ✓ | | | |
| forbud | ✓ | | | | | | ✓ |
| krispaket | ✓ | | ✓ | | ✓ | | |
| sektorskatt | | ✓ | | ✓ | | | |
| solidaritet | | ✓ | | ✓ | | | |
| lojalitet | ✓ | ✓ | | | | ✓ | |
| marknadsavtal | | ✓ | | | ✓ | | |
| gronstod | ✓ | | | ✓ | | | |
| grannskatt | | ✓ | | ✓ | | | |
| sektorblockad | | ✓ | | | | | ✓ |
| allians | | ✓ | | | | ✓ | |
| kustvakt | ✓ | | | | | | |
| skogsvard | ✓ | | | | | | |
| utslappshandel | ✓ | ✓ | | ✓ | | | |
| naturreservat | ✓ | | | | | | ✓ |
| raddningsfond | ✓ | | | | ✓ | | |
| byggboom | | ✓ | | | | | ✓ |

### 5.3 Antal per kategori (utkast ovan)

| Tagg | Antal |
|---|---|
| environment | 10 |
| economy | 10 |
| redistribution | 6 |
| cooperation | 4 |
| restriction | 4 |
| competitive | 2 |
| crisis | 1 |

### 5.4 Överlappningar och svårigheter
- Flera förslag är genuint **tvåtemiga** (miljö + ekonomi: `lojalitet`, `utslappshandel`). Det är
  korrekt, men gör "antal per tema" > 18 → en kvot "minst 2 environment" och "minst 2 economy" kan
  plockas av *samma* förslag. Måste bestämmas: räknas överlapp dubbelt i kvoter?
- `cooperation` vs `redistribution` vs `competitive` glider in i varandra (t.ex. `gron` =
  kollektiv men bara ja-röstare betalar → nästan `competitive`).
- `crisis` har bara 1 medlem — fungerar inte som kvoterbar kategori, bör nog hanteras via
  `eligibility` (som idag), inte via blandningskvot.

### 5.5 Hur en framtida taggfördelning skulle kunna konfigureras per variant
- **Idag stödjer selektorn:** kvoter *per `category`* (`selection.quotas = { direct: 3, future: 1 }`)
  + en tagg-*whitelist* (`selection.tags = ['environment','economy']`, filtrerar bort allt annat).
- **Idag stödjer selektorn INTE:** kvoter *per tagg* (t.ex. "exakt 2 environment + 2 economy + 1
  valfri"). Det kräver en liten utökning av `selectProposals` (en `tagQuotas`-väg vid sidan av
  `quotas`). **Beslut krävs** om vi vill vikta per tema — annars måste temat uttryckas som
  `category`, vilket krockar med categoryns mekaniska roll.
- Per-variant skulle det då bli, t.ex. (illustration, ej förslag på siffror):
  - Mellan: `politics.selection.quotas = { … }` eller `tagQuotas = { … }`.
  - Skola: egen fördelning med tyngre `investment`/långsiktiga förslag.

---

## 6. Identifierade designproblem

Uppdelat i **verifierade tekniska** (står i koden) och **subjektiva designbedömningar**.

### Verifierade tekniska
1. **Selektorn kan inte vikta per tagg.** Bara kvota per `category` + filtrera på tagg-whitelist. Vill
   vi blanda per *tema* behövs en utökning eller en omtolkning av `category`. (`proposal-selector.js`.)
2. **Politik-urvalet saknar minne mellan år.** `_rollProposalChoices` rullar per runda utan
   `_lastDecisionId`-skydd → samma 5 (och samma valda förslag) kan återkomma år efter år. Dilemma-
   vägen har skydd mot förra årets. Asymmetri — avsiktlig eller inte?
3. **`category` på `forbud` är inkonsekvent.** `forbud` ger byggbegränsning *nästa* runda (precis som
   `sektorblockad`/`naturreservat`/`byggboom` som är `future`), men är taggat `direct`. Rättning
   påverkar framtida kvoter.
4. **`eligibility` stödjer bara `always`/`ohBelow`.** Ingen `ohAbove`, ingen rundbaserad regel, inget
   "bara i aktiv kris". Begränsar hur situationsstyrda förslag kan göras.
5. **`EXTRA_PROPOSAL_POOL` är vilseledande** — ser ut som en körande pool men används bara av
   golden-testet. Bör dokumenteras tydligare eller flyttas.
6. **Utdaterad kommentar i `mellan.js`** (säger "legacy, ej live") medan `selectedVariant='mellan'`
   gör varianten live. Risk för felbeslut om vi litar på kommentaren.
7. **`koncernerbjudande` (dilemma) överlappar `sponsrat` (rost-händelse)** tematiskt — flaggat i
   `dilemmas.js`. Båda ligger i Flashs beslutspool samtidigt → kan båda dyka upp.

### Subjektiva designbedömningar (balans/upplevelse — inte buggar)
8. **Nära dubbletter:**
   - `kustvakt` ↔ `skogsvard`: spegelbild (betalar 8🪙 var, +10 öh) — skiljer bara på *vilka* två lag.
   - `allians` ↔ `lojalitet`: nästan identiska (ja-bonus/nej-böter); `lojalitet` lägger bara +4 öh.
   - `skatt` ↔ `solidaritet` ↔ `grannskatt`: alla "ta från rik → ge till andra", olika urval.
9. **Förslag som nästan alltid är bra/dåliga för ön:**
   - Nästan alltid bra: `raddningsfond` (+15 öh för bara 5🪙 var), `naturreservat` (+12 öh), `krispaket`
     (+28 öh). → svaga som *val*, starka som räddning.
   - Alltid dåligt för ön: `byggboom` (−10), `utslappshandel` (−6). → "egoist-kort".
10. **Otydliga konsekvenser:** `sektorblockad` ("motståndarsektorn" = sektor ≠ förslagsställarens —
    beror på vem som lägger det) och alla `future`-förslag (effekten syns först nästa runda).
11. **`marknadsavtal` kräver exakt 3 ja** — svår koordination, kan nästan aldrig lyckas i selfplay.
12. **Snedfördelning av teman:** `crisis` har bara 1 förslag; ingen uttalad "samarbete"-kategori trots
    att flera förslag är kollektiva; `future` bara 3 st. En jämn tematisk blandning är svår idag.

---

## 7. Beslut vi behöver fatta innan implementation

1. **Taggaxlar:** behåller vi `category` (mekanik) + `tags` (tema) som två axlar? Utökar vi tags till
   de ~6 teman jag föreslår, eller färre/andra?
2. **Viktningsmekanism:** ska blandning styras per `category` (finns) eller per `tagg` (kräver
   selektor-utökning)? Räknas tvåtemiga förslag dubbelt i kvoter?
3. **Category-taxonomin:** är `direct`/`future`/`investment` rätt? Ska `forbud` flyttas till `future`?
4. **Upprepning:** ska politik-urvalet undvika förra årets förslag (som dilemma-vägen gör)?
5. **Dubbletter:** slå ihop/ta bort `kustvakt`+`skogsvard`, `allians`+`lojalitet`,
   `skatt`/`solidaritet`/`grannskatt`? (Balansfråga — separat från taggning.)
6. **`koncernerbjudande` vs `sponsrat`:** behåll båda, slå ihop, eller ta bort dilemmat?
7. **Mellan vs Skola:** ska de skilja sig i politik-blandningen, och i så fall hur?
8. **Städning:** rätta `mellan.js`-kommentaren och tydliggör/flytta `EXTRA_PROPOSAL_POOL`.

*(Procentfördelningar lämnas medvetet öppna — vi går igenom kategoriseringen tillsammans först.)*
