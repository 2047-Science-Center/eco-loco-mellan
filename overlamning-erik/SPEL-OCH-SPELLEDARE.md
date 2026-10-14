# Riggen mot spelet + spelledarfunktionen — sammanställning

Bygger vidare på **README.md** (flasha ESP32 + testa LED/pil/blandare från terminalen).
Den här filen beskriver nästa steg: **koppla riggen mot det riktiga spelet**, och den nya
**spelledarfunktionen** (prisutdelning som en människa klickar fram).

> Snabb orientering i kedjan:
> ```
> SPELET (server)  ──semantik──►  DIRIGENTEN  ──granulärt──►  ESP32  ──►  LED-list + blandare
>  "hjärnan som        scen/ohälsa/      (hjarna-stubb.py        out/led  out/spot
>   bestämmer allt"     award/ljud        på NUC, Blocks i final)  out/fx   out/blandare
> ```
> ESP32:n är en **dum renderare** — all mening (vilken färg, vilken sida) bestäms uppströms.

---

## 1. Firmwaren som gäller (testad 14 okt, kopplar mot spelet)

**`firmware/rigg_arduino/rigg_arduino.ino`** — detta är den aktuella filen. Samma fil till både
Josefs test-DevKit och Eriks slutkort; bara `config.h` skiljer.

Vad den gör: ansluter till wifi + MQTT-broker och lyssnar på de **granulära** topicsen och renderar lokalt:

| Topic (prenumererar) | Effekt på riggen |
|---|---|
| `ecoloco/rigg/out/led/1..4` | ambient-segment 1–4 får färg (HSV-sträng, t.ex. `{"h":110,"s":90,"v":90}`) |
| `ecoloco/rigg/out/spot/1..4` | pil/chevron-segment 1–4 (eller spot-relä) av/på — "peka mot lag" |
| `ecoloco/rigg/out/fx` | ljuseffekt över ambient-delen (`wave`/chase, `countdown`, `none`) |
| `ecoloco/rigg/out/blandare` | saftblandar-relä av/på |

**Config för ditt kort** (Waveshare ESP32-S3-ETH) ligger färdig i `overlamning-erik/config-s3-eth.h`:
- `LED_PIN 21` (WS2812 DIN) · `NUM_LEDS 60` (1 m-list)
- `SPOT_PINS {17,16,18,15}` = aker, skog, tundra, stad
- `BLANDARE_PIN 42` (aktiv hög → MOSFET)
- Pinnarna undviker ethernet/SD/USB/strapping på S3-ETH-kortet.

Flashning: se **README.md steg 1–4** (oförändrat). Du ändrar bara wifi + broker-IP i `config.h`.

---

## 2. Starta spelet på NUC:en och se att riggen reagerar

Spelet är en liten Node-server. Dirigenten (`hjarna-stubb.py`) översätter spelets semantik till de
granulära signalerna ovan. Båda startas av drift-skripten (Linux Mint/Ubuntu-NUC):

```bash
git clone https://github.com/2047-Science-Center/eco-loco-mellan.git
cd eco-loco-mellan
bash drift/mint/installera-mint.sh server     # spelservern (autostart + omstart vid krasch)
bash drift/mint/installera-rigg.sh            # broker (mosquitto) + hjärnan (ljud + semantik→granulärt)
```

- `installera-rigg.sh` installerar **mosquitto** (brokern), startar **hjärnan** som tjänst, och
  skriver ut NUC:ens IP.
- **Sätt ESP32:ns `MQTT_BROKER` = NUC:ens IP** (i `config.h`) och flasha om → riggen hänger på samma broker.
- Öppna en spelskärm: `http://<NUC-ip>:8765/spel.html?online=1&lag=aker` (en per lag: aker/skog/tundra/stad).

**Vad som då händer automatiskt** (utan någon spelledare): när ni spelar följer riggen med —
öns hälsa färgar ambient-ljuset, prisutdelningen tänder rätt sida, nedräkningen blinkar sista 10 s.

> **Blandaren:** den är i nuläget **inte** kopplad till en spel-händelse — den triggas manuellt
> (terminal: `./overlamning-erik/testa-rigg.sh blandare on`, eller av spelledaren). Vill vi att den
> ska gå automatiskt vid t.ex. en viss händelse/award, säg till Josef så kopplar vi in den i spelet.

---

## 3. Dagens tester — gör i denna ordning

### Test A — riggen följer spelet UTAN spelledare (grundkedjan)
1. Flasha ESP32:n (config.h med NUC:ens broker-IP). Seriell monitor: `WiFi OK` + `MQTT connected + subscribed`.
2. Starta server + hjärna på NUC:en (steg 2). Öppna minst en spelskärm.
3. Spela en runda rakt igenom. **Förväntat på riggen:**
   - [ ] Ambient-ljuset ändrar färg med öns hälsa (grönt → gult → rött när ön mår sämre)
   - [ ] Sista 10 s av rundan: nedräknings-fx (blink/chase)
   - [ ] Prisutdelningen: rätt sida tänds per pris (grön åt ledande/eldsjäl, röd åt sabotör)
   - [ ] Blandaren testas separat från terminalen (se not ovan)

Funkar Test A → **grundsömmen spel→broker→hjärna→ESP32 sitter.**

