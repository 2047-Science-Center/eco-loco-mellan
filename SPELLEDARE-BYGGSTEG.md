# Spelledarfunktionen i Blocks — bygg-checklista (steg för steg)

Allt byggs i **blocks.2047.nu/edit**, realm **Eco Loco**, grupp **Dirigent**.
Enheten heter **`EcolocoRigg`** (litet c!). Kryssa av medan du går.

## Redan klart (bygg INTE om)
- [x] Enhet `EcolocoRigg` + 15 properties
- [x] Realm-variabel `gmMaster` (Boolean) + `spotM1` (Boolean)
- [x] Task **AwardCue**, **OhalsaLook**, **GmAllaGrona**, **GmSlack**, **GmSpot1**

## Kvar att bygga (slutmål: 13 tasks)
Variabler `spotM2/3/4` · tasks GmSpot2, GmSpot3, GmSpot4, WaveStart, WaveStopp,
CountdownStart, CountdownStopp, AttractLook, RundaLook · panelknappar · (ljud sist, separat).

---

## 0. Grundgester — läs en gång, gäller allt nedan

**Skapa en task:** klicka **+** överst i Task-kolumnen → dialog "Add Task" → skriv namnet → **OK**.

**Lägg till en sats (statement):**
1. Öppna sats-paletten (knappen uppe till höger som fäller ut listan: do / wait / set local variable / set realm variable …).
2. **DRA** satsen (t.ex. `do`) från paletten in i task-kroppen. (Klicka räcker inte — den måste dras.)

**Fyll en `do`-sats:**
1. Klicka i **mål-fältet** ("Target property or function"), skriv pathen, t.ex. `Network.EcolocoRigg.led1`, tryck **Tab**. Nu dyker **set to**-fältet upp.
2. **Trippelklicka** i set to-fältet (markerar det förifyllda), skriv värdet, tryck **Tab**, och **klicka sedan i tomt område** utanför fältet.
3. **Kontrollera att texten står kvar.** ← Viktigast av allt. Ser det tomt/konstigt ut: gör om. En sats som "ser rätt ut" men inte committats gör **tyst ingenting**.

**⚠ Citattecken måste vara raka:** `'` och `"` — aldrig böjda (`'` `"`). Kopiera helst härifrån.

**⚠ Om en sats blir trasig** (felrad i Task Log, eller den bara inte gör något): markera raden (klicka radnumret) → **Delete** → bygg om den från paletten. Skriv **aldrig** om pathen i en trasig sats.

**Sätt trigger:** markera tasken → höger panel (kugghjuls-fliken):
- **Trigger** = dropdown → välj **Property Change**.
- **Property** = Network → `EcolocoRigg` → välj property i "Select or Type Name" (eller pennan → Custom Path).
- **Start when property** = dropdown → **Changes** / **Becomes true** / **Becomes false** (står angivet per task nedan).

**Trigger Condition:** fältet **högst upp** i task-ytan. Skriv JS-uttrycket där (t.ex. `!gmMaster.value`).

**Testa en task för hand:** triangeln (▶) vid tasknamnet kör den manuellt. OBS: då är `trigger` tomt, så uttryck som läser `trigger` tar första grenen — det gäller bara AttractLook/RundaLook, inte resten.

---

## 1–3. Tre realm-variabler

För var och en av **spotM2**, **spotM3**, **spotM4**:
1. I **Realm Variable**-kolumnen (där `gmMaster` och `spotM1` står): klicka **+**.
2. Dialog "New Realm Variable" → **Name** = `spotM2` (resp. 3, 4).
3. **Type** = **Boolean**.
4. **OK**.

- [ ] spotM2 (Boolean)
- [ ] spotM3 (Boolean)
- [ ] spotM4 (Boolean)

---

## 4–6. GmSpot2, GmSpot3, GmSpot4

En egen task per spott. **Trigger: None** (ingen — den körs bara från panelknappen).
Varje task har **2 satser**. Byt N = 2, 3, 4 (och motsvarande spotMN).

**GmSpot2:**
1. Ny task → namn `GmSpot2`. Lämna Trigger = **None**. Lämna Trigger Condition tom.
2. Dra in `do`-sats → mål `Network.EcolocoRigg.spot2` → Tab → set to: `!spotM2.value`
3. Dra in **`set realm variable`**-sats → välj `spotM2` i dropdownen → value to: `!spotM2.value`

- [ ] GmSpot2
- [ ] GmSpot3  (samma, byt alla "2" → "3")
- [ ] GmSpot4  (samma, byt alla "2" → "4")

> Varför två satser: `!spotMN.value` = "motsatsen till nuvarande läge". Sats 1 skickar det till spotten, sats 2 sparar det nya läget till nästa tryck. Ordningen spelar ingen roll (båda räknar på det gamla värdet).

---

## 7. WaveStart

1. Ny task → `WaveStart`.
2. Trigger: **Property Change** → property `wave` → Start when property = **Becomes true**.
3. Trigger Condition: `!gmMaster.value`
4. En sats: `do` → `Network.EcolocoRigg.fx` → Tab → set to: `'{"fx":"wave","speed":60}'`

- [ ] WaveStart

