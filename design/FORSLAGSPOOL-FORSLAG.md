# Förslagspool — nya omröstningar för Eco Loco (Mellan)

*Arbetsfil. Inte beslutad, inte committad. Grundad i `spec/engine.js` (motorn = sanning),
`src/ui.js` (förslags-UI), `server/server.js` (bot-/multiplayer-förslag) och inspirerad av
originalet "Eco Loco flash" (`~/Desktop/2047/Eco Loco/Bas Eco Loco flash.xlsx` +
`Spelregler Eco Loco flash.docx`). Alla förslag nedan är NYA, anpassade till den nuvarande motorn.*

---

## 1. Mål (Josefs ord)

Efter ~runda 3 (när spelarna förstått dynamiken) ska NYA förslag kunna dyka upp som skapar
FLER dilemman och tvingar spelarna att **samarbeta eller gruppera sig MED/MOT varandra**. Smutsiga
lag har ekonomiskt överläge + maktmedel; övriga måste gå ihop via omröstning för att rädda ön.
Det ska likna **allmänningarnas tragedi**. De 3 grund-förslagen ska alltid ligga kvar.

---

## 2. Nuläge — vad motorn FAKTISKT kan idag

### 2.1 De 3 nuvarande förslagen (ur koden)
Hårdkodade på tre ställen: effekten i `engine.js:_resolveProposal` (grenar `gron`/`skatt`/`forbud`),
kort-texterna i `src/ui.js:propDefs()` (rad 731–738), bot-valet i `server/server.js:240` och `src/ui.js:75`.

| # | Namn (type) | Mekanik i motorn | Grind |
|---|---|---|---|
| 1 | 🌱 **Grön satsning** (`gron`) | Alla *ja-röstare* betalar `gronCost` (10🪙); `S.gronQueued += gronGain` (8) → läggs på öhälsan vid bokslut. | 3 av 4 JA |
| 2 | 💸 **Miljöskatt** (`skatt`) | `worstPolluter()` betalar `taxAmount` (15🪙); delas lika mellan de andra tre. Ingen öhälso-effekt. | 3 av 4 JA |
| 3 | 🚫 **Förbjud smutsig** (`forbud`) | Sätter `banDirtyNextRound=true` → `selectCard` blockar tier `'smutsig'` nästa runda för ALLA. | 3 av 4 JA |

### 2.2 Motorns effekt-"vokabulär" (primitiver ett förslag kan återanvända)
En ny förslagstyp = en ny `case`-gren i `_resolveProposal` + en rad i `propDefs()` + runda-gate i bot-valet.
Följande primitiver finns redan och kan kombineras fritt i en sådan gren **utan ny motor-mekanik**:

- **P1** Ändra `t.pengar` (±) på valfri lag-mängd (t.ex. bara ja-röstare — mönstret finns i `gron`).
- **P2** Ändra `t.material` (±) — samma primitiv, `t.material` finns men används inte av något förslag idag.
- **P3** Ändra öhälsan (`S.gronQueued` eller direkt `S.oh` + `ohalsa`-event, som i `_runEvent`).
- **P4** `banDirtyNextRound` (blockar ALL smutsig nästa runda).
- **P5** Mål-selektorer finns redan i `_eventTargets`/hjälparna: `richest()`, `worstPolluter()`,
  `_greenest()`, `sektorPengar`/`sektorMaterial`, `omrade:<id>`, `alla`.
- **P6** Rösträkning per lag: `p.votes[teamId]` (true/false) + `yesCount`. **Förslagsläggaren auto-röstar JA**
  (`server.js:350`), och tomma röster fylls med NEJ (`server.js:213`) → alltid exakt 4 röster. Det gör
  antals-/lojalitetsvillkor ("≥3 ja", "exakt 3 ja", "nej-röstare straffas") byggbara direkt.

