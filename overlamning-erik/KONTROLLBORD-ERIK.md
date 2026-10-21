# Kontrollbordet i bänkarna — installationsguide (Erik)

Gäller **bänk-mikrokontrollerna** i Maktspelet / Eco Loco Mellan — en per bänk, som driver
bänkens **sifferdisplayer** och **statuslampa**. Detta är ett *annat* kort än den centrala
förstärkningsriggen (ESP32-S3-ETH, `ecoloco/rigg/out/*`) som beskrivs i resten av den här mappen.

> Källkoden som den här guiden utgår från är Joels gamla klient
> (`ecolocooMicrocontrollerMqttClient`). Den är **oförändrad** — inget är byggt eller flashat av mig.
> Jag har bara läst den. Alla konkreta rad-/filhänvisningar nedan pekar in i den koden.

---

## 1. Vad kortet FAKTISKT är

| Fråga | Svar (ur koden) |
|---|---|
| Kort | **Wiznet W55RP20-EVB-Pico** — `platformio.ini`: `board = wiznet_55rp20_evb_pico`, core `earlephilhower` |
| Chip | RP2040 (samma pinout som Raspberry Pi Pico) + **W5500 Ethernet inbyggt** i samma kapsel (W55RP20) |
| Anslutning | **Trådbunden Ethernet** (RJ45), inte wifi — `EthernetHandler.cpp` använder `W55RP20lwIP` / `Wiznet55rp20lwIP eth(17)` |
| Not om "wifi" | Koden har `#include <WiFi.h>` och en `WiFiClient`, men det är bara earlephilhower-corens enhetliga lwIP-klient som i praktiken kör **över Ethernet-gränssnittet**. Ingen radio. |

**Alltså:** Josefs minnesbild "ESP32 med wifikort" stämmer inte för *det här* kortet. Det är ett
Wiznet RP2040-kort med **kabel-Ethernet**. (Den centrala riggen är en ESP32-S3-ETH — också Ethernet.)
Bekräfta vilket kort som faktiskt sitter i bänkarna i dag.

Upptagna GPIO på W55RP20 (ur bilden i repo:t `src/Skärmbild ….png`): GPIO17, 20, 21, 22, 23, 24, 25
samt SWD och RUN/BOOT-SEL. Fria: GPIO 0–16 (utom 17), 18, 19, 26–29.

### Vad varje bänk driver (tre objekt)

| Objekt | Hårdvara i koden | Pin / adress |
|---|---|---|
| **Sifferverk – pengar** | 4-siffrig 7-segment via I2C (slav 0) | I2C-adress **0x11**, SDA=GPIO4, SCL=GPIO5 |
| **Sifferverk – resurser** | 4-siffrig 7-segment via I2C (slav 1) | I2C-adress **0x12**, SDA=GPIO4, SCL=GPIO5 |
| **Statuslampa** | Adresserbar WS2812B-list, 3 pixlar | DIN = **GPIO1** (`LED_PIN`), `NUM_LEDS = 3` |

> ⚠️ **Viktigt att bekräfta (hårdvara vs Josefs beskrivning):**
> - Josef beskriver **två separata lampor** per bänk (klimatbov-lampa + ledar-lampa). Koden driver
>   bara **EN** WS2812-list (GPIO1, 3 px). Den listen lyser antingen **röd** (topic `winner`), **grön**
>   (topic `looser`) eller släckt — färgen är enda skillnaden, och de kan **inte lysa samtidigt**
>   (sista meddelandet vinner). Vill ni ha två fysiskt skilda lampor som kan lysa samtidigt krävs en
>   firmware-ändring (andra datapin + andra LED-array). **Bekräfta med Josef om en färgkodad lampa
>   räcker, eller om det ska vara två.**
> - Josef/du beskriver **en** 4-siffrig display per bänk. Koden pratar med **två** I2C-slavar
>   (0x11 pengar, 0x12 resurser). **Bekräfta: en eller två fysiska displayer per bänk?**

---

## 2. Konfig per bänk (vad du ändrar innan flash)

Allt per-kort-specifikt ligger i **två filer**. Inga hemligheter i koden.

### `src/MqttHandler.cpp`
| Rad | Nuvarande värde | Ändra till |
|---|---|---|
| `broker` (rad 13) | `"172.20.1.2"` (gammalt nät) | **`"192.168.0.23"`** (2047-brokern) |
| `benchId` (rad 20) | `"0"` | **unikt per bänk** — se §4 om vilket schema som gäller |
| `mqttPort` (rad 22) | `1883` | oförändrat (standard) |
| MQTT-klient-id (rad 78) | `"RP2040Client"` | **gör unikt per bänk**, t.ex. `"bench-0"`. Identiskt id på flera kort → brokern kickar dubbletter. |

