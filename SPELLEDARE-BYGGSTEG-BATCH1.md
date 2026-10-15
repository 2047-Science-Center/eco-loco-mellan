# Spelledarpanel — Batch 1 (klick-för-klick)

Allt byggs i **blocks.2047.nu/edit**, realm **Eco Loco**, grupp **Dirigent**.
Enheten heter **`EcolocoRigg`** (litet c!). Kryssa av medan du går.

> **Denna fil ersätter i `SPELLEDARE-BYGGSTEG.md`:** de gamla **WaveStart/WaveStopp**
> (de bygger du INTE — Spänning/Happening nedan tar deras plats) och **§13 Panelknapparna**
> (ny metod: `Set Property → running → true`, inte "Start task").
> Allt annat i den gamla filen (variabler, GmSpot, AttractLook, RundaLook, Countdown) står kvar.

## Vad batchen innehåller (6 tasks + knappar)
1. CountdownStart · 2. CountdownStopp · 3. AttractLook · 4. RundaLook
· 5. SpänningStart (ny) · 6. SpänningStopp (ny) · 7. Happening (ny) · 8. Panelknappar

> **Firmware-krav:** Spänning + Happening använder `fx: "chase"`. Den effekten finns redan
> i `firmware/rigg_arduino/rigg_arduino.ino` (kompilerar rent). Blocks skickar bara strängen
> vidare — ingen Erik/hårdvara behövs för detta.

---

## 0. Grundgester — läs en gång, gäller allt nedan

**De fyra sats-typerna du använder (vad betyder vad):**
- **`do`** = skriv ett värde till en property på enheten *nu* (t.ex. `fx` eller `led1`). Detta är arbetshästen.
- **`wait`** = pausa tasken X millisekunder innan nästa sats körs. Används bara i Happening (3 s mellan tänd och släck).
- **`set local variable`** = räkna fram ett värde och spara i en variabel som bara lever i tasken (RundaLooks `look`).
- **`set realm variable`** = spara ett värde i en realm-variabel som överlever (GmSpot-speglarna — ingår inte i denna batch).

→ Så svaret på din fråga: **CountdownStart är 5 st `do`.** Happening är `do` + `wait` + `do`.
Ingen `log` behövs någonstans i denna batch.

**Skapa en task:** klicka **+** överst i Task-kolumnen → dialog "Add Task" → skriv namnet → **OK**.

**Lägg till en sats (statement):**
1. Öppna sats-paletten (knappen uppe till höger som fäller ut listan: do / wait / set local variable / set realm variable …).
2. **DRA** satsen in i task-kroppen. (Klicka räcker inte — den måste dras.)
3. Vill du ha flera satser i rad: dra in en i taget, uppifrån och ner. Ordningen = körordningen.

**Fyll en `do`-sats:**
1. Klicka i **mål-fältet** ("Target property or function"), skriv pathen, t.ex. `Network.EcolocoRigg.led1`, tryck **Tab**. Nu dyker **set to**-fältet upp.
2. **Trippelklicka** i set to-fältet (markerar det förifyllda), skriv värdet, tryck **Tab**, **klicka sedan i tomt område** utanför fältet.
3. **Kontrollera att texten står kvar.** ← Viktigast av allt. En sats som "ser rätt ut" men inte committats gör **tyst ingenting**.

**Fyll en `wait`-sats:** dra in `wait` från paletten → i dess fält skriv antal **millisekunder** (3 sekunder = `3000`) → Tab → klicka utanför.

**⚠ Citattecken måste vara raka:** `'` och `"` — aldrig böjda. Kopiera helst payloadsen härifrån.

**⚠ Trasig sats** (felrad i Task Log, eller den bara inte gör något): markera raden (klicka radnumret) → **Delete** → bygg om från paletten. Skriv **aldrig** om pathen i en trasig sats.

**Sätt trigger:** markera tasken → höger panel (kugghjuls-fliken):
- **Trigger** = dropdown → **Property Change** (eller **None** där det står None nedan).
- **Property** = Network → `EcolocoRigg` → välj property.
- **Start when property** = **Changes** / **Becomes true** / **Becomes false** (anges per task).

**Trigger Condition:** fältet **högst upp** i task-ytan. Skriv JS-uttrycket där (t.ex. `!gmMaster.value`).

**Testa för hand:** triangeln (▶) vid tasknamnet kör tasken manuellt. Då är `trigger` tomt → uttryck som läser `trigger` tar första grenen (gäller bara AttractLook/RundaLook).

---

