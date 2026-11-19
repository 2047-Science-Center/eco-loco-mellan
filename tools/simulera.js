// tools/simulera.js — Monte Carlo-balansanalys av Eco Loco (variantmedveten, instrumenterad).
// Kör spec/engine.js (reglerna ORÖRDA — inga balansvärden ändras) tusentals gånger och rapporterar
// ekonomi, handel, händelse-utfall, öhälsa/KRIS och överlevnad per variant och strategi.
//
//   node tools/simulera.js                 (standard: Mellan, N=3000, kärnscenarier)
//   node tools/simulera.js 1000            (annat N)
//   node tools/simulera.js 1000 flash      (annan variant: flash|mellan|skola)
//   node tools/simulera.js 1000 skola full (variant + fokus: kort|full)
//
// Strategier (DEL 4): girig=ekonomisk(A) · gron=miljövänlig(B, bygger bara grönt) · adaptiv(C) · blandade(D).
// Expansionsappetit (DEL 4b): hur MÅNGA byggen/år (en/forsiktig/normal/aggressiv). Motorn tillåter
//   obegränsat byggande/år; appetiten + reserven styr bottarnas vilja (de spenderar inte allt).
// Handel (DEL 4): 1:1-byte som mock-opponents; scenario med handel AV för jämförelse.
// Händelsebelastning (DEL 5): baslinje(inga) · automatiska(foretag+ohalsa) · fullt(+GM) · hög(många neg).
// Räddning (DEL 6): smutsig start → aggressiv grön vändning (kan flera gröna/år rädda ön?).
//
// FÖRENKLINGAR (dokumenterade): (1) Botstrategierna är deterministiska heuristiker, inte människor.
// (2) GM-händelser injiceras vid bestämda år (simulatorn "är" spelledaren) — den riktiga motorn slumpar
// dem aldrig. (3) Ingen 10 s-paus/UI — händelseköns effekter verkställs direkt (companyEventResolved).
// (4) Fas-timers/prisceremoni simuleras inte (påverkar inte ekonomin). (5) Politiken är en enkel
// "grön satsning vid behov", inte fullt ordförande-flöde.

import { EcoLoco, AREAS, handFor as engineHandFor } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { makeRng, tryTrade, expProfile, resolveStrat, pickOrder } from './bot-strategier.js';

const N = parseInt(process.argv[2]) || 3000;
const VARIANT = (process.argv[3] || 'mellan').toLowerCase();
const FOKUS = (process.argv[4] || 'kort').toLowerCase();
const VCFG = VARIANTS[VARIANT];
if (!VCFG) { console.error(`Okänd variant: ${VARIANT}. Välj flash|mellan|skola.`); process.exit(1); }

// Strategi-/handels-/expansionslogiken ligger i tools/bot-strategier.js (delas med mellan-analys.js).

