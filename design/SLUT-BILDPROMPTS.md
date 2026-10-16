# Eco Loco (Mellan) — Bildprompts för AVSLUTNINGEN (slutdel version A)

*Underlag för Josef att generera bilder via ChatGPT. Grundat i `spec/slutdel.js` (de exakta stegen), `spel.html` (kort-format + färg-tokens) och designdokumenten (`SPELINFO.md`, `design/GAME-DESIGN.md`, `design/CORE-PRINCIPLES-OVERLAMNING-KLARA.md`). Skapat 2026-10-16. Committas inte.*

Slutdelen (version A) som servern bygger ur `slutdel.js`: **podium q1–q6** (reflektionsfrågor, inga rätta svar) följt av **Newfoundland nf1 → nf2 → nf3**. Varje podiefråga och nf1/nf2 har ett `bild`-fält (`assets/slutdel/<id>.png`) som visas i rutan. **nf3 är `typ:'regi'` — ren spelledartext i en guldstreckad ruta, ingen bild** (ingen prompt behövs, se längst ned).

---

## Gemensam ton & stil (klistra in överst i varje prompt)

Spelets värld: mörk, kall, guld-accentuerad — samma som dashboarden (bakgrund nästan svart varmsvart `#121009`, ett enda guldskimmer `#C9A94F` som accent, dämpad/avmättad palett, retro kontrollpanel-estetik med LED-glöd). En **sibirisk ö-känsla**: karg, vidsträckt, kall tundra/kust, lågt grått ljus, långa skuggor. Visuellt språk hämtat ur spelets egna assets: **stiliserad låg-poly / fasetterad geometri** (samma som den AI-genererade låg-poly-ö-kartan och de fasetterade djur-badgarna), filmiskt lågdagerljus, kalla blå-grå toner med en varm guld-kantbelysning.

> **Stilrad att återanvända (EN):**
> *"Dark, cold, cinematic low-poly 3D render. Faceted stylized geometry, near-black warm background (#121009), muted desaturated palette of cold slate-blue and grey, a single warm gold accent (#C9A94F) as rim light / glow. Siberian island mood: barren tundra coast, low grey overcast light, long shadows. Retro control-panel atmosphere, subtle LED glow, film grain, soft vignette. No text, no logos, no UI."*

**För Newfoundland-delen (nf1/nf2):** byt låg-poly mot **dokumentär/verklig fotokänsla** (riktiga torskbåtar, hav, kaj) MEN färggradad in i exakt samma kalla palett + guldaccent, så den hänger ihop med resten.

> **Stilrad Newfoundland (EN):**
> *"Documentary photographic realism, cold North-Atlantic grade: desaturated slate-blue and grey, muted warm gold accent (#C9A94F) in the light, overcast low light, film grain, soft vignette. Cohesive with a dark, cold game world. No text, no logos."*

### Bildformat (gäller ALLA prompterna) — matcha kortet i spelet
Bilden visas som en **bred banner** överst i slutdels-kortet: `.sd-img` är 100 % bred (ruta ≈ 1120 px) med `max-height: 360px` och `object-fit: cover`, 4 px kant i `--edge2` (`#5C5547`), rundade hörn 18 px.
→ **Generera i brett liggande format ≈ 3:1** (t.ex. 1536×512). Om ChatGPT bara ger 16:9: **håll motivet vertikalt centrerat** och lägg inget viktigt högst upp eller längst ned — rutan beskär till ett brett mittband (~360 px högt). Horisont ungefär i mitten.

---

## PODIUM — q1–q6 (reflektion, inga rätta svar)

Podiet handlar om **eftertanke** (öns utfall + ansvar + vad det liknar), inte om fakta. Håll bilderna **atmosfäriska och mångtydiga** — de ska bära en känsla, inte illustrera ett "rätt" svar (frågan och svarsknapparna står ovanpå/under bilden). Alla sex ligger i samma ö-värld.

### q1 — `assets/slutdel/q1.png`  ← "Hur gick det" (öns utfall) — HUVUDBILDEN
Fråga: *"Hur gick det egentligen för ön under ert styre?"* (Blomstrande / Vi klarade oss / Vi tänjde på gränsen / Fråga inte)

Eftersom svaren spänner från blomstring till kollaps ska bilden **rymma hela spektrat i ETT motiv** — en ö sedd på håll som är kluven: blomstrande på ena sidan, kollapsad på den andra.

**Prompt (EN):**
> `[Stilrad]` A single low-poly island seen from a slight aerial angle, centered, filling a wide banner. The island is split in mood across its length: one half lush and alive — faceted green forests, clear water, faint gold sunlight and a few birds; the other half barren and collapsed — grey smog haze, dead stylized trees, cracked dark ground, a sickly tint. A soft gradient blends the two halves in the middle so neither "wins". Cold overcast sky, low grey light, long shadows, a single warm gold glow on the healthy side. Faceted stylized geometry, muted cold palette, near-black background, film grain, soft vignette. Wide 3:1 banner, horizon centered. No text, no UI.

### q2 — `assets/slutdel/q2.png`  — Ansvar
Fråga: *"Vem bär ansvaret för hur ön mår nu?"* (Vårt lag / De andra lagen / Centralmakten / Reglerna / Ingen)

**Prompt (EN):**
> `[Stilrad]` Four small low-poly territories around one shared low-poly island — a yellow farmland corner (bison mood), a green forest corner (bear), an orange tundra corner (wolf), a grey city corner (eagle) — each slightly turned away from the others, long shadows pointing inward toward the island's center where a single faint gold light pools on empty ground. A sense of shared, unclaimed responsibility: no one figure, four silent territories. Cold overcast light, faceted geometry, muted palette, near-black background, film grain, vignette. Wide 3:1 banner, centered composition. No text, no UI.

