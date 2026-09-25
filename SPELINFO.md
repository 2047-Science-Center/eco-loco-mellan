# Eco Loco (Mellan) — komplett spelinformation

*Underlag för att arbeta vidare med spelet i en ny Claude-session (t.ex. en uppdaterad introduktion). Självbärande — allt väsentligt står här. Uppdaterad 2026-09-25.*

## Vad spelet är

Eco Loco är 2047 Science Centers hållbarhetsstation. Detta är **mellanversionen**: en självfaciliterande webbversion på ~15 minuter för besökare och skolgrupper, spelbar på touchskärmar — en spelare/lag per skärm, eller en skärm mot datorstyrda motståndare. Den byggs som ersättare/komplement till den fysiska riggen (4 bänkar med Unreal-spel, displayer, LED och telefonförhandling) och behåller riggens MQTT-koppling så hårdvaran kan återanvändas.

**Målgrupp:** besökare och skolklasser som aldrig sett spelet förut. Låg insättningströskel, minimal text (spelet har historiskt haft "för mycket ord"), stödjande piktogram, all copy på svenska.

## Kärnan

Konflikten mellan **eget vinstintresse** och **tvånget att samarbeta — annars kraschar ön**. Fyra spänningar bär spelet:

1. **Allmänningens dilemma:** smutsiga byggen är billigast och mest lönsamma, men skadar den *delade* ö-mätaren. Vinsten är privat, notan delas av fyra.
2. **Beroendet:** varje lag tjänar bara EN valuta men behöver den andra för att bygga → tvingad byteshandel och förhandlingsmakt.
3. **Politiken:** majoritetsbeslut (3 av 4) kan tvinga, beskatta eller förbjuda — och "grön satsning" har inbyggt friåkarproblem (bara ja-röstare betalar, alla får nyttan).
4. **Slutspänningen:** delad tröskel + rikast-vinner ovanpå. Designmål: den som blir rik på öns bekostnad ska inte kunna vinna ostraffat.

## Regler (motorns skarpa värden)

- **4 lag = 4 öområden.** Områdesfärg = lagfärg. Loggor = fasetterade djurbadges:
  - Åkermark (gul, bison) — producerar **material** 🧱
  - Skog (grön, björn) — producerar **material** 🧱
  - Tundra (orange, varg) — producerar **pengar** 🪙
  - Stad (grå, örn) — producerar **pengar** 🪙
- **8 rundor**, 90 s/runda (timer-ring; tar den slut sker bokslutet automatiskt).
- **Start:** 40 pengar / 30 material per lag. **Öns hälsa:** 0–100, start 50. Röd zon < 30 (katastrofer slår varje runda: alla förlorar 10🪙+10🧱), grön zon > 70.
- **Utfall:** öhälsa ≥ 60 efter runda 8 → rikaste laget (pengar+material) vinner. Under 60 → **alla förlorar**. Når 0 → omedelbar kollaps, alla förlorar.
- **Handen:** alltid exakt 3 val — SMUTSIG / STANDARD / GRÖN (spelets heliga treenighet; namn och bild skiljer per område men begreppen är alltid desamma):

  | Materialsektorn (Åker/Skog) | kostar | ger/runda | öhälsa |
  |---|---|---|---|
  | Smutsig (Industrijordbruk / Sågverk) | 10🪙 | +8🧱 | −4 |
  | Standard (Jordbruk / Skogsbruk) | 15🪙+5🧱 | +6🧱 | −2 |
  | Grön (Ekologiskt jordbruk / Skogsjordbruk) | 25🪙+10🧱 | +5🧱 | +1 |

  | Pengarsektorn (Tundra/Stad) | kostar | ger/runda | öhälsa |
  |---|---|---|---|
  | Smutsig (Oljeplattform / Kolkraftverk) | 8🧱 | +10🪙 | −2 |
  | Standard (Fabrik / Kontor & hotell) | 6🪙+6🧱 | +7🪙 | +1 |
  | Grön (Vindkraft / Solceller) | 10🪙+8🧱 | +6🪙 | +3 |

- **Byteshandel:** fritt mellan lag, valfri kurs. UI:t ramar det som "du ger din valuta, du får den andra". Mot datorlag svarar en enkel accept-logik; mot människor kommer en accept-dialog.
- **Politik:** ett förslag per runda, 3 av 4 JA krävs:
  - 🌱 *Grön satsning* — alla ja-röstare betalar 10🪙 → öhälsa +8.
  - 💸 *Miljöskatt* — värsta boven betalar 15🪙 som delas av de andra.
  - 🚫 *Förbjud smutsig* — nästa runda kan ingen välja smutsigt.
- **Bokslut varje runda (ceremoni i sekvens):** allas byggen avslöjas ett i taget med ljud → inkomster betalas → ö-mätaren slår → ev. katastrof → tre awards som popup (tryck för att fortsätta): 🏆 Årets ledande företag, 🌱 Årets eldsjäl, 💀 Årets sabotör (sociala, ingen mekanisk bonus).
- **Alltid synligt:** 💰 Börsen (rank på förmögenhet, 👑 på ledaren) och 🏭 Klimatregistret (rank på ackumulerad skada, ⚠ på boven) + personlig årsberättelse (dina val, ditt avtryck, ditt kapital).
- **De fem ölägena** (kartan är öhälso-visningen, med overlay + ljudlandskap): superdåligt 0–20 (smog, hosta), dåligt 20–40, neutralt 40–60, bra 60–80 (fågelkvitter), mycket bra 80–100 (feststämning).