// Kör ETT parti. opts: { strategies, expansion, vandAr, politics, handel, events, gmPlan, seed }.
function runGame(opts) {
  const { strategies, politics, handel, events, gmPlan, seed } = opts;
  // expansion: sträng (alla lika), karta per lag-id, ELLER opts.expByStrat (karta per RESOLVERAD strategi,
  // för fas-beroende appetit t.ex. mild smutsig fas → aggressiv grön fas). Default 'normal'.
  const expOf = (id, strat) => {
    if (opts.expByStrat) return expProfile(opts.expByStrat[strat] || 'normal');
    return expProfile(typeof opts.expansion === 'string' ? opts.expansion : (opts.expansion?.[id] || 'normal'));
  };
  const vandAr = opts.vandAr;
  const rng = makeRng(seed);
  // Händelse-flaggor: baslinje strippar features helt; annars variantens features.
  const feat = events === 'ingen'
    ? { trade: handel }
    : { ...VCFG.features, trade: handel };
  const engine = new EcoLoco({ ...VCFG, features: feat, seed });

  // — statistik per parti —
  const ids = AREAS.map(a => a.id);
  const z = () => Object.fromEntries(ids.map(i => [i, 0]));
  const stats = {
    trades: z(), tradeVol: z(),
    built: z(), gron: z(), neutral: z(), skadlig: z(),
    byggFail: z(), failPengar: z(), failMaterial: z(), failBada: z(),
    evCount: {}, evClamp: 0, evResDelta: z(),
    ohHist: [], krisOn: 0, krisOff: 0,
    locked: z(),
    yearsPlayed: 0,   // faktiskt spelade år (parti kan sluta tidigt vid kollaps) → byggen/år
  };
  // instrumentering
  engine.on('build', p => { const oh = p.card.oh; stats.built[p.teamId]++; if (oh > 0) stats.gron[p.teamId]++; else if (oh < 0) stats.skadlig[p.teamId]++; else stats.neutral[p.teamId]++; });
  engine.on('companyEvent', p => {
    stats.evCount[p.id] = (stats.evCount[p.id] || 0) + 1;
    for (const r of (p.teams || [])) {
      const t = engine.team(r.teamId); if (!t) continue;
      // clamp-förlust: skulle dra mer än vad laget har
      if (r.dPengar < 0 && t.pengar < -r.dPengar) stats.evClamp++;
      if (r.dMaterial < 0 && t.material < -r.dMaterial) stats.evClamp++;
      stats.evResDelta[r.teamId] += (r.dPengar || 0) + (r.dMaterial || 0);
    }
  });
  engine.on('crisis', p => { if (p.on) stats.krisOn++; else stats.krisOff++; });

  let result = null, collapsed = false;
  engine.on('gameEnd', p => { result = p; if (p.reason && p.reason.includes('kollaps')) collapsed = true; });

  const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 40) engine.companyEventResolved(); };
  const gmByYear = {};
  for (const g of (gmPlan || [])) (gmByYear[g.year] ||= []).push(g.id);

  engine.start();
  while (!engine.getState().over) {
    const S = engine.getState();
    const year = S.round;
    const thr = engine.cfg.redZone;
    // ÅRSGATADE lokala kriser: köa väntande kriser (skada+årskrav uppfyllt) vid byggfasens början (som servern).
    engine.fireDueCrises(); drain();
    // enkel politik: grön satsning när ön mår dåligt
    if (politics === 'gron-vid-behov' && S.oh < 55 && !S.proposal) {
      const by = S.teams[Math.floor(rng() * 4)];
      const pr = engine.openProposal('gron', by.id);
      if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); }
    }
    // byggfas: varje lag bygger FLERA gånger/år (Mellan/Skola obegränsat). VARIANTSTYRD gräns
    // (Flash maxBuildsPerYear=1) kapar taket här OCH nekas auktoritativt av motorns selectCard.
    // Expansionsappetiten (en/forsiktig/normal/aggressiv) styr HUR MÅNGA; strategin styr VILKET kort.
    const byggTak = engine.cfg.maxBuildsPerYear ?? Infinity;
    for (const t of S.teams) {
      const strat = resolveStrat(strategies[t.id], year, vandAr);
      const ec = expOf(t.id, strat);
      let n = 0;   // byggen detta år för laget
      while (n < Math.min(ec.max, byggTak)) {
        const order = pickOrder(strat, handOf(engine, t.id), S.oh, thr, rng);
        let did = false;
        for (const card of order) {
          const kp = card.kp, km = card.km;
          // bygg bara om reserven hålls (egna resurser); annars ev. stretch (nuvarande råd eller handel).
          const ownOk = (t.pengar - kp >= ec.reserveP) && (t.material - km >= ec.reserveM);
          let payOk = ownOk;
          if (!payOk && ec.stretch) {
            payOk = (t.pengar >= kp && t.material >= km) || (handel && tryTrade(engine, t, kp, km, stats));
          }
          if (payOk && engine.selectCard(t.id, card.tier).ok) { did = true; drain(); break; }
        }
        if (!did) break;
        n++;
      }
      if (n === 0) {   // ville bygga men kom inte igång → bygg-fail (samma mått som tidigare)
        stats.byggFail[t.id]++;
        const cheapest = handOf(engine, t.id).reduce((a, b) => (a.kp + a.km <= b.kp + b.km ? a : b));
        const needP = t.pengar < cheapest.kp, needM = t.material < cheapest.km;
        if (needP && needM) stats.failBada[t.id]++; else if (needP) stats.failPengar[t.id]++; else if (needM) stats.failMaterial[t.id]++;
      }
    }
    stats.yearsPlayed++;
    // GM-injektion detta år (simulatorn agerar spelledare)
    for (const gid of (gmByYear[year] || [])) { if (engine.fireGmEvent(gid).ok) drain(); }
    engine.endRound();
    drain();   // öhälsohändelser vid bokslut
    stats.ohHist.push(engine.getState().oh);
  }
  const S = engine.getState();
  // "låst" lag: slutar med < billigaste byggkostnad i båda valutor och ingen produktion
  ids.forEach(id => { const t = engine.team(id); if (t.pengar < 6 && t.material < 6 && t.incP + t.incM === 0) stats.locked[id] = 1; });
  return {
    won: result.won, collapsed, oh: S.oh,
    wealth: Object.fromEntries(S.teams.map(t => [t.id, t.pengar + t.material])),
    pengar: Object.fromEntries(S.teams.map(t => [t.id, t.pengar])),
    material: Object.fromEntries(S.teams.map(t => [t.id, t.material])),
    prod: Object.fromEntries(S.teams.map(t => [t.id, t.incP + t.incM])),
    winner: result.winner.teamId,
    winnerSektor: AREAS.find(a => a.id === result.winner.teamId).sektor,
    ohThresh: { h35: stats.ohHist.some(o => o <= 35), h30: stats.ohHist.some(o => o <= 30), h27: stats.ohHist.some(o => o <= 27), h20: stats.ohHist.some(o => o <= 20) },
    stats,
  };
}

