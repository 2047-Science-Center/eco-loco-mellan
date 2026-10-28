// server/server.js — Eco Loco (Mellan): server-auktoritativ multiplayer.
// EN process äger sanningen: spec/engine.js körs HÄR (oförändrad). Klienterna
// (webbläsare på Mac/iPad/NUC) ansluter över WebSocket, skickar actions och
// renderar events. Lag som ingen människa tar styrs av mock-opponents (botar).
// Processen serverar även spelets filer, så klienter behöver bara en URL.
//
//   npm install        (en gång — hämtar ws)
//   npm run server     (eller: node server/server.js)
//   → öppna http://<serverns-ip>:8765/spel.html?online=1 på varje enhet
//
// Offline/LAN-först: inga externa beroenden i drift utöver den vendrade ws-modulen.

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { EcoLoco, AREAS, timerSecFor, EVENTS } from '../spec/engine.js';
import { mockOpponentsAct, mockOpponentsVote } from '../spec/mock-opponents.js';
import { attachMqtt, setPublisher as setBenchPublisher } from '../src/mqtt.js';
import { attachRigg } from '../src/rigg.js';
import { newSession } from './persist.js';
import { buildSlutdel } from '../spec/slutdel.js';
import { execFile, spawn } from 'node:child_process';

const PORT = parseInt(process.env.PORT) || 8765;
// Förstärkningsriggen: publicera semantiska cues (ecoloco/rigg/*) till riggens broker.
// Hjärnan (hjarna-stubb.py → Blocks) översätter till ljus/ljud. Default = lokal broker.
const RIGG_BROKER = process.env.RIGG_BROKER || 'localhost';
const RIGG_PORT   = process.env.RIGG_PORT   || '1883';
let riggWarned = false;
let riggSilent = false;   // "med spelledare": spelet skickar INGA rigg-cues (spelledaren driver riggen manuellt)
// riggSend = lågnivå (alltid). riggPublish = spel-cues (gatade av riggSilent i spelledarläge).
// Systemsignaler som paus använder riggSend direkt → de når riggen även i spelledarläge.
const riggSend = (t, m) => {
  console.log(`[rigg→] ${t} ${m}`);
  execFile('mosquitto_pub', ['-h', RIGG_BROKER, '-p', RIGG_PORT, '-t', t, '-m', String(m)], (err) => {
    if (err && !riggWarned) {
      riggWarned = true;
      console.warn(`[rigg] VARNING: mosquitto_pub misslyckades (${err.code || err.message}). Rigg-cues når inte brokern ${RIGG_BROKER}:${RIGG_PORT} — kolla att mosquitto-clients finns och att RIGG_BROKER stämmer.`);
    }
  });
};
// Ambient kopplat till öns mående (öhälsa-soundscape + grundljus via scen) ska ALLTID nå riggen,
// även "med spelledare" — spelledaren regisserar bara show-momenten (award m.m.), inte ambienten.
// AMBIENT/alltid-på: öhälso-looken, scen-växlingar OCH award-ceremonin. Award-ceremonin dirigeras av
// SERVERN i BÅDA lägen (skärm + rigg i exakt takt) → den MÅSTE nå riggen även i spelledarläge, annars
// tänds award-scenen men pilen + award-ljudet kommer aldrig (buggen i spelledarläge).
const AMBIENT_TOPICS = new Set(['ecoloco/rigg/ohalsa', 'ecoloco/rigg/scen', 'ecoloco/rigg/award']);
const riggPublish = (t, m) => { if (riggSilent && !AMBIENT_TOPICS.has(t)) return; riggSend(t, m); };

// ─── Rigg-cues vid spelledarens händelser (§7: spelet sänder BETYDELSE, riggen tolkar) ───
// Samma semantiska cues som spelledarpultens RIGG-knappar, men avfyrade från servern så en
// händelse kan trigga ljus+ljud innan den visas på skärmarna. Ungated (riggSend) = som pultens
// egna knappar, spelar även "med spelledare". Lägg till fler namn här vid behov.
const RIGG_EVENT_DELAY_MS = 3000;   // rigg-cue körs → 3 s senare dyker händelsen upp på skärmarna
const R_ = 'ecoloco/rigg/';
function fireRiggCue(cue) {
  switch (cue) {
    case 'kris':          riggSend(R_ + 'gm/ljud', 'larm'); riggSend(R_ + 'kris', '1'); break;
    case 'fanfar':        riggSend(R_ + 'gm/ljud', 'win'); riggSend(R_ + 'gm/alla_grona', '1'); break;
    case 'nedrakning':    riggSend(R_ + 'countdown', '1'); setTimeout(() => riggSend(R_ + 'countdown', '0'), 10000); break;
    case 'startceremoni': riggSend(R_ + 'ceremoni', 'countdown'); setTimeout(() => riggSend(R_ + 'ceremoni', 'climax'), 3000); break;
    case 'happening':
    default:              riggSend(R_ + 'ljud', 'happening'); riggSend(R_ + 'wave', '1'); setTimeout(() => riggSend(R_ + 'wave', '0'), 3000); break;
  }
}
// Vilken rigg-cue varje händelse (event-id) får när spelledaren kör den. Default = 'happening'.
// Tilldela specialcues här efter hand (t.ex. uppror = "folket har fått nog" → kris/larm).
const EVENT_RIGG_CUE = {
  uppror: 'kris',
};
// Bänkarnas kontrollbord: src/mqtt.js (attachMqtt) bygger topics/innehåll per bänk
// (ecoloco/<benchId>/money|resources|winner|looser). Här kopplar vi den mot SAMMA broker,
// RETAINED (-r) så en bänk som startar om / ansluter sent direkt får senaste värdet.
const benchSend = (t, m) => {
  execFile('mosquitto_pub', ['-h', RIGG_BROKER, '-p', RIGG_PORT, '-r', '-t', t, '-m', String(m)], () => {});
};
setBenchPublisher(benchSend);
const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'spec', 'assets.json')));
const basename = s => String(s).split('/').pop();   // 'assets/audio/rigg/x.mp3' → 'x.mp3' (rigg-ljud-id)

// ——— Statiska filer (så iPad/NUC bara behöver en URL) ———
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.css': 'text/css',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };
const httpServer = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/spel.html';
  const file = join(ROOT, normalize(p).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(file));
});

// ——— Spelvärd ———
const TEAMS = ['aker', 'skog', 'tundra', 'stad'];
const NAMN = Object.fromEntries(AREAS.map(a => [a.id, a.namn]));
const FARG = Object.fromEntries(AREAS.map(a => [a.id, a.farg]));   // lag-id → lagfärg (för podie-marker)
let engine = null, rigg = null;
let started = false;
// Persistens + slutdel (fas 4-grund + spelledarstegad slutdel). Allt fire-and-forget / fas-gardat.
let session = null;            // persist-session (newEngine → ny session, ny JSONL + summary)
let version = 'A';             // slutdel-version (default 'A' = PODIUM + Newfoundland)
let slutdel = null;            // { steps, i, answers:{questionId:{lag:option}} } — null utanför slutdelen
let lastGameEnd = null;        // motorns senaste gameEnd-payload (för summary efter slutdelen)
let finaleSent = false;        // KRÖNING: final-cuen (win/lose) skickas EN gång, efter prisutdelningen
// GM-flaggan bor i SERVERN (drift), inte i motorn (regler): den styr DRIFT-flödet — om händelser
// triggas via spelledarens ja/nej (GM PÅ) eller slumpas automatiskt med chansPerRunda (GM AV),
// och om award-ceremonin stegas för hand eller av 10 s-klockan. Motorn får bara veta av/på via setGm().
let gmMode = false;
const claims = { aker: null, skog: null, tundra: null, stad: null };  // teamId → ws | 'bot' | null
let klar = new Set();          // mänskliga lag som tryckt AVSLUTA
let timerLeft = 0, timerInt = null;
let paused = false;       // paus → frys BARA spelmotorn (timer + bokslut). Riggen/ambiencen rörs ej.
let tutBeats = {};             // tutorial-barriären: beat → Set av lag som är klara
let awardsVantar = new Set();  // mänskliga lag som inte klickat klart prisutdelningen än
let awardsFailsafe = null;     // timeout som startar timern även om någon klient tappas
let lastAwards = null;         // senaste rundans prisvinnare (motorns 'award'-event)
let cer = null;                // prisutdelning som SERVERN dirigerar (båda lägen): { steps:[{typ,w}], i }
let cerTimer = null;           // selfplay: auto-stegarens timer (server-dirigerad lockstep skärm+rigg)
const CEREMONY_STEP_MS = 8000; // selfplay: tid per pris (skärm + rigg kliver i exakt denna takt)
let resolvingNow = false;
let eventFiring = false;        // en spelledar-händelse körs (rigg-cue + 3 s fördröjning innan den visas)
const PROPOSAL_COOLDOWN_MS = 2500;   // kort paus efter att ett förslag avgjorts innan nästa får läggas (hinner visa resultatet)
const BOT_POWER_WAIT_S = 60;         // en bot med makten väntar så här många sek IN I rundan innan den lägger sitt förslag (människor hinner ringa & påverka)
let proposalCooldownUntil = 0;
// Inaktiva skärmar → bot: idleMs räknar AKTIV speltid (medan rundtimern tickar) sedan laget senast
// gjorde något. Prisutdelning/paus räknas INTE (vakten står still då), och klockan persistar över
// rundor → en övergiven skärm blir bot "till nästa runda", men en som bara funderar en stund gör det
// inte (tröskeln är längre än en hel runda). Varje handling nollställer den. Kan återtas med ett tryck.
const IDLE_TAKEOVER_MS = 180000;   // ~1,5 runda (120 s) aktiv inaktivitet → bot
const IDLE_TICK_MS = 5000;
const idleMs = {};              // teamId → ackumulerad aktiv speltid utan handling
function touchLag(id) { if (id) idleMs[id] = 0; }
// KOPPLING 2 — intro-trailer: trailerPlaying = kör just nu (gardar både command- och auto-vägen
// mot dubbelstart). trailerPlayedAuto = auto-vägen har fyrat denna lobby-cykel (nollas vid startGame).
let trailerPlaying = false, trailerPlayedAuto = false, trailerTimers = [];
let offerSeq = 0;
const offers = new Map();      // offerId → { from, to, give, giveCur, get, getCur }

