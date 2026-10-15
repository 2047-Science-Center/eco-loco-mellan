# Eco Loco (Mellan) — Kärnprinciper: överlämning till Klara

*Vem: Klara, som ska göra ändringar och balansering i mellanversionen.*
*Vad: vad du INTE får röra (invarianter), vad du FÅR justera (balans-rattar), ett vanligt scenario med sannolika utfallskurvor, lärdomar från originalspelet + referensspel, och idéer kring byten/förhandling.*
*Grundad i: Josefs egna ord om kärnprinciperna (facit), `spec/engine.js` (motorn = källa till sanning), `SPELINFO.md`, originalspelets regler (`~/Desktop/2047/Eco Loco/`), samt research på allmänningens-tragedi-spel.*
*Skapad 2026-10-15. Committa inte utan Josefs OK.*

---

## KÄRNPRINCIPER FÖR KLARA — klar lista med motiveringar

*Detta är det viktigaste i hela dokumentet. Varje princip är OKRÄNKBAR. För var och en: **(1) vad den är**, **(2) VARFÖR den är okränkbar — med källa i spelets dokumentation**, **(3) vad det betyder att INTE röra den.** Motiveringarna är hämtade ur det underlag Josef gav när Eco Loco Mellan byggdes: originaldokumenten i `~/Desktop/2047/Eco Loco/` samt repo-dokumenten `design/GAME-DESIGN.md`, `design/INTRODUKTION.md` och `SPELINFO.md`. Detaljerna + rattarna du FÅR vrida på står längre ner (§1–§5).*

### P1 — Det ska vara svårare att vara grön
- **Vad:** Smutsigt är billigast och mest lönsamt på kort sikt; grönt kostar mer och ger mindre, men skonar ön. Den som kör smutsigt hamnar i ekonomiskt överläge.
- **Varför (okränkbar):** Det är hela det verklighetstrogna dilemmat — att det *lönar sig* att smutsa ner är det som gör valet svårt och lärorikt. `design/GAME-DESIGN.md` bygger varje byggkort så att smutsig ger mest inkomst/runda men mest öhälso-skada; `Bas Eco Loco flash.xlsx`/"5 minuter till kollaps" uttrycker det som **I vs G** i varje runda ("Maxvinst = I +++ / G ---"): hög individuell vinst betalas med hög gemensam skada. Tar man bort det blir grönt ett gratisval och spelet har inget dilemma kvar.
- **Att inte röra den:** Du får justera *hur mycket* dyrare/sämre grönt är (siffrorna i korthänderna), men aldrig vända riktningen så att grönt blir det ekonomiskt bästa valet.

### P2 — Privat vinst, delad nota (allmänningens tragedi)
- **Vad:** Vinsten av ett smutsigt bygge går till ett lag (privat). Skadan drabbar den enda, delade ö-mätaren (alla fyra).
- **Varför (okränkbar):** Det ÄR allmänningens tragedi, och syftet med stationen (`SPELINFO.md`: "Vinsten är privat, notan delas av fyra"). Originalets flash-design kodar det explicit per runda som **I (individuell) mot G (gemensam)** (`Bas Eco Loco flash.xlsx`). `design/GAME-DESIGN.md`: "Den som blir rik på öns bekostnad ska inte kunna vinna ostraffat: ön bärs bara gemensamt." Delar man upp ö-mätaren per lag, eller låter skadan stanna hos den som orsakar den, försvinner tragedin.
- **Att inte röra den:** Håll ö-hälsan som EN gemensam mätare. Slå aldrig isär den per lag, och låt aldrig en förorenare bära bara sin egen andel av skadan.

### P3 — Två valutor och tvingad handel (sektorregeln)
- **Vad:** Varje lag tjänar bara en valuta (material 🧱 eller pengar 🪙) men behöver båda för att bygga. Materialsektorn (Åker/Skog) ger bara material; pengarsektorn (Tundra/Stad) ger bara pengar.
- **Varför (okränkbar):** Det är mekaniken som tvingar lagen att prata och förhandla — utan den kan alla köra sitt eget race i isolering. Originalbalansen (`Balansering Eco Loco.xlsx`) designar sektorerna så att byggnader medvetet "**fastnar i sin flik**" (Produktion ger mest resurser, Infrastruktur/Jordbruk mest pengar) just för att framtvinga handel. `design/GAME-DESIGN.md`: "Man tjänar bara den ena valutan men behöver den andra för att bygga → man måste byta med de andra." Josef har uttryckligen backat ett tidigare förslag om att slå ihop till en valuta.
- **Att inte röra den:** Slå ALDRIG ihop till en valuta och kapa aldrig beroendet. Behåll två valutor och sektor-låsningen.

