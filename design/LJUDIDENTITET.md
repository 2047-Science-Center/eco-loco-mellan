# Ljudidentitet — Eco Loco Mellan (Maktspelet)

*Riktning **A — "Centralmaktens etersändning"** (vald av Josef). Metoden är lånad
från X&Y-riggens ljudidentitets-arbete (`../../xy-ljud/LJUDIDENTITET.md`) men
identiteten är **egen** — detta är inte X&Y:s 80-tals-amber-synth. Dokumentet är
kartan alla ljud härleds ur: en central referens, en gemensam prompt-prefix som
lim, och en fullständig ljudlista (finns + saknas). Generering sker via
ElevenLabs (`tools/generera-rigg-ljud.js` / `tools/generera-ljud.js`).*

---

## 1. Central referens (allt härleds ur denna mening)

> **Allt ljud i Maktspelet kommer ur Centralmaktens slitna högtalarsystem över
> ön — varm rörelektronik och bandeko, buret av en lågmäld två-tons
> myndighetssignatur. Institutionellt, melankoliskt, aldrig arkadigt, aldrig
> game-show.**

Grundad i spelets fiktion: fyra lag (Åker/Skog/Tundra/Stad) styr öns hälsa under
**Centralmakten/Centralmyndigheten** — en torr, byråkratisk, milt olycksbådande
auktoritet ("Centralmyndigheten meddelar", "milt ogillande", "Tack för er
förståelse", ur `spec/engine.js → EVENTS`). Ljudvärlden *är* den myndighetens
apparat: det vi hör är besked, mätningar och signaler ur ett gammalt
högtalarsystem, inte spel-SFX.

**Tre principer (från X&Y-metoden):**
1. **Ett material, flera filter.** Samma rörelektronik/bandeko/PA-färg på *allt* —
   från skärmens UI-klick till event-stingrarna — så helheten låter som en maskin,
   inte 30 orelaterade ljud.
2. **Håll igen överallt utom topparna.** Kris, award-ceremoni och slut får svälla;
   UI och interaktion är torra och små så topparna har någonstans att ta vägen.
3. **Allt ryms under rösten/skeendet.** Inget ljud ska skrika; ambiensen duckar
   aldrig bort stingrarna, stingrarna stansar igenom en varm, låg bädd.

**Löser den gamla sprickan:** "tryck"-ljuden enas som **allvarlig institutionell
signal** (kris = dämpad VMA-aktig tvåtonssignal under sub-bas), aldrig den gamla
`larm`-klaxonens game-show-absurditet. Show-momenten (`happening` m.fl.) lyfts ur
game-show-registret in i samma etersändnings-estetik.

---

## 2. Gemensam prompt-prefix (stil-limmet)

Varje framtida ljud-prompt = `<specifik beskrivning>, <PREFIX>`. Prefixen bär
husstilen så att allt hamnar i paletten automatiskt (X&Y:s "shared prefix"-teknik).
Den lever som `export const PREFIX` i BÅDA gen-skripten (`tools/generera-rigg-ljud.js`
+ `tools/generera-ljud.js`) — håll dem identiska. Förstärkt PA/dist-karaktär efter
att `prov-event-ident` valdes som tonreferens (sliten myndighetshögtalare ska höras
genom allt):

```
through Centralmaktens worn PA loudspeaker, driven valve-and-tape saturation and
light distortion, tape hiss and wow-flutter, institutional melancholic not arcade,
no music no melody no voice
```

**Inställningar (startpunkt):** modell `eleven_text_to_sound_v2`, `mp3_44100_128`,
`prompt_influence` 0.5 (0.6–0.8 för korta torra UI-ljud). Ambienser/loopar:
`loop:true` + lång duration (~30 s). **OBS:** ElevenLabs tar max **450 tecken**
per prompt — prefixen (~219) + beskrivning måste rymmas; håll beskrivningen kort.

**Återkommande motiv (röda tråden):** den **två-tons myndighetssignaturen**
(mjukt fallande tvåtonsplingaden) öppnar varje `event_*` och ekar i `round_start`
/`proposal_open`. Den är spelets signatur — återanvänd den medvetet.

**Palett-byggstenar att variera:** harmonium/rörorgel, sub-drone-pads,
rör-/bandmättnad, PA-/högtalarfilter (smalband + lätt distorsion), avlägset
rumseko, torra dämpade anslag (UI). Ingen ljus digital briljans, ingen melodi.

---

## 3. Fullständig ljudlista — finns + borde finnas

Lager: **UI** (skärm, torra) · **interaktion** (skärm, feedback) · **show**
(central stinger) · **tryck** (central spänning/kris) · **event** (central) ·
**award** (central) · **ambience** (central loop). Trigger = motor-event
(`spec/engine.js`) eller rigg-cue (`src/rigg.js`/`spelledare.html` →
`hjarna-stubb.py`).

### 3.1 UI-familjen (enhetlig — mestadels gap)

Idag finns bara `ui_tap`. Hela familjen ska härledas ur **ett** torrt ankare (en
dämpad konsol-blip) och varieras i tonhöjd/riktning — inte tolv olika ljud.

| ljud-id | lager | trigger | status | behandling i riktning A |
|---|---|---|---|---|
| `ui_tap` | UI | klick/select (`src/audio.js play`) | **finns** | ankaret: kort torr dämpad konsol-blip, snabb dämpning |
| `ui_confirm` | UI | bekräfta/lås val | **saknas** | ankaret, mjukt stigande tvåton (positivt, lågmält) |
| `ui_reject` | UI | ogiltig/avvisad åtgärd | **saknas** | ankaret, mjukt fallande tvåton, artig inte hård |
| `ui_hover` | UI | hover/fokus | **saknas** | mycket kort, tystare variant av ankaret |
| `ui_open` | UI | popup/kort/panel visas | **saknas** | ankaret + kort PA-filtrerad svept öppning |
| `ui_close` | UI | popup/panel stängs | **saknas** | ankaret, kort nedåt-svep (spegel av `ui_open`) |
| `ui_notis` | UI | notis/toast (`broadcast notis`) | **saknas** | dämpad tvåtons PA-pling, neutral |
| `ui_back` | UI | bakåt/ångra | **saknas** | ankaret, neutral fallande ton |
| `ui_tick` | UI | skärm-räknare/nedräkningstick | **saknas** | mycket kort torr tick (skärm-eko av `countdown`) |

### 3.2 Interaktion (skärm-feedback)

| ljud-id | lager | trigger | status | behandling i riktning A |
|---|---|---|---|---|
| `build_smutsig` | interaktion | `build`, `card.tier=smutsig` | **finns** | lågt dämpat industriellt anslag, ingen dissonant arkadighet |
| `build_standard` | interaktion | `build`, standard | **finns** | neutralt dämpat mekaniskt thunk |
| `build_gron` | interaktion | `build`, grön | **finns** | mjukt varmt anslag med kort resonans (ej ljust pling) |
| `trade` | interaktion | `trade` (byteshandel) | **finns** | dämpad resurs-växling, varm, kort |
| `vote` | interaktion/UI | röst lagd | **finns** | dämpad klubba → fäll in i UI-familjen (civic men varm) |
| `proposal_pass` | interaktion | `proposalResolved` passed | **finns** | lågmäld positiv bekräftelse (ej ljus durtriad) |
| `proposal_fail` | interaktion | `proposalResolved` fail | **finns** | mjuk institutionell avvisning |

### 3.3 Show-stingers (central)

| ljud-id | lager | trigger | status | behandling i riktning A |
|---|---|---|---|---|
| `round_start` | show | `roundStart` (runda>1) | **finns** | tvåtons-harmonium-motivet, "mötet öppnas" |
| `proposal_open` | show | `proposalOpened` | **finns** | kort uppmärksamhets-cue + motivet |
| `relief` | show | öhälsa reser sig ur kris (`rigg.js`) | **finns** | mörk drone som löser upp sig, utandning |
| `win` | show/slut | `gameEnd won` | **finns** | varm resolverande kadens, lättnad ej triumf |
| `lose` | show/slut | `gameEnd !won` | **finns** | dyster fallande kadens, tung |
| `happening` | show | GM-knapp (`spelledare.html`) | **finns (görs om)** | riser + beslutsam downbeat, komponerad — **ej game-show** |
| `pil_blip` | show | GM-accent | **finns (görs om)** | torr PA-accent, lyft ur game-show |
| `ding` | show | GM `gm-ljud ding` | **finns** | enkel dämpad bordsklocka, varm |
| `paus` | show/system | `apply_paus` (paus 1) | **finns** | lugn nedsläckt cue, hållen |
| `spanning` | show/tryck | startceremoni-riser (`ceremoni countdown`) | **finns (görs om)** | institutionell suspense-loop, ej teatralisk |
| `trailer` | show | intro-trailer | **finns** | behålls (egen trailer-ljudbild) |
| `attract` | ambience | viloläge (`scen attract`) | **finns** | varm analog drone-loop (i familjen) |
| `fanfar` | show | GM (= `win`+alla gröna) | **finns (härlett)** | ärvs av `win`; ingen egen fil behövs |
| `event_ident` | show | **röd tråd** (öppnar event) | **saknas** | fristående återanvändbar tvåtons-myndighetssignatur |
| `game_end_tyst` | show | efter slut (rum-ton) | **saknas (valfri)** | kort nedväxling till ambient efter win/lose |

### 3.4 Tryck / spänning (central)

| ljud-id | lager | trigger | status | behandling i riktning A |
|---|---|---|---|---|
| `kris` | tryck | motorns `crisis` → `ecoloco/rigg/kris` | **finns (görs om)** | **allvarlig** institutionell tvåtons-varning under sub-bas; ej air-raid-wail, ej game-show |
| `countdown` | tryck | `rigg.tick` ≤10 s kvar | **finns (görs om)** | torr klocka under stigande drone, beslutsam låg träff |
| `larm` | tryck | GM-knapp | **finns → ersätt** | ersätts av `kris`-språket (den lekfulla klaxonen rimmar inte med A) |

### 3.5 Event-stingers (central — alla öppnar med myndighetssignaturen)

| ljud-id | lager | trigger | status | behandling i riktning A |
|---|---|---|---|---|
| `event_storm` | event | `EVENTS` storm | **finns** | ident → kuslig kustvind + avlägset muller, PA-filtrerat |
| `event_skogsbrand` | event | skogsbrand | **finns** | ident → lågt institutionellt larm under torr eld |
| `event_uppror` | event | uppror | **finns** | ident → avlägsen vred folkmassa, dämpad |
| `event_torka` | event | torka | **finns** | ident → torr ihålig vind, sparsam |
| `event_godskord` | event | god skörd | **finns** | ident → dämpad varm fanfar, modest |
| `event_sponsrat` | event | sponsrat (röst) | **finns** | ident → lite för slät "korporativ" jingle över oroligt drone |
| `event_gronafonden` | event | gröna fonden | **finns** | ident → stigande ceremoniell ton, värdig |
| `event_marknadskrasch` | event | marknadskrasch | **finns** | ident → telegraf-klatter som kollapsar till fallande ton |

### 3.6 Award (central)

| ljud-id | lager | trigger | status | behandling i riktning A |
|---|---|---|---|---|
| `award_foretagare` | award | `award` → `apply_award` (grön sida) | **finns** | värdig dämpad harmonium/bleck-swell, positiv |
| `award_eldsjal` | award | award eldsjäl (grön) | **finns** | varm hjärtlig stigande harmonium |
| `award_sabotor` | award | award sabotör (röd) | **finns** | mörk dramatisk reveal, värdig spänning ej komik |

### 3.7 Ambience (central loop, auto på öhälsa)

| ljud-id | lager | trigger | status | behandling i riktning A |
|---|---|---|---|---|
| `soundscape_1..5` | ambience | `AMB_FILE` per öhälsoläge (`hjarna-stubb.py`) | **finns (ersätts)** | ersätts av `ambience-forslag/` (warm analog cinematic drone, icke-diegetisk) |
| `ambience-forslag/ (v1+v2)` | ambience | kandidater | **finns (förslag)** | redan i familjen; v2 har subtil cyklisk rörelse |
| `ambience-manuell-preset` | ambience | spelledar-växel (framtida) | **saknas** | manuell stämnings-override (se analys: ny `ecoloco/rigg/ambience`-topic) |

---

## 4. Orphans att städa (oanvända filer)

Ligger kvar men pekas inte ut i `spec/assets.json` och/eller är överskuggade:

- `assets/audio/win.mp3`, `assets/audio/lose.mp3`, `assets/audio/round_start.mp3`
  — gamla "musikaliska" versioner; manifestet pekar dessa nycklar mot `rigg/`.
- `assets/audio/award_led.mp3`, `award_eld.mp3`, `award_sab.mp3` — ersatta av
  `rigg/award_foretagare|eldsjal|sabotor`.
- `assets/audio/event.mp3` — ej i manifestet.
- `assets/audio/amb_bra.mp3`, `amb_daligt.mp3`, `amb_mycketbra.mp3`,
  `amb_neutralt.mp3`, `amb_superdaligt.mp3` — `src/audio.js setAmbience()` är no-op;
  all ambience ligger centralt.

---

## 5. Status — hela batchen genererad (Riktning A)

Kalibrerings-settet (`assets/audio/rigg/identitet-prov/`, 6 prov) godkändes och
hela ljudbilden regenererades i Riktning A med den förstärkta prefixen:

- **Central/show/tryck/event/award/ambience** → `tools/generera-rigg-ljud.js`
  (alla befintliga filnamn på plats + nya `event_ident.mp3`; `larm` omskinnat till
  allvarlig kris-syskon; `soundscape_1..5` bär nu bakgrundsskrap/brus).
- **Skärm-SFX + UI-familjen** → `tools/generera-ljud.js` (`ui_tap` + nya
  `ui_confirm/reject/hover/open/close/notis/back/tick`).
- **Orphans borttagna** (se §4).

Kör om allt: `node tools/generera-rigg-ljud.js --force` och
`node tools/generera-ljud.js --force`.

**Kvar att wire:a (spellogik — görs separat):** nya `event_ident` + hela
UI-familjen behöver nycklar i `spec/assets.json → audio` och anrop i `src/ui.js`
(UI-familjen) / `src/rigg.js` (ev. `event_ident` som pre-roll). Se rapportens
touchpoints-lista. `hjarna-stubb.py` och ambiensen behöver INGEN ändring — den
läser `soundscape_1..5`/`event_*`/osv. på exakt befintliga filnamn.
