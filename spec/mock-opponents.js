// mock-opponents.js — SLÄNGBAR. Fyller de lag människan inte styr, för test på en skärm (fas 3).
// I skarp drift (fas 4) ersätts denna fil av en nätverkskälla: de andra lagens actions
// kommer då från riktiga spelare via WebSocket, men anropar SAMMA motor-actions.
//
// Användning i drivern vid bokslut:
//   mockOpponentsAct(engine, humanTeamId);   // botarna väljer kort (+ byter om de saknar valuta)
//   engine.endRound();                        // motorn resolverar
// Botarnas kortval emitteras som 'build' just då = "revealen" vid bokslut.

import { handFor } from './engine.js';

// humans: ett lag-id (mock på en skärm) ELLER en array av lag-id (multiplayer:
// alla lag som styrs av människor hoppas över — botarna fyller resten).
const skipSet = humans => new Set(Array.isArray(humans) ? humans : [humans]);

export function mockOpponentsAct(engine, humans) {
  const skip = skipSet(humans);
  const S = engine.getState();
  const oh = S.oh, redZone = engine.cfg.redZone;
  S.teams.filter(t => !skip.has(t.id) && !t.choice).forEach(t => {
    const hand = handFor(t.id).filter(c => !(S.banDirtyThisRound && c.tier === 'smutsig'));
    let card;
    if (oh < redZone + 8) {
      card = [...hand].sort((a, b) => b.oh - a.oh)[0];            // ön lider → grönast
    } else if (Math.random() < 0.3) {
      card = hand.find(c => c.oh >= 0) || hand[1];                // ibland ansvarsfull
    } else {
      card = [...hand].sort((a, b) => (b.gp + b.gm) - (a.gp + a.gm))[0]; // oftast girig (mest avkastning)
    }
    ensureAfford(engine, t, card);
    const res = engine.selectCard(t.id, card.tier);
    if (!res.ok) {
      // hade inte råd ens efter byte → avstå (inget val denna runda)
    }
  });
}

// Botar byter till sig den valuta de saknar, ~1:1, från ett lag med överskott.
function ensureAfford(engine, t, card) {
  const S = engine.getState();
  ['pengar', 'material'].forEach(cur => {
    const need = (cur === 'pengar' ? card.kp : card.km) - t[cur];
    if (need > 0) {
      const other = cur === 'pengar' ? 'material' : 'pengar';
      const seller = S.teams.find(x => x.id !== t.id && x[cur] - need >= 6 && t[other] >= need);
      if (seller) engine.transfer(t.id, seller.id, need, other, need, cur);
    }
  });
}

// Bot-röstning på ett öppet förslag (kalla efter att människorna röstat).
export function mockOpponentsVote(engine, humans) {
  const skip = skipSet(humans);
  const S = engine.getState();
  const p = S.proposal;
  if (!p || p.resolved) return;
  const worst = engine.worstPolluter();
  S.teams.filter(t => !skip.has(t.id) && p.votes[t.id] === undefined).forEach(t => {
    let yes = false;
    if (p.type === 'gron') yes = (S.oh < 55 && t.pengar >= engine.cfg.gronCost) || Math.random() < 0.35;
    if (p.type === 'skatt') yes = t.id !== worst.id;
    if (p.type === 'forbud') yes = S.oh < 52 || Math.random() < 0.4;
    engine.vote(t.id, yes);
  });
}
