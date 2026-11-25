# Maktspelet (Eco Loco) — självfaciliterande webbspel för 2047 Science Center

> **Se [`RAMVERK.md`](RAMVERK.md) först** — invarianter, palett/ikon/typsnitt-konventioner och konflikt-checklista innan du utvecklar vidare i Maktspelet (fd Eco Loco).

En självfaciliterande webbversion av Eco Loco: behåll kärnkonflikten (individuell vinst mot gemensam
överlevnad av ön), skär bort krånglet. Server-auktoritativ multiplayer mellan flera NUC-datorer med
samma MQTT-söm som den fysiska riggen, + spelledar-/Blocks-lager ovanpå.

**Flerversion (beslut 2026-11-11): EN motor, tre jämbördiga varianter** — **Flash** (~8 min, 4 rundor),
**Mellan** (~25 min, 8 rundor) och **Skola** (~45 min). Varianterna skiljer sig genom config +
taggat innehåll, inte genom separata motorer/repon. Filträdet speglar detta (se nedan + `ARCHITECTURE.md`).

---

## Läs först
1. `RAMVERK.md` — arkitektur-kartan (§1), invarianterna och konflikt-checklistan. **Läs före en ändring.**
2. `ARCHITECTURE.md` — filträdet (motor / innehåll / variant-config), mock→drift, MQTT-sömmen, driftskraven.
3. `spec/engine.js` — den körbara spelmotorn = **källan till sanning för reglerna**. Ren modul, ingen DOM,
   **innehållstom**: regler + `DEFAULT_CONFIG`; allt innehåll bor i `spec/content/*`, per-variant-värden i
   `spec/config/variants/*`. Rör inte balans/regler utan avstämning.
4. `design/` — speldesign, UI-, ljud- och balansdokument (inte en del av filträds-/arkitektur-kartan).

## Filträd (kort)
```
spec/engine.js  effects.js  systems/     ← MOTOR (regler + DEFAULT_CONFIG, innehållstom)
spec/content/   buildings, teams,         ← INNEHÅLL (data; variant-tillhörighet taggas per post)
                proposals, dilemmas,
                company-crises/-events,
                ohalsa-events, gm-events, events
spec/config/variants/ flash, mellan,      ← PER-VARIANT CONFIG (override av DEFAULT_CONFIG)
                      skola, index
spec/assets.json                          ← MANIFEST (slots, ljud, config-overrides, läses live)
spec/mock-opponents.js  bot-policy.js     ← BOT/AI
server/server.js  variant-config.js       ← SERVER (auktoritativ) + buildEngineConfig
src/ui.js net.js map.js icons.js logos.js rigg.js mqtt.js audio.js   ← KLIENT
```

---

## Bygg-faserna (historik)
*Nedan är den ursprungliga byggbriefen för Fable 5 (hur mellanversionen byggdes från grunden i fyra
faser). Bygget är genomfört — multiplayer, drift och flerversion finns — så detta är bakgrund, inte en
att-göra-lista. Vidareutveckling styrs av `RAMVERK.md` + `att-gora.md` (i Klaras Kontext).*

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
