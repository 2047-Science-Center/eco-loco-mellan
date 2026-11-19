# Mellan — två spelprotokoll, bygge för bygge

*Skriven 2026-11-19 av Claude. Två reproducerbara partier att läsa igenom som om man satt bredvid barnen
under en spelomgång. Ett **byggtätt** och ett **lugnt**, alla fyra lag, de tre första åren, med VARJE enskilt
bygge (inte bara händelserna). Kör `spec/engine.js` orörd i nuvarande läge (`ohalsaDelayed=true`) — inga
regler/trösklar/effekter ändrade. Komplement till [MELLAN-HANDELSEBALANS.md](MELLAN-HANDELSEBALANS.md).*

> **Reproducerbart (exakt dessa protokoll):**
> `node tools/handelse-protokoll.js 1001 normal 3` (byggtätt)
> `node tools/handelse-protokoll.js 1000 forsiktig 3` (lugnt)
> `node tools/handelse-protokoll.js scan` (hitta fler frön) · `… <frö> <appetit> <antal år>` (valfritt parti)

## Så läser du orsakskedjan
För varje bygge visas hela kedjan:

> **Byggnad** → **resursförändring** (kassa före→efter + produktion/år) → **miljöpåverkan** (öhälsa + lagets
> ackumulerade skada) → **uppfyllt händelsevillkor** → **händelse** → **konsekvens**.

Vid bokslut:

> årets **samlade miljöpåverkan** → **ny öhälsa** → **kvalificerade öhälsohändelser** → **när de visas** (nästa år).

Teckenförklaring: 🪙 pengar · 🧱 material · ★ positiv händelse · ⚠ negativ händelse · ⚡ fördröjd
öhälsohändelse (öns reaktion från förra året). Bottarna är deterministiska heuristiker, **inte barn** — de
bygger fortare och förhandlar sämre; läs protokollen som *mekanik-genomgång*, inte som typiskt barnspel.

---

## Exempel 1 · BYGGTÄTT parti (lag bygger fort) — frö 1001, appetit `normal`
*2 år spelade · ön kollapsar till 0 i år 2. Visar år-1-klustret: 9 händelser i första byggfasen, och hur
smutsiga byggen trappar upp miljökriserna −10 → −20.*

