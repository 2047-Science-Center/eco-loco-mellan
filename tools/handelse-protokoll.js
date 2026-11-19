// tools/handelse-protokoll.js — LÄSBARA SPELPROTOKOLL för Mellan (8 år), bygge för bygge.
// Syfte: kunna läsa ett parti som om man satt bredvid barnen. För VARJE bygge visas orsakskedjan
//   Byggnad → resursförändring → miljöpåverkan → uppfyllt händelsevillkor → händelse → konsekvens,
// och vid bokslut: årets samlade miljöpåverkan → ny öhälsa → kvalificerade öhälsohändelser → när de visas.
// Kör spec/engine.js ORÖRD i nuvarande läge (ohalsaDelayed=true). Ingen regel/effekt/tröskel ändrad.
//
//   node tools/handelse-protokoll.js            (skannar fram + skriver ut ett byggtätt och ett lugnt parti)
//   node tools/handelse-protokoll.js scan        (bara seed-skanningen, för att välja frön)
//   node tools/handelse-protokoll.js <seed> <appetit> <ar>   (ett valt parti, N första åren)
//
// "Byggtätt" = normal appetit (bygger fort). "Lugnt" = försiktig appetit (färre byggen, blandar grönt/smutsigt).

import { EcoLoco, AREAS, handFor as engineHandFor } from '../spec/engine.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { makeRng, tryTrade, expProfile, resolveStrat, pickOrder } from './bot-strategier.js';
import { ohalsaEventById } from '../spec/content/ohalsa-events.js';
import { COMPANY_CRISES } from '../spec/content/company-crises.js';

