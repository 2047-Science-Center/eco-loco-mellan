# Förstärkningsriggen — signalkontrakt (fruset gränssnitt)

Två lager. Spelet känner bara till lager 1. Firmwaren känner bara till lager 2.
Hjärnan (Python-stubb nu → Blocks sen) översätter mellan dem.

```
spel (src/rigg.js) ──semantik: ecoloco/rigg/*──► HJÄRNA ──granulärt: ecoloco/rigg/out/led|fx|spot──► ESP32
                                                   │
                                                   └──► ljud (pygame nu / Blocks media-spot sen)
```

Migration A→B och Python→Blocks är osynlig nedåt: båda lagren nedan är frusna.

---

## Lager 1 — semantiskt (spel → hjärna)

| Topic | När | Payload | Retained |
|-------|-----|---------|----------|
| `ecoloco/rigg/scen` | fasbyte | `attract` \| `runda` \| `awards` \| `slut` | ja |
| `ecoloco/rigg/ohalsa` | vid ändring under runda | `1`–`100` (heltal) | ja |
| `ecoloco/rigg/award` | vid varje prisuppläsning | `{"typ":"sabotor\|foretagare\|eldsjal","lag":"aker\|skog\|tundra\|stad"}` | nej |
| `ecoloco/rigg/wave` | bokslut börjar (`resolveStart`) | `1` = starta wave, `0` = stopp | nej |
| `ecoloco/rigg/paus` | spelet pausas/fortsätter (skärmknapp / arkadknapp / Blocks) | `1` = pausad (lugn blå bas + långsam wave + paus-ljud, hålls tills `0`), `0` = återgå till rundans look | nej |
| `ecoloco/rigg/countdown` | 10 s kvar | `1` = starta, `0` = stopp | nej |
| `ecoloco/rigg/ceremoni` | startceremonin (tutorial→runda 1), skickas från skärmen | `countdown` = riser-soundscape + LED-chase 1–4 + klockljud · `climax` = vitt ljus i 3 s · `runda1` = fade till rundans look | nej |
| `ecoloco/rigg/blandare` | spelet vill köra blandaren (valfri cue, ej inkopplad i rigg.js än) | `1` = på, `0` = av | nej |
| `ecoloco/rigg/ljud` | central "show"-ljud (ej på skärmen) | ljud-id/filnamn, t.ex. `round_start`, `win`, `lose`, `relief`, `proposal_open`, `event_storm.mp3` | nej |
| `ecoloco/rigg/kris` | KRIS på/av. Latchas av `crisis`-event (öh ≤ krisZon). En visad företags-/öhälsohändelse med special-cue `kris` pulsar larm och återställer sedan topicen till sanningen (`inCrisis`) efter händelsepausen. | `1` = på, `0` = av | nej |
| `ecoloco/rigg/gm/alla_grona` | special-cue `fanfar` (stora positiva vändningar) → "allt grönt"-look. Återställs till `0` efter händelsepausen. | `1`/`0` | nej |
| `ecoloco/rigg/trailer` | intro-trailern (systemceremoni, alltid, även i spelledarläge). Servern skickar `1` på filmens `start_at` (samma klocka som skärmarna) och `0` vid filmens slut, skip och avbrott | exakt `1` = hjärnan spelar `assets/audio/rigg/trailer.mp3` i centralhögtalaren (tystar attract-ambiencen); allt annat = stopp. **Aldrig JSON** (tolkas som stopp) | nej |
| `ecoloco/rigg/final` | KRÖNING efter sista prisutdelningen (sista steget klickat) | `{"result":"win"\|"lose","lag":"aker\|skog\|tundra\|stad"\|null}` (ren sträng `win`/`lose` accepteras också) → hjärnan: mörker → kort paus → ljus + fanfar (vinnarsidan tänds vid vinst) | nej |
| `ecoloco/rigg/handelse` | **NY 2026-11-27** — en händelse visas, eller ett beslut (sponsrat/dilemma) öppnas/avgörs. Ljudet skickas separat på `ecoloco/rigg/ljud` | `{"id":"skog_major","ljus":"stor\|liten\|hela\|eko\|bra\|val\|av","lag":["skog"]}` (tabell: `spec/assets.json` → `handelser`). `stor` = lagets sida blinkar djup orange + spot (8 s) · `liten` = sidan pulserar gulorange + spot (4 s) · `hela` = kallt blåvitt flimmer (6 s) · `eko` = sidorna tappar ljuset i tur och ordning (6 s) · `bra` = grönt på lagets sida + spot/pil mot den bänken, annars våg runt alla (6 s) · `val` = guldpuls tills `av`. Rött/blandare är reserverat för `ecoloco/rigg/kris`. Ersätter de gamla händelse-cuesen `wave`/`kris`/`gm/alla_grona` | nej |
| `ecoloco/rigg/intro` | **NY 2026-11-27** — introt efter trailern (systemceremoni, även i spelledarläge) | `1` = spela `intro_badd.mp3` + `event_ident` vid 5,8 s · `0` = stoppa · `vanta` = `soundscape_1` tills nedräkningen börjar | nej |
| `ecoloco/rigg/kroning` | **NY 2026-11-27** — kröningsceremonin (Mellan + Flash), ersätter `final` där. Servern skickar stegen på filmklocka (tidslinje: `spec/kroning.js`) | `{"steg":"rum\|meddelande\|rakna\|overlevde\|foll\|slack\|vagg\|tand\|ut\|duell\|kvar\|blixt\|krona\|ingen\|dampa\|on_dod\|on_foll\|lugn\|kort\|meddelande_bort","lag":"aker"\|["skog","aker"]\|null,"vunnet":true\|false}` — ljus och ljud per steg: se `apply_kroning` i `tools/hjarna-stubb.py` | nej |

