// tools/fordrojd-ohalsa-test.js — Tester för FÖRDRÖJDA öhälsohändelser (ohalsaDelayed, default på).
// Täcker uppgiftens 12 punkter: kvalificering vid bokslut, visning efter 30 s AKTIV byggtid nästa år,
// 30 s mellan flera, paus fryser nedräkningen, överbäring om byggfasen tar slut, ingen dubbel utlösning/
// -effekt, företagshändelser + KRIS oförändrade, och att alla tre varianter fungerar. Exit 1 vid fel.
//
//   node tools/fordrojd-ohalsa-test.js

import { EcoLoco, AREAS } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const IDS = AREAS.map(a => a.id);
const drain = e => { let g = 0; while (e.getState().activeCompanyEvent && g++ < 60) e.companyEventResolved(); };

// Motor med variantens RIKTIGA features (inkl. företagskriser/-händelser där de finns) + fördröjning PÅ (default).
function eng(variant = 'mellan', extra = {}) {
  const feat = { ...VARIANTS[variant].features, trade: true, ohalsaEvents: true };
  return new EcoLoco({ seed: 7, ...VARIANTS[variant], autoEventAtStart: false, features: feat, ...extra });
}
// Bygg ett år så öhälsan landar i ett intervall (standard = −3/bygge, inga kriser vid få byggen).
function sankTill(e, target) {               // grovt: bygg standard tills öhälsan skulle hamna ~target
  const steg = Math.ceil((e.getState().oh - target) / 3);
  for (let i = 0; i < steg; i++) e.selectCard(IDS[i % 4], 'standard');
}

// MODELL av serverns aktiva-byggtids-timer (speglar server/server.js startTimer): aktiv tid ökar bara
// när vi INTE är pausade/autoPaused; vid varje delaySec-märke avfyras nästa väntande öhälsohändelse.
// pauses = lista [{from,to}] i aktiv-sekunder då manuell paus råder. Returnerar [{t, id}] (när varje visades).
// manualPause = lista [{from,to}] i VERKLIG klocktid (sek) då manuell paus råder (fryser aktiv tid).
function simBuildPhase(engine, { full = 100, delaySec = 30, manualPause = [] } = {}) {
  let left = full, nextMark = delaySec; const shown = [];
  let autoPausedUntil = -1;                    // händelsepopupens egen 10 s-paus (aktiv tid fryses)
  for (let sek = 0; sek < 1000 && left > 0; sek++) {   // 1 tick = 1 s verklig tid
    const manual = manualPause.some(p => sek >= p.from && sek < p.to);
    const auto = sek < autoPausedUntil || engine.getState().activeCompanyEvent;
    if (manual || auto) {                      // paus (manuell/auto/popup) → aktiv tid fryser (left minskar EJ)
      if (engine.getState().activeCompanyEvent) engine.companyEventResolved();   // popupen klar efter sin paus
      continue;
    }
    left--;
    const ea = full - left;
    if (ea >= nextMark && !engine.getState().activeCompanyEvent && engine.getState().pendingOhalsa.length) {
      const r = engine.fireNextPendingOhalsa();
      if (r.ok) { shown.push({ t: ea, id: r.id }); nextMark += delaySec; autoPausedUntil = sek + 10; }  // 10 s popup-paus
    }
  }
  return shown;
}

console.log('1+2) Kvalificering vid BOKSLUT, INGEN visning under år 1:s byggfas');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  sankTill(e, 26);                       // bygg år 1 → öhälsa ~26
  drain(e);                              // ev. företagshändelser under byggfasen
  const underByggfas = evs.filter(x => ['varmebolja', 'storm', 'naturenblomstrar', 'miljolyft'].includes(x.id)).length;
  ok(underByggfas === 0, 'inga öhälsohändelser visade under år 1:s byggfas');
  e.endRound(); drain(e);
  const underBokslut = evs.filter(x => ['varmebolja', 'storm'].includes(x.id)).length;
  ok(underBokslut === 0, 'inga öhälsohändelser visade vid själva bokslutet heller');
  ok(e.getState().pendingOhalsa.includes('varmebolja') && e.getState().pendingOhalsa.includes('storm'),
     `VÄRMEBÖLJA + STORM kvalificerade som VÄNTANDE vid bokslut (öhälsa ${e.getState().oh}, pending=[${e.getState().pendingOhalsa}])`);
}

