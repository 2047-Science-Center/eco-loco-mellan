# Touchstation-baspaket (Linux Mint)

Gemensam grund för X&Y-touchstationerna — **Förhandlingen** och **Minnestest**
(och kommande stationer). Sköter det som är likadant oavsett station:

- **Touch → rätt skärm**, bundet till fysisk USB-port så det håller över omstart
  (även för två *identiska* paneler, där xinput-id annars byter plats).
- **Självläkande mappning** som överlever inloggnings-reset, skärm-hotplug och
  strömblink — utan att någon behöver köra ett kommando.
- **Skrivbordsknapp "Reset touch"** för när man ändå vill tvinga om på plats.

Station-specifik start (kiosk, "Starta spelet", "Uppdatera") ligger kvar i
respektive stations `deploy/nuc/`. Detta paket rör bara touch.

> Kräver **X11** (Mint standard). Wayland kan inte mappa touch → skärm.

---

## Installera på en ny Mint-maskin

Kopiera hela mappen `mint-touchstation-bas/` till NUC:en (t.ex. `~/`), sedan:

```bash
cd ~/mint-touchstation-bas
bash install-base.sh        # paket + autostart + "Reset touch"-knapp
./find-touch.sh             # skriver ut dina paneler + skärmar
nano touch.env              # klistra in raderna find-touch.sh gav
./reset-touch.sh            # applicera nu (eller dubbelklicka knappen)
```

Logga ut/in en gång — den självläkande mappningen startar då automatiskt.

---

## Filer

| Fil | Roll |
|-----|------|
| `install-base.sh` | Engångsinstallation: paket, autostart, skrivbordsknapp. |
| `find-touch.sh` | Hittar panelernas `ID_PATH` + dina skärmar. Rör inget. |
| `touch.env.example` | Mall. Kopieras till `touch.env` (per maskin, git-ignoreras). |
| `reset-touch.sh` | Mappar om en gång. Mål för "Reset touch"-knappen. |
| `touch-watch.sh` | Självläkande mappning i bakgrunden (autostart). |
| `map-touch.sh` | Själva motorn (delas med stationernas kiosk.sh). |
| `_lib.sh` | Läser `touch.env` → argument till `map-touch.sh`. |

`touch.env` är den **enda** filen du rör per maskin. Den innehåller bara
USB-portar och skärmnamn — inga lösenord/hemligheter.

---

## Per station

- **Minnestest** = en skärm, en panel → en rad i `TOUCH_PAIRS`.
- **Förhandlingen** = två skärmar, två paneler → två rader (vänster + höger).

Samma paket, bara olika antal rader i `touch.env`.

---

## Felsökning

- **`find-touch.sh` hittar ingen panel** → sitter du i X11? Kör
  `echo $XDG_SESSION_TYPE` (ska säga `x11`). Är panelerna inkopplade?
- **Fingret flyttar pekaren på fel skärm** → byt plats på skärmnamnen i
  `touch.env`, kör `./reset-touch.sh` igen.
- **Touch dör efter omstart** → kolla att autostarten finns:
  `ls ~/.config/autostart/xy-touch-watch.desktop`. Logga ut/in.
- **"command not found" när du redigerar touch.env** → osynligt tecken från en
  grafisk texteditor. Använd `nano`, eller kör raden om med vanliga blanksteg.
  (`_lib.sh` städar redan bort de vanligaste, men nano är säkrast.)