### `src/EthernetHandler.cpp`
| Rad | Nuvarande värde | Ändra till |
|---|---|---|
| `ip` (rad 12) | `172,20,1,101` | **unik IP i broker-nätet**, t.ex. `192,168,0,101/102/103/104` — *eller* byt till DHCP |
| `gateway` (rad 17) | `172,20,1,254` | nätets gateway (t.ex. `192,168,0,1`) |
| `subnet` (rad 18) | `255,255,255,0` | normalt oförändrat |
| `mac` (rad 7) | `DE:AD:BE:EF:FE:ED` (samma på alla!) | **unik MAC per kort** — annars IP/ARP-krockar |

> **Nät-flytten:** brokern flyttas från `172.20.1.2` → `192.168.0.23`. Eftersom korten har **statisk
> IP i 172.20.1.x**, måste de också flytta in på **192.168.0.x** (ny IP + gateway per kort), annars når
> de inte brokern. Fråga Josef om 192.168.0.x har **DHCP** — i så fall kan `eth.begin(mac)` köras utan
> `eth.config(...)` och IP tilldelas automatiskt (enklare än 4 handsatta IP:n).

### Wifi
Ingen wifi på det här kortet (Ethernet). Behöver du wifi-lösen för *den centrala riggen* (ESP32-S3):
**fråga Josef**.

---

## 3. Topic-kontraktet (vad kortet LYSSNAR på)

Kortet prenumererar på `ecoloco/<benchId>/#` och filtrerar i callbacken (`MqttHandler.cpp` rad 95–148).
Spelet **publicerar** till dessa topics; kortet publicerar själv ingenting.

| Topic | Payload | Vad som händer | Kod |
|---|---|---|---|
| `ecoloco/<id>/money` | siffersträng, t.ex. `1234` | Visar talet på **pengar-displayen (0x11)**. Endast de 4 sista siffrorna, högerjusterat; kortare tal → blanka positioner. | `MqttHandler.cpp:114`, render i `.ino` `loop()` → `testToSingleSlave(buf, slave_addr[0])` |
| `ecoloco/<id>/resources` | siffersträng | Visar talet på **resurs-displayen (0x12)**. | `MqttHandler.cpp:121` → `slave_addr[1]` |
| `ecoloco/<id>/winner` | **`1` = tänd, `0` = släck** | Tänder hela listen **RÖD** (vid `1`), släcker annars. | `MqttHandler.cpp:108` → `setSingleLed(NUM_LEDS, atoi(msg), CRGB::Red)` |
| `ecoloco/<id>/looser` | **`1` = tänd, `0` = släck** | Tänder hela listen **GRÖN** (vid `1`), släcker annars. | `MqttHandler.cpp:102` → `setSingleLed(…, CRGB::Green)` |
| `ecoloco/<id>/changebench` | ny benchId-sträng | Kortet kopplar om och prenumererar under nytt id i drift (ingen omflash). | `MqttHandler.cpp:128,149` |
| `ecoloco/<id>/displaymoney` | heltal | Sätter bara en intern variabel `displayMoneyNumbers`. **Används inte i renderingen → ingen synlig effekt i dag.** Kan ignoreras. | `MqttHandler.cpp:134`, `i2cHandler.cpp:258` |
| `ecoloco/<id>/displayresources` | heltal | Som ovan (`displayResourceNumbers`). Ingen synlig effekt. | `MqttHandler.cpp:141`, `i2cHandler.cpp:262` |

> **OBS om `winner`/`looser`:** trots att koden gör `atoi(msg)` är payloaden **inte** ett LED-index och
> inte en färg. `setSingleLed()` (`LedsHandler.cpp:33`) jämför `LedOn == 1` och tänder/släcker **alla**
> pixlar. Så: **`1` = på, allt annat (t.ex. `0`) = av.** Färgen bestäms av vilket topic (winner=röd,
> looser=grön), inte av payloaden.

> ⚠️ **Färg-krock att ta ställning till:** firmwaren ger **winner = RÖD**, **looser = GRÖN**. Men
> semantiskt vill spelet att **ledaren (rikast)** lyser och **klimatboven (värsta förorenaren)** lyser,
> och i spelets befintliga stubb är `winner` = ledaren och `looser` = klimatboven. Det ger idag
> **ledare → röd**, **klimatbov → grön** — tvärtemot intuitionen (bov borde vara röd/varning).
> Lös detta på **ett** ställe: antingen byt färgerna i `MqttHandler.cpp` (winner→grön/guld, looser→röd),
> eller låt spelet publicera "tvärtom". **Josef + Erik bestämmer.** (Se SPELSPEC-dokumentet.)

---

## 4. benchId — vilket schema gäller?

Det finns **tre** scheman i omlopp just nu. De måste samordnas (firmware ↔ spel ↔ fysisk bänk):

| Källa | Värden |
|---|---|
| Firmwarens default (`benchId`) | `"0"` |
| Spelets befintliga stubb (`src/mqtt.js` `BENCH`) | `eco1`, `eco2`, `eco3`, `eco4` |
| Förslag i denna överlämning | `aker=0, skog=1, tundra=2, stad=3` |

