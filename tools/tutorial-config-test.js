// tools/tutorial-config-test.js — RIKTAT test för tutorialens versionsanpassning (minimal, 2026-11-18).
// Övningsmotorn (makeTutorial) ska köra VALD versions regler (år, tröskel, beslutssystem) men behålla
// övningsekonomin 26/26 så bygg- och handelsmomenten fungerar. Verifierar config-genomslag + att de
// interaktiva momenten (bygga, byta, avsluta år) fungerar i alla tre versioner. Exit 1 vid fel.
//
//   node tools/tutorial-config-test.js

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
// Samma config-bygge som runTutorial: manifest-bas + variant, + övnings-overrides (26/26, gm).
const tutEngine = (id) => {
  const base = { mode: 'tutorial' };
  const e = new EcoLoco({ ...base, ...VARIANTS[id], humanTeam: 'aker', startPengar: 26, startMaterial: 26 });
  e.setGm(true);
  return e;
};

console.log('1) Övningsmotorn följer varje versions år + tröskel + beslutssystem');
{
  for (const [id, rounds, ds] of [['flash', 4, 'dilemma'], ['mellan', 8, 'politics'], ['skola', 10, 'politics']]) {
    const e = tutEngine(id); e.start();
    ok(e.cfg.rounds === rounds, `${id}: tutorial-text "Ni har ${rounds} år" (cfg.rounds)`);
    ok(e.cfg.threshold === 60, `${id}: öhälsogräns ${e.cfg.threshold} (cfg.threshold)`);
    ok(e._decisionSystem === ds, `${id}: beslutssystem ${ds}`);
  }
}

console.log('2) Övningsekonomin 26/26 bevarad (garanterar bygg/byt-momenten)');
{
  for (const id of ['flash', 'mellan', 'skola']) {
    const e = tutEngine(id); e.start();
    ok(e.team('aker').pengar === 26 && e.team('aker').material === 26, `${id}: start 26/26`);
  }
}

console.log('3) Interaktiva momenten fungerar: BYGG → BYT → AVSLUTA ÅR (alla versioner)');
{
  for (const id of ['flash', 'mellan', 'skola']) {
    const e = tutEngine(id); e.start();
    // BYGG: aker (material) bygger smutsigt (kp8/km0) — har råd med 26/26
    ok(e.selectCard('aker', 'smutsig').ok, `${id}: BYGG funkar`);
    // BYT: aker byter 5 pengar mot 5 material med skog (som i tutorialens byt-steg; handel på i alla)
    ok(e.transfer('aker', 'skog', 5, 'pengar', 5, 'material').ok, `${id}: BYT funkar (handel på)`);
    // AVSLUTA ÅR: bokslut körs utan att hänga; motorn går vidare (eller spelslut)
    const before = e.getState().round;
    e.endRound();
    ok(e.getState().round === before + 1 || e.getState().over, `${id}: AVSLUTA ÅR → bokslut ok`);
  }
}

console.log('4) Övergång: övningen lär ut SAMMA årtal som det riktiga partiet kör');
{
  for (const id of ['flash', 'mellan', 'skola']) {
    const tut = tutEngine(id); tut.start();
    const real = new EcoLoco(VARIANTS[id]); real.start();   // riktiga partiet (serverns motor)
    ok(tut.cfg.rounds === real.cfg.rounds, `${id}: övning (${tut.cfg.rounds} år) = riktigt parti (${real.cfg.rounds} år)`);
  }
}

console.log(fails === 0 ? '\n[tutorial-config] ALLA TESTER OK' : `\n[tutorial-config] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