## 1. CountdownStart
**Vad:** 5 st `do`. Tänder vit nedräkningspuls + sätter alla fyra sidor vita.

1. Ny task → `CountdownStart`.
2. **Trigger:** Property Change → property `countdown` → Start when property = **Becomes true**.
3. **Trigger Condition:** `!gmMaster.value`
4. Dra in **5 `do`-satser**, en i taget:

| # | typ | mål-path | set to |
|---|-----|----------|--------|
| 1 | do | `Network.EcolocoRigg.fx`   | `'{"fx":"countdown","speed":70}'` |
| 2 | do | `Network.EcolocoRigg.led1` | `'{"h":0,"s":0,"v":80}'` |
| 3 | do | `Network.EcolocoRigg.led2` | `'{"h":0,"s":0,"v":80}'` |
| 4 | do | `Network.EcolocoRigg.led3` | `'{"h":0,"s":0,"v":80}'` |
| 5 | do | `Network.EcolocoRigg.led4` | `'{"h":0,"s":0,"v":80}'` |

- [ ] CountdownStart

---

## 2. CountdownStopp
**Vad:** 1 st `do`. Släcker effekten (looken rättar sig själv nästa gång öhälsan uppdateras).

1. Ny task → `CountdownStopp`.
2. **Trigger:** Property Change → property `countdown` → **Becomes false**.
3. **Trigger Condition:** `!gmMaster.value`
4. Dra in **1 `do`-sats:**

| # | typ | mål-path | set to |
|---|-----|----------|--------|
| 1 | do | `Network.EcolocoRigg.fx` | `'{"fx":"none"}'` |

- [ ] CountdownStopp

---

## 3. AttractLook
**Vad:** 9 st `do`. Lugn grön puls, alla spots av, ingen fx.

1. Ny task → `AttractLook`.
2. **Trigger:** Property Change → property `scen` → **Changes**.
3. **Trigger Condition:** `!gmMaster.value && trigger == 'attract'`
4. Dra in **9 `do`-satser:**

| # | typ | mål-path | set to |
|---|-----|----------|--------|
| 1 | do | `Network.EcolocoRigg.led1` | `'{"h":120,"s":80,"v":40,"puls":20}'` |
| 2 | do | `Network.EcolocoRigg.led2` | `'{"h":120,"s":80,"v":40,"puls":20}'` |
| 3 | do | `Network.EcolocoRigg.led3` | `'{"h":120,"s":80,"v":40,"puls":20}'` |
| 4 | do | `Network.EcolocoRigg.led4` | `'{"h":120,"s":80,"v":40,"puls":20}'` |
| 5 | do | `Network.EcolocoRigg.spot1` | `false` |
| 6 | do | `Network.EcolocoRigg.spot2` | `false` |
| 7 | do | `Network.EcolocoRigg.spot3` | `false` |
| 8 | do | `Network.EcolocoRigg.spot4` | `false` |
| 9 | do | `Network.EcolocoRigg.fx`    | `'{"fx":"none"}'` |

- [ ] AttractLook

---

## 4. RundaLook
**Vad:** 1 st `set local variable` + 4 st `do`. Räknar fram öhälso-färgen en gång, målar alla fyra sidor.

1. Ny task → `RundaLook`.
2. **Trigger:** Property Change → property `scen` → **Changes**.
3. **Trigger Condition:** `!gmMaster.value && trigger == 'runda'`
4. **Sats 1 = `set local variable`** → namn `look` → value to (klistra in HELA raden, en rad, raka citattecken):

```
Network.EcolocoRigg.ohalsa <= 20 ? '{"h":0,"s":100,"v":100,"blink":80}' : Network.EcolocoRigg.ohalsa <= 40 ? '{"h":0,"s":100,"v":50,"puls":30}' : Network.EcolocoRigg.ohalsa <= 60 ? '{"h":50,"s":100,"v":35,"puls":40}' : Network.EcolocoRigg.ohalsa <= 80 ? '{"h":110,"s":90,"v":70}' : '{"h":125,"s":100,"v":70,"puls":60}'
```

5. **Sats 2–5 = `do`** (värdet är variabeln `look`, **utan** citattecken):

| # | typ | mål-path | set to |
|---|-----|----------|--------|
| 2 | do | `Network.EcolocoRigg.led1` | `look` |
| 3 | do | `Network.EcolocoRigg.led2` | `look` |
| 4 | do | `Network.EcolocoRigg.led3` | `look` |
| 5 | do | `Network.EcolocoRigg.led4` | `look` |

- [ ] RundaLook

