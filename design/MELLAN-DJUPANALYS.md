# Mellan — djupanalys: händelser, ekonomi och vinnare (förståelsefas)

*Skriven 2026-11-18 av Claude. Endast MELLAN (8 år). Syfte: förstå hur de fyra företagen tjänar och
förlorar resurser, vilka händelser som faktiskt inträffar och varför vissa företag vinner — INNAN
balansering. Inga balansvärden, regler eller händelsetriggrar/effekter ändrade. Använder den
korrigerade simulatorn med fritt byggande (flera byggen/år).*

> **Reproducerbart.** Tre spårade partier + byggnadsekonomi + 1000-partisstatistik:
> `node tools/mellan-analys.js` (frön 1001/2002/3003 för parti A/B/C anges nedan). Bot-/strategilogik
> delas med simulatorn via `tools/bot-strategier.js`. **Alla resursändringar stäms av matematiskt**
> (start + bygg + produktion + handel + händelser = slut) — avstämningskolumnen är ✓ i varje tabell.

> **Läsanvisning.** Siffrorna kommer från botsimulering (deterministiska heuristiker), inte människor.
> De visar struktur och storleksordning. Verifierat kontra hypotes hålls isär.

---

## 0. Viktigaste slutsatsen först
**Pengarföretagen (Tundra/Stad) är INTE rikare för att de är pengarföretag.** Byggnadsekonomin är
*exakt symmetrisk* mellan sektorerna. I kontrollerade körningar med samma strategi för alla fyra lag
och utan händelser blir alla fyra **precis lika rika** (kvot 1,00). Rikedomen följer **strategin**
(girigt/smutsigt bygger billigt och tjänar mest), inte sektorn. Att Tundra/Stad "vinner" i blandade
partier beror på att det giriga spelet i blandningen råkar ligga på ett pengar-lag — flyttar man det
giriga spelet till Åker vinner Åker. Detta är en **korrigering** av tidigare rapporters bild av en
"strukturell pengar-dominans" (se §4).

---

## 1. Tre konkreta partier (DEL 1–3)

Strategier: **girig** (mest avkastning, bygger smutsigt), **grön** (bygger bara grönt), **adaptiv**
(girig tills ön krisar), **standard** (bygger mest standard). Expansionsappetit: normal (≤4/år) om
inget annat anges. Handel + automatiska företags-/öhälsohändelser på i alla tre.

### Parti A — blandade strategier (frö 1001, normal expansion)
Åker grön · Skog adaptiv · Tundra girig · Stad standard.

| År | Öhälsa | Byggen (antal/typ) | Nyckelhändelser | KRIS |
|---|---|---|---|---|
| 1 | 50 → 1 | Åker 3 grön · Skog 2 grön+2 smutsig · Tundra 4 smutsig · Stad 3 standard | FRAMTIDSVISIONÄR, GRÖNA FONDEN, EXPANSION (Åker) · SKADEDJUR, OLJEUTSLÄPP, UPPROR, MARKEN RASAR, VÄRMEBÖLJA, STORM. Byggnadernas miljöpåverkan −30 öhälsa. | ⚠️ på |
| 2 | 1 → 0 | Tundra 4 smutsig m.fl. | SKOGSBRAND → öhälsa 0 | kollaps |

**Utfall:** ön kollapsade år 2. Vinnare **Tundra 88** (girig). Så snabbt tippar ön när realistiskt
byggande (Tundra 4 smutsiga/år = −24 öhälsa bara den) möter de automatiska kriserna. *Detta är det
typiska utfallet för "normal blandad" — inte ett olyckligt frö.*

Ekonomisk avstämning (hela partiet, 🪙/🧱 separat):