### P4 — Omröstning är de svagas verktyg mot den mäktige
- **Vad:** De lag som inte kör smutsigt måste gå ihop — via omröstning (och handel) — för att hålla ön över tröskeln. De politiska verktygen (grön satsning / miljöskatt / förbjud smutsig) och 3-av-4-grinden är samarbetstvingande.
- **Varför (okränkbar):** Den som blir rik ska kunna skaffa maktmedel; motvikten ska vara att de andra tvingas organisera sig. `design/GAME-DESIGN.md` beskriver politiken som "ett socialt system" med en röst mot ön (grön satsning) och två mot boven (miljöskatt, förbjud smutsig). `SPELINFO.md` kallar det samarbetstvingande och pekar ut friåkarproblemet som avsiktligt. Originalets flash-kurva (`Spelregler Eco Loco flash.docx`) bygger hela mitten av spelet på villkorad samordning ("+35 Hälsa om minst 3 lag investerar").
- **Att inte röra den:** Behåll omröstningen som bindande gruppmekanik (3 av 4) och de tre förslagstyperna. Gör inte politiken till något enskilt lag kan lösa ensamt.

### P5 — Rikast vinner (totalt kapital), och det ska vara lättare att vinna smutsigt
- **Vad:** Den med störst **totalt kapital (pengar + material)** vinner — så som motorn räknar idag. Det ska vara lättare att vinna om man kör smutsigt; grönt räddar ön men vinner sällan partiet.
- **Varför (okränkbar):** Det är den obekväma sanningen stationen vill lära ut — att det är svårt att lägga bördan på företag att ta ekologiskt ansvar (`SPELINFO.md`; intern projektkontext). `design/GAME-DESIGN.md` anger uttryckligen "rikast (pengar + material) vinner". **Bekräftat beslut:** vinstmåttet är totalt kapital (pengar + material), inte enbart pengar — ingen öppen fråga längre.
- **Att inte röra den:** Behåll rikast-vinner på totalt kapital. Belöna inte grön spelstil med själva segern (den belönas genom att ön överlever, P6) — annars försvinner lärdomen.

### P6 — Faller ön under tröskeln förlorar ALLA
- **Vad:** Oavsett vem som är rikast: når ön inte över tröskeln (60) vid sista rundan — eller når den 0 under spelet — förlorar alla. Rikast-vinner gäller bara om ön överlever.
- **Varför (okränkbar):** Det är spänningen som tvingar även den giriga att bry sig om helheten. `design/GAME-DESIGN.md`: "Öhälsa under tröskeln → alla förlorar. Öhälsa når 0 → direkt kollaps, alla förlorar." Flash-designens runda 8 ("Sista chansen / Existentiell kris: *Offrar du din seger för att rädda alla?*") är byggd kring exakt detta. Utan tröskeln blir det ett rent girighetsspel utan allmänningsdilemma.
- **Att inte röra den:** Behåll uppåt-tröskeln vid slutet och 0-kollapsen. Själva tröskelvärdet (60) är en ratt du får flytta; att den finns är det inte.

### P7 — Lärdomen (allmänningens tragedi) är helig
- **Vad:** Upplevelsen ska vara verklighetstrogen: allmänningens tragedi, och hur svårt det är att tvinga företag att bära det ekologiska ansvaret. All balansering ska tjäna den lärdomen.
- **Varför (okränkbar):** Det är stationens hela existensberättigande (`SPELINFO.md`, `design/GAME-DESIGN.md`: "Kärnan — allt annat tjänar detta"). Ett parti där det är lätt och gratis att vara grön, eller där girighet alltid bestraffas rättvist, har tappat poängen och blir ett vanligt vinn-spel.
- **Att inte röra den:** När du balanserar, fråga alltid: tjänar detta lärdomen? Gör inte spelet "snällt" eller "rättvist" på bekostnad av dilemmat.

