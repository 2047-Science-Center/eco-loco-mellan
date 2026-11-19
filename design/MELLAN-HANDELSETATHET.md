# Mellan — händelsetäthet & negativa spiraler (förståelsefas)

*Skriven 2026-11-18 av Claude. Endast MELLAN (8 år). Huvudfråga: kan händelsesystemet skapa för många
avbrott eller en för snabb negativ spiral, trots att byggande och ekonomi fungerar bra i de 11 publika
testspelningarna? Inga regler, byggkostnader, produktionsvärden, händelsetriggers eller händelseeffekter
ändrade — ren analys/instrumentering. Inga ändringar i motor, server eller UI.*

> **Reproducerbart:** `node tools/handelsetathet.js` (1000 partier, seedBase 1000, blandade strategier,
> normal expansion, handel + auto-händelser). Återanvänder spec/engine.js + tools/bot-strategier.js.

> **Tre sorters påståenden hålls isär i hela rapporten:**
> **[OBS]** observerat i simulering · **[KOD]** verifierat genom kodgranskning av motor/server (ej kört)
> · **[HYP]** hypotes om hur barn i rummet upplever det.

---

## 0. Kort svar på huvudfrågan
**Ja, det finns en reell risk — men den sitter i FÖRSTA byggfasen, inte utspridd över spelet.** Händelserna
är kraftigt **frontladdade till år 1**: alla händelser är en-gång-per-spel och utlöses när trösklar först
passeras och prestationer först tjänas — vilket sker i den första vågen av byggande. I ett parti där mycket
byggs tidigt (bottarnas normal-regim) fyrar **8–11 händelser i år 1:s enda byggfas**, var och en med en
~10 s popup-paus = **80–110 s avbrott** ovanpå en ~100 s byggfas. Det finns **ingen gräns** på antal
automatiska händelser per byggfas. Däremot bildas **inga långa köer från ett enskilt bygge** (max 2 från
samma bygge) och **ingen självförstärkande flerårsspiral** (öhälso-händelserna sänker inte öhälsa, och
engångsnaturen gör att trycket är slut efter år 1–2). Problemet är alltså **avbrottstäthet i en het
byggfas**, inte en skenande miljöspiral.

---

## 1. Statistik: händelser per parti och år (DEL 2)
**[OBS]** 1000 partier, blandade strategier, normal expansion:

| Mått | Värde |
|---|---|
| Snitt händelser/parti | **9,2** |
| Snitt/spelat år | 7,64 |
| Median/år · 90:e percentil · max | 8 · 11 · **11** |
| Andel spelår med 5+ händelser | 83,4 % |
| Partier med minst ett år ≥3 / ≥5 händelser | 100 % / 100 % |

⚠ **Tolkning (viktig):** med blandade+normal **kollapsar ön år 1–2 av byggandet** (se MELLAN-DJUPANALYS.md).
Därför kläms nästan alla händelser in i **år 1:s enda byggfas** innan kollaps — "8 händelser/år" betyder
här "8 i år 1", inte jämnt över 8 år. Per spelår: år 1 = 8,96 händelser (varav 8,77 i byggfasen), år 2 = 1,0.

**Jämförelse — överlevande lågbygg-regim (försiktig expansion, partier når alla 8 år):** 4,4 händelser/parti,
**0,55/år** (median 0, p90 3, max 4). Per spelår: år 1 = 3,4 · år 2 = 1,0 · år 3–8 ≈ 0. **[OBS]**
→ När ön lever är händelserna få och **front­laddade till år 1–2**; den höga tätheten i normal-regimen är
en följd av kollapsen, inte av åtta års spel. Verkligt barnspel ligger någonstans mellan dessa regimer
(okänt exakt var — testspelningarna byggde "lagom", inte bot-aggressivt).

**Utlösta händelser = popup-avbrott (1:1).** **[KOD]** Varje `companyEvent` (kris, prestation, öhälso-
händelse, GM) relä-sänds och visas som **en** popup med paus — även POSITIVA (GRÖNA FONDEN, EXPANSION,
FRAMTIDSVISIONÄR). Det finns alltså inga "tysta" automatiska händelser; antal utlösta = antal avbrott.