**Åtgärd:** Josef väljer **ett** schema. Firmwarens `benchId` på varje kort och spelets `BENCH`-karta
måste sedan matcha exakt, annars når inga meddelanden fram. (Det är bara en sträng — välj det som är
lättast att etikettera fysiskt på bänkarna.)

---

## 5. Punkt-/siffer-mappningen — det DU fyller i

Mappningen "vilken segment-bit tänder vilket fysiskt segment" bor i
**`src/i2cHandler.cpp`, `getSegmentByte()` (rad 28–120)**.

- Bit-ordning enligt kommentaren: **`A B C D E F G DP`** (MSB → LSB), `1` = segmentet tänt.
  Ex: `'0'` → `0b11111100` (A–F tända, G och DP släckta).
- Varje `money`/`resources`-meddelande skickar **4 byte** till en display (`testToSingleSlave`,
  `i2cHandler.cpp:181`): **`data[0]` = sista (högra) siffran … `data[3]` = första (vänstra)**.
  Positioner utan siffra fylls med `'r'` = blankt.

**Vad du behöver göra:** kontrollera att bit-ordningen `A B C D E F G DP` och de 4-byte-positionerna
stämmer mot hur *dina* displayer faktiskt är kopplade (vilken bit → vilket segment, och vilken byte →
vilken siffra). Om din display har annan segment-ordning: **redigera bit-mönstren i `getSegmentByte()`**.
Om siffer-ordningen är omvänd: justera loopen i `testToSingleSlave()`. (Det här är den mappning du,
Erik, redan kan — notera bara att *det är här i koden den sitter*.)

---

## 6. Flasha (Josef flashar / du styr själv — kör inte åt någon)

Projektet är PlatformIO (`platformio.ini`, env `wiznet_55rp20_evb_pico`). Kräver
`maxgerhardt/platform-raspberrypi` + core `earlephilhower`, samt biblioteken `W55RP20lwIP`,
`PubSubClient`, `FastLED` (ligger i `~/Documents/Arduino/libraries` enligt `lib_extra_dirs`).

Grovt: `pio run -e wiznet_55rp20_evb_pico` → UF2 hamnar i `src/build/…`. Håll BOOTSEL inne,
anslut USB (kortet dyker upp som masslagring), släpp UF2:n där. Seriell monitor 115200.

> Jag anger kommandon men kör inte flash/upload åt dig — det gör du (eller Josef).

### Vad du ska se vid boot (inbyggd självtest, `.ino` `setup()`)
1. LED-listen lyser **grön** ~5 s (LED-självtest).
2. Displayerna visar i tur och ordning `1111`, `5555`, `rrrr` (segmenttest), samt `M ON` / `E ON`
   (I2C/Ethernet/MQTT-ok-markörer).
3. Serien skriver `MQTT ansluten` + `Prenumererar på: ecoloco/<id>/#`.

---

## 7. Testsekvens från terminalen (utan spelet)

Starta inget spel. Publicera för hand mot 2047-brokern och se bänken reagera.
Byt `<id>` mot bänkens faktiska benchId (se §4).

```bash
# Pengar-displayen (0x11)
mosquitto_pub -h 192.168.0.23 -t ecoloco/<id>/money     -m 1234
# Resurs-displayen (0x12)
mosquitto_pub -h 192.168.0.23 -t ecoloco/<id>/resources -m 56
# Statuslampa RÖD på / av
mosquitto_pub -h 192.168.0.23 -t ecoloco/<id>/winner    -m 1
mosquitto_pub -h 192.168.0.23 -t ecoloco/<id>/winner    -m 0
# Statuslampa GRÖN på / av
mosquitto_pub -h 192.168.0.23 -t ecoloco/<id>/looser    -m 1
mosquitto_pub -h 192.168.0.23 -t ecoloco/<id>/looser    -m 0
# Byt bänk-id i drift (ingen omflash)
mosquitto_pub -h 192.168.0.23 -t ecoloco/<id>/changebench -m 2
```

### Acceptans
- [ ] `money 1234` → pengar-displayen visar `1234`
- [ ] `resources 56` → resurs-displayen visar `  56` (två blanka framför)
- [ ] `winner 1` → lampan lyser röd · `winner 0` → släckt
- [ ] `looser 1` → lampan lyser grön · `looser 0` → släckt
- [ ] Seriell monitor skriver en rad per mottaget meddelande (`Money received:` osv.)

---

## 8. Att bekräfta (checklista)

- [ ] Är kortet i bänkarna verkligen W55RP20 (Ethernet), eller ett annat kort?
- [ ] En färgkodad lampa per bänk räcker — eller krävs två fysiska lampor (→ firmware-ändring)?
- [ ] En eller två fysiska 7-seg-displayer per bänk?
- [ ] Vilket **benchId-schema** gäller (§4)?
- [ ] 192.168.0.x: **DHCP eller statiska IP** per kort? Gateway?
- [ ] **Färg-mappningen** winner/looser (§3-krocken) — behåll eller byt?
- [ ] Unik **MAC** och unikt **MQTT-klient-id** per kort inlagt?