### P8 — Strukturen: 4 lag, 3 val, en ö-mätare
- **Vad:** Fyra lag = fyra områden. Exakt tre kort-val per runda (SMUTSIG / STANDARD / GRÖN). En gemensam ö-hälsomätare 0–100.
- **Varför (okränkbar):** Tre-valsgrammatiken är "spelets heliga treenighet" (`SPELINFO.md`) och håller tröskeln låg (ett begrepp, tre val) — ett medvetet svar på originalets problem "för mycket text / för krångligt". `design/GAME-DESIGN.md` låser "4 lag, ett per område" och "en delad mätare".
- **Att inte röra den:** Behåll fyra lag, tre val och en mätare. *Antalet rundor* får du experimentera med (se §3), men inte grammatiken.

### P9 — Sektorerna är lika starka från start; spelarnas VAL ska avgöra
- **Vad:** Ingen sektor (material vs pengar) ska vara född vinnare. Utfallet ska avgöras av hur lagen spelar — inte av vilket område de råkade få.
- **Varför (okränkbar):** **Bekräftat beslut:** sektorerna ska vara lika från start, spelarnas val avgör, inte startläget. Detta rättar det kända, oavsiktliga balansfelet där pengarsektorn vinner ~100 % för att dess kort är billigare/snabbare/renare (`SPELINFO.md` balansläge; `tools/simulera.js`). Lärdomen (P7) kräver att det är *valet* att smutsa ner, inte en slumpad startposition, som bestämmer — annars lär spelet ut fel sak.
- **Att inte röra den:** När du balanserar korthänderna, sikta på symmetriska sektorer (spegla smutsig/standard/grön mellan material och pengar). Bygg inte in en permanent över-/underklass som startläge.

### P10 — Riggsömmen (MQTT-id:n) rörs av ingen
- **Vad:** Topics `ecoloco/<bänk>/money|resources|winner|looser|…` och `AREAS[].id` (`aker/skog/tundra/stad`) driver den fysiska hårdvaran (displayer, LED).
- **Varför (okränkbar):** Mellanversionen är byggd för att återanvända den fysiska riggen oförändrad (`SPELINFO.md`, `ARCHITECTURE.md`). Ändrar du id:n eller topic-namn slutar hårdvaran fungera.
- **Att inte röra den:** Ändra aldrig dessa id:n eller topic-namn. (Visningsnamnen Oxen/Björnen/Räven/Örnen får du ändra fritt — de syns bara på skärm.)

---

## 0. Läs detta först — en varning innan du vrider på något

Spelet har **ett känt, ej åtgärdat balansfel** (simulerat över 3000 partier/scenario i `tools/simulera.js`):

1. **Pengarsektorn (Tundra/Stad) dominerar oavsiktligt** — deras kort är billigare, ger snabbare payback OCH skadar ön mindre än materialsektorns (Åker/Skog) på alla tre nivåer. Pengarsektorn vinner ~99–100 % av partierna. Detta är en *bugg i siffrorna*, inte en designad klasskillnad.
2. **Överlevnaden är i stort sett binär** — i simuleringen räddar bara helt gröna grupper ön (100 %), allt annat kollapsar (0 %). Räddningen ligger alltså idag *utanför* räckhåll för en normalgrupp, vilket är fel (se referenskurvorna i §4).

**Bekräftade beslut (gäller — inga öppna frågor längre):** (a) **Vinstmått = totalt kapital (pengar + material)**, precis som motorn räknar idag (P5). (b) **Sektorerna ska vara lika starka från start** — spelarnas val ska avgöra, inte startläget (P9). Din balansering av korthänderna ska alltså sikta mot *symmetriska* sektorer, inte en designad över-/underklass.

Det betyder: **målkurvan i §3 är ett MÅL att balansera MOT, inte en beskrivning av vad motorn gör idag.** Din första uppgift är sannolikt att stänga glappet mellan dagens motor och den kurvan. Gör det genom balans-rattarna i §2 — inte genom att röra invarianterna i §1.

---

## 1. OKRÄNKBARA invarianter — rör inte dessa

Dessa är spelets själ. Ändrar du dem bygger du ett annat spel. (Josefs ord är facit; motorn implementerar dem så här idag.)