### q3 — `assets/slutdel/q3.png`  — Motståndare eller grannar?
Fråga: *"De andra lagen — var de motståndare eller grannar?"* (Motståndare / Grannar / Det växlade / Fattade aldrig)

**Prompt (EN):**
> `[Stilrad]` Two neighbouring low-poly territories separated by a narrow channel of cold water, seen head-on across the banner. A single faceted bridge of gold light arcs between them but is half-formed / unfinished — ambiguous whether it is being built or has broken. Both shores identical in form, mirrored, equal weight left and right. Cold grey overcast, long shadows, one warm gold accent on the bridge. Faceted stylized geometry, muted palette, near-black background, film grain, vignette. Wide 3:1 banner, water horizon centered. No text, no UI.

### q4 — `assets/slutdel/q4.png`  — Vad styrde ert ja/nej?
Fråga: *"När erbjudandet kom — vad styrde ert ja eller nej?"* (Vad som gynnade oss / Vad som var bäst för ön / Vad de andra skulle göra / Magkänsla)

**Prompt (EN):**
> `[Stilrad]` A single faceted crossroads / fork on barren tundra ground, seen from a low angle, two low-poly paths diverging into cold mist — one path lit by a warm private gold glow leading to a small pile of faceted coins and bricks, the other path cooler and dimmer leading toward the healthy green of the shared island. A lone long shadow stands at the fork, undecided. Cold overcast, muted palette, near-black background, film grain, vignette. Wide 3:1 banner, the fork centered. No text, no UI.

### q5 — `assets/slutdel/q5.png`  — Gick det att vinna utan att ön fick betala?
Fråga: *"Gick det ens att vinna utan att ön fick betala?"* (Ja, vi missade det / Nej, reglerna tillät inte / Kanske, med mer tid / Vi brydde oss inte om att vinna)

**Prompt (EN):**
> `[Stilrad]` A faceted old-style balance scale standing on cold tundra, filling the banner's center. On one pan a glowing gold heap of coins and bricks (private wealth); on the other pan a small fragile low-poly island with a single green tree. The scale tips heavily toward the gold, the little island lifted high and vulnerable. One warm gold rim light, everything else cold grey overcast. Faceted stylized geometry, muted palette, near-black background, film grain, vignette. Wide 3:1 banner, scale centered. No text, no UI.

### q6 — `assets/slutdel/q6.png`  — Vad liknar det här mest?
Fråga: *"Vad liknar det här mest?"* (Internationell politik / Näringslivet / Skolans grupparbete / Nej, bara ett spel)

**Prompt (EN):**
> `[Stilrad]` A wide low-poly conference / round table on the barren island, four empty faceted chairs around it facing inward, one small shared low-poly globe-island glowing faintly gold at the table's center. Long cold shadows, overcast grey light, a quiet after-the-meeting emptiness that could be a summit, a boardroom or a classroom group. Faceted stylized geometry, muted palette, near-black background, film grain, vignette. Wide 3:1 banner, table centered. No text, no UI.

---

## NEWFOUNDLAND — nf1 / nf2 (dokumentär, samma kalla gradering)

Det verkliga exemplet: torskfisket utanför Newfoundland som blomstrade, överfiskades och **kollapsade 1992** — och inte kommit tillbaka. Allmänningarnas tragedi i verkligheten. Byt till **dokumentär fotokänsla** men samma kalla palett + guldaccent.

### nf1 — `assets/slutdel/newfoundland.png`  — Blomstringen / "ingen ville sluta först"
Text på kortet: *"Nordatlanten, för inte så länge sedan. En ö levde på torsken. Varje båt fiskade så mycket den kunde — klokt, för sin egen familj. Ingen ville vara den som slutade först."*

**Prompt (EN):**
> `[Stilrad Newfoundland]` A busy North-Atlantic cod-fishing harbour in its heyday, overcast morning. Many small wooden fishing boats crowded together, decks and docks piled high with glistening cod, fishermen hauling full nets, gulls wheeling overhead. A sense of abundance and quiet competition — every boat taking as much as it can. Cold slate-blue and grey sea, muted warm gold light breaking faintly through the clouds onto the catch. Desaturated documentary realism, film grain, soft vignette. Wide 3:1 banner, horizon centered. No text, no logos.

### nf2 — (reuse `newfoundland.png` eller spara som t.ex. `newfoundland-kollaps.png`) — Kollapsen / tomma hav
Text på kortet: *"En säsong var fisken borta. Tiotusentals jobb med den. Trettio år senare har den inte kommit tillbaka."*

> **Obs:** nf2 pekar idag på **samma** `assets/slutdel/newfoundland.png` som nf1. Vill du ha en egen kollaps-bild för nf2: generera denna, spara under ett nytt namn och ändra `bild` på nf2 i `slutdel.js`. Annars räcker nf1-bilden för båda.

**Prompt (EN):**
> `[Stilrad Newfoundland]` The same North-Atlantic harbour decades later, abandoned. Empty grey sea, flat and lifeless, no fish, no gulls. A few derelict wooden fishing boats rotting against a weathered dock, peeling paint, slack frayed nets, an empty rusted fish-processing shed. Still, silent, deserted. Cold slate-blue and grey, a single thin shaft of muted gold light on the empty water — beautiful and bleak. Desaturated documentary realism, film grain, soft vignette. Wide 3:1 banner, horizon centered. No text, no logos.

### nf3 — INGEN BILD (regi-text)
nf3 är `typ:'regi'`: spelledartexten *"Varenda båt hade rätt. Tillsammans hade de fel. — Känns det igen?"* visas som en **guldstreckad ruta** (`.sd-regi`), inte som bild. **Ingen prompt behövs.**
