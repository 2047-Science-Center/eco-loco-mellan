# Mellan — händelsesystemets balans & presentation (beslutsunderlag)

*Skriven 2026-11-19 av Claude. Endast MELLAN (8 år), nuvarande motorläge (`ohalsaDelayed=true`). Syfte:
avgöra om händelsesystemet behöver ändras INNAN vi utvecklar spelmotorn vidare. Ren analys — inga regler,
trösklar, effekter, balansvärden eller presentation ändrade. Bygger vidare på
[MELLAN-HANDELSETATHET.md](MELLAN-HANDELSETATHET.md) (täthet/kö) och
[MELLAN-FORDROJDA-HANDELSER.md](MELLAN-FORDROJDA-HANDELSER.md) (fördröjningen), som förutsätts lästa.*

> **Reproducerbart:**
> `node tools/handelsebalans.js 2000` (ny: ekonomisk attribution, kris-proportionalitet, positiva utdelningar · 5 regimer)
> `node tools/simulera.js 2000 mellan full` (strategier, sektorbalans, överlevnad)
> `node tools/fordrojd-sim.js 1000 mellan 30` (täthet/popup-tid i nuvarande vs tidigare läge)
> Alla kör `spec/engine.js` orörd. 17/17 regressionstester gröna.

> **Tre sorters påståenden hålls isär:** **[OBS]** observerat i simulering · **[KOD]** verifierat genom
> kodgranskning (ej kört) · **[HYP]** hypotes om barns upplevelse i rummet.

---

## 0. Sammanfattning — behöver vi ändra systemet nu?

**Nej, inte reglerna. Händelse*systemet* är strukturellt friskt.** Det finns ingen skenande flerårsspiral,
inga långa köer från ett enda bygge, inget lag går under noll, och de negativa dragen är **riktade och
begripliga** (den som bygger smutsigast straffas mest). Den redan införda fördröjningen av öhälsohändelser
har dessutom lättat år-1-trycket. **[OBS+KOD]**

**Två saker är värda uppmärksamhet, men båda ligger på presentations-/observationssidan, inte i triggers:**

1. **Ett reellt presentationsproblem:** i ett byggtungt år 1 kan **upp till 8 företagshändelse-popups × 10 s
   = ~80 s paus** tränga ihop sig i en ~100 s byggfas, och eftersom byggtimern fryses *glider* fasen. Detta
   är den enda konkreta risken för spelkänslan — och den kan testas/dämpas helt på popup-sidan utan att röra
   en enda tröskel eller effekt. **[OBS+KOD+HYP]**
2. **En balansfråga att HÅLLA ÖGONEN PÅ (ej åtgärda blint):** den stora företagskrisen **−20** är ofta större
   än ett kontantsvagt lags hela sektorkassa (upp till **197 % av kassan**, clamp i 75 % av fallen i
   aggressiv botspel). MEN detta biter **bara i bot-regimer som redan kollapsar** — i den överlevande
   (barnlika) regimen fyrar majors knappt och minor-krisen är proportionerlig (29 % av kassan, 0 % clamp).
   Rör den alltså inte på simulatordata ensam; verifiera mot verkligt rum först. **[OBS]**

**Rekommendation i en mening:** *Gå vidare med spelmotorn. Lägg INGA ändringar av trösklar/effekter nu.
Köa ett presentations-experiment (popup-spridning/-sammanslagning) för ett kommande rumstest, och samla
verkligt speldata på −20-krisen innan den ev. rörs.*

---

## 1. Kartläggning av samtliga automatiska händelser i Mellan

Verifierat i koden (`spec/content/*`, `spec/engine.js`). **[KOD]** Tre automatiska kategorier delar EN kö
(`companyEventQueue`) och EN 10 s-paus (servern). GM-händelser och KRIS är separata.

### 1a. Företagskriser (`company-crises.js`, `cfg.features.companyCrises`)
Åtta kriser, två per lag, utlöses **direkt vid bygget** när lagets ackumulerade `impactNeg` passerar tröskeln.
Varje max en gång/spel (`firedCompanyEvents`).

