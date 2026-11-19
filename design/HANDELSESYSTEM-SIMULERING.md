# Händelsesystemet — balanssimulering (förståelsefas)

*Skriven 2026-11-19 av Claude. Syfte: förstå hur Eco Locos ekonomi faktiskt fungerar med det nya
händelsesystemet (företags-, öhälso- och GM-händelser) INNAN balansering. Inga balansvärden ändrade.*

> **Läsanvisning:** siffrorna kommer från botsimulering (deterministiska heuristiker), inte människor.
> De visar strukturella mönster och storleksordningar, inte exakta utfall i rummet. Verifierade mönster
> och hypoteser hålls isär. Reproducerbart: `node tools/simulera.js <N> <variant> [full]` (seedBase 1000).

> ⚠️ **VIKTIGT TILLÄGG 2026-11-18 — läs först.** §4–10 nedan räknades när simulatorn hade en
> **artificiell byggbegränsning: ett bygge per lag och år.** Motorn tillåter obegränsat byggande.
> Begränsningen är nu borttagen och expansionsstrategier (en/försiktig/normal/aggressiv) införda.
> **De korrigerade resultaten och vad de ändrar står i [§11–§14 längst ned](#11-tillägg-byggbegränsningen-var-ett-simulatorfel-korrigerad-2026-11-18).**
> §4–10 behålls som historik men siffrorna där underskattar hur snabbt ön kollapsar i verkligt spel.

## 1. Verktyg och ändringar
- **`tools/simulera.js`** (vidareutvecklad, ingen ny simulator). Tidigare: default-motor, 5 strategier,
  1:1-handel, sektor-/överlevnadsstatistik. Nu tillagt: **variantmedveten** (Flash/Mellan/Skola via
  `spec/config/variants`), **seedade frön** (reproducerbart), **händelse-instrumentering**
  (companyEvent/crisis/ohalsa), **GM-injektion** (simulatorn agerar spelledare vid bestämda år), och
  **detaljstatistik** (byggnadstyper, handel, bygg-fail, händelsefrekvens, öhälsotrösklar, clamp).
- **DEL 2-kodändring:** den autonoma slumphändelsen (`maybeFireEvent` + motorns `_drawEvent`-anrop) är
  borttagen. Händelser kommer nu bara ur `foretag`/`ohalsa` (automatiskt) + `gm` (manuellt). Flash Ö-råd,
  politikurvalet och GM:s manuella slump är orörda. Golden-baselinen regenererad (förväntat).

## 2. Omfattning
1 000 partier/scenario, tre varianter (Flash 4 år, Mellan 8 år, Skola 10 år), ~14 scenarier/variant
(strategi A–D, handel på/av, händelsebelastning baslinje→hög). Körtid ~3 s/variant.

## 3. Hur handel och strategier modellerades
- **Strategier:** A Ekonomisk (alla giriga, mest avkastning), B Miljövänlig (alla gröna), C Blandad
  (alla adaptiva — giriga tills ön krisar), D Blandade spelare (Åker grön, Skog adaptiv, Tundra girig,
  Stad standard). D är viktigast (barn spelar olika).
- **Handel:** 1:1-byte för att ha råd att bygga (skaffar den valuta som saknas från ett lag med
  överskott). **Begränsning:** modelleras bara som "bygg-möjliggörare", inte strategisk handel →
  handelns roll är troligen **underskattad** mot verkligt spel.

## 4. Ekonomisk utveckling per företagstyp (VERIFIERAT)
**Grundläggande sektor-obalans bekräftad.** I baslinjen (inga händelser) är pengarsektorn (Tundra/Stad)
2,7–3,4× rikare än materialsektorn (Åker/Skog):

| Variant | MATERIAL (Åker+Skog) | PENGAR (Tundra+Stad) | kvot |
|---|---|---|---|
| Mellan baslinje | 81 | 270 | 3,35 |
| Skola baslinje | 132 | 400 | 3,04 |
| Flash baslinje | 39 | 106 | 2,73 |

Pengarsektorn vinner (rikast) i **~100 %** av partierna i alla ekonomiskt inriktade scenarier. Detta är
samma strukturella pengar-dominans som sedan tidigare är känd (`design/BALANS.md`), och den kvarstår
med det nya händelsesystemet.

## 5. Resursbrist och låsningar (VERIFIERAT)
- **Med handel:** bygg-fail ≈ 0 — handeln löser i princip all tillfällig resursbrist. Inga permanenta
  låsningar observerades (0 % låsta lag i slutläget).
- **Utan handel:** bygg-fail 0,4–1,5/parti, kollaps ökar (Mellan blandade 90,7 % utan vs 100 % med —
  se nedan), och materialsektorn drabbas oftast (Åker/Skog saknar pengar till gröna bygget 14🪙/10🧱).
- **Slutsats:** handeln är central för att företagen ska kunna fortsätta bygga, särskilt materiallagen.

## 6. Hur ofta ön överlever (VERIFIERAT)
Ön når tröskeln (öhälsa ≥60 vid slut) i princip **bara när alla spelar grönt**:

| Scenario (Mellan) | Överlever | Slut-öhälsa | Kollaps(0) |
|---|---|---|---|
| A Alla giriga | 0 % | 0 | 100 % |
| B Alla gröna | 100 % | 100 | 0 % |
| C Alla adaptiva | 0,2 % | 42,5 | 0 % |
| D Blandade spelare | 0 % | 0 | 100 % |

Adaptivt spel (C) stabiliserar ön runt **öhälsa ~40** men når sällan tröskeln 60. Blandat spel (D, det
mest realistiska) → **100 % kollaps** i Mellan/Skola. Flash (4 år) är mildare: D kollapsar inte helt
(slut-öhälsa ~29) eftersom spiralen inte hinner bli lika djup.

## 7. Händelsernas faktiska påverkan (VERIFIERAT)
Jämförbara frön, blandade spelare (Mellan):

| Händelsebelastning | Slut-öhälsa | Kollaps(0) |
|---|---|---|
| Baslinje (inga) | 17,2 | 0 % |
| Automatiska (foretag+ohalsa) | 0,0 | 100 % |
| Fullt (+GM) | 0,0 | 100 % |

- **De automatiska händelserna driver kollapsen:** samma parti går från öhälsa ~17 (överlever knappt
  som låg) till 0 (total kollaps) när händelserna slås på.
- **Drivande händelser:** företagskriser (−4 vid −10, −8 vid −20 öhälsa) + UPPROR (−3) lägger
  öhälso-smäll OVANPÅ byggnadens egen miljöpåverkan. I blandat spel utlöses tundra/stad-kriserna nästan
  alltid (minor ~1,0, major ~1,0 för det girigaste laget). Öhälsohändelserna Värmebölja/Storm drar
  resurser (inte öhälsa) men slår när ön redan är låg.
- **GM-direkthändelser** ändrar ekonomin men inte överlevnaden nämnvärt (de rör mest resurser).
  EKONOMISKT STÖD + BRA SKÖRD höjer materialsektorns slutförmögenhet något.
- **Clamp** (händelse kan inte dra fullt belopp) är sällsynt (~0,1–0,3/parti) → golvet vid 0 är inget
  stort problem vid nuvarande belopp.

## 8. Variantskillnader (VERIFIERAT)
- **Flash (4 år):** fungerar mildast. För kort för den djupa röd-zons-spiralen; blandat spel hamnar på
  ~29 öhälsa utan total kollaps. Men ekonomin hinner knappt utvecklas — grön strategi ger bara ~29 i
  förmögenhet/lag (mot 68–83 i Mellan). **Hypotes:** 4 år kan vara i kortaste laget för att
  bygg-/handelsmomentet ska kännas meningsfullt ekonomiskt.
- **Mellan (8 år) / Skola (10 år):** längre spel → djupare spiral → blandat/girigt spel kollapsar
  nästan alltid. Skola förstärker både rikedom (adaptiv ~170–214/lag) och kollaps (fler år med
  negativa händelser). Grön strategi gynnas av längden (Skola B: 115–130/lag).

## 9. Identifierade balansproblem (mest betydande först)
1. **Pengarsektorns dominans (strukturell, hög).** Tundra/Stad ~3× rikare än Åker/Skog i baslinjen.
   Materialsektorns gröna bygge (14🪙) saknar peng-inkomst → kroniskt peng-underskott, beroende av handel.
2. **Negativa händelser gör ön nästan oräddningsbar i blandat spel (hög).** Realistiskt (blandat) spel
   kollapsar 100 % i Mellan/Skola. Företagskrisernas öhälso-smäll ovanpå byggnadens egen påverkan är den
   starkaste enskilda faktorn.
3. **Tröskeln 60 nås nästan bara av helgrön grupp (medel).** Adaptivt spel planar ut runt 40 → en grupp
   som "vaknar halvvägs" räddar inte ön med nuvarande belopp. (Jfr överlämningens pedagogiska mål att en
   grupp som vaknar halvvägs SKA kunna rädda ön.)
4. **Grön strategi är överlevnadsbar men ekonomiskt svagare (medel/lågt).** B överlever alltid men är
   fattigare än C utom i Skola. Grönt straffas alltså ekonomiskt på kort sikt (Flash/Mellan).
5. **Flash-ekonomin hinner knappt utvecklas (lågt/medel).** 4 år ger små förmögenheter.

## 10. Rekommenderade justeringar (för kommande balanssteg — EJ genomförda)
*Rangordnade, alla hypoteser att testa i simulatorn + rummet:*
1. **Dämpa företagskrisernas öhälso-smäll** eller gör byggnadens egen miljöpåverkan + krisen till EN
   effekt, så låg öhälsa inte straffas dubbelt. Störst hävstång på överlevnaden.
2. **Minska pengarsektorns inkomstövertag** (t.ex. materialsektorns gröna billigare, eller pengar-
   byggnadernas avkastning något lägre) — adresserar grundobalansen.
3. **Gör grön satsning mer ekonomiskt bärkraftig** (grön produktion/inkomst upp) så "vakna halvvägs"
   blir en vinnande väg, inte bara en överlevnadsväg.
4. **Se över threshold 60 vs faktisk räddningsbarhet** — eller justera händelsebelastningen så adaptivt
   spel kan nå tröskeln.
5. **Flash:** överväg fler år eller högre startresurser om ekonomimomentet ska bära.

## Begränsningar (så resultaten inte övertolkas)
- Botstrategier ≠ barn; särskilt handel modelleras snävt (bara bygg-möjliggörare) → handelns verkliga
  roll är troligen underskattad.
- GM-händelser injiceras vid fasta år (simulatorn = spelledaren); den riktiga motorn slumpar dem aldrig.
- Fas-timers, prisceremoni och 10 s-pauser simuleras inte (påverkar inte ekonomin).
- Politiken är förenklad ("grön satsning vid behov"), inte fullt ordförande-flöde.
- Allt ovan är **nuläget före balansering** — siffrorna är utgångspunkt för tuning, inte en dom.

---

## 11. TILLÄGG: byggbegränsningen var ett simulatorfel (korrigerad 2026-11-18)

*Frågan som utlöste tillägget: företag ska kunna bygga obegränsat antal byggnader per år så länge
resurser och byggfas räcker — det finns ingen regel om max ett bygge per år. Stämde simulatorn med
det? Svar: nej. Inga balansvärden ändrade; bara simulatorns bot-byggande och motoren verifierad.*

### 11a. Motorn (VERIFIERAT — ingen avvikelse)
`spec/engine.js` `selectCard()` tillåter **obegränsat många byggen per lag och runda**: varje anrop
drar full kostnad, ger laget en egen slot, räknar upp `_builtThisYear` och summerar alla rundans
byggen vid bokslut (`_roundCards`). Direkttest: tre byggen samma år → 3 slots, 3×kostnad dragen,
`_builtThisYear=3`. **Motorn hade alltså aldrig någon ett-bygge-per-år-regel.**

### 11b. Simulatorn (FELET — nu korrigerat)
Gamla `tools/simulera.js` byggde **exakt ett kort per lag och år** (ett `break` efter första lyckade
bygget i byggfasloopen). Det var en ren simulatorbegränsning utan motsvarighet i reglerna. Allt i
§4–10 räknades under den. Korrigering:
- Byggfasen bygger nu **flera gånger/år** tills lagets expansionsappetit eller resurser tar slut.
- **Expansionsappetit (DEL 4, ny axel):** `en` (1/år = gamla beteendet, för jämförelse) · `försiktig`
  (max 2, håller reserv 6/6, ingen stretch-handel) · `normal` (max 4, reserv 2/2) · `aggressiv`
  (max 10, reserv 0, bygger tills resurserna tar slut). Appetiten styr HUR MÅNGA; kortstrategin
  (girig/grön/adaptiv/standard) styr VILKET kort. "Fritt byggande" ≠ spendera allt — reserven gör
  att lag kan avstå.
- **Strategiförfining:** "miljövänlig" (`gron`) bygger nu **bara grönt** (bygger inte smutsigt för
  att spara ihop) — gör "alla gröna" till ett trovärdigt tak. Giriga/adaptiva blandar som förut.
- EXPANSION (3 byggen/år), företagskriser och öhälsohändelser verifierade att de utlöses korrekt
  även med flera byggen/år (de fyrar i varje aggressivt/normalt scenario i utdata).

### 11c. Byggen per år nu (Mellan, N=1000)
| Scenario | Byggen/lag/år | (var tidigare) |
|---|---|---|
| Alla giriga, aggressiv appetit | 3,75–4,13 | 1,00 (lås) |
| Blandade spelare (normal) | 3,21 | 1,00 |
| Alla adaptiva | 2,51 | 1,00 |
| Alla gröna (grönt dyrt → få) | 1,06 | 1,00 |
| Försiktig appetit | 0,33 | 1,00 |

Giriga lag bygger ~4 byggen/år (begränsas av start+inkomst, inte av en regel). Gröna lag bygger
**färre** än ett/år i snitt — grönt (14🪙) är så dyrt att de sällan har råd med mer än ett, och
materiallagen (ingen peng-inkomst) ofta inte ens det.

## 12. Hur byggbegränsningen snedvred de tidigare resultaten (VERIFIERAT)
Jämförelse `en`-appetit (= gamla 1/år) mot `normal`/`aggressiv`, blandade spelare, Mellan N=1000:

| Mått | EN/år (gamla) | NORMAL | AGGRESSIV |
|---|---|---|---|
| Byggen/lag/år | 1,00 | 3,21 | 4,13 |
| Kollaps(0) | 100 % | 100 % | 100 % |
| Sektor-kvot (pengar/material) | **2,69** | 1,18 | 1,19 |
| Slutförmögenhet pengarsektorn | 167 | 40 | 39 |

- **Kollapsen fanns redan vid 1/år** i blandat spel — byggbegränsningen dolde den inte helt, men den
  **dolde HUR SNABBT** ön tippar: med realistiskt byggande (3–4 skadliga byggen/år × −6 öh) kraschar
  ön på 1–2 år i stället för att sakta glida ner. Baslinjen (inga händelser) som i §6 låg på öhälsa
  17 utan kollaps **kollapsar nu 100 %** — den gamla siffran var en artefakt av byggtaket.
- **Sektor-dominansen (§4) såg mindre ut än den är i korta partier**, eftersom kollaps kapar
  inkomstackumuleringen. I partier som överlever hela vägen återkommer pengarövertaget tydligt
  (kvot 1,8–3,9 i §13:s överlevande scenarier). Grundobalansen kvarstår alltså — den gamla kvoten
  3,35 var inte fel, men den syns bara när ön lever kvar.
- **Praktiskt:** ju mer lagen bygger, desto fortare kraschar ön — om byggandet är skadligt. Den
  pedagogiska poängen (bygg vårdslöst → snabb kollaps) blir STARKARE med korrekt byggande, inte
  svagare.

## 13. Räddningsfrågan: kan ett smutsigt företag rädda ön med flera gröna/år? (VERIFIERAT — JA)
Detta var själva poängen med fri byggning. Fas-beroende appetit: mild smutsig start (1/år) → aggressiv
grön vändning. Mellan (8 år), N=1000:

| Scenario | Överlever | Slut-öhälsa | Lägsta öhälsa nådd |
|---|---|---|---|
| Alla 4 giriga, vänder aldrig | 0 % (kollaps) | 0 | kollaps år 2 |
| Alla 4 vänder år 2 (direkt) | **100 %** | **100** | dippade ≤27, ej ≤20 |
| 2 gröna ankare + 2 vänder år 3 | **100 %** | **100** | aldrig under 35 |
| 2 gröna ankare + 2 vänder år 4 | **100 %** | **100** | dippade ≤30 |
| 2 gröna ankare + 2 vänder år 6 (sent) | **100 %** | **69** | dippade ≤20 (KRIS), återhämtar |
| 2 gröna ankare + 2 giriga (vänder aldrig) | 0 % (kollaps) | 0 | — |

**Svar: ja, mekaniken fungerar och är kraftfull.** Ett (eller flera) företag som börjar smutsigt kan
rädda ön genom att sedan bygga **flera gröna byggnader samma år** — det var omöjligt att visa med
ett-bygge-per-år. Nyanser:
- **Fönstret beror på hur brant ön faller.** Fyra vårdslösa lag (−24 öh/år) kollapsar ön redan år 2,
  så bara en omedelbar vändning hinner. Med gröna ankare som håller lutningen mild räcker en vändning
  så sent som år 4 (Mellan) för full återhämtning, år 6 för överlevnad med ärr (öhälsa 69).
- **Ju senare vändning, desto djupare dipp** innan återhämtning (år 6 → ända ner i KRIS-zonen).
- **Handel är avgörande** för vändningen: materiallagen måste byta till sig pengar för de dyra gröna
  byggena (upp till 24 byten/parti i vändningsscenariot).
- Flash (4 år): smalare fönster (vändning år 3 klarar tröskeln 60, år 4 överlever men når ej 60).
  Skola (10 år): bredare — räddning möjlig t.o.m. år 5, för sent vid år 7.

## 14. Vad detta ändrar inför balanseringen
- **§9:s problemlista står kvar**, men punkt 3 ("vakna halvvägs räddar inte ön") måste nyanseras:
  med korrekt byggande (flera gröna/år) **GÅR** det att vakna halvvägs — förutsatt att ön inte redan
  tippat. Det pedagogiska målet är alltså uppnåbart; det som fattas är att göra fönstret lagom brett
  (inte så smalt att fyra vårdslösa lag omöjliggör räddning år 2, inte så brett att vårdslöshet är
  gratis). Det är en balansfråga för nästa steg.
- **Pengar-dominansen (§9.1) kvarstår** och bör mätas i överlevande partier, inte i kollapsade.
- **Nytt att väga in:** eftersom byggtakten nu är fri skalar både skada OCH räddning med byggtakten.
  Balanseringen bör sikta på att smutsig expansion kraschar ön "lagom" snabbt (pedagogisk signal) men
  att grön expansion hinner ikapp om gruppen vänder i tid.
- **Simulatorn är nu trogen reglerna** på byggpunkten — tidigare slutsatser om överlevnad/ekonomi bör
  läsas genom §12. Inga balansvärden ändrade; detta var enbart en simulator- och modellkorrigering.