// ─────────────────────────────────────────────────────────────────────────────
// RUMS-FLÖDE — server-ägd fas + 15 s start-fönster (additivt ovanpå det befintliga
// klient-drivna flödet attract→lobby→STARTA→trailer→tutorial→runda 1).
//   phase = var GRUPPEN är → skickas i VARJE send() (top-level) + i hello-ack, så en
//   sent ansluten klient kan hoppa in på rätt ställe (se src/ui.js joinPhase).
//   startWindow = självspelets 15 s join-fönster FÖRE det befintliga trailer-steget.
//   En start FRÅN SPELLEDARPULTEN (startGame direkt) hoppar över fönstret.
// ─────────────────────────────────────────────────────────────────────────────
let phase = 'lobby';                 // 'lobby' | 'intro' | 'tutorial' | 'spel' | 'slutdel'
const START_WINDOW_SEC = 15;
let startWindowInt = null, startWindowLeft = null;

// ——— Gate 3 + 4: server-ägd tutorial-barriär + GEMENSAM nedräkning före runda 1 ———
// Problemet förr: varje skärm körde tutorialen i egen takt och FÖRSTA bänk som klickade klart
// startade runda 1 åt alla (ingen gemensam grind → osynk, någon fick countdown, någon inte).
// Nu: varje skärm säger 'tutReady' när den är klar. Servern väntar in ALLA levande människor
// (eller spelledarens TVINGA START, eller en lång failsafe mot en död bänk), kör EN nedräkning
// åt alla, och startar sedan runda 1 EN gång. Ingen skärm startar spelet själv längre.
let tutReady = new Set();            // lag som rapporterat "tutorial klar / redo" (Gate 3)
let tutReadyFailsafe = null;         // lång failsafe: en död/seg bänk ska aldrig låsa rummet
const TUT_READY_FAILSAFE_MS = 60000; // 60 s från första "redo" → tvinga gemensam countdown
let startCountdownInt = null, startCountdownLeft = null;   // Gate 4: gemensam 10→0 (synkad på alla skärmar)
const START_COUNTDOWN_SEC = 10;

const humanIds = () => TEAMS.filter(id => claims[id] && claims[id] !== 'bot');
const liveHumanIds = () => humanIds().filter(id => claims[id].readyState === 1);

// State bär även serverns driftflaggor (gmMode/riggSilent) så spelledarpanelen kan spegla dem auktoritativt.
// claims (lag → 'human'|'bot'|null) rider med i VARJE meddelande så spelledarpanelens stations-lista
// alltid är färsk (ett lag som tappar sin skärm blir 'bot' → syns direkt på pulten).
function claimKinds() { return Object.fromEntries(TEAMS.map(id => [id, claims[id] === 'bot' ? 'bot' : claims[id] ? 'human' : null])); }
// Händelsekatalogen (id + rubrik + typ) — statisk, följer med i state så spelledarpanelen kan erbjuda VÄLJ HÄNDELSE.
const EVENT_KATALOG = EVENTS.map(e => ({ id: e.id, rubrik: e.rubrik, typ: e.typ }));
function send(ws, obj) { if (ws && ws !== 'bot' && ws.readyState === 1) ws.send(JSON.stringify({ ...obj, phase, claims: claimKinds(), state: engine ? { ...engine.getState(), gmMode, riggSilent, started, eventKatalog: EVENT_KATALOG } : null })); }
function broadcast(obj) { for (const ws of wss.clients) send(ws, obj); }
function lobbyMsg() {
  return { type: 'lobby', started, spelledare: riggSilent,   // spelledare på → klienterna gömmer STARTA (spelledaren styr starten)
    claims: claimKinds() };
}

// ─────────────────────────────────────────────────────────────────────────────
// KOPPLING 2 — intro-trailer. Servern äger ljuset: skärmarna spelar bara videon,
// ljus-cuesen fyras EN gång härifrån (ej 4× från fyra skärmar). TRAILER_CUES
// speglar EXAKT trailer.html:s CUES (samma tider + out/*-payloads; led/* = samma
// payload till /1../4; lagfärgerna = trailer.html:s TEAM-HSV). riggSend String():ar
// payloaden, så objekt JSON.stringify:as här (strängar '1'/'0' skickas som de är).
// ─────────────────────────────────────────────────────────────────────────────
const TR = 'ecoloco/rigg/out/';
// Lagfärger (HSV) ur motorns AREAS: 1 åker gul · 2 skog grön · 3 tundra orange · 4 stad grå
const TR_TEAM = { 1: { h: 46, s: 67, v: 91 }, 2: { h: 128, s: 56, v: 56 }, 3: { h: 30, s: 72, v: 85 }, 4: { h: 215, s: 8, v: 59 } };
const trLed  = v  => [1, 2, 3, 4].map(n => ({ topic: TR + 'led/' + n, payload: v }));
const trTeam = () => [1, 2, 3, 4].map(n => ({ topic: TR + 'led/' + n, payload: TR_TEAM[n] }));
const trFx   = v  => [{ topic: TR + 'fx', payload: v }];
const trBl   = v  => [{ topic: TR + 'blandare', payload: v }];
const TRAILER_CUES = [
  { t: 0.0,  label: 'Kall blå bas',             cmds: trLed({ h: 210, s: 70, v: 18, puls: 20 }) },
  { t: 12.0, label: 'Chase-svep in',            cmds: [...trLed({ h: 210, s: 60, v: 28 }), ...trFx({ fx: 'chase', speed: 32 })] },
  { t: 16.0, label: 'FYRA LAGEN i lagfärg',     cmds: [...trFx({ fx: 'none' }), ...trTeam()] },
  { t: 20.2, label: 'Guld-puls',                cmds: trLed({ h: 46, s: 90, v: 60, puls: 45 }) },
  { t: 24.0, label: 'KRIS — rött + blandare',   cmds: [...trLed({ h: 0, s: 100, v: 100, blink: 80 }), ...trBl('1')] },
  { t: 27.0, label: 'Vitt climax',              cmds: [...trBl('0'), ...trLed({ h: 0, s: 0, v: 100 })] },
  { t: 29.5, label: 'Släck',                    cmds: [...trFx({ fx: 'none' }), ...trLed({ h: 0, s: 0, v: 0 })] },
];
const TRAILER_DUR = 30;   // skärmens failsafe-längd (payload.dur) — flödet fastnar aldrig

