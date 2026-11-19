// tools/company-crisis-test.js — Tester för LOKALA FÖRETAGSKRISER med NYA regler (2026-11-19):
// tröskel minor ≥15 / major ≥25 OCH årskrav minor år 2 / major år 4. En kris kräver att BÅDA villkoren
// är uppfyllda. Passeras tröskeln ett tillåtet år → direkt vid bygget. Passerades den ett tidigare år →
// köas vid starten av det första tillåtna årets byggfas (engine.fireDueCrises). Config-styrt (DEFAULT_CONFIG.
// companyCrisisThreshold / companyCrisisMinRound) → gamla reglerna (−10/−20, inget årskrav) kan köras i samma
// motor. Resursförluster/öhälsoeffekter (−10/−20, −4/−8) OFÖRÄNDRADE. Exit 1 vid fel.
//
//   node tools/company-crisis-test.js

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };

// Motor med companyCrises PÅ men companyEvents AV → testar kris-mekaniken isolerat.
function mellanEngine(opts = {}) {
  const base = { seed: 7, ...VARIANTS.mellan, ...opts };
  base.features = { ...VARIANTS.mellan.features, companyEvents: false, ...(opts.features || {}) };
  return (_dE = new EcoLoco(base));
}
let _dE = null;
const drain = () => { let g = 0; while (_dE && _dE.getState().activeCompanyEvent && g++ < 60) _dE.companyEventResolved(); };

// Bygg n smutsiga för ett lag (ackumulerar impactNeg −6/bygge). Ger resurser så laget alltid har råd.
function buildDirty(e, teamId, n) {
  for (let i = 0; i < n; i++) { const t = e.team(teamId); t.pengar = 100; t.material = 100; e.selectCard(teamId, 'smutsig'); }
}
// Avancera till ett visst spelår utan att partiet dör: nollställ smutsiga rundkort + håll öhälsan uppe.
function advanceToYear(e, year) {
  while (e.getState().round < year && !e.getState().over) {
    e.getState().teams.forEach(t => { t._roundCards = []; });   // inga byggnads-öhälsodrag vid detta bokslut
    e.getState().oh = 60;                                        // håll ön frisk så KRIS/kollaps inte stör
    e.endRound(); drain();
  }
}

console.log('1) Ingen MINDRE kris kan inträffa år 1, oavsett miljöskada');
{
  for (const region of ['aker', 'skog', 'tundra', 'stad']) {
    const e = mellanEngine(); e.start();
    const evs = []; e.on('companyEvent', p => evs.push(p));
    buildDirty(e, region, 6);                    // −36, långt under −15 — men år 1
    e.fireDueCrises(); drain();
    ok(evs.length === 0, `${region}: ingen kris år 1 trots impactNeg ${e.team(region).impactNeg}`);
  }
}

console.log('2) Ingen STÖRRE kris kan inträffa före år 4');
{
  for (const yr of [2, 3]) {
    const e = mellanEngine(); e.start();
    const evs = []; e.on('companyEvent', p => evs.push(p));
    buildDirty(e, 'tundra', 6);                  // −36 (räcker för både minor & major)
    advanceToYear(e, yr); drain();               // minor hinner slå (år ≥2), major ska INTE
    e.fireDueCrises(); drain();
    ok(!evs.some(x => x.id === 'tundra_major'), `år ${yr}: ingen major (impactNeg ${e.team('tundra').impactNeg}, år < 4)`);
    ok(evs.some(x => x.id === 'tundra_minor'), `år ${yr}: minor HAR slagit (årskrav 2 uppfyllt)`);
  }
}

