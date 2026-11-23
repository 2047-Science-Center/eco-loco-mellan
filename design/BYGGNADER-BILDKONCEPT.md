# EcoLoco — Byggnader: fastställda bildkoncept, inventering + promptar (alla fyra företag)

*Kanonisk referens för de tolv byggnadsillustrationerna. Skriven 2026-11-23 av Klara + Claude utifrån den
bekräftade bildserien. Ersätter tidigare utkast (borttagna). Namnbytet på samtliga 12 är genomfört (§5).
Nya bilder ska genereras för ALLA tolv (uniform stil) — prompterna i §7. Jag genererar inte PNG:erna själv;
det sker i bildgeneratorn. Ingen mekanik/kostnad/effekt/ID ändrad. Ingen commit/push.*

> **Begränsningar (brief):** Återinför inte äldre byggnadsnamn. Den gröna Skog-byggnaden är **Hållbart
> skogsbruk** — INTE "Träåterbruk". Ändra inte effekter/balans/ID/bildfilnamn.

---

## 1. Gemensam bildstil

**Cinematic isometric 3D game art, polished low-poly, nordiskt landskap.** Varje byggnad:
- Tredimensionellt isometriskt perspektiv, samma kameravinkel + skala som de övriga elva.
- Eget **hexagonalt diorama** per byggnad, med **sammanhängande nordisk natur (berg + vatten)** i miljön.
- Polerad, **färgstark och detaljrik** spelgrafik — tydliga byggnader, maskiner, landskapselement.
- En visuell utveckling **miljöskadlig → hållbar** över de tre nivåerna — nivån läses ur själva byggnaden
  och miljön (smutsig/standard/grön). **Ingen skylt, text eller djursymbol i bilden** (det var en äldre
  generering — utgår nu).
- **Behåll samma mark-sockel som idag:** en **hexagonal, flytande ö-tile** (platt topp, klippiga bergskanter,
  gräs/jordkant) i samma isometriska vinkel, skala och centrering. Byggnaderna placeras som **sprites** på
  slot-koordinater (`placeBuilding`, size≈135 i kartpixlar) — de tesselerar inte, så passningen är visuell:
  samma hex-form + skala + vinkel + centrering (samma 512×512-canvas) → droppar in i kartans slots identiskt,
  utan kod-/asset-ändring.
- Transparent bakgrund, 512×512 (generera gärna 1024 och skala ner). Ingen UI/statistik/skylt/text.

## 2. De tolv fastställda byggnaderna (koncept)

### 🐂 OXEN — Åkermark (`aker`) · öns matproduktion
- 🔴 **Storodling** (`aker_smutsig`) — storskaligt industrijordbruk: stora sammanhängande åkrar,
  skördetröska + traktor, silor + ladugård, intensiv produktion, begränsad biologisk mångfald.
- 🟠 **Växthus** (`aker_standard`) — kontrollerad effektiv matproduktion: två stora glasväxthus, synliga
  odlingar, teknisk utrustning, mindre ekonomibyggnader, ordnat odlingslandskap.
- 🟢 **Ekogård** (`aker_gron`) — småskaligt ekologiskt jordbruk: odlingsbäddar + fruktträd, betande djur,
  liten damm, blommande vegetation, varierat levande jordbrukslandskap.

### 🐻 BJÖRNEN — Skog (`skog`) · öns skog och byggmaterial
- 🔴 **Skövling** (`skog_smutsig`) *(tidigare namn: Kalhygge)* — stort avverkat skogsområde: många stubbar +
  bar jord, stora timmerhögar, skogsmaskiner, tydliga spår av omfattande exploatering.
- 🟠 **Sågverk** (`skog_standard`) — industriell träproduktion: stor sågverksanläggning, industribyggnader,
  transportband, sågade plankor + timmer, silor + utrustning.
- 🟢 **Hållbart skogsbruk** (`skog_gron`) — varsamt långsiktigt skogsbruk: levande skog med träd i olika
  åldrar, selektiv avverkning, mindre skogsmaskiner, återplantering, balans skogsbruk↔bevarad natur.

### 🦊 RÄVEN — Tundra (`tundra`) · öns industri och energi
- 🔴 **Oljefält** (`tundra_smutsig`) — storskalig oljeutvinning: borrtorn, flera oljepumpar, rörledningar,
  lagringstankar, mörk rök, exploaterad mark.
- 🟠 **Fabrik** (`tundra_standard`) — industriell tillverkning: större industrikomplex, fabrikshallar,
  skorstenar, produktionsutrustning, silor + lastbilar.
