# Ombalansering av Eco Loco (Mellan) — förslag

*Arbetsfil. Inte beslutad, inte committad. Grundad i `spec/engine.js` (motorn = sanning), validerad med
Monte Carlo (N=4000/scenario) och korskontrollerad mot riktiga speltest-utvärderingar (se §6) och det
ursprungliga balansunderlaget. Allt nedan är **parameter-/sifferjusteringar** + EN liten
återkopplings-mekanik som redan är dokumenterad men aldrig implementerad.*

> **Innan något ändras:** kör `RAMVERK.md`:s konflikt-checklista. Kortens siffror (`MATERIAL_HAND`/
> `PENGAR_HAND`), `EVENTS` och den nya röd-zons-spiralen ligger **hårdkodade i `engine.js`** och går
> *inte* att tuna via `assets.json` → de kräver ett medvetet beslut av Josef (RAMVERK-invariant). Config-
> värdena (start, redZone, gronGain, taxAmount, eventLoss m.fl.) kan läggas live i `spec/assets.json → config`.
>
> **Allt nytt är "testa"-läge.** §7 listar exakt NULÄGE (gamla värden/beteende) för varje rad vi rör,
> så det går att återställa på en minut om speltest säger annat.

---

## 0. Josefs fästa beslut (styr förslaget)

1. **Vinstmått = oförändrat.** Den med **mest kapital (pengar + material)** vinner — exakt som motorn
   räknar idag (`richest()`, `engine.js:217`, summerar `pengar + material`). Inget förslag om "bara
   pengar". Rörs ej.
2. **Sektorerna är LIKA från grunden.** Symmetriska startförutsättningar — allt ska bero på spelarnas
   val, inga olika förutsättningar från start. → Vi **speglar händerna** (material = pengar i egen/
   motpartsvaluta-termer) och **jämnar starten** (35/35 i stället för 40/30). Se §3.1–3.2.
3. **"2 smutsiga lag = garanterad kollaps" gäller INTE.** Det var ett *exempel*, inte en regel. Krisen
   ska gå att **rädda**. → Vi kör den **mjukare spiral-varianten** (redZonePenalty 3) + ett starkare men
   inte trivialt kollektivt grön-verktyg, så en djup kris är räddningsbar om minst 3 lag går ihop.
4. **Röd-zons-spiralen behålls** — men dokumenteras tydligt (NULÄGE i §7) och körs som "testa".

---

## 1. Mål (från Josef)

1. Större konsekvenser, särskilt **negativa**, av standard/smutsigt.
2. Man ska **snabbare hamna i kris**.
3. Det ska **verkligen krävas samarbete** (byten + omröstning) för att vända och rädda ön.
4. Vanligt scenario: **1–2 lag kör eget race** (smutsigt, ekonomiskt överläge) → kris inom **få rundor**
   om inget görs — men det ska gå att vända om de andra går ihop.
5. **Exponentiell kurva**: långsam start → accelererande kris → mitten kräver mycket samarbete för att
   vända → kan sedan eskalera uppåt.

Okränkbart: mest kapital vinner · lättare att vinna smutsigt, svårare grönt · smutsiga lag får
ekonomiskt överläge + maktmedel · allmänningarnas tragedi.

---

## 2. Nuläges-diagnos (siffror ur koden)

### 2.1 Kortens öhälso-avtryck är för svaga OCH osymmetriska (`engine.js:68–77`)
| Sektor | smutsig oh | standard oh | grön oh |
|---|---|---|---|
| Material (Åker/Skog) | −4 | −2 | +1 |
| Pengar (Tundra/Stad) | −2 | **+1** | +3 |

- **Standard är i princip gratis för ön.** Naiv grupp (alla standard) = 2×(−2)+2×(+1) = **−2/runda**.
  Sim: slut-öhälsa **27**, kurva `50→47→44→…→27` — linjärt, ingen dramatik.
- **Pengar-standard *läker* ön (+1)** och pengar-korten är billigare/renare → pengar-sektorn vinner
  **~100 %** av alla partier i sim (bekräftar SPELINFO §Balansläget). Det bryter mot beslut 2 (symmetri).
- **Smutsigt straffar för milt** (−4/−2) → ön kraschar inte "av sig själv" i tid.