### 1.1 Det ska vara SVÅRARE att vara grön
Smutsigt ska vara **billigast och mest lönsamt på kort sikt**. Den som kör smutsigt ska hamna i **ekonomiskt överläge**. Grönt ska kosta mer och ge mindre, men skona ön.
> Motorn idag: smutsigt är billigast + ger högst inkomst/runda men mest öhälso-skada; grönt är dyrast + lägst inkomst men bygger öhälsa. Rangordningen billig→dyr = smutsig→standard→grön är helig. Du får justera *hur mycket*, inte *vilket håll*.

### 1.2 Privat vinst, delad nota (allmänningens tragedi)
Vinsten av ett smutsigt bygge ska vara **privat** (går till ett lag). Skadan ska drabba den **delade** ö-mätaren (alla fyra). Detta är hela den pedagogiska poängen. Ö-hälsan är en enda gemensam mätare — slå aldrig isär den per lag.

### 1.3 Tvingad handel via två valutor (sektorregeln)
Varje lag tjänar **bara en** valuta (material 🧱 *eller* pengar 🪙) men behöver **båda** för att bygga. Materialsektorn (Åker/Skog) ger bara material; pengarsektorn (Tundra/Stad) ger bara pengar.
> Detta tvingar fram byteshandel och förhandlingsmakt. Slå ALDRIG ihop till en valuta och kapa aldrig beroendet — det är en av kärnorna. (Josef har uttryckligen backat ett tidigare förslag om att göra just detta.)

### 1.4 Övriga måste använda verktygen (omröstning) för att gå ihop mot den mäktigaste
Spelet ska *kräva* att de svagare lagen samordnar sig — via **omröstning** (och handel) — för att hålla ön över tröskeln. Den som kör smutsigt och blir rik ska kunna skaffa sig **maktmedel** mot de andra; motmedlet är att de andra röstar ihop. De tre politiska verktygen (grön satsning / miljöskatt / förbjud smutsig) och 3-av-4-grinden får finnas kvar som samarbetstvingande mekanik.
> Obs: "maktmedel mot andra spelare" är idag bara delvis byggt (den rikes makt = kontroll över den valuta andra behöver i byten, plus att den rike kan rösta ner förslag). Explicита makt-drag är ett möjligt *bygge*, inte något som finns att balansera än — stäm av med Josef innan du lägger till något.

### 1.5 Vinstvillkor: rikast vinner, OCH det ska vara lättare att vinna smutsigt
Den med **mest pengar/kapital vinner**. Det ska vara **lättare att vinna om man kör smutsigt**. Grön spelstil ska rädda ön men sällan vinna partiet — det är poängen med lärdomen (se 1.6).
> Motorn idag: vinnare = högsta `pengar + material` (totalt kapital). **Bekräftat beslut:** vinstmåttet är totalt kapital (pengar + material) — så som motorn räknar idag. Ingen öppen fråga; ändra inte vinstmåttet.

### 1.6 Tröskel-utfall: faller ön under gränsen förlorar ALLA
Oavsett vem som är rikast: når ön inte över tröskeln vid sista rundan — eller når den 0 under spelet — **förlorar alla**. Rikast-vinner gäller bara om ön överlever. Detta är spänningen som tvingar även den giriga att bry sig om helheten.

### 1.7 Syftet / lärdomen är helig
Upplevelsen ska vara **verklighetstrogen**: allmänningens tragedi, och hur **svårt det är att lägga bördan på företag att ta ekologiskt ansvar**. All balansering ska tjäna den lärdomen. Ett parti där det är lätt och gratis att vara grön, eller där girighet alltid bestraffas rättvist, har tappat poängen.

### 1.8 Strukturen: 4 lag, 8 rundor, 3 val, en ö-mätare
4 lag = 4 områden. Exakt **3 kort-val per runda** (SMUTSIG / STANDARD / GRÖN) — den heliga treenigheten. En gemensam ö-hälsomätare. Antalet *rundor* får du experimentera med (se §2), men 3-valsgrammatiken och fyra-lag-strukturen ligger fast.

