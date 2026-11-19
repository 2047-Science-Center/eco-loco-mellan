// tools/mellan-analys.js — FÖRDJUPAD analys av MELLAN (8 år): tre spårade partier år-för-år,
// byggnadernas ekonomi, varför pengarföretagen vinner, och händelsestatistik över 1000 partier.
// Kör spec/engine.js ORÖRD (inga balansvärden/regler/triggers ändras) — detta är ren analys.
// Bot-/strategilogik delas med tools/simulera.js via tools/bot-strategier.js.
//
//   node tools/mellan-analys.js            (allt: byggnadsekonomi + 3 partier + 1000-statistik)
//   node tools/mellan-analys.js partier    (bara de tre spårade partierna)
//   node tools/mellan-analys.js stat       (bara 1000-partisstatistiken)
//   node tools/mellan-analys.js ekonomi    (bara byggnadsekonomi-tabellen)
//
// ATTRIBUTION: varje resursändring hänförs till rätt orsak (byggkostnad/produktion/handel/händelse)
// genom att jämföra lagens faktiska resurser FÖRE och EFTER varje motor-event (snapshot-diff). Det
// fångar även clamp vid 0 (avsedd vs faktisk effekt). Öhälsa följs via 'ohalsa'/'companyEvent'-events.

import { EcoLoco, AREAS, handFor as engineHandFor } from '../spec/engine.js';
import { BUILDINGS, buildingsForRegion } from '../spec/content/buildings.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { makeRng, tryTrade, expProfile, resolveStrat, pickOrder } from './bot-strategier.js';

const VCFG = VARIANTS.mellan;
const IDS = AREAS.map(a => a.id);
const NAMN = { aker: 'Åker (Oxen)', skog: 'Skog (Björnen)', tundra: 'Tundra (Räven)', stad: 'Stad (Örnen)' };
const SEKTOR = Object.fromEntries(AREAS.map(a => [a.id, a.sektor]));
const z = () => Object.fromEntries(IDS.map(i => [i, 0]));

// hand för ett lag med aktuella byggförbud bortfiltrerade (som i simulera.js)
function handOf(engine, id) {
  const S = engine.getState();
  return engineHandFor(id).filter(c => !(S.banAllThisRound) && !(S.banDirtyThisRound && c.tier === 'smutsig') && !(S.banDirtySektorThisRound === engine.team(id).sektor && c.tier === 'smutsig'));
}

