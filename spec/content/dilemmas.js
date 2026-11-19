// spec/content/dilemmas.js — DILEMMABANK (innehåll, ingen logik). Etapp 2c, 2026-11-16.
// Berättelsedrivna situationer med TVÅ alternativa handlingsvägar (A/B) i stället för ja/nej.
// Delar effektsystemet (spec/effects.js) och urvalet (spec/systems/proposal-selector.js) med
// politikbanken, men har egen interaktionsform (A/B-omröstning).
//
// ⚠ PRELIMINÄRT INNEHÅLL (alla fyra, `preliminary: true`): skapade för att verifiera arkitekturen,
// balansvärden är preliminära. Gås igenom i den kommande INNEHÅLLSGRANSKNINGEN. OBS: `koncernerbjudande`
// överlappar TEMATISKT den befintliga 'rost'-händelsen `sponsrat` (events.js) — granskningen avgör om
// det ska behållas, tas bort eller slås ihop. Det ursprungliga erbjudande-beslutet ÄR `sponsrat` och
// ligger kvar i events.js (individuell ja/nej); det dubbleras inte här.
//
// Samma dilemma-definition återanvänds i två sammanhang (INTE två kopior):
//   • Flash: automatiskt under Ö-rådet (decisionSystem:'dilemma'). FLASHS AKTIVA POOL är EXPLICIT listad
//     i spec/config/variants/flash.js (dilemma.pool) — exakt 8 beslut. Motorn filtrerar _decisionPool()
//     mot den listan, så koncernerbjudande (nedan) är UTE ur Flash men kvar i banken för GM.
//   • Mellan/Skola: som spelledarstyrd händelse (GM anropar openDilemma(id)). GM-katalogen byggs i
//     server.js av dilemman som INTE är flashOnly → de fyra Flash-only-dilemman nedan syns aldrig i GM.
//
// Fält:
//   id          stabilt ID. ÄNDRA ALDRIG.
//   namn        rubrik. text  berättelsetext.
//   category    berättelsetyp: 'erbjudande' | 'kris' | 'mojlighet' | 'konflikt' (styr ev. kvoter/rotation).
//   tags        beskrivande etiketter (flera möjliga).
//   eligibility presentationsvillkor (samma schema som politik: {} / {always} / {ohBelow} / {notLastRound}).
//   flashOnly   true → beslutet hör BARA till Flash (hålls ur GM-katalogen i Mellan/Skola). Utelämnat = bankgemensamt.
//   bild        valfri bild-nyckel.
//   alternativ  { A:{namn, effects}, B:{namn, effects} } — effekter per väg (se spec/effects.js).

