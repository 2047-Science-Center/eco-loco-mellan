# Eco Loco (Mellan/Skola) — Bildprompts för de nya händelserna

*Underlag för att generera bilder via ChatGPT till de händelser som lagts till i
`spec/content/company-crises.js`, `spec/content/company-events.js`,
`spec/content/ohalsa-events.js` och `spec/content/gm-events.js` (2026-11-18). Skapat 2026-11-18.
Committas inte om du inte vill det — rent arbetsunderlag.*

Just nu visar `src/ui.js` (rad ~444) alla dessa 20 händelser med bara **två placeholderbilder**
(`assets/event_storm.png` för varning, `assets/event_gronafonden.png` för belöning). Det här
dokumentet ger en egen bild per händelse, enligt den namnkonvention koden redan förväntar sig:
**`assets/event_<id>.png`**.

---

## Stilen — "HÄNDELSEKORT" (en TREDJE, egen stilrad — blanda inte med låg-poly/fotoreal-ö)

De åtta ursprungliga händelsebilderna (`event_storm.png`, `event_uppror.png`, `event_gronafonden.png`
m.fl.) är **inte** i låg-poly-stilen (emblem/kröning) eller i den rena fotoreal-ö-stilen (trailer/slut).
De är en tredje, redan etablerad stil: **målad, illustrerad halv-realism** — ett slags nordiskt/
atlantiskt ö-samhälle, dämpad överskyad palett med EN varm ljusspricka, mänsklig skala (byggnader,
redskap, ibland människor), motivet visar händelsen KONKRET (en brinnande skog, ett brev som byter
hand) snarare än symboliskt. Döp den **Stilrad HÄNDELSEKORT** och återanvänd den för alla 20 bilderna
nedan, så känns hela händelsesystemet som en enhetlig uppsättning.

> **STATUS (2026-11-18): under omprövning.** Efter att ha sett 16 bilder i stilen nedan i spelet
> tyckte Klara att den var för fotorealistisk/filmisk — känns som ett foto/en film, inte som ett
> SPEL, och matchar inte känslan i kontrollrummet + de fasetterade djuremblemen. Ny riktning under
> test: **Stilrad SPELKONST** (se nedan, efter HÄNDELSEKORT) — målad spelkonst á la WoW/Blizzard-
> konceptkonst: grundad i verkligheten men tydligt ILLUSTRERAD, inte fotad. Flera testbilder godkända
> i den nya stilen (tundra_major, stad_minor) men iteration pågår (mer "spelifierad" känsla efterfrågad
> på stad_minor). **Inget beslut än om de 16 redan sparade HÄNDELSEKORT-bilderna ska göras om** —
> Klara valde "paus, vill se fler tester" när frågan kom upp. Använd SPELKONST för nya bilder tills
> vidare; HÄNDELSEKORT-raden nedan sparas som historik.

> **Stilrad HÄNDELSEKORT (EN) — ÄLDRE, används inte för nya bilder just nu:**
> *"Painted illustrated realism, digital gouache style (not photoreal, not low-poly 3D). A cold
> Nordic/North-Atlantic island community — weathered stone and wood buildings, fishing-harbour or
> farmland infrastructure, boreal forest and hills. Muted, desaturated overcast palette (slate-blue,
> grey, moss green, ochre) broken by ONE warm light source — sun breaking through cloud, a lit window,
> a lantern. Grounded, human-scale detail that shows the event concretely, not symbolically. Soft
> painterly brushwork, gentle atmospheric haze, film grain, soft vignette. Wide 16:9 landscape
> composition, horizon roughly centered. No text, no UI, no logos, no watermark."*

**Format:** generera i 16:9 (samma som de befintliga, 1672×941) — `object-fit:cover` i spelet beskär
sidorna något i den smalare rutan, så håll motivets viktigaste del centrerad.

