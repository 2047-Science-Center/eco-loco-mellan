# Maktspelet / Eco Loco — VINST- & FÖRLUST-FILM (slut-narrativ, ~15–25 s styck)

*Två korta narrativklipp som spelas vid **partislut**, på samma sätt som intro-trailern (`design/TRAILER-INTRO.md`): stillbilder i ChatGPT → enkel kamerarörelse i Runway → klipp ihop, VO + musik, title-card. Ett spelas när **ön klarade sig** (öhälsa ≥ mål), ett när **ön föll** (total kollaps mitt i spelet ELLER tröskelmiss på sista rundan — `engine.js _end(false)`). Skrivet 2026-10-26 utifrån `design/TRAILER-INTRO.md` (visuell identitet att matcha EXAKT), `design/VINST-FORLUST-FORSLAG.md` (vad vinst/förlust betyder), `spec/slutdel.js` (Newfoundland-ekot) och `design/INTRODUKTION.md` (ton). Committas inte.*

---

## Gemensam identitet (samma som trailern — klistra in överst i varje bildprompt)

> *"Dark, cold, cinematic, PHOTOREAL. Cold Nordic/Arctic island world: black snow-capped mountains, a frozen sea scattered with ice floes, pine forests and fjords, an aurora in the sky (calm green when the island is healthy, toxic red when it is failing) and a low gold sun breaking the clouds. Muted desaturated slate-blue-and-grey palette with a single warm gold accent (#C9A94F); light text tone (#F2ECDD). The man-made / institutional layer is STYLIZED and retro (not the land): a brutalist 1960s control room with a backlit topographic island map, a row of retro CRT monitors, analog dials, desk phones and tungsten lamps, and four faceted low-poly bronze animal crests in hexagonal plaques (gold bison = Oxen, green bear = Björnen, copper wolf = Räven, grey eagle = Örnen) — soviet-adjacent but NO real symbols and no readable text. Film grain, soft vignette, 16:9 landscape. No text, no UI, no logos."*
>
> **Två register (viktigt):** ÖN/landskapet renderas **fotorealistiskt** (som trailerns ö-bilder — svarta snötoppar, isflak, norrsken). **Låg-poly/fasetterat gäller BARA** emblemen och kartan. Blanda inte — marken är aldrig low-poly.

**Regler (samma som trailern):** en bild = en enkel rörelse (push-in / pan / parallax). Inga rörliga folkmassor, inget talande ansikte, ingen komplex rök/eld/vatten-i-rörelse — statiskt dis/norrsken är OK (det svepar fint). Generera UTAN text; lägg title-card som overlay i klippsteget (**MAKTSPELET**-typsnittet Oxanium, guld `#C9A94F`). Rösten är **samma som trailern och central-högtalaren — "Institutet för öns framtid": lugn, kall, institutionell, aldrig hetsig.** Ljudet går på central-högtalaren; riggen förstärker med ljus (se not längst ned).

Båda filmerna **återbrukar trailerns vokabulär** medvetet (mätaren, kontrollrummet, de fyra emblemen, ön i vidvinkel) så slutet rimmar med starten — nu med utfallet inskrivet.

---

# ① FÖRLUST — "ÖN FÖLL"  (~18–22 s)

**Spelas när:** `_end(false)` — total kollaps (öh ≤ 0 mitt i spelet) eller tröskelmiss på sista bokslutet. Känsla: tyst, oåterkalleligt, byråkratiskt sorgligt — ingen katastrof-spektakel, utan en **stilla dom**. Ekar Newfoundland: alla gjorde rätt för sig, tillsammans blev det fel.