export const DILEMMAS = [
  { preliminary: true,
    id: 'koncernerbjudande', namn: 'Ett erbjudande ni knappast kan tacka nej till',
    text: 'En koncern vill investera stort i ön — mot att ni blundar för lite smuts.',
    category: 'erbjudande', tags: ['economy'], eligibility: {}, bild: 'assets/dilemma/koncernerbjudande.png',
    alternativ: {
      A: { namn: 'Ta pengarna', effects: [
        { type: 'resource', target: 'all', currency: 'pengar', amount: 15, op: 'add' },
        { type: 'ohalsa', value: -6, when: 'immediate' },
      ] },
      B: { namn: 'Tacka nej', effects: [
        { type: 'ohalsa', value: 2, when: 'immediate' },
      ] },
    },
  },
  { preliminary: true,
    id: 'algblomning', namn: 'Algblomningen sprider sig',
    text: 'Vattnet grumlas av giftiga alger. Sanera tillsammans nu, eller hoppas att det driver bort?',
    category: 'kris', tags: ['environment', 'crisis'], eligibility: { ohBelow: 45 }, bild: 'assets/dilemma/algblomning.png',
    alternativ: {
      A: { namn: 'Sanera gemensamt', effects: [
        { type: 'resource', target: 'all', currency: 'pengar', amount: 6, op: 'sub', floor: 0 },
        { type: 'ohalsa', value: 12, when: 'immediate' },
      ] },
      B: { namn: 'Avvakta', effects: [
        { type: 'ohalsa', value: -10, when: 'immediate' },
      ] },
    },
  },
  { preliminary: true,
    id: 'oljefynd', namn: 'Olja under tundran',
    text: 'Geologerna har hittat olja. En kortsiktig guldgruva för pengar-lagen — men till vilket pris för ön?',
    category: 'mojlighet', tags: ['economy'], eligibility: {}, bild: 'assets/dilemma/oljefynd.png',
    alternativ: {
      A: { namn: 'Börja borra', effects: [
        { type: 'resource', target: 'sectorPengar', currency: 'pengar', amount: 12, op: 'add' },
        { type: 'ohalsa', value: -8, when: 'immediate' },
      ] },
      B: { namn: 'Låt oljan ligga', effects: [
        { type: 'ohalsa', value: 4, when: 'immediate' },
      ] },
    },
  },
  { preliminary: true,
    id: 'markkonflikt', namn: 'Striden om den sista marken',
    text: 'Två läger gör anspråk på öns sista obebyggda mark. Vem får den?',
    category: 'konflikt', tags: ['economy'], eligibility: {}, bild: 'assets/dilemma/markkonflikt.png',
    alternativ: {
      A: { namn: 'Ge den rikaste exploatören', effects: [
        { type: 'resource', target: 'richest', currency: 'pengar', amount: 10, op: 'add' },
        { type: 'ohalsa', value: -5, when: 'immediate' },
      ] },
      B: { namn: 'Ge det grönaste laget', effects: [
        { type: 'resource', target: 'greenest', currency: 'pengar', amount: 8, op: 'add' },
        { type: 'ohalsa', value: 3, when: 'immediate' },
      ] },
    },
  },

  // ── FLASH-ONLY (2026-11-19): nya dilemman ENBART för Flashs beslutspool (flash.js dilemma.pool).
  // `flashOnly: true` håller dem UTE ur GM-katalogen i Mellan/Skola (server bygger den av !flashOnly).
  // Koncernerbjudandet togs ur Flashs pool (överlappade sponsrat) men ligger kvar ovan för GM-bruk. ──
  { preliminary: true, flashOnly: true,
    id: 'urskog', namn: 'Den sista urskogen',
    text: 'En orörd urskog har upptäckts på ön. Skogen innehåller värdefullt virke, men en avverkning skulle skada naturen.',
    category: 'mojlighet', tags: ['economy'], eligibility: {}, bild: 'assets/dilemma/urskog.png',
    alternativ: {
      // SPEGEL av oljefynd: gynnar materialsektorn (Oxen + Björnen) i stället för pengarsektorn.
      A: { namn: 'Avverka skogen', effects: [
        { type: 'resource', target: 'sectorMaterial', currency: 'material', amount: 12, op: 'add' },
        { type: 'ohalsa', value: -8, when: 'immediate' },
      ] },
      B: { namn: 'Bevara urskogen', effects: [
        { type: 'ohalsa', value: 4, when: 'immediate' },
      ] },
    },
  },
  { preliminary: true, flashOnly: true,
    id: 'naturreservat_flash', namn: 'Naturreservat',
    text: 'Ett stort naturområde föreslås bli naturreservat. Ska företagen skydda naturen, även om det begränsar deras möjligheter att bygga nästa år?',
    // SEPARAT Flash-definition — rör INTE politikförslaget 'naturreservat' i proposals.js (Mellan/Skola).
    // eligibility notLastRound: bara år 1–3 (effekten "förbjud smutsigt nästa år" saknar mening sista året).
    // buildRestriction scope:'dirty' = samma beprövade mekanik som politikens 'forbud' → bannar BARA smutsiga
    // byggen nästa år (gröna tillåtna), för alla fyra företag, och upphör efter det året (banDirty-shiften).
    category: 'mojlighet', tags: ['environment'], eligibility: { notLastRound: true }, bild: 'assets/dilemma/naturreservat_flash.png',
    alternativ: {
      A: { namn: 'Bilda naturreservat', effects: [
        { type: 'ohalsa', value: 12, when: 'immediate' },
        { type: 'buildRestriction', scope: 'dirty', duration: 'thisRound' },
      ] },
      B: { namn: 'Fortsätt som vanligt', effects: [] },
    },
  },
  { preliminary: true, flashOnly: true,
    id: 'leveransstopp_flash', namn: 'Leveransstopp',
    text: 'En viktig transportled har blockerats. Ska ön prioritera leveranser av byggmaterial eller ekonomiska resurser?',
    // Tema lånat från GM-händelsen Leveransstopp (gm-events.js) — den definitionen är OFÖRÄNDRAD.
    // Sektorval: båda vägarna har SAMMA miljökostnad (−5), bara olika mottagarsektor.
    category: 'konflikt', tags: ['economy'], eligibility: {}, bild: 'assets/dilemma/leveransstopp_flash.png',
    alternativ: {
      A: { namn: 'Prioritera material', effects: [
        { type: 'resource', target: 'sectorMaterial', currency: 'material', amount: 10, op: 'add' },
        { type: 'ohalsa', value: -5, when: 'immediate' },
      ] },
      B: { namn: 'Prioritera ekonomin', effects: [
        { type: 'resource', target: 'sectorPengar', currency: 'pengar', amount: 10, op: 'add' },
        { type: 'ohalsa', value: -5, when: 'immediate' },
      ] },
    },
  },
  { preliminary: true, flashOnly: true,
    id: 'bra_skord_flash', namn: 'Bra skörd',
    text: 'Ön har haft ett ovanligt gynnsamt år. Ska företagen använda överskottet för att växa eller låta naturen återhämta sig?',
    // Tema lånat från GM-händelsen Bra skörd (gm-events.js) — den definitionen är OFÖRÄNDRAD.
    category: 'mojlighet', tags: ['economy'], eligibility: {}, bild: 'assets/dilemma/bra_skord_flash.png',
    alternativ: {
      A: { namn: 'Ta vara på skörden', effects: [
        { type: 'resource', target: 'all', currency: 'pengar', amount: 8, op: 'add' },
        { type: 'ohalsa', value: -4, when: 'immediate' },
      ] },
      B: { namn: 'Låt naturen återhämta sig', effects: [
        { type: 'ohalsa', value: 10, when: 'immediate' },
      ] },
    },
  },
];

const BY_ID = Object.fromEntries(DILEMMAS.map(d => [d.id, d]));
export const dilemmaById = id => BY_ID[id];
