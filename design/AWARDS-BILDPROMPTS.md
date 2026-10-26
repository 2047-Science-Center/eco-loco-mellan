# Maktspelet — Bildprompts för AWARDS (prisutdelningen varje runda)

*Underlag för Josef att generera bilder via ChatGPT + klipp via Runway. **Motivet är LAG-AGNOSTISKT** — en (1) bild per pris som återanvänds oavsett vilket lag som vinner (laget visas av kortets text/färg i UI:t). Inga lag-emblem i bilden (annars hade det krävts ett klipp per lag×pris). Motivet = **Centralmaktens kontrollrum och det man SER PÅ SKÄRMARNA / kartan** — trailerns rum (bild 3), där övervaknings-skärmarna berättar vad priset betyder. Grundat i `spec/engine.js` (`_computeAwards`) + prisordningen i `server/server.js` (🏆 → 🌱 → 💀).*

De tre prisen (per runda, kan vara null om ingen kvalar):
- **🏆 Ledande — "Företagaren"** (`led`): störst **kapitalökning**. Skärmarna visar en ekonomi som skenar.
- **🌱 Eldsjäl** (`eld`): bidrog **mest positivt till öns hälsa**. Skärmarna visar en ö som läker.
- **💀 Sabotör** (`sab`): **skadade ön mest**. Röd-larm: skärmarna visar en ö som bryts ner.

---

## REFERENSBILD — ja, lägg med den
- **Bild 3** (kontrollrummet med de fyra CRT-skärmarna + backlit ö-karta) är **huvudreferensen** — precis det rummet och skärmarna vi vill ha. Lägg med den i ChatGPT; i Runway = input-frame.
- Bild 1 (emblemen) och bild 2 behövs INTE här (emblemen ska inte synas i award-bilden).

## Två register (samma som slut-/trailer-bilderna)
- **Rummet (betong, pulpeter, CRT-höljen, tungsten) → FOTOREAL.**
- **Det som visas PÅ skärmarna och på ö-kartan (grafer, radar, kart-overlay) → stiliserat/low-poly / retro-UI-grafik.**
Håll skärm-texter **oläsliga** (glödande indikatorer, siffer-liknande klotter, inga riktiga ord).

## Bildformat — 16:9 (filmiskt, INTE en tunn banner)
Award-rutan är idag en liten text-ruta utan bild — den byggs om till att visa klippet **stort, nära helskärm** (filmiskt), med pristitel + vinnarlag som overlay. Därför: **generera i 16:9** (t.ex. 1920×1080), samma format som trailer-materialet och kontrollrums-referensen. Komponera med luft runt motivet så en text-overlay (titel nere/uppe) inte skymmer skärm-raden/kartan.

---

## 🏆 LEDANDE — "Företagaren"  → `assets/award/led.png`

Ekonomin skenar. Kall triumf — rikedom, men ingen värme.

**Prompt (EN):**
> Dark, cold, cinematic photoreal render of the Centralmakten control room (brutalist 1960s war-room: concrete, analog consoles, dials, tungsten lamps, exactly like the reference). The focus is the row of retro CRT monitors and the big backlit topographic island map above them, all glowing a triumphant **warm gold**: the screens show climbing bar- and line-graphs, rising production/output readouts, a golden harbour and industry at full tilt, meters pegged at maximum — a booming economy. The island map glows gold with bright pulsing nodes. Warm gold light washes the room, dust in the beams, shallow depth of field, film grain, soft vignette. Retro-UI / low-poly screen graphics, photoreal room. Triumphant but cold — success paid for by the island. 16:9 cinematic frame, screens/map as the focus, room for a text overlay. No legible text, no logos, no UI chrome, no team emblems.

---

## 🌱 ELDSJÄL  → `assets/award/eld.png`

Ön läker. Den enda äkta värmen i det kalla rummet.

