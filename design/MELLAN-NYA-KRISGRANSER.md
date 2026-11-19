# Mellan — nya trösklar & årskrav för lokala företagskriser

*Skriven 2026-11-19 av Claude. Implementation + analys av beslutet (Klara/Josef) att de lokala
företagskriserna inträffade för tidigt. Nya regler: tröskel **−15/−25** och **årskrav** (minor år 2,
major år 4). Resursförluster/öhälsoeffekter och allt annat i händelsesystemet är OFÖRÄNDRAT. Bygger vidare
på [MELLAN-HANDELSEBALANS.md](MELLAN-HANDELSEBALANS.md) och [MELLAN-SPELPROTOKOLL.md](MELLAN-SPELPROTOKOLL.md).*

> **Reproducerbart:** `node tools/krisgranser-sim.js 1500` (före/efter, samma motor + frön) ·
> `node tools/handelse-protokoll.js 1000 normal 4 byggtat` (byggtätt) ·
> `node tools/handelse-protokoll.js 1000 forsiktig 8 blandade` (lugnt) · `node tools/company-crisis-test.js`.
> **[OBS]** simulerat · **[KOD]** kodgranskat · **[HYP]** upplevelsehypotes.

---

## 1. Exakt vilka regler som implementerats

En lokal kris inträffar när **BÅDA** villkoren är uppfyllda — tillräcklig ackumulerad miljöskada (`impactNeg`)
**OCH** att spelet nått krisens tidigast tillåtna år. Inget nytt miljöskadligt bygge krävs just det året.

| | Mindre lokal kris | Större lokal kris |
|---|---|---|
| Ackumulerad negativ miljöpåverkan (`impactNeg`) | **≤ −15** | **≤ −25** |
| Tidigast spelår | **år 2** | **år 4** |
| Resursförlust | −10 huvudresurs *(oförändrad)* | −20 huvudresurs *(oförändrad)* |
| Öhälsa | −4 *(oförändrad)* | −8 *(oförändrad)* |
| Max antal | 1 gång/företag/spel | 1 gång/företag/spel |

**Timing (verifierat i kod + test):**
- **Passeras tröskeln ett TILLÅTET år** → krisen slår **direkt vid bygget** (Exempel C). [KOD]
- **Passerades tröskeln ett TIDIGARE år** → krisen **köas vid starten av det första tillåtna årets byggfas**
  (`engine.fireDueCrises()`, anropas av servern i `startTimer` efter Ö-råd — aldrig under bokslut/Ö-råd)
  (Exempel A). [KOD]
- Presenteras via **befintlig företagshändelse-kö** med 10 s-paus. Flera samtidigt kvalificerade → köas en
  i taget. Max en gång/företag/spel (`firedCompanyEvents`), ingen dubbel, inget tappat. [KOD+OBS]

**Config-styrt (DEFAULT_CONFIG):** `companyCrisisThreshold {minor:-15,major:-25}` och
`companyCrisisMinRound {minor:2,major:4}`. Gamla reglerna nås i **samma motor** med
`{minor:-10,major:-20}` + `{minor:1,major:1}` → jämförelsen nedan byter aldrig kodversion. Gäller
**Mellan + Skola** (`features.companyCrises`). **Flash** saknar företagskriser → helt oförändrat.

## 2. Vilka filer som ändrats

| Fil | Ändring |
|---|---|
| `spec/engine.js` | Config `companyCrisisThreshold`/`companyCrisisMinRound`. `_checkCompanyCrises` → `_maybeQueueCrisis` (tröskel **+ årskrav**). Nya `_crisisGrad/_crisisThreshold/_crisisMinRound` + publik `fireDueCrises()` (köar väntande kriser vid byggfasens start). |
| `spec/content/company-crises.js` | `grad:'minor'|'major'` per kris; `threshold`-fältet borttaget (styrs nu av config). loss/ohalsa **oförändrade**. |
| `server/server.js` | `startTimer` anropar `engine.fireDueCrises()` vid byggfasens början (guard `crisisDueRound`, en gång/runda). Nollställs vid omstart/ny motor. |
| `tools/simulera.js`, `handelsebalans.js`, `fordrojd-sim.js`, `handelsetathet.js` | `engine.fireDueCrises()` vid byggfasens början (speglar servern). |
| `tools/company-crisis-test.js` | Omskriven för de 11 verifieringspunkterna. |
| `tools/company-event-test.js`, `fordrojd-ohalsa-test.js` | Kris-beroende testfall uppdaterade till nya regler. |
| `tools/golden/mellan-baseline-v3.json` | Regenererad — enda diffen är de nya config-fälten (noll beteendeskillnad; golden-partiet kör utan `features` → inga kriser). |
| `tools/krisgranser-sim.js` *(ny)* | Före/efter-jämförelse (config-styrd, samma motor). |
| `tools/handelse-protokoll.js` | Visar årsgatade kriser + markerar ⏳ "tröskel passerad, väntar på år X". |
| `RAMVERK.md` | §5b uppdaterad med kris-årskravet. |

