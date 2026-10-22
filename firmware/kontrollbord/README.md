# Kontrollbord-firmware (bänk) — ESP32-S3

Testfirmware för bänkens kontrollbord: **LED-strip (RGBW) + två I2C-7seg-displayer**.
Flasha, öppna Seriell Monitor och verifiera hårdvaran **utan nätverk** — styr allt med textkommandon.

## Hårdvara (Eriks spec)
| Sak | Anslutning |
|---|---|
| LED-strip (RGBW, SK6812-typ) | **GPIO15**, 2 skyltar à 32 LED = **64** totalt |
| I2C SCL | **GPIO16** |
| I2C SDA | **GPIO18** |
| Money-display | I2C **0x11** |
| Resources-display | I2C **0x12** |

Displayerna tar **4 bytes** = segmentmönster för siffra 1 (längst till höger) → siffra 4 (vänster).
Talet mappas till segment **i ESP:n** (skickas aldrig som decimalt värde). Font = Eriks tabell, **aktiv låg** (0 = tänt segment).

## Flasha
1. Arduino IDE → **Bibliotekshanteraren** → installera **Adafruit NeoPixel**.
2. Kort: **ESP32S3 Dev Module** (installera "esp32 by Espressif" om det saknas). USB CDC On Boot: Enabled.
3. Öppna `kontrollbord.ino`, välj rätt port, **Ladda upp**.
4. Öppna **Seriell Monitor @ 115200**.

## Vad som händer vid boot (självtest)
- I2C-skanning (ska lista **0x11** och **0x12**).
- Stripen sveper **vit → grön → gul**, landar på vitt.
- Displayerna visar **"Eco "/"Loco"**, sedan **1 / 2**.
→ Ser du det lever både LED och displayer.

## Testkommandon (skriv i Seriell Monitor)
```
money 30            visar 30 på Money-displayen
resources 128       visar 128 på Resources
money text Eco      upp till 4 tecken
led white           hela stripen i lagloggans vita
led green           grönt (leder) · led yellow (varning) · led off
led 1 green         bara skylt 1
invert on           invertera 7-seg om displayen är true-kodad
raw money 0x44 0x44 0x44 0x44   råa segment-bytes (font-debug)
scan                I2C-skanning
test                kör självtestet igen
help
```

## Om något ser fel ut
- **Fel siffror/tecken, "spöksegment"** → displayen är troligen *true-kodad* (1 = tänt). Skriv `invert on`. Fungerar det → ändra `invertSeg = true;` som default i `.ino`.
- **Fel LED-färger** (t.ex. rött↔grönt) → strippens färgordning är RGBW, inte GRBW. Ändra `#define LED_TYPE (NEO_RGBW + NEO_KHZ800)`.
- **`scan` hittar inget / I2C-fel** → kolla SDA=18, SCL=16, gemensam GND, och att displayerna har ström + ev. pull-ups. Testa `I2C_HZ 50000` vid långa kablar.
- **LED mörk** → kolla 5V + GND till stripen och dataledningen på GPIO15 (ev. nivåomvandlare 3V3→5V).

## Färgvärden (Eriks logga)
| Läge | R | G | B | W |
|---|---|---|---|---|
| Vitt (logga) | FF | 70 | 00 | FF |
| Grönt (leder) | 00 | FF | 00 | 00 |
| Gult (varning) | FF | 30 | 00 | 00 |

## Nästa steg — MQTT (skarp drift)
I spel-drift styrs bänken via MQTT enligt kontraktet i `../../src/mqtt.js`
(`ecoloco/<benchId>/money | resources | winner | looser`). Den här firmwaren är **test/serie-styrd**;
MQTT-lagret (WiFi/Ethernet + prenumeration på `ecoloco/<benchId>/#` → samma display-/LED-funktioner)
läggs till som ett andra steg när serietestet bekräftat att hårdvaran mappar rätt. Säg till så bygger jag på det.
