# Fördröjda öhälsohändelser — implementation & effekt (Mellan)

*Skriven 2026-11-18 av Claude. Inför en mer naturlig eftersläpning: öns miljö reagerar inte omedelbart
på företagens beslut. Öhälsohändelserna KVALIFICERAS vid bokslut men VISAS först en bit in i nästa
spelår. Inga balansvärden, byggkostnader, produktionsvärden, trösklar eller händelseeffekter ändrade —
detta är en tids-/presentationsmekanik. Företagshändelser, GM och KRIS är oförändrade.*

> **Förloppet vi vill skapa:** företagen bygger → bokslutet avslöjar hur ön mår → ön reagerar under
> nästa spelår. Det händer fortfarande saker under byggfasen (företagshändelser direkt), men öns
> "reaktion" kommer med eftersläpning.

> **Kod:** motorn `spec/engine.js` (kvalificering + väntelista + `fireNextPendingOhalsa`), servern
> `server/server.js` (aktiv-byggtids-schemaläggning). Flagga: `cfg.ohalsaDelayed` (default **true**),
> `cfg.ohalsaDelaySeconds` (default **30**). Legacy omedelbart beteende nås med `ohalsaDelayed:false`.
> Tester: `tools/fordrojd-ohalsa-test.js` (14 block). Jämförelse: `tools/fordrojd-sim.js`.

---

## 1. Så här implementerades mekaniken

**Fyra händelsekategorier, tre tidpunkter (oförändrade utom öhälsohändelserna):**

| Kategori | När den inträffar | Ändrad? |
|---|---|---|
| Företagshändelser (kriser VATTENBRIST/OLJEUTSLÄPP…, prestationer GRÖNA FONDEN/EXPANSION/UPPROR…) | **direkt** när villkoret uppfylls under byggfasen | nej |
| **Öhälsohändelser** (NATUREN BLOMSTRAR, MILJÖLYFT, VÄRMEBÖLJA, STORM) | **kvalificeras vid bokslut → visas ~30 s in i NÄSTA byggfas** | **JA (nytt)** |
| RESURSBRIST (Skola) | **direkt vid bokslut** (pågående produktionseffekt) | **nej — undantagen** (se §6) |
| GM-händelser | när spelledaren aktiverar | nej |
| KRIS | vid bokslut (öhälsa ≤20), befintlig mekanik | nej |

**Motorn (`spec/engine.js`):**
- Ny state-lista `S.pendingOhalsa` — id:n som kvalificerat vid senaste bokslut och väntar på nästa år.
- Vid bokslut (efter kris-grinden, bara när rundan står kvar): `_qualifyPendingOhalsa()` i stället för
  omedelbar köning. Den kontrollerar samma villkor som förr (Miljölyft = årets netto ≥15; NATUREN ≥70;
  VÄRMEBÖLJA ≤35; STORM ≤27 — **exakta värden oförändrade**, lästa ur `spec/content/ohalsa-events.js`)
  och lägger kvalificerade id:n i `pendingOhalsa` via `_pendIf` (som skyddar mot dubbletter: redan visad
  = `firedCompanyEvents`, redan väntande = redan i listan).
- `fireNextPendingOhalsa()` — plockar nästa väntande, tillämpar effekten DÅ (via samma `_queueOhalsa` →
  `companyEvent`-emit som förr) och markerar den visad. Hoppar över om en annan händelse-popup visas just
  nu (köar inte ovanpå). Servern/simulatorn kallar den var 30:e aktiva byggsekund.
- De tidigare MITT-I-ÅRET-triggrarna för öhälsohändelser är avstängda i fördröjt läge: kedjan efter en
  företagskris (en kris sänkte öhälsan → värmebölja) och politik/dilemma-triggern. Öhälsohändelser
  kvalificeras nu **bara** vid bokslut. (Företagskrisernas egna direkta öhälsoeffekter är kvar.)

