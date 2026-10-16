# Maktspelet / Eco Loco — intro-trailer (30 s)

*Koncept + shot-lista + copy + bildprompts för en 30-sekunders intro som spelas när spelet startar (kan ersätta/kompletera narrativ-klippet `assets/video/narrativ.mp4`, se `spec/assets.json → onboarding`). Workflow: stillbilder genereras i ChatGPT, får liv via en enkel kamerarörelse i Runway, klipps ihop till 30 s. Skrivet utifrån spel.html (attract "MAKTSPELET — THE EXPERIENCE", färg-tokens), GAME-DESIGN.md, SPELINFO.md, INTRODUKTION.md och AUDIO.md.*

---

## Koncept & ton (läs först)

**Vad trailern ska göra på 30 s:** ge besökaren tre saker innan spelet börjar — **VAR** man är (en karg, vacker ö i Sibirien), **VAD** uppdraget är (få ön att blomstra / inte sänka den), och **VILKEN ROLL** man har (*ett av fyra företag som nu bär ansvaret*).

**Dramaturgin:** plats → maktvakuum → företagen tar över (kontrollrum) → *ni är ett av dem* → insatsen (ö-mätaren) → hotet (kris) → titel. Den landar hårt i **MAKTSPELET** så den sömlöst går in i attract-skärmen.

**Visuell identitet (matcha spelet):**
- Palett: nära-svart varm bakgrund `#121009`, guld-accent `#C9A94F`, ljus text `#F2ECDD`. Lagfärger som återkommer: **gul** (Åkermark), **grön** (Skog), **orange** (Tundra), **grå** (Stad).
- Känsla: kall, institutionell, byråkratisk makt — **kontrollrum, kartor, knappar, uniform-detaljer, stämplar**. Sibirisk natur: tundra, is, berg, sparsamt ljus, norrsken/dis.
- **Flörta** med Sovjet-/institutionsestetik (kall ordning, emblem, pampig byråkrati) — men **inga explicita symboler, inga läsbara riktiga länder/partier**. Antydan, inte utpekande.
- Typsnitt om text renderas: **Oxanium** (rubrik) / **Chakra Petch** (siffror) — matchar spelet. *Rekommendation: generera bilderna UTAN text och lägg title-cards som overlay i klippsteget, så typsnittet blir skarpt och exakt spelets.*

**Regel för varje bild:** komponera med **djup och tomrum att panorera/zooma i**. Inga rörliga folkmassor, inget talande ansikte, inget komplext vatten/eld/rök-i-rörelse. Statiskt dis och norrsken är OK (de svepar fint). En bild = en enkel rörelse.

---

## Shot-lista (8 shots ≈ 30 s)

### Shot 1 — Ön uppenbarar sig · 0:00–0:04
- **Kamera (Runway):** långsam push-in uppifrån (svag top-down drift nedåt).
- **Syns:** vidvinkel-flygbild över en ensam ö i mörkt, iskallt hav. Snö, tundra, taggiga berg, sparsamt vinterljus, svagt norrsken i utkanten.
- **Känsla:** avlägset, storslaget, ödsligt. "Här är platsen."
- **COPY (VO):** "Längst ut i Sibirien ligger en ö."
- **BILDPROMPT:** `Cinematic high aerial wide shot of a single remote island in a dark frozen sea, Siberian winter: snow-dusted tundra, jagged mountains, sparse cold light, faint aurora glow at the horizon. Deep near-black warm background (#121009), muted palette with a subtle gold rim of light. Moody, desolate, epic scale, film grain, 16:9 landscape.` — *Runway: slow push-in / gentle downward drift; aurora and haze sit still and glide.*

### Shot 2 — Fyra landskap · 0:04–0:08
- **Kamera:** långsam horisontell pan (vänster → höger).
- **Syns:** lägre flygvinkel där öns fyra territorier skönjs sida vid sida — gyllene snöfält (åker), mörk barrskog (skog), orange-brun tundra, och en grå industristad i fjärran. Subtilt färgkodat.
- **Känsla:** "en ö, men delad i fyra." Vacker men kall.
- **COPY (VO):** "Karg. Vacker. Och utan styre." — **Textkort (valfritt, nedre tredjedel):** `EN Ö · FYRA OMRÅDEN`
- **BILDPROMPT:** `Cinematic low aerial pan across one island divided into four distinct terrains side by side: golden snow farmland, dark pine forest, orange-brown frozen tundra, and a grey industrial town in the distance. Siberian winter light, cold haze, subtle color-coding (gold, green, orange, grey). Dark warm background, gold accents, film grain, 16:9 landscape, strong horizontal depth.` — *Runway: slow left-to-right lateral pan across the four zones.*