### Shot L1 — Mätaren faller · 0:00–0:04
- **Kamera (Runway):** mycket långsam push-in mot nålen.
- **Syns:** samma stora analoga ö-mätare som trailern (shot 6), men nålen **har fallit ner i den röda zonen**, under den guldmarkerade tröskeln. Guldmarkeringen lyser svagt, övergiven. Mässing och stål, kallt.
- **COPY (VO):** "Ön nådde inte gränsen."
- **BILDPROMPT:** `[Stilrad] Cinematic push-in on the large analog institutional island-health gauge on a dark control-room wall, the needle fallen deep into the red zone below a dim glowing gold threshold mark, green zone untouched at the top. Brass and steel housing, cold dim light, near-black warm background (#121009), a sense of a verdict already passed. Film grain, 16:9, central composition.` — *Runway: slow push-in; needle still, faint red glow pulses.*

### Shot L2 — Skärmarna slocknar · 0:04–0:08
- **Kamera:** långsam lateral pan längs konsolen.
- **Syns:** det brutalistiska kontrollrummet (trailerns kontrollrum) men de **fyra retro-CRT-skärmarna slocknar en efter en** — gul, grön, orange, grå falnar till mörkt, den stora backlit ö-kartan ovanför dämpas. Rattar och telefoner står stilla. Ingen människa.
- **COPY (VO):** "Varje företag gjorde sitt klokaste val."
- **BILDPROMPT:** `[Stilrad] Cinematic lateral pan across a cold brutalist 1960s control room, a row of four retro CRT wall monitors (gold, green, orange, grey) gone dark and dead, the big backlit topographic island map above dimmed, analog dials and desk phones frozen, concrete walls, no people, a thin layer of dust and cold haze, the last dim gold tungsten light fading. Near-black warm background, bureaucratic emptiness, film grain, 16:9, strong parallax depth.` — *Runway: slow left-to-right pan; monitors stay dark, haze drifts.*

### Shot L3 — Ön sjunker · 0:08–0:13
- **Kamera:** långsam parallax-drift över ön.
- **Syns:** ön i vidvinkel (som trailerns ö-bild) nu **fallen** — svarta snötoppar under en **giftig röd norrskenshimmel**, industriskorstenar till höger med svarta rökpelare, döda grå-bruna skogar och tömda fjordar, det frusna havet platt och livlöst med smutsiga isflak. Likt Newfoundlands tomma hav.
- **COPY (VO):** "Tillsammans räckte det inte."
- **BILDPROMPT:** `[Stilrad] Photoreal cinematic wide aerial of the cold Nordic island in collapse: black snow-capped mountains under a toxic red aurora bleeding across the dark sky, industrial smokestacks on the right belching static columns of black smoke, dead grey-brown forests and drained fjords, the frozen sea flat and lifeless with dirty ice floes, a cold ominous red-gold sun low on the horizon. Bleak, still, like an emptied sea. Photoreal, desaturated slate-blue and grey with a sickly red cast and only a faint gold accent. Film grain, 16:9, horizontal depth.` — *Runway: slow lateral parallax drift; keep smoke and aurora STATIC, only gliding — no animated smoke.*

### Shot L4 — Emblemen falnar · 0:13–0:17
- **Kamera:** mycket långsam push-in mot emblemen.
- **Syns:** de fyra fasetterade low-poly brons-emblemen (bison/björn/varg/örn) i hexagonala plaketter med lagerkrans + stjärna på den mörka metallväggen (som trailerns emblem-vägg), nu **matta och färglösa** — glöden borta ur alla fyra. Likställda även i nederlaget.
- **COPY (VO):** "Ön är förlorad."
- **BILDPROMPT:** `[Stilrad] Cinematic close push-in on the four faceted low-poly bronze animal crests (bison, bear, wolf, eagle), each in a hexagonal plaque with a laurel wreath and small star, mounted on a dark metal wall (exactly like the reference emblem wall), now cold, matte and colourless, all glow gone out of them, equal in defeat. Dim institutional light, near-black warm background, faint grey rim light, shallow depth, film grain, 16:9.` — *Runway: slow push-in that settles on the dark crests.*

