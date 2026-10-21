# Kontrollbord — spelspec (vad SPELET ska publicera per bänk)

Spec för publiceringen från spelmotorn till bänkarnas kontrollbord (Joels RP2040/Wiznet-firmware).
**Ändra ingen kod här** — detta är underlaget för huvudsessionen som bygger publiceringen.

> **Nyckelupptäckt:** publiceringen finns **redan** som en stubb i **`src/mqtt.js`**
> (`attachMqtt(engine)`). Den implementerar hela kontraktet nedan. Den är kopplad i
> `server/server.js:180` men **utan riktig publisher** → kör i dag bara `console.log`-mock.
> Det som saknas för drift är i princip tre saker (se §5), inte ny event-logik.

---

## 1. Topic-kontraktet (firmwaren lyssnar på exakt detta)

`ecoloco/<benchId>/<endtopic>`. Firmwaren prenumererar på `ecoloco/<benchId>/#`.

| Topic | Payload | Firmware-effekt | Spel-källa |
|---|---|---|---|
| `…/money` | siffersträng (`t.pengar`) | pengar-display (I2C 0x11), 4 siffror | lagets `pengar` |
| `…/resources` | siffersträng (`t.material`) | resurs-display (I2C 0x12), 4 siffror | lagets `material` |
| `…/winner` | `1` = på, `0` = av | tänder lampan **RÖD** | se §3 (ledare vs klimatbov) |
| `…/looser` | `1` = på, `0` = av | tänder lampan **GRÖN** | se §3 |
| `…/displaymoney` | heltal | **no-op i firmware** (sätter oanvänd variabel) | kan skippas |
| `…/displayresources` | heltal | **no-op i firmware** | kan skippas |

- `money`/`resources`-payload = rått heltal som sträng. Motorns värden är små, icke-negativa
  (`Math.max(0,…)`) → ryms i 4 siffror.
- `winner`/`looser`-payload = **`1`/`0`** (på/av), **inte** index eller färg. Firmwaren jämför `== 1`.

---

## 2. NÄR spelet ska publicera (motor-events)

Motorn (`spec/engine.js`) emitterar events; `src/mqtt.js` hakar redan på dessa:

### money + resources (per lag) — publiceras vid varje tillfälle kapitalet kan ändras
Hooks i `src/mqtt.js` (`pushTeam` → `money`+`resources`):
| Event | Finns i engine.js | Varför |
|---|---|---|
| `start` | `EcoLoco.start()` | initiala värden på alla bänkar |
| `build` | `selectCard()` rad 199 | kort köpt → pengar/material dras |
| `trade` | `transfer()` rad 210 | byte mellan två lag |
| `income` | `endRound()` rad 369 | passiv inkomst vid bokslut |
| `proposalResolved` | `_resolveProposal()` rad 327 | skatter/omfördelning ändrar saldon |
| `event` | `_runEvent()` rad 508 | händelser ändrar saldon |

### winner + looser (statuslampan) — publiceras vid rundslut och spelslut
Hooks i `src/mqtt.js`:
| Event | Finns i engine.js | Val av lag |
|---|---|---|
| `roundEnd` | rad 400 | `winner`=1 för `leaderboards().bors[0]` (rikast); `looser`=1 för `leaderboards().klimat[0]` om `skada < 0` |
| `gameEnd` | `_end()` rad 570 | `winner`=1 för `p.winner.teamId`; `looser`=1 för `p.klimatbov.teamId` |

Relevanta selektorer finns färdiga i motorn:
- **Rikast / ledare:** `engine.richest()` (rad 331) · `leaderboards().bors[0]` (rad 334)
- **Värsta förorenaren / klimatbov:** `engine.worstPolluter()` (rad 330) · `leaderboards().klimat[0]` (rad 336) · även `gameEnd.klimatbov` (rad 573)

> **Nuläge:** stubben uppdaterar lamporna **bara vid `roundEnd`/`gameEnd`** (en gång per bokslut).
> Vill ni att lampan följer med mitt i rundan (t.ex. efter `trade`/`event` som byter vem som är rikast)
> får huvudsessionen lägga winner/looser-beräkningen även på de eventen. **Designval — stäm av med Josef.**

---

## 3. Mappning: klimatbov / ledare / display — och färg-krocken

