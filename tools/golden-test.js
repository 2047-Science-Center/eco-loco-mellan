// tools/golden-test.js — REFERENSTEST (golden) för motorns beteende.
// Kör ett deterministiskt parti (seedad RNG, fast action-script) och fångar BÅDE hela
// eventströmmen OCH slut-state. Används för att bevisa att en refaktorering INTE ändrar
// motorns beteende: skriv en baseline FÖRE ändringen, jämför EFTER.
//
//   node tools/golden-test.js --write           → skriv mellan-baseline (tools/golden/mellan-baseline-v5.json)
//   node tools/golden-test.js --write-proposals → skriv förslags-baseline (tools/golden/proposals-baseline.json)
//   node tools/golden-test.js                    → kör + jämför mellan-parti + förslag mot baseline (exit 1 vid avvikelse)
//
// Två scenarier:
//   1) mellan   — fullt parti (bygge/byte/politik/auto-händelser/kris över alla år).
//   2) events   — riktat: forcerar VARJE händelse (inkl. röst-händelsen sponsrat) från samma
//                 startläge i GM-läge och fångar dess effekter. Täcker selektorer som partiet missar.
//
// Determinism: Math.random monkey-patchas med en seedad PRNG (mulberry32). Action-scriptet
// läser live-state för att alltid göra giltiga drag (rätt maktlag, öppna omröstningar), så
// partiet är reproducerbart men ändå exercerar bygge/byte/politik/händelser/kris över alla år.

import { EcoLoco } from '../spec/engine.js';
import { PROPOSALS } from '../spec/content/proposals.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// HISTORISKA baselines (behålls orörda, används EJ i regressionen): mellan-baseline.json
// (powerFromRound=1), mellan-baseline-v2.json (powerFromRound=2, legacy grund-3-urval),
// mellan-baseline-v3.json (config-styrt urval över den gamla 18-banken). AKTIV baseline:
// mellan-baseline-v4.json = den omarbetade GEMENSAMMA 15-förslagsbanken (fyra kategorier, 2026-11-19).
// mellan-baseline-v5.json = efter att det gamla fullt slumpade händelsesystemet togs bort (2026-11-19):
//   ENDA skillnaden mot v4 är att state-fälten eventPool/drawnEvents/pendingEvent inte längre finns.
// Se tools/golden/README.md.
const BASELINE = join(HERE, 'golden', 'mellan-baseline-v5.json');
const PROPOSALS_BASELINE = join(HERE, 'golden', 'proposals-baseline.json');
const SEED = 0x9e3779b9;

// — seedad PRNG (mulberry32) som ersätter Math.random under testet —
function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clone = x => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

const ALL_EVENTS = ['start', 'roundStart', 'build', 'trade', 'proposalOpened', 'proposalResolved',
  'income', 'ohalsa', 'award', 'event', 'crisis', 'roundReplay', 'roundEnd', 'gameEnd'];

function playGame() {
  seedRandom(SEED);
  const engine = new EcoLoco();           // standardconfig = dagens Mellan-baslinje
  const events = [];
  for (const ev of ALL_EVENTS) engine.on(ev, p => events.push({ ev, payload: clone(p) }));

  engine.start();
  const tiers = ['smutsig', 'standard', 'gron'];
  let steps = 0;
  while (!engine.getState().over && steps < 500) {
    steps++;
    const S = engine.getState();

    // 1) Öppen omröstning (t.ex. event-röst) → rösta klart innan vi går vidare.
    if (S.proposal && !S.proposal.resolved) {
      S.teams.forEach((t, i) => engine.vote(t.id, i % 2 === 0));   // 2 ja, 2 nej (deterministiskt)
      continue;
    }

    // 2) Varje lag bygger ett kort (roterande nivå per år+lag).
    S.teams.forEach((t, i) => engine.selectCard(t.id, tiers[(S.round + i) % 3]));

    // 3) Maktlaget lägger ETT av rundans valbara förslag (config-styrt urval); alla röstar (3 ja, 1 nej).
    const power = S.powerTeam || S.teams[0].id;
    const choices = S.proposalChoices || [];
    if (choices.length) {
      engine.openProposal(choices[S.round % choices.length], power);
      const S2 = engine.getState();
      if (S2.proposal && !S2.proposal.resolved) S2.teams.forEach((t, i) => engine.vote(t.id, i !== 3));
    }

    // 4) Bokslut.
    engine.endRound();
  }
  return { seed: SEED, steps, finalState: clone(engine.getState()), events };
}

// (Scenario 2 "events" togs bort 2026-11-19 tillsammans med det gamla fullt slumpade händelsesystemet.
//  De nya händelserna — foretag/ohalsa/gm — täcks av tools/company-event-test.js, ohalsa-event-test.js
//  och gm-event-test.js. Historik: tools/golden/events-baseline.json behålls orörd men läses inte längre.)

