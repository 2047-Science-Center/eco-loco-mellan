# Arkitektur — från mock till skarp drift

## Princip
`engine.js` är en **ren, deterministisk motor utan DOM och utan nätverk**. Samma fil kör i webbläsaren (fas 3) och server-side i Node (fas 4). Allt runt om — vy, mock-motståndare, nätverk, MQTT — kopplas via motorns *actions* (in) och *events* (ut). Byt lager utan att röra reglerna.

```
   Spelarens handlingar  ──►  ENGINE (källa till sanning)  ──►  events  ──►  VY (rita/ljud)
   selectCard/transfer/vote/endRound                                         MQTT (displayer/LED)
```

## Nu (Fas 3) — en skärm, mockade motståndare
- Allt i webbläsaren. Du styr ett lag; `mock-opponents.js` väljer kort/byten/röster för de andra tre.
- Motorns events driver vyn (bygg på karta, kontoanimation, öhälsa-overlay, soundscape, awards, register).
- `assets.json` + config läses live.

## Sen (Fas 4) — multiplayer mellan NUCar
Skarp rigg: 4 bänkar (en per område), var sin NUC i kioskläge, plus en central låda (router). Kabel-LAN, statiska IP `172.20.1.x` finns redan.

- **Server-auktoritativt:** en process (på central-lådan eller en NUC) håller `engine.js` = sanningen. Klienterna skickar *actions* och renderar *events* över **WebSocket**. Samma mönster som `identificationSystem` (Laravel Reverb) / `body-game-websocket-server`. Detta speglar originalets UE-server-auktoritativa modell.
- **Bytet är litet:** ersätt `mock-opponents.js` med en nätverkskälla för de andra lagens actions. Motorn är redan skriven för det (actions kommer utifrån, inte från AI).
- **MQTT-sömmen — oförändrad:** servern publicerar per bänk så den fysiska riggen fungerar som förr. Behåll topic-namnen:
  - `ecoloco/<bänk>/money`, `ecoloco/<bänk>/resources`, `ecoloco/<bänk>/winner`, `ecoloco/<bänk>/looser`, `ecoloco/<bänk>/displaymoney`, `ecoloco/<bänk>/displayresources`.
  - Mappa område→bänk (t.ex. aker=eco1, skog=eco2, tundra=eco3, stad=eco4 — bekräfta med Josef/firmware).
  - Grön LED = ekonomisk ledare; varnings-LED = värsta boven (Klimatregistret). Humör-färg från öhälso-läget.
  - Lokal **mosquitto**-broker finns; för webbklient → MQTT-över-WebSocket-brygga (repo `mqtt-websocket-broker` finns).

## Driftskrav (bygg in stöd, aktivera i fas 4)
- **Offline/LAN-först:** inget internetberoende. Fonter/bibliotek/assets paketeras lokalt.
- **Kiosk + autostart:** helskärm, dölj muspekare, autostart vid boot, watchdog som startar om vid krasch.
- **Robust omstart/återanslutning:** en klient som tappar kontakt ska kunna återansluta och **synka hela tillståndet från servern** (originalet hade en bugg där omstart mellan omgångar inte nollställdes — undvik det: servern är sanningen, klienten är statslös vy).
- **Ren ny omgång:** ett enda "nollställ"-kommando (server) startar rent — inga kvarhängande lås/val.
- **Spelledarläge (Blocks-lager):** `config.mode='gm'` exponerar extra kontroll (kasta in event, styra tempo, egna förslag) ovanpå self-play. Kan drivas via Blocks Web-spot + MQTT/HTTP mot servern.
- **Config live:** balans + assets i `assets.json`/config läses utan omkompilering (redigerbart i Claude/Fable). William Bergmans parametriska balansmodell (Matlab/Excel, aug-25) är källa för siffrorna.
- **Loggning:** enkel server-logg per session (val, byten, röster, utfall) för speltest och drift.

## Stubbar att lägga in redan nu (fas 4-förberedelse, inte färdigbygge)
- `server/` med en tunn WebSocket-server som instansierar `engine.js`, tar emot actions och sänder events (kan lämnas ofärdig men strukturerad).
- Ett `net/`-lager i klienten med två utbytbara implementationer: `local` (mock, fas 3) och `ws` (nätverk, fas 4) bakom samma gränssnitt.
- En `mqtt.js`-adapter som lyssnar på motorns events och publicerar topic-namnen ovan (kan köra mot mock-broker / `mosquitto_pub` under test).
