// tools/handelsetathet.js — ANALYS av händelsetäthet & negativa spiraler i MELLAN (8 år).
// Svarar på: skapar händelsesystemet för många avbrott eller en för snabb negativ spiral?
// Kör spec/engine.js ORÖRD (inga regler/triggers/effekter/balansvärden ändras) — ren analys/instrumentering.
// Bot-/strategilogik delas med simulatorn via tools/bot-strategier.js.
//
//   node tools/handelsetathet.js           (allt: 1000-partisstatistik + tre exempelpartier)
//   node tools/handelsetathet.js stat       (bara statistiken)
//   node tools/handelsetathet.js exempel     (bara de tre exempelpartierna)
//
// VIKTIGT — vad simulatorn modellerar vs vad som verifierats via KODGRANSKNING (ej körning):
//  • Simulatorn modellerar: VILKA händelser som utlöses, i vilken ORDNING motorn behandlar dem, hur de
//    GRUPPERAS per bygge (kaskad) och per år, samt deras resurs-/öhälsoeffekter (inkl. kö-djup).
//  • Simulatorn modellerar INTE tid: motorn/servern visar varje företagshändelse som EN popup med ~10 s
//    auto-paus (server/server.js rad 428–439: autoPaused + crisisTimer 10000 ms, byggtimern fryses rad 524).
//    Popup-/paustiden nedan är RÄKNAD (10 s × antal popups), inte simulerad. Se rapporten för kodgranskningen.

import { EcoLoco, AREAS, handFor as engineHandFor } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { makeRng, tryTrade, expProfile, resolveStrat, pickOrder } from './bot-strategier.js';

