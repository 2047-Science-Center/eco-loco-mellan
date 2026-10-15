# Skärm-mirroring — spegla lagens 4 skärmar till spelledaren

> Status: **förslag, ej byggt.** Verifierat mot koden 2026-10-15
> (`server/server.js`, `src/net.js`, `src/ui.js`, `drift/mint/installera-mint.sh`,
> `tools/hjarna-stubb.py`, `ARCHITECTURE.md`). Grundat i stationsbygge-skillens
> NUC-/kioskprofil (forhandlingens `deploy/nuc`-mönster).

---

## 1. Mål

Spelledaren har bredvid sin touch-panel **fyra skärmar** som i realtid speglar lagens
vyer (`aker` / `skog` / `tundra` / `stad`) — *samma* fönster som sitter uppe vid respektive
bänk. Panelen ska kunna **öppna / stänga / ladda om / väcka** de fyra spegel-fönstren.

Två problem att lösa:
1. **Ren spegel** — spegeln får inte bli "en till spelare" som stör laget.
2. **Väck/toggla från panelen** — en webbsida kan inte öppna/stänga andra lokala fönster.

---

## 2. Hur spelet serveras & ansluter idag (nuläge, FINNS)

- `server/server.js` (port 8765) serverar alla statiska filer **och** äger motorn; klienter
  är statslösa vyer. URL per bänk: `http://<server-ip>:8765/spel.html?online=1&lag=<lag>`.
- Varje server-meddelande bär **hela `state`** (`send()` i server.js rad 94), och
  `broadcast()` (rad 95) går till **alla** anslutna WS-klienter — även en klient utan lag.
- Kiosk: `drift/mint/installera-mint.sh kiosk <url> <lag>` skriver `~/.local/bin/eco-loco-kiosk.sh`
  som startar **ett** Chromium `--app=<SPEL_URL>` i helskärm. En skärm = ett lag = ett fönster.

### Vad händer om man öppnar samma lag-URL två gånger? (dubbel-anslutning)

Villkoret i `hello` (server.js rad 288) claimar `m.lag` bara om platsen är `null`, `bot`
eller en **död** anslutning (`readyState !== 1`). Så länge bänkens riktiga spelare är uppe:

- **Andra fönstret med `?lag=aker` claimar INTE** → får `hello-ack` med `lag: null`, men
  tar ändå emot alla broadcasts (= hela state). Det blir alltså redan en halv åskådare.
- **MEN:** om bänkens anslutning blinkar till (nätglapp, `readyState` ≠ 1 en sekund) och
  spegeln just då (åter)ansluter med `?lag=aker` → **spegeln kan rycka åt sig laget**.
  `?lag=`-vägen är alltså inte en säker läsvy.

Dessutom renderar en lag-lös klient idag bara den **delade** brädan (karta/konton/register),
**inte** lagets sektor (hand/kort/me-panel) — se `rebuildFromState` rad 914: `if (!game.me) return`.
Det är inte "samma fönster som laget ser".

**Slutsats:** en ren, full spegel kräver en liten kod-ändring (nästa avsnitt).

---

## 3. Ren spegel-vy — rekommendation + kod-ändring

**Rekommendation: FULL lagvy, men READ-ONLY.** Spegeln ska visa exakt vad laget ser
(hand, valt kort, byten, röstning, prisutdelning), inte bara brädan — men aldrig skicka
någon action och aldrig claima laget. Ren läsvy = **ingen input, ingen extra WS-spelare**.

### Ny flagga `?mirror=<lag>` (liten ändring, ~15–25 rader)

I `src/ui.js → makeOnline()` (rad 113) finns redan allt råmaterial:

1. **Anslut utan att claima.** Läs `const MIRROR = params.get('mirror')`. Om satt:
   anropa `net.connect(null)` (wish = `null`) i stället för `net.connect(params.get('lag'))`.
   → servern tilldelar aldrig ett lag, bänkens spelare rörs inte.
2. **Rendera som laget.** Låt fasadens `me`-getter returnera `MIRROR` i stället för `net.me`
   (som är `null`). Hela vyn är redan en ren funktion av `me` + `state`
   (`renderMe`/`renderHand`/`handFor(game.me)`/`initSector` rad 495–672) → den ritar
   lagets fulla skärm från serverns broadcasts utan annan ändring.