### Shot L5 — Title-card · 0:17–0:21
- **Kamera:** mycket långsam push-in som låser i stillbild.
- **Syns:** mörk kontrollrums-/karta-platta, tom. Title-card tonar in: **ÖN FÖLL** (guld, Oxanium), underrad **– ALLA FÖRLORADE –**.
- **COPY (VO):** *(tystnad, eller) "Maktspelet."*
- **BILDPROMPT (bakgrundsplatta, text som overlay i klippet):** `[Stilrad] Cinematic dark empty title-card plate: an out-of-focus dead control room and faint grey island map, near-black warm tone (#121009), strong central negative space, a single very faint cold light pool in the middle, bleak and final. Film grain, 16:9.` — *Runway: very slow push-in easing to a stop; overlay "ÖN FÖLL" / "– ALLA FÖRLORADE –" i guld.*

**VO i följd (förlust):**
> Ön nådde inte gränsen.
> Varje företag gjorde sitt klokaste val.
> Tillsammans räckte det inte.
> Ön är förlorad.

---

# ② VINST — "ÖN KLARADE SIG"  (~18–22 s)

**Spelas när:** `_end(true)` — öhälsa ≥ tröskel på sista rundan. Känsla: **lättnad och värme, inte triumf-pompa** — ön andas ut, ljuset vänder tillbaka. Guldaccenten vinner. Samma vokabulär som förlusten, speglad mot ljuset (använd gärna sida vid sida i klipp-steget för kontrast).

### Shot W1 — Mätaren håller · 0:00–0:04
- **Kamera:** mycket långsam push-in mot nålen.
- **Syns:** samma ö-mätare, men nålen **vilar stadigt ovanför den guldmarkerade tröskeln**, uppe i den gröna zonen. Guldmarkeringen lyser varmt och stabilt.
- **COPY (VO):** "Ön höll sig över gränsen."
- **BILDPROMPT:** `[Stilrad] Cinematic push-in on the large analog institutional island-health gauge, the needle resting steady above a warmly glowing gold threshold mark, up in the green zone, calm and secure. Brass and steel housing catching warm gold light, near-black warm background (#121009), a sense of quiet relief. Film grain, 16:9, central composition.` — *Runway: slow push-in; needle still, warm gold glow steady.*

### Shot W2 — Skärmarna lyser lugnt · 0:04–0:08
- **Kamera:** långsam lateral pan längs konsolen.
- **Syns:** kontrollrummet med de **fyra skärmarna lysande stadigt och samtidigt** — gul, grön, orange, grå, lugna och i balans. Varmt guldljus över konsolen.
- **COPY (VO):** "Fyra företag. En ö."
- **BILDPROMPT:** `[Stilrad] Cinematic lateral pan across a cold brutalist 1960s control room now calm and working: a row of four retro CRT wall monitors (gold harbour, green radar, orange, grey coast) glowing steadily and in balance together, the big backlit island map above softly lit, analog dials and desk phones settled, warm gold tungsten key light filling the concrete room, no people. Near-black warm background, order restored, film grain, 16:9, parallax depth.` — *Runway: slow left-to-right pan; monitors glow steady, warm haze drifts.*

### Shot W3 — Ön blommar · 0:08–0:13
- **Kamera:** långsam push-in / uppåtdrift över ön.
- **Syns:** ön i vidvinkel nu **levande** — svarta snötoppar i varmt rosa-guld gryningsljus, ett **lugnt grönt norrsken** som möter en gyllene soluppgång, täta gröna skogar och klara blå fjordar, det frusna havet ljusnar med rena isflak, små varma ljus tänds i en avlägsen stad.
- **COPY (VO):** "Ni fick den att blomstra."
- **BILDPROMPT:** `[Stilrad] Photoreal cinematic wide aerial of the cold Nordic island alive and thriving at dawn: black snow-capped mountains catching warm pink-gold light, a calm green aurora above meeting a golden sunrise, lush green pine forests and clear blue fjords, the frozen sea softening and bright with clean ice floes, small warm lights coming on in a distant town. Cold slate-blue base warming through with green and gold — a quiet exhale, not a loud celebration. Photoreal, film grain, 16:9, horizontal depth.` — *Runway: slow push-in with gentle upward drift; aurora and light static, gliding.*