| Kris (per lag) | Villkor | Kontrolleras | Resursförlust | Öhälsa | Upprepas |
|---|---|---|---|---|---|
| minor (VATTENBRIST/SKADEDJUR/OLJEUTSLÄPP/ÖVERBELASTNING) | `impactNeg ≤ −10` | i `selectCard` → `_checkCompanyCrises` | −10 i lagets sektor­valuta | **−4** | nej |
| major (TORKA/SKOGSBRAND/MARKEN RASAR/STRÖMAVBROTT) | `impactNeg ≤ −20` | i `selectCard` | −20 i sektorvalutan | **−8** | nej |

### 1b. Prestationshändelser (`company-events.js`, `cfg.features.companyEvents`)
Utlöses **direkt vid bygge/handel**. Max en gång/spel. I Mellan tas `gronafonden`+`uppror` ur slumppoolen.

| Händelse | Villkor | Kontrolleras | Effekt | Öhälsa |
|---|---|---|---|---|
| GRÖNA FONDEN | 3 gröna byggen totalt (`gronBuilt≥3`) | `_checkCompanyAchievements` vid bygge | +5 🪙 | 0 |
| EXPANSION | 3:e bygget samma år (`_builtThisYear≥3`) | vid bygge | +5 huvudresurs | 0 |
| GRÖN OMSTÄLLNING | grön-svit ≥2 **och** ≥2 skadliga byggen tidigare | vid grönt bygge | +5 🪙 | 0 |
| FRAMTIDSVISIONÄR | grön-svit ≥2 **och** laget ligger sist | vid grönt bygge (prioriteras före Grön omställning) | +5 🪙 +5 🧱 | 0 |
| GEMENSAM SATSNING | alla fyra lag byggt ≥1 grön i år | vid bygge | +5 huvudresurs till **alla fyra** | 0 |
| UPPROR | rikaste lagets kapital ≥ näst rikaste +30 | vid bygge **och** handel (`_checkUppror`) | −15 🪙 −10 🧱 | **−3** |

### 1c. Öhälsohändelser (`ohalsa-events.js`, `cfg.features.ohalsaEvents`) — FÖRDRÖJDA
**Kvalificeras vid bokslut** på öns faktiska tillstånd, läggs som väntande (`pendingOhalsa`), **visas ~30 s
aktiv byggtid in i NÄSTA år** (servern/`fireNextPendingOhalsa`). Max en gång/spel. Alla har **öhälsa 0**
(rör bara resurser). RESURSBRIST är Skola-only (`complexEvents`) och **inte** fördröjd — ej aktuell i Mellan.

| Händelse | Villkor (vid bokslut) | Effekt | Öhälsa |
|---|---|---|---|
| NATUREN BLOMSTRAR | öhälsa ≥ 70 | +5 huvudresurs/lag | 0 |
| MILJÖLYFT | årets netto-öhälsa ≥ +15 | +3 huvudresurs/lag | 0 |
| VÄRMEBÖLJA | öhälsa ≤ 35 | −3 huvudresurs/lag | 0 |
| STORM | öhälsa ≤ 27 | −5 huvudresurs/lag | 0 |

### 1d. Finns andra automatiska händelser? **Nej.** [KOD]
Den gamla slump-dragningen (`_drawEvent` → skogsbrand/godskord/marknadskrasch) är **avstängd** (borttagen
2026-11-19; `endRound` drar ingen autonom händelse längre). `rost`-händelser (sponsrat m.fl.) utlöses bara
via Ö-råd/politik eller GM. GM-händelser (`gm-events.js`) och dilemman kräver **manuell** aktivering → ingår
inte i grundanalysen. KRIS (`crisis`, öhälsa ≤20) har egen mekanik vid bokslut och analyseras separat.

---

## 2. Täthet, köbildning och pauser (nuvarande läge)

### 2a. Hur motorn och servern faktiskt beter sig [KOD]
- Motorn köar **alla** kvalificerade händelser i `companyEventQueue` — **ingen gräns per byggfas**.
- Servern (`server.js` 428–439): varje `companyEvent` → `autoPaused=true` + **10 s** (`crisisTimer`) →
  `companyEventResolved()` → nästa i kön → ny 10 s. Popuparna visas **en i taget med separata 10 s-pauser**.
- Byggtimern **fryses** under pausen (`if (paused||autoPaused) return`, rad 531). Bygge/handel blockeras.
  → Händelser *äter inte* byggtid men **förlänger** fasen 10 s per popup → fasen "glider".
- Fördröjda öhälsohändelser avfyras bara vid **aktiv-tids-märken** (30/60/90 s) och bara när ingen annan
  popup visas → i praktiken max **3/år** i Mellan, 30 s isär. Resten bärs över till nästa år. **[KOD]**