const VCFG = VARIANTS.mellan;
const IDS = AREAS.map(a => a.id);
const NAMN = { aker: 'Åker', skog: 'Skog', tundra: 'Tundra', stad: 'Stad' };
const z = () => Object.fromEntries(IDS.map(i => [i, 0]));
const BLANDADE = { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' };
const CRIS_IDS = new Set(['aker_minor', 'aker_major', 'skog_minor', 'skog_major', 'tundra_minor', 'tundra_major', 'stad_minor', 'stad_major']);
const OHALSA_IDS = new Set(['naturenblomstrar', 'miljolyft', 'varmebolja', 'resursbrist', 'storm']);
const POS_IDS = new Set(['gronafonden', 'expansion', 'gronomstallning', 'framtidsvisionar', 'gemensamsatsning', 'naturenblomstrar', 'miljolyft']);
const CHEAPEST = 8;   // billigaste bygget kostar 8 (smutsig) i en valuta

function handOf(engine, id) {
  const S = engine.getState();
  return engineHandFor(id).filter(c => !(S.banAllThisRound) && !(S.banDirtyThisRound && c.tier === 'smutsig') && !(S.banDirtySektorThisRound === engine.team(id).sektor && c.tier === 'smutsig'));
}

// Kör ETT instrumenterat parti. trace=true → spara år-för-år-händelselogg (för exempelpartier).
// appetit: expansionsprofil (default 'normal'; 'forsiktig' = överlevande lågbygg-regim).
function runGame(seed, withEvents, trace = false, appetit = 'normal') {
  const rng = makeRng(seed);
  const feat = withEvents ? { ...VCFG.features, trade: true } : { trade: true };
  const engine = new EcoLoco({ ...VCFG, features: feat, seed });

  const R = {
    seed,
    evPerYear: {}, buildPhaseEv: {}, bokslutEv: {},   // händelser per år (totalt / byggfas / bokslut)
    cascades: [],                                       // {year, team, size, ids, chain} — events från ETT bygge
    maxBurst: 0,                                        // största burst (händelser från ett triggertillfälle)
    coYear: {}, coCascade: {},                          // samförekomst: par av event-id samma år / samma kaskad
    ohBuild: {}, ohCris: {}, ohUppror: {},              // öhälso-delta per år per källa
    negCount: {}, negLossP: {}, negLossM: {},           // negativa händelser per lag (antal, pengar-, material-förlust)
    multiNegTeamYear: 0, lostAfford: 0,                 // lag med 2+ neg händelser samma år · neg händelse som slog ut bygg-råd
    posCount: z(),
    krisYear: null, oh0Year: null,
    ohByYear: {},                                       // {year:{start,end}} öhälso-bana (för exempel-trace)
    trace: trace ? [] : null,
  };
  for (let y = 1; y <= 8; y++) { R.evPerYear[y] = 0; R.buildPhaseEv[y] = 0; R.bokslutEv[y] = 0; R.ohBuild[y] = 0; R.ohCris[y] = 0; R.ohUppror[y] = 0; }
  for (const id of IDS) { R.negCount[id] = 0; R.negLossP[id] = 0; R.negLossM[id] = 0; }

  let curYear = 0, phase = 'build';          // 'build' | 'bokslut'
  let burst = 0;                              // händelser sedan senaste triggertillfälle (bygge/bokslut)
  let cascadeBuf = null;                      // aktuell bygg-kaskad (nollställs per bygge)
  let yearEvIds = [];                         // event-id:n detta år (för samförekomst)
  const teamNegThisYear = () => { const m = z(); return m; };
  let negPerTeamYear = teamNegThisYear();
  let snapBefore = {};

  const readSnap = () => { for (const id of IDS) { const t = engine.team(id); snapBefore[id] = { p: t.pengar, m: t.material }; } };

  engine.on('roundStart', p => {
    // nästa års roundStart fyrar inuti endRound → bokför det gångna årets neg-per-lag + slut-öhälsa först
    for (const id of IDS) if (negPerTeamYear[id] >= 2) R.multiNegTeamYear++;
    if (curYear) R.ohByYear[curYear].end = engine.getState().oh;
    curYear = p.round; yearEvIds = []; negPerTeamYear = teamNegThisYear();
    R.ohByYear[curYear] = { start: engine.getState().oh, end: null };
  });

  engine.on('companyEvent', p => {
    R.evPerYear[curYear] = (R.evPerYear[curYear] || 0) + 1;
    if (phase === 'build') R.buildPhaseEv[curYear]++; else R.bokslutEv[curYear]++;
    // BURST = händelser från ETT triggertillfälle (ett bygge, eller bokslutet). I verkligt spel visas de
    // en i taget med 10 s-paus → (burst−1) väntar i kön medan en visas. (Motorns kö är tom i simulatorn
    // eftersom drain() betar av direkt; vi mäter bursten i stället, som är det kön faktiskt skulle bli.)
    burst++; if (burst > R.maxBurst) R.maxBurst = burst;
    if (cascadeBuf) { cascadeBuf.size++; cascadeBuf.ids.push(p.id); if (OHALSA_IDS.has(p.id) && phase === 'build') cascadeBuf.chain = true; }
    // samförekomst inom år
    for (const prev of yearEvIds) addPair(R.coYear, prev, p.id);
    yearEvIds.push(p.id);
    // öhälsa-attribution (crises/uppror bär ohalsa; ohalsa-events = 0)
    if (p.ohalsa) { if (CRIS_IDS.has(p.id)) R.ohCris[curYear] += p.ohalsa; else if (p.id === 'uppror') R.ohUppror[curYear] += p.ohalsa; }
    // ekonomisk påverkan per lag (faktisk, inkl clamp) — negativt delta = förlust
    for (const r of (p.teams || [])) {
      const dP = r.dPengar || 0, dM = r.dMaterial || 0;
      if (dP < 0 || dM < 0) {
        R.negCount[r.teamId]++; negPerTeamYear[r.teamId]++;
        R.negLossP[r.teamId] += Math.min(0, dP); R.negLossM[r.teamId] += Math.min(0, dM);
        // slog händelsen ut bygg-rådet? (laget hade råd med billigaste bygget före, inte efter)
        const t = engine.team(r.teamId); const b4 = snapBefore[r.teamId] || { p: t.pengar, m: t.material };
        const couldBefore = b4.p >= CHEAPEST || b4.m >= CHEAPEST;
        const canAfter = t.pengar >= CHEAPEST || t.material >= CHEAPEST;
        if (couldBefore && !canAfter) R.lostAfford++;
      } else if (dP > 0 || dM > 0) R.posCount[r.teamId]++;
    }
    if (R.trace) R.trace.push({ year: curYear, phase, kind: 'event', id: p.id, namn: p.namn, teams: (p.teams || []).map(r => ({ id: r.teamId, dP: r.dPengar || 0, dM: r.dMaterial || 0 })), ohalsa: p.ohalsa || 0, ohAfter: p.ohAfter, qAfter: engine.getState().companyEventQueue.length });
  });

  engine.on('ohalsa', p => {
    if (p.delta === 0) return;
    if (phase === 'bokslut' && !pendingEventOh) R.ohBuild[curYear] += p.delta;   // byggnadernas bokslutsdelta
    pendingEventOh = false;
  });
  let pendingEventOh = false;
  engine.on('companyEvent', p => { if (p.ohalsa) pendingEventOh = true; });
  engine.on('crisis', p => { if (p.on && R.krisYear === null) R.krisYear = curYear; });

  let result = null;
  engine.on('gameEnd', p => { result = p; if (p.reason && p.reason.includes('kollaps') && R.oh0Year === null) R.oh0Year = curYear; });

  // ── kör partiet ──
  const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 60) engine.companyEventResolved(); };
  engine.start();
  while (!engine.getState().over) {
    const S = engine.getState(); const year = S.round; const thr = engine.cfg.redZone;
    phase = 'build';
    engine.fireDueCrises(); drain();   // ÅRSGATADE lokala kriser köas vid byggfasens början (som servern)
    if (S.oh < 55 && !S.proposal) { const by = S.teams[Math.floor(rng() * 4)]; const pr = engine.openProposal('gron', by.id); if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); } }
    for (const t of S.teams) {
      const strat = resolveStrat(BLANDADE[t.id], year); const ec = expProfile(appetit); let n = 0;
      while (n < ec.max) {
        const order = pickOrder(strat, handOf(engine, t.id), S.oh, thr, rng); let did = false;
        for (const card of order) {
          const ownOk = (t.pengar - card.kp >= ec.reserveP) && (t.material - card.km >= ec.reserveM);
          let payOk = ownOk; if (!payOk && ec.stretch) payOk = (t.pengar >= card.kp && t.material >= card.km) || tryTrade(engine, t, card.kp, card.km, null);
          if (payOk) {
            readSnap();                               // tillstånd FÖRE bygget+dess kaskad
            burst = 0;                                // nytt triggertillfälle
            cascadeBuf = { year, team: t.id, size: 0, ids: [], chain: false };
            if (engine.selectCard(t.id, card.tier).ok) {
              did = true; drain();
              if (cascadeBuf.size > 0) { R.cascades.push(cascadeBuf); for (let i = 0; i < cascadeBuf.ids.length; i++) for (let j = i + 1; j < cascadeBuf.ids.length; j++) addPair(R.coCascade, cascadeBuf.ids[i], cascadeBuf.ids[j]); }
              cascadeBuf = null; break;
            }
            cascadeBuf = null;
          }
        }
        if (!did) break; n++;
      }
    }
    phase = 'bokslut'; readSnap(); burst = 0;   // bokslutet = nytt triggertillfälle (byggnadströsklar + miljölyft)
    engine.endRound(); drain();
  }
  for (const id of IDS) if (negPerTeamYear[id] >= 2) R.multiNegTeamYear++;   // sista året
  if (curYear && R.ohByYear[curYear]) R.ohByYear[curYear].end = engine.getState().oh;
  R.yearsPlayed = Math.min(curYear, 8);
  R.won = result?.won; R.result = result; R.finalOh = engine.getState().oh;
  return R;
}
function addPair(obj, a, b) { const k = [a, b].sort().join(' + '); obj[k] = (obj[k] || 0) + 1; }

