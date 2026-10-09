# Flasha riggens ESP32 — guide för Erik

Målet: du flashar kortet själv, kopplar in brain-boxen och ser riggen lysa styrd över MQTT.
Firmwaren är en **dum renderare** — den tar emot färg/puls/relä-kommandon och gör inget eget.
All logik bor i hjärnan (spel + dirigent), så när lamporna lyder MQTT är din del klar.

## Det här behöver du

- Kortet: **Waveshare ESP32-S3-ETH** (PoE-varianten) — *eller* en klassisk ESP32 DevKit;
  guiden säger var det skiljer.
- USB-C-kabel (dataduglig, inte bara laddkabel) + dator med **Arduino IDE 2.x**.
- Brain-boxen (74AHCT125-nivåomvandlare + reläheader) och WS2812-kedjan från förproduktionen.
- Uppgifter från Josef: **wifi-namn, wifi-lösenord, brokerns IP** (skrivs i `config.h`, hamnar
  aldrig i git).

> **OBS onsdag = wifi.** Kortet har ethernet/PoE men firmwaren kör wifi än så länge —
> kabeldriften är ett senare firmware-steg och ändrar inget i din koppling.

## 1. Engångssetup av Arduino IDE (~10 min, kräver internet)

1. Installera **Arduino IDE 2** (arduino.cc → Software).
2. *Boards Manager* (ikonen med kretskort i vänsterkanten) → sök **esp32** → installera
   **"esp32 by Espressif Systems"** (version 2.0.12 eller nyare).
3. *Library Manager* (bokhyllan) → installera tre bibliotek:
   **FastLED** · **PubSubClient** (av Nick O'Leary) · **ArduinoJson** (av Benoît Blanchon).

## 2. Öppna och konfigurera firmwaren

1. Hämta koden: `git clone https://github.com/2047-Science-Center/eco-loco-mellan.git`
   (eller ta mappen av Josef). Öppna `firmware/rigg_arduino/rigg_arduino.ino` i Arduino IDE.
2. I samma mapp: kopiera `config.example.h` → **`config.h`** (högerklick-kopiera i Finder/
   Utforskaren funkar; IDE:n plockar upp filen som en egen flik vid omstart).
3. Fyll i `config.h`:
   - `WIFI_SSID` / `WIFI_PASS` / `MQTT_BROKER` — uppgifterna från Josef.
   - **Pinnar.** Beror på vilket S3-kort:

     **A) ESP32-S3-DevKitC-1 (drift just nu — ingen ethernet, inget SD):**
     ```c
     #define LED_PIN   21
     #define SPOT_PINS { 4, 5, 6, 7 }
     ```
     *Varför:* utan W5500/SD är GPIO 4–7 och 9–14 fria. 21 (LED-data) + 4/5/6/7 (spots)
     är alla fria, icke-strap, och 4–7 sitter intill varandra i hörnet av underraden
     (…15 7 6 5 4 RST 3V3) → enkelt att löda. Undvik 0/3/19/20/43/44/45/46/48.

     **B) Waveshare ESP32-S3-ETH (PoE-varianten, senare):**
     ```c
     #define LED_PIN   21
     #define SPOT_PINS { 16, 17, 18, 8 }
     ```
     *Varför:* det kortet reserverar GPIO 9–14 (ethernet W5500), 4–7 (SD-kortplats)
     och 33–37 (internt); 0/3/45/46 är boot-pinnar. 21/16/17/8 är fria på headern.

     **Verifiera mot kortets tryckta pinout att alla fem finns på headern innan du löder** —
     stämmer det inte, välj andra ur den fria listan och säg till Josef vilka det blev
     (firmwaren bryr sig inte, bara `config.h` stämmer).
   - `NUM_LEDS` + `SIDE_STARTS/ENDS`: för hela riggen (4 × 1,5 m à 60/m = 360 punkter):
     ```c
     #define NUM_LEDS  360
     #define SIDE_STARTS { 0, 90, 180, 270 }
     #define SIDE_ENDS   { 89, 179, 269, 359 }
     ```
     (Testar du med kortare bit: sätt det du har, t.ex. 60 och 15-intervallen som står där.)
   - `SPOT_ACTIVE_LOW true` för relämodulen (false bara om du mockar med LED på pinnen).

## 3. Flasha

1. *Tools → Board* → **ESP32S3 Dev Module** (klassisk ESP32: **ESP32 Dev Module**).
2. *Tools → USB CDC On Boot* → **Enabled** (viktigt på S3 — annars syns ingen serieutskrift).
3. Koppla in USB-C, välj porten under *Tools → Port*.
4. Tryck **Upload** (pilen). Om uppladdningen inte hittar kortet: håll **BOOT** nedtryckt,
   tryck **RESET** kort, släpp RESET, släpp BOOT — försök igen.
5. Öppna *Serial Monitor* (förstoringsglaset uppe till höger), **115200 baud**. Du ska se:
   ```
   [rigg] start
   [rigg] WiFi OK, IP 192.168.x.x
   [rigg] MQTT connected + subscribed
   ```
   - `WiFi FAILED` → fel SSID/lösen i config.h, eller 5 GHz-nät (ESP32 kräver 2,4 GHz).
   - `MQTT fail rc=-2` om och om → fel broker-IP, eller brokern nere/annat nät.

## 4. Verifiera utan hjärna (räcker för att godkänna din del)

Från vilken dator som helst på samma nät (mosquitto-clients installerat):

```bash
# Sida 1 röd med puls:
mosquitto_pub -h <BROKER-IP> -t ecoloco/rigg/out/led/1 -m '{"h":0,"s":100,"v":100,"puls":50}'
# Alla sidor olika färger, wave-effekt, spottar:
bash tools/mock-rigg-granular.sh <BROKER-IP>     # ligger i repot
# Släck allt:
mosquitto_pub -h <BROKER-IP> -t ecoloco/rigg/out/fx -m '{"fx":"none"}'
```

Lyder stripen och klickar reläerna är **firmware + hårdvara godkända** — allt ovanför
(spel → hjärna) är redan verifierat och pratar exakt samma topics.

## 5. Hela kedjan på plats (med Josef på tråden)

1. Brokern kör på Mint-datorn (Josef verifierar via SSH).
2. Josef startar spel + hjärna på Mint-datorn remote.
3. Kör ett botparti: riggen ska följa öhälsan (grönt→gult→rött alarm), göra wave vid bokslut,
   peka ut vinnare med spot + färg vid awards.

## Vanliga fel

| Symptom | Fix |
|---|---|
| Inget lyser alls | Datapinnen: rätt GPIO i config.h? Nivåomvandlaren matad? GND gemensam mellan PSU och ESP32? |
| Lyser men fel färger | Färgordning — firmwaren kör GRB (stämmer för våra strippar); fel typ av strip? |
| Första lysdioden spökar | Klassiskt utan nivåomvandlare — kontrollera 74AHCT125-vägen |
| Reläer inverterade | Växla `SPOT_ACTIVE_LOW` |
| Kortet syns inte som port | Datakabel? BOOT+RESET-tricket. Linux: `sudo usermod -aG dialout $USER` + logga ut/in |
| Funkar på bänken, inte i riggen | Spänningsfall — ström-injektionerna inkopplade i bägge ändar? |