function fireTrailerCue(cmds) {
  for (const c of cmds) {
    const payload = (c.payload && typeof c.payload === 'object') ? JSON.stringify(c.payload) : c.payload;
    riggSend(c.topic, payload);   // lågnivå, ungated — trailern är en systemceremoni (som paus)
  }
}
function clearTrailerTimers() { for (const t of trailerTimers) clearTimeout(t); trailerTimers = []; }
function stopTrailer() {
  clearTrailerTimers();
  trailerPlaying = false;
  riggSend('ecoloco/rigg/trailer', '0');   // stoppa ev. centralt trailer-ljud (hjärnan)
}
// playTrailer: broadcasta 'trailer' till skärmarna, schemalägg varje ljus-cue vid sin tid,
// och efter sista cuen broadcasta 'trailerDone'. Fas-gardat (en flagga) + rör aldrig motorn.
function playTrailer() {
  if (trailerPlaying) return;              // kör aldrig två trailrar samtidigt
  trailerPlaying = true;
  phase = 'intro';                         // trailern/introt rullar → late-join hoppar in i introt
  trailerPlayedAuto = true;                // auto-vägen fyrar bara en gång per lobby-cykel
  const src = manifest.onboarding?.trailer || '';
  console.log(`[trailer] start — ${TRAILER_CUES.length} ljus-cues från servern (EN källa)`);
  broadcast({ type: 'event', event: 'trailer', payload: { src, dur: TRAILER_DUR } });
  // Skärmarna spelar videon TYST — trailer-ljudet går CENTRALT via hjärnan (navet → centralhögtalaren).
  clearTrailerTimers();                    // rensa ev. gamla timers UTAN att röra ljud-topicen (undvik 0→1-race)
  trailerPlaying = true;
  riggSend('ecoloco/rigg/trailer', '1');   // starta centralt trailer-ljud (ren 0→1 — topicen nollas vid trailerns slut)
  trailerTimers = TRAILER_CUES.map(cue => setTimeout(() => {
    fireTrailerCue(cue.cmds);
    console.log(`[trailer] cue ${cue.t.toFixed(1)}s · ${cue.label}`);
  }, Math.round(cue.t * 1000)));
  const endMs = Math.round((TRAILER_CUES[TRAILER_CUES.length - 1].t + 1) * 1000);
  trailerTimers.push(setTimeout(() => {
    trailerPlaying = false;
    riggSend('ecoloco/rigg/trailer', '0');   // trailern slut → nollställ ljud-topicen, annars står den kvar som "körd" och nästa trailer triggar inte om
    broadcast({ type: 'event', event: 'trailerDone' });
    console.log('[trailer] klar');
  }, endMs));
}
// AUTO: alla fyra lag MÄNNISKO-claimade i lobbyn, spelet ej startat, trailern ej körd → en gång.
// Konservativ: kräver fyra LEVANDE människo-anslutningar. Command-vägen ({cmd:'trailer'}) är huvudväg.
function maybeAutoTrailer() {
  if (started || trailerPlaying || trailerPlayedAuto) return;
  const allaManniskor = TEAMS.every(id => claims[id] && claims[id] !== 'bot' && claims[id].readyState === 1);
  if (allaManniskor) playTrailer();
}

// ——— 15 s start-fönster (självspel) ———
// Första STARTA-trycket från en SPELARE öppnar ett join-fönster: fasen står kvar i 'lobby',
// servern broadcastar en synlig nedräkning, och fler kan claima sina lag. Vid 0 → 'startGo' →
// klienterna kör det BEFINTLIGA flödet (trailer → tutorial → runda 1). Avbryts vid omstart.
function openStartWindow(byLag) {
  if (startWindowInt) return;                                   // redan öppet — ignorera dubbeltryck
  if (started && engine && !engine.getState().over) return;     // pågår redan
  startWindowLeft = START_WINDOW_SEC;
  console.log(`[spel] 15 s start-fönster öppnat av ${byLag || 'bänk utan lag'}`);
  broadcast({ type: 'startWindow', left: startWindowLeft, total: START_WINDOW_SEC });
  startWindowInt = setInterval(() => {
    startWindowLeft--;
    if (startWindowLeft > 0) {
      broadcast({ type: 'startWindow', left: startWindowLeft, total: START_WINDOW_SEC });
    } else {
      clearInterval(startWindowInt); startWindowInt = null; startWindowLeft = null;
      console.log('[spel] start-fönster klart → startGo (kör det riktiga flödet)');
      broadcast({ type: 'startGo' });
    }
  }, 1000);
}
function cancelStartWindow(silent) {
  if (startWindowInt) { clearInterval(startWindowInt); startWindowInt = null; }
  startWindowLeft = null;
  if (!silent) broadcast({ type: 'startWindowCancel' });
}

// ——— Gate 3: tutorial-barriär — när släpps den gemensamma nedräkningen? ———
// En skärm säger 'tutReady' när dess tutorial är klar. När alla LEVANDE människor är redo (eller
// spelledaren tvingar, eller failsafen löser ut) → kör den gemensamma nedräkningen.
function maybeStartCountdown() {
  if (started || startCountdownInt) return;
  const humans = liveHumanIds();
  if (humans.length === 0) return;
  if (humans.every(id => tutReady.has(id))) startSharedCountdown();
}
// ——— Gate 4: EN nedräkning åt alla, sedan starta runda 1 EN gång ———
function startSharedCountdown() {
  if (started || startCountdownInt) return;
  clearTimeout(tutReadyFailsafe); tutReadyFailsafe = null;
  startCountdownLeft = START_COUNTDOWN_SEC;
  console.log('[spel] GEMENSAM nedräkning → runda 1 (server-ägd grind)');
  riggSend('ecoloco/rigg/ceremoni', 'countdown');   // SYSTEMCEREMONI (ungated, som trailer/paus): riser + LED-chase spelar i BÅDA lägena
  broadcast({ type: 'startCountdown', left: startCountdownLeft, total: START_COUNTDOWN_SEC });
  startCountdownInt = setInterval(() => {
    startCountdownLeft--;
    if (startCountdownLeft > 0) {
      broadcast({ type: 'startCountdown', left: startCountdownLeft, total: START_COUNTDOWN_SEC });
    } else {
      clearInterval(startCountdownInt); startCountdownInt = null; startCountdownLeft = null;
      riggSend('ecoloco/rigg/ceremoni', 'climax');  // SYSTEMCEREMONI (ungated): vitt climax → rundans look (hjärnan)
      beginGame();
    }
  }, 1000);
}
function cancelStartCountdown(silent) {
  if (startCountdownInt) { clearInterval(startCountdownInt); startCountdownInt = null; }
  startCountdownLeft = null;
  if (!silent) broadcast({ type: 'startCountdownCancel' });
}

// Starta själva partiet (EN gång). Rums-flödet når hit via den gemensamma nedräkningen; replay/direkt-
// start (playAgain, lokalt) når hit via 'startGame'-meddelandet. riggSilent/gmMode rörs INTE här —
// de ägs av spelledarpanelens läges-toggle (annars nollades "MED spelledare" vid varje start).
function beginGame() {
  if (started && engine && !engine.getState().over) return;
  cancelStartWindow(true);
  cancelStartCountdown(true);
  clearTimeout(tutReadyFailsafe); tutReadyFailsafe = null;
  stopTrailer(); trailerPlayedAuto = false;
  for (const id of TEAMS) if (!claims[id] || claims[id] === 'bot' || claims[id].readyState !== 1) claims[id] = claims[id] && claims[id] !== 'bot' && claims[id].readyState === 1 ? claims[id] : 'bot';
  started = true;
  phase = 'spel';                              // motorn körs → late-join tar över en bot via claim
  tutBeats = {}; tutReady = new Set();
  newEngine();
  broadcast(lobbyMsg());
  engine.start();
}

// ——— Spelledarens OMSTART → alla till lobbyn (när som helst) ———
// Stoppar allt (fönster/trailer/timer), nollställer started + motorn, sätter phase='lobby' och
// broadcastar 'tilllobby' så varje klient river ner det den håller på med (overlays, solo-tutorial,
// trailer) och visar lobbyn. Motorn = null → samma tillstånd som vid serverstart innan första partiet.
function resetToLobby() {
  cancelStartWindow(true);
  cancelStartCountdown(true);
  tutReady = new Set();
  clearTimeout(tutReadyFailsafe); tutReadyFailsafe = null;
  stopTrailer();
  broadcast({ type: 'event', event: 'trailerDone' });   // stäng ev. trailer-overlay på skärmarna
  stopTimer();
  clearTimeout(cerTimer);
  slutdel = null; cer = null; lastAwards = null; resolvingNow = false; eventFiring = false;
  started = false; paused = false;
  klar = new Set(); tutBeats = {}; awardsVantar = new Set(); trailerPlayedAuto = false;
  for (const id of TEAMS) if (claims[id] === 'bot') claims[id] = null;   // släpp botarna, behåll människornas platser
  engine = null; rigg = null; session = null;
  phase = 'lobby';
  riggSend('ecoloco/rigg/scen', 'attract');   // tillbaka till viloläge → attract-MUSIK på centralhögtalaren igen (ungated)
  console.log('[spel] OMSTART → lobbyn (allt nollställt)');
  broadcast({ type: 'event', event: 'tilllobby' });
  broadcast(lobbyMsg());
}