// ═══════════ 1000-partisstatistik (DEL 2–8) ═══════════
function statistik() {
  const N = 1000;
  const games = [], gamesNo = [];
  for (let i = 0; i < N; i++) { games.push(runGame(1000 + i, true)); gamesNo.push(runGame(1000 + i, false)); }

  // DEL 2 — händelser per parti/år
  const perGame = games.map(g => IDS.length && Object.values(g.evPerYear).reduce((a, b) => a + b, 0));
  const yearCounts = [];                 // alla (parti,år)-par: antal händelser
  const yearByNr = Array.from({ length: 9 }, () => []);
  for (const g of games) for (let y = 1; y <= 8; y++) { if (y <= g.yearsPlayed) { yearCounts.push(g.evPerYear[y]); yearByNr[y].push(g.evPerYear[y]); } }
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => a.length ? sum(a) / a.length : 0;
  const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const bucket = a => { const b = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 }; for (const x of a) b[x >= 5 ? '5+' : x]++; return b; };

  console.log('\n════════ DEL 2 · HÄNDELSER PER PARTI OCH ÅR (1000 Mellan, blandade, normal, auto-händelser) ════════');
  console.log(`Snitt händelser/parti: ${mean(perGame).toFixed(1)} · snitt/spelat år: ${mean(yearCounts).toFixed(2)}`);
  console.log(`Per år: median ${pct(yearCounts, 0.5)} · 90:e percentil ${pct(yearCounts, 0.9)} · MAX under ett år ${Math.max(...yearCounts)}`);
  const b = bucket(yearCounts); const ty = yearCounts.length;
  console.log(`Andel spelår med N händelser: 0 ${p(b[0], ty)} · 1 ${p(b[1], ty)} · 2 ${p(b[2], ty)} · 3 ${p(b[3], ty)} · 4 ${p(b[4], ty)} · 5+ ${p(b['5+'], ty)}`);
  const g3 = games.filter(g => Object.values(g.evPerYear).some(c => c >= 3)).length;
  const g5 = games.filter(g => Object.values(g.evPerYear).some(c => c >= 5)).length;
  console.log(`Andel partier med minst ett år ≥3 händelser: ${p(g3, N)} · ≥5 händelser: ${p(g5, N)}`);
  console.log('\nFördelning per spelår (snitt händelser/år, och andel byggfas vs bokslut):');
  console.log('| År | Snitt ev | median | p90 | max | varav byggfas | varav bokslut | partier kvar |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (let y = 1; y <= 8; y++) {
    const arr = yearByNr[y]; if (!arr.length) continue;
    const bp = mean(games.filter(g => y <= g.yearsPlayed).map(g => g.buildPhaseEv[y]));
    const bo = mean(games.filter(g => y <= g.yearsPlayed).map(g => g.bokslutEv[y]));
    console.log(`| ${y} | ${mean(arr).toFixed(2)} | ${pct(arr, 0.5)} | ${pct(arr, 0.9)} | ${Math.max(...arr)} | ${bp.toFixed(2)} | ${bo.toFixed(2)} | ${arr.length} |`);
  }
  console.log('⚠ TOLKNING: blandade+normal KOLLAPSAR ön år 1–2 (byggandet), så nästan alla händelser kläms');
  console.log('  in i år 1:s enda byggfas INNAN kollaps. "Många händelser/år" = "allt i år 1" här, inte jämnt över 8 år.');

  // DEL 2b — ÖVERLEVANDE lågbygg-regim (försiktig) → hur sprider sig händelserna över HELA 8 år?
  const surv = [];
  for (let i = 0; i < 1000; i++) surv.push(runGame(1000 + i, true, false, 'forsiktig'));
  const survYears = surv.map(g => g.yearsPlayed);
  const survYearCounts = []; const survByNr = Array.from({ length: 9 }, () => []);
  for (const g of surv) for (let y = 1; y <= 8; y++) if (y <= g.yearsPlayed) { survYearCounts.push(g.evPerYear[y]); survByNr[y].push(g.evPerYear[y]); }
  console.log('\n── Jämförelse: ÖVERLEVANDE regim (försiktig expansion, ~0,3 bygg/lag/år, partier når i snitt ' + mean(survYears).toFixed(1) + ' år) ──');
  console.log(`Snitt händelser/parti: ${mean(surv.map(g => sum(Object.values(g.evPerYear)))).toFixed(1)} · snitt/spelat år: ${mean(survYearCounts).toFixed(2)} · median/år ${pct(survYearCounts, 0.5)} · p90 ${pct(survYearCounts, 0.9)} · max/år ${Math.max(...survYearCounts)}`);
  console.log('Snitt händelser/år per spelår 1–8: ' + [1, 2, 3, 4, 5, 6, 7, 8].map(y => survByNr[y].length ? mean(survByNr[y]).toFixed(1) : '–').join(' · '));
  console.log('→ När ön LEVER sprids händelserna ut (få/år); den höga tätheten i normal-regimen är en följd av kollapsen, inte av 8 års spel.');

  // DEL 3 — byggfas/kaskad/kö
  console.log('\n════════ DEL 3 · HÄNDELSER PER BYGGFAS OCH KASKAD ════════');
  const allCasc = games.flatMap(g => g.cascades);
  const cascSizes = allCasc.map(c => c.size);
  const multiCasc = allCasc.filter(c => c.size >= 2);
  const buildPhaseTotals = games.flatMap(g => Object.values(g.buildPhaseEv));   // per år
  console.log(`Byggfas-händelser/år: snitt ${mean(buildPhaseTotals).toFixed(2)} · max ${Math.max(...buildPhaseTotals)}`);
  console.log(`Kaskader (händelser EFTER ETT enda bygge): ${allCasc.length} st över ${N} partier (${(allCasc.length / N).toFixed(2)}/parti)`);
  console.log(`  varav flera (≥2) händelser från samma bygge: ${multiCasc.length} (${p(multiCasc.length, allCasc.length)} av kaskaderna) · största kaskad ${Math.max(...cascSizes)} händelser`);
  const cb = bucket(cascSizes);
  console.log(`  kaskadstorlek: 1 ${p(cb[1], cascSizes.length)} · 2 ${p(cb[2], cascSizes.length)} · 3 ${p(cb[3], cascSizes.length)} · 4 ${p(cb[4], cascSizes.length)} · 5+ ${p(cb['5+'], cascSizes.length)}`);
  const maxBurst = Math.max(...games.map(g => g.maxBurst));
  console.log(`Längsta BURST (händelser från ETT triggertillfälle) = ${maxBurst} → i verkligt spel väntar ${maxBurst - 1} i kö medan en visas.`);
  console.log(`Andel partier med burst ≥2 (minst en gång kö): ${p(games.filter(g => g.maxBurst >= 2).length, N)} · ≥3: ${p(games.filter(g => g.maxBurst >= 3).length, N)}`);
  console.log('OBS kodgranskning: motorn köar ALLA kvalificerade händelser (ingen gräns/byggfas); servern visar dem en i taget');
  console.log('med 10 s auto-paus (crisisTimer) och fryser byggtimern → köade händelser visas EFTER att byggfasen "känns" slut.');

  // DEL 4 — samförekomst
  console.log('\n════════ DEL 4 · VANLIGASTE HÄNDELSEKOMBINATIONER ════════');
  const coY = {}; for (const g of games) for (const [k, v] of Object.entries(g.coYear)) coY[k] = (coY[k] || 0) + v;
  const coC = {}; for (const g of games) for (const [k, v] of Object.entries(g.coCascade)) coC[k] = (coC[k] || 0) + v;
  console.log('Samma ÅR (par, antal partier-förekomster, topp 12):');
  for (const [k, v] of Object.entries(coY).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${k}  ×${v}  (${p(v, N)} av partierna)`);
  console.log('Samma BYGGE/kaskad (par som utlöstes av ETT bygge, topp 8):');
  const coCsorted = Object.entries(coC).sort((a, b) => b[1] - a[1]);
  if (coCsorted.length) for (const [k, v] of coCsorted.slice(0, 8)) console.log(`   ${k}  ×${v}`);
  else console.log('   (inga par från ett enda bygge)');

  // DEL 5 — kedjereaktioner A/B/C
  console.log('\n════════ DEL 5 · KEDJEREAKTIONER (A gemensam trigger · B kedja · C oberoende) ════════');
  const A = allCasc.filter(c => c.size >= 2 && !c.chain).length;    // ett bygge → flera direkta
  const B = allCasc.filter(c => c.chain).length;                   // ett bygge → kris → öhälsotröskel → öhälsohändelse
  console.log(`A · Gemensam trigger (ett bygge utlöser ≥2 direkta händelser): ${A} kaskader (${(A / N).toFixed(2)}/parti)`);
  console.log(`B · Kedjereaktion (en händelses öhälso-smäll utlöser en öhälsohändelse): ${B} kaskader (${(B / N).toFixed(2)}/parti, ${p(games.filter(g => g.cascades.some(c => c.chain)).length, N)} av partierna)`);
  const indepYears = games.flatMap(g => { const out = []; for (let y = 1; y <= g.yearsPlayed; y++) { const nC = g.cascades.filter(c => c.year === y).length; if (nC >= 2) out.push(1); } return out; }).length;
  console.log(`C · Oberoende (≥2 olika byggen/lag utlöser händelser samma år): ${indepYears} (parti,år)-fall`);

  // DEL 6 — öhälso-attribution + med/utan händelser
  console.log('\n════════ DEL 6 · HUR STOR DEL AV ÖHÄLSOFÖRÄNDRINGEN ÄR HÄNDELSER ════════');
  const totBuild = mean(games.map(g => sum(Object.values(g.ohBuild))));
  const totCris = mean(games.map(g => sum(Object.values(g.ohCris))));
  const totUpp = mean(games.map(g => sum(Object.values(g.ohUppror))));
  console.log(`Snitt öhälso-delta/parti (brutto, före clamp 0–100):`);
  console.log(`   Byggnader: ${totBuild.toFixed(1)} · Företagskriser: ${totCris.toFixed(1)} · UPPROR: ${totUpp.toFixed(1)} · Öhälsohändelser (värmebölja/storm m.fl.): 0 (alla har ohalsa=0)`);
  const evOhShare = (Math.abs(totCris) + Math.abs(totUpp)) / (Math.abs(totBuild) + Math.abs(totCris) + Math.abs(totUpp));
  console.log(`   → Händelser står för ${(100 * evOhShare).toFixed(0)} % av den NEGATIVA öhälsopåverkan; byggnader för resten.`);
  const krisWith = games.filter(g => g.krisYear).map(g => g.krisYear), krisNo = gamesNo.filter(g => g.krisYear).map(g => g.krisYear);
  const oh0With = games.filter(g => g.oh0Year).map(g => g.oh0Year), oh0No = gamesNo.filter(g => g.oh0Year).map(g => g.oh0Year);
  console.log(`\nMed vs UTAN automatiska händelser (samma frön):`);
  console.log(`   KRIS (öhälsa ≤20): MED ${p(krisWith.length, N)} av partier, snittår ${mean(krisWith).toFixed(1)} · UTAN ${p(krisNo.length, N)}, snittår ${mean(krisNo).toFixed(1)}`);
  console.log(`   Kollaps (öhälsa 0): MED ${p(oh0With.length, N)}, snittår ${mean(oh0With).toFixed(1)} · UTAN ${p(oh0No.length, N)}, snittår ${mean(oh0No).toFixed(1)}`);
  // kollaps-tidpunkt (snitt) är den tydligaste "hur mycket snabbare": normal-regimen kollapsar av bygget,
  // händelserna tidigarelägger kollapsen från år ~1,8 till ~1,2 (≈0,6 år). KRIS-bandet (≤20) hoppas ofta
  // över MED händelser eftersom öhälsan störtar förbi 20 rakt till 0 (därav lägre KRIS-andel men tidigare 0).
  let deltaColl = 0, nC = 0;
  for (let i = 0; i < N; i++) { const a = games[i].oh0Year, b = gamesNo[i].oh0Year; if (a && b) { nC++; deltaColl += (b - a); } }
  console.log(`   → Händelser tidigarelägger kollapsen i snitt ${(deltaColl / nC).toFixed(2)} år (normal-regim; bygget driver, händelserna påskyndar).`);
  // ÖVERLEVANDE regim: här kollapsar INTE bygget ensamt → händelsernas marginal syns rent.
  const sF = [], sFno = [];
  for (let i = 0; i < 1000; i++) { sF.push(runGame(1000 + i, true, false, 'forsiktig')); sFno.push(runGame(1000 + i, false, false, 'forsiktig')); }
  const fin = a => mean(a.map(g => g.finalOh));
  console.log(`\n   Överlevande regim (försiktig) MED vs UTAN händelser (samma frön):`);
  console.log(`      Slut-öhälsa: MED ${fin(sF).toFixed(1)} · UTAN ${fin(sFno).toFixed(1)} (skillnad ${(fin(sF) - fin(sFno)).toFixed(1)} = händelsernas netto-öhälsobidrag)`);
  console.log(`      KRIS-andel: MED ${p(sF.filter(g => g.krisYear).length, 1000)} · UTAN ${p(sFno.filter(g => g.krisYear).length, 1000)} · Kollaps: MED ${p(sF.filter(g => g.oh0Year).length, 1000)} · UTAN ${p(sFno.filter(g => g.oh0Year).length, 1000)}`);

  // DEL 7 — ekonomisk påverkan per företag
  console.log('\n════════ DEL 7 · EKONOMISK PÅVERKAN PER FÖRETAG (negativa händelser) ════════');
  console.log('| Företag | Neg händelser/parti | Pengar-förlust/parti | Material-förlust/parti | Positiva händelser/parti |');
  console.log('|---|---|---|---|---|');
  for (const id of IDS) {
    console.log(`| ${NAMN[id]} | ${mean(games.map(g => g.negCount[id])).toFixed(2)} | ${mean(games.map(g => g.negLossP[id])).toFixed(1)} | ${mean(games.map(g => g.negLossM[id])).toFixed(1)} | ${mean(games.map(g => g.posCount[id])).toFixed(2)} |`);
  }
  console.log(`Lag med 2+ negativa händelser SAMMA år: ${(mean(games.map(g => g.multiNegTeamYear))).toFixed(2)} (lag,år)-fall/parti`);
  console.log(`Negativ händelse som slog ut bygg-rådet (lag → kunde ej bygga billigaste efteråt): ${mean(games.map(g => g.lostAfford)).toFixed(2)}/parti`);

  // DEL 8 — popup/paustid (RÄKNAD, 10 s/popup)
  console.log('\n════════ DEL 8 · POPUP- & PAUSTID (räknad: 10 s/popup, byggtimern fryses) ════════');
  console.log('OBS: varje företagshändelse = 1 popup med ~10 s auto-paus (server/server.js rad 428–439). Gäller även POSITIVA.');
  console.log(`Snitt EXTRA händelsetid/byggfas (år): ${(mean(buildPhaseTotals) * 10).toFixed(0)} s (${mean(buildPhaseTotals).toFixed(2)} popups × 10 s)`);
  console.log(`Värsta observerade byggfas: ${Math.max(...buildPhaseTotals)} popups = ${Math.max(...buildPhaseTotals) * 10} s extra`);
  const bp3 = buildPhaseTotals.filter(x => x >= 3).length;
  console.log(`Andel (parti,år)-byggfaser med ≥3 popups: ${p(bp3, buildPhaseTotals.length)}`);
  console.log(`Snitt popups/HELA partiet: ${mean(perGame).toFixed(1)} = ~${(mean(perGame) * 10).toFixed(0)} s total händelse-paustid utspritt över partiet.`);
}
function p(n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '0%'; }

// ═══════════ Tre exempelpartier (DEL 9) ═══════════
function exempel() {
  // scanna frön → välj typiskt (median-tät), händelsetätt (störst byggfas), spiral (flest neg öhälsa tidigt)
  const scan = [];
  for (let i = 0; i < 400; i++) { const g = runGame(1000 + i, true); const maxBuildPhase = Math.max(...Object.values(g.buildPhaseEv)); const tot = Object.values(g.evPerYear).reduce((a, b) => a + b, 0); scan.push({ seed: 1000 + i, tot, maxBuildPhase, kris: g.krisYear, oh0: g.oh0Year }); }
  const med = [...scan].sort((a, b) => a.tot - b.tot)[Math.floor(scan.length / 2)];
  const tat = [...scan].sort((a, b) => b.maxBuildPhase - a.maxBuildPhase)[0];
  // C · negativ spiral i ett ÖVERLEVANDE parti (försiktig) som når KRIS → syns öhälso-bana över flera år
  const scanF = [];
  for (let i = 0; i < 400; i++) { const g = runGame(1000 + i, true, false, 'forsiktig'); scanF.push({ seed: 1000 + i, kris: g.krisYear, years: g.yearsPlayed, finalOh: g.finalOh }); }
  const spiral = [...scanF].filter(s => s.kris && s.years >= 6).sort((a, b) => a.finalOh - b.finalOh)[0] || scanF.find(s => s.kris);
  console.log('\n════════ DEL 9 · TRE EXEMPELPARTIER ════════');
  printTrace('A · TYPISKT (normal, händelsemängd nära median)', runGame(med.seed, true, true));
  printTrace('B · HÄNDELSETÄTT (normal, flest händelser i en byggfas)', runGame(tat.seed, true, true));
  if (spiral) printTrace('C · NEGATIV SPIRAL (försiktig, överlever men når KRIS)', runGame(spiral.seed, true, true, 'forsiktig'), true);
}
function printTrace(label, g, multiYear = false) {
  console.log(`\n────────── ${label} ·  frö ${g.seed} ──────────`);
  const tot = Object.values(g.evPerYear).reduce((a, b) => a + b, 0);
  console.log(`Totalt ${tot} händelser · KRIS år ${g.krisYear || '—'} · kollaps år ${g.oh0Year || '—'} · slut-öhälsa ${g.finalOh} · ${g.won ? 'ÖVERLEVDE' : 'ön klarade ej tröskeln'}`);
  // hitta mest händelsetäta året
  let tatY = 1, tatN = -1; for (let y = 1; y <= 8; y++) if ((g.evPerYear[y] || 0) > tatN) { tatN = g.evPerYear[y]; tatY = y; }
  console.log(`Händelser/år: ${[1, 2, 3, 4, 5, 6, 7, 8].map(y => g.evPerYear[y] ?? '–').join(' · ')}  (tätast år ${tatY}: ${tatN} händelser)`);
  if (multiYear) {
    const path = [];
    for (let y = 1; y <= g.yearsPlayed; y++) { const o = g.ohByYear[y]; if (o) path.push(`år ${y}: ${o.start}→${o.end} (${g.evPerYear[y] || 0} ev)`); }
    console.log(`Öhälso-bana: ${path.join(' · ')}`);
  }
  console.log(`\nKRONOLOGISK HÄNDELSELOGG år ${tatY} (exakt motorns behandlingsordning, fas = byggfas/bokslut):`);
  const rows = g.trace.filter(r => r.year === tatY);
  if (!rows.length) { console.log('   (inga händelser detta år)'); return; }
  for (const r of rows) {
    const who = r.teams.filter(t => t.dP || t.dM).map(t => `${t.id} ${t.dP ? (t.dP > 0 ? '+' : '') + t.dP + '🪙' : ''}${t.dM ? ' ' + (t.dM > 0 ? '+' : '') + t.dM + '🧱' : ''}`.trim()).join(', ') || '(ingen resurs)';
    console.log(`   [${r.phase === 'build' ? 'byggfas' : 'bokslut'}] ${r.namn} → ${who}${r.ohalsa ? ` · öhälsa ${r.ohalsa > 0 ? '+' : ''}${r.ohalsa}→${r.ohAfter}` : ''}${r.qAfter ? ` · ${r.qAfter} i kö` : ''}`);
  }
  console.log(`   = ${rows.length} popups detta år ≈ ${rows.length * 10} s auto-paus (varav byggfas: ${rows.filter(r => r.phase === 'build').length}).`);
}

const MODE = (process.argv[2] || 'allt').toLowerCase();
console.log(`Eco Loco — händelsetäthet & negativa spiraler · MELLAN (8 år) · reproducerbart (seedBase 1000)`);
console.log(`Motorn/reglerna/triggers ORÖRDA. Tid (10 s/popup) är RÄKNAD, inte simulerad — se kodgranskning i rapporten.`);
if (MODE === 'allt' || MODE === 'stat') statistik();
if (MODE === 'allt' || MODE === 'exempel') exempel();
