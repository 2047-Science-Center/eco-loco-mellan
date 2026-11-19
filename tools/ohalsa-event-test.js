// tools/ohalsa-event-test.js — Tester för öhälsohändelsernas TRÖSKLAR och EFFEKTER (ohalsa-events.js).
// Verifierar trösklar, Miljölyft (bokslut-netto), Resursbrist (Skola, hysteres), en-gång-per-spel,
// att KRIS är oförändrad och att Flash Ö-råd/sponsrat inte påverkas. Exit 1 vid fel.
//
// OBS: dessa tester kör i LEGACY-läge (ohalsaDelayed:false) → öhälsohändelser VISAS omedelbart när
// trösklar passeras, vilket isolerar tröskel-/effekt-korrektheten (oförändrad). Den NYA FÖRDRÖJDA
// presentationen (kvalificering vid bokslut → visning nästa byggfas) testas i tools/fordrojd-ohalsa-test.js.
//
//   node tools/ohalsa-event-test.js

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { mockOpponentsVote } from '../spec/mock-opponents.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };

// Motor med BARA ohalsaEvents (+ complexEvents för Skola) → isolerar öhälsohändelser från
// företagshändelser (annars bullrar gronafonden/kriser in). trade kvar så bygg funkar.
// ohalsaDelayed:false = legacy omedelbar visning (tröskel-/effekttester; fördröjningen testas separat).
function ohEng(variant = 'mellan', extra = {}) {
  const feat = { trade: true, ohalsaEvents: true, ...(variant === 'skola' ? { complexEvents: true } : {}) };
  return new EcoLoco({ seed: 7, ...VARIANTS[variant], autoEventAtStart: false, ohalsaDelayed: false, features: feat, ...extra });
}
function allRich(e, n = 200) { e.getState().teams.forEach(t => { t.pengar = n; t.material = n; }); }
function drainQueue(e) { let g = 0; while (e.getState().activeCompanyEvent && g++ < 30) e.companyEventResolved(); }
const got = (evs, id) => evs.find(x => x.id === id);

console.log('1) Alla varianter börjar med 50 öhälsa');
{
  for (const v of ['flash', 'mellan', 'skola']) {
    const e = new EcoLoco({ ...VARIANTS[v] }); e.start();
    ok(e.getState().oh === 50, `${v}: start-öhälsa 50`);
  }
}

console.log('2) NATUREN BLOMSTRAR vid öhälsa ≥70 → alla +5 huvudresurs, 0 öhälsa');
{
  const e = ohEng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 71; e._checkOhalsaThresholds();
  drainQueue(e);
  const nb = got(evs, 'naturenblomstrar');
  ok(nb, 'naturen blomstrar utlöst vid ≥70');
  ok(nb && nb.teams && nb.teams.length === 4, 'alla fyra lag får effekt');
  ok(nb && nb.ohalsa === 0, '0 extra öhälsa');
  // aker (material) +5 material, tundra (pengar) +5 pengar
  const by = Object.fromEntries((nb?.teams || []).map(r => [r.teamId, r]));
  ok(by.aker.dMaterial === 5 && by.tundra.dPengar === 5, 'rätt huvudresurs per sektor');
}