### 2.3 Vad motorn INTE kan idag (kräver ny mekanik)
- **N1** Fler-rundors / fördröjda effekter. Enda flerstegs-staten är `banDirtyNextRound` (engångs). En
  effekt som "varar 2 rundor" eller "buffrar nästa händelse" kräver nytt state-fält + läsning i `endRound`.
- **N2** Inkomst-/produktions-multiplikatorer. `endRound` betalar `incP`/`incM` platt — ingen multiplikator finns.
- **N3** Handels-spärr / tvingad handel. `transfer()` har ingen spärr-state att läsa.
- **N4** Selektiva byggförbud utöver "all smutsig" (t.ex. förbjud *standard*, eller smutsig *bara i en sektor*):
  `selectCard` kollar bara `tier === 'smutsig'` globalt → kräver ny flagga + ny `selectCard`-koll.
- **N5** Tre-gradig insats (A/B/C) per lag i stället för binärt JA/NEJ: `vote()` tar en boolean → kräver ny röst-payload.

### 2.4 Inspiration ur flash-originalet (översatt till denna motor)
Flash byggde dilemman med **grupptrösklar** på varje rundas förslag: bonus triggas bara om gruppen når
ett tröskelvärde — *"om ≥3 lag investerar: +35 hälsa"*, *"om minst 2 bidrar: +20"*, *"exakt 3 deltar: +15"*,
samt uttalad **gratisåkar-mekanik** ("alla får nyttan, bara bidragsgivare betalar"). Dramaturgin var
optimism → girighet → misstro → återhämtning → slutlig uppoffring. Grupptröskel-idén är precis vad som
tvingar fram allianser, och den är **byggbar direkt** via P6 (yesCount/vote-identitet) — det är den
starkaste hävstången nedan.

---

## 3. Poolen — nya förslag (fält a–d per förslag)

Legend bygg-status: **[BYGG]** = endast ny `case`-gren + propDef + gate (återanvänder P1–P6).
**[NY MEK]** = kräver nytt motor-state/logik (flaggat med vilken N-punkt).

### 🆘 Krispaket (`krispaket`) — [BYGG] (P1+P3+P6)
- **(a) Namn:** Krispaket / Nödinsats.
- **(b) Mekanik:** Som Grön satsning men vassare och kris-gated: varje ja-röstare betalar ~`gronCost`🪙,
  och öhälsan höjs med ett STORT belopp (t.ex. `2×gronGain`) **endast om ≥3 röstade ja** (annars 0 — pengarna
  bränns). Ren återanvändning av P1 (ja betalar) + P3 (öh upp) + P6 (yesCount-villkor).
- **(c) Dilemma / tryck:** Det enda verktyget som kan *vända* en djup kris — men bara om nästan alla går
  ihop. Gratisåkarpress: den som röstar nej får ändå öhälso-nyttan men slipper betala. Tvingar de rena
  lagen att samfinansiera räddningen och att övertala/pressa en fjärde att hoppa på.
- **(d) Upplåsning:** När öhälsan passerar under `redZone` (kris) — eller tidigast runda 4. Kris-reaktivt.

### 🏝 Sektorskatt / Tullavtal (`sektorskatt`) — [BYGG] (P1/P2+P5)
- **(a) Namn:** Sektorskatt (pengar-lagen betalar material-lagen, eller tvärtom).
- **(b) Mekanik:** Den utpekade sektorn (`sektorPengar` **eller** `sektorMaterial` via P5) betalar X av sin
  starka valuta; summan delas lika till den andra sektorns två lag. Återanvänder skatt-mönstret (P1/P2) men
  med sektor-selektor i stället för enskild bov.
- **(c) Dilemma / tryck:** Delar ön i **2 mot 2 längs sektorslinjen**. Eftersom pengar-sektorn dominerar
  ekonomiskt (SPELINFO §Balansläget) är detta material-lagens naturliga maktmedel — och pengar-lagen måste
  gå ihop för att blockera det. Tvingar fram sektor-block-röstning (bloc MOT bloc).
- **(d) Upplåsning:** Runda 3.