// expansion per lag: sträng, eller {girig,gron,...} (fas-beroende per resolverad strategi)
function expansionOf(cfg, id, strat) {
  const v = cfg[id] ?? 'normal';
  if (typeof v === 'string') return expProfile(v);
  return expProfile(v[strat] || 'normal');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// DEL 4A — byggnadernas ekonomi (statisk tabell ur byggnadsbanken)
// ═══════════════════════════════════════════════════════════════════════════════════════
function byggnadsEkonomi() {
  console.log('\n════════ DEL 4A · BYGGNADERNAS EKONOMI (Mellan, verkliga värden) ════════');
  console.log('Återbet. = kostnad(p+m) / produktion(p+m) per år. Nettovärde efter Y år = prod·Y − kostnad (öhälsa separat).');
  console.log('\n| Byggnad | Sektor | Kostnad 🪙/🧱 | Prod 🪙/🧱 | Miljö | Återbet.(år) | Netto 4 år | Netto 8 år |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const b of BUILDINGS) {
    const kp = b.cost.pengar, km = b.cost.material, gp = b.production.pengar, gm = b.production.material;
    const kost = kp + km, prod = gp + gm;
    const aterbet = prod > 0 ? (kost / prod).toFixed(1) : '—';
    const net4 = prod * 4 - kost, net8 = prod * 8 - kost;
    console.log(`| ${b.namn} (${b.tier}) | ${SEKTOR[b.region]} | ${kp}/${km} | ${gp}/${gm} | ${b.impact >= 0 ? '+' : ''}${b.impact} | ${aterbet} | ${net4 >= 0 ? '+' : ''}${net4} | ${net8 >= 0 ? '+' : ''}${net8} |`);
  }
  console.log('\nOBS: produktionen är EN valuta per sektor (material för Åker/Skog, pengar för Tundra/Stad).');
  console.log('Nettovärdet räknar produktion rakt av; se DEL 4C om 1🧱 verkligen är värt 1🪙 (handel 1:1).');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// DEL 1–3 — spåra ETT parti år-för-år med exakt resursattribution
// ═══════════════════════════════════════════════════════════════════════════════════════
function traceGame(label, opts) {
  const rng = makeRng(opts.seed);
  const engine = new EcoLoco({ ...VCFG, features: { ...VCFG.features, trade: opts.handel }, seed: opts.seed });

  // ledger per lag: start, byggkostnad, produktion, handel, händelser, slut — pengar OCH material separat
  const L = Object.fromEntries(IDS.map(id => [id, { byggP: 0, byggM: 0, prodP: 0, prodM: 0, handP: 0, handM: 0, evP: 0, evM: 0 }]));
  const snap = {};                         // senaste kända resurser per lag (för diff-attribution)
  const readSnap = () => { for (const id of IDS) { const t = engine.team(id); snap[id] = { p: t.pengar, m: t.material }; } };
  const diffTo = (bucketP, bucketM) => {   // hänför faktisk ändring sedan förra snapshot till en bucket
    for (const id of IDS) { const t = engine.team(id); L[id][bucketP] += t.pengar - snap[id].p; L[id][bucketM] += t.material - snap[id].m; snap[id] = { p: t.pengar, m: t.material }; }
  };

  const years = [];                        // års-logg
  let cur = null;                          // aktuellt år-objekt
  let startResurser = null;
  let expectEventOhalsa = false;

  engine.on('start', () => { readSnap(); startResurser = Object.fromEntries(IDS.map(id => { const t = engine.team(id); return [id, { p: t.pengar, m: t.material }]; })); });
  const snapResurser = () => Object.fromEntries(IDS.map(id => { const t = engine.team(id); return [id, { p: t.pengar, m: t.material }]; }));
  engine.on('roundStart', p => {
    // nästa års roundStart fyrar INUTI endRound → öhälsan + resurserna är då färdiga för året som slutade.
    if (years.length) { years[years.length - 1].ohEnd = engine.getState().oh; years[years.length - 1].slut = snapResurser(); }
    cur = { year: p.round, ohStart: engine.getState().oh, builds: z0(), trades: [], events: [], income: null, ohEnd: null, slut: null, krisOn: false, krisOff: false, ohLog: [] };
    for (const id of IDS) cur.builds[id] = [];
    years.push(cur);
    readSnap();
  });
  function z0() { return {}; }

  engine.on('build', p => {
    diffTo('byggP', 'byggM');              // bokför kostnaden (diff fångar exakt dragna belopp)
    cur.builds[p.teamId].push({ namn: p.card.namn, tier: p.card.tier, kp: p.cost.pengar, km: p.cost.material, oh: p.card.oh, gp: p.card.gp, gm: p.card.gm });
  });
  engine.on('trade', p => {
    diffTo('handP', 'handM');
    cur.trades.push({ from: p.from, to: p.to, give: p.give, giveCur: p.giveCur, get: p.get, getCur: p.getCur });
  });
  engine.on('income', p => { diffTo('prodP', 'prodM'); (cur.income ||= z()); cur.income[p.teamId] = { p: p.pengar, m: p.material }; });
  engine.on('companyEvent', p => {
    // faktiska deltan (inkl. clamp) = diff sedan förra snapshot; avsedda = p.teams-raderna
    const before = Object.fromEntries(IDS.map(id => [id, { ...snap[id] }]));
    diffTo('evP', 'evM');
    const faktiska = {};
    for (const id of IDS) { const t = engine.team(id); faktiska[id] = { p: t.pengar - before[id].p, m: t.material - before[id].m }; }
    const avsedda = {};
    for (const r of (p.teams || [])) avsedda[r.teamId] = { p: r.dPengar || 0, m: r.dMaterial || 0 };
    cur.events.push({ kind: 'foretag', id: p.id, namn: p.namn, avsedda, faktiska, dOh: p.ohalsa || 0, ohAfter: p.ohAfter });
    expectEventOhalsa = (p.ohalsa || 0) !== 0;
  });
  engine.on('ohalsa', p => {
    if (!cur) return;
    if (p.delta === 0) return;
    if (expectEventOhalsa) { expectEventOhalsa = false; cur.ohLog.push({ label: 'händelse', delta: p.delta, value: p.value }); return; }
    cur.ohLog.push({ label: 'byggnaders miljöpåverkan (bokslut)', delta: p.delta, value: p.value });
  });
  engine.on('crisis', p => { if (!cur) return; if (p.on) cur.krisOn = true; else cur.krisOff = true; });

  let result = null;
  engine.on('gameEnd', p => { result = p; });

  // ── kör partiet ──
  const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 40) engine.companyEventResolved(); };
  const gmByYear = {};
  for (const g of (opts.gmPlan || [])) (gmByYear[g.year] ||= []).push(g.id);

  engine.start();
  while (!engine.getState().over) {
    const S = engine.getState();
    const year = S.round;
    const thr = engine.cfg.redZone;
    if (opts.politics === 'gron-vid-behov' && S.oh < 55 && !S.proposal) {
      const by = S.teams[Math.floor(rng() * 4)];
      const pr = engine.openProposal('gron', by.id);
      if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); }
    }
    for (const t of S.teams) {
      const strat = resolveStrat(opts.strategies[t.id], year, opts.vandAr);
      const ec = expansionOf(opts.expansion || {}, t.id, strat);
      let n = 0;
      while (n < ec.max) {
        const order = pickOrder(strat, handOf(engine, t.id), S.oh, thr, rng);
        let did = false;
        for (const card of order) {
          const kp = card.kp, km = card.km;
          const ownOk = (t.pengar - kp >= ec.reserveP) && (t.material - km >= ec.reserveM);
          let payOk = ownOk;
          if (!payOk && ec.stretch) payOk = (t.pengar >= kp && t.material >= km) || (opts.handel && tryTrade(engine, t, kp, km, null));
          if (payOk && engine.selectCard(t.id, card.tier).ok) { did = true; drain(); break; }
        }
        if (!did) break;
        n++;
      }
    }
    for (const gid of (gmByYear[year] || [])) { if (engine.fireGmEvent(gid).ok) drain(); }
    engine.endRound();
    drain();
  }
  if (years.length) { years[years.length - 1].ohEnd = engine.getState().oh; years[years.length - 1].slut = snapResurser(); }   // sista året

  printGame(label, opts, engine, startResurser, L, years, result);
  return { engine, L, years, result };
}

