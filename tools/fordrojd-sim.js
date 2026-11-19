// tools/fordrojd-sim.js — FÖRE/EFTER-jämförelse av fördröjda öhälsohändelser i MELLAN.
// A = tidigare system (ohalsaDelayed:false, öhälsohändelser visas direkt när trösklar passeras).
// B = nytt system (ohalsaDelayed:true, kvalificeras vid bokslut → visas en bit in i NÄSTA byggfas).
// Samma strategier + slumpfrön i båda. Kör spec/engine.js ORÖRD (bara config-flaggan skiljer).
//
//   node tools/fordrojd-sim.js                        (Mellan, 30 s, 1000 partier/scenario)
//   node tools/fordrojd-sim.js 2000                    (annat N)
//   node tools/fordrojd-sim.js 1000 flash 30           (variant + delay-sekunder)
//   node tools/fordrojd-sim.js 1000 flash 20           (kortare intervall för kort byggfas)
//
// EXPLICIT AKTIV-BYGGTIDSMODELL (förenklad, dokumenterad): varje byggfas har en aktiv-tidsbudget
// (Mellan ~100 s). Företagshändelser visas DIREKT när de utlöses (räknas i byggfasens år). I nytt
// läge visas väntande öhälsohändelser vid 30/60/90 s AKTIV tid (popup-pausen räknas INTE som aktiv
// tid → fryser budgeten, men budgeten räcker ändå till ~3 visningar/fas). Väntande som inte hinner
// visas (fler än budgeten tillåter) bärs över till nästa byggfas. Pauser modelleras som att de bara
// fryser klockan → de ändrar inte VILKA som visas, bara när, så för utfallsstatistiken räcker budgeten.

import { EcoLoco, AREAS, handFor as engineHandFor } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { makeRng, tryTrade, expProfile, resolveStrat, pickOrder } from './bot-strategier.js';

const N = parseInt(process.argv[2]) || 1000;
const VARIANT = (process.argv[3] || 'mellan').toLowerCase();
const VCFG = VARIANTS[VARIANT];
if (!VCFG) { console.error(`Okänd variant: ${VARIANT}`); process.exit(1); }
const IDS = AREAS.map(a => a.id);
const BLANDADE = { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' };
const OHALSA_IDS = new Set(['naturenblomstrar', 'miljolyft', 'varmebolja', 'resursbrist', 'storm']);
// aktiv byggtid/år = variantens byggfas (phases.bygga) eller timerSec. DELAY = aktiv sek mellan väntande.
const BUILD_BUDGET = VCFG.phases?.bygga ?? VCFG.timerSec ?? 100;
const DELAY = parseInt(process.argv[4]) || VCFG.ohalsaDelaySeconds || 30;
// En händelse vid märket 30,60,… men byggfasen tar slut vid BUILD_BUDGET (sista märket = slutet → hinner ej).
const SLOTS = Math.max(0, Math.ceil(BUILD_BUDGET / DELAY) - 1);

function handOf(engine, id) {
  const S = engine.getState();
  return engineHandFor(id).filter(c => !(S.banAllThisRound) && !(S.banDirtyThisRound && c.tier === 'smutsig') && !(S.banDirtySektorThisRound === engine.team(id).sektor && c.tier === 'smutsig'));
}

function runGame(seed, delayed, appetit) {
  const rng = makeRng(seed);
  const engine = new EcoLoco({ ...VCFG, ohalsaDelayed: delayed, features: { ...VCFG.features, trade: true }, seed });
  const R = {
    popupsBuildPhase: {}, popupsYear: {},   // per år: popups under byggfasen / totalt (inkl bokslut)
    qualified: 0, shown: 0,                  // (nytt läge) antal kvalificerade / faktiskt visade öhälsohändelser
    maxPhasePopups: 0,
    krisYear: null, collapsed: false,
  };
  for (let y = 1; y <= 8; y++) { R.popupsBuildPhase[y] = 0; R.popupsYear[y] = 0; }
  let curYear = 0, phase = 'build';
  engine.on('roundStart', p => { curYear = p.round; });
  engine.on('companyEvent', p => {
    R.popupsYear[curYear] = (R.popupsYear[curYear] || 0) + 1;
    if (phase === 'build') R.popupsBuildPhase[curYear]++;
    if (OHALSA_IDS.has(p.id)) R.shown++;
  });
  engine.on('crisis', p => { if (p.on && R.krisYear === null) R.krisYear = curYear; });
  engine.on('gameEnd', p => { if (p.reason && p.reason.includes('kollaps')) R.collapsed = true; });

  const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 60) engine.companyEventResolved(); };
  engine.start();
  while (!engine.getState().over) {
    const S = engine.getState(); const year = S.round; const thr = engine.cfg.redZone;
    phase = 'build';
    engine.fireDueCrises(); drain();   // ÅRSGATADE lokala kriser köas vid byggfasens början (som servern)
    if (S.oh < 55 && !S.proposal) { const by = S.teams[Math.floor(rng() * 4)]; const pr = engine.openProposal('gron', by.id); if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); } }
    // NYTT LÄGE: visa väntande öhälsohändelser från FÖRRA bokslutet, upp till budgetens slots, under DENNA byggfas.
    if (delayed) { let slot = 0; while (slot < SLOTS && engine.getState().pendingOhalsa.length) { const r = engine.fireNextPendingOhalsa(); if (!r.ok) break; drain(); slot++; } }
    // bots bygger (företagshändelser visas direkt via drain)
    const byggTak = engine.cfg.maxBuildsPerYear ?? Infinity;   // Flash: 1/lag/år
    for (const t of S.teams) {
      const strat = resolveStrat(BLANDADE[t.id], year); const ec = expProfile(appetit); let n = 0;
      while (n < Math.min(ec.max, byggTak)) {
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
    const pendBefore = engine.getState().pendingOhalsa.length;
    engine.endRound(); drain();
    if (delayed) R.qualified += engine.getState().pendingOhalsa.length - pendBefore;   // nya kvalificerade detta bokslut
  }
  const S = engine.getState();
  R.finalOh = S.oh;
  R.waiting = delayed ? S.pendingOhalsa.length : 0;    // kvar ovisade vid spelslut (bärs aldrig då spelet är slut)
  R.wealth = Object.fromEntries(IDS.map(id => [id, S.teams.find(t => t.id === id).pengar + S.teams.find(t => t.id === id).material]));
  R.maxPhasePopups = Math.max(...Object.values(R.popupsBuildPhase));
  return R;
}