**Röd/neutral ram:** `warn:true` ger automatiskt röd kortram i UI:t — bilden själv behöver inte vara
röd, men negativa händelser ska kännas *obehagliga/akuta* i motivet (rök, torka, mörker, kaos) och
positiva ska kännas *hoppfulla* (ljus, grönska, lättnad), precis som de befintliga bilderna redan gör.

---

## A. Företagskriser — `spec/content/company-crises.js` (8 st, alla `warn:true`)

Två kriser per lag/region, en mild ("minor") och en allvarlig ("major") version av samma motiv —
major ska kännas som en upptrappning av minor, inte en helt annan händelse.

> **Bekräftad regel (2026-11-18, efter test i ChatGPT):** minor och major behöver INTE vara exakt
> samma plats, bara samma landskapstyp/region och samma stilgrad. Det som faktiskt skiljer dem åt:
> - **minor = inzoomat med EN person** som upptäcker/undersöker ett tidigt tecken på nära håll.
>   Omgivningen runt personen ska fortfarande mest se frisk/hel ut — inte hela landskapet skadat.
> - **major = utzoomat landskap, oftast UTAN person** (eller person försvinnande liten) — hela
>   skadans omfattning är poängen, inte en persons reaktion på den.
>
> Detta matchar redan de återanvända bilderna (`torka`, `skogsbrand` är båda personlösa vidvinkel-
> landskap) och de två godkända minor-bilderna (`aker_minor`, `skog_minor` har båda en person i
> förgrunden med frisk omgivning runt). Tillämpa samma mönster på tundra och stad nedan.

### 1. `aker_minor` — VATTENBRIST → `assets/event_aker_minor.png` ✅ KLAR (sparad)
*"Åkrarna får för lite vatten!"* (material −10, öhälsa −4)

Slutgiltig bild: bred vy, manlig bonde liten i bild vid åkerkanten, gradvis (inte skarp) övergång
mellan vissnande och frisk majs ut mot bevattningsarmen i bakgrunden. Ingen sprucken jord.

### 2. `aker_major` — TORKA → `assets/event_aker_major.png`
*"Skördarna torkar bort!"* (material −20, öhälsa −8)

> ⚠ **Dubblett, ingen ny bild behövs:** gamla auto-händelsen `torka` (events.js) heter redan TORKA och
> har bilden `assets/event_torka.png` — torr spruckna åker, död majs, krympt sjö, väderkvarn. Den
> passar `aker_major` rakt av (den handlar bokstavligen om samma sak). **Återanvänd den filen direkt**
> i stället för att generera en ny. (Det påverkar `aker_minor` nedan — se omskriven prompt, nu samma
> gård/väderkvarn/sjö i ett tidigare, mildare skede, så de två känns som samma plats som förvärras.)

### 3. `skog_minor` — SKADEDJUR → `assets/event_skog_minor.png` ✅ KLAR (sparad)
*"Träden angrips av insekter!"* (material −10, öhälsa −4)

Slutgiltig bild: flera stora, kraftigt barkborre-skadade stammar i förgrunden med synliga skalbaggar
på barken, kvinnlig skogsarbetare stående längre bort och tittar upp mot skadan, vakttorn på åsen
i bakgrunden, skogen gradvis friskare längre bort.

### 4. `skog_major` — SKOGSBRAND → `assets/event_skog_major.png`
*"Skogen står i lågor!"* (material −20, öhälsa −8)

> ⚠ **Tematiskt dubblett:** gamla auto-händelsen `skogsbrand` (events.js) har redan en skogsbrand-bild
> (`assets/event_skogsbrand.png`, visad ovan i chatten). Du kan antingen återanvända den filen direkt
> för `skog_major` (kopiera filen, eller peka `bild` på samma fil i koden), eller generera en ny,
> tydligt KRAFTIGARE variant med denna prompt:
> [Stilrad HÄNDELSEKORT] A boreal pine forest hillside engulfed in a raging wildfire, tall orange
> flames tearing along the ridge, a massive dark-grey smoke column rising into a sickly amber sky. A
> wooden watchtower in near silhouette in the foreground, dwarfed by the blaze. More intense and
> closer than a distant fire — the heat and scale should feel immediate. No text, no UI.