Retur-kanal (spelledarpanel → server, icke-retained): `ecoloco/spel/gm`
| Payload | Effekt (server.js) |
|---------|--------------------|
| `{"cmd":"gm","on":true\|false}` | serverns GM-läge: händelser via ja/nej (på) eller 50 %-auto (av) + award-takt |
| `{"cmd":"pengaslapp"}` | +10 pengar & +10 material till alla fyra lag (under pågående runda) |
| `{"cmd":"event","beslut":"ja"\|"nej"}` | kör/hoppa rundans händelseförslag (GM-läge, en gång/runda) |
| `{"cmd":"award_next"}` | stega award-ceremonin ett pris (GM-läge) |

GM (master, bryter spelet): `ecoloco/rigg/gm/<kommando>`
| Topic | Payload |
|-------|---------|
| `ecoloco/rigg/gm/alla_grona` | `1` / `0` |
| `ecoloco/rigg/gm/spot/<1-4>` | `0` / `1` |
| `ecoloco/rigg/gm/blandare` | `0` / `1` |
| `ecoloco/rigg/gm/ljud` | ljud-id (sträng) |
| `ecoloco/rigg/gm/master` | `1` = GM tar över (ignorera spelets cues), `0` = släpp |

---

## Lager 2 — granulärt (hjärna → firmware). Firmwaren renderar bara primitiver.

| Topic | Payload | Firmware gör |
|-------|---------|--------------|
| `ecoloco/rigg/out/led/<1-4>` | `{"h":0-360,"s":0-100,"v":0-100,"puls":0-100,"blink":0-100}` | sätter sida N:s grundfärg + puls/blink-takt (lokalt) |
| `ecoloco/rigg/out/fx` | `{"fx":"none\|wave\|countdown\|chase","speed":0-100}` | helslinge-overlay (tombola-wave / vit nedräkningspuls / `chase` = ljusband som sveper ca 28 LED/s från godtycklig startpunkt, rigg_arduino.ino rad 97–113) |
| `ecoloco/rigg/out/spot/<1-4>` | `0` / `1` | relä av/på (aktiv-låg-flagga i firmware) **och** i `rigg_arduino.ino` pil-segment N (ljusvåg mot spetsen, pekar mot bänk N) |
| `ecoloco/rigg/out/blandare` | `0` / `1` | saftblandar-relä av/på (egen aktiv-låg-flagga, boot-säker i firmware) |

Sida→punktintervall är en **konstant i firmwaren** (t.ex. `LAG_A = 0..34`), bytbar när antal punkter ändras.

---

## Mappning: öhälsa → look  (hjärnan räknar; de 5 lägena = motorns `ohMode()`)