### 2b. Mätvärden — nuvarande (fördröjda) system [OBS]
Via `fordrojd-sim.js` (1000 partier/regim, blandade strategier):

| Mått | NORMAL expansion (byggtung) | FÖRSIKTIG expansion (överlever) |
|---|---|---|
| Händelser år 1 | **7,24** | 2,50 |
| Händelser år 2 | 0,46 | 1,40 |
| Händelser år 3–8 | 0,00 | 0,50 |
| **Max popups under en byggfas** | **8** | 3 |
| Snitt popup-tid/byggfas | 9,6 s | 5,5 s |
| Andel byggfaser med ≥3 popups | 12,5 % | 6,3 % |

**Köbildning från ETT bygge:** max **2** händelser (t.ex. EXPANSION+GRÖNA FONDEN); ≤1 väntar i kön medan en
visas. **Inga långa köer från ett enda bygge.** **[OBS, MELLAN-HANDELSETATHET.md DEL 3]**

**Tolkning:** händelserna är **frontladdade till år 1** (allt är en-gång-per-spel och fyrar i första
byggvågen). I byggtunga partier ger det ~80 s avbrott i den första fasen; i överlevande/lugnare partier är
mängden rimlig. Fördröjningen har redan sänkt år-1-toppen (tidigare max 11 popups, snitt 11,5 s → nu 8 /
9,6 s) och flyttat öns "reaktion" till år N+1. **[OBS]**

---

## 3. Ekonomisk balansanalys

### 3a. Resurs-netto per källa (🪙+🧱/parti, alla lag) [OBS] — `handelsebalans.js`, N=2000

| Regim | Byggproduktion | Företagskriser | Prestationer | UPPROR | Öhälsohändelser |
|---|---|---|---|---|---|
| A· Alla giriga | +135 | **−100** | +5 | −25 | 0 |
| C· Alla adaptiva | +316 | −59 | +31 | −25 | −32 |
| D· Blandade | +135 | −45 | +20 | −25 | −7 |
| E· Blandade/försiktig (överlever) | +598 | −15 | +10 | 0 | −30 |
| B· Alla gröna | +830 | 0 | +40 | −25 | +32 |

→ **Produktionen dominerar ekonomin** (som den ska). Bland händelserna är **företagskriserna den klart
största resurskraften**, och **UPPROR** en fast −25 så fort någon drar ifrån med +30. Positiva prestationer
kompenserar delvis — men **nästan bara i grön/blandad spel**. I ren girig spel är enda positiva händelsen
EXPANSION (+5). **[OBS]**

### 3b. Öhälsa per källa (brutto/parti) [OBS]

| Regim | Byggnader | Företagskriser | UPPROR | Öhälsohändelser | Händelsers andel av NEG öhälsa |
|---|---|---|---|---|---|
| E· försiktig (överlever) | −29,2 | −6,0 | 0 | 0 | **17 %** |
| D· blandade | −29,1 | −17,9 | −3,0 | 0 | 42 % |
| C· adaptiva | −30,0 | −23,5 | −3,0 | 0 | 47 % |
| A· giriga | −7,0 | −40,0 | −3,0 | 0 | 86 % |

→ I **överlevande/barnlik** spel driver **byggnaderna** öhälsan (83 %); kriserna är en liten påspädning
(17 %). Först i kollapsande botspel tar kriserna över (upp till 86 %) — men då är ön redan förlorad av
byggandet. **Öhälsohändelserna rör aldrig öhälsan** (alla har `ohalsa:0`). **Byggnadernas positiva
öhälsopåverkan är orörd** (central mekanik). **[OBS]**

### 3c. Är företagskriserna −10/−20 proportionerliga? [OBS] — kärnfrågan
Lagets **sektorvaluta direkt före krisen** vs förlusten:

| Regim | MINOR −10 | MAJOR −20 |
|---|---|---|
| E· försiktig (överlever) | kassa 35,0 → −10 = **29 %**, clamp **0 %** | fyrar ej |
| A· giriga | kassa 31,3 → −10 = 32 %, clamp 0 % | kassa 26,7 → −20 = **75 %**, clamp 0 % |
| D· blandade | kassa 28,2 → −10 = 35 %, clamp 11 % | kassa 19,0 → −20 = **105 %**, clamp **62 %** |
| C· adaptiva | kassa 15,9 → −10 = 63 %, clamp 53 % | kassa 10,2 → −20 = **197 %**, clamp **75 %** |