```
────────── ÅR 1 ──────────

  🔨 Åker (Oxen) bygger GRÖN "Ekologiskt jordbruk"
     kostar 14🪙 10🧱 → kassa 35🪙/35🧱 → 21🪙/25🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → inget händelsevillkor uppfyllt

  🔨 Åker (Oxen) bygger GRÖN "Ekologiskt jordbruk"
     kostar 14🪙 10🧱 → kassa 21🪙/25🧱 → 12🪙/20🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → ★ FRAMTIDSVISIONÄR  (villkor: grön-svit ≥2 och laget ligger sist)
        konsekvens: Åker +5🪙 +5🧱

  🔨 Åker (Oxen) bygger GRÖN "Ekologiskt jordbruk"
     kostar 14🪙 10🧱 → kassa 14🪙/18🧱 → 5🪙/13🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → ★ GRÖNA FONDEN  (villkor: 3 gröna byggen totalt (nu 3))
        konsekvens: Åker +5🪙
     → ★ EXPANSION  (villkor: 3:e bygget samma år (nu 3))
        konsekvens: Åker  +5🧱

  🔨 Skog (Björnen) bygger GRÖN "Skogsjordbruk"
     kostar 14🪙 10🧱 → kassa 30🪙/40🧱 → 16🪙/30🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → inget händelsevillkor uppfyllt

  🔨 Skog (Björnen) bygger GRÖN "Skogsjordbruk"
     kostar 14🪙 10🧱 → kassa 16🪙/30🧱 → 2🪙/20🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → inget händelsevillkor uppfyllt

  🔨 Skog (Björnen) bygger SMUTSIG "Sågverk"
     kostar 8🪙 0🧱 → kassa 8🪙/14🧱 → 0🪙/14🧱   (produktion 0🪙 +9🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada 0 → -6
     → inget händelsevillkor uppfyllt

  🔨 Skog (Björnen) bygger SMUTSIG "Sågverk"
     kostar 8🪙 0🧱 → kassa 8🪙/6🧱 → 0🪙/0🧱   (produktion 0🪙 +9🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -6 → -12
     → ⚠ SKADEDJUR  (villkor: ackumulerad miljöskada -12 nådde tröskeln (−10))
        konsekvens: Skog  -10🧱 · öhälsa -4 → 46

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 21🪙/49🧱 → 21🪙/41🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada 0 → -6
     → inget händelsevillkor uppfyllt

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 21🪙/41🧱 → 11🪙/33🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -6 → -12
     → ⚠ OLJEUTSLÄPP  (villkor: ackumulerad miljöskada -12 nådde tröskeln (−10))
        konsekvens: Tundra -10🪙 · öhälsa -4 → 42

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 11🪙/33🧱 → 11🪙/25🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -12 → -18
     → ⚠ UPPROR  (villkor: rikast med ≥30 marginal)
        konsekvens: Stad -15🪙 -10🧱 · öhälsa -3 → 39

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 11🪙/25🧱 → 0🪙/17🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -18 → -24
     → ⚠ MARKEN RASAR  (villkor: ackumulerad miljöskada -24 nådde tröskeln (−20))
        konsekvens: Tundra -20🪙 · öhälsa -8 → 31

  🔨 Stad (Örnen) bygger standard "Kontor & hotell"
     kostar 6🪙 8🧱 → kassa 20🪙/25🧱 → 14🪙/17🧱   (produktion +7🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada 0 → -3
     → inget händelsevillkor uppfyllt

  🔨 Stad (Örnen) bygger standard "Kontor & hotell"
     kostar 6🪙 8🧱 → kassa 14🪙/17🧱 → 8🪙/9🧱   (produktion +7🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada -3 → -6
     → inget händelsevillkor uppfyllt

  🔨 Stad (Örnen) bygger standard "Kontor & hotell"
     kostar 6🪙 8🧱 → kassa 8🪙/9🧱 → 2🪙/1🧱   (produktion +7🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada -6 → -9
     → inget händelsevillkor uppfyllt

  📊 BOKSLUT år 1:
     passiv produktion: Åker 0🪙+15🧱 · Skog 0🪙+28🧱 · Tundra +36🪙0🧱 · Stad +21🪙0🧱
     årets samlade miljöpåverkan på ön: -30 öhälsa → ön 31 → 1
     ⤷ KVALIFICERADE öhälsohändelser (öhälsa 1): VÄRMEBÖLJA, STORM — visas ~30 s in i år 2

────────── ÅR 2 ──────────
  ⤷ Öns reaktion från förra året (fördröjda öhälsohändelser, ~30 s in i byggfasen):
     ⚡ VÄRMEBÖLJA — Åker  -3🧱, Skog  -3🧱, Tundra -3🪙, Stad -3🪙 (öhälsa oförändrad)
     ⚡ STORM — Åker  -5🧱, Skog  -5🧱, Tundra -5🪙, Stad -5🪙 (öhälsa oförändrad)

  🔨 Åker (Oxen) bygger GRÖN "Ekologiskt jordbruk"
     kostar 14🪙 10🧱 → kassa 14🪙/11🧱 → 0🪙/1🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → inget händelsevillkor uppfyllt

  🔨 Skog (Björnen) bygger standard "Skogsbruk"
     kostar 8🪙 6🧱 → kassa 10🪙/10🧱 → 2🪙/4🧱   (produktion 0🪙 +7🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada -12 → -15
     → inget händelsevillkor uppfyllt

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 14🪙/31🧱 → 14🪙/23🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -24 → -30
     → inget händelsevillkor uppfyllt

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 14🪙/23🧱 → 14🪙/15🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -30 → -36
     → inget händelsevillkor uppfyllt

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 14🪙/15🧱 → 14🪙/7🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -36 → -42
     → inget händelsevillkor uppfyllt

  📊 BOKSLUT år 2:
     passiv produktion: Åker 0🪙+20🧱 · Skog 0🪙+35🧱 · Tundra +63🪙0🧱 · Stad +21🪙0🧱
     årets samlade miljöpåverkan på ön: -1 öhälsa → ön 1 → 0
     ⤷ inga öhälsohändelser kvalificerade (ön varken ≥70, ≤35, ≤27 eller netto +15)

  (Partiet slutade år 2.)
```

**Att lägga märke till (byggtätt):**
- **Åkers 3:e gröna bygge** uppfyller *två* villkor på en gång → GRÖNA FONDEN + EXPANSION i rad (det
  "ett bygge = flera popups"-fall som rapporten beskriver). Rimligt, men två belöningsrutor för en handling.