**Servern (`server/server.js`):** i byggtimerns tick (en gång/sek) räknas aktiv byggtid = `full − timerLeft`.
Vid varje 30-sekundersmärke, om det finns väntande öhälsohändelser och ingen annan popup visas, kallas
`engine.fireNextPendingOhalsa()` → `companyEvent` emitteras → den befintliga 10 s-popup-pausen tar vid.

**UI:** ingen ändring — öhälsohändelserna är `companyEvent` som förr och visas av den befintliga popup-
hanteraren; de emitteras bara vid en annan tidpunkt.

## 2. Hur bokslut och intern öhälsa samverkar
- **Bokslutet är det avgörande tillfället.** Kvalificeringen sker på öns FAKTISKA tillstånd vid bokslut
  (och årets netto för Miljölyft). Bokslutets presentation av öhälsan är oförändrad.
- **Ingen retroaktiv effekt:** resursförändringen tillämpas när händelsen VISAS nästa år, inte vid
  bokslutet. Effekten appliceras exakt en gång (verifierat i test 8+9).
- **Om öhälsan hinner ändras innan visning:** händelsen ligger kvar i kön ändå (kvalificeringen vid
  bokslut är bindande; ingen ny tröskelkontroll vid visning). Så t.ex. en VÄRMEBÖLJA som kvalificerade
  vid öhälsa 30 visas nästa år även om ön då klättrat till 40.
- **En gång per parti** består: `firedCompanyEvents` + dubblettskyddet i `_pendIf` gör att samma
  öhälsohändelse varken kvalificeras eller visas två gånger.

## 3. Hur den aktiva byggtidstimern fungerar
Vi återanvänder den **befintliga byggtimern** (`timerLeft`, `startTimer`) — ingen ny parallell timer.
- Timern tickar 1/sek och minskar `timerLeft` **bara när spelet inte är pausat** (`if (paused || autoPaused) return`).
- Därför räknas aktiv byggtid = `full − timerLeft` bort automatiskt under: **manuell paus**, **dilemma-/
  Ö-råds-auto-paus**, och **händelsepopupens egen 10 s-paus** (popupen sätter `autoPaused`). Popup-tiden
  räknas alltså inte som aktiv byggtid.
- Timern körs bara under byggfasen → inga öhälsohändelser avfyras under bokslut, Ö-råd eller andra faser.
- Väntande som inte hinner visas innan byggfasen tar slut ligger kvar i `pendingOhalsa` och visas nästa
  byggfas (verifierat i test 7). Vid ~100 s byggfas och 30 s-intervall hinner upp till **3** visas/år.

## 4. Resultat före och efter (1000 Mellan-partier/system, samma frön)

### NORMAL expansion (bygger tungt → kollaps år 1–2)
| Mått | A· Tidigare | B· Nytt |
|---|---|---|
| Händelser år 1 | 8,96 | **7,24** |
| Händelser år 2 | 0,20 | 0,46 |
| Händelser år 3–8 | 0,00 | 0,00 |
| Max popups under en byggfas | 11 | **8** |
| Snitt popup-tid per byggfas | 11,5 s | **9,6 s** |
| Andel byggfaser med ≥3 popups | 12,5 % | 12,5 % |
| Slut-öhälsa | 0,0 | 0,0 |
| Andel som når KRIS | 19,9 % | 22,9 % |
| Andel som når öhälsa 0 | 100 % | 100 % |
| Slutförmögenhet Åker/Skog/Tundra/Stad | 27/40/54/25 | 30/43/55/27 |

Öhälsohändelser: tidigare **1,46/parti** (mest via mitt-i-året-kedjan i år 1) → nytt **0,46/parti**
kvalificerade = 0,46 visade, 0 väntande kvar. Färre totalt eftersom kedjan är borttagen och snabba
kollapspartier sällan hinner ett bokslut + nästa byggfas.