**Prompt (EN):**
> Dark, cold, cinematic photoreal render of the Centralmakten control room (brutalist concrete war-room, analog consoles, dials, tungsten lamps, like the reference). The focus is the row of retro CRT monitors and the backlit island map above them, now glowing a soft living **green-gold**: the screens show the island healing — a rising green health gauge, a radar sweep over regrowing forest, a small sprout / clean water / a gentle green dawn on one screen. The island map glows with spreading green life-nodes. A warm green-gold light is the one genuinely hopeful glow in the dim concrete room; tender, quiet. Dust in the beams, shallow depth of field, film grain, soft vignette. Retro-UI / low-poly screen graphics, photoreal room. 16:9 cinematic frame, screens/map as the focus, room for a text overlay. No legible text, no logos, no UI chrome, no team emblems.

---

## 💀 SABOTÖR  → `assets/award/sab.png`

Röd-larm. Ön bryts ner på skärmarna.

**Prompt (EN):**
> Dark, cold, cinematic photoreal render of the Centralmakten control room (brutalist concrete war-room, analog consoles, dials, tungsten lamps, like the reference) under **red alert**: the row of retro CRT monitors and the backlit island map glow a sickly alarm **red**. The screens show the island breaking down — a smoking erupting coastline, black industrial plumes, a plummeting health gauge, flashing red warning readouts, a grey ruined shore. Red warning lamps are lit across the consoles; thin smoke drifts through the room. The island map bleeds red and grey, nodes dying out. Grim, shaming, cold; a faint dying glow. Dust and smoke in the beams, shallow depth of field, film grain, heavy soft vignette. Retro-UI / low-poly screen graphics, photoreal room. 16:9 cinematic frame, screens/map as the focus, room for a text overlay. No legible text, no logos, no UI chrome, no team emblems.

---

## Runway-videoprompts (10 s inzoom→stillbild)

*Award-rutan visas ~10 s. Generera BILDEN först, mata in i Runway Gen-3 som **image-to-video** (bilden = första frame), långsam inzoom mot skärm-raden/kartan som **fryser de sista ~4 s**. Allt subtilt — rummet byter aldrig form, bara skärmarna/ljuset lever lite.*

**Runway-inställningar:** Gen-3 Alpha, **image-to-video**, längd **10 s**, "Motion" lågt (≈ 2–4). Första frame = din award-bild.

**Gemensam negativ/constraint:**
> `no legible text, no logos, no UI chrome, no team emblems, no new objects, no camera shake, keep the room and consoles stable, subtle motion only`

### 🏆 LEDANDE — Runway-motionprompt (EN)
> `Very slow cinematic push-in across the control room toward the glowing CRT monitors and gold island map. The graphs and output readouts tick upward, the gold light slowly brightens, meters creep to maximum, dust drifts through the warm beams, the CRT screens flicker softly. Triumphant but cold. Over the final 4 seconds all motion eases to a near-freeze, settling on a still of the booming screens. Slow, controlled, subtle.`

### 🌱 ELDSJÄL — Runway-motionprompt (EN)
> `Gentle slow push-in toward the CRT monitors and the island map. A green health gauge slowly rises, a soft radar sweep passes over regrowing forest, the green-gold glow gently swells and radiates, faint motes drift through the beams, the screens breathe softly. Hopeful, tender, quiet. Over the final 4 seconds the glow settles into a near-freeze on a calm still of the healing screens. Slow and delicate.`

### 💀 SABOTÖR — Runway-motionprompt (EN)
> `Slow ominous push-in toward the red-lit CRT monitors and bleeding island map. Red warning lamps pulse, a health gauge plummets, smoke curls from the erupting-coast screen, the red glow deepens, thin smoke drifts through the room. Grim, shaming, cold. Over the final 4 seconds everything slows to a near-freeze on a bleak still of the alarm screens. Heavy, slow, menacing.`

---

## Att tänka på
- **En bild per pris räcker** — samma `led.png` / `eld.png` / `sab.png` oavsett vinnarlag. Spara i `assets/award/` (skapa mappen). Laget färgläggs/namnges av kortet i UI:t.
- Håll de tre **tonalt distinkta i samma rum**: Ledande = gyllene högkonjunktur, Eldsjäl = grön läkning, Sabotör = rött larm / nedbrytning.
- Generera 2–3 varianter per pris och välj den som beskärs snyggast till det breda mittbandet.
- Award-korten pekar i dag inte ut någon bildsökväg i koden — när bilderna finns kopplar jag in dem (säg till).