### Test B — spelledarfunktionen (nytt)
Här tar en människa (spelledaren) kontroll över **prisutdelningens takt**. Styrs från en panel i Blocks.
1. Spelledaren trycker **MASTER** (tar kontroll). Serverloggen: `[gm] GM-läge = true`.
2. Spela en runda klart. **Nu stannar prisutdelningen och väntar** — både spelskärmen ("Prisutdelning")
   och riggen (award-scenen) står still.
3. Spelledaren trycker **NÄSTA AWARD** → pris 1 visas (skärm **och** rigg samtidigt). Igen → pris 2. Igen → pris 3.
4. Efter sista priset → popupen stängs, rundan återupptas.

**Förväntat:** skärm och rigg kliver i **exakt takt**, ett pris per knapptryck. (Verifierat i mjukvaran
14 okt — end-to-end genom broker + server.)

Att följa i brokern under testet (eget fönster):
```bash
mosquitto_sub -h <NUC-ip> -v -t 'ecoloco/spel/gm' -t 'ecoloco/rigg/scen' -t 'ecoloco/rigg/award' -t 'ecoloco/rigg/out/#'
```
Du ska se knapptrycken (`ecoloco/spel/gm {"cmd":...}`) följt av serverns svar (`.../award`, `.../out/spot/N`).

---

## 4. Vad vi byggt i Blocks mot spelet — översikt (icke-teknisk)

Tänk tre roller:

- **Spelet = hjärnan.** Det bestämmer allt: vem som vinner priser, öns hälsa, vilka händelser som sker.
- **Riggen = kroppen.** LED, spottar, blandare, ljud. Den gör bara det den blir tillsagd.
- **Dirigenten = tolken** mellan dem. På test-NUC:en är det `hjarna-stubb.py`; i färdig drift blir det **Blocks**.

I Blocks har vi byggt två "enheter" som pratar med spelet via samma broker (MQTT = ett gemensamt
meddelande-nät där alla ropar och lyssnar på namngivna kanaler):

- **EcolocoRigg** — *lyssnar* på spelets besked (scen, öns hälsa, priser, ljud) och *skickar* konkreta
  rigg-kommandon (vilken LED-färg, vilken spot, vilken effekt).
- **EcolocoSpel** — *skickar spelledarens kommandon TILL spelet* (ta kontroll, nästa pris, kör händelse).

Och tre små automatiseringar ("tasks") + knappar:

| Byggdel i Blocks | Vad den gör | Riktning |
|---|---|---|
| **AwardRender** | När spelet ropar ut ett pris → tänd rätt sida/färg på riggen | spelet → rigg |
| **MASTER**-knapp + **GmPublish** | Spelledaren tar kontroll över spelets takt | spelledare → spelet |
| **NÄSTA AWARD**-knapp + **AwardNext** | Spelledaren klickar fram ett pris i taget | spelledare → spelet |

**Hur det hänger ihop:** normalt sköter spelet sig självt och riggen följer med (det är Test A).
När spelledaren trycker MASTER pausar spelet prisutdelningen och **väntar på "kör"**. Varje tryck på
NÄSTA AWARD skickar ett "kör"-meddelande till spelet, som då stegar fram nästa pris på **både**
spelarnas skärmar och riggen samtidigt (det är Test B).

### Så här byggde vi det i Blocks — steg för steg (för att backtracka)

1. **Manage → Network Devices:** skapade två enheter med drivern *Configurable MQTT*, mot projektets broker:
   - **EcolocoRigg** (Topic Base `ecoloco/rigg`). Dess "Custom Options" = listan av properties:
     *lyssnar* på `scen`, `ohalsa`, `award` (typ+lag), `wave`, `countdown`, `ljud`;
     *skickar* `led1–4`, `fx`, `spot1–4`.
   - **EcolocoSpel** (Topic Base `ecoloco/spel`). En property `gm` som *skickar* spelledar-kommandon.
2. **Realm-variabel `gmMaster`** (på/av-flagga) + en **MASTER**-knapp som togglar den.
3. **Tasks** (grupp *Dirigent*):
   - **AwardRender** — triggar på *Property Change* när `EcolocoRigg.awardLag` ändras; tänder spot/LED
     för rätt lag (aker→1, skog→2, tundra→3, stad→4) i pris-typens färg.
   - **GmPublish** — triggar på `gmMaster`-ändring; skickar `{"cmd":"gm","on":true/false}` till spelet.
   - **AwardNext** — skickar `{"cmd":"award_next"}` till spelet. Startas av NÄSTA AWARD-knappen.
4. **Knappar** bundna till tasks (MASTER → gmMaster, NÄSTA AWARD → startar AwardNext).

Kommandona som Blocks skickar till spelet (kanalen `ecoloco/spel/gm`):
`{"cmd":"gm","on":true}` · `{"cmd":"gm","on":false}` · `{"cmd":"award_next"}`
(och senare `{"cmd":"event","beslut":"ja"|"nej"}`, `{"cmd":"pengaslapp"}`).

> Status 14 okt: spelsidan (server + skärm) klar och verifierad end-to-end. I Blocks är EcolocoRigg +
> AwardRender byggda och testade (riggen tänds på award). AwardNext + GmPublish + knapparna byggs/testas nu.
