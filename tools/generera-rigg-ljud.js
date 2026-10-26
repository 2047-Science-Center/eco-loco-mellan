// tools/generera-rigg-ljud.js — centralhögtalarens / förstärkningsriggens ljud via ElevenLabs SFX.
// LJUDIDENTITET: Riktning A "Centralmaktens etersändning" (se design/LJUDIDENTITET.md).
// Allt bär den gemensamma PREFIX:en (sliten myndighetshögtalare: rörmättnad, lätt dist, bandeko).
// prov-event-ident är tonreferensen — PA/dist ska höras genom ALLT.
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

// ——— GEMENSAM PROMPT-PREFIX (stil-limmet — bärs av VARJE ljud, även skärm-SFX i generera-ljud.js) ———
export const PREFIX = 'through Centralmaktens worn PA loudspeaker, driven valve-and-tape saturation and light distortion, tape hiss and wow-flutter, institutional melancholic not arcade, no music no melody no voice';

// [fil, specifik beskrivning, sekunder, loop]  — slutlig prompt = `${desc}, ${PREFIX}`
const SPEC = [
  // ——— Ambienser (loopbara, bär subtilt bakgrundsskrap/brus i PA-/bandvärlden) ———
  // OBS mappning i hjarna-stubb.py AMB_FILE: 1=superdåligt(tungt) … 5=mycketbra(ljust).
  ['soundscape_1', 'a heavy but tender ambience loop, a slow mournful low drone with a soft rounded gentle sub, a grieving warmth, subtle background crackle and room texture, sombre and sorrowful yet safe and comforting, serious never frightening, seamless loop', 30, true],
  ['soundscape_2', 'a wistful grey ambience loop, a soft low drone with a quiet melancholy and slow gentle swells, subtle background crackle and scrape, pensive and a little sad yet calm and safe, seamless loop', 30, true],
  ['soundscape_3', 'a calm reflective ambience loop, a mellow steady drone breathing slowly, subtle background crackle and room texture, composed warm neutral base mood, seamless loop', 30, true],
  ['soundscape_4', 'a warm hopeful ambience loop, a soft breathing drone with gentle uplift and slow swells, subtle background crackle and texture, pleasant and tender, seamless loop', 30, true],
  ['soundscape_5', 'a bright gentle ambience loop, a warm open drone with airy lift and slow shimmer, subtle background crackle and texture, glad and graceful, seamless loop', 30, true],
  ['attract',      'a slow mysterious yet hopeful attract-mode ambience loop, a deep pulsing low drone with faint distant wind and a barely-there heartbeat sub-pulse, subtle background crackle, inviting and melancholic, seamless loop', 20, true],

  // ——— Runda / förslag / nedräkning ———
  ['round_start',   'a calm round-opening cue, the soft two-note authority motif rising a gentle neutral interval with a short produced swell, like a meeting called to order', 1.3, false],
  ['proposal_open', 'a short attention cue, the soft two-note authority motif under a gentle paper-and-gavel motion, calling the room to a vote', 0.9, false],
  ['countdown',     'a nine-second tension builder, a dry clock ticking steadily while a low drone and sub-bass slowly rise, the ticks tightening and accelerating, resolving on one firm decisive low hit', 9.0, false],
  // Spelstart-nedräkning (ecoloco/rigg/ceremoni=countdown) — mer dramatisk, mer tickande klocka än spanning.
  ['countdown_start','a ten-second game-start countdown, a mechanical clock ticking and accelerating over a swelling low drone and rising tension riser, climaxing in one huge decisive impact hit', 10.0, false],

  // ——— Tryck / kris (ENAD allvarlig institutionell linje; aldrig game-show) ———
  ['kris', 'a grave institutional pressure cue, a slow rising two-tone warning signal swelling under a deep ominous sub-bass drone, dignified and dramatic, not alarmist, no siren wail', 3.0, false],
  ['larm', 'a grave institutional alert, a firm rising two-tone warning signal over a dark swelling sub-bass, serious and dignified, attention-commanding but not alarmist, no comedic klaxon', 3.0, false],
  ['paus', 'a calm suspended pause cue, a soft held low drone with a gentle filtered swell, frozen and waiting, understated', 2.5, false],

  // ——— Awards (värdig pondus; +/- färg efter typ) ———
  ['award_foretagare', 'a dignified award swell for business of the year, a warm muted harmonium-and-brass rise with a slow bloom and a reverberant tail, quietly proud and positive but restrained', 1.8, false],
  ['award_eldsjal',    'a warm heartfelt award cue, a gentle rising harmonium phrase with a soft bloom, sincere and clearly positive, understated', 1.6, false],
  ['award_sabotor',    'a dark dramatic reveal sting for the saboteur, a low dissonant harmonium-and-reed swell with ominous sub-bass easing into shadow, clearly negative, dignified tension not comedy', 1.6, false],

  // ——— Slutscener ———
  ['win',  'a warm resolving cadence, harmonium settling into a hopeful consonant chord with a slow bloom, relieved and tender rather than triumphant, slowly fading', 3.0, false],
  ['lose', 'a somber descending cadence, low harmonium and muted cello sinking into a heavy unresolved chord with deep sub-bass, a slow mournful decay, slowly fading', 3.0, false],
  ['relief', 'a soft pressure release, a dark low drone resolving as a single warm harmonium note rises with a gentle swell, a held breath let go, hopeful', 1.5, false],

  // ——— GM / show ———
  ['ding',     'a single soft muted desk bell note, warm and neutral, quickly damped with a short tail', 0.6, false],
  ['pil_blip', 'a short dry designed accent blip, a warm muted tone with a quick tail, confident and composed, clean not harsh', 0.5, false],
  ['spanning', 'a dramatic suspense bed, a pulsing low heartbeat drone building tension with a slow ticking pulse and sustained unease, breath-held anticipation, controlled not theatrical, no resolution', 16, false],
  ['happening','a short something-is-happening cue, a rising riser swell with a soft decisive downbeat and a brief tape flutter, attention-grabbing but composed, not a game-show sting', 3.0, false],

  // ——— Event-signatur (NY, fristående röd tråd) ———
  ['event_ident', 'the two-note Central Authority station ident chime, two gentle descending tones announcing an official broadcast, calm and clean with slight tape warmth', 2.0, false],

  // ——— Event-ljud (alla öppnar med tvåtons-myndighetssignaturen) ———
  ['event_storm',         'the two-note authority ident chime, then dramatic howling coastal wind, distant rolling thunder and a deep sub-rumble, melancholic ominous and restrained, slow fade out', 6, false],
  ['event_skogsbrand',    'the two-note authority ident chime, then a low mournful alarm under a dry roaring forest fire with cracking timber and a far-off warning bell, tense sombre, fade out', 6, false],
  ['event_uppror',        'the two-note authority ident chime, then a large distant angry crowd, rhythmic chanting and banging building, a flat warning tone over the top, muffled across a square, dramatic restrained', 6, false],
  ['event_torka',         'the two-note authority ident chime, then a dry hollow desert wind over cracked earth, a slow creaking idle windmill and a lonely low drone swelling and dying, parched melancholic, slow fade', 5, false],
  ['event_godskord',      'the two-note authority ident chime, then a warm understated fanfare of soft brass and a distant bell with a light breeze, hopeful but modest, gentle fade out', 5, false],
  ['event_sponsrat',      'the two-note authority ident chime, then a smooth slightly too-polished corporate jingle motif with a shimmer of coins over a low uneasy drone, seductive and uncanny, no full resolution', 6, false],
  ['event_gronafonden',   'the two-note authority ident chime, then a gentle rising three-note ceremonial tone with a soft shimmer and a quiet wind-turbine hum, dignified hopeful calm, slow graceful fade', 5, false],
  ['event_marknadskrasch','the two-note authority ident chime, then a rapid telegraph clatter accelerating and collapsing into a flat falling tone, an institutional buzzer and a descending sub-drone, cold bureaucratic dread, abrupt soft end', 6, false],
];

