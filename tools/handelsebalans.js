// tools/handelsebalans.js — EKONOMISK & PRESENTATIONS-BALANS för händelsesystemet i MELLAN (8 år).
// Komplement till tools/handelsetathet.js (täthet/kö) och tools/fordrojd-sim.js (före/efter fördröjning).
// Kör spec/engine.js ORÖRD i NUVARANDE läge (ohalsaDelayed=true default) — inga regler/trösklar/effekter/
// balansvärden ändras. Modellerar aktiv-byggtids-avfyrningen av fördröjda öhälsohändelser (30 s-slots)
// precis som servern, så öhälsohändelser faktiskt VISAS (annars ligger de kvar som pending och syns aldrig).
//
//   node tools/handelsebalans.js            (allt)
//   node tools/handelsebalans.js N          (annat antal partier/strategi, default 2000)
//
// Vad verktyget mäter som handelsetathet.js INTE gör:
//  1. EKONOMISK ATTRIBUTION per källa: byggproduktion vs företagskriser vs prestationer vs öhälsohändelser
//     (resurser) + öhälsa per källa — summerat per parti OCH per lag.
//  2. −10/−20-krisernas PROPORTIONALITET: lagets resurser DIREKT före krisen vs förlusten (+ clamp).
//  3. POSITIVA prestationers ekonomi: hur mycket delas ut, till vem, hur ofta.
// Alla tre körs över de fem strategiregimerna (girig/grön/adaptiv/blandad + appetit).

import { EcoLoco, AREAS, handFor as engineHandFor } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { makeRng, tryTrade, expProfile, resolveStrat, pickOrder } from './bot-strategier.js';

const N = parseInt(process.argv[2]) || 2000;
const VCFG = VARIANTS.mellan;
const IDS = AREAS.map(a => a.id);
const NAMN = { aker: 'Åker', skog: 'Skog', tundra: 'Tundra', stad: 'Stad' };
const CRIS_IDS = new Set(['aker_minor', 'aker_major', 'skog_minor', 'skog_major', 'tundra_minor', 'tundra_major', 'stad_minor', 'stad_major']);
const MAJOR = new Set(['aker_major', 'skog_major', 'tundra_major', 'stad_major']);
const OHALSA_IDS = new Set(['naturenblomstrar', 'miljolyft', 'varmebolja', 'resursbrist', 'storm']);
const ACHIEVE = new Set(['gronafonden', 'expansion', 'gronomstallning', 'framtidsvisionar', 'gemensamsatsning']);
const BUILD_BUDGET = VCFG.phases?.bygga ?? 100;
const DELAY = VCFG.ohalsaDelaySeconds || 30;
const SLOTS = Math.max(0, Math.ceil(BUILD_BUDGET / DELAY) - 1);   // ~3 visnings-slots/byggfas i Mellan
const z = () => Object.fromEntries(IDS.map(i => [i, 0]));
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? sum(a) / a.length : 0;

function handOf(engine, id) {
  const S = engine.getState();
  return engineHandFor(id).filter(c => !(S.banAllThisRound) && !(S.banDirtyThisRound && c.tier === 'smutsig') && !(S.banDirtySektorThisRound === engine.team(id).sektor && c.tier === 'smutsig'));
}