### 2.2 Starten är osymmetrisk (`engine.js:16–18`)
`startPengar 40`, `startMaterial 30`. Alla lag startar lika *med varandra*, men ett pengar-lag startar
med mer av sin egen valuta (40 pengar) medan ett material-lag startar med mer av det det måste byta till
sig. Kombinerat med osymmetriska händer ger det en start-skevhet. Bryter mot beslut 2.

### 2.3 Krisen är **linjär**, och den dokumenterade röd-zons-katastrofen finns inte i koden
SPELINFO §Regler lovar *"Röd zon < 30 (katastrofer slår varje runda: alla förlorar 10🪙+10🧱)"*. Det är
**inte implementerat.** `engine.js:264`: *"Gamla kris-slumpen är borttagen"*. Och:
- `redZone: 30` (`engine.js:22`) används bara av UI-färg (`ui.js:481–486`), mock-strategi
  (`mock-opponents.js:23`) och rigg-ljud "relief" (`rigg.js:77`) — **aldrig mekaniskt i bokslutet.**
- `eventLoss: 10` (`engine.js:25`) och `greenZone: 70` (`engine.js:23`) är **död config.**

→ Ingen accelererande återkoppling. Faller ön under 30 händer inget extra. Ingen exponentiell kurva.

### 2.4 Räddningsverktygen är för svaga för att "vända" (`engine.js:200–211`)
- Grön satsning `gronGain: 8` öhälsa (3/4). Två smutsiga lag drar lika mycket → satsningen *bromsar*,
  *vänder* inte.
- Miljöskatt `taxAmount: 15` flyttar bara pengar, **ingen öhälso-effekt**.
- Sim: utfallet är **binärt** — bara helgröna grupper räddar ön (~98 %); allt annat 0 %. Inget mittfält.

---

## 3. Förslag — konkreta taländringar (gammalt → nytt)

### 3.1 Speglade, symmetriska händer (`engine.js:68–77`) — hårdkodat, kräver beslut
Material och pengar blir **identiska** uttryckt i egen/motpartsvaluta. (opp = valutan sektorn måste byta
till sig; own = valutan sektorn producerar.) Smutsigt billigast + högst avkastning + värst för ön; grönt
dyrast + lägst avkastning + enda som bygger upp. Beroendet (man måste byta) kvarstår.

| tier | opp-kost | own-kost | own-avk. | oh (NY) | oh (gammalt mat/pen) |
|---|---|---|---|---|---|
| **smutsig**  | 8  | 0  | 9 | **−6** | −4 / −2 |
| **standard** | 8  | 6  | 7 | **−3** | −2 / +1 |
| **grön**     | 14 | 10 | 5 | **+3** | +1 / +3 |

Konkret i motorn:
```js
const MATERIAL_HAND = [            // own = material (gm), opp = pengar (kp)
  { tier:'smutsig',  kp: 8,  km: 0,  gp: 0, gm: 9, oh: -6 },
  { tier:'standard', kp: 8,  km: 6,  gp: 0, gm: 7, oh: -3 },
  { tier:'gron',     kp: 14, km: 10, gp: 0, gm: 5, oh:  3 },
];
const PENGAR_HAND = [              // own = pengar (gp), opp = material (km)  — exakt spegel
  { tier:'smutsig',  kp: 0,  km: 8,  gp: 9, gm: 0, oh: -6 },
  { tier:'standard', kp: 6,  km: 8,  gp: 7, gm: 0, oh: -3 },
  { tier:'gron',     kp: 10, km: 14, gp: 5, gm: 0, oh:  3 },
];
```
Varför: (a) standard slutar vara gratis/läkande → tydliga negativa konsekvenser (mål 1); (b) smutsigt
−6 gör 1–2 bovar till en snabb krismotor (mål 4); (c) spegling tar bort pengar-dominansen → sim går från
**pengar 100 %** till **~50/50** mellan sektorerna (beslut 2). Spännvidden −6…+3 närmar sig originalets
breda avtryck (Oljekraftverk −8 … Avancerad återvinning +5 i *Balansering Eco Loco.xlsx*).

