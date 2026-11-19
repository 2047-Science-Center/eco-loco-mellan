// tools/dilemma-test.js — RIKTAT test för dilemmabanken + A/B-beslutssystemet (Etapp 2c).
// Verifierar: A/B-röstning, att RÄTT effektlista verkställs per utfall, oavgjort-regel, eligibility,
// att samma dilemma kan köras via Ö-råd (decisionSystem:'dilemma') OCH som spelledarhändelse
// (openDilemma direkt), samt config-gate. Assertions → exit 1 vid fel.
//
//   node tools/dilemma-test.js

import { EcoLoco } from '../spec/engine.js';
import { DILEMMAS, dilemmaById } from '../spec/content/dilemmas.js';

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { console.error(`  ✗ ${msg}`); fails++; } };
const cap = {};
const kap = t => t.pengar + t.material;

// Hjälp: öppna + rösta ett dilemma, returnera {events, state}.
function runDilemma(engine, id, votePattern) {
  const events = [];
  for (const ev of ['dilemmaOpened', 'dilemmaResolved', 'ohalsa']) engine.on(ev, p => events.push({ ev, payload: p }));
  engine.openDilemma(id);
  const S = engine.getState();
  S.teams.forEach((t, i) => engine.vote(t.id, votePattern[i]));
  return { events, S: engine.getState() };
}

console.log('1) Bank-sanity');
{
  ok(DILEMMAS.length >= 3, 'minst 3 exempel-dilemman');
  ok(DILEMMAS.every(d => d.alternativ && d.alternativ.A && d.alternativ.B), 'alla har A + B');
  ok(DILEMMAS.every(d => Array.isArray(d.alternativ.A.effects) && Array.isArray(d.alternativ.B.effects)), 'A/B har effektlistor');
}

console.log('2) Utfall A verkställer A-effekterna (koncernerbjudande: alla +15 pengar, ö −6)');
{
  const e = new EcoLoco(); e.start();
  const oh0 = e.getState().oh, p0 = e.team('aker').pengar;
  const { events, S } = runDilemma(e, 'koncernerbjudande', ['A', 'A', 'A', 'B']);   // 3 A → A vinner
  ok(S.proposal.outcome === 'A', 'utfall A (3 mot 1)');
  ok(e.team('aker').pengar === p0 + 15, 'alla lag +15 pengar');
  ok(S.oh === oh0 - 6, 'öhälsa −6');
  ok(events.some(x => x.ev === 'dilemmaResolved' && x.payload.outcome === 'A'), 'dilemmaResolved med outcome A');
}

console.log('3) Utfall B verkställer B-effekterna (koncernerbjudande B: ö +2, inga pengar)');
{
  const e = new EcoLoco(); e.start();
  const oh0 = e.getState().oh, p0 = e.team('aker').pengar;
  const { S } = runDilemma(e, 'koncernerbjudande', ['B', 'B', 'B', 'A']);   // 3 B → B vinner
  ok(S.proposal.outcome === 'B', 'utfall B');
  ok(e.team('aker').pengar === p0, 'inga pengar ändrade (B saknar resurs-effekt)');
  ok(S.oh === oh0 + 2, 'öhälsa +2');
}

console.log('4) Oavgjort 2–2 → A vinner (preliminär regel)');
{
  const e = new EcoLoco(); e.start();
  const { S } = runDilemma(e, 'koncernerbjudande', ['A', 'A', 'B', 'B']);
  ok(S.proposal.outcome === 'A', '2–2 → A');
}

console.log('5) Eligibility styr dilemma-urvalet (algblomning: ohBelow 45)');
{
  const ids = S => S.decisionChoices.map(c => c.id);   // decisionChoices = [{id, kind}]
  const hi = new EcoLoco({ seed: 1, decisionSystem: 'dilemma', dilemma: { perRound: 10 } }); hi.cfg.ohStart = 50; hi.start();
  const lo = new EcoLoco({ seed: 1, decisionSystem: 'dilemma', dilemma: { perRound: 10 } }); lo.cfg.ohStart = 30; lo.start();
  ok(!ids(hi.getState()).includes('algblomning'), 'öhälsa 50 → algblomning UTE');
  ok(ids(lo.getState()).includes('algblomning'), 'öhälsa 30 → algblomning INNE');
}

console.log('6) Samma dilemma via Ö-råd (auto-urval) OCH som GM-händelse → samma resolution');
{
  // Ö-råd-väg: plocka ett A/B-DILEMMA (kind='dilemma') ur beslutspoolen (som kan innehålla rost-händelser).
  const oracl = new EcoLoco({ seed: 5, decisionSystem: 'dilemma' }); oracl.start();
  const picked = oracl.getState().decisionChoices.find(c => c.kind === 'dilemma')?.id || 'koncernerbjudande';
  ok(oracl._decisionSystem === 'dilemma', 'Ö-råd: decisionSystem=dilemma');
  const rA = runDilemma(oracl, picked, ['A', 'A', 'A', 'B']);
  // GM-väg: vanlig politik-motor (default) men GM aktiverar SAMMA dilemma-id direkt.
  const gm = new EcoLoco(); gm.start();
  ok(gm._decisionSystem === 'politics', 'GM-motor: politik i Ö-rådet (dilemma aktiveras separat)');
  const rB = runDilemma(gm, picked, ['A', 'A', 'A', 'B']);
  ok(rA.S.proposal.outcome === rB.S.proposal.outcome, 'samma utfall oavsett väg');
  ok(rA.S.oh === rB.S.oh, 'samma öhälso-resultat oavsett väg (samma innehållsdefinition)');
}

console.log('7) State-form: politics → proposalChoices, dilemma → decisionChoices');
{
  const pol = new EcoLoco(); pol.start();   // default = politics
  ok(Array.isArray(pol.getState().proposalChoices) && pol.getState().decisionChoices === undefined, 'politics: proposalChoices satt, inga decisionChoices');
  const dil = new EcoLoco({ decisionSystem: 'dilemma', dilemma: { perRound: 1 } }); dil.start();
  ok(Array.isArray(dil.getState().decisionChoices), 'dilemma: decisionChoices satt');
  ok(dil.getState().proposalChoices === undefined, 'dilemma: inga proposalChoices');
}

console.log('8) openDilemma: okänt id / dubbelöppning avvisas');
{
  const e = new EcoLoco(); e.start();
  ok(e.openDilemma('finns-inte').ok === false, 'okänt dilemma avvisas');
  ok(e.openDilemma('koncernerbjudande').ok === true, 'giltigt dilemma öppnas');
  ok(e.openDilemma('oljefynd').ok === false, 'andra dilemmat avvisas medan ett är öppet');
}

console.log(fails === 0 ? '\n[dilemma] ALLA TESTER OK' : `\n[dilemma] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