const VCFG = VARIANTS.mellan;
const IDS = AREAS.map(a => a.id);
const NAMN = { aker: 'Åker (Oxen)', skog: 'Skog (Björnen)', tundra: 'Tundra (Räven)', stad: 'Stad (Örnen)' };
const SEKTOR = Object.fromEntries(AREAS.map(a => [a.id, a.sektor]));
const BLANDADE = { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' };
const CRIS_IDS = new Set(['aker_minor', 'aker_major', 'skog_minor', 'skog_major', 'tundra_minor', 'tundra_major', 'stad_minor', 'stad_major']);
const OHALSA_IDS = new Set(['naturenblomstrar', 'miljolyft', 'varmebolja', 'resursbrist', 'storm']);
const BUILD_BUDGET = VCFG.phases?.bygga ?? 100;
const DELAY = VCFG.ohalsaDelaySeconds || 30;
const SLOTS = Math.max(0, Math.ceil(BUILD_BUDGET / DELAY) - 1);
const r2 = v => (v > 0 ? '+' : '') + v;

function handOf(engine, id) {
  const S = engine.getState();
  return engineHandFor(id).filter(c => !(S.banAllThisRound) && !(S.banDirtyThisRound && c.tier === 'smutsig') && !(S.banDirtySektorThisRound === engine.team(id).sektor && c.tier === 'smutsig'));
}
const tierTxt = t => t === 'gron' ? 'GRÖN' : t === 'smutsig' ? 'SMUTSIG' : 'standard';
const ohTxt = oh => oh > 0 ? `grön (+${oh} öhälsa)` : oh < 0 ? `miljöskadlig (${oh} öhälsa)` : 'neutral (0 öhälsa)';

// Förklara VILKET villkor en företagshändelse uppfyllde (för orsakskedjan). cfg = motorns krisparametrar.
function villkorFor(id, t, cfg) {
  switch (id) {
    case 'gronafonden': return `villkor: 3 gröna byggen totalt (nu ${t.gronBuilt})`;
    case 'expansion': return `villkor: 3:e bygget samma år (nu ${t._builtThisYear})`;
    case 'gronomstallning': return `villkor: grön-svit ≥2 efter ≥2 skadliga (skadliga ${t.dirtyBuilt})`;
    case 'framtidsvisionar': return `villkor: grön-svit ≥2 och laget ligger sist`;
    case 'gemensamsatsning': return `villkor: alla fyra lag byggt ≥1 grön i år`;
    case 'uppror': return `villkor: rikast med ≥30 marginal`;
    default:
      if (CRIS_IDS.has(id)) {
        const grad = id.endsWith('_major') ? 'major' : 'minor';
        const thr = (cfg.companyCrisisThreshold || {})[grad], yr = (cfg.companyCrisisMinRound || {})[grad];
        return `villkor: ackumulerad miljöskada ${t.impactNeg} ≤ ${thr} OCH år ≥ ${yr}`;
      }
      return '';
  }
}
// Kriser vars TRÖSKEL är passerad men som VÄNTAR på sitt årskrav (för markeringen "väntar på år X").
function vantandeKriser(engine, teamId) {
  const t = engine.team(teamId), cfg = engine.cfg, out = [];
  for (const c of COMPANY_CRISES) {
    if (c.region !== teamId) continue;
    if (engine.getState().firedCompanyEvents.includes(c.id)) continue;
    const grad = c.grad || (c.id.endsWith('_major') ? 'major' : 'minor');
    const thr = (cfg.companyCrisisThreshold || {})[grad], yr = (cfg.companyCrisisMinRound || {})[grad];
    if (t.impactNeg <= thr && engine.getState().round < yr) out.push({ namn: c.namn, grad, yr });
  }
  return out;
}

// Kör ETT parti och bygg upp ett strukturerat protokoll (per år: byggen + bokslut).
function protokoll(seed, appetit, strategies = BLANDADE) {
  const rng = makeRng(seed);
  const engine = new EcoLoco({ ...VCFG, features: { ...VCFG.features, trade: true }, seed });
  const years = {};   // {year: {builds:[], bokslut:{}, shown:[]}}
  let curYear = 0, mode = 'build', curBuild = null;

  const ensureYear = y => (years[y] ||= { builds: [], bokslut: null, shown: [], yearStartCrises: [] });

  engine.on('roundStart', p => { curYear = p.round; ensureYear(curYear); });
  engine.on('companyEvent', p => {
    const rec = { id: p.id, namn: p.namn, warn: p.warn, ohalsa: p.ohalsa || 0, ohAfter: p.ohAfter,
      teams: (p.teams || []).map(x => ({ id: x.teamId, dP: x.dPengar || 0, dM: x.dMaterial || 0 })) };
    if (mode === 'crisis-start') { rec.villkor = villkorFor(p.id, engine.team(p.teamId), engine.cfg); ensureYear(curYear).yearStartCrises.push(rec); }
    else if (mode === 'build' && curBuild) { rec.villkor = villkorFor(p.id, engine.team(curBuild.teamId), engine.cfg); curBuild.events.push(rec); }
    else if (mode === 'ohalsa-show') ensureYear(curYear).shown.push(rec);
    else ensureYear(curYear).bokslutEvents?.push(rec);
  });

  const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 60) engine.companyEventResolved(); };
  engine.start();
  while (!engine.getState().over) {
    const S = engine.getState(); const year = S.round; const thr = engine.cfg.redZone;
    mode = 'build';
    // ÅRSGATADE lokala kriser: köa väntande kriser (tröskel passerad tidigare år, årskravet nu uppfyllt)
    mode = 'crisis-start'; engine.fireDueCrises(); drain();
    // politik: grön satsning vid behov (loggas separat kort)
    mode = 'build';
    if (S.oh < 55 && !S.proposal) { const by = S.teams[Math.floor(rng() * 4)]; const pr = engine.openProposal('gron', by.id); if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); } }
    // visa fördröjda öhälsohändelser från förra bokslutet (aktiv-tids-slots)
    mode = 'ohalsa-show';
    let slot = 0; while (slot < SLOTS && engine.getState().pendingOhalsa.length) { if (!engine.fireNextPendingOhalsa().ok) break; drain(); slot++; }
    mode = 'build';
    for (const t of S.teams) {
      const strat = resolveStrat(strategies[t.id], year); const ec = expProfile(appetit); let n = 0;
      while (n < ec.max) {
        const order = pickOrder(strat, handOf(engine, t.id), S.oh, thr, rng); let did = false;
        for (const card of order) {
          const ownOk = (t.pengar - card.kp >= ec.reserveP) && (t.material - card.km >= ec.reserveM);
          let payOk = ownOk; if (!payOk && ec.stretch) payOk = (t.pengar >= card.kp && t.material >= card.km) || tryTrade(engine, t, card.kp, card.km, null);
          if (payOk) {
            const beforeP = t.pengar, beforeM = t.material, beforeNeg = t.impactNeg;
            curBuild = { teamId: t.id, events: [] };
            const res = engine.selectCard(t.id, card.tier);
            if (res.ok) {
              did = true; drain();
              ensureYear(year).builds.push({
                teamId: t.id, namn: card.namn, tier: card.tier, oh: card.oh,
                kp: card.kp, km: card.km, beforeP, beforeM, afterP: t.pengar, afterM: t.material,
                gp: card.gp, gm: card.gm, impactNegBefore: beforeNeg, impactNegAfter: t.impactNeg,
                events: curBuild.events, vantar: vantandeKriser(engine, t.id),   // trösklar passerade men väntar på årskrav
              });
              curBuild = null; break;
            }
            curBuild = null;
          }
        }
        if (!did) break; n++;
      }
    }
    // bokslut
    mode = 'bokslut';
    ensureYear(year).bokslutEvents = [];
    const ohBefore = S.oh;
    const prodBefore = Object.fromEntries(S.teams.map(t => [t.id, { p: t.pengar, m: t.material }]));
    const pendBefore = engine.getState().pendingOhalsa.slice();
    engine.endRound(); drain();
    const after = engine.getState();
    ensureYear(year).bokslut = {
      ohBefore, ohAfter: after.oh, delta: after.oh - ohBefore,
      prod: Object.fromEntries(S.teams.map(t => { const b = prodBefore[t.id]; const tt = after.teams.find(x => x.id === t.id); return [t.id, { dP: tt.pengar - b.p, dM: tt.material - b.m }]; })),
      qualified: after.pendingOhalsa.filter(x => !pendBefore.includes(x)),
    };
    ensureYear(year).builtThisYearImpact = Object.fromEntries(S.teams.map(t => [t.id, t._roundOh]));
  }
  const fin = engine.getState();
  return { seed, appetit, years, finalOh: fin.oh, won: engine.getState().over ? fin.oh >= engine.cfg.threshold : null, yearsPlayed: Math.min(curYear, 8) };
}