const LJUD = SPEC.map(([namn, desc, dur, loop]) => [namn, `${desc}, ${PREFIX}`, dur, loop]);

// Guard: ElevenLabs tar max 450 tecken/prompt.
console.log(`PREFIX (${PREFIX.length} tecken)`);
let bad = false;
for (const [namn, text] of LJUD) { if (text.length > 450) { console.error(`FÖR LÅNG (${text.length}): ${namn}`); bad = true; } }
if (bad) { console.error('Avbryter — korta ner markerade prompts.'); process.exit(1); }

for (const [namn, text, dur, loop] of LJUD) {
  const fil = join(DIR, `${namn}.mp3`);
  if (existsSync(fil) && !FORCE) { console.log(`↷ ${namn}.mp3 finns — hoppar över`); continue; }
  process.stdout.write(`♪ ${namn}.mp3 … `);
  const body = { text, model_id: 'eleven_text_to_sound_v2', duration_seconds: dur, prompt_influence: 0.5 };
  if (loop) body.loop = true;
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.log(`FEL ${r.status}: ${(await r.text()).slice(0, 200)}`); continue; }
  writeFileSync(fil, Buffer.from(await r.arrayBuffer()));
  console.log('klar');
}
console.log('\nFärdigt → assets/audio/rigg/. Testa: afplay assets/audio/rigg/event_ident.mp3');
