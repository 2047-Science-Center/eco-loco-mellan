# Rigg-ljud (placeholders)

Lägg ljudfiler här med dessa namn. Hjärna-stubben spelar dem via `afplay`.
Saknas en fil hoppas den bara över (du ser "(ljud saknas: …)" i loggen) — så du kan
börja med bara några och fylla på. Valfritt format som afplay klarar: .wav/.mp3/.m4a/.aiff.

| Fil | Spelas när |
|-----|-----------|
| `kris.wav` | öhälsa går in i kris-läget (≤20) |
| `attract.wav` | scen = attract (intag) |
| `countdown.wav` | nedräkning (10 s kvar) |
| `award_sabotor.wav` | award: sabotör |
| `award_foretagare.wav` | award: företagare |
| `award_eldsjal.wav` | award: eldsjäl |

GM-ljud: det du publicerar som `gm-ljud <id>` spelar `<id>.wav` härifrån (t.ex. `gm-ljud ding` → `ding.wav`).

## Soundscapes (kontinuerliga loopar)

Spelas i loop på halv volym (`AMB_VOL`, default 0.5) hela rundan, byts med öns hälsa, tystnar vid nedräkning och under awards. Stingarna ovan mixas ovanpå.

| Fil | Öhälsoläge | Stämning |
|-----|-----------|----------|
| `soundscape_1.mp3` | superdåligt (≤20) | upprorsstämning |
| `soundscape_2.mp3` | dåligt (≤40) | spänd/orolig |
| `soundscape_3.mp3` | neutralt (≤60) | lugn (= start-vibe) |
| `soundscape_4.mp3` | bra (≤80) | varm/positiv |
| `soundscape_5.mp3` | mycket bra (>80) | glatt |

Alla har subtil mänsklig chatter inblandad. `attract.mp3` loopar i viloläget före spelstart.
