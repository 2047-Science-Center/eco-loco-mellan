# EcoLoco — Visuell stilguide för händelsebilderna (v0.1, FÖRSLAG — ej fastställd)

*Skrivet 2026-11-19 av Claude. Status: **förslag att testa**, inte en bestämd standard. Rör INTE
kartan, byggnaderna, emblemen, kontrollrummet, trailern eller UI:t — gäller enbart de bilder som
visas i händelsekortet (`#ov-event` i `spel.html`, `assets/event_<id>.png`). De 24 befintliga
händelsebilderna (8 gamla + 16 nya från `design/HANDELSE-BILDPROMPTS.md`) är INTE omgjorda eller
ersatta av det här dokumentet — de ligger kvar oförändrade för jämförelse.*

Bakgrund: se `design/VISUELL-STILJAMFORELSE.md` för nulägesbilden av alla stilar i spelet. Den
visade att spelet har minst sex visuella språk i drift samtidigt. Det här dokumentet är ett första,
avgränsat steg: hitta EN stil för framtida händelsebilder genom att förena två av de befintliga
referenserna — kontrollrummets atmosfär och kartans spelifierade geometri — utan att kopiera någon
av dem rakt av.

**Arbetsnamn:** *Cinematic Stylized 3D Game Art — Retroindustrial Nordic Atmosphere.*

---

## A. Stildefinition

**Grad av stilisering.** Mellanläge, medvetet mellan två ytterligheter: INTE lika förenklad/flack
som kartans low-poly-fasetter, INTE lika detaljrik/korngrynig som ett fotografi. Tänk "cinematic
matte painting för ett högproducerat strategispel" — formerna är rena och lätta att läsa, men
materialen känns verkliga och ljussättningen är dramatisk. Om man klev in i bilden skulle den
kännas som en plats, inte som en spelplansbricka och inte som en nyhetsbild.

**Geometri och former.** Trovärdiga verklighetsproportioner (ingen fantasy-överdrift, inga
töjda/chibi-figurer). Rena, lätta silhuetter — undvik visuellt brus och överdrivet små detaljer som
försvinner när bilden visas kort (kortet syns i ~12 sekunder innan det auto-stängs). En tydlig
huvudform per bild, inte flera konkurrerande fokuspunkter.

**Material och texturer.** Taktila men MÅLADE, inte fotograferade — rost, vittrat trä, betong,
jord, lövverk ska kännas verkliga genom säkra penseldrag/renderingsbeslut, inte genom
fotografisk mikrodetalj (synliga träfibrer, porer, sensor-brus). Materialkänslan ska likna
kontrollrummets (tung, taktil, industriell) men tekniken ska vara målad/renderad, inte fotad.

**Ljussättning.** Dramatisk och riktad, alltid med en tydlig ljuskälla eller kontrastaxel (låg sol
genom moln, en enda lampa, eldsken, ett kallt gryningsljus) — aldrig platt, jämnt "mulet
ögonblicksfoto"-ljus. Stark ljus/skugga-kontrast, gärna kantljus (rim light) som skiljer motivet
från bakgrunden. Det här är den viktigaste enskilda egenskapen för att bilderna ska kännas filmiska
i stället för dokumentära.

**Färgmättnad och kontrast.** Rikare och mer mättad än dämpad dokumentärrealism, men INTE kartans
klargodis-mättnad. En jordnära men levande palett: varma guld/ambertoner (samma familj som UI:ets
`--gold:#C9A94F`) mot kallare blå-violetta skuggor. Hög valör-kontrast (tydligt ljust mot tydligt
mörkt), inte den jämna gråskalan som dokumentärfoto ofta har.

**Miljöer och landskap.** Samma nordiska/boreala värld som kartan och trailern — barrskog, fjordar,
jordbruksmark, tundra, en liten stad — men renderad filmiskt-målat, inte fotorealistiskt och inte
som leksaksdiorama.

**Arkitektur och industri.** Verklighetsgrundad nordisk lantbruks-/industriarkitektur (vittrat trä,
betong, stål, rostiga rörledningar) — INTE kartans rundade, charmiga "leksaksbyggnad"-stil.

**Människor och karaktärer.** Får finnas men är sekundära — målade/förenklade, inte fotografiska
porträtt, inga synliga ansiktsdrag i detalj. Läsbar siluett/pose räcker (en person som böjer sig
ner, en folkmassa som rör sig) — miljön och händelsen ska alltid dominera bilden, inte personen.

