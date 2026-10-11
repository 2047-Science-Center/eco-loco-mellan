# Rigg-drift på huvud-NUC:en

Mål: slå på NUC:en → allt startar själv. Du öppnar bara spelet i webbläsaren.

## Vad som körs var

| Del | Hur | Startar |
|-----|-----|---------|
| Broker (mosquitto, LAN) | systemd-tjänst `mosquitto` + `conf.d/rigg.conf` | vid boot |
| Spelserver (`node server/server.js`) | systemd-tjänst `eco-loco-server` | vid boot |
| Hjärnan (ljud → Anker) | autostart i sessionen (`start-rigg.sh`) | vid inloggning |
| Standard-ljud = HDMI (spelets klick) | `pactl set-default-sink` i `start-rigg.sh` | vid inloggning |

Broker + server behöver varken ljud eller skärm → systemd. Hjärnan spelar ljud → måste ligga i den grafiska sessionen (annars når den inte Anker). Därför den uppdelningen.

## Installera (en gång, på NUC:en)

```bash
cd ~/eco-loco-mellan && git pull
bash deploy/nuc/installera.sh
```
Verifiera sedan att sink-namnen i `deploy/nuc/rigg.env` stämmer:
```bash
pactl list short sinks
```
Starta om NUC:en. Klart — allt går igång automatiskt.

## Kolla / felsöka

```bash
systemctl status eco-loco-server        # spelservern
journalctl -u eco-loco-server -f        # serverns logg (ser [rigg→]-rader)
systemctl status mosquitto              # brokern
```
Hjärnan loggar till `~/.eco-loco-rigg.log`:
```bash
tail -f ~/.eco-loco-rigg.log            # award/soundscape/GM-rader + ev. "ljud saknas"
```
För en ren live-körning (felsökning): `AUDIO_SINK=... python3 tools/hjarna-stubb.py` direkt.

Ljudet hamnar fel? Kontrollera att `AUDIO_SINK` (Anker) och `SCREEN_SINK` (HDMI) i `rigg.env` matchar `pactl list short sinks`.

## Autostarta även spelet i kiosk (valfritt, nästa steg)

För att webbläsaren med spelet ska öppnas automatiskt (och sen de fyra spelledar-skärmarna i `?watch=`-läge) återanvänds `forhandlingen/deploy/nuc`-kioskmönstret: ett chromium-`--app`-fönster per skärm. Läggs till som en extra autostart. Tas när watch-läget är byggt.

## Uppdatera i drift

```bash
cd ~/eco-loco-mellan && git pull
sudo systemctl restart eco-loco-server
# hjärnan: logga ut/in, eller döda och låt keep-alive starta om den
```
