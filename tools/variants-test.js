// tools/variants-test.js — RIKTAT test för versionskonfigurationerna (Etapp 3a).
// Verifierar: alla tre laddas, är fullständiga + konsekventa, och kör på SAMMA motor. Exit 1 vid fel.
//
//   node tools/variants-test.js

import { VARIANTS, VARIANT_IDS, loadVariant } from '../spec/config/variants/index.js';
import { EcoLoco } from '../spec/engine.js';

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { console.error(`  ✗ ${msg}`); fails++; } };

console.log('1) Alla tre laddas');
{
  ok(VARIANT_IDS.length === 3, 'tre varianter registrerade');
  ok(['flash', 'mellan', 'skola'].every(id => VARIANTS[id]), 'flash + mellan + skola finns');
  ok(loadVariant('mellan').id === 'mellan', 'loadVariant hämtar rätt');
  let threw = false; try { loadVariant('finns-inte'); } catch { threw = true; }
  ok(threw, 'okänt id kastar (ingen tyst standard-fallback)');
}

console.log('2) Fullständighet — varje config har de versions-definierande fälten');
{
  const required = ['id', 'namn', 'rounds', 'timerSec', 'phases', 'decisionSystem', 'features', 'modules', 'content', 'mode'];
  for (const id of VARIANT_IDS) {
    const v = VARIANTS[id];
    const saknas = required.filter(k => v[k] === undefined);
    ok(saknas.length === 0, `${id}: alla obligatoriska fält (${saknas.length ? 'saknar: ' + saknas : 'ok'})`);
    ok(v.phases && ['bygga', 'prisutdelning', 'politik'].every(f => typeof v.phases[f] === 'number'), `${id}: fas-tider kompletta`);
  }
}

console.log('3) Konsekvens — beslutssystem matchar sin urvalskonfiguration');
{
  for (const id of VARIANT_IDS) {
    const v = VARIANTS[id];
    ok(['politics', 'dilemma'].includes(v.decisionSystem), `${id}: giltigt decisionSystem (${v.decisionSystem})`);
    if (v.decisionSystem === 'politics') {
      ok(v.politics && v.politics.proposalCount != null, `${id}: politics har proposalCount`);
      ok(v.content.proposals !== false, `${id}: politik-variant använder politikbanken`);
    } else {
      ok(v.dilemma && v.dilemma.perRound != null, `${id}: dilemma har perRound`);
      ok(v.content.proposals === false, `${id}: dilemma-variant använder INTE politikbanken`);
    }
  }
}

console.log('4) Ingen version är inbyggd standard — alla sätter sina egna strukturvärden explicit');
{
  const rounds = VARIANT_IDS.map(id => VARIANTS[id].rounds);
  ok(VARIANT_IDS.every(id => typeof VARIANTS[id].rounds === 'number'), 'alla sätter rounds explicit');
  ok(new Set(rounds).size === 3, 'olika rundantal (4/8/10) → tre distinkta versioner');
  ok(new Set(VARIANT_IDS.map(id => VARIANTS[id].id)).size === 3, 'distinkta id:n');
}

console.log('5) Samma motor — varje config instansierar EcoLoco och speglar sina värden');
{
  for (const id of VARIANT_IDS) {
    const v = VARIANTS[id];
    const engine = new EcoLoco(v);
    engine.start();
    ok(engine instanceof EcoLoco, `${id}: körs på EcoLoco-motorn`);
    ok(engine.cfg.rounds === v.rounds, `${id}: rounds (${v.rounds}) genomslag i motorn`);
    ok(engine._decisionSystem === v.decisionSystem, `${id}: decisionSystem genomslag`);
    const S = engine.getState();
    if (v.decisionSystem === 'dilemma') ok(Array.isArray(S.decisionChoices), `${id}: decisionChoices satt`);
    else ok(Array.isArray(S.proposalChoices), `${id}: proposalChoices satt`);
    ok(S.round === 1 && S.teams.length === 4 && S.oh === engine.cfg.ohStart, `${id}: gemensam grundstruktur (4 lag, öhälsa, år 1)`);
  }
}

console.log('6) Default-motorn (ingen variant) kör config-styrt urval (Slice 6B: inget legacy)');
{
  const bare = new EcoLoco(); bare.start();
  ok(Array.isArray(bare.getState().proposalChoices) && bare.getState().proposalChoices.length === 5, 'naken motor: 5 jämbördiga förslag ur default-config');
}

console.log(fails === 0 ? '\n[variants] ALLA TESTER OK' : `\n[variants] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