### 3.2 Config (`engine.js:12–30` / läggs i `assets.json → config`)
| Parameter | gammalt → nytt | motivering |
|---|---|---|
| `startPengar` | 40 → **35** | Symmetrisk start (beslut 2). |
| `startMaterial` | 30 → **35** | Samma — summan (70) oförändrad. |
| `ohStart` | 50 → **50** | Oförändrad (lugn start). |
| `threshold` | 60 → **60** | Kärnvillkor — orört. |
| `redZone` | 30 → **35** | Spiralen biter tidigare → kris "fastnar" lättare. |
| `redZonePenalty` | *(ny)* → **3** | Mjuk spiral (beslut 3) — se §3.4. |
| `eventLoss` | 10 → **4** | Återaktiveras (allmänningens nota i röd zon); **lågt** pga speltest-risk (§6.3). |
| `gronCost` | 10 → **8** | Billigare → råd att samarbeta även i kris. |
| `gronGain` | 8 → **14** | Kollektiv satsning (3/4) ska kunna **vända** en kris, men inte trivialt. |
| `taxAmount` | 15 → **20** | Vassare maktmedel mot boven. |
| `rounds` | 8 → **8** | Oförändrat. |

### 3.3 Events (`engine.js:50`) — hårdkodat
| Parameter | gammalt → nytt | motivering |
|---|---|---|
| `EVENT_CONFIG.chansPerRunda` | 0.5 → **0.6** | Mer yttre press (endast auto/selfplay; GM-läge opåverkat). Speltest efterfrågade "större chans för saker att hända" / "oförutsedda händelser" (§6.1). |

Enskilda event-siffror kan stå kvar i v1 — kort + spiral är den stora hävstången.

### 3.4 EN ny mekanik: röd-zons-spiralen (beslut 4 — behålls, körs som "testa")
Återaktiverar det SPELINFO redan *lovar* och som config (`redZone`, `eventLoss`) + UI + rigg-ljud redan
är byggda för. Läggs i bokslutet precis före att öhälsan appliceras (`engine.js:259`):

```js
// Röd-zons-spiral: är ön i kris faller den EXTRA varje runda (exponentiell nedförsbacke)
// och alla lag betalar allmänningens nota. Vänds bara genom samarbete.
const provisional = before + delta;
if (provisional > 0 && provisional < c.redZone) {
  delta -= (c.redZonePenalty || 0);                      // extra öhälso-fall (−3)
  this.S.teams.forEach(t => {                            // allmänningens nota (−4/−4 resurser)
    t.pengar   = Math.max(0, t.pengar   - (c.eventLoss || 0));
    t.material = Math.max(0, t.material - (c.eventLoss || 0));
  });
}
```
Över redZone faller ön linjärt (kortens avtryck). Under redZone tillkommer −3/runda → självförstärkande
spiral → kurvan blir exponentiell: långsam start, snabb kris, botten som bara kraftigt samarbete lyfter
ur. Mjuk (−3, inte −4) så en djup kris är **räddningsbar** (beslut 3): sim visar att 3 samordnade lag
klättrar ur röd zon tillbaka över 60.

---

## 4. Vanligt scenario — 8-rundors-omgång, FÖRE vs EFTER

Scenario: 2 lag kör smutsigt (ekonomiskt överläge), övriga försöker hålla igen. Snitt-kurvor ur sim
(snitt-öhälsa start→r8).

### FÖRE (nuvarande motor)
| Grupp | r0 | r1 | r2 | r3 | r4 | r5 | r6 | r7 | r8 | Utfall |
|---|---|---|---|---|---|---|---|---|---|---|
| 2 smutsiga + 2 passiva | 50 | 41 | 32 | 23 | 14 | 6 | 1 | 0 | — | kollaps, men först r6–7 |
| Naiv (alla standard) | 50 | 47 | 44 | 41 | 38 | 35 | 32 | 29 | 27 | fail — men långsamt, odramatiskt |

Krisen *kryper*. Ingen vändpunkt, grön satsning (+8) räcker inte för att vända → samarbete känns lönlöst.

### EFTER (förslaget)
| Grupp (politik) | r0 | r1 | r2 | r3 | r4 | r5 | r6 | r7 | r8 | Utfall |
|---|---|---|---|---|---|---|---|---|---|---|
| Naiv (alla standard) | 50 | 37 | 21 | 5 | 0 | — | — | — | — | **kollaps r4** |
| 2 smutsiga + 2 gröna, ingen politik | 50 | 43 | 35 | 24 | 11 | 2 | 0 | — | — | **kollaps r6** |
| **1 smutsig + 3 som samarbetar** (byten+röster) | 50 | 52 | 70 | 67 | 57 | 56 | 57 | 59 | 63 | **räddad (67 %)** — kris vänd! |
| Delvis samordnad grupp | 50 | 69 | 73 | 73 | 70 | 71 | 75 | 80 | 85 | klarar ön (98 %) |