### 1.9 Riggsömmen (MQTT) är rörd av ingen
Topics `ecoloco/<bänk>/money|resources|winner|looser|…` och motorns `AREAS[].id` (`aker/skog/tundra/stad`) driver den fysiska hårdvaran. Ändra ALDRIG dessa id:n eller topic-namnen — displayer/LED slutar fungera. (Visningsnamnen — Oxen/Björnen/Räven/Örnen — får du ändra fritt.)

---

## 2. Vad du FÅR justera — balans-rattarna

Allt tunbart ligger i `DEFAULT_CONFIG` i `spec/engine.js` och kan live-överskridas i `spec/assets.json` (`config`-blocket, läses utan omkompilering). **Det är rätt yta att äga.** Rör helst inte motorns logik — bara siffrorna.

### 2.1 Globala rattar (`DEFAULT_CONFIG`)
| Ratt | Idag | Vad den styr |
|---|---|---|
| `rounds` | 8 | Antal rundor. Josef vill troligen lägga till rundor — se §3. |
| `timerSec` / `timerSecEarly` / `earlyRounds` | 90 / 120 / 3 | Rundtid; de första rundorna längre för inlärning. |
| `startPengar` / `startMaterial` | 40 / 30 | Startkapital per lag. |
| `ohStart` | 50 | Öns starthälsa (0–100). Original startade på **70** — sänkt start = snabbare kris. |
| `threshold` | 60 | Öhälsa som måste nås vid slutet för att ön ska överleva. |
| `redZone` | 30 | Under detta = kris. |
| `greenZone` | 70 | Över detta = blomstring. |
| `eventLoss` | 10 | (Legacy-ratt.) |
| `gronCost` / `gronGain` | 10 / 8 | "Grön satsning": kostnad per ja-röst / öhälsa den ger. |
| `taxAmount` | 15 | "Miljöskatt": belopp värsta boven betalar. |

### 2.2 Korthänderna (`MATERIAL_HAND` / `PENGAR_HAND`)
Varje kort: `kp`/`km` = engångskostnad (pengar/material), `gp`/`gm` = passiv inkomst/runda, `oh` = engångseffekt på öhälsa.
> **Detta är den viktigaste balansspaken** och där det kända felet bor (§0). **Bekräftat beslut (P9):** sektorerna ska vara lika starka från start — spegla händerna (ge båda sektorer symmetrisk smutsig/standard/grön med spänning, i stället för att den ena är strikt bättre). Bygg alltså INTE in en medveten över-/underklass som startläge; det är spelarnas *val* att smutsa ner som ska skapa överläget (P1), inte vilket område de fick.

### 2.3 Händelserna (`EVENTS` + `EVENT_CONFIG`)
Rena text/sifferstrukturer, byggda för att redigeras direkt. `chansPerRunda` (0.5) = hur ofta en händelse dras i auto-läge. Varje händelse har `traffar` (alla / rikaste / greenaste / sektorPengar / sektorMaterial / omrade:<id>), `pengar`/`material`/`egenValuta`/`oh`, och typ `auto` (slår direkt) eller `rost` (individuell frestelse). Lägg gärna till, ta bort eller justera — men behåll balansen mellan straff-mot-rikaste (t.ex. `uppror`) och frestelser (t.ex. `sponsrat`), eftersom de bär maktdynamiken i 1.4.

### 2.4 Svårighetsgrader
Tänk svårighetsgrader som **config-presets** (olika `ohStart`/`threshold`/`gronGain`/`eventLoss` m.m.), inte som ny kod. OBS: de blir meningsfulla först EFTER att kärnbalansen (§2.2) är fixad.

### Du FÅR INTE justera via config:
riktningen billig→smutsig (1.1), antal valutor (1.3), 3-valsgrammatiken, vinst/förlust-logiken (1.5–1.6), eller MQTT-id:n (1.9). Dessa ligger i logiken, inte i siffrorna — och är invarianter.

---

## 3. Vanligt scenario + sannolika utfallskurvor

### Det vanliga scenariot (Josefs facit)
Det ska vara **normalt** att 1–2 lag kör sitt eget smutsiga race. Deras privata ekonomi skenar medan ö-notan delas av alla fyra → **inom få rundor (av bara 8) uppstår kris om inget görs.** Då *måste* de övriga använda verktygen (omröstning + handel + grön satsning) för att vända. Lyckas de vända sker det långsamt först, sen snabbt. Det rikaste (ofta smutsiga) laget vinner ändå om ön råkar överleva — det är lärdomen.

