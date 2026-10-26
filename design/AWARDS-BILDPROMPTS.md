# Maktspelet — Bildprompts för AWARDS (prisutdelningen varje runda)

*Underlag för Josef att generera bilder via ChatGPT + klipp via Runway. **Emblemen ska nu sitta i SAMMA rum som trailern** — Centralmaktens kontrollrum (mörk betong-/metallvägg, backlit ö-karta, rad av CRT-skärmar, varm tungsten + CRT-sken). Vinnarlagets **djur-emblem** visas upptänt enligt priset. Grundat i `spec/engine.js` (`_computeAwards`) + prisordningen i `server/server.js` (🏆 → 🌱 → 💀).*

De tre prisen (per runda, kan vara null om ingen kvalar):
- **🏆 Ledande — "Företagaren"** (`led`): störst **kapitalökning**. Kortsiktig framgång, ofta smutsig.
- **🌱 Eldsjäl** (`eld`): bidrog **mest positivt till öns hälsa**. Den som offrade vinst för ön.
- **💀 Sabotör** (`sab`): **skadade ön mest** (mest negativ öhälsa). Boven.

**Emblemen = lagens djur** (samma som på trailer-väggen): **Oxen** = bison/oxe (guld) · **Björnen** = björn (grön) · **Räven** = räv/varg (koppar) · **Örnen** = örn (grå/stål). Visa **vinnarlagets** djur-emblem i rummet, upptänt enligt priset. Byt `[DJUR-EMBLEM]` i prompten till rätt lag (generera de du behöver — minst en per lag, eller en per lag×pris om du vill ha allt unikt).

---

## REFERENSBILDER — ja, lägg med dem (det gör störst skillnad)
- **Emblem-stil & djur:** använd **bild 1** (de fyra emblemen på väggen) som stil-/subjekt-referens.
- **Rummet/miljön:** använd **bild 3** (kontrollrummet med CRT-skärmarna + kartan) som miljö-referens — den är mest aktuell, precis som du sa.
- **Bild 2** (tomma kartbordsrummet) behövs inte.
- Med båda referenserna i ChatGPT matchar emblem + rum trailern direkt. I Runway: den genererade stillbilden = input-frame (image-to-video).

---

## Gemensam ton & stil (stilrad — grunden i alla tre; mood läggs på per pris)

> *"Dark, cold, cinematic photoreal render with faceted low-poly sculpture. A single stylized **[DJUR-EMBLEM]** plaque — a hexagonal bronze-and-metal ceremonial relief of the animal's head framed by a laurel wreath, a small star and a fluted-pillar motif, exactly like the emblems on the wall in the reference — mounted on the dark concrete-and-metal wall of the Centralmakten control room. Behind it, softly out of focus: a huge backlit topographic island map and a row of glowing retro CRT monitors, analog dials and tungsten desk lamps, brutalist 1960s war-room. Warm tungsten rim light and a faint coloured CRT glow, golden atmospheric haze, drifting dust motes, muted slate-blue-and-grey palette with a single warm gold accent (#C9A94F). Cinematic shallow depth of field, film grain, soft vignette. No text, no logos, no UI."*

### Bildformat — matcha prisutdelnings-kortet
Visas som en **bred banner** överst i award-kortet. **Generera i brett liggande ≈ 3:1** (t.ex. 1536×512), motivet **vertikalt centrerat**, emblemet i mitten, inget viktigt högst upp/ner.

---

## 🏆 LEDANDE — "Företagaren"  → `assets/award/led.png`

**Prompt (EN):**
> Dark, cold, cinematic photoreal render with faceted low-poly sculpture. A stylized **[DJUR-EMBLEM]** plaque — a hexagonal bronze-and-metal ceremonial relief of the animal's head framed by a laurel wreath, a small star and a fluted-pillar motif (exactly like the emblems in the reference) — mounted on the dark concrete-and-metal wall of the Centralmakten control room; behind it, out of focus, a huge backlit island map and a row of glowing retro CRT monitors, analog dials, tungsten lamps, brutalist war-room. The emblem is picked out by a bright warm **gold spotlight** — its faceted metal gleams proud and dominant, the richest-lit object in the room; triumphant but cold and austere, success paid for by the island; the CRT glow behind is warm gold. Golden haze, dust motes, muted slate-blue palette, warm gold accent (#C9A94F), shallow depth of field, film grain, soft vignette. Wide 3:1 banner, emblem centered. No text, no logos, no UI.

---

## 🌱 ELDSJÄL  → `assets/award/eld.png`