### Shot 3 — Maktvakuumet · 0:08–0:12
- **Kamera:** långsam push-in mot motivet.
- **Syns:** en övergiven, snötäckt byråkratibyggnad/monument — tomma flaggstänger, en nedfälld/lutad institutionsskylt, ett generiskt emblem halvt begravt i snö. Ingen människa.
- **Känsla:** något har tagit slut. Tomrum efter makten.
- **COPY (VO):** "Invånarna kastade ut politikerna."
- **BILDPROMPT:** `Cinematic push-in on an abandoned snow-covered bureaucratic building and monument in a Siberian town square, empty flagpoles, a toppled institutional sign half-buried in snow, a generic faceless emblem, no people, overcast cold light, oppressive stillness. Dark warm palette (#121009), faint gold on metal, soviet-adjacent institutional mood but no real symbols or readable text, film grain, 16:9 landscape, deep perspective.` — *Runway: slow push-in toward the toppled sign.*

### Shot 4 — Företagen tar över · 0:12–0:16
- **Kamera:** långsam lateral pan genom rummet (parallax-djup).
- **Syns:** interiör av ett kallt institutionellt **kontrollrum** — stor väggkarta över ön, rader av knappar och rattar, fyra skärmar som lyser i de fyra lagfärgerna (gul/grön/orange/grå). Tomt på folk.
- **Känsla:** ordning, byråkratisk makt, kontroll. "Härifrån styrs ön nu."
- **COPY (VO):** "Nu styr fyra företag ön."
- **BILDPROMPT:** `Cinematic interior of a cold institutional control room, large wall map of an island, rows of analog buttons and dials, four glowing monitors tinted gold, green, orange and grey, no people, dim gold key light against near-black (#121009), bureaucratic power aesthetic, soviet-adjacent but no explicit symbols, volumetric haze, film grain, 16:9 landscape, strong parallax depth.` — *Runway: slow lateral pan across the console, foreground dials give parallax.*

### Shot 5 — Rollen: ett av fyra · 0:16–0:20
- **Kamera:** push-in mot emblemen (lätt parallax).
- **Syns:** närbild på fyra uniforma, fasetterade metall-emblem på en stålvägg — **bison (gul), björn (grön), varg (orange), örn (grå)** — graverade, officiella, likställda. Ett av dem fångas sist av kameran.
- **Känsla:** "det här är företagen — och ett av dem är ni." Placerar rollen.
- **COPY (VO):** "Ett av dem är ni." — **Textkort (valfritt, nedre tredjedel):** `DU ÄR ETT AV FYRA FÖRETAG`
- **BILDPROMPT:** `Cinematic close shot of four uniform faceted metal company crests mounted in a row on a brushed-steel wall: a bison, a bear, a wolf, an eagle, each engraved and official-looking, tinted respectively gold, green, orange and grey. Cold institutional lighting, dark warm background, gold rim light, soviet-adjacent emblem styling without real symbols, shallow depth, film grain, 16:9 landscape.` — *Runway: slow push-in that settles on the crests; faint parallax between wall and crests.*

### Shot 6 — Insatsen: öns hälsa · 0:20–0:24
- **Kamera:** långsam push-in mot instrumentet.
- **Syns:** ett stort analogt mätinstrument/urtavla på kontrollrummets vägg märkt i anda med spelets ö-mätare — nål som darrar nära mitten, en **guldmarkering vid tröskeln**, grön zon upptill, röd zon nedtill.
- **Känsla:** allt hänger på den här mätaren. Spänd balans.
- **COPY (VO):** "Uppdraget: få ön att blomstra." — **Textkort (valfritt):** `ÖNS HÄLSA`
- **BILDPROMPT:** `Cinematic push-in on a large analog institutional gauge mounted on a dark control-room wall, a trembling needle near the center, a glowing gold threshold mark, a green zone at top and a red zone at bottom, brass and steel housing, dim gold key light, near-black warm background (#121009), tense and official mood, film grain, 16:9 landscape, central composition with room to push in.` — *Runway: slow push-in toward the needle; keep needle still, let light glint.*