> `ohalsa` är en läsbar (readOnly) property — den GÅR att läsa i uttryck. Det var bara
> writeOnly-propertysen (led/spot/fx) som inte gick, därför spot-trixet med spotM-variablerna.

---

## 5. SpänningStart (NY — spänningsmoment PÅ)
**Vad:** 1 st `do`. Startar långsam chase. **Trigger: None** (körs bara från panelknapp).

1. Ny task → `SpänningStart`. Lämna **Trigger = None**. Lämna Trigger Condition tom.
2. Dra in **1 `do`-sats:**

| # | typ | mål-path | set to |
|---|-----|----------|--------|
| 1 | do | `Network.EcolocoRigg.fx` | `'{"fx":"chase","speed":50}'` |

- [ ] SpänningStart

---

## 6. SpänningStopp (NY — spänningsmoment AV)
**Vad:** 1 st `do`. **Trigger: None.**

1. Ny task → `SpänningStopp`. Lämna **Trigger = None**.
2. Dra in **1 `do`-sats:**

| # | typ | mål-path | set to |
|---|-----|----------|--------|
| 1 | do | `Network.EcolocoRigg.fx` | `'{"fx":"none"}'` |

- [ ] SpänningStopp

---

## 7. Happening (NY — engångs-chase ~3 s)
**Vad:** `do` + `wait` + `do`. Tänder snabb chase, väntar 3 s, släcker. **Trigger: None.**

1. Ny task → `Happening`. Lämna **Trigger = None**.
2. Dra in satserna i denna ordning:

| # | typ | mål-path / värde | set to |
|---|-----|------------------|--------|
| 1 | do   | `Network.EcolocoRigg.fx` | `'{"fx":"chase","speed":80}'` |
| 2 | wait | — | `3000`  (= 3 sekunder, i ms-fältet på wait-satsen) |
| 3 | do   | `Network.EcolocoRigg.fx` | `'{"fx":"none"}'` |

- [ ] Happening

> Sats 2 är `wait`-satsen dragen från paletten — skriv `3000` i dess millisekund-fält, inte i ett set to.

---

## 8. Panelknapparna (Spelledarpanelen)

**Bindningsmetod (bekräftad, Emils metod):** varje knapp binds som
**Set Property → Realm `Eco Loco` → group `Dirigent` → task → property `running` → true**.
Det "trycker igång" tasken. (Detta ersätter "Start task" i gamla doc:en.)

**Så här per knapp (samma klick-kedja som MASTER-knappen använder):**
1. Markera knappen i kompositionen.
2. I bindnings-/action-fältet välj **Set Property**.
3. Navigera: Realm **Eco Loco** → group **Dirigent** → **task** (välj tasken i tabellen nedan).
4. Property = **running**.
5. Value = **true**.

| Knapp | → task (Set Property → task → running → true) |
|---|---|
| ALLA GRÖNA | GmAllaGrona |
| SLÄCK ALLT | GmSlack |
| SPOT 1 | GmSpot1 |
| SPOT 2 | GmSpot2 |
| SPOT 3 | GmSpot3 |
| SPOT 4 | GmSpot4 |
| HAPPENING | Happening |

- [ ] ALLA GRÖNA → GmAllaGrona
- [ ] SLÄCK ALLT → GmSlack
- [ ] SPOT 1–4 → GmSpot1–4 (om ej redan bundna)
- [ ] HAPPENING → Happening

**SPÄNNING** har två lägen (precis som MASTER fast mot tasks). Två sätt, välj ett:
- **A (två knappar):** knapp **SPÄNNING PÅ** → SpänningStart · knapp **SPÄNNING AV** → SpänningStopp (båda Set Property → task → running → true).
- **B (en toggle-knapp):** PÅ-läget kör `SpänningStart`, AV-läget kör `SpänningStopp`.

- [ ] SPÄNNING PÅ → SpänningStart
- [ ] SPÄNNING AV → SpänningStopp

Panel-URL: `blocks.2047.nu:8080/spot/index.ftl?spot-id=spelledare`

---

## När allt är inlagt
Säg till Claude — verifieras härifrån via brokern (192.168.0.23 genom tunneln):
- `countdown` 1/0 → fx countdown + vita sidor / fx none
- `scen=attract` → grön puls, spots av · `scen=runda` → öhälso-look
- panelknapparna (ALLA GRÖNA / SLÄCK ALLT / SPOT 1–4 / HAPPENING / SPÄNNING PÅ+AV)
- **master-spärren** (MASTER på → spel-cues tysta)

Ljud-spoten byggs sen, separat (ladda upp `assets/audio/rigg/*.mp3` + en ljud-spot).
