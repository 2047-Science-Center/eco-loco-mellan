// tools/flash-byggrans-test.js — Tester för Flash-regeln "max ett bygge per lag och år"
// (cfg.maxBuildsPerYear=1). Verifierar motorns gate i selectCard, att Mellan/Skola är obegränsade,
// att simulatorns byggloop respekterar gränsen och att fördröjda öhälsohändelser fortsatt fungerar.
// Inga balansvärden ändrade. Exit 1 vid fel.
//
//   node tools/flash-byggrans-test.js

import { EcoLoco, AREAS, handFor } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { pickOrder, expProfile } from './bot-strategier.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const IDS = AREAS.map(a => a.id);
const drain = e => { let g = 0; while (e.getState().activeCompanyEvent && g++ < 60) e.companyEventResolved(); };
const flash = (extra = {}) => new EcoLoco({ seed: 3, ...VARIANTS.flash, ...extra });

console.log('0) Config: Flash=1, Mellan/Skola=obegränsat (null)');
{
  ok(new EcoLoco({ ...VARIANTS.flash }).cfg.maxBuildsPerYear === 1, 'Flash maxBuildsPerYear = 1');
  ok((new EcoLoco({ ...VARIANTS.mellan }).cfg.maxBuildsPerYear ?? null) === null, 'Mellan = null (obegränsat)');
  ok((new EcoLoco({ ...VARIANTS.skola }).cfg.maxBuildsPerYear ?? null) === null, 'Skola = null (obegränsat)');
}

console.log('1) Flash tillåter FÖRSTA bygget');
{
  const e = flash(); e.start();
  const r = e.selectCard('aker', 'standard');
  ok(r.ok === true, 'första bygget accepteras');
  ok(e.team('aker').built === 1 && e.team('aker')._builtThisYear === 1, 'built=1, _builtThisYear=1');
}

console.log('2+3) Flash NEKAR andra bygget samma år, utan resurs-/state-ändring');
{
  const e = flash(); e.start();
  e.selectCard('aker', 'standard');
  const t = e.team('aker');
  const p0 = t.pengar, m0 = t.material, built0 = t.built, slots0 = t.slots.length;
  const r = e.selectCard('aker', 'smutsig');
  ok(r.ok === false && r.maxReached === true, `andra bygget nekas (reason: ${r.reason})`);
  ok(t.pengar === p0 && t.material === m0, 'inga resurser dragna vid nekat bygge');
  ok(t.built === built0 && t.slots.length === slots0, 'ingen ny byggnad/slot skapad');
}

console.log('4) Samma lag kan bygga igen NÄSTA år (räknaren nollas vid bokslut)');
{
  const e = flash(); e.start();
  e.selectCard('aker', 'standard');
  e.endRound(); drain(e);
  ok(e.team('aker')._builtThisYear === 0, '_builtThisYear nollad vid årsskifte');
  const r = e.selectCard('aker', 'standard');
  ok(r.ok === true, 'aker kan bygga igen år 2');
}

console.log('5) Alla fyra lag kan bygga VARSIN byggnad samma år');
{
  const e = flash(); e.start();
  const res = IDS.map(id => e.selectCard(id, 'standard').ok);
  ok(res.every(Boolean), 'alla fyra första byggen accepteras');
  ok(IDS.every(id => e.team(id).built === 1), 'varje lag har exakt 1 byggnad');
  // men ett FEMTE försök (något lag igen) nekas
  ok(e.selectCard('aker', 'standard').ok === false, 'ytterligare bygge för ett lag nekas');
}

console.log('6) Handel fungerar fortfarande EFTER ett bygge');
{
  const e = flash(); e.start();
  e.selectCard('aker', 'standard');                 // aker har byggt (klar för året)
  const a = e.team('aker'), b = e.team('skog');
  const aP = a.pengar, aM = a.material, bP = b.pengar, bM = b.material;
  const r = e.transfer('aker', 'skog', 3, 'material', 3, 'pengar');   // aker ger 3🧱 mot 3🪙
  ok(r.ok === true, 'handel accepteras efter bygget');
  ok(a.pengar === aP + 3 && a.material === aM - 3, 'akers resurser bytta korrekt');
  ok(b.pengar === bP - 3 && b.material === bM + 3, 'skogs resurser bytta korrekt');
}

console.log('7) Mellan och Skola tillåter FLERA byggen per lag och år');
{
  for (const v of ['mellan', 'skola']) {
    const e = new EcoLoco({ seed: 3, ...VARIANTS[v] }); e.start();
    const r = [e.selectCard('aker', 'standard').ok, e.selectCard('aker', 'standard').ok, e.selectCard('aker', 'smutsig').ok];
    ok(r.every(Boolean) && e.team('aker').built === 3, `${v}: 3 byggen samma år accepteras (obegränsat)`);
  }
}

console.log('8) Simulatorns byggloop respekterar gränsen i Flash (bara 1 bygge/lag/år, inga felrapporterade)');
{
  // Replikerar simulatorns loop (aggressiv appetit = max 10) → motorns gate + cap ska ge exakt 1/lag.
  const e = flash(); e.start();
  let builtEvents = 0; e.on('build', () => builtEvents++);
  const rng = () => 0.5;
  const byggTak = e.cfg.maxBuildsPerYear ?? Infinity;
  for (const t of e.getState().teams) {
    const ec = expProfile('aggressiv'); let n = 0;
    while (n < Math.min(ec.max, byggTak)) {
      const order = pickOrder('girig', handFor(t.id), e.getState().oh, e.cfg.redZone, rng);
      let did = false;
      for (const card of order) {
        const ownOk = t.pengar >= card.kp && t.material >= card.km;
        if (ownOk && e.selectCard(t.id, card.tier).ok) { did = true; drain(e); break; }
      }
      if (!did) break; n++;
    }
  }
  ok(builtEvents === 4, `exakt 4 'build'-events (1/lag), inte fler (${builtEvents})`);
  ok(IDS.every(id => e.team(id).built === 1), 'varje lag exakt 1 byggnad i simulatorloopen');
}

console.log('9) Fördröjda öhälsohändelser fungerar fortfarande i Flash (kvalificering vid bokslut)');
{
  const e = flash(); e.start();
  // 4 lag × 1 smutsig = −24 öhälsa → bokslut öhälsa 26 → VÄRMEBÖLJA (≤35) + STORM (≤27) kvalificerar
  IDS.forEach(id => e.selectCard(id, 'smutsig'));
  const evs = []; e.on('companyEvent', p => evs.push(p.id));
  e.endRound(); drain(e);
  ok(e.getState().oh === 26, `bokslut-öhälsa 26 (${e.getState().oh})`);
  ok(evs.filter(x => ['varmebolja', 'storm'].includes(x)).length === 0, 'inga öhälsohändelser visade vid bokslut (fördröjt)');
  ok(e.getState().pendingOhalsa.includes('varmebolja') && e.getState().pendingOhalsa.includes('storm'),
     `VÄRMEBÖLJA + STORM väntande till nästa år (pending=[${e.getState().pendingOhalsa}])`);
  const r = e.fireNextPendingOhalsa(); drain(e);
  ok(r.ok && evs.includes('varmebolja'), 'väntande öhälsohändelse kan avfyras nästa år');
  ok(e.cfg.ohalsaDelaySeconds === 20, 'Flash använder 20 s-intervall (oförändrat)');
}

console.log(fails === 0 ? '\n[flash-byggrans] ALLA TESTER OK' : `\n[flash-byggrans] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
