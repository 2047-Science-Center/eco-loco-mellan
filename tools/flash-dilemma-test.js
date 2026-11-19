// tools/flash-dilemma-test.js — RIKTAT test för Flashs omarbetade beslutspool (8 beslut, 2026-11-19).
// Verifierar pool-storlek, borttaget koncernerbjudande, de nya dilemmans effekter, urvalshistorik
// per parti, naturreservat_flashs år-villkor + byggförbud, samt att GM-katalogen (Mellan/Skola) är
// oförändrad. Rör INTE Flashs röstningsregler. Assertions → exit 1 vid fel.
//
//   node tools/flash-dilemma-test.js

import { EcoLoco } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { DILEMMAS, dilemmaById } from '../spec/content/dilemmas.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const TEAMS = ['aker', 'skog', 'tundra', 'stad'];
const flashEngine = seed => new EcoLoco({ ...VARIANTS.flash, seed, autoEventAtStart: false });
// Bygg ett giltigt år (ett standard-bygge/lag, Flash tillåter max 1) och gör bokslut → nästa år + nytt beslut.
function buildYear(e) { for (const id of TEAMS) e.selectCard(id, 'standard'); e.endRound(); }

console.log('1) Flashs aktiva pool = exakt 8 beslut; koncernerbjudande UTE, nya + sponsrat INNE');
{
  const e = flashEngine(1); e.start();
  const pool = e._decisionPool().map(p => p.id).sort();
  ok(pool.length === 8, `8 beslut i Flash-poolen (nu ${pool.length})`);
  ok(!pool.includes('koncernerbjudande'), 'koncernerbjudande är UTE ur Flash');
  const want = ['algblomning', 'bra_skord_flash', 'leveransstopp_flash', 'markkonflikt',
                'naturreservat_flash', 'oljefynd', 'sponsrat', 'urskog'].sort();
  ok(JSON.stringify(pool) === JSON.stringify(want), 'exakt rätt åtta id:n i poolen');
  ok(e._decisionPool().find(p => p.id === 'sponsrat')?._kind === 'event', 'sponsrat är en rost-händelse (ja/nej), inte A/B');
}

console.log('2) De fyra nya dilemmans effekter');
{
  const urskog = dilemmaById('urskog');
  const uA = urskog.alternativ.A.effects;
  ok(uA.some(f => f.type === 'resource' && f.target === 'sectorMaterial' && f.currency === 'material' && f.amount === 12 && f.op === 'add'), 'urskog A: Oxen+Björnen +12 material');
  ok(uA.some(f => f.type === 'ohalsa' && f.value === -8), 'urskog A: öhälsa −8');
  ok(urskog.alternativ.B.effects.some(f => f.type === 'ohalsa' && f.value === 4), 'urskog B: öhälsa +4 (spegel av oljefynd)');

  const nat = dilemmaById('naturreservat_flash');
  ok(nat.eligibility && nat.eligibility.notLastRound === true, 'naturreservat_flash: notLastRound (år 1–3)');
  ok(nat.alternativ.A.effects.some(f => f.type === 'ohalsa' && f.value === 12), 'naturreservat_flash A: öhälsa +12');
  ok(nat.alternativ.A.effects.some(f => f.type === 'buildRestriction' && f.scope === 'dirty'), 'naturreservat_flash A: förbjud SMUTSIGT (grönt tillåtet)');
  ok(nat.alternativ.B.effects.length === 0, 'naturreservat_flash B: ingen effekt');

  const lev = dilemmaById('leveransstopp_flash');
  ok(lev.alternativ.A.effects.some(f => f.target === 'sectorMaterial' && f.currency === 'material' && f.amount === 10), 'leveransstopp A: Oxen+Björnen +10 material');
  ok(lev.alternativ.B.effects.some(f => f.target === 'sectorPengar' && f.currency === 'pengar' && f.amount === 10), 'leveransstopp B: Räven+Örnen +10 pengar');
  ok(lev.alternativ.A.effects.some(f => f.type === 'ohalsa' && f.value === -5) && lev.alternativ.B.effects.some(f => f.type === 'ohalsa' && f.value === -5), 'leveransstopp: båda vägar −5 öhälsa (samma miljökostnad)');

  const skord = dilemmaById('bra_skord_flash');
  ok(skord.alternativ.A.effects.some(f => f.target === 'all' && f.currency === 'pengar' && f.amount === 8), 'bra_skord A: alla +8 pengar');
  ok(skord.alternativ.A.effects.some(f => f.type === 'ohalsa' && f.value === -4), 'bra_skord A: öhälsa −4');
  ok(skord.alternativ.B.effects.some(f => f.type === 'ohalsa' && f.value === 10), 'bra_skord B: öhälsa +10');
}

