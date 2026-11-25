# Maktspelet (Eco Loco) — komplett spelinformation

*Underlag för att arbeta vidare med spelet i en ny Claude-session. Självbärande — allt väsentligt står här. Uppdaterad 2026-11-25 (flerversion + aktuell struktur).*

## Vad spelet är

Maktspelet (fd Eco Loco) är 2047 Science Centers hållbarhetsstation: en självfaciliterande webbversion
för besökare och skolgrupper, spelbar på touchskärmar — en spelare/lag per skärm, eller en skärm mot
datorstyrda motståndare. Den byggs som ersättare/komplement till den fysiska riggen (4 bänkar med
Unreal-spel, displayer, LED och telefonförhandling) och behåller riggens MQTT-koppling så hårdvaran
kan återanvändas. Utåt heter spelet **Maktspelet**; internt (klass, MQTT-topics, filnamn) **EcoLoco**.

**Flerversion (beslut 2026-11-11): EN motor, tre jämbördiga varianter** — de delar regler/motor och
skiljer sig genom config + taggat innehåll (`spec/config/variants/*`), inte separata spel:

| Variant | Längd | Rundor | Beslutssystem | Särdrag |
|---|---|---|---|---|
| **Flash** | ~8 min | 4 | Ö-rådet kör DILEMMAN (A/B) | max ett bygge/lag/år; kort byggfas |
| **Mellan** | ~25 min | 8 | Ö-råds-POLITIK (förslag + ja/nej) | obegränsat byggande; tutorial |
| **Skola** | ~45 min | ~10 | som Mellan + adderad slutdel/analys | stackade/beroende byggnader (framåt) |

Resten av detta dokument beskriver **Mellan** som referens; Flash/Skola avviker via sina variant-configar.
Balansvärdena nedan är **aktuella men preliminära** (balanseringen är medvetet ogjord, se sist).

**Målgrupp:** besökare och skolklasser som aldrig sett spelet förut. Låg insättningströskel, minimal text (spelet har historiskt haft "för mycket ord"), stödjande piktogram, all copy på svenska.

## Kärnan

Konflikten mellan **eget vinstintresse** och **tvånget att samarbeta — annars kraschar ön**. Fyra spänningar bär spelet:

1. **Allmänningens dilemma:** smutsiga byggen är billigast och mest lönsamma, men skadar den *delade* ö-mätaren. Vinsten är privat, notan delas av fyra.
2. **Beroendet:** varje lag tjänar bara EN valuta men behöver den andra för att bygga → tvingad byteshandel och förhandlingsmakt.
3. **Politiken:** majoritetsbeslut (3 av 4) kan tvinga, beskatta eller förbjuda — och "grön satsning" har inbyggt friåkarproblem (bara ja-röstare betalar, alla får nyttan).
4. **Slutspänningen:** delad tröskel + rikast-vinner ovanpå. Designmål: den som blir rik på öns bekostnad ska inte kunna vinna ostraffat.

## Regler (motorns skarpa värden)

- **4 lag = 4 öområden.** Områdesfärg = lagfärg. Loggor = fasetterade djurbadges (`spec/content/teams.js`):
  - Åkermark (gul) — **Oxen** — producerar **material** 🧱
  - Skog (grön) — **Björnen** — producerar **material** 🧱
  - Tundra (orange) — **Räven** — producerar **pengar** 🪙
  - Stad (grå) — **Örnen** — producerar **pengar** 🪙
- **Rundor:** Mellan 8 (Flash 4, Skola ~10), timer-ring per bygg-runda; tar den slut sker bokslutet automatiskt.
- **Start:** 35 pengar / 35 material per lag. **Öns hälsa:** 0–100, start 50, MÅL 60. Röda zonen är en
  VISUELL/bot-tröskel — den ger INGEN automatisk årlig förlust längre (den gamla "katastrof varje runda"
  + årlig −3 är borttagna 2026-11-18/19). Låg öhälsa hanteras av öhälsohändelser + KRIS (se nedan).
- **Utfall:** öhälsa ≥ 60 på sista rundan → rikaste laget (pengar+material) vinner. Under 60 → **alla
  förlorar**. **KRIS** deklareras när öhälsan är mycket låg (≤20) — tydlig röd look + siren; en olöst
  kris vid deadline spelar om rundan (konfigurerbart). 0-golvet är backstop.
- **Handen:** alltid exakt 3 val — SMUTSIG / STANDARD / GRÖN (spelets heliga treenighet; namn och bild
  skiljer per område men begreppen är alltid desamma). **De 12 byggnadernas aktuella namn, kostnader,
  inkomst och öhälso-effekt bor i `spec/content/buildings.js`** (källan till sanning — värdena är
  preliminära och underhålls inte i detta dokument). Varje byggnad anger själv i vilka varianter den finns.
