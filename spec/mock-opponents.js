// mock-opponents.js — SLÄNGBAR. Fyller de lag människan inte styr, för test på en skärm (fas 3).
// I skarp drift (fas 4) ersätts denna fil av en nätverkskälla: de andra lagens actions
// kommer då från riktiga spelare via WebSocket, men anropar SAMMA motor-actions.
//
// Användning i drivern vid bokslut:
//   mockOpponentsAct(engine, humanTeamId);   // botarna väljer kort (+ byter om de saknar valuta)
//   engine.endRound();                        // motorn resolverar
// Botarnas kortval emitteras som 'build' just då = "revealen" vid bokslut.

import { handFor } from './engine.js';
import { proposalById } from './content/proposals.js';
import { dilemmaById } from './content/dilemmas.js';
import { botVoteProposal, botChooseDilemma } from './bot-policy.js';

// humans: ett lag-id (mock på en skärm) ELLER en array av lag-id (multiplayer:
// alla lag som styrs av människor hoppas över — botarna fyller resten).
const skipSet = humans => new Set(Array.isArray(humans) ? humans : [humans]);

export function mockOpponentsAct(engine, humans) {
  const skip = skipSet(humans);
  const S = engine.getState();
  const oh = S.oh, redZone = engine.cfg.redZone;
  const rounds = engine.cfg.rounds ?? 8, threshold = engine.cfg.threshold ?? 60;
  const slutspel = (rounds - S.round) <= 1;   // sista (~2) året då öns slut-öhälsa MÅSTE nå tröskeln
  S.teams.filter(t => !skip.has(t.id) && !t.choice).forEach(t => {
    const hand = handFor(t.id).filter(c => !(S.banDirtyThisRound && c.tier === 'smutsig'));
    const greenest = [...hand].sort((a, b) => b.oh - a.oh)[0];
    let card;
    if (oh < redZone + 8) {
      card = greenest;                                           // akut kris (farozonen) → grönast
    } else if (Math.random() < 0.3) {
      card = hand.find(c => c.oh >= 0) || hand[1];               // ibland ansvarsfull
    } else {
      card = [...hand].sort((a, b) => (b.gp + b.gm) - (a.gp + a.gm))[0]; // oftast GIRIG (mest avkastning)
    }
    // SLUTSPELS-MATTE: en bot ska aldrig vara den som tippar en RÄDDNINGSBAR ö under tröskeln sista året.
    // Projicera öns slut-öhälsa med allt som REDAN byggts denna runda (människor + tidigare botar) + det
    // valda kortet. Skulle det giriga valet sänka ön under tröskeln → bygg grönast i stället (rädda, inte
    // förstöra för människorna). Finns buffert (ön klarar sig ändå) får boten vara girig.
    if (slutspel && card.oh < 0) {
      const byggt = S.teams.reduce((s, x) => s + (x._roundCards || []).reduce((a, c) => a + c.oh, 0), 0);
      if (oh + byggt + card.oh < threshold) card = greenest;
    }
    ensureAfford(engine, t, card, skip);
    const res = engine.selectCard(t.id, card.tier);
    if (!res.ok) {
      // hade inte råd ens efter byte → avstå (inget val denna runda)
    }
  });
}

// Botar byter till sig den valuta de saknar, ~1:1, BARA från en annan BOT med överskott.
// Aldrig från ett människolag (skip) — en bot tvingar aldrig fram ett byte utan samtycke.
// Hittas ingen bot-säljare får boten avstå sitt bygge denna runda (selectCard-grenen ovan).
function ensureAfford(engine, t, card, skip) {
  const S = engine.getState();
  ['pengar', 'material'].forEach(cur => {
    const need = (cur === 'pengar' ? card.kp : card.km) - t[cur];
    if (need > 0) {
      const other = cur === 'pengar' ? 'material' : 'pengar';
      const seller = S.teams.find(x => x.id !== t.id && !skip.has(x.id) && x[cur] - need >= 6 && t[other] >= need);
      if (seller) engine.transfer(t.id, seller.id, need, other, need, cur);
    }
  });
}

// Bot-röstning på ett öppet beslut (kalla efter att människorna röstat). Version-agnostiskt via
// spec/bot-policy.js — INGA hårdkodade förslags-ID:n. Hanterar politik (ja/nej) OCH dilemma (A/B).
export function mockOpponentsVote(engine, humans) {
  const skip = skipSet(humans);
  const S = engine.getState();
  const p = S.proposal;
  if (!p || p.resolved) return;
  const cfg = engine.cfg;
  S.teams.filter(t => !skip.has(t.id) && p.votes[t.id] === undefined).forEach(t => {
    if (p.kind === 'dilemma') {
      engine.vote(t.id, botChooseDilemma(engine, dilemmaById(p.dilemmaId), t, cfg));   // A/B
    } else {
      // politik: ja/nej utifrån förslagets effekter (p.type 'event' = runtime-händelse → def saknas → nappar oftast)
      engine.vote(t.id, botVoteProposal(engine, proposalById(p.type), t, cfg));
    }
  });
}
