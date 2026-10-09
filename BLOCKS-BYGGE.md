# Blocks som dirigent + spelledarpanel — byggbeskrivning

Blocks ersätter `tools/hjarna-stubb.py`. Kontraktet är fruset (`RIGG-KONTRAKT.md`):
Blocks prenumererar på lager 1 (`ecoloco/rigg/*`, semantiskt), publicerar lager 2
(`ecoloco/rigg/out/*`, granulärt), spelar riggljuden och bär spelledarpanelen.
Spel och firmware märker inte bytet.

> Server: `blocks.2047.nu` (nås via Tailscale). Byggs i admin-UI:t — stegen nedan är
> i den ordning de klickas. Mappningstabellerna är kopierade ur kontraktet och ÄR facit;
> exakt driver-syntax verifieras mot Blocks-versionen när vi är inne (MQTT-drivern
> konfigureras med Topic Base + property-lista, samma mönster som Netio-app-noten).

## 1. MQTT-anslutning (Manage → Network Devices)

Blocks MQTT-stöd binder **properties ↔ topics** via en driver med *Topic Base* +
property-lista. En enhet räcker:

**Enhet `EcoLocoRigg`** — Topic Base: `ecoloco/rigg`

| Property | Riktning | subTopic / publishSubTopic | Typ |
|---|---|---|---|
| `scen` | in (subscribe) | `/scen` | String (`attract\|runda\|awards\|slut`) |
| `ohalsa` | in | `/ohalsa` | Number 1–100 |
| `award` | in | `/award` | String (JSON: `{"typ":…,"lag":…}`) |
| `wave` | in | `/wave` | Boolean (1/0) |
| `countdown` | in | `/countdown` | Boolean (1/0) |
| `led1`…`led4` | ut (publish) | `/out/led/1`…`/out/led/4` | String (JSON-payload) |
| `fx` | ut | `/out/fx` | String (JSON) |
| `spot1`…`spot4` | ut | `/out/spot/1`…`/out/spot/4` | Boolean, true=`1`/false=`0` |

Brokern: samma mosquitto som spelet/firmwaren använder (Mint-datorns IP). Blocks-servern
måste nå den — de står på samma nät på 2047.

## 2. Realm `EcoLoco` — variabler

| Variabel | Typ | Roll |
|---|---|---|
| `gmMaster` | Boolean | GM har tagit över — spel-cues ignoreras |
| `senasteScen` | String | för panelens statusvisning |
| `senasteOhalsa` | Number | för panelens mätare |

## 3. Tasks (en per rad = trigger → handling)

**Lyssnartasks** (trigger: property change på `EcoLocoRigg`; alla utom GM-tasks börjar med
villkoret `gmMaster == false`):

| Task | Trigger | Gör |
|---|---|---|
| `OhalsaLook` | `ohalsa` ändras | slå upp i öhälso-tabellen nedan → sätt `led1..4` till samma payload; vid kris-inträde (≤20) spela `kris`-ljudet |
| `ScenByte` | `scen` ändras | `attract` → attract-loop (lugn grön puls + `attract`-ljud); `runda` → kör OhalsaLook-looken; `slut` → vinnarfärg kvar; uppdatera `senasteScen` |
| `AwardCue` | `award` ändras | parsa JSON → vinnarsidans led = typfärg (tabell nedan), övriga `v:0`, vinnarens spot = true, spela typens ljud; släck spot efter 10 s |
| `WaveFx` | `wave` → true/false | `fx` = `{"fx":"wave","speed":60}` resp. `{"fx":"none"}` |
| `CountdownFx` | `countdown` → true/false | `fx` = countdown + alla sidor vitt (h0 s0 v80) resp. tillbaka till öhälso-look; `countdown`-ljud |

**Öhälsa → look** (payload till alla fyra `led`-properties):

