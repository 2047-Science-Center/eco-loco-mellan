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
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { EcoLoco, AREAS, timerSecFor, EVENTS } from '../spec/engine.js';
import { mockOpponentsAct, mockOpponentsVote } from '../spec/mock-opponents.js';
import { botPickProposal } from '../spec/bot-policy.js';
import { attachMqtt, setPublisher as setBenchPublisher, clearBenchResults } from '../src/mqtt.js';
import { attachRigg } from '../src/rigg.js';
import { newSession } from './persist.js';
import { buildSlutdel } from '../spec/slutdel.js';
import { buildEngineConfig, isValidVariant, VARIANT_IDS, phaseTimers } from './variant-config.js';
import { DILEMMAS } from '../spec/content/dilemmas.js';
import { GM_EVENTS } from '../spec/content/gm-events.js';
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
// Rigg-cue per händelse-id. Det gamla fullt slumpade systemets cues är OMPEKADE till de nya
// händelserna (company-crises/-events, ohalsa-events, gm-events) 2026-11-19 — t.ex. gamla
// skogsbrand → company-crisis `skog_major`, torka → `aker_major`. Fyras av companyEvent-handlern när
// händelsen visas. Default (ej i listan) = 'happening' (självslocknande wave + ljud). Specialcues
// 'kris'/'fanfar' latchar sina topics (ecoloco/rigg/kris, .../gm/alla_grona) → companyEvent-handlern
// återställer dem till sanningen efter pausen. Tilldela fler här efter hand.
const EVENT_RIGG_CUE = {
  // Stora katastrofer (de gamla auto-katastrofernas arvtagare) → larm/kris-puls.
  aker_major: 'kris', skog_major: 'kris', tundra_major: 'kris', stad_major: 'kris',
  uppror: 'kris',                                         // "folket har fått nog" (oförändrad specialcue)
  // Stora positiva vändningar → fanfar.
  naturenblomstrar: 'fanfar', miljolyft: 'fanfar', gronafonden: 'fanfar',
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
  const type = MIME[extname(file)] || 'application/octet-stream';
  const size = statSync(file).size;
  // Range-stöd (206 Partial Content) → introfilm/bakgrundsvideo spelar på Safari/iPad,
  // som skickar byte-range-förfrågningar och annars vägrar spela <video>.
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= size) { start = 0; end = size - 1; }
    res.writeHead(206, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  // no-store på icke-video: webbläsaren (även kiosk/pekskärm) cachar ALDRIG html/js/css/bild → en vanlig
  // reload hämtar alltid färsk kod. (Video går via 206-grenen ovan med no-cache så den får cachas.)
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Accept-Ranges': 'bytes', 'Content-Length': size });
  createReadStream(file).pipe(res);
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
let paused = false;       // MANUELL paus (spelledare/knapp) → frys spelmotorn. Riggen/ambiencen rörs ej.
let autoPaused = false;   // AUTO-paus: ett spelledarstyrt dilemma pågår under byggfasen → frys timer + blockera
let eventDismissed = new Set();   // lag som klickat bort NUVARANDE händelse-popup (resume när alla levande människor gjort det, annars 15 s-taket)
                          // bygge/handel. Skild från manuell paus: när dilemmat avgörs återupptas spelet BARA
                          // om spelledaren inte också pausat manuellt.
let tutBeats = {};             // tutorial-barriären: beat → Set av lag som är klara
let awardsVantar = new Set();  // mänskliga lag som inte klickat klart prisutdelningen än
let awardsFailsafe = null;     // timeout som startar timern även om någon klient tappas
let lastAwards = null;         // senaste rundans prisvinnare (motorns 'award'-event)
let cer = null;                // prisutdelning som SERVERN dirigerar (båda lägen): { steps:[{typ,w}], i }
let cerTimer = null;           // selfplay: auto-stegarens timer (server-dirigerad lockstep skärm+rigg)
const CEREMONY_STEP_MS = 5000; // selfplay: tid per pris (skärm + rigg kliver i exakt denna takt)
let resolvingNow = false;
const PROPOSAL_COOLDOWN_MS = 2500;   // kort paus efter att ett förslag avgjorts innan nästa får läggas (hinner visa resultatet)
// ÖRÅD-politik: efter prisutdelningen varje år får ordföranden (powerTeam, roterar) en stund att
// lägga ETT av 5 förslag — eller 'inget förslag'. Läggs ett → röstning → konsekvenser → nästa år.
let politics = null;                 // { stage:'propose'|'vote'|'done', left, power } eller null (ingen politikfas)
let politicsTimer = null, botOrdforandeTimer = null;
// DILEMMA-Ö-råd (Slice 4): när versionens decisionSystem='dilemma' (Flash) körs ett auto-draget
// dilemma i stället för politik. { stage:'vote'|'done', left } eller null.
let dilemma = null;
let dilemmaTimer = null, botDilemmaTimer = null;
let crisisTimer = null;        // företagshändelse: kort visnings-/frystimer (EVENT_PAUSE_MS) → resume
let eventCooldownTimer = null; // cooldown av NORMALT spel mellan köade händelser (EVENT_COOLDOWN_MS) → lös nästa
let crisisDueRound = 0;        // ÅRSGATADE lokala kriser: senaste runda vi redan köat väntande kriser för (en gång/runda)
// Händelse-pacing (presentation, beslut Klara 2026-11-19): en företagshändelse fryser spelet bara en KORT
// stund (skärmen oklickbar), sen rullar spelet vidare — INTE hela kön på en gång. Ligger flera händelser i
// kö får de en COOLDOWN av normalt spel emellan så popups inte staplas. Rör inga regler/effekter/trösklar.
const EVENT_PAUSE_MS = 15000;    // händelse-popupen ligger kvar (och spelet fryst) UPP TILL 15 s — ett klick (eventDismiss) löser den tidigare (Klara 2026-11-23)
const EVENT_COOLDOWN_MS = 4000;  // normalt (ofryst) spel mellan två köade händelser
const PROPOSE_SECS = 30, VOTE_SECS = 30;
const BOT_POWER_WAIT_S = 60;         // en bot med makten väntar så här många sek IN I rundan innan den lägger sitt förslag (människor hinner ringa & påverka)
const EVENT_DELAY_S = 30;            // årets slumphändelse dyker upp så här många sek IN I året (inte i örådet)
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
// Spelversion (Slice 1 + 6B): spelledaren väljer Flash/Mellan/Skola för NÄSTA parti. MELLAN är förvald
// standardversion vid serverstart (Slice 6B: legacy/Standard borttaget — alla tre är jämbördiga).
// Appliceras i newEngine() → gäller nästa beginGame(), aldrig ett pågående parti. runningVariant = vad
// det pågående/senaste partiet faktiskt byggdes med.
let selectedVariant = 'mellan';
let runningVariant = null;
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
// Dilemma-katalog (id + namn) → spelledarpanelen kan erbjuda AKTIVERA DILEMMA under byggfasen (Slice 5).
// GM-katalog (spelledarpult, Mellan/Skola): ENDAST bank-gemensamma dilemman. Flash-only-dilemman
// (flashOnly, 2026-11-19) hålls ute så Mellan/Skola-pulten är oförändrad.
const DILEMMA_KATALOG = DILEMMAS.filter(d => !d.flashOnly).map(d => ({ id: d.id, namn: d.namn }));
const GM_KATALOG = GM_EVENTS.map(e => ({ id: e.id, namn: e.namn }));                              // 4 direkta GM-händelser
const ROST_KATALOG = EVENTS.filter(e => e.typ === 'rost').map(e => ({ id: e.id, namn: e.rubrik })); // ja/nej-omröstningar (sponsrat)
// variant: valet för nästa parti (selected) + vad pågående parti faktiskt kör (running) + alternativen.
// Följer med i VARJE meddelande så spelledarpanelen alltid kan visa aktuell version (Slice 1).
// mode = valda variantens onboarding-läge (flash=selfplay/mellan=tutorial) → klienten vet redan i lobbyn
// om STARTA ska köra tutorial eller starta direkt (innan motorn/config finns).
function variantInfo() { return { selected: selectedVariant, running: runningVariant, options: VARIANT_IDS, mode: buildEngineConfig(manifest.config || {}, selectedVariant).mode }; }
// Lobby-config: även utan igångsatt parti ska varje send() bära en GILTIG config (vald variants),
// annars blir reader.cfg = undefined i klienten och init-koden (E().cfg.rounds) kastar → döda knappar.
function lobbyCfg() { return buildEngineConfig(manifest.config || {}, selectedVariant); }
function send(ws, obj) { if (ws && ws !== 'bot' && ws.readyState === 1) ws.send(JSON.stringify({ ...obj, phase, claims: claimKinds(), variant: variantInfo(), config: engine ? engine.cfg : lobbyCfg(), state: engine ? { ...engine.getState(), gmMode, riggSilent, started, dilemmaKatalog: DILEMMA_KATALOG, gmKatalog: GM_KATALOG, rostKatalog: ROST_KATALOG } : null })); }
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
  slutdel = null; cer = null; lastAwards = null; resolvingNow = false;
  clearTimeout(politicsTimer); clearTimeout(botOrdforandeTimer); politics = null; clearTimeout(dilemmaTimer); clearTimeout(botDilemmaTimer); dilemma = null;   // ÖRÅD-politik avbryts vid omstart
  started = false; paused = false; autoPaused = false; clearTimeout(crisisTimer); crisisTimer = null; clearTimeout(eventCooldownTimer); eventCooldownTimer = null; crisisDueRound = 0;
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
  runningVariant = selectedVariant;   // lås partiets version NU → senare variantbyte rör inte detta parti
  engine = new EcoLoco(buildEngineConfig(manifest.config || {}, selectedVariant));
  engine.setGm(gmMode);   // spegla serverns GM-läge in i den nya motorn
  engine.cfg.autoEventAtStart = false;   // händelsen körs INTE vid årsstart (i örådet) → servern kör den ~30 s in i året
  lastAwards = null; cer = null; slutdel = null; lastGameEnd = null; finaleSent = false; autoPaused = false; clearTimeout(crisisTimer); crisisTimer = null; clearTimeout(eventCooldownTimer); eventCooldownTimer = null; crisisDueRound = 0;
  clearTimeout(politicsTimer); clearTimeout(botOrdforandeTimer); politics = null;
  clearTimeout(dilemmaTimer); clearTimeout(botDilemmaTimer); dilemma = null;
  // Persistens: ny session (sessionId = tidsstämpel) med metadata-startrad. Fire-and-forget, data/ gitignorerad.
  session = newSession(ROOT, { config: engine.cfg, gmMode, version, claims });
  attachMqtt(engine);  // MQTT-sömmen: console-mock tills broker kopplas (byt publish i src/mqtt.js)
  rigg = attachRigg(engine, { publish: riggPublish, gm: gmMode, isPaused: () => paused });  // förstärkningsriggen: semantiska cues (paus fryser award-takten)
  const relay = ev => payload => broadcast({ type: 'event', event: ev, payload });
  for (const ev of ['start', 'build', 'trade', 'proposalOpened', 'proposalResolved', 'dilemmaOpened', 'dilemmaResolved', 'income', 'ohalsa', 'event', 'companyEvent', 'crisis', 'roundReplay', 'roundEnd', 'gameEnd'])
    engine.on(ev, relay(ev));
  // KRIS → riggen via EN semantisk cue. Dirigenten (hjarna-stubb.py) översätter: blandare + röd puls + 15s-timer.
  // Gatas automatiskt av riggPublish i spelledarläge (ecoloco/rigg/kris är ej en AMBIENT_TOPIC) → spelledaren
  // äger då blandaren manuellt. 15s-timern och LED-looken ligger i DIRIGENTEN, inte här.
  engine.on('crisis', p => riggPublish('ecoloco/rigg/kris', p.on ? '1' : '0'));
  // Företagshändelser (kriser + prestationer): pausa byggfasen ~10 s, visa händelsen, sedan resolve
  // (motorns kö processar nästa om fler ligger och väntar).
  // Företagshändelse (kris/prestation/öhälsohändelse): FRYS spelet kort (EVENT_PAUSE_MS), visa rutan, sen
  // RESUME. Ligger fler i motorns kö LÖSES de inte direkt — en COOLDOWN av normalt spel (EVENT_COOLDOWN_MS)
  // får passera innan nästa köade händelse löses och visas. Effekten tillämpas i motorn vid emit (oförändrat).
  engine.on('companyEvent', p => {
    autoPaused = true;
    eventDismissed = new Set();   // ny händelse → nollställ vilka skärmar som klickat bort den
    broadcastPause();   // auto=true → klienten fryser/blockerar men visar INGEN paus-overlay (bara händelserutan)
    // RIGG-CUE: varje visad händelse ger en cue (ompekade från det gamla systemet, se EVENT_RIGG_CUE).
    // Gatas av riggSilent (spelledarläge = operatören driver riggen själv). Latchande specialcues
    // (kris/fanfar) återställs till sanningen efter pausen så en transient händelse inte låser riggen.
    if (!riggSilent) {
      const cue = EVENT_RIGG_CUE[p.id] || 'happening';
      fireRiggCue(cue);
      if (cue === 'kris') setTimeout(() => { if (engine) riggSend(R_ + 'kris', engine.getState()?.inCrisis ? '1' : '0'); }, EVENT_PAUSE_MS);
      else if (cue === 'fanfar') setTimeout(() => riggSend(R_ + 'gm/alla_grona', '0'), EVENT_PAUSE_MS);
    }
    clearTimeout(crisisTimer);
    crisisTimer = setTimeout(afterEventShow, EVENT_PAUSE_MS);
  });
  // Persistens-tap: SAMMA eventström som relä-broadcastas → en JSONL-rad per motorhändelse (payloads oförändrade).
  for (const ev of ['start', 'build', 'trade', 'proposalOpened', 'proposalResolved', 'dilemmaOpened', 'dilemmaResolved', 'income', 'ohalsa', 'event', 'companyEvent', 'crisis', 'roundReplay', 'roundEnd', 'award', 'gameEnd'])
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
  // ÖRÅD-politik: ordföranden lade → gå till röstning; förslag avgjort → visa resultat ~2,5 s, sedan nästa år.
  engine.on('proposalOpened', () => politicsToVote());
  engine.on('proposalResolved', () => {
    if (politics) { politics.stage = 'done'; clearTimeout(politicsTimer); setTimeout(endPolitics, 2500); }
    else if (dilemma) { dilemma.stage = 'done'; clearTimeout(dilemmaTimer); setTimeout(dilemma.buildPhase ? endBuildDilemma : endDilemma, 2500); }   // rost avgjord: GM byggfas → återuppta · Flash Ö-råd → året
  });
  // Dilemma avgjort → visa resultatet, sedan: Ö-råd (Flash) → året · byggfas (GM) → återuppta.
  // Flash Ö-råd: håll resultatet längre så barn hinner läsa VILKET alternativ som genomfördes
  // (7 s vid beslut, 4,5 s vid oavgjort) — matchar klientens popup-tid. GM-byggfas (Mellan/Skola) oförändrad 2,5 s.
  engine.on('dilemmaResolved', p => {
    if (!dilemma) return;
    dilemma.stage = 'done'; clearTimeout(dilemmaTimer);
    const hold = dilemma.buildPhase ? 2500 : (p && p.outcome ? 7000 : 4500);
    setTimeout(dilemma.buildPhase ? endBuildDilemma : endDilemma, hold);
  });
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

// Fas-timers (Slice 6A): variant → ur cfg.phases; legacy → nuvarande konstanter. Inga hårdkodade
// tider åsidosätter en variants config.
function phaseT() { return phaseTimers(engine.cfg, { propose: PROPOSE_SECS, vote: VOTE_SECS }); }
function proposeSec() { return phaseT().propose; }
function voteSec() { return phaseT().vote; }
function ceremonyStepMs(steps) {
  const tot = phaseT().prisutdelning;
  return tot != null && steps > 0 ? Math.max(1500, Math.round(tot * 1000 / steps)) : CEREMONY_STEP_MS;
}
function roundFull() {
  const b = phaseT().bygga;                 // variant: byggfasens längd ur config
  return b != null ? b : timerSecFor(engine.cfg, engine.getState().round);   // legacy: timerSecFor (oförändrat)
}

function startTimer() {
  stopTimer();
  const full = roundFull();
  timerLeft = full;
  let countdownFired = false;                 // 10 s-nedräkningen fyras en gång per runda
  // FÖRDRÖJDA ÖHÄLSOHÄNDELSER: avfyra nästa VÄNTANDE händelse var N:e AKTIVA byggsekund (motorns
  // ohalsaDelaySeconds, default 30). "Aktiv tid" = timerLeft minskar bara när vi INTE är pausade/auto-
  // pausade (raden nedan returnerar då) → manuell paus, dilemma-paus OCH händelse-popupens egen 10 s-paus
  // räknas alla bort automatiskt. Köade/väntande händelser som inte hinner visas bär vi över till nästa år
  // (de ligger kvar i motorns S.pendingOhalsa). Timern körs bara under byggfasen → inga händelser i andra faser.
  const delaySec = (engine?.cfg?.ohalsaDelaySeconds) || 30;
  let ohalsaNextMark = delaySec;              // aktiv-tids-märke (sekunder förflutna) för nästa väntande händelse
  broadcast({ type: 'timer', left: timerLeft, full });
  // ÅRSGATADE LOKALA KRISER: vid BÖRJAN av byggfasen (efter Ö-råd), köa kriser vars villkor (ackumulerad
  // skada + årskrav) redan är uppfyllda men som väntat på sitt tillåtna spelår. En gång/runda (startTimer
  // kallas även vid återupptagning efter paus/dilemma → guard mot upprepning; motorn är ändå idempotent).
  // Köade kriser presenteras via companyEvent-kön (10 s-paus), aldrig under bokslut/Ö-råd.
  if (engine && engine.getState()?.round !== crisisDueRound) {
    crisisDueRound = engine.getState().round;
    engine.fireDueCrises?.();
  }
  timerInt = setInterval(() => {
    if (paused || autoPaused) return;   // manuell ELLER dilemma-auto-paus → frys nedräkningen (ambiencen loopar vidare).
    timerLeft--;
    broadcast({ type: 'timer', left: timerLeft, full });
    // aktiv byggtid som förflutit = full − timerLeft. Vid varje N-sekundersmärke: visa nästa väntande
    // öhälsohändelse (om någon finns och ingen annan händelse visas just nu). Motorn applicerar effekten då.
    const elapsedActive = full - timerLeft;
    if (engine?.cfg?.ohalsaDelayed && elapsedActive >= ohalsaNextMark
        && !engine.getState().activeCompanyEvent && engine.getState().pendingOhalsa?.length) {
      const r = engine.fireNextPendingOhalsa();   // emit 'companyEvent' → companyEvent-handlern sätter autoPaused + 10 s
      if (r.ok) ohalsaNextMark += delaySec;       // nästa väntande efter ytterligare N aktiva sekunder
    }
    // Händelser kommer bara ur foretag/ohalsa (automatiskt via motorn) + gm (manuellt) — det gamla
    // fullt slumpade systemet är borttaget 2026-11-19.
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
// Sänd pausstatus till klienterna. `paused` = MANUELL spelledarpaus (klienten visar "Spelet är pausat"-
// overlayen). `auto` = händelse-/dilemma-paus (byggtimern fryses + bygge/handel blockeras, MEN ingen
// paus-overlay — händelse-/dilemmarutan är det som ska synas). Klienten skiljer på de två via dessa fält.
function broadcastPause() { broadcast({ type: 'paused', paused, auto: autoPaused, left: timerLeft }); }

// Varför bygge/handel är blockerat vid auto-paus — RÄTT text beroende på orsak. En företagshändelse
// (kris ELLER prestation som EXPANSION) visas i popup-kön → "en händelse visas"; annars ett Ö-råds-/
// dilemmabeslut → "ett beslut pågår". (Tidigare visades alltid "dilemma pågår", även för händelser.)
function autoPauseReason() { return engine?.getState()?.activeCompanyEvent ? 'en händelse visas' : 'ett beslut pågår'; }

// Händelsens korta frystid är slut → RESUME spelet (skärmen klickbar, timern tickar igen). Ligger fler
// händelser i motorns kö: LÖS dem INTE direkt — vänta EVENT_COOLDOWN_MS av normalt spel, lös sedan den
// nuvarande (vilket får motorn att emit:a nästa → ny kort visning). Är kön tom: lös direkt (nollar aktiv).
// activeCompanyEvent står kvar under cooldownen → nya byggen köar bakom i stället för att fyra direkt.
function afterEventShow() {
  if (!engine) return;
  autoPaused = false;
  broadcast({ type: 'event', event: 'eventClosed' });   // alla skärmar stänger händelse-popupen samtidigt
  broadcastPause();   // auto=false; manuell paus (paused=true) består om spelledaren pausat
  clearTimeout(eventCooldownTimer);
  if (engine.getState().companyEventQueue.length > 0) {
    eventCooldownTimer = setTimeout(() => { if (engine) engine.companyEventResolved(); }, EVENT_COOLDOWN_MS);
  } else {
    engine.companyEventResolved();   // inget mer i kön → lös nuvarande (nollar activeCompanyEvent)
  }
}

function setPaused(on) {
  on = !!on;
  if (on === paused || !started) return;
  paused = on;
  broadcastPause();
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
  if (!cer || !cer.steps.length) {                 // ingen prisutdelning denna runda (ingen vinnare) → hoppa INTE över örådet
    broadcast({ type: 'timer', left: timerLeft, full, paused: true });
    return startOrad();                             // kör örådet direkt (det startar sedan årets timer via endPolitics/endDilemma)
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
  if (!over) { clearBenchResults(); startOrad(); }                     // prisceremonin klar → ÖRÅD (politik ELLER dilemma enl. version), sedan startar året
  else fireFinale();                                                   // KRÖNING: efter prisutdelningen → tänd vinnaren + final
  return true;
}

// KRÖNING (efter SISTA prisutdelningen, när sista steget klickats). Riggen är redan mörk (scen 'slut'
// från endAwards). Finale-cuen bär utfall + vinnarlag → HJÄRNAN kör sekvensen: mörker → kort paus →
// ljus + fanfar (vinnarsidan tänds för VINST, dystert rött för FÖRLUST). Final är SYSTEMCEREMONI (ungated).
function fireFinale() {
  if (finaleSent || !lastGameEnd) return;
  finaleSent = true;
  const ge = lastGameEnd;
  const win = ge.won && !!ge.winner;
  riggSend('ecoloco/rigg/final', JSON.stringify({ result: win ? 'win' : 'lose', lag: win ? ge.winner.teamId : null }));
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
    cerTimer = setTimeout(step, 3500);                                 // paus medan skärmens ÖRÅD-popup visas (3,5 s → hinner läsas som ceremoni) → sedan första priset med full tid
  }, 300);
  function step() {
    if (!cer) return;
    if (paused) { cerTimer = setTimeout(step, 400); return; }          // paus → vänta in fortsätt
    if (!advanceCeremony()) cerTimer = setTimeout(step, ceremonyStepMs(cer.steps.length));
  }
}
// ÅTERANSLUTNING / OMLADDAD SIDA MITT I PRISUTDELNINGEN: landa klienten på exakt det pris rummet
// visar NU — i stället för att missa ceremonin eller (som förr) spela om den från början. Speglar
// slutdel-återsändningen i hello-hanteraren. cer.i = -1 → ÖRÅD-skylten; i >= 0 → det aktuella priset.
// Den löpande auto-stegaren (selfplay) resp. spelledarens award_next (GM) fortsätter som vanligt för alla.
function resumeAwards(ws) {
  if (!started || !cer) return;
  if (cer.i < 0) {
    send(ws, { type: 'event', event: 'awardCeremony', payload: { total: cer.steps.length } });
  } else if (cer.i < cer.steps.length) {
    const s = cer.steps[cer.i];
    send(ws, { type: 'event', event: 'awardStep', payload: { typ: s.typ, w: s.w, i: cer.i, total: cer.steps.length } });
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
  return;                                                       // POLITIK avstängd tills vidare → botar lägger inga förslag (ingen politik förrän efter prisceremonin, byggs senare)
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
  // Bot väljer ur de FAKTISKT tillåtna förslagen (motorn är enda källan) — inga hårdkodade id:n.
  const type = botPickProposal(engine.allowedProposals(), S.oh);
  if (type) engine.openProposal(type, by);
}

// ═══════════ ÖRÅD-politik (server-auktoritativ fas efter prisutdelningen) ═══════════
// Motorn står på det NYA året (roundStart har redan fyrat under ceremonin), så powerTeam +
// S.extraProposals (5 förslag) är satta. Ordföranden får PROPOSE_SECS att lägga ETT förslag
// eller 'inget förslag'; läggs ett → VOTE_SECS röstning → konsekvenser → året startar.
// Ö-råds-dispatcher: versionens beslutssystem avgör. Inga versions-specialfall utanför detta val.
function startOrad() {
  if (engine && engine._decisionSystem === 'dilemma') startDilemma();
  else startPolitics();
}

// ── ÖRÅD-BESLUT (Flash): auto-presentera rundans beslut → röstning → verkställ → året ──
// Beslutet kan vara ett A/B-dilemma (dilemmas.js) ELLER en individuell 'rost'-händelse (events.js).
// Motorn presenterar med rätt mekanik via openOradDecision; serverns röst-/timer-flöde delas.
function startDilemma() {
  const S = engine?.getState();
  if (!S || S.over) { startTimer(); return; }
  const choice = (S.decisionChoices || [])[0];       // { id, kind:'dilemma'|'event' }
  if (!choice) { startTimer(); return; }             // inget beslut i år → gå direkt till året
  dilemma = { stage: 'vote', left: voteSec(), kind: choice.kind };
  const res = engine.openOradDecision(choice);       // dilemma → 'dilemmaOpened' (A/B) · event → 'proposalOpened' type:event (ja/nej)
  if (!res || !res.ok) { dilemma = null; startTimer(); return; }
  // Botar röstar efter en kort delay (skärmarna hinner visa dilemmat); människor röstar via UI (A/B).
  clearTimeout(botDilemmaTimer);
  botDilemmaTimer = setTimeout(() => { if (dilemma) { checkBotVotes(); broadcast({ type: 'voteUpdate' }); } }, 8000);
  tickDilemma();
}
function tickDilemma() {
  clearTimeout(dilemmaTimer);
  dilemmaTimer = setTimeout(() => {
    if (!dilemma) return;
    if (paused) { tickDilemma(); return; }           // paus fryser nedräkningen
    dilemma.left--;
    broadcast({ type: 'politicsTimer', stage: 'vote', left: dilemma.left });   // återanvänder vote-timern i UI
    if (dilemma.left <= 0) { forceDilemmaVotes(); return; }
    tickDilemma();
  }, 1000);
}
function forceDilemmaVotes() {                        // röst-tiden ute → tvinga kvarvarande + botar
  const p = engine.getState().proposal;
  if (!p || p.resolved) return;
  const strict = !!engine.cfg.dilemmaStrict;          // Flash: uteblivna röster räknas INTE (ingen default-A)
  if (p.kind === 'dilemma') {
    // Flash-strict: fyll INTE i uteblivna (de räknas inte). Legacy (Mellan/Skola GM): utebliven → A.
    if (!strict) humanIds().forEach(id => { if (p.votes[id] === undefined) engine.vote(id, 'A'); });
  } else {
    humanIds().forEach(id => { if (p.votes[id] === undefined) engine.vote(id, false); });   // 'rost' (sponsrat): utebliven → NEJ (oförändrat)
  }
  mockOpponentsVote(engine, humanIds());              // botar röstar (botar = företag som röstar, ej "uteblivna")
  if (strict) engine.resolveOpenDecision();           // strict kan vara olöst (ej alla 4 röstade) → avgör med faktiska röster
}
function endDilemma() {                               // dilemmat avgjort → året börjar (återanvänder politicsDone-flödet)
  if (!dilemma) return;
  clearTimeout(dilemmaTimer); clearTimeout(botDilemmaTimer); dilemma = null;
  broadcast({ type: 'event', event: 'politicsDone', payload: {} });   // klienten stänger Ö-råd + stegar årssiffran
  if (engine && !engine.getState().over) startTimer();
}

// ── SPELLEDARSTYRT BESLUT under byggfasen (Slice 5 + GM-banken) ──
// GM aktiverar ett A/B-dilemma ELLER en ja/nej-omröstning (sponsrat) MITT i bygg-/bytesfasen. Auto-paus
// (frys timer + blockera bygge/handel), omröstning (delat flöde), verkställ, återuppta — men INTE om
// spelledaren också pausat manuellt (paus-distinktion). Använder motorns gmOpenDecision → en-gång/spel-
// gating (gmDecisionsUsed). choice = { id, kind:'dilemma'|'event' }.
function startGmDecision(choice) {
  if (!engine || phase !== 'spel' || resolvingNow || engine.getState().over) return false;
  const cur = engine.getState().proposal;
  if (cur && !cur.resolved) return false;            // ett beslut i taget
  const res = engine.gmOpenDecision(choice);         // dilemma → 'dilemmaOpened' (A/B) · event → 'proposalOpened' (ja/nej)
  if (!res || !res.ok) return false;
  dilemma = { stage: 'vote', left: voteSec(), kind: res.kind || choice.kind || 'dilemma', buildPhase: true };
  autoPaused = true;                                 // frys byggtimern + blockera bygge/handel
  broadcastPause();                                  // auto=true → dilemmarutan syns, ingen paus-overlay
  clearTimeout(botDilemmaTimer);
  botDilemmaTimer = setTimeout(() => { if (dilemma) { checkBotVotes(); broadcast({ type: 'voteUpdate' }); } }, 8000);
  tickDilemma();                                     // röst-nedräkning (VOTE_SECS) → forceDilemmaVotes vid 0
  return true;
}
function endBuildDilemma() {                          // dilemmat avgjort → återuppta byggfasen
  clearTimeout(dilemmaTimer); clearTimeout(botDilemmaTimer); dilemma = null;
  autoPaused = false;
  // Återuppta BARA om spelledaren inte också pausat manuellt — annars stannar spelet pausat.
  broadcastPause();
  // Byggtimern (timerInt) tickar vidare av sig själv när autoPaused släppts (den stoppades aldrig).
}

function startPolitics() {
  const S = engine?.getState();
  if (!S || S.over) { startTimer(); return; }
  const power = S.powerTeam || TEAMS[0];
  politics = { stage: 'propose', left: proposeSec(), power };
  broadcast({ type: 'event', event: 'politicsStart', payload: { power, stage: 'propose', left: proposeSec() } });
  if (claims[power] === 'bot') { clearTimeout(botOrdforandeTimer); botOrdforandeTimer = setTimeout(() => botOrdforandeLay(power), 12000); }
  tickPolitics();
}
function tickPolitics() {
  clearTimeout(politicsTimer);
  politicsTimer = setTimeout(() => {
    if (!politics) return;
    if (paused) { tickPolitics(); return; }                 // paus fryser nedräkningen
    politics.left--;
    broadcast({ type: 'politicsTimer', stage: politics.stage, left: politics.left });
    if (politics.left <= 0) {
      if (politics.stage === 'propose') endPolitics();       // tiden ute utan förslag → inget förslag → nästa år
      else forceOpenVotes();                                 // röst-tiden ute → tvinga → proposalResolved → endPolitics
      return;
    }
    tickPolitics();
  }, 1000);
}
function politicsToVote() {                                   // ordföranden lade ett förslag (proposalOpened)
  if (!politics || politics.stage !== 'propose') return;
  clearTimeout(botOrdforandeTimer);
  politics.stage = 'vote'; politics.left = voteSec();
  broadcast({ type: 'politicsTimer', stage: 'vote', left: voteSec() });
}
function endPolitics() {                                      // inget förslag / skip / förslag avgjort → året börjar
  if (!politics) return;
  clearTimeout(politicsTimer); clearTimeout(botOrdforandeTimer); politics = null;
  broadcast({ type: 'event', event: 'politicsDone', payload: {} });
  if (engine && !engine.getState().over) startTimer();
}
function botOrdforandeLay(power) {                            // bot-ordförande lägger (eller avstår) så självspel har politik
  if (!politics || politics.stage !== 'propose' || claims[power] !== 'bot') return;
  const S = engine.getState();
  const type = botPickProposal(engine.allowedProposals(), S.oh);   // ur de faktiskt tillåtna — inga hårdkodade id:n
  if (!type) { endPolitics(); return; }                            // inget att lägga → inget förslag i år
  const before = engine.getState().proposal;
  engine.openProposal(type, power);
  if (engine.getState().proposal === before) { endPolitics(); return; }   // nekades → inget förslag
  engine.vote(power, true);
  broadcast({ type: 'voteUpdate' });
  checkBotVotes();
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
  if (!started || !engine || !timerInt || paused || autoPaused || resolvingNow || engine.getState().over) return;
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
        // Sent ansluten / omladdad sida mitt i prisutdelningen → landa på det pris rummet visar nu.
        if (started && cer) resumeAwards(ws);
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
        if (!engine || !lag || resolvingNow) break;   // ingen motor (lobby/omstart) → ignorera vilsen klient i stället för att krascha
        if (autoPaused) { send(ws, { type: 'actionResult', reqId: m.reqId, res: { ok: false, reason: autoPauseReason() } }); break; }   // auto-paus (händelse/beslut) → bygge fryst
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
      case 'eventDismiss': {   // en skärm klickade bort SIN händelse-popup (de andra ser den kvar). Resume FÖRST
        if (!lag || !autoPaused || !engine?.getState()?.activeCompanyEvent) break;   // när ALLA levande människo-skärmar klickat (annars 15 s-taket).
        eventDismissed.add(lag);
        const humans = liveHumanIds();
        if (humans.length && humans.every(id => eventDismissed.has(id))) { clearTimeout(crisisTimer); afterEventShow(); }
        break;
      }
      case 'openProposal': {
        // ETT FÖRSLAG PER LAG/RUNDA: blockera bara om ett förslag är OAVGJORT just nu (inte om det
        // senaste redan avgjorts). Motorn nekar lag som redan lagt sitt förslag denna runda.
        if (!engine || !lag || resolvingNow) break;   // ingen motor → ignorera
        const pp = engine.getState().proposal;
        if ((pp && !pp.resolved) || Date.now() < proposalCooldownUntil) break;
        const before = engine.getState().proposal;
        engine.openProposal(m.ptype, lag);
        if (engine.getState().proposal === before) break;   // motorn nekade (redan lagt / ej tillåtet)
        engine.vote(lag, true);
        broadcast({ type: 'voteUpdate' });
        checkBotVotes();
        break;
      }
      case 'politicsSkip': {   // ÖRÅD: ordföranden valde INGET FÖRSLAG → hoppa direkt till nästa år
        if (politics && politics.stage === 'propose' && lag === politics.power) endPolitics();
        break;
      }
      case 'vote': {
        if (!engine || !lag) break;
        const pv = engine.getState().proposal;
        const isDil = pv && pv.kind === 'dilemma';
        engine.vote(lag, isDil ? (m.choice === 'B' ? 'B' : 'A') : !!m.yes);   // dilemma: A/B · politik/event: ja/nej
        broadcast({ type: 'voteUpdate' });
        checkBotVotes();
        if (!isDil && (!engine.getState().proposal || engine.getState().proposal.resolved)) maybeResolve();
        break;
      }
      case 'tradeOffer': {
        if (!engine || !lag) break;
        if (autoPaused) { send(ws, { type: 'tradeResult', reqId: m.reqId, res: { ok: false, why: autoPauseReason() } }); break; }   // auto-paus (händelse/beslut) → handel fryst
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
        const o = offers.get(m.offerId); if (!o || !engine) break;
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
    case 'variant': {    // {val:'flash'|'mellan'|'skola'|null} → välj version för NÄSTA parti.
      const v = m.val == null ? null : String(m.val);          // null = legacy/standard
      if (!isValidVariant(v)) { console.warn(`[variant] ogiltig variant: ${v} (giltiga: ${VARIANT_IDS.join(', ')})`); break; }
      selectedVariant = v;                                     // appliceras vid nästa newEngine() → pågående parti orört
      console.log(`[variant] nästa parti: ${v || 'legacy (standard)'}${started ? ` (pågående parti kör ${runningVariant || 'legacy'} vidare)` : ''}`);
      broadcast(lobbyMsg());                                   // spegla valet till spelledarpanelen
      break;
    }
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
    case 'reloadScreens':   // SPELLEDARE: hård omladdning av ALLA spelskärmar (t.ex. efter variant-byte) → de
      resetToLobby();       // återansluter färskt och hamnar rätt på den nya versionen. Först tillbaka till lobbyn.
      broadcast({ type: 'reloadClients' });
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
    case 'dilemma':      // {id} → bakåtkompat: aktivera ett A/B-dilemma i byggfasen
      if (startGmDecision({ id: m.id, kind: 'dilemma' })) console.log(`[spel] spelledaren aktiverade dilemma '${m.id}' (byggfas-paus)`);
      else console.warn(`[spel] dilemma '${m.id}' kunde inte aktiveras (fas/beslut pågår/redan använt?)`);
      break;
    case 'gmEvent': {    // {id} → DIREKT GM-händelse (gm-events.js). Verkställs utan omröstning via companyEvent-kön.
      if (!gmMode || !started || !engine || engine.getState().over) break;
      const res = engine.fireGmEvent(m.id);
      if (res.ok) console.log(`[spel] spelledaren körde GM-händelse '${m.id}'`);
      else console.warn(`[spel] GM-händelse '${m.id}' avvisad: ${res.reason}`);
      break;
    }
    case 'gmDecision':   // {id, kind:'dilemma'|'event'} → aktivera ett BEFINTLIGT dilemma/omröstning i byggfasen
      if (!gmMode) break;
      if (startGmDecision({ id: m.id, kind: m.kind })) console.log(`[spel] spelledaren aktiverade beslut '${m.id}' (${m.kind})`);
      else console.warn(`[spel] beslut '${m.id}' kunde inte aktiveras (fas/pågår/redan använt?)`);
      break;
    case 'gmRandomDecision': {   // slumpa fram ett ej-använt dilemma/omröstning — BARA på GM:s aktiva handling
      if (!gmMode) break;
      const pick = engine.gmPickRandomDecision();
      if (pick && startGmDecision(pick)) console.log(`[spel] spelledaren slumpade beslut '${pick.id}' (${pick.kind})`);
      else console.warn('[spel] slumpat beslut kunde inte aktiveras (fas/pågår/alla använda?)');
      break;
    }
    // (Det gamla fullt slumpade händelse-flödet 'event'/'valjEvent'/'slumpaEvent' togs bort 2026-11-19.
    //  Spelledaren styr nu händelser via DIREKTA GM-HÄNDELSER (gmEvent) + DILEMMAN/OMRÖSTNINGAR (gmDecision).)
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