### FÖRSIKTIG expansion (överlever alla 8 år)
| Mått | A· Tidigare | B· Nytt |
|---|---|---|
| Händelser år 1 | 3,40 | **2,50** |
| Händelser år 2 | 1,00 | 1,40 |
| Händelser år 3–8 | 0,00 | **0,50** |
| Max popups under en byggfas | 3 | 3 |
| Snitt popup-tid per byggfas | 5,5 s | 5,5 s |
| Andel byggfaser med ≥3 popups | 6,3 % | 6,3 % |
| Slut-öhälsa | 14,9 | **14,9** |
| Andel som når KRIS | 50,1 % | 50,1 % |
| Andel som når öhälsa 0 | 0 % | 0 % |
| Slutförmögenhet | 105/174/236/182 | 105/174/236/182 |

Öhälsohändelser: **1,90/parti i båda** — samma antal, men i nya systemet **flyttade till nästa år och
utspridda** (år 1: 3,4→2,5, och nu 0,5 i år 3–8). **Slut-öhälsa, KRIS, kollaps och ekonomi är IDENTISKA.**

### Tolkning (svar på frågorna)
1. **Minskar popup-avbrotten under år 1?** Ja — år-1-popups ned ~1 st, max/byggfas 11→8, snitt-tid 11,5→9,6 s.
2. **Sprids händelserna naturligare?** Ja — i överlevande spel flyttas öhälsohändelser till år N+1 och
   fördelas 30 s isär (en del hamnar t.o.m. i år 3–8, som förr var helt tomt).
3. **Minskar risken för flera negativa i rad?** Ja, för öhälsohändelserna (de serieläggs 30 s isär och
   staplas inte längre direkt på en företagskris via kedjan). Företagshändelsernas egen täthet är oförändrad.
4. **Förändras öhälsans utveckling?** I överlevande spel: **nej** (identisk). Öhälsohändelserna har
   `ohalsa: 0` — de rör resurser, inte öhälsa — så eftersläpningen är **dramaturgisk/ekonomisk**, inte en
   miljöförändring. (Som förutspått: anta inte att senarelagda händelser förbättrar öhälsan.)
5. **Påverkas ekonomin?** Minimalt. I överlevande spel identisk (alla effekter hinner tillämpas). I
   kollapsande spel något högre slutförmögenhet (−3/−5-dragen hamnar ett år senare, en del hinner aldrig).
6. **Får ön större chans att återhämta sig?** Inte via öhälsan (den ändras inte). Men den första
   byggfasen blir lite lugnare, vilket kan ge barnen mer ro att fatta beslut — en upplevelseeffekt.

## 5. Exempel på ett konkret parti år för år (frö 1000, försiktig, nytt läge)
Öhälsa per år: **1:18 · 2:6 · 3–8:6**.

| År | Vad som händer |
|---|---|
| 1 | Byggen sänker öhälsan 50→18. Vid **bokslutet kvalificeras VÄRMEBÖLJA (≤35) och STORM (≤27)** som väntande. Inget visas ännu. |
| 2 | ~30 s in i byggfasen visas **VÄRMEBÖLJA** (alla −3 huvudresurs); ~60 s in visas **STORM** (alla −5). Öns reaktion på år 1 kommer alltså under år 2. |
| 3–8 | Inga nya öhälsohändelser (båda förbrukade, en gång/parti). |

Jämför tidigare system: där hade VÄRMEBÖLJA/STORM (eller kedjan efter en kris) slagit redan under år 1.

## 6. Tekniska risker och beslut
- **RESURSBRIST undantagen (medvetet).** Den har en pågående produktionseffekt (×0,8) som aktiveras ≤30
  och återhämtas ≥40. För att INTE råka skjuta upp återhämtningen eller ändra produktionen hålls dess
  aktivering/avaktivering **omedelbar vid bokslut** (oförändrad). Bara engångs-öhälsohändelserna fördröjs.
  Verifierat att resursbrist-tillståndet fortfarande följer öhälsan och att faktorn (0,8) är orörd.