- **Byteshandel:** fritt mellan lag, valfri kurs. UI:t ramar det som "du ger din valuta, du får den andra". Mot datorlag svarar en enkel accept-logik; mot människor kommer en accept-dialog.
- **Ö-rådet (efter prisutdelningen varje år):** Mellan kör **politik** — årets ordförande (roterar) väljer
  ett av flera förslag (eller inget), alla röstar ja/nej, konsekvensen slår direkt på öhälsan. Flash kör
  i stället **dilemman** (A/B-beslut). Förslags-/dilemmabanken: `spec/content/{proposals,dilemmas}.js`.
- **Händelser under byggfasen (inte vid bokslut):** tre kategorier ur motorn — företagskriser
  (`company-crises.js`), företagsprestationer (`company-events.js`, t.ex. GRÖN OMSTÄLLNING) och
  öhälsohändelser (`ohalsa-events.js`, visas fördröjt en bit in i året). Spelledaren kan dessutom kasta in
  direkta GM-händelser (`gm-events.js`). Varje händelse är en popup som kort fryser byggtimern.
- **Bokslut varje runda (ceremoni i sekvens):** allas byggen avslöjas ett i taget med ljud → inkomster
  betalas → ö-mätaren slår → tre awards som popup (tryck för att fortsätta): 🏆 Årets ledande företag,
  🌱 Årets eldsjäl, 💀 Årets sabotör (sociala, ingen mekanisk bonus). Sedan Ö-rådet (politik/dilemma).
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

**Intro-trailer (v2, 2026-11-25):** när STARTA trycks spelas en trailer på 69 s på alla skärmar innan tutorialen.
- Ön, de fyra företagen Oxen, Björnen, Räven och Örnen, och målet att bli öns rikaste företag och ta makten som borgmästare.
- Öns gränser, och slutet med MAKTSPELET – THE EXPERIENCE.
- Josefs egen inläsning, i centralhögtalaren.
- Riggens ljus följer filmen: varje lag lyser i sin ruta, guld vid borgmästaren, rött och blandaren på "faller allt".
- Se `RIGG-KONTRAKT.md`, avsnittet om intro-trailern.

## UI:t i korthet

Dashboard utan flikar på 16:9 touch: öns hälsa som stor mätare överst (färgzoner, MÅL 60-markering, delta-pil, läges-emoji) · vänster kolumn = ditt lag (logga, LED-resurser, inkomst, sektorruta "Du producerar X — Y måste du byta till dig", BYT-knapp, årsberättelse) · mitten = ön (AI-genererad låg-poly-karta, byggnader droppar på fasta platser, smog/grönska-overlay) · höger = de andra lagen (resurser, 👑/⚠, BYT per lag) + Börsen/Klimatregistret + LÄGG FÖRSLAG · nederst = handen med 3 stora kort (tryck = expandera med detaljer, tryck KÖP = bygg; "har inte råd" visar exakt vad som saknas och pekar mot byteshandeln) + AVSLUTA OMGÅNG med timer-ring. Röstning och byteshandel är fullskärms-modaler. Retro kontrollpanel-estetik (mörk oliv, LED-siffror, guld) från den fysiska riggen.

## Teknik (för sammanhang)

**EN innehållstom spelmotor** (`spec/engine.js` + `effects.js` + `systems/`): regler + `DEFAULT_CONFIG`
(versionsneutral baslinje). **Allt innehåll som data** i `spec/content/*` (byggnader, lag, förslag,
dilemman, händelsebanker) + `spec/slutdel.js`; manifest/slots/ljud i `spec/assets.json` (läses live).
**Varianterna** (Flash/Mellan/Skola) ligger i `spec/config/variants/*` och overridar `DEFAULT_CONFIG`;
`server/variant-config.js` bygger motor-config för vald variant. Samma motor kör i webbläsaren (mot
datorlag) och server-side i Node (multiplayer: server äger sanningen, klienter är statslösa vyer över
WebSocket, återanslutning ger full state-synk). Lägesväxel `config.mode = tutorial | selfplay | gm`
(gm = spelledarpanel på iPad). `spel.html` lokalt, `spel.html?online=1` med lobby; `spelledare.html` =
spelledarpult. Ljud via ElevenLabs SFX (tonal trappa + ambienser). MQTT-topics behållna för riggen.
Fullständig arkitektur-/filträdskarta: `RAMVERK.md §1` + `ARCHITECTURE.md`.

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