- **Miljökriserna trappar korrekt:** Tundras byggen tar laget −6 → −12 (OLJEUTSLÄPP, −10) → −18 → −24
  (MARKEN RASAR, −20). Den stora −20-krisen drar 20🪙 från en kassa på 11 → kassan **töms** (clamp). Det är
  just den kontantsvaga situationen rapportens §3c flaggar.
- **9 händelser i år 1:s byggfas** (3 positiva + 6 negativa) = ~90 s popup-paus runt en ~100 s byggfas →
  presentationsproblemet, konkret.
- **Fördröjningen syns:** VÄRMEBÖLJA + STORM kvalificerades vid bokslut år 1 (ön föll till 1) men visas först
  ~30/60 s in i år 2 — öns "reaktion" kommer året efter, inte direkt.

---

## Exempel 2 · LUGNT parti (färre byggen, blandar grönt/smutsigt) — frö 1000, appetit `forsiktig`
*8 år spelade (ön lever hela spelet, slutar på öhälsa 6). Färre byggen/år, lagen blandar gröna och
miljöskadliga investeringar. Visar hur länge det dröjer innan händelser utlöses och hur de sprids.*

```
────────── ÅR 1 ──────────

  🔨 Åker (Oxen) bygger GRÖN "Ekologiskt jordbruk"
     kostar 14🪙 10🧱 → kassa 35🪙/35🧱 → 21🪙/25🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → inget händelsevillkor uppfyllt

  🔨 Åker (Oxen) bygger GRÖN "Ekologiskt jordbruk"
     kostar 14🪙 10🧱 → kassa 21🪙/25🧱 → 12🪙/20🧱   (produktion 0🪙 +5🧱/år)
     miljöpåverkan: grön (+3 öhälsa) · lagets ackumulerade skada 0 → 0
     → ★ FRAMTIDSVISIONÄR  (villkor: grön-svit ≥2 och laget ligger sist)
        konsekvens: Åker +5🪙 +5🧱

  🔨 Skog (Björnen) bygger SMUTSIG "Sågverk"
     kostar 8🪙 0🧱 → kassa 35🪙/35🧱 → 27🪙/35🧱   (produktion 0🪙 +9🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada 0 → -6
     → inget händelsevillkor uppfyllt

  🔨 Skog (Björnen) bygger SMUTSIG "Sågverk"
     kostar 8🪙 0🧱 → kassa 27🪙/35🧱 → 19🪙/25🧱   (produktion 0🪙 +9🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -6 → -12
     → ⚠ SKADEDJUR  (villkor: ackumulerad miljöskada -12 nådde tröskeln (−10))
        konsekvens: Skog  -10🧱 · öhälsa -4 → 46

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 35🪙/35🧱 → 35🪙/27🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada 0 → -6
     → inget händelsevillkor uppfyllt

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 35🪙/27🧱 → 25🪙/19🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -6 → -12
     → ⚠ OLJEUTSLÄPP  (villkor: ackumulerad miljöskada -12 nådde tröskeln (−10))
        konsekvens: Tundra -10🪙 · öhälsa -4 → 42

  🔨 Stad (Örnen) bygger standard "Kontor & hotell"
     kostar 6🪙 8🧱 → kassa 35🪙/35🧱 → 29🪙/27🧱   (produktion +7🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada 0 → -3
     → inget händelsevillkor uppfyllt

  🔨 Stad (Örnen) bygger standard "Kontor & hotell"
     kostar 6🪙 8🧱 → kassa 29🪙/27🧱 → 23🪙/19🧱   (produktion +7🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada -3 → -6
     → inget händelsevillkor uppfyllt

  📊 BOKSLUT år 1:
     passiv produktion: Åker 0🪙+10🧱 · Skog 0🪙+18🧱 · Tundra +18🪙0🧱 · Stad +14🪙0🧱
     årets samlade miljöpåverkan på ön: -24 öhälsa → ön 42 → 18
     ⤷ KVALIFICERADE öhälsohändelser (öhälsa 18): VÄRMEBÖLJA, STORM — visas ~30 s in i år 2

────────── ÅR 2 ──────────
  ⤷ Öns reaktion från förra året (fördröjda öhälsohändelser, ~30 s in i byggfasen):
     ⚡ VÄRMEBÖLJA — Åker  -3🧱, Skog  -3🧱, Tundra -3🪙, Stad -3🪙 (öhälsa oförändrad)
     ⚡ STORM — Åker  -5🧱, Skog  -5🧱, Tundra -5🪙, Stad -5🪙 (öhälsa oförändrad)

  🔨 Skog (Björnen) bygger standard "Skogsbruk"
     kostar 8🪙 6🧱 → kassa 19🪙/35🧱 → 11🪙/29🧱   (produktion 0🪙 +7🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada -12 → -15
     → inget händelsevillkor uppfyllt

  🔨 Tundra (Räven) bygger SMUTSIG "Oljeplattform"
     kostar 0🪙 8🧱 → kassa 35🪙/19🧱 → 35🪙/11🧱   (produktion +9🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-6 öhälsa) · lagets ackumulerade skada -12 → -18
     → inget händelsevillkor uppfyllt

  🔨 Stad (Örnen) bygger standard "Kontor & hotell"
     kostar 6🪙 8🧱 → kassa 29🪙/19🧱 → 23🪙/11🧱   (produktion +7🪙 0🧱/år)
     miljöpåverkan: miljöskadlig (-3 öhälsa) · lagets ackumulerade skada -6 → -9
     → inget händelsevillkor uppfyllt

  📊 BOKSLUT år 2:
     passiv produktion: Åker 0🪙+10🧱 · Skog 0🪙+25🧱 · Tundra +27🪙0🧱 · Stad +21🪙0🧱
     årets samlade miljöpåverkan på ön: -12 öhälsa → ön 18 → 6
     ⤷ inga öhälsohändelser kvalificerade (ön varken ≥70, ≤35, ≤27 eller netto +15)

────────── ÅR 3 ──────────

  📊 BOKSLUT år 3:
     passiv produktion: Åker 0🪙+10🧱 · Skog 0🪙+25🧱 · Tundra +27🪙0🧱 · Stad +21🪙0🧱
     årets samlade miljöpåverkan på ön: 0 öhälsa → ön 6 → 6
     ⤷ inga öhälsohändelser kvalificerade (ön varken ≥70, ≤35, ≤27 eller netto +15)

  … (år 4–8 utelämnade; kör verktyget för hela partiet.)
```