function newEngine() {
  engine = new EcoLoco(manifest.config || {});
  engine.setGm(gmMode);   // spegla serverns GM-läge in i den nya motorn
  lastAwards = null; cer = null; slutdel = null; lastGameEnd = null; finaleSent = false;
  // Persistens: ny session (sessionId = tidsstämpel) med metadata-startrad. Fire-and-forget, data/ gitignorerad.
  session = newSession(ROOT, { config: engine.cfg, gmMode, version, claims });
  attachMqtt(engine);  // MQTT-sömmen: console-mock tills broker kopplas (byt publish i src/mqtt.js)
  rigg = attachRigg(engine, { publish: riggPublish, gm: gmMode, isPaused: () => paused });  // förstärkningsriggen: semantiska cues (paus fryser award-takten)
  const relay = ev => payload => broadcast({ type: 'event', event: ev, payload });
  for (const ev of ['start', 'build', 'trade', 'proposalOpened', 'proposalResolved', 'income', 'ohalsa', 'event', 'crisis', 'roundReplay', 'roundEnd', 'gameEnd'])
    engine.on(ev, relay(ev));
  // KRIS → riggen via EN semantisk cue. Dirigenten (hjarna-stubb.py) översätter: blandare + röd puls + 15s-timer.
  // Gatas automatiskt av riggPublish i spelledarläge (ecoloco/rigg/kris är ej en AMBIENT_TOPIC) → spelledaren
  // äger då blandaren manuellt. 15s-timern och LED-looken ligger i DIRIGENTEN, inte här.
  engine.on('crisis', p => riggPublish('ecoloco/rigg/kris', p.on ? '1' : '0'));
  // Persistens-tap: SAMMA eventström som relä-broadcastas → en JSONL-rad per motorhändelse (payloads oförändrade).
  for (const ev of ['start', 'build', 'trade', 'proposalOpened', 'proposalResolved', 'income', 'ohalsa', 'event', 'crisis', 'roundReplay', 'roundEnd', 'award', 'gameEnd'])
    engine.on(ev, p => session?.logEvent(ev, p));
  // Härledda tal för summaryn: öhälsa per runda, händelser som slog, och summary vid gameEnd.
  engine.on('roundEnd', p => session?.noteOhRound(p.round, engine.getState().oh));
  engine.on('event', p => session?.noteEvent(engine.getState().round, p));
  engine.on('gameEnd', p => { lastGameEnd = p; session?.writeSummary(engine.getState(), p); });
  // Award-ceremonin dirigeras av SERVERN i BÅDA lägen (awardCeremony → awardStep×N → awardDone) så
  // skärm + rigg kliver i EXAKT takt — fixar mqtt-lagget där LED-listen låg före skärmen. Ingen klient
  // och ingen rigg self-pacar längre. GM: spelledaren stegar via award_next. Selfplay: server-timer
  // (startAutoCeremony). 'award' broadcastas INTE rått längre; ceremonin bär vinnarna.
  engine.on('award', p => { lastAwards = p; });
  engine.on('roundEnd', () => {
    if (!lastAwards) return;
    const steps = buildCeremonySteps(lastAwards);
    if (!steps.length) { cer = null; return; }   // ingen förändring → HOPPA prisutdelningen helt (ingen scen, inga cues)
    cer = { steps, i: -1 };
    if (gmMode) {
      rigg.beginAwards();                                               // riggen går till award-scenen, väntar
      broadcast({ type: 'event', event: 'awardCeremony', payload: { total: cer.steps.length } });
    } else {
      startAutoCeremony();   // selfplay: stegaren öppnar scenen + broadcastar awardCeremony på sitt FÖRSTA tick
    }                        // (deferrad → en synkron roundReplay hinner nolla cer innan något syns)
  });
  engine.on('roundStart', p => {
    resolvingNow = false; klar = new Set();
    broadcast({ type: 'event', event: 'roundStart', payload: p });
    // GM-läge: motorn har dragit rundans förslag men inte applicerat det — visa det för spelledarpanelen.
    if (gmMode) {
      const pe = engine.getState().pendingEvent;
      if (pe) riggPublish('ecoloco/rigg/eventforslag', JSON.stringify({ id: pe.id, namn: pe.rubrik, text: pe.text }));
    }
    if (p.round > 1) pauseForAwards(); else startTimer();   // runda 2+: timern väntar tills prisutdelningen klickats igenom
    // (maybeBotProposal triggas numera av rundtimern, BOT_POWER_WAIT_S in i rundan — inte här)
  });
  // OMSPEL (kris olöst): rundan raderas och spelas om. Ingen prisceremoni (rundan är ogjord) → starta
  // rundtimern direkt, i stället för pauseForAwards. 'roundReplay' broadcastas redan via relay-loopen ovan.
  // OBS GM-läge: en award-ceremoni för den FELADE rundan kan ha hunnit broadcastas; cer nollas här, men
  // samspelet skärm↔rigg vid omspel i GM-läge bör verifieras i rummet.
  engine.on('roundReplay', p => {
    resolvingNow = false; klar = new Set(); cer = null; clearTimeout(cerTimer);   // avbryt ev. påbörjad auto-ceremoni (rundan är ogjord)
    startTimer();   // maybeBotProposal triggas av timern (BOT_POWER_WAIT_S in i rundan)
  });
  engine.on('gameEnd', () => stopTimer());
  // VINST/FÖRLUST-FINALEN (ecoloco/rigg/final) skickas inte längre direkt här, utan som KRÖNING EFTER
  // prisutdelningen (fireFinale i advanceCeremony) — vinnarsidan tänds en sista gång, 2 s, sedan final.
  engine.on('proposalOpened', () => { checkBotVotes(); });
  engine.on('proposalResolved', () => { proposalCooldownUntil = Date.now() + PROPOSAL_COOLDOWN_MS; });   // kö-paus innan nästa förslag
}

function roundFull() { return timerSecFor(engine.cfg, engine.getState().round); }