---

## 2. Händelser per byggfas och kaskad (DEL 3)
**[OBS]**
- Byggfas-händelser/år: snitt 1,12, men **max 11** (år 1 i normal-regimen).
- **6,70 kaskader/parti** (en kaskad = händelser som ett ENDA bygge utlöser). 33,8 % av kaskaderna gav
  **2** händelser från samma bygge; **största kaskad = 2**. Ingen enskild byggnad utlöser 3+.
- **Längsta burst = 2** (händelser från ett triggertillfälle) → i verkligt spel väntar **högst 1** i kö
  medan en visas. **Inga långa köer från ett enskilt bygge.**

**[KOD] Hur motorn/servern faktiskt hanterar det (verifierat, ej kört):**
- Motorn (`spec/engine.js`) köar **alla** kvalificerade händelser i en gemensam kö (`companyEventQueue`),
  **utan gräns per byggfas**. Första händelsen visas direkt; övriga ligger i kö.
- Servern (`server/server.js` rad 428–439): varje `companyEvent` sätter `autoPaused = true`, broadcastar
  paus och startar en **10 s-timer** (`crisisTimer`); efter 10 s `companyEventResolved()` → nästa i kön
  → ny 10 s. Popuparna visas alltså **en i taget med separata 10 s-pauser**.
- **Byggtimern fryses** under pausen (rad 524: `if (paused || autoPaused) return`). Bygge/handel blockeras
  (rad 976/1023). → Händelser **äter inte byggtid**, men **förlänger** fasen med 10 s per popup.
- **Kan nya händelser utlösas medan en visas?** Ja, men bara via **kedjereaktion** (en öhälso-sänkande
  händelse passerar en tröskel → ny öhälso-händelse köas bakom, `_checkOhalsaThresholds` rad 727). **Nya
  BYGG-utlösta** händelser kan inte tillkomma under pausen eftersom byggandet är blockerat.
- **[KOD-RISK]** Eftersom byggtimern fryses och kön saknar tak kan **köade händelser visas efter att
  byggfasen "känns" slut** för spelarna — fasen glider 10 s i taget tills kön är tom.

---

## 3. Vanligaste händelsekombinationer (DEL 4)
**[OBS]** Samma BYGGE/kaskad (par som ETT bygge utlöste, 1000 partier):

| Par | Antal | Typ |
|---|---|---|
| EXPANSION + GRÖNA FONDEN | ×1000 | gemensam trigger (Åkers 3:e gröna bygge = både 3 gröna totalt och 3 byggen/år) |
| MARKEN RASAR + VÄRMEBÖLJA (tundra_major) | ×765 | **kedja** (krisen sänker öhälsa ≤35 → värmebölja) |
| OLJEUTSLÄPP + VÄRMEBÖLJA (tundra_minor) | ×235 | kedja |
| STORM + MARKEN RASAR | ×235 | kedja (öhälsa ≤27) |
| ÖVERBELASTNING/STAD + STORM | ×30 | kedja |

Samma ÅR: i normal-regimen samförekommer i princip **allt** (alla par 100 %) eftersom nästan alla händelser
ligger i år 1. Det säger mest att året är överfullt, inte att specifika par är intressanta.
**Samma bygge kan utlösa flera händelser — ja, men högst 2.**

---

## 4. Negativa kedjereaktioner (DEL 5)
**[OBS]** Tre typer, per 1000 partier:

| Typ | Vad | Hur ofta |
|---|---|---|
| **A · Gemensam trigger** | ett bygge passerar flera villkor → ≥2 **direkta** händelser | 1,00/parti (i praktiken EXPANSION+GRÖNA FONDEN) |
| **B · Kedjereaktion** | en händelses **öhälso-smäll** passerar en tröskel → **ny** öhälso-händelse | **1,26/parti · 100 % av partierna** |
| **C · Oberoende** | ≥2 olika lag/byggen uppfyller villkor **samma år** | 1,00 (parti,år)-fall |