**Att lägga märke till (lugnt):**
- **Färre byggen (2 per lag år 1)** → bara 3 händelser i år 1 (FRAMTIDSVISIONÄR, SKADEDJUR, OLJEUTSLÄPP) i
  stället för 9. Byggfasen avbryts ~30 s totalt — nära det barnen sannolikt upplever.
- **Minor-krisen är proportionerlig här:** SKADEDJUR drar 10🧱 från en kassa på 35 (clamp 0) — en kännbar men
  rättvis smäll, inte en tömning. Majors (−20) fyrar aldrig i det här partiet (ingen hinner −20).
- **Händelsevillkoren tar tid att nå i lugnt spel:** GRÖNA FONDEN (3 gröna) och GEMENSAM SATSNING (alla fyra
  gröna samma år) utlöses **inte** här eftersom bara Åker bygger grönt — de kräver verkligt grönt samspel. Det
  är rimligt: belöningarna är inte gratis.
- **Fördröjningen sprider ut:** år 1 slutar på 18 → VÄRMEBÖLJA + STORM kvalificeras, men "öns reaktion" (−3/−5
  resurser) kommer först i år 2. Efter år 2 planar ön ut på 6 och trycket tar slut (engångsnatur) → **ingen
  skenande spiral**, bara en frontladdad år-1-dipp.

---

## Kort jämförelse
| | Byggtätt (1001) | Lugnt (1000) |
|---|---|---|
| Byggen år 1 | 14 | 7 |
| Händelser år 1 | 9 (3★ / 6⚠) | 3 (1★ / 2⚠) |
| Öhälsa efter år 1 | 31 → 1 | 42 → 18 |
| −20 MAJOR-kris | ja (tömde Tundra) | nej |
| Utgång | kollaps år 2 | lever alla 8 år (slutar 6) |

Protokollen bekräftar [MELLAN-HANDELSEBALANS.md](MELLAN-HANDELSEBALANS.md): varje enskild händelse är rimlig
i förhållande till vad lagen gjort; det som skaver är (a) **tätheten** i ett byggtungt år 1 och (b) **−20-krisen
mot en tom kassa**. Båda syns tydligt i det byggtäta partiet och är i stort sett borta i det lugna.
