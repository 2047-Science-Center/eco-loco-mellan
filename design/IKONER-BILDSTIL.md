# Ikoner & bildstil — inventering + rekommenderad metod

*Rapport, ingen implementation. Skapad 2026-11-19 av Klara + Claude. INGA bilder genererade eller
ersatta. Underlag för beslut om hur vi tar fram ikoner/bilder till Flashs 8 dilemman och Mellans 15
politiska förslag, i Eco Locos befintliga visuella identitet.*

---

## 1. Inventering

### 1.1 Vilka bildfiler som används — och var

| Område | Hur de refereras | Faktiska filer |
|---|---|---|
| **Händelser** (events/kriser/öhälsa) | `assets/event_<id>.png` (konvention i `src/ui.js`), eller `ev.bild` | **Finns:** 20 st `assets/event_*.png` (storm, skogsbrand, torka, uppror, gronafonden, sponsrat, marknadskrasch, godskord + de 12 nya kris-/prestationsbilderna). |
| **Maktbilder** (ordförande/"X har ordet", kröning) | `assets/makt/<lagid>.png` | **Finns:** `aker/skog/stad/tundra.png`. |
| **Dilemman** (Flash) | `d.bild` → `assets/dilemma/<id>.png`, annars fallback `assets/event_<id>.png` | **Saknas helt** — `assets/dilemma/`-mappen finns inte. Dilemman visas i dag utan egen bild (tyst fallback). Gäller både de 4 gamla och mina 4 nya. |
| **Politiska förslag** (Mellan/Skola) | **Emoji** i `src/ui.js propDefs()` (`pic:'🌱'` osv.) | **Inga bildfiler** — bara emoji. |
| **Kort/byggnader** | `assets/<region>_<tier>.png` | Finns (aker/skog_gron/standard/smutsig …). |
| **Chrome-ikoner** (resurser, mätare, lagbadges) | `src/icons.js` (`ico()`), `src/logos.js` | Ritade i kod (fasetterad vektor-stil), inte PNG. |

### 1.2 Format, dimensioner, proportioner
- Scen-/händelsebilder: **PNG, 1672×941 px (≈16:9), 8-bit RGB.** Visas med `object-fit:cover` i olika
  rutor (stor event-popup; liten 200×120 i röst-rutan `vote-pic`) → **håll motivets kärna centrerad**,
  sidorna beskärs.
- Inga alfakanaler/transparens i scen-bilderna (fyllda 16:9-rutor, inte fristående ikoner).
- Chrome-ikonerna (`src/icons.js`) är upplösningsoberoende (ritas i kod), helt annan kategori.

### 1.3 Hur bilderna refereras från innehållet (viktigt för mekaniken)
- Koden refererar **id:n**, aldrig bilder, för spel-logik. Bilder hämtas via **sökvägskonvention**
  (`assets/event_<id>.png`, `assets/dilemma/<id>.png`) eller ett `bild`-fält i innehållet.
- **Saknad bild degraderar snällt** (`onerror` döljer/faller tillbaka). → Att lägga till/byta en bild
  är att släppa en fil på rätt sökväg; **ingen kod- eller balansändring behövs**.

### 1.4 Finns en gemensam stil? Befintliga designinstruktioner?
- **Ja, dokumenterad men i omprövning.** `design/HANDELSE-BILDPROMPTS.md` (2026-11-18) har per-bild-
  prompts + stilrader:
  - **"HÄNDELSEKORT"** (äldre): målad illustrerad realism / digital gouache, kallt nordiskt ö-samhälle,
    dämpad overskyad palett med EN varm ljusspricka, 16:9. 16 bilder gjordes i den.
  - **"SPELKONST"** (ny riktning): målad spelkonst á la WoW/Blizzard-konceptkonst — "grundad i
    verkligheten men tydligt ILLUSTRERAD, inte fotad". Klaras feedback: HÄNDELSEKORT kändes **för
    fotorealistisk/filmisk**, matchade inte kontrollrummet + de fasetterade djuremblemen. Två SPELKONST-
    testbilder godkända (`tundra_major`, `stad_minor`); iteration pågick. **Inget beslut än** om de 16
    gamla ska göras om.
- Överlämningens §4 (asset-pipeline): generera i enhetlig stil med **bildreferens + explicita avvikelser**,
  ta fram 4–6 varianter, välj mot checklista.

### 1.5 Vilken typ av visuell identitet?
**En medveten KOMBINATION av flera stilrader** (RAMVERK §3 + §6.4):
- **Fasetterade/low-poly djuremblem** (lagbadges, `src/logos.js`) + **retro kontrollpanel-chrome** (CSS,
  mörk oliv/guld, LED-siffror).
- **Målade scen-bilder** (händelser, makt) — halv-realistisk illustration.
- **Fotoreal-ö** (trailer/karta/slutfinal).
- **Emoji** som nödlösning i politik-modal/toasts (flaggat som skuld i RAMVERK §6.4 — bör ersättas av
  `src/icons.js`-fasettikoner).

---

## 2. Rekommenderad metod (svar på de sex frågorna)

