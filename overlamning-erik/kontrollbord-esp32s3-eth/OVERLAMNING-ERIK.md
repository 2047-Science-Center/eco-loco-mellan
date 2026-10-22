# Överlämning till Erik — kontrollbords-firmware (ESP32-S3-ETH)

Hej Erik! Det här är **testfirmwaren för bänkens kontrollbord**, byggd direkt ur din instruktion
(LED-strip + två I2C-7seg-displayer). Innan vi går vidare vill jag att du **bekräftar att jag
tolkat dig rätt** — se "Öppna frågor" sist. Firmwaren är serie-styrd (ingen MQTT än) så du kan
flasha och verifiera hårdvaran direkt.

**Paketet (i den här mappen):**
- `kontrollbord.ino` — firmwaren att flasha
- `README.md` — flash- + testguide (bibliotek, kort, kommandon)
- `OVERLAMNING-ERIK.md` — det här dokumentet

---

## 1. Pinout — avstämt mot ESP32-S3-ETH (Waveshare, W5500)

Jag har kollat dina valda pinnar mot kortets reserverade pinnar. **Alla dina val är fria** — inga
krockar med Ethernet (W5500) eller SD-kortet:

| Funktion | Pin | Status på ESP32-S3-ETH |
|---|---|---|
| **LED-strip (data)** | **GPIO15** | ✅ fri GPIO |
| **I2C SCL** | **GPIO16** | ✅ fri GPIO |
| **I2C SDA** | **GPIO18** | ✅ fri GPIO |

Reserverat på kortet (använd **inte** till annat):
- **W5500 Ethernet:** MOSI=GPIO11 · MISO=GPIO12 · CLK=GPIO13 · CS=GPIO14 · INT=GPIO10 · RST=GPIO9
- **SD-kort:** MOSI=GPIO6 · MISO=GPIO5 · CLK=GPIO7 · CS=GPIO4
- **USB (native):** D+=GPIO19 · D−=GPIO20 · **UART0:** TX=GPIO43 · RX=GPIO44
- **Strapping (undvik som I/O):** GPIO0, GPIO3, GPIO45, GPIO46

→ GPIO15/16/18 ligger utanför allt detta. Lediga reserv-pinnar om något behöver flyttas:
GPIO1, 2, 8, 17, 21 (vänster header) och GPIO33–42, 47, 48 (höger header).

---

## 2. Så här har jag tolkat din instruktion

**LED-stripen (RGBW)**
- Styrs från **GPIO15**.
- RGBW-strip (SK6812-typ) — jag driver R, G, B **och** vit-kanalen separat.
- **Två sektioner i serie på samma dataledning**, 32 LED/skylt → LED 0–31 = skylt 1, LED 32–63 = skylt 2 (totalt 64).
- Färgerna (dina värden), satta per pixel:
  | Läge | R | G | B | W |
  |---|---|---|---|---|
  | Vitt i lagloggan | FF | 70 | 00 | FF |
  | Grönt (leder) | 00 | FF | 00 | 00 |
  | Gult (varning) | FF | 30 | 00 | 00 |

**Displayerna (I2C)**
- **SCL=GPIO16, SDA=GPIO18.** Adresser **0x11 (Money)**, **0x12 (Resources)**.
- Varje display får **4 bytes**: segmentmönster för **siffra 1 (längst till höger) → siffra 4 (vänster)**.
  Jag skickar byte-ordningen *siffra 1 först* (rå `Wire`-skrivning till adressen, **inget register-/kommando-byte** före — säg till om det ska vara ett).
- **Talet mappas till segment i ESP:n**, aldrig som decimalvärde — precis som du sa, så vi kan visa valfritt tecken.
- Font = **din exakta tabell** (bitordning `E G B F A . D C`), transkriberad rakt av. Alla 28 tecken (0–9, släckt, streck, P,E,t,H,n,o,u,c,r,L,C,d,h,F).
- **Active-low** antaget (bitvärde 0 = tänt segment, som du skrev). Är displayen true-kodad finns kommandot `invert on` (och en default-flagga i koden) för att vända allt — ingen omkodning behövs.

**Uppstart (som Joel)**
- Vid boot: I2C-skanning + LED-svep (vit→grön→gul) + displayerna visar **"Eco "/"Loco"**, sedan **1 / 2**. Så ser man direkt att allt lever innan spelet kopplas på.

---

## 3. Öppna frågor — bekräfta gärna

1. **LED-färgordning:** jag utgår från **GRBW** (vanligast för SK6812-RGBW). Ser färgerna fel ut (t.ex. rött↔grönt) är det **RGBW** — en rad i koden. Vilken är din strip?
2. **I2C-skrivformat:** rena **4 databytes** till adressen, eller ska det föregås av ett **kommando-/register-byte**? (Jag antog rena 4 bytes.)
3. **Byte-ordning:** är **siffra 1 (höger) = första byten** i de fyra? (Jag antog ja, enligt din formulering.)
4. **Active-low:** bekräftat att 0 = tänt? Eller kan displayen vara true-kodad (då kör vi `invert on`)?
5. **Font-dubblett:** i din tabell har **P (0x0E)** och **F (0x1B)** *samma* byte `0b00000111`. Kopieringsmiss, eller stämmer det? (Jag transkriberade exakt — lätt att rätta.)
6. **Ström & nivå:** 64 RGBW-LED kan dra en del 5 V — **egen 5V-matning** till stripen? Och behövs en **nivåomvandlare 3V3→5V** på dataledningen (GPIO15)? Gemensam GND mellan ESP, strip och displayer förutsätts.
7. **Displayernas I2C-nivå:** 3V3 eller 5V, och sitter pull-ups på SDA/SCL någonstans på bordet?

---

## 4. Testa (kort — fullständigt i README.md)
Flasha, öppna Seriell Monitor @ 115200:
```
money 30            visar 30 på Money-displayen (0x11)
resources 128       visar 128 på Resources (0x12)
led white / green / yellow / off
money text Eco      (upp till 4 tecken)
invert on           vänd 7-seg om displayen är true-kodad
raw money 0x44 0x44 0x44 0x44   råa segment-bytes (font-debug)
scan                I2C-skanning (ska hitta 0x11 + 0x12)
```

## 5. Nästa steg (när hårdvaran är verifierad)
Lägga till **MQTT över Ethernet** (W5500 på SPI-pinnarna ovan) så bänken lyssnar på spelets topics
`ecoloco/<benchId>/money | resources | winner | looser` och driver samma display-/LED-funktioner.
Kontraktet finns i `src/mqtt.js` i repot. Vill bara bekräfta mappningen ovan med dig först.

Tack! Hör av dig med svaren på frågorna i §3 så justerar jag firmwaren exakt. — Josef (via Claude)