console.log('3) Urval: ett beslut/år, fyra OLIKA per parti, villkor respekteras');
{
  let fourDistinct = true, noNatLast = true, noAlgAtStart = true;
  for (let seed = 1; seed <= 80; seed++) {
    const e = flashEngine(seed); e.start();
    const picks = [e.getState().decisionChoices[0]?.id];   // år 1 (round 1)
    for (let y = 0; y < 3; y++) { buildYear(e); picks.push(e.getState().decisionChoices[0]?.id); }   // år 2,3,4
    if (new Set(picks).size !== 4) fourDistinct = false;
    if (picks[3] === 'naturreservat_flash') noNatLast = false;        // round 4 = sista året
    if (picks[0] === 'algblomning') noAlgAtStart = false;            // round 1: öh=50 ≥ 45 → ej eligible
  }
  ok(fourDistinct, '80 partier: alltid fyra OLIKA beslut (ett per år)');
  ok(noNatLast, 'naturreservat_flash dyker ALDRIG upp sista året (round 4)');
  ok(noAlgAtStart, 'algblomning dyker aldrig upp vid öhälsa 50 (kräver <45)');
}

console.log('4) Historik nollställs per parti (samma beslut kan återkomma i nytt parti)');
{
  const e = flashEngine(3); e.start();
  ok(Array.isArray(e.getState().usedDecisions) && e.getState().usedDecisions.length === 1, 'usedDecisions börjar med årets första beslut');
  buildYear(e); buildYear(e);
  const used = [...e.getState().usedDecisions];
  ok(used.length >= 2, 'historik växer under partiet');
  const e2 = flashEngine(3); e2.start();                 // nytt parti, samma seed
  ok(e2.getState().usedDecisions.length === 1, 'nytt parti → historik nollställd (ingen delning mellan partier)');
}

console.log('5) naturreservat_flash: förbjuder SMUTSIGT nästa år (alla fyra), grönt ok, max 1 bygge, upphör sen');
{
  const e = flashEngine(5); e.start();
  buildYear(e);                                           // → round 2 (ej sista året)
  const res = e.openOradDecision({ id: 'naturreservat_flash', kind: 'dilemma' });
  ok(res.ok, 'naturreservat_flash öppnas i Ö-rådet');
  TEAMS.forEach(id => e.vote(id, 'A'));                   // alla röstar A → bildar reservat
  ok(e.getState().proposal.resolved && e.getState().proposal.outcome === 'A', 'utfall A verkställt');
  ok(e.selectCard('aker', 'smutsig').ok === false, 'smutsigt bygge BLOCKERAT detta år');
  ok(e.selectCard('skog', 'smutsig').ok === false, 'förbudet gäller alla fyra (skog också)');
  const gron = e.selectCard('aker', 'gron');
  ok(gron.ok === true, 'grönt bygge TILLÅTET');
  ok(e.selectCard('aker', 'gron').ok === false, 'Flash: max ETT bygge/lag/år gäller fortfarande');
  // Resten bygger klart + bokslut → nästa år ska släppa förbudet
  ['skog', 'tundra', 'stad'].forEach(id => e.selectCard(id, 'gron'));
  e.endRound();
  ok(e.getState().banDirtyThisRound === false, 'förbudet upphörde efter året');
  ok(e.selectCard('aker', 'smutsig').ok === true, 'smutsigt bygge tillåtet igen året därpå');
}

console.log('6) sponsrat: individuell JA/NEJ oförändrad (varje JA-lag +15, ön −6 vid ≥1 ja)');
{
  const e = flashEngine(9); e.start();
  const before = e.getState().oh;
  const pengarFore = Object.fromEntries(e.getState().teams.map(t => [t.id, t.pengar]));
  const res = e.openOradDecision({ id: 'sponsrat', kind: 'event' });
  ok(res.ok && res.kind === 'event', 'sponsrat öppnas som event (ja/nej), inte A/B');
  e.vote('aker', true); e.vote('skog', true); e.vote('tundra', false); e.vote('stad', false);   // 2 ja
  const S = e.getState();
  ok(S.teams.find(t => t.id === 'aker').pengar === pengarFore.aker + 15, 'JA-lag (aker) +15 pengar');
  ok(S.teams.find(t => t.id === 'tundra').pengar === pengarFore.tundra, 'NEJ-lag (tundra) oförändrat');
  ok(S.oh === before - 6, 'ön −6 öhälsa (minst ett JA)');
}

console.log('7) GM-katalog (Mellan/Skola) oförändrad: flashOnly uteslutna, koncernerbjudande kvar');
{
  const gm = DILEMMAS.filter(d => !d.flashOnly).map(d => d.id).sort();
  ok(JSON.stringify(gm) === JSON.stringify(['algblomning', 'koncernerbjudande', 'markkonflikt', 'oljefynd'].sort()), 'GM-katalogen = de fyra bank-gemensamma (inkl. koncernerbjudande)');
  ok(['urskog', 'naturreservat_flash', 'leveransstopp_flash', 'bra_skord_flash'].every(id => dilemmaById(id).flashOnly === true), 'de fyra nya är flashOnly');
  ok(!!dilemmaById('koncernerbjudande'), 'koncernerbjudande finns kvar i banken (GM kan fortfarande öppna det)');
}

