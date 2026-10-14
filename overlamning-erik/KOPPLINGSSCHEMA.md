# Kopplingsschema — Förstärkningsriggen (Waveshare ESP32-S3-ETH)

Styrkort: **Waveshare ESP32-S3-ETH** (ESP32-S3 + W5500-ethernet). I testet ansluter kortet via **wifi**;
ethernet-pinnarna hålls fria så kabel kan läggas till senare utan ombyggnad.

## Pinnar (vad som går vart)

| Funktion | GPIO | På kortet | Noteringar |
|----------|------|-----------|------------|
| **WS2812 DATA (DIN)** | **GPIO21** | vänster header | Dataledning till LED-listens DIN |
| **Saftblandare-relä** | **GPIO42** | höger header | Till relä/MOSFET IN (aktiv hög = GPIO HIGH tänder) |
| Spot-relä 1 (aker) | GPIO17 | vänster header | *Valfri* — pil-segmentet gör samma jobb |
| Spot-relä 2 (skog) | GPIO16 | vänster header | *Valfri* |
| Spot-relä 3 (tundra) | GPIO18 | vänster header | *Valfri* |
| Spot-relä 4 (stad) | GPIO15 | vänster header | *Valfri* |
| GND | GND | flera | **Gemensam jord** mellan kort, LED-PSU och relä-PSU |
| 5V in till LED | — | **extern PSU** | INTE från kortet för hela listen (se ström nedan) |

**UPPTAGNA — använd ALDRIG till annat** (W5500/SD/USB/UART/strapping):
GPIO 9,10,11,12,13,14 (ethernet) · 4,5,6,7 (SD) · 19,20 (USB) · 43,44 (UART) · 0,3,45,46 (strapping).

## För Eriks test räcker det med LED + blandare

```
   Extern 5V-PSU ──┬── 5V ───────────────► LED-list  +5V
                   └── GND ──┬──────────► LED-list  GND
                             │
   ESP32-S3-ETH  GPIO21 ─[330Ω]─────────► LED-list  DIN
                 GND ──────────┴ (gemensam jord med PSU)

   ESP32-S3-ETH  GPIO42 ───────────────► relämodul IN   (saftblandare)
                 5V/GND ─────────────────► relämodul VCC/GND
                 relä COM/NO ────────────► saftblandarens matning (Eriks drivsteg)
```

- **Dataledning:** GPIO21 → LED DIN, gärna via ~330 Ω i serie. ESP32-S3 är 3,3 V-logik och WS2812 vill
  ha ~5 V data — på 1 m testlist funkar det oftast direkt, men för **drift lägg in en nivåomvandlare
  74AHCT125** (3,3→5 V) för säker signal.
- **Ström:** LED-listen matas från **extern 5V-PSU**, inte från kortets USB/5V (60 LED kan dra ~3,6 A).
  **Gemensam GND** mellan PSU, LED-list och kortet är ett krav. På drift: större PSU + matning i flera
  punkter (hörn).
- **Saftblandaren:** GPIO42 styr bara reläets/MOSFET:ens IN-stift. **Last-/nätsidan (blandarens motor)
  är Eriks drivsteg** — dimensioneras efter motorns startström, byggs in och säkras. Mjukvaran sätter
  bara pinnen hög/låg.
- **Högtalaren sitter INTE på ESP32:n** — den går till NUC:ens ljud-ut (3,5 mm), och drivs av hjärnan
  (mjukvaran). Se README, steg "Testa ljud".

## Segment-layout på listen (8 segment på EN list)

```
 index:  0    4 5    9 10  14 15  19 | 20      29 30      39 40      49 50      59
         └ amb1 ┘└ amb2 ┘└ amb3 ┘└amb4┘ └ pil 1 ┘ └ pil 2 ┘ └ pil 3 ┘ └ pil 4 ┘
         ambient (led/1..4) = färg+fx   pil (spot/1..4) = chevron, spets i MITTEN
```
Pilarna är chevroner: ytterände → spets (mitt) → ytterände. Justera gränserna i config om du lägger
chevronerna annorlunda fysiskt (ändra `AMBIENT_*` / `ARROW_*`). `NUM_LEDS` sätts efter din list.
