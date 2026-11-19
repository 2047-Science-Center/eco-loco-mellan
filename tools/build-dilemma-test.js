// tools/build-dilemma-test.js — RIKTAT test för spelledarstyrt dilemma MITT i byggfasen (Slice 5).
// Testar motor-beteendet servern förlitar sig på: öppna ett A/B-dilemma under en pågående byggrunda,
// avgöra det (A/B), verkställa effekter, och att året sedan fortsätter normalt. (Auto-paus/blockering
// av bygge/handel + manuell/auto-paus-distinktion är server-glue, verifieras separat.) Exit 1 vid fel.
//
//   node tools/build-dilemma-test.js

import { EcoLoco } from '../spec/engine.js';
import { mockOpponentsVote } from '../spec/mock-opponents.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };

console.log('1) Mitt i byggfasen (runda igång, inget beslut öppet) → openDilemma funkar');
{
  const e = new EcoLoco(); e.start();                 // round 1, byggfas, inget Ö-råd → proposal null
  ok(e.getState().proposal === null, 'byggfas: inget beslut öppet');
  const res = e.openDilemma('koncernerbjudande');
  ok(res.ok, 'openDilemma mitt i byggfasen funkar');
  ok(e.getState().proposal.kind === 'dilemma', 'ett A/B-dilemma är öppet');
}

console.log('2) A/B-röstning avgör + verkställer rätt effekter mitt i rundan');
{
  const e = new EcoLoco(); e.start();
  const ohFore = e.getState().oh, pFore = e.team('aker').pengar;
  e.openDilemma('koncernerbjudande');                 // A: alla +15, ön −6
  e.vote('aker', 'A'); e.vote('skog', 'A'); e.vote('tundra', 'A'); e.vote('stad', 'B');   // 3 A → A
  const S = e.getState();
  ok(S.proposal.resolved && S.proposal.outcome === 'A', 'utfall A');
  ok(e.team('aker').pengar === pFore + 15, 'A-effekt: alla +15 pengar');
  ok(S.oh === ohFore - 6, 'A-effekt: ön −6 öhälsa');
}

console.log('3) Året fortsätter normalt efter dilemmat (bygge + bokslut)');
{
  const e = new EcoLoco(); e.start();
  e.openDilemma('oljefynd');
  mockOpponentsVote(e, []);                            // botar röstar A/B → avgjort
  ok(e.getState().proposal.resolved, 'dilemmat avgjort');
  e.getState().teams.forEach(t => { t.choice = null; e.selectCard(t.id, 'standard'); });   // lagen bygger efter dilemmat
  const before = e.getState().round;
  e.endRound();
  const S = e.getState();
  ok(S.round === before + 1 || S.over, 'bokslut körde → nästa år (eller spelslut) — inget hänger');
}

console.log('4) Ett beslut i taget: inget nytt dilemma medan ett pågår');
{
  const e = new EcoLoco(); e.start();
  ok(e.openDilemma('koncernerbjudande').ok === true, 'första dilemmat öppnas');
  ok(e.openDilemma('oljefynd').ok === false, 'andra avvisas medan ett pågår (skyddar ev. Ö-råd/omröstning)');
}

console.log(fails === 0 ? '\n[build-dilemma] ALLA TESTER OK' : `\n[build-dilemma] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