**MINOR −10 är proportionerlig** (≈⅓ av kassan) i hälsosam spel. **MAJOR −20 är gränsfallet:** den fyrar vid
andra smutsiga bygget, och ett kontantsvagt lag har då ofta **inte** 20 i sektorn → krisen **tömmer** laget
(clamp 62–75 %). I den **överlevande** regimen fyrar major dock knappt alls (laget bygger för försiktigt för
att nå −20). **Så "konfiskationen" inträffar bara i regimer som redan kraschar ön.** Clamp:en gör att ingen
går under noll — straffet mildras automatiskt för de fattigaste. **[OBS]**

### 3d. Positiva prestationer — risk att konflikten försvinner? **Nej.** [OBS]
Störst utdelning i **grön** spel (regim B): GEMENSAM SATSNING +20, NATUREN BLOMSTRAR +20, MILJÖLYFT +12,
FRAMTIDSVISIONÄR +10/parti. Men dessa kräver **verkligt grönt spel** (grön-svit, alla fyra gröna, netto
+15 öhälsa) → de belönar den som faktiskt räddar ön, inte den som maximerar ekonomi. I girig/blandad spel
delas i princip inget positivt ut utom EXPANSION (+5). **Ekonomi-vs-miljö-spänningen består** — gröna
belöningar gör miljövägen *möjlig*, inte gratis. **[OBS]** Baksidan: de smutsiga lagen får **bara**
negativa händelser (se 3a) → enkelriktat för den som spelar ekonomiskt. **[HYP]**

---

## 4. Jämförelse mellan spelstrategier [OBS] — `simulera.js`, N=2000

| Strategi | Överlever | Slut-öhälsa | Vinnande sektor | Not |
|---|---|---|---|---|
| Alla gröna | **100 %** | 100 | — | ingen kris, generösa gröna belöningar |
| Alla giriga | 0 % (kollaps 100 %) | 0 | pengar 0 %* | kollaps redan år 1 |
| Alla adaptiva | 0,1 % | 0 | pengar 57 % | KRIS 0,97/parti |
| Blandade (normal) | 0 % | 0 | pengar 76 % | kollaps år 1–2 |
| Blandade **försiktig** | 0 %** | **14,8** | pengar 100 % | når alla 8 år, nära tröskel |

\* vid total kollaps med allt = 0 blir "vinnaren" godtycklig. \*\* "överlever" = nå tröskel 60; försiktig
botspel landar på ~15 (lever hela spelet men klarar inte vinstkravet — botar förhandlar sämre än barn).

**Viktig sektor-iakttagelse:** i **baslinjen utan händelser** dominerar pengar-sektorn kraftigt
(förmögenhetskvot pengar/material **2,16**). Med automatiska händelser **krymper gapet till 1,16** — dvs
**händelserna motverkar faktiskt pengar-dominansen** (UPPROR + kriser träffar de rika/smutsiga pengarlagen
hårdast). Händelsesystemet förvärrar alltså inte den kända sektorobalansen; det dämpar den. **[OBS]**

**Tolkningsvarning (från uppgiften):** bottarnas normal/aggressiv-regim bygger mycket snabbare än barnen i de
11 publika testspelningarna (som byggde lugnare, förhandlade och ofta balanserade ön). Botkollaps år 1–2 är
**inte** bevis på felbalans — den överlevande (försiktig) regimen ligger närmare verkligt barnspel, och där
är både täthet (2,5 ev år 1) och kris-proportionalitet (−10 = 29 %, inga majors) sunda. **[OBS+HYP]**

---

## 5. Konkreta exempel på problematiska händelsekedjor [OBS]

1. **EXPANSION + GRÖNA FONDEN från samma bygge** (×~1000/1000 i grön/blandad spel). Åkers 3:e gröna bygge är
   *både* "3 gröna totalt" *och* "3 byggen i år" → **två positiva popups i rad** (20 s) för en handling. Rimlig
   konsekvens, men två fulla pauser för en bra gärning. **[OBS] — typfall av "ett bygge → flera popups".**
2. **Andra smutsiga bygget → MINOR + (senare) MAJOR samma lag.** `impactNeg` passerar −10 och −20 nära
   varandra → VATTENBRIST följt av TORKA inom samma byggfas, tillsammans −30 sektor + −12 öhälsa. Riktat och
   begripligt, men hård dubbelsmäll för ett redan pressat lag (kopplat till 3c). **[OBS]**