| ohalsa | payload |
|---|---|
| ≤20 | `{"h":0,"s":100,"v":100,"blink":80}` + kris-ljud vid inträde |
| ≤40 | `{"h":0,"s":100,"v":50,"puls":30}` |
| ≤60 | `{"h":50,"s":100,"v":35,"puls":40}` |
| ≤80 | `{"h":110,"s":90,"v":70}` |
| >80 | `{"h":125,"s":100,"v":70,"puls":60}` |

**Award → look** (lag→sida: aker=1, skog=2, tundra=3, stad=4):

| typ | vinnarsidan | ljud |
|---|---|---|
| `sabotor` | `{"h":0,"s":100,"v":100}` | `award_sabotor` |
| `foretagare` | `{"h":110,"s":90,"v":90}` | `award_foretagare` |
| `eldsjal` | `{"h":135,"s":100,"v":70}` | `award_eldsjal` |

**GM-tasks** (trigger: panelknappar; ingen master-spärr):

| Task | Gör |
|---|---|
| `GmMasterToggle` | växla `gmMaster`; vid släpp (false) → kör OhalsaLook så riggen synkar med spelet igen |
| `GmAllaGrona` | alla sidor `{"h":120,"s":100,"v":90}`, alla spots false |
| `GmSpotN` (1–4) | växla `spotN` |
| `GmLjud<id>` | spela ljud `<id>` |
| `GmSlack` | alla sidor `v:0`, fx none, spots av |

## 4. Ljud

Riggljuden finns färdiga i repot: `assets/audio/rigg/` (kris, attract, countdown,
award_sabotor, award_foretagare, award_eldsjal, ding) — ladda upp till Blocks mediabibliotek.
Spelas genom en **ljud-spot**: i drift NUC:en vid riggen (Blocks-spot i webbläsare mot
USB-DAC/högtalaren); tasks ovan triggar uppspelning på den spoten.

## 5. Spelledarpanelen (Web-spot)

En komposition med Controls, visningsbar i vilken webbläsare som helst (= Josef kan öppna
den från Malmö via Tailscale, ingen fysisk skärm krävs):

```
┌────────────────────────────────────────────┐
│  ECO LOCO — SPELLEDARE                     │
│  Scen: [runda]      Öhälsa: ▓▓▓▓▓░░ 52     │   ← senasteScen/senasteOhalsa
│                                            │
│  [ MASTER: AUTO/MANUELL ]   ← gmMaster     │
│  ────── aktiva bara i MANUELL: ──────      │
│  [ALLA GRÖNA] [SLÄCK ALLT]                 │
│  Spot:  [1] [2] [3] [4]                    │
│  Ljud:  [KRIS] [DING] [SAB] [FTG] [ELD]    │
└────────────────────────────────────────────┘
```

Knapp → respektive GM-task. Master-knappen färgmarkeras tydligt (grön AUTO / röd MANUELL)
så ingen glömmer att släppa tillbaka till spelet.

## 6. Verifiering utan rigg (helt remote)

Blocks-lagret bevisas genom att **titta på lager 2-trafiken** — inga LED behövs:

```bash
# På Mint-datorn (SSH): lyssna på allt Blocks publicerar
mosquitto_sub -h localhost -t 'ecoloco/rigg/out/#' -v
# Mata Blocks med semantik (härma spelet):
bash tools/mock-rigg-semantisk.sh localhost      # scen/ohälsa/award-svit
```

Rätt payloads på `out/led/*`, `out/fx`, `out/spot/*` enligt tabellerna = Blocks-dirigenten
är korrekt, per definition likvärdig med hjärna-stubben. Sedan: tryck på GM-panelen från
Malmö och se samma trafik. Sist: `tools/selfplay-rigg.mjs` (helt botparti) mot brokern →
hela kedjan spel→Blocks→(firmware).

## Migrering stubb → Blocks

Hjärna-stubben och Blocks får inte köra samtidigt (dubbla dirigenter = dubbla publiceringar).
Testläge: stoppa `hjarna-stubb.py` när Blocks-tasksen aktiveras; rulla tillbaka genom att
starta stubben igen. Onsdagens fallback är alltid stubben — den är verifierad.