**1. Bildgenerering utifrån gemensamma referensbilder + fast stilprompt?**
Ja — för de **stora dilemma-scenbilderna** (Flash). Återanvänd exakt pipelinen i
`design/HANDELSE-BILDPROMPTS.md`: en fast stilrad (rekommendation: **SPELKONST**, se §3) + 1–2
godkända referensbilder (`tundra_major`, `stad_minor`) bifogade som stilankare + per-bild motivtext,
4–6 varianter, välj mot checklista. Det ger dilemman samma uttryck som händelsesystemet.
**För de 15 politiska förslagen** rekommenderar jag INTE stora genererade scener (se nästa fråga).

**2. SVG/vektor eller genererad PNG?**
- **Politiska förslag → vektor/kod-ikoner (SVG eller `src/icons.js`-fasettstil), inte PNG-scener.**
  Förslagen visas som små knappval i politik-modalen; de behöver en tydlig *symbol* (hammare, våg,
  träd, fabrik), inte en målad scen. Det matchar också RAMVERK §Ikoner (chrome ska gå via `src/icons.js`)
  och löser emoji-skulden. Vektor skalar skarpt på alla skärmar.
- **Flash-dilemman → genererad PNG (16:9-scen).** De presenteras som stora berättande Ö-rådskort,
  precis som händelser → samma format och pipeline som `assets/event_*.png`.

**3. Tekniska krav för alla ikoner/bilder:**
- Dilemma-scener: **PNG, 1672×941 (16:9)**, motivets kärna centrerad (cover beskär sidor), ingen text/
  UI/logga/vattenstämpel i bilden, filnamn exakt `assets/dilemma/<id>.png`.
- Politik-ikoner: **SVG eller `src/icons.js`-ikon**, enfärgad/duoton som chromet, läsbar ned till
  ~40–64 px, inget inbränt text, transparent bakgrund, följer palett-tokens (guld/dämpat) i `spel.html`.
- Alla: svenska/neutrala symboler, touch-skala, funkar mot mörk kontrollpanels-bakgrund.

**4. Hur får de 8 Flash-besluten + 15 politiska förslagen ett sammanhängande uttryck?**
Två konsekventa *lager* snarare än en enda bildtyp (matchar spelets befintliga logik):
- **Berättande beslut (dilemman) = SPELKONST-scener** (som händelserna).
- **Snabbval (politik) = fasett-ikon-symboler** (som chromet/lagbadges).
Gemensam palett (RAMVERK §3-tokens), samma ljus-/färgkänsla, samma symbolspråk (träd=miljö, fabrik=
industri, våg=skatt). En kort **stil-checklista** (palett, ljusspricka, symbolbibliotek) hålls i
`design/HANDELSE-BILDPROMPTS.md` så båda lagren refererar samma ankare.

**5. Hur byter vi bilder utan att röra mekaniken?**
Lägg filen på sökvägskonventionen (`assets/dilemma/<id>.png`) eller sätt `bild`-fältet i innehållet.
Koden refererar id:n; saknad/bytt bild degraderar snällt. **Ingen motor-, server- eller balansändring.**
(För politik-ikoner: byt `pic`-fältet i `propDefs()` från emoji till `ico('<namn>')` när fasett-ikonerna
finns — en ren UI-ändring.)

**6. Vilka befintliga bilder kan återanvändas?**
- **`sponsrat`** har redan `assets/event_sponsrat.png` → Flash-dilemmat kan återanvända den direkt
  (fallbacken gör det redan).
- **`bra_skord_flash`** ↔ befintlig `assets/event_godskord.png` (god skörd) — samma motiv, kan återanvändas/omarbetas.
- **`leveransstopp_flash`** ↔ temat i GM-händelsen Leveransstopp; **`oljefynd`/`urskog`** kan spegla
  varandra (samma scen, en med borrtorn/olja, en med skog/avverkning) för tydlig parallell.
- Maktbilderna (`assets/makt/*`) återanvänds redan för ordförande/kröning — inget nytt behövs där.

---

## 3. Konkret stilrekommendation

**Välj SPELKONST-raden** (redan påbörjad, två godkända testbilder) som den gemensamma scen-stilen för
dilemman, och **fasett-ikoner** (`src/icons.js`-familjen, samma som lagbadges/chrome) för politik-
symbolerna. Motivering: Klara har redan sagt att det fotorealistiska (HÄNDELSEKORT) inte matchar
kontrollrummet + djuremblemen; SPELKONST + fasett-ikoner binder ihop hela spelet till ett uttryck och
undviker att införa en fjärde stilrad. Behåll HÄNDELSEKORT-bilderna tills vidare (inget beslut om omgörning).

**Innan generering:** bekräfta (a) SPELKONST som låst scen-stil, (b) att politik går till vektor/fasett
istället för scen-PNG, (c) om de 16 gamla HÄNDELSEKORT-bilderna ska göras om i SPELKONST (separat beslut).

*Nästa steg: på Klaras godkännande — skriv per-bild-prompts för de 8 dilemmana i
`design/HANDELSE-BILDPROMPTS.md`-mönstret och en symbol-lista för de 15 politik-ikonerna. Generera inget innan dess.*