// ── skriv ut ett spårat parti ──
function printGame(label, opts, engine, start, L, years, result) {
  const stratTxt = IDS.map(id => `${id}=${describeStrat(opts, id)}`).join(' · ');
  console.log(`\n\n════════════════════════════════════════════════════════════════════`);
  console.log(`${label}   (frö=${opts.seed}, Mellan 8 år, handel ${opts.handel ? 'PÅ' : 'AV'}, auto-händelser PÅ)`);
  console.log(`Strategier: ${stratTxt}`);
  if (opts.gmPlan?.length) console.log(`GM-plan: ${opts.gmPlan.map(g => `år ${g.year}: ${g.id}`).join(' · ')}`);
  console.log(`════════════════════════════════════════════════════════════════════`);

  const eventRows = [];
  for (const y of years) {
    console.log(`\n── ÅR ${y.year} ──  öhälsa ${y.ohStart} → ${y.ohEnd}${y.krisOn ? '  ⚠️KRIS AKTIVERAD' : ''}${y.krisOff ? '  ✅KRIS AVSLUTAD' : ''}`);
    // byggen + kostnad + produktion-bidrag
    for (const id of IDS) {
      const bs = y.builds[id];
      if (!bs.length) { console.log(`   ${pad(NAMN[id])}: (byggde inget)`); continue; }
      const txt = bs.map(b => `${b.namn}[${b.tier} −${b.kp}🪙/−${b.km}🧱, miljö ${b.oh >= 0 ? '+' : ''}${b.oh}, +prod ${b.gp}🪙/${b.gm}🧱]`).join('  ');
      console.log(`   ${pad(NAMN[id])}: ${bs.length} bygge(n)  ${txt}`);
    }
    // handel
    if (y.trades.length) for (const tr of y.trades) console.log(`   HANDEL: ${tr.from} gav ${tr.give}${cur2(tr.giveCur)} → fick ${tr.get}${cur2(tr.getCur)} av ${tr.to}`);
    // öhälsa-logg i ordning
    for (const o of y.ohLog) console.log(`   öhälsa ${o.delta >= 0 ? '+' : ''}${o.delta} (${o.label}) → ${o.value}`);
    // produktion vid bokslut
    if (y.income) { const inc = IDS.map(id => `${id} +${y.income[id]?.p || 0}🪙/+${y.income[id]?.m || 0}🧱`).join(' · '); console.log(`   PRODUKTION (bokslut): ${inc}`); }
    // händelser detta år
    for (const ev of y.events) {
      const who = Object.entries(ev.faktiska).filter(([, d]) => d.p || d.m).map(([id, d]) => `${id} ${d.p ? (d.p > 0 ? '+' : '') + d.p + '🪙' : ''}${d.m ? ' ' + (d.m > 0 ? '+' : '') + d.m + '🧱' : ''}`.trim()).join(', ') || '(ingen resurseffekt)';
      const clamp = clampNote(ev);
      console.log(`   HÄNDELSE: ${ev.namn}${ev.id.startsWith('gm_') ? ' [GM]' : ''} → ${who}${ev.dOh ? ` · öhälsa ${ev.dOh > 0 ? '+' : ''}${ev.dOh}→${ev.ohAfter}` : ''}${clamp}`);
      eventRows.push({ year: y.year, ...ev });
    }
    // slutresurser året (snapshot vid årsgränsen, inte live-slutläge)
    const slut = y.slut ? IDS.map(id => `${id} ${y.slut[id].p}🪙/${y.slut[id].m}🧱`).join(' · ') : '—';
    console.log(`   RESURSER vid årets slut: ${slut}`);
  }

  // ── DEL 3: sammanfattande ekonomitabell per företag (pengar/material separat) ──
  console.log(`\n   ── EKONOMISK SAMMANFATTNING (hela partiet, 🪙 pengar / 🧱 material separat) ──`);
  console.log('   | Företag | Start 🪙/🧱 | Bygg 🪙/🧱 | Prod 🪙/🧱 | Handel 🪙/🧱 | Händelser 🪙/🧱 | Slut 🪙/🧱 | Avstämning |');
  console.log('   |---|---|---|---|---|---|---|---|');
  for (const id of IDS) {
    const l = L[id], s = start[id], t = engine.team(id);
    const calcP = s.p + l.byggP + l.prodP + l.handP + l.evP;
    const calcM = s.m + l.byggM + l.prodM + l.handM + l.evM;
    const ok = (calcP === t.pengar && calcM === t.material) ? '✓' : `✗ (beräknat ${calcP}/${calcM})`;
    console.log(`   | ${NAMN[id]} | ${s.p}/${s.m} | ${sg(l.byggP)}/${sg(l.byggM)} | ${sg(l.prodP)}/${sg(l.prodM)} | ${sg(l.handP)}/${sg(l.handM)} | ${sg(l.evP)}/${sg(l.evM)} | ${t.pengar}/${t.material} | ${ok} |`);
  }
  const win = result?.winner?.teamId;
  console.log(`\n   UTFALL: ${result?.won ? 'ÖN ÖVERLEVDE' : (result?.reason || 'ön klarade ej tröskeln')} · slut-öhälsa ${engine.getState().oh} · vinnare ${win ? NAMN[win] + ' (' + SEKTOR[win] + ')' : '—'}`);
  const w = IDS.map(id => { const t = engine.team(id); return { id, tot: t.pengar + t.material }; }).sort((a, b) => b.tot - a.tot);
  console.log(`   Förmögenhetsranking (🪙+🧱): ${w.map(x => `${x.id} ${x.tot}`).join(' · ')}`);
}

