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

Spelas i loop på halv volym (`AMB_VOL`, default 0.5) hela rundan, tystnar vid nedräkning och under awards. Stingarna ovan mixas ovanpå. Rent atmosfäriska soundscapes i husstilen (sliten PA, rör/band, subtilt bakgrundsskrap — inga fåglar/röster/maskiner). Numret = stämnings-preset OCH öhälso-läge: **1 = mörkast/kris → 5 = ljusast/glad**.

| Fil | Preset | Öhälsoläge (AUTO) | Stämning |
|-----|--------|-------------------|----------|
| `soundscape_1.mp3` | 1 | superdåligt (≤20, kris) | mörk, tung, tryckande |
| `soundscape_2.mp3` | 2 | dåligt (≤40) | orolig, grå |
| `soundscape_3.mp3` | 3 | neutralt (≤60, start) | balanserad, lugn |
| `soundscape_4.mp3` | 4 | bra (≤80) | varm, hoppfull |
| `soundscape_5.mp3` | 5 | mycket bra (>80) | ljus, blomstrande |

**AUTO vs manuell:** i AUTO-läge byter dirigenten ambience efter öns hälsa (tabellen ovan). Spelledaren kan när som helst välja en fast stämning via panelens **STÄMNING**-knappar → topic `ecoloco/rigg/ambience` med `"1"`–`"5"` (manuell preset vinner över öhälsan) eller `"auto"` (åter till hälso-styrning). Se `AMB_FILE`/`AMB_PRESET`/`apply_ambience` i `tools/hjarna-stubb.py`.

`attract.mp3` loopar i viloläget före spelstart.
