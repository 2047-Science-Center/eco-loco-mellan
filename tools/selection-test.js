// tools/selection-test.js — RIKTAT test för det config-styrda förslagsurvalet (Etapp 2b–B).
// Verifierar kvoter, eligibility, dubbletter, seedad reproducerbarhet, bank-ordnings-oberoende,
// varning vid otillräckligt antal, samt motor-integration. Assertions → exit 1 vid fel.
//
//   node tools/selection-test.js
//
// (Detta är INGEN golden-baseline. Det nya urvalet är en avsiktlig beteendeförändring; de gamla
//  golden-baselines behålls orörda som historisk referens och legacy-regression.)

import { PROPOSALS, proposalById } from '../spec/content/proposals.js';
import { selectProposals, proposalEligible, makeRng } from '../spec/systems/proposal-selector.js';
import { EcoLoco } from '../spec/engine.js';

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { console.error(`  ✗ ${msg}`); fails++; } };
const uniq = a => new Set(a).size === a.length;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cfg = { krisProposalOh: 20 };
const elig = (oh) => (p => proposalEligible(p, { oh, cfg }));

console.log('1) Utan kvoter: N slumpas ur hela banken');
{
  const { chosen, warnings } = selectProposals(PROPOSALS, { proposalCount: 5 }, { isEligible: elig(50), rng: makeRng(1) });
  ok(chosen.length === 5, '5 förslag valda');
  ok(uniq(chosen), 'inga dubbletter');
  ok(warnings.length === 0, 'inga varningar');
  ok(chosen.every(id => proposalById(id)), 'alla valda finns i banken');
}

console.log('2) Seedad reproducerbarhet + variation mellan seeds');
{
  const a = selectProposals(PROPOSALS, { proposalCount: 5 }, { isEligible: elig(50), rng: makeRng(42) }).chosen;
  const b = selectProposals(PROPOSALS, { proposalCount: 5 }, { isEligible: elig(50), rng: makeRng(42) }).chosen;
  const c = selectProposals(PROPOSALS, { proposalCount: 5 }, { isEligible: elig(50), rng: makeRng(43) }).chosen;
  ok(eq(a, b), 'samma seed → identiskt urval (ordning med)');
  ok(!eq(a, c), 'annan seed → annat urval');
}

console.log('3) Bank-ordnings-oberoende');
{
  const shuffledBank = [...PROPOSALS].reverse();
  const a = selectProposals(PROPOSALS, { proposalCount: 6 }, { isEligible: elig(50), rng: makeRng(7) }).chosen;
  const b = selectProposals(shuffledBank, { proposalCount: 6 }, { isEligible: elig(50), rng: makeRng(7) }).chosen;
  ok(eq([...a].sort(), [...b].sort()), 'samma mängd oavsett bankens ordning');
  ok(eq(a, b), 'samma ordning oavsett bankens ordning (kanon-sortering + seed)');
}

console.log('4) Kvoter per kategori + slumpfyllnad');
{
  const { chosen, warnings } = selectProposals(PROPOSALS,
    { proposalCount: 5, quotas: { cooperation: 2, future: 1 }, fillRemaining: 'random' },
    { isEligible: elig(50), rng: makeRng(5) });
  const cats = chosen.map(id => proposalById(id).category);
  ok(chosen.length === 5, '5 totalt');
  ok(uniq(chosen), 'inga dubbletter över kvot + fyllnad');
  ok(cats.filter(c => c === 'cooperation').length >= 2, 'minst 2 cooperation (kvot)');
  ok(cats.filter(c => c === 'future').length >= 1, 'minst 1 future (kvot)');
  ok(warnings.length === 0, 'inga varningar');
}

console.log('5) Eligibility: krispaket bara när öhälsa < krisProposalOh');
{
  const hi = selectProposals(PROPOSALS, { proposalCount: 15 }, { isEligible: elig(50), rng: makeRng(9) }).chosen;
  const lo = selectProposals(PROPOSALS, { proposalCount: 15 }, { isEligible: elig(10), rng: makeRng(9) }).chosen;
  ok(!hi.includes('krispaket'), 'öhälsa 50 → krispaket UTE (ej eligible)');
  ok(lo.includes('krispaket'), 'öhälsa 10 → krispaket INNE (eligible)');
  ok(hi.length === 14 && lo.length === 15, 'poolstorlek speglar eligibility (14 vs 15 av 15-banken)');
}

console.log('6) Tydlig varning vid otillräckligt antal');
{
  const { chosen, warnings } = selectProposals(PROPOSALS,
    { proposalCount: 3, quotas: { future: 5 } },       // bara 2 future finns
    { isEligible: elig(50), rng: makeRng(2) });
  ok(warnings.some(w => w.includes('future')), 'varning om att future-kvoten inte kan fyllas');
  ok(uniq(chosen), 'fortfarande inga dubbletter');
}

console.log('7) Taggfilter (whitelist)');
{
  const { chosen } = selectProposals(PROPOSALS, { proposalCount: 4, tags: ['crisis'] }, { isEligible: elig(10), rng: makeRng(3) });
  ok(chosen.every(id => (proposalById(id).tags || []).includes('crisis')), 'bara förslag med taggen crisis');
}

console.log('8) Motor-integration: config-styrt urval + reproducerbarhet per runda');
{
  // Slice 6B: en naken motor har default-urval (ingen legacy) → proposalChoices satt.
  const bare = new EcoLoco();
  bare.start();
  ok(Array.isArray(bare.getState().proposalChoices) && bare.getState().proposalChoices.length === 5, 'naken motor: default-urval ger 5 förslag (inget legacy)');

  const a = new EcoLoco({ seed: 123, politics: { proposalCount: 5 } }); a.start();
  const b = new EcoLoco({ seed: 123, politics: { proposalCount: 5 } }); b.start();
  ok(Array.isArray(a.getState().proposalChoices) && a.getState().proposalChoices.length === 5, 'S.proposalChoices satt med 5 förslag');
  ok(eq(a.getState().proposalChoices, b.getState().proposalChoices), 'samma seed+runda → samma urval i motorn');
  // grund-3 har ingen särskild status: _proposalAllowed styrs av urvalet
  const picks = a.getState().proposalChoices;
  ok(a._proposalAllowed(picks[0]) === true, 'valt förslag är tillåtet');
  const notPicked = PROPOSALS.map(p => p.id).find(id => !picks.includes(id));
  ok(a._proposalAllowed(notPicked) === false, 'ovalt förslag INTE tillåtet (även om det är grund-3)');
}

console.log(fails === 0 ? '\n[selection] ALLA TESTER OK' : `\n[selection] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