- **Långsam start → snabb kris:** r0→r1 mild, sedan accelererar fallet när ön passerar redZone (35) och
  spiralen slår. Exponentiellt (naiv: `50→37→21→5→0`).
- **1–2 bovar → kris inom få rundor** om inget görs (kollaps r4–6).
- **Men räddningsbart:** går **3 lag ihop** (bygg grönt + grön satsning 3/4 + förbjud smutsig mot boven)
  vänder kurvan ur röd zon och tillbaka över 60 — och "eskalerar uppåt" (slutar 63–85). Det kräver att
  minst en av bovarna fås med / tvingas via omröstning (3/4).

---

## 5. Simuleringsresultat (N=4000/scenario)

Kört `spec/engine.js` (NULÄGE) mot patchad kopia (FÖRSLAG), samma bot-strategier/bytes-logik som
`tools/simulera.js`. Benchmark (SPELINFO): naiv ~10–20 %, delvis samordnad ~50–70 %, samordnad ~95 %.

| Scenario | NULÄGE överlev | FÖRSLAG överlev | Vinnarsektor FÖRE→EFTER |
|---|---|---|---|
| Naiv (alla standard) | 0 % (slut-öh 27, krälar) | **0 %, kollaps r4** | pen 100 → (kollaps) |
| Adaptiv, ingen politik | 0 % (slut-öh 38) | 0 % (slut-öh 40) | pen 100 → **mat 52/pen 48** |
| 2 smutsiga + 2 passiva | kollaps 100 % (r6–7) | **kollaps 100 %, r3–4** | — |
| 2 smutsiga + 2 gröna, ingen politik | kollaps 38 % | **kollaps 100 %, r6** | — |
| 2 smutsiga + 2 gröna, politik-hammer | 0 % (slut 32) | 0 % överlev, 53 % kollaps | 2 bovar = mycket svårt, ej garanterat 0 |
| **1 smutsig + 3 samarbetar (hammer)** | 37 % | **67 %** | djup kris räddningsbar |
| Delvis samordnad + full politik | 92 % | 98 % | pen 100 → **mat 49/pen 51** |
| Adaptiv (reaktiv) + full politik | 0 % (slut 38) | **24 %** (slut 50) | → **mat 61/pen 40** |
| Samordnad grön + full politik | 98 % | 100 % | pen 100 → **mat 38/pen 62** |
| SLUMP (förvirrad grupp) | 0 %, kollaps 10 % | **kollaps 100 %** | pen 99 → mat 53/pen 47 |

Tre saker FÖRSLAGET fixar:
1. **Sektor-paritet:** pengar-dominansen (100 %) → **~50/50** i symmetriska scenarier (beslut 2).
2. **Gradient i stället för binärt:** naiv kraschar fort · reaktiv/delvis ~24–98 % · samordnad ~100 %.
3. **Räddningsbar djup kris:** 3 samordnade lag vänder en kris (37 %→**67 %**); 2 hårdnackade bovar är
   mycket svåra men **inte garanterad kollaps** (och i verkligheten förlorar bovarna också om ön <60, så
   de har eget skäl att vända i tid → då blir det 3-mot-1-fallet, som är räddningsbart).

---

## 6. Vad de riktiga speltest-utvärderingarna säger (stödjer de diagnosen?)

Analys av tre utvärderingsfiler av det **förra (fysiska) Eco Loco** — enbart det som rör **balansering
och spelets syfte** (feedback om "svårt att förstå"/UI/buggar ignorerad per uppdrag):
`Eco Loco speltest VT-25(1-22)` (22 svar, ungdoms-/sci-clubs), `Utvärdering Eco Loco (2)(1-9)` (9 svar,
Länsstyrelsen/pedagoger), `Utvärdering Eco Loco(1-25)` (25 svar, science-center-proffs + ungdomar).

**Viktig reservation:** utvärderingarna gäller det *förra* spelet (telefon, forskningsträd, attackera
industrier m.m.), inte mellan-motorn 1:1. De validerar alltså **riktningen**, inte de exakta siffrorna.
Förslaget är **inte** ändrat utifrån dem — detta är ren dokumentation av om de stödjer min diagnos.

