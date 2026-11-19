// tools/company-event-test.js — Tester för prestationsbaserade företagshändelser (company-events.js).
// Verifierar de fem triggarna, en-gång-per-spel, köhantering, versionsgating och samspel med
// miljökriserna. Exit 1 vid fel.
//
//   node tools/company-event-test.js
//
// OBS om testdesign: UPPROR triggas av att ett lag är ≥30 kapital rikare än näst rikaste. För att
// isolera de ÖVRIGA triggarna håller vi därför alla fyra lag lika rika (allEqual) så uppror inte
// bullrar in. drainQueue() speglar servern som resolvar varje köad händelse efter sin 10 s-visning.

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };

function eng(opts = {}) {
  return new EcoLoco({ seed: 7, ...VARIANTS.mellan, autoEventAtStart: false, ...opts });
}
// Alla lag lika rika → ingen uppror-marginal (isolerar bygg-triggarna).
function allEqual(e, n = 120) { e.getState().teams.forEach(t => { t.pengar = n; t.material = n; }); }
// Resolvar hela företagshändelse-kön (som servern efter 10 s/händelse).
function drainQueue(e) { let g = 0; while (e.getState().activeCompanyEvent && g++ < 30) e.companyEventResolved(); }
const got = (evs, id) => evs.find(x => x.id === id);

console.log('1) GRÖNA FONDEN: 3 gröna byggnader totalt → +5 pengar, 0 öhälsa');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron');
  drainQueue(e);
  const gf = got(evs, 'gronafonden');
  ok(gf, 'gronafonden utlöst vid 3 gröna');
  ok(gf && gf.dPengar === 5 && !gf.dMaterial, '+5 pengar');
  ok(gf && gf.ohalsa === 0, '0 öhälsa');
}

console.log('2) EXPANSION: 3 byggen samma år → +5 huvudresurs; nollställs vid årsskifte');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('aker', 'standard'); e.selectCard('aker', 'standard');
  drainQueue(e);
  ok(!got(evs, 'expansion'), 'ingen expansion vid 2 byggen');
  e.selectCard('aker', 'standard');  // 3:e samma år
  drainQueue(e);
  const ex = got(evs, 'expansion');
  ok(ex, 'expansion vid 3:e bygget samma år');
  ok(ex && ex.dMaterial === 5 && !ex.dPengar, 'aker (material-sektor): +5 material');

  // Avsluta året → _builtThisYear nollas → 3 nya byggen ger INGEN ny expansion (en gång/spel).
  e.getState().teams.forEach(t => e.selectCard(t.id, 'standard'));
  e.endRound();
  ok(e.team('aker')._builtThisYear === 0, '_builtThisYear nollställt vid årsskifte');
  allEqual(e);
  e.selectCard('aker', 'standard'); e.selectCard('aker', 'standard'); e.selectCard('aker', 'standard');
  drainQueue(e);
  ok(evs.filter(x => x.id === 'expansion').length === 1, 'expansion bara en gång/spel');
}

console.log('3) EXPANSION: Räven (pengar-sektor) får +5 pengar');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('tundra', 'standard'); e.selectCard('tundra', 'standard'); e.selectCard('tundra', 'standard');
  drainQueue(e);
  const ex = got(evs, 'expansion');
  ok(ex && ex.dPengar === 5 && !ex.dMaterial, 'tundra (pengar-sektor): +5 pengar');
}

console.log('4) GRÖN OMSTÄLLNING: ≥2 skadliga först, sedan 2 gröna i rad (ej sist) → +5 pengar');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('skog', 'smutsig'); e.selectCard('skog', 'smutsig');  // dirtyBuilt=2 (impactNeg -12 → kris)
  drainQueue(e);
  e.selectCard('skog', 'gron');     // grön #1
  // Håll skog INTE sist (stad permanent fattigast) och topp-lagen lika → ingen uppror-marginal.
  e.team('aker').pengar = 120; e.team('aker').material = 120;
  e.team('tundra').pengar = 120; e.team('tundra').material = 120;
  e.team('skog').pengar = 120; e.team('skog').material = 120;
  e.team('stad').pengar = 5; e.team('stad').material = 5;   // ensam sist → skog kan ej vara sist
  e.selectCard('skog', 'gron');     // grön #2 → GRÖN OMSTÄLLNING (ej sist)
  drainQueue(e);
  const go = got(evs, 'gronomstallning');
  ok(go, 'grön omställning utlöst (2 skadliga + 2 gröna i rad, ej sist)');
  ok(go && go.dPengar === 5, '+5 pengar');
}

