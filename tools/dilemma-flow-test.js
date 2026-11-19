// tools/dilemma-flow-test.js — RIKTAT test för Flash dilemma-Ö-råd-FLÖDET (Etapp 3b, Slice 4).
// Speglar det servern orkestrerar, på motor/bot-nivå: decisionSystem-routing → auto-draget dilemma
// vid Ö-rådet → A/B-röstning (botar via mockOpponentsVote) → verkställt utfall. Exit 1 vid fel.
//
//   node tools/dilemma-flow-test.js

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { mockOpponentsVote } from '../spec/mock-opponents.js';
import { dilemmaById } from '../spec/content/dilemmas.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };

// Spela ett år (alla bygger standard, bokslut) → motorn stegar till nästa år + rullar Ö-rådets beslut.
function playYear(e) { e.getState().teams.forEach(t => e.selectCard(t.id, 'standard')); e.endRound(); }

console.log('1) decisionSystem-routing: Flash drar dilemma, Mellan drar förslag');
{
  const flash = new EcoLoco({ seed: 7, ...VARIANTS.flash, autoEventAtStart: false }); flash.start(); playYear(flash);
  ok(flash._decisionSystem === 'dilemma', 'Flash: decisionSystem=dilemma');
  ok(Array.isArray(flash.getState().decisionChoices) && flash.getState().decisionChoices.length >= 1, 'Flash: decisionChoices satt vid Ö-rådet');
  ok(flash.getState().proposalChoices === undefined, 'Flash: inga proposalChoices (använder ej politikbanken)');

  const mellan = new EcoLoco({ seed: 7, ...VARIANTS.mellan, autoEventAtStart: false }); mellan.start(); playYear(mellan);
  ok(mellan._decisionSystem === 'politics', 'Mellan: decisionSystem=politics');
  ok(Array.isArray(mellan.getState().proposalChoices), 'Mellan: proposalChoices satt');
  ok(mellan.getState().decisionChoices === undefined, 'Mellan: inga decisionChoices');
}

console.log('2) Flash Ö-råd: auto-draget dilemma → bot-A/B-röstning → verkställt + event');
{
  const e = new EcoLoco({ seed: 11, ...VARIANTS.flash, autoEventAtStart: false }); e.start(); playYear(e);
  const events = [];
  for (const ev of ['dilemmaOpened', 'dilemmaResolved', 'ohalsa']) e.on(ev, p => events.push({ ev, payload: p }));
  const id = 'oljefynd';                         // ett känt A/B-dilemma (poolen kan annars ge en rost-händelse)
  const ohFore = e.getState().oh;
  const res = e.openOradDecision({ id, kind: 'dilemma' });   // servern gör detta i startDilemma()
  ok(res.ok, `openOradDecision('${id}') ok`);
  ok(events.some(x => x.ev === 'dilemmaOpened'), 'dilemmaOpened emitterat (relläs av servern)');
  mockOpponentsVote(e, []);                       // alla lag = botar → A/B-röstning (som serverns forceDilemmaVotes)
  const S = e.getState();
  ok(S.proposal.resolved, 'alla röstade → dilemmat avgjort');
  ok(['A', 'B'].includes(S.proposal.outcome), `utfall satt (${S.proposal.outcome})`);
  const resolved = events.find(x => x.ev === 'dilemmaResolved');
  ok(resolved && resolved.payload.outcome === S.proposal.outcome, 'dilemmaResolved med rätt utfall');
  ok(resolved.payload.aCount + resolved.payload.bCount === 4, 'alla fyra lags röster räknade');
  // rätt effektlista verkställd: öhälsan rörde sig åt det vinnande alternativets håll
  const alt = dilemmaById(id).alternativ[S.proposal.outcome];
  const altOh = (alt.effects || []).reduce((s, f) => s + (f.type === 'ohalsa' ? (f.value || 0) : 0), 0);
  if (altOh !== 0) ok(Math.sign(S.oh - ohFore) === Math.sign(altOh), `öhälsa följde vinnande alternativets effekt (${ohFore}→${S.oh}, alt-oh ${altOh})`);
  else ok(true, 'vinnande alternativ saknar öhälso-effekt (inget att verifiera)');
}

console.log('3) Botar klarar BÅDE A/B (dilemma) och ja/nej (politik) via samma väg');
{
  const flash = new EcoLoco({ seed: 2, ...VARIANTS.flash, autoEventAtStart: false }); flash.start(); playYear(flash);
  const dc = flash.getState().decisionChoices.find(c => c.kind === 'dilemma') || { id: 'koncernerbjudande', kind: 'dilemma' };
  flash.openOradDecision(dc);
  mockOpponentsVote(flash, []);
  ok(['A', 'B'].includes(flash.getState().proposal.outcome), 'dilemma: botar gav A/B');

  const mellan = new EcoLoco({ seed: 2, ...VARIANTS.mellan, autoEventAtStart: false }); mellan.start(); playYear(mellan);
  const S = mellan.getState();
  mellan.openProposal(S.proposalChoices[0], S.powerTeam || S.teams[0].id);
  mockOpponentsVote(mellan, []);
  ok(mellan.getState().proposal.resolved, 'politik: botar gav ja/nej → avgjort');
}

console.log(fails === 0 ? '\n[dilemma-flow] ALLA TESTER OK' : `\n[dilemma-flow] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