console.log('3) Första väntande händelsen visas efter 30 s AKTIV byggtid nästa år');
{
  const e = eng(); e.start(); sankTill(e, 26); drain(e); e.endRound(); drain(e);   // pending efter år 1
  const shown = simBuildPhase(e, { full: 100, delaySec: 30 });
  ok(shown.length >= 1 && shown[0].t === 30, `första visades vid 30 s aktiv tid (vid ${shown[0]?.t})`);
}

console.log('4) Två väntande separeras med 30 s aktiv byggtid');
{
  const e = eng(); e.start(); sankTill(e, 26); drain(e); e.endRound(); drain(e);   // [varmebolja, storm]
  const shown = simBuildPhase(e, { full: 100, delaySec: 30 });
  ok(shown.length === 2, `båda visades (${shown.length})`);
  ok(shown[0].t === 30 && shown[1].t === 60, `30 s mellan dem (vid ${shown.map(s => s.t).join(', ')})`);
}

console.log('5) MANUELL paus fryser nedräkningen (visning skjuts upp i verklig tid men sker vid 30 s AKTIV tid)');
{
  const e = eng(); e.start(); sankTill(e, 30); drain(e); e.endRound(); drain(e);   // [varmebolja]
  // manuell paus mellan aktiv sekund 10 och 40 → aktiv tid står still där, men 30-märket nås ändå i aktiv tid
  const shown = simBuildPhase(e, { full: 100, delaySec: 30, manualPause: [{ from: 10, to: 40 }] });
  ok(shown.length === 1 && shown[0].t === 30, `visades vid 30 s AKTIV tid trots paus (vid ${shown[0]?.t})`);
}

console.log('6) AUTOMATISK paus (popupens egen 10 s) räknas inte som aktiv byggtid');
{
  const e = eng(); e.start(); sankTill(e, 26); drain(e); e.endRound(); drain(e);   // [varmebolja, storm]
  const shown = simBuildPhase(e, { full: 100, delaySec: 30 });
  // andra händelsen vid 60 s AKTIV — popupens 10 s mellan dem räknas bort (annars vore den vid ~40 s verklig)
  ok(shown.length === 2 && shown[1].t === 60, `andra vid 60 s aktiv tid (popup-paus borträknad) (vid ${shown[1]?.t})`);
}

console.log('7) Väntande händelser ligger kvar om byggfasen tar slut (överbäring till nästa år)');
{
  const e = eng(); e.start(); sankTill(e, 26); drain(e); e.endRound(); drain(e);   // [varmebolja, storm]
  // kort byggfas (bara 35 s aktiv) → bara en hinner visas, en blir kvar
  const shown = simBuildPhase(e, { full: 35, delaySec: 30 });
  ok(shown.length === 1, `bara en visades i den korta fasen (${shown.length})`);
  ok(e.getState().pendingOhalsa.length === 1, `en kvar som väntande till nästa byggfas (${e.getState().pendingOhalsa})`);
}