### 👑 Solidaritetsskatt på rikaste (`solidaritet`) — [BYGG] (P1/P2+P5)
- **(a) Namn:** Solidaritetsskatt (omfördelning från den rikaste).
- **(b) Mekanik:** `richest()` betalar X🪙 **och** Y🧱; delas lika mellan de andra tre. Som Miljöskatt men
  träffar *ekonomisk* ledare (inte klimatbov) och flyttar båda valutorna (P1+P2).
- **(c) Dilemma / tryck:** De tre fattigare laggar ihop MOT ledaren — klassisk "de-har-nots mot ledaren".
  Men målet skiftar under spelets gång: blir ett *rent* lag plötsligt rikast straffas det "orättvist", vilket
  skapar diskussion om vem som egentligen förtjänar att beskattas. Allians-mot med rörligt måltavla.
- **(d) Upplåsning:** Runda 3.

### 🤝 Grön utdelning / Lojalitetstest (`lojalitet`) — [BYGG] (P1+P3+P6)
- **(a) Namn:** Grön utdelning (bonus till blocket, böter till kallsinniga).
- **(b) Mekanik:** Om förslaget går igenom (3/4): varje **ja**-röstare får +X🪙 (eller delar en pott),
  öhälsan +litet; varje **nej**-röstare betalar böter Z🪙. Allt via P6 (vote-identitet) + P1 + P3.
- **(c) Dilemma / tryck:** Gör själva rösten till ett **lojalitetsprov** — att stå utanför blocket kostar
  dig konkret. Pressar hold-outs (ofta de smutsiga) att antingen ansluta eller betala för sin avvikelse.
  MED-blocket belönas, MOT-sidan bestraffas → hårt grupperingstryck.
- **(d) Upplåsning:** Runda 4 (först efter att spelarna förstått vanliga 3/4-röstningen).

### 📈 Marknadsavtal — exakt tre (`marknadsavtal`) — [BYGG] (P1+P6)
- **(a) Namn:** Marknadsavtal / Handelsavtal (koordination, inte uppoffring).
- **(b) Mekanik:** Bonus (+X🪙 till alla fyra, liten öh) triggas **endast om EXAKT 3 av 4 röstade ja** — fyra
  ja ELLER högst två ja ger ingenting. Egen antals-regel i grenen (P6: `yesCount === 3`). OBS: förslagsläggaren
  auto-röstar ja (`server.js:350`) → designa texten så att "en måste avstå" är tydligt.
- **(c) Dilemma / tryck:** Rent **koordinationsproblem** (direkt från flash "Regional handel"). Någon måste
  frivilligt bli den som avstår → "kan inte du ta den?", "varför alltid jag?". Social friktion som tvingar
  fram förhandling utan att någon ens är ond. Fungerar lika bra med bot-lag (botens röst blir jokern).
- **(d) Upplåsning:** Runda 5 (mellanspel — koordinationskänsla när allianser redan börjat formas).

### 💊 Riktat grönt stöd (`gronstod`) — [BYGG-variant] / [NY MEK-variant N4]
- **(a) Namn:** Riktat grönt stöd (ön hjälper ett lag att ställa om).
- **(b) Mekanik:**
  - **[BYGG]-variant (P1+P5):** ja-röstare betalar var X🪙 → hela potten ges till ett mål-lag (t.ex.
    `_greenest()`, eller ett lag förslagsläggaren pekar ut via ny `omrade`-parameter i `openProposal`).
    Ger mål-laget kapital att ha råd med dyra gröna kort.
  - **[NY MEK N4]-variant:** sänk mål-lagets *nästa gröna kort-kostnad* — kräver nytt kostnads-modifikator-state
    (finns inte; `selectCard` läser fasta `card.kp/km`).
- **(c) Dilemma / tryck:** Ska de rika (ofta smutsiga) laggen betala för att en *rival* ska bli grön och lyfta
  den delade ön? Egennytta (öhälsan de också lever på) vs. att stärka en konkurrent på börsen. Samarbete som
  gynnar kollektivet men förskjuter den interna rangordningen.