## Nuvarande introduktion (det som ska förbättras)

Spelet har idag **ingen riktig tutorial** — bara en startskärm/lobby med tre snabbrutor:

> **🏝 ECO LOCO** — *Bli rikast — utan att sänka ön ni delar.*
> - 🃏 **Bygg** — Välj 1 kort per runda. Smutsigt är billigt — men skadar ön.
> - 🔁 **Byt** — Du tjänar bara en valuta. Den andra får du byta till dig.
> - 🗳 **Rösta** — Ett förslag per runda. 3 av 4 JA krävs.
> 
> Håller ön **över 60** efter 8 rundor vinner det rikaste laget. Faller den under — **förlorar alla.**
> [STARTA SPELET]

I onlineläget är samma ruta även lobby: välj lag → se vilka som gått med → starta (lag utan spelare styrs av datorn). Man kan ansluta mitt i ett parti och ta över ett datorlag.

**Etablerad tutorial-idé (från designarbetet, ej byggd):** en "fäll-reveal"-runda 0 — alla lockas köpa det lönsamma valet, upptäcker att de saknar den andra valutan, och polletten trillar ner: *man måste byta med de andra*. Stödet finns i arkitekturen som `config.mode = 'tutorial' | 'selfplay' | 'gm'` (gm = spelledarläge med extra kontroll). Progressiv exponering är designprincipen: visa bara det som behövs just nu, en handling i taget, igenkänning framför minne.

**Kända introduktionsproblem från originalspelet:** folk förstod inte röstningen; för mycket text överlag; beroendet (att man MÅSTE byta) gick många förbi tills det var för sent.

## UI:t i korthet

Dashboard utan flikar på 16:9 touch: öns hälsa som stor mätare överst (färgzoner, MÅL 60-markering, delta-pil, läges-emoji) · vänster kolumn = ditt lag (logga, LED-resurser, inkomst, sektorruta "Du producerar X — Y måste du byta till dig", BYT-knapp, årsberättelse) · mitten = ön (AI-genererad låg-poly-karta, byggnader droppar på fasta platser, smog/grönska-overlay) · höger = de andra lagen (resurser, 👑/⚠, BYT per lag) + Börsen/Klimatregistret + LÄGG FÖRSLAG · nederst = handen med 3 stora kort (tryck = expandera med detaljer, tryck KÖP = bygg; "har inte råd" visar exakt vad som saknas och pekar mot byteshandeln) + AVSLUTA OMGÅNG med timer-ring. Röstning och byteshandel är fullskärms-modaler. Retro kontrollpanel-estetik (mörk oliv, LED-siffror, guld) från den fysiska riggen.

## Teknik (för sammanhang)

Ren spelmotor (`spec/engine.js`, all balans i config + `spec/assets.json` som läses live) · samma motor kör i webbläsaren (mot datorlag) och server-side i Node (multiplayer: server äger sanningen, klienter är statslösa vyer över WebSocket, återanslutning ger full state-synk) · `spel.html` lokalt, `spel.html?online=1` med lobby · ljud genereras via ElevenLabs SFX från färdiga prompts (tre signatur-byggljud som tonal trappa + fem ambienser) · MQTT-topics behållna för den fysiska riggens displayer/LED.

## Balansläget (viktigt för introduktionens löften)

Simulering (3000 partier/scenario) visar två saker som ska åtgärdas men ännu inte är beslutade:
1. **Pengarsektorn dominerar oavsiktligt** — vinner ~100 % av partierna; deras kort är billigare, snabbare och renare. Testade speglade händer ger 50/50 och behåller beroendet.
2. **Överlevnaden är binär** — bara helt gröna grupper räddar ön (100 %), alla andra misslyckas (0 %). Riktmärke (jfr Fishbanks, Pandemic): naiv grupp ~10–20 %, delvis samordnad ~50–70 %, samordnad ~95 %; krasch får vara normalutfall men räddningen måste vara inom räckhåll.

Introduktionen bör alltså inte lova "rättvist" förrän ombalanseringen är gjord — men kärnbudskapet (*billigt skadar ön; du behöver de andra*) står fast oavsett.

## Öppna frågor som en ny introduktion kan behöva ta ställning till

- Tutorial-runda 0 (fäll-reveal) eller lärande under spelets gång (coach-marks första rundan)?
- Hur mycket ska avslöjas om vinstvillkoret i förväg vs. upptäckas?
- Röstningens pedagogik — den historiskt svåraste mekaniken att förstå.
- Skolgrupp med lärare vs. spontanbesökare — samma intro eller två lägen?
- Introt ska funka både för en ensam spelare (tre datorlag) och fyra bänkar samtidigt.