- 🟢 **Vindkraft** (`tundra_gron`) — förnybar energi: flera stora vindkraftverk, öppet nordiskt landskap,
  berg + vegetation, liten sjö, ren modern energiinfrastruktur.

### 🦅 ÖRNEN — Stad (`stad`) · öns stad och handel
- 🔴 **Betongstad** (`stad_smutsig`) — tät hårt exploaterad stad: höga betongbyggnader, mycket asfalt, tät
  trafik, stora hårdgjorda ytor, mycket begränsad grönska.
- 🟠 **Handelsområde** (`stad_standard`) — kommersiellt stadsområde: köpcentrum + handelsbyggnader, stora
  parkeringsytor, bilar, butiker/service, viss grönska.
- 🟢 **Stadskvarter** (`stad_gron`) — hållbar levande stad: moderna stadshus med solpaneler, grönska + träd,
  cykelbanor, gångstråk, kollektivtrafik, människovänlig miljö.

## 3. Inventering av aktuell implementation

Källa: `spec/content/buildings.js` (bank som motorn läser) + spegling i `spec/assets.json`. Alla 12 används i
**Flash, Mellan OCH Skola**. Interna ID = `region_tier` (oförändrade). **Visningsnamnen är nu satta till de
fastställda** (§5). Alla 12 bildfiler finns (512×512); kolumnen längst till höger = om NUVARANDE bild matchar
det fastställda konceptet (styr vilka som behöver nya bilder, §4).

| Internt ID | Namn (nu = fastställt) | Nivå | Bildfil | Finns | Nuvarande bild ↔ koncept |
|---|---|---|---|---|---|
| aker_smutsig | Storodling | 🔴 | assets/aker_smutsig.png | ✅ | ✅ matchar |
| aker_standard | Växthus | 🟠 | assets/aker_standard.png | ✅ | ❌ bild = klassisk gård, inte växthus |
| aker_gron | Ekogård | 🟢 | assets/aker_gron.png | ✅ | ⚠ delvis (har växthus, saknar betande djur/damm) |
| skog_smutsig | Skövling | 🔴 | assets/skog_smutsig.png | ✅ | ❌ bild = sågverk, inte kalhygge |
| skog_standard | Sågverk | 🟠 | assets/skog_standard.png | ✅ | ❌ bild = timmerstuga/skog, inte sågverk |
| skog_gron | Hållbart skogsbruk | 🟢 | assets/skog_gron.png | ✅ | ⚠ bild = skogsträdgård, inte selektivt skogsbruk |
| tundra_smutsig | Oljefält | 🔴 | assets/tundra_smutsig.png | ✅ | ✅ matchar |
| tundra_standard | Fabrik | 🟠 | assets/tundra_standard.png | ✅ | ⚠ nära (mer lager än stort fabrikskomplex) |
| tundra_gron | Vindkraft | 🟢 | assets/tundra_gron.png | ✅ | ✅ matchar |
| stad_smutsig | Betongstad | 🔴 | assets/stad_smutsig.png | ✅ | ❌ bild = kolkraftverk, inte betongstad |
| stad_standard | Handelsområde | 🟠 | assets/stad_standard.png | ✅ | ❌ bild = kontors-/hotellhus, inte handel |
| stad_gron | Stadskvarter | 🟢 | assets/stad_gron.png | ✅ | ⚠ delvis (enskilt hus, inte stadskvarter) |

## 4. Bildstatus → generera om ALLA tolv (uniform serie)

Beslut: generera **nya bilder för samtliga 12** så serien blir enhetlig (samma kamera/skala/ljus/stil + ny
företags-träskylt). Det löser samtidigt de nuvarande avvikelserna (projektets bilder är en äldre uppsättning):
- ❌ **5 stämmer inte** med konceptet: aker_standard, skog_smutsig, skog_standard, stad_smutsig, stad_standard.
- ⚠ **4 delvis:** aker_gron, skog_gron, tundra_standard, stad_gron.
- ✅ **3 matchar** men genereras ändå om för enhetlighet: aker_smutsig, tundra_smutsig, tundra_gron.

Filnamnen behålls (`assets/<id>.png`) → ingen kod-/asset-kopplings-ändring när de nya ersätter de gamla.

## 5. Genomfört

- **Samtliga 12 visningsnamn satta till de fastställda** i `spec/content/buildings.js` + `spec/assets.json`
  (Storodling/Växthus/Ekogård · Skövling/Sågverk/Hållbart skogsbruk · Oljefält/Fabrik/Vindkraft ·
  Betongstad/Handelsområde/Stadskvarter). ID, kostnad, produktion, impact, asset-koppling **oförändrade**.
