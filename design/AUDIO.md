# Ljud — brief

Peka färdiga ljudfiler i `spec/assets.json → audio`. Prompterna nedan är för ett SFX-genereringsverktyg (t.ex. ElevenLabs SFX). Håll allt kort och tydligt — flera lag kan bygga nästan samtidigt vid bokslut.

## De tre signatur-byggljuden (viktigast)
Ett per nivå, designade som en **tonal trappa** så bordet hör *vad* som valdes även när flera bygger samtidigt. Spelas på motorns `build`-event, väljs på `card.tier`.

- **Smutsig** — lågt, dissonant, industriellt; kort muller + metallklang + antydan skorsten. Instinktivt "oj då". ~0,8 s.
  > prompt: "short low industrial machine clank with a dull rumble and a puff of steam, slightly dissonant, ominous, game build sound, ~1s, no music"
- **Standard** — neutralt mekaniskt "thunk"; mittemellan, varken bra eller dåligt. ~0,6 s.
  > prompt: "short neutral mechanical construction thunk, a single wooden-and-metal placement sound, plain and clean, game build sound, ~0.6s, no music"
- **Grön** — ljust, organiskt, konsonant; mjukt pling + löv/vind. Instinktivt "skönt". ~0,9 s.
  > prompt: "short bright organic chime with a soft sprout/leaf shimmer and a gentle wind, pleasant and harmonic, game build sound, ~1s, no music"

De kan även mata öns soundscape (många smutsiga → ambiensen mörknar).

## Grund-SFX
- **Val/klick:** "soft UI tap, clean, short"
- **Byteshandel klar:** "quick coin/resource exchange chime, light, ~0.7s"
- **Förslag läggs / röstning:** "short wooden gavel tap, civic, ~0.5s"
- **Förslag antaget / föll:** "brief positive two-note confirm" / "brief soft negative buzz"
- **Runda börjar:** "gentle round-start bell, hopeful, ~1s"
- **Katastrof-event:** "short dramatic warning sting, low brass hit with alarm tail, ~1.5s"

## Award-stingar (tre olika)
- 🏆 Ledande: "triumphant short brass fanfare, celebratory, ~1.5s"
- 🌱 Eldsjäl: "warm uplifting short chime, wholesome, ~1.3s"
- 💀 Sabotör: "comedic ominous short sting, playful shame trombone wah, ~1.3s"

## Slutstingar
- Vinst (ön klarade sig): "warm victorious resolve, bright and hopeful, ~2.5s"
- Förlust/kollaps: "somber descending sting, muted, ~2.5s"

## De fem öhälso-ambienserna (loopar, korsfadas på `ohalsa`-event)
- **superdaligt (0–20):** "bleak industrial ambience loop, distant coughing crowd, machinery hum, wind, oppressive"
- **daligt (20–40):** "muted industrial ambience loop, faint machinery, occasional bird, uneasy"
- **neutralt (40–60):** "balanced ambient loop, light wind, faint town and nature mixed, calm"
- **bra (60–80):** "pleasant nature ambience loop, birdsong, light breeze, faint cheerful voices"
- **mycketbra (80–100):** "joyful thriving ambience loop, lively birds, gentle festive murmur, warm and bright"

Korsfada mjukt mellan lägena (~1–2 s) så skiften inte skär.
