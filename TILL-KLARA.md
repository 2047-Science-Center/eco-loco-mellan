# Till Klara — så bygger du vidare i Maktspelet

Hej Klara! En kort men viktig spelregel för all vidareutveckling i det här projektet
(Maktspelet, mellanversionen — repot `eco-loco-mellan`).

## Den enda regeln: läs `RAMVERK.md` FÖRST

**Innan du (eller en AI-assistent) ändrar något i spelet — öppna och följ `RAMVERK.md` i repots rot.**
Den är "läs detta först"-dokumentet: arkitektur-karta, de orubbliga reglerna (invarianter),
konventioner (färger, typsnitt, ikoner) och en **konflikt-checklista**. Kör checklistan
**före och efter** varje ändring — den fångar precis den sortens krockar som annars smyger sig in.

Varför: spelet har byggts i flera parallella sessioner, och då uppstår lätt drift
(två paletter, emoji vs egna ikoner, gamla namn kvar osv). `RAMVERK.md` håller ihop helheten
och gör att vi inte råkar bygga saker som motsäger varandra.

## Om du bygger med en AI-assistent (t.ex. Claude)

Ge assistenten den här instruktionen i början av varje session, och säg ungefär:

> "Innan du föreslår eller gör någon ändring i det här projektet: läs `RAMVERK.md` i repots rot
> och följ den. Kör dess konflikt-checklista före och efter ändringen, och flagga om något krockar
> mot invarianterna. Uppdatera `RAMVERK.md` om en invariant eller konvention ändras."

Peka alltså assistenten på `RAMVERK.md` *först* — innan den börjar koda.

## Snabbkarta över dokumenten

| Fil | När |
|---|---|
| **`RAMVERK.md`** | **Läs först, alltid.** Regler + konventioner + konflikt-checklista. |
| `ARCHITECTURE.md` | Djupare om mock→drift-arkitekturen. |
| `RIGG-KONTRAKT.md` | Signalsömmen till ljus/ljud-riggen (semantiska cues). |
| `SPELINFO.md` / `design/GAME-DESIGN.md` | Vad spelet ÄR och reglerna bakom. |
| `spec/engine.js` | Motorn = sanning. **Rör aldrig balans/regler utan att stämma av med Josef.** |

## De fyra viktigaste "rör-ej / gör-så-här" (fullständig lista i `RAMVERK.md`)

1. **Motorn (`spec/engine.js`) är sanning** — ändra inte regler/balans utan beslut. Tuna via `spec/assets.json`.
2. **Inga nya npm-beroenden** och inga moln-/CDN-beroenden — spelet ska köra offline på plats.
3. **Färger via `:root`-tokens, siffror via `var(--font-num)`, symboler via `src/icons.js`** — inte hårdkodade hex/emoji.
4. **Spelet heter "Maktspelet" utåt** (i UI). Internt heter klassen/topicsen fortfarande `EcoLoco`/`ecoloco/*` — det ska vara kvar.

Hör av dig till Josef om något i `RAMVERK.md` känns oklart eller om du behöver bryta mot en invariant —
det går bra, men det ska vara ett medvetet beslut, inte en olycka. 🙌
