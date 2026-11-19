# Flash – inventering av Ö-rådets beslut (dilemman + sponsrat)

*Rapport, ingen implementation. Skapad 2026-11-19 av Klara + Claude. Inget i Flash har ändrats —
beslutssystem, dilemman, effekter och urvalslogik är orörda. Rent läsunderlag inför kommande
Flash-arbete.*

**Källor:** `spec/content/dilemmas.js` (4 A/B-dilemman), `spec/content/events.js` (`sponsrat`,
typ `rost`), `spec/engine.js` (`_decisionPool`, `_rollRoundDecisions`, `openDilemma`,
`_resolveDilemma`, `_resolveProposal`), `server/server.js` (`startDilemma`/`tickDilemma`/
`forceDilemmaVotes`), `spec/config/variants/flash.js`.

Flash kör `decisionSystem: 'dilemma'` och `content.proposals: false` → **politikbanken används
aldrig i Flash**. Ö-rådets beslut dras i stället ur en egen pool: de 4 dilemmana **plus** röst-
händelsen `sponsrat`. Alla fem är flaggade `preliminary` (dilemmana i data, sponsrat tematiskt).

---

## 6. Flashs fem beslut

### 6.1 `koncernerbjudande` — "Ett erbjudande ni knappast kan tacka nej till" *(A/B-dilemma)*
- **Text:** "En koncern vill investera stort i ön — mot att ni blundar för lite smuts."
- **Alt A — "Ta pengarna":** alla fyra lag **+15 🪙**; öhälsa **−6**.
- **Alt B — "Tacka nej":** öhälsa **+2** (inga resurser).
- **Villkor (eligibility):** inga → alltid valbart.
- **Bild:** `assets/dilemma/koncernerbjudande.png`.

### 6.2 `algblomning` — "Algblomningen sprider sig" *(A/B-dilemma)*
- **Text:** "Vattnet grumlas av giftiga alger. Sanera tillsammans nu, eller hoppas att det driver bort?"
- **Alt A — "Sanera gemensamt":** alla fyra lag **−6 🪙** (golv 0, aldrig negativt); öhälsa **+12**.
- **Alt B — "Avvakta":** öhälsa **−10** (inga resurser).
- **Villkor (eligibility):** **öhälsa < 45** (`ohBelow: 45`). Visas bara när ön redan är ansträngd.
- **Bild:** `assets/dilemma/algblomning.png`.

### 6.3 `oljefynd` — "Olja under tundran" *(A/B-dilemma)*
- **Text:** "Geologerna har hittat olja. En kortsiktig guldgruva för pengar-lagen — men till vilket pris för ön?"
- **Alt A — "Börja borra":** pengarsektorn (Räven + Örnen) **+12 🪙**; öhälsa **−8**.
- **Alt B — "Låt oljan ligga":** öhälsa **+4** (inga resurser).
- **Villkor (eligibility):** inga → alltid valbart.
- **Bild:** `assets/dilemma/oljefynd.png`.

### 6.4 `markkonflikt` — "Striden om den sista marken" *(A/B-dilemma)*
- **Text:** "Två läger gör anspråk på öns sista obebyggda mark. Vem får den?"
- **Alt A — "Ge den rikaste exploatören":** rikaste laget **+10 🪙**; öhälsa **−5**.
- **Alt B — "Ge det grönaste laget":** grönaste laget **+8 🪙**; öhälsa **+3**.
- **Villkor (eligibility):** inga → alltid valbart.
- **Bild:** `assets/dilemma/markkonflikt.png`.

### 6.5 `sponsrat` — "Ett erbjudande ni knappast kan tacka nej till" *(JA/NEJ-omröstning, typ `rost`)*
- **Text:** "En vänligt sinnad koncern vill investera i ön — mot att vi blundar för lite smuts. Rösta nu: tar ni pengarna?"
- **Röstfråga:** "Ska ön anta koncernens erbjudande?"
- **JA (per lag):** varje lag som röstar JA får **+15 🪙** (individuell frestelse).
- **Öhälsa:** **−6** för hela ön **om minst ett lag röstar JA**. Röstar alla NEJ → ingen effekt.
- **Villkor (eligibility):** inga → alltid valbart.
- **Ljud:** `assets/audio/rigg/event_sponsrat.mp3`. (Detta är den enda röst-händelsen i poolen.)