console.log('5) GRÖN OMSTÄLLNING kräver ≥2 skadliga FÖRE sviten');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('aker', 'gron'); allEqual(e); e.selectCard('aker', 'gron');  // 2 gröna, inga skadliga
  drainQueue(e);
  ok(!got(evs, 'gronomstallning'), 'ingen grön omställning utan 2 skadliga först');
}

console.log('6) FRAMTIDSVISIONÄR: sist i resurser + 2 gröna i rad → +5/+5, prioriteras över omställning');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('stad', 'smutsig'); e.selectCard('stad', 'smutsig');  // dirtyBuilt=2 (kris)
  drainQueue(e);
  e.selectCard('stad', 'gron');     // grön #1
  // Gör stad ENSAM sist men med råd för grön #2 (cost 10/14). Andra rika, lika → ingen uppror.
  e.team('aker').pengar = 120; e.team('aker').material = 120;
  e.team('skog').pengar = 120; e.team('skog').material = 120;
  e.team('tundra').pengar = 120; e.team('tundra').material = 120;
  e.team('stad').pengar = 14; e.team('stad').material = 16;   // sist, men har råd
  e.selectCard('stad', 'gron');     // grön #2 → FRAMTIDSVISIONÄR (sist, prioriteras)
  drainQueue(e);
  const fv = got(evs, 'framtidsvisionar');
  ok(fv, 'framtidsvisionär utlöst (sist i resurser)');
  ok(fv && fv.dPengar === 5 && fv.dMaterial === 5, '+5 pengar och +5 material');
  ok(!got(evs, 'gronomstallning'), 'grön omställning INTE förbrukad samtidigt (prioritet framtidsvisionär)');
}

console.log('7) UPPROR: rikaste betydligt rikare → −15 pengar, −10 material, −3 öhälsa');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.team('aker').pengar = 120; e.team('aker').material = 120;   // 240
  e.team('skog').pengar = 20; e.team('skog').material = 20;     // 40
  e.team('tundra').pengar = 20; e.team('tundra').material = 20;
  e.team('stad').pengar = 20; e.team('stad').material = 20;
  e.selectCard('skog', 'standard');   // trigga koll via ett bygge (ej aker)
  drainQueue(e);
  const up = got(evs, 'uppror');
  ok(up, 'uppror utlöst när ett lag är betydligt rikare');
  ok(up && up.teamId === 'aker', 'rikaste laget (aker) drabbas');
  ok(up && up.dPengar === -15 && up.dMaterial === -10, '−15 pengar, −10 material');
  ok(up && up.ohalsa === -3, '−3 öhälsa');
}

console.log('8) UPPROR triggas INTE vid liten resursskillnad');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.team('aker').pengar = 40; e.team('aker').material = 40;   // 80 vs 70 → marginal 10 < 30
  e.selectCard('skog', 'standard');
  drainQueue(e);
  ok(!got(evs, 'uppror'), 'inget uppror vid marginal 10');
}

console.log('9) Varje prestationshändelse högst en gång per spel');
{
  const e = eng(); e.start(); allEqual(e, 300);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron');
  drainQueue(e);
  e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron');
  drainQueue(e);
  ok(evs.filter(x => x.id === 'gronafonden').length === 1, 'gronafonden bara en gång');
}

console.log('10) Flera händelser köas (en i taget)');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron');
  drainQueue(e);
  e.selectCard('aker', 'gron');  // 3:e grön: gronafonden + (streak=3, aker sist → framtidsvisionär)
  ok(e.getState().activeCompanyEvent !== null, 'en händelse aktiv efter trippel-grön');
  const queuedNow = e.getState().companyEventQueue.length;
  ok(queuedNow >= 1, `fler händelser köade bakom den aktiva (${queuedNow})`);
  drainQueue(e);
  ok(e.getState().activeCompanyEvent === null, 'kön tömd efter resolve');
  ok(got(evs, 'gronafonden') && got(evs, 'framtidsvisionar'), 'båda samtidiga händelser hanterades');
}

console.log('11) Byggnadernas miljöpåverkan är oförändrad');
{
  const e = eng(); e.start(); allEqual(e);
  const t = e.team('aker');
  e.selectCard('aker', 'gron');  // grön = +3 impact
  ok(t.impactPos === 3, 'grön byggnad ger +3 impactPos (oförändrat)');
  ok(t.gronBuilt === 1 && t._gronStreak === 1, 'grön-räknare uppdaterad');
}

