# Eco Loco — Mellan · byggpaket för Fable 5

Det här är underlaget för att bygga **mellanversionen** av Eco Loco: en självständig, självfacilerande webbversion (~15 min) som behåller kärnkonflikten men skär bort krånglet. Den ska kunna köras med spelledare + Blocks-lager ovanpå, och senare i skarp drift som multiplayer mellan flera NUC-datorer med samma MQTT-söm som den fysiska riggen redan använder.

Du (Fable) bygger detta **i fyra faser, i ordning**. Stäm av med Josef mellan fas 1→2 och fas 2→3.

---

## Läs först (ändra inte reglerna)
1. `design/GAME-DESIGN.md` — spelets kärna, regler, parametrar, de fyra områdena, 12 byggnaderna, awards, topplistor.
2. `spec/engine.js` — **den körbara spelmotorn = källan till sanning för reglerna.** Ren modul, ingen DOM. Rör inte balans/regler utan avstämning; siffror som får tunas ligger i configen överst i filen och i `spec/assets.json`.
3. `spec/mock-opponents.js` — enkel AI som fyller de lag du inte styr, för test på en skärm. **Slängbar** — ersätts av nätverksspelare i skarp drift.
4. `ARCHITECTURE.md` — hur mock-nu blir riktig multiplayer mellan NUCar, MQTT-sömmen och driftskraven.

---

## FAS 1 — Rita ön + färgsätt lagen
- Rita en **stiliserad 2D-karta** i samma anda som Josefs nuvarande UI (referensbilder i `Referens spelrigg/` = foton på riggen och hur det ser ut när man spelar, och `Referens UI/` = digitalt UI/skärmdelar — tolka dem, återskapa dem inte), med **fyra färgade områden**: Åkermark (gul), Skog (grön), Tundra (orange), **Stad (grå, ny)**. Se `design/UI-AND-MAP.md`.
- Lägg **10 fasta byggplatser (slots) per område** och skriv ut deras koordinater till `spec/assets.json` (fältet `slots`).
- **Justera lagens loggor efter öns färger** — områdesfärgen *är* lagfärgen (gul/grön/orange/grå). Färga om de fyra företagsloggorna därefter.
- Leverera detta som en visning till Josef innan du går vidare.

## FAS 2 — Föreslå UI (stäm av innan du bygger)
- Utgå från **referensbilderna** i `Referens spelrigg/` (rigg + spel) och `Referens UI/` (digitalt UI) — tolka känslan, bygg eget, återanvänd dem inte som grafik — + hur spelet faktiskt fungerar (`spec/engine.js`).
- **Full layout-frihet:** innehållsgrupperingen i prototypen är logisk, men UI:t behöver inte trängas in i den slimmade ramen. En **dashboard där allt syns samtidigt** och en **ö som inte är centrerad** är helt okej — föreslå det du bedömer mest begripligt. Josef är redo att byta UI helt.
- Ge ett **UI-förslag grundat i teori och praktik** för maximal begriplighet — se checklistan i `design/UI-AND-MAP.md`. Målgrupp: besökare/skolgrupper, låg insättningströskel, touch-skärm, självfacilerande.
- **Presentera förslaget för Josef och få okej innan du börjar bygga.**

## FAS 3 — Bygg den spelbara versionen (mock)
- Bygg det som nuvarande prototyp gör, men mot den riktiga motorn, dina assets, kartan och ljudet:
  - En spelare styr sitt lag; `mock-opponents.js` sköter de andra tre.
  - Koppla motorns **hooks** (se nedan) till: byggnad droppar på slot + kontoanimation, öhälsa-mätare + de fem ölägena (overlay + soundscape), tre bygg-ljud, årsbokslut-awards, Börsen + Klimatregistret, din årsberättelse.
  - Config/`assets.json` läses **live** (ingen omkompilering för att tuna balans/byta asset).

## FAS 4 — Förbered skarp drift (bygg inte klart, men strukturera för det)
- Håll `engine.js` nätverksfärdig (den kör oförändrad även server-side i Node). Motståndare = mock nu → nätverksspelare sen genom att byta ut `mock-opponents.js` mot en nätverksklient.
- Stubba den server-auktoritativa multiplayern (WebSocket) + **MQTT-sömmen** (`ecoloco/<bänk>/...`, oförändrade topics) + driftskraven. Se `ARCHITECTURE.md`.

---

## Motorns hooks (koppla vy mot dessa — rör inte reglerna)
`engine.on('<event>', cb)`:
- `start` / `roundStart` `{round}`
- `build` `{teamId, area, card, slotIndex, cost}` — rita byggnad på slot + kontoanimation + bygg-ljud (tier)
- `trade` `{from, to, give, giveCur, get, getCur}`
- `proposalOpened` / `proposalResolved` `{type, votes, passed}`
- `income` `{teamId, pengar, material}`
- `ohalsa` `{value, mode, delta}` — mode ∈ superdaligt|daligt|neutralt|bra|mycketbra → overlay + soundscape
- `award` `{round, led, eld, sab}` — ceremonin (tre pop-ups)
- `event` `{namn, loss}` — katastrof
- `roundEnd` `{round}` / `gameEnd` `{won, reason, winner, klimatbov}`

## Vad som INTE får krångla till sig
- Spelaren möter alltid bara **tre val**: smutsig / standard / grön. Det är huvudrubriken oavsett område.
- All UI-copy på **svenska**.
- **Offline/LAN-först** — inget internetberoende i drift.
- Behåll MQTT-topic-namnen så den fysiska riggen fungerar oförändrad.
