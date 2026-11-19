// spec/content/proposals.js — POLITIKBANK (innehåll, ingen logik).
// Flyttad ur spec/engine.js (_resolveProposal-kedjan) 2026-11-11, Etapp 2b–A.
// OMARBETAD 2026-11-19 (Klara/Josef-beslut): GEMENSAM bank för Mellan OCH Skola, 15 förslag,
// FYRA mekaniska kategorier. Effekterna tolkas av spec/effects.js, urvalet av
// spec/systems/proposal-selector.js. Belopp läses ur cfg via cfgKey — INGA balansvärden ändras här.
//
// FYRA KATEGORIER (`category`, exakt EN per förslag; styr kvoter i politics.selection.quotas):
//   future        Beslut som påverkar NÄSTA spelår (byggförbud/-paus m.m.).
//   cooperation   Gemensamma satsningar/överenskommelser där företagens röster påverkar utfallet.
//   polluter      Beslut riktade mot de som förorenat mest eller har störst tillgångar ("boven").
//   sector        Beslut där pengasektorn och materialsektorn ställs mot varandra.
//
// Övriga fält:
//   id          stabilt ID (matchar tidigare proposal.type). ÄNDRA ALDRIG.
//   namn        kort visningsnamn (motorn använder id; UI-rubrik ligger i src/ui.js propDefs).
//   tags        BESKRIVANDE metadata (ej primär urvalsnyckel längre). Selektorn kan filtrera på dem
//               (whitelist), men Mellans/Skolas urval styrs av `category`. Lämnade kvar som referens.
//   eligibility VILLKOR för att förslaget får PRESENTERAS (urvalet filtrerar). {} / {always} = alltid.
//   conditions  villkor för att EFFEKTERNA ska genomföras (utöver motorns 3/4-grind), t.ex. exakt 3 ja.
//   effects     förändringar av spel-status (se spec/effects.js för typer/selektorer).
//
// INGA förslag är obligatoriska eller har särskild status i urvalet.

