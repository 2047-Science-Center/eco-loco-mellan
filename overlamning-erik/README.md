# Överlämning — Förstärkningsriggen (test via MQTT)

Mål: Erik ska kunna **flasha ESP32-kortet och trigga LED, högtalare och saftblandare från terminalen**,
så vi vet att MQTT-sömmen fungerar innan mötet (där vi kopplar in spelet + Blocks).

Riggens "dumma renderare" (ESP32) lyssnar på en MQTT-broker och ritar LED / slår reläer. Högtalaren
drivs av en liten mjukvara ("hjärnan") på datorn. Allt triggas genom att publicera MQTT från terminalen.

```
  terminal  ──MQTT──►  broker (mosquitto)  ──►  ESP32  ──►  LED-list + saftblandar-relä
                              │
                              └──►  hjärnan (hjarna-stubb.py)  ──►  högtalaren (datorns ljud-ut)
```

Innehåll i mappen:
- **KOPPLINGSSCHEMA.md** — pinnar + inkoppling (Waveshare ESP32-S3-ETH)
- **config-s3-eth.h** — färdig config för kortet (kopieras till firmwaren)
- **testa-rigg.sh** — triggar LED/pil/fx/blandare/ljud från terminalen

---

## Vad du behöver

- Waveshare **ESP32-S3-ETH** + USB-C-kabel
- WS2812-list (1 m för test) + 5V-PSU, ev. relämodul till saftblandaren — se **KOPPLINGSSCHEMA.md**
- En dator (NUC/laptop) på **samma wifi** som ESP32:n, med: Arduino IDE, `git`, `mosquitto` + `mosquitto-clients`, och (för ljudet) Python3 + `mpg123`
- Högtalare i datorns 3,5 mm-ut (för ljudtestet)

---

## 1. Hämta koden

```bash
git clone https://github.com/2047-Science-Center/eco-loco-mellan.git
cd eco-loco-mellan
```

## 2. Koppla hårdvaran

Följ **KOPPLINGSSCHEMA.md**. För grundtestet räcker **LED-list (GPIO21 + 5V-PSU + gemensam GND)** och
**saftblandar-reläet (GPIO42)**.

## 3. Config — wifi + broker-IP

Ta reda på IP:t på datorn som ska köra brokern:
```bash
hostname -I        # Linux   (Mac: ipconfig getifaddr en0)
```
Kopiera den färdiga configen och fyll i:
```bash
cp overlamning-erik/config-s3-eth.h firmware/rigg_arduino/config.h
```
Öppna `firmware/rigg_arduino/config.h` och ändra de tre översta raderna:
- `WIFI_SSID` = ditt wifi-namn
- `WIFI_PASS` = ditt wifi-lösen
- `MQTT_BROKER` = **IP:t från ovan** (datorn som kör mosquitto)

(Pinnarna är redan satta för ESP32-S3-ETH. `NUM_LEDS` = 60 för en 1 m-list — ändra vid annan längd.)

## 4. Flasha i Arduino IDE

1. **Installera ESP32-stöd** (en gång): Inställningar → Fler URL:er till korthanteraren:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   → Korthanterare → installera **esp32 by Espressif**.
2. **Installera bibliotek** (Bibliotekshanteraren): **FastLED**, **PubSubClient**, **ArduinoJson** (v7).
3. Öppna **`firmware/rigg_arduino/rigg_arduino.ino`**.
4. Kort: **ESP32S3 Dev Module**. Sätt **USB CDC On Boot = Enabled**. Välj porten (USB-C i kortet).
5. **Upload**. Öppna Seriell monitor på **115200** — du ska se `[rigg] WiFi OK, IP …` och
   `[rigg] MQTT connected + subscribed`.
   - `WiFi FAILED` → fel SSID/lösen. `MQTT fail rc=…` → fel broker-IP, eller brokern körs inte (steg 5).

## 5. Starta broker (+ hjärnan för ljud) på datorn

**Broker** (eget terminalfönster, låt stå):
```bash
mosquitto -c tools/mosquitto-rigg.conf -v
```
Om "Address already in use" kör redan en broker — bra, hoppa vidare.

**Hjärnan** (behövs bara för högtalaren; eget fönster). Installera spelaren en gång: `sudo apt install -y mpg123`.
```bash
python3 tools/hjarna-stubb.py
```
Vill du ha ljudet på en viss högtalare: `AUDIO_SINK=<sink> python3 tools/hjarna-stubb.py`
(lista med `pactl list short sinks`).

## 6. Testa från terminalen

Eget fönster. Sätt `BROKER` till samma IP du la i config.h (eller `localhost` om du står på broker-datorn):
```bash
BROKER=192.168.1.50 ./overlamning-erik/testa-rigg.sh
```
Du får en `rigg>`-prompt. Prova:

```
rigg> led 1 röd          # ambient-segment 1 blir rött
rigg> led 2 grön         # ambient-segment 2 blir grönt
rigg> pil 2 on           # pil 2 sveper inåt mot spetsen (ärver led 2:s färg)
rigg> pil 2 off
rigg> fx wave            # ljusvåg/chase över ambient-delen
rigg> fx none
rigg> blandare on        # saftblandar-reläet slår till (klick/indikator-LED)
rigg> blandare off
rigg> ljud ding          # ljud i högtalaren  (kräver hjärnan, steg 5)
rigg> ohalsa 15          # kris-look + soundscape (kräver hjärnan)
rigg> demo               # kör igenom allt
rigg> allt-av
rigg> q
```

En rad i taget går också: `BROKER=192.168.1.50 ./overlamning-erik/testa-rigg.sh blandare on`

## Acceptans (så vet vi att det funkar)

- [ ] `led 1 röd` → segment 1 lyser rött · `led 1 av` → släckt
- [ ] `pil 1 on` → pilen animerar (sveper in mot mitten) · `pil 1 off` → släckt
- [ ] `fx wave` → chase rör sig över ambient-delen
- [ ] `blandare on/off` → reläet klickar / saftblandaren går
- [ ] `ljud ding` → ljud hörs i högtalaren
- [ ] Seriell monitor visar `[rigg] ecoloco/rigg/out/… <- …` för varje kommando

## Felsökning

- **Inget på LED men serial visar `<-`-rader** → datapinne (GPIO21) eller gemensam GND (se KOPPLINGSSCHEMA).
- **ESP ansluter inte** → kolla `WIFI_*` och att `MQTT_BROKER` = broker-datorns IP, samma wifi.
- **Broker visar inga `Received PUBLISH`** när du kör testet → fel `BROKER` i testkommandot.
- **LED funkar men inget ljud** → hjärnan (steg 5) körs inte, eller fel ljud-utgång (`AUDIO_SINK`).
- **Pil/ambient hamnar fel på listen** → justera `AMBIENT_*`/`ARROW_*` i config.h efter din fysiska layout.
