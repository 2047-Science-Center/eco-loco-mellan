# Överlämning — kontrollbordens DRIFT-firmware (WiFi + MQTT)

Hej Erik! Det här är **driftfirmwaren** för bänkarnas kontrollbord — samma display/LED-kod du
redan verifierat via serie, men matad av spelet över **WiFi + MQTT**. Flashas **en gång per bänk**.

**Fil att flasha:** `kontrollbord_mqtt.ino` (i den här mappen).

---

## 1. Ändra TVÅ saker före varje flash

### A) `BENCH_ID` — en rad, olika per bänk (det är hela "lösning A")
Högst upp i filen: `#define BENCH_ID "eco1"`. Sätt rätt id för bänken du flashar:

| Bänk (lag) | Område | **BENCH_ID** |
|---|---|---|
| **Oxen** | Åker | **`eco1`** |
| **Björnen** | Skog | **`eco2`** |
| **Räven** | Tundra | **`eco3`** |
| **Örnen** | Stad | **`eco4`** |

> ⚠️ **Detta är "vad siffrorna motsvarar":** `eco1`=Oxen/Åker, `eco2`=Björnen/Skog, `eco3`=Räven/Tundra,
> `eco4`=Örnen/Stad. Id:t MÅSTE matcha bänkens fysiska plats (och samma lag som LED-pilarna pekar på).
> Fel id → bänken visar ett annat lags pengar.

### B) WiFi + broker (SAMMA på alla fyra)
```
#define WIFI_SSID   "..."          // 2047-nätets WiFi — fråga Josef
#define WIFI_PASS   "..."          // fyll i LOKALT, skriv aldrig in i repot
#define MQTT_HOST   "192.168.0.23" // ligger redan rätt (2047-brokern)
```
Allt annat lämnar du orört.

---

## 2. Flasha
1. Bibliotekshanteraren: installera **Adafruit NeoPixel** + **PubSubClient**.
2. Kort: **ESP32S3 Dev Module**, USB CDC On Boot: **Enabled**, 115200 baud.
3. Ändra A + B ovan → **Ladda upp**.
4. Upprepa för varje bänk med dess `BENCH_ID` (4 flashningar totalt).

---

## 3. Vad bänken visar (signalerna från spelet)
Bänken prenumererar på `ecoloco/<BENCH_ID>/#` och driver:

| Signal | Vad | Effekt |
|---|---|---|
| `…/money` | lagets **pengar** (rått tal) | Money-displayen **0x11** |
| `…/resources` | lagets **resurser/material** (rått tal) | Resources-displayen **0x12** |
| `…/winner` | laget **leder** (rikast) | **LEDARE-skylten**: **grön** om leder, annars stark **vit** |
| `…/looser` | laget är **klimatbov** (värst för ön) | **SABOTÖR-skylten**: **gul** om klimatbov, annars **släckt** |
| `…/displaymoney`, `…/displayresources` | — | ignoreras (no-op) |

> **Två skyltar (viktigt):** LED-stripens två sektioner är **en LEDARE-skylt** och **en SABOTÖR-skylt** —
> inte en gemensam logga. LEDARE-skylten lyser alltid (stark vit, grön när laget leder). SABOTÖR-skylten
> är **släckt** utom när laget är klimatbov (då gul). Vilken sektion som är vilken sätts med `#define
> LEADER_SIGN` / `SABOTEUR_SIGN` högst upp — **byt dem om de fysiska skyltarna sitter tvärtom** på bänken.

> Siffrorna på displayerna är **de verkliga pengar-/resursvärdena** från spelet (mappas till segment i ESP:n
> via din font-tabell). Om BÅDE leder och klimatbov samtidigt: **gul** (varning) prioriteras — säg till om
> du vill ha grön istället.

---

## 4. Verifiera
- **Vid boot (självtest):** LED-loggan blir **vit**, displayerna visar **1 / 2**. → hårdvaran lever.
- **När spelet kör:** displayerna följer lagets pengar/resurser **i realtid** (uppdateras i samma stund de
  ändras i spelet), och LED-loggan skiftar grön/gul efter vem som leder/är klimatbov.
- **Retained:** startar en bänk om mitt i ett parti får den **direkt** senaste värdet (spelet publicerar retained).
- Serie-monitor @115200 skriver ut WiFi-IP, MQTT-anslutning och prenumerationen — bra vid felsökning.

---

## 5. WiFi nu — förberett för trådbundet (ETH) sen
Vi kör **WiFi** nu (speglar den beprövade rigg-firmwaren → funkar direkt). Firmwaren är **förberedd för
trådbundet**: längst ner i `kontrollbord_mqtt.ino` finns ett **ALTERNATIV: ETH**-block med W5500-pinnarna
för det här kortet (CS=14, IRQ=10, RST=9, SCLK=13, MISO=12, MOSI=11). När ni vill gå trådbundet byts bara
**transportlagret** (WiFiClient → ETH) — display/LED/MQTT-logiken är oförändrad. `ETH.begin()`-signaturen
skiljer sig mellan ESP32-core-versioner, så stäm av den mot Waveshares ESP32-S3-ETH-exempel när det blir aktuellt.

---

## 6. Säkerhet
WiFi-lösenordet (och allt annat hemligt) skrivs **aldrig** in i repot — fyll i det lokalt i din kopia precis
före flash. Den committade filen har platshållare `DITT_WIFI` / `DITT_LOSEN`.

Hör av dig om något krånglar — klistra in vad serie-monitorn skriver, så felsöker vi. — Josef (via Claude)
