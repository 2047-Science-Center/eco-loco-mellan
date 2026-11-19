# EcoLoco — Visuell stilguide för händelsebilderna (v1.0 — ersätter v0.1)

*Skrivet 2026-11-19 av Claude. Detta dokument ersätter `design/HANDELSE-VISUAL-STYLE-GUIDE.md`
(v0.1, "Cinematic Stylized 3D Game Art") som arbetsstandard. v0.1-filen raderas INTE — den ligger
kvar som historik/jämförelse. Gäller ENDAST händelsebilderna (`assets/event_<id>.png`). Rör INTE
kartan, byggnaderna, emblemen, kontrollrummet, trailern eller spelets UI/kod.*

**Status:** godkänd grundriktning efter flera bildtester (Gröna fonden, Stad minor). Detta
dokument + de 24 förberedda prompterna i `design/HANDELSE-BILDPROMPTS-v2.md` väntar på ditt
godkännande innan någon bild genereras på riktigt.

---

## 1. Den övergripande visuella idén

EcoLoco utspelar sig i en värld med **två perspektiv på samma ö**:

- **Kartan = Centralmaktens strategiska modell.** Ljus, stiliserad low-poly-geometri. Representerar
  ön som ett SYSTEM — resurser, investeringar, strategiska beslut. Spelarna ser ön så här när de
  STYR den.
- **Händelsebilderna = verkligheten på ön.** Verkliga människor, natur, samhällen, konsekvenser.
  De ska kännas som verkliga platser, inte spelplansbrickor. Spelarna ser ön så här när de
  INFORMERAS om vad deras beslut faktiskt gör.

Det är en MEDVETEN kontrast, inte en inkonsekvens: kartan visar systemet, händelsebilderna visar
verkligheten bakom systemet.

**Länken mellan dem är kontrollrummet.** Spelarna sitter i Centralmaktens analoga, retroindustriella
kontrollrum (1960-talskänsla, olivbruna paneler, guldaccent `#C9A94F`, statuslampor och instrument)
och övervakar ön på distans. Händelsebilderna är **visuella rapporter som kommer in från ön till
detta analoga system** — det är därför de ska kännas verkliga (det är verkligheten) men samtidigt
"mottagna genom" något (det analoga kontrollrummet).

Den kopplingen förmedlas i TVÅ separata lager, som är avsiktligt hållna isär:
1. **Grundbilden** (vad som genereras) — se §2–4 nedan. Ren, overkligt oförstörd kvalitet.
2. **Bildbehandlingen** (hur den visas i spelet) — se §7. Ett gemensamt CSS-filter/overlay-lager
   som läggs PÅ grundbilden i klienten, inte i själva bildfilen. De är separata så att filtret kan
   justeras i efterhand utan att bilderna behöver genereras om.

---

## 2. Grundstil: CINEMATIC TACTILE REALISM

Detta ersätter den tidigare "Cinematic Stylized 3D Game Art"-riktningen (v0.1), som byggde på
målad WoW/Blizzard-konceptkonst. Efter tester kändes den stilen för tydligt MÅLAD (synliga
penseldrag, dramatisk fantasy-färggradering) — fel håll. Den nya riktningen går istället mot
verklighetstrogen, taktil realism med bara en mycket subtil stilisering, grundad i de två
godkända referensbilderna (§8).

**Grundprincip:** bilderna ska kännas som verkliga, levande miljöer med trovärdiga människor,
byggnader och natur — men ha EN mycket subtil, medveten stilisering i geometri och textur som
gör att de ändå känns som en genomarbetad spelvärld, inte ett stockfoto.

### Vi vill INTE ha
- Tydligt målad konceptkonst med synliga penseldrag.
- Manga, anime eller serietidningsestetik.
- Low-poly-geometri eller leksaksliknande byggnader (det är kartans jobb, inte händelsernas).
- Plastiga, lerliknande eller överdrivet förenklade människor.
- Överdrivet filmisk, dramatiskt färggraderad fantasy-belysning (den orange-violetta
  solnedgångspaletten från SPELKONST-testerna).
- Gamla, blekta eller dokumentära arkivfotografier.

