// tools/gm-event-test.js — Tester för de fyra direkta GM-händelserna + GM-aktivering av befintliga
// dilemman/omröstningar. Verifierar effekter, en-gång-per-spel, fattigast-urval och att Flash Ö-råd
// inte påverkas. Exit 1 vid fel.
//
//   node tools/gm-event-test.js

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { mockOpponentsVote } from '../spec/mock-opponents.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };

function eng(variant = 'mellan') {
  return new EcoLoco({ seed: 7, ...VARIANTS[variant], autoEventAtStart: false });
}
function setRes(e, id, p, m) { const t = e.team(id); t.pengar = p; t.material = m; }
function drain(e) { let g = 0; while (e.getState().activeCompanyEvent && g++ < 20) e.companyEventResolved(); }
const byId = ev => Object.fromEntries((ev.teams || []).map(r => [r.teamId, r]));

console.log('1) MARKNADSKRASCH: endast Tundra + Stad −10 pengar, Åker/Skog oförändrade');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().teams.forEach(t => { t.pengar = 40; t.material = 40; });
  ok(e.fireGmEvent('gm_marknadskrasch').ok, 'kördes');
  const b = byId(evs[0]);
  ok(b.tundra.dPengar === -10 && b.stad.dPengar === -10, 'Tundra + Stad −10 pengar');
  ok(!b.aker && !b.skog, 'Åker/Skog inte med (asymmetriskt, avsiktligt)');
  ok(evs[0].ohalsa === 0, 'ingen öhälsoförändring');
  drain(e);
  ok(e.team('tundra').pengar === 30 && e.team('aker').pengar === 40, 'rätt resurser efter verkställning');
}

console.log('2) LEVERANSSTOPP: alla fyra −5 material, inga pengar');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.fireGmEvent('gm_leveransstopp');
  const b = byId(evs[0]);
  ok(['aker', 'skog', 'tundra', 'stad'].every(id => b[id].dMaterial === -5), 'alla −5 material');
  ok(['aker', 'skog', 'tundra', 'stad'].every(id => !b[id].dPengar), 'inga pengar påverkade');
}

console.log('3) BRA SKÖRD: alla fyra +8 material (ingen betalar ur eget förråd)');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().teams.forEach(t => { t.material = 20; });
  e.fireGmEvent('gm_braskord');
  const b = byId(evs[0]);
  ok(['aker', 'skog', 'tundra', 'stad'].every(id => b[id].dMaterial === 8), 'alla +8 material');
  drain(e);
  ok(e.getState().teams.every(t => t.material === 28), 'alla fick +8 (Oxen betalar inget själv)');
}

console.log('4) EKONOMISKT STÖD: fattigaste laget +10/+10');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  setRes(e, 'aker', 50, 50); setRes(e, 'skog', 50, 50); setRes(e, 'tundra', 50, 50);
  setRes(e, 'stad', 3, 2);   // stad fattigast (5)
  e.fireGmEvent('gm_ekonomisktstod');
  const b = byId(evs[0]);
  ok(b.stad && b.stad.dPengar === 10 && b.stad.dMaterial === 10, 'stad (fattigast) +10/+10');
  ok(Object.keys(b).length === 1, 'bara ett lag får stödet');
}

console.log('5) EKONOMISKT STÖD: deterministisk tie-break vid lika resurser (AREAS-ordning)');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().teams.forEach(t => { t.pengar = 10; t.material = 10; });   // alla lika (20)
  e.fireGmEvent('gm_ekonomisktstod');
  const b = byId(evs[0]);
  ok(b.aker, 'vid lika resurser → första i AREAS-ordning (Oxen/aker)');
}

console.log('6) Varje GM-händelse högst en gång per spel');
{
  const e = eng(); e.start();
  ok(e.fireGmEvent('gm_braskord').ok, 'första gången ok');
  e.companyEventResolved();
  ok(!e.fireGmEvent('gm_braskord').ok, 'andra gången avvisad');
}

console.log('7) Ingen resurs blir negativ');
{
  const e = eng(); e.start();
  e.getState().teams.forEach(t => { t.pengar = 2; t.material = 2; });
  e.fireGmEvent('gm_leveransstopp');   // −5 material på 2 → golv 0
  drain(e);
  ok(e.getState().teams.every(t => t.material === 0 && t.pengar === 2), 'material golvat vid 0, inga negativa');
}

console.log('8) GM kan aktivera befintligt dilemma (A/B) + en gång/spel');
{
  const e = eng(); e.start();
  ok(e.gmOpenDecision({ id: 'oljefynd', kind: 'dilemma' }).ok, 'dilemma öppnat');
  mockOpponentsVote(e, []);
  ok(['A', 'B'].includes(e.getState().proposal.outcome), 'A/B-utfall');
  ok(e.getState().gmDecisionsUsed.includes('oljefynd'), 'registrerat som använt');
  ok(!e.gmOpenDecision({ id: 'oljefynd', kind: 'dilemma' }).ok, 'kan inte aktiveras igen');
}

console.log('9) GM kan aktivera SPONSRAT (individuell ja/nej-omröstning)');
{
  const e = eng(); e.start();
  const r = e.gmOpenDecision({ id: 'sponsrat', kind: 'event' });
  ok(r.ok, 'sponsrat öppnat som omröstning');
  ok(e.getState().proposal && e.getState().proposal.type === 'event', 'proposal type=event (rost)');
  mockOpponentsVote(e, []);
  ok(e.getState().proposal.resolved, 'sponsrat avgjort via röstning');
}

console.log('10) GM slumpval öppnar ett ej-använt beslut (ingen autonom slump)');
{
  const e = eng(); e.start();
  const pick = e.gmPickRandomDecision(() => 0);   // deterministisk: första i poolen
  ok(pick && pick.id, `slumpade fram '${pick?.id}' (${pick?.kind})`);
  ok(e.gmOpenDecision(pick).ok, 'öppnades');
  // slumpen levererar aldrig ett redan använt beslut
  const pool = e._decisionPool().filter(p => !e.getState().gmDecisionsUsed.includes(p.id));
  ok(pool.every(p => p.id !== pick.id), 'använt beslut utesluts ur framtida slump');
}

console.log('11) Flash Ö-råd + sponsrat oförändrat (GM-funktionen påverkar inte Flash-urvalet)');
{
  const e = new EcoLoco({ seed: 11, ...VARIANTS.flash, autoEventAtStart: false }); e.start();
  e.getState().teams.forEach(t => e.selectCard(t.id, 'standard')); e.endRound();
  ok(Array.isArray(e.getState().decisionChoices), 'Flash har sitt egna decisionChoices-urval');
  ok(e.getState().gmDecisionsUsed.length === 0, 'Flash rör inte GM-historiken');
  const res = e.openOradDecision(e.getState().decisionChoices[0]);
  ok(res.ok, 'Flash Ö-råd öppnar sitt beslut som förr');
}

console.log('12) GM-direkthändelser gatas INTE av variant (fungerar även om anropad i Flash-motor)');
{
  // fireGmEvent är versionsneutral (GM-läge styrs av servern, inte motor-features)
  const e = new EcoLoco({ seed: 7, ...VARIANTS.flash, autoEventAtStart: false }); e.start();
  ok(e.fireGmEvent('gm_braskord').ok, 'fireGmEvent fungerar på motor-nivå (servern gatar på gmMode)');
}

console.log(fails === 0 ? '\n[gm-event] ALLA TESTER OK' : `\n[gm-event] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
