// tools/bot-policy-test.js — RIKTAT test för bot-policyn (Etapp 3b, Slice 3).
// Verifierar: botten väljer bara ur FAKTISKT tillåtna förslag (legacy + nytt urval), inga hårdkodade
// id:n, giltig A/B på dilemman, rimlig ja/nej-röstning. Plus en källkods-kontroll att inga hårdkodade
// förslags-id:n finns kvar i botlogiken. Exit 1 vid fel.
//
//   node tools/bot-policy-test.js

import { EcoLoco } from '../spec/engine.js';
import { PROPOSALS, proposalById } from '../spec/content/proposals.js';
import { DILEMMAS, dilemmaById } from '../spec/content/dilemmas.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { botPickProposal, botVoteProposal, botChooseDilemma } from '../spec/bot-policy.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

console.log('1) Ordförande väljer bara ur allowedProposals — DEFAULT-motorn (config-styrt urval)');
{
  const e = new EcoLoco(); e.start();
  const allowed = e.allowedProposals();
  ok(allowed.length === 5 && allowed.every(id => proposalById(id)), 'default: 5 jämbördiga förslag ur banken (inget hårdkodat grund-3)');
  let allIn = true;
  for (let i = 0; i < 200; i++) { const pick = botPickProposal(allowed, e.getState().oh); if (!allowed.includes(pick)) allIn = false; }
  ok(allIn, '200 val ligger alltid inom allowedProposals');
}

console.log('2) Ordförande väljer bara ur allowedProposals — NYTT URVAL (Mellan-variant)');
{
  const e = new EcoLoco({ seed: 3, ...VARIANTS.mellan }); e.start();
  const choices = e.getState().proposalChoices;
  const allowed = e.allowedProposals();
  ok(Array.isArray(choices) && choices.length === 5, 'proposalChoices satt (5)');
  ok(JSON.stringify(allowed.slice().sort()) === JSON.stringify(choices.slice().sort()), 'allowedProposals == proposalChoices (ingen grund-3-special)');
  let allIn = true, sawNonGrund = false;
  for (let i = 0; i < 200; i++) { const pick = botPickProposal(allowed, e.getState().oh); if (!choices.includes(pick)) allIn = false; if (!['gron', 'skatt', 'forbud'].includes(pick)) sawNonGrund = true; }
  ok(allIn, '200 val ligger inom de valda förslagen');
  ok(sawNonGrund, 'boten väljer även icke-grund-3-förslag (bevisar att grund-3 inte är hårdkodade)');
}

console.log('3) Miljö-preferens vid kris (metadata, inte id)');
{
  const allowed = PROPOSALS.map(p => p.id);
  let greenHits = 0;
  for (let i = 0; i < 300; i++) { const pick = botPickProposal(allowed, 20); if ((proposalById(pick)?.tags || []).includes('environment')) greenHits++; }
  ok(greenHits === 300, 'vid låg öhälsa väljs alltid ett environment-taggat förslag');
}

console.log('4) Dilemma A/B — giltigt val, kris väljer bäst för ön');
{
  const e = new EcoLoco(); e.start();
  for (const d of DILEMMAS) {
    const v = botChooseDilemma(e, d, e.team('aker'), e.cfg);
    ok(v === 'A' || v === 'B', `${d.id}: giltigt A/B (${v})`);
  }
  // konstruerat: kris → välj alternativet med högst öhälsa. algblomning A(+12) vs B(-10) → A.
  e.cfg.ohStart = 20; const e2 = new EcoLoco(); e2.cfg.ohStart = 20; e2.start();
  ok(botChooseDilemma(e2, dilemmaById('algblomning'), e2.team('aker'), e2.cfg) === 'A', 'kris: väljer A (räddar ön) för algblomning');
}

console.log('5) Ja/nej-röstning ger boolean och är rimlig');
{
  const e = new EcoLoco(); e.start();
  const t = e.team('tundra');
  ok(typeof botVoteProposal(e, proposalById('gron'), t, e.cfg) === 'boolean', 'returnerar boolean');
  // okänt (runtime-event, def saknas) → nappar ändå ibland utan att krascha
  ok(typeof botVoteProposal(e, undefined, t, e.cfg) === 'boolean', 'okänt förslag (event) → boolean utan krasch');
}

console.log('6) Källkod: inga hårdkodade förslags-id:n kvar i botlogiken');
{
  const ids = PROPOSALS.map(p => p.id);
  const files = ['server/server.js', 'spec/mock-opponents.js', 'src/ui.js'];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    // leta efter bot-nära rader som nämner ett förslags-id som sträng (grov men träffsäker heuristik)
    const lines = src.split('\n');
    const hits = [];
    lines.forEach((ln, i) => {
      const low = ln.toLowerCase();
      // Smal heuristik: bara FAKTISKA bot-beslutsfunktioner (ej presentation som propDefs/openProposal).
      const botnara = /botpick|botvote|botchoose|botordforande|botmakt|mockopponentsvote|pickbotproposal|bot-nära|bot väljer|botten/.test(low);
      if (!botnara) return;
      for (const id of ids) { if (new RegExp(`['"\`]${id}['"\`]`).test(ln)) hits.push(`${f}:${i + 1} → '${id}'`); }
    });
    ok(hits.length === 0, `${f}: inga hårdkodade förslags-id:n i bot-nära rader${hits.length ? ' — ' + hits.join(', ') : ''}`);
  }
}

console.log(fails === 0 ? '\n[bot-policy] ALLA TESTER OK' : `\n[bot-policy] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