### 5. `tundra_minor` — OLJEUTSLÄPP → `assets/event_tundra_minor.png`
*"Olja läcker ut på tundran!"* (pengar −10, öhälsa −4)
> [Stilrad HÄNDELSEKORT] Open tundra ground with a small, spreading black oil slick pooling around a
> cracked pipeline joint, a patch of moss and lichen already blackened and dying at its edge. A lone
> worker in overalls crouches nearby inspecting the leak with a flashlight. Flat grey tundra light,
> low distant oil-rig silhouettes on the horizon, one dim warm light from a worker's lantern. No text,
> no UI.

### 6. `tundra_major` — MARKEN RASAR → `assets/event_tundra_major.png` ✅ KLAR (sparad, HÄNDELSEKORT-stil) — nu testas ett alternativ nedan
*"Marken ger vika under oljefälten!"* (pengar −20, öhälsa −8)
> [Stilrad HÄNDELSEKORT] A tundra oil field where the ground has collapsed into a wide, dark sinkhole,
> swallowing part of a pipeline and the base of a drilling rig which now leans at a dangerous angle.
> Black oil pools in the crater's bottom. Flat grey overcast tundra light, distant rig silhouettes on
> the horizon — no people, just the scale of the failure. No text, no UI.

> ⚠ **Engångsexperiment (2026-11-18):** testade en ALTERNATIV låg-poly-variant av samma motiv, i stilen
> från emblemväggen/kröningsbilderna, för att se om den känns bättre. Övriga 15 nya händelsebilder
> (inkl. `tundra_minor`) ligger kvar i HÄNDELSEKORT-stilen ovan — detta är EN medveten stilavvikelse,
> inte ett systembyte. Om testet känns bra, bestäm separat om det ska bli standard för fler bilder.
> [Stilrad LÅG-POLY] Dark, cold, cinematic low-poly 3D render of a tundra oil field where the ground
> has catastrophically collapsed: faceted, stylized terrain split by a wide dark sinkhole, a drilling
> rig built from the same faceted bronze-metal geometry as the animal crests, leaning at a dangerous
> angle into the crater, a broken pipeline hanging over the edge. Near-black warm background
> (#121009), muted desaturated cold slate-blue and grey palette, a single warm gold accent (#C9A94F)
> glowing from cracks in the collapsed ground and rim-lighting the leaning rig. Retro control-panel
> atmosphere, subtle LED-like glow, film grain, soft vignette. No text, no logos, no UI.

### 7. `stad_minor` — ÖVERBELASTNING → `assets/event_stad_minor.png`
*"Staden växer för snabbt!"* (pengar −10, öhälsa −4)
> [Stilrad HÄNDELSEKORT] A crowded city street at dusk, sagging overloaded power lines strung between
> old stone buildings, a transformer box sparking faintly, traffic jammed bumper to bumper, people
> weaving between cars. Warm window lights contrast with a hazy grey-brown sky from congestion. A
> sense of a city straining at its own growth. No text, no UI.

### 8. `stad_major` — STRÖMAVBROTT → `assets/event_stad_major.png`
*"Hela staden slocknar!"* (pengar −20, öhälsa −8)
> [Stilrad HÄNDELSEKORT] A city skyline at night gone completely dark during a blackout — windows
> black, streetlights dead, only a few scattered emergency flashlight beams and candlelit windows
> glowing faintly warm against the cold dark silhouettes of buildings. A stalled tram or bus visible in
> the foreground street. Near-total darkness and stillness, more severe than mere congestion. No text,
> no UI.

---

## B. Företagshändelser (prestationsbaserade) — `spec/content/company-events.js` (4 nya)

Dessa triggas av ETT valfritt lag (vilket som helst) — håll bilderna **sektor-neutrala** (inte
låsta till ett specifikt lags terräng), så de fungerar oavsett vem som utlöser dem.

### 9. `expansion` — EXPANSION → `assets/event_expansion.png` ✅ KLAR (sparad)
*"Företaget växer så det knakar!"* (huvudresurs +5, positiv)

Slutgiltig bild: hamn-/industriplan med kran, stålstomme under uppbyggnad, flera arbetare i rörelse,
stora högar virke/material. Energisk, neutral ton (varken grön eller smutsig).

### 10. `gronomstallning` — GRÖN OMSTÄLLNING → `assets/event_gronomstallning.png` ✅ KLAR (sparad)
*"Företaget byter kurs och satsar på miljön!"* (pengar +5, positiv)

> **Viktigt (efter feedback):** INTE en övergiven/förfallen gammal fabrik + ett nytt samhälle bakom —
> det signalerar fel sak (att den gamla verksamheten lagts ned). I Eco Loco fortsätter företagen
> använda sina gamla byggnader (de ger fortfarande pengar/material, trots miljöpåverkan) — grönt
> bygge KOMPLETTERAR verksamheten, ersätter den inte. Visa aktiv gammal verksamhet OCH nya gröna
> investeringar sida vid sida, samtidigt i drift. Inte sektor-specifik (ska funka oavsett vilket av
> de fyra företagen som triggar den) — ett brett, blandat verksamhetslandskap utan att något enskilt
> område dominerar.
> [Stilrad HÄNDELSEKORT] A wide view of a mixed economic landscape, mid-transition but still fully
> active: an industrial plant with smoke still rising from its stacks, clearly still operating, now
> fitted with new solar panels along one roofline; a smaller working farmland patch nearby; a cluster
> of wind turbines on a ridge in the middle distance; a town visible further back. Nothing is
> abandoned or decayed — everything shown is in active use, old and new production running side by
> side at the same time, no clear before/after split. Warm, calm daylight suggesting an economy
> changing while it keeps working, not a finished green utopia. No text, no UI, no logos.

### 11. `framtidsvisionar` — FRAMTIDSVISIONÄR → `assets/event_framtidsvisionar.png` ✅ KLAR (sparad)
*"Trots motgångar satsar företaget på öns framtid!"* (pengar +5, material +5, positiv)

**Viktigt (efter iteration):** det här laget har liten ekonomi men stort klimatfokus — litet, intimt,
men FÄRDIGT och fungerande, inte "precis påbörjat". Byggnaden medvetet neutral (varken bondgård,
skogskoja eller stadshus) så bilden funkar oavsett vilket av de fyra "gröna verksamhetstyperna"
(ekogård/vindkraft/hållbart skogsbruk/stadskvarter) som triggar den. Slutgiltig bild: liten vindturbin
+ solpaneler på en enkel sliten byggnad, redan planterade (inte krukade) unga träd, en strömmätare
som visar aktiv drift, ett par personer i bakgrunden med vardagssysslor.

### 12. `gemensamsatsning` — GEMENSAM SATSNING → `assets/event_gemensamsatsning.png` ✅ KLAR (sparad)
*"För en gångs skull drar alla företag åt samma håll!"* (alla fyra lag, huvudresurs +5, positiv)

Slutgiltig bild: brett filmiskt flygperspektiv över hela ön i ett sammanhängande landskap — jordbruk
med växthus, frisk skog med återplantering, tundra med olja+vindkraft sida vid sida, modern stad med
gröna tak/solpaneler/kollektivtrafik. Ön har fortfarande industri och ekonomisk aktivitet — omställd,
inte nedlagd. Varmt men realistiskt ljus, en vändpunkt snarare än ett färdigt utopi.

---

## C. Öhälsohändelser — `spec/content/ohalsa-events.js` (4 nya, `storm` återanvänder befintlig bild)

### 13. `naturenblomstrar` — NATUREN BLOMSTRAR → `assets/event_naturenblomstrar.png` ✅ KLAR (sparad)
*"Öns ekosystem frodas!"* (huvudresurs +5, positiv, öhälsa ≥70)

> **Justerad:** behåll naturen/djurlivet som huvudmotiv i förgrunden, men lägg till synliga tecken på
> att människornas gröna omställning också lyckats, synligt längre bort — en grön stad, vindkraft,
> en ekogård — så bilden knyter ihop öns hälsa med de fyra företagens arbete.
> [Stilrad HÄNDELSEKORT] A lush, thriving stretch of the island in the foreground — tall healthy pine
> forest meeting a clear turquoise fjord, wildflowers and dense green undergrowth, a deer and a fox at
> the treeline, seabirds overhead, clean clear water. In the distance across the water, small but
> visible signs of a thriving human island: a cluster of wind turbines on a far ridge, a compact green
> city skyline with rooftop solar, patchwork green farmland. Vibrant, warm golden sunlight pouring
> through the canopy. A feeling of abundance and health, nature and people both flourishing together.
> No text, no UI.

### 14. `miljolyft` — MILJÖLYFT → `assets/event_miljolyft.png` ✅ KLAR (sparad)
*"Öns miljö har förbättrats rekordmycket! Framtiden ser ljus ut!"* (huvudresurs +3, positiv)
> [Stilrad HÄNDELSEKORT] A restoration scene in progress: a few workers and volunteers planting rows of
> young saplings and clearing debris along a riverbank that still shows faint old scars (a stained
> high-water mark, a rusted pipe end) but is now visibly recovering — fresh green shoots pushing through.
> Hopeful work-in-progress mood, not yet fully healed but clearly turning a corner. Warm light breaking
> through parting clouds. No text, no UI.

### 15. `varmebolja` — VÄRMEBÖLJA → `assets/event_varmebolja.png`
*"Extremvärme drabbar ön!"* (huvudresurs −3, negativ, öhälsa ≤35)
> [Stilrad HÄNDELSEKORT] A heatwave scene: a dried-up riverbed with cracked mud, wilted roadside grass,
> visible heat-shimmer distorting the horizon, livestock or a dog resting flat in whatever shade a
> single tree offers, a farmer wiping their brow. Harsh bleached-white sky, no clouds, oppressive bright
> light rather than the usual overcast — a deliberate contrast to the cold grey of the other cards. No
> text, no UI.

### 16. `resursbrist` — RESURSBRIST → `assets/event_resursbrist.png`
*"Öns naturresurser sinar! Produktionen minskar."* (ingen direkt resurseffekt, negativ, bara Skola)
> [Stilrad HÄNDELSEKORT] The interior of a large wooden warehouse or storage depot, mostly empty — a
> handful of crates and sacks scattered across a vast bare floor where full shelving once stood, a
> worker standing with an empty clipboard looking at the near-bare shelves, a closed hatch where
> deliveries used to arrive. Dim, cool interior light with one shaft of grey daylight through a high
> window. A quiet sense of depletion rather than disaster. No text, no UI.

---

## D. GM-direkthändelser — `spec/content/gm-events.js` (4 nya, spelledarstyrda)

### 17. `gm_marknadskrasch` — MARKNADSKRASCH → `assets/event_gm_marknadskrasch.png`
*"Börsen rasar! Tundran och Staden förlorar pengar!"* (pengar −10, Tundra+Stad, negativ)

> ⚠ **Tematisk dubblett:** gamla auto-händelsen `marknadskrasch` (events.js) finns redan som
> `assets/event_marknadskrasch.png`. Om den bilden redan funkar bra kan du återanvända den direkt för
> `gm_marknadskrasch` i stället för att generera en ny. Annars:
> [Stilrad HÄNDELSEKORT] A small, old-fashioned trading-floor or bank office interior, a few clerks in
> shirtsleeves staring in dismay at a wall-mounted ticker board or stacks of falling paper ledgers,
> scattered dropped papers on the floor, a single desk lamp casting the only warm light in an otherwise
> cold, dim room. A sense of sudden collective bad news. No text, no UI.

### 18. `gm_leveransstopp` — LEVERANSSTOPP → `assets/event_gm_leveransstopp.png`
*"Leveranserna har fastnat! Hela ön får materialbrist!"* (material −5, alla, negativ)
> [Stilrad HÄNDELSEKORT] A small island harbour at a standstill: a cargo ship sits idle at the dock,
> its crane unmoving, stacked shipping containers and pallets piled up along the quay with nowhere to
> go, a dockworker leaning against a post checking a clipboard with nothing to do. Grey overcast light,
> still water, a sense of everything backed up and waiting. No text, no UI.

### 19. `gm_braskord` — BRA SKÖRD → `assets/event_gm_braskord.png`
*"Oxens skördar slår alla rekord! De delar generöst med sig till hela ön!"* (material +8, alla, positiv)

> ⚠ **Dubblett, ingen ny bild behövs:** gamla auto-händelsen `godskord` (events.js) är konceptuellt
> redan ersatt av BRA SKÖRD (se att-göra-listan) och har bilden `assets/event_godskord.png` — gyllene
> skörd, skördearbetare, fiskeläge i bakgrunden, överflöd. Passar rakt av. **Återanvänd den filen**
> i stället för att generera en ny.

### 20. `gm_ekonomisktstod` — EKONOMISKT STÖD → `assets/event_gm_ekonomisktstod.png`
*"Centralmakten ger ekonomiskt stöd till öns mest utsatta företag!"* (pengar+material +10, fattigast, positiv)
> [Stilrad HÄNDELSEKORT] A formally dressed official's hand holding out a sealed envelope with an
> official wax stamp toward a visibly weathered, modest worker (patched work jacket, tired but
> grateful expression) outside a small struggling workshop or farmhouse. Similar composition to the
> existing GRÖNA FONDEN image (an envelope changing hands) but framed as official state support rather
> than a reward — slightly more formal, less celebratory, more "a helping hand." Warm light on the
> envelope and the worker's face. No text, no UI.

---

## Sammanfattning — vad som redan finns vs. vad som är nytt

| Kategori | Nya bilder att generera | Återanvänder befintlig bild |
|---|---|---|
| Företagskriser (8) | aker_minor (ny, men matchad mot torka-bilden), skog_minor, tundra_minor, tundra_major, stad_minor, stad_major | `aker_major` ← `event_torka.png`, `skog_major` ← `event_skogsbrand.png` |
| Företagshändelser (4 nya) | expansion, gronomstallning, framtidsvisionar, gemensamsatsning | `gronafonden`, `uppror` (finns redan) |
| Öhälsohändelser (4 nya) | naturenblomstrar, miljolyft, varmebolja, resursbrist | `storm` (finns redan) |
| GM-händelser (4) | leveransstopp, ekonomisktstod | `gm_marknadskrasch` ← `event_marknadskrasch.png`, `gm_braskord` ← `event_godskord.png` |

**16 nya bilder att generera** (inte 20) — fyra händelser återanvänder befintlig konst rakt av. När bilderna är genererade: spara dem som `assets/event_<id>.png` (exakt
samma mönster som de befintliga), så plockar `src/ui.js` upp dem automatiskt (rad ~1192 bygger redan
`assets/event_${ev.id}.png` när `ev.bild` saknas — man behöver bara koppla `companyEvent`/`ohalsaEvent`/
`gmEvent`-visningen till samma mönster i stället för de två hårdkodade placeholder-raderna på rad 444).
