# EcoLoco — Bildprompts v2, Cinematic Tactile Realism (alla 24 händelsebilder)

*Skrivet 2026-11-19. Följer `design/HANDELSE-VISUELL-STILGUIDE.md` (v1.0). Ersätter INTE
`design/HANDELSE-BILDPROMPTS.md` (den filen ligger kvar oförändrad för jämförelse/historik) —
det här är en parallell, ny uppsättning prompts i den nya stilen. Inget genererat än.*

**Hur du använder det här dokumentet:** för varje händelse, klistra in i ordning:
1. **MASTER STYLE** (stilguiden §5) — samma text varje gång, oförändrad.
2. **Subject** — motivbeskrivningen nedan, specifik per händelse.
3. **NEGATIVE PROMPT** (stilguiden §6) — samma text varje gång, oförändrad.

Innehåll/speleffekt (pengar/material/öhälsa) är OFÖRÄNDRAT från `spec/content/*.js` — bara
bildspråket är nytt. Alla 24 är listade som EN rad per unik bildfil (flera händelser delar ibland
samma fil, se "delas med" nedan — exakt samma gruppering som i `HANDELSE-BILDPROMPTS.md`).

**Allmän anmärkning:** samtliga 24, inklusive de 8 som redan har bilder sedan tidigare (storm,
skogsbrand, uppror, torka, godskord, sponsrat, gronafonden, marknadskrasch) och de 12 som gjordes
i den här sessionens tidigare stilar (HÄNDELSEKORT/SPELKONST), behöver nya bilder — ingen av de
nuvarande stilarna är identisk med Cinematic Tactile Realism, så "redan godkänd" betyder bara
"motivet/kompositionen är beprövad", inte "bilden kan återanvändas rakt av" (med ett undantag, se
#7 nedan).

---

## De 8 ursprungliga (fanns innan den här sessionen)

### 1. `storm` → `assets/event_storm.png`
*Höststormen är här. sektorPengar, pengar −12, öhälsa −5.*
**Subject:** A powerful autumn storm battering a small Nordic coastal village at dusk. Heavy rain
driven by wind, dark churning clouds with a thin gold crack of light at the horizon, waves
crashing hard against a stone pier where an old dockside crane stands. A row of weathered stone
cottages braces against the wind, one window glowing warm against the cold storm light. The raw,
immediate threat of the coast is the focus.

### 2. `skogsbrand` → `assets/event_skogsbrand.png` *(delas med `skog_major`)*
*Det brinner i Björnens skogar. område:skog, material −15, öhälsa −8.*
**Subject:** A boreal pine forest hillside engulfed in wildfire, seen from a slightly elevated
distance. Tall flames moving along the ridge, a large smoke column rising into a hazy amber sky, a
wooden fire-watch tower in silhouette in the foreground, dwarfed by the blaze. The scale of the
fire across the whole hillside is the focus — no people needed.

### 3. `uppror` → `assets/event_uppror.png`
*Folket har fått nog. rikaste, pengar −15, material −10, öhälsa −3.*

> ⚠ **Behöver mest justering av de åtta:** den befintliga bilden har läsbara engelska protestplakat
> ("OUR ISLAND OUR HOME") och en anime-liknande stil — bryter mot BÅDE no-text-regeln och den nya
> stilen. Full omgörning rekommenderas, inte bara en stiljustering.

**Subject:** A determined but orderly crowd of real, individually-rendered islanders — weathered
work clothing, a range of ages — marching down a modest street toward a plain municipal building.
A few carry simple hand-painted signs showing only color and shape, no readable text. Overcast
daylight, a sense of collective frustration rather than violence or chaos.

### 4. `torka` → `assets/event_torka.png` *(delas med `aker_major`)*
*Torkan slår till. sektorMaterial, material −12, öhälsa −4.*

> Bedöm om den befintliga bilden redan kommer nära målet (den är redan ganska verklighetstrogen,
> vidvinkel, personlös) — annars, ny version:

> **Viktigt (efter feedback 2026-11-19):** major fick samma komposition/vinkel som minor (bara
> andra byggnader), vilket kändes som "samma plats, bytt kuliss". Kräv explicit en ANNAN vinkel/
> vantagepunkt på landskapet — inte samma gård-i-vänsterkant-fält-i-mitten-uppbyggnad.

**Subject:** A farmland landscape in advanced drought, seen from a DIFFERENT vantage point and
angle than the mild version of this event — not the same farmhouse-left/field-center composition.
A wide, slightly elevated view looking across the valley from a different direction. Deeply dry,
visibly cracked soil stretching toward the horizon, rows of corn collapsed and brown, a stone
farmhouse and an idle windmill pump beside a lake that has clearly receded, leaving a wide dry
margin at its old shoreline. The scale of the dryness across the whole farm is the focus; a tiny
distant figure may be present but is not the subject. Same region and climate as the mild version,
clearly a different spot within it.

### 5. `godskord` → `assets/event_godskord.png` *(delas med `gm_braskord`)*
*Ett ovanligt gott år. alla, +8 egen valuta, öhälsa +2.*

> Bedöm om den befintliga bilden redan kommer nära målet (redan ganska verklighetstrogen) — annars,
> ny version:

**Subject:** A golden harvest on a Nordic coastal farmland hillside — real, individually-rendered
workers gathering wheat into stooks across a wide field, a small fishing harbour with a few boats
visible at the shoreline below, warm late-summer evening light. A sense of broad, shared abundance
across a whole community, not just one farm.

### 6. `sponsrat` → `assets/event_sponsrat.png` *(ingen bild genererad än)*
*Ett erbjudande ni knappast kan tacka nej till. Röstningshändelse: pengarTillJa 15, öhälsa −6.*
**Subject:** A formally dressed corporate representative extending a signed contract and a small
case of money toward a hesitant local island official outside a modest town hall. A faint
industrial silhouette looms on the horizon behind the representative, hinting at future
development. Neutral, tense daylight — a difficult choice not yet made, not a celebration or a
disaster either way.

### 7. `gronafonden` → `assets/event_gronafonden.png` *(delas med företagshändelsen `gronafonden`)*

> ✅ **Undantag — kan troligen användas direkt:** referensbilden `design/referensbilder/
> gronafonden-fotoref.png` ÄR i praktiken redan den nya målbilden (den är referensen hela den nya
> stilen byggdes kring). Om du är nöjd med den kan den sparas rakt av som `assets/
> event_gronafonden.png` i stället för att genereras om — annars, samma motiv, ny generering:

**Subject:** An elderly, weathered local farmer receiving a sealed envelope and a handful of
banknotes from an official hand extended from off-frame, in front of his small farmstead —
vegetable garden, stone walls, a few grazing sheep, a calm fjord and a single wind turbine on a
distant ridge. Warm, soft daylight, a quiet, dignified, hopeful moment.

### 8. `marknadskrasch` → `assets/event_marknadskrasch.png` *(delas med `gm_marknadskrasch`)*
*Marknaden kollapsar. sektorPengar, pengar −15.*
**Subject:** A small, old-fashioned bank or trading office interior — a few real, individually-
rendered clerks in shirtsleeves staring at a wall-mounted ticker board showing falling numbers,
scattered papers on the floor, a single desk lamp the only warm light in an otherwise cool, dim
room. Quiet, real bad news, not theatrical panic.

---

## Företagskriser (8, minor/major-par) — samma minor/major-princip som tidigare: **minor = nära
håll med en person som upptäcker ett tidigt tecken, omgivning mestadels frisk · major = vidvinkel,
oftast utan person, hela skadans omfattning är poängen.**

### 9. `aker_minor` → `assets/event_aker_minor.png`
*Vattenbrist. material −10, öhälsa −4.*
**Subject:** A wide farmland field at golden hour, an irrigation pivot arm in the middle distance.
A real, weathered farmer, small in frame, crouches at the field's edge checking the dry topsoil.
The dryness fades in gradually — some corn rows drooping and yellow mixed unevenly with still-
green stalks, no hard line anywhere. Soil dry but not cracked.

### 10. `aker_major` = `torka` (#4 ovan)

### 11. `skog_minor` → `assets/event_skog_minor.png`
*Skadedjur. material −10, öhälsa −4.*
**Subject:** A boreal pine forest, close foreground on several large tree trunks with severe,
real-looking bark-beetle damage — wide patches of bark stripped away revealing tunnelling
galleries, a few actual beetles visible on the bark. A real, individually-rendered female
forestry worker stands further back, looking up at the damage. A wooden watchtower on the distant
ridge, forest fading gradually to healthy green further back.

### 12. `skog_major` = `skogsbrand` (#2 ovan)

### 13. `tundra_minor` → `assets/event_tundra_minor.png`
*Oljeutsläpp. pengar −10, öhälsa −4.*
**Subject:** A wide, slightly elevated view over a northern tundra oil field. A ruptured pipeline
has released a large black oil slick spread extensively across the landscape — flowing between
rocks, soaking through patches of tundra moss, pooling into a stream in the mid-distance. Oil rigs
and pipeline infrastructure still standing and operating further back. A lone worker, small in
frame, inspects the ruptured pipe — a secondary detail. Flat grey overcast northern light.

### 14. `tundra_major` → `assets/event_tundra_major.png`
*Marken rasar. pengar −20, öhälsa −8.*

> **Justerad (efter feedback 2026-11-19):** mörkare, dimmigare, senare-på-kvällen-känsla efterfrågad
> (som den äldre HÄNDELSEKORT-versionen av tundra_major) i stället för ljust mulet dagsljus.

**Subject:** A wide, elevated view over a northern tundra oil field at dusk/evening, where the
ground has catastrophically failed: broad fissures and a sunken depression across the terrain,
part of a drilling platform sunk and tilting at a dangerous angle, steam or dust rising from the
crack, a section of broken pipeline hanging over the edge. Dark, heavy evening sky, thick mist
hanging low over the terrain, distant rig lights glowing faintly through the haze. The ground
failure itself is the focus. No close-up people; at most a tiny distant figure for scale.

### 15. `stad_minor` → `assets/event_stad_minor.png`

> ✅ **Kan troligen användas direkt:** referensbilden `design/referensbilder/
> stad_minor-fotoref.png` ÄR i praktiken redan målbilden för den här händelsen.

*Överbelastning. pengar −10, öhälsa −4.*
**Subject:** A dense northern city street at a rainy dusk, straining under rapid growth. Real,
individually-rendered commuters crowd onto an overcrowded tram and wait at a packed stop, a long
traffic jam of cars with glowing tail-lights stretches down the wet street. Construction cranes
rise over half-finished apartment blocks against a cool, cloudy evening sky — NOT a strong orange
sunset. The city feels overfull and pressed to its limit, but still running.

### 16. `stad_major` → `assets/event_stad_major.png`
*Strömavbrott. pengar −20, öhälsa −8.*

> **Justerad (efter feedback 2026-11-19):** första försöket gav en pittoresk gammal europeisk
> småstad med kyrktorn — fel karaktär. Staden som drabbas hårdast av det här är den som byggt
> mycket betong/handelsområden (standard-/smutsigt byggande), inte en vacker gammal stadskärna.
> Skylinen ska domineras av nyktra betong-/kontors-/handelsbyggnader, men ändå kännas som SAMMA
> stad som i `stad_minor` (spårvagn, byggkranar) — inte en helt annan plats.

**Subject:** An elevated view over a large northern city at night during a total blackout. The
skyline is dominated by utilitarian concrete apartment blocks, office buildings and commercial
retail structures — functional, somewhat bleak architecture, not a quaint old town with spires —
while still recognizably the same city as the tram/traffic scene (similar tram lines, similar
construction cranes visible in daylight elsewhere). Nearly the entire skyline is dark — windows
black, streetlights dead, signs gone out. Scattered real points of light break the darkness: a
few car headlights on a street far below, one or two candlelit windows, a distant handheld
flashlight beam. Quiet, sudden, uncertain — not an explosion, just a city that has gone dark.

---

## Företagshändelser (4, sektor-neutrala — funkar oavsett vilket av de fyra lagen som triggar dem)

### 17. `expansion` → `assets/event_expansion.png`
*Expansion. huvudresurs +5, positiv.*
**Subject:** A bustling harbour-industrial construction site — fresh scaffolding on a half-
finished steel-framed warehouse, stacked timber and crates, a small crane swinging a beam into
place, several real workers in motion hauling materials. Energetic, neutral tone (neither green
nor polluting), warm late-afternoon light.

### 18. `gronomstallning` → `assets/event_gronomstallning.png`
*Grön omställning. pengar +5, positiv.*
**Subject:** A wide view of a mixed economic landscape, mid-transition but still fully active: an
industrial plant with smoke still rising from its stacks, clearly still operating, now fitted with
new solar panels along one roofline; a smaller working farmland patch nearby; a cluster of wind
turbines on a ridge in the middle distance; a town visible further back. Nothing abandoned or
decayed — old and new production running side by side at the same time. Calm, natural daylight.

### 19. `framtidsvisionar` → `assets/event_framtidsvisionar.png`
*Framtidsvisionär. pengar +5, material +5, positiv.*
**Subject:** A small, modest but clearly finished and working green installation: a single small
wind turbine turning beside a plain, weathered utility building (deliberately generic — could
belong to a farm, forestry operation, wind cooperative or small city block), solar panels on its
roof, a power meter on the wall showing active output. A short row of young trees already planted
in the ground, established over a season. Modest in scale but finished and running. One or two
real people doing ordinary upkeep in the background. Soft warm late-afternoon light.

### 20. `gemensamsatsning` → `assets/event_gemensamsatsning.png`
*Gemensam satsning. alla fyra lag, huvudresurs +5, positiv.*
**Subject:** A sweeping aerial panorama of the entire island as one believable, connected
landscape, with the four regions arranged in their correct relative positions (per the island map):
farmland in one corner bordering both the forest (next to it) and the tundra (next to it on its
other side); dense healthy forest bordering the farmland and, across the island, the city; a
northern tundra stretch bordering both the farmland and the city, where older oil infrastructure
stands alongside new wind turbines; a compact modern city bordering the forest and the tundra, with
green rooftops, solar panels and functioning transit. Farmland and city are on roughly opposite
corners, as are forest and tundra — they should not appear directly adjacent to each other. The
island still clearly has industry, farming and economic activity — changed, not abandoned. Warm,
realistic daylight suggesting a hopeful turning point, not a finished utopia.

---

## Öhälsohändelser (4) — triggas av öns hälsa, inte ett specifikt lag → hela ö-sammanhang, inte en
isolerad plats (lärdom från tidigare iteration).

### 21. `naturenblomstrar` → `assets/event_naturenblomstrar.png` (görs om igen, se nedan)
*Naturen blomstrar. huvudresurs +5, positiv, öhälsa ≥70.*

> **Justerad (efter feedback 2026-11-19):** för många bilder i rad blev vattendrag-närbilder.
> Byt till en vidvinkel-flygbild över ön, med NATUREN/djurlivet som huvudfokus.

> **Justerad igen (2026-11-19):** den vidvinklade 4-regioners-flygbilden konvergerade visuellt mot
> `gemensamsatsning` (samma vindkraft-på-ås + gård + stad-komposition) — de två tappade sin egen
> identitet. Dra tillbaka till natur-DOMINERAD komposition: lägre/närmare kamera, djurliv och
> vegetation i förgrunden fyller bilden, mänskliga byggen syns bara som en liten, avlägsen glimt
> — INTE en lika vägd översikt över alla fyra regioner som `gemensamsatsning`.

> **Justerad igen (2026-11-19):** fokus flyttat till vattnet/ekosystemet specifikt — fisk i klart
> vatten läses tydligare och snabbare som "det går bra nu" än djur i skogsbryn.

> **Justerad igen (2026-11-19):** förra versionen blev för inzoomad (bäck, vattenyta-närbild). Byt
> till en bredare vy över ett sund/vik, sedd något ovanifrån och ner GENOM det klara vattnet
> (inte en under-vattnet-kameravinkel) — en vidare, mer luftig komposition.

> **Justerad igen (2026-11-19):** fisken såg ut att "flyga" ovanför ytan i förra försöket — fel
> perspektiv/brytning. Kräv explicit att fisken är korrekt UNDER vattenytan med trovärdig
> ljusbrytning. Byt avlägsen "grön utveckling"-glimt mot en fiskehamn/stad på andra sidan sundet.

**Subject:** A wide, more zoomed-out aerial view looking down from higher above across a clear
strait or sound between two rocky, forested shores. The water is crystal clear — a varied mix of
real fish of different sizes and species clearly swimming BENEATH the water's surface, their
bodies correctly refracted and slightly distorted by the water the way real underwater objects
look from above — none of them breaking the surface or appearing to float/fly above it. Sunlight
rays penetrate down through the water and catch their scales; smooth rocks and kelp are visible on
the sandy bottom in the shallower areas. Healthy forest lines the near shore, and along it a small
wooden dock or boathouse sits at the water's edge for scale. Seabirds fly over the water. Across
the water in the distance, a small Nordic fishing harbour town is visible — modest waterfront
buildings, a few fishing boats at a quay — grounding the scene without pulling focus from the
water itself. The clarity and life in the water is the whole point: an ecosystem that has visibly
recovered. Vibrant, warm natural sunlight.

### 22. `miljolyft` → `assets/event_miljolyft.png` ✅ KLAR (sparad)
*Miljölyft. huvudresurs +3, positiv.*

Slutgiltig bild: den ursprungliga vattendrags-återställningsscenen (två personer planterar/städar
vid en bäck med en rostig rörstump/gammalt skräp kvar) — behölls trots det inledande
"för-många-vattendrag"-problemet, eftersom just den kändes rätt ("vi hjälps åt"-känslan). Den
vidvinklade flygbilds-varianten användes i stället för `naturenblomstrar` (#21).

### 23. `varmebolja` → `assets/event_varmebolja.png` ✅ KLAR (sparad; geografin lite fel —
skog/åker bytte plats i slutresultatet, men behölls medvetet)
*Värmebölja. huvudresurs −3, negativ, öhälsa ≤35.*

> **Justerad igen (2026-11-19):** öhälsa är en ö-övergripande mätare, så värmeböljan drabbar hela
> ön — ska visa alla FYRA regioner från drönar-/flygperspektiv, inte en enda utbyggd del. Varje
> region visar sin egen typ av bebyggelse som bakas i värmen, i rätt geografiskt läge mot varandra
> (åker↔skog, åker↔tundra, skog↔stad, tundra↔stad — se stilguidens geografiregel).

**Subject:** A wide drone/aerial view over the whole island during an oppressive heatwave,
showing all four regions in their correct relative positions: farmland with a cluster of
greenhouses (some panels fogged from the heat); forest with a sawmill and stacked timber;
tundra with oil-industry infrastructure; a city with a commercial/retail district of flat-roofed
buildings. Farmland borders both forest and tundra; forest borders the city; tundra borders the
city too — farmland and city are on roughly opposite sides, as are forest and tundra. A real
heat-shimmer distortion visible over rooftops and open ground throughout, dust hanging in the
still air, wilting vegetation wherever it exists between the built-up areas. Harsh bleached-white
sky, no clouds, oppressive bright light — the scale of built-up development across the whole
island under stress is the focus.

### 24. `resursbrist` → `assets/event_resursbrist.png` *(ingen bild genererad än, bara Skola)*
*Resursbrist. ingen direkt resurseffekt, negativ.*
**Subject:** A wide, elevated view over a stretch of the island where several different depots are
visibly running low at once, scattered across the view: a near-empty farm silo, a half-empty
harbour warehouse, a quiet timber yard with only a few logs left. A grey, overcast, slightly hazy
light over the whole scene. A quiet sense of island-wide scarcity, not one local shortage.

---

## GM-direkthändelser (4, spelledarstyrda)

### 25. `gm_marknadskrasch` = `marknadskrasch` (#8 ovan)

### 26. `gm_leveransstopp` → `assets/event_gm_leveransstopp.png` *(ingen bild genererad än)*
*Leveransstopp. material −5, alla, negativ.*
**Subject:** A small island harbour at a standstill: a cargo ship idle at the dock, its crane
unmoving, stacked shipping containers and pallets piled along the quay with nowhere to go, a real
dockworker leaning against a post checking a clipboard with nothing to do. Grey overcast light,
still water, everything backed up and waiting.

### 27. `gm_braskord` = `godskord` (#5 ovan)

### 28. `gm_ekonomisktstod` → `assets/event_gm_ekonomisktstod.png` *(ingen bild genererad än)*
*Ekonomiskt stöd. pengar+material +10, fattigast, positiv.*

> Medvetet skild från `gronafonden` (#7) trots liknande "kuvert byter hand"-komposition: här är
> givaren mer byråkratisk/formell, mottagaren ser lättad/trött ut snarare än firad — stöd, inte pris.

**Subject:** A formally dressed official's hand holding out a sealed envelope with an official wax
stamp toward a visibly weathered, modest worker — patched work jacket, a tired but relieved
expression, standing in the doorway of a small struggling workshop or farmhouse. Quieter, more
official in tone than a reward scene. Warm light on the envelope and the worker's face, otherwise
plain daylight.

---

## Sammanfattning

| Grupp | Antal unika bildfiler | Redan genererade (i äldre stil) | Aldrig genererade |
|---|---|---|---|
| Ursprungliga 8 | 8 | 8 | `sponsrat` (0 bild hittills) |
| Företagskriser | 6 (+2 delade) | 6 | — |
| Företagshändelser | 4 | 4 | — |
| Öhälsohändelser | 4 | 2 (naturenblomstrar, miljolyft) | `varmebolja`, `resursbrist` |
| GM-händelser | 2 (+2 delade) | 0 nya | `gm_leveransstopp`, `gm_ekonomisktstod` |
| **Totalt unika filer** | **24** | **20** | **4** |

(`sponsrat` har aldrig haft en genererad bild — UI:t visar bara placeholder för den idag.)

## Öppna frågor till dig

1. **`gronafonden` och `stad_minor`** (#7, #15): kan referensbilderna sparas direkt som de nya
   assets-filerna, eller vill du se dem genomgå Analog Control Room Transmission (stilguiden §7)
   innan du bestämmer?
2. **`torka` och `godskord`** (#4, #5): värda att bedöma om de befintliga bilderna redan kommer
   nära nog, eller ska alla 24 genereras om helt för säkerhets skull?
3. **Ordning:** vill du köra alla 24 i en följd, eller gruppvis (t.ex. de 4 aldrig-genererade
   först, sen de 8 ursprungliga, sen resten)?
4. **`uppror`** (#3) är den som avviker mest från ny stil (text i bild, anime-känsla) — prioritera
   den tidigt?
