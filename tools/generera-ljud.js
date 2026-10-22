// tools/generera-ljud.js — skärmens interaktions-/UI-ljud via ElevenLabs SFX (webbläsarlagret).
// LJUDIDENTITET: Riktning A "Centralmaktens etersändning" (se design/LJUDIDENTITET.md).
// Samma gemensamma PREFIX som centrallagret (generera-rigg-ljud.js) → skärm + show = samma maskin.
// Skärmljuden är KORTA och TORRA, men bär samma sliten-PA/band-finish subtilt.
// Filnamnen matchar spec/assets.json → audio. UI-familjen härleds ur ett torrt konsol-ankare (ui_tap).
//
//   export ELEVENLABS_API_KEY=sk_...
//   node tools/generera-ljud.js            (hoppar över filer som finns)
//   node tools/generera-ljud.js --force    (gör om allt)
//
// OBS: de gamla orphan-ljuden (round_start/event/award_led/eld/sab/win/lose/amb_*) genereras INTE
// längre här — de ligger centralt i assets/audio/rigg/ (se spec/assets.json). Radera orphan-filerna.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Sätt ELEVENLABS_API_KEY i miljön först.'); process.exit(1); }
const FORCE = process.argv.includes('--force');
const DIR = join(fileURLToPath(import.meta.url), '..', '..', 'assets', 'audio');
mkdirSync(DIR, { recursive: true });

// Samma stil-lim som centrallagret (håll identisk med PREFIX i generera-rigg-ljud.js).
export const PREFIX = 'through Centralmaktens worn PA loudspeaker, driven valve-and-tape saturation and light distortion, tape hiss and wow-flutter, institutional melancholic not arcade, no music no melody no voice';

// [fil, specifik beskrivning, sekunder]  — slutlig prompt = `${desc}, ${PREFIX}`
const SPEC = [
  // De tre signatur-byggljuden (tonal trappa: smutsig lågt/dovt → grön mjukt/organiskt)
  ['build_smutsig',  'a short low industrial placement thunk with a dull muffled rumble, slightly ominous and grounded', 1.0],
  ['build_standard', 'a short neutral mechanical placement thunk, a plain muted wooden-and-metal tap', 0.7],
  ['build_gron',     'a short soft organic placement tone with a gentle warm resonance and a faint shimmer, pleasant', 1.0],

  // UI-familjen (ankaret ui_tap varieras i tonhöjd/riktning — EN familj, inte spridda ljud)
  ['ui_tap',     'a short dry console tap, a single soft muted key-press blip with a quick damped tail', 0.6],
  ['ui_confirm', 'a short confirm blip, a soft muted rising two-note, positive and understated', 0.6],
  ['ui_reject',  'a short reject blip, a soft muted falling two-note, polite not harsh', 0.6],
  ['ui_hover',   'a very short faint hover blip, a tiny muted neutral tick, subtle', 0.5],
  ['ui_open',    'a short open cue, a soft muted blip with a quick upward filtered swell, a panel appearing', 0.7],
  ['ui_close',   'a short close cue, a soft muted blip with a quick downward swell, a panel dismissed', 0.6],
  ['ui_notis',   'a soft muted two-note notification ping, neutral and calm', 0.8],
  ['ui_back',    'a short back blip, a soft muted neutral falling tone', 0.6],
  ['ui_tick',    'a very short dry counting tick, a soft muted mid tone', 0.5],

  // Interaktion / feedback
  ['trade',         'a short muted resource-exchange chime, a soft warm two-part swap, light and positive', 0.8],
  ['vote',          'a short muted gavel tap, a soft civic knock, decisive but warm', 0.6],
  ['proposal_pass', 'a brief muted positive confirmation, a soft low-key two-note, warm', 1.0],
  ['proposal_fail', 'a brief soft muted negative tone, a gentle institutional rejection', 1.0],
];

const LJUD = SPEC.map(([namn, desc, dur]) => [namn, `${desc}, ${PREFIX}`, dur]);

// Guard: ElevenLabs tar max 450 tecken/prompt.
console.log(`PREFIX (${PREFIX.length} tecken)`);
let bad = false;
for (const [namn, text] of LJUD) { if (text.length > 450) { console.error(`FÖR LÅNG (${text.length}): ${namn}`); bad = true; } }
if (bad) { console.error('Avbryter — korta ner markerade prompts.'); process.exit(1); }

for (const [namn, text, dur] of LJUD) {
  const fil = join(DIR, `${namn}.mp3`);
  if (existsSync(fil) && !FORCE) { console.log(`↷ ${namn}.mp3 finns — hoppar över`); continue; }
  process.stdout.write(`♪ ${namn}.mp3 … `);
  const body = { text, model_id: 'eleven_text_to_sound_v2', duration_seconds: dur, prompt_influence: 0.6 };
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.log(`FEL ${r.status}: ${(await r.text()).slice(0, 200)}`); continue; }
  writeFileSync(fil, Buffer.from(await r.arrayBuffer()));
  console.log('klar');
}
console.log('\nFärdigt → assets/audio/. UI-familjen kräver nya nycklar i spec/assets.json + anrop i src/ui.js (se design/LJUDIDENTITET.md).');