function startTimer() {
  stopTimer();
  const full = roundFull();
  timerLeft = full;
  let countdownFired = false;                 // 10 s-nedräkningen fyras en gång per runda
  let botFired = false;                        // maktbotens förslag läggs en gång, BOT_POWER_WAIT_S in i rundan
  broadcast({ type: 'timer', left: timerLeft, full });
  timerInt = setInterval(() => {
    if (paused) return;   // pausad → frys nedräkningen. Inget rigg-cue skickas, så ambiencen loopar vidare.
    timerLeft--;
    broadcast({ type: 'timer', left: timerLeft, full });
    // ~1 min in i rundan → en bot med makten lägger sitt förslag (människor har hunnit ringa & påverka).
    if (!botFired && timerLeft <= full - BOT_POWER_WAIT_S) { botFired = true; maybeBotProposal(); }
    // 10 s kvar → NEDRÄKNING i riggen (ljus + ljud), samma cue som spelledarens NEDRÄKNING-knapp.
    // SYSTEMCEREMONI (ungated via riggSend) så den spelar i BÅDA lägena — även "med spelledare".
    if (timerLeft <= 10 && timerLeft > 0 && !countdownFired) { countdownFired = true; riggSend('ecoloco/rigg/countdown', 1); }
    if (timerLeft <= 0) { riggSend('ecoloco/rigg/countdown', 0); stopTimer(); forceResolve(); }
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInt); timerInt = null;
  clearTimeout(awardsFailsafe); awardsFailsafe = null; awardsVantar = new Set();
}

// Paus: fryser BARA spelmotorn (nedräkning + bokslut). Soundscape/ambience loopar vidare.
// Utlöses av skärmknapp (WS), GM-kommando eller fysisk knapp/Blocks (ecoloco/spel/pause).
// Skickar ecoloco/rigg/paus (1/0) som SYSTEMSIGNAL (riggSend, ej gatad) → riggen visar paus-
// wave även i spelledarläge, tills paus släpps. Gäller i både auto- och spelledarläge.
function setPaused(on) {
  on = !!on;
  if (on === paused || !started) return;
  paused = on;
  broadcast({ type: 'paused', paused, left: timerLeft });
  riggSend('ecoloco/rigg/paus', paused ? 1 : 0);
  console.log(`[spel] paus = ${paused}`);
}

// Prisutdelning: visa full rundtid men låt den stå stilla tills alla levande människor
// klickat igenom award-korten (eller failsafen slår till — tappad klient ska inte frysa spelet).
// Prisutdelningens pris-ordning = samma som skärmen visar: 🏆 ledande → 🌱 eldsjäl → 💀 sabotör.
// led/eld hoppas över om de saknas; sab-kortet visas alltid (null = "Ön andas ut").
function buildCeremonySteps(aw) {
  const steps = [];
  if (aw.led) steps.push({ typ: 'led', w: aw.led });
  if (aw.eld) steps.push({ typ: 'eld', w: aw.eld });
  // Sabotör-platsen visas ALLTID när ceremonin ändå körs: en riktig bov, annars "ingen bov — ön andas ut"
  // (skärmens renderAwardCard visar meddelandet när w saknas; riggen tänder inget för ett tomt pris).
  if (aw.sab) steps.push({ typ: 'sab', w: aw.sab });
  else if (steps.length) steps.push({ typ: 'sab', w: null });
  return steps;
}

function pauseForAwards() {
  stopTimer();
  const full = roundFull();
  timerLeft = full;
  if (!cer || !cer.steps.length) {                 // ingen prisutdelning denna runda → kör vidare direkt
    broadcast({ type: 'timer', left: timerLeft, full });
    return startTimer();
  }
  broadcast({ type: 'timer', left: timerLeft, full, paused: true });
  // Rundtimern står stilla tills ceremonin når awardDone. GM: spelledarens award_next startar den.
  // Selfplay: serverns auto-stegare (startAutoCeremony → advanceCeremony) startar den. Ingen klient-gating.
}

// Stega prisutdelningen ETT pris (skärm-broadcast + rigg i exakt takt). Returnerar true när ceremonin
// är slut. Delas av GM (award_next, ett klick per pris) och selfplay (auto-stegaren nedan).
function advanceCeremony() {
  if (!cer) return true;
  cer.i++;
  if (cer.i < cer.steps.length) {
    const s = cer.steps[cer.i];
    rigg?.showAward(s.typ, s.w);                                        // riggen tänder priset
    broadcast({ type: 'event', event: 'awardStep', payload: { typ: s.typ, w: s.w, i: cer.i, total: cer.steps.length } });
    return false;
  }
  const over = engine.getState().over;
  rigg?.endAwards(over);
  broadcast({ type: 'event', event: 'awardDone', payload: { over } });
  cer = null;
  if (!over) startTimer();                                             // rundan återupptas
  else fireFinale();                                                   // KRÖNING: efter prisutdelningen → tänd vinnaren + final
  return true;
}

// KRÖNING (efter sista prisutdelningen). Återanvänder award-cuen (RIGG-KONTRAKT §Award-mapping):
// VINST → tänd vinnarsidan en sista gång i lagets färg (övriga släckta), vänta 2 s så skärmens
// kröningsbild hinner synas, SEDAN final 'win' (riggen exploderar i grönt). FÖRLUST → final 'lose'
// direkt (ingen enskild sida highlightas — alla lika i nederlaget). Final är SYSTEMCEREMONI (ungated).
function fireFinale() {
  if (finaleSent || !lastGameEnd) return;
  finaleSent = true;
  const ge = lastGameEnd;
  if (ge.won && ge.winner) {
    rigg?.showAward('led', { teamId: ge.winner.teamId });              // vinnarsidan grön, övriga släckta
    setTimeout(() => riggSend('ecoloco/rigg/final', 'win'), 2000);
  } else {
    riggSend('ecoloco/rigg/final', 'lose');
  }
}

// SELFPLAY: servern stegar ceremonin på en fast klocka så skärm + rigg kliver i takt. Första ticket
// öppnar scenen (beginAwards + awardCeremony); följande tick stegar ett pris var CEREMONY_STEP_MS.
// Paus fryser takten. Avbryts av clearTimeout(cerTimer) + cer=null (omstart/omspel).
function startAutoCeremony() {
  clearTimeout(cerTimer);
  const total = cer ? cer.steps.length : 0;
  cerTimer = setTimeout(function open() {
    if (!cer) return;
    rigg?.beginAwards();
    broadcast({ type: 'event', event: 'awardCeremony', payload: { total } });
    cerTimer = setTimeout(step, 700);                                  // kort pre-award-paus (matchar scen-bytet)
  }, 300);
  function step() {
    if (!cer) return;
    if (paused) { cerTimer = setTimeout(step, 400); return; }          // paus → vänta in fortsätt
    if (!advanceCeremony()) cerTimer = setTimeout(step, CEREMONY_STEP_MS);
  }
}
function awardsKlar(lag) {
  if (!awardsVantar.has(lag)) return;
  awardsVantar.delete(lag);
  if (awardsVantar.size === 0 && !timerInt && started && !engine.getState().over) startTimer();
}

// Röstlogik: botar röstar när alla (levande) människor röstat; döda/mänskliga eftersläntrare tvingas vid timeout.
function checkBotVotes() {
  if (!started || !engine) return;   // efter omstart-till-lobby finns ingen motor
  const p = engine.getState().proposal;
  if (!p || p.resolved) return;
  const waiting = liveHumanIds().filter(id => p.votes[id] === undefined);
  if (waiting.length === 0) mockOpponentsVote(engine, humanIds());
}
function forceOpenVotes() {
  const p = engine.getState().proposal;
  if (!p || p.resolved) return;
  humanIds().forEach(id => { if (p.votes[id] === undefined) engine.vote(id, false); });
  mockOpponentsVote(engine, humanIds());
}

function forceResolve() {
  if (paused || resolvingNow || !started || engine.getState().over) return;
  resolvingNow = true;
  forceOpenVotes();
  broadcast({ type: 'resolveStart' });
  mockOpponentsAct(engine, humanIds());
  engine.endRound();
}
function maybeResolve() {
  if (paused || resolvingNow || !started || !engine) return;
  const p = engine.getState().proposal;
  if (p && !p.resolved) return;                            // röstning pågår
  if (liveHumanIds().every(id => klar.has(id))) { stopTimer(); forceResolve(); }
}

// Lägg maktbotens (eller en fri-runda-bots) förslag NU. Triggas av rundtimern BOT_POWER_WAIT_S in i
// rundan (se startTimer) — inte vid rundstart — så en bot med makten väntar ~1 min och människorna
// hinner ringa och påverka innan boten bestämmer.
function maybeBotProposal() {
  const S = engine.getState();
  if (!S || S.round < 2) return;                                // runda 1 = inga bot-förslag
  if (S.over || (S.proposal && !S.proposal.resolved) || resolvingNow || Date.now() < proposalCooldownUntil) return;   // bara ett oavgjort i taget + kö-paus
  // MAKT-ROTATION: har rundan ett maktlag är det BARA det laget som får lägga förslag.
  const power = S.powerTeam;
  let by;
  if (power) {
    if (claims[power] !== 'bot') return;                        // maktlaget är en människa → de bestämmer själva
    if ((S.proposedBy || []).includes(power)) return;           // maktlaget (bot) har redan lagt sitt
    by = power;                                                 // en bot med makten lägger ett förslag (så rundan har en politisk fråga)
  } else {
    const bots = TEAMS.filter(id => claims[id] === 'bot' && !(S.proposedBy || []).includes(id));
    if (!bots.length) return;
    by = bots[Math.floor(Math.random() * bots.length)];
  }
  // Grund-3 öhälso-viktat (som förr). Fr.o.m. runda 4: boten kan även välja ur rundans
  // extra-pool (S.extraProposals); i kris prioriteras Krispaket. Samma logik som src/ui.js pickBotProposal.
  const base = S.oh < 45 ? (Math.random() < 0.6 ? 'gron' : 'forbud')
             : Math.random() < 0.5 ? 'skatt' : (Math.random() < 0.5 ? 'gron' : 'forbud');
  const extra = (S.round >= 4 && Array.isArray(S.extraProposals)) ? S.extraProposals : [];
  let type = base;
  if (extra.length && Math.random() < 0.4) {
    type = (S.oh < 45 && extra.includes('krispaket')) ? 'krispaket' : extra[Math.floor(Math.random() * extra.length)];
  }
  engine.openProposal(type, by);
}

// Bot-svar på byteserbjudande (samma logik som mock-läget i ui.js)
function botAccepts(bot, get, getCur, give) {
  if (bot[getCur] < get + 6) return { ok: false, why: `${bot.namn} har inte ${get} att avvara` };
  if (give < get * 0.8) return { ok: false, why: `${bot.namn} tyckte bytet var för snålt` };
  return { ok: true };
}

// ——— Slutdelen: live podie-fördelning ———
// Räkna ihop svaren för en fråga: counts {option:antal} + tokens [{team, farg, option}]
// (ett svar per lag/skärm, sista vinner tills frågan stegas vidare). Markerna färgas efter lagfärg.
function slutdelDistribution(questionId) {
  const ans = (slutdel && slutdel.answers[questionId]) || {};
  const counts = {}, tokens = [];
  for (const [lag, option] of Object.entries(ans)) {
    counts[option] = (counts[option] || 0) + 1;
    tokens.push({ team: lag, farg: FARG[lag] || '#8A8F96', option });
  }
  return { questionId, counts, tokens };
}
// Skicka slutdelens AKTUELLA steg till EN klient (sent ansluten) så den hamnar på rätt ställe.
function sendSlutdelStep(ws) {
  const step = slutdel?.steps[slutdel.i];
  if (!step) return;
  send(ws, { type: 'event', event: 'slutdelStart', payload: { total: slutdel.steps.length, version } });
  if (step.kind === 'question') {
    send(ws, { type: 'event', event: 'slutdelQuestion', payload: { id: step.id, fraga: step.fraga, options: step.options, bild: step.bild } });
    send(ws, { type: 'event', event: 'slutdelDist', payload: slutdelDistribution(step.id) });
  } else {
    send(ws, { type: 'event', event: 'slutdelReveal', payload: { kort: step } });
  }
}

// ——— WebSocket ———
const wss = new WebSocketServer({ server: httpServer });

// Hjärtslag: rensa spökanslutningar (somnad iPad, hårt stängt fönster) så att
// "alla klara → avsluta tidigt" aldrig blockeras av en död klient som räknas som människa.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws._alive === false) { ws.terminate(); continue; }   // → 'close' → laget blir bot + maybeResolve
    ws._alive = false;
    ws.ping();
  }
}, 10000);

