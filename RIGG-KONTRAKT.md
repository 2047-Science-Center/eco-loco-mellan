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
| `ecoloco/rigg/countdown` | 10 s kvar | `1` = starta, `0` = stopp | nej |

GM (master, bryter spelet): `ecoloco/rigg/gm/<kommando>`
| Topic | Payload |
|-------|---------|
| `ecoloco/rigg/gm/alla_grona` | `1` / `0` |
| `ecoloco/rigg/gm/spot/<1-4>` | `0` / `1` |
| `ecoloco/rigg/gm/ljud` | ljud-id (sträng) |
| `ecoloco/rigg/gm/master` | `1` = GM tar över (ignorera spelets cues), `0` = släpp |

---

## Lager 2 — granulärt (hjärna → firmware). Firmwaren renderar bara primitiver.

| Topic | Payload | Firmware gör |
|-------|---------|--------------|
| `ecoloco/rigg/out/led/<1-4>` | `{"h":0-360,"s":0-100,"v":0-100,"puls":0-100,"blink":0-100}` | sätter sida N:s grundfärg + puls/blink-takt (lokalt) |
| `ecoloco/rigg/out/fx` | `{"fx":"none\|wave\|countdown","speed":0-100}` | helslinge-overlay (tombola-wave / vit nedräkningspuls) |
| `ecoloco/rigg/out/spot/<1-4>` | `0` / `1` | relä av/på (aktiv-låg-flagga i firmware) |

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