| Företag | Start | Bygg | Produktion | Nettohandel | Händelser | Slut | ✓ |
|---|---|---|---|---|---|---|---|
| Åker | 35/35 | −56/−40 | +0/+35 | +11/−11 | +10/+2 | 0/21 | ✓ |
| Skog | 35/35 | −60/−26 | +0/+72 | +25/−25 | +0/−12 | 0/44 | ✓ |
| Tundra | 35/35 | +0/−64 | +108/+0 | −37/+37 | −26/+0 | 80/8 | ✓ |
| Stad | 35/35 | −18/−24 | +42/+0 | +1/−1 | −23/−10 | 37/0 | ✓ |

### Parti B — grön omställning (frö 2002, vändning år 4)
Åker & Skog grön från start · Tundra & Stad börjar ekonomiskt och ställer om till grönt år 4.
*De smutsiga lagens FÖRE-fas kördes försiktig (≈1 smutsig/år), inte normal: normal expansion = 8
smutsbyggen år 1 = −48 öhälsa → ön kollapsar innan vändningen hinner ske (eget fynd, jfr Parti A).
Mild start → vändningen går att observera. Grön fas = aggressiv.*

| År | Öhälsa | Vad som händer | KRIS |
|---|---|---|---|
| 1 | 50 → 33 | 4 lag bygger (2 grön-lag, 2 smutsig-lag mild) | |
| 2 | 33 → 16 | MARKEN RASAR, STORM, UPPROR drar öhälsa/resurser | ⚠️ på |
| 3 | 16 → 4 | Tundra fortsatt smutsig (sista smutsåret), ön nära kollaps | |
| **4** | **4 → 19** | **VÄNDNING:** Tundra bygger 3 Vindkraft (grön), Åker/Skog grönt → +15 öhälsa. GRÖN OMSTÄLLNING, MILJÖLYFT | |
| 5 | 19 → 31 | aggressiv grön expansion, +12 öhälsa | |
| 6 | 31 → 46 | fortsatt grönt | ✅ av |
| 7 | 46 → 64 | GEMENSAM SATSNING (alla bygger grönt samma år) | |
| 8 | 64 → 88 | +24 öhälsa | |

**Utfall:** **ön ÖVERLEVDE (öhälsa 88).** Räddningen fungerar: två företag som börjar smutsigt vänder
år 4 och bygger sig ur krisen med flera gröna/år. Vinnare **Tundra 237** — den som var girig först och
sedan byggde grönt aggressivt blev ändå rikast.

| Företag | Start | Bygg | Produktion | Nettohandel | Händelser | Slut | ✓ |
|---|---|---|---|---|---|---|---|
| Åker | 35/35 | −154/−110 | +0/+250 | +123/−123 | +10/+10 | 14/62 | ✓ |
| Skog | 35/35 | −126/−90 | +0/+195 | +91/−91 | +0/+0 | 0/49 | ✓ |
| Tundra | 35/35 | −140/−244 | +573/+0 | −209/+209 | −22/+0 | 237/0 | ✓ |
| Stad | 35/35 | −10/−30 | +154/+0 | −5/+5 | −25/−10 | 149/0 | ✓ |

Notera handelns volym: Åker omsatte +123/−123, Tundra −209/+209 — materiallagen byter material mot
pengar för att ha råd med de dyra gröna byggena. Utan handel vore den gröna omställningen omöjlig för
materiallagen.

### Parti C — spelledaren ingriper (frö 3003, försiktig expansion → överlever)
Blandade strategier (som A) men försiktig expansion så partiet överlever hela 8 år och GM-händelserna
hinner fyra. GM aktiverar 3 av de 4 direkthändelserna.