**Kameravinklar och komposition.** Filmiska, varierade vinklar — INTE låst isometriskt top-down som
kartan. Får vara låg vinkel, lätt förhöjd, närbild eller vid vy beroende på vad händelsen kräver.
Tydlig komposition med ett huvudmotiv, inte en spridd "allt syns lika mycket"-vy. 16:9, ingen text,
ingen UI, inga loggor.

**Atmosfär och väder.** Väder och luftperspektiv som aktivt berättarverktyg — dis, regn, damm, rök,
solstrålar genom moln — för att förstärka stämningen, inte bara som bakgrundsdekoration.

---

## B. Gemensamma regler

**ALLTID konsekvent mellan alla händelsebilder (oavsett händelse):**
1. Samma renderingsteknik och stiliseringsgrad (målad/filmisk 3D-spelkonst, se ovan) — aldrig
   fotorealism, aldrig kartans low-poly-fasetter, aldrig platt tecknad stil.
2. Samma materialbehandling (målad taktilitet, inte fotografisk mikrodetalj).
3. Samma grad av ljusdramatik/kontrast — alltid en tydlig, riktad ljuskälla.
4. Samma färglogik: jordnära grundpalett + EN varm guldaccent-familj som genomgående tråd,
   oavsett om bilden i övrigt är varm eller kall.
5. Samma kompositionsstädning: ett tydligt huvudmotiv, läsbart inom några sekunder.
6. 16:9, ingen text, ingen UI, inga loggor, inga vattenstämplar.

**FÅR VARIERA beroende på händelsens innehåll/stämning:**
1. Temperatur och mood: en positiv händelse kan vara ljus, varm, hoppfull; en katastrof mörk,
   dramatisk, hotfull.
2. Färggradering inom paletten: varmare amber för positiva händelser, kallare blå-violett för
   negativa — men alltid inom samma grundpalett (se regel B4 ovan).
3. Dygns-/väderläge (gryning, skymning, storm, klar himmel).
4. Närvaro eller frånvaro av människor, och hur många.
5. Kameravinkel och avstånd (intimt närmre skott kontra vid etablerande vy) — styrs av vad
   händelsen behöver, inte av ett fast mönster.
6. Grad av synlig skada/ordning (en "minor"-händelse ska se mindre allvarlig ut än en "major", se
   `design/HANDELSE-BILDPROMPTS.md`s minor/major-princip — den principen gäller oavsett vilken
   bildstil som används och ärvs rakt in i den nya stilen).

---

## C. Master Style Prompt (engelska, återanvändbar)

Klistra in detta överst i varje händelseprompt, följt av en beskrivning av det specifika motivet:

> **MASTER STYLE — Cinematic Stylized 3D Game Art, Retroindustrial Nordic Atmosphere:**
> A digital matte painting created for a high-production stylized video game cinematic — rendered
> with confident, deliberate brushwork and simplified, clean forms, not photographic micro-detail
> and not flat vector cartoon geometry. Grounded real-world proportions and believable materials
> (weathered wood, rust, concrete, steel, soil, foliage) built from committed painted/rendered
> surfaces rather than photographic texture — no visible camera grain, no lens artifacts, no
> depth-of-field camera blur, no chromatic aberration. Dramatic, directional cinematic lighting
> with one clear dominant light source and strong value contrast between lit and shadowed areas,
> a subtle warm rim light separating the subject from its surroundings. A grounded but vivid color
> palette: warm amber-gold light (in the family of #C9A94F) against cooler blue-violet shadow,
> richer and more saturated than documentary photo-realism but never candy-bright or toylike.
> Nordic/boreal environment — pine forest, fjords, farmland, tundra, or a small weathered
> industrial town — rendered with real-world architectural grounding, not stylized toy-block
> buildings. People, when present, are secondary: painterly, simplified figures with readable
> silhouettes rather than photographic portraits, never the focal point of fine detail. Clean,
> single-focus cinematic composition, readable at a glance. Wide 16:9 landscape framing. No text,
> no UI elements, no logos, no watermark.

---

## D. Negative prompt

Lägg till i slutet av varje prompt (eller i ChatGPT:s separata negativa fält om sådant finns):

> Avoid: photorealism, documentary photography, photographic grain or lens artifacts, realistic
> human portraiture with detailed facial features, traditional unstylized fine-art landscape
> painting, anime or manga style, generic fantasy illustration, cute/toylike mobile-game
> aesthetics, low-poly faceted geometry, flat simplified vector cartoon graphics, security-camera
> or surveillance framing, screen/monitor framing device, any text, UI elements, logos or
> watermarks.

---

## E. Exempelprompter (tre testmotiv, samma grundstil, olika stämning)

### E1. STORM — dramatisk storm vid öns hamn (negativ, hotfull)
> [MASTER STYLE — se C] Subject: A powerful coastal storm battering a small weathered Nordic
> harbour at dusk. Heavy rain driven near-horizontal by wind, dark storm clouds churning overhead
> with a thin crack of harsh gold light breaking through at the horizon. Waves crash hard against
> a stone breakwater, spray exploding into the air. An old dockside crane and a few stone
> warehouses stand braced against the wind, one window glowing warm against the storm's cold blue-
> grey palette. A sense of raw, immediate natural threat. [Negative — se D]

### E2. GRÖNA FONDEN — positiv händelse, en invånare får stöd till ett miljöprojekt
> [MASTER STYLE — se C] Subject: A modest Nordic smallholding at golden hour, where a weathered
> local resident receives a sealed envelope and a handful of banknotes from an official-looking
> hand extended from off-frame. Behind the resident: a small vegetable garden, a single wind
> turbine turning on a nearby ridge, warm low sun breaking through parting clouds and catching the
> envelope's wax seal. A quiet, hopeful, dignified moment — support given, not charity received.
> [Negative — se D]

### E3. SABOTAGE — hotfull händelse kopplad till öns industri/infrastruktur
> [MASTER STYLE — se C] Subject: A damaged industrial pipeline junction at night, sparks arcing
> from a torn section of metal casing, a thin plume of dark smoke rising against a cold
> blue-black sky. Harsh amber emergency light spills from a cracked control box nearby, throwing
> long hard shadows across wet concrete and scattered tools — the scene reads as deliberate
> damage, not natural wear. No people needed; the danger and disorder of the scene is the focus.
> [Negative — se D]

*Dessa tre är valda för att de representerar tre väldigt olika händelsetyper (naturkatastrof,
mänsklig värme/stöd, hot/sabotage) — om stilen håller ihop över alla tre är det ett starkt tecken
på att den är robust nog för hela händelsesystemet.*

---

## Testprocess (innan fler bilder produceras)

1. **Generera E1–E3** i ChatGPT, var för sig (inte i samma bild).
2. **Lägg dem bredvid varandra** och bredvid en skärmdump av kartan + en skärmdump av
   kontrollrummet (t.ex. `eldsjal01.png`), och gå igenom checklistan:
   - [ ] Ser bilderna ut att tillhöra samma spel som varandra (alla tre inbördes)?
   - [ ] Känns de som scener från samma värld som kartan (samma ö, samma klimat/arkitektur),
     utan att se ut som kartans stil?
   - [ ] Har de kontrollrummets atmosfäriska och visuella tyngd (dramatik, materialkänsla,
     ljuskontrast)?
   - [ ] Är de tillräckligt stiliserade för att kännas som spelkonst, inte som foton?
   - [ ] Håller stilen ihop för både en positiv (E2) och två negativa/hotfulla (E1, E3) händelser?
3. **Om svaret är ja på alla fem:** stilguiden går från v0.1 till en riktig standard, och vi kan
   besluta separat om den ska appliceras framåt bara, eller även ersätta de 24 befintliga
   händelsebilderna (se öppna frågor i `VISUELL-STILJAMFORELSE.md`).
4. **Om något känns fel:** notera VILKEN av de fem punkterna som brister (för ljus/mörk, för
   detaljerad/för enkel, för foto-aktig, för kall/för varm) — det pekar direkt på vilket avsnitt i
   stilguiden (A/C) som behöver justeras, i stället för att gissa om på hela stilen igen.

---

## Vad som INTE är gjort i det här dokumentet

Inga bilder har genererats. Inga befintliga filer är ändrade, ersatta eller borttagna. `spec/`,
`src/`, `server/` och `spel.html` är orörda. `design/HANDELSE-BILDPROMPTS.md` (de 24 befintliga
händelsebildernas dokumentation) ligger kvar oförändrad för jämförelse. Det här är ett förslag att
testa, inte ett beslut.
