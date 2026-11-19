// tools/mellan-politik-test.js — RIKTAT test för den omarbetade politikbanken (2026-11-19).
// Verifierar Klara/Josef-besluten: gemensam 15-förslagsbank, fyra kategorier, Mellans fasta
// kategorikvoter, Industriskatt/Naturbruksskatt-symmetrin, borttagna förslag, Skolas slumpurval.
// Assertions → exit 1 vid fel.
//
//   node tools/mellan-politik-test.js

import { PROPOSALS, proposalById } from '../spec/content/proposals.js';
import { selectProposals, proposalEligible, makeRng } from '../spec/systems/proposal-selector.js';
import { loadVariant } from '../spec/config/variants/index.js';
import { EcoLoco } from '../spec/engine.js';

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { console.error(`  ✗ ${msg}`); fails++; } };
const uniq = a => new Set(a).size === a.length;
const cfg = { krisProposalOh: 20 };
const catCount = ids => ids.reduce((m, id) => { const c = proposalById(id).category; m[c] = (m[c] || 0) + 1; return m; }, {});

console.log('1) Gemensam bank: exakt 15 aktiva förslag med giltiga kategorier');
{
  ok(PROPOSALS.length === 15, `15 förslag i banken (nu ${PROPOSALS.length})`);
  const valid = new Set(['future', 'cooperation', 'polluter', 'sector']);
  ok(PROPOSALS.every(p => valid.has(p.category)), 'alla har en av de fyra kategorierna');
  const counts = catCount(PROPOSALS.map(p => p.id));
  ok(counts.future === 2, `future = 2 (nu ${counts.future})`);
  ok(counts.cooperation === 5, `cooperation = 5 (nu ${counts.cooperation})`);
  ok(counts.polluter === 4, `polluter = 4 (nu ${counts.polluter})`);
  ok(counts.sector === 4, `sector = 4 (nu ${counts.sector})`);
}

console.log('2) De fyra borttagna förslagen finns INTE i banken');
{
  for (const id of ['sektorblockad', 'byggboom', 'raddningsfond', 'lojalitet']) {
    ok(!proposalById(id), `${id} borttaget`);
  }
}

console.log('3) Industriskatt (id sektorskatt) behåller id, nytt namn; Naturbruksskatt är ny spegel');
{
  const ind = proposalById('sektorskatt');
  ok(!!ind, "id 'sektorskatt' finns kvar (inga brutna referenser)");
  ok(ind && ind.namn === 'Industriskatt', 'namn = Industriskatt');
  ok(ind && ind.category === 'sector', 'Industriskatt är sector');
  const nat = proposalById('naturbruksskatt');
  ok(!!nat, 'naturbruksskatt tillagt');
  ok(nat && nat.category === 'sector', 'Naturbruksskatt är sector');
  const indPot = ind.effects.find(e => e.type === 'pot');
  const natPot = nat.effects.find(e => e.type === 'pot');
  ok(indPot.from === 'sectorPengar' && indPot.to === 'sectorMaterial', 'Industriskatt: pengar→material');
  ok(natPot.from === 'sectorMaterial' && natPot.to === 'sectorPengar', 'Naturbruksskatt: material→pengar (spegel)');
}

console.log('4) Mellans fasta fördelning: exakt 1 future + 1 sector + 2 cooperation + 1 polluter');
{
  const mellan = loadVariant('mellan');
  const sel = { proposalCount: mellan.politics.proposalCount, ...mellan.politics.selection };
  let allOk = true, noDupes = true, noWarn = true;
  for (const oh of [50, 10]) {            // öh≥20 (krispaket ute) OCH öh<20 (krispaket inne)
    const isEligible = p => proposalEligible(p, { oh, cfg });
    for (let seed = 1; seed <= 60; seed++) {
      const { chosen, warnings } = selectProposals(PROPOSALS, sel, { isEligible, rng: makeRng(seed) });
      const c = catCount(chosen);
      if (!(chosen.length === 5 && c.future === 1 && c.sector === 1 && c.cooperation === 2 && c.polluter === 1)) allOk = false;
      if (!uniq(chosen)) noDupes = false;
      if (warnings.length) noWarn = false;
    }
  }
  ok(allOk, '120 Ö-råd (öh 50 + 10, seed 1–60): alltid 1/1/2/1, totalt 5');
  ok(noDupes, 'aldrig dubbletter inom ett Ö-råd');
  ok(noWarn, 'aldrig varningar (alla kategorier har nog med giltiga förslag)');
}

