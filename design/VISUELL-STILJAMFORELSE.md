# Visuell stiljämförelse — underlag för en gemensam profil

*Skrivet 2026-11-19 av Claude, på begäran av Klara: en nulägesbild av alla visuella stilar som
just nu finns i spelet, så hon har underlag för att bestämma en mer enhetlig profil. Ren
research/sammanställning — inga beslut tagna här.*

## Sammanfattning

Spelet har just nu **minst sex olika visuella språk** i aktiv användning samtidigt, utan en
gemensam nämnare mellan dem. Ingen är "fel" i sig, men de drar åt olika håll: två är ljusa och
tecknade/lekfulla, tre är mörka och filmiska/vuxna, och den nyaste (SPELKONST, under test just nu)
är ett försök att hitta något mitt emellan. Nedan: vad som finns, var det syns, och hur de skiljer
sig åt.

---

## 1. UI-kromet (själva gränssnittet, `spel.html` CSS)

Det spelarna faktiskt KLICKAR på — knappar, paneler, siffror. Inte AI-genererade bilder, utan
kodad design.

- **Känsla:** retro analog kontrollpanel från den fysiska riggen.
- **Palett:** mörk oliv/brun bakgrund (`--bg:#121009`, `--panel:#211E17`), guldaccent
  (`--gold:#C9A94F`), LED-färger för status (gul/röd/grön).
- **Typsnitt:** Oxanium (rubriker) + Chakra Petch (siffror, monospace-känsla).
- Detta är den enda stilen som är **helt låst** av den fysiska riggens formspråk — allt annat är
  friare.

## 2. Ö-kartan + byggnadsikonerna (`assets/Karta 1.2.png`, `assets/aker_standard.png` m.fl.)

**Det spelarna tittar på mest under hela spelet** — kartan är alltid synlig, byggnader läggs till
kontinuerligt.

- **Känsla:** ljus, glad, "mobilspel"-aktig low-poly-diorama. Rundade fasetter, klarblå himmel-
  frånvaro (ingen himmel, isolerad diorama), varma mättade färger (gult fält, grönt skogsklot,
  orange tundra, grått stadsklot).
- **Rendering:** stiliserad 3D-render, men LJUS och LEKFULL — snarare Monument Valley/mobilspel än
  seriöst strategispel. Byggnaderna (gård, lada, traktor) är charmiga och detaljerade men inte dystra.
- Det här är den **mest laddade** stilen att ändra — all kart-/byggnadslogik (slots, placering,
  öhälso-overlay) är byggd mot just den här bildens koordinater och look.

## 3. Lag-emblemen / kröningsbilderna (`assets/makt/*.png`, `assets/slut/arets-foretag-*.png`,
`assets/intro/borgmastare.png`)

Visas vid maktrotation, tutorial, och spelets avslutning.

- **Känsla:** mörk, dramatisk, "institutionell trofé" — fasetterade bronsmetall-djurhuvuden
  (bison/björn/varg/örn) på en mörk metallvägg, strålkastarljus, guldaccent.
- **Rendering:** stiliserad 3D-render, men MÖRK och SERIÖS — raka motsatsen till kartans ljusa ton
  trots att båda tekniskt är "low-poly 3D-render".
- Dokumenterad stilrad: **Stilrad LÅG-POLY** (`design/SLUT-BILDPROMPTS.md`).

## 4. Trailer/slutfilm-landskapen (`design/TRAILER-INTRO.md`, `design/VINST-FORLUST-FILM-PROMPTS.md`)

Den nordiska ön i stort, vid spelstart och slut.

- **Känsla:** filmisk, kall, FOTOREALISTISK — snötoppar, norrsken (grönt/rött), fruset hav.
- Dokumenterad stilrad: **Stilrad FOTOREAL-Ö**. Blandas MEDVETET med låg-poly-emblemen i samma
  sekvenser (landskap=fotoreal, människogjorda symboler=låg-poly) — se SLUT-BILDPROMPTS.md §"Gemensam
  ton".

## 5. "Kontrollrummet" (`assets/eldsjal01.png`, `assets/sabotor_01.png`, referensbilderna du pekade
på i den här konversationen)

Award-ikoner (Eldsjäl/Sabotör) + den stämning du nyss sa att du vill att händelsebilderna ska
matcha.

- **Känsla:** mörkt, filmiskt, brutalistiskt 1960-talskontrollrum — bildskärmar, mätare, gröna
  CRT-glow, guldaccent.
- **Rendering:** FOTOREALISTISK/cinematisk, inte målad och inte low-poly. Lika mörk som emblemen
  (3), men en helt annan rendering-teknik (foto vs. 3D-render).

## 6. De åtta ORIGINALA händelsebilderna (`assets/event_storm.png`, `event_uppror.png`,
`event_torka.png`, `event_godskord.png` m.fl. — fanns innan den här sessionen)

