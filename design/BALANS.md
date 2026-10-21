# BALANS — var alla centrala balansvärden ändras

Kort karta över VAR i koden varje balanssiffra i Maktspelet / Eco Loco Mellan sitter.
Ingen ny mekanik beskrivs här — bara var det som redan finns ligger.

**Två platser att ändra på:**

1. **`spec/engine.js`** — källa till sanning. Innehåller `DEFAULT_CONFIG` (alla config-rattar),
   korthänderna (`MATERIAL_HAND` / `PENGAR_HAND`) och händelserna (`EVENTS`).
2. **`spec/assets.json` → `config`-blocket** — OVERRIDE:ar `DEFAULT_CONFIG` live, utan att röra koden
   (se §6). **OBS:** bara config-VÄRDEN kan override:as här — korthänderna kan det INTE (se §6).

Alla radnummer nedan avser `spec/engine.js` såvida inget annat anges (filen är ~577 rader).

---

## 1. Startvärden — `DEFAULT_CONFIG` (engine.js, rad 12–63)

Objektet `DEFAULT_CONFIG` börjar på **rad 12**. Grundrattarna:

| Ratt | Rad | Värde | Betydelse |
|---|---|---|---|
| `rounds` | 13 | 8 | antal rundor |
| `timerSec` | 14 | 90 | rundtid (sek), normala rundor |
| `timerSecEarly` | 15 | 120 | rundtid de första rundorna (inlärning) |
| `earlyRounds` | 16 | 3 | så många rundor körs med `timerSecEarly` |
| `startPengar` | 17 | 35 | pengar varje lag börjar med |
| `startMaterial` | 18 | 35 | material varje lag börjar med |
| `ohStart` | 19 | 50 | öhälsa vid start |
| `ohMax` | 20 | 100 | tak för öhälsa |
| `threshold` | 21 | 60 | öhälsa som måste nås på sista rundan för vinst |
| `redZone` | 22 | 35 | under detta → röd-zons-spiral slår in |
| `redZonePenalty` | 23 | 3 | extra öhälso-fall per runda i röd zon |
| `greenZone` | 24 | 70 | grön-zons-gräns (status/visning) |
| `slotsPerArea` | 25 | 10 | byggplatser per område |
| `eventLoss` | 26 | 4 | allmänningens nota (pengar+material/lag) i röd zon |
| `gronCost` | 27 | 8 | se §3 |
| `gronGain` | 28 | 14 | se §3 |
| `taxAmount` | 29 | 20 | se §3 |

Tidsfunktionen `timerSecFor(cfg, round)` (rad 101–102) väljer `timerSecEarly` för runda ≤ `earlyRounds`, annars `timerSec`.

### Kris-rattarna (engine.js, rad 35–40)

| Ratt | Rad | Värde | Betydelse |
|---|---|---|---|
| `krisZon` | 35 | 20 | öh ≤ 20 vid bokslut (utan aktiv kris) → KRIS startar |
| `krisReset` | 36 | 35 | öh ≥ 35 vid bokslut (med aktiv kris) → krisen LÖST (15 p hysteres) |
| `krisReplay` | 37 | true | olöst kris vid deadline → rollback + spela om rundan |
| `krisMaxReplay` | 38 | 2 | tak på antal omspel av samma kris-runda |

Kris-logiken lever i `_krisGrind()` (rad 429–450) och `replayRound()` (rad 455–463).

### Övriga rattar i DEFAULT_CONFIG

- `humanTeam: 'aker'` (rad 42) — vilket område människan styr i mock/fas 3.
- `extraProposalsFromRound: 4` (rad 48) — extra-förslag dyker upp först fr.o.m. denna runda.
- `extraProposalsPerRound: 2` (rad 49) — antal extra-förslag per runda.

Separat händelse-ratt (utanför `DEFAULT_CONFIG`): `EVENT_CONFIG` (rad 88)
= `{ chansPerRunda: 0.6, utanAterlaggning: true }` — sannolikhet att en händelse dras per runda
(endast auto/selfplay; GM-läge opåverkat) och om dragna händelser kan återkomma.

---

## 2. Kortkostnader (smutsig / standard / grön) — `MATERIAL_HAND` & `PENGAR_HAND`

Två arrayer, module-level `const` (ej exporterade, ej i config):
- `MATERIAL_HAND` — engine.js **rad 109–113** (material-sektorns lag: Åker/Oxen, Skog/Björnen).
- `PENGAR_HAND` — engine.js **rad 114–118** (pengar-sektorns lag: Tundra/Räven, Stad/Örnen).
  Exakt spegel av `MATERIAL_HAND`.