// Idle-vakt: en öppen men inaktiv skärm tas över av en bot, så spelet aldrig fastnar på en som
// "somnat". idleMs räknar BARA upp medan rundtimern tickar (inte lobby/tutorial/prisutdelning/paus) →
// den ackumulerade tiden är ren aktiv speltid, persistar över rundor, och nollställs av varje handling.
setInterval(() => {
  if (!started || !engine || !timerInt || paused || resolvingNow || engine.getState().over) return;
  let togNagon = false;
  for (const id of TEAMS) {
    const ws = claims[id];
    if (!ws || ws === 'bot' || ws.readyState !== 1) continue;      // bara levande människor
    idleMs[id] = (idleMs[id] || 0) + IDLE_TICK_MS;
    if (idleMs[id] < IDLE_TAKEOVER_MS) continue;                   // ännu inte nog aktiv inaktivitet
    idleMs[id] = 0;
    claims[id] = 'bot';                                            // → bot sköter laget (bygger vid bokslut, driver rundan)
    try { send(ws, { type: 'botTakeover', lag: id }); } catch {}   // tala om för just den skärmen → erbjud "ta tillbaka"
    broadcast({ type: 'notis', text: `🤖 ${NAMN[id]} var inaktiv — en bot tog över` });
    broadcast(lobbyMsg());                                         // pulten + skärmarna speglar bot-läget
    togNagon = true;
  }
  // Togs sista människan över, ELLER är hela bordet redan botar? → rundan ska inte vänta ut timern.
  // (Utan detta stod rena bot-rundor och tickade hela vägen, eftersom bara en människas "klar" annars
  // triggar maybeResolve.) Noll levande människor → lös rundan nu; botarna bygger i forceResolve.
  if (togNagon || liveHumanIds().length === 0) maybeResolve();
}, IDLE_TICK_MS);