// Scenario 3 (proposals): pinna RESOLUTIONEN av VARJE politiskt förslag i den aktiva banken.
// Det vanliga partiet öppnar bara ett fåtal → resten är annars otäckta. Vi stageutar
// ett förslag direkt (förbi urvals-gaten) och kör _resolveProposal, fångar emitterade events +
// den resulterande spel-statusen (öhälsa, bygg-flaggor, lagens resurser). Röstmönster 3 ja / 1 nej
// (aker/skog/tundra ja, stad nej) → yesCount=3, så pass-grinden slår och alla effekter körs.
function snapshotProposalState(S) {
  return {
    oh: S.oh, gronQueued: S.gronQueued, lastDelta: S.lastDelta,
    banDirtyThisRound: S.banDirtyThisRound, banAllThisRound: S.banAllThisRound,
    banDirtySektorThisRound: S.banDirtySektorThisRound, buildDiscountThisRound: S.buildDiscountThisRound,
    teams: S.teams.map(t => ({ id: t.id, pengar: t.pengar, material: t.material })),
  };
}
function playProposalsCoverage() {
  const types = PROPOSALS.map(p => p.id);
  const out = [];
  for (const type of types) {
    seedRandom(SEED);
    const engine = new EcoLoco();
    const events = [];
    for (const ev of ALL_EVENTS) engine.on(ev, p => events.push({ ev, payload: clone(p) }));
    engine.start();
    const base = events.length;
    const S = engine.getState();
    S.proposal = { type, by: 'aker', votes: {}, resolved: false, passed: false };
    S.teams.forEach((t, i) => { S.proposal.votes[t.id] = (i !== 3); });   // 3 ja, 1 nej
    engine._resolveProposal();
    out.push({ type, emitted: events.slice(base), state: snapshotProposalState(engine.getState()) });
  }
  return { seed: SEED, scenario: 'proposals', cases: out };
}

// — stabil serialisering: sortera OBJEKT-nycklar (arrayordning bevaras) så jämförelsen inte
//   är känslig för nyckelordning, bara för faktiskt innehåll —
function sortDeep(x) {
  if (Array.isArray(x)) return x.map(sortDeep);
  if (x && typeof x === 'object') {
    const out = {};
    for (const k of Object.keys(x).sort()) out[k] = sortDeep(x[k]);
    return out;
  }
  return x;
}
const stable = x => JSON.stringify(sortDeep(x), null, 2);

// — hitta första skillnaden (för läsbar diff-rapport) —
function firstDiff(a, b, path = '') {
  if (a === b) return null;
  const ta = Array.isArray(a) ? 'array' : typeof a, tb = Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) return { path, a, b };
  if (ta === 'array') {
    if (a.length !== b.length) return { path: `${path}.length`, a: a.length, b: b.length };
    for (let i = 0; i < a.length; i++) { const d = firstDiff(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (ta === 'object' && a && b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) { const d = firstDiff(a[k], b[k], path ? `${path}.${k}` : k); if (d) return d; }
    return null;
  }
  return { path, a, b };
}

function compareTo(file, result, label) {
  if (!existsSync(file)) { console.error(`[golden] saknar baseline (${file}) — kör med --write* först`); process.exit(2); }
  const baseline = JSON.parse(readFileSync(file, 'utf8'));
  const current = JSON.parse(stable(result));   // samma normalisering som baseline
  const diff = firstDiff(baseline, current);
  if (diff) {
    console.error(`[golden:${label}] AVVIKELSE mot baseline:`);
    console.error(`  path: ${diff.path}`);
    console.error(`  baseline: ${JSON.stringify(diff.a)}`);
    console.error(`  nu:       ${JSON.stringify(diff.b)}`);
    process.exit(1);
  }
  return true;
}

if (process.argv.includes('--write')) {
  const result = playGame();
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, stable(result) + '\n');
  console.log(`[golden] mellan-baseline skriven: ${BASELINE}`);
  console.log(`[golden] ${result.events.length} events, ${result.steps} steg, slut-öhälsa ${result.finalState.oh}, over=${result.finalState.over}`);
} else if (process.argv.includes('--write-proposals')) {
  const result = playProposalsCoverage();
  mkdirSync(dirname(PROPOSALS_BASELINE), { recursive: true });
  writeFileSync(PROPOSALS_BASELINE, stable(result) + '\n');
  console.log(`[golden] proposals-baseline skriven: ${PROPOSALS_BASELINE} (${result.cases.length} förslag)`);
} else {
  compareTo(BASELINE, playGame(), 'mellan');
  const pr = playProposalsCoverage();
  compareTo(PROPOSALS_BASELINE, pr, 'proposals');
  console.log(`[golden] OK — mellan-partiet + ${pr.cases.length} förslag identiska mot baseline.`);
}
