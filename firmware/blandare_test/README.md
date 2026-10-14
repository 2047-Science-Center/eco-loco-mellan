# Blandartest — fristående drivtest för Erik

En liten på/av-programvara för att testa att få igång saftblandaren.
**Ingen app, ingen broker, inget spel, inget wifi** behövs. Du flashar sketchen till ett
kort, kopplar in ditt drivsteg + last, och tänder/släcker — från datorns serie-monitor eller
en knapp. Det är hela mocktestet. (När fysiken är bevisad körs blandaren sen som en kanal på
riggen över MQTT — se `../BLANDARE-ERIK.md`, men strunta i det tills detta funkar.)

**Logiknivåer (enligt din feedback):**
- **Utgången är aktiv hög** — GPIO HIGH = PÅ. Passar att driva en MOSFET direkt.
- **Knapp-ingången är aktiv låg** — `INPUT_PULLUP`, tryck mot GND. (Slå på via `BUTTON_PIN`.)

---

## 1. Det här behöver du

**Styrsidan (lågspänning):**
- Ett **Arduino- eller ESP32-kort** som kan flashas över USB. Vilket som helst duger till
  testet (klassisk Uno/Nano går bra). Ska det sen sitta på riggen krävs ett ESP32 — men inte här.
- **USB-kabel** (dataduglig) mellan dator och kort.
- **Ditt drivsteg** (MOSFET med gate-resistor m.m. — din design) + ev. gemensam matning till lasten.
- **Dupont-kablar** mellan kort och drivsteg. Gemensam GND mellan kort och drivsteg.
- Dator med **Arduino IDE 2.x**.
- *Valfritt:* en tryckknapp + kabel om du vill toggla med knapp i stället för tangentbord.

**Lastsidan (ditt elansvar):**
- En **lampa eller ofarlig testlast för första testet** (se säkerhet).
- Saftblandaren + matning/skydd dimensionerat efter dess effekt inkl. motorns startström.
  Läs effekten på märkskylten (W eller A; W/230 ≈ A) eller mät med en plug-in-elmätare.

---

## 2. Koppling

### Styrsidan — kort → ditt drivsteg

```
Dator ──USB──► Arduino/ESP32
                   │
                   │ GPIO8 (OUT_PIN, AKTIV HÖG) ──► MOSFET-gate (via gate-resistor)
                   │ GND  ─────────────────────────► gemensam GND med drivsteget
                   
   (OUT_PIN = 8 i sketchen. Uno/Nano: 8.  ESP32-S3: ändra till t.ex. 15.)
   HIGH = PÅ, LOW = AV. Boot-säkert: pinnen hålls LOW tills sketchen tagit över.
```

### Lastsidan — ditt drivsteg kopplar lasten

Drivsteget (MOSFET) och hur lasten matas och säkras är din design och ditt ansvar.
Sketchen gör inget annat än att sätta GPIO:n hög/låg.

Hela kedjan:

```
  Dator ──USB──► Arduino ──GPIO (aktiv hög)──► [DITT DRIVSTEG] ──► Lampa (test) → sen Saftblandare
   (skriv 1/0)
```

---

## 3. Flasha sketchen

1. Öppna `blandare_test.ino` i Arduino IDE.
2. *Tools → Board*: välj ditt kort (ESP32: "ESP32S3 Dev Module" el. din ESP32; annars Uno/Nano).
3. Kolla överst i filen: `OUT_PIN` (default 8), `OUT_ACTIVE_HIGH` (default `true`), ev. `BUTTON_PIN`.
4. Koppla in USB, välj porten under *Tools → Port*, tryck **Upload**.
5. Öppna *Serial Monitor*, **115200 baud**.

---

## 4. Testa (tända/släcka)

Skriv i serie-monitorn:

| Skicka | Gör |
|--------|-----|
| `1`    | PÅ (yes) |
| `0`    | AV (no) |
| `t`    | togglar |
| `p`    | puls 3 s och sen av |

Kortets inbyggda LED speglar utgångens läge, så du ser yes/no även utan last inkopplad.
Har du satt en knapp (`BUTTON_PIN`) togglar ett tryck (aktiv låg).

---

## 5. Säkerhet

- Styrsidan (kort + GPIO till drivsteget) är ofarlig lågspänning.
- **Lastsidan och matningen är din design** — dimensionera efter blandarens effekt inkl.
  motorns startström (inrush), bygg in och säkra.
- **Testa först med en lampa/ofarlig last**, så du ser att utgången slår i rätt läge innan
  blandaren kopplas på.

---

## 6. När detta funkar

Då är drivkedjan godkänd. Nästa steg (senare) är att köra blandaren som en kanal på riggen:
sätt `BLANDARE_PIN` i rigg-firmwarens `config.h` (med `BLANDARE_ACTIVE_HIGH true`), flasha
`../rigg_arduino/`, och verifiera med `mosquitto_pub -t ecoloco/rigg/out/blandare -m 1`.
Spelledaren och spelet skickar sen exakt samma på/av ovanifrån. Detaljer i `../BLANDARE-ERIK.md`.