## 8. WaveStopp

1. Ny task → `WaveStopp`.
2. Trigger: **Property Change** → property `wave` → **Becomes false**.
3. Trigger Condition: `!gmMaster.value`
4. En sats: `do` → `Network.EcolocoRigg.fx` → set to: `'{"fx":"none"}'`

- [ ] WaveStopp

---

## 9. CountdownStart

1. Ny task → `CountdownStart`.
2. Trigger: **Property Change** → property `countdown` → **Becomes true**.
3. Trigger Condition: `!gmMaster.value`
4. **5 satser** (`do`):
   - `Network.EcolocoRigg.fx`  → `'{"fx":"countdown","speed":70}'`
   - `Network.EcolocoRigg.led1` → `'{"h":0,"s":0,"v":80}'`
   - `Network.EcolocoRigg.led2` → `'{"h":0,"s":0,"v":80}'`
   - `Network.EcolocoRigg.led3` → `'{"h":0,"s":0,"v":80}'`
   - `Network.EcolocoRigg.led4` → `'{"h":0,"s":0,"v":80}'`

- [ ] CountdownStart

## 10. CountdownStopp

1. Ny task → `CountdownStopp`.
2. Trigger: **Property Change** → property `countdown` → **Becomes false**.
3. Trigger Condition: `!gmMaster.value`
4. En sats: `do` → `Network.EcolocoRigg.fx` → set to: `'{"fx":"none"}'`

- [ ] CountdownStopp

> (Looken rättar sig själv nästa gång öhälsan uppdateras från spelet.)

---

## 11. AttractLook

1. Ny task → `AttractLook`.
2. Trigger: **Property Change** → property `scen` → **Changes**.
3. Trigger Condition: `!gmMaster.value && trigger == 'attract'`
4. **9 satser** (`do`):
   - `led1` → `'{"h":120,"s":80,"v":40,"puls":20}'`
   - `led2` → `'{"h":120,"s":80,"v":40,"puls":20}'`
   - `led3` → `'{"h":120,"s":80,"v":40,"puls":20}'`
   - `led4` → `'{"h":120,"s":80,"v":40,"puls":20}'`
   - `spot1` → `false`
   - `spot2` → `false`
   - `spot3` → `false`
   - `spot4` → `false`
   - `fx` → `'{"fx":"none"}'`

   (Alla path med `Network.EcolocoRigg.` före, t.ex. `Network.EcolocoRigg.led1`.)

- [ ] AttractLook

---

## 12. RundaLook

1. Ny task → `RundaLook`.
2. Trigger: **Property Change** → property `scen` → **Changes**.
3. Trigger Condition: `!gmMaster.value && trigger == 'runda'`
4. **Första satsen = `set local variable`** → namn `look` → value to (klistra in HELA raden, en rad):

```
Network.EcolocoRigg.ohalsa <= 20 ? '{"h":0,"s":100,"v":100,"blink":80}' : Network.EcolocoRigg.ohalsa <= 40 ? '{"h":0,"s":100,"v":50,"puls":30}' : Network.EcolocoRigg.ohalsa <= 60 ? '{"h":50,"s":100,"v":35,"puls":40}' : Network.EcolocoRigg.ohalsa <= 80 ? '{"h":110,"s":90,"v":70}' : '{"h":125,"s":100,"v":70,"puls":60}'
```

5. Sedan **4 `do`-satser**:
   - `Network.EcolocoRigg.led1` → set to: `look`
   - `Network.EcolocoRigg.led2` → set to: `look`
   - `Network.EcolocoRigg.led3` → set to: `look`
   - `Network.EcolocoRigg.led4` → set to: `look`

   (`look` utan citattecken — det är variabeln, inte text.)

- [ ] RundaLook

> `ohalsa` är en läsbar (readOnly) property — den GÅR att läsa i uttryck. Det var bara writeOnly-propertysen (led/spot/fx) som inte gick, därför spot-trixet med spotM-variablerna.

---

## 13. Panelknapparna (Spelledarpanelen)

MASTER-knappen är redan bunden. Gör likadant för resten, men i stället för att växla variabeln binder du knappen till **Start task**:

| Knapp | Start task |
|---|---|
| ALLA GRÖNA | GmAllaGrona |
| SLÄCK ALLT | GmSlack |
| SPOT 1 | GmSpot1 |
| SPOT 2 | GmSpot2 |
| SPOT 3 | GmSpot3 |
| SPOT 4 | GmSpot4 |

- [ ] ALLA GRÖNA → GmAllaGrona
- [ ] SLÄCK ALLT → GmSlack
- [ ] SPOT 1–4 → GmSpot1–4

Panel-URL: `blocks.2047.nu:8080/spot/index.ftl?spot-id=spelledare`

---

## När allt är inlagt
Säg till Claude — verifieras härifrån via brokern (192.168.0.23 genom tunneln):
wave/countdown/attract/runda/award-pub → rätt payloads ut, panelknappar, och
**master-spärren** (MASTER på → spel-cues ska vara tysta). Ljud-spoten byggs sen,
separat (ladda upp `assets/audio/rigg/*.mp3` + en ljud-spot).