function describeStrat(opts, id) {
  const s = opts.strategies[id];
  const exp = (opts.expansion || {})[id] ?? 'normal';
  const expTxt = typeof exp === 'string' ? exp : Object.entries(exp).map(([k, v]) => `${k}→${v}`).join('/');
  if (s === 'vand') return `vänd@år${opts.vandAr}(${expTxt})`;
  return `${s}(${expTxt})`;
}
const pad = s => (s + '                 ').slice(0, 15);
const sg = n => (n >= 0 ? '+' : '') + n;
const cur2 = c => c === 'pengar' ? '🪙' : '🧱';
function clampNote(ev) {
  let diff = false;
  for (const [id, a] of Object.entries(ev.avsedda)) { const f = ev.faktiska[id] || { p: 0, m: 0 }; if (a.p !== f.p || a.m !== f.m) diff = true; }
  return diff ? '  ⚠️(clamp vid 0: faktisk < avsedd)' : '';
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// DEL 5 — händelsestatistik + attribution över N partier
// ═══════════════════════════════════════════════════════════════════════════════════════
function aggregat(N, withEvents) {
  const blandade = { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' };
  const evFreq = {}, evTeamDelta = {}, evCount = {};   // frekvens, resursdelta per lag, antal
  const attrib = { bygg: z(), prod: z(), hand: z(), event: z() };   // |delta| per kategori (pengar+material)
  let gamesEvOh = 0, totEvents = 0;

  for (let i = 0; i < N; i++) {
    const seed = 1000 + i;
    const rng = makeRng(seed);
    const feat = withEvents ? { ...VCFG.features, trade: true } : { trade: true };
    const engine = new EcoLoco({ ...VCFG, features: feat, seed });
    const snap = {};
    const read = () => { for (const id of IDS) { const t = engine.team(id); snap[id] = { p: t.pengar, m: t.material }; } };
    const diff = bucket => { for (const id of IDS) { const t = engine.team(id); attrib[bucket][id] += Math.abs(t.pengar - snap[id].p) + Math.abs(t.material - snap[id].m); snap[id] = { p: t.pengar, m: t.material }; } };
    engine.on('start', read); engine.on('roundStart', read);
    engine.on('build', () => diff('bygg'));
    engine.on('trade', () => diff('hand'));
    engine.on('income', () => diff('prod'));
    engine.on('companyEvent', p => {
      const before = Object.fromEntries(IDS.map(id => [id, { ...snap[id] }]));
      diff('event');
      evFreq[p.id] = (evFreq[p.id] || 0) + 1; totEvents++;
      evTeamDelta[p.id] ||= z(); evCount[p.id] ||= 0; evCount[p.id]++;
      for (const id of IDS) { const t = engine.team(id); evTeamDelta[p.id][id] += (t.pengar - before[id].p) + (t.material - before[id].m); }
    });
    let hadEvOh = false;
    engine.on('companyEvent', p => { if (p.ohalsa) hadEvOh = true; });

    const drain = () => { let g = 0; while (engine.getState().activeCompanyEvent && g++ < 40) engine.companyEventResolved(); };
    engine.start();
    while (!engine.getState().over) {
      const S = engine.getState(); const year = S.round; const thr = engine.cfg.redZone;
      if (S.oh < 55 && !S.proposal) { const by = S.teams[Math.floor(rng() * 4)]; const pr = engine.openProposal('gron', by.id); if (pr && pr.ok) { S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost)); drain(); } }
      for (const t of S.teams) {
        const strat = resolveStrat(blandade[t.id], year); const ec = expProfile('normal'); let n = 0;
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
    }
    if (hadEvOh) gamesEvOh++;
  }
  return { N, evFreq, evTeamDelta, evCount, attrib, totEvents, gamesEvOh };
}

function printAggregat() {
  console.log('\n\n════════ DEL 5 · HÄNDELSESTATISTIK ÖVER 1000 MELLAN-PARTIER (blandade spelare, normal expansion) ════════');
  const A = aggregat(1000, true);
  const B = aggregat(1000, false);   // samma frön, UTAN automatiska händelser → isolera händelsernas vikt

  const ALLA_EV = [
    ['aker_minor', 'ÅKER MILJÖKRIS (liten)'], ['aker_major', 'ÅKER MILJÖKRIS (stor)'],
    ['skog_minor', 'SKOG MILJÖKRIS (liten)'], ['skog_major', 'SKOG MILJÖKRIS (stor)'],
    ['tundra_minor', 'TUNDRA MILJÖKRIS (liten)'], ['tundra_major', 'TUNDRA MILJÖKRIS (stor)'],
    ['stad_minor', 'STAD MILJÖKRIS (liten)'], ['stad_major', 'STAD MILJÖKRIS (stor)'],
    ['gronafonden', 'GRÖNA FONDEN'], ['expansion', 'EXPANSION'], ['uppror', 'UPPROR'],
    ['gronomstallning', 'GRÖN OMSTÄLLNING'], ['framtidsvisionar', 'FRAMTIDSVISIONÄR'], ['gemensamsatsning', 'GEMENSAM SATSNING'],
    ['naturenblomstrar', 'NATUREN BLOMSTRAR'], ['miljolyft', 'MILJÖLYFT'], ['varmebolja', 'VÄRMEBÖLJA'],
    ['resursbrist', 'RESURSBRIST'], ['storm', 'STORM'],
  ];
  console.log('\n| Händelse | Andel partier | Snitt-resursdelta/förekomst (🪙+🧱) | Mest påverkat lag |');
  console.log('|---|---|---|---|');
  for (const [id, namn] of ALLA_EV) {
    const f = A.evFreq[id] || 0;
    if (f === 0) { console.log(`| ${namn} | 0 % (fyrar aldrig) | — | — |`); continue; }
    const perGame = (100 * f / A.N).toFixed(0);
    const td = A.evTeamDelta[id] || z();
    const totDelta = IDS.reduce((s, id2) => s + td[id2], 0);
    const snitt = (totDelta / f).toFixed(1);
    const top = IDS.map(id2 => [id2, td[id2]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    console.log(`| ${namn} | ${perGame >= 100 ? '~100' : perGame} % | ${snitt >= 0 ? '+' : ''}${snitt} | ${top[1] ? `${top[0]} (${(td[top[0]] / f).toFixed(0)})` : '—'} |`);
  }
  console.log(`\nHändelser/parti i snitt: ${(A.totEvents / A.N).toFixed(1)} · partier med öhälso-påverkande händelse: ${(100 * A.gamesEvOh / A.N).toFixed(0)} %`);

  // attribution: hur stor del av resursrörelsen kommer från vad
  console.log('\n── Varifrån kommer resursrörelsen? (summa |Δ| per kategori, snitt/parti, MED händelser) ──');
  console.log('| Kategori | Åker | Skog | Tundra | Stad |');
  console.log('|---|---|---|---|---|');
  for (const [k, namn] of [['bygg', 'Byggkostnad'], ['prod', 'Produktion'], ['hand', 'Handel'], ['event', 'Händelser']]) {
    console.log(`| ${namn} | ${(A.attrib[k].aker / A.N).toFixed(0)} | ${(A.attrib[k].skog / A.N).toFixed(0)} | ${(A.attrib[k].tundra / A.N).toFixed(0)} | ${(A.attrib[k].stad / A.N).toFixed(0)} |`);
  }
  // andel från händelser per lag
  console.log('\nAndel av resursrörelsen som är HÄNDELSER (resten = bygg+prod+handel):');
  for (const id of IDS) {
    const tot = ['bygg', 'prod', 'hand', 'event'].reduce((s, k) => s + A.attrib[k][id], 0);
    console.log(`   ${NAMN[id]}: ${(100 * A.attrib.event[id] / tot).toFixed(0)} %`);
  }
  console.log(`\n(Jämförkörning UTAN automatiska händelser kördes på samma frön för att isolera effekten — se rapporttext.)`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
const MODE = (process.argv[2] || 'allt').toLowerCase();

if (MODE === 'allt' || MODE === 'ekonomi') byggnadsEkonomi();

if (MODE === 'allt' || MODE === 'partier') {
  // Parti A — blandade strategier, normal expansion, handel + auto-händelser
  traceGame('PARTI A · Blandade strategier', {
    seed: 1001, handel: true, politics: 'gron-vid-behov',
    strategies: { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' },
    expansion: { aker: 'normal', skog: 'normal', tundra: 'normal', stad: 'normal' },
  });
  // Parti B — 2 gröna från start, 2 ekonomiska som ställer om till grönt år 4 (aggressiv grön sen).
  // De smutsiga lagens FÖRE-fas är FÖRSIKTIG (inte normal): normal = 8 smutsbyggen år 1 = −48 öh →
  // ön kollapsar innan vändningen hinner ske (ett fynd i sig, se rapport). Mild start → vändningen syns.
  traceGame('PARTI B · Grön omställning (vändning år 4)', {
    seed: 2002, handel: true, politics: 'gron-vid-behov', vandAr: 4,
    strategies: { aker: 'gron', skog: 'gron', tundra: 'vand', stad: 'vand' },
    expansion: { aker: 'normal', skog: 'normal', tundra: { girig: 'forsiktig', gron: 'aggressiv' }, stad: { girig: 'forsiktig', gron: 'aggressiv' } },
  });
  // Parti C — blandade strategier + GM aktiverar 3 av de 4 direkthändelserna. Försiktig expansion
  // så partiet överlever hela 8 år (annars hinner GM-händelserna aldrig fyra innan kollaps).
  traceGame('PARTI C · Spelledaren ingriper (försiktig expansion → överlever)', {
    seed: 3003, handel: true, politics: 'gron-vid-behov',
    strategies: { aker: 'gron', skog: 'adaptiv', tundra: 'girig', stad: 'standard' },
    expansion: { aker: 'forsiktig', skog: 'forsiktig', tundra: 'forsiktig', stad: 'forsiktig' },
    gmPlan: [{ year: 2, id: 'gm_ekonomisktstod' }, { year: 4, id: 'gm_marknadskrasch' }, { year: 6, id: 'gm_braskord' }],
  });
}

if (MODE === 'allt' || MODE === 'stat') printAggregat();