- **(d) Upplåsning:** Runda 4.

### 🚢 Handelsblockad mot boven (`blockad`) — [NY MEK N3]
- **(a) Namn:** Handelsblockad (strypa den smutsiga ledarens byteshandel).
- **(b) Mekanik:** `worstPolluter()` (eller `richest()`) får inte byta valuta nästa runda. **Kräver ny mekanik:**
  ny state-flagga (t.ex. `tradeBanNextRound: teamId`) + en spärr i `transfer()` och i mock/bot-accept-logiken.
- **(c) Dilemma / tryck:** Det vassaste allians-MOT-verktyget. Eftersom varje lag bara tjänar EN valuta är
  byteshandel livsnödvändig — att strypa boven tvingar dem att bygga billigt/sämre eller gå med på öns krav.
  De tre andra måsta gå ihop, och boven får incitament att förhandla sig fri i förväg. Direkt allmännings-press.
- **(d) Upplåsning:** Runda 5 (starkt maktmedel — först när kriser gör det befogat).

### 🌪 Utsläppstak / Endast grönt (`utslappstak`) — [NY MEK N4]
- **(a) Namn:** Utsläppstak (nästa runda får bara grönt byggas).
- **(b) Mekanik:** Nästa runda blockeras BÅDE `smutsig` och `standard` — bara `gron` tillåts. **Kräver ny mekanik:**
  en andra flagga (t.ex. `banNonGreenNextRound`) + utökad koll i `selectCard` (idag kollas bara `'smutsig'`).
- **(c) Dilemma / tryck:** Brutalt för alla, värst för material-lagen vars gröna kort är dyrast. Bara lag som
  har råd med grönt (eller har bytt till sig material/pengar i förväg) vågar backa det → en koalition av de
  som *tål* uppoffringen mot de som inte gör det. Tvingar fram byteshandel INNAN omröstningen.
- **(d) Upplåsning:** Runda 6 (sen fas — den "stora uppoffringen" i flash-dramaturgin).

### 🛡 Katastroffond / Stormberedskap (`katastroffond`) — [NY MEK N1]
- **(a) Namn:** Katastroffond (betala nu, skyddad mot nästa händelse).
- **(b) Mekanik:** ja-röstare betalar X🪙 nu → nästa dragna `EVENTS`-händelse dämpas (t.ex. halverad
  öh-/resurs-smäll), eller öhälsan får en buffert. **Kräver ny mekanik:** fler-rundors state (N1) som
  `_runEvent`/`endRound` läser nästa runda.
- **(c) Dilemma / tryck:** Riskdelning med gratisåkar-tvist (från flash "Forskningsprojekt/Riskdelning"):
  man betalar för ett skydd som bara lönar sig OM katastrofen slår — och nyttan är delad. Lockar fram
  "ska vi gardera oss eller chansa?"-diskussion och misstro mot den som vägrar bidra.
- **(d) Upplåsning:** Runda 4.

---

## 4. Rekommenderad upplåsnings- & rotationsmodell

**Rekommendation: växande men TAKAD pool, runda-gated, med öhälso-viktat urval.**

- **Grund-3 ligger alltid kvar** (Grön satsning, Miljöskatt, Förbjud smutsig) — de är spelets grammatik och
  behövs som referens varje runda.
- **Runda 1–2:** endast grund-3 (inlärning — matchar `earlyRounds=3` och flash "runda 1 = samarbete är enkelt").
- **Från runda 3:** extra-poolen öppnas. Visa **grund-3 + 2 roterande extra-förslag** per runda (max 5 val →
  UI:t förblir skannbart; `propDefs()` returnerar idag 3 kort och renderas som en lista, så 5 ryms).