function scenario(namn, appetit) {
  const agg = m => { const A = { y1: 0, y2: 0, y38: 0, maxPhase: 0, phase3: 0, phases: 0, oh: 0, kris: 0, coll: 0, w: { aker: 0, skog: 0, tundra: 0, stad: 0 }, qual: 0, shown: 0, wait: 0 };
    for (let i = 0; i < N; i++) {
      const r = runGame(1000 + i, m, appetit);
      A.y1 += r.popupsYear[1]; A.y2 += r.popupsYear[2]; for (let y = 3; y <= 8; y++) A.y38 += r.popupsYear[y];
      A.maxPhase = Math.max(A.maxPhase, r.maxPhasePopups);
      for (let y = 1; y <= 8; y++) { if (r.popupsBuildPhase[y] !== undefined) { A.phases++; if (r.popupsBuildPhase[y] >= 3) A.phase3++; } }
      A.oh += r.finalOh; A.kris += r.krisYear ? 1 : 0; A.coll += r.collapsed ? 1 : 0;
      for (const id of IDS) A.w[id] += r.wealth[id];
      A.qual += r.qualified; A.shown += r.shown; A.wait += r.waiting;
    }
    return A;
  };
  const A = agg(false), B = agg(true);
  const avgPhasePopupTime = X => (10 * (X.y1 + X.y2 + X.y38) / X.phases);   // grov: total popups × 10 s / antal byggfaser
  const f = (a, d = 2) => a.toFixed(d);
  console.log(`\n■ ${namn} (N=${N}/system)`);
  console.log('| Mått | A· Tidigare | B· Nytt |');
  console.log('|---|---|---|');
  console.log(`| Händelser år 1 (snitt) | ${f(A.y1 / N)} | ${f(B.y1 / N)} |`);
  console.log(`| Händelser år 2 | ${f(A.y2 / N)} | ${f(B.y2 / N)} |`);
  console.log(`| Händelser år 3–8 | ${f(A.y38 / N)} | ${f(B.y38 / N)} |`);
  console.log(`| Max popups under en byggfas | ${A.maxPhase} | ${B.maxPhase} |`);
  console.log(`| Snitt popup-tid per byggfas (s) | ${f(avgPhasePopupTime(A), 1)} | ${f(avgPhasePopupTime(B), 1)} |`);
  console.log(`| Andel byggfaser med ≥3 popups | ${f(100 * A.phase3 / A.phases, 1)}% | ${f(100 * B.phase3 / B.phases, 1)}% |`);
  console.log(`| Slut-öhälsa | ${f(A.oh / N, 1)} | ${f(B.oh / N, 1)} |`);
  console.log(`| Andel som når KRIS | ${f(100 * A.kris / N, 1)}% | ${f(100 * B.kris / N, 1)}% |`);
  console.log(`| Andel som når öhälsa 0 | ${f(100 * A.coll / N, 1)}% | ${f(100 * B.coll / N, 1)}% |`);
  console.log(`| Slutförmögenhet Åker/Skog/Tundra/Stad | ${IDS.map(id => Math.round(A.w[id] / N)).join('/')} | ${IDS.map(id => Math.round(B.w[id] / N)).join('/')} |`);
  console.log(`  Nytt system — öhälsohändelser: kvalificerade ${f(B.qual / N)}/parti · faktiskt visade ${f(B.shown / N)}/parti · väntande kvar vid spelslut ${f(B.wait / N)}/parti (aldrig visade)`);
  console.log(`  (Tidigare system visade ${f(A.shown / N)} öhälsohändelser/parti — alla i kvalificeringsåret.)`);
}