### Kurvformen du ska balansera mot
Josefs beskrivning (bekräftad mot originalets dokumenterade kurvor, §4): **exponentiell förändring åt båda håll — börjar långsamt, går sedan snabbare. Kris kommer FORT, mitten kräver mycket samarbete för att vända, och då kan det eskalera snabbt uppåt.**

Två mätare rör sig samtidigt och i otakt:
- **Öns hälsa** (delad): dyker tidigt mot röd zon, planar/vänder i mitten om samarbete, accelererar sedan.
- **Ekonomin** (privat, per lag): de smutsiga lagens kapital växer ungefär exponentiellt (inkomst varje runda kompounderar), de gröna halkar efter → **klyftan vidgas över tid** = den mäktiges maktmedel i 1.4.

### Tre sannolika utfallskurvor (öhälsa 0–100 över 8 rundor, start 50)

**Kurva A — "Girig drift / ingen samordning" (vanligaste utan ingripande).**
Snabbt, accelererande fall. Når röd zon runt R3–R4, kollaps (0) före R8. **Alla förlorar.**
```
50 ▇▇▇▇▇▆
46            ▆
38               ▆
28  (röd zon)      ▆
15                   ▆
 0 ──────────────────── ▆  (kollaps ~R6)
   R1  R2  R3  R4  R5  R6  R7  R8
```
Form: konkav nedåt — lugnt först, sedan brant. Motsvarar originalets "egoistiska grupp" (70→70→35→35→10→0) och Fishbanks krasch-by-default.

**Kurva B — "Sen räddning / allmänningens tragedi" ← REKOMMENDERAD MÅLKURVA.**
Dyker ner i/mot röd zon (kris känns på riktigt), de övriga vaknar och samordnar i mitten (R4–R6: grön satsning + handel + förbjud smutsig), vändning som först går trögt och sedan accelererar uppåt — landar **precis runt tröskeln 60** vid R8. Nagelbitare. Ön överlever knappt; **rikaste (ofta smutsiga) laget vinner.**
```
62                              ▇ ~62 (klarar 60 knappt)
58                          ▇
50 ▇▇▇▆                 ▇
42       ▆          ▇
33          ▆   ▇  (vändpunkt ~R5)
28  (röd)     ▆▇
   R1  R2  R3  R4  R5  R6  R7  R8
```
Form: U/V — accelererande fall, trög vändning, accelererande återhämtning (exponentiellt åt båda håll). Motsvarar originalets "ganska bra samarbete" (70→85→70→90→85→65→100) men sträckt till en knappare marginal. **Detta är känslan Josef vill ha.**

**Kurva C — "Tidig samordning" (ovanligare, men ska vara möjlig).**
Gruppen fattar tidigt, håller ön i gul/grön zon hela vägen, bekväm överlevnad. MEN: den som smög med smutsigt i början är ändå rikast → vinner. Lärdomen i 1.7 landar: *även när ön räddas är det svårt att tvinga företagen att bära kostnaden.*
```
68                        ▇▇▇▇ ~68
60 ──────────────────────────────
54 ▇▇▆▆▇▇▇
   R1  R2  R3  R4  R5  R6  R7  R8
```

### Riktmärke för hur ofta ön ska räddas
Från balansanalysen + referensspel (§4): **naiv/osamordnad grupp 10–20 % överlevnad, delvis samordnad 50–70 %, välsamordnad ~95 %.** Krasch får vara ett vanligt normalutfall (det är pedagogiskt), men räddningen måste ligga **inom räckhåll** för en normalgrupp — annars känns det meningslöst att försöka. Idag är det i praktiken 0 %/100 % (binärt) — det är kurva B:s mellanläge som saknas och som du ska balansera fram.

### Om du lägger till rundor
Josef vill troligen lägga till rundor (ändra `rounds`). Behåll då **formen**, sträck inte bara ut den: tidig kris ska fortfarande komma "fort" (inom ~första tredjedelen), mitten ska vara den långa samarbetssträckan, och sista 1–2 rundorna ska vara ett avgörande (originalet hade en explicit slutkris "Cyklonen Helga" som krävde en stor gemensam insats — en sådan slutrunds-mekanik kan vara värd att återskapa).