**Kedjan B är verklig och vanlig:** en företagskris (t.ex. MARKEN RASAR −8 öhälsa) drar öhälsan under 35
eller 27 → VÄRMEBÖLJA/STORM köas direkt bakom (`_checkOhalsaThresholds` efter varje öhälso-sänkande
händelse). **MEN kedjan är kort och självbegränsande:** öhälso-händelserna har `ohalsa: 0` (sänker bara
resurser, inte öhälsa) och är en-gång-per-spel → de kan inte trigga ytterligare öhälso-händelser. Så kedjan
blir **kris → en öhälso-händelse**, aldrig en skenande loop. Exempel-logg (frö 1002, år 1):
`SKOGSBRAND (−8 öhälsa→38) … MARKEN RASAR (−8→23) → STORM (öhälsa ≤27, resursdrag) … ÖVERBELASTNING (−4→19)`.

---

## 5. Händelsernas påverkan på öhälsa (DEL 6)
**[OBS]** Snitt öhälso-delta/parti (brutto, före clamp 0–100):

| Källa | Öhälso-delta | Andel av negativ öhälsa |
|---|---|---|
| **Byggnader** | −27,9 | 54 % |
| **Företagskriser** (−4 liten/−8 stor) | −20,5 | 44 % |
| **UPPROR** (−3) | −3,0 | 6 % |
| **Öhälso-händelser** (VÄRMEBÖLJA/STORM/NATUREN/MILJÖLYFT) | **0** | 0 % (alla har `ohalsa: 0`) |

→ **Händelser står för ~46 % av den negativa öhälsopåverkan**, byggnader för resten. Viktigt: **bara
företagskriser och UPPROR** rör öhälsan bland händelserna — VÄRMEBÖLJA/STORM drar **resurser**, inte öhälsa.

**Hur mycket snabbare når ön kritiska nivåer? [OBS]** Samma frön med vs utan automatiska händelser:
- **Normal-regim:** ön kollapsar av byggandet oavsett (100 % i båda), men händelserna **tidigarelägger
  kollapsen ~0,57 år** (snittår 1,8 → 1,2). Öhälsan störtar så hårt att KRIS-bandet (≤20) ofta **hoppas
  över** rakt till 0 (därav lägre KRIS-andel men tidigare kollaps).
- **Överlevande regim (försiktig):** här kollapsar bygget inte ensamt. Händelserna sänker **slut-öhälsan
  med 6,0** (20,9 → 14,9) men ändrar **inte** överlevnaden (KRIS 50 % i båda, kollaps 0 % i båda).

→ Händelsernas extra öhälso-smäll är **märkbar men inte avgörande för kollaps**: byggandet driver, kriserna
påskyndar. **Ingen självförstärkande flerårsspiral** (engångsnatur + öhälso-händelser = 0 öhälsa).

---

## 6. Ekonomisk påverkan per företag (DEL 7)
**[OBS]** Per 1000 partier (negativa händelser; förlust är negativ):

| Företag | Neg. händelser/parti | Pengar-förlust | Material-förlust | Positiva händelser/parti |
|---|---|---|---|---|
| Åker (grön) | 1,46 | 0 | −5,3 | **3,00** |
| Skog (adaptiv) | 2,90 | 0 | −24,0 | 0 |
| Tundra (girig) | **3,46** | **−35,3** | 0 | 0 |
| Stad (standard) | 2,73 | −23,0 | −10,0 | 0 |

- **Hårdast drabbade:** Tundra (−35 pengar) och Skog (−24 material) — de som bygger smutsigast får flest/störst
  kriser. Det är **riktat och begripligt** (den som förstör mest straffas mest).
- **Positiva händelser kompenserar nästan bara det gröna laget (Åker, 3,00/parti).** De smutsiga lagen får
  i princip **bara negativa** händelser → ingen kompensation. **[HYP]** Kan kännas enkelriktat för de lag
  som spelar ekonomiskt.