### Shot W4 — Emblemen lyser tillsammans · 0:13–0:17
- **Kamera:** mycket långsam push-in mot emblemen.
- **Syns:** de fyra fasetterade low-poly brons-emblemen (bison/björn/varg/örn) i hexagonala plaketter på den mörka metallväggen, nu **lysande i sina lagfärger samtidigt** (guld/grön/koppar/grå), varm guld-kantbelysning — likställda i framgången.
- **COPY (VO):** "Den här gången — tillsammans."
- **BILDPROMPT:** `[Stilrad] Cinematic close push-in on the four faceted low-poly bronze animal crests (bison, bear, wolf, eagle) in hexagonal plaques on a dark metal wall (as in the reference emblem wall), each glowing warmly in its own colour (gold, green, copper, grey) at the same time, warm gold rim light, equal and together in success. Near-black warm background, shallow depth, film grain, 16:9.` — *Runway: slow push-in that settles on the glowing crests.*

### Shot W5 — Title-card · 0:17–0:21
- **Kamera:** mycket långsam push-in som låser i stillbild.
- **Syns:** mörk, varmt guldbelyst kontrollrums-/karta-platta. Title-card tonar in: **ÖN KLARADE SIG** (guld, Oxanium), underrad **– ÖN ANDAS UT –** (eller lagets namn som vinnare läggs som overlay).
- **COPY (VO):** *(värme, mjukt) "Maktspelet."*
- **BILDPROMPT (bakgrundsplatta, text som overlay):** `[Stilrad] Cinematic dark title-card plate: an out-of-focus warmly gold-lit control room and faint living island map, near-black warm tone (#121009), strong central negative space, a warm gold light pool in the middle, hopeful and calm. Film grain, 16:9.` — *Runway: very slow push-in easing to a stop; overlay "ÖN KLARADE SIG" / "– ÖN ANDAS UT –" i guld.*

**VO i följd (vinst):**
> Ön höll sig över gränsen.
> Fyra företag. En ö.
> Ni fick den att blomstra.
> Den här gången — tillsammans.

---

## Musik & ljud (kort not)

- **Förlust:** låt den kalla dronen från trailern **sjunka och tunnas ut** — en sista nedåtgående institutionell ton, nästan bara vind och ett avlägset lågt muller, ingen resolve. Tänk `lose`-stingen men utdragen. Glest, tyst, oåterkalleligt.
- **Vinst:** samma kalla grund men låt den **lyftas till en varm guld-swell** — inte en fanfar, en lättnad. Tänk `win`-stingen + den "warm victorious resolve" som trailern landar i, men mjukare och längre.
- Rösten bär båda; håll bädden glest så VO:n hörs rent. Ljudet spelas centralt (Institutet för öns framtid-sinken), aldrig på bänk-/skärmhögtalarna.

## Rigg-förstärkning i rummet (LJUS, parallellt — valfritt)
Som trailern kan filmerna förstärkas i rummet med **ljudlösa** Lager-2-cues (`ecoloco/rigg/out/*`) så riggen inte krockar med filmens ljud — ELLER så låter man spelets egna **vinst/förlust-finale** (`ecoloco/rigg/final win|lose`, redan byggd i `server.js`/`hjarna-stubb.py`) äga riggen under klippet: **win** = firande grönt + svall, **lose** = dystert mörkt rött. Enklaste vägen: spela filmen och låt `final`-cuen gå samtidigt.

---

## Så gör du
1. **Generera** stillbilderna i ChatGPT (16:9, en prompt per shot, utan text).
2. **Svep** varje bild i Runway med den angivna enkla rörelsen (~3–4 s/klipp).
3. **Klipp ihop** till ~18–22 s per film, lägg VO + musik, overlay:a title-card (Oxanium/guld).
4. Lägg filmerna där spelet kan spela dem vid partislut (samma slot-tänk som trailern i `spec/assets.json → onboarding`; ny nyckel t.ex. `onboarding.winFilm` / `onboarding.loseFilm` — stäm av med spelservern innan inkoppling).