| ohMode (öhälsa) | Din look | `ecoloco/rigg/out/led/*` alla sidor | Ljud (edge) |
|-----------------|----------|--------------------------|-------------|
| superdaligt ≤20 | kris: alla blinkar alarm | h0 s100 v100 blink80 | kris-alarm |
| daligt ≤40 | svagt alarm | h0 s100 v50 puls30 | – |
| neutralt ≤60 | svagt pulserande gult | h50 s100 v35 puls40 | – |
| bra ≤80 | ljusgrönt | h110 s90 v70 | – |
| mycketbra >80 | puls ljus→mörkgrön | h125 s100 v70 puls60 | – |

## Mappning: award → look  (kumulativt, läst ur engine.getState().teams)

| typ | mätvärde (kumulativt) | vinnarsidan | övriga sidor | spot | ljud |
|-----|----------------------|-------------|--------------|------|------|
| `sabotor` | mest negativ `impactNeg` (`worstPolluter`) | h0 s100 v100 (skarp röd) | v0 | vinnarens | sab-ljud |
| `foretagare` | mest total förmögenhet (`richest`/`bors[0]`) | h110 s90 v90 (ljusgrön) | v0 | vinnarens | företagar-ljud |
| `eldsjal` | högst `impactPos` | h135 s100 v70 (mörkgrön) | v0 | vinnarens | eldsjäls-ljud |

Paus = systemsignal: `paus/1` → alla sidor `h210 s70 v14` + `fx {wave speed15}` (hålls), `paus/0` → `fx none` + rundans öhälso-look. Går ut även i spelledarläge och kringgår GM-master (riggen ska alltid visa paus). Ambiencen rörs ej.
Wave = `ecoloco/rigg/out/fx {wave}` under `resolveStart`→första award. Countdown = `ecoloco/rigg/out/fx {countdown}` + alla sidor vitt (h0 s0 v80) vid 10 s kvar.
GM `alla_grona` = alla sidor h120 v90, spots släckta. GM master-flagga → hjärnan ignorerar spelets cues tills `0`.

---

## Award-tidssättning: Option A (prototyp) → B (drift)

- **A (nu):** `src/rigg.js` äger en egen 10 s-sekvens ur `resolveStart` + `award`-datan. Rör inte ui.js.
- **B (drift):** auktoritativ sekvenserare i `server.js` fyrar tidsatta steg; skärm + rigg lyssnar. Samma `ecoloco/rigg/*` publiceras → firmware/hjärna/Blocks oförändrade.

## Hjärnan: Python-stubb nu → Blocks sen

`hjarna-stubb.py` = paho-mqtt + mappnings-tabellerna ovan + pygame för ljud + master-flagga.
Blocks = samma tabeller som Tasks + variabler; MQTT som Network Device; ljud som media-spot; GM som kontrollyta.
Tabellerna ovan ÄR specen Blocks översätter. IN/UT-kontrakten är frusna → bytet är osynligt för spel och firmware.

---

## Intro-trailern (v2, 2026-11-25)

Filmen är ett HTML-paket i `assets/trailer-film/` (HyperFrames, 69,3 s). Skärmarna spelar det **tyst** i en iframe
(`skarm.html?start_at=<epoch-ms>`), synkat mot serverns klocka på `GET /time`. Masterljudet spelas centralt av
hjärnan (`ecoloco/rigg/trailer` = `1`, filen `assets/audio/rigg/trailer.mp3`).

**Ljus-cuesen** fyras av servern (`playTrailer`) ur filmens egen cue-fil `assets/trailer-film/rigg-cues.json`
(genereras ur filmens tidslinje i källprojektet `ecoloco-produktion/trailer-film`, `verktyg/bygg-rigg-cues.py`).
Servern skickar dem som lager 2 direkt (förbi hjärnans översättning), som tidigare trailern. Servern släpper bara
igenom de topics och format firmwaren hanterar:
- `out/led/1–4` med JSON-objekt;
- `out/fx` med `none`, `wave`, `countdown` eller `chase`;
- `out/spot/1–4` och `out/blandare` med `0` eller `1`;
- `ecoloco/rigg/trailer` med exakt `1` eller `0`.

Allt annat avvisas med en varning.

**Säker släckning:** vid filmslut (cue c20), skip och avbrott (`stopTrailer`) sätts blandaren, fx, pilarna och
alla sidor till av.

Längden (`film.json` → `duration_s`) styr skärmens och flödets failsafes (`trailerDone` kommer vid filmens slut + 0,3 s).