Varje rad = ett kort-tier med fälten:

| Fält | Betydelse |
|---|---|
| `kp` | kostnad pengar (engångskostnad vid bygge) |
| `km` | kostnad material (engångskostnad vid bygge) |
| `gp` | inkomst pengar per runda (passiv, efter bygge) |
| `gm` | inkomst material per runda (passiv, efter bygge) |
| `oh` | öhälso-effekt (engång, appliceras vid bokslut) |

**MATERIAL_HAND** (inkomst i `gm` = material; betalar `kp` i pengar):

| tier | kp | km | gp | gm | oh |
|---|---|---|---|---|---|
| smutsig | 8 | 0 | 0 | 9 | −6 |
| standard | 8 | 6 | 0 | 7 | −3 |
| gron | 14 | 10 | 0 | 5 | +3 |

**PENGAR_HAND** (inkomst i `gp` = pengar; betalar `km` i material):

| tier | kp | km | gp | gm | oh |
|---|---|---|---|---|---|
| smutsig | 0 | 8 | 9 | 0 | −6 |
| standard | 6 | 8 | 7 | 0 | −3 |
| gron | 10 | 14 | 5 | 0 | +3 |

Mönster: smutsigt = billigast + högst avkastning + värst för ön (oh −6); grönt = dyrast + lägst
avkastning + enda som bygger upp ön (oh +3). Korttyp väljs i `selectCard()` (rad 187), kostnaden dras
där; inkomst (`gp`/`gm`) och öhälsa (`oh`) bokförs i `endRound()` (rad 347 ff).
Namn per område = `NAMES` (rad 119–124). `handFor(areaId)` (rad 126–130) väljer rätt hand per sektor.

---

## 3. Förslagens utbetalningar — rattar i `DEFAULT_CONFIG`

Grund-3-förslagen och deras rattar (styrs i `_resolveProposal()`, rad 244–328):

| Ratt | Rad | Värde | Förslag | Vad det styr |
|---|---|---|---|---|
| `gronCost` | 27 | 8 | **grön satsning** (`gron`) | 🪙 varje ja-röstare betalar (rad 267) |
| `gronGain` | 28 | 14 | **grön satsning** (`gron`) | öhälso-lyft som köas (rad 268) |
| `taxAmount` | 29 | 20 | **skatt** (`skatt`) | 🪙 värsta förorenaren betalar, delas lika till övriga (rad 270–273) |

`forbud` (förbjud smutsigt nästa runda) har ingen siffer-ratt — sätter bara `banDirtyNextRound` (rad 276).

Extra-förslagens rattar (engine.js rad 51–62; logik rad 279–325):

| Ratt | Rad | Värde | Förslag | Vad det styr |
|---|---|---|---|---|
| `krispaketGain` | 53 | 28 | 🆘 **Krispaket** (`krispaket`) | öhälso-lyft; ja-röstare betalar `gronCost` var (rad 282–283) |
| `sektorskattAmount` | 54 | 12 | 🏝 **Sektorskatt** (`sektorskatt`) | 🪙 varje pengar-lag betalar; potten delas lika till materiallagen (rad 290–292) |
| `solidaritetPengar` | 55 | 15 | 👑 **Solidaritetsskatt** (`solidaritet`) | 🪙 rikaste laget betalar, delas på tre andra (rad 297, 301–302) |
| `solidaritetMaterial` | 56 | 10 | 👑 **Solidaritetsskatt** (`solidaritet`) | 🧱 rikaste laget betalar, delas på tre andra (rad 298, 301–302) |
| `lojalitetBonus` | 57 | 6 | 🤝 **Grön utdelning** (`lojalitet`) | 🪙 bonus till varje ja-röstare (rad 307) |
| `lojalitetBoter` | 58 | 8 | 🤝 **Grön utdelning** (`lojalitet`) | 🪙 böter som varje nej-röstare betalar (rad 308) |
| `lojalitetOh` | 59 | 4 | 🤝 **Grön utdelning** (`lojalitet`) | öhälso-lyft vid lyckat förslag (rad 310) |
| `marknadsavtalBonus` | 60 | 8 | 📈 **Marknadsavtal** (`marknadsavtal`) | 🪙 till alla fyra lag, bara om EXAKT 3 ja (rad 315) |
| `marknadsavtalOh` | 61 | 2 | 📈 **Marknadsavtal** (`marknadsavtal`) | öhälso-lyft vid exakt 3 ja (rad 316) |

Förslaget 💊 **Riktat grönt stöd** (`gronstod`, rad 318–324) har ingen egen ratt — ja-röstarna betalar
`gronCost` var och hela potten går till grönaste laget. Grund-3 kräver ≥3 ja (rad 264); extra-förslagen
likaså. Vilka extra-förslag som finns i poolen: `EXTRA_PROPOSAL_POOL` (rad 68).