- Golden-baseline (`tools/golden/mellan-baseline-v5.json`) **regenererad** — diffarna var enbart namnfält.
  Sviten **20/20**. Namnen renderas enbart ur banken (`card.namn` i `src/ui.js`), inga hårdkodade strängar.
- Obs: smutsig Skog hette tidigare *visnings*namnet "Sågverk" (inte "Kalhygge"); bytt till "Skövling" via ID.

## 6. Bildfilernas sökvägar (behålls)

`assets/{aker,skog,tundra,stad}_{smutsig,standard,gron}.png` — 12 st, 512×512, transparent. Kopplas via
`asset`-fältet i `buildings.js`.

## 7. Promptar för bildgenerering (12)

**Arbetsgång:** generera **`aker_smutsig` (Storodling) först** i 4–6 varianter för att låsa den enhetliga
stilen; spara den valda som **stil-ankare** och bifoga den som referens när resten genereras (be om SAMMA
hex-sockel, kamera, skala, ljus och palett, bara nytt motiv). **Bara själva byggnaden** — ingen skylt, text
eller djursymbol.

**Gemensamt STIL-block (engelska, prefix i varje prompt):**
> Cinematic isometric 3D game art, polished low-poly, Nordic landscape. A single company building standing on
> its own **hexagonal floating island tile** (flat top, rocky cliff edges, grassy/soil rim), set in cohesive
> Nordic nature with snow-capped mountains and water in the surroundings. One consistent isometric camera
> angle, scale and centering (identical hex base across all twelve). Polished, colorful, detailed game
> graphics with clear buildings, machines and landscape elements. Centered single subject, transparent
> background, **no signs, no text, no emblems, no UI**. Square format.

**Per byggnad = stil-block + motiv nedan** (nivån ska läsas ur byggnaden/miljön, ingen skylt):

- **aker_smutsig** (Storodling) — *Large-scale industrial farming: vast continuous fields, a combine harvester
  and tractor, grain silos and a barn, intensive production, little biodiversity; dusty, monoculture.*
- **aker_standard** (Växthus) — *Controlled efficient food production: two large glass greenhouses, visible
  crops, technical equipment, small outbuildings, an orderly cultivated landscape.*
- **aker_gron** (Ekogård) — *Small-scale organic farm: raised cultivation beds and fruit trees, grazing animals,
  a small pond, flowering vegetation, a varied living farmland.*
- **skog_smutsig** (Skövling) — *A large clear-cut forest: many stumps and bare earth, big timber piles,
  forestry machines, clear traces of heavy exploitation; strong deforestation.*
- **skog_standard** (Sågverk) — *Industrial timber production: a large sawmill facility, industrial buildings,
  conveyor belts, sawn planks and logs, silos and wood-processing equipment.*
- **skog_gron** (Hållbart skogsbruk) — *Careful long-term forestry: living forest with trees of different ages,
  selective logging, smaller forestry machines, replanting of young trees, balance between forestry and nature.*
- **tundra_smutsig** (Oljefält) — *Large-scale oil extraction: a drilling derrick, several oil pumps, pipelines,
  storage tanks, dark smoke, exploited ground.*
- **tundra_standard** (Fabrik) — *Industrial manufacturing: a larger industrial complex, factory halls,
  chimneys, production equipment, silos and trucks; active industry.*
- **tundra_gron** (Vindkraft) — *Renewable energy: several large wind turbines, an open Nordic landscape,
  mountains and vegetation, a small lake, clean modern energy infrastructure.*
- **stad_smutsig** (Betongstad) — *Dense, heavily built-up city: tall concrete buildings, lots of asphalt,
  heavy traffic, large hard surfaces, very limited greenery; rapid urbanization with little regard for nature.*
- **stad_standard** (Handelsområde) — *Commercial city area: a shopping mall and retail buildings, large
  parking lots, cars, shops and services, some greenery.*
- **stad_gron** (Stadskvarter) — *Sustainable living city: modern city blocks with solar panels, greenery and
  trees, bike lanes, pedestrian paths, public transport, an attractive people-friendly environment.*

## 8. Urvalschecklista (per bild)

- [ ] Rätt företag + nivå läsbart på 1–2 sek — nivån (smutsig/standard/grön) läses ur byggnaden/miljön,
  **ingen skylt eller text**.
- [ ] **Samma hex-sockel, kamera, skala, ljus och stil** som de övriga elva (enhetlig serie).
- [ ] Nordisk natur (berg + vatten) i miljön; polerad, färgstark, detaljrik.
- [ ] Transparent bakgrund, centrerat, ingen UI/statistik/skylt/text.
- [ ] Fyller tilen i **samma skala/centrering/hex-form** som dagens (droppar rätt i kartans slot som sprite),
  filnamn `assets/<id>.png`.
