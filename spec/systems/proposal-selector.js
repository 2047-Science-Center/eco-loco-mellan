// spec/systems/proposal-selector.js — GENERELL URVALSMOTOR för politiska förslag (Etapp 2b–B).
// Ren funktion, ingen motor-/DOM-/nät-koppling → enkel att testa isolerat.
//
// Väljer vilka förslag som presenteras i ett Ö-råd utifrån versionens config. ALLA förslag är
// jämbördiga — inga obligatoriska, ingen särskild status (grund-3 behandlas som alla andra).
//
// selection-config (ur variantens politics):
//   proposalCount   totalt antal förslag att presentera. Utelämnas → hela den giltiga poolen.
//   quotas          { <category>: n } — antal per mekanisk kategori. Valfritt.
//   fillRemaining   'random' (standard) fyller återstående platser slumpvis ur hela poolen | 'none'.
//   tags            [..] valfritt taggfilter (whitelist) — bara förslag med minst en matchande tagg.
//
// Egenskaper (brief §Urvalet):
//   • Slumpmässigt och reproducerbart med seed (rng injiceras).
//   • Utan dubbletter.
//   • Bara förslag som uppfyller sina eligibility-villkor (isEligible injiceras).
//   • Oberoende av ordningen i innehållsbanken (poolen kanon-sorteras på id före blandning).
//   • Tydlig varning när en kvot/total inte kan uppfyllas (returneras i warnings[]).

// Seedbar PRNG (mulberry32) — samma familj som golden-testet. Exporteras så motor + tester delar den.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Eligibility: får förslaget/dilemmat presenteras i nuvarande speltillstånd? ctx = { oh, cfg, round?, rounds? }.
export function proposalEligible(p, ctx) {
  const e = p.eligibility;
  if (!e || e.always) return true;
  if (e.ohBelow !== undefined) {
    const lim = (e.ohBelow && typeof e.ohBelow === 'object') ? ctx.cfg[e.ohBelow.cfgKey] : e.ohBelow;
    if (!(ctx.oh < lim)) return false;
  }
  // notLastRound: bara giltigt om det INTE är spelets sista år (effekter som gäller "nästa år" saknar
  // mening då). Kräver round + rounds i ctx; saknas de lämnas villkoret opåverkat (bakåtkompat).
  if (e.notLastRound && ctx.round !== undefined && ctx.rounds !== undefined && ctx.round >= ctx.rounds) return false;
  return true;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function selectProposals(bank, selection = {}, { isEligible = () => true, rng = Math.random } = {}) {
  const warnings = [];
  const count = selection.proposalCount ?? selection.count ?? null;
  const quotas = selection.quotas || null;
  const fill = selection.fillRemaining ?? 'random';
  const tagFilter = (selection.tags && selection.tags.length) ? selection.tags : null;

  let pool = bank.filter(p => isEligible(p));
  if (tagFilter) pool = pool.filter(p => (p.tags || []).some(t => tagFilter.includes(t)));
  // Kanon-sortering på id → resultatet beror bara på {poolens innehåll, rng}, inte bankens ordning.
  pool = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const chosenIds = new Set();
  const chosen = [];
  const take = (candidates, n, label) => {
    const avail = candidates.filter(p => !chosenIds.has(p.id));
    if (avail.length < n) warnings.push(`otillräckligt antal giltiga förslag för ${label}: begärde ${n}, fanns ${avail.length}`);
    const picked = shuffle(avail, rng);
    for (let i = 0; i < Math.min(n, avail.length); i++) { chosen.push(picked[i]); chosenIds.add(picked[i].id); }
  };

  // Kvoter per kategori (kategori-nycklar i sorterad ordning → reproducerbart).
  if (quotas) for (const cat of Object.keys(quotas).sort()) take(pool.filter(p => p.category === cat), quotas[cat], `kategori '${cat}'`);

  // Fyll upp till total.
  const target = count ?? pool.length;
  const remaining = target - chosen.length;
  if (remaining > 0) {
    if (fill === 'random') take(pool, remaining, 'slumpfyllnad');
    else warnings.push(`${remaining} platser kunde inte fyllas (fillRemaining='${fill}')`);
  }

  return { chosen: chosen.map(p => p.id), warnings };
}
