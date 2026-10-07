# Rigg-firmware (ESP8266 prototyp → ESP32 drift)

Dum renderare för förstärkningsriggen. Lyssnar på granulära MQTT-topics (se `../../RIGG-KONTRAKT.md`)
och ritar lokalt. Ingen spel-logik här.

## Kom igång

```bash
cp src/config.example.h src/config.h      # fyll i wifi + broker-IP
pio run -e nodemcuv2 -t upload            # flasha Amican (ESP8266)
pio device monitor                        # se logg
```

Testa utan spel/hjärna, från broker-lådan eller laptopen:
```bash
BROKER=<broker-ip> ../../tools/mock-rigg-granular.sh demo
```

## Koppling (NodeMCU, prototyp)

| Signal | NodeMCU-pin | GPIO |
|--------|-------------|------|
| LED-data (WS2812B) | D2 | 4 |
| Spot 1–4 (relä) | D5 / D6 / D7 / D1 | 14 / 12 / 13 / 5 |

- LED: gemensam GND mellan strip-PSU och NodeMCU. 1 m funkar oftast med 3,3 V data rakt in;
  på full längd (kvadraten) – lägg in 74AHCT125 nivåomvandlare + mata 5 V i flera punkter.
- Relämodul: `SPOT_ACTIVE_LOW true` i config. Testar du med en LED på pinnen i stället → sätt `false`.

## Byta till ESP32 / S3 (husstandard) senare

1. `pio run -e esp32dev -t upload` (eller `-e esp32-s3`).
2. I `src/config.h`: byt `LED_PIN` och `SPOT_PINS` till ESP32:ns GPIO.
   På S3-PoE-kortet: undvik W5500:ns SPI-pinnar. Låt Josef/Claude bekräfta pin-kartan mot kortet.

Koden i övrigt är oförändrad – FastLED sköter chip-skillnaden.