// ── Utskrift av ett protokoll (N första åren) ──
function skriv(P, label, maxYears = 3) {
  console.log(`\n\n══════════════════════════════════════════════════════════════════`);
  console.log(`${label}`);
  console.log(`Frö ${P.seed} · appetit ${P.appetit} · spelade ${P.yearsPlayed} år · slut-öhälsa ${P.finalOh}`);
  console.log(`══════════════════════════════════════════════════════════════════`);
  const ymax = Math.min(maxYears, P.yearsPlayed);
  for (let y = 1; y <= ymax; y++) {
    const Y = P.years[y]; if (!Y) continue;
    console.log(`\n────────── ÅR ${y} ──────────`);
    // ÅRSGATADE kriser som köas vid DETTA års byggfas-start (tröskel passerad tidigare år)
    if (Y.yearStartCrises.length) {
      console.log(`  ⤷ Lokala kriser vars årskrav NU uppfylls (tröskeln passerades ett tidigare år) — köas vid byggfasens start:`);
      for (const e of Y.yearStartCrises) console.log(`     ⚠ ${e.namn} — ${resTxt(e.teams)}${e.ohalsa ? ` · öhälsa ${r2(e.ohalsa)} → ${e.ohAfter}` : ''}  (${e.villkor})`);
    }
    // fördröjda öhälsohändelser som VISAS detta år (kvalificerade förra bokslutet)
    if (Y.shown.length) {
      console.log(`  ⤷ Öns reaktion från förra året (fördröjda öhälsohändelser, ~30 s in i byggfasen):`);
      for (const e of Y.shown) console.log(`     ⚡ ${e.namn} — ${resTxt(e.teams)} (öhälsa oförändrad)`);
    }
    // byggen
    if (!Y.builds.length) console.log('  (inga byggen detta år)');
    for (const b of Y.builds) {
      console.log(`\n  🔨 ${NAMN[b.teamId]} bygger ${tierTxt(b.tier)} "${b.namn}"`);
      console.log(`     kostar ${b.kp}🪙 ${b.km}🧱 → kassa ${b.beforeP}🪙/${b.beforeM}🧱 → ${b.afterP}🪙/${b.afterM}🧱   (produktion ${r2(b.gp)}🪙 ${r2(b.gm)}🧱/år)`);
      console.log(`     miljöpåverkan: ${ohTxt(b.oh)} · lagets ackumulerade skada ${b.impactNegBefore} → ${b.impactNegAfter}`);
      if (!b.events.length && !b.vantar.length) console.log(`     → inget händelsevillkor uppfyllt`);
      for (const e of b.events) {
        console.log(`     → ${e.warn ? '⚠ ' : '★ '}${e.namn}  (${e.villkor})`);
        console.log(`        konsekvens: ${resTxt(e.teams)}${e.ohalsa ? ` · öhälsa ${r2(e.ohalsa)} → ${e.ohAfter}` : ''}`);
      }
      // TRÖSKEL passerad men kris VÄNTAR på årskravet (markeras särskilt per uppgiften)
      for (const v of b.vantar) console.log(`     ⏳ miljötröskeln för ${v.namn} passerad — men krisen VÄNTAR på årskravet (tidigast år ${v.yr})`);
    }
    // bokslut
    const bk = Y.bokslut;
    console.log(`\n  📊 BOKSLUT år ${y}:`);
    console.log(`     passiv produktion: ${IDS.map(id => `${shortN[id]} ${r2(bk.prod[id].dP)}🪙${r2(bk.prod[id].dM)}🧱`).join(' · ')}`);
    console.log(`     årets samlade miljöpåverkan på ön: ${r2(bk.delta)} öhälsa → ön ${bk.ohBefore} → ${bk.ohAfter}`);
    if (bk.qualified.length) {
      console.log(`     ⤷ KVALIFICERADE öhälsohändelser (öhälsa ${bk.ohAfter}): ${bk.qualified.map(q => ohalsaEventById(q)?.namn || q).join(', ')} — visas ~30 s in i år ${y + 1}`);
    } else {
      console.log(`     ⤷ inga öhälsohändelser kvalificerade (ön varken ≥70, ≤35, ≤27 eller netto +15)`);
    }
  }
  if (ymax < P.yearsPlayed) console.log(`\n  … (år ${ymax + 1}–${P.yearsPlayed} utelämnade; kör verktyget för hela partiet.)`);
  else console.log(`\n  (Partiet slutade år ${P.yearsPlayed}.)`);
}
const shortN = { aker: 'Åker', skog: 'Skog', tundra: 'Tundra', stad: 'Stad' };
function resTxt(teams) {
  const parts = teams.filter(t => t.dP || t.dM).map(t => `${shortN[t.id] || t.id} ${t.dP ? r2(t.dP) + '🪙' : ''}${t.dM ? ' ' + r2(t.dM) + '🧱' : ''}`.trim());
  return parts.length ? parts.join(', ') : '(ingen resursändring)';
}

