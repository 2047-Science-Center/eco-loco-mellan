# Vinst- & förlustvillkor i Eco Loco (Mellan) — designförslag

*Arbetsfil. **Committas inte utan Josefs OK.** Inget är implementerat — detta är ett förslag.*
*Grundad i: `spec/engine.js` (motorn = källa till sanning), `design/CORE-PRINCIPLES-OVERLAMNING-KLARA.md`
(invarianterna P1–P10), `design/REBALANSERING-FORSLAG.md` (nyss införd röd-zons-spiral), originalspelets
flash-regler (`~/Desktop/2047/Eco Loco/Spelregler Eco Loco flash.docx` + `5 minutes to collapse.docx`),
samt riggsömmen (`src/rigg.js`, `server/server.js`, `tools/hjarna-stubb.py`, `firmware/BLANDARE-ERIK.md`).*
*Simuleringssiffror ur `tools/simulera.js` + en krisprob (N=2000/scenario) körd mot nuvarande motor.*
*Skapad 2026-10-16.*

---

## 1. Nulägesdiagnos — varför man aldrig förlorar

### 1.1 Exakt vad som avgör vinst/förlust idag (`engine.js` `endRound` rad 386–389, `_end` 494)

```js
if (this.S.oh <= 0) return this._end(false, 'Ön kollapsade totalt.');          // (A) enda mitt-i-spelet-förlusten
if (this.S.round >= c.rounds) {                                                 // (B) bara på SISTA rundan
  return this.S.oh >= c.threshold ? this._end(true) : this._end(false, …);      //     öh ≥ 60 = vinst, annars förlust
}
```

Det finns alltså **exakt två förlustvägar**, och bara två:

- **(A) Total kollaps:** öhälsa `≤ 0` vid ett bokslut. Kan slå när som helst.
- **(B) Tröskelmiss:** på sista rundan (8) är öhälsa `< 60`.

Vinst = överlever till runda 8 med öh ≥ 60 → rikaste laget (pengar + material) vinner (P5/P6).

**Det kritiska: under runda 1–7 finns ingen konsekvens för att ligga lågt.** Tröskeln 60 ritas på
mätaren som "MÅL 60" (`ui.js:968`) men har **inga tänder förrän på sista bokslutet**. Ligger ön på 25 i
runda 4 händer ingenting mekaniskt utöver den mjuka röd-zons-spiralen (−3 öh + resurs-nota). Den enda
riktiga döden mitt i spelet är att nå **exakt 0**.

### 1.2 Varför 0 i praktiken aldrig nås (belägg ur simulering)

Krisprob mot **nuvarande motor** (N=2000/scenario), andel partier som vid något bokslut rörde öh ≤ 20
respektive öh = 0:

| Grupp | nådde öh ≤ 20 | nådde öh = 0 (förlust A) | snitt lägsta öh |
|---|---|---|---|
| Adaptiv + grön politik (grupp som *reagerar*) | **22 %** | **0 %** | 26.7 |
| 1 girig + 3 adaptiva + politik | **51 %** | 2 % | 20.4 |
| Alla gröna + politik | 0 % | 0 % | 49.9 |
| Naiv (alla standard, *oguidad*) | 100 % | 100 % | 0.0 |

Tolkning: en **grupp som reagerar** (adaptiv + grön satsning vid behov — det realistiska guidade
fallet) når **aldrig** 0, men dyker under 20 i ~1 av 5 partier. Med en bov inblandad dyker den under 20
i varannan omgång men når ändå 0 bara 2 %. **Kollapslinjen (0) ligger utanför räckhåll för en grupp som
alls försöker — så de förlorar aldrig — medan en "kris-linje" runt 20 är fullt nåbar.**

### 1.3 Två förstärkande orsaker i den guidade pilotverkligheten

