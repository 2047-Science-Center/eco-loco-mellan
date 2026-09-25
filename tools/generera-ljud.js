// tools/generera-ljud.js — genererar spelets alla ljud via ElevenLabs Sound Effects-API.
// Prompterna kommer från design/AUDIO.md; filnamnen matchar spec/assets.json → audio.
//
//   export ELEVENLABS_API_KEY=sk_...      (eller lägg nyckeln i .env-fil och source:a den)
//   node tools/generera-ljud.js           (hoppar över filer som redan finns)
//   node tools/generera-ljud.js --force   (genererar om allt)
//
// Ambienserna görs som ~20 s loopar; korsfadningen i src/audio.js döljer skarven.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Sätt ELEVENLABS_API_KEY i miljön först.'); process.exit(1); }
const FORCE = process.argv.includes('--force');
const DIR = join(fileURLToPath(import.meta.url), '..', '..', 'assets', 'audio');
mkdirSync(DIR, { recursive: true });

// [fil, prompt, sekunder, loop]
const LJUD = [
  // De tre signatur-byggljuden (tonal trappa: smutsig lågt/dissonant → grön ljust/konsonant)
  ['build_smutsig', 'short low industrial machine clank with a dull rumble and a puff of steam, slightly dissonant, ominous, game build sound, no music', 1.0],
  ['build_standard', 'short neutral mechanical construction thunk, a single wooden-and-metal placement sound, plain and clean, game build sound, no music', 0.7],
  ['build_gron', 'short bright organic chime with a soft sprout leaf shimmer and a gentle wind, pleasant and harmonic, game build sound, no music', 1.0],
  // Grund-SFX
  ['ui_tap', 'soft UI tap, clean, short, subtle', 0.5],
  ['trade', 'quick coin and resource exchange chime, light and positive', 0.8],
  ['vote', 'short wooden gavel tap, civic, decisive', 0.6],
  ['proposal_pass', 'brief positive two-note confirmation chime, bright', 1.0],
  ['proposal_fail', 'brief soft negative buzz, muted, gentle rejection', 1.0],
  ['round_start', 'gentle round-start bell, hopeful, single clear tone', 1.2],
  ['event', 'short dramatic warning sting, low brass hit with alarm tail, urgent', 1.6],
  // Award-stingar
  ['award_led', 'triumphant short brass fanfare, celebratory, game award jingle', 1.6],
  ['award_eld', 'warm uplifting short chime, wholesome, gentle celebration', 1.4],
  ['award_sab', 'comedic ominous short sting, playful shame trombone wah wah', 1.4],
  // Slutstingar
  ['win', 'warm victorious musical resolve, bright and hopeful, game victory sting', 2.6],
  ['lose', 'somber descending musical sting, muted and heavy, game defeat', 2.6],
  // De fem öhälso-ambienserna (loopar)
  ['amb_superdaligt', 'bleak industrial ambience loop, distant coughing crowd, heavy machinery hum, cold wind, oppressive smog atmosphere', 20, true],
  ['amb_daligt', 'muted industrial ambience loop, faint machinery, occasional lonely bird, uneasy grey atmosphere', 20, true],
  ['amb_neutralt', 'balanced calm ambient loop, light wind, faint distant town and nature mixed', 20, true],
  ['amb_bra', 'pleasant nature ambience loop, birdsong, light breeze, faint cheerful voices far away', 20, true],
  ['amb_mycketbra', 'joyful thriving nature ambience loop, lively birds, gentle festive murmur, warm and bright', 20, true],
];

for (const [namn, text, dur, loop] of LJUD) {
  const fil = join(DIR, `${namn}.mp3`);
  if (existsSync(fil) && !FORCE) { console.log(`↷ ${namn}.mp3 finns — hoppar över`); continue; }
  process.stdout.write(`♪ ${namn}.mp3 … `);
  const body = { text, duration_seconds: dur, prompt_influence: 0.5 };
  if (loop) body.loop = true;   // stöds av nyare API:t; ta bort raden om servern klagar
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.log(`FEL ${r.status}: ${(await r.text()).slice(0, 200)}`); continue; }
  writeFileSync(fil, Buffer.from(await r.arrayBuffer()));
  console.log('klar');
}
console.log('\nFärdigt. Ljuden pekas redan ut i spec/assets.json — ladda om spelet så spelar de.');