// Strategiset: byggtätt = 2 gröna ankare + 2 smutsiga (ön överlever ≥4 år → de smutsiga passerar trösklar
// TIDIGT men kriserna fördröjs till år 2/4). Lugnt = blandade (grönt/smutsigt), försiktig appetit.
const STRATSETS = {
  // byggtätt: 3 gröna ankare håller ön vid liv i 8 år medan Stad bygger smutsigt och passerar
  // −15/−25 redan år 1 → minor-krisen fördröjs till år 2, major till år 4 (demonstrerar årskravet).
  byggtat:   { aker: 'gron', skog: 'gron', tundra: 'gron', stad: 'girig' },
  blandade:  BLANDADE,
};
const crisisCount = P => Object.values(P.years).reduce((s, Y) => s + Y.yearStartCrises.length
  + Y.builds.reduce((a, b) => a + b.events.filter(e => CRIS_IDS.has(e.id)).length, 0), 0);

// ── Skanna fram ett byggtätt parti (3 gröna ankare + 1 smutsigt (Stad), överlever ≥4 år, ≥1 fördröjd kris) + ett lugnt ──
function scan() {
  const out = { tat: [], lugn: [] };
  for (let i = 0; i < 300; i++) {
    const seed = 1000 + i;
    const pT = protokoll(seed, 'normal', STRATSETS.byggtat);
    const pL = protokoll(seed, 'forsiktig', STRATSETS.blandade);
    const buildCount = P => Object.values(P.years).reduce((s, Y) => s + Y.builds.length, 0);
    out.tat.push({ seed, years: pT.yearsPlayed, cris: crisisCount(pT), builds: buildCount(pT) });
    out.lugn.push({ seed, years: pL.yearsPlayed, cris: crisisCount(pL), builds: buildCount(pL) });
  }
  return out;
}