---

## 4. Händelser — `EVENTS` (engine.js, rad 89–98)

Alla event-effekter ligger i `EVENTS`-arrayen (rad 89–98). Åtta händelser (`storm`, `skogsbrand`,
`uppror`, `torka`, `godskord`, `sponsrat`, `gronafonden`, `marknadskrasch`). Per händelse ändras:
`pengar` / `material` / `egenValuta` (förändring per träffat lag), `oh` (öhälsa), `traffar` (vilka lag),
`typ` (`auto` = slår automatiskt / `rost` = individuell omröstning), samt `rubrik`/`text`/`ljud`.
Dra-sannolikhet och återläggning styrs av `EVENT_CONFIG` (rad 88, se §1). Träff-selektorer löses i
`_eventTargets()` (rad 516–528); händelser appliceras i `_runEvent()` (rad 488–513).

---

## 5. Övrigt hårdkodat (ej config)

- **Pengasläpp (GM):** `pengaslapp()` (rad 539–547) ger +10 pengar och +10 material till alla lag — fast tal i koden, ingen ratt.
- **`ohMode()`-trösklar** (rad 132–138): 20 / 40 / 60 / 80 — statusnivåer för öhälsa, fasta i koden.
- **Solo/single-player start:** `src/ui.js:1145` skapar motorn med `startPengar: 26, startMaterial: 26`
  (hårdkodad override i UI:t, bara för det läget — inte en config-ratt och inte i assets.json).

---

## 6. Override utan att röra koden — `spec/assets.json` → `config`

`spec/assets.json` har ett `config`-block (rad 3–6) som läses LIVE av spelet och OVERRIDE:ar
`DEFAULT_CONFIG`. Mekaniken: UI/server skapar motorn med `new EcoLoco(manifest.config || {})`
(`src/ui.js:59`, `server/server.js:175`), och konstruktorn gör `this.cfg = { ...DEFAULT_CONFIG, ...config }`
(`engine.js:142`). Allt du lägger i `config`-blocket skriver alltså över motsvarande `DEFAULT_CONFIG`-värde
— utan att koden ändras. Tomt objekt = motorns standardvärden. (`config._readme` i filen beskriver detta.)

**Så här ändrar man ett värde live** — lägg nyckeln i `config`-blocket, t.ex.:

```json
"config": {
  "mode": "tutorial",
  "startPengar": 40,
  "rounds": 6
}
```

Alla rattar i §1 och §3 går att override:a så här (de är fält i `DEFAULT_CONFIG`).
`mode`-fältet styr bara onboarding-lagret (tutorial | selfplay | gm), aldrig motorns regler;
`?mode=...` i URL:en vinner över assets.json.

**VIKTIG SKILLNAD — korthänderna är INTE override-bara via assets.json idag.**
`MATERIAL_HAND` och `PENGAR_HAND` (§2) är module-level `const` i `engine.js`, inte en del av
`DEFAULT_CONFIG`. Spread-mergen (`{ ...DEFAULT_CONFIG, ...config }`) rör dem aldrig. Vill man ändra
kortkostnader, inkomster eller korts öhälso-effekt måste man alltså redigera arrayerna direkt i
`spec/engine.js` (rad 109–118). Likaså är `EVENTS` (§4) och de hårdkodade värdena i §5 bara ändringsbara
i koden.

---

## Avvikelser mot beskrivningen

1. **`startPengar`/`startMaterial` = 35/35, inte 40/30.** Uppdraget nämnde dessa som rattar (korrekt),
   men de nuvarande värdena i `DEFAULT_CONFIG` är **35 / 35** (ombalansering till symmetrisk start, rad 17–18).
   `assets.json`-blockets `config._readme` är STALE och säger fortfarande "startPengar 40, startMaterial 30"
   — bör uppdateras men är bara kommentar (påverkar inte spelet).
2. **`rounds` = 8** (inte 10 eller annat) och **`timerSec` = 90**, med separat `timerSecEarly` 120 för de
   3 första rundorna — värt att veta att rundtid inte är en enda siffra.
3. **`eventLoss`** (4) används numera FÖR röd-zons-notan (rad 381), inte som generell event-förlust —
   kommentaren i koden noterar att den var 10 och "oanvänd" tidigare.
4. Allt annat i uppdraget stämde mot koden: kris-rattarna, alla förslags-rattar, `MATERIAL_HAND`/`PENGAR_HAND`-fälten
   och override-mekaniken verifierades rad för rad.