console.log('8) Röstregler (Flash dilemmaStrict): uteblivna räknas inte, oavgjort = inget beslut');
{
  // Öppna ett A/B-dilemma, lägg exakta röster, och (vid behov) tvinga avgörande som serverns timeout.
  function run(id, votes) {   // votes: { teamId: 'A'|'B' } — utelämnade lag = uteblivna (röstar inte)
    const e = flashEngine(5); e.start();
    e.openDilemma(id);
    for (const [t, v] of Object.entries(votes)) e.vote(t, v);
    e.resolveOpenDecision();                 // som forceDilemmaVotes vid tidsutgång (ingen default-fyllnad)
    return e;
  }
  const outc = (id, votes) => run(id, votes).getState().proposal.outcome;

  ok(outc('markkonflikt', { aker: 'A', skog: 'A', tundra: 'A', stad: 'B' }) === 'A', '3–1 → A');
  ok(outc('markkonflikt', { aker: 'B', skog: 'B', tundra: 'B', stad: 'A' }) === 'B', '1–3 → B');
  ok(outc('markkonflikt', { aker: 'A', skog: 'A' }) === 'A', '2–0 (två uteblivna) → A (uteblivna räknas inte som B)');
  ok(outc('markkonflikt', { aker: 'B' }) === 'B', '0–1 (tre uteblivna) → B (uteblivna räknas inte som A)');
  ok(outc('markkonflikt', { aker: 'A', skog: 'A', tundra: 'B', stad: 'B' }) === null, '2–2 → inget beslut');
  ok(outc('markkonflikt', { aker: 'A', skog: 'B' }) === null, '1–1 (två uteblivna) → inget beslut');
  ok(outc('markkonflikt', {}) === null, '0–0 (alla uteblivna) → inget beslut');

  // Inga resurser/öhälsa ändras vid oavgjort (markkonflikt A/B skulle annars flytta öhälsa + pengar).
  {
    const e = flashEngine(5); e.start();
    const ohFore = e.getState().oh;
    const kapFore = e.getState().teams.map(t => t.pengar + t.material);
    e.openDilemma('markkonflikt');
    e.vote('aker', 'A'); e.vote('skog', 'A'); e.vote('tundra', 'B'); e.vote('stad', 'B');   // 2–2
    ok(e.getState().proposal.outcome === null, 'oavgjort → outcome null');
    ok(e.getState().oh === ohFore, 'öhälsa oförändrad vid oavgjort');
    ok(JSON.stringify(e.getState().teams.map(t => t.pengar + t.material)) === JSON.stringify(kapFore), 'inga resurser ändrade vid oavgjort');
  }
  // Inga FRAMTIDA effekter vid oavgjort: naturreservat_flash byggförbud aktiveras INTE.
  {
    const e = flashEngine(5); e.start(); buildYear(e);   // → round 2 (ej sista året)
    e.openDilemma('naturreservat_flash');
    e.vote('aker', 'A'); e.vote('skog', 'A'); e.vote('tundra', 'B'); e.vote('stad', 'B');   // 2–2 → inget beslut
    ok(e.getState().proposal.outcome === null, 'naturreservat oavgjort → inget beslut');
    ok(e.getState().banDirtyThisRound === false, 'byggförbud INTE aktiverat vid oavgjort');
    ok(e.selectCard('aker', 'smutsig').ok === true, 'smutsigt bygge fortfarande tillåtet');
  }
  // Spelet fortsätter normalt efter ett oavgjort beslut.
  {
    const e = flashEngine(5); e.start();
    e.openDilemma('markkonflikt'); e.vote('aker', 'A'); e.vote('skog', 'B'); e.resolveOpenDecision();   // 1–1
    ok(e.getState().proposal.resolved === true, 'beslutet markerat avgjort (inget beslut)');
    const rFore = e.getState().round;
    buildYear(e);
    ok(e.getState().round === rFore + 1, 'nästa år startar normalt efter oavgjort');
  }
}

console.log('9) Mellan/Skola GM-dilemman OFÖRÄNDRADE (ingen dilemmaStrict → oavgjort ger A)');
{
  const m = new EcoLoco({ ...VARIANTS.mellan, seed: 5 }); m.start();
  m.openDilemma('koncernerbjudande');
  m.vote('aker', 'A'); m.vote('skog', 'A'); m.vote('tundra', 'B'); m.vote('stad', 'B');   // 2–2
  ok(m.getState().proposal.outcome === 'A', 'Mellan: 2–2 → A (legacy, oförändrat)');
  ok(m.cfg.dilemmaStrict === undefined, 'Mellan saknar dilemmaStrict-flaggan');
}

console.log(fails === 0 ? '\n[flash-dilemma] ALLA TESTER OK' : `\n[flash-dilemma] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