// hand för ett lag (kort-form) — via motorns publika handFor-väg.
function handOf(engine, id) {
  const S = engine.getState();
  return engineHandFor(id).filter(c => !(S.banAllThisRound) && !(S.banDirtyThisRound && c.tier === 'smutsig') && !(S.banDirtySektorThisRound === engine.team(id).sektor && c.tier === 'smutsig'));
}

// — kör ett scenario N gånger, aggregera —
function scenario(namn, opts) {
  const ids = AREAS.map(a => a.id);
  const acc = { won: 0, collapsed: 0, ohSum: 0, wealth: z(), pengar: z(), material: z(), prod: z(),
    winSektor: { material: 0, pengar: 0 }, trades: z(), byggFail: z(), locked: z(),
    gron: z(), skadlig: z(), neutral: z(), built: z(), evCount: {}, evClamp: 0,
    th: { h35: 0, h30: 0, h27: 0, h20: 0 }, krisOn: 0, yearsPlayed: 0 };
  function z() { return Object.fromEntries(ids.map(i => [i, 0])); }
  for (let i = 0; i < N; i++) {
    const r = runGame({ ...opts, seed: (opts.seedBase ?? 1000) + i });
    acc.won += r.won; acc.collapsed += r.collapsed; acc.ohSum += r.oh;
    acc.winSektor[r.winnerSektor]++;
    ids.forEach(id => {
      acc.wealth[id] += r.wealth[id]; acc.pengar[id] += r.pengar[id]; acc.material[id] += r.material[id]; acc.prod[id] += r.prod[id];
      acc.trades[id] += r.stats.trades[id]; acc.byggFail[id] += r.stats.byggFail[id]; acc.locked[id] += r.stats.locked[id];
      acc.gron[id] += r.stats.gron[id]; acc.skadlig[id] += r.stats.skadlig[id]; acc.neutral[id] += r.stats.neutral[id]; acc.built[id] += r.stats.built[id];
    });
    for (const [k, v] of Object.entries(r.stats.evCount)) acc.evCount[k] = (acc.evCount[k] || 0) + v;
    acc.evClamp += r.stats.evClamp; acc.krisOn += r.stats.krisOn; acc.yearsPlayed += r.stats.yearsPlayed;
    for (const k of ['h35', 'h30', 'h27', 'h20']) if (r.ohThresh[k]) acc.th[k]++;
  }
  const pct = x => (100 * x / N).toFixed(1) + '%';
  const av = x => (x / N).toFixed(0);
  const avg = (x, d = 1) => (x / N).toFixed(d);
  console.log(`\n■ ${namn}`);
  console.log(`  Överlever ${pct(acc.won)} · kollaps(0) ${pct(acc.collapsed)} · snitt-slutöhälsa ${avg(acc.ohSum)} · KRIS/parti ${avg(acc.krisOn, 2)}`);
  console.log(`  Öhälsa nådde: ≤35 ${pct(acc.th.h35)} · ≤30 ${pct(acc.th.h30)} · ≤27 ${pct(acc.th.h27)} · ≤20 ${pct(acc.th.h20)}`);
  console.log(`  Förmögenhet:  Åker ${av(acc.wealth.aker)} · Skog ${av(acc.wealth.skog)} | Tundra ${av(acc.wealth.tundra)} · Stad ${av(acc.wealth.stad)}`);
  const m = (acc.wealth.aker + acc.wealth.skog) / (2 * N), p = (acc.wealth.tundra + acc.wealth.stad) / (2 * N);
  console.log(`  Sektor: MATERIAL ${m.toFixed(0)} vs PENGAR ${p.toFixed(0)} (kvot ${(p / m).toFixed(2)}) · vinnare pengar ${pct(acc.winSektor.pengar)}`);
  // BYGGEN/ÅR (DEL 4-nyckeltal): totalt antal byggen per lag och spelat år (yearsPlayed = faktiskt spelade år).
  const tot = ids.reduce((s, id) => s + acc.built[id], 0);
  const teamYears = acc.yearsPlayed * ids.length;   // 4 lag × spelade år
  console.log(`  Byggen/lag/år: ${(tot / teamYears).toFixed(2)} (snitt alla lag) · ${ids.map(id => `${id} ${(acc.built[id] / acc.yearsPlayed).toFixed(2)}`).join(' · ')}`);
  if (FOKUS === 'full') {
    console.log(`  Byggen/parti: Åker ${avg(acc.built.aker)} (${avg(acc.gron.aker)}grön/${avg(acc.skadlig.aker)}smut) · Stad ${avg(acc.built.stad)} (${avg(acc.gron.stad)}grön/${avg(acc.skadlig.stad)}smut)`);
    console.log(`  Handel/parti: Åker ${avg(acc.trades.aker,1)} · Skog ${avg(acc.trades.skog,1)} · Tundra ${avg(acc.trades.tundra,1)} · Stad ${avg(acc.trades.stad,1)}`);
    console.log(`  Bygg-FAIL/parti (ej råd): Åker ${avg(acc.byggFail.aker,1)} · Skog ${avg(acc.byggFail.skog,1)} · Tundra ${avg(acc.byggFail.tundra,1)} · Stad ${avg(acc.byggFail.stad,1)}`);
    console.log(`  Låsta lag (slutläge): ${ids.map(id => `${id} ${pct(acc.locked[id])}`).join(' · ')}`);
    const evs = Object.entries(acc.evCount).sort((a, b) => b[1] - a[1]);
    if (evs.length) console.log(`  Händelser/parti: ${evs.map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(' · ')}`);
    if (acc.evClamp) console.log(`  Clamp-händelser (kunde ej dra fullt belopp): ${avg(acc.evClamp, 2)}/parti`);
  }
}

