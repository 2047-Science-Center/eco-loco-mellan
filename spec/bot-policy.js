// spec/bot-policy.js — BOT-BESLUT (ordförandeval + röstning), version-agnostiskt. Etapp 3b, Slice 3.
// INGA hårdkodade förslags-ID:n: botten väljer bland de FAKTISKA alternativen (engine.allowedProposals)
// och röstar utifrån förslagets/dilemmats EFFEKTER + metadata (tags), inte specifika id:n. Fungerar
// därför för alla spelversioner och alla förslag/dilemman — även framtida innehåll.
//
// Ren modul: tar emot `engine` + rena värden, muterar inget. Ändrar inga balansvärden/regler.

import { proposalById } from './content/proposals.js';

// Summan av ett effektpakets öhälso-förändring (politik: cfgKey; dilemma: literal value).
function ohDelta(effects, cfg) {
  return (effects || []).reduce((s, e) => s + (e.type === 'ohalsa' ? (e.cfgKey !== undefined ? cfg[e.cfgKey] : (e.value || 0)) : 0), 0);
}

// Är detta lag med i en selektor-mängd? (för att gissa om laget tjänar/betalar). votedYes = antag
// att laget röstar JA (relevant för 'yesVoters'). Återanvänder motorns egna selektor-metoder.
function selectorHasTeam(engine, sel, team, votedYes) {
  if (Array.isArray(sel)) return sel.some(s => selectorHasTeam(engine, s, team, votedYes));
  switch (sel) {
    case 'all': return true;
    case 'yesVoters': return votedYes;
    case 'noVoters': return !votedYes;
    case 'richest': return engine.richest()?.id === team.id;
    case 'worstPolluter': return engine.worstPolluter()?.id === team.id;
    case 'greenest': return engine._greenest()?.id === team.id;
    case 'twoRichest': return engine.leaderboards().bors.slice(0, 2).some(r => r.id === team.id);
    case 'twoPoorest': return engine.leaderboards().bors.slice(-2).some(r => r.id === team.id);
    case 'sectorPengar': return team.sektor === 'pengar';
    case 'sectorMaterial': return team.sektor === 'material';
    default:
      if (typeof sel === 'string' && sel.startsWith('omrade:')) return team.id === sel.slice('omrade:'.length);
      return false;
  }
}

// Grovt tecken på lagets ekonomiska utfall om förslaget/alternativet går igenom (antag JA-röst):
// >0 ≈ laget tjänar, <0 ≈ laget betalar, 0 ≈ neutralt.
function teamGainSign(engine, effects, team) {
  let sign = 0;
  for (const e of (effects || [])) {
    if (e.type === 'resource' && selectorHasTeam(engine, e.target, team, true)) sign += (e.op === 'sub' ? -1 : 1);
    else if (e.type === 'pot') {
      if (selectorHasTeam(engine, e.from, team, true)) sign -= 1;
      if (e.to === 'othersThanFrom' ? !selectorHasTeam(engine, e.from, team, true) : selectorHasTeam(engine, e.to, team, true)) sign += 1;
    }
  }
  return sign;
}

// ── ORDFÖRANDE: välj ett förslag ur de faktiskt tillåtna ──
// Ingen hårdkodad id-lista. Vid låg öhälsa föredras miljö-taggade förslag (metadata), annars valfritt.
export function botPickProposal(allowedIds, oh, rng = Math.random) {
  if (!allowedIds || !allowedIds.length) return null;
  if (oh < 45) {
    const green = allowedIds.filter(id => (proposalById(id)?.tags || []).includes('environment'));
    if (green.length) return green[Math.floor(rng() * green.length)];
  }
  return allowedIds[Math.floor(rng() * allowedIds.length)];
}

// ── RÖSTNING (ja/nej) på ett politiskt förslag ── effekt-/öhälso-baserat, inga id:n.
export function botVoteProposal(engine, def, team, cfg, rng = Math.random) {
  if (!def) return rng() < 0.6;                 // okänt (t.ex. runtime-händelse 'event') → nappar oftast
  const oh = engine.getState().oh;
  const dOh = ohDelta(def.effects, cfg);
  const gain = teamGainSign(engine, def.effects, team);
  if (oh < 45 && dOh > 0) return rng() < 0.9;   // kris + förslaget lyfter ön → rädda ön
  if (gain < 0) return rng() < 0.3;             // laget är nettobetalare → oftast nej
  if (dOh > 0 || gain > 0) return rng() < 0.7;  // bra för ön eller för laget → oftast ja
  return rng() < 0.45;
}

// ── RÖSTNING (A/B) på ett dilemma ── väljer alternativet med bäst utfall; kris → ön först.
export function botChooseDilemma(engine, dilemma, team, cfg, rng = Math.random) {
  const oh = engine.getState().oh;
  const sA = ohDelta(dilemma.alternativ.A.effects, cfg), sB = ohDelta(dilemma.alternativ.B.effects, cfg);
  if (oh < 45) return sA >= sB ? 'A' : 'B';     // kris → välj det som är bäst för ön
  const scoreA = sA * 0.5 + teamGainSign(engine, dilemma.alternativ.A.effects, team);
  const scoreB = sB * 0.5 + teamGainSign(engine, dilemma.alternativ.B.effects, team);
  if (scoreA === scoreB) return rng() < 0.5 ? 'A' : 'B';
  return scoreA > scoreB ? 'A' : 'B';
}
