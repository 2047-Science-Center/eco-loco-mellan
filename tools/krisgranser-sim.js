// tools/krisgranser-sim.js — FÖRE/EFTER-jämförelse av lokala företagskrisers trösklar + årskrav i MELLAN.
// GAMLA regler: −10/−20, inget årskrav (minRound 1/1). NYA regler: −15/−25, minor år 2 / major år 4.
// BÅDA körs genom SAMMA motor (spec/engine.js) via config (companyCrisisThreshold/companyCrisisMinRound),
// med SAMMA frön + strategier → ren jämförelse utan kodversionsbyte. Reglerna/effekterna i övrigt orörda.
//
//   node tools/krisgranser-sim.js            (1500 partier/strategi/regeluppsättning)
//   node tools/krisgranser-sim.js 1000
//
// Modellerar servern: fireDueCrises() vid byggfasens början (årsgatade kriser), company events direkt vid
// bygge, 10 s popup-paus (räknad). Bottarna är heuristiker (ej barn) — försiktig ≈ realistiskt, aggressiv = stresstest.

import { EcoLoco, AREAS, handFor as engineHandFor } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { makeRng, tryTrade, expProfile, resolveStrat, pickOrder } from './bot-strategier.js';

const N = parseInt(process.argv[2]) || 1500;
const VCFG = VARIANTS.mellan;
const IDS = AREAS.map(a => a.id);
const CRIS = new Set(['aker_minor','aker_major','skog_minor','skog_major','tundra_minor','tundra_major','stad_minor','stad_major']);
const MAJOR = new Set(['aker_major','skog_major','tundra_major','stad_major']);
const POS = new Set(['gronafonden','expansion','gronomstallning','framtidsvisionar','gemensamsatsning','naturenblomstrar','miljolyft']);
const BLANDADE = { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' };
const BUILD_BUDGET = VCFG.phases?.bygga ?? 100, DELAY = VCFG.ohalsaDelaySeconds || 30;
const SLOTS = Math.max(0, Math.ceil(BUILD_BUDGET / DELAY) - 1);
const sum = a => a.reduce((x, y) => x + y, 0), mean = a => a.length ? sum(a) / a.length : 0;
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '0%';

const OLD = { companyCrisisThreshold: { minor: -10, major: -20 }, companyCrisisMinRound: { minor: 1, major: 1 } };
const NEW = { companyCrisisThreshold: { minor: -15, major: -25 }, companyCrisisMinRound: { minor: 2, major: 4 } };

function handOf(engine, id) {
  const S = engine.getState();
  return engineHandFor(id).filter(c => !(S.banAllThisRound) && !(S.banDirtyThisRound && c.tier === 'smutsig') && !(S.banDirtySektorThisRound === engine.team(id).sektor && c.tier === 'smutsig'));
}

function runGame(seed, rules, strategies, appetit) {
  const rng = makeRng(seed);
  const engine = new EcoLoco({ ...VCFG, ...rules, features: { ...VCFG.features, trade: true }, seed });
  const R = {
    crises: [],            // {id, grad, region, year, dirtyBefore, atStart}
    popupsBuildPhase: {}, posYear: {}, crisYear: {},
    ohByYear: {}, krisActivations: 0, collapsed: false,
    econLossCris: 0,       // summerad resursförlust från kriser (negativ)
  };
  for (let y = 1; y <= 8; y++) { R.popupsBuildPhase[y] = 0; R.posYear[y] = 0; R.crisYear[y] = 0; }
  let curYear = 0, phase = 'build', atStart = false;
  engine.on('roundStart', p => { curYear = p.round; R.ohByYear[curYear] = { end: null }; });
  engine.on('crisis', p => { if (p.on) R.krisActivations++; });
  engine.on('companyEvent', p => {
    if (phase === 'build') R.popupsBuildPhase[curYear]++;
    if (CRIS.has(p.id)) {
      const t = engine.team(p.teamId);
      R.crises.push({ id: p.id, grad: MAJOR.has(p.id) ? 'major' : 'minor', region: p.teamId, year: curYear, dirtyBefore: t.dirtyBuilt, atStart });
      R.crisYear[curYear]++;
      R.econLossCris += (p.teams || []).reduce((s, r) => s + Math.min(0, r.dPengar || 0) + Math.min(0, r.dMaterial || 0), 0);
    } else if (POS.has(p.id)) R.posYear[curYear]++;
  });
  engine.on('gameEnd', p => { if (p.reason && p.reason.includes('kollaps')) R.collapsed = true; });

  const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 60) engine.companyEventResolved(); };
  engine.start();
  while (!engine.getState().over) {
    const S = engine.getState(); const year = S.round; const thr = engine.cfg.redZone;
    phase = 'build';
    atStart = true; engine.fireDueCrises(); drain(); atStart = false;   // årsgatade kriser vid byggfasens start
    let slot = 0; while (slot < SLOTS && engine.getState().pendingOhalsa.length) { if (!engine.fireNextPendingOhalsa().ok) break; drain(); slot++; }
    if (S.oh < 55 && !S.proposal) { const by = S.teams[Math.floor(rng() * 4)]; const pr = engine.openProposal('gron', by.id); if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); } }
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
    phase = 'bokslut';
    engine.endRound(); drain();
    if (R.ohByYear[year]) R.ohByYear[year].end = engine.getState().oh;
  }
  const S = engine.getState();
  R.finalOh = S.oh; R.won = S.oh >= engine.cfg.threshold && S.round >= engine.cfg.rounds;
  R.wealth = Object.fromEntries(IDS.map(id => [id, S.teams.find(t => t.id === id).pengar + S.teams.find(t => t.id === id).material]));
  R.yearsPlayed = Math.min(curYear, 8);
  return R;
}