| Josefs objekt | Spel-begrepp | Motor-källa | Firmware-topic (nuvarande stubb) | Lampans färg i firmware |
|---|---|---|---|---|
| **Ledar-lampa** | rikast / leder | `richest()` / `bors[0]` | `winner` | **RÖD** |
| **Klimatbov-lampa** | värsta förorenaren | `worstPolluter()` / `klimat[0]` | `looser` | **GRÖN** |
| **Sifferverk** | pengar + resurser | `t.pengar` / `t.material` | `money` (0x11) / `resources` (0x12) | — |

> ⚠️ **Färg-krock att lösa innan drift.** Firmwaren renderar `winner`→röd, `looser`→grön. Med
> mappningen ovan blir **ledaren röd** och **klimatboven grön** — tvärtemot intuition och tvärtemot
> `src/mqtt.js`-kommentaren som säger "grön LED = ekonomisk ledare 👑, varnings-LED = värsta boven ⚠".
> **Tre sätt att lösa det (välj ett, Josef + Erik):**
> 1. Byt färgerna i firmware (`MqttHandler.cpp`: winner→grön/guld, looser→röd) — spelkoden orörd.
> 2. Byt vilket topic varje mening publicerar till (ledare→`looser`, bov→`winner`) — firmware orörd.
> 3. Acceptera nuvarande färger.
>
> **Krock #2 (hårdvara):** firmwaren driver **en** lamp-list per bänk → ledare och klimatbov kan
> **inte** lysa samtidigt (ett lag kan vara både rikast och värst). Om båda ska kunna synas samtidigt
> krävs firmware-ändring (två lampor). Se KONTROLLBORD-ERIK.md §1.

---

## 4. Bänk-mappning (benchId)

**Förslag:** `aker=0, skog=1, tundra=2, stad=3`.

> ⚠️ **Flaggas:** spelets befintliga `src/mqtt.js` använder i stället
> `BENCH = { aker:'eco1', skog:'eco2', tundra:'eco3', stad:'eco4' }`, och firmwarens default är `"0"`.
> **Josef/Erik måste bekräfta ETT schema**, och firmwarens `benchId` per kort + spelets `BENCH`-karta
> måste matcha exakt. Områdes-id (`aker/skog/tundra/stad`) är låsta i `engine.js:72` (`AREAS`, får ej
> ändras) — det är bara `BENCH`-värdet (benchId-strängen) som ska samordnas med korten.

Lagen/områdena (engine.js:72):
`aker` = Oxen (material) · `skog` = Björnen (material) · `tundra` = Räven (pengar) · `stad` = Örnen (pengar).

---

## 5. Vad huvudsessionen behöver bygga (utan att röra engine.js)

1. **Riktig publisher.** `attachMqtt(engine)` anropas i `server/server.js:180` utan publisher →
   console-mock. Kalla `setPublisher(fn)` (exporterad i `src/mqtt.js:16`) med en funktion som skickar
   till brokern **192.168.0.23:1883**. Enklast: återanvänd samma mönster som `riggSend` i
   `server/server.js:35` (`execFile('mosquitto_pub', ['-h', broker, '-p', '1883', '-t', t, '-m', m])`),
   eller en `mqtt`-klient. Allt publicerings-*innehåll* finns redan i `attachMqtt`.
2. **Samordna benchId** (§4) — sätt `BENCH`-kartan i `src/mqtt.js` så den matchar korten.
3. **Besluta färg/mappning** (§3) — påverkar antingen firmware (Erik) eller `winner`/`looser`-raderna
   i `src/mqtt.js` (rad 46–49 / 52–55). Rör inte engine.js.
4. (Valfritt) Lägg winner/looser-uppdatering på fler events om lampan ska följa med mitt i rundan (§2).

> Not: `displaymoney`/`displayresources` är no-ops i firmware → behöver inte publiceras i drift
> (stubben gör det ändå, skadar inget).

---

## 6. Kräver bekräftelse (sammanfattning)

- benchId-schema (0/1/2/3 vs eco1–4) — **Josef**
- färg-mappning winner/looser (röd/grön-krocken) — **Josef + Erik**
- en lampa (färgkodad) eller två fysiska lampor per bänk — **Josef + Erik**
- en eller två 7-seg-displayer per bänk — **Erik**
- broker-nätet: statiska IP eller DHCP på 192.168.0.x — **Josef/Erik**