| År | Öhälsa | GM-ingripande (riktig effekt) | Övrigt | KRIS |
|---|---|---|---|---|
| 1 | 50 → 31 | — | FRAMTIDSVISIONÄR, OLJEUTSLÄPP, VÄRMEBÖLJA | |
| 2 | 31 → 22 | **EKONOMISKT STÖD** → Åker (fattigast) +10🪙/+10🧱 | STORM | |
| 3 | 22 → 25 | — | GRÖNA FONDEN | |
| 4 | 25 → 25 | **MARKNADSKRASCH** → Tundra −10🪙, Stad −10🪙 | | |
| 5 | 25 → 25 | — | | |
| 6 | 25 → 25 | **BRA SKÖRD** → alla +8🧱 | | |
| 7 | 25 → 4 | — | MARKEN RASAR, ÖVERBELASTNING | ⚠️ på |
| 8 | 4 → 4 | — | | ✅ av |

**Utfall:** ön nådde bara 4 (under tröskeln 60) men **kollapsade inte**. Vinnare **Tundra 223** (girig).
GM-direkthändelserna flyttar resurser men ändrar inte öhälsan (de har `ohalsa: 0`) och inte heller
ranking — Tundra vinner trots MARKNADSKRASCH. Notera: ingen handel alls (försiktig appetit har god
marginal och behöver aldrig byta för att bygga).

| Företag | Start | Bygg | Produktion | Nettohandel | Händelser | Slut | ✓ |
|---|---|---|---|---|---|---|---|
| Åker | 35/35 | −42/−30 | +0/+110 | +0/+0 | +20/+15 | 13/130 | ✓ |
| Skog | 35/35 | −22/−10 | +0/+112 | +0/+0 | +0/+0 | 13/137 | ✓ |
| Tundra | 35/35 | +0/−32 | +225/+0 | +0/+0 | −48/+8 | 212/11 | ✓ |
| Stad | 35/35 | −24/−32 | +175/+0 | +0/+0 | −28/+8 | 158/11 | ✓ |

---

## 2. Sammanställning av händelser i de tre partierna
Alla redovisade med riktiga namn. "Faktisk" = efter clamp vid 0 (resurs kan inte bli negativ).

| Parti | Företagskriser | Prestationshändelser | Öhälsohändelser | GM |
|---|---|---|---|---|
| A | SKADEDJUR, OLJEUTSLÄPP, MARKEN RASAR, SKOGSBRAND | FRAMTIDSVISIONÄR, GRÖNA FONDEN, EXPANSION, UPPROR | VÄRMEBÖLJA, STORM | — |
| B | OLJEUTSLÄPP, ÖVERBELASTNING, MARKEN RASAR, UPPROR | FRAMTIDSVISIONÄR, GRÖNA FONDEN, EXPANSION, GRÖN OMSTÄLLNING, GEMENSAM SATSNING | VÄRMEBÖLJA, STORM, MILJÖLYFT | — |
| C | OLJEUTSLÄPP, MARKEN RASAR, ÖVERBELASTNING | FRAMTIDSVISIONÄR, GRÖNA FONDEN | VÄRMEBÖLJA, STORM | EKONOMISKT STÖD, MARKNADSKRASCH, BRA SKÖRD |

**Clamp observerades** flera gånger (t.ex. SKADEDJUR −6🧱 mot Skog med 0🧱 → faktisk 0; STORM mot nära
tomt lag). Avsedd effekt > faktisk effekt när laget redan är tomt — värt att minnas vid balansering:
straffen "studsar" mot golvet och blir mildare ju fattigare laget är.

**Händelsekedjor:** i Parti B år 4 fyrar byggnadernas +15 öhälsa → passerar en tröskel uppåt → MILJÖLYFT
(+3 till alla) i samma bokslut. Positiva och negativa händelser kan alltså trigga varandra via öhälsan.

---

## 3. De fyra företagens ekonomi (DEL 3)
Se avstämningstabellerna i §1 (pengar/material separat, alla ✓). Mönster över de tre partierna:

- **Materiallagen (Åker/Skog)** betalar sina byggen till stor del i **pengar** men producerar **material**
  → kroniskt pengar-underskott. De löser det med **handel** (byter material → pengar). I Parti B omsatte
  Åker 123 i handel, i Parti C (försiktig) 0 — handelsbehovet skalar med byggtakten.