wss.on('connection', ws => {
  ws._alive = true;
  ws.on('pong', () => { ws._alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const lag = ws._lag;
    if (lag && claims[lag] === ws) touchLag(lag);   // laget gjorde något → nollställ dess idle-klocka
    switch (m.type) {

      case 'hello': {
        if (m.lag && TEAMS.includes(m.lag) && (!claims[m.lag] || claims[m.lag] === 'bot' || claims[m.lag].readyState !== 1)) {
          const varBot = claims[m.lag] === 'bot';
          claims[m.lag] = ws; ws._lag = m.lag;
          touchLag(m.lag);   // färsk aktivitet → idle-vakten tar inte tillbaka laget direkt
          if (varBot && started && !engine.getState().over) broadcast({ type: 'notis', text: `🧑 En spelare tog över ${NAMN[m.lag]}` });
        }
        send(ws, { type: 'hello-ack', lag: ws._lag ?? null, started, config: engine?.cfg ?? new EcoLoco(manifest.config || {}).cfg });
        broadcast(lobbyMsg());
        // Sent ansluten mitt i slutdelen → skicka DET steg som visas nu, så skärmen hamnar rätt.
        if (phase === 'slutdel' && slutdel && slutdel.i >= 0 && slutdel.i < slutdel.steps.length) sendSlutdelStep(ws);
        // (trailern triggas nu av STARTA-knappen/fönstret, inte av anslutning — se playTrailer + klientens startEfterTrailer)
        break;
      }
      case 'claim': {
        // Ledig plats, bot, eller död anslutning får tas över — även mitt i pågående spel.
        const free = TEAMS.includes(m.lag) && (!claims[m.lag] || claims[m.lag] === 'bot' || claims[m.lag].readyState !== 1);
        if (free) {
          if (lag && claims[lag] === ws) claims[lag] = started ? 'bot' : null;
          claims[m.lag] = ws; ws._lag = m.lag;
          touchLag(m.lag);   // färsk aktivitet → idle-vakten tar inte tillbaka laget direkt
          if (started && !engine.getState().over) broadcast({ type: 'notis', text: `🧑 En spelare tog över ${NAMN[m.lag]}` });
        }
        send(ws, { type: 'claimAck', lag: ws._lag ?? null });
        broadcast(lobbyMsg());
        // (trailern triggas nu av STARTA-knappen, inte av anslutning)
        break;
      }
      case 'tutBeat': {
        // Tutorial-barriär: ren relä — klienterna äger tutorialen, servern säger bara vilka som är klara med ett beat.
        if (!lag || started) break;
        (tutBeats[m.beat] ||= new Set()).add(lag);
        broadcast({ type: 'tutUpdate', beat: m.beat, klara: [...tutBeats[m.beat]], humans: liveHumanIds().length });
        break;
      }
      case 'startGame': {
        // DIREKT-start: replay (playAgain) och lokalt/dev. RUMS-FLÖDET går numera via tutReady →
        // gemensam nedräkning → beginGame (ingen skärm startar partiet själv längre). riggSilent/gmMode
        // sätts INTE om här — de ägs av spelledarpanelens läges-toggle.
        console.log(`[spel] startGame (direkt) från ${lag || 'bänk utan lag'}${started && engine && !engine.getState().over ? ' — ignorerad (pågår)' : ''}`);
        if (started && engine && !engine.getState().over) break;
        beginGame();
        break;
      }
      case 'tutReady': {
        // Gate 3: den här skärmens tutorial är klar. Nedräkningen startar FÖRST när ALLA levande
        // människor är redo — ingen blank tids-tvång (den startade spelet i förtid medan långsamma
        // lag fortfarande körde tutorialen). Övergivna skärmar faller ur via hjärtslaget (→ bot), och
        // idle-skärmars tutorial auto-slutförs av beat-failsafes → de rapporterar också 'redo' till slut.
        if (!lag || started) break;
        if (!tutReady.has(lag)) {
          tutReady.add(lag);
          broadcast({ type: 'tutReadyUpdate', klara: [...tutReady], humans: liveHumanIds().length });
          maybeStartCountdown();
        }
        break;
      }
      case 'tutIdle': {
        // Obemannad skärm i tutorialen (ingen beröring på 90 s, rapporterat av skärmen) → gör laget till
        // bot så gruppens nedräkning inte blockeras. Kan återtas (claim) precis som ett bot-övertagande.
        if (started || !lag || claims[lag] !== ws) break;   // bara i förspelet, bara eget levande lag
        claims[lag] = 'bot';
        try { send(ws, { type: 'botTakeover', lag }); } catch {}
        broadcast({ type: 'notis', text: `🤖 ${NAMN[lag]} var obemannad — en bot tar över` });
        broadcast(lobbyMsg());
        maybeStartCountdown();   // kvarvarande redo-lag kan nu starta
        break;
      }
      case 'selectCard': {
        if (!lag || resolvingNow) break;
        const res = engine.selectCard(lag, m.tier);
        send(ws, { type: 'actionResult', reqId: m.reqId, res });
        break;
      }
      case 'klar': {
        if (lag && !klar.has(lag)) {
          klar.add(lag);
          broadcast({ type: 'klarUpdate', klar: [...klar], senast: lag, humans: liveHumanIds().length });
          maybeResolve();   // alla mänskliga lag klara → bokslutet körs direkt, timern väntas inte ut
        }
        break;
      }
      case 'awardsKlara': {
        if (lag) awardsKlar(lag);   // klickat igenom prisutdelningen → timern startar när alla är klara
        break;
      }
      case 'openProposal': {
        // ETT FÖRSLAG PER LAG/RUNDA: blockera bara om ett förslag är OAVGJORT just nu (inte om det
        // senaste redan avgjorts). Motorn nekar lag som redan lagt sitt förslag denna runda.
        const pp = engine.getState().proposal;
        if (!lag || resolvingNow || (pp && !pp.resolved) || Date.now() < proposalCooldownUntil) break;
        const before = engine.getState().proposal;
        engine.openProposal(m.ptype, lag);
        if (engine.getState().proposal === before) break;   // motorn nekade (redan lagt / ej tillåtet)
        engine.vote(lag, true);
        broadcast({ type: 'voteUpdate' });
        checkBotVotes();
        break;
      }
      case 'vote': {
        if (!lag) break;
        engine.vote(lag, !!m.yes);
        broadcast({ type: 'voteUpdate' });
        checkBotVotes();
        if (!engine.getState().proposal || engine.getState().proposal.resolved) maybeResolve();
        break;
      }
      case 'tradeOffer': {
        if (!lag) break;
        const target = claims[m.to];
        const t = engine.team(lag);
        if (t[m.giveCur] < m.give) { send(ws, { type: 'tradeResult', reqId: m.reqId, res: { ok: false, why: 'du saknar täckning' } }); break; }
        if (target === 'bot') {
          const bot = engine.team(m.to);
          const svar = botAccepts(bot, m.get, m.getCur, m.give);
          const res = svar.ok ? engine.transfer(lag, m.to, m.give, m.giveCur, m.get, m.getCur) : svar;
          send(ws, { type: 'tradeResult', reqId: m.reqId, res: res.ok ? { ok: true } : { ok: false, why: res.why || res.reason } });
        } else if (target && target.readyState === 1) {
          const id = ++offerSeq;
          offers.set(id, { from: lag, to: m.to, give: m.give, giveCur: m.giveCur, get: m.get, getCur: m.getCur, reqId: m.reqId, fromWs: ws });
          send(target, { type: 'tradeIncoming', offerId: id, from: lag, give: m.give, giveCur: m.giveCur, get: m.get, getCur: m.getCur });
        } else {
          send(ws, { type: 'tradeResult', reqId: m.reqId, res: { ok: false, why: 'laget är inte anslutet' } });
        }
        break;
      }
      case 'tradeAnswer': {
        const o = offers.get(m.offerId); if (!o) break;
        offers.delete(m.offerId);
        const res = m.accept ? engine.transfer(o.from, o.to, o.give, o.giveCur, o.get, o.getCur) : { ok: false, reason: 'tackade nej' };
        send(o.fromWs, { type: 'tradeResult', reqId: o.reqId, res: res.ok ? { ok: true } : { ok: false, why: res.reason } });
        break;
      }

      // ——— SLUTDEL: skärm-svar på podiefråga ———
      // Ett svar per lag/skärm per fråga (sista vinner tills GM stegar vidare). Live-fördelning till ALLA.
      case 'podiumAnswer': {
        if (!slutdel) break;
        const step = slutdel.steps[slutdel.i];
        if (!step || step.kind !== 'question' || step.id !== m.questionId) break;   // bara den fråga som visas nu
        const voter = lag || ws._lag;
        if (!voter || !Array.isArray(step.options) || !step.options.includes(m.option)) break;
        (slutdel.answers[m.questionId] ||= {})[voter] = m.option;
        session?.logEvent('podiumAnswer', { questionId: m.questionId, team: voter, option: m.option });
        broadcast({ type: 'event', event: 'slutdelDist', payload: slutdelDistribution(m.questionId) });
        break;
      }
      // Startceremonin: skärmen ber riggen köra riser/LED-chase/vitt ljus (hjärnan mappar).
      case 'rigCue': { if (m.phase) riggPublish('ecoloco/rigg/ceremoni', String(m.phase)); break; }
      // ——— SLUTDEL/GM: sekundär kontrollkanal över WS (webb-spelledarpanel + headless-test) ———
      // MQTT-kanalen ecoloco/spel/gm är oförändrad; detta är ett ADDITIV alternativ med samma payload.
      case 'pause': { setPaused(m.on !== undefined ? m.on : !paused); break; }   // skärmknapp → pausa/fortsätt
      // RUMS-FLÖDE: spelaren trycker STARTA i självspel → öppna 15 s join-fönster (fasen kvar i 'lobby').
      // Spelledarpulten startar via 'startGame' direkt → rör aldrig detta.
      case 'startWindow': { openStartWindow(lag); break; }
      // RUMS-FLÖDE: klienten säger att den gått in i solo-tutorialen → phase='tutorial' (bara i lobby, före start).
      case 'phaseTutorial': { if (!started && phase !== 'spel') phase = 'tutorial'; break; }
      case 'gmcmd': { try { handleGmCmd(m); } catch (e) { console.warn(`[gm] fel vid WS-kommando: ${e.message}`); } break; }
      // Spelledarpanel → riggen (grupp B): publicera en rigg-topic direkt. Bara ecoloco/rigg/* släpps igenom.
      case 'rigcmd': { if (typeof m.topic === 'string' && m.topic.startsWith('ecoloco/rigg/')) riggSend(m.topic, (m.payload && typeof m.payload === 'object') ? JSON.stringify(m.payload) : (m.payload ?? '')); break; }
    }
  });
  ws.on('close', () => {
    const lag = ws._lag;
    if (lag && claims[lag] === ws) {
      claims[lag] = started ? 'bot' : null;   // mitt i spel → boten tar över; i lobby → platsen släpps
      if (started && !engine.getState().over) broadcast({ type: 'notis', text: `🤖 ${NAMN[lag]} tappade kontakten — styrs nu av datorn` });
      broadcast(lobbyMsg());
      if (started) { klar.delete(lag); awardsKlar(lag); checkBotVotes(); maybeResolve(); }
      else { tutReady.delete(lag); maybeStartCountdown(); }   // tappad skärm i förspelet → de kvarvarande redo-lagen kan starta
    }
  });
});