const STRATS = [
  { namn: 'Försiktigt (realistiskt)', strat: BLANDADE, app: 'forsiktig' },
  { namn: 'Normalt/blandat', strat: BLANDADE, app: 'normal' },
  { namn: 'Aggressivt (stresstest)', strat: BLANDADE, app: 'aggressiv' },
  { namn: 'Grönt', strat: { aker: 'gron', skog: 'gron', tundra: 'gron', stad: 'gron' }, app: 'normal' },
  { namn: 'Blandade lag', strat: BLANDADE, app: 'normal' },
];

function agg(games) {
  const minor = games.flatMap(g => g.crises.filter(c => c.grad === 'minor'));
  const major = games.flatMap(g => g.crises.filter(c => c.grad === 'major'));
  const yearDist = grad => { const d = Array(9).fill(0); games.forEach(g => g.crises.filter(c => c.grad === grad).forEach(c => d[c.year]++)); return d; };
  const bothSame = games.map(g => { const by = {}; g.crises.forEach(c => (by[c.region] ||= new Set()).add(c.grad)); return Object.values(by).filter(s => s.has('minor') && s.has('major')).length; });
  const bp = games.flatMap(g => Object.values(g.popupsBuildPhase));
  const multiCrisYears = games.map(g => Object.values(g.crisYear).filter(x => x >= 2).length);
  const crisWithPos = games.map(g => { let n = 0; for (let y = 1; y <= 8; y++) if (g.crisYear[y] && g.posYear[y]) n++; return n; });
  return {
    minorShare: minor.length / (games.length * 4), majorShare: major.length / (games.length * 4),
    minorYearMean: mean(minor.map(c => c.year)), minorYearMed: median(minor.map(c => c.year)),
    majorYearMean: mean(major.map(c => c.year)), majorYearMed: median(major.map(c => c.year)),
    minorDist: yearDist('minor'), majorDist: yearDist('major'),
    minorDirty: mean(minor.map(c => c.dirtyBefore)), majorDirty: mean(major.map(c => c.dirtyBefore)),
    bothSame: mean(bothSame),
    atStartShare: pct(games.flatMap(g => g.crises).filter(c => c.atStart).length, games.flatMap(g => g.crises).length),
    bpMean: mean(bp), bpMax: Math.max(...bp, 0), bp3: pct(bp.filter(x => x >= 3).length, bp.length),
    pauseMean: mean(games.map(g => sum(Object.values(g.popupsBuildPhase)))) * 10,
    multiCrisYears: mean(multiCrisYears), crisWithPos: mean(crisWithPos),
    finalOh: mean(games.map(g => g.finalOh)), won: pct(games.filter(g => g.won).length, games.length),
    collapse: pct(games.filter(g => g.collapsed).length, games.length),
    kris: mean(games.map(g => g.krisActivations)), econLoss: mean(games.map(g => g.econLossCris)),
    wealth: Object.fromEntries(IDS.map(id => [id, mean(games.map(g => g.wealth[id]))])),
    years: mean(games.map(g => g.yearsPlayed)),
  };
}