---

## 4. Lärdomar — originalspelet + referensspel

### Från original-Eco Loco (det som fungerade)
Originalet finns i tre lager, alla hos Josef (`~/Desktop/2047/Eco Loco/` + repon i org `2047-Science-Center`):

- **Full/mellan (resource management, Unreal):** 4 företag, två mätare (Miljö + Samhälle 0–100), **vinst = båda ≥ 80**, **förlust = endera ≤ 20**. Sektorregeln (Produktion ger bara resurser; Jordbruk & Infrastruktur ger bara pengar) tvingade handel. Ekologin drevs medvetet mot minus för att TVINGA fram forskning/samarbete. Designmål dokumenterat: **~halva lagen förlorar efter ~20 min = pedagogiskt lagom.** Fick superbra recensioner, men var "lite för krångligt + lång insättningstid" (därav mellan/flash-varianterna).
- **Flash ("5 minutes to collapse", scenariokort):** EN ö-mätare, start **70**, kollaps 0, 8 rundor. Här är **den dokumenterade målkänslan** (ur `Spelregler Eco Loco flash.docx`, Josefs facit-kurva), citerat kort:
  > "Runda 1: Samarbete är enkelt. Runda 3–5: Nu börjar det gå åt skogen. Runda 6: Vi kan fortfarande rädda det. Runda 8: Nu avgörs allt."
  Dokumenterade exempelkurvor: *samarbete* 70→85→70→90→85→65→100→100 (överlever); *egoism* 70→70→35→35→10→0 (kollaps redan efter 5 rundor). Dramaturgin designerns egna ord: **optimism → girighet → misstro → återhämtning → slutlig uppoffring.** Runda 6 (Forskningsprojektet, +35 om nog många satsar) var den avsiktliga "balanseringsspaken" för återhämtning efter de oundvikliga sveken i R2–R5.

**Lärdom för dig:** krisen SKA komma tidigt och kännas oundviklig; mitten SKA ha en kraftfull men villkorad återhämtningsmekanik (grön satsning / forskning som bara lyckas om flera går ihop); slutet SKA vara ett avgörande. Kurvan oscillerar/vänder — den är inte en jämn lutning.

**Kända problem från originalet (fixa inte igen):** folk förstod inte röstningen; för mycket text; beroendet (att man MÅSTE byta) gick många förbi tills det var för sent. Mellanversionens UI-arbete adresserar detta — behåll den riktningen.