3. **Gör alla actions till no-ops.** `selectCard`/`trade`/`vote`/`klar`/`openProposal`/
   `claim`/`awardsKlara`/`podiumAnswer` → `return`/ignorera. Inget skickas = ingen störning.
4. **Dölj lobby/start och lås input.** Hoppa över lobby + attract för mirror-klienten;
   lägg `body.mirror { }` och göm/avaktivera knapparna (kort, AVSLUTA, rösta, byt) — enklast
   `document.body.classList.add('mirror')` + CSS `body.mirror .card, body.mirror #vote-btns,
   … { pointer-events: none; opacity: … }`.

### Valfri server-härdning (1 rad, rekommenderas)

Skicka `{type:'hello', lag:null, mirror:true}` och lägg i `hello`-case ett tidigt
`if (m.mirror) { send(ws,{type:'hello-ack', lag:null, …}); broadcast(lobbyMsg()); break; }`
så servern **aldrig** kan råka claima en spegel ens i en kapplöpning. Garanterar punkt 1.

> Allt annat (full state i varje broadcast, reconnect som synkar hela state) finns redan.
> Spegeln är självläkande på samma sätt som bänkarna: tappar den kontakt → `net.js`
> återansluter (rad 45–49) med `this.me = null` → förblir spegel.

---

## 4. Väck/toggla fönster från panelen — kontroll-mekanismen

En webbsida kan inte starta/stänga lokala OS-fönster. Det behövs en **liten lokal agent på
spelledar-NUC:en** (den som äger de fyra spegel-skärmarna) som tar emot kommandon och kör
Chromium-fönster per skärm. Detta speglar exakt två saker som redan finns i repot:

- `server.js → attachGmChannel()` (rad 506): spawnar `mosquitto_sub` och agerar på kommandon.
- `tools/hjarna-stubb.py`: en `mosquitto_sub`-driven lokal agent som översätter meddelanden
  till fysiska effekter. **Samma mönster** — bara att "effekten" här är kioskfönster.
- Fönsterstarten speglar `eco-loco-kiosk.sh` + stationsbygge-skillens kioskprofil.

### Agentens jobb (ny kod — `drift/mint/mirror-agent.sh` el. `.py` + systemd --user-tjänst)

Håller en tabell `lag → {skärm-geometri, user-data-dir, pid}` och kör:

| Kommando | Vad agenten gör (X11/XWayland) |
|---|---|
| `open`   | Starta Chromium om inte redan uppe: `--app=http://<server>:8765/spel.html?online=1&mirror=<lag>` `--ozone-platform=x11 --window-position=<X>,0 --window-size=<W>,<H> --start-fullscreen --user-data-dir=~/.mirror-<lag> --autoplay-policy=no-user-gesture-required --no-first-run` |
| `close`  | `pkill -f "user-data-dir=.../.mirror-<lag>"` |
| `reload` | enklast: `close` + `open`. Renare: starta med `--remote-debugging-port=922X` och anropa DevTools `Page.reload`, eller `xdotool key --window <id> F5` |
| `wake`   | `xset s reset; xset dpms force on` + `wmctrl -a <titel>` / `xdotool windowactivate` (lyft fram) |
| `toggle` | pid i tabellen? → `close`, annars `open` |

Profildetaljer från stationsbygge-skillen (dyrköpt, återanvänd): **separat `--user-data-dir`
per lag** (annars kan inte fyra oberoende instanser köras), **inte hård `--kiosk`** utan
`--app --start-fullscreen` (går att styra/stänga), `--ozone-platform=x11` så `--window-position`
funkar även på Wayland. Skärmarnas X/W fås med `xrandr` (en rad per HDMI-utgång).

### Två transport-vägar panel → agent

**A. Via MQTT-sömmen (REKOMMENDERAS — matchar stacken).**
Panelen talar redan WS med `server.js` (se `design/SPELLEDARAPP-FORSLAG.md`). Lägg ett
nytt WS-case i `server.js` (~4 rader, återanvänder befintliga `riggSend`):
`case 'mirrorcmd': riggSend('ecoloco/panel/mirror', JSON.stringify({lag:m.lag, action:m.action})); break;`
Agenten prenumererar `ecoloco/panel/mirror` via `mosquitto_sub` (= hjarna-stubb-mönstret).