1. **GM-läget stänger av det automatiska yttre trycket.** I drift körs `gm = true` (`server.js`
   `gmMode`). Då dras händelser men **appliceras inte** förrän spelledaren säger ja (`engine.js:395`,
   `resolveEventDecision`). De 100 %-kollapser simuleringen visar bygger på auto-läge
   (`chansPerRunda 0.6`) + obevekliga botar — inget av det gäller i rummet med en GM som vårdar ön.
2. **Ingen hänvisningsbar kris-signal.** Spelet har ingen punkt där någon säger "nu FÖRLORAR vi, fixa
   det NU". Ön driver i gult/rött och får **en enda dom — på allra sista bokslutet.** Spänningen
   (P6: "faller ön under gränsen förlorar alla") finns i koden men **upplevs aldrig under spelets gång.**

**Slutsats:** problemet är inte att balansen är för snäll — det är att **förlustvillkoret saknar tänder
mitt i spelet**. Enda mitt-i-döden (öh = 0) ligger så djupt att en reagerande grupp aldrig når den, och
tröskeln 60 prövas bara i runda 8. Det behövs en **skarp, synlig, hänvisningsbar kris-gräns som biter
UNDER spelets gång** — inte bara en balansjustering.

---

## 2. Tre alternativ för en skarp förlust-gräns

### Alternativ A — Röd-zons-kollapsslump (originalets 50 %/runda i rött)

**Mekanik:** vid varje bokslut där öh ligger i röd zon (`< redZone = 35`), slå tärning: med sannolikhet
`pKris` (originalkänslan ≈ 0.5) → **alla förlorar direkt.** Varje runda i rött är rysk roulette.

- **Tal:** `pKris = 0.5`, utvärderas i röd zon (< 35) vid bokslut.
- **Hur ofta:** med ~22–51 % som rör röda zonen och ofta 2–3 bokslut där, ger p=0.5 **drastiskt** utfall
  — i praktiken förlorar nästan alla som dippar i rött någon gång. Mycket vasst.
