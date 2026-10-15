# Paus-knapp (fristående ESP32)

En fysisk arkadknapp som **pausar/startar Eco Loco-spelet** över MQTT. Helt
frånkopplad från Blocks och riggen — knappen pratar direkt med spelservern.

Firmwaren är en **dum publicerare**: vid varje tryck publicerar den EN gång till
`ecoloco/spel/pause` med payload `t`. Servern (`server/server.js`,
`attachGmChannel` → `setPaused`) togglar då paus. All mening bor i servern:

| payload | effekt i servern |
|---------|------------------|
| `1`     | pausa            |
| `0`     | fortsätt         |
| annat (`t`) | **toggla**   |

Knappen skickar alltid `t`, så ett tryck = paus, nästa tryck = fortsätt.

## Wiring

- Arkadknappens två ben: **ena benet → GPIO4**, **andra benet → GND**.
- Firmwaren använder `INPUT_PULLUP`, så **ingen extern resistor behövs**.
- Tryck drar pinnen till LOW (aktiv-låg) → firmwaren publicerar `t`.
- Inbyggd LED (`LED_BUILTIN`, oftast GPIO2) lyser när **både WiFi och MQTT** är
  anslutna = klart att trycka. Saknar kortet inbyggd LED skadar det inget.

### GPIO-val

**GPIO4** är vald medvetet: den är **icke-strapping** och säker på både classic
ESP32 och ESP32-S3 (till skillnad från t.ex. 0/2/5/12/15 på classic eller
0/3/45/46 på S3). Vill du byta pin: ändra `BUTTON_PIN` i `config.h` och håll dig
till en fri, icke-strapping GPIO.

## Flash-guide (Arduino IDE)

1. **Kort:** Tools → Board → "ESP32 Dev Module" (generisk ESP32). På ett
   ESP32-S3-kort: välj "ESP32S3 Dev Module" och sätt *USB CDC On Boot: Enabled*.
2. **Bibliotek:** Library Manager → installera **PubSubClient** (Nick O'Leary).
3. **Konfig:** kopiera exempelfilen och fyll i:
   ```sh
   cp config.example.h config.h
   ```
   Sätt `WIFI_SSID`, `WIFI_PASS`, `MQTT_BROKER` (broker-lådans fasta IP) och ev.
   `MQTT_CLIENT` / `BUTTON_PIN`. `config.h` är gitignorad — checkas aldrig in.
4. **Upload:** öppna `paus-knapp.ino`, välj rätt port, klicka Upload.
5. **Seriemonitor:** 115200 baud. Du ska se `WiFi OK` + `MQTT connected`.

## Testa

- **Med knapp:** tryck på arkadknappen → spelet pausar. Tryck igen → fortsätter.
  Seriemonitorn loggar `[paus] tryck -> ecoloco/spel/pause t`.
- **Utan knapp:** skicka `t` i seriemonitorn = ett simulerat tryck.
- **Från en dator (motsvarande en knapptryckning):**
  ```sh
  mosquitto_pub -h <BROKER_IP> -t ecoloco/spel/pause -m t
  ```
  (`-m 1` pausar explicit, `-m 0` fortsätter explicit.)