- **För:** återanvänder exakt den beprövade sömmen (WS→server→MQTT→lokal agent), panelen
  behöver inte veta var spegel-skärmarna bor, brokern finns redan i final-riggen.
- **Mot:** beroende av broker; kräver nytt topic + 4 rader i server.js + ny agent.

**B. Direkt lokal HTTP (enklast om panel + speglar sitter på SAMMA NUC).**
Agenten är en pytteliten HTTP-server på spelledar-NUC:en; panelen gör
`fetch('http://<leder-nuc>:PORT/mirror/<lag>/<action>')`. Sätt `Access-Control-Allow-Origin: *`
(endast NUC-nät) om panelen serveras från en annan host.

- **För:** inga nya server.js-rader, ingen broker. Få rörliga delar.
- **Mot:** panelen måste känna spelledar-NUC:ens IP; CORS om korsad origin.

---

## 5. Rekommenderad väg + flöde

**Rekommendation:** `?mirror=<lag>`-flaggan (avsnitt 3) + **MQTT-agent (väg A)** (avsnitt 4),
för att den återanvänder den redan byggda sömmen (`attachGmChannel` + `hjarna-stubb`-mönstret)
och håller panelen platsoberoende. Väg B som fallback om spelledar-NUC:en saknar broker.

Ny roll i `installera-mint.sh`: `mirror <server-url>` → installerar Chromium + agenten som
`--user`-tjänst (samma systemd-mönster som `eco-loco-server`/`eco-loco-hjarna`), klar att boota.

Panelen (ingår i den ännu obyggda `spelledare.html`): en rad med 4 spegel-brickor +
"Väck alla / Släck alla". Varje bricka: öppna · ladda om · stäng (eller en toggle + väck-knapp).

### Flöde (väg A)

```
[Panel] tryck "Väck Åker-spegel"
   │  WS  {type:'mirrorcmd', lag:'aker', action:'open'}
   ▼
[server.js]  riggSend('ecoloco/panel/mirror', '{"lag":"aker","action":"open"}')
   │  MQTT
   ▼
[mirror-agent  (mosquitto_sub på spelledar-NUC)]
   │  startar Chromium på skärm 1:
   │  --app=http://<server>:8765/spel.html?online=1&mirror=aker --window-position=0,0 …
   ▼
[Spegelskärm 1]  visar ÅKERs fulla vy — READ-ONLY, claimar inte laget
                 (bänkens Åker-spelare opåverkad; båda ritar från samma state)
```

`close` → `pkill` instansen · `reload` → close+open (el. DevTools-reload) · `wake` →
`xset dpms force on` + lyft fönstret · `toggle` → öppna/stäng beroende på pid.

---

## 6. Vad finns vs vad är ny kod

**Finns (återanvänds):**
- Full `state` i varje broadcast → en lag-lös klient tar redan emot allt (`send`/`broadcast`).
- `?online=1&lag=` + kiosk-start (`eco-loco-kiosk.sh`), reconnect som synkar hela state (`net.js`).
- MQTT-sömmen: `riggSend` (`mosquitto_pub`) + `attachGmChannel` (`mosquitto_sub`) + hjarna-stubb-agent.
- systemd `--user`-tjänst-mönster och Chromium-kioskprofil (stationsbygge / forhandlingen `deploy/nuc`).

**Ny kod (liten, väl avgränsad):**
1. `src/ui.js`: `?mirror=<lag>` i `makeOnline` — anslut utan claim, `me`→mirror-lag, actions=no-op,
   dölj lobby + lås input (~15–25 rader) + liten CSS i `spel.html`.
2. *(valfritt, rekommenderat)* `server.js` `hello`: `mirror`-flagga som garanterar att spegeln
   aldrig claimar (~1 rad).
3. `server.js`: WS-case `mirrorcmd` → `riggSend('ecoloco/panel/mirror', …)` (~4 rader; väg A).
4. `drift/mint/mirror-agent.*` + ny roll `mirror` i `installera-mint.sh` + systemd `--user`-tjänst
   (launchar/stänger/reloadar/väcker 4 Chromium per skärm).
5. Panel-UI: 4 spegel-brickor + väck/släck-alla (läggs i `spelledare.html` / SPELLEDARAPP-FORSLAG).
