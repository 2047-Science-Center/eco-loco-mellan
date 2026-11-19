// tools/variant-select-test.js — RIKTAT test för serverns versionsval (Etapp 3b, Slice 1).
// Testar den rena hjälparen server/variant-config.js + kärnkravet att ett versionsbyte inte
// förändrar ett redan byggt (pågående) parti. Exit 1 vid fel.
//
//   node tools/variant-select-test.js

import { buildEngineConfig, isValidVariant, VARIANT_IDS } from '../server/variant-config.js';
import { EcoLoco } from '../spec/engine.js';

let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const manifest = { mode: 'tutorial' };   // liknar spec/assets.json → config

console.log('1) Giltighetskoll');
{
  ok(isValidVariant(null), 'null (standard) giltigt');
  ok(['flash', 'mellan', 'skola'].every(isValidVariant), 'flash/mellan/skola giltiga');
  ok(!isValidVariant('xyz'), 'okänt id ogiltigt');
  ok(VARIANT_IDS.length === 3, 'tre varianter');
}

console.log('2) buildEngineConfig: null → legacy (bara manifest), variant → variantens värden');
{
  const legacy = buildEngineConfig(manifest, null);
  ok(legacy.rounds === undefined && legacy.mode === 'tutorial', 'legacy: inga variant-override (motorns DEFAULT_CONFIG gäller)');
  const flash = buildEngineConfig(manifest, 'flash');
  ok(flash.rounds === 4 && flash.decisionSystem === 'dilemma', 'flash: rounds 4 + decisionSystem dilemma');
  const skola = buildEngineConfig(manifest, 'skola');
  ok(skola.rounds === 10 && skola.decisionSystem === 'politics', 'skola: rounds 10 + politics');
}

console.log('3) Motorn byggd ur configen speglar versionen');
{
  for (const [id, rounds, ds] of [[null, 8, 'politics'], ['flash', 4, 'dilemma'], ['mellan', 8, 'politics'], ['skola', 10, 'politics']]) {
    const e = new EcoLoco(buildEngineConfig(manifest, id)); e.start();
    ok(e.cfg.rounds === rounds, `${id || 'legacy'}: rounds ${rounds}`);
    ok((e._decisionSystem) === ds, `${id || 'legacy'}: decisionSystem ${ds}`);
  }
  // Slice 6B: ingen legacy längre — även en naken config (null-variant) kör config-styrt urval.
  const bareEngine = new EcoLoco(buildEngineConfig(manifest, null)); bareEngine.start();
  ok(Array.isArray(bareEngine.getState().proposalChoices), 'null-variant: config-styrt urval (inget legacy)');
}

console.log('4) Versionsbyte förändrar INTE ett redan byggt parti');
{
  // Simulera serverns flöde: selectedVariant → newEngine låser partiets config; byt selectedVariant
  // efteråt → ett NYTT engine får nya versionen, men det gamla engine-objektet är oförändrat.
  let selectedVariant = 'mellan';
  const pågående = new EcoLoco(buildEngineConfig(manifest, selectedVariant)); pågående.start();
  const rundaMitt = pågående.getState().round;
  selectedVariant = 'flash';                       // spelledaren byter MITT i partiet
  const nästaParti = new EcoLoco(buildEngineConfig(manifest, selectedVariant)); nästaParti.start();
  ok(pågående.cfg.rounds === 8, 'pågående parti behåller Mellan (rounds 8) trots byte');
  ok(pågående.getState().round === rundaMitt, 'pågående partis tillstånd orört av bytet');
  ok(nästaParti.cfg.rounds === 4, 'nästa parti får Flash (rounds 4)');
}

console.log(fails === 0 ? '\n[variant-select] ALLA TESTER OK' : `\n[variant-select] ${fails} TEST MISSLYCKADES`);
process.exit(fails === 0 ? 0 : 1);