- **Progressiv upplåsning inom poolen** enligt (d)-kolumnen ovan: lättare sektors-/omfördelnings-dilemman
  från r3, lojalitets-/stöd-/fond-dilemman från r4, koordinations- och maktmedel (marknadsavtal, blockad)
  från r5, utsläppstak r6. Nya dilemman droppar alltså successivt — spelarna hinner smälta ett i taget.
- **Urvalet av de 2 extra viktas av öhälsan** (motorn vet `S.oh` och `ohMode`): i kris (öh < `redZone`)
  prioriteras räddnings-/press-förslag (Krispaket, Utsläppstak, Blockad); i grönt läge prioriteras
  omfördelnings-/koordinations-förslag (Solidaritet, Marknadsavtal). Detta speglar bot-logiken som redan
  finns (`server.js:240`: `S.oh < 45 ? gron/forbud : skatt/...`) och ger krisen rätt verktyg i rätt stund.

**Varför växande-takad framför rent roterande eller rent växande:**
- *Rent växande* (allt upplåst ligger kvar samtidigt) → 10+ kort i förslagslistan efter runda 6 =
  valöverlast, tvärtemot SPELINFO:s "minimal text / en handling i taget".
- *Rent roterande* (byt ut, inget garanterat kvar) → risk att grund-verktygen försvinner när de behövs mest.
- *Växande-takad* ger **garanterad grund + garanterad nyhet + takad valmängd** och låter öhälsan styra vilket
  dilemma som känns akut — störst samarbets-/alliansdramatik till lägst kognitiv kostnad.

**Enkel variant om takning/viktning känns för komplex för v1:** lås bara upp 1 nytt förslag per udda runda
(r3, r5, r7) som ADDERAS permanent till listan, inget rotationsurval. Mindre kod, fortfarande "nya dilemman
efter runda 3", men förslagslistan växer till 6 kort mot slutet.

---

## 5. Sammanfattning — byggbart direkt vs. kräver ny mekanik

| Förslag | Status | Återanvänder / kräver |
|---|---|---|
| 🆘 Krispaket | **BYGG** | P1+P3+P6 (ja betalar, öh upp vid ≥3 ja) |
| 🏝 Sektorskatt | **BYGG** | P1/P2+P5 (sektor-selektor) |
| 👑 Solidaritetsskatt | **BYGG** | P1/P2+P5 (`richest()`, båda valutor) |
| 🤝 Grön utdelning/Lojalitet | **BYGG** | P1+P3+P6 (bonus ja / böter nej) |
| 📈 Marknadsavtal (exakt 3) | **BYGG** | P1+P6 (`yesCount===3`) |
| 💊 Riktat grönt stöd | **BYGG** (pott-variant) / **NY MEK N4** (kostnadsrabatt-variant) | P1+P5 / nytt kostnads-state |
| 🚢 Handelsblockad | **NY MEK N3** | ny trade-ban-state + `transfer()`-spärr |
| 🌪 Utsläppstak | **NY MEK N4** | andra byggförbuds-flagga + `selectCard`-koll |
| 🛡 Katastroffond | **NY MEK N1** | fler-rundors state läst i `_runEvent`/`endRound` |

**Gemensam byggkostnad för ALLA (även "BYGG"):** motorn har idag **ingen pool-/rundagate-abstraktion** — de 3
förslagen är fast listade i `propDefs()` och bot-valet på två ställen. Att göra utbudet dynamiskt kräver
alltså, oavsett enskilt förslag:
1. ny `case`-gren per förslagstyp i `engine.js:_resolveProposal` (+ ev. ny state för N-flaggade),
2. runda-/öhälso-gate i `src/ui.js:propDefs()` (människans meny),
3. motsvarande runda-gate i bot-valet (`server/server.js:240` och `src/ui.js:75`).

Effekterna (P1–P6) är den lilla biten; den dynamiska utbuds-logiken är den gemensamma (men lilla) nya koden.
Rör inte balans-/kort-siffror utan Josefs beslut (RAMVERK-invariant) — det gäller även öh-belopp i nya förslag.
