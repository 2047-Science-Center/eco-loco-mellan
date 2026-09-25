// tools/simulera.js — Monte Carlo-balansanalys av Eco Loco Mellan.
// Kör spec/engine.js (reglerna orörda) tusentals gånger med olika lagstrategier
// och rapporterar överlevnad, kollaps, förmögenhet per sektor och vinnarfördelning.
//
//   node tools/simulera.js            (alla scenarier, N=3000)
//   node tools/simulera.js 500        (snabbare)
//
// Strategier: girig | standard | gron | adaptiv (som mock-opponents) | slump
// Politik:    ingen | gron-vid-behov (grön satsning föreslås när ön mår dåligt)

import { EcoLoco, AREAS, handFor } from '../spec/engine.js';

const N = parseInt(process.argv[2]) || 3000;

// — 1:1-byteshandel: skaffa valutan som saknas från ett lag med överskott (som mock-opponents) —
function tryAfford(engine, t, card) {
  const S = engine.getState();
  for (const cur of ['pengar', 'material']) {
    const need = (cur === 'pengar' ? card.kp : card.km) - t[cur];
    if (need > 0) {
      const other = cur === 'pengar' ? 'material' : 'pengar';
      const seller = S.teams.find(x => x.id !== t.id && x[cur] - need >= 6 && t[other] >= need);
      if (seller) engine.transfer(t.id, seller.id, need, other, need, cur);
    }
  }
  return t.pengar >= card.kp && t.material >= card.km;
}

function pickCard(strategy, engine, t) {
  const S = engine.getState();
  const hand = handFor(t.id).filter(c => !(S.banDirtyThisRound && c.tier === 'smutsig'));
  const byYield = [...hand].sort((a, b) => (b.gp + b.gm) - (a.gp + a.gm));
  const byOh = [...hand].sort((a, b) => b.oh - a.oh);
  switch (strategy) {
    case 'girig': return byYield;
    case 'standard': return [hand.find(c => c.tier === 'standard'), ...hand].filter(Boolean);
    case 'gron': return byOh;                       // grönast först, faller neråt
    case 'slump': return [...hand].sort(() => Math.random() - 0.5);
    case 'adaptiv':
      if (S.oh < engine.cfg.redZone + 8) return byOh;
      if (Math.random() < 0.3) return [hand.find(c => c.oh >= 0) || hand[1], ...byYield];
      return byYield;
  }
}

function runGame(strategies, politics) {
  const engine = new EcoLoco({});
  engine.start();
  let collapsed = false, result = null;
  engine.on('gameEnd', p => { result = p; if (p.reason?.includes('kollaps')) collapsed = true; });
  while (!engine.getState().over) {
    const S = engine.getState();
    // politik: grön satsning när ön mår dåligt
    if (politics === 'gron-vid-behov' && S.oh < 55 && !S.proposal) {
      const by = S.teams[Math.floor(Math.random() * 4)];
      engine.openProposal('gron', by.id);
      S.teams.forEach(t => engine.vote(t.id, t.pengar >= engine.cfg.gronCost));
    }
    // kortval (i lag-ordning; prova kort i strategins prioritetsordning)
    for (const t of S.teams) {
      for (const card of pickCard(strategies[t.id], engine, t)) {
        if (tryAfford(engine, t, card) && engine.selectCard(t.id, card.tier).ok) break;
      }
    }
    engine.endRound();
  }
  const S = engine.getState();
  return {
    won: result.won, collapsed, oh: S.oh,
    wealth: Object.fromEntries(S.teams.map(t => [t.id, t.pengar + t.material])),
    winner: result.winner.teamId,
    winnerSektor: AREAS.find(a => a.id === result.winner.teamId).sektor,
  };
}

function scenario(namn, strategies, politics = 'ingen') {
  const acc = { won: 0, collapsed: 0, ohSum: 0, wealth: {}, winSektor: { material: 0, pengar: 0 }, winTeam: {} };
  AREAS.forEach(a => acc.wealth[a.id] = 0);
  for (let i = 0; i < N; i++) {
    const r = runGame(strategies, politics);
    acc.won += r.won; acc.collapsed += r.collapsed; acc.ohSum += r.oh;
    AREAS.forEach(a => acc.wealth[a.id] += r.wealth[a.id]);
    acc.winSektor[r.winnerSektor]++;
    acc.winTeam[r.winner] = (acc.winTeam[r.winner] || 0) + 1;
  }
  const pct = x => (100 * x / N).toFixed(1) + '%';
  const w = id => (acc.wealth[id] / N).toFixed(0);
  console.log(`\n■ ${namn}${politics !== 'ingen' ? ' + politik(grön satsning)' : ''}`);
  console.log(`  Ön överlever: ${pct(acc.won)}   kollaps(0): ${pct(acc.collapsed)}   snitt-öhälsa vid slut: ${(acc.ohSum / N).toFixed(1)}`);
  console.log(`  Snittförmögenhet:  Åker ${w('aker')}  Skog ${w('skog')}  |  Tundra ${w('tundra')}  Stad ${w('stad')}`);
  const mSnitt = (acc.wealth.aker + acc.wealth.skog) / (2 * N), pSnitt = (acc.wealth.tundra + acc.wealth.stad) / (2 * N);
  console.log(`  Sektorsnitt: MATERIAL ${mSnitt.toFixed(0)}  vs  PENGAR ${pSnitt.toFixed(0)}   (pengar/material-kvot ${(pSnitt / mSnitt).toFixed(2)})`);
  console.log(`  Vinnare (rikast): materialsektor ${pct(acc.winSektor.material)}  pengarsektor ${pct(acc.winSektor.pengar)}`);
}

const alla = s => ({ aker: s, skog: s, tundra: s, stad: s });

console.log(`Eco Loco Mellan — balanssimulering, N=${N} partier per scenario, motorns standardconfig`);
scenario('Alla spelar STANDARD (naiv grupp)', alla('standard'));
scenario('Alla spelar GIRIGT (mest avkastning)', alla('girig'));
scenario('Alla spelar GRÖNT (så grönt de har råd med)', alla('gron'));
scenario('Alla ADAPTIVA (som mock-botarna: giriga tills ön krisar)', alla('adaptiv'));
scenario('SLUMP (förvirrad förstagångsgrupp)', alla('slump'));
scenario('Alla ADAPTIVA', alla('adaptiv'), 'gron-vid-behov');
scenario('Alla GRÖNA', alla('gron'), 'gron-vid-behov');
scenario('En GIRIG (Stad) bland ADAPTIVA', { aker: 'adaptiv', skog: 'adaptiv', tundra: 'adaptiv', stad: 'girig' }, 'gron-vid-behov');
scenario('Materiallag GRÖNA, pengarlag GIRIGA', { aker: 'gron', skog: 'gron', tundra: 'girig', stad: 'girig' }, 'gron-vid-behov');