### 6.1 Starkt STÖD för diagnosen och förslaget
- **"För belönande med dåliga beslut, borde straffas mer" / "ohållbar verksamhet lönar sig" / "hade
  behövt kännas mer i magen inför dåliga beslut"** (Tobias Minin). Dead-on mål 1 → stöder hårdare
  smutsig/standard-avtryck (§3.1).
- **"Odlingarna var bara bra, det fanns inget dåligt med dom — dom borde ge minus i samhället"** (Elver)
  → exakt skälet att göra standard negativ (§3.1, standard +1/−2 → −3).
- **"Lite för lätt att inte köra ön i botten"** (Patrik G); **"i sista rundan blev det för lätt, inga
  problem"** (Elver); **"för enkelt för de som brukar spela mycket?"** (Helena) → stöder snabbare/hårdare
  kris (§3.1–3.4).
- **"Om en person är jätterik och förstör naturen vinner dom, för alla andra måste tänka på naturen men
  inte personen som går minus"** (Gabriel) → precis slutspänningen; stöder att konsekvenserna måste bita.
- **"Bra jordbruk + olja gav jättestor tillväxt OCH bra klimat"** (Gustav); **"olja är fett effektivt för
  att tjäna pengar"** (Anton); **"så länge man har återvinning kan man utnyttja oljeindustrin hur mycket
  man vill"** (Jonas H) → smutsigt = ekonomiskt överläge (önskat) men nuvarande straff för litet; stöder
  −6 på smutsig så "kompensera bort smutsen" inte blir gratis.
- **"När man insåg vad som hände var det för sent"** (Irene) → kris som smyger och sen slår — stöder den
  exponentiella spiralen (men se 7.3 om att göra den läsbar).
- **Samarbete/maktmedel:** "behövde minst en vän, annars rev de andra ens industri" (Gustav); "om en
  började stycka ut sig var det lätt för de andra att samarbeta, men alla ville vinna så ingen vann"
  (Titus) → stöder att samarbete krävs + att omröstning är maktmedel (§3.2 taxAmount/förbud).
- **Fler event:** "större chans för saker att hända" (William); "oförutsedda händelser saknades" (Irene);
  "slumpen skapar händelser som påverkar mätarna" (Patric) → stöder `chansPerRunda` 0.5→0.6 (§3.3).
- **Jämn start värderades:** återkommande "alla fick samma förutsättningar / samma odds" (minst 6 svar)
  → stöder beslut 2 (symmetriska sektorer + jämn start).
- **Syftet landar redan:** "en handling får påverkan, drabbar inte den som utför den" (Markus =
  allmänningens tragedi), "varför företag agerar olika", "motstridiga intressen", återkommande
  "samarbete". Kärnsyftet är rätt — ombalanseringen ska förstärka det, inte byta det.

### 6.2 Nyanser kring beslut 3 (räddningsbart, inte garanterad kollaps)
- **"Jag och en annan hade olja, de andra två kunde inte göra något för vi nekade varje politiskt
  förslag"** (Jonas H). Verkligt belägg för att **2 bovar kan blockera** 3/4-omröstningar → de övriga 2
  kan inte rädda ensamma. Det matchar förslaget: räddning kräver **minst 3** som samarbetar (en bov måste
  vändas/tvingas). Stöder att behålla 3/4-grinden men göra djup kris räddningsbar när 3 går ihop (sim:
  67 %).
- **Snowball:** "får man en stark start har man praktiskt taget vunnit; de starkaste krossar de svaga"
  (Casper) → risk att comeback blir omöjlig. Stöder beslut 3 (mjuk spiral −3, inte −4) så att vändning
  är möjlig.

### 6.3 Två tydliga VARNINGAR som förslaget måste respektera
- **Resurs-svält / fastna utan produktion:** flera vittnar om att de blev pank och **inte kunde
  producera eller köpa under flera rundor och fastnade** (Ellen, Maja, m.fl.); Gustav: *"man borde alltid
  kunna producera lite — en basproduktion så man kan komma tillbaka."* → Allmänningens nota (`eventLoss`
  som drar resurser i röd zon) riskerar precis detta. Därför satt **lågt (4)** och flaggat "testa"; om
  speltest visar låsningar: sänk mot 0, eller lägg in en bas-/minsta-produktion. **Öppen fråga.**