// ——— Retur-kanal: spelledarpanel → server (ecoloco/spel/gm, ICKE-retained) ———
// Samma mosquitto_sub-spawn-mönster som tools/hjarna-stubb.py — ingen ny npm-dep.
// Payload = {cmd:...}. ENDAST spelledar-initierade kommandon; allt är fas-gardat & idempotent.
// Push nytt pending-händelseförslag till spelledarpanelen (state bär pendingEvent) + riggen (eventforslag-topic).
function broadcastEventforslag() {
  const pe = engine?.getState().pendingEvent;
  if (pe) riggPublish('ecoloco/rigg/eventforslag', JSON.stringify({ id: pe.id, namn: pe.rubrik, text: pe.text }));
  broadcast({ type: 'event', event: 'eventforslag', payload: pe ? { id: pe.id, rubrik: pe.rubrik, text: pe.text } : null });
}
function handleGmCmd(m) {
  if (!m || typeof m.cmd !== 'string') return;
  switch (m.cmd) {
    case 'gm':   // {on:true/false} → serverns GM-flagga (styr händelse-flöde + award-takt)
      gmMode = !!m.on;
      engine?.setGm(gmMode);
      rigg?.setGm(gmMode);
      console.log(`[gm] GM-läge = ${gmMode}`);
      broadcast(lobbyMsg());   // spegla läget till klienterna (STARTA-knappens synlighet)
      break;
    case 'pause':        // {on?:bool} eller toggla — frys bara spelmotorn (paus-knapp / arkadknapp / Blocks)
      setPaused(m.on !== undefined ? !!m.on : !paused);
      break;
    case 'spelledare':   // {on:bool} → med/utan spelledare. MED = spelet tyst mot riggen OCH GM-läge:
      riggSilent = !!m.on;                 //   100 % valbart event varje runda + manuell award-stegning.
      gmMode = riggSilent;                 //   "spelledare" och GM är samma koncept — en ledare styr allt.
      engine?.setGm(gmMode);
      rigg?.setGm(gmMode);
      console.log(`[spel] läge: ${riggSilent ? 'MED' : 'UTAN'} spelledare (GM ${gmMode ? 'PÅ' : 'AV'}, rigg-cues ${riggSilent ? 'AV' : 'PÅ'})`);
      broadcast(lobbyMsg());   // spegla läget till klienterna (STARTA-knappens synlighet)
      break;
    case 'trailer':      // KOPPLING 2 (huvudväg): spela intro-trailern (video på skärmar + ljussekvens från servern)
      playTrailer();
      break;
    case 'trailerSkip':  // hoppa över trailern (tap på skärmen) → stoppa ljussekvensen + säg "klart" till alla skärmar
      stopTrailer();
      broadcast({ type: 'event', event: 'trailerDone' });
      break;
    case 'skipintro':    // SPELLEDARE: skippa introt/trailern → gå vidare (tutorial/spel) för ALLA. Bara i intro-fasen.
      if (phase !== 'intro') break;
      stopTrailer();
      broadcast({ type: 'event', event: 'trailerDone' });   // klienterna kör korEfterTrailer → tutorial/spel
      console.log('[spel] SKIPPA INTRO → vidare för alla');
      break;
    case 'tilllobby':    // SPELLEDARE: omstart → alla till lobbyn (när som helst)
      resetToLobby();
      break;
    case 'tillattract':  // SPELLEDARE: ta alla hela vägen till ATTRACT-skärmen (ny grupp redo att komma in)
      resetToLobby();                                     // nollställ allt (motor/timers/started) → lobby-läge
      broadcast({ type: 'event', event: 'tillattract' }); // skärmarna lägger attract-skärmen överst + spelar filmen
      riggSend('ecoloco/rigg/scen', 'attract');           // riggen till viloläge (ungated → även i spelledarläge)
      break;
    case 'forcestart':   // SPELLEDARE: TVINGA START — kör den gemensamma nedräkningen även om alla inte tryckt redo
      if (!started && !startCountdownInt) { console.log('[spel] spelledaren TVINGADE start'); startSharedCountdown(); }
      break;
    case 'startspel':    // SPELLEDARE: STARTA SPELET — kör hela det normala flödet (trailer → tutorial →
      // gemensam nedräkning → runda 1) på alla skärmar. Samma signal som när join-fönstret löper ut.
      if (!started && phase === 'lobby') { console.log('[spel] spelledaren STARTADE spelet (fullt flöde)'); broadcast({ type: 'startGo' }); }
      break;
    case 'tillrunda1':   // SPELLEDARE: HOPPA DIREKT TILL RUNDA 1 — skippar trailer OCH tutorial, startar partiet nu.
      // beginGame() avbryter trailer/nedräkning/join-fönster, fyller tomma lag med botar och startar motorn.
      // Klienter i tutorial/intro hoppar in via 'start'-eventet (convergeToGame / trailerDone).
      if (started && engine && !engine.getState().over) { console.log('[spel] tillrunda1 ignorerad — parti pågår'); break; }
      broadcast({ type: 'event', event: 'trailerDone' });   // stäng ev. trailer-overlay på skärmarna
      console.log('[spel] spelledaren HOPPADE direkt till runda 1');
      beginGame();
      break;
    case 'pengaslapp':   // +10 pengar & +10 material till alla lag — bara under en pågående runda
      if (!started || !engine || engine.getState().over || resolvingNow) break;
      engine.pengaslapp();
      break;
    case 'event': {   // {beslut:'ja'|'nej'} → kör/hoppa rundans händelseförslag (en gång/runda, idempotent via pendingEvent)
      if (!gmMode || !started || !engine || engine.getState().over) break;
      if (eventFiring) break;                                      // en händelse körs redan (rigg-cue + 3 s) → ignorera dubbeltryck
      const pe = engine.getState().pendingEvent;
      if (!pe) break;
      const beslut = m.beslut === 'ja' ? 'ja' : 'nej';
      session?.noteGmDecision(engine.getState().round, pe.id, beslut);   // logga GM-beslutet till summaryn
      if (beslut === 'nej') { engine.resolveEventDecision('nej'); break; }   // hoppa: ingen cue, ingen fördröjning
      // KÖR: rigg-cue (per händelse, default happening) nu → 3 s senare visas händelsen på skärmarna.
      fireRiggCue(EVENT_RIGG_CUE[pe.id] || 'happening');
      eventFiring = true;
      setTimeout(() => {
        eventFiring = false;
        if (!started || !engine || engine.getState().over) return;
        if (engine.getState().pendingEvent?.id !== pe.id) return;   // omstart/omspel hann ändra läget
        engine.resolveEventDecision('ja');                          // visar händelsen (+ event-ljud via rigg.js)
      }, RIGG_EVENT_DELAY_MS);
      break;
    }
    case 'valjEvent': {   // {id} → spelledaren väljer SJÄLV rundans händelse (byter pending; går att byta tills den körts)
      if (!gmMode || !started || !engine || engine.getState().over) break;
      if (eventFiring) break;                                      // en händelse körs redan (cue + 3 s) → ignorera
      engine.chooseEvent(m.id);
      broadcastEventforslag();
      break;
    }
    case 'slumpaEvent': {   // spelledaren lämnar tillbaka till slumpen → dra en ny händelse
      if (!gmMode || !started || !engine || engine.getState().over) break;
      if (eventFiring) break;
      engine.drawRandomEvent();
      broadcastEventforslag();
      break;
    }
    case 'award_next': {   // GM: stega prisutdelningen ett pris — skärm + rigg i exakt takt (delad med selfplay)
      if (!gmMode || !cer) break;
      advanceCeremony();
      break;
    }

    // ——— SLUTDEL: spelledarstegad slutdel (podium + reveal). Fas-gardat + idempotent, som award_next. ———
    case 'slutdel_start': {   // guard: partiet måste vara SLUT. Bygg ordnad steglista [q1..q6, nf1..nf3] (version A).
      if (!engine || engine.getState().over !== true) break;
      slutdel = { steps: buildSlutdel(version), i: -1, answers: {} };
      phase = 'slutdel';
      rigg?.beginSlutdel?.();
      broadcast({ type: 'event', event: 'slutdelStart', payload: { total: slutdel.steps.length, version } });
      break;
    }
    case 'slutdel_next': {   // stega ETT steg. Fråge-steg → fråga+knappar. Reveal-steg → kort (+ ev. ljud-cue).
      if (!slutdel) break;
      const leaving = slutdel.steps[slutdel.i];
      if (leaving && leaving.kind === 'question') {   // lås föregående frågas svar → faller in i summaryn
        const d = slutdelDistribution(leaving.id);
        session?.notePodium(leaving.id, leaving.fraga, d.counts, d.tokens.length);
      }
      slutdel.i++;
      if (slutdel.i >= slutdel.steps.length) {         // efter sista steget → klart, uppdatera summaryn
        rigg?.endSlutdel?.(engine.getState().over);
        broadcast({ type: 'event', event: 'slutdelDone', payload: {} });
        session?.writeSummary(engine.getState(), lastGameEnd);
        slutdel = null;
        break;
      }
      const step = slutdel.steps[slutdel.i];
      if (step.kind === 'question') {
        broadcast({ type: 'event', event: 'slutdelQuestion', payload: { id: step.id, fraga: step.fraga, options: step.options, bild: step.bild } });
      } else {
        if (step.ljud) rigg?.slutdelReveal?.(step);   // ev. ljud-cue på centralhögtalaren via src/rigg.js
        broadcast({ type: 'event', event: 'slutdelReveal', payload: { kort: step } });
      }
      break;
    }
  }
}

function attachGmChannel() {
  let proc;
  try {
    proc = spawn('mosquitto_sub', ['-h', RIGG_BROKER, '-p', RIGG_PORT, '-v', '-t', 'ecoloco/spel/gm', '-t', 'ecoloco/spel/pause']);
  } catch (e) {
    console.warn(`[gm] kunde inte starta mosquitto_sub (${e.code || e.message}) — spelledarpanelen når inte servern`);
    return;
  }
  proc.on('error', e => console.warn(`[gm] mosquitto_sub-fel (${e.code || e.message}) — spelledarpanelen når inte servern`));
  let buf = '';
  proc.stdout.on('data', chunk => {
    buf += chunk.toString();
    let ix;
    while ((ix = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, ix); buf = buf.slice(ix + 1);
      const sp = line.indexOf(' ');            // mosquitto_sub -v ger "topic payload"
      if (sp < 0) continue;
      const topic = line.slice(0, sp), payload = line.slice(sp + 1).trim();
      if (topic === 'ecoloco/spel/pause') {    // fysisk knapp / Blocks: 1=pausa, 0=fortsätt, annat=toggla
        setPaused(payload === '1' ? true : payload === '0' ? false : !paused);
        continue;
      }
      let m; try { m = JSON.parse(payload); } catch { continue; }
      try { handleGmCmd(m); } catch (e) { console.warn(`[gm] fel vid kommando: ${e.message}`); }
    }
  });
}
attachGmChannel();

httpServer.listen(PORT, async () => {
  const os = await import('node:os');
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`Eco Loco-server igång på port ${PORT}. Öppna på varje enhet:`);
  for (const ip of ips.length ? ips : ['localhost']) console.log(`  http://${ip}:${PORT}/spel.html?online=1`);
});
