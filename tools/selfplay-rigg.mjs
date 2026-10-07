// selfplay-rigg.mjs — kör ett RIKTIGT parti (bots) och driver riggen via src/rigg.js.
// Kedjan: detta -> semantik -> (hjarna-stubb.py) -> granulärt -> firmware -> strip + ljud.
// Noll npm-beroenden: publicerar via mosquitto_pub (installerat).
//
//   BROKER=localhost node tools/selfplay-rigg.mjs
//
// Kräver att brokern, hjarna-stubb.py och firmware-Amican är igång (som för mockarna).

import { EcoLoco } from '../spec/engine.js';
import { attachRigg } from '../src/rigg.js';
import { execFile } from 'node:child_process';

const BROKER = process.env.BROKER || 'localhost';
const PORT   = process.env.PORT   || '1883';
const pub = (t, m) => execFile('mosquitto_pub', ['-h', BROKER, '-p', PORT, '-t', t, '-m', String(m)]);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const TIERS = ['smutsig', 'standard', 'gron'];
const pick  = () => TIERS[Math.floor(Math.random() * 3)];

const engine = new EcoLoco();
// Snabbare ceremoni för demon (drift-default i rigg.js är 10 s/pris).
const handle = attachRigg(engine, { publish: pub, waveMs: 3000, awardMs: 4000 });

console.log(`Selfplay mot ${BROKER}:${PORT} — Ctrl-C för att avbryta.`);
engine.start();
await sleep(2000);

while (!engine.getState().over) {
  console.log(`-- Runda ${engine.getState().round} --`);
  for (const t of engine.getState().teams) {
    for (const tier of [pick(), 'smutsig', 'standard', 'gron']) {
      if (engine.selectCard(t.id, tier).ok) break;   // köp första som går
    }
  }
  await sleep(1500);            // "spelarna agerar"
  engine.endRound();           // bokslut -> rigg.js startar ceremonin
  await handle.whenIdle();     // vänta tills award-ceremonin spelat klart
  await sleep(800);
}
console.log('Parti slut.');
await sleep(500);
process.exit(0);