### Shot 7 — Hotet: kris · 0:24–0:27
- **Kamera:** långsam parallax-drift (svag sidorörelse).
- **Syns:** öns vidvinkel igen men nu i obalans — ena sidan grön och levande, andra sidan nedsänkt i kall, stillastående industridis under mörknande himmel. Norrsken slår över i rött.
- **Känsla:** varning. "Det kan rasa."
- **COPY (VO):** "Klarar ni det inte — faller allt."
- **BILDPROMPT:** `Cinematic wide shot of the same Siberian island now out of balance: one side green and alive, the other sunk under cold static industrial haze beneath a darkening sky, the aurora shifting to an ominous red. Dark warm palette, red and gold accents, heavy stillness, dread, film grain, 16:9 landscape, horizontal depth.` — *Runway: slow lateral parallax drift; haze and red aurora stay static and glide — no moving smoke.*

### Shot 8 — Titel · 0:27–0:30
- **Kamera:** mycket långsam push-in som låser i stillbild.
- **Syns:** mörk, guldbelyst kontrollrums-/karta-bakgrund. Titeln **MAKTSPELET** tonar in centrerat, underrad **– THE EXPERIENCE –** i guld. (Matchar attract-skärmen i spel.html exakt.)
- **Känsla:** auktoritet, start. Leder rakt in i spelet.
- **COPY (VO):** "Maktspelet." — **Title-card:** `MAKTSPELET` / `– THE EXPERIENCE –`
- **BILDPROMPT (bakgrundsplatta, text läggs som overlay i klippet):** `Cinematic dark title-card plate: an out-of-focus gold-lit control room and faint island map in the background, near-black warm tone (#121009), strong central negative space for a title, a single warm gold light pool in the middle, elegant, institutional, film grain, 16:9 landscape.` — *Runway: very slow push-in that eases to a stop; overlay "MAKTSPELET" (Oxanium) + "– THE EXPERIENCE –" in gold `#C9A94F` i klippsteget.*

---

## Voiceover i följd (för inläsning / tajming)

> Längst ut i Sibirien ligger en ö.
> Karg. Vacker. Och utan styre.
> Invånarna kastade ut politikerna.
> Nu styr fyra företag ön.
> Ett av dem är ni.
> Uppdraget: få ön att blomstra.
> Klarar ni det inte — faller allt.
> **Maktspelet.**

*Röst: lugn, kall, institutionell — samma auktoritet som central-högtalaren "Institutet för öns framtid". Nästan byråkratisk, aldrig hetsig. ~45 ord, bekvämt inom 30 s med andningspauser.*

---

## Musik & ljud (kort not)

- **Grundton:** låg, kall drone + svag institutionell puls (klocka/hjärtslag-tempo), byggd mot en guldig swell på titeln. Tänk "Institutet för öns framtid" — stämningsfullt, officiellt, lite olycksbådande.
- **Textur per fas:** vind + avlägset industrimuller under shot 1–4 (ekar AUDIO.md:s öhälso-ambienser); en kort civic/stämpel-markör vid shot 4 (företagen tar över) och shot 5 (emblemen); en spänd sting under shot 7 (kris, jfr `larm`/`spanning`); varm guld-resolve på titeln (jfr slut-stingen "warm victorious resolve").
- Håll det glest — rösten bär. Inga melodislingor som konkurrerar med VO.

---

## Så gör du

1. **Generera** de 8 stillbilderna i ChatGPT (16:9, en bildprompt per shot ovan — utan text i bilden).
2. **Svep** varje bild i Runway med den angivna enkla rörelsen (pan / push-in / parallax), ~3–4 s per klipp.
3. **Klipp ihop** till 30 s i ordning, lägg VO + musik, och overlay:a title-cards (Oxanium/guld) — landa i **MAKTSPELET** så det går sömlöst in i attract-skärmen.