console.log(`Eco Loco — LOKALA KRISERS TRÖSKLAR + ÅRSKRAV · FÖRE/EFTER · MELLAN · N=${N}/strategi/regeluppsättning`);
console.log(`GAMLA: −10/−20 inget årskrav · NYA: −15/−25, minor år 2 / major år 4. Samma motor + frön. Reglerna/effekterna i övrigt orörda.\n`);

for (const s of STRATS) {
  const oldG = [], newG = [];
  for (let i = 0; i < N; i++) { oldG.push(runGame(1000 + i, OLD, s.strat, s.app)); newG.push(runGame(1000 + i, NEW, s.strat, s.app)); }
  const A = agg(oldG), B = agg(newG);
  console.log(`\n████ ${s.namn} ████`);
  console.log('A· TIMING                              | GAMLA              | NYA');
  console.log(`  Andel företag m. MINDRE kris         | ${pct(A.minorShare, 1).padEnd(18)} | ${pct(B.minorShare, 1)}`);
  console.log(`  Andel företag m. STÖRRE kris         | ${pct(A.majorShare, 1).padEnd(18)} | ${pct(B.majorShare, 1)}`);
  console.log(`  MINDRE kris: snittår / medianår      | ${(A.minorYearMean.toFixed(2)+' / '+A.minorYearMed).padEnd(18)} | ${B.minorYearMean.toFixed(2)} / ${B.minorYearMed}`);
  console.log(`  STÖRRE kris: snittår / medianår      | ${(A.majorYearMean.toFixed(2)+' / '+A.majorYearMed).padEnd(18)} | ${B.majorYearMean.toFixed(2)} / ${B.majorYearMed}`);
  console.log(`  MINDRE kris fördelning år 1..8       | ${A.minorDist.slice(1).join(',')}`);
  console.log(`                                 (nya) | ${B.minorDist.slice(1).join(',')}`);
  console.log(`  STÖRRE kris fördelning år 1..8       | ${A.majorDist.slice(1).join(',')}`);
  console.log(`                                 (nya) | ${B.majorDist.slice(1).join(',')}`);
  console.log(`  Smutsiga byggen före minor / major   | ${A.minorDirty.toFixed(1)} / ${A.majorDirty.toFixed(1).padEnd(12)} | ${B.minorDirty.toFixed(1)} / ${B.majorDirty.toFixed(1)}`);
  console.log(`  Båda kriserna samma företag/parti    | ${A.bothSame.toFixed(2).padEnd(18)} | ${B.bothSame.toFixed(2)}`);
  console.log(`  Andel kriser som köas vid ÅRSSTART   | ${A.atStartShare.padEnd(18)} | ${B.atStartShare}`);
  console.log('B· TÄTHET');
  console.log(`  Popups/byggfas snitt / max           | ${(A.bpMean.toFixed(2)+' / '+A.bpMax).padEnd(18)} | ${B.bpMean.toFixed(2)} / ${B.bpMax}`);
  console.log(`  Andel byggfaser ≥3 popups            | ${A.bp3.padEnd(18)} | ${B.bp3}`);
  console.log(`  Total händelse-paustid/parti (s)     | ${A.pauseMean.toFixed(0).padEnd(18)} | ${B.pauseMean.toFixed(0)}`);
  console.log(`  År med ≥2 företagskriser (snitt)     | ${A.multiCrisYears.toFixed(2).padEnd(18)} | ${B.multiCrisYears.toFixed(2)}`);
  console.log(`  År där kris + positiv händelse krockar| ${A.crisWithPos.toFixed(2).padEnd(17)} | ${B.crisWithPos.toFixed(2)}`);
  console.log('C· BALANS');
  console.log(`  Överlever / kollaps                  | ${(A.won+' / '+A.collapse).padEnd(18)} | ${B.won} / ${B.collapse}`);
  console.log(`  Snitt-slutöhälsa / spelade år        | ${(A.finalOh.toFixed(1)+' / '+A.years.toFixed(1)).padEnd(18)} | ${B.finalOh.toFixed(1)} / ${B.years.toFixed(1)}`);
  console.log(`  KRIS-aktiveringar/parti              | ${A.kris.toFixed(2).padEnd(18)} | ${B.kris.toFixed(2)}`);
  console.log(`  Resursförlust från kriser/parti      | ${A.econLoss.toFixed(0).padEnd(18)} | ${B.econLoss.toFixed(0)}`);
  console.log(`  Slutförmögenhet Åker/Skog/Tundra/Stad| ${IDS.map(id => Math.round(A.wealth[id])).join('/').padEnd(18)} | ${IDS.map(id => Math.round(B.wealth[id])).join('/')}`);
}