console.log('3) MINDRE kris inträffar vid −15 eller mer från år 2');
{
  const e = mellanEngine(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  buildDirty(e, 'aker', 3);                      // −18 (≤ −15) men år 1 → ingen kris än
  e.fireDueCrises(); drain();
  ok(evs.length === 0, 'år 1: −18 men ingen kris (årskrav 2 ej uppfyllt)');
  advanceToYear(e, 2);
  e.fireDueCrises(); drain();                     // år 2 börjar → väntande minor köas
  ok(evs.length === 1 && evs[0].id === 'aker_minor', 'år 2: minor köas vid byggfasens start (−18, utan nytt bygge)');
}

console.log('4) STÖRRE kris inträffar vid −25 eller mer från år 4');
{
  const e = mellanEngine(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  buildDirty(e, 'skog', 5);                      // −30 (≤ −25)
  advanceToYear(e, 4);
  e.fireDueCrises(); drain();                     // år 4 → både minor (sedan tidigare) + major ska ha slagit
  ok(evs.some(x => x.id === 'skog_major'), 'år 4: major slår (−30 ≥ 25, årskrav 4)');
}

console.log('5) Tidigare ackumulerad skada → kris vid nytt års början UTAN nytt bygge (Exempel A)');
{
  const e = mellanEngine(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  buildDirty(e, 'aker', 3);                      // −18 under år 1
  e.fireDueCrises(); drain();
  ok(evs.length === 0, 'inget år 1');
  advanceToYear(e, 2);                            // INGET nytt bygge
  const r = e.fireDueCrises(); drain();
  ok(r.includes('aker_minor') && evs.length === 1, 'minor köas vid år 2:s start helt utan nytt bygge');
}

console.log('6) En kris som utlöses VID BYGGE år ≥ tillåtet visas direkt (Exempel C)');
{
  const e = mellanEngine(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  advanceToYear(e, 5);                            // nå år 5 utan skada
  ok(e.team('tundra').impactNeg === 0, 'tundra oskadd fram till år 5');
  buildDirty(e, 'tundra', 3);                     // −18 passerar −15 under år 5 → direkt
  drain();
  ok(evs.length === 1 && evs[0].id === 'tundra_minor', 'minor slår direkt vid bygget som passerar tröskeln (år 5)');
}

console.log('7) Varje kris inträffar högst en gång per företag och spel');
{
  const e = mellanEngine(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  buildDirty(e, 'aker', 3); advanceToYear(e, 2); e.fireDueCrises(); drain();  // minor
  buildDirty(e, 'aker', 2); e.fireDueCrises(); drain();                        // mer skada, år 2
  const minors = evs.filter(x => x.id === 'aker_minor').length;
  ok(minors === 1, `aker_minor bara en gång (sågs ${minors})`);
}

console.log('8) Resursförluster och öhälsoeffekter är OFÖRÄNDRADE (−10/−4 minor, −20/−8 major)');
{
  const e = mellanEngine(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  buildDirty(e, 'tundra', 5); advanceToYear(e, 4);
  e.getState().oh = 60;                            // tydligt öhälso-utgångsläge
  const ohBefore = e.getState().oh;
  e.fireDueCrises(); drain();                       // presentera BÅDA via kön (effekter tillämpas)
  const minor = evs.find(x => x.id === 'tundra_minor'), major = evs.find(x => x.id === 'tundra_major');
  ok(minor && minor.dPengar === -10 && minor.ohalsa === -4, `minor: −10 pengar, −4 öhälsa`);
  ok(major && major.dPengar === -20 && major.ohalsa === -8, `major: −20 pengar, −8 öhälsa`);
  ok(e.getState().oh === ohBefore - 4 - 8, `öhälsa ${ohBefore} → ${e.getState().oh} (−4 −8 = −12)`);
}

console.log('9) Flera samtidigt kvalificerade kriser köas korrekt (en i taget)');
{
  const e = mellanEngine(); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  // Två lag passerar sina trösklar under tidiga år; vid år 4 är BÅDES minor+major kvalificerade.
  buildDirty(e, 'aker', 5); buildDirty(e, 'skog', 5);   // −30 var
  advanceToYear(e, 4);
  const fired = e.fireDueCrises();                       // ska köa 4 kriser (aker m+M, skog m+M)
  ok(fired.length === 4, `fyra kriser kvalificerade samtidigt (köade ${fired.length})`);
  ok(e.getState().activeCompanyEvent && e.getState().companyEventQueue.length === 3, 'en aktiv, tre i kön');
  let guard = 0; while (e.getState().activeCompanyEvent && guard++ < 10) e.companyEventResolved();
  ok(evs.length === 4, 'alla fyra presenterades via kön, en i taget');
}

console.log('10) Flash påverkas inte (inga företagskriser alls)');
{
  const e = (_dE = new EcoLoco({ seed: 7, ...VARIANTS.flash })); e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  buildDirty(e, 'aker', 6); e.fireDueCrises(); drain();
  ok(evs.length === 0, 'Flash: inga företagskriser (oförändrat)');
  ok(e.cfg.maxBuildsPerYear === 1, 'Flash byggräns oförändrad (1/lag/år)');
}

console.log('11) GAMLA reglerna kan köras i SAMMA motor (config-styrt: −10/−20, inget årskrav)');
{
  const e = mellanEngine({ companyCrisisThreshold: { minor: -10, major: -20 }, companyCrisisMinRound: { minor: 1, major: 1 } });
  e.start();
  const evs = []; e.on('companyEvent', p => evs.push(p));
  buildDirty(e, 'aker', 2);                        // −12 → minor redan år 1 (gammalt beteende)
  drain();
  ok(evs.length === 1 && evs[0].id === 'aker_minor', 'gamla regler: minor vid −12 år 1');
  buildDirty(e, 'aker', 2); drain();               // −24 → major år 1
  ok(evs.some(x => x.id === 'aker_major'), 'gamla regler: major vid −24 år 1');
}

console.log(fails === 0 ? '\n[company-crisis] ALLA TESTER OK' : `\n[company-crisis] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