export const PROPOSALS = [
  // ── FRAMTIDA (future) — 2 ──
  { id: 'forbud', namn: 'Förbjud smutsig', category: 'future', tags: ['environment'], eligibility: { always: true }, conditions: [],
    effects: [
      { type: 'buildRestriction', scope: 'dirty', duration: 'thisRound' },
    ] },
  { id: 'naturreservat', namn: 'Naturreservat', category: 'future', tags: ['environment'], eligibility: {}, conditions: [],
    effects: [
      { type: 'ohalsa', cfgKey: 'naturreservatOh', when: 'immediate' },
      { type: 'buildRestriction', scope: 'all', duration: 'thisRound' },
    ] },

  // ── SAMARBETE (cooperation) — 5 ──
  { id: 'gron', namn: 'Grön satsning', category: 'cooperation', tags: ['environment'], eligibility: { always: true }, conditions: [],
    effects: [
      { type: 'resource', target: 'yesVoters', currency: 'pengar', amount: { cfgKey: 'gronCost' }, op: 'sub', floor: 0 },
      { type: 'ohalsa', cfgKey: 'gronGain', when: 'immediate' },
    ] },
  { id: 'krispaket', namn: 'SOS Krispaket', category: 'cooperation', tags: ['crisis', 'environment'], eligibility: { ohBelow: { cfgKey: 'krisProposalOh' } }, conditions: [],
    effects: [
      { type: 'resource', target: 'yesVoters', currency: 'pengar', amount: { cfgKey: 'krispaketCost' }, op: 'sub', floor: 0 },
      { type: 'ohalsa', cfgKey: 'krispaketGain', when: 'immediate' },
    ] },
  { id: 'marknadsavtal', namn: 'Marknadsavtal', category: 'cooperation', tags: ['economy'], eligibility: {}, conditions: [{ yesCountEquals: 3 }],
    effects: [
      { type: 'resource', target: 'all', currency: 'pengar', amount: { cfgKey: 'marknadsavtalBonus' }, op: 'add' },
      { type: 'ohalsa', cfgKey: 'marknadsavtalOh', when: 'immediate' },
    ] },
  { id: 'gronstod', namn: 'Riktat grönt stöd', category: 'cooperation', tags: ['environment'], eligibility: {}, conditions: [],
    effects: [
      { type: 'pot', from: 'yesVoters', to: 'greenest', currency: 'pengar', amount: { cfgKey: 'gronCost' }, split: 'whole', toTiming: 'after' },
    ] },
  { id: 'allians', namn: 'Allians', category: 'cooperation', tags: ['economy'], eligibility: {}, conditions: [],
    effects: [
      { type: 'resource', target: 'yesVoters', currency: 'pengar', amount: { cfgKey: 'alliansBonus' }, op: 'add' },
      { type: 'resource', target: 'noVoters', currency: 'pengar', amount: { cfgKey: 'alliansBoter' }, op: 'sub', floor: 0 },
    ] },

  // ── BOVEN (polluter) — 4 ──
  { id: 'skatt', namn: 'Miljöskatt på boven', category: 'polluter', tags: ['economy'], eligibility: { always: true }, conditions: [],
    effects: [
      { type: 'pot', from: 'worstPolluter', to: 'othersThanFrom', currency: 'pengar', amount: { cfgKey: 'taxAmount' }, split: 'floor' },
    ] },
  { id: 'utslappshandel', namn: 'Utsläppshandel', category: 'polluter', tags: ['economy', 'environment'], eligibility: {}, conditions: [],
    effects: [
      { type: 'pot', from: 'worstPolluter', to: 'greenest', currency: 'pengar', amount: { cfgKey: 'utslappAmount' }, split: 'whole' },
      { type: 'ohalsa', cfgKey: 'utslappOh', when: 'immediate' },
    ] },
  { id: 'solidaritet', namn: 'Solidaritetsskatt', category: 'polluter', tags: ['economy'], eligibility: {}, conditions: [],
    effects: [
      { type: 'pot', from: 'richest', to: 'othersThanFrom', amounts: { pengar: { cfgKey: 'solidaritetPengar' }, material: { cfgKey: 'solidaritetMaterial' } }, split: 'floor' },
    ] },
  { id: 'grannskatt', namn: 'Grannskatt', category: 'polluter', tags: ['economy'], eligibility: {}, conditions: [],
    effects: [
      { type: 'pot', from: 'twoRichest', to: 'twoPoorest', currency: 'pengar', amount: { cfgKey: 'grannskattAmount' }, split: 'floor' },
    ] },

  // ── SEKTORKONFLIKT (sector) — 4 ──
  // Industriskatt + Naturbruksskatt är SPEGLAR: samma mekanik, motsatt riktning. sektorPengar = Räven
  // (tundra) + Örnen (stad); sectorMaterial = Oxen (aker) + Björnen (skog). Betalare golvas vid 0 i
  // applyPot (Math.min) → pengar blir aldrig negativt. ID 'sektorskatt' behålls (bara visningsnamnet
  // bytte till "Industriskatt" i src/ui.js) så inga referenser bryts.
  { id: 'sektorskatt', namn: 'Industriskatt', category: 'sector', tags: ['economy'], eligibility: {}, conditions: [],
    effects: [
      { type: 'pot', from: 'sectorPengar', to: 'sectorMaterial', currency: 'pengar', amount: { cfgKey: 'sektorskattAmount' }, split: 'floor' },
    ] },
  { id: 'naturbruksskatt', namn: 'Naturbruksskatt', category: 'sector', tags: ['economy'], eligibility: {}, conditions: [],
    effects: [
      { type: 'pot', from: 'sectorMaterial', to: 'sectorPengar', currency: 'pengar', amount: { cfgKey: 'naturbruksskattAmount' }, split: 'floor' },
    ] },
  { id: 'kustvakt', namn: 'Kustvakt', category: 'sector', tags: ['environment'], eligibility: {}, conditions: [],
    effects: [
      { type: 'resource', target: ['omrade:tundra', 'omrade:stad'], currency: 'pengar', amount: { cfgKey: 'kustvaktAmount' }, op: 'sub', floor: 0 },
      { type: 'ohalsa', cfgKey: 'kustvaktOh', when: 'immediate' },
    ] },
  { id: 'skogsvard', namn: 'Skogsvård', category: 'sector', tags: ['environment'], eligibility: {}, conditions: [],
    effects: [
      { type: 'resource', target: ['omrade:aker', 'omrade:skog'], currency: 'pengar', amount: { cfgKey: 'skogsvardAmount' }, op: 'sub', floor: 0 },
      { type: 'ohalsa', cfgKey: 'skogsvardOh', when: 'immediate' },
    ] },
];

const BY_ID = Object.fromEntries(PROPOSALS.map(p => [p.id, p]));
export const proposalById = id => BY_ID[id];

// BORTTAGNA 2026-11-19 (ej längre i aktiv bank): sektorblockad, byggboom, raddningsfond, lojalitet.
// (EXTRA_PROPOSAL_POOL-listan är borttagen — golden-testet räknar numera upp PROPOSALS direkt.)
