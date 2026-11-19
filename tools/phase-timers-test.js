// tools/phase-timers-test.js — RIKTAT test för Slice 6A: fas-timers ur config + funktions-gater.
// Verifierar att varje version hämtar byggtimer/pris/politik ur SIN config (inga hårdkodade tider),
// att legacy faller tillbaka på nuvarande konstanter, och att handel gatas av features.trade. Exit 1 vid fel.
//
//   node tools/phase-timers-test.js

import { phaseTimers } from '../server/variant-config.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { EcoLoco } from '../spec/engine.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const LEG = { propose: 30, vote: 30 };

console.log('1) Legacy (ingen phases) → faller tillbaka på konstanter, inga variant-tider');
{
  const t = phaseTimers({}, LEG);
  ok(t.bygga === null, 'bygga null → servern använder timerSecFor (legacy)');
  ok(t.propose === 30 && t.vote === 30, 'propose/vote = legacy-konstanter (30/30)');
  ok(t.prisutdelning === null, 'prisutdelning null → per-steg legacy-takt');
}

console.log('2) Flash (dilemma): tider ur config, hela politik-budgeten → A/B-rösten');
{
  const t = phaseTimers(VARIANTS.flash, LEG);
  ok(t.bygga === 60, 'bygga 60 ur config (beslut 2026-11-19)');
  ok(t.prisutdelning === 20, 'prisutdelning 20 ur config');
  ok(t.vote === 30, 'dilemma-röst = politik 30 (hela budgeten, ingen förslagsfas)');
}

console.log('3) Mellan/Skola (politics): politik delas propose+vote');
{
  const m = phaseTimers(VARIANTS.mellan, LEG);
  ok(m.bygga === 100 && m.propose === 30 && m.vote === 30, 'Mellan: bygga 100, politik 60 → 30+30');
  const s = phaseTimers(VARIANTS.skola, LEG);
  ok(s.bygga === 180 && s.propose === 30 && s.vote === 30, 'Skola: bygga 180, politik 60 → 30+30');
}

console.log('4) Handel gatas av features.trade');
{
  const give = e => e.transfer('aker', 'skog', 5, 'pengar', 5, 'material');
  const off = new EcoLoco({ features: { trade: false } }); off.start();
  ok(give(off).ok === false, 'features.trade:false → handel BLOCKERAD');
  const flash = new EcoLoco(VARIANTS.flash); flash.start();
  ok(give(flash).ok === true, 'Flash (features.trade:true): handel tillåten');
  const mellan = new EcoLoco(VARIANTS.mellan); mellan.start();
  ok(give(mellan).ok === true, 'Mellan (features.trade:true): handel tillåten');
  const legacy = new EcoLoco(); legacy.start();
  ok(give(legacy).ok === true, 'legacy (ingen features): handel tillåten (oförändrat)');
}

console.log('5) Varje version använder sin config för år + beslutssystem');
{
  for (const [id, rounds, ds] of [['flash', 4, 'dilemma'], ['mellan', 8, 'politics'], ['skola', 10, 'politics']]) {
    const e = new EcoLoco(VARIANTS[id]); e.start();
    ok(e.cfg.rounds === rounds && e._decisionSystem === ds, `${id}: ${rounds} år, decisionSystem=${ds}`);
  }
}

console.log(fails === 0 ? '\n[phase-timers] ALLA TESTER OK' : `\n[phase-timers] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
