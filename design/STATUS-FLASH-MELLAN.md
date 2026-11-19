# Status: Flash + Mellan — vad som är klart och vad som är kvar

*Uppdaterad 2026-11-19. Översikt över var Flash- och Mellan-versionerna står på den gemensamma,
innehållstomma spelmotorn, och vad som återstår för kompletta implementeringar + en ren motor.
Skriven som planeringsunderlag — läs ihop med `att-gora.md` (Kontext) och `FLERVERSION-ARKITEKTUR.md`.*

---

## 1. Läget i korthet

Arkitekturen (en motor + innehållsbanker + variant-config) är på plats och grundimplementeringarna
för både Flash och Mellan fungerar. Testsviten (20 filer, `tools/*test*.js`) är grön.

- **Motor:** `spec/engine.js` — innehållstom, actions in / events ut. Innehåll i `spec/content/*`,
  variant-config i `spec/config/variants/*`, deklarativa effekter i `spec/effects.js`, urval i
  `spec/systems/proposal-selector.js`.
- **Händelser:** tre kategorier — foretag (`company-crises.js`/`company-events.js`), ohalsa
  (`ohalsa-events.js`), gm (`gm-events.js`). Det gamla fullt slumpade systemet är **borttaget**
  (2026-11-19). `sponsrat` (rost) kvar i `events.js`, dras in i Ö-rådets beslutspool.

---

## 2. Beslutade designval (ej längre öppna frågor)

Dessa är **beslutade** — ska inte omprövas som "öppet" i schemat:

- **Flash har exakt 8 beslut:** `algblomning`, `oljefynd`, `urskog`, `markkonflikt`, `sponsrat`,
  `naturreservat_flash`, `leveransstopp_flash`, `bra_skord_flash`.
- **Koncernerbjudande är ersatt av Urskogen** i Flash (överlappade `sponsrat`). `koncernerbjudande`
  finns kvar som GM-aktiverbart i Mellan/Skola.
- **Sponsrat behålls.**
- **Fyra olika beslut per parti** i Flash — urvalshistorik (`S.usedDecisions`, nollas per parti)
  ser till att fyra skilda beslut dras så länge poolen räcker.
- **Oavgjort = inget beslut, inga effekter** (Flash A/B, `dilemmaStrict`): uteblivna röster räknas
  inte, och lika röstetal (inkl. 0–0) ger "INGET BESLUT FATTADES" utan konsekvenser.
- **Mellans kategorifördelning 1/1/2/1** (future / sector / cooperation / polluter) per Ö-råd.

---

## 3. Nästa steg (prioritetsordning)

1. **Visuell verifiering av Flash** — spela igenom i webbläsaren och bekräfta att det nya flödet
   (8 beslut, röstregler, timers, resultatpopup, rigg-cues) ser rätt ut. *Pågår.*
2. **Visuell verifiering av Mellan** — samma genomspelning (15 förslag, 1/1/2/1-kvoter, politik,
   företags-/öhälsohändelser).
3. **Riktad balansering** — DÄREFTER, med simulatorn (`tools/simulera.js`-mönstret). Flash-dilemmans
   och händelsernas siffror är preliminära; Mellans kända skuld (pengarsektorn dominerar) tas här.

**Nedprioriterat just nu (gör INTE före 1–3):** ytterligare motorstädning och ombalansering.

---

## 4. Kvar till "kompletta + rena" (efter nästa steg)

**Gemensamt / motor (städning — ej nu):**
- Lyft `DEFAULT_CONFIG` mot en versionsneutral baslinje (motorn har kvar Mellan-doftande default).
- Döda state-fält/efterlämningar efter borttagna förslag (`banDirtySektor`/`buildDiscount`).
- `README.md`/`SPELINFO.md`-drift (gammalt "Eco Loco"-namn, saknar nya mekaniker).

**Flash:**
- Bilder för de 8 besluten (`assets/dilemma/<id>.png` saknas → tyst fallback). Se `IKONER-BILDSTIL.md`.
- Flash kör i dag Mellans tutorial (klientens MODE kommer från manifestet, inte varianten) — känd
  kvarvarande punkt.

**Mellan:**
- Ikoner för de 15 politikförslagen (fortfarande emoji). Se `IKONER-BILDSTIL.md`.
- Bekräfta fas-timrar (bygga 100 vs tidigare 120) och nära-dubbletter i politikbanken
  (`POLITIK-INVENTERING.md` §6).

**Öppna designfrågor:**
- **Sponsrats "rätta plats":** behåll `events.js` som rost-bank, eller vik in i `dilemmas.js` så alla
  Ö-råds-beslut bor ihop? Ingen mekanik påverkas. (Se `att-gora.md`.)
- **Rigg-cuerna:** gå igenom vilka nya händelser som ska vara dramatiska (kris/fanfar) vs lugna
  (happening) — nuvarande mappning är en första gissning. (Se `RIGG-KONTRAKT.md` + `att-gora.md`.)

---

## 5. Innan push till upstream — stäm av med Josef

**Flerversions-ombyggnaden omtolkar RAMVERK invariant 1.** Tidigare: balans/regler i `spec/engine.js`.
Nu: motorn är innehållstom, balans/innehåll ligger i `spec/content/*` + `spec/config/variants/*`.
Arbetet är **committat lokalt** men ska **INTE pushas** till upstream (2047-Science-Center) förrän
Josef godkänt omtolkningen — NUC:arna hämtar därifrån. RAMVERK.md är uppdaterad för att beskriva den
nya strukturen; den uppdateringen är en del av det som ska stämmas av.
