# Golden-baselines

Referensfångster av motorns beteende, används av `tools/golden-test.js` för regressions­testning.
Varje baseline är ett seedat, deterministiskt förlopp serialiserat med sorterade nycklar.

| Fil | Används i regression | Innehåll |
|---|---|---|
| `mellan-baseline-v3.json` | **JA (aktiv)** | Fullt parti, **config-styrt urval** (Slice 6B). 2026-11-18: årliga röd-zons-öhälsoförsämringen (−3/år) borttagen. 2026-11-19: röd-zons-RESURSförlusten (`eventLoss` −4/−4) borttagen → lagens resurser divergerar från baslinjen när ön är i röd zon (slut-öhälsa 62→65). |
| `events-baseline.json` | JA | Alla 8 händelser forcerade i GM-läge (effekter + selektorer, inkl. röst-händelsen). |
| `proposals-baseline.json` | JA | Alla 18 politiska förslags resolution (effekt-verkställning per förslag). |
| `mellan-baseline-v2.json` | **NEJ (historisk)** | Fullt Mellan-parti, legacy grund-3-urval (`powerFromRound=2`). |
| `mellan-baseline.json` | **NEJ (historisk)** | Fullt Mellan-parti, äldsta beteendet (`powerFromRound=1`), pre-2026-11-16. |

## Varför v3?

2026-11-16 (Slice 6B) togs motorns legacy-urval bort (de tre obligatoriska grundförslagen). Nu är
ALLA förslag jämbördiga i ett config-styrt urval (5/år ur banken). Default-motorn (`new EcoLoco()`)
får detta urval ur `DEFAULT_CONFIG`. Det ändrar vilka förslag mellan-scenariot öppnar → ny aktiv
baseline `mellan-baseline-v3.json`. De tidigare (v1/v2) behålls orörda som historik.

## Varför två mellan-baselines?

2026-11-16 ändrades `DEFAULT_CONFIG.powerFromRound` från `1` till `2` (godkänt). Det gör att
**första Ö-rådet (efter år 1) leds av Oxen/aker** i stället för Björnen/skog, och rotationen
fortsätter aker → skog → räven → örnen.

Ändringen gäller **enbart ordföranderotationen** (`powerTeam` + relaterad metadata som
`proposedBy`). Verifierat: **lagens resurser, öns hälsa och alla spelutfall är oförändrade** mot
den historiska baselinen — endast vilket lag som är ordförande varje Ö-råd skiljer.

`mellan-baseline.json` behålls orörd som historisk referens och ingår **inte** i de löpande
regressionstesterna (den skulle annars flagga den avsiktliga ändringen som ett testfel).
`mellan-baseline-v2.json` är den aktuella regressions­baselinen.

Regenerera den aktuella baselinen (efter en *avsiktlig* beteendeändring) med:
`node tools/golden-test.js --write`