const alla = s => ({ aker: s, skog: s, tundra: s, stad: s });
const blandade = { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' };   // D: olika per lag

console.log(`Eco Loco — balanssimulering · VARIANT=${VARIANT} (${VCFG.rounds} år) · N=${N}/scenario · fokus=${FOKUS}`);
console.log(`Reproducerbart (seedBase=1000). Reglerna/balansvärdena orörda. Se filhuvudet för förenklingar.`);

// DEL 4 — strategier (med automatiska händelser + handel på)
console.log('\n=== DEL 4: STRATEGIER (automatiska händelser, handel PÅ) ===');
scenario('A· Ekonomisk (alla giriga)', { strategies: alla('girig'), politics: 'ingen', handel: true, events: 'auto' });
scenario('B· Miljövänlig (alla gröna)', { strategies: alla('gron'), politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('C· Blandad (alla adaptiva)', { strategies: alla('adaptiv'), politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('D· Blandade spelare (olika/lag)', { strategies: blandade, politics: 'gron-vid-behov', handel: true, events: 'auto' });

// DEL 4 — handelns betydelse
console.log('\n=== DEL 4: HANDELNS BETYDELSE (blandade spelare) ===');
scenario('Med handel', { strategies: blandade, politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('UTAN handel', { strategies: blandade, politics: 'gron-vid-behov', handel: false, events: 'auto' });

// DEL 5 — händelsebelastning (blandade spelare, handel på, samma frön)
console.log('\n=== DEL 5: HÄNDELSEBELASTNING (blandade spelare) ===');
scenario('Baslinje (inga händelser)', { strategies: blandade, politics: 'gron-vid-behov', handel: true, events: 'ingen' });
scenario('Automatiska (foretag+ohalsa)', { strategies: blandade, politics: 'gron-vid-behov', handel: true, events: 'auto' });
const gmFull = [{ year: 2, id: 'gm_marknadskrasch' }, { year: 3, id: 'gm_ekonomisktstod' }, { year: 4, id: 'gm_braskord' }];
scenario('Fullt system (+GM-händelser)', { strategies: blandade, politics: 'gron-vid-behov', handel: true, events: 'auto', gmPlan: gmFull });
const gmHard = [{ year: 2, id: 'gm_marknadskrasch' }, { year: 3, id: 'gm_leveransstopp' }];
scenario('Hög belastning (giriga + neg GM)', { strategies: alla('girig'), politics: 'ingen', handel: true, events: 'auto', gmPlan: gmHard });

// DEL 4b — EXPANSIONSAPPETIT: hur många byggen/år påverkar ekonomi och överlevnad.
// Blandade spelare, automatiska händelser, handel på. 'en' = gamla simulatorns 1 bygge/år (jämförelse).
console.log('\n=== DEL 4b: EXPANSIONSAPPETIT (blandade spelare, auto-händelser) ===');
scenario('Appetit: EN/år (= gamla simulatorn)', { strategies: blandade, expansion: 'en', politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('Appetit: FÖRSIKTIG', { strategies: blandade, expansion: 'forsiktig', politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('Appetit: NORMAL', { strategies: blandade, expansion: 'normal', politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('Appetit: AGGRESSIV', { strategies: blandade, expansion: 'aggressiv', politics: 'gron-vid-behov', handel: true, events: 'auto' });

// DEL 6 — RÄDDNINGSFRÅGAN: kan företag som börjar smutsigt rädda ön genom att sedan bygga
// FLERA gröna byggnader samma år? Alla fyra spelar 'vand' (girigt→grönt). FAS-BEROENDE appetit
// (expByStrat): MILD smutsig fas (forsiktig) så ön lever kvar till vändningen, AGGRESSIV grön fas
// (bygg så många gröna/år resurserna tillåter). Vändning vid olika år. Jämförs mot "aldrig vändning".
console.log('\n=== DEL 6: RÄDDNING — smutsig start → aggressiv grön vändning ===');
const faser = { girig: 'en', gron: 'aggressiv' };   // smutsig fas MYCKET mild (1/år) · grön fas max
// (a) ALLA FYRA smutsiga → vänder. 4×smutsigt = −24 öh/år → ön kollapsar redan år 2, så bara en
// mycket tidig vändning hinner verka. Visar att räddningen FUNGERAR men att fönstret är smalt.
scenario('Aldrig vändning (alla 4 giriga)', { strategies: alla('girig'), expByStrat: faser, politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('Alla 4 vänder år 2 (direkt)', { strategies: alla('vand'), vandAr: 2, expByStrat: faser, politics: 'gron-vid-behov', handel: true, events: 'auto' });
// (b) REALISTISKT RUM: 2 lag gröna hela tiden (ankare, −12 öh/år mildare lutning) + 2 lag som
// börjar smutsigt och vänder vid olika år. Bredare räddningsfönster → syns hur sent man kan vända.
const mix = (vand) => ({ aker: 'gron', skog: 'gron', tundra: vand, stad: vand });
const vA = 3, vB = Math.max(4, Math.round(VCFG.rounds * 0.5)), vC = Math.max(5, Math.round(VCFG.rounds * 0.7));
scenario(`2 gröna + 2 vänder år ${vA}`, { strategies: mix('vand'), vandAr: vA, expByStrat: faser, politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario(`2 gröna + 2 vänder år ${vB}`, { strategies: mix('vand'), vandAr: vB, expByStrat: faser, politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario(`2 gröna + 2 vänder år ${vC}`, { strategies: mix('vand'), vandAr: vC, expByStrat: faser, politics: 'gron-vid-behov', handel: true, events: 'auto' });
scenario('2 gröna + 2 giriga (vänder aldrig)', { strategies: mix('girig'), expByStrat: faser, politics: 'gron-vid-behov', handel: true, events: 'auto' });

console.log('\n(Kör med fjärde argumentet "full" för byggnads-/handels-/händelse-detaljer per scenario.)');