// Spåra ETT överlevande parti (försiktig) år-för-år i NYTT läge → visa kvalificering vid bokslut
// kontra visning nästa år. Väljer ett frö som når KRIS så öhälsohändelser faktiskt uppstår.
function exempelParti() {
  for (let i = 0; i < 400; i++) {
    const seed = 1000 + i;
    const rng = makeRng(seed);
    const e = new EcoLoco({ ...VCFG, ohalsaDelayed: true, features: { ...VCFG.features, trade: true }, seed });
    const log = [];
    let curYear = 0;
    e.on('roundStart', p => { curYear = p.round; });
    e.on('companyEvent', p => { if (OHALSA_IDS.has(p.id)) log.push({ year: curYear, typ: 'VISAD', namn: p.namn }); });
    const drain = () => { let g = 0; while (e.getState().activeCompanyEvent && g++ < 60) e.companyEventResolved(); };
    const ohBana = [];
    e.start();
    while (!e.getState().over) {
      const S = e.getState(); const year = S.round; const thr = e.cfg.redZone;
      if (S.oh < 55 && !S.proposal) { const by = S.teams[Math.floor(rng() * 4)]; const pr = e.openProposal('gron', by.id); if (pr && pr.ok) { S.teams.forEach(t => e.vote(t.id, t.pengar >= e.cfg.gronCost)); drain(); } }
      let slot = 0; while (slot < SLOTS && e.getState().pendingOhalsa.length) { const r = e.fireNextPendingOhalsa(); if (!r.ok) break; drain(); slot++; }
      const byggTak = e.cfg.maxBuildsPerYear ?? Infinity;   // Flash: 1/lag/år
      for (const t of S.teams) {
        const strat = resolveStrat(BLANDADE[t.id], year); const ec = expProfile('forsiktig'); let n = 0;
        while (n < Math.min(ec.max, byggTak)) { const order = pickOrder(strat, handOf(e, t.id), S.oh, thr, rng); let did = false;
          for (const card of order) { const ownOk = (t.pengar - card.kp >= ec.reserveP) && (t.material - card.km >= ec.reserveM); let payOk = ownOk; if (!payOk && ec.stretch) payOk = (t.pengar >= card.kp && t.material >= card.km) || tryTrade(e, t, card.kp, card.km, null); if (payOk && e.selectCard(t.id, card.tier).ok) { did = true; drain(); break; } }
          if (!did) break; n++; }
      }
      const ohStart = ohBana.length ? ohBana[ohBana.length - 1].slut : e.cfg.ohStart;
      const pendBefore = e.getState().pendingOhalsa.slice();
      e.endRound(); drain();
      const nya = e.getState().pendingOhalsa.filter(x => !pendBefore.includes(x));
      ohBana.push({ year, slut: e.getState().oh });
      for (const id of nya) log.push({ year, typ: 'KVALIFICERAD (bokslut → nästa år)', namn: id });
    }
    if (log.some(l => l.typ === 'VISAD') && e.getState().round >= 4) {   // ett parti med faktisk fördröjd visning
      console.log(`\n■ EXEMPELPARTI (frö ${seed}, försiktig, NYTT läge) — öhälsa/år: ${ohBana.map(o => `${o.year}:${o.slut}`).join(' ')}`);
      for (const l of log) console.log(`   år ${l.year}: ${l.typ} — ${l.namn}`);
      console.log(`   → öhälsohändelser KVALIFICERAS vid bokslut år N och VISAS ~30 s in i byggfasen år N+1.`);
      return;
    }
  }
  console.log('\n(Inget lämpligt exempelparti hittades i de 400 första fröna.)');
}

console.log(`Eco Loco — fördröjda öhälsohändelser FÖRE/EFTER · ${VARIANT.toUpperCase()} · N=${N}/system · blandade strategier · handel PÅ`);
console.log(`Aktiv-byggtidsmodell: budget ${BUILD_BUDGET} s, ${DELAY} s mellan väntande händelser → ${SLOTS} slots/byggfas. Reglerna orörda (bara ohalsaDelayed skiljer).`);
scenario('NORMAL expansion', 'normal');
scenario('FÖRSIKTIG expansion', 'forsiktig');
exempelParti();