console.log('12) Grön-svit bryts av skadlig byggnad');
{
  const e = eng(); e.start(); allEqual(e, 300);
  const t = e.team('aker');
  e.selectCard('aker', 'gron');     ok(t._gronStreak === 1, 'streak=1 efter grön');
  e.selectCard('aker', 'smutsig');  ok(t._gronStreak === 0, 'streak=0 efter skadlig');
  e.selectCard('aker', 'gron');     ok(t._gronStreak === 1, 'streak=1 (sviten startade om)');
}

console.log('12b) GEMENSAM SATSNING: alla fyra bygger ≥1 grön/år → alla +5 huvudresurs');
{
  const e = eng(); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  const kapFore = {};
  e.getState().teams.forEach(t => kapFore[t.id] = { p: t.pengar, m: t.material });
  e.selectCard('aker', 'gron'); e.selectCard('skog', 'gron'); e.selectCard('tundra', 'gron');
  ok(!got(evs, 'gemensamsatsning'), 'ingen gemensam satsning efter 3 lag');
  e.selectCard('stad', 'gron');   // fjärde laget → GEMENSAM SATSNING
  drainQueue(e);
  const gs = got(evs, 'gemensamsatsning');
  ok(gs, 'gemensam satsning utlöst när alla fyra byggt grönt');
  ok(gs && gs.teams && gs.teams.length === 4, 'alla fyra lag i effekten');
  // Oxen/Björnen (material-sektor) +5 material; Räven/Örnen (pengar-sektor) +5 pengar
  const byId = Object.fromEntries((gs?.teams || []).map(r => [r.teamId, r]));
  ok(byId.aker && byId.aker.dMaterial === 5 && !byId.aker.dPengar, 'Oxen +5 material');
  ok(byId.tundra && byId.tundra.dPengar === 5 && !byId.tundra.dMaterial, 'Räven +5 pengar');
  ok(gs && gs.ohalsa === 0, '0 öhälsa');
}

console.log('12c) GEMENSAM SATSNING: bara en gång/spel; nollställs ej mitt i år');
{
  const e = eng(); e.start(); allEqual(e, 300);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().teams.forEach(t => e.selectCard(t.id, 'gron'));  // alla grönt år 1 → gemensam
  drainQueue(e);
  ok(evs.filter(x => x.id === 'gemensamsatsning').length === 1, 'en gemensam satsning år 1');
  // nytt år: alla bygger grönt igen → ingen ny (en gång/spel)
  e.endRound(); allEqual(e, 300);
  e.getState().teams.forEach(t => e.selectCard(t.id, 'gron'));
  drainQueue(e);
  ok(evs.filter(x => x.id === 'gemensamsatsning').length === 1, 'ingen andra gemensam satsning (en gång/spel)');
}

console.log('13) Flash får INGA prestationshändelser');
{
  const e = new EcoLoco({ seed: 7, ...VARIANTS.flash, autoEventAtStart: false }); e.start(); allEqual(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron'); e.selectCard('aker', 'gron');
  e.team('aker').pengar = 400; e.team('aker').material = 400;  // stenrik → skulle trigga uppror om på
  e.selectCard('skog', 'standard');
  ok(evs.length === 0, 'Flash: inga företagshändelser (varken kris eller prestation)');
}

// (Tidigare block 14 testade det borttagna fullt slumpade eventPool-filtret — gronafonden/uppror
//  utlöses nu av sina prestationstriggers, se blocken ovan. Det gamla slumpsystemet togs bort 2026-11-19.)

console.log('15) Miljökriser fungerar fortfarande med companyEvents på (nya regler: −15 från år 2)');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  const t = e.team('aker'); t.pengar = 50; t.material = 50;   // råd + fattig nog → inget uppror-brus
  e.selectCard('aker', 'smutsig'); e.selectCard('aker', 'smutsig'); e.selectCard('aker', 'smutsig');  // −18 (≤ −15), men år 1
  drainQueue(e);
  ok(!got(evs, 'aker_minor'), 'ingen kris år 1 (årskrav 2)');
  e.endRound(); drainQueue(e);                                  // → år 2
  e.fireDueCrises(); drainQueue(e);                             // väntande minor köas vid byggfasens start
  ok(got(evs, 'aker_minor'), 'miljökris aker_minor triggas år 2 (−18) även med companyEvents på');
}

console.log(fails === 0 ? '\n[company-event] ALLA TESTER OK' : `\n[company-event] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