// Kör ETT parti i NUVARANDE läge. strategies = karta per lag, appetit = expansionsprofil.
function runGame(seed, strategies, appetit) {
  const rng = makeRng(seed);
  const engine = new EcoLoco({ ...VCFG, features: { ...VCFG.features, trade: true }, seed });

  const R = {
    // ekonomi-attribution (resurser): per källa, per lag (netto pengar+material)
    resProd: z(), resCris: z(), resAchieve: z(), resOhalsa: z(), resUppror: z(),
    // öhälso-attribution (brutto): byggnader / kriser / uppror (öhälsohändelser = 0)
    ohBuild: 0, ohCris: 0, ohUppror: 0,
    // kris-proportionalitet: rader {id, major, teamId, before, loss, after, clamp}
    crisRows: [],
    // positiva prestationer: antal + utdelat belopp per id
    posCount: {}, posAmount: {},
    yearsPlayed: 0, finalOh: 0, won: null, krisYear: null,
  };
  const preBuild = {};   // resurser DIREKT före ett bygge (satt i 'build' → före kriskontroll i selectCard)

  engine.on('build', p => { const t = engine.team(p.teamId); preBuild[p.teamId] = { p: t.pengar, m: t.material }; });
  engine.on('income', p => { R.resProd[p.teamId] += (p.pengar || 0) + (p.material || 0); });   // bokslutsproduktion
  engine.on('crisis', p => { if (p.on && R.krisYear === null) R.krisYear = engine.getState().round; });

  engine.on('companyEvent', p => {
    const rader = p.teams || [];
    // öhälsa-attribution
    if (p.ohalsa) { if (CRIS_IDS.has(p.id)) R.ohCris += p.ohalsa; else if (p.id === 'uppror') R.ohUppror += p.ohalsa; }
    // resurs-attribution per källa (faktiskt tillämpad delta efter clamp läses från laget)
    for (const r of rader) {
      const net = (r.dPengar || 0) + (r.dMaterial || 0);
      if (CRIS_IDS.has(p.id)) R.resCris[r.teamId] += net;
      else if (p.id === 'uppror') R.resUppror[r.teamId] += net;
      else if (ACHIEVE.has(p.id)) R.resAchieve[r.teamId] += net;
      else if (OHALSA_IDS.has(p.id)) R.resOhalsa[r.teamId] += net;
    }
    // kris-proportionalitet
    if (CRIS_IDS.has(p.id)) {
      const r = rader[0]; const t = engine.team(r.teamId);
      const before = preBuild[r.teamId] || { p: t.pengar, m: t.material };
      const lossCur = MAJOR.has(p.id) ? 20 : 10;
      const sektorVal = t.sektor === 'pengar' ? before.p : before.m;   // krisen drar lagets sektorvaluta
      const after = t.sektor === 'pengar' ? t.pengar : t.material;
      R.crisRows.push({ id: p.id, major: MAJOR.has(p.id), teamId: r.teamId, beforeSektor: sektorVal, loss: lossCur, after, clamp: after === 0 && sektorVal < lossCur });
    }
    // positiva prestationer
    if (ACHIEVE.has(p.id) || (OHALSA_IDS.has(p.id) && !p.warn)) {
      R.posCount[p.id] = (R.posCount[p.id] || 0) + 1;
      R.posAmount[p.id] = (R.posAmount[p.id] || 0) + rader.reduce((s, r) => s + Math.max(0, (r.dPengar || 0)) + Math.max(0, (r.dMaterial || 0)), 0);
    }
  });

  // byggnadernas öhälso-bokslutsdelta (skild från händelsernas öhälsa)
  let pendingEventOh = false;
  engine.on('companyEvent', p => { if (p.ohalsa) pendingEventOh = true; });
  engine.on('ohalsa', p => { if (p.delta === 0) return; if (pendingEventOh) { pendingEventOh = false; return; } R.ohBuild += Math.min(0, p.delta) < 0 ? p.delta : 0; });

  let result = null;
  engine.on('gameEnd', p => { result = p; });

  const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 60) engine.companyEventResolved(); };
  engine.start();
  while (!engine.getState().over) {
    const S = engine.getState(); const year = S.round; const thr = engine.cfg.redZone;
    engine.fireDueCrises(); drain();   // ÅRSGATADE lokala kriser köas vid byggfasens början (som servern)
    if (S.oh < 55 && !S.proposal) { const by = S.teams[Math.floor(rng() * 4)]; const pr = engine.openProposal('gron', by.id); if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); } }
    // VISA fördröjda öhälsohändelser från förra bokslutet (aktiv-tids-slots, som servern)
    let slot = 0; while (slot < SLOTS && engine.getState().pendingOhalsa.length) { if (!engine.fireNextPendingOhalsa().ok) break; drain(); slot++; }
    for (const t of S.teams) {
      const strat = resolveStrat(strategies[t.id], year); const ec = expProfile(appetit); let n = 0;
      while (n < ec.max) {
        const order = pickOrder(strat, handOf(engine, t.id), S.oh, thr, rng); let did = false;
        for (const card of order) {
          const ownOk = (t.pengar - card.kp >= ec.reserveP) && (t.material - card.km >= ec.reserveM);
          let payOk = ownOk; if (!payOk && ec.stretch) payOk = (t.pengar >= card.kp && t.material >= card.km) || tryTrade(engine, t, card.kp, card.km, null);
          if (payOk && engine.selectCard(t.id, card.tier).ok) { did = true; drain(); break; }
        }
        if (!did) break; n++;
      }
    }
    engine.endRound(); drain();
    R.yearsPlayed = Math.min(S.round, 8);
  }
  R.finalOh = engine.getState().oh; R.won = result?.won;
  return R;
}