3. **År-1-klustret (byggtung regim):** FRAMTIDSVISIONÄR → GRÖNA FONDEN → EXPANSION → SKADEDJUR → OLJEUTSLÄPP
   → UPPROR → MARKEN RASAR = 7–8 popups × 10 s i EN byggfas. Var och en rimlig; **summan** gör att fasen
   stannar nästan lika länge som man får bygga. **[OBS] — presentationsproblemet, inte ett triggerfel.**
4. **Fördröjda VÄRMEBÖLJA + STORM år N+1** (frö 1000, försiktig): kvalificeras vid bokslut år 1 (öhälsa ≤35
   och ≤27) → visas 30 s respektive 60 s in i år 2. Önskat beteende: öns reaktion kommer med eftersläpning,
   utspridd — **inte** längre staplad direkt på en kris via den gamla kedjan. **[OBS]**

**Vad som INTE längre händer:** den gamla kedjan "kris sänker öhälsa → värmebölja köas direkt bakom" är
**borta** i fördröjt läge (öhälsohändelser kvalificeras bara vid bokslut). Ingen självförstärkande
flerårsspiral finns (engångsnatur + öhälsohändelser = 0 öhälsa). **[KOD+OBS]**

---

## 6. Vilka problem är verkliga vs simulatorberoende?

| Problem | Typ | Verkligt eller simulatorberoende? |
|---|---|---|
| År-1-popupkluster (≤8 × 10 s) + timerglidning | **C· Presentation** | **Verkligt** men regimberoende: uttalat i byggtung botspel, mildare (≤3) i barnlik spel. Server-/köbeteendet är **[KOD]**-verifierat oavsett regim. |
| MAJOR −20 ≥ lagets sektorkassa (clamp) | **A· Balans** | **Mest simulatorberoende:** biter i kollapsande botregimer; i överlevande regim fyrar majors knappt. Behöver **verkligt speldata** innan åtgärd. |
| EXPANSION+GRÖNA FONDEN / minor+major = 2 popups/bygge | **B· Trigger** (mild) | **Verkligt men avsiktligt** — flera konsekvenser av en handling. ≤2, aldrig 3+. Snarare ett *presentationsval* (slå ihop?) än ett triggerfel. |
| Positiva händelser belönar nästan bara gröna laget | **A· Balans** (mjuk) | **Verkligt** och delvis avsiktligt (grönt ska löna sig). Enkelriktningen för smutsiga lag är en upplevelsefråga. **[HYP]** |
| Självförstärkande miljöspiral | — | **Finns inte** (verifierat). |
| Långa köer från ett bygge | — | **Finns inte** (max 2). |

**Viktig princip (från uppgiften):** föreslå **inte** ändrade trösklar för att lösa ett popup-problem.
År-1-klustret är ett **presentationsproblem** och ska lösas på presentationssidan om det ska lösas.

---

## 7. Möjliga förbättringar — utan implementation

Varje alternativ bedömt på: **(1)** vilket problem · **(2)** upplevelse · **(3)** balanspåverkan · **(4)**
nackdelar · **(5)** komplexitet.

### Alt 0 — Behåll nuvarande system
1. — · 2. Oförändrad; fördröjningen har redan lättat år 1. · 3. Ingen. · 4. År-1-klustret kvarstår i
byggtung spel. · 5. Noll. **Fullt försvarbart tills vi har rumstestdata.**

### Alt 1 — Minsta aktiva byggtid mellan FÖRETAGShändelser (presentation)
Som öhälso-fördröjningen, men för kriser/prestationer: håll t.ex. ≥8–10 s aktiv byggtid mellan popups;
överskjutande köas och visas löpande i stället för i en klump.
1. Löser år-1-klustret direkt. · 2. Barnen får bygga mellan smällarna; "action→konsekvens" behålls (bara
minsta avstånd). · 3. **Ingen** (samma händelser, samma effekter, bara spridning). · 4. Fasen kan glida ännu
längre om många köas; kräver att överskott bärs mellan faser (som öhälso-mekaniken redan gör). · 5. Måttlig
(server/motor-schemaläggning finns redan att kopiera). **[HYP] — starkaste kandidaten mot presentationsproblemet.**