- **Sista året:** `endRound` returnerar på sista rundan (öh ≥ tröskel → vinst, annars förlust) **före**
  kvalificeringen → en händelse som skulle kvalificera vid sista bokslutet blir aldrig väntande och visas
  aldrig efter spelslut. Inget extra spelår, ingen permanent väntelista (verifierat test 13).
- **KRIS-replay (rollback):** `pendingOhalsa` sätts vid bokslut, efter rundans snapshot. Vid en KRIS-
  omspelning rullas state tillbaka till rundstart → väntelistan återställs och ev. händelser som hann
  visas under det bortrullade försöket "av-visas" (även `firedCompanyEvents` rullas tillbaka) och kan visas
  igen. Det är konsekvent med full rollback (allt annat rullas också). Replay är sällsynt; värt att nämna.
- **Mycket kort/hårt pausad byggfas (t.ex. Flash):** färre 30 s-slots → väntande bärs oftare över, och i
  enstaka fall hinner en händelse aldrig visas före spelslut (räknas som "väntande kvar"; 0 i Mellan-körningarna).
- **Servertimerns koppling:** avfyrningen bygger på att `timerLeft` bara minskar när `!paused && !autoPaused`.
  Ändras den logiken måste aktiv-tids-märket ses över. En enkel modultest av schemat finns i `fordrojd-ohalsa-test.js`.
- **Ingen UI-ändring behövdes** — men verifiera i rummet att en öhälso-popup som dyker upp mitt i byggandet
  känns bra (den blockerar bygge/handel under sina 10 s, precis som en företagshändelse gör idag).

## 7. Rekommendation om intervallet (30 s)
- **30 s fungerar väl för Mellan** (~100 s byggfas): första reaktionen kommer en bit in i året (inte direkt,
  inte vid bokslut), och 3 slots räcker för de 1–2 öhälsohändelser som normalt kvalificeras. Behåll 30 s som default.
- **Värt att testa i rummet:** 25–40 s. Kortare (25 s) ger ön en snabbare "reaktion" och plats för fler
  visningar; längre (40 s) ger lugnare byggfas men risk att färre hinner visas.
- **Flash är verifierad separat** (byggfas 90 s): motorn tillåter fritt byggande även i Flash (empiriskt
  3 byggen/lag/år — ingen ett-bygge-per-år-regel i motorn, bara den gamla simulatorgränsen som är borttagen).
  Med 30 s får Flash 2 visnings-slots (30/60 s), med 20 s får den 4 (20/40/60/80 s). I 1000 Flash-partier
  visades ALLA kvalificerade öhälsohändelser (1,5–1,9/parti) nästa år med **0 väntande/aldrig-visade** vid
  båda intervallen. 30 s räcker alltså i praktiken, men eftersom Flash bara har 2 slots vid 30 s (och en
  sällsynt bokslut kan kvalificera 3 öhälsohändelser) **är Flash satt till `ohalsaDelaySeconds: 20`** i
  `spec/config/variants/flash.js` som marginal + snabbare reaktion i det korta formatet. Mellan behåller 30 s.
- Intervallet är en **config-ratt per variant** (`ohalsaDelaySeconds`), så det kan tunas utan kodändring.

## Begränsningar
- Simulatorns aktiv-byggtid är en **förenklad explicit modell** (budget 100 s, 30 s-slots, pauser fryser
  klockan). Den fångar VILKA händelser som visas/väntar/aldrig hinner, men exakt sekundprecision beror på
  verkligt spel (byggtempo, pauser). Verifiera i en testspelning.
- Bot-strategier ≠ barn. Normal-regimen kollapsar år 1–2 (byggandet), försiktig överlever — verkligt spel
  ligger emellan.
- Inga balansvärden/trösklar/effekter ändrade; företagshändelser, GM, politik/Ö-råd och KRIS orörda.
  16/16 regressionstester gröna (inkl. nya `fordrojd-ohalsa-test.js`; golden-baslinjen regenererad — enda
  diffen var de nya config-/state-fälten, noll beteendeskillnad i golden-partiet).