console.log('5) krispaket-eligibility inom cooperation-kvoten');
{
  const mellan = loadVariant('mellan');
  const sel = { proposalCount: mellan.politics.proposalCount, ...mellan.politics.selection };
  let hiHasKris = false, loCanHaveKris = false;
  for (let seed = 1; seed <= 100; seed++) {
    const hi = selectProposals(PROPOSALS, sel, { isEligible: p => proposalEligible(p, { oh: 50, cfg }), rng: makeRng(seed) }).chosen;
    const lo = selectProposals(PROPOSALS, sel, { isEligible: p => proposalEligible(p, { oh: 10, cfg }), rng: makeRng(seed) }).chosen;
    if (hi.includes('krispaket')) hiHasKris = true;
    if (lo.includes('krispaket')) loCanHaveKris = true;
  }
  ok(!hiHasKris, 'öhälsa ≥ 20: krispaket förekommer ALDRIG');
  ok(loCanHaveKris, 'öhälsa < 20: krispaket KAN förekomma');
}

console.log('6) Industriskatt + Naturbruksskatt: symmetriska och aldrig negativa');
{
  // Stagea ett förslag direkt (förbi urvals-gaten) och kör _resolveProposal, som golden-testet gör.
  function resolve(type, pengar) {
    const engine = new EcoLoco(); engine.start();
    const S = engine.getState();
    for (const t of S.teams) t.pengar = pengar[t.id];
    S.proposal = { type, by: 'aker', votes: {}, resolved: false, passed: false };
    S.teams.forEach((t, i) => { S.proposal.votes[t.id] = (i !== 3); });   // 3 ja → passerar grinden
    engine._resolveProposal();
    return Object.fromEntries(engine.getState().teams.map(t => [t.id, t.pengar]));
  }
  // aker/skog = materialsektor (Oxen/Björnen); tundra/stad = pengarsektor (Räven/Örnen).
  const start = { aker: 100, skog: 100, tundra: 100, stad: 100 };
  const ind = resolve('sektorskatt', start);       // pengar→material: tundra/stad −12, aker/skog +12
  const nat = resolve('naturbruksskatt', start);    // material→pengar: aker/skog −12, tundra/stad +12
  ok(ind.tundra === 88 && ind.stad === 88 && ind.aker === 112 && ind.skog === 112, 'Industriskatt: Räven/Örnen 88, Oxen/Björnen 112');
  ok(nat.aker === 88 && nat.skog === 88 && nat.tundra === 112 && nat.stad === 112, 'Naturbruksskatt: Oxen/Björnen 88, Räven/Örnen 112 (spegel)');
  // Fattig betalare → golvas vid 0, blir aldrig negativ.
  const poor = resolve('naturbruksskatt', { aker: 5, skog: 100, tundra: 100, stad: 100 });
  ok(poor.aker === 0, 'fattig betalare golvas vid 0 (betalar allt, aldrig negativt)');
}

console.log('7) Skola: samma bank, men oförändrat SLUMPURVAL (inga kategorikvoter)');
{
  const skola = loadVariant('skola');
  ok(Object.keys(skola.politics.selection.quotas || {}).length === 0, 'Skola har inga kategorikvoter');
  const sel = { proposalCount: skola.politics.proposalCount, ...skola.politics.selection };
  const { chosen, warnings } = selectProposals(PROPOSALS, sel, { isEligible: p => proposalEligible(p, { oh: 50, cfg }), rng: makeRng(11) });
  ok(chosen.length === 5 && uniq(chosen), 'Skola: 5 slumpade förslag utan dubbletter');
  ok(chosen.every(id => proposalById(id)), 'alla ur den gemensamma 15-banken');
  ok(warnings.length === 0, 'inga varningar');
}

console.log('8) Motor-integration: Mellan-varianten ger 1/1/2/1 i S.proposalChoices');
{
  // Motorn använder cfg.seed + round för rng (se _rollProposalChoices). Kör några år.
  const mellan = loadVariant('mellan');
  let allOk = true;
  for (let seed = 1; seed <= 10; seed++) {
    const engine = new EcoLoco({ ...mellan, seed });
    engine.start();
    const picks = engine.getState().proposalChoices;
    const c = catCount(picks);
    if (!(picks.length === 5 && c.future === 1 && c.sector === 1 && c.cooperation === 2 && c.polluter === 1)) allOk = false;
  }
  ok(allOk, 'motorn (new EcoLoco(mellan)) ger 1/1/2/1 i proposalChoices');
}

console.log(fails === 0 ? '\n[mellan-politik] ALLA TESTER OK' : `\n[mellan-politik] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