**Prompt (EN):**
> Dark, cold, cinematic photoreal render with faceted low-poly sculpture. A stylized **[DJUR-EMBLEM]** plaque — a hexagonal bronze-and-metal ceremonial relief of the animal's head framed by a laurel wreath, a small star and a fluted-pillar motif (exactly like the emblems in the reference) — mounted on the dark concrete-and-metal wall of the Centralmakten control room; behind it, out of focus, a huge backlit island map and a row of glowing retro CRT monitors, analog dials, tungsten lamps, brutalist war-room. The emblem glows with a soft **warm gold-green light from within** — a small living sprout / green flame set at its heart, the one genuinely warm and hopeful light in the cold dim room; tender, quiet, a little lonely; the CRT monitors behind dim to a soft green. Golden-green haze, faint drifting pollen motes, muted slate-blue palette, warm accents, shallow depth of field, film grain, soft vignette. Wide 3:1 banner, emblem centered. No text, no logos, no UI.

---

## 💀 SABOTÖR  → `assets/award/sab.png`

**Prompt (EN):**
> Dark, cold, cinematic photoreal render with faceted low-poly sculpture. A stylized **[DJUR-EMBLEM]** plaque — a hexagonal bronze-and-metal ceremonial relief of the animal's head framed by a laurel wreath and a fluted-pillar motif (exactly like the emblems in the reference) — mounted on the dark concrete-and-metal wall of the Centralmakten control room; behind it, out of focus, a huge backlit island map and a row of glowing retro CRT monitors, analog dials, brutalist war-room. The emblem is **tarnished, corroded and cracked**, drained of gold; a sickly cold **red light** and thin drifting smoke/ash bleed across it, the metal dull and dead, sunk in cold shadow — grim and shaming; the CRT monitors behind flicker a sickly red. Cold red-grey haze, falling ash, muted desaturated slate-blue palette, a faint dying glow, shallow depth of field, film grain, heavy soft vignette. Wide 3:1 banner, emblem centered. No text, no logos, no UI.

---

## Runway-videoprompts (10 s inzoom→stillbild)

*Award-rutan visas ~10 s. Generera BILDEN (prompterna ovan) först, mata in i Runway Gen-3 som **image-to-video** (bilden = första frame), långsam inzoom i rummet som **fryser de sista ~4 s**. Allt subtilt — emblemet/rummet byter aldrig form, inga nya objekt, ingen text.*

**Runway-inställningar:** Gen-3 Alpha, **image-to-video**, längd **10 s**, "Motion" lågt (≈ 2–4). Första frame = din award-bild.

**Gemensam negativ/constraint:**
> `no text, no logos, no UI, no new objects, no camera shake, do not morph or distort the emblem or the room, keep faceted low-poly geometry stable, subtle motion only`

### 🏆 LEDANDE — Runway-motionprompt (EN)
> `Very slow cinematic push-in across the control room toward the [DJUR-EMBLEM] plaque on the wall. The warm gold spotlight slowly brightens and glints across the faceted metal; dust motes drift through the golden haze; the CRT monitors behind flicker softly, out of focus; a low glow pulses once, slowly. Triumphant but cold. Over the final 4 seconds all motion eases to a near-freeze, settling on a still hero shot of the emblem. Slow, controlled, subtle.`

### 🌱 ELDSJÄL — Runway-motionprompt (EN)
> `Gentle slow push-in toward the [DJUR-EMBLEM] plaque. The small green sprout / flame at its heart softly breathes — its warm gold-green glow swells and gently radiates; a few faint embers or pollen motes drift up through the haze; the CRT monitors behind glow soft green, out of focus; the plaque holds still. Hopeful, tender, quiet. Over the final 4 seconds the glow settles into a near-freeze on a calm still. Slow and delicate.`

### 💀 SABOTÖR — Runway-motionprompt (EN)
> `Slow ominous push-in toward the tarnished [DJUR-EMBLEM] plaque. Thin smoke curls off the corroded metal; a sickly red tint slowly bleeds deeper into the shadow; a weak light flickers and almost gutters out; the CRT monitors behind flicker red; ash drifts down through the haze. Grim, shaming, cold. Over the final 4 seconds everything slows to a near-freeze on a bleak still of the dead emblem. Heavy, slow, menacing.`

---

## Att tänka på
- Spara som `assets/award/led.png` / `eld.png` / `sab.png` (skapa mappen `assets/award/`). Vill du ha det **lag-specifikt** (vinnarlagets djur varje gång): spara t.ex. `assets/award/led_oxen.png`, `led_bjornen.png` … så kopplar jag koden att välja efter vinnarlag.
- Håll de tre **tonalt distinkta men i samma rum**: Ledande = kall guldtriumf (spotlight), Eldsjäl = ensam varm grön glöd, Sabotör = korroderad/röd/rök.
- Generera 2–3 varianter per pris och välj den som beskärs snyggast till det breda mittbandet.
- Award-korten pekar i dag inte ut någon bildsökväg i koden — när bilderna finns kopplar jag in dem (säg till).