console.log('8+9) Ingen dubbel utlösning, effekten appliceras exakt EN gång');
{
  const e = eng(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.getState().teams.forEach(t => { t.pengar = 200; t.material = 200; });
  sankTill(e, 30); drain(e); e.endRound(); drain(e);    // VÄRMEBÖLJA pending
  const matFore = e.team('aker').material;
  simBuildPhase(e, { full: 100, delaySec: 30 });         // visar varmebolja (−3 material till alla)
  ok(evs.filter(x => x.id === 'varmebolja').length === 1, 'VÄRMEBÖLJA visad exakt en gång');
  ok(e.team('aker').material === matFore - 3, `effekten −3 material applicerad exakt en gång (${matFore}→${e.team('aker').material})`);
  // kör nästa bokslut med fortsatt låg öhälsa → ska INTE kvalificera igen
  e.getState().oh = 30; e.selectCard('aker', 'standard'); e.endRound(); drain(e);
  ok(!e.getState().pendingOhalsa.includes('varmebolja'), 'VÄRMEBÖLJA kvalificeras inte igen (en gång/parti)');
}

console.log('10) Företagshändelser utlöses fortfarande DIREKT (oförändrat; nya regler: −15 från år 2)');
{
  const e = eng(); e.start();
  e.getState().round = 2;             // nå minor-årskravet (år 2) så krisen får slå vid bygget
  const evs = []; e.on('companyEvent', p => evs.push(p));
  e.selectCard('tundra', 'smutsig'); e.selectCard('tundra', 'smutsig'); e.selectCard('tundra', 'smutsig'); drain(e);   // −18 (≤ −15) → OLJEUTSLÄPP direkt
  ok(evs.some(x => x.id === 'tundra_minor'), 'företagskris (OLJEUTSLÄPP) visas direkt vid bygget (år 2, −18)');
}

console.log('11) KRIS oförändrad (≤20 vid bokslut → aktiv; ej fördröjd/behandlad som öhälsohändelse)');
{
  const e = eng(); e.start();
  const crises = []; e.on('crisis', p => crises.push(p));
  e.getState().oh = 24; e.selectCard('aker', 'smutsig'); e.endRound();   // −6 → 18 ≤20
  ok(e.getState().inCrisis === true, 'KRIS aktiv vid ≤20 vid bokslut (omedelbart)');
  ok(crises.some(p => p.on === true), "crisis-event emitterat vid bokslut (ej fördröjt)");
  ok(!e.getState().pendingOhalsa.includes('kris'), 'KRIS ligger inte som väntande öhälsohändelse');
}

console.log('12) Alla tre varianter: kvalificering + visning fungerar');
{
  for (const v of ['flash', 'mellan', 'skola']) {
    const e = eng(v); e.start();
    e.getState().teams.forEach(t => { t.pengar = 200; t.material = 200; });
    IDS.forEach(id => e.selectCard(id, 'smutsig'));   // 1 smutsig/lag = −24 öhälsa → 26 (funkar även med Flash-gränsen)
    drain(e); e.endRound(); drain(e);
    const pend = e.getState().pendingOhalsa.length;
    const shown = simBuildPhase(e, { full: 100, delaySec: 30 });
    ok(pend > 0 && shown.length > 0, `${v}: kvalificerade ${pend}, visade ${shown.length} nästa byggfas`);
  }
}

console.log('13) Sista året: händelse som kvalificerar vid SISTA bokslutet blir ALDRIG väntande');
{
  const e = eng('mellan'); e.start();
  // spola fram till sista rundan
  e.getState().round = e.cfg.rounds;             // sista bokslutet
  e.getState().oh = 30;                          // skulle kvalificera VÄRMEBÖLJA
  e.selectCard('aker', 'standard'); e.endRound();
  ok(e.getState().over === true, 'spelet slutar på sista bokslutet');
  ok(e.getState().pendingOhalsa.length === 0, 'inga väntande händelser lämnas kvar efter spelslut (§6)');
}

console.log('14) Pågående händelsekö + ny fördröjd händelse krockar inte');
{
  const e = eng(); e.start(); sankTill(e, 26); drain(e); e.endRound(); drain(e);   // [varmebolja, storm]
  // tvinga en företagshändelse i kön SAMTIDIGT som vi försöker avfyra en väntande
  e.selectCard('tundra', 'smutsig'); e.selectCard('tundra', 'smutsig');            // OLJEUTSLÄPP aktiv (ej drainad)
  const r = e.fireNextPendingOhalsa();
  ok(r.ok === false && r.reason === 'en händelse visas redan', 'fördröjd händelse avfyras inte ovanpå en pågående popup');
  drain(e);                                                                         // lös företagshändelsen
  const r2 = e.fireNextPendingOhalsa();
  ok(r2.ok === true, 'fördröjd händelse kan avfyras när kön är fri');
}

console.log(fails === 0 ? '\n[fordrojd-ohalsa] ALLA TESTER OK' : `\n[fordrojd-ohalsa] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