## 3. Testresultat
- **`company-crisis-test.js`: alla 11 punkter gröna** — (1) ingen minor år 1, (2) ingen major före år 4,
  (3) minor vid −15 från år 2, (4) major vid −25 från år 4, (5) tidigare skada → kris vid nytt års början
  utan nytt bygge, (6) kris vid bygge visas direkt, (7) max en gång/företag, (8) resurs/öhälsa oförändrade
  (−10/−4, −20/−8), (9) flera samtidiga köas korrekt, (10) Flash opåverkat, (11) gamla reglerna körbara i
  samma motor.
- **Hela regressionssviten: 17/17 gröna.** Golden-baslinjen regenererad (config-diff, noll beteende).
- `node --check` på engine/server OK.

## 4. Jämförelse gamla vs nya regler [OBS] — `krisgranser-sim.js`, N=1500/strategi

| Strategi | Mått | GAMLA (−10/−20) | NYA (−15/−25, år 2/4) |
|---|---|---|---|
| **Försiktigt (realistiskt)** | andel m. minor / major | 37,5 % / 0 % | 37,5 % / 0 % |
| | minor snittår | **1,0** | **2,0** |
| | slut-öhälsa / överlever | 14,9 / lever 8 år | **14,9 / lever 8 år (identiskt)** |
| **Normalt/blandat** | andel m. minor / major | 50 % / **31 %** | 30 % / **0 %** |
| | minor / major snittår | 1,0 / 1,0 | **2,0 / —** |
| | båda kriserna samma företag | 1,23/parti | **0,00** |
| | resursförlust från kriser | −45/parti | **−12/parti** |
| | max popups/byggfas | 8 | **5** |
| **Aggressivt (stresstest)** | andel m. minor / major | 51 % / 44 % | **0 % / 0 %** |
| | resursförlust från kriser | −56/parti | **0** |
| **Grönt** | andel m. kris | 0 % | 0 % (identiskt) |

**Sammanfattning:** de nya reglerna (a) **tar bort alla minor-kriser år 1**, (b) **flyttar minor till år 2**,
(c) **gör major mycket sällsynt** (kräver −25 *och* år 4 — nås sällan innan ön annars stabiliserats eller
kollapsat), och (d) **sänker krisernas ekonomiska drag kraftigt** (normal −45→−12, aggressiv −56→0). I den
**realistiska (försiktiga) regimen är balansen identisk** — ren tidsförskjutning av minor från år 1 till år 2.

## 5. Händelsefördelning över spelåren [OBS]
Fördelning av lokala kriser över år 1–8 (normal/blandat, N=1500):

| | GAMLA | NYA |
|---|---|---|
| MINDRE kris | **allt år 1** (3000 st) | **allt år 2** (1780 st) |
| STÖRRE kris | **allt år 1** (1845 st) | — (0 st; når inte −25 *och* år 4 i ett kollapsande botparti) |

→ **Kriserna sprids nu över flera år i stället för att koncentreras till år 1.** I det realistiska protokollet
(nedan, §7) ser man precis detta: Stad passerar −15/−25 redan år 1, men ÖVERBELASTNING väntar till år 2 och
STRÖMAVBROTT till år 4.

**Ny koncentration vid år 2?** Delvis, men mild och bara i botregimer: när flera lag passerade sina trösklar
år 1 köas deras minor-kriser tillsammans vid år-2-byggfasens start → andel byggfaser med ≥3 popups steg i
*normal* (12,5 %→22,1 %). **MEN** max popups/byggfas **sjönk** (8→5) och total paustid sjönk (77→70 s).
**I realistiskt (försiktigt) spel är ≥3-popup-andelen oförändrad (6,2 %)** och max 3→4. Vi har alltså inte
flyttat hela popup-problemet till år 2 — år-1-toppen är borta och år-2-klustret är mindre än den gamla
år-1-toppen. [OBS]

## 6. Balanspåverkan [OBS]
- **Öhälsa över tid:** i realistiskt spel oförändrad (minor-krisens −4 kommer ett år senare men ön landar på
  samma slut-öhälsa, 14,9). I botregimer dör ön fortfarande av **byggandet** — kriserna var aldrig den
  drivande kraften (se [MELLAN-HANDELSEBALANS.md](MELLAN-HANDELSEBALANS.md)).