const ARG = (process.argv[2] || '').toLowerCase();
console.log('Eco Loco — SPELPROTOKOLL (bygge för bygge) · MELLAN · NYA krisregler (−15/−25, år 2/4) · reproducerbart');

if (ARG === 'scan') {
  const s = scan();
  const byTat = s.tat.filter(x => x.years >= 4 && x.cris >= 1).sort((a, b) => b.cris - a.cris).slice(0, 8);
  const byLugn = s.lugn.filter(x => x.years >= 6 && x.builds >= 4).sort((a, b) => b.cris - a.cris).slice(0, 8);
  console.log('\nByggtäta kandidater (3 gröna ankare + 1 smutsigt (Stad), ≥4 år, ≥1 fördröjd kris):'); for (const x of byTat) console.log(`  frö ${x.seed}: ${x.years} år · ${x.builds} byggen · ${x.cris} kriser`);
  console.log('\nLugna kandidater (försiktig blandade, ≥6 år):'); for (const x of byLugn) console.log(`  frö ${x.seed}: ${x.years} år · ${x.builds} byggen · ${x.cris} kriser`);
} else if (/^\d+$/.test(ARG)) {
  const seed = parseInt(ARG), app = (process.argv[3] || 'normal'), yrs = parseInt(process.argv[4]) || 4;
  const strat = STRATSETS[(process.argv[5] || 'blandade').toLowerCase()] || STRATSETS.blandade;
  skriv(protokoll(seed, app, strat), `VALT PARTI (${app}, ${process.argv[5] || 'blandade'})`, yrs);
} else {
  const s = scan();
  const tat = s.tat.filter(x => x.years >= 4 && x.cris >= 1).sort((a, b) => (b.cris - a.cris) || (b.years - a.years))[0]
    || s.tat.filter(x => x.years >= 4).sort((a, b) => b.years - a.years)[0];
  const lugn = s.lugn.filter(x => x.years >= 6 && x.builds >= 4).sort((a, b) => b.cris - a.cris)[0]
    || s.lugn.filter(x => x.years >= 6).sort((a, b) => b.builds - a.builds)[0];
  skriv(protokoll(tat.seed, 'normal', STRATSETS.byggtat), 'EXEMPEL 1 · BYGGTÄTT PARTI (3 gröna ankare + 1 smutsigt (Stad)) — kriserna fördröjs trots tidiga trösklar', 4);
  skriv(protokoll(lugn.seed, 'forsiktig', STRATSETS.blandade), 'EXEMPEL 2 · LUGNT PARTI (färre byggen, blandar grönt/smutsigt) — hela 8-årsspelet', 8);
  console.log(`\n\n(Reproducerbart: node tools/handelse-protokoll.js ${tat.seed} normal 4 byggtat  ·  node tools/handelse-protokoll.js ${lugn.seed} forsiktig 8 blandade)`);
}