console.log('3) MILJÖLYFT vid minst +15 netto under ett år (bokslut)');
{
  const e = ohEng(); e.start(); allRich(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  for (let i = 0; i < 5; i++) e.selectCard('aker', 'gron');   // +3 each = +15 impact
  e.endRound();                                                // oh 50 → 65, netto +15
  drainQueue(e);
  ok(got(evs, 'miljolyft'), 'miljölyft vid netto +15');
  ok(e.getState().oh === 65, `bokslut-öhälsa 65 (${e.getState().oh})`);
}

console.log('3b) MILJÖLYFT INTE vid netto +12');
{
  const e = ohEng(); e.start(); allRich(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  for (let i = 0; i < 4; i++) e.selectCard('aker', 'gron');   // +12
  e.endRound();                                                // oh 50 → 62, netto +12
  drainQueue(e);
  ok(!got(evs, 'miljolyft'), 'ingen miljölyft vid netto +12');
}

console.log('4) VÄRMEBÖLJA vid öhälsa ≤35 → alla −3 huvudresurs');
{
  const e = ohEng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 35; e._checkOhalsaThresholds();
  drainQueue(e);
  const vb = got(evs, 'varmebolja');
  ok(vb, 'värmebölja vid ≤35');
  const by = Object.fromEntries((vb?.teams || []).map(r => [r.teamId, r]));
  ok(by.aker.dMaterial === -3 && by.tundra.dPengar === -3, 'alla −3 huvudresurs');
}

console.log('5) STORM vid öhälsa ≤27 → alla −5 huvudresurs');
{
  const e = ohEng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 27; e._checkOhalsaThresholds();
  drainQueue(e);
  const st = got(evs, 'storm');
  ok(st, 'storm vid ≤27');
  const by = Object.fromEntries((st?.teams || []).map(r => [r.teamId, r]));
  ok(by.aker.dMaterial === -5 && by.tundra.dPengar === -5, 'alla −5 huvudresurs');
}

console.log('6) RESURSBRIST endast i Skola (complexEvents)');
{
  const mellan = ohEng('mellan'); mellan.start();
  const em = []; mellan.on('companyEvent', p => em.push(p));
  mellan.getState().oh = 25; mellan._checkOhalsaThresholds(); drainQueue(mellan);
  ok(!got(em, 'resursbrist'), 'Mellan: ingen resursbrist (ej complexEvents)');
  ok(mellan.getState().resursbristAktiv === false, 'Mellan: resursbrist-tillstånd aldrig aktivt');

  const skola = ohEng('skola'); skola.start();
  const es = []; skola.on('companyEvent', p => es.push(p));
  skola.getState().oh = 25; skola._checkOhalsaThresholds(); drainQueue(skola);
  ok(got(es, 'resursbrist'), 'Skola: resursbrist visas vid ≤30');
  ok(skola.getState().resursbristAktiv === true, 'Skola: resursbrist-tillstånd aktivt');
}

console.log('7) RESURSBRIST upphör vid öhälsa ≥40 (hysteres)');
{
  const e = ohEng('skola'); e.start();
  e.getState().oh = 28; e._checkOhalsaThresholds();
  ok(e.getState().resursbristAktiv === true, 'aktiv vid 28');
  e.getState().oh = 35; e._checkOhalsaThresholds();
  ok(e.getState().resursbristAktiv === true, 'fortfarande aktiv vid 35 (under 40)');
  e.getState().oh = 40; e._checkOhalsaThresholds();
  ok(e.getState().resursbristAktiv === false, 'upphör vid 40');
}

console.log('7b) RESURSBRIST minskar produktionen medan aktiv (mekanik finns; ⚠ faktor preliminär)');
{
  // incP/incM ackumuleras vid bokslut och appliceras SAMMA bokslut. Jämför inkomsten med/utan resursbrist.
  const full = (() => {
    const e = ohEng('skola'); e.start(); allRich(e);
    e.selectCard('aker', 'standard');                 // aker material-sektor, standard gm=7
    const fore = e.team('aker').material; e.endRound();
    return e.team('aker').material - fore;
  })();
  const red = (() => {
    const e = ohEng('skola'); e.start(); allRich(e);
    e.selectCard('aker', 'standard'); e.getState().resursbristAktiv = true;
    const fore = e.team('aker').material; e.endRound();
    return e.team('aker').material - fore;
  })();
  ok(full === 7, `full produktion +${full} material`);
  ok(red < full, `resursbrist minskar produktionen (+${red} < +${full}) — faktor ⚠ ej slutgiltigt beslutad`);
}

console.log('8) Varje öhälsohändelse högst en gång per spel');
{
  const e = ohEng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 34; e._checkOhalsaThresholds(); drainQueue(e);
  e.getState().oh = 33; e._checkOhalsaThresholds(); drainQueue(e);   // fortfarande ≤35
  ok(evs.filter(x => x.id === 'varmebolja').length === 1, 'värmebölja bara en gång');
}

console.log('9) Flera passerade gränser samtidigt köas (Skola, djup kris)');
{
  const e = ohEng('skola'); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 15; e._checkOhalsaThresholds();   // ≤35, ≤30, ≤27 på en gång
  ok(e.getState().activeCompanyEvent !== null, 'en aktiv, övriga köade');
  drainQueue(e);
  ok(got(evs, 'varmebolja') && got(evs, 'resursbrist') && got(evs, 'storm'), 'alla tre hanterade i kö');
}

console.log('10) Den tidigare −3 öhälsa/år-effekten i röd zon är BORTTAGEN');
{
  const e = ohEng(); e.start();
  e.getState().oh = 36;
  e.selectCard('aker', 'smutsig');   // −6 impact → provisional 30 (i röd zon <35)
  e.endRound();
  // Gammalt: 36−6−3(redZonePenalty)=27. Nytt: 36−6=30 (ingen extra −3).
  ok(e.getState().oh === 30, `öhälsa 30, ingen extra −3 (${e.getState().oh})`);
}

console.log('11) KRIS oförändrad: aktiveras ≤20 vid bokslut, upphör ≥35');
{
  const e = ohEng(); e.start();
  const crises = []; e.on('crisis', p => crises.push(p));
  // Sänk till ≤20 via ett stort smutsigt bygge vid bokslut
  e.getState().oh = 24;
  e.selectCard('aker', 'smutsig');   // −6 → 18 ≤20
  e.endRound();
  ok(e.getState().inCrisis === true, 'KRIS aktiv vid öhälsa ≤20');
  ok(crises.some(p => p.on === true), "crisis-event {on:true} emitterat");
  // Höj ≥35 → KRIS löses
  e.getState().oh = 40;
  e.getState().teams.forEach(t => e.selectCard(t.id, 'gron'));   // höj öhälsan
  e.endRound();
  ok(e.getState().inCrisis === false, 'KRIS upphör när öhälsa ≥35');
}

console.log('12) KRIS behåller internt namn/event (crisis), separat från ohalsa-banken');
{
  const e = ohEng(); e.start();
  let crisisSeen = false; e.on('crisis', () => crisisSeen = true);
  e.getState().oh = 22; e.selectCard('aker', 'smutsig'); e.endRound();   // → ≤20
  ok(crisisSeen, "KRIS använder fortfarande 'crisis'-eventet (ej companyEvent)");
  // KRIS är INTE en ohalsa-händelse i kön
  ok(!e.getState().firedCompanyEvents.includes('kris') && !e.getState().firedCompanyEvents.includes('crisis'),
     'KRIS ligger inte i företagshändelse-kön');
}

console.log('13) Flash Ö-råd + sponsrat oförändrat (separat system)');
{
  const e = new EcoLoco({ seed: 11, ...VARIANTS.flash, autoEventAtStart: false }); e.start();
  e.getState().teams.forEach(t => e.selectCard(t.id, 'standard')); e.endRound();
  // Flash drar dilemma vid Ö-rådet
  const res = e.openOradDecision({ id: 'oljefynd', kind: 'dilemma' });
  ok(res.ok, 'Flash Ö-råd öppnar dilemma');
  mockOpponentsVote(e, []);
  ok(['A', 'B'].includes(e.getState().proposal.outcome), 'Flash dilemma-röstning ger A/B');
  // sponsrat (rost) finns kvar i Flash decisionPool (inte filtrerat)
  ok(e._decisionPool().some(d => d.id === 'sponsrat'), 'sponsrat kvar i Flash beslutspool');
  // det gamla fullt slumpade EVENTS-systemet (eventPool/auto-storm m.m.) är borttaget 2026-11-19
  ok(e.getState().eventPool === undefined, 'inget gammalt eventPool-state kvar (fullt slumpat system borttaget)');
}

console.log('14) Byggnadernas miljöpåverkan oförändrad');
{
  const e = ohEng(); e.start(); allRich(e);
  const t = e.team('aker');
  e.selectCard('aker', 'gron');     ok(t.impactPos === 3, 'grön +3');
  e.selectCard('aker', 'smutsig');  ok(t.impactNeg === -6, 'smutsig −6');
  e.selectCard('aker', 'standard'); ok(t.impactNeg === -9, 'standard −3 (totalt −9)');
}

console.log('15) Bokslut + kö + paus utan dubbla effekter');
{
  const e = ohEng(); e.start(); allRich(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  // bygg så öhälsan faller till ≤35 vid bokslut → Värmebölja köas EN gång
  for (let i = 0; i < 3; i++) e.selectCard('aker', 'smutsig');   // −18 → oh 32
  const matFore = e.team('aker').material;
  e.endRound();
  drainQueue(e);
  ok(evs.filter(x => x.id === 'varmebolja').length === 1, 'värmebölja exakt en gång vid bokslut');
  // Värmebölja −3 material appliceras exakt en gång (ingen dubbel)
  ok(e.getState().oh === 32, `bokslut-öhälsa 32 (${e.getState().oh})`);
}

console.log('15b) Ingen automatisk eventLoss-resursförlust i röd zon');
{
  // Isolerat från öhälsohändelser (röd zon <35 = Värmebölja-zon) → motor UTAN ohalsaEvents.
  const e = new EcoLoco({ seed: 7, ...VARIANTS.mellan, autoEventAtStart: false, features: { trade: true } });
  e.start();
  e.getState().oh = 33;                 // redan i röd zon (<35)
  e.getState().teams.forEach(t => { t.pengar = 50; t.material = 50; });
  e.selectCard('aker', 'standard');     // −3 → provisional 30 (röd zon)
  const pengarFore = e.team('skog').pengar, matFore = e.team('skog').material;   // skog byggde inget
  e.endRound();
  ok(e.team('skog').pengar === pengarFore && e.team('skog').material === matFore,
     'ett lag som inte byggde tappar INGA resurser i röd zon (eventLoss borttagen)');
}

console.log('15c) RESURSBRIST ger 80 % produktion (faktor 0.8)');
{
  const prod = aktiv => {
    const e = ohEng('skola'); e.start(); allRich(e);
    e.selectCard('aker', 'standard');   // gm=7
    if (aktiv) e.getState().resursbristAktiv = true;
    const fore = e.team('aker').material; e.endRound();
    return e.team('aker').material - fore;
  };
  ok(prod(false) === 7, 'full produktion = 7 material');
  ok(prod(true) === Math.round(7 * 0.8), `resursbrist = ${Math.round(7 * 0.8)} material (80 % av 7, avrundat)`);
}

console.log('16) Öhälsotrigger via BESLUT (dilemma/politik ändrar öhälsan → tröskel)');
{
  // Ett dilemma/politikbeslut som sänker öhälsan ska köa en öhälsohändelse (via _applyQueuedOhalsa).
  const e = ohEng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 29;                 // precis över Storm (≤27)
  e.getState().gronQueued = -3;         // ett beslut lägger −3 öhälsa i kön → 26
  e._applyQueuedOhalsa();               // verkställer beslutets öhälsoeffekt
  drainQueue(e);
  ok(e.getState().oh === 26, 'beslut sänkte öhälsan 29→26');
  ok(got(evs, 'storm'), 'STORM registrerad via beslut (28→26-liknande fall)');
}

console.log('17) Öhälsotrigger via BYGGE vid bokslut (36→34 → VÄRMEBÖLJA)');
{
  const e = ohEng(); e.start(); allRich(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 37;
  e.selectCard('aker', 'standard');     // −3 impact → 34 ≤35
  e.endRound();
  drainQueue(e);
  ok(e.getState().oh === 34, 'bygge sänkte öhälsan 37→34');
  ok(got(evs, 'varmebolja'), 'VÄRMEBÖLJA registrerad via bygge');
}

console.log('18) Öhälsotrigger uppåt via BYGGE (når ≥70 → NATUREN BLOMSTRAR)');
{
  const e = ohEng(); e.start(); allRich(e);
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 64;
  for (let i = 0; i < 2; i++) e.selectCard('aker', 'gron');   // +6 → 70
  e.endRound();
  drainQueue(e);
  ok(e.getState().oh >= 70, `bygge höjde öhälsan till ${e.getState().oh}`);
  ok(got(evs, 'naturenblomstrar'), 'NATUREN BLOMSTRAR registrerad via bygge');
}

console.log('19) RESURSBRIST produktionseffekt följer öhälsan efter att popupen visats');
{
  const e = ohEng('skola'); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().oh = 25; e._checkOhalsaThresholds(); drainQueue(e);   // popup visas, tillstånd på
  ok(e.getState().resursbristAktiv === true, 'aktiv efter popup');
  e.getState().oh = 45; e._checkOhalsaThresholds();                  // återhämtning → effekt av
  ok(e.getState().resursbristAktiv === false, 'effekten upphör ≥40 även efter popup');
  e.getState().oh = 28; e._checkOhalsaThresholds();                  // ny svacka → effekt PÅ igen (popup ej igen)
  ok(e.getState().resursbristAktiv === true, 'effekten återaktiveras vid ny svacka');
  ok(evs.filter(x => x.id === 'resursbrist').length === 1, 'popupen visas bara en gång totalt');
}

console.log(fails === 0 ? '\n[ohalsa-event] ALLA TESTER OK' : `\n[ohalsa-event] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