- **Slutlig öhälsa / överlevnad:** oförändrad för alla strategier (gröna 100 % / 100, försiktig 14,9, resten
  kollaps — drivs av byggandet, inte kriserna).
- **Ekonomiska förluster från kriser:** **kraftigt minskade** i snabbt spel (normal −45→−12, aggressiv
  −56→0), eftersom majors knappt inträffar och minors senareläggs. Direkt konsekvens av §3c i balansrapporten
  (den konfiskatoriska −20 mot tom kassa försvinner nästan helt).
- **KRIS-aktiveringar (öhälsa ≤20):** **ökar** i normal (0,23→0,77/parti). Orsak: utan den tidiga
  kris-smällen störtar öhälsan inte längre förbi 20 rakt till 0 — ön **dröjer kvar** i KRIS-bandet i stället.
  Öns hälsa utvecklas alltså annorlunda, precis som uppgiften förutsåg att kontrollera. Det är inte sämre:
  fler KRIS-moment = fler tillfällen att vända (blandar-linjen gör sitt jobb).
- **Återhämtning efter lokala kriser:** oförändrad mekanik; den senarelagda −4/−8 ger laget mer tid att bygga
  upp en buffert innan smällen (minor kommer tidigast år 2, inte år 1).

## 7. Konkreta spelprotokoll

### Byggtätt parti — 3 gröna ankare + Stad (smutsigt), frö 1000, normal appetit (8 år)
*Visar hur kriserna FÖRDRÖJS trots att miljötrösklarna passeras tidigt. Stad når −15 redan år 1 och −25 år 3,
men ÖVERBELASTNING väntar till år 2 och STRÖMAVBROTT till år 4. Ön lever hela spelet (gröna ankare).*

```
────────── ÅR 1 ──────────
  🔨 Stad (Örnen) bygger SMUTSIG "Kolkraftverk"  (×4, −6 öhälsa/bygge)
     ackumulerad skada 0 → −6 → −12 → −18 → −24
     ⏳ miljötröskeln för ÖVERBELASTNING passerad (−18 ≤ −15) — men krisen VÄNTAR på årskravet (tidigast år 2)
  📊 BOKSLUT år 1: ön 47 → 44 · inga öhälsohändelser kvalificerade

────────── ÅR 2 ──────────
  ⤷ Lokala kriser vars årskrav NU uppfylls (tröskeln passerades ett tidigare år) — köas vid byggfasens start:
     ⚠ ÖVERBELASTNING — Stad −10🪙 · öhälsa −4 → 40  (villkor: ackumulerad miljöskada −24 ≤ −15 OCH år ≥ 2)
  📊 BOKSLUT år 2: ön 40 → 49

────────── ÅR 3 ──────────
  🔨 Stad bygger SMUTSIG ×3 → skada −24 → −30 → −36 → −42
     ⏳ miljötröskeln för STRÖMAVBROTT passerad (−30 ≤ −25) — men krisen VÄNTAR på årskravet (tidigast år 4)
  📊 BOKSLUT år 3: ön 49 → 34 · ⤷ KVALIFICERAD: VÄRMEBÖLJA — visas ~30 s in i år 4

────────── ÅR 4 ──────────
  ⤷ Lokala kriser vars årskrav NU uppfylls — köas vid byggfasens start:
     ⚠ STRÖMAVBROTT — Stad −20🪙 · öhälsa −8 → 26  (villkor: ackumulerad miljöskada −42 ≤ −25 OCH år ≥ 4)
  ⤷ Öns reaktion från förra året: ⚡ VÄRMEBÖLJA — alla −3 huvudresurs
  📊 BOKSLUT år 4: ön 26 → 29
```
*(Fullständig bygge-för-bygge-logg: `node tools/handelse-protokoll.js 1000 normal 4 byggtat`.)*

### Lugnt parti — blandade lag, frö 1000, försiktig appetit (hela 8 år)
*Färre byggen, blandar grönt/smutsigt. Fråga: inträffar någon lokal kris? **Ja — två minor i år 2**, inga major.*