- **Känsla:** målad, illustrerad halvrealism, nordiskt/atlantiskt tema.
- **Problem:** inkonsekventa SINSEMELLAN. `storm`/`skogsbrand`/`torka`/`godskord` är rena
  landskapsmålningar (ingen eller liten mänsklig figur). `uppror` är ett helt annat register —
  anime-liknande, fotorealistiska människor, engelska protestplakat ("OUR ISLAND OUR HOME").
  De känns som att de kommer från olika källor, inte en designad uppsättning.

## 7. De 16 NYA händelsebilderna — "HÄNDELSEKORT" (byggda i den här sessionen, `assets/event_aker_minor.png` m.fl. — se `design/HANDELSE-BILDPROMPTS.md`)

- **Känsla:** dämpad, desaturerad, dokumentär målad realism. Siktade medvetet på att matcha de
  BÄTTRE av originalbilderna (storm/torka/godskord), inte uppror-stilen.
- **Din feedback (2026-11-18→19):** för fotorealistisk/filmisk — känns som foto, inte spel.
  Matchar inte emblemens (3) eller kontrollrummets (5) "gjorda"-känsla.
- **Status:** 16 av 16 godkända och sparade i den här stilen, men beslut om omgörning är pausat i
  väntan på fler stiltester.

## 8. SPELKONST — ny riktning under test (idag, 2026-11-19)

- **Känsla:** målad spelkonst á la Blizzard/WoW-konceptkonst — grundad i verkligheten men tydligt
  ILLUSTRERAD, mättade färger, dramatisk belysning, synliga penseldrag, INGEN fotorealism/filmkorn/
  skärpedjup.
- **Status:** två testbilder godkända (`tundra_major`, en spelkonst-variant av oljefälts-kollapsen;
  `stad_minor`, trafikstockningen) — men stad_minor-testet efterfrågade ÄNNU mer "spelifierad"
  känsla, så iterationen pågår. Inget beslutat om det här ska bli den nya standarden för alla
  händelsebilder.

---

## Jämförelsetabell

| # | Vad | Var | Rendering | Mood | Mättnad |
|---|---|---|---|---|---|
| 1 | UI-krom | Hela spelet | Kodad design, ej bild | Retro-analog | Mörk, varm |
| 2 | Karta + byggnader | Spelplanen (ständigt synlig) | Stiliserad 3D-render | Ljus, glad, lekfull | Hög, klara färger |
| 3 | Lag-emblem/kröning | Maktrotation, avslut | Stiliserad 3D-render | Mörk, seriös, institutionell | Låg, en guldaccent |
| 4 | Trailer/ö-landskap | Start/slut | Fotorealism | Kall, filmisk | Låg, kall + en guldaccent |
| 5 | Kontrollrummet | Award-ikoner | Fotorealism/cinematisk | Mörk, brutalistisk | Låg, grön/guld-glow |
| 6 | Gamla händelsekort (8) | Slumphändelser | Målad, INKONSEKVENT internt | Blandad | Blandad |
| 7 | Nya händelsekort (16) | Alla nya händelser | Målad dokumentär realism | Dämpad, vuxen | Låg |
| 8 | SPELKONST (test) | Under utveckling | Målad spelkonst | Dramatisk men varm | Hög |

**Mönstret:** allt som spelaren ser MEST och interagerar med rakt av (UI, karta, byggnader — #1–2)
är LJUST och LEKFULLT. Allt som är "berättande"/atmosfäriskt (emblem, trailer, kontrollrum,
händelser — #3–8) är MÖRKT och mer vuxet/filmiskt — men splittrat mellan fotorealism och
3D-render och (nu) målad spelkonst, utan att dessa tre tekniker pratar med varandra.

## Öppna frågor att ta med dig

1. **Ska händelsebilderna närma sig kartans/byggnadernas ljusa, lekfulla ton** (#2 — den stil
   spelaren faktiskt lever i mest), **eller den mörkare "berättande" tonen** (#3/#4/#5 — den stil
   som redan dominerar emblem/trailer/kontrollrum)? SPELKONST-testet idag lutar mot det senare men
   varmare/mer mättat än #3–5.
2. Om SPELKONST blir standard för händelser — ska den **också** ersätta #6/#7 (de 24 händelse-
   bilderna totalt, gamla + nya), eller bara gälla framåt?
3. Finns det en poäng i att #2 (karta/byggnader) och #3 (emblem) är så olika trots att båda är
   "low-poly 3D-render"? Är det en medveten kontrast (spelplan=lekfull, makt/ceremoni=allvarlig)
   värd att bevara, eller en oavsiktlig splittring?
4. Ingen av de nuvarande stilarna matchar UI-kromets (#1) faktiska paletttokens exakt (`#121009`,
   `#C9A94F`) — värt att låta en vald bildstil citera den paletten mer medvetet?
