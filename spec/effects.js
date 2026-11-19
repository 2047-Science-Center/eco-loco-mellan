// spec/effects.js — EFFEKTSYSTEM för politiska förslag (och senare dilemman).
// Tolkar deklarativa effekter ur content/proposals.js i stället för den tidigare hårdkodade
// if/else-kedjan i engine.js. Mutera­r spel-statusen EXAKT som förut — inga balansvärden ändras,
// beloppen läses ur motorns cfg (tuning förblir i DEFAULT_CONFIG/assets.json).
//
// Resolvern EMITTAR ingenting. Öhälso-effekter läggs på S.gronQueued precis som förr; motorns
// svans (engine._resolveProposal) applicerar gronQueued på öhälsan och emitterar 'ohalsa' +
// 'proposalResolved' oförändrat. Så eventströmmen blir identisk.
//
// Tre separerade begrepp (Josefs struktur):
//   • eligibility  — NÄR ett förslag får presenteras (urval, hanteras EJ här; se proposals.js-metadata).
//   • conditions   — villkor för att effekterna ska genomföras (t.ex. exakt 3 ja).
//   • effects      — hur spel-statusen ändras (listan nedan).
//
// Effekt-typer:
//   resource         { target, currency, amount, op:'add'|'sub', floor? }
//   pot              { from, to, currency|amounts, split:'floor'|'whole', toTiming?:'after' }
//   ohalsa           { cfgKey, when:'immediate' }        (beloppet + tecknet ligger i cfg)
//   buildRestriction { scope:'dirty'|'all'|'dirtySector', sector?, duration:'thisRound' }
//   buildDiscount    { currency, amount, duration:'thisRound' }
//
// Selektorer (återanvänder motorns egna metoder → ingen dubblering av urvalslogik):
//   all · yesVoters · noVoters · richest · worstPolluter · greenest · twoRichest · twoPoorest
//   · sectorPengar · sectorMaterial · omrade:<id> · othersThanFrom (bara som pot-mål) · array av ovanstående

function amount(engine, a) {
  if (typeof a === 'number') return a;
  if (a && a.cfgKey !== undefined) return engine.cfg[a.cfgKey];
  if (a && a.value !== undefined) return a.value;
  return 0;
}

function resolveSelector(engine, sel, ctx) {
  if (Array.isArray(sel)) return sel.flatMap(s => resolveSelector(engine, s, ctx));
  const teams = engine.getState().teams;
  switch (sel) {
    case 'all':            return teams;
    case 'yesVoters':      return teams.filter(t => ctx.votes[t.id]);
    case 'noVoters':       return teams.filter(t => !ctx.votes[t.id]);
    case 'richest':        return [engine.richest()];
    case 'worstPolluter':  return [engine.worstPolluter()];
    case 'greenest':       { const g = engine._greenest(); return g ? [g] : []; }
    case 'twoRichest':     return engine.leaderboards().bors.slice(0, 2).map(r => engine.team(r.id));
    case 'twoPoorest':     return engine.leaderboards().bors.slice(-2).map(r => engine.team(r.id));
    case 'sectorPengar':   return teams.filter(t => t.sektor === 'pengar');
    case 'sectorMaterial': return teams.filter(t => t.sektor === 'material');
    default:
      if (typeof sel === 'string' && sel.startsWith('omrade:')) {
        const t = engine.team(sel.slice('omrade:'.length));
        return t ? [t] : [];
      }
      return [];
  }
}

function applyResource(engine, eff, ctx) {
  const amt = amount(engine, eff.amount);
  for (const t of resolveSelector(engine, eff.target, ctx)) {
    if (eff.op === 'sub') t[eff.currency] = eff.floor !== undefined ? Math.max(eff.floor, t[eff.currency] - amt) : t[eff.currency] - amt;
    else t[eff.currency] += amt;
  }
}

function applyPot(engine, eff, ctx) {
  const currencies = eff.amounts ? Object.keys(eff.amounts) : [eff.currency];
  const fromTeams = resolveSelector(engine, eff.from, ctx);
  // Mål resolveras FÖRE insamlingen som standard (speglar koden som beräknade selektorer vid
  // grenens början). gronstod är undantaget: greenaste bestäms EFTER att ja-rösterna betalat.
  let toTeams = eff.to === 'othersThanFrom'
    ? engine.getState().teams.filter(t => !fromTeams.includes(t))
    : (eff.toTiming === 'after' ? null : resolveSelector(engine, eff.to, ctx));
  const pot = {};
  for (const cur of currencies) {
    pot[cur] = 0;
    for (const t of fromTeams) {
      const pay = Math.min(amount(engine, eff.amounts ? eff.amounts[cur] : eff.amount), t[cur]);
      t[cur] -= pay; pot[cur] += pay;
    }
  }
  if (!toTeams) toTeams = resolveSelector(engine, eff.to, ctx);
  for (const cur of currencies) {
    if (eff.split === 'whole') toTeams.forEach(t => { t[cur] += pot[cur]; });
    else { const share = toTeams.length ? Math.floor(pot[cur] / toTeams.length) : 0; toTeams.forEach(t => { t[cur] += share; }); }
  }
}

function applyEffect(engine, eff, ctx) {
  const S = engine.getState();
  switch (eff.type) {
    case 'resource': applyResource(engine, eff, ctx); break;
    case 'pot':      applyPot(engine, eff, ctx); break;
    case 'ohalsa':   S.gronQueued += (eff.cfgKey !== undefined ? engine.cfg[eff.cfgKey] : (eff.value || 0)); break;   // cfgKey (politik) ELLER literal value (dilemman); svansen applicerar
    case 'buildDiscount': S.buildDiscountThisRound = amount(engine, eff.amount); break;
    case 'buildRestriction':
      if (eff.scope === 'dirty') S.banDirtyThisRound = true;
      else if (eff.scope === 'all') S.banAllThisRound = true;
      else if (eff.scope === 'dirtySector') {
        const by = engine.team(ctx.by);
        S.banDirtySektorThisRound = eff.sector === 'otherThanProposer'
          ? (by && by.sektor === 'pengar' ? 'material' : 'pengar')
          : eff.sector;
      }
      break;
  }
}

function conditionsMet(engine, def, ctx) {
  for (const c of (def.conditions || [])) {
    if (c.yesCountEquals !== undefined && ctx.yesCount !== c.yesCountEquals) return false;
    if (c.ohBelow !== undefined && engine.getState().oh >= c.ohBelow) return false;
  }
  return true;
}

// Verkställ ett förslags effekter. Muterar bara S (+ S.gronQueued); emitterar inget.
// ctx = { votes, yesCount, by }.
export function applyProposalEffects(engine, def, ctx) {
  if (!def || !conditionsMet(engine, def, ctx)) return;
  for (const eff of (def.effects || [])) applyEffect(engine, eff, ctx);
}