```
────────── ÅR 1 ──────────  (Skog −12, Tundra −12 — båda ÖVER −15 → ingen kris; årskrav 2 ändå ej nått)
  📊 BOKSLUT år 1: ön 50 → 26 · ⤷ KVALIFICERAD: VÄRMEBÖLJA, STORM — visas år 2

────────── ÅR 2 ──────────
  ⤷ ⚡ VÄRMEBÖLJA (alla −3) · ⚡ STORM (alla −5)   [fördröjda öhälsohändelser från år 1]
  🔨 Skog bygger standard → skada −12 → −15
     → ⚠ SKADEDJUR  (villkor: −15 ≤ −15 OCH år ≥ 2)   · Skog −10🧱, öhälsa −4
  🔨 Tundra bygger SMUTSIG → skada −12 → −18
     → ⚠ OLJEUTSLÄPP  (villkor: −18 ≤ −15 OCH år ≥ 2)  · Tundra −10🪙, öhälsa −4
  📊 BOKSLUT år 2: ön 18 → 6

────────── ÅR 3–8 ──────────  inga fler byggen, inga fler kriser (ön planar ut på öhälsa 6; majors nås aldrig)
```
*(Full logg: `node tools/handelse-protokoll.js 1000 forsiktig 8 blandade`.)* I båda protokollen följer varje
bygge kedjan **byggnad → miljöpåverkan → ackumulerad skada → krisvillkor → eventuell händelse**, och ⏳
markerar när en tröskel passerats men krisen väntar på årskravet.

## 8. Oväntade konsekvenser
1. **I snabba/aggressiva partier SUPPRIMERAS kriserna nästan helt** — ön kollapsar av byggandet före år 2/4,
   så ett hänsynslöst lag hinner aldrig få sin stora kris (aggressiv: minor/major 51 %/44 % → 0 %/0 %). [OBS]
   **[HYP]** Pedagogiskt tveeggat: "den stora konsekvensen" för grov miljöförstöring kan utebli om gruppen
   kraschar ön först. I realistiskt barnspel (långsammare) är detta mindre troligt, men värt att observera.
2. **Mild ny koncentration vid år-2-byggfasens start** i botregimer (deferred minors köas ihop): ≥3-popup-andel
   12,5 %→22,1 % i normal. Men max popups/byggfas sjönk 8→5 och realistiskt spel är opåverkat (6,2 %). Vi har
   inte flyttat hela problemet — bara gjort år-1-toppen mindre. [OBS]
3. **Fler KRIS-bandsaktiveringar** (0,23→0,77 i normal): ön dröjer kvar i det låga bandet i stället för att
   störta till 0. Öhälsans förlopp ändras — inte sämre, men annorlunda. [OBS]

## Bedömning — ger de nya reglerna en rimligare utveckling?
**Ja.** För realistiskt (barnlikt) spel är resultatet precis det önskade: **inga minor-kriser år 1**, minor
flyttad till år 2, major reserverad för år 4, och **balansen i övrigt identisk**. Protokollen visar en tydlig,
begriplig fördröjning (tröskel passeras → ⏳ väntar → kris vid tillåtet år). Krisernas tidigare konfiskatoriska
drag (−20 mot tom kassa, se balansrapporten §3c) är nästan borta.

**Behöver trösklarna/årskraven justeras ytterligare? — Inte nu.** Två saker bör **observeras i verkligt
rumsspel** innan någon finjustering:
- **Majors sällsynthet.** Med −25 *och* år 4 slår den stora krisen knappt i simulering. Om ni i rummet vill att
  ett ihållande smutsigt lag **ska** få sin stora konsekvens kan major-året sänkas (t.ex. år 3) eller tröskeln
  mjukas (−22). Men det är en medveten balansavvägning — ta den med verkligt speldata, inte botdata.
- **År-2-klustret** i byggtungt spel. Litet i simulering och mildare än den gamla år-1-toppen; mät popup-tätheten
  i nästa testspelning innan ni ev. lägger ett minsta mellanrum mellan köade kriser (presentationssida, rör
  inga trösklar).

**Rekommendation:** behåll de beslutade värdena (−15/−25, år 2/4), driftsätt, och samla rumsdata på (a) hur ofta
majors faktiskt inträffar och (b) hur år-2-starten känns. Inga ytterligare balansändringar utan ditt godkännande.

## Begränsningar
- **[OBS]** botstrategier, inte barn. Normal/aggressiv kollapsar av byggandet år 1–2; försiktig (närmast
  verkligt spel) lever hela spelet. Inga spelardata uppfunna.
- **[KOD]** serverns `fireDueCrises`-anrop (byggfasens start, efter Ö-råd) är kodgranskat; exakt sekundtajming
  beror på verkligt byggtempo/pauser.
- Endast lokala företagskriser ändrade. Byggkostnader, byggnaders miljöpåverkan, krisernas resurs/öhälsoeffekter,
  övriga företagshändelser, fördröjda öhälsohändelser, KRIS-mekaniken, handel/Ö-råd/politik och
  byggbegränsningar är **orörda**. Flash/Skola: Flash opåverkat, Skola får samma nya regler. 17/17 tester gröna.