- **2+ negativa händelser samma år för samma lag:** 3,46 (lag,år)-fall/parti — alltså vanligt att ett lag
  tar två smällar samma år (igen: koncentrerat till år 1).
- **Negativ händelse slog ut bygg-rådet** (laget kunde ej bygga ens billigaste efteråt): 1,82/parti.
  **[HYP]** För ett barn: "jag skulle just bygga, sen small en händelse och nu har jag inte råd."
- **Clamp vid 0** inträffar (avsedd förlust > faktisk när laget redan är tomt) → straffen mildras
  automatiskt för de fattigaste; ingen risk att gå under 0.

---

## 7. Beräknad popup- och paustid (DEL 8)
**[KOD]** Varje företagshändelse = 1 popup med ~10 s auto-paus; byggtimern fryses (server rad 428–439, 524).
**[OBS]** popup-räkning över 1000 partier:

| Mått | Värde |
|---|---|
| Snitt popups/parti (≈ total händelse-paustid) | 9,2 ≈ **92 s** |
| Snitt popups/byggfas (år) | 1,12 ≈ 11 s |
| **Värsta observerade byggfas** | **11 popups = 110 s** extra |
| Andel (parti,år)-byggfaser med ≥3 popups | 12,5 % |

**[HYP]** Den kritiska siffran är **år 1 i ett byggtungt parti: 8–11 popups × 10 s = 80–110 s** avbrott runt
en ~100 s byggfas — spelet skulle i praktiken **stanna lika länge som man får bygga**, i serie, i den första
fasen. Eftersom byggtimern fryses **glider fasen** och köade popups kan visas efter att barnen upplever att
bygget är klart. I ett lugnare parti (få byggen) är det ~10–30 s, vilket är rimligt.

---

## 8. Tre konkreta exempelpartier (DEL 9)
**[OBS]** Reproducerbara frön.

### A · Typiskt (normal, frö 1376) — 8 händelser, alla i år 1, kollaps år 1
Kronologisk logg år 1 (motorns ordning): FRAMTIDSVISIONÄR, GRÖNA FONDEN, EXPANSION (Åker, positiva) →
SKADEDJUR (Skog −10🧱, öhälsa −4) → OLJEUTSLÄPP (Tundra −10🪙, −4) → UPPROR (Stad −15🪙/−10🧱, −3) →
MARKEN RASAR (Tundra −20🪙, −8) → VÄRMEBÖLJA (alla −3). **= 8 popups ≈ 80 s.**

### B · Händelsetätt (normal, frö 1002) — 11 händelser i år 1
Samma mönster + SKOGSBRAND (−8) och STORM och ÖVERBELASTNING. Öhälsa i byggfasen: 50 → 46 → 38 → 34 → 31 →
23 → 19. **= 11 popups ≈ 110 s** i en enda byggfas. Visar taket på nuvarande system utan gräns.

### C · Negativ spiral (försiktig, frö 1000) — överlever men når KRIS
Öhälso-bana: **år 1: 50→18 (4 ev) · år 2: 18→6 (1 ev) · år 3–8: 6→6 (0 ev).** KRIS år 1, slut-öhälsa 6.
Logg år 1: FRAMTIDSVISIONÄR → SKADEDJUR (−4) → OLJEUTSLÄPP (−4) → [bokslut] VÄRMEBÖLJA (resurser). **Visar
tydligt att "spiralen" är en frontladdad år-1-dipp, inte en flerårig kedja** — efter år 2 är händelse­trycket
slut (engångsnatur) och öhälsan planar ut.

---

## 9. Slutsatser och möjliga lösningar (DEL 10)

**Svar på de sex frågorna:**
1. **För många händelser i snitt?** Inte utspritt — men **år 1 är överlastat** i byggtunga partier (8–11
   popups). I lugnare/överlevande spel är mängden rimlig (0,55/år). Problemet är *koncentrationen*, inte totalen.