- **Kris-läsbarhet:** "visste inte hur nära vi var att förlora — förlorade en gång av misstag, ingen
  förstod att vi var i farozonen" (Gustav, Titus). → Spiralen MÅSTE telegraferas tydligt. UI har redan
  röd-zon-färg + larm (`ui.js:481`, `stageAlarm`) och rigg-ljud; se till att spiral-fallet syns som en
  tydlig varning innan det slår.

### 6.4 Realism-not (lägre prioritet)
Marit: "ologiskt att jordbruk gav pengar men inga resurser — tvärtom i verkligheten"; önskar justering av
hur rimligt pengar/resurser/miljöpåverkan är per verksamhet. Mellan-mappningen (Åker/Skog→material)
adresserar delar av detta. Symmetriska sektorer (beslut 2) prioriterar rättvisa/tydlighet — som spelarna
värderade högt — framför verksamhetsspecifik realism. Medveten avvägning.

### 6.5 Sammanfattad dom
Utvärderingarna **stödjer genomgående** diagnosen och förslagets riktning: hårdare smutsig/standard,
snabbare kris, vassare samarbetsverktyg, fler event, behåll jämn start. De **motsäger inget** i §2–3. De
**tillför två konkreta krav**: (a) undvik olåsbar resurs-svält (håll `eventLoss` lågt / överväg
bas-produktion), (b) gör krisen/spiralen läsbar i UI:t.

---

## 7. NULÄGE att kunna återställa till (gamla värden/beteende)

Allt nedan är nuvarande, orört tillstånd i `spec/engine.js`. Rör vi en rad → detta är "ångra"-värdet.

**Config (`DEFAULT_CONFIG`, `engine.js:12–30`):** `rounds 8` · `startPengar 40` · `startMaterial 30` ·
`ohStart 50` · `ohMax 100` · `threshold 60` · `redZone 30` · `greenZone 70` · `eventLoss 10` (oanvänd) ·
`gronCost 10` · `gronGain 8` · `taxAmount 15`. Ingen `redZonePenalty` finns.

**Händer (`engine.js:68–77`):**
- MATERIAL: smutsig `kp10 km0 gp0 gm8 oh-4` · standard `kp15 km5 gp0 gm6 oh-2` · gron `kp25 km10 gp0 gm5 oh+1`
- PENGAR:  smutsig `kp0 km8 gp10 gm0 oh-2` · standard `kp6 km6 gp7 gm0 oh+1` · gron `kp10 km8 gp6 gm0 oh+3`

**Events (`engine.js:50`):** `EVENT_CONFIG.chansPerRunda 0.5`.

**Bokslut (`endRound`, `engine.js:233–287`):** öhälsa appliceras rakt av (`oh = clamp(oh + delta)`),
`engine.js:259–262`. **Ingen** röd-zons-spiral, **ingen** resurs-nota. `engine.js:264` noterar uttryckligen
att den gamla kris-slumpen är borttagen. `eventLoss`/`greenZone`/`redZone` läses inte mekaniskt här.

**Vinst (`_end`/`richest`, `engine.js:217,385–393`):** vinnare = högst `pengar + material`. Rörs ej.

---

## 8. Checklista för att genomföra (om beslut tas)
- [ ] `engine.js:68–77` — speglade, symmetriska händer (§3.1).
- [ ] `engine.js:16–18` — `startPengar 40→35`, `startMaterial 30→35`.
- [ ] `engine.js:12–30` — `redZone 30→35`, lägg `redZonePenalty 3`, `eventLoss 10→4`, `gronCost 10→8`, `gronGain 8→14`, `taxAmount 15→20`.
- [ ] `engine.js:259` — lägg in röd-zons-spiralen (§3.4).
- [ ] `engine.js:50` — `chansPerRunda 0.5→0.6`.
- [ ] Spegla de live-tunbara config-värdena i `spec/assets.json → config`.
- [ ] Säkra att spiral-fallet **telegraferas** i UI (röd-zon-larm, §6.3) — annars upplevs det som §6.3:s "förlorade av misstag".
- [ ] Uppdatera SPELINFO.md §Regler (röd-zon-texten stämmer då med koden) + hand-tabellerna + starten (35/35).
- [ ] Kör `node tools/simulera.js` och jämför mot §5.
- [ ] Speltesta med riktig grupp — särskilt resurs-svält i röd zon (§6.3) — innan siffrorna fryses.