### Alt 2 — Slå ihop samtidiga POSITIVA prestationer till en ruta
"Åker: GRÖNA FONDEN + EXPANSION + FRAMTIDSVISIONÄR" i en popup i stället för tre 10 s-pauser.
1. Löser 2-popups-per-bygge och positiv-klustret. · 2. Snabbare, tydligare belöning. · 3. Ingen (summan av
belöningar oförändrad). · 4. Mindre "ceremoni" per enskild bedrift; UI-arbete. · 5. Måttlig (UI + en
grupperings­regel i presentationslagret). **[HYP]**

### Alt 3 — Kortare/ingen full paus för positiva händelser
Positiva popups pausar t.ex. 4–5 s i stället för 10 s (kriser behåller 10 s).
1. Halverar positiv-tiden. · 2. Belöningar känns lätta, kriser tunga. · 3. Ingen. · 4. Två paus-längder att
balansera; risk att en viktig belöning missas. · 5. Låg (en konstant i servern). **[HYP]**

### Alt 4 — Prioritera kriser före prestationer i kön
Visa negativa/viktiga händelser först när flera kvalificerar samtidigt.
1. Säkerställer att det pedagogiskt viktiga syns även om fasen tar slut. · 2. Tydligare orsak→verkan. · 3.
Ingen. · 4. Positiva kan skjutas till nästa år / tappas om fasen tar slut. · 5. Låg (sorteringsregel i kön). **[HYP]**

### Alt 5 (BALANS — bara om rumsdata motiverar) — mjuka MAJOR-krisens −20
T.ex. tak "−20 eller högst X % av kassan". **Rör en händelseeffekt** → utanför "inga balansändringar".
1. Gör −20 proportionerlig i kontantsvag spel. · 2. Mindre "allt försvann"-känsla. · 3. **Ja — ändrar
straffets styrka** (kräver avstämning med Josef + ny simulering + golden-omgenerering). · 4. Kan göra
smutsig spel för billig; clamp:en löser redan golv-problemet gratis. · 5. Låg kod, men hög process (regeländring).
**Rekommenderas INTE nu — håll under observation.**

---

## 8. Slutrekommendation

**Behöver vi förändra händelsesystemet innan vi går vidare med spelmotorn? — Nej, inte reglerna.**

- **Triggers, trösklar och effekter:** lämna orörda. Systemet är strukturellt sunt, de negativa dragen är
  riktade och begripliga, konflikten ekonomi-vs-miljö består, händelserna **dämpar** t.o.m. den kända
  pengar-dominansen, och fördröjningen har redan lättat år 1. Att ändra trösklar nu vore att lösa ett
  presentationsproblem på fel ställe. **[OBS+KOD]**
- **Det ENDA som är värt ett aktivt beslut** är presentationen av år-1-klustret (Alt 1 starkast, ev. + Alt 2).
  Det kan byggas och testas **utan** att röra en enda trigger eller effekt — men vänta tills vi har sett en
  faktisk testspelning, eftersom barnspel ligger närmare den lugna regimen där problemet är litet. **[HYP]**
- **Håll under observation (ej åtgärda blint):** MAJOR-krisens −20 i kontantsvag spel (clamp), och att
  smutsiga lag bara får negativa händelser. Samla verkligt speldata; ta beslut med Josef om datan motiverar.

**Nästa konkreta steg:** gå vidare med spelmotorn som planerat; mät popup-tätheten i nästa fysiska
testspelning (år 1, antal popups, upplevd väntan) och ta med −20-utfallen — det avgör om Alt 1/Alt 5
någonsin behövs.

## Begränsningar
- **[OBS]** bygger på botstrategier, inte barn. Normal/aggressiv kollapsar år 1–2 (byggandet); försiktig
  överlever och ligger närmast verkligt spel. Exakt var barnen hamnar är okänt — inga spelardata uppfunna.
- **[KOD]** server-/köbeteende (10 s-paus, fryst/glidande timer, ingen kögräns, 30 s-slots) är läst i koden,
  inte uppmätt i rummet. Simulatorns aktiv-byggtid är en förenklad modell (budget 100 s, 30 s-slots).
- Endast Mellan. Inga regler/balansvärden/trösklar/effekter/presentation ändrade; inga ändringar i
  motor/server/UI. Flash/Skola, Ö-råd, handel och byggnader orörda. **17/17 regressionstester gröna.**
