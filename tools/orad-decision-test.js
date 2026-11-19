// tools/orad-decision-test.js — RIKTAT test för Flashs KOMBINERADE beslutspool (Slice 4b).
// A/B-dilemman (dilemmas.js) + individuella 'rost'-händelser (events.js) i samma urval. Verifierar:
// att sponsrat kan dras, ger sina EXAKTA individuella konsekvenser (ja-röstare +15, ön −6), att
// beslutet avgörs korrekt (så året kan fortsätta), och att samma beslut undviks två år i rad. Exit 1 vid fel.
//
//   node tools/orad-decision-test.js

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { EVENTS } from '../spec/content/events.js';
import { mockOpponentsVote } from '../spec/mock-opponents.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const playYear = e => { e.getState().teams.forEach(t => e.selectCard(t.id, 'standard')); e.endRound(); };
const rostIds = EVENTS.filter(e => e.typ === 'rost').map(e => e.id);

console.log('1) Kombinerad pool: både dilemman OCH rost-händelser kan dras');
{
  const e = new EcoLoco({ decisionSystem: 'dilemma', dilemma: { perRound: 99 } }); e.start();
  const kinds = new Set(e.getState().decisionChoices.map(c => c.kind));
  const ids = e.getState().decisionChoices.map(c => c.id);
  ok(kinds.has('dilemma') && kinds.has('event'), 'poolen innehåller både dilemma- och event-beslut');
  ok(rostIds.every(id => ids.includes(id)), `alla rost-händelser ingår automatiskt (${rostIds.join(', ')})`);
  ok(!EVENTS.filter(e => e.typ === 'auto').some(e => ids.includes(e.id)), 'auto-händelser ingår INTE (bara rost)');
}

console.log('2) sponsrat via Ö-rådet → EXAKT individuella konsekvenser (ja-röstare +15, ön −6)');
{
  const e = new EcoLoco({ decisionSystem: 'dilemma' }); e.start();
  const ohFore = e.getState().oh;
  const pengarFore = Object.fromEntries(e.getState().teams.map(t => [t.id, t.pengar]));
  const res = e.openOradDecision({ id: 'sponsrat', kind: 'event' });
  ok(res.ok && res.kind === 'event', 'openOradDecision(sponsrat) → event-väg');
  const p = e.getState().proposal;
  ok(p && p.type === 'event' && !p.resolved, "öppnar individuell ja/nej (proposal type:'event')");
  // aker + skog röstar JA, tundra + stad NEJ
  e.vote('aker', true); e.vote('skog', true); e.vote('tundra', false); e.vote('stad', false);
  const S = e.getState();
  ok(S.proposal.resolved, 'avgjort när alla röstat → året kan fortsätta');
  ok(e.team('aker').pengar === pengarFore.aker + 15, 'JA-röstare aker +15 pengar');
  ok(e.team('skog').pengar === pengarFore.skog + 15, 'JA-röstare skog +15 pengar');
  ok(e.team('tundra').pengar === pengarFore.tundra, 'NEJ-röstare tundra oförändrad');
  ok(e.team('stad').pengar === pengarFore.stad, 'NEJ-röstare stad oförändrad');
  ok(S.oh === ohFore - 6, 'ön −6 öhälsa (minst ett ja)');
}

console.log('3) sponsrat: inget ja → inga pengar, ingen öhälso-smäll (konsekvens bevarad)');
{
  const e = new EcoLoco({ decisionSystem: 'dilemma' }); e.start();
  const ohFore = e.getState().oh;
  e.openOradDecision({ id: 'sponsrat', kind: 'event' });
  e.getState().teams.forEach(t => e.vote(t.id, false));   // alla nej
  ok(e.getState().oh === ohFore, 'ingen nappade → öhälsa oförändrad');
}

console.log('4) Botar klarar rost-händelsen (ja/nej) via samma väg som dilemman');
{
  const e = new EcoLoco({ decisionSystem: 'dilemma' }); e.start();
  e.openOradDecision({ id: 'sponsrat', kind: 'event' });
  mockOpponentsVote(e, []);                                 // alla lag botar
  ok(e.getState().proposal.resolved, 'botar röstade ja/nej → avgjort');
}

console.log('5) Undvik samma beslut två år i rad (perRound 1)');
{
  // Enhetsnivå: rulla beslutet upprepat (fejka årsbyte via round++) utan att spela år → inget
  // event-/öhälso-brus (annars varierar Math.random i _drawEvent urvalet mellan körningar).
  const e = new EcoLoco({ seed: 9, decisionSystem: 'dilemma', dilemma: { perRound: 1 } }); e.start();
  const seq = [];
  for (let r = 0; r < 6; r++) { seq.push(e.getState().decisionChoices[0].id); e.getState().round++; e._rollRoundDecisions(); }
  let repeats = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) repeats++;
  ok(repeats === 0, `inga upprepningar i rad (${seq.join(' → ')})`);
}

console.log('6) Tillåt upprepning om inget annat giltigt alternativ finns');
{
  // Taggfilter 'crisis' → bara algblomning matchar (enda crisis-taggade). Enda giltiga → måste upprepas.
  const e = new EcoLoco({ seed: 1, decisionSystem: 'dilemma', dilemma: { perRound: 1, selection: { tags: ['crisis'] } } });
  e.cfg.ohStart = 10; e.start();
  const a = e.getState().decisionChoices[0]?.id;
  e.getState().round++; e._rollRoundDecisions();
  const b = e.getState().decisionChoices[0]?.id;
  ok(a === 'algblomning' && a === b, `enda giltiga alternativet upprepas (${a} → ${b})`);
}

console.log(fails === 0 ? '\n[orad-decision] ALLA TESTER OK' : `\n[orad-decision] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