- **Pengarlagen (Tundra/Stad)** betalar i **material** men producerar **pengar** → kroniskt
  material-underskott, spegelvänt. Tundra i Parti B: produktion +573🪙, men bygg −244🧱 och handel +209🧱.
- **Produktionen ackumuleras** (varje bygge höjer den passiva inkomsten permanent) → den som bygger
  mest tidigt får ränta-på-ränta. Det är därför girigt/smutsigt (billigast byggen → flest byggen tidigt)
  blir rikast, oavsett sektor.

---

## 4. Varför "vinner" Tundra/Stad? (DEL 4 — huvudfrågan)

### 4A. Byggnadernas ekonomi är EXAKT symmetrisk
Ur byggnadsbanken (verkliga värden). Återbet. = kostnad(🪙+🧱)/produktion per år; netto = prod·år − kostnad.

| Byggnad (sektor) | Kostnad 🪙/🧱 | Prod/år | Miljö | Återbet. | Netto 8 år |
|---|---|---|---|---|---|
| Industrijordbruk / Oljeplattform / Sågverk / Kolkraftverk (smutsig) | 8/0 resp. 0/8 | 9 | −6 | 0,9 år | +64 |
| Jordbruk / Fabrik / Skogsbruk / Kontor (standard) | 8/6 resp. 6/8 | 7 | −3 | 2,0 år | +42 |
| Eko-jordbruk / Vindkraft / Skogsjordbr. / Solceller (grön) | 14/10 resp. 10/14 | 5 | +3 | 4,8 år | +16 |

Varje material-byggnad har en pengar-spegelbild med **identiska** tal (bara valutorna bytta). Alltså:
smutsigt är ekonomiskt klart bäst (återbet. 0,9 år, netto +64) och grönt sämst (+16) — men **lika för
båda sektorerna**.

### 4B–D. Produktion, handel och kostnader — kontrollerade tester
500 partier/rad, slutförmögenhet (🪙+🧱):

| Uppställning | Material (Åker+Skog) | Pengar (Tundra+Stad) | kvot | Vinnare |
|---|---|---|---|---|
| **Utan händelser, alla giriga** | 74 | 74 | **1,00** | jämnt (74/74/74/74) |
| **Utan händelser, alla standard** | 49 | 49 | **1,00** | jämnt |
| Med händelser, alla giriga | 40 | 35 | 0,86 | material något före |
| Med händelser, alla gröna | 86 | 85 | 0,98 | jämnt |
| Blandat: girig=**Tundra** (pengar) | 33 | 40 | 1,19 | **Tundra** |
| Blandat: girig=**Åker** (material) [swap] | 36 | 29 | 0,79 | **Åker** |

**Slutsats (verifierat):**
- **Utan händelser + lika strategi → kvot 1,00.** Byggekonomin, produktionen, kostnaderna och 1:1-handeln
  är symmetriska. Det finns **ingen inbyggd sektorfördel**.
- **Rikedomen följer strategin, inte sektorn.** Flyttar man det giriga spelet från Tundra till Åker
  byter dominansen sektor (kvot 1,19 → 0,79). "Pengar vinner ~100 %" i tidigare rapporter kom av att
  blandningen alltid satte det giriga/ekonomiska spelet på ett pengar-lag.
- **1:1-handeln är rättvis** i modellen: 1🧱 byts mot 1🪙 och båda är lika lätta att producera (smutsig
  ger 9/år i respektive valuta). Ingen sektor gynnas systematiskt av bytet.
- **Händelser gynnar om något materialsektorn marginellt** (kvot < 1 med händelser, lika strategi) — se §5.

