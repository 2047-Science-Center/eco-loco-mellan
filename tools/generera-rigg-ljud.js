// tools/generera-rigg-ljud.js — genererar förstärkningsriggens / centralhögtalarens ljud via ElevenLabs SFX-API.
// Filer hamnar i assets/audio/rigg/ som .mp3 (hjarna-stubb.py hittar .mp3 även när den frågar .wav).
//
//   export ELEVENLABS_API_KEY=sk_...
//   node tools/generera-rigg-ljud.js            (hoppar över filer som finns)
//   node tools/generera-rigg-ljud.js --force    (gör om allt)
//
// Alla dessa ljud spelas i CENTRALHÖGTALAREN (showlagret). Skärmarnas klick-/feedbackljud
// ligger separat i tools/generera-ljud.js och är OFÖRÄNDRADE. Ljudidentitet: sliten analog-
// institutionell "show" — mer produktion/drama än skärmens torra feedback, men aldrig arkadigt.

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
  // ——— Ambienser: ENDA ambiensfamiljen (skärmarna har inget ambient-ljud) ———
  ['soundscape_1', 'a bleak cinematic ambience loop, oppressive smog-grey atmosphere with deep sub-bass weight, a restless distant crowd murmur and very faint protest chants surging and fading low in the mix, heavy machinery hum, cold wind gusts, a dark slowly-evolving low drone pad with tape saturation, tense and smoldering, seamless loop, warm analog room, no music melody', 22],
  ['soundscape_2', 'a muted cinematic ambience loop, uneasy grey atmosphere, faint distant machinery and a lonely bird, very subtle worried human chatter drifting far away, a dull neutral drone pad with slow swells and gentle sub weight, quiet unresolved tension, seamless loop, warm analog room, no music melody', 22],
  ['soundscape_3', 'a balanced immersive ambience loop, poised calm atmosphere, light wind and a soft distant town murmur mixed with faint nature, gentle neutral chatter very subtle, a mellow steady drone pad breathing slowly with warm tape, composed and cinematic yet understated, seamless loop, warm analog room, no music melody', 22],
  ['soundscape_4', 'a warm pleasant ambience loop, hopeful open atmosphere, gentle birdsong and a light breeze, faint content chatter and soft distant laughter, a warm drone pad with slow uplifting swells and a little shimmer, cinematic but calm, seamless loop, warm analog room, no music melody', 22],
  ['soundscape_5', 'a bright thriving ambience loop, warm joyful open atmosphere, lively birds and a gentle festive distant murmur with soft happy chatter, a warm uplifting drone pad with airy swells, lively but graceful, cinematic glow, seamless loop, warm analog room, no music melody', 22],

  // ——— Attract / viloläge ———
  ['attract', 'a slow immersive attract-mode loop, mysterious yet hopeful, a deep pulsing low harmonium drone with faint distant island wind, a barely-there heartbeat sub-pulse and occasional soft tape-saturated swells rising and settling, institutional and melancholic, cinematic and inviting, seamless loop, warm analog room, no melody, no music', 14],

  // ——— Runda / förslag / nedräkning ———
  ['round_start',   'a calm institutional round cue opening the room, the two-note harmonium motif rising a gentle neutral interval with a soft produced swell and light room bloom, like a meeting called to order, warm analog tape, cinematic but understated, no fanfare, no music', 1.3],
  ['proposal_open', 'a short attention cue, a soft paper-and-gavel motion placed on the table, the two-note harmonium motif rising gently underneath, calling the room to a vote, warm analog tape, civic and poised, no music', 0.9],
  ['countdown',     'a nine-second tension builder, a dry wooden clock ticking steadily while a low drone and sub-bass slowly rise beneath it, the ticks tightening and accelerating with mounting urgency, resolving on one firm decisive low hit, cinematic and tense, warm analog tape, no melody, no music', 9.0],

  // ——— Kris / varning (VMA-färgat, evokativt — ej exakt skarpsignal) ———
  ['kris', 'a weathered outdoor public-warning siren rising across a fogbound city, a slow rising-and-holding two-tone air-raid signal reminiscent of a Swedish VMA alert, heard distant through an old loudspeaker with a deep ominous sub-bass swell underneath, pulsing and dramatic, degraded warm analog tape, no music', 3.0],

  // ——— Awards (stillsam pondus, laddade +/- efter typ) ———
  ['award_foretagare', 'a dignified award flourish for business of the year, a warm muted brass-and-harmonium swell with a slow produced rise and a gentle reverberant tail, quiet institutional pride, clearly celebratory and positive but restrained and a touch melancholic, cinematic room, warm analog tape, no jubilant fanfare loop, no music', 1.8],
  ['award_eldsjal',    'a warm heartfelt award cue, a gentle rising harmonium phrase with a soft produced sparkle and a tender reverberant bloom, sincere and clearly positive, understated celebration with warmth, cinematic room, warm analog tape, no bright digital bells, no music', 1.6],
  ['award_sabotor',    'a dark dramatic reveal sting for the saboteur of the year, a low dissonant brass-and-reed swell with ominous sub-bass and a tense held cluster easing into shadow, clearly negative and unsettling, dignified dramatic tension not comedy, cinematic room, warm degraded analog tape, no wah, no slapstick, no music', 1.6],

  // ——— Slutscener ———
  ['win',  'a warm cinematic resolving cadence, a harmonium and soft strings settling into a hopeful consonant chord with gentle distant birdsong fading in and a slow reverberant bloom, relieved and tender rather than triumphant, produced and spacious, warm analog tape, slowly fading, no cheer', 3.0],
  ['lose', 'a somber cinematic descending cadence, a low harmonium and muted cello sinking into a heavy unresolved chord with deep sub-bass and cold wind underneath, a slow mournful reverberant decay, quiet and heavy, produced and spacious, warm degraded analog tape, slowly fading, no sting hit', 3.0],
  ['relief', 'a soft cinematic pressure release, tension easing as a dark low drone resolves and a single warm harmonium note rises with a gentle airy swell, a held breath let go, hopeful and understated, warm analog room, no music', 1.5],

  // ——— GM-ljud (spelledarpanelen, mer show) ———
  ['ding',      'a single soft muted desk bell note, warm and neutral, quickly damped with a short analog tail, understated attention cue, warm tape tone, no shimmer, no music', 0.6],
  ['pil_blip',  'short crisp designed game-show accent blip, warm analog synth tone with a subtle bright bloom and a quick tail, confident and polished, clean not harsh, no melody', 0.5],
  ['spanning',  'immersive dramatic suspense soundscape loop for a live game show, pulsing low heartbeat drone building tension, shimmering sustained strings over a slow ticking pulse, breath-held anticipation of who will it be, cinematic and theatrical yet controlled, warm analog, no resolution, no melody', 16],
  ['larm',      'playful theatrical alert klaxon, a rising-falling two-tone show siren with a touch of brass and comic swagger, attention-grabbing mock-emergency fanfare, warm analog, lively and a little absurd, not scary and not dystopian, no real-danger tone', 6],
  ['happening', 'punchy three-second game-show something-is-happening sting, bright rising analog synth swell with a quick sparkle and a confident downbeat, theatrical and polished attention cue, warm, dramatic but friendly, no spoken voice', 3.0],

  // ——— Event-ljud (centralhögtalaren, alla öppnar med samma korta stations-ident) ———
  ['event_storm',         'a two-note institutional station ident chime, then a crackling PA announcement ambience swelling into dramatic howling coastal wind, distant rolling thunder and a deep cinematic sub-rumble, heard through an old analog loudspeaker with tape hiss, melancholic ominous and restrained, no melody, slow fade out', 6],
  ['event_skogsbrand',    'a two-note station ident chime, then a low mournful institutional alarm rising under a dramatic dry roaring forest fire with cracking timber and a far-off warning bell, filtered through a worn public-address speaker with static, tense sombre cinematic but understated, no music, fade out', 6],
  ['event_uppror',        'a two-note station ident chime, then a crackly PA feed opening onto a large distant angry crowd, rhythmic chanting and banging building in intensity, a single flat warning tone cutting over the top, heard muffled across a square through an old loudspeaker, dramatic yet restrained, analog hiss, no music', 6],
  ['event_torka',         'a two-note station ident chime, then a dry hollow desert-like wind over cracked earth, a slow creaking idle windmill and a lonely sustained low drone that swells and dies, through a thin analog PA system, parched and melancholic, cinematic emptiness, very sparse, slow fade', 5],
  ['event_godskord',      'a two-note station ident chime, then a warm understated fanfare of soft brass and a gentle distant bell with quiet birdsong and a light breeze underneath, through an old loudspeaker with analog warmth, hopeful but modest and melancholic, not triumphant, gentle fade out', 5],
  ['event_sponsrat',      'a two-note station ident chime, then a smooth slightly too-polished corporate jingle motif with a shimmer of falling coins over a low uneasy drone, played through an institutional speaker with faint static, seductive and uncanny, dramatic but restrained, hinting at something not quite right, no full resolution', 6],
  ['event_gronafonden',   'a two-note station ident chime, then a gentle rising three-note ceremonial tone with a soft choir-like shimmer and a quiet wind-turbine hum underneath, through an old analog loudspeaker with slight warmth, dignified hopeful calm and cinematic yet restrained, slow graceful fade', 5],
  ['event_marknadskrasch','a two-note station ident chime, then a rapid dramatic telegraph and typewriter clatter accelerating and collapsing into a single flat falling tone, an institutional buzzer and a deep descending sub-drone, through a thin analog loudspeaker with static, cold bureaucratic cinematic dread, melancholic, abrupt soft end', 6],
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