const REGIMES = [
  { namn: 'A· Ekonomisk (alla giriga)', strat: { aker: 'girig', skog: 'girig', tundra: 'girig', stad: 'girig' }, app: 'normal' },
  { namn: 'B· Miljövänlig (alla gröna)', strat: { aker: 'gron', skog: 'gron', tundra: 'gron', stad: 'gron' }, app: 'normal' },
  { namn: 'C· Adaptiv (alla)', strat: { aker: 'adaptiv', skog: 'adaptiv', tundra: 'adaptiv', stad: 'adaptiv' }, app: 'normal' },
  { namn: 'D· Blandade (grön/adaptiv/girig/standard)', strat: { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' }, app: 'normal' },
  { namn: 'E· Blandade · FÖRSIKTIG appetit (överlever)', strat: { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' }, app: 'forsiktig' },
];

function p(n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '0%'; }

console.log(`Eco Loco — EKONOMISK & PRESENTATIONS-BALANS · MELLAN · N=${N}/regim · NUVARANDE läge (ohalsaDelayed=true)`);
console.log(`Aktiv-byggtidsmodell: ${BUILD_BUDGET} s byggfas, ${DELAY} s-slots → ${SLOTS} öhälso-visningar/fas. Reglerna/balansvärdena ORÖRDA.`);

for (const reg of REGIMES) {
  const games = [];
  for (let i = 0; i < N; i++) games.push(runGame(1000 + i, reg.strat, reg.app));
  console.log(`\n════════ ${reg.namn} ════════`);
  console.log(`Överlever ${p(games.filter(g => g.won).length, N)} · snitt-slutöhälsa ${mean(games.map(g => g.finalOh)).toFixed(1)} · snitt spelade år ${mean(games.map(g => g.yearsPlayed)).toFixed(1)}`);

  // 1. EKONOMISK ATTRIBUTION per källa (netto resurser/parti, summerat alla lag)
  const srcTot = k => mean(games.map(g => sum(IDS.map(id => g[k][id]))));
  console.log('\n  Resurs-netto per KÄLLA (🪙+🧱/parti, alla lag):');
  console.log(`    Byggproduktion (bokslut): ${srcTot('resProd').toFixed(0)}  ·  Företagskriser: ${srcTot('resCris').toFixed(1)}  ·  Prestationer: +${srcTot('resAchieve').toFixed(1)}  ·  UPPROR: ${srcTot('resUppror').toFixed(1)}  ·  Öhälsohändelser: ${srcTot('resOhalsa').toFixed(1)}`);
  const evNeg = Math.abs(srcTot('resCris')) + Math.abs(srcTot('resUppror')) + Math.min(0, srcTot('resOhalsa'));
  console.log(`    → Händelsernas negativa resursdrag/parti ≈ ${evNeg.toFixed(0)} 🪙/🧱 (kriser+uppror+neg öhälsohändelser), mot +${srcTot('resAchieve').toFixed(0)} i positiva prestationer.`);

  // öhälsa per källa
  const ohB = mean(games.map(g => g.ohBuild)), ohC = mean(games.map(g => g.ohCris)), ohU = mean(games.map(g => g.ohUppror));
  const negTot = Math.abs(ohB) + Math.abs(ohC) + Math.abs(ohU);
  console.log(`  Öhälsa-delta per KÄLLA (brutto/parti): Byggnader ${ohB.toFixed(1)} · Företagskriser ${ohC.toFixed(1)} · UPPROR ${ohU.toFixed(1)} · Öhälsohändelser 0`);
  console.log(`    → Händelser står för ${negTot ? (100 * (Math.abs(ohC) + Math.abs(ohU)) / negTot).toFixed(0) : 0} % av NEGATIV öhälsa; byggnader för ${negTot ? (100 * Math.abs(ohB) / negTot).toFixed(0) : 0} %.`);

  // 2. KRIS-PROPORTIONALITET
  const rows = games.flatMap(g => g.crisRows);
  const minor = rows.filter(r => !r.major), major = rows.filter(r => r.major);
  const propLine = (label, arr) => {
    if (!arr.length) { console.log(`    ${label}: (inträffade ej)`); return; }
    const beforeAvg = mean(arr.map(r => r.beforeSektor)), lossAvg = mean(arr.map(r => r.loss));
    const clampAndel = p(arr.filter(r => r.clamp).length, arr.length);
    const ratio = beforeAvg ? (lossAvg / beforeAvg) : 0;
    console.log(`    ${label}: n=${arr.length} · sektorvaluta FÖRE ${beforeAvg.toFixed(1)} · förlust ${lossAvg.toFixed(0)} (${(100 * ratio).toFixed(0)} % av kassan) · clamp(tömde laget) ${clampAndel}`);
  };
  console.log('\n  Kris-proportionalitet (lagets sektorvaluta DIREKT före krisen vs förlusten):');
  propLine('MINOR −10 (−4 öhälsa)', minor);
  propLine('MAJOR −20 (−8 öhälsa)', major);

  // 3. POSITIVA PRESTATIONER
  const posIds = Object.keys({ ...games.reduce((a, g) => ({ ...a, ...g.posCount }), {}) });
  if (posIds.length) {
    console.log('\n  Positiva händelser (frekvens · snittutdelning/parti):');
    for (const id of posIds.sort()) {
      const cnt = mean(games.map(g => g.posCount[id] || 0)), amt = mean(games.map(g => g.posAmount[id] || 0));
      console.log(`    ${id}: ${cnt.toFixed(2)}/parti · +${amt.toFixed(1)} 🪙/🧱/parti`);
    }
  }
}