### 4F. Vinnarmekaniken
Vinnaren = högst **pengar + material** summerat (lika vikt). Eftersom byggekonomin är symmetrisk är det
en rättvis jämförelse mellan sektorerna. MEN: hög total förmögenhet ≠ god tillgång till rätt resurs för
att bygga. Ett pengar-lag kan sitta på 200🪙 men 0🧱 och ändå inte kunna bygga (allt kostar material).
I Parti C slutar Tundra 212🪙/11🧱 — "rikast" men material-fattig. **Rekommendation inför balansering:**
överväg om vinsten ska mäta total förmögenhet eller snarare *byggförmåga/bidrag till ön*, så att
"vinnaren" inte bara är den som hamstrat mest av sin egen bekväma valuta.

---

## 5. Händelsestatistik över 1000 Mellan-partier (DEL 5)
Blandade spelare (Åker grön, Skog adaptiv, Tundra girig, Stad standard), normal expansion, handel på.

| Händelse | Andel partier | Snitt-resursdelta/förekomst | Hårdast drabbat |
|---|---|---|---|
| TUNDRA MILJÖKRIS liten / stor | ~100 % / ~100 % | −10 / −16 | Tundra |
| SKOG MILJÖKRIS liten / stor | ~100 % / 43 % | −9 / −11 | Skog |
| STAD MILJÖKRIS liten | 27 % | −1 | Stad |
| UPPROR | ~100 % | −25 (−15🪙/−10🧱) | rikaste laget |
| VÄRMEBÖLJA | ~100 % | −9 (−3/lag) | alla |
| STORM | 46 % | −18 (−5/lag) | alla |
| GRÖNA FONDEN / EXPANSION | ~100 % | +5 | Åker |
| FRAMTIDSVISIONÄR | ~100 % | +10 (+5🪙/+5🧱) | Åker |
| **Fyrar ALDRIG i denna mix:** ÅKER-kriser, STAD stor kris, GRÖN OMSTÄLLNING, GEMENSAM SATSNING, NATUREN BLOMSTRAR, MILJÖLYFT, RESURSBRIST | 0 % | — | — |

Snitt **9,2 händelser/parti**. Varför vissa aldrig fyrar (viktigt — det är strategiberoende, inte trasigt):
- **Åker-kriser:** Åker spelar grönt → ingen miljöskadlig impact ackumuleras → tröskeln −10 nås aldrig.
- **GEMENSAM SATSNING / NATUREN BLOMSTRAR / MILJÖLYFT:** kräver att alla bygger grönt samma år resp. att
  öhälsan stiger högt — i blandat spel kollapsar ön i stället, så dessa positiva trösklar nås sällan.
- **RESURSBRIST:** är Skola-exklusiv (complexEvents) → fyrar korrekt aldrig i Mellan.
- I de spårade partierna B/C (med gröna lag/omställning) fyrar flera av dessa (GRÖN OMSTÄLLNING, GEMENSAM
  SATSNING, MILJÖLYFT) — de är alltså inte döda, bara villkorade av grönt spel.

### Varifrån kommer resursrörelsen? (snitt/parti, |Δ| per kategori)
| Kategori | Åker | Skog | Tundra | Stad |
|---|---|---|---|---|
| Byggkostnad | 77 | 52 | 38 | 40 |
| Produktion | 19 | 41 | 50 | 26 |
| Handel | 41 | 67 | 34 | 1 |
| Händelser | 25 | 18 | 28 | 30 |
| **Andel händelser** | **16 %** | **10 %** | **19 %** | **31 %** |

Händelser står för 10–31 % av resursrörelsen; resten är bygg/produktion/handel. Stad påverkas mest av
händelser (UPPROR + storm drar mycket relativt dess låga byggaktivitet).

### Isolering: samma frön MED vs UTAN automatiska händelser (1000 partier)
| | Slut-öhälsa | Kollaps | Förmögenhet (Åker/Skog/Tundra/Stad) |
|---|---|---|---|
| MED händelser | 0,0 | 100 % | 27 / 40 / 54 / 25 |
| UTAN händelser | 0,0 | 100 % | 25 / 53 / 105 / 63 |