- **Skarpt/rättvist:** maximalt skarpt, men **slumpen bryter mot "räddningsbart med ansträngning".** En
  grupp som gör allt rätt (klättrar ur rött nästa runda) kan ändå slås ut av ett myntkast de inte kunde
  påverka. Pedagogiskt grumligt: lärdomen blir "otur" i stället för "era val". Svårt att hänga på en
  synlig rigg-signal (slumpen syns inte förrän den slår). **Originalkällan stödjer det inte heller** —
  flash-reglerna (`Spelregler Eco Loco flash.docx`) är *deterministiska* ("Om öns hälsa når 0 förlorar
  alla"; "Om total investering ≥60: ön överlever. Annars Hälsa → 0"); 50 %-mekaniken satt i det gamla
  *fulla* Unreal-spelet, inte i den flash-linje mellanversionen ärver.

### Alternativ B — Blandaren = kris-linje (deterministisk, hänvisningsbar) ← REKOMMENDERAS

**Mekanik:** en kris-tröskel `krisZon`. Faller öh till/under den vid ett bokslut → **KRIS deklareras**:
saftblandaren (`ecoloco/rigg/blandare 1`) tänds, skärmen går i larmläge. Krisen **måste lösas till nästa
bokslut** (öh klättrar upp över en återhämtnings-tröskel `krisReset`). Löses den inte → **alla förlorar
rundan → rundan spelas om** (rollback till rundans början). Löses den → blandaren släcks, spelet
fortsätter.

- **Tal:** `krisZon = 20`, `krisReset = 35`, deadline = 1 runda. (Motivering + flöde i §3.)
- **Hur ofta:** krisprob ovan → kris-linjen vid öh ≤ 20 tänds i **22 %** (reagerande grupp) / **51 %**
  (med en bov) / **0 %** (välspelat) av partierna. Alltså: triggar för grupper som *släpper* ön men inte
  för dem som sköter den — precis rätt fördelning.
- **Skarpt/rättvist:** deterministiskt (ingen otur), **hänvisningsbart** ("blandaren går = ni förlorar
  om ni inte fixar det"), kopplat till en **synlig fysisk signal** riggen redan har. Räddningsbart med
  ansträngning (en stark kollektiv satsning räcker, se §3). Matchar originalets deterministiska
  "lös-det-annars-kollaps"-logik och flash-dramaturgins runda-8-slutkris, men gör den upplevd mitt i
  spelet.

### Alternativ C — Hård botten (öh = 0 = direkt förlust)

**Mekanik:** behåll dagens `öh ≤ 0 → _end(false)` men gör den nåbar (brantare spiral / lägre
`redZonePenalty`-tak). I praktiken = dagens villkor, bara hårdare balanserat.

- **Tal:** t.ex. `redZonePenalty 3 → 6`, eller borttaget `Math.max(0,…)`-golv på resurs-notan.
- **Hur ofta:** endast om balansen trimmas så hårt att en reagerande grupp faktiskt faller till 0 — och
  då straffar man även dem som försöker (snowball-risken i REBALANSERING §6.2).
- **Skarpt/rättvist:** enklast (ingen ny mekanik), men **löser inte grundproblemet**: 0 är en *tyst*
  gräns utan förvarning, den slår "av misstag" (speltest-varning §6.3: "visste inte hur nära vi var"),
  och den är inte hänvisningsbar. Duger bäst som **backstop under B**, inte som huvudmekanik.

---

## 3. Rekommendation — Alternativ B, exakta siffror

> **Blandaren = kris-linjen. Faller ön till öh ≤ 20 tänds saftblandaren och ön är i KRIS. Klättrar ön
> inte tillbaka över 35 till nästa bokslut förlorar alla rundan och rundan spelas om. Tröskeln 60 på
> sista rundan (P6) och 0-golvet (backstop) ligger kvar oförändrat.**

### 3.1 De exakta talen (nya config-rattar)

| Ratt | Värde | Vad den gör | Varför just detta |
|---|---|---|---|
| `krisZon` | **20** | öh ≤ 20 vid bokslut → KRIS (blandare PÅ, larmläge) | Sammanfaller med `ohMode` "superdaligt" (`engine.js:121`, öh ≤ 20) **och** hjärnans redan edge-triggade `kris.wav` (`hjarna-stubb.py:33`). Återanvänder en gräns som rigg + ljud redan känner. Ligger tydligt UNDER röda zonen (35) → "rött = varning, blandare = rött larm". |
| `krisReset` | **35** | öh ≥ 35 vid senare bokslut → KRIS löst (blandare AV) | Hysteres på 15 p hindrar flimmer och gör "lösa krisen" = att klättra ut ur röda zonen. Kräver en reell kollektiv insats (grön satsning `gronGain 14` + gröna bygg räcker; en ensam satsning gör det inte). = dagens `redZone`. |
| `krisDeadline` | **1** | Antal rundor gruppen har på sig att lösa krisen | Ett bokslut = akut men inte orättvist. Matchar "lös det NU". |
| `krisReplay` | **true** | Fail → rollback + spela om rundan (annars: direkt game over) | Josefs linje. `false` ger hårdare variant (session slut). |

**Två-stegs-telegrafering** (svarar direkt på speltest-varningen §6.3 "visste inte hur nära vi var"):

1. **Röd zon (öh < 35):** dagens varning — röd mätare + `stageAlarm` (`ui.js:487`) + röd-zons-spiral.
2. **KRIS (öh ≤ 20):** **blandaren tänds** + skärmens KRIS-overlay + `kris.wav`. Omöjligt att missa.

### 3.2 Hur det visas — på skärmen

- **Mätaren:** lägg en KRIS-markör vid 20 (som `ohgoal` vid 60, `ui.js:968`); zonstaplarna
  (`ui.js:970`) får ett eget djuprött kris-band 0–20.
- **KRIS-overlay** när krisen är aktiv: helskärms rött pulsljus (återanvänd `stageAlarm`), rubrik
  **"ÖN ÄR I KRIS"** + hänvisningsbar text: *"Saftblandaren går. Lös krisen innan nästa bokslut —
  annars förlorar alla och rundan spelas om."* + en liten "deadline: 1 runda kvar"-indikator.
- **Vid fail:** kort "ALLA FÖRLORAR — rundan spelas om"-skärm innan rundan återställs.

### 3.3 Hur det visas — på riggen (blandaren)

Sömmen finns **redan färdig** — den är bara inte kopplad till ett spel-villkor än
(`BLANDARE-ERIK.md`: *"när i spelet den ska fyra bestämmer Josef (ännu ej inkopplad i `src/rigg.js`)"*).
Inkopplingen blir:

- Motorn emitterar ett nytt event `crisis` (`{ active: true/false }`) i bokslutet när öh korsar
  `krisZon` / `krisReset`.
- `src/rigg.js` lyssnar och gör `P('ecoloco/rigg/blandare', active ? '1' : '0')` — exakt den topic
  hjärnan redan prenumererar på (`hjarna-stubb.py:261`, `set_blandare`), som driver
  `ecoloco/rigg/out/blandare` till Eriks relä.
- Detta är **samma signal** som spelledarpultens KRIS-knapp redan skickar
  (`spelledare.html:420`: `gm/ljud larm` + `ohalsa 10` + `gm/blandare 1`). Den manuella och den
  automatiska vägen konvergerar på en enda fysisk effekt → noll nytt systemtänk, P10 orörd.

Ingen MQTT-id eller topic ändras (P10). Blandaren är redan "bara en relä-kanal till" (`BLANDARE-ERIK.md`).

### 3.4 "Spela om rundan"-flödet + motor-bedömning

**Önskat flöde:** KRIS deklareras vid bokslut N. Gruppen får runda N+1 på sig. Vid bokslut N+1:
öh ≥ 35 → krisen löst, fortsätt. öh < 35 → **alla förlorar rundan** → rulla tillbaka till **början av
runda N+1** (tillståndet precis efter bokslut N, då krisen deklarerades) och spela om den med krisen
fortfarande aktiv.

**Klarar motorn det idag? Nej — det kräver ett litet, rent tillägg.** `_snapshot()` (`engine.js:166`)
sparar **bara** `_roundStartWealth` (pengar+material per lag) för award-beräkning — det är **ingen**
full state-snapshot. För att spela om en runda behövs:

1. **Full snapshot vid rundstart.** I `_snapshot()` (anropas vid `start` och efter varje bokslut,
   `engine.js:391`): spara `this._roundSnapshot = structuredClone(this.S)`. `S` är ren data (tal,
   strängar, arrayer, objekt — inga funktioner/Map/Set) → `structuredClone` räcker och är exakt.
2. **Restore-metod.** `replayRound()`: `this.S = structuredClone(this._roundSnapshot)` + emit nytt
   event `roundReplay { round }`. Återställer öhälsa, slots, built, inkomster, bannlysning,
   `gronQueued`, logg, **och** `eventPool`/`drawnEvents` (så samma händelser kan dras om — eller, som
   designval, lämnas dragna; se öppen fråga §5).
3. **Krisgrind i bokslutet.** I `endRound`, där öhälsan just applicerats (`engine.js:368–370`): sätt/
   rensa `S.krisAktiv` mot `krisZon`/`krisReset`, räkna ned `S.krisDeadline`, och vid 0 utan
   återhämtning → emit `gameEnd`-liknande "rundförlust" + `replayRound()`.
4. **Skärm + rigg** hanterar `roundReplay` (nollställ rundans UI, blandaren kvar PÅ tills löst).

Omfattning: ~1 snapshot-rad + en `replayRound()`-metod + ~10 rader krisgrind i `endRound` + ett nytt
event. **Måttligt, inte trivialt — och det rör vinst/förlust-logiken, som invariantdokumentet
uttryckligen pekar ut som ett Josef-beslut** (CORE-PRINCIPLES §2.4: "vinst/förlust-logiken … ligger i
logiken, inte i siffrorna — och är invarianter"). Därför korrekt att det kommer som förslag.

**Softlock-skydd:** en grupp som failar om och om fastnar annars i evig omspelning. Förslag: GM-pulten
får en "rädda/godkänn runda"-override (GM äger rummet ändå), och/eller `krisMaxReplays` (t.ex. 2) →
därefter session-slut. Flaggas som balansbeslut (§5).

### 3.5 Vad som INTE ändras

- Vinstvillkoret: överlev till runda 8 med öh ≥ 60 → rikaste (pengar + material) vinner. **Orört**
  (P5/P6, `richest()` `engine.js:314`).
- 0-golvet (`öh ≤ 0 → total kollaps`) ligger kvar som **backstop** men slår sällan — kris-linjen vid 20
  träffar först. (Alternativ C infogat som skyddsnät under B.)
- Alla korthänder, events och den nyss införda röd-zons-spiralen: **orörda** av detta förslag.

---

## 4. Invariant-koll (P1–P10)

| Princip | Påverkan | Omdöme |
|---|---|---|
| **P1** Svårare att vara grön | Rörs ej — korthänder/kostnader oförändrade. | ✅ Grön förblir dyr/svag; krisen räddas *kollektivt*, inte genom att grönt blir billigt. |
| **P2** Privat vinst, delad nota | Krisen slår på den **enda delade** ö-mätaren → alla förlorar tillsammans. | ✅ Förstärker tragedin (delad nota blir kännbar). |
| **P3** Två valutor / tvingad handel | Rörs ej. | ✅ |
| **P4** Omröstning = de svagas verktyg | Att klättra +15 öh på en runda kräver i praktiken grön satsning (3/4) + gröna bygg → **tvingar samordning**. | ✅ Stärker omröstningens roll. |
| **P5** Rikast vinner, lättare smutsigt | Vinstmått orört. Boven som orsakar krisen förlorar också om den inte vänds → eget skäl att vara med. | ✅ |
| **P6** Under tröskeln → alla förlorar | **Kärnan som förslaget ger tänder mitt i spelet.** Tröskeln 60 (sista rundan) + 0-golvet båda kvar. | ✅ Direkt i linje — P6 blir *upplevd*, inte bara slutdom. |
| **P7** Lärdomen helig | Deterministisk, läsbar kris → lärdomen blir "era val", inte otur (därav B före A). | ✅ |
| **P8** 4 lag, 3 val, en mätare | Ingen förändring av grammatiken. | ✅ |
| **P9** Sektorer lika från start | Rörs ej. | ✅ |
| **P10** Riggsömmen (MQTT-id) orörd | Återanvänder befintlig `ecoloco/rigg/blandare`-topic; inga id/topic ändras. | ✅ |

**Kräver Josefs balans-OK (per §2.4 = vinst/förlust är invariant):**
(a) själva kris-linjen som ny förlustväg; (b) talen `krisZon 20` / `krisReset 35` / deadline 1;
(c) "spela om rundan" vs direkt game over (`krisReplay`); (d) softlock-policy (`krisMaxReplays` / GM-override).

---

## 5. Öppna frågor till Josef

1. **Spela om rundan vs game over:** omspelning (rekommenderat, mjukare för en station) eller hård
   session-slut vid fail?
2. **Softlock:** hur många omspel innan GM-override/session-slut? (Förslag: GM kan alltid rädda + tak 2.)
3. **Händelser vid omspel:** ska redan dragna events dras om (full rollback) eller förbli förbrukade?
   (Förslag: full rollback = samma runda, rättvisast.)
4. **Kris-linjens djup:** 20 (djup, dramatisk, ~22 % i reagerande grupp) eller högre (triggar oftare,
   men blandaren = varning snarare än existentiellt larm)? Rekommendation: 20.
5. **Återhämtnings-krav:** räcker +15 öh (20→35) på en runda, eller vill du ha det snävare/bredare?
