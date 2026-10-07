// tools/generera-rigg-ljud.js — genererar förstärkningsriggens ljud via ElevenLabs SFX-API.
// Filer hamnar i assets/audio/rigg/ som .mp3 (hjarna-stubb.py hittar .mp3 även när den frågar .wav).
//
//   export ELEVENLABS_API_KEY=sk_...
//   node tools/generera-rigg-ljud.js            (hoppar över filer som finns)
//   node tools/generera-rigg-ljud.js --force    (gör om allt)

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Sätt ELEVENLABS_API_KEY i miljön först.'); process.exit(1); }
const FORCE = process.argv.includes('--force');
const DIR = join(fileURLToPath(import.meta.url), '..', '..', 'assets', 'audio', 'rigg');
mkdirSync(DIR, { recursive: true });

// [fil, prompt, sekunder]
const LJUD = [
  ['kris',             'urgent low alarm klaxon pulsing warning, tense danger throb, deep red-alert siren, no music', 3.0],
  ['attract',          'calm atmospheric ambient intro, mysterious yet hopeful soft pulsing pad drone, slow and immersive, no melody', 14],
  ['countdown',        'tense ticking clock countdown, steady ticks rising in urgency toward a final beat, no music', 9.0],
  ['award_sabotor',    'comedic ominous shame trombone wah-wah sting, playful villain reveal, short', 1.6],
  ['award_foretagare', 'triumphant short brass fanfare, celebratory business award jingle, bright', 1.8],
  ['award_eldsjal',    'warm uplifting wholesome chime, gentle heartfelt celebration, soft sparkle', 1.6],
  ['ding',             'single bright positive coin ding, clean and short', 0.6],
  // Fem kontinuerliga soundscapes (loopar, ~22 s) — samma atmosfäriska vibe som attract,
  // subtil mänsklig chatter inblandad, humör från upprorsstämning (1) till glatt (5).
  ['soundscape_1', 'immersive ambient soundscape loop, uneasy restless atmosphere, distant angry crowd murmur and faint protest chants very subtle low in the mix, dark tense drone pad, smoldering unrest, no music melody', 22],
  ['soundscape_2', 'immersive ambient soundscape loop, subdued uneasy atmosphere, faint worried human chatter low and subtle in the background, muted grey drone pad, quiet tension, no music melody', 22],
  ['soundscape_3', 'immersive ambient soundscape loop, calm balanced atmosphere, soft distant town murmur and gentle human chatter very subtle, mellow neutral drone pad, steady and immersive, no music melody', 22],
  ['soundscape_4', 'immersive ambient soundscape loop, warm pleasant atmosphere, faint content human chatter and light laughter subtle in the background, gentle hopeful drone pad, soft distant birds, no music melody', 22],
  ['soundscape_5', 'immersive ambient soundscape loop, bright joyful atmosphere, subtle happy human chatter and distant festive murmur low in the mix, warm uplifting drone pad, lively but gentle, no music melody', 22],
];

for (const [namn, text, dur] of LJUD) {
  const fil = join(DIR, `${namn}.mp3`);
  if (existsSync(fil) && !FORCE) { console.log(`↷ ${namn}.mp3 finns — hoppar över`); continue; }
  process.stdout.write(`♪ ${namn}.mp3 … `);
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: dur, prompt_influence: 0.5 }),
  });
  if (!r.ok) { console.log(`FEL ${r.status}: ${(await r.text()).slice(0, 200)}`); continue; }
  writeFileSync(fil, Buffer.from(await r.arrayBuffer()));
  console.log('klar');
}
console.log('\nFärdigt → assets/audio/rigg/. Testa: afplay assets/audio/rigg/award_eldsjal.mp3');