**Nyckelinsikt:** vid normal byggtakt **kollapsar ön lika säkert utan händelser** — det är det smutsiga
byggandet (Tundra 4 oljeplattformar/år = −24 öhälsa) som tippar ön, inte händelserna. Händelsernas roll
är i stället att **dränera förmögenhet**, särskilt hos de rika giriga pengar-lagen (Tundra 105 → 54,
Stad 63 → 25 med händelser på). Händelserna **utjämnar** alltså ekonomin snarare än att förstärka en
sektorskillnad. *(Detta nyanserar förra rapportens §7, som vid 1 bygge/år tillskrev händelserna
kollapsen — vid realistisk byggtakt är byggandet den drivande faktorn.)*

---

## 6. Viktigaste slutsatser inför balanseringen
1. **Ingen strukturell pengar-dominans.** Byggekonomin är symmetrisk; rikedom följer strategi, inte
   sektor (§4). Ett balansmål "jämna ut sektorerna" är alltså fel diagnos — sektorerna ÄR jämna. Det som
   "vinner" är girigt/smutsigt spel. Frågan är snarare: ska smutsigt vara så ekonomiskt överlägset
   (netto +64 mot grönts +16 på 8 år)?
2. **Smutsigt byggande är ekonomiskt klart bäst OCH tippar ön.** Återbetalning 0,9 år för smutsigt mot
   4,8 år för grönt. Vid fritt byggande kollapsar normal blandad lek på ~2 år av byggandet ensamt (§5).
   Största balanshävstången: minska smutsigt-grönt-gapet (dyrare/mindre avkastning smutsigt, eller
   billigare/mer avkastning grönt) så att grönt blir ett ekonomiskt val, inte bara ett moraliskt.
3. **Grön omställning fungerar och är dramatisk** (Parti B: 4 → 88 öhälsa) — men bara om ön lever kvar
   till vändningen. Med fyra giriga lag är fönstret ~år 2; med gröna ankare räcker år 4. Pedagogiskt mål
   nåbart; justera byggtakt/straff så fönstret blir lagom brett.
4. **Händelserna utjämnar snarare än driver.** De drar mest från de rika giriga lagen (UPPROR −25 på den
   rikaste; Tundra-kriser −16). Vill man att grönt ska löna sig kan händelsesidan förstärka det (redan
   idag gynnas Åker av GRÖNA FONDEN/EXPANSION/FRAMTIDSVISIONÄR), men grundobalansen smutsigt>grönt sitter
   i byggvärdena, inte i händelserna.
5. **Flera positiva trösklar nås aldrig i realistiskt spel** (NATUREN BLOMSTRAR, MILJÖLYFT, GEMENSAM
   SATSNING) eftersom ön sällan mår bra nog. De aktiveras när gruppen spelar grönt (Parti B) — knyt gärna
   dem tydligare till räddningsögonblicket så belöningen känns.
6. **Vinnarmekaniken** mäter total förmögenhet; överväg om den i stället (eller också) bör mäta
   byggförmåga/bidrag, så att "vinnaren" inte är den som hamstrat mest av sin egen valuta utan kunnat
   bygga (§4F).

## Begränsningar (så resultaten inte övertolkas)
- Botstrategier ≠ barn; handel modelleras som ren bygg-möjliggörare (1:1) → verklig handel troligen rikare.
- GM-händelser injiceras vid fasta år (simulatorn "är" spelledaren); motorn slumpar dem aldrig.
- De tre partierna är enskilda frön (1001/2002/3003), valda för att illustrera tre förlopp (kollaps /
  grön räddning / GM-ingripande), inte för att bekräfta en slutsats. De statistiska påståendena (§4B–D,
  §5) bygger på 500–1000 partier.
- Fas-timers, prisceremoni och 10 s-pauser simuleras inte (påverkar inte ekonomin).
- Allt ovan är **nuläget före balansering** — underlag för tuning, inte en dom. Inga balansvärden ändrade.
