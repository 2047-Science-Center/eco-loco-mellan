# Saftblandare på relä — handoff till Erik

Målet: en saftblandare som startar/stoppar på en **given signal** — från spelledaren (manuellt)
eller från spelet. Mjukvaran är klar; din del är den fysiska reläkopplingen mot 230 V-nätet.

Blandaren är bara **en relä-kanal till** på förstärkningsriggen, exakt som en spot
(`0`/`1` = på/av). Inget nytt systemtänk — samma söm som allt annat på riggen.

## Din del (fysiskt)

1. **Ditt drivsteg (MOSFET) mellan GPIO och last.** GPIO:n är **aktiv hög** (HIGH = PÅ) och driver
   gaten; kortet switchar aldrig nätet direkt.
2. **Dimensionera drivsteget + lasten efter blandarens effekt + startström.** Se nedan. En
   saftblandare är en motorlast med hög inrush vid start — välj med rejäl marginal, bygg in och säkra.
   (Hur lasten matas och säkras är din design.)
3. **Bygg in nätsidan** (hölje, dragavlastning, säkring/propp). Lågspänningssidan (kort + relä-IN)
   får sitta på bänk.

## Hur mycket ström drar den? (det Josef inte visste)

- **Läs märkskylten** på blandaren: står oftast i W (t.ex. 300–1200 W) eller A. Dela W/230 ≈ A i drift.
  Ex: 600 W ≈ 2,6 A, 1000 W ≈ 4,3 A kontinuerligt.
- **Startströmmen (inrush) är mångdubbelt högre** i bråkdelen av en sekund när motorn drar igång —
  det är den som avgör relävalet, inte märkeffekten. Därför marginal.
- **Vill du ha exakt siffra:** sätt en plug-in-elmätare (Kill-A-Watt/"energimätare") mellan vägg och
  blandare och läs W vid start och i körning. Säg siffran till Josef så noteras den.

## Testa i två steg

**Steg 1 — fristående, ingen mjukvarustack (börja här).**
Flasha `blandare_test/blandare_test.ino` på valfritt kort du har (ESP32 eller klassisk Arduino Uno/Nano).
Öppna serie-monitorn (115200) och skicka `1`/`0`/`t`/`p`. Reläet ska klicka och inbyggd LED speglar
läget. Testa gärna med en lampa först, koppla sedan in blandaren. När den startar/stannar på kommando
är den fysiska kedjan godkänd. Justera överst i filen: `RELAY_PIN`, `RELAY_ACTIVE_LOW` (true för vanlig
billig relämodul), ev. `BUTTON_PIN`.

**Steg 2 — på riggen över MQTT (samma kort som LED/spottar).**
Blandaren är redan inlagd i rigg-firmwaren som kanal `ecoloco/rigg/out/blandare` (`0`/`1`).
I `config.h` sätter du bara pinnen, t.ex. på ESP32-S3-DevKitC-1:
```c
#define BLANDARE_PIN         15       // fri GPIO intill spot-pinnarna 4-7; verifiera mot kortets pinout
#define BLANDARE_ACTIVE_HIGH true     // MOSFET: GPIO HIGH = PÅ
```
Flasha `rigg_arduino/rigg_arduino.ino` som vanligt (se FLASH-GUIDE-ERIK.md). Verifiera utan hjärna:
```bash
mosquitto_pub -h <BROKER-IP> -t ecoloco/rigg/out/blandare -m 1   # på
mosquitto_pub -h <BROKER-IP> -t ecoloco/rigg/out/blandare -m 0   # av
```
Slår utgången på dessa är din del klar — spelledaren och spelet skickar exakt samma signal ovanifrån.

## Arduino vs ESP32 — en notis
Den fristående testsketchen (steg 1) kör på vilken Arduino som helst. **MQTT-vägen (steg 2) kräver
wifi → ett ESP32-kort** (flashas precis som en Arduino i Arduino IDE). En klassisk Arduino Uno/Nano
saknar nätverk och kan inte vara med på riggens buss. På riggen blir blandaren samma ESP32 som redan
driver LED + spottar — inget extra kort behövs i drift.

## Vad styr den ovanifrån (redan klart i mjukvaran)
- **Spelledaren (manuellt):** `ecoloco/rigg/gm/blandare` `1`/`0` → hjärnan → `out/blandare`.
  I spelledar-mocken: `./tools/mock-rigg-semantisk.sh gm-blandare on` / `off`.
- **Spelet (cue):** `ecoloco/rigg/blandare` `1`/`0`. Topicen finns och hjärnan lyssnar; *när* i spelet
  den ska fyra bestämmer Josef (ännu ej inkopplad i `src/rigg.js`).