2. **För koncentrerade till vissa år?** **Ja, kraftigt frontladdade till år 1(–2).** Alla händelser är
   en-gång-per-spel och fyrar när trösklar först passeras / prestationer först tjänas. **[OBS]**
3. **Långa popup-köer?** Inte från ett enskilt bygge (max 2, ≤1 i kö). Men **många separata händelser i en
   het byggfas** ger serie-popups som summerar till 80–110 s. **[OBS+KOD]**
4. **Förstärker händelserna miljöförstöringen oproportionerligt?** Händelser = 46 % av negativ öhälsa och
   tidigarelägger kollaps ~0,6 år, men **byggandet driver**; kriserna påskyndar. Öhälso-händelserna själva
   rör inte öhälsan. Inte oproportionerligt, men märkbart. **[OBS]**
5. **Något företag orimligt hårt drabbat?** Tundra/Skog (smutsigast) tar flest/störst smällar — **riktat och
   rimligt**. Men **positiva händelser kompenserar nästan bara det gröna laget**; 1,82 ggr/parti slås ett
   lags bygg-råd ut av en händelse. **[OBS] + [HYP]**
6. **Behöver vi begränsa tätheten?** **Byggande/ekonomi ska inte röras** (fungerar i testspel). Risken ligger
   i **avbrottstätheten i första byggfasen** + att byggtimern glider. Värt att testa en lätt dämpning på
   *presentations-/popup-sidan*, som inte rör triggers/effekter.

**Möjliga alternativ att TESTA senare (ej implementerade, hypoteser):**
- **Tak på popups per byggfas** (t.ex. max 2–3 automatiska popups/fas; resten slås ihop eller skjuts till
  bokslutet). Adresserar direkt år-1-överlasten. **[HYP]**
- **Prioritera** viktiga händelser (företagskriser) framför prestationer; visa **positiva prestationer
  sammanslagna** (t.ex. "Åker: GRÖNA FONDEN + EXPANSION + FRAMTIDSVISIONÄR" som en ruta) i stället för tre
  separata 10 s-pauser. **[HYP]**
- **Kortare/ingen full paus för positiva** händelser (de behöver inte stoppa spelet lika länge som kriser). **[HYP]**
- **Slå ihop samtidiga öhälso-händelser** med kris (visa "MARKEN RASAR + VÄRMEBÖLJA" som en ruta i stället
  för en kedja). **[HYP]**
- **Sänk företagskrisernas öhälso-smäll** (−4/−8) något — de står för 44 % av negativ öhälsa och är
  frontladdade. (Gränsar till balans; görs bara om vi medvetet rör händelse-effekter — utanför denna uppgift.) **[HYP]**
- **Tak på byggtimerns glidning** eller "samla alla årets händelser till bokslutet" så byggfasen inte
  avbryts löpande. Kräver server/UI-ändring (ej nu). **[KOD-RISK → lösningsidé]**

**Vad som INTE är ett problem:** inga långa köer från ett enda bygge, ingen självförstärkande flerårsspiral,
inget lag går under 0 (clamp), och i överlevande spel är händelsemängden låg.

## Begränsningar
- **[OBS]** bygger på botstrategier (blandade, normal/försiktig), inte barn. Bottarnas normal-regim bygger
  tungt år 1 → kollaps år 1–2; verkligt barnspel (som i testspelningarna) bygger troligen lugnare, så den
  verkliga popup-tätheten ligger sannolikt mellan "försiktig" (≈3 ev år 1) och "normal" (≈9). Exakt var är okänt.
- **[KOD]** server/motor-beteendet (10 s-paus, fryst timer, ingen kögräns) är läst i koden, inte uppmätt i rummet.
- **[HYP]** upplevelse-slutsatserna är resonemang, inte speltestdata — nästa steg vore att mäta popup-tätheten
  i en faktisk testspelning.
- Endast Mellan. Inga balansvärden/regler/triggers/effekter ändrade; inga ändringar i motor/server/UI. 15/15 regressionstester gröna.
