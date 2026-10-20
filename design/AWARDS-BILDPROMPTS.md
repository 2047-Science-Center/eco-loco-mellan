# Maktspelet — Bildprompts för AWARDS (prisutdelningen varje runda)

*Underlag för Josef att generera bilder via ChatGPT. Grundat i `spec/engine.js` (`_computeAwards` = de tre prisen motorn delar ut), prisordningen i `server/server.js` (🏆 ledande → 🌱 eldsjäl → 💀 sabotör) och husstilen i `design/SLUT-BILDPROMPTS.md`. Skapat 2026-10-16. Committas inte.*

De tre prisen (per runda, kan vara null om ingen kvalar):
- **🏆 Ledande — "Företagaren"** (`led`): laget med störst **kapitalökning** den rundan. Vinnaren på börsen — kortsiktig framgång, ofta smutsig.
- **🌱 Eldsjäl** (`eld`): laget som bidrog **mest positivt till öns hälsa** den rundan. Den som offrade vinst för ön.
- **💀 Sabotör** (`sab`): laget som **skadade ön mest** (mest negativ öhälsa). Boven — den som tjänade på nedsmutsning.

Prisen är **roll-emblem, inte lagfärgade** — samma bild funkar oavsett vilket lag som får priset (laget färgläggs av riggen/skärmen runt bilden).

---

## Gemensam ton & stil (samma värld som slutbilderna — klistra in överst i varje prompt)

> **Stilrad (EN):**
> *"Dark, cold, cinematic low-poly 3D render. Faceted stylized geometry, near-black warm background (#121009), muted desaturated palette of cold slate-blue and grey, a single warm gold accent (#C9A94F) as rim light / glow. Siberian island mood, retro control-panel atmosphere, subtle LED glow, film grain, soft vignette. A faceted ceremonial award EMBLEM / medallion, centered, no team colors. No text, no logos, no UI."*

### Bildformat — matcha prisutdelnings-kortet
Visas som en **bred banner** överst i award-kortet (samma rutformat som slutdels-kortet: ~100 % brett, beskärs till ett brett mittband ≈ 360 px högt, `object-fit: cover`).
→ **Generera i brett liggande ≈ 3:1** (t.ex. 1536×512). Håll motivet **vertikalt centrerat**, inget viktigt högst upp/ner. Emblemet i mitten.

---

## 🏆 LEDANDE — "Företagaren"  → `assets/award/led.png`

Rundans ekonomiska vinnare. Triumf med en kall underton — framgång betald av ön. Inte hjältemodig; mäktig, lite kylig.

**Prompt (EN):**
> `[Stilrad]` A faceted low-poly award medallion for an industrial tycoon, centered and filling a wide banner. The emblem: a stylized gold-rimmed coin/medal embossed with a low-poly silhouette of smoke-stacks and stacked crates/ingots, crowned by a thin laurel. Cold hard gold (#C9A94F) catches a single rim light; the rest sits in near-black slate-blue shadow. A faint cold glow of wealth, but no warmth — triumph at a cost. Faceted stylized geometry, muted desaturated palette, near-black background, subtle LED glow, film grain, soft vignette. Wide 3:1 banner, emblem centered. No text, no team colors, no UI.

---

## 🌱 ELDSJÄL  → `assets/award/eld.png`

Den som gav till ön. Ensam, hoppfull värme i en kall värld. Det enda priset med äkta ljus.

**Prompt (EN):**
> `[Stilrad]` A faceted low-poly award medallion for a quiet hero of the island, centered in a wide banner. The emblem: a stylized gold-rimmed medal embossed with a single low-poly green sprout / small flame of new growth, cupped by two faceted hands. A soft warm gold-green glow radiates from the sprout — the one genuinely warm light in an otherwise cold, near-black frame of slate-blue shadow. Hopeful but lonely. Faceted stylized geometry, muted palette, subtle LED glow, film grain, soft vignette. Wide 3:1 banner, emblem centered. No text, no team colors, no UI.

---

## 💀 SABOTÖR  → `assets/award/sab.png`

Boven. Rök, sprucken mark, släckt ö. En mörk, kall skam-medalj med en sjuklig röd-grå ton.

**Prompt (EN):**
> `[Stilrad]` A faceted low-poly "anti-award" medallion for the island's polluter, centered in a wide banner. The emblem: a tarnished, cracked gold-rimmed medal embossed with a low-poly skull-and-smokestack motif over cracked dead ground, thin faceted smoke curling off it. The gold is dull and corroded; a sickly cold red-grey tint bleeds into the slate-blue shadow; the usual warm glow is almost snuffed out. Ominous, shaming, cold. Faceted stylized geometry, muted desaturated palette, near-black background, faint dying LED glow, film grain, heavy soft vignette. Wide 3:1 banner, emblem centered. No text, no team colors, no UI.

---

## Att tänka på
- Spara som `assets/award/led.png` / `eld.png` / `sab.png` (skapa mappen `assets/award/`). Om spelet ska visa dem måste award-kortet peka ut bildsökvägen — säg till Josef om du vill att koden kopplas in (idag har award-korten ljud men ev. ingen bild).
- Håll de tre **tonalt distinkta men i samma värld**: Ledande = kall guldtriumf, Eldsjäl = ensam varm glöd, Sabotör = korroderad/sjuklig. Då läses de direkt i prisutdelningen.
- Generera gärna 2–3 varianter per pris och välj den som beskärs snyggast till det breda mittbandet.