### Vi vill HA
- Verklighetstrogna proportioner och naturliga människor.
- Trovärdiga, taktila material.
- Subtil stilisering i geometri och texturer (knappt märkbar — en känsla av att vara "gjord för
  ett spel", inte en synlig teknik).
- Levande miljöer med naturliga variationer och små imperfektioner.
- Realistiskt ljus och atmosfär, styrt av SCENEN, inte av en påklistrad filmisk mall.
- En värld som känns fysisk och bebodd.

---

## 3. Detaljregler per kategori

**Människor.** Ska se verkliga ut — individuella ansikten, ålderstecken, naturliga hudtexturer,
trovärdiga kläder, realistiska proportioner. INTE lerfigur-aktiga eller stiliserade 3D-karaktärer.
INTE heller överdrivet perfekta/retuscherade. De är en del av scenen men behöver inte dominera den
(se §4 om komposition).

> **Regel: varje händelse ska ha en SYNLIGT ANNAN person.** Olika händelser föreställer olika
> människor på olika delar av ön — ingen återkommande huvudperson. Bildgenerering tenderar att
> återanvända samma ansikte/figur när en tidigare bild bifogas som stilreferens (hände mellan
> `aker_minor` och `gronafonden` — båda fick samma gråskäggiga äldre man). Specificera därför
> ålder/hår/kön explicit i varje Subject-prompt, och variera medvetet mellan händelser (t.ex. inte
> alltid en äldre vithårig man) — be uttryckligen om en person som INTE liknar tidigare genererade
> karaktärer när en referensbild bifogas enbart för STIL.

**Byggnader och arkitektur.** Trovärdig nordisk arkitektur: trä, sten, betong, metall, tegel,
industriella konstruktioner. Materialen ska kännas använda, slitna, fysiska. Subtila geometriska
förenklingar är OK om de är nästan omärkliga — aldrig så mycket att byggnader börjar likna
leksaker eller kartans byggnadsstil.

**Natur och landskap.** Skogar, fjordar, berg, tundra, odlingsmark, kustmiljöer ska kännas verkliga.
Vegetation/terräng får ha en subtilt stiliserad struktur (som i referensbilderna), men **vatten,
moln och väder måste bete sig FYSISKT TROVÄRDIGT** — naturliga vågor, reflektioner, skum. Tidigare
tester gav vatten/stormmoln en manga-/konceptkonst-känsla — det undviks aktivt nu.

> **Regel: öns fyra områden hänger geografiskt ihop** (bekräftat mot `src/map.js`): **Åker (NV)
> gränsar till Skog (NÖ) och Tundra (SV); Skog gränsar till Stad (SÖ); Stad gränsar till Tundra.**
> Åker↔Stad och Skog↔Tundra ligger DIAGONALT, inte intill varandra. En bild från ett område ska i
> bakgrunden kunna ANA sina grannområden där det är rimligt (t.ex. skog synlig från åkerns kant,
> eftersom de gränsar till varandra) — inte generiska snöberg i alla bilder oavsett var på ön man
> är, och inte stadens skyline synlig från åkern (de ligger diagonalt, för långt bort). Snöklädda
> berg i fjärran är OK som en gemensam bakgrundskuliss för hela ön (syns i referensbilderna), men
> ska inte vara det ENDA som skiljer "plats A" från "plats B".

**Färger och ljus.** Naturliga men rika färger. INTE den överdrivna orange-violetta
solnedgångspaletten från SPELKONST-testerna. Ljuset styrs av HÄNDELSEN, inte av en fast mall:
- Positiva händelser: kan vara ljusa, varma, hoppfulla.
- Negativa händelser: kan vara kalla, mörka, hotfulla.
- Vardagliga samhällshändelser: neutralt, naturligt dagsljus.

**Viktigt:** alla bilder ska INTE ha samma dramatiska ljussättning. Det som ska vara konsekvent är
RENDERINGSTEKNIKEN, materialkänslan och graden av realism — inte vädret eller färgtemperaturen.

**Kameravinklar och komposition.** Fria, filmiska vinklar (inte kartans låsta top-down). Ett tydligt
huvudmotiv per bild, läsbart inom några sekunder (kortet visas kort). 16:9, ingen text, ingen UI,
inga loggor.

---

## 4. Vad som ALLTID ska vara konsekvent vs. vad som FÅR variera

**ALLTID konsekvent:**
1. Renderingsteknik och realismgrad — Cinematic Tactile Realism (§2), aldrig målad konceptkonst,
   aldrig low-poly, aldrig anime/serietidning.
2. Naturliga, trovärdiga människor (om de finns) — aldrig lerfigurer eller överdrivet stiliserade.
3. Fysiskt trovärdigt vatten/väder/moln.
4. Nordisk verklighetsgrundad arkitektur och natur.
5. Tydligt, läsbart huvudmotiv per bild. 16:9, ingen text/UI/loggor.
6. Minor/major-skillnaden kommuniceras genom MOTIVET (omfattning av skada/synlighet), inte bara
   genom färgläggning — se §6.

**FÅR variera per händelse:**
1. Ljustemperatur och stämning (varmt/hoppfullt vs. kallt/hotfullt vs. neutralt) — styrt av om
   händelsen är positiv, negativ eller vardaglig.
2. Dygns-/väderläge.
3. Närvaro/frånvaro av människor, och hur många.
4. Kameravinkel och avstånd (nära/intimt vs. vidvinkel/etablerande).
5. Grad av synlig skada/ordning — se §6.

---

## 5. MASTER STYLE PROMPT (engelska, återanvändbar)

Klistra in överst i varje händelseprompt, följt av det specifika motivet:

> **MASTER STYLE — Cinematic Tactile Realism:**
> A richly detailed, photographically-grounded image of a real Nordic place, rendered with
> naturalistic realism and only a subtle, deliberate degree of stylization in geometry and
> surface texture — not visible painterly brushwork, not low-poly or faceted geometry, not flat
> cartoon or anime style. People, when present, have individual, naturalistic faces with
> believable skin texture, age and weather marks, realistic proportions and lived-in clothing —
> never doll-like, clay-like, plasticky, or artificially smooth and retouched. Architecture is
> grounded Nordic vernacular — weathered wood, stone, concrete, brick, rusted or painted metal —
> built from materials that feel used and physical, with at most a barely perceptible geometric
> simplification, never toy-like or blocky. Nature — forest, fjord, mountain, tundra, farmland,
> coastline — is rendered with convincing physical behavior: natural wave motion, real reflections
> and foam in water, believable cloud structure and weather, vegetation with a subtly simplified
> but still believable structure. Lighting and atmosphere are realistic and governed by the
> specific scene rather than a uniform dramatic film treatment — can be bright, warm and hopeful,
> or cold, dim and threatening, or plain neutral daylight, depending on the subject. Rich, natural
> color grading — not an exaggerated orange-and-violet fantasy sunset palette, not oversaturated,
> not desaturated documentary grey. Wide 16:9 landscape framing, single clear focal point readable
> at a glance. No text, no UI elements, no logos, no watermark.

---

## 6. NEGATIVE PROMPT

Lägg till i slutet av varje prompt (eller i ChatGPT:s separata negativa fält om sådant finns):

> Avoid: visibly painted concept art with brushwork, manga/anime/comic-book style, low-poly or
> faceted geometry, toy-like or blocky stylized buildings, clay-like or plasticky oversimplified
> human figures, exaggerated or doll-like proportions, dramatic orange-and-violet fantasy sunset
> color grading, old faded documentary or archival photography look, security-camera or
> surveillance framing, a screen/monitor/frame device baked into the image, any text, UI elements,
> logos or watermarks.

---

## 7. ANALOG CONTROL ROOM TRANSMISSION (bildbehandlingslagret — separat från grundbilden)

Detta appliceras i KLIENTEN (CSS på `<img>`-elementet + två overlay-lager), INTE på bildfilen.
Grundbilder genereras alltid helt obehandlade (§2–6) — behandlingen läggs på ovanpå, och kan ändras
senare utan att bilderna behöver göras om igen.

**Vald variant: "C v3"** (efter tester av 0/A/B/C-v1/C-v2 på de två referensbilderna, se §8).
C v2 var för subtil (syntes knappt i spelkortets faktiska storlek). C v1 var för mörk/färgdämpad.
C v3 utgår från C v1 men med högre mättnad/ljusstyrka och svagare overlay.

**Effekt:** en tydlig men naturlig varm guldton (samma familj som `--gold:#C9A94F`), något djupare
skuggor, diskret vinjettering/fosforglöd i kanterna, en mycket mild signalvariation. INGEN kraftig
oskärpa, INGEN tydlig bildförvrängning, INGA stora scanlines, INGEN sepiaeffekt, INGEN arkivfilms-
känsla, INGEN extra ram eller skärm, INGEN text/UI i bilden. Ska kännas som en levande
direktsändning genom ett analogt system, inte ett gammalt fotografi. Gröna skogar ska fortfarande
vara gröna, blått vatten blått, röda varningsljus röda — filtret förenar bilderna, förstör inte
deras individuella färger.

**Exakta värden (testade i `design/handelsebild-C-v3-test.html`, antecknade i Kontext/beslut.md):**
```css
#ov-event img { filter: contrast(1.05) saturate(.88) brightness(1.05); }
/* overlay 1 — varm guldton, soft-light */
background: linear-gradient(135deg, rgba(240,179,60,.08), rgba(10,8,5,.15));
mix-blend-mode: soft-light;
/* overlay 2 — fosforglöd i kanterna, mycket mild signalvariation */
box-shadow: inset 0 0 50px rgba(201,169,79,.20), inset 0 0 14px rgba(201,169,79,.10);
animation: signalvar 5s ease-in-out infinite; /* opacity 1 → .94 → .88 → .94 */
```

**Status: VALT men INTE implementerat i `spel.html`.** Väntar enligt beslut — se `Kontext/beslut.md`
(2026-11-19) och fråga 2 i öppna frågor nedan.

---

## 8. Referenser till godkända testbilder

- **GRÖNA FONDEN-referens:** `design/referensbilder/gronafonden-fotoref.png` — äldre skäggig man
  tar emot kuvert från en kvinna, får, stuga, fjord, vindkraftverk i bakgrunden. Den fotorealistiska
  versionen, INTE den äldre/mer illustrerade `assets/event_gronafonden.png`.
- **STAD MINOR-referens:** `design/referensbilder/stad_minor-fotoref.png` — pendlare vid spårvagn
  och trafikstockning i regnig skymning, byggkranar i bakgrunden. Den fotorealistiska versionen,
  INTE den sparade SPELKONST-versionen (`assets/event_stad_minor.png`, stark orange solnedgång).
- **Bildbehandlingstest:** `design/handelsebild-C-v3-test.html` (Original/C v1/C v3 i spelkortets
  faktiska storlek, 840×430).
- **Tidigare stiltester (historik, ej raderade):** `design/HANDELSE-VISUAL-STYLE-GUIDE.md` (v0.1,
  SPELKONST), `design/handelsekort-rapport-prototyp.html`, `design/handelsebild-signalbehandling-
  prototyp.html`, `design/handelsebild-C-stadminor-test.html`, `design/handelsebild-C-v2-test.html`.

---

## 9. Checklista för kvalitetskontroll av nya bilder

- [ ] Är människor (om de finns) naturliga — INTE lerfigurer, dockor eller överdrivet stiliserade?
- [ ] Är personen SYNLIGT ANNAN än i andra redan genererade händelsebilder (ålder/hår/kön
      varierat, ingen återkommande huvudperson av misstag via stilreferensen)?
- [ ] Är vatten/moln/väder fysiskt trovärdigt — INTE konceptkonst-stiliserat?
- [ ] Om bakgrunden visar ett annat område — är det ett GRANNOMRÅDE enligt kartans geografi
      (åker↔skog, åker↔tundra, skog↔stad, tundra↔stad), inte ett diagonalt/orimligt avstånd?
- [ ] Är färgläggningen naturlig — INTE en överdriven orange-violett fantasy-solnedgång?
- [ ] Syns minor/major-skillnaden i SJÄLVA MOTIVET (omfattning av skada), inte bara i färgton?
- [ ] Ett tydligt huvudmotiv, läsbart inom några sekunder?
- [ ] 16:9, ingen text, ingen UI, inga loggor?
- [ ] Känns bilden som samma nordiska värld som kartan/trailern, UTAN att kopiera kartans
      low-poly-stil eller trailerns rena fotoreal-ö-stil?
- [ ] Skulle bilden fortfarande kännas rätt efter att Analog Control Room Transmission (§7) lagts
      på ovanpå (dvs. är den tillräckligt färgstark/kontrastrik för att tåla den varma guldtonen)?

---

## Vad som INTE är gjort i det här dokumentet

Inga bilder har genererats. Inga befintliga filer (bilder, `spel.html`, CSS, JS, `spec/`, `src/`,
`server/`) är ändrade. `design/HANDELSE-VISUAL-STYLE-GUIDE.md` (v0.1) och alla tidigare prototyper
ligger kvar oförändrade. `design/HANDELSE-BILDPROMPTS.md` (de ursprungliga 24 promptarna) ligger
kvar oförändrad — de nya promptarna enligt den här guiden finns i en separat, ny fil:
`design/HANDELSE-BILDPROMPTS-v2.md`.