---

## 6b. Hur omröstningen avgörs + lika röstetal

| | A/B-dilemman (6.1–6.4) | `sponsrat` (6.5) |
|---|---|---|
| **Mekanik** | Flest röster vinner (`aCount >= bCount ? 'A' : 'B'`). Hela ön följer utfallet. | Individuell JA/NEJ. Varje JA-lag får sin belöning; öns öhälsa tar smällen om ≥1 JA. Ingen 3/4-grind. |
| **Lika röstetal** | **Oavgjort → A** (förslagets första alternativ). Gäller 2–2 **och** 0–0. Flaggat som *preliminär regel* i koden. | Ej tillämpligt (ingen majoritet räknas). 0 JA = inget händer. |
| **Vid tidsutgång** | Icke-röstare räknas som **A** (`forceDilemmaVotes`, default 'A'), sedan röstar botarna. | Icke-röstare räknas som **NEJ** (default `false`) → "avstå erbjudandet". |
| **Botar** | Röstar via `checkBotVotes` ~8 s efter att dilemmat visats. | Samma. |

**Effektmotor:** båda vägarna verkställs av samma `spec/effects.js` som politiken (dilemman via
literala `value`-öhälsotal, inte `cfgKey`). Öhälso-svansen (`_applyQueuedOhalsa`) applicerar och
emitterar `ohalsa` oförändrat.

---

## 7. Flashs urvalslogik (kort)

- **När under året:** beslutet presenteras **i början av Ö-rådet** (`server.js startDilemma`), efter
  byggfas + prisutdelning, **innan** nästa år startar. Ett beslut per år (`dilemma.perRound: 1`).
  Automatiskt — ingen ordförande, inget val mellan flera alternativ (till skillnad från Mellans politik).
- **Hur det slumpas:** `_rollRoundDecisions` bygger poolen `_decisionPool()` = 4 dilemman + `sponsrat`,
  och väljer **1** via samma seedbara selektor som politiken (`selectProposals`, rng = `seed + round`).
- **Föregående års beslut undviks:** `_lastDecisionId` filtreras bort — **men bara om** det finns minst
  `need` (=1) andra beslut som klarar samma filter. Annars tillåts upprepning. I praktiken finns alltid
  ≥4 giltiga → **samma beslut kommer aldrig två år i rad**, men kan återkomma ett senare år.
- **Eligibility:** `algblomning` kräver öhälsa < 45; övriga fyra är alltid valbara. Filtret körs före urvalet.
- **Alltid ett giltigt beslut?** Ja. Minst fyra beslut är alltid eligible (koncernerbjudande, oljefynd,
  markkonflikt, sponsrat) → poolen är aldrig tom.
- **Selfplay vs spelledarläge:** Flash kör `mode: 'selfplay'` och **GM aktiveras aldrig i Flash**. Ö-
  rådsbeslutet är därför alltid auto-draget. (Samma dilemma-*definitioner* återanvänds som
  spelledarstyrda händelser i Mellan/Skola via `openDilemma`/`gmOpenDecision`, men det hör inte till
  Flash och rör inte Flashs urval.)

---

## Likheter / observationer (ingen ändring föreslås)

- **`koncernerbjudande` (6.1) och `sponsrat` (6.5) är mycket lika** — båda "ta smutsiga pengar
  (+15 🪙) mot öhälsa −6". Skillnaden är mekaniken: 6.1 är kollektiv A/B (alla får pengarna om A
  vinner), 6.5 är individuell frestelse (bara JA-lagen får pengarna). De delar till och med rubrik.
  Detta är redan flaggat i `dilemmas.js`-headern som något innehållsgranskningen ska avgöra
  (behålla / ta bort / slå ihop). Eftersom båda ligger i Flashs pool **kan de dyka upp i samma spel**.
- `oljefynd` (A) och `koncernerbjudande` (A) är båda "ta pengar nu, öhälsa ned" men träffar olika
  mottagare (pengarsektorn vs alla) och olika öhälsa (−8 vs −6).
- Allt innehåll är `preliminary` → balanstalen är avsedda att gås igenom, inte låsta.

*Nästa steg (när vi tar Flash): avgöra 6.1-vs-6.5-överlappet och om fyra dilemman räcker, innan
någon balansering.*