### Från referensspel / forskning (allmänningens tragedi)
- **Fishbanks** (Dennis Meadows management-simulering): lag driver fiskebolag som konkurrerar om vinst på en delad resurs. **Krasch-by-default** — i dokumenterade körningar kollapsar fiskbestånden mot noll, ofta runt "år 6". Lag som försöker bilda allianser för hållbart fiske gör det ofta **för sent**. Stödjer tidig-kris-sen-räddning-formen. [USF: Fish Banks](https://www.usf.edu/marine-science/news/2021/keeping-good-company-fish-banks-simulation.aspx) · [Fishbanks studentmaterial (sustainabilityscience.org)](https://sustainabilityscience.org/course/course-library/learning-games/fishbanks-students.pdf)
- **Common-pool / public goods-experiment (Ostrom m.fl.):** startsamarbetet är förvånansvärt högt i runda 1 men **sjunker över rundorna** när man inte kan prata; **kommunikation lyfter samarbetet dramatiskt** och homogeniserar utfallen. Detta är den direkta forskningsgrunden för §5 (tvinga fram samtal, inte bara knapptryck). [Ostrom-experiment, indiska byar (dlc.dlib.indiana.edu)](https://dlc.dlib.indiana.edu/dlc/handle/10535/7814) · [Governing the Commons: experimentell info-studie](https://dlc.dlib.indiana.edu/dlc/items/91b18772-0eca-4572-9e8c-62e3bb18426b)
- **Co-op-brädspel (Pandemic m.fl.):** nybörjare förväntas inte vinna första partiet; vinst kommer efter några försök på nybörjarnivå, och bra partier avgörs ofta med minsta marginal (sista draget) — justerbar svårighet ses som en styrka. Stödjer "knapp marginal vid tröskeln" (kurva B) och svårighetsgrader-som-presets. [Board Game Analysis: Pandemic (Uppsala)](https://babel.speldesign.uu.se/?p=7282)

*(Caveat: Fishbanks-"typiska utfall" bygger på klassrumsrapporter, inte publicerad statistik; co-op-vinstnivåerna är spelrapporter, inte designer-mål. Använd banden i §3 som riktmärke, inte exakt facit.)*

---

## 5. Idéer kring byten/förhandling — tvinga fram samtalet

**Problemet idag (`engine.transfer` + bytesmodalen i `src/ui.js` ~662–728):** ett byte är en tyst transaktion. Du öppnar modalen, väljer motpart, ställer "DU GER / DU FÅR" med +/–-knappar och trycker GO. Mot botar accepteras det om det inte är för snålt (`give ≥ get × 0.8`); mot människa får motparten en ett-klicks JA/NEJ-ruta. **Man kan alltså skicka ett bytesförslag helt utan att prata** — telefonen/samtalet blir överflödigt. Josef vill att telefonerna används, men **inte** att de ersätter det mänskliga samtalet (i originalets fulla rigg satt en person och förhandlade via riktig telefon — det var en höjdpunkt).

Idéer (öka samtalstvånget utan att bygga om motorn i grunden — stäm av med Josef innan bygge):

1. **Dela upp förslag och verkställande.** Telefonen/skärmen *initierar* ett byte, men det *bekräftas* bara med en kod/handskakning som motparten måste läsa upp — tvingar minst en mening över bordet/luren. (Forskningen i §4: kommunikation är det som lyfter samarbete.)
2. **Inga sifferfält — bara en inbjudan.** Knappen skickar "Räven vill byta — ring/prata", inte ett färdigt tal. Själva kursen kommer man överens om muntligt och knappar in efteråt. Tar bort den tysta auto-optimeringen.
3. **Öppet bud / auktion i stället för privat DM.** Ett bud syns för alla fyra en kort stund → skapar motbud och snack ("ta inte hans, jag ger mer") i stället för tysta par-transaktioner.
4. **Botarna slutar vara en genväg.** Idag kan en människa handla sig runt problemet mot fogliga botar. Låt botar kräva ett verkligt dåligt pris, eller handla bara efter att ett samtalssteg skett — så att byte mot *människa* alltid är bättre → driver spelare till varandra.
5. **Koppla handel till politik.** Ett byte som "betalning" för en röst (du ger material, jag röstar JA till din miljöskatt) gör förhandlingen till en allians-förhandling, inte bara en kurs. Det matchar 1.4 (gå ihop mot den mäktige).
6. **Tidsfönster för förhandling.** En kort explicit "förhandlingsfas" varje runda där skärmarna visar "PRATA NU" innan byten låses — gör samtalet till en schemalagd, förväntad del, inte något man hoppar över.

Gemensam nämnare: **flytta kursbeslutet från skärmen till människorna, och låt skärmen bara bokföra.** Telefonen används (den initierar/bekräftar), men ersätter inte samtalet.

---

## Snabb-sammanfattning
- **Rör inte:** svårare att vara grön (1.1), privat vinst/delad nota (1.2), två valutor + tvingad handel (1.3), omröstning som samarbetstvång (1.4), rikast vinner + lättare smutsigt (1.5), tröskel → alla förlorar (1.6), lärdomen allmänningens tragedi (1.7), MQTT-id:n (1.9).
- **Vrid på:** `DEFAULT_CONFIG` + `assets.json`-config, korthänderna (`MATERIAL_HAND`/`PENGAR_HAND`), `EVENTS`, svårighetsgrader-som-presets.
- **Bekräftade beslut (gäller):** (a) vinstmått = totalt kapital (pengar + material), som motorn räknar idag (P5); (b) sektorerna lika starka från start — balansera mot symmetri, spelarnas val ska avgöra (P9).
- **Målkurva = Kurva B:** tidig accelererande kris → trög vändning i mitten via samarbete → accelererande återhämtning → knappt över tröskeln vid slutet. Band: osamordnad 10–20 % överlevnad, delvis 50–70 %, välsamordnad ~95 %.
