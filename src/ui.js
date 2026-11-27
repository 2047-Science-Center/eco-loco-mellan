// ui.js — Eco Loco (Mellan): vylager i två lägen bakom SAMMA spelfasad.
//   spel.html              → ONLINE (standard): server/server.js äger motorn; denna klient är
//                            en statslös vy (lag väljs i lobbyn, resten blir botar). HELA öråds-/
//                            prisflödet är serverstyrt och finns BARA här.
//   spel.html?lag=aker     → kioskläge: gör anspråk på ett lag direkt (NUC-autostart)
//   spel.html?local=1      → LOKALT (dev-mock): motorn kör i webbläsaren, mock-opponents styr 3 lag.
//                            SAKNAR öråd/politik/serverceremoni — bara för snabb UI-pyssel utan server.
//
// Fasadens kontrakt: game.on(event, cb) för motorns 12 events + timer/lobby/…,
// game.E() = läsare (team/leaderboards/contribution/getState/cfg), actions som promises.
// Events spelas alltid genom en seriell kö — under bokslutet ('resolveStart') tar
// stegen sina scenpauser, annars kör de direkt.

import { EcoLoco, AREAS, handFor, ohMode, timerSecFor } from '../spec/engine.js';
import { mockOpponentsAct, mockOpponentsVote } from '../spec/mock-opponents.js';
import { botPickProposal } from '../spec/bot-policy.js';
import { dilemmaById } from '../spec/content/dilemmas.js';
import { VARIANTS } from '../spec/config/variants/index.js';
import { TUTORIALS, ANCHORS, tutorialFor, helpById } from '../spec/content/tutorial.js';
import { renderMap } from './map.js';
import { logoSVG } from './logos.js';
import { GameAudio } from './audio.js';
import { ServerNet } from './net.js';
import { ico, moodIco, curIco, ICON_IDS } from './icons.js';
import { visaKroning, stangKroning, forladdaKroning } from './kroning.js';
import { kroningData } from '../spec/kroning.js';

const $ = id => document.getElementById(id);
const delay = ms => new Promise(r => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const ONLINE = !params.has('local');   // online är STANDARD; ?local=1 ger den gamla dev-mocken (utan öråd)

const manifest = await (await fetch('./spec/assets.json')).json();
const slots = Object.fromEntries(Object.entries(manifest.slots).filter(([k]) => k !== '_readme'));
const audio = new GameAudio(manifest.audio || {});

const MODE_LABEL = {
  superdaligt: 'Superdåligt', daligt: 'Dåligt', neutralt: 'Neutralt',
  bra: 'Bra', mycketbra: 'Mycket bra',
};
const TIER_LABEL = { smutsig: 'SMUTSIG', standard: 'STANDARD', gron: 'GRÖN' };
const CUR_ICON = { pengar: ico('pengar', 15), material: ico('material', 15) };   // fasett-ikoner (ej emoji) — RAMVERK §3
const teamName = id => AREAS.find(a => a.id === id).namn;
const fmtOh = v => (v > 0 ? '+' + v : v) + (v > 0 ? ' ' + ico('tillvaxt', 16) : ' ' + ico('industri', 16));
// Statiska chrome-ikoner i spel.html håller markup emoji-fri via <span data-ico="id" data-sz="px"> → fasett-ikon.
document.querySelectorAll('[data-ico]').forEach(el => { try { el.innerHTML = ico(el.dataset.ico, +el.dataset.sz || 20); } catch {} });

// Bot-/auto-val av förslag ur de FAKTISKT tillåtna (motorn är enda källan) — inga hårdkodade id:n.
// Samma version-agnostiska policy som servern (spec/bot-policy.js).
function pickBotProposal(engine) {
  return botPickProposal(engine.allowedProposals(), engine.getState().oh);
}

// ═══════════════ Spelfasaden ═══════════════
function makeEmitter() {
  const h = {};
  return { on: (ev, cb) => (h[ev] ||= []).push(cb), emit: (ev, p) => (h[ev] || []).forEach(cb => cb(p)) };
}

function makeLocal() {
  const em = makeEmitter();
  const engine = new EcoLoco(manifest.config || {});
  const me = engine.cfg.humanTeam;
  for (const ev of ['start', 'roundStart', 'build', 'trade', 'proposalOpened', 'proposalResolved',
                    'dilemmaOpened', 'dilemmaResolved',
                    'income', 'ohalsa', 'award', 'event', 'companyEvent', 'crisis', 'roundReplay', 'roundEnd', 'gameEnd'])
    engine.on(ev, p => em.emit(ev, p));

  let left = 0, tid = null, votingOpen = false;
  const stopT = () => { clearInterval(tid); tid = null; };
  const fullT = () => timerSecFor(engine.cfg, engine.getState().round);
  const startT = () => {
    stopT(); const full = fullT(); left = full;
    em.emit('timer', { left, full });
    tid = setInterval(() => { left--; em.emit('timer', { left, full }); if (left <= 0) { stopT(); doResolve(); } }, 1000);
  };
  function doResolve() {
    if (engine.getState().over || votingOpen) return;
    stopT();
    em.emit('resolveStart', {});
    mockOpponentsAct(engine, me);
    engine.endRound();
  }
  engine.on('roundStart', p => {
    if (p.round > 1) { stopT(); const full = fullT(); left = full; em.emit('timer', { left, full, paused: true }); }
    else startT();   // runda 2+: timern står stilla tills prisutdelningen klickats igenom (awardsKlara)
    if (p.round >= 2 && Math.random() < 0.35) setTimeout(() => {
      const S = engine.getState();
      if (S.over || S.proposal) return;
      const bots = S.teams.filter(t => t.id !== me);
      const by = bots[Math.floor(Math.random() * bots.length)].id;
      engine.openProposal(pickBotProposal(engine), by);
    }, 2500);
  });
  engine.on('proposalOpened', () => { votingOpen = true; });
  engine.on('proposalResolved', () => { votingOpen = false; });
  // OMSPEL (kris olöst): rundan spelas om → ingen prisceremoni, starta rundtimern direkt.
  engine.on('roundReplay', () => { votingOpen = false; startT(); });
  engine.on('gameEnd', () => stopT());

  function botAccepts(bot, get, getCur, give) {
    if (bot[getCur] < get + 6) return { ok: false, why: `${bot.namn} har inte ${get} ${CUR_ICON[getCur]} att avvara` };
    if (give < get * 0.8) return { ok: false, why: `${bot.namn} tyckte bytet var för snålt` };
    return { ok: true };
  }
  return {
    online: false, me, E: () => engine,
    on: em.on,
    startGame: () => engine.start(),
    selectCard: async tier => engine.selectCard(me, tier),
    trade: async (to, give, giveCur, get, getCur) => {
      const svar = botAccepts(engine.team(to), get, getCur, give);
      if (!svar.ok) return svar;
      const r = engine.transfer(me, to, give, giveCur, get, getCur);
      return r.ok ? { ok: true } : { ok: false, why: r.reason };
    },
    openProposal: type => {
      engine.openProposal(type, me);
      engine.vote(me, true);
      setTimeout(() => mockOpponentsVote(engine, me), 1100);
    },
    vote: yes => { engine.vote(me, yes); setTimeout(() => mockOpponentsVote(engine, me), 900); },
    klar: () => doResolve(),
    awardsKlara: () => { if (!tid && !engine.getState().over) startT(); },
    eventDismiss: () => {},   // lokalt läge: popupen stängs direkt vid klick (ingen server att resuma)
    pause: () => {},   // lokalt läge: ingen server/rigg att pausa
    playAgain: () => location.reload(),
  };
}

async function makeOnline() {
  const net = new ServerNet();
  const wish = params.get('lag');
  const first = await net.connect(wish);
  return {
    online: true, net,
    get me() { return net.me; }, E: () => net.reader,
    on: (ev, cb) => net.on(ev, cb),
    startGame: (opts) => net.startGame(opts),
    startWindow: () => net.startWindow(),       // RUMS-FLÖDE: spelar-STARTA → 15 s join-fönster
    enterTutorial: () => net.enterTutorial(),   // RUMS-FLÖDE: markera tutorial-fasen för late-join
    get phase() { return net.phase; },
    pause: () => net.pause(),
    selectCard: t => net.selectCard(t),
    trade: (to, give, gc, get, gc2) => net.trade(to, give, gc, get, gc2),
    openProposal: t => net.openProposal(t),
    politicsSkip: () => net.politicsSkip(),
    vote: y => net.vote(y),
    klar: () => net.klar(),
    awardsKlara: () => net.awardsKlara(),
    eventDismiss: () => net.eventDismiss(),
    playAgain: () => net.startGame(),
    playTrailer: () => net.playTrailer(),
    skipTrailer: () => net.skipTrailer(),
    claim: lag => net.claim(lag),
    tradeAnswer: (id, a) => net.tradeAnswer(id, a),
    podiumAnswer: (q, o) => net.podiumAnswer(q, o),   // slutdelen
    _first: first,
  };
}

// Proxy-fasad: UI:t pratar alltid med `game`; bakom den kan backend bytas
// (riktiga spelet ↔ tutorialens skriptade övningsmotor) utan att UI:t märker det.
function makeProxy() {
  const em = makeEmitter();
  let cur = null;
  const seen = new Set();
  const FWD = ['start', 'roundStart', 'build', 'trade', 'proposalOpened', 'proposalResolved',
               'dilemmaOpened', 'dilemmaResolved',
               'income', 'ohalsa', 'award', 'awardCeremony', 'awardStep', 'awardDone',
               'event', 'eventClosed', 'reloadClients', 'companyEvent', 'crisis', 'roundReplay', 'roundEnd', 'gameEnd', 'timer', 'resolveStart',
               'lobby', 'klarUpdate', 'claimAck', 'voteUpdate', 'tradeIncoming', 'notis',
               'botTakeover', 'disconnected', 'reconnected', 'paused',
               'politicsStart', 'politicsDone', 'politicsTimer',
               'trailer', 'trailerDone',
               'startWindow', 'startGo', 'startWindowCancel', 'tilllobby',
               'slutdelStart', 'slutdelQuestion', 'slutdelReveal', 'slutdelDist', 'slutdelDone', 'kroning', 'finalOrad'];
  return {
    attach(b) {
      cur = b;
      if (!seen.has(b)) { seen.add(b); FWD.forEach(ev => b.on(ev, p => { if (cur === b) em.emit(ev, p); })); }
    },
    on: em.on,
    get backend() { return cur; },
    get online() { return cur.online; },
    get me() { return cur.me; },
    get _first() { return cur._first; },
    E: () => cur.E(),
    startGame: (...a) => cur.startGame(...a),
    startWindow: (...a) => cur.startWindow?.(...a),
    enterTutorial: (...a) => cur.enterTutorial?.(...a),
    get phase() { return cur.phase; },
    selectCard: (...a) => cur.selectCard(...a),
    trade: (...a) => cur.trade(...a),
    openProposal: (...a) => cur.openProposal(...a),
    politicsSkip: (...a) => cur.politicsSkip?.(...a),
    vote: (...a) => cur.vote(...a),
    klar: (...a) => cur.klar(...a),
    awardsKlara: (...a) => cur.awardsKlara?.(...a),
    eventDismiss: (...a) => cur.eventDismiss?.(...a),
    pause: (...a) => cur.pause?.(...a),
    playAgain: (...a) => cur.playAgain(...a),
    playTrailer: (...a) => cur.playTrailer?.(...a),
    skipTrailer: (...a) => cur.skipTrailer?.(...a),
    claim: (...a) => cur.claim?.(...a),
    tradeAnswer: (...a) => cur.tradeAnswer?.(...a),
    podiumAnswer: (...a) => cur.podiumAnswer?.(...a),   // slutdelen
    _emit: (ev, p) => em.emit(ev, p),   // test-krok: injicera events lokalt (slutdeltest)
  };
}

// Om servern inte svarar inom 5 s: visa "Ingen kontakt" i stället för att fastna tyst här.
// (await makeOnline() nedan resolvar först vid hello-ack; utan detta får btn-attract aldrig
//  sin klick-hanterare → "STARTA SPELET" blir en död knapp utan felmeddelande.)
let _noContact = null;
if (ONLINE) {
  const host = document.getElementById('nocontact-host');
  if (host) host.textContent = location.host;
  _noContact = setTimeout(() => document.getElementById('ov-nocontact')?.classList.add('open'), 5000);
}
const realGame = ONLINE ? await makeOnline() : makeLocal();
if (_noContact) clearTimeout(_noContact);
document.getElementById('ov-nocontact')?.classList.remove('open');
const game = makeProxy();
game.attach(realGame);
const E = game.E;

// ═══════════════ Karta + skala ═══════════════
const map = renderMap($('map'), { slots, mode: 'neutralt' });
map.showSlots(false);

// Egna fasett-ikoner i det statiska chromet (ersätter generiska emoji).
function initIcons() {
  const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
  set('#box-pengar .ic', ico('pengar', 48));
  set('#box-material .ic', ico('material', 48));
  set('#logg-h', `${ico('bok', 26)} HÄNDELSER PÅ ÖN`);
  set('#btn-trade', `${ico('byt', 30)} BYT VALUTOR`);
  set('#btn-prop', `${ico('rosta', 22)} POLITIK`);
  set('#toplist-h', `${ico('borsen', 18)} TOPPLISTA`);
  set('#ov-start h1', `${ico('on', 46)} MAKTSPELET`);
  set('#ov-trade h2', `${ico('byt', 40)} BYT VALUTOR`);
  set('#ov-choose h2', `${ico('rosta', 24)} LÄGG ETT FÖRSLAG`);
  set('#ov-vote h2', `${ico('rosta', 24)} OMRÖSTNING`);
  set('#btn-trade-go', `${ico('ja', 40)} FÖRESLÅ BYTET`);
  set('#btn-trade-cancel', `${ico('nej', 40)} AVBRYT`);
  set('#btn-trade-cancel2', `${ico('nej', 30)} AVBRYT`);
  set('#btn-tradein-ja', `${ico('ja', 46)} ACCEPTERA`);
  set('#btn-tradein-nej', `${ico('nej', 46)} NEJ TACK`);
  set('#tin-mid', ico('byt', 60));
}
initIcons();
function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('stage').style.transform = `scale(${s})`;
  // Extra yta (i stage-px) som skärmen har utöver 16:9-rutan → kontrollrums-bakgrunden/prisbilderna får bleeda ut hit
  // (negativ inset i CSS) och fylla HELA skärmen utan svarta kanter, oavsett skärmformat.
  const st = $('stage').style;
  st.setProperty('--ex', Math.max(0, (innerWidth / s - 1920) / 2) + 'px');
  st.setProperty('--ey', Math.max(0, (innerHeight / s - 1080) / 2) + 'px');
}
addEventListener('resize', fit); fit();

// ═══════════════ Vy-tillstånd + seriell event-kö ═══════════════
let resolving = false;
let picked = null;
let expanded = null;
// Flera byggen/runda? Styrs av variantens byggtak (cfg.maxBuildsPerYear), INTE av spelledarläge:
//   • Flash (tak = 1) → ALDRIG flera (handen låses efter ett bygge → tydligt "klar med årets bygge").
//   • Mellan/Skola (tak = null = obegränsat) → ALLTID flera, även i självspel (fri byggning exponerad).
//   • (Ett eventuellt tak > 1 → flera tillåts; motorn nekar auktoritativt när taket nås.)
// Motorns selectCard är alltid den auktoritativa gränsen oavsett UI.
const flerByggen = () => { const cap = E()?.cfg?.maxBuildsPerYear; return cap == null || cap > 1; };
let voteOpenFor = null;
// 3 s klick-lås på röst-knapparna när en omröstning/dilemma dyker upp (undviker ström-klick som röstar).
let voteLockUntil = 0;
function armVoteLock() {
  voteLockUntil = Date.now() + 3000;
  const b = $('vote-btns'); if (b) { b.classList.add('clicklock'); setTimeout(() => b.classList.remove('clicklock'), 3000); }
}
let klarLag = new Set();   // lag som tryckt AVSLUTA denna runda (online)
const queue = [];
let running = false;
// RUMS-FLÖDE: delat vy-tillstånd (deklareras tidigt → late-join-routern vid boot kan läsa dem).
let startWindowLeft = null;   // 15 s start-fönster: sekunder kvar (null = inget fönster öppet)
let tutRunning = false;       // solo-tutorialen kör (gard mot dubbelstart vid late-join/claim)
let tutAbort = false;         // omstart mitt i tutorialen → avbryt den rent
let tutInCeremony = false;    // tutorialen är i slut-ceremonin (redo→nedräkning) — konvergerar själv mot spelet
let tutOnlyProp = null;       // tutorial: begränsa LÄGG FÖRSLAG-väljaren till EN förslagstyp (ingen förvirrande valmeny)
let vantarLag = false;        // väntläge efter tutorial: visar "X/Y lag klara" tills den gemensamma nedräkningen börjar
let lastTutReady = null;      // senaste tutReadyUpdate {klara, humans} från servern
const _tutAborters = [];      // väntare som väcks när tutorialen ska avbrytas
let tutFick = 0;              // tutorial: belopp spelaren FICK i sitt senaste byte (→ "Du fick +N" i övningen)
let tutOhShown = null;        // tutorial: öhälso-värdet som konsekvens-rutan redan animerat baren till (så bokslutet inte dubbel-animerar)
let tutOhReset = false;       // tutorial: har öhälsobaren återställts till full bakom prisceremonin (en gång) inför riktiga spelet
// Obemannad skärm i tutorialen: mäts PÅ skärmen (ingen beröring alls på 90 s) eftersom servern knappt får
// meddelanden under tutorialen. Når gränsen → berätta för servern, som gör laget till bot så gruppens
// nedräkning inte blockeras. Bara i drift (ONLINE); solo/lokalt behöver det inte.
const TUT_IDLE_MS = 90000;
let tutIdleTimer = null, tutLastTouch = 0, tutIdleSent = false;
function tutTouch() {
  tutLastTouch = Date.now();
  if (tutIdleSent) {                      // en bot hade tagit över (idle) → människan är tillbaka
    tutIdleSent = false;
    $('ov-bot').classList.remove('open');
    if (game.me) realGame.net?.claim?.(game.me);   // återta laget på servern (av-botta) så det inte är bot när spelet startar
  }
}
function startTutIdleWatch() {
  if (!ONLINE) return;
  stopTutIdleWatch();
  tutLastTouch = Date.now(); tutIdleSent = false;
  document.addEventListener('pointerdown', tutTouch, true);
  tutIdleTimer = setInterval(() => {
    if (!tutRunning || tutAbort) { stopTutIdleWatch(); return; }
    if (!tutIdleSent && Date.now() - tutLastTouch > TUT_IDLE_MS) {
      tutIdleSent = true;
      realGame.net.tutIdle?.();           // → servern: laget blir bot (kan återtas via TA TILLBAKA)
      // Visa "en bot tog över"-rutan ÄVEN under tutorialen. (Proxyn forwardar inte serverns
      // botTakeover medan tutorial-backenden är aktiv, så skärmen öppnar den själv här.)
      audio.play('ui_notis');
      $('ov-bot').classList.add('open');
    }
  }, 5000);
}
function stopTutIdleWatch() {
  if (tutIdleTimer) { clearInterval(tutIdleTimer); tutIdleTimer = null; }
  document.removeEventListener('pointerdown', tutTouch, true);
}
function run(step) {
  queue.push(step);
  if (running) return;
  running = true;
  (async () => {
    while (queue.length) { try { await queue.shift()(); } catch (e) { console.error(e); } }
    running = false;
  })();
}

// ═══════════════ Motorns events → scenerna ═══════════════
game.on('resolveStart', () => run(async () => {
  resolving = true;
  $('endwrap').classList.remove('pulse');
  $('cards').parentElement.classList.add('hand-locked');
  setEndBtn('ÖRÅD…', true);
  // Bokslutet (byggen/byten/öhälsa) avslöjas först. ÖRÅD-popupen visas EFTER det, precis före priserna (awardCeremony).
}));

// ═══════════ Händelselogg — permanent skrollbar historik i högerkolumnen (ersätter POLITIK-knappen) ═══════════
// Allt som förr bara poppade upp (byggen, byten, politik, händelser, kris) läggs här kvar så man kan skrolla.
let _loggRunda = 0;
function loggClear() { const l = $('logg'); if (l) l.innerHTML = ''; _loggRunda = 0; }
function loggRunda(n) {
  const l = $('logg'); if (!l || !n || n === _loggRunda) return;
  _loggRunda = n;
  const sep = document.createElement('div'); sep.className = 'loggsep'; sep.textContent = `ÅR ${n}`;
  l.appendChild(sep); l.scrollTop = l.scrollHeight;
}
function loggLag(id) { const f = AREAS.find(a => a.id === id)?.farg || 'var(--text)'; return `<span class="lg-lag" style="color:${f}">${teamName(id)}</span>`; }
function logg(html, cls = '') {
  const l = $('logg'); if (!l) return;
  const naraBotten = l.scrollHeight - l.scrollTop - l.clientHeight < 48;   // följ med bara om man redan står längst ner
  const row = document.createElement('div'); row.className = 'loggrad' + (cls ? ' ' + cls : ''); row.innerHTML = html;
  l.appendChild(row);
  if (naraBotten) l.scrollTop = l.scrollHeight;
}

game.on('build', p => run(async () => {
  const b = manifest.buildings[p.card.asset];
  map.placeBuilding(p.area, p.slotIndex, b.file, 135, { namn: p.card.namn, oh: p.card.oh, lagNamn: teamName(p.teamId) });
  audio.play(`build_${p.card.tier}`);
  if (p.teamId === game.me && p.cost) {                        // kostnaden syns som röd minussiffra på pengar/material (Klara 2026-11-25)
    if (p.cost.pengar) flashRes('pengar', -p.cost.pengar);
    if (p.cost.material) flashRes('material', -p.cost.material);
  }
  if (p.teamId !== game.me) toast(`${teamName(p.teamId)} byggde ${p.card.namn} <span class="${p.card.oh > 0 ? 'ohplus' : 'ohminus'}">${fmtOh(p.card.oh)}</span>`);
  { const oh = p.card.oh; logg(`${logoSVG(p.teamId, 26)}<span class="ri">${ico('bygge', 20)}</span><span class="rt">${p.card.namn}</span><span class="ro"><b class="${oh >= 0 ? 'pos' : 'neg'}">${oh >= 0 ? '+' : '−'}${Math.abs(oh)}</b>${ico(oh >= 0 ? 'tillvaxt' : 'industri', 20)}</span>`, 'lr'); }
  renderMe(); renderTeams();
  flashCoachOnBuild(p);                                          // Flash-coach: eget bygge → konsekvens → BYT
  if (resolving) await delay(650);
}));

game.on('trade', p => run(async () => {
  audio.play('trade');
  if (p.from === game.me) tutFick = p.get; else if (p.to === game.me) tutFick = p.give;   // tutorial: vad DU fick

  if (p.from !== game.me && p.to !== game.me) {
    toast(`${teamName(p.from)} bytte ${p.give} ${CUR_ICON[p.giveCur]} mot ${p.get} ${CUR_ICON[p.getCur]} med ${teamName(p.to)}`);
  }
  // Loggen: lagloggor + färgade siffror + valutaikoner (inga ord). Från-lagets gives vänster, tar emot höger.
  logg(`${logoSVG(p.from, 26)}<b style="color:${curCol(p.giveCur)}">−${p.give}</b>${ico(p.giveCur, 20)}<span>${ico('byt', 20)}</span><b style="color:${curCol(p.getCur)}">+${p.get}</b>${ico(p.getCur, 20)}${logoSVG(p.to, 26)}`, 'lr lg-byte');
  renderMe(); renderTeams();
  if (resolving) await delay(350);
}));

game.on('income', p => run(async () => {
  if (p.teamId === game.me) {
    if (p.pengar) flashRes('pengar', p.pengar);
    if (p.material) flashRes('material', p.material);
  }
  renderMe(); renderTeams();
  if (resolving) await delay(250);
}));

game.on('ohalsa', p => run(async () => {
  // TUTORIAL-ONLY: konsekvens-rutan har redan sänkt baren till detta värde → bokslutet ska inte animera om det.
  if (tutRunning && tutOhShown != null && p.value === tutOhShown) { tutOhShown = null; return; }
  updateOh(p);
  if (resolving) await delay(1300);
}));

// Konsekvens-chips under event-bilden: vilka lag drabbas och hur + öns hälsa.
// Konsekvenser i händelse-popupen: lag (logga + namn + ±siffra + symbol) + ÖNS HÄLSA som egen ruta med ö-ikonen.
// rader: [{ teamId, delar: [{ v, sym }] }], oh: { v } | null.  (Samma markup för alla händelsekällor.)
function eventKonsMarkup(rader, oh) {
  const sg = v => v > 0 ? '+' : '−';
  const del = d => `<span class="${d.v > 0 ? 'plus' : 'minus'}"><span class="cv">${sg(d.v)}${Math.abs(d.v)}</span><span class="sy">${ico(d.sym, 52)}</span></span>`;
  const teams = rader.filter(r => r.teamId && r.delar.length)
    .map(r => `<div class="ek-chip">${logoSVG(r.teamId, 64)}<span class="cn">${teamName(r.teamId)}</span>${r.delar.map(del).join('')}</div>`).join('');
  const ohb = oh && oh.v
    ? `<div class="ek-oh"><span class="isl">${ico('on', 84)}</span><div><div class="ohl">ÖNS HÄLSA</div><div class="ohv ${oh.v > 0 ? 'plus' : 'minus'}"><span class="cv">${sg(oh.v)}${Math.abs(oh.v)}</span><span class="sy">${ico(oh.v > 0 ? 'tillvaxt' : 'industri', 64)}</span></div></div></div>` : '';
  return (teams ? `<div class="ek-teams">${teams}</div>` : '') + ohb;
}
function eventKonsHTML(p) {
  const rader = (p.effekter || []).map(e => {
    const delar = [];
    if (e.egen)     delar.push({ v: e.egen, sym: e.sektor === 'pengar' ? 'pengar' : 'material' });
    if (e.pengar)   delar.push({ v: e.pengar, sym: 'pengar' });
    if (e.material) delar.push({ v: e.material, sym: 'material' });
    return { teamId: e.teamId, delar };
  });
  return eventKonsMarkup(rader, p.oh ? { v: p.oh } : null);
}

// Händelse (EVENT-systemet). Ljudet spelas centralt (rigg); skärmen visar bild + rubrik + text + konsekvenser.
game.on('event', p => run(async () => {
  const warn = p.id !== 'godskord' && p.id !== 'gronafonden' && p.id !== 'pengaslapp';
  renderMe(); renderTeams(); renderRegs();
  if (p.bild) {
    const evImg = $('event-img');
    evImg.onerror = () => { evImg.onerror = null; evImg.src = warn ? 'assets/event_storm.png' : 'assets/event_naturenblomstrar.png'; };
    evImg.src = p.bild;
    $('event-rubrik').textContent = p.rubrik || '';
    $('event-text').textContent = p.text || '';
    $('event-kons').innerHTML = eventKonsHTML(p);
    $('ov-event').classList.toggle('warn', warn);
    $('ov-event').classList.add('open');
    await delay(500);                               // hinner läsas innan tryck registreras
    await clickOrTimeout($("ov-event"), resolving ? 6000 : 30000, 3000);   // 3 s klick-lås: hinner uppfattas innan den kan klickas bort
    $('ov-event').classList.remove('open');
    await delay(200);
  } else {                                          // t.ex. pengasläpp (ingen bild) → banner + toast
    await banner(`${warn ? ico('varning', 40) : ico('happening', 40)} ${(p.rubrik || '').toUpperCase()}`, warn, 1900);
    if (p.text) toast(`${warn ? ico('varning', 16) : ico('happening', 16)} ${p.text}`, warn);
    if (resolving) await delay(600);
  }
}));

// KRIS (design/VINST-FORLUST-FORSLAG.md Alt B + design/ui-mockup/kris-mockup.html):
//   on:true  → fyll #ov-event med kris-innehållet (röd .warn-ram) + visa kortet + tänd .krisglow.
//              Kortet stängs som andra event (tryck/timeout) MEN glöden ligger kvar tills on:false.
//   on:false → släck .krisglow (krisen löst).
game.on('crisis', p => run(async () => {
  if (p.on) {
    $('krisglow').classList.add('on');
    renderMe(); renderTeams(); renderRegs();
    const reset = E().cfg.krisReset ?? 35;
    $('event-img').src = 'assets/kris.png';
    $('event-rubrik').textContent = 'Ön står inför kollaps';
    $('event-text').textContent = 'Centralmakten meddelar kyligt: öns hälsa är kritisk. Rädda den innan året är slut — annars faller allt, och ni får börja om. Lösningen är er.';
    $('event-kons').innerHTML =
      `<div class="kons oh">${ico('mal', 16)} Få öns hälsa <b>över ${reset}</b></div>` +
      `<div class="kons"><span class="minus">⏳ 1 år — annars förlorar <b>alla</b></span></div>`;
    $('ov-event').classList.add('warn');
    $('ov-event').classList.add('open');
    await delay(500);                               // hinner läsas innan tryck registreras
    await clickOrTimeout($("ov-event"), resolving ? 14000 : 30000, 5000);   // 5 s klick-lås, 14 s auto (Klara 2026-11-25: hinn läsa Centralmakten-texten)
    $('ov-event').classList.remove('open');
    await delay(200);
    // .krisglow ligger KVAR — släcks först vid crisis{on:false}
  } else {
    $('krisglow').classList.remove('on');
    toast(`${ico('ja', 16)} Krisen avvärjd — ön andas ut`);
  }
}));

// Företagshändelse (companyEvent): miljökriser (warn) + prestationshändelser (belöning). Visas i
// Händelse-popupen ligger kvar UPP TILL 15 s, men ett klick (efter 800 ms) stänger den — och via
// eventDismiss→servern→eventClosed stängs ALLA skärmar samtidigt + spelet resumas. 15,5 s failsafe.
let _evCloseResolve = null, _evFailsafe = null;
game.on('eventClosed', () => { if (_evCloseResolve) _evCloseResolve(); });
// Spelledaren tryckte "ladda om alla skärmar" (t.ex. efter variant-byte) → hård omladdning.
game.on('reloadClients', () => { try { location.reload(); } catch {} });
function waitEventClose(el) {
  return new Promise(res => {
    let locked = true;
    el.classList.add('clicklock');
    const lockT = setTimeout(() => { locked = false; el.classList.remove('clicklock'); }, 800);
    const finish = () => { clearTimeout(lockT); clearTimeout(_evFailsafe); el.removeEventListener('pointerdown', onDown); _evCloseResolve = null; res(); };
    const onDown = () => { if (!locked) { game.eventDismiss?.(); finish(); } };   // klick → be servern lösa + stäng
    el.addEventListener('pointerdown', onDown);
    _evCloseResolve = finish;                 // 'eventClosed' från servern (annan skärm klickade / 15 s) → stäng
    _evFailsafe = setTimeout(finish, 15500);
  });
}
// #ov-event (samma kort som vanliga händelser). warn styr röd/neutral ram.
game.on('companyEvent', p => run(async () => {
  renderMe(); renderTeams(); renderRegs();
  // Bild per händelse-id (assets/event_<id>.png). Saknas den → generisk storm/gronafonden.
  const evFallback = p.warn ? 'assets/event_storm.png' : 'assets/event_naturenblomstrar.png';
  const evImg = $('event-img');
  evImg.onerror = () => { evImg.onerror = null; evImg.src = evFallback; };
  evImg.src = p.id ? `assets/event_${p.id}.png` : evFallback;
  $('event-rubrik').textContent = p.namn || '';
  $('event-text').textContent = p.text || '';
  // teams tom (t.ex. RESURSBRIST som verkar via produktionsminskning) → inga resurs-rader, bara text.
  const rader = (Array.isArray(p.teams) ? p.teams
    : [{ teamId: p.teamId, dPengar: p.dPengar, dMaterial: p.dMaterial }])
    .map(r => ({ teamId: r.teamId, delar: [r.dPengar && { v: r.dPengar, sym: 'pengar' }, r.dMaterial && { v: r.dMaterial, sym: 'material' }].filter(Boolean) }));
  $('event-kons').innerHTML = eventKonsMarkup(rader, p.ohalsa ? { v: p.ohalsa } : null);
  $('ov-event').classList.toggle('warn', !!p.warn);
  $('ov-event').classList.add('open');
  await delay(300);
  await waitEventClose($('ov-event'));   // upp till 15 s / klick / eventClosed (synkat över alla skärmar)
  $('ov-event').classList.remove('open', 'clicklock');
  await delay(150);
}));

// Award-popup: tryck går vidare; auto-fortsätter efter 8 s så självspelande läge aldrig fastnar.
// Paus fryser auto-nedräkningen (uiPaused) → skärmens prisutdelning håller i takt med riggen.
let uiPaused = false;
// lockMs: inledande period då klick IGNORERAS (spelaren hinner uppfatta att en händelse dykt upp
// innan den kan klickas bort — undviker att ett pågående klick i t.ex. bytesfönstret stänger den).
// ignorePause=true → nedräkningen fryser INTE av uiPaused (används för händelserutan, vars egen korta
// visningstid ska löpa i väggklockstid i takt med serverns korta händelse-frys, inte stanna av pausen).
function clickOrTimeout(el, ms, lockMs = 0, ignorePause = false) {
  return new Promise(res => {
    let remaining = ms;
    let locked = lockMs > 0;
    const step = 100;
    let t = setTimeout(tick, step);
    const lockT = locked ? setTimeout(() => { locked = false; el.classList.remove('clicklock'); }, lockMs) : null;
    if (locked) el.classList.add('clicklock');
    function tick() {
      if (ignorePause || !uiPaused) remaining -= step;
      if (remaining <= 0) done(); else t = setTimeout(tick, step);
    }
    function onDown() { if (!locked) done(); }
    function done() { clearTimeout(t); clearTimeout(lockT); el.classList.remove('clicklock'); el.removeEventListener('pointerdown', onDown); res(); }
    el.addEventListener('pointerdown', onDown);
  });
}

// Pris-typ → kort-innehåll (samma för selfplay-popupen och GM-stegningen). Ljud spelas centralt (rigg/hjärna).
const awardMeta = (typ, w) => ({
  led: { em: ico('trofe', 58),   rubrik: 'Årets ledande företag', icon: 'trofe',    sym: null,       plus: true,  cls: 'ohplus' },   // totalt kapital (pengar + material): INGEN symbol, bara siffran (Klara 2026-11-23)
  eld: { em: ico('tillvaxt', 58), rubrik: 'Årets eldsjäl',         icon: 'tillvaxt', sym: 'tillvaxt', plus: true,  cls: 'ohplus' },
  sab: { em: ico('sabotor', 58), rubrik: 'Årets sabotör',          icon: 'sabotor',  sym: 'industri', plus: false, cls: 'ohminus' },
}[typ]);
// Lag-agnostiska prisbilder (kontrollrummets skärmar) — samma bild oavsett vinnarlag.
const AWARD_BILD = {
  led: 'assets/kontrollrum_guld.jpg',
  eld: 'assets/kontrollrum_gron.jpg',
  sab: 'assets/kontrollrum_rod.jpg',
};
// Kontrollrummet (#room-bg) ligger kvar bakom hela örådet: tänds direkt när prisutdelning/"har ordet"/förslag/
// omröstning öppnas, släcks först RUM_HALL ms efter att den sista stängts → ingen blink av spelplanen mellan dem.
const RUM_HALL = 2500;
let rumT = null;
let oradAktivt = false;   // true från att örådet börjar (har ordet / dilemma) tills politicsDone → kontrollrummet får inte försvinna mitt i örådet
// Örådet helt klart (politicsDone) → riv kontrollrummet DIREKT (snabb tonad ut) så spelaren landar på ön och ser "ÅR N".
function rivRummet(mjukt = false) {
  const el = $('room-bg'); if (!el) return;
  clearTimeout(rumT); rumT = null;
  if (!mjukt) el.classList.add('snabb');   // mjukt (politik → ö-vyn): standardtonen 0,6 s i stället för snabb 0,25 s
  el.classList.remove('on');
  setTimeout(() => el.classList.remove('snabb'), 700);
}
if (typeof MutationObserver !== 'undefined' && $('room-bg')) {
  const ids = ['ov-award', 'ov-power', 'ov-choose', 'ov-vote', 'ov-dilemma', 'ov-result', 'ov-year'];
  const syncRum = () => {
    if (ids.some(i => $(i)?.classList.contains('open'))) { clearTimeout(rumT); rumT = null; $('room-bg').classList.add('on'); }
    else if (!rumT) rumT = setTimeout(() => { rumT = null; if (!oradAktivt && !ids.some(i => $(i)?.classList.contains('open'))) $('room-bg').classList.remove('on'); }, RUM_HALL);   // under pågående öråd ligger rummet KVAR tills politicsDone (så ÅR-banderollen visas där, i Mellan som i Flash)
  };
  const mo = new MutationObserver(syncRum);
  ids.forEach(i => $(i) && mo.observe($(i), { attributes: true, attributeFilter: ['class'] }));
}
let sistaPrisBild = '';   // sista prisbilden när ceremonin stängdes (startbild för "X har ordet")
let prevAwardBild = '';   // senast visade prisbild under pågående ceremoni (nollas när prisutdelningen stängs)
// Förladda + DEKODA alla stora rumsbilder vid start och håll referenserna (annars kan första bilden dekodas under tonade övergången → ingen synlig tonad inkomst).
const _rumsBilder = [];
if (typeof Image !== 'undefined') [...Object.values(AWARD_BILD), 'assets/kontrollrum_neutral.jpg', 'assets/kontrollrum_krona.jpg', 'assets/vagg_mork.jpg', 'assets/vagg_aker.jpg', 'assets/vagg_skog.jpg', 'assets/vagg_tundra.jpg', 'assets/vagg_stad.jpg'].forEach(src => { const im = new Image(); im.src = src; im.decode?.().catch(() => {}); _rumsBilder.push(im); });
// ÖRÅD-banderollen (mitt på skärmen) tonas mjukt ut INNAN första priset ritas → ingen hård byte (Klara 2026-11-23).
async function tonaUtOrad() {
  const b = $('awardcard')?.querySelector('.aw-ban.mid');
  if (!b) return;
  b.classList.add('out');
  await delay(450);
}
function renderAwardCard(typ, w, footer = '') {
  const m = awardMeta(typ, w);
  // PRISUTDELNING (P3, Klara 2026-11-23): prisbilden fyller HELA skärmen + en centrerad grå popup med
  // text/ikoner (ingen liten prisbild-popup). Bilden byts per pris → "rummet byter färg". 'prize'
  // gör kortet fullskärm. Ingen bov → ingen bild (mörk skärm + popup).
  $('awardcard').className = 'awardcard prize' + (typ === 'sab' ? ' sab' : typ === 'eld' ? ' eld' : '') + (w ? '' : ' ingen');
  const bild = w ? (AWARD_BILD[typ] || '') : '';
  // Föregående prisbild ligger kvar under och den nya tonas in över den → ingen svart blink mellan priserna.
  const prev = bild && prevAwardBild && prevAwardBild !== bild ? prevAwardBild : '';   // 'ingen vinnare' → neutrala rummet, inte förra färgen
  prevAwardBild = bild;
  $('awardcard').innerHTML =
    (prev ? `<img class="aw-img" src="${prev}" alt="">` : '') +
    (bild ? `<img class="aw-img aw-new" src="${bild}" alt="" onerror="this.style.display='none'">` : '') +
    `<div class="aw-scrim"></div>` +
    (w ? `<div class="aw-ban" style="--acc:${typ === 'sab' ? 'var(--led-red)' : typ === 'eld' ? 'var(--led-green)' : 'var(--gold)'}">`
        + `<div class="bar"></div>`
        + `<div class="lg"><span class="halo"></span>${logoSVG(w.teamId, 200)}</div>`
        + `<div class="info"><div class="tt"><span class="ic">${ico(m.icon, 48)}</span><span class="t">${m.rubrik}</span></div><div class="nm">${w.namn}</div></div>`
        + `<div class="vl"><span class="sign">${m.plus ? '+' : '−'}</span><span class="num" data-n="${Math.abs(w.varde)}" style="min-width:${String(Math.abs(w.varde)).length}ch">0</span>${m.sym ? `<span class="sy">${ico(m.sym, 124)}</span>` : ''}</div>`
        + `</div>` + (footer ? `<div class="aw-foot">${footer}</div>` : '')
     : (typ === 'sab'
        ? `<div class="aw-ban" style="--acc:var(--led-green)"><div class="bar"></div>`
          + `<div class="lg dimmed">${ico('sabotor', 120)}<span class="slash"></span></div>`
          + `<div class="info"><div class="tt"><span class="ic">${ico(m.icon, 48)}</span><span class="t">${m.rubrik}</span></div><div class="nm">INGEN BOV</div></div>`
          + `<div class="vl okmark">${ico('ja', 112)}</div></div>` + (footer ? `<div class="aw-foot">${footer}</div>` : '')
        : ''));   // ingen eldsjäl → inget visas alls (priset hoppas över)
  // Siffran räknar upp efter att banderollen glidit in (matchar animationen i CSS).
  const num = $('awardcard').querySelector('.aw-ban .num');
  if (num && typeof requestAnimationFrame !== 'undefined') {
    const to = +num.dataset.n, t0 = performance.now() + 850;
    const tick = t => { if (!num.isConnected) return; const x = Math.max(0, Math.min(1, (t - t0) / 700)); num.textContent = Math.round(to * (1 - Math.pow(1 - x, 3))); if (x < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  } else if (num) num.textContent = num.dataset.n;
}

// Slutskärmen (win/lose) ska visas FÖRST när prisceremonin för sista rundan spelats klart.
// Online driver servern ceremonin (awardCeremony→awardStep→awardDone{over}); gameEnd kan komma FÖRE
// awardCeremony i auto-läge, så vi väntar alltid in awardDone(over) online. Lokalt (mock) stegar
// 'award' själv via den seriella kön före gameEnd → då visas slut direkt.
let pendingSlut = null, slutFailsafe = null;
let cerNastaRunda = null;   // online: "RUNDA N"-bannern hålls tills prisceremonin är klar (awardDone) så den syns NÄR nya rundan börjar
let roundPowerTeam = null;  // MAKT-ROTATION: vilket lag som styr politiken denna runda (ur roundStart-payloaden)

// MAKT-ROTATION: visa vilket lag som styr politiken denna runda. Klick-genom, auto-fortsätt efter 15 s
// (självspel fastnar aldrig). Egen text på maktlagets skärm vs de andra. Ingen banner om powerTeam saknas (t.ex. runda 1).
function showPowerBanner(powerTeam) {
  return Promise.resolve();   // POLITIK avstängd tills vidare → visa aldrig "vem styr politiken"-rutan
  // eslint-disable-next-line no-unreachable
  if (!powerTeam) return Promise.resolve();
  const namn = teamName(powerTeam);
  const farg = AREAS.find(x => x.id === powerTeam)?.farg || 'var(--gold)';   // lagets egen färg → tydligt VILKET lag som styr
  $('power-img').src = `assets/makt/${powerTeam}.png`;          // en scen-bild per lag (assets/makt/)
  if (game.me === powerTeam) {
    $('power-rubrik').innerHTML = 'NI HAR DEN POLITISKA MAKTEN!';
    $('power-tx').innerHTML = 'Välj vilket förslag ön ska rösta om det här året.<br>Lyssna på de andra företagen — eller driv er egen agenda!';
  } else {
    $('power-rubrik').innerHTML = `<span style="color:${farg}">${namn.toUpperCase()}</span> STYR POLITIKEN!`;
    $('power-tx').innerHTML = `Det här året lägger <b style="color:${farg}">${namn}</b> fram ett politiskt förslag.<br>Vill ni påverka? <b style="color:${farg}">Ring ${namn}</b> och övertyga dem!`;
  }
  $('ov-power').classList.add('open');
  audio.play('ui_open');
  return new Promise(res => {
    let done = false;
    const finish = () => { if (done) return; done = true; $('ov-power').onclick = null; clearTimeout(tmo); $('ov-power').classList.remove('open'); res(); };
    $('ov-power').onclick = finish;
    const tmo = setTimeout(finish, 15000);   // auto-fortsätt efter 15 s så man hinner läsa
  });
}
function showPendingSlut() {
  clearTimeout(slutFailsafe); slutFailsafe = null;
  if (!pendingSlut) return;
  const s = pendingSlut; pendingSlut = null; showSlut(s);
}

// SELFPLAY: skärmen stegar själv genom priserna på timer (5 s per pris).
game.on('award', p => run(async () => {
  const show = async (typ, w, sista) => {
    await tonaUtOrad();
    renderAwardCard(typ, w);                // ingen "tryck för att fortsätta": priset går alltid på timer (spelledarläge: styrs av spelledaren via awardStep)
    $('ov-award').classList.add('open');
    // TUTORIAL-ONLY: övningsåret nollas inför riktiga spelet. Återställ öhälsobaren till full NU —
    // bakom prisceremonins overlay — så man aldrig ser den "läka upp" (Klara 2026-11-27).
    if (tutRunning && !tutOhReset) {
      tutOhReset = true; const oh0 = E()?.cfg?.ohStart ?? 50;
      updateOh({ value: oh0, mode: ohMode(oh0), delta: 0 });
    }
    await delay(5000);                      // samma takt som online (awardStep): varje pris hålls kvar 5 s
    if (!sista) return;                     // overlayn hålls ÖPPEN mellan priserna → ingen släckt skärm
    $('ov-award').classList.remove('open');
    prevAwardBild = '';
    await delay(250);
  };
  if (p.led) await show('led', p.led, false);
  if (p.eld) await show('eld', p.eld, false);
  await show('sab', p.sab, true);
  game.awardsKlara?.();   // prisutdelningen genomklickad → rundtimern får börja ticka
  renderPropBtn();        // rundan återupptas → POLITIK tryckbar igen
  renderRegs();
}));

// Prisutdelningen börjar: byggena är redan avslöjade → NU släcks skärmen ner (mörk overlay) och
// stor ÖRÅD-skylt visas, sedan direkt första priset (awardStep ersätter innehållet på samma mörka
// skärm). Servern väntar in skylten (2 s) innan första awardStep så första priset får full tid.
game.on('awardCeremony', () => run(async () => {
  prevAwardBild = '';
  // ÖRÅD: banderoll i prisernas stil, MITT på skärmen (Klara 2026-11-23). Rådsikon + RÅDET SAMLAS + ÖRÅD + årets nummer.
  $('awardcard').className = 'awardcard prize ingen';
  const yr = parseInt($('roundnum')?.textContent, 10);
  $('awardcard').innerHTML =
    `<div class="aw-ban mid" style="--acc:var(--gold)"><div class="bar"></div>`
    + `<div class="lg"><span class="halo"></span>${ico('orad', 150)}</div>`
    + `<div class="info row"><div class="nm">ÖRÅD</div><div class="sub">– RÅDET SAMLAS</div></div>`
    + (yr ? `<div class="vl"><span class="lab">ÅR</span><span class="num2">${yr}</span></div>` : '')
    + `</div>`;
  $('ov-award').classList.add('open');   // .overlay-bakgrunden släcker ner skärmen → kvar tänd genom hela prisutdelningen.
  // SELFPLAY: håll ÖRÅD-skylten kvar KLIENTSTYRT. Serverns paus räcker inte — bokslutet (byggen/öhälsa)
  // kan dra över den, och då racar skylten mot första priset och blinkar förbi. Här står den garanterat
  // kvar innan nästa köjobb (första awardStep) får rita över. Spelledarläge: skylten stegas av spelledaren.
  if (!E()?.getState()?.gmMode) await delay(3000);
}));
game.on('awardStep', p => run(async () => {
  if (p.typ === 'eld' && !p.w) return;   // ingen eldsjäl → visas inte alls (föregående pris ligger kvar tills nästa)
  await tonaUtOrad();
  renderAwardCard(p.typ, p.w);
  $('ov-award').classList.add('open');
  if (!E()?.getState()?.gmMode) await delay(5000);   // SELFPLAY: varje pris hålls kvar 5 s klientstyrt (lika med serverns takt → låser sig när ikapp, pacar själv om bokslutet drog över)
}));
game.on('awardDone', p => run(async () => {
  $('ov-award').classList.remove('open');
  sistaPrisBild = prevAwardBild;   // "har ordet" börjar på samma rum som sista priset visade (sömlös övergång)
  prevAwardBild = '';
  renderRegs();
  if (p?.over) { showPendingSlut(); return; }   // sista rundans ceremoni klar → nu visas slutskärmen
  // ÖRÅD: årssiffran + "ÅR N"-bannern byts INTE här. Örådet (ordförande → förslag → röstning) hör
  // ihop med prisutdelningen och sker direkt efteråt; nya året börjar först när örådet är klart
  // (politicsDone). cerNastaRunda hålls kvar tills dess.
  syncBotOverlay();
}));

game.on('roundEnd', () => run(async () => { flashCoachStop(); renderRegs(); }));   // byggfas slut → Flash-coach stängs (säkerhetsnät)

game.on('start', () => run(async () => {
  // Nytt parti → uppdatera chrome ur PARTIETS config (varierar per version: år, mål/tröskel).
  // (Init-värdena sattes vid load med default-configen; ett variant-parti kan ha andra.)
  $('roundmax').textContent = E().cfg.rounds;
  $('ohgoal').style.left = `${E().cfg.threshold}%`;
  $('ohgoal-lbl').textContent = `MÅL ${E().cfg.threshold}`;
  if (game.me) initSector();
  // Bänk utan lag (åskådare): behåll lobbyn öppen så man kan ta över en dator när som helst.
  if (!(ONLINE && !game.me)) $('ov-start').classList.remove('open');
  $('ov-slut').classList.remove('open');
  stangKroning();
  pendingSlut = null; clearTimeout(slutFailsafe); slutFailsafe = null; cerNastaRunda = null;   // nytt parti → nollställ ev. väntande slutskärm/banner
  map.clearBuildings();
  loggClear();        // nytt parti → töm händelseloggen
  syncBotOverlay();   // bot-bänk → visa "ta över"-rutan redan när runda 1 börjar
}));

game.on('roundStart', p => run(async () => {
  if (p.round === 1) loggRunda(1);   // år 1: avdelaren direkt. År 2+ sätts den EFTER örådet (politicsDone) så örådsbeslutet hamnar under rätt år.
  // Online runda>1: roundStart kommer MEDAN förra rundans ceremoni spelas → vänta med att byta
  // rundnummer tills ceremonin är klar (awardDone), annars hoppar siffran fram för tidigt.
  if (!(ONLINE && p.round > 1)) $('roundnum').textContent = p.round;
  // Stäng ALLA kvarglömda spel-popups från förra rundan. roundStart emitteras FÖRE rundans 'event',
  // så nya rundans händelse-ruta öppnas EFTER detta (stängs alltså inte av misstag).
  ['ov-trade', 'ov-tradein', 'ov-choose', 'ov-vote', 'ov-dilemma', 'ov-event', 'ov-register', 'ov-bot'].forEach(id => $(id)?.classList.remove('open'));
  voteOpenFor = null;
  roundPowerTeam = p.powerTeam || null;                          // MAKT-ROTATION: vem styr politiken denna runda
  oradAktivt = false;                                            // säkerhetsnät: ett avbrutet öråd (utan politicsDone) får aldrig låsa kontrollrummet
  if (ONLINE && !game.me && lastLobby) renderLobby(lastLobby);   // åskådarbänk: visa ta-över-läget
  // round_start-ljud spelas centralt (rigg). Online: håll "RUNDA N" tills prisceremonin är klar
  // (roundStart kommer medan ceremonin fortfarande spelas) → bannras i awardDone. Lokalt: visa direkt.
  if (p.round > 1) {
    if (ONLINE) cerNastaRunda = p.round;
    else { await banner(`ÅR ${p.round}`, false, 1300); await showPowerBanner(roundPowerTeam); }
  }
  picked = null; expanded = null; resolving = false; klarLag = new Set();
  renderHand(); renderMe(); renderTeams(); renderRegs();
  renderPropBtn();                                                // gata LÄGG FÖRSLAG på maktlaget (inte bara disabled=false)
  $('endwrap').classList.remove('pulse');
  setEndBtn('AVSLUTA<br>ÅR', false);
  syncBotOverlay();   // bot-rutan öppnas igen BARA om bänken fortfarande körs av en bot (annars stängd)
  flashCoachStart(p.round);   // Flash: starta lätt coachning (BYGG → BYT) ovanpå det riktiga år 1
}));

game.on('gameEnd', p => run(async () => {
  // win/lose-ljud spelas centralt (rigg) — skärmen är tyst.
  // Lokalt (mock): 'award' stegade redan klart via kön → visa slut direkt.
  // Online: servern driver prisceremonin och avslutar med awardDone{over:true}; gameEnd kan komma
  // FÖRE awardCeremony (auto-läge) → vänta in awardDone. Säkerhetsnät om awardDone aldrig kommer.
  if (E().cfg.kroning) {                           // KRÖNINGEN: online skickar servern 'kroning'; lokalt startar den här
    if (!ONLINE) startaKroning(kroningData(E().getState(), p));
    return;
  }
  if (!ONLINE) { showSlut(p); return; }
  pendingSlut = p;
  clearTimeout(slutFailsafe);
  slutFailsafe = setTimeout(() => run(async () => showPendingSlut()), 15000);
}));

// ── KRÖNINGSCEREMONIN (spec/kroning.js + src/kroning.js) — ersätter slutskärmen i Mellan och Flash ──
function startaKroning(data, forbi = 0) {
  // Allt annat stängs: ceremonin börjar i det släckta kontrollrummet.
  ['ov-award', 'ov-power', 'ov-choose', 'ov-vote', 'ov-dilemma', 'ov-result', 'ov-year', 'ov-event', 'ov-trade', 'ov-tradein', 'ov-register', 'ov-bot', 'ov-slut']
    .forEach(id => $(id)?.classList.remove('open'));
  pendingSlut = null; clearTimeout(slutFailsafe); slutFailsafe = null;
  slutForlust = !data.vunnet;
  const gmNu = !!E()?.getState()?.gmMode;          // spelledarläge: spelledaren leder avslutningen (ingen knapp)
  visaKroning(data, {
    forbi,
    knapp: gmNu ? null : (data.vunnet ? 'STARTA NYTT SPEL' : 'TILLBAKA TILL LOBBYN'),
    onKort: () => { oradAktivt = false; rivRummet(); },
    onKnapp: () => { stangKroning(); $('btn-again').click(); },
  });
}
game.on('kroning', p => run(async () => startaKroning(p.data, p.forbi || 0)));
game.on('finalOrad', () => run(async () => { forladdaKroning(); }));

game.on('proposalOpened', p => run(async () => {
  // proposal_open-ljud spelas centralt (rigg); 'vote' stannar som torr feedback när DU trycker JA/NEJ.
  if ($('ov-choose').classList.contains('open') && p.type) {   // valt kort markeras (guldkant), de andra tonas ner → sedan omröstning
    document.querySelectorAll('#proplist .propchoice').forEach(el => el.classList.add(el.dataset.type === p.type ? 'pick' : 'fade'));
    await delay(1000);
  }
  $('ov-choose').classList.remove('open');   // ÖRÅD: stäng förslagsväljaren → röstningen öppnas
  if (p.type === 'event') openSponsratModal(p);   // sponsrat (rost) → v3-vyn (JA/NEJ, grön/röd)
  else openVoteModal(p);                           // politik-förslag → #ov-vote
}));

game.on('proposalResolved', p => run(async () => {
  audio.play(p.passed ? 'proposal_pass' : 'proposal_fail');
  const _pnamn = p.type === 'event' ? 'Erbjudande' : (propDefs().find(d => d.type === p.type)?.rubrik || 'Förslag');
  { const _pd = propDefs().find(d => d.type === p.type); const _pi = ICON_IDS.includes(p.type) ? p.type : (p.type === 'event' ? 'happening' : 'orad');   // förslagets egen ikon, ingen laglogga
    logg(`<span class="ri">${ico(_pi, 22)}</span><span class="rt">${_pnamn}</span><span class="ro">${ico(p.passed ? 'ja' : 'nej', 20)}<b class="fr">${p.yesCount}/4</b></span>`, 'lr'); }
  // SPONSRAT i v3-vyn (#ov-dilemma): resultat återanvänder vyn (vinnande ja-kort / grå ruta).
  if (p.type === 'event' && $('ov-dilemma')?.classList.contains('open')) {
    const ev = sponsratVote?.event || {};
    const noCount = Object.values(p.votes || {}).filter(v => v === false).length;
    $('dz-timer').className = 'dz-timer done'; $('dz-timer').textContent = '';
    if (p.passed) {
      let kons = `<div class="r">${ico('pengar', 34)}<span class="who">Varje ja-företag</span><b>+${ev.ja ?? 0}</b></div>`;
      if (ev.oh) { const up = ev.oh >= 0; kons += `<div class="r">${ico(up ? 'tillvaxt' : 'industri', 34)}<span class="who">Öns hälsa</span><b class="${up ? 'up' : 'down'}">${up ? '+' : '−'}${Math.abs(ev.oh)}</b></div>`; }
      $('dz-choices').innerHTML = `<div class="resultcard win ja"><div class="rtop"><span class="ab">JA</span><span class="won">${p.yesCount} TOG EMOT</span></div><div class="kons">${kons}</div></div>`;
    } else {
      $('dz-choices').innerHTML = `<div class="resultcard none">Inget företag nappade · ön slapp undan</div>`;
    }
    $('dz-foot').innerHTML = `<div class="dz-tally"><span class="jav">${p.yesCount} JA</span> · <span class="nejv">${noCount} NEJ</span></div>`;
    sponsratVote = null; sponsratPicked = null; dzResolved = true;
    setTimeout(() => { $('ov-dilemma').classList.remove('open'); rivRummet(); voteOpenFor = null; renderMe(); renderTeams(); renderRegs(); }, 5000);
    return;
  }
  // POLITIK: de sista rösterna visas en kort stund, sedan resultat-popup (GICK IGENOM / FÖLL) på timer.
  renderVoteState();
  $('vote-btns').style.display = 'none';
  await delay(900);
  const def = propDefs().find(d => d.type === p.type);
  const teams = E().getState().teams;
  const ic = ICON_IDS.includes(p.type) ? ico(p.type, 120) : (def?.pic || '');
  $('ov-result').innerHTML = `<div class="rp ${p.passed ? 'ok' : 'no'}"><div class="rtop"><span class="ri">${ic}</span>`
    + `<div class="rm"><div class="rl">${def?.rubrik || p.event?.rubrik || 'Förslag'}</div><div class="rs">${ico(p.passed ? 'ja' : 'nej', 64)} ${p.passed ? 'GICK IGENOM' : 'FÖLL'}</div></div>`
    + `<div class="rn">${p.yesCount}<span>/ ${teams.length}</span></div></div>`
    + `<div class="rv">${teams.map((t, i) => { const ja = p.votes?.[t.id] === true; return `<span class="vtm" style="animation-delay:${(1 + i * .18).toFixed(2)}s"><i class="c ${ja ? 'ja' : 'nej'}">${ico(ja ? 'ja' : 'nej', 52)}</i><em>${t.namn}${t.id === game.me ? ' (du)' : ''}</em></span>`; }).join('')}</div></div>`;
  $('ov-result').classList.add('open');
  $('ov-vote').classList.remove('open'); voteOpenFor = null; renderMe(); renderTeams(); renderRegs();
  await delay(4200);
  $('ov-result').classList.remove('open'); $('ov-result').innerHTML = '';
}));

// DILEMMA (Flash Ö-råd): auto-presenterat → A/B-röstning → resultat. politicsDone stänger + stegar året.
game.on('dilemmaOpened', p => run(async () => {
  $('ov-choose').classList.remove('open');
  openDilemmaModal(p);
}));
game.on('dilemmaResolved', p => run(async () => {
  const d = dilemmaById(p.id);
  $('dz-timer').className = 'dz-timer done'; $('dz-timer').textContent = '';
  if (!p.outcome) {   // OAVGJORT (dilemmaStrict): inget beslut → inga effekter.
    audio.play('ui_close');
    logg(`<span class="ri">${ico(ICON_IDS.includes(p.id) ? p.id : 'vag', 22)}</span><span class="rt">${d?.namn || 'Dilemma'}</span><span class="ro"><b class="fr">${p.aCount}–${p.bCount}</b></span>`, 'lr');
  } else {
    const a0 = (d && d.alternativ[p.outcome]) || {};
    audio.play('proposal_pass');
    logg(`<span class="ri">${ico(ICON_IDS.includes(p.id) ? p.id : 'vag', 22)}</span><span class="rt">${d?.namn || 'Dilemma'}</span><span class="ro"><span class="ab">${p.outcome}</span></span>`, 'lr');
  }
  dilemmaVote = null; dilemmaPicked = null; dzResolved = true;
  // Som i politiken: de sista rösterna syns en kort stund, sedan resultat-popup där svaren visas ETT I TAGET (cirklar med A/B + lagnamn).
  renderDilemmaVotes();
  await delay(900);
  const teams = E().getState().teams;
  const win = p.outcome, a = (d && win && d.alternativ[win]) || {};
  const cls = win === 'A' ? 'a' : win === 'B' ? 'b' : 'none';
  $('ov-result').innerHTML = `<div class="rwrap"><div class="rp ${cls}"><div class="rtop"><span class="rab">${win || '–'}</span>`
    + `<div class="rm"><div class="rl">${win ? `ALTERNATIV ${win} VANN` : 'Ö-RÅDET'}</div><div class="rs">${win ? (a.namn || '').toUpperCase() : 'INGET BESLUT'}</div></div></div>`
    + (win ? `<div class="kons">${dilemmaKons(a.effects)}</div>` : `<div class="rl" style="text-align:center">Ni kunde inte bestämma er — inga förändringar</div>`)
    + `<div class="rv">${teams.map((t, i) => { const v = p.votes?.[t.id]; const c = v === 'A' ? 'a' : v === 'B' ? 'b' : 'x';
        return `<span class="vtm" style="animation-delay:${(0.9 + i * .55).toFixed(2)}s"><i class="c ${c}">${v === 'A' || v === 'B' ? v : '–'}</i><em>${t.namn}${t.id === game.me ? ' (du)' : ''}</em></span>`; }).join('')}</div></div>`
    + `<div class="rtally${win ? '' : ' none'}"><span class="av">${p.aCount} A</span><span class="sep"> – </span><span class="bv">${p.bCount} B</span></div></div>`;   // tallyn UNDER rutan
  $('ov-result').classList.add('open');
  $('ov-dilemma').querySelector('.dz')?.classList.add('out');
  await delay(400);
  $('ov-dilemma').classList.remove('open'); $('ov-dilemma').querySelector('.dz')?.classList.remove('out');
  voteOpenFor = null; renderMe(); renderTeams(); renderRegs();
  await delay(win ? 5200 : 2700);   // totalt ≈ serverns hållning (7 s / 4,5 s) → politicsDone (ÅR-banderoll i kontrollrummet) köas efteråt
  $('ov-result').classList.remove('open'); $('ov-result').innerHTML = '';
}));

game.on('voteUpdate', () => { renderVoteState(); if ($('ov-dilemma')?.classList.contains('open') && !dzResolved) (sponsratVote ? renderSponsratVotes() : renderDilemmaVotes()); });   // röst-tally live (ej efter avgörandet)

game.on('timer', ({ left, full }) => {
  const m = Math.floor(Math.max(0, left) / 60), s = Math.max(0, left) % 60;
  $('timertxt').textContent = `${m}:${String(s).padStart(2, '0')}`;
  const skala = full || E().cfg.timerSec;
  $('timerring').style.strokeDashoffset = 414.7 * (1 - Math.max(0, left) / skala);
  $('endwrap').classList.toggle('urgent', left > 0 && left <= 15);
});

// ——— Online-specifika events ———
if (ONLINE) {
  game.on('lobby', m => renderLobby(m));
  game.on('klarUpdate', m => {
    klarLag = new Set(m.klar);
    if (m.senast && m.senast !== game.me) toast(`${ico('ja', 16)} ${teamName(m.senast)} har avslutat — året körs när alla är klara`);
    if (klarSent) setEndBtn(`VÄNTAR…<br>${m.klar.filter(id => lastLobby?.claims[id] === 'human').length}/${m.humans}`, true);
    renderTeams();
  });
  game.on('claimAck', () => {
    if (game.me) initSector();
    if (lastLobby) renderLobby(lastLobby);
    $('ov-bot').classList.remove('open');   // återtog laget efter bot-övertagande → stäng rutan
    // Tog över ett lag mitt i pågående spel → bygg upp vyn och stäng lobbyn.
    const S = E()?.getState();
    if (game.me && S && S.round >= 1 && !S.over) rebuildFromState(S);
    // RUMS-FLÖDE: sent ansluten claimade ett lag medan gruppen är i tutorial-fasen → kör egen solo-tutorial.
    else if (game.me && game.phase === 'tutorial' && !tutRunning) runTutorial();
  });
  // Boten tog över den här (inaktiva) skärmen → visa "ta tillbaka"-rutan. Tryck → återta laget via claim.
  game.on('botTakeover', m => {
    if (!game.me || (m.lag && m.lag !== game.me)) return;
    audio.play('ui_notis');
    $('ov-bot').classList.add('open');
  });
  game.on('tradeIncoming', m => openTradeIncoming(m));
  game.on('notis', m => { audio.play('ui_notis'); toast(m.text); });
  game.on('disconnected', () => setConn(false));
  game.on('reconnected', r => { setConn(true); toast(`${ico('ja', 16)} Återansluten`); if (r.started && r.state) rebuildFromState(r.state); });
}

// ═══════════════ Rendering ═══════════════
// Räknar upp/ner en siffra (ease-out) — känns som en reaktion på handlingen.
const _reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateCount(el, to, ms = 650) {
  const from = parseInt(el.textContent, 10) || 0;
  if (from === to || _reduceMotion()) { el.textContent = to; return; }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Röd-zon-larm: en röd vinjett-puls när ön faller (i eller in i röda zonen).
let _alarmTmo = null;
function stageAlarm() {
  const st = $('stage');
  st.classList.remove('alarm'); void st.offsetWidth;   // starta om animationen
  st.classList.add('alarm');
  clearTimeout(_alarmTmo);
  _alarmTmo = setTimeout(() => st.classList.remove('alarm'), 750);
}

function updateOh({ value, mode, delta }) {
  const c = E().cfg;
  if (value < c.redZone && delta < 0) stageAlarm();
  $('ohfill').style.width = `calc(${value}% - 6px)`;
  $('ohfill').style.background = value < c.redZone ? 'var(--oh-red)' : value > c.greenZone ? 'var(--oh-green)' : 'var(--oh-yellow)';
  $('ohneedle').style.left = `${value}%`;
  animateCount($('ohval'), value);
  $('ohval').style.color = value < c.redZone ? 'var(--oh-red)' : value > c.greenZone ? 'var(--oh-green)' : 'var(--oh-yellow)';
  const d = $('ohdelta');
  d.textContent = delta === 0 ? '—' : (delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`);
  d.className = 'ohdelta' + (delta > 0 ? ' pos' : delta < 0 ? ' neg' : '');
  $('ohmode').innerHTML = moodIco(mode, 44);   // bara emoji/ikon (ordet borttaget) — större
  map.setOhalsaMode(mode);
  // Ambiens flyttad till centralhögtalaren (rigg/hjärna) — skärmen är tyst mellan interaktioner.
}

function renderMe() {
  if (!game.me || !E()?.getState()) return;
  const t = E().team(game.me);
  $('me-pengar').textContent = t.pengar;
  $('me-material').textContent = t.material;
  const inc = [];
  if (t.incP) inc.push(`<b style="color:${curCol('pengar')}">+${t.incP}</b>${ico('pengar', 36)}`);
  if (t.incM) inc.push(`<b style="color:${curCol('material')}">+${t.incM}</b>${ico('material', 36)}`);
  $('me-inc').innerHTML = inc.length ? inc.join('<span class="sp"></span>') + '<span class="per">/ år</span>' : '';   // inkomsten är viktig → stor
  renderHandAfford();
  renderPropBtn();
}

// Gemensam POLITIK-knapp på ALLA skärmar → alla kan öppna och LÄSA förslagen; bara maktlaget kan LÄGGA.
// Statusraden visar vem som är förslagsläggare (i lagets färg) så alla vet vem de ska påverka.
function renderPropBtn() {
  const btn = $('btn-prop'); if (!btn) return;
  const S = E().getState();
  const power = S?.powerTeam || null;                   // MAKT-ROTATION: vilket lag som styr politiken denna runda
  const sub = document.querySelector('.politik-sub');
  const lagt = !!(S && S.proposal);                     // ett förslag har lagts denna runda (en per runda med makt-rotation)
  // Din tur att lägga? (maktlaget, eller alla i runda 1 utan makt, och du har inte redan lagt)
  const kanLagga = !lagt && !!game.me && (!power || power === game.me) && !(S?.proposedBy || []).includes(game.me);
  if (lagt) {
    btn.disabled = true; btn.classList.remove('gold'); btn.classList.add('lagt');   // grå + oklickbar resten av rundan → ingen ny händelse ovanpå
    btn.innerHTML = `${ico('rosta', 22)} FÖRSLAG LAGT`;
  } else {
    btn.disabled = false; btn.classList.remove('lagt');
    btn.classList.toggle('gold', kanLagga);             // gul/guldig = din tur att lägga förslag; neutral = du kan bara läsa de andras
    btn.innerHTML = `${ico('rosta', 22)} POLITIK`;
  }
  if (sub) {
    if (power) {
      const farg = AREAS.find(x => x.id === power)?.farg || 'var(--gold)';
      sub.innerHTML = `Förslagsläggaren: <b style="color:${farg}">${teamName(power)}</b>${power === game.me ? ' (du)' : ''}`;
    } else {
      sub.textContent = 'Ett förslag per lag · 3 av 4 JA avgör';
    }
  }
}

function flashRes(cur, amount) {
  const box = $(cur === 'pengar' ? 'box-pengar' : 'box-material');
  box.classList.add(amount > 0 ? 'flash-up' : 'flash-down');
  const chip = document.createElement('span');
  chip.className = 'floatchip';
  chip.style.color = amount > 0 ? 'var(--led-green)' : 'var(--led-red)';
  chip.innerHTML = `${amount > 0 ? '+' : ''}${amount} ${CUR_ICON[cur]}`;
  box.appendChild(chip);
  setTimeout(() => { box.classList.remove('flash-up', 'flash-down'); chip.remove(); }, 1400);
}

// Topplistan: alla fyra lag rankade på förmögenhet (= Börsen), ledaren i egen tier,
// BYT per motståndarrad, ditt eget lag markerat DU. Ersätter både "de andra lagen" + Börsen.
function renderTeams() {
  if (!E()?.getState()) return;
  const lb = E().leaderboards();
  const rich = lb.bors[0], bov = lb.klimat[0];
  const byId = Object.fromEntries(E().getState().teams.map(t => [t.id, t]));
  const ranked = lb.bors.map(r => byId[r.id]).filter(Boolean);
  $('toplist').innerHTML = ranked.map((t, i) => {
    const me = t.id === game.me;
    const style = `--spine:var(--team-${t.id})`;
    const isBov = bov && t.id === bov.id && bov.skada < 0;
    const bytBtn = me ? `<span class="du-tag">DU</span>`
                      : `<button class="byt" data-partner="${t.id}">${ico('byt', 22)} BYT</button>`;
    if (i === 0) {
      const crown = rich.varde > 0 ? ' ' + ico('krona', 24, { badge: false }) : '';
      return `<div class="tl-row lead ${me ? 'me' : ''}" style="${style}">
        <span class="rank">1</span>
        <span class="tl-badge">${logoSVG(t.id, 46)}</span>
        <div class="tl-id"><div class="nm">${t.namn}${crown}</div><div class="tl-sub">LEDARE${me ? ' · DU' : ''}</div></div>
        <div class="tl-cap"><span class="cap-total">${t.pengar + t.material}</span><span class="cap-parts"><span class="c-p">${ico('pengar', 14)}${t.pengar}</span><span class="c-m">${ico('material', 14)}${t.material}</span></span></div>
        ${me ? '' : `<button class="byt" data-partner="${t.id}">${ico('byt', 22)} BYT</button>`}
      </div>`;
    }
    return `<div class="tl-row ${me ? 'me' : ''}" style="${style}">
      <span class="rank">${i + 1}</span>
      <span class="tl-badge sm">${logoSVG(t.id, 30)}</span>
      <div class="tl-id"><div class="nm sm">${t.namn}${isBov ? ' ' + ico('varning', 16, { badge: false }) : ''}</div></div>
      <div class="tl-cap sm"><span class="cap-total">${t.pengar + t.material}</span><span class="cap-parts"><span class="c-p">${ico('pengar', 12)}${t.pengar}</span><span class="c-m">${ico('material', 12)}${t.material}</span></span></div>
      ${bytBtn}
    </div>`;
  }).join('');
  document.querySelectorAll('#toplist [data-partner]').forEach(b =>
    b.addEventListener('click', () => { audio.play('ui_tap'); openTrade(b.dataset.partner); }));
}

// Liten nedtonad spegel: vem skadar ön mest (fulla listan finns i registret-slideovern).
function renderRegs() {
  if (!E()?.getState()) return;
  const bov = E().leaderboards().klimat[0];
  const body = bov && bov.skada < 0
    ? `${ico('varning', 28, { badge: false })} <b>${bov.namn}</b> sänker ön mest <span class="n">${bov.skada}</span>`
    : `${ico('tillvaxt', 30)} Ingen bov — ön andas ut`;
  $('reg-klimat-mirror').innerHTML = `<div class="km-head">${ico('industri', 26)} KLIMATREGISTRET <span style="margin-left:auto;color:var(--gold);font-weight:700;font-size:17px;letter-spacing:1px">visa alla ›</span></div><div class="km-body">${body}</div>`;
}

function renderHand() {
  if (!game.me) return;
  const hand = handFor(game.me);
  const S = E().getState();
  const banned = S.banDirtyThisRound;
  const banAll = S.banAllThisRound;                 // byggstopp (naturreservat): INGET bygge i år
  const banSektor = S.banDirtySektorThisRound === E().team(game.me)?.sektor;   // sektorblockad: smutsigt stopp för min sektor
  $('cards').innerHTML = hand.map(c => {
    const kostHtml = [c.kp ? `${c.kp}${ico('pengar', 14)}` : '', c.km ? `${c.km}${ico('material', 14)}` : ''].filter(Boolean).join(' + ');
    const gerCur = c.gp ? 'pengar' : 'material';           // egen vinning (inkomst till DIG) — den stora visuella kroken
    const gerNum = c.gp || c.gm;
    const pos = c.oh > 0;
    const dirtyBan = (banned || banSektor) && c.tier === 'smutsig';   // smutsigt kort stoppat (förbud / sektorblockad)
    return `
    <div class="card ${c.tier} ${banAll ? 'byggstopp' : dirtyBan ? 'banned' : ''}" data-tier="${c.tier}">
      <div class="band">${TIER_LABEL[c.tier]}</div>
      <div class="inner">
        <img src="${manifest.buildings[c.asset].file}" alt="">
        <div class="info">
          <div class="nm">${c.namn}</div>
          <div class="gain-badge ${gerCur}">${ico(gerCur, 32)}<span class="gain-num">+${gerNum}</span><span class="gain-lbl">/ år</span></div>
          <div class="stat"><span class="k">Kostar</span> <span class="v">${kostHtml}</span></div>
          <div class="stat"><span class="k">Öns hälsa</span> <span class="v ${pos ? 'ohplus' : 'ohminus'}">${pos ? '+' + c.oh : c.oh} ${ico('on', 14)}</span></div>
        </div>
      </div>
      <button class="kop">KÖP — BYGG PÅ ÖN</button>
      <span class="saknas"></span>
    </div>`;
  }).join('');
  $('cards').parentElement.classList.remove('hand-locked');
  document.querySelectorAll('#cards .card').forEach(el => {
    el.addEventListener('click', ev => {
      if (resolving) return;
      if (picked && !flerByggen()) {   // Flash/en-bygge-variant: redan byggt i år → FÖRKLARA (ingen tyst död knapp)
        audio.play('ui_notis');
        toast(`${ico('ja', 16)} Du har redan byggt i år — tryck <b>KLAR</b> när du är nöjd`);
        return;
      }
      if (el.classList.contains('banned') || el.classList.contains('byggstopp')) {   // stoppat kort → förklara (motorn nekar ändå)
        audio.play('ui_notis');
        toast(el.classList.contains('byggstopp') ? '🚫 Byggstopp i år — naturreservat' : '🚫 Det smutsiga kortet är förbjudet i år', true);
        return;
      }
      const tier = el.dataset.tier;
      if (ev.target.classList.contains('kop')) { buyCard(tier); return; }
      audio.play('ui_tap');
      expanded = expanded === tier ? null : tier;
      document.querySelectorAll('#cards .card').forEach(x =>
        x.classList.toggle('expanded', x.dataset.tier === expanded));
    });
  });
  renderHandAfford();
}

function renderHandAfford() {
  if (!game.me) return;
  const t = E().team(game.me);
  const otherCur = t.sektor === 'pengar' ? 'material' : 'pengar';
  let needOther = false;
  handFor(game.me).forEach(c => {
    const el = document.querySelector(`#cards .card[data-tier="${c.tier}"]`);
    if (!el) return;
    const brist = [];
    if (t.pengar < c.kp) brist.push(`${c.kp - t.pengar}${ico('pengar', 13)}`);
    if (t.material < c.km) brist.push(`${c.km - t.material}${ico('material', 13)}`);
    el.classList.toggle('poor', brist.length > 0 && !picked);
    el.querySelector('.saknas').innerHTML = brist.length ? `saknar ${brist.join(' + ')} → BYT` : '';
    if (!picked && ((otherCur === 'pengar' && t.pengar < c.kp) || (otherCur === 'material' && t.material < c.km))) needOther = true;
  });
  const tb = $('btn-trade');
  if (tb) tb.classList.toggle('need-trade', needOther);
}

async function buyCard(tier) {
  const res = await game.selectCard(tier);
  if (!res.ok) {
    if (res.need) toast(`Har inte råd — saknar ${res.need.pengar ? res.need.pengar + ' ' + ico('pengar', 14) + ' ' : ''}${res.need.material ? res.need.material + ' ' + ico('material', 14) : ''}. Byt med ett annat lag!`, true);
    else toast(res.reason || res.why || 'gick inte', true);
    return;
  }
  if (flerByggen()) {
    // MED SPELLEDARE: ingen låsning — bygg igen med uppdaterade resurser.
    picked = null; expanded = null;
    $('endwrap').classList.add('pulse');
    renderHand(); renderMe(); renderTeams();
    return;
  }
  picked = tier; expanded = null;
  $('cards').parentElement.classList.add('hand-locked');
  document.querySelectorAll('#cards .card').forEach(x => {
    x.classList.remove('expanded', 'poor');
    x.classList.toggle('picked', x.dataset.tier === tier);
  });
  $('endwrap').classList.add('pulse');
  renderMe(); renderTeams();
}

function setEndBtn(html, disabled) {
  $('btn-end').innerHTML = html;
  $('btn-end').disabled = !!disabled;
  $('btn-end').style.opacity = disabled ? 0.55 : 1;
}
let klarSent = false;
$('btn-end').addEventListener('click', () => {
  if (resolving || voteOpenFor) return;
  audio.play('ui_tap');
  if (ONLINE) {
    klarSent = true;
    setEndBtn('VÄNTAR…', true);
    game.klar();
  } else {
    game.klar();
  }
});
game.on('roundStart', () => { klarSent = false; });

// OMSPEL (kris olöst → rundan spelas om): kort signal + bygg om vyn från det ÅTERSTÄLLDA statet.
// Separat från roundStart (undviker award-paus-maskineriet) → nollställ rund-UI:t explicit här.
game.on('roundReplay', p => run(async () => {
  klarSent = false; picked = null; expanded = null; resolving = false; klarLag = new Set();
  $('ov-award').classList.remove('open');
  $('ov-event').classList.remove('open');
  $('ov-vote').classList.remove('open'); voteOpenFor = null;
  $('cards').parentElement.classList.remove('hand-locked');
  $('roundnum').textContent = p.round;
  await banner('ÖN KOLLAPSADE — SPELAR OM ÅRET', true, 1900);
  const S = E()?.getState();
  if (S) rebuildFromState(S);                         // ritar om byggnader/resurser/öhälsa från rollbacken; tänder .krisglow (S.inCrisis)
  $('endwrap').classList.remove('pulse');
  setEndBtn('AVSLUTA<br>ÅR', false);
}));

function humanCount() {
  const l = lastLobby;
  return l ? Object.values(l.claims).filter(v => v === 'human').length : 1;
}

// ═══════════════ Byteshandel ═══════════════
let mySector = null, giveCur = null, getCur = null;
let tradePartner = null, giveAmt = 10, getAmt = 10;

function initSector() {
  mySector = AREAS.find(a => a.id === game.me).sektor;
  giveCur = mySector; getCur = mySector === 'material' ? 'pengar' : 'material';
  const annan = mySector === 'material' ? 'pengar' : 'material';
  $('me-sektor').innerHTML = `<div class="gr"><span>DU GÖR</span>${ico(mySector, 40)}</div><div class="gr s"><span>DU SAKNAR</span>${ico(annan, 40)}</div>`;
  $('melogo').innerHTML = logoSVG(game.me, 64);
  $('mename').textContent = teamName(game.me);
}

function tradePartnersByNeed() {
  // Rangordna efter vem som har MEST av valutan du behöver (getCur) — störst överst.
  return E().getState().teams.filter(t => t.id !== game.me)
    .sort((a, b) => b[getCur] - a[getCur]);
}
function openTrade(partnerId = null) {
  const partners = tradePartnersByNeed();
  tradePartner = partnerId || partners[0].id;
  giveAmt = 10; getAmt = 10;
  renderTradeLabels();
  renderTradeModal();
  const go = $('btn-trade-go'); go.disabled = false; tradeWaitUI(false);   // nollställ ev. väntläge
  audio.play('ui_open');
  $('ov-trade').classList.add('open');
}
// Riktnings-etiketterna (vilken valuta man ger/får) — egen funktion så swap-knappen kan rita om dem.
function renderTradeLabels() {
  $('trade-give-lbl').innerHTML = `${giveCur} ${curIco(giveCur, 16)}`;
  $('trade-get-lbl').innerHTML = `${getCur} ${curIco(getCur, 16)}`;
  $('tb-give').innerHTML = `DU GER ${curIco(giveCur, 30)}`;
  $('tb-get').innerHTML = `DU FÅR ${curIco(getCur, 30)}`;
  $('trade-swap')?.classList.toggle('flip', giveCur === 'material');   // DU GER material → pilen vriden 180° (grå pilen överst, pekar bortåt)
}
const COL_PENGAR = '#E8C96A', COL_MATERIAL = '#C9D3DC';   // pengar = guld, material = silver (överallt i byten)
const curCol = c => (c === 'pengar' ? COL_PENGAR : COL_MATERIAL);
function renderTradeModal() {
  $('partners').innerHTML = tradePartnersByNeed().map((t, i) => `
    <button class="${t.id === tradePartner ? 'sel' : ''}" data-p="${t.id}">
      ${i === 0 ? `<span class="most">MEST ${curIco(getCur, 22)}</span>` : ''}
      <span class="plg">${logoSVG(t.id, 92)}</span>
      <div class="pi"><div class="pn">${t.namn}</div>
        <div class="st"><span style="color:${COL_PENGAR}">${t.pengar}</span>${ico('pengar', 30)}<i></i><span style="color:${COL_MATERIAL}">${t.material}</span>${ico('material', 30)}</div></div>
    </button>`).join('');
  document.querySelectorAll('#partners [data-p]').forEach(b =>
    b.addEventListener('click', () => { tradePartner = b.dataset.p; renderTradeModal(); }));
  $('give-amt').textContent = '−' + giveAmt; $('give-amt').style.color = curCol(giveCur);
  $('get-amt').textContent = '+' + getAmt;   $('get-amt').style.color = curCol(getCur);
}
// ⇄ Byt håll: ge det du annars skulle få (och tvärtom). Partnerlistan rankas efter getCur → ritas om.
$('trade-swap').addEventListener('click', () => {
  audio.play('ui_tap');
  [giveCur, getCur] = [getCur, giveCur];
  renderTradeLabels(); renderTradeModal();   // renderTradeLabels sätter pilens rotation efter nya giveCur
});
$('btn-trade').addEventListener('click', () => { audio.play('ui_tap'); openTrade(); });
$('btn-trade-cancel').addEventListener('click', () => { audio.play('ui_close'); $('ov-trade').classList.remove('open'); });
// Ta tillbaka laget efter bot-övertagande → claim (servern låter en människa återta en bot mitt i spel).
$('btn-bot-tillbaka').addEventListener('click', () => { audio.play('ui_tap'); const lag = game.me || params.get('lag'); if (lag) game.claim(lag); });
$('give-minus').addEventListener('click', () => { giveAmt = Math.max(1, giveAmt - 1); renderTradeModal(); });
$('give-plus').addEventListener('click', () => { giveAmt = Math.min(E().team(game.me)[giveCur], giveAmt + 1); renderTradeModal(); });
$('get-minus').addEventListener('click', () => { getAmt = Math.max(1, getAmt - 1); renderTradeModal(); });
$('get-plus').addEventListener('click', () => { getAmt = getAmt + 1; renderTradeModal(); });
// Väntläge efter förslag till MÄNSKLIGT lag: knapparna byts mot "VÄNTAR PÅ X" + pulserande prickar + AVBRYT.
function tradeWaitUI(on, partnerId) {
  $('trade-btns').style.display = on ? 'none' : 'flex';
  $('trade-wait').style.display = on ? 'flex' : 'none';
  if (on) {
    $('trade-wait-logo').innerHTML = logoSVG(partnerId, 56);
    $('trade-wait-txt').innerHTML = `VÄNTAR PÅ ${teamName(partnerId).toUpperCase()}<span class="dd"><i></i><i></i><i></i></span>`;
  }
}
$('btn-trade-cancel2').addEventListener('click', () => { audio.play('ui_close'); $('ov-trade').classList.remove('open'); });
// Stor resultatruta mitt på skärmen: grön BYTT! / röd NEJ TACK (ej under övningen — den har egna rutor).
async function showTradeResult(ok, partnerId, why) {
  const c = $('traderes-card');
  c.className = 'modal res ' + (ok ? 'g' : 'r');
  c.innerHTML = `<span>${logoSVG(partnerId, 140)}</span><div>` + (ok
    ? `<div class="rh">${ico('ja', 110)} BYTT!</div><div class="rn"><b style="color:${curCol(giveCur)}">−${giveAmt}</b>${ico(giveCur, 90)}<span class="ar">→</span><b style="color:${curCol(getCur)}">+${getAmt}</b>${ico(getCur, 90)}</div>`
    : `<div class="rh">${ico('nej', 110)} NEJ TACK</div>${why ? `<div class="rn sm">${why}</div>` : ''}`) + `</div>`;
  $('ov-traderes').classList.add('open');
  audio.play(ok ? 'ui_confirm' : 'ui_close');
  await new Promise(res => { const t = setTimeout(done, 2600); function done() { clearTimeout(t); $('ov-traderes').onclick = null; res(); } $('ov-traderes').onclick = done; });
  $('ov-traderes').classList.remove('open');
}
$('btn-trade-go').addEventListener('click', async () => {
  const go = $('btn-trade-go');
  go.disabled = true;
  // Byte med ett MÄNSKLIGT lag → servern frågar dem, svaret kan dröja → väntrad med AVBRYT. (Botar svarar direkt.)
  const partnerHuman = ONLINE && lastLobby?.claims?.[tradePartner] === 'human';
  if (partnerHuman) tradeWaitUI(true, tradePartner);
  const res = await game.trade(tradePartner, giveAmt, giveCur, getAmt, getCur);
  go.disabled = false; tradeWaitUI(false);
  if (!res.ok) {
    // Motpartens nej (bot som inte har råd/tycker det är snålt, människa som tackar nej) → stor NEJ TACK-ruta + stäng.
    // Systemfel (paus, ej ansluten, egen täckning) är inget "nej" från laget → vanlig textrad, rutan blir kvar.
    const why = res.why || '';
    if (/täckning|paus|ansluten/i.test(why)) { toast(`${ico('nej', 16)} ${why || 'bytet gick inte'}`, true); return; }
    $('ov-trade').classList.remove('open');
    await showTradeResult(false, tradePartner, /funderar|inget svar/i.test(why) ? 'inget svar' : '');   // bara NEJ TACK (ingen lång förklaring)
    return;
  }
  flashRes(giveCur, -giveAmt); flashRes(getCur, getAmt);
  $('ov-trade').classList.remove('open');
  renderMe(); renderTeams();
  await showTradeResult(true, tradePartner);                    // även i övningen: den stora BYTT!-rutan ersätter den gamla "Bytt! +X"-rutan
});

// Inkommande bytesförfrågan (online, människa → människa)
function openTradeIncoming(m) {
  const f = AREAS.find(x => x.id === m.from)?.farg || 'var(--text)';
  $('tradein-logo').innerHTML = logoSVG(m.from, 96);
  $('tradein-name').textContent = teamName(m.from).toUpperCase();
  $('tin-get').innerHTML = `${ico(m.giveCur, 72)}<b style="color:${curCol(m.giveCur)}">+${m.give}</b>`;   // Björnen ger → du FÅR
  $('tin-give').innerHTML = `${ico(m.getCur, 72)}<b style="color:${curCol(m.getCur)}">−${m.get}</b>`;    // Björnen vill ha → du GER
  $('ov-tradein').classList.add('open');
  $('btn-tradein-ja').onclick = () => { game.tradeAnswer(m.offerId, true); $('ov-tradein').classList.remove('open'); };
  $('btn-tradein-nej').onclick = () => { game.tradeAnswer(m.offerId, false); $('ov-tradein').classList.remove('open'); };
}

// ═══════════════ Politik ═══════════════
// Render-mallar för ALLA 15 förslag i den gemensamma banken (omarbetad 2026-11-19; fyra kategorier).
// Texten speglar config-siffrorna. visibleProps() visar de som urvalssystemet lagt i S.proposalChoices
// — inget förslag har särskild status. Ordnade per kategori (future/cooperation/polluter/sector).
function propDefs() {
  const c = E().cfg, bov = E().worstPolluter(), rik = E().richest(), gron = E()._greenest();
  return [
    // ── FRAMTIDA (future) ──
    { type: 'forbud', pic: ico('forbud', 64), rubrik: 'Förbjud smutsig', tx: `Nästa år kan <b>ingen</b> bygga det smutsiga kortet.`, ja: 'JA — förbjud smutsig' },
    { type: 'naturreservat', pic: ico('naturreservat', 64), rubrik: 'Naturreservat', tx: `Ön <b>+${c.naturreservatOh}</b> — men <b>ingen</b> får<br>bygga nästa år.`, ja: 'JA — pausa för naturen' },
    // ── SAMARBETE (cooperation) ──
    { type: 'gron', pic: ico('gron', 64), rubrik: 'Grön satsning', tx: `Alla som röstar JA betalar ${c.gronCost} ${ico('pengar', 14)}.<br>Öns hälsa går <b>upp +${c.gronGain}</b>.`, ja: `JA — jag betalar ${c.gronCost} ${ico('pengar', 14)}` },
    { type: 'krispaket', pic: ico('krispaket', 64), rubrik: 'Krispaket', tx: `Alla som röstar JA betalar ${c.krispaketCost} ${ico('pengar', 14)} (eller allt man har).<br>Går det igenom lyfts öns hälsa <b>+${c.krispaketGain}</b>.`, ja: `JA — jag betalar ${c.krispaketCost} ${ico('pengar', 14)}` },
    { type: 'marknadsavtal', pic: ico('marknadsavtal', 64), rubrik: 'Marknadsavtal', tx: `Bonus <b>+${c.marknadsavtalBonus} ${ico('pengar', 14)} till alla</b> — men <b>bara om exakt 3 av 4</b> röstar JA.<br>En måste avstå.`, ja: 'JA — jag är med' },
    { type: 'gronstod', pic: ico('gronstod', 64), rubrik: 'Riktat grönt stöd', tx: `Alla som röstar JA betalar ${c.gronCost} ${ico('pengar', 14)} → hela potten<br>går till grönaste laget (<b>${gron.namn}</b>).`, ja: `JA — jag skänker ${c.gronCost} ${ico('pengar', 14)}` },
    { type: 'allians', pic: ico('allians', 64), rubrik: 'Allians', tx: `Varje <b>JA-lag</b> får +${c.alliansBonus} ${ico('pengar', 14)},<br>varje <b>NEJ-lag</b> betalar ${c.alliansBoter} ${ico('pengar', 14)}.`, ja: `JA — gå med` },
    // ── BOVEN (polluter) ──
    { type: 'skatt', pic: ico('skatt', 64), rubrik: 'Miljöskatt', tx: `Värsta boven (<b>${bov.namn}</b>) betalar ${c.taxAmount} ${ico('pengar', 14)}<br>som delas mellan de andra lagen.`, ja: 'JA — beskatta boven' },
    { type: 'utslappshandel', pic: ico('utslappshandel', 64), rubrik: 'Utsläppshandel', tx: `Värsta boven betalar ${c.utslappAmount} ${ico('pengar', 14)} till<br>grönaste laget — ön ${c.utslappOh}.`, ja: 'JA' },
    { type: 'solidaritet', pic: ico('solidaritet', 64), rubrik: 'Solidaritetsskatt', tx: `Rikaste laget (<b>${rik.namn}</b>) betalar ${c.solidaritetPengar} ${ico('pengar', 14)} + ${c.solidaritetMaterial} ${ico('material', 14)}<br>som delas mellan de tre andra.`, ja: 'JA — beskatta rikaste' },
    { type: 'grannskatt', pic: ico('grannskatt', 64), rubrik: 'Grannskatt', tx: `De <b>två rikaste</b> betalar ${c.grannskattAmount} ${ico('pengar', 14)} var →<br>delas på de två fattigaste.`, ja: 'JA — ta från de rika' },
    // ── SEKTORKONFLIKT (sector) ──
    { type: 'sektorskatt', pic: ico('sektorskatt', 64), rubrik: 'Industriskatt', tx: `<b>Räven + Örnen</b> betalar ${c.sektorskattAmount} ${ico('pengar', 14)} var<br>som delas mellan Oxen + Björnen.`, ja: 'JA — beskatta industrin' },
    { type: 'naturbruksskatt', pic: ico('naturbruksskatt', 64), rubrik: 'Naturbruksskatt', tx: `<b>Oxen + Björnen</b> betalar ${c.naturbruksskattAmount} ${ico('pengar', 14)} var<br>som delas mellan Räven + Örnen.`, ja: 'JA — beskatta naturbruket' },
    { type: 'kustvakt', pic: ico('kustvakt', 64), rubrik: 'Kustvakt', tx: `<b>Räven + Örnen</b> betalar ${c.kustvaktAmount} ${ico('pengar', 14)} var<br>för stormskydd → ön +${c.kustvaktOh}.`, ja: 'JA — skydda kusten' },
    { type: 'skogsvard', pic: ico('skogsvard', 64), rubrik: 'Skogsvård', tx: `<b>Oxen + Björnen</b> betalar ${c.skogsvardAmount} ${ico('pengar', 14)} var<br>för att återställa skadad skog och mark → ön +${c.skogsvardOh}.`, ja: 'JA — återställ naturen' },
  ];
}
// Rundans valbara förslag — ALLTID ur server-auktoritativ spelstatus (S.proposalChoices), aldrig
// klient-lokal slump. Inget hårdkodat grundförslag (Slice 6B: legacy borttaget).
function visibleProps() {
  const defs = propDefs();
  const show = E().getState()?.proposalChoices || [];
  return show.map(type => defs.find(d => d.type === type)).filter(Boolean);
}
// POLITIK-knappen borttagen (händelseloggen ersatte den). Spelarna lägger inte längre egna förslag
// via UI:t; bot-/server-lagda förslag visas fortfarande som omröstning (ov-vote) och loggas.
$('btn-choose-inget').addEventListener('click', () => { audio.play('ui_close'); $('ov-choose').classList.remove('open'); game.politicsSkip?.(); });

// ═══════════ ÖRÅD-politik (klient): ordförande-ruta → förslagsväljare (5 förslag) → röstning ═══════════
game.on('politicsStart', p => run(async () => {
  oradAktivt = true;
  await showOrdforande(p.power);
  openPolitikval(p.power);
}));
// "X HAR ORDET"-rutan med lagets maktbild (assets/makt/). Klick-genom, auto efter ~3 s.
function showOrdforande(power) {
  return new Promise(res => {
    const namn = teamName(power), farg = AREAS.find(a => a.id === power)?.farg || 'var(--gold)';
    const ov = $('ov-power');
    // Start: sista prisrummet (samma bild som nyss visades → sömlöst) → skärmarna släcks (mjukt dopp) → kort svart →
    // mörka emblemväggen tonas upp (rummet tänds) → kort paus → lagets emblem tonas upp → banderoll glider in.
    const startBild = sistaPrisBild || 'assets/kontrollrum_neutral.jpg'; sistaPrisBild = '';
    ov.innerHTML =
      `<div class="pw-wall pw-room" style="background-image:url(${startBild})"></div>`
      + `<div class="pw-wall pw-mork" style="background-image:url(assets/vagg_mork.jpg)"></div>`
      + `<div class="pw-wall pw-lit" style="background-image:url(assets/vagg_${power}.jpg)"></div><div class="pw-dim"></div>`
      + `<div class="pw-ban" style="--acc:${farg}"><div class="bar"></div>`
      + `<div class="lg"><span class="halo"></span>${logoSVG(power, 200)}</div>`
      + `<div class="info"><div class="tt"><span class="ic">${ico('orad', 48)}</span><span class="t">HAR ORDET</span></div><div class="nm">${namn.toUpperCase()}</div>`
      + (power === game.me ? `<div class="you">${ico('rosta', 34)} DIN TUR</div>` : `<div class="ring">Ring och påverka!</div>`) + `</div>`
      + `<div class="vl">${ico('rosta', 112)}</div></div>`;
    ov.classList.remove('out'); ov.classList.add('open');
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(tmo); ov.classList.add('out'); setTimeout(() => { ov.classList.remove('open', 'out'); ov.innerHTML = ''; }, 500); res(); };
    const tmo = setTimeout(finish, 7600);   // timer (ingen klick-stängning): animationen tar ~5,5 s + banderollen visas ~2 s. Servern väntar POLITICS_INTRO_MS (≈ denna tid).
  });
}
game.on('politicsTimer', p => {
  const el = p.stage === 'vote' ? $('vote-timer') : $('choose-timer');
  if (el) { el.textContent = `⏱ ${p.left}s`; el.classList.toggle('hot', p.left <= 10); }
  // Dilemma-vyn (#ov-dilemma): samma nedräkning i dz-timer (om inte redan "Klart").
  const dt = $('dz-timer');
  if (p.stage === 'vote' && dt && $('ov-dilemma')?.classList.contains('open') && !dt.classList.contains('done')) {
    dt.textContent = `⏱ ${p.left}s`; dt.classList.toggle('hot', p.left <= 10);
  }
});
game.on('politicsDone', p => run(async () => {
  $('ov-choose').classList.remove('open'); $('ov-vote').classList.remove('open'); voteOpenFor = null; dilemmaVote = null;
  if (p?.slut) return;                             // sista örådet: stanna i kontrollrummet — kröningen tar över
  const rumPa = $('room-bg')?.classList.contains('on');   // politik: kontrollrummet ligger kvar → ÅR-banderoll där, sedan mjuk övergång till ön
  oradAktivt = false;
  if (!rumPa) rivRummet();
  $('choose-timer').textContent = ''; $('vote-timer').textContent = '';
  // Örådet klart → NU byter årssiffran, loggens ÅR-avdelare sätts (så örådsbeslutet ligger kvar
  // under året vars öråd det var) och "ÅR N"-bannern visas, sedan spelas det nya året.
  if (cerNastaRunda) {
    const r = cerNastaRunda; cerNastaRunda = null; $('roundnum').textContent = r; loggRunda(r);
    if (rumPa) {
      $('ov-year').innerHTML = `<div class="yr">${ico('on', 130)}<div class="yt"><div class="yn">ÅR <b>${r}</b></div><div class="ys">TILLBAKA TILL ÖN <span class="ya">›</span></div></div></div>`;
      $('ov-year').classList.add('open');
      // Går av sig självt efter ~5 s, men ett tryck tar en direkt tillbaka till ön (liten pil = klickbar). Klicklås 600 ms mot misstag.
      await new Promise(resolve => {
        const t = setTimeout(done, 4600);
        let lock = true; setTimeout(() => { lock = false; }, 600);
        function done() { clearTimeout(t); $('ov-year').removeEventListener('pointerdown', onDown); resolve(); }
        function onDown() { if (!lock) done(); }
        $('ov-year').addEventListener('pointerdown', onDown);
      });
      $('ov-year').querySelector('.yr')?.classList.add('out'); await delay(400);
      $('ov-year').classList.remove('open'); $('ov-year').innerHTML = '';
      rivRummet(true); await delay(700);                       // mjuk tonad övergång till ö-vyn
    } else await banner(`ÅR ${r}`, false, 1600);
  } else if (rumPa) rivRummet(true);
  // Örådet kan ha ändrat vad som får byggas DETTA år (förbud → smutsigt kort förbjudet, naturreservat,
  // sektorblockad, byggboom). roundStart ritade handen FÖRE örådet, så rita om den NU när besluten gäller.
  renderHand(); renderMe(); renderTeams(); renderRegs();
  syncBotOverlay();
}));

// Förslagsväljaren i ÖRÅD: 5 förslag på ALLA skärmar. Ordföranden kan lägga; övriga ser bara (gråa).
function openPolitikval(power) {
  const kanLagga = !!game.me && power === game.me;
  const farg = AREAS.find(a => a.id === power)?.farg || 'var(--gold)';
  $('choose-title').innerHTML = kanLagga ? `${ico('rosta', 24)} DU HAR ORDET — VÄLJ ETT FÖRSLAG` : `${ico('rosta', 24)} ${teamName(power).toUpperCase()} HAR ORDET`;
  $('choose-sub').innerHTML = kanLagga ? 'Lägg ett förslag — sedan röstar alla (3 av 4 JA avgör).' : `<b style="color:${farg}">${teamName(power)}</b> lägger ett beslut — ring och påverka!`;
  $('proplist').innerHTML = visibleProps().map(p => `<div class="propcard propchoice${kanLagga ? '' : ' readonly'}" data-type="${p.type}"${kanLagga ? '' : ' aria-disabled="true"'}>
      <div class="pic">${p.pic}</div>
      <div class="tx"><b style="color:var(--text)">${p.rubrik}</b><br>${p.tx}</div>
    </div>`).join('');
  if (kanLagga) document.querySelectorAll('#proplist .propchoice').forEach(el =>
    el.addEventListener('click', () => { audio.play('ui_tap'); game.openProposal(el.dataset.type); }));
  $('btn-choose-inget').style.display = kanLagga ? '' : 'none';   // bara ordföranden kan avstå
  $('choose-timer').classList.remove('hot');
  audio.play('ui_open');
  $('ov-choose').classList.add('open');
}

// Omröstningsrutan: förslaget uppdelat i rader (Klara 2026-11-23). Rad(er) för företagen, därunder en rad för ön (bara om den påverkas).
// Siffror ur cfg; lagnamn (värsta bov / rikaste / grönaste) ur motorn. Ingen löptext.
function propKons(type) {
  const c = E().cfg, bov = E().worstPolluter(), rik = E().richest(), gron = E()._greenest();
  const sg = n => (n > 0 ? '+' : '−') + Math.abs(n);
  const num = (n, sym) => `<b class="${n > 0 ? 'up' : 'down'}">${sg(n)}</b><span class="sy">${ico(sym, 34)}</span>`;
  const pg = n => num(n, 'pengar'), mt = n => num(n, 'material');
  const W = t => `<span class="who">${t}</span>`;
  const R = (...x) => `<div class="r">${x.join('')}</div>`;
  const ARR = '<span class="arr">→</span>';
  const warn = t => `<span class="who">${ico('varning', 34)} ${t}</span>`;
  const oh = n => `<div class="r ke"><span class="isl">${ico('on', 44)}</span>${W('Öns hälsa')}${num(n, n > 0 ? 'tillvaxt' : 'industri')}</div>`;
  switch (type) {
    case 'forbud': return R(warn('Ingen får bygga smutsigt nästa år'));
    case 'naturreservat': return R(warn('Ingen får bygga nästa år')) + oh(c.naturreservatOh);
    case 'gron': return R(W('Alla som röstar JA'), pg(-c.gronCost)) + oh(c.gronGain);
    case 'krispaket': return R(W('Alla som röstar JA'), pg(-c.krispaketCost)) + oh(c.krispaketGain);
    case 'marknadsavtal': return R(W('Alla företag'), pg(c.marknadsavtalBonus), '<span class="sep">–</span>', '<span class="cond">bara om exakt 3 av 4 röstar JA</span>') + oh(c.marknadsavtalOh);
    case 'gronstod': return R(W('Alla som röstar JA'), pg(-c.gronCost)) + R(ARR, W(`Grönaste laget (${gron.namn})`), W('får allt'));
    case 'allians': return R(W('Varje JA-lag'), pg(c.alliansBonus)) + R(W('Varje NEJ-lag'), pg(-c.alliansBoter));
    case 'skatt': return R(W(`Värsta boven (${bov.namn})`), pg(-c.taxAmount)) + R(ARR, W('De andra'), pg(Math.floor(c.taxAmount / 3)));
    case 'utslappshandel': return R(W(`Värsta boven (${bov.namn})`), pg(-c.utslappAmount)) + R(ARR, W(`${gron.namn} (grönaste)`), pg(c.utslappAmount)) + oh(c.utslappOh);
    case 'solidaritet': return R(W(`Rikaste (${rik.namn})`), pg(-c.solidaritetPengar), mt(-c.solidaritetMaterial)) + R(ARR, W('De andra'), pg(Math.floor(c.solidaritetPengar / 3)), mt(Math.floor(c.solidaritetMaterial / 3)));
    case 'grannskatt': return R(W('De två rikaste'), pg(-c.grannskattAmount)) + R(ARR, W('De två fattigaste'), pg(c.grannskattAmount));
    case 'sektorskatt': return R(W('Räven + Örnen'), pg(-c.sektorskattAmount)) + R(ARR, W('Oxen + Björnen'), pg(c.sektorskattAmount));
    case 'naturbruksskatt': return R(W('Oxen + Björnen'), pg(-c.naturbruksskattAmount)) + R(ARR, W('Räven + Örnen'), pg(c.naturbruksskattAmount));
    case 'kustvakt': return R(W('Räven + Örnen'), pg(-c.kustvaktAmount)) + oh(c.kustvaktOh);
    case 'skogsvard': return R(W('Oxen + Björnen'), pg(-c.skogsvardAmount)) + oh(c.skogsvardOh);
  }
  return '';
}
function openVoteModal(p) {
  voteOpenFor = p;
  armVoteLock();   // 3 s innan rösten går att trycka
  $('vote-btns').classList.remove('dilemma'); $('votestat').classList.remove('dilemma');   // ja/nej → grön/röd
  $('btn-nej').innerHTML = 'NEJ';                                                           // återställ efter ev. dilemma (B — …)
  // Händelse-frestelse (typ:'event', t.ex. sponsrat): varje lag väljer själv, ingen 3/4-grind.
  if (p.type === 'event') {
    const ev = p.event || E().getState().proposal?.event || {};
    const bild = ev.bild || (ev.id ? `assets/event_${ev.id}.png` : null);
    $('ov-vote').classList.remove('pk');
    $('vote-sub').textContent = 'Centralmakten erbjuder — varje lag väljer själv';
    if (bild) $('vote-pic').innerHTML = `<img src="${bild}" alt="" style="width:200px;height:120px;object-fit:cover;border-radius:12px;display:block">`;
    else $('vote-pic').innerHTML = ico('byt', 64);
    $('vote-tx').innerHTML = `<b style="color:var(--text)">${ev.rubrik || ''}</b><br>${ev.rostFraga || ev.text || ''}`;
    $('btn-ja').innerHTML = `JA — ta ${ev.ja ?? ''} ${ico('pengar', 14)}`;
    $('vote-btns').style.display = p.by === game.me ? 'none' : 'flex';
    renderVoteState();
    $('ov-vote').classList.add('open');
    return;
  }
  const def = propDefs().find(d => d.type === p.type);
  $('vote-sub').textContent = `${teamName(p.by)} föreslår — det krävs 3 av 4 JA`;
  $('vote-pic').innerHTML = ICON_IDS.includes(def.type) ? ico(def.type, 150) : def.pic;   // stor ikon för förslaget
  $('vote-tx').innerHTML = `<div class="pt">${def.rubrik}</div><div class="kons">${propKons(def.type)}</div>`;
  $('ov-vote').classList.add('pk');
  $('btn-ja').innerHTML = def.ja;
  $('vote-btns').style.display = p.by === game.me ? 'none' : 'flex';
  renderVoteState();
  $('ov-vote').classList.add('open');
}
function renderVoteState() {
  const p = E().getState()?.proposal; if (!p) return;
  $('votestat').innerHTML = E().getState().teams.map(t => {
    const v = p.votes[t.id];
    const cls = (v === true || v === 'A') ? 'ja' : (v === false || v === 'B') ? 'nej' : '';   // politik: ja/nej · dilemma: A/B
    return `<div class="v"><div class="d ${cls}"></div>${t.namn}${t.id === game.me ? ' (du)' : ''}</div>`;
  }).join('');
}
// DILEMMA (Flash Ö-råd): samma röst-overlay som politik, men två alternativ A/B i stället för ja/nej.
let dilemmaVote = null;   // det öppna dilemmats payload (null = ingen dilemma-omröstning öppen)
// ── v3-design (#ov-dilemma): stor bild + fråga, två helfärgade A/B-kort med konsekvenser, lag-pluttar,
//    resultat där vinnarkortet täcker båda. Separat overlay → Mellans politik-röstning (#ov-vote) orörd. ──
let dilemmaPicked = null;   // vilket alternativ DU röstat på i det öppna dilemmat ('A'/'B')
let dzResolved = false;     // true efter avgörandet → voteUpdate skriver INTE över resultatet med pluttar
const _DTL = { richest: 'Rikaste laget', greenest: 'Grönaste laget', all: 'Alla företag', sectorMaterial: 'Material-lagen', sectorPengar: 'Pengar-lagen' };
function dilemmaKons(effects) {   // effekt-lista → konsekvens-rader med spelets riktiga ikoner
  if (!effects || !effects.length) return `<div class="r none">Ingen direkt effekt</div>`;
  return effects.map(e => {
    if (e.type === 'resource') { const sign = e.op === 'sub' ? '−' : '+';
      return `<div class="r">${ico(e.currency === 'material' ? 'material' : 'pengar', 34)}<span class="who">${_DTL[e.target] || e.target}</span><b class="${e.op === 'sub' ? 'down' : 'up'}">${sign}${e.amount}</b></div>`; }
    if (e.type === 'ohalsa') { const up = e.value >= 0;
      return `<div class="r">${ico(up ? 'tillvaxt' : 'industri', 34)}<span class="who">Öns hälsa</span><b class="${up ? 'up' : 'down'}">${up ? '+' : '−'}${Math.abs(e.value)}</b></div>`; }
    if (e.type === 'buildRestriction') return `<div class="r">${ico('varning', 34)}<span class="who">Inga smutsiga byggen nästa år</span></div>`;
    return '';
  }).join('');
}
function renderDilemmaChoices() {
  const p = dilemmaVote; if (!p) return;
  const d = dilemmaById(p.id);   // namn ur payload + effekter ur banken
  const card = L => {
    const a = (d && d.alternativ[L]) || p.alternativ[L] || {};
    const cls = 'dchoice ' + (L === 'A' ? 'a' : 'b') + (dilemmaPicked === L ? ' picked' : '') + (dilemmaPicked && dilemmaPicked !== L ? ' dim' : '');
    return `<div class="${cls}" data-vote="${L}"><div class="toprow"><div class="ab">${L}</div><div class="nm">${(a.namn || '').toUpperCase()}</div></div><div class="kons">${dilemmaKons(a.effects)}</div></div>`;
  };
  $('dz-choices').innerHTML = card('A') + card('B');
  if (!dilemmaPicked) $('dz-choices').querySelectorAll('.dchoice').forEach(el => el.onclick = () => dilemmaVoteClick(el.dataset.vote));
}
const dzVotedSet = new Set();   // lag vars röst redan visats i det öppna dilemmat
function renderDilemmaVotes() {   // lag-pluttar: blå=A / guld=B / grå=ej röstat (som spelets votestat)
  const S = E()?.getState(); if (!S?.teams) return;
  const votes = S.proposal?.votes || {};
  const dots = S.teams.map(t => {
    const v = votes[t.id]; const c = v === 'A' ? 'a' : v === 'B' ? 'b' : '';
    const ny = c && !dzVotedSet.has(t.id); if (c) dzVotedSet.add(t.id);   // bara NYA röster poppar (renderingen körs om vid varje röst)
    return `<div class="v"><div class="d ${c}${ny ? ' pop' : ''}"></div>${t.namn}${t.id === game.me ? ' (du)' : ''}</div>`;
  }).join('');
  $('dz-foot').innerHTML = `<div class="dz-votes">${dots}</div>${dilemmaPicked ? '' : `<div class="dz-hint">Flest röster vinner</div>`}`;
}
function dilemmaVoteClick(choice) {
  if (Date.now() < voteLockUntil || dilemmaPicked) return;   // 3 s klick-lås; en röst per spelare
  audio.play('vote');
  game.vote(choice);
  dilemmaPicked = choice;
  renderDilemmaChoices(); renderDilemmaVotes();
}
function openDilemmaModal(p) {
  dilemmaVote = p; dilemmaPicked = null; dzResolved = false;
  dzVotedSet.clear();
  armVoteLock();   // 3 s innan valen går att trycka
  voteOpenFor = { type: 'dilemma' };
  const img = $('dz-img'), fallback = 'assets/event_tundra_major.png';
  img.onerror = () => { img.onerror = null; img.src = fallback; };   // dilemma-bild saknas → platshållare
  img.src = p.bild || fallback;
  $('dz-q').textContent = p.rubrik;     // dilemmats namn = titel
  $('dz-lead').textContent = p.text;    // kort situation/fråga
  $('dz-timer').className = 'dz-timer politimer'; $('dz-timer').textContent = '';
  renderDilemmaChoices(); renderDilemmaVotes();
  audio.play('ui_open');
  $('ov-dilemma').classList.add('open');
}
// ── Sponsrat (rost): samma v3-vy, men individuellt JA/NEJ i grönt/rött. ──
let sponsratVote = null, sponsratPicked = null;
function sponsratKons(ev, which) {
  if (which !== 'JA') return `<div class="r none">Ingen förändring för ditt företag</div>`;
  let rows = `<div class="r">${ico('pengar', 34)}<span class="who">Ditt företag</span><b>+${ev.ja ?? 0}</b></div>`;
  if (ev.oh) { const up = ev.oh >= 0; rows += `<div class="r">${ico(up ? 'tillvaxt' : 'industri', 34)}<span class="who">Öns hälsa om någon tar emot</span><b class="${up ? 'up' : 'down'}">${up ? '+' : '−'}${Math.abs(ev.oh)}</b></div>`; }
  return rows;
}
function renderSponsratChoices() {
  const p = sponsratVote; if (!p) return;
  const ev = p.event || {};
  const card = (which, label, cls) => {
    const c = 'dchoice ' + cls + (sponsratPicked === which ? ' picked' : '') + (sponsratPicked && sponsratPicked !== which ? ' dim' : '');
    return `<div class="${c}" data-ja="${which === 'JA' ? '1' : '0'}"><div class="toprow"><div class="ab">${which}</div><div class="nm">${label}</div></div><div class="kons">${sponsratKons(ev, which)}</div></div>`;
  };
  $('dz-choices').innerHTML = card('JA', 'TA EMOT', 'ja') + card('NEJ', 'AVSTÅ', 'nej');
  if (p.by !== game.me && sponsratPicked === null) $('dz-choices').querySelectorAll('.dchoice').forEach(el => el.onclick = () => sponsratVoteClick(el.dataset.ja === '1'));
}
function renderSponsratVotes() {
  const S = E()?.getState(); if (!S?.teams) return;
  const votes = S.proposal?.votes || {};
  const dots = S.teams.map(t => {
    const v = votes[t.id]; const c = v === true ? 'ja' : v === false ? 'nej' : '';
    return `<div class="v"><div class="d ${c}"></div>${t.namn}${t.id === game.me ? ' (du)' : ''}</div>`;
  }).join('');
  $('dz-foot').innerHTML = `<div class="dz-votes">${dots}</div>${sponsratPicked !== null ? '' : `<div class="dz-hint">Varje lag väljer själv</div>`}`;
}
function sponsratVoteClick(yes) {
  if (Date.now() < voteLockUntil || sponsratPicked !== null) return;
  audio.play('vote');
  game.vote(yes);
  sponsratPicked = yes ? 'JA' : 'NEJ';
  renderSponsratChoices(); renderSponsratVotes();
}
function openSponsratModal(p) {
  sponsratVote = p; sponsratPicked = null; dilemmaVote = null; dzResolved = false;
  armVoteLock();
  voteOpenFor = p;
  const ev = p.event || {};
  const img = $('dz-img'), fallback = 'assets/event_stad_major.png';
  img.onerror = () => { img.onerror = null; img.src = fallback; };
  img.src = 'assets/dilemma/koncernerbjudande.png';   // tematiskt: koncernens erbjudande (fallback om saknas)
  $('dz-q').textContent = ev.rubrik || 'Ett erbjudande';
  $('dz-lead').textContent = ev.rostFraga || ev.text || '';
  $('dz-timer').className = 'dz-timer politimer'; $('dz-timer').textContent = '';
  renderSponsratChoices(); renderSponsratVotes();
  audio.play('ui_open');
  $('ov-dilemma').classList.add('open');
}
$('btn-ja').addEventListener('click', () => humanVote(dilemmaVote ? 'A' : true));
$('btn-nej').addEventListener('click', () => humanVote(dilemmaVote ? 'B' : false));
function humanVote(choice) {
  if (Date.now() < voteLockUntil) return;             // 3 s klick-lås — hinner uppfatta omröstningen först
  audio.play('vote');
  game.vote(choice);                                  // ja/nej (bool) eller A/B (sträng)
  $('vote-btns').style.display = 'none';
  renderVoteState();
}

// ═══════════════ Register (två vyer: hela Klimatregistret · Din årsberättelse) ═══════════════
// 📖 Din årsberättelse-knappen → BARA den personliga årsberättelsen (så den får plats).
$('btn-log').addEventListener('click', () => { audio.play('ui_open'); renderRegister('arsberattelse'); $('ov-register').classList.add('open'); });
$('btn-reg-close').addEventListener('click', () => { audio.play('ui_close'); $('ov-register').classList.remove('open'); });
// Klimat-spegeln i högerkolumnen är klickbar → hela Klimatregistret (alla fyra lags påverkan).
document.querySelector('.klimat-mirror')?.addEventListener('click', () => { audio.play('ui_open'); renderRegister('klimat'); $('ov-register').classList.add('open'); });
function renderRegister(mode = 'arsberattelse') {
  if (mode === 'klimat') {
    $('reg-title').innerHTML = `${ico('industri', 24)} Klimatregistret — allas påverkan på ön`;
    const lb = E().leaderboards();
    $('reg-body').innerHTML = `<table class="ranktable">` + lb.klimat.map((r, i) =>
      `<tr class="${r.id === game.me ? 'me-row' : ''}"><td>${i + 1}.</td><td>${logoSVG(r.id, 28)} ${r.namn}${r.id === game.me ? ' (du)' : ''} ${i === 0 && r.skada < 0 ? '⚠️' : ''}</td><td class="n" style="color:${r.skada < 0 ? 'var(--led-red)' : 'var(--led-green)'}">${r.skada > 0 ? '+' + r.skada : r.skada}</td></tr>`).join('') + `</table>`;
    return;
  }
  // 'arsberattelse' — bara den personliga delen
  $('reg-title').innerHTML = '📖 Din årsberättelse';
  if (!game.me) { $('reg-body').innerHTML = '<p style="color:var(--dim)">Välj ett lag för att se din årsberättelse.</p>'; return; }
  const c = E().contribution(game.me);
  $('reg-body').innerHTML =
    `<div style="font-size:17px;margin-bottom:12px">Ditt avtryck: <span class="ohplus">+${c.impactPos}</span> / <span class="ohminus">${c.impactNeg}</span> · netto <b>${c.netto >= 0 ? '+' + c.netto : c.netto}</b> · kapital <b style="color:var(--led)">${c.kapital}</b></div>` +
    `<table class="logtable"><tr><th>ÅR</th><th>DU BYGGDE</th><th>ÖN</th></tr>` +
    c.log.map(r => `<tr><td>${r.round}</td><td>${r.namn}</td><td class="${r.oh > 0 ? 'ohplus' : r.oh < 0 ? 'ohminus' : ''}">${r.oh === 0 ? '—' : fmtOh(r.oh)}</td></tr>`).join('') + `</table>`;
}

// ═══════════════ Slutskärm ═══════════════
const EFTERSNACK = [
  '💬 <b>Prata om det:</b> Vem tjänade mest på öns bekostnad — och vem betalade priset?',
  '💬 <b>Prata om det:</b> Hade ön klarat sig om alla byggt likadant som du?',
  '💬 <b>Prata om det:</b> Vilket politiskt förslag hade behövts tidigare?',
];
function showSlut(p) {
  // KRÖNING: vinst → vinnarlagets segrarbild (ÅRETS FÖRETAG); förlust → ön-kollapsade-bilden.
  const simg = $('slut-img');
  simg.style.cssText = `display:block;width:min(560px,70vw);height:auto;border-radius:14px;border:3px solid ${p.won ? 'var(--gold)' : 'var(--oh-red)'};box-shadow:0 10px 40px #000;margin:0 auto 14px`;
  if (p.won && p.winner) {
    simg.onerror = () => { simg.onerror = null; simg.src = `assets/makt/${p.winner.teamId}.png`; };   // saknas segrarbild (t.ex. tundra ännu) → lagets maktbild
    simg.src = `assets/slut/arets-foretag-${p.winner.teamId}.png`;
  } else {
    simg.onerror = null;
    simg.src = 'assets/slut/on-dog.png';
  }
  const vfarg = (p.winner && AREAS.find(x => x.id === p.winner.teamId)?.farg) || 'var(--gold)';   // vinnarlagets egen färg
  $('slut-title').innerHTML = p.won ? `${ico('krona', 48)} <span style="color:${vfarg}">${p.winner.namn.toUpperCase()}</span> BLIR BORGMÄSTARE!` : `${ico('sabotor', 48)} ÖN FÖLL`;
  $('slut-title').className = 'big ' + (p.won ? 'win' : 'lose');
  $('slut-why').innerHTML = p.won
    ? `Öns hälsa slutade på <b style="color:var(--led-green)">${p.oh}</b> — över målet ${p.threshold}. Då vinner det rikaste laget.`
    : p.reason;
  $('slut-cards').innerHTML =
    (p.won ? `<div class="award"><div class="em">${ico('trofe', 58)}</div><h4>Vinnare — rikast</h4><div class="who">${logoSVG(p.winner.teamId, 64)}<span style="color:${vfarg}">${p.winner.namn}</span>${p.winner.teamId === game.me ? ' (du!)' : ''}<span class="val">${p.winner.kapital} kapital</span></div></div>` : '') +
    (p.klimatbov ? `<div class="award" style="border-color:var(--edge2)"><div class="em">${ico('industri', 58)}</div><h4>Klimatbov</h4><div class="who">${logoSVG(p.klimatbov.teamId, 64)}${p.klimatbov.namn}${p.klimatbov.teamId === game.me ? ' (du…)' : ''}<span class="val ohminus">${p.klimatbov.skada} öhälsa</span></div></div>` : '');
  $('slut-efter').innerHTML = EFTERSNACK[Math.floor(Math.random() * EFTERSNACK.length)];
  slutForlust = !p.won;                              // förlust → knappen tar tillbaka till lobbyn (spelet är avslutat)
  $('btn-again').textContent = p.won ? 'STARTA NYTT SPEL' : 'TILLBAKA TILL LOBBYN';
  // Spelledarläge: spelarna ska INTE kunna starta om — spelledaren leder avslutningen (slutdel + TILL LOBBYN/ATTRACT).
  const gmNu = !!E()?.getState()?.gmMode;
  $('btn-again').style.display = gmNu ? 'none' : '';
  $('ov-slut').classList.add('open');
}
let slutForlust = false;
$('btn-again').addEventListener('click', () => {
  if (slutForlust) {                                 // FÖRLUST: tillbaka till lobbyn (inte direkt omstart)
    $('ov-slut').classList.remove('open');
    $('ov-start').classList.add('open');
    if (lastLobby) renderLobby(lastLobby);
  } else {
    game.playAgain();
    // ROBUST OMSTART (online): normalt river realGame.on('start') slut-vyn och bygger om. Skulle
    // klienten ha fastnat i slut-/slutdelssekvensen (kön hänger) → ladda om sidan efter 2,5 s;
    // den återansluter till den nu omstartade servern och hoppar in i runda 1. "Starta nytt spel"
    // gör alltid NÅGOT synligt. Lyckas den normala vägen är ov-slut redan stängd → ingen omladdning.
    if (ONLINE) setTimeout(() => { if ($('ov-slut').classList.contains('open')) location.reload(); }, 2500);
  }
});

// ═══════════════ Toasts & banner ═══════════════
function toast(html, warn = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (warn ? ' warn' : '');
  el.innerHTML = html;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}
async function banner(text, varn, ms) {
  $('bannertxt').innerHTML = text;   // kan innehålla fasett-ikon (SVG); alla anrop skickar kontrollerad text
  $('bannertxt').className = 'bt' + (varn ? ' varn' : '');
  $('banner').style.display = 'flex';
  await delay(ms);
  $('banner').style.display = 'none';
}

// ═══════════════ Lobby (online) + start ═══════════════
let lastLobby = null;
function gamePhase() {
  const S = E()?.getState();
  if (S && S.round >= 1 && !S.over) return 'pagar';
  if (S && S.over) return 'slut';
  return 'lobby';
}
// Visa "ta över"-rutan så snart en bot kör DENNA bänk, göm den när en människa styr.
// Körs vid rundstart / ceremoni-slut OCH vid lobby-uppdateringar (claims bärs i varje meddelande),
// så rutan dyker upp DIREKT när runda 1 börjar för en bot-bänk — inte först när en lobby-händelse
// råkar komma (då kunde den poppa upp mitt i t.ex. runda 5). Låst bänk (?lag=) vet sitt lag via URL:en.
function syncBotOverlay() {
  if (!ONLINE) return;
  if (gamePhase() !== 'pagar') return;
  const claims = realGame.net?.claims || lastLobby?.claims; if (!claims) return;
  const myBench = game.me || params.get('lag'); if (!myBench) return;
  if (claims[myBench] === 'bot') $('ov-bot').classList.add('open');
  else if (claims[myBench] === 'human') $('ov-bot').classList.remove('open');
}
function renderLobby(m) {
  lastLobby = m;
  if (!ONLINE) return;
  const phase = gamePhase();
  syncBotOverlay();
  const LAGEN = ['aker', 'skog', 'tundra', 'stad'];

  // Fyra prickar — en per lag, fylld = spelare ansluten (aldrig "x av 4" i text)
  $('pdots').style.display = 'flex';
  $('pdots').innerHTML = `<span class="lbl">SPELARE</span>` +
    LAGEN.map(id => `<i class="${m.claims[id] === 'human' ? 'on' : ''}"></i>`).join('');

  $('lobbytag').textContent =
    phase === 'pagar' ? 'Spelet pågår. Tryck på en dator — ta över!'
    : phase === 'slut' ? 'Spelet är slut. Starta ett nytt!'
    : game.me ? 'Du är med! Starta när ni är redo.'
    : params.get('lag') ? `Du spelar ${teamName(params.get('lag'))} — vänta på start.`
    : 'Tryck på laget du vill spela.';

  $('lobby').innerHTML = LAGEN.map(id => {
    const st = m.claims[id];
    const mine = game.me === id;
    const takbar = !mine && st !== 'human' && !params.get('lag');   // LÅST BÄNK (?lag=): andra lag aldrig valbara → björnen kan aldrig bli räven
    const status = mine ? `<span class="st du"><i class="dot"></i>DU ${ico('ja', 14)}</span>`
      : st === 'human' ? `<span class="st human"><i class="dot"></i>SPELARE</span>`
      : st === 'bot' ? `<span class="st"><i class="dot"></i>${phase === 'pagar' ? 'DATOR — TA ÖVER!' : `DATOR ${ico('bot', 14)}`}</span>`
      : phase === 'pagar' ? `<span class="st"><i class="dot"></i>—</span>`
      : `<span class="st"><i class="dot"></i>DATOR ${ico('bot', 14)}</span>`;
    return `<button class="lobbyteam ${mine ? 'sel' : ''} ${!takbar && !mine ? 'taken' : ''}" data-lag="${id}" ${takbar ? '' : 'disabled'}>
      ${logoSVG(id, 54)}<b>${teamName(id)}</b>
      <small>${status}</small>
    </button>`;
  }).join('');
  document.querySelectorAll('.lobbyteam:not([disabled])').forEach(b =>
    b.addEventListener('click', () => { audio.unlock(); game.claim(b.dataset.lag); }));

  const btn = $('btn-start');
  if (m.spelledare) {
    // MED SPELLEDARE: spelarna startar inte själva — spelledaren styr starten från panelen.
    btn.style.display = 'none';
    $('startnote').style.display = 'block';
    $('startnote').textContent = 'Spelledaren startar spelet — luta er tillbaka 🎬';
  } else if (phase === 'pagar') { btn.style.display = 'none'; $('startnote').style.display = 'none'; }
  else {
    btn.style.display = '';
    btn.disabled = false;   // startbar när som helst — tomma lag körs av bottar
    btn.textContent = phase === 'slut' ? 'STARTA NYTT SPEL' : 'STARTA SPELET';
    $('startnote').style.display = 'block';
    $('startnote').innerHTML = game.me ? `Lag utan spelare styrs av datorn ${ico('bot', 16)}`
                                       : `Inget lag valt — du tittar på. Datorn spelar alla ${ico('bot', 16)}`;
  }
  // RUMS-FLÖDE: 15 s join-fönster öppet → visa nedräkningen, fler kan claima under tiden.
  if (phase !== 'pagar' && startWindowLeft != null) {
    btn.style.display = '';
    btn.disabled = true;
    btn.textContent = `STARTAR OM ${startWindowLeft}s…`;
    $('startnote').style.display = 'block';
    $('startnote').textContent = 'Spelet börjar strax — fler hinner ansluta! Tryck på ett ledigt lag.';
  }
}
function setConn(ok) {
  const el = $('connstatus');
  el.style.display = '';
  el.className = ok ? 'ok' : 'bad';
  el.textContent = ok ? '● Du är ansluten' : '● Ingen kontakt — försöker igen…';
}

function rebuildFromState(S) {
  if (!S || !S.teams) return;
  $('roundnum').textContent = S.round;
  // PARTIETS config-härledda chrome (år-total, öhälsomål) — MÅSTE sättas om här, inte bara i 'start'.
  // Annars står tutorialmotorns värden (8 år, Mellans mål) kvar efter convergeToGame → Flash visade "ÅR N/8".
  $('roundmax').textContent = E().cfg.rounds;
  $('ohgoal').style.left = `${E().cfg.threshold}%`;
  $('ohgoal-lbl').textContent = `MÅL ${E().cfg.threshold}`;
  map.clearBuildings();
  for (const t of S.teams) t.slots.forEach((b, i) => {
    const c = handFor(t.id).find(x => x.tier === b.tier);   // härled namn + öhälso-effekt för info-rutan
    map.placeBuilding(t.id, i, manifest.buildings[b.asset].file, 135, c ? { namn: c.namn, oh: c.oh, lagNamn: teamName(t.id) } : null);
  });
  updateOh({ value: S.oh, mode: ohMode(S.oh), delta: S.lastDelta });
  $('krisglow').classList.toggle('on', !!S.inCrisis);   // kris-glöden följer statet (återanslutning/övertag/omspel)
  renderTeams(); renderRegs();
  if (!game.me) {
    // Åskådare mitt i pågående spel: behåll lobbyn öppen så man kan ta över en bot.
    $('lobbytag').textContent = 'Spelet pågår — välj ett lag för att ta över dess bot.';
    return;
  }
  initSector();
  renderMe(); renderHand();
  const me = S.teams.find(t => t.id === game.me);
  if (me?.choice) {
    picked = me.choice;
    $('cards').parentElement.classList.add('hand-locked');
    document.querySelector(`#cards .card[data-tier="${me.choice}"]`)?.classList.add('picked');
  }
  if (S.proposal && !S.proposal.resolved) {
    if (S.proposal.kind === 'dilemma') {   // reconnect mitt i ett dilemma → bygg payload ur banken
      const d = dilemmaById(S.proposal.dilemmaId);
      if (d) openDilemmaModal({ id: d.id, rubrik: d.namn, text: d.text, alternativ: { A: { namn: d.alternativ.A.namn }, B: { namn: d.alternativ.B.namn } }, bild: d.bild || null });
    } else openVoteModal(S.proposal);
  }
  $('ov-start').classList.remove('open');
}

// ——— Init ———
// Null-säkert: om cfg ännu saknas (t.ex. lobby innan parti) används manifestets standard, så att
// EN saknad siffra aldrig kan kasta och avbryta resten av modulen (→ döda knappar). Uppdateras
// sedan av rebuildFromState när partiets riktiga variant-config kommit in.
const initCfg = (E()?.cfg) || manifest.config || {};
const CFG_RUNDOR = initCfg.rounds ?? 8, CFG_MAL = initCfg.threshold ?? 60;
const CFG_RED = initCfg.redZone ?? 20, CFG_GREEN = initCfg.greenZone ?? 70;
$('roundmax').textContent = CFG_RUNDOR;
$('ohgoal').style.left = `${CFG_MAL}%`;
$('ohgoal-lbl').textContent = `MÅL ${CFG_MAL}`;
$('ohzones').innerHTML = `<i class="z1" style="width:${CFG_RED}%"></i><i class="z2" style="width:${CFG_GREEN - CFG_RED}%"></i><i class="z3" style="width:${100 - CFG_GREEN}%"></i>`;

if (ONLINE) {
  $('lobby').style.display = 'grid';
  setConn(true);
  if (game._first.started && game._first.state) {
    audio.unlock();
    rebuildFromState(game._first.state);
  }
  if (game.me) initSector();
} else {
  initSector();
}

// ═══════════════ Onboarding fas 1: attract → narrativ → lobby/start ═══════════════
// Allt ska fungera UTAN videoklipp: saknas/felar filen visas placeholder-vyn i stället.
const ONB = manifest.onboarding || {};
const MODE = params.get('mode') || manifest.config?.mode || 'selfplay';   // 'tutorial' | 'selfplay' | 'gm'
// Tutorial lär genom att GÖRA → göm regel-boxen (Bygg/Byt/Rösta) i lobbyn i det läget.
if (MODE === 'tutorial') { const ht = document.getElementById('howto'); if (ht) ht.style.display = 'none'; }

function videoEllerFallback(videoId, fallbackId, src) {
  const v = $(videoId);
  const visaFallback = () => { v.style.display = 'none'; $(fallbackId).style.display = ''; };
  if (!src) { visaFallback(); return null; }
  v.addEventListener('error', visaFallback, { once: true });
  v.src = src;
  return v;
}

// RUMS-FLÖDE: sent ansluten → hoppa in där gruppen är (fasen kommer i hello-ack).
const bootPhase = ONLINE ? (game._first?.phase || (game._first?.started ? 'spel' : 'lobby')) : 'lobby';
const senJoin = ONLINE && (game._first?.started || bootPhase !== 'lobby');   // spel/intro/tutorial/slutdel pågår → hoppa in
if (senJoin) $('ov-attract').classList.remove('open');
else videoEllerFallback('attract-video', 'attract-fallback', ONB.attract)?.play().catch(() => {});
// joinPhase(bootPhase) körs längre ned, EFTER att trailer-/tutorial-vars + hjälpare deklarerats.

$('btn-attract').addEventListener('click', () => {
  audio.unlock();                 // första trycket låser upp ljudet (webbläsarpolicyn)
  audio.play('ui_tap');
  $('attract-video').pause?.();
  $('ov-attract').classList.remove('open');
  // Narrativ-steget borttaget → STARTA SPELET går DIREKT in i lobbyn (ov-start ligger under).
});

function oppnaNarrativ() {
  $('ov-narrativ').classList.add('open');
  const skip = $('btn-narr-skip');
  const klar = () => { $('narrativ-video').pause?.(); $('ov-narrativ').classList.remove('open'); };  // lobbyn ligger under
  skip.addEventListener('click', klar, { once: true });
  const nv = videoEllerFallback('narrativ-video', 'narrativ-fallback', ONB.narrativ);
  if (nv) {
    nv.addEventListener('ended', klar, { once: true });
    nv.addEventListener('error', () => skip.classList.add('visas'), { once: true });
    nv.play().catch(() => skip.classList.add('visas'));
    // Mjuk skip efter en knuff — spelledare (mode=gm) får den direkt. Fånga aldrig användaren.
    setTimeout(() => skip.classList.add('visas'), MODE === 'gm' ? 0 : 5000);
  } else {
    skip.classList.add('visas');  // placeholder med punktmanus → VIDARE direkt
  }
}

// ═══════════════ KOPPLING 2 — intro-trailer (servern äger ljuset) ═══════════════
// Servern broadcastar 'trailer' {src, dur, start_at} när STARTA trycks (före tutorial) eller via
// spelledarens kommando. v2 (2026-11-25): src är filmens HTML-spelare (assets/trailer-film/skarm.html);
// skärmen visar den i en iframe, TYST och synkad mot serverns klocka (?start_at= + /time). Ljudet går
// centralt via hjärnan, ljus-cuesen fyras från servern (EN källa), aldrig härifrån. Döljs vid
// 'trailerDone' — och senast efter dur (failsafe) så flödet (tutorial/spel) ALDRIG fastnar.
// En äldre .mp4-src spelas fortfarande i <video> (bakåtkompatibelt).
let trailerFailsafe = null, trailerRiv = null;
// Mjuk övergång efter filmen (Klara 2026-11-27): filmens sista bild ligger KVAR medan introt tonar in svart ovanpå
// (runIntro), sedan tonar det tomma kontrollrummet fram. Utan intro (t.ex. Flash) tonar filmen i stället ut.
const TRAILER_UTTONING_MS = 1700;
function doljTrailer() {
  clearTimeout(trailerFailsafe); trailerFailsafe = null;
  const ov = $('ov-trailer');
  if (!ov.classList.contains('open') || trailerRiv) return;
  const introFoljer = effMode() === 'tutorial' && gamePhase() === 'lobby' && !!game.me;
  if (!introFoljer) { ov.style.transition = 'opacity 1.4s ease-in-out'; ov.style.opacity = 0; }
  trailerRiv = setTimeout(rivTrailer, TRAILER_UTTONING_MS);
}
function rivTrailer() {
  clearTimeout(trailerRiv); trailerRiv = null;
  const v = $('trailer-video');
  try { v.pause?.(); } catch {}
  const ram = $('trailer-ram');
  if (ram) { ram.removeAttribute('src'); ram.style.display = 'none'; }   // stoppa HTML-filmen helt
  const ov = $('ov-trailer');
  ov.classList.remove('open'); ov.style.transition = ''; ov.style.opacity = '';
}
game.on('trailer', p => {
  trailerVisad = true;   // denna skärm har sett trailern → STARTA ska inte trigga en ny
  const src = p?.src || '';
  const dur = (p && p.dur) ? p.dur : 30;
  clearTimeout(trailerRiv); trailerRiv = null;                          // ev. pågående uttoning får inte riva den nya filmen
  $('ov-trailer').style.transition = ''; $('ov-trailer').style.opacity = '';
  $('ov-trailer').classList.add('open');
  if (/\.html(\?|$)/.test(src) && $('trailer-ram')) {
    const ram = $('trailer-ram');
    $('trailer-video').style.display = 'none'; $('trailer-fallback').style.display = 'none';
    const startAt = Number(p?.start_at) || (Date.now() + 1500);
    ram.style.display = '';
    ram.src = `${src}${src.includes('?') ? '&' : '?'}start_at=${startAt}`;
  } else {
    const v = videoEllerFallback('trailer-video', 'trailer-fallback', src);   // saknas klippet → placeholder
    if (v) {
      v.muted = true;   // TYST på skärmen — trailer-ljudet går centralt via hjärnan (navet → centralhögtalaren)
      v.addEventListener('ended', doljTrailer, { once: true });
      try { v.currentTime = 0; } catch {}
      v.play?.().catch(() => {});   // autoplay nekad → ljussekvensen körs ändå, failsafe/trailerDone döljer
    }
  }
  clearTimeout(trailerFailsafe);
  trailerFailsafe = setTimeout(doljTrailer, (dur + 3) * 1000);   // dölj senast efter filmens längd även om trailerDone uteblir
  // Flödets failsafe följer filmens längd (STARTA sätter en generös provisorisk; här blir den exakt)
  if (efterTrailer) { clearTimeout(efterTrailerFailsafe); efterTrailerFailsafe = setTimeout(korEfterTrailer, (dur + 5) * 1000); }
});
game.on('trailerDone', () => { doljTrailer(); korEfterTrailer(); });

// Trailern spelas EN gång när STARTA trycks (efter att alla anslutit), sedan fortsätter flödet
// (tutorial → riktiga spelet) när den är klar. Servern broadcastar 'trailer' till ALLA skärmar.
let efterTrailer = null, trailerVisad = false, efterTrailerFailsafe = null;
function startEfterTrailer(fn) {
  if (trailerVisad || !game.playTrailer) { fn(); return; }    // redan sedd, eller lokalt läge utan server → kör direkt
  trailerVisad = true;
  efterTrailer = fn;
  game.playTrailer();                                         // → servern: broadcast 'trailer' + ljussekvens (en källa)
  clearTimeout(efterTrailerFailsafe);
  efterTrailerFailsafe = setTimeout(korEfterTrailer, 120000); // provisorisk failsafe; 'trailer'-eventet sätter filmens längd + 5 s
}
function korEfterTrailer() {
  clearTimeout(efterTrailerFailsafe); efterTrailerFailsafe = null;
  if (!efterTrailer) return;
  const f = efterTrailer; efterTrailer = null;
  f();
}
// GATAD trailer: tryck på skärmen gör INGET — introfilmen ska inte gå att hoppa över/avbryta av
// spelarna. Den avslutas av sig själv (video slut / trailerDone / failsafe). Spelledaren kan
// fortfarande skippa den från panelen (SKIPPA INTRO).
// Nytt parti (replay) → tillåt att trailern + tutorialen körs igen vid nästa STARTA.
game.on('gameEnd', () => { trailerVisad = false; tutRunning = false; });

// ═══════════════ RUMS-FLÖDE: 15 s start-fönster · startGo · late-join · omstart · skippa intro ═══════════════
// Det BEFINTLIGA flödet (trailer → tutorial → runda 1) rörs inte — fönstret läggs FÖRE det, och
// late-join/omstart hoppar in i / river ner rätt fas. Allt gardat av ONLINE (lokalt läge opåverkat).

// Vad som händer EFTER trailern (tutorial eller riktiga spelet). I tutorial-läge krävs ett lag.
// Effektivt onboarding-läge: VARIANTENS mode (flash=selfplay/mellan=tutorial) styr, inte manifestet.
// URL ?mode= vinner; sen partiets config (E().cfg.mode); sen manifestet; sen selfplay. Fixar att Flash
// (mode:selfplay) annars körde Mellans manifest-tutorial och fastnade vid STARTA.
function effMode() { return params.get('mode') || realGame?.net?.variant?.mode || E()?.cfg?.mode || manifest.config?.mode || 'selfplay'; }
function computeFortsatt() {
  if (effMode() === 'tutorial' && gamePhase() === 'lobby') {
    if (!game.me) return null;                 // utan lag i tutorial → den här skärmen tittar bara på
    return () => runTutorial();
  }
  if (game.me) initSector();
  return () => game.startGame({ spelledare: false });
}
// Kör det befintliga trailer→tutorial→runda-1-flödet (anropas vid 'startGo' på alla skärmar).
function beginStartFlow() {
  if (gamePhase() !== 'lobby') return;         // redan igång/slut → gör inget
  // Ta med skärmar som ännu står kvar på attract/narrativ in i flödet (rummet startar synkat).
  try { audio.unlock(); } catch {}
  $('ov-attract')?.classList.remove('open');
  $('ov-narrativ')?.classList.remove('open');
  const f = computeFortsatt();
  if (f) startEfterTrailer(f);
}

// Late-join: hoppa in där gruppen är.
function joinIntro() {
  trailerVisad = true;
  const v = videoEllerFallback('trailer-video', 'trailer-fallback', ONB.trailer);
  $('ov-trailer').classList.add('open');
  if (v) { v.muted = true; try { v.currentTime = 0; } catch {} v.addEventListener('ended', doljTrailer, { once: true }); v.play?.().catch(() => {}); }
  // När introt är klart (trailerDone/skip) → kör samma flöde som alla andra (lag räknas om då).
  efterTrailer = () => { const f = computeFortsatt(); if (f) f(); };
  clearTimeout(efterTrailerFailsafe);
  efterTrailerFailsafe = setTimeout(korEfterTrailer, 33000);
}
function joinPhase(ph) {
  if (!ONLINE || ph === 'lobby') return;
  $('ov-attract').classList.remove('open');
  $('ov-narrativ')?.classList.remove('open');
  if (ph === 'intro') { joinIntro(); return; }
  if (ph === 'tutorial') { if (game.me && !tutRunning) runTutorial(); return; }   // egen solo-tutorial; utan lag → stanna i lobbyn
  // 'spel' → ta-över via claim + rebuildFromState (sköts av game._first.started-blocket ovan).
  // 'slutdel' → servern skickar aktuellt steg direkt efter hello → slutdel-eventsen fyller vyn.
}

// Omstart (spelledaren) → riv ner allt på den här skärmen och visa lobbyn.
function fireTutAbort() { tutAbort = true; stopTutIdleWatch(); while (_tutAborters.length) _tutAborters.shift()('abort'); }
// Väntläget efter tutorialen: små diamanter (en per lag, grön = redo) + liten "X/Y lag redo"-text
// — inte den stora nedräkningssiffran.
function renderWaitDots(m) {
  const klara = m?.klara?.length ?? 0, humans = m?.humans ?? 4;
  $('cd-num').style.display = 'none';
  $('cd-dots').innerHTML = Array.from({ length: humans }, (_, i) => `<i class="${i < klara ? 'on' : ''}"></i>`).join('');
  $('cd-dots').style.display = 'flex';
  $('cd-sub').textContent = `${klara}/${humans} lag redo`;
  $('cd-sub').style.display = 'block';
}

function resetToLobbyUI() {
  stangKroning();
  fireTutAbort();                               // avbryt ev. pågående solo-tutorial rent
  tutRunning = false; tutInCeremony = false;
  vantarLag = false; lastTutReady = null;       // nollställ väntläget/lag-räknaren
  startWindowLeft = null;
  efterTrailer = null;
  trailerVisad = false;                         // BUGFIX: annars hoppas trailern över nästa parti efter "TILL LOBBYN" (nollades bara vid gameEnd)
  clearTimeout(efterTrailerFailsafe); efterTrailerFailsafe = null;
  rivTrailer();
  ['ov-attract', 'ov-narrativ', 'ov-trailer', 'ov-roll', 'ov-intro', 'ov-ready', 'ov-countdown', 'ov-slut', 'ov-slutdel',
   'ov-award', 'ov-event', 'ov-vote', 'ov-choose', 'ov-trade', 'ov-tradein', 'ov-register', 'ov-paus', 'ov-bot', 'ov-mission', 'ov-power', 'ov-result', 'ov-year'].forEach(id => $(id)?.classList.remove('open'));
  tutIdleSent = false;
  $('tutveil').style.display = 'none';
  $('tutbox').style.display = 'none';
  $('tutbarrier').style.display = 'none';
  $('banner').style.display = 'none';
  tutFocus(null);
  map.clearBuildings();
  // Nollställ topbaren så inga gamla rund-/öhälso-siffror ligger kvar bakom lobbyn.
  try { $('roundnum').textContent = '–'; const oh0 = E()?.cfg?.ohStart ?? 50; updateOh({ value: oh0, mode: ohMode(oh0), delta: 0 }); } catch {}
  game.attach(realGame);                        // tutorialens övningsmotor var ev. påkopplad → tillbaka till servern
  $('ov-start').classList.add('open');
  if (lastLobby) renderLobby(lastLobby);
  toast('Spelledaren tog alla tillbaka till lobbyn');
}

// Lämna tutorialen/väntläget och hoppa in i det riktiga spelet (anropas när servern startat runda 1).
// Idempotent: river ner tutorial-overlays + nedräkning och bygger vyn från serverns state.
function convergeToGame() {
  fireTutAbort();
  tutRunning = false; tutInCeremony = false;
  $('ov-ready').classList.remove('open');
  $('ov-countdown').classList.remove('open', 'hot');
  $('cd-lbl').textContent = 'SPELET BÖRJAR OM';
  $('tutveil').style.display = 'none'; $('tutbox').style.display = 'none'; $('tutbarrier').style.display = 'none';
  $('banner').style.display = 'none'; tutFocus(null);
  game.attach(realGame);
  loggClear();          // online-vägen in i spelet → töm tutorialens övnings-händelser (loggen tom vid runda 1)
  const S = realGame.E()?.getState();
  if (S && S.round >= 1 && !S.over) rebuildFromState(S);
}

// OBS: dessa server-events måste lyssnas på realGame (ServerNet), INTE proxyn `game` — under
// tutorialen är proxyn kopplad till övningsmotorn och släpper inte igenom serverns events.
// (Samma mönster som tutBarrier, som använder realGame.on/realGame.net direkt.)
if (ONLINE) {
  realGame.on('startWindow', m => {              // 15 s-fönstret tickar → visa nedräkningen i lobbyn
    startWindowLeft = m.left;
    if (lastLobby) renderLobby(lastLobby);
  });
  realGame.on('startGo', () => {                 // fönstret klart → kör det riktiga flödet på alla skärmar
    startWindowLeft = null;
    beginStartFlow();
  });
  realGame.on('startWindowCancel', () => {       // fönstret avbrutet (t.ex. omstart) → åter till normal lobby
    startWindowLeft = null;
    if (lastLobby) renderLobby(lastLobby);
  });
  realGame.on('tilllobby', () => resetToLobbyUI());  // spelledaren tog alla till lobbyn (kan ske mitt i tutorialen)
  realGame.on('tillattract', () => {                 // spelledaren tog alla hela vägen till ATTRACT-skärmen (ny grupp)
    // Ny grupp → nollställ trailer-minnet EXPLICIT så introfilmen spelas igen vid nästa STARTA
    // (förlita dig inte på tilllobby-ordningen). Servern nollställer sina trailer-flaggor i resetToLobby.
    trailerVisad = false; efterTrailer = null;
    clearTimeout(efterTrailerFailsafe); efterTrailerFailsafe = null;
    $('ov-attract').classList.add('open');
    const v = videoEllerFallback('attract-video', 'attract-fallback', ONB.attract);
    v && v.play?.().catch(() => {});
  });
  // Gate 4: SERVERN äger den gemensamma nedräkningen. Rita 10→0 synkat på alla skärmar.
  // Väntläge efter tutorial: uppdatera "X/Y lag klara" medan vi väntar in alla lag.
  realGame.on('tutReadyUpdate', m => {
    lastTutReady = m;
    if (vantarLag) { $('cd-lbl').textContent = 'VÄNTAR PÅ DE ANDRA LAGEN'; renderWaitDots(m); }
  });
  realGame.on('startCountdown', m => {
    tutInCeremony = true;                      // håll konvergens-läget (även om vi kom hit utan tutorial)
    vantarLag = false;                         // alla är inne → sluta visa lag-räknaren
    $('cd-dots').style.display = 'none'; $('cd-sub').style.display = 'none'; $('cd-num').style.display = '';   // tillbaka till stora nedräkningssiffran
    $('cd-lbl').textContent = 'SPELET BÖRJAR OM';
    const el = $('cd-num');
    el.textContent = m.left;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';   // starta om pop
    $('ov-countdown').classList.toggle('hot', m.left <= 3);
    $('ov-countdown').classList.add('open');
    audio.play('ui_tap');
  });
  realGame.on('startCountdownCancel', () => {   // nedräkningen avbröts (omstart) → stäng overlayn
    $('ov-countdown').classList.remove('open', 'hot');
    $('cd-lbl').textContent = 'SPELET BÖRJAR OM';
  });
  // Servern startade runda 1 (den gemensamma grinden slog till) → lämna tutorialen/väntläget och hoppa
  // in i spelet. Gäller BÅDE lär-delen och ceremonin/nedräkningen — EN källa (servern) startar partiet.
  realGame.on('start', () => {
    if (tutRunning && game.backend !== realGame) { convergeToGame(); return; }   // tutorial/ceremoni → spel
    // OMSTART (STARTA NYTT SPEL efter slut): spelet är redan på realGame. Riv ner slut-/öråd-overlays
    // och bygg vyn på nytt DIREKT (denna lyssnare går inte via den seriella kön → funkar även om kön
    // fastnat i slut-/finalsekvensen, vilket var varför "spela igen" inte gjorde något).
    if (game.backend === realGame) {
      fireTutAbort();
      ['ov-slut', 'ov-award', 'ov-choose', 'ov-vote', 'ov-power', 'ov-result', 'ov-year', 'ov-bot', 'ov-event', 'ov-register'].forEach(id => $(id)?.classList.remove('open'));
      pendingSlut = null; clearTimeout(slutFailsafe); slutFailsafe = null; cerNastaRunda = null;
      map.clearBuildings(); loggClear();
      const S = realGame.E()?.getState();
      if (S && S.round >= 1 && !S.over) rebuildFromState(S);
      renderMe(); renderTeams(); renderRegs(); renderHand();
    }
  });
}

// Sent ansluten: nu finns alla trailer-/tutorial-hjälpare → hoppa in i rätt fas.
if (senJoin) joinPhase(bootPhase);

// ═══════════════ Runda 0 — tutorial (mode='tutorial') ═══════════════
// En skriptad övningsrunda på en EGEN kastmotor bakom samma UI: deterministiska botar,
// ingen timer, varje beat gör-gated men hoppbar och auto-utförd vid timeout (fastnar aldrig).
// Kastas när den är klar — det riktiga spelet startar orört på runda 1. Inga regler rörda.

function makeTutorial(myLag, baseCfg) {
  const em = makeEmitter();
  // Övningsmotorn kör den VALDA versionens regler (år, tröskel, beslutssystem) men behåller övnings-
  // ekonomin 26/26 som garanterar att "slå i väggen → byt"-steget fungerar. baseCfg = variantens config.
  const engine = new EcoLoco({ ...(baseCfg || manifest.config || {}), humanTeam: myLag, startPengar: 26, startMaterial: 26 });
  engine.setGm(true);   // övningen ska aldrig slumpa in en händelse — gm-flaggan kväver auto-dragningen (motorn kastas direkt efteråt)
  const bots = ['aker', 'skog', 'tundra', 'stad'].filter(id => id !== myLag);
  for (const ev of ['start', 'build', 'trade', 'proposalOpened', 'proposalResolved', 'income', 'ohalsa', 'event'])
    engine.on(ev, p => em.emit(ev, p));
  engine.on('roundStart', p => { if (p.round === 1) em.emit('roundStart', { round: 0 }); });  // runda 2 skickas aldrig — övningen är slut
  engine.on('roundEnd', () => em.emit('roundEnd', { round: 0 }));
  engine.on('award', p => em.emit('award', { round: 0, led: p.led, eld: p.eld, sab: p.sab }));  // övningen visar alla tre priserna
  return {
    online: false, me: myLag, E: () => engine,
    on: em.on,
    startGame: () => engine.start(),
    selectCard: async t => engine.selectCard(myLag, t),
    trade: async (to, give, gc, get, gc2) => {     // botarna säger alltid ja i övningen
      const r = engine.transfer(myLag, to, give, gc, get, gc2);
      return r.ok ? { ok: true } : { ok: false, why: r.reason };
    },
    openProposal: type => engine.openProposal(type, myLag),   // tutorial: spelaren lägger sitt EGET förslag
    vote: yes => engine.vote(myLag, yes),
    klar: () => { em.emit('resolveStart', {}); engine.endRound(); },
    awardsKlara: () => {}, playAgain: () => {},
    script: {
      bots,
      botRosta: id => { engine.vote(id, true); em.emit('voteUpdate', {}); },
    },
  };
}

const tutWaitP = (pred, ms = 150) => new Promise(res => {
  const i = setInterval(() => { if (pred()) { clearInterval(i); res(); } }, ms);
});
function tutOnce(ev, pred) {
  return new Promise(res => {
    let done = false;
    game.on(ev, p => { if (!done && (!pred || pred(p))) { done = true; res(p); } });
  });
}
function tutFocus(sel) {
  document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
  if (sel) document.querySelector(sel)?.classList.add('tut-focus');
}
// ── Pekande coach-hand ─────────────────────────────────────────────────────────
// Pekar ut knappen/byggnaden man ska trycka på. Scen-koordinater (1920×1080) som tutbox.
// 10 s-nudge på GÖR-knappar + en scriptad bygg-info-demon (handen klickar en byggnad åt en).
const TUT_TIP = { x: 41, y: 8 };                 // fingertoppens läge i hand-SVG:n (0–100)
function _tutHand() { return $('tut-hand'); }
function _tutStage() { const s = document.getElementById('stage'); const r = s.getBoundingClientRect(); return { r, scale: r.width / 1920 || 1 }; }
function _tutHandFill() { const h = _tutHand(); const inner = h?.querySelector('.inner'); if (inner && !inner.dataset.filled) { inner.innerHTML = ico('hand', 92); inner.dataset.filled = '1'; } }
// Elementets rektangel i scen-koordinater.
function _tutScene(el) {
  const { r, scale } = _tutStage(), e = el.getBoundingClientRect();
  return { x: (e.left - r.left) / scale, y: (e.top - r.top) / scale, w: e.width / scale, h: e.height / scale,
           cx: (e.left - r.left + e.width / 2) / scale, cy: (e.top - r.top + e.height / 2) / scale,
           right: (e.right - r.left) / scale, bottom: (e.bottom - r.top) / scale };
}
// Placera handens fingertopp vid scen-punkt (x,y); dir 'up'|'down'|'left'; jump=true hoppar (ingen glid).
function tutHandTip(x, y, dir = 'up', jump = false) {
  const h = _tutHand(); if (!h) return; _tutHandFill();
  h.classList.toggle('down', dir === 'down');
  h.classList.toggle('left', dir === 'left');
  if (jump) { h.style.transition = 'none'; }
  h.style.display = 'block';
  const hw = h.offsetWidth, hh = h.offsetHeight, X = TUT_TIP.x / 100, Y = TUT_TIP.y / 100;
  let tx, ty;
  if (dir === 'down')      { tx = hw * (1 - X); ty = hh * (1 - Y); }
  else if (dir === 'left') { tx = hw * Y;       ty = hh * (1 - X); }   // rotation -90° om centrum (fingret pekar vänster)
  else                     { tx = hw * X;       ty = hh * Y; }
  h.style.left = (x - tx) + 'px'; h.style.top = (y - ty) + 'px';
  if (jump) { void h.offsetWidth; h.style.transition = ''; }
}
// Peka på ett element (knapp): under + upp om i övre halvan, annars över + ned.
function tutHandAtEl(sel, jump = false) {
  const el = document.querySelector(sel); if (!el) { tutHandHide(); return; }
  const s = _tutScene(el), dir = s.cy < 1080 * 0.55 ? 'up' : 'down';
  if (dir === 'up') tutHandTip(s.cx, s.bottom + 6, 'up', jump);
  else tutHandTip(s.cx, s.y - 6, 'down', jump);
}
// Peka åt VÄNSTER in på ett element → handen hamnar på HÖGER sida om det.
function tutHandRightOfEl(sel, gap = 10, jump = false) {
  const el = document.querySelector(sel); if (!el) { tutHandHide(); return; }
  const s = _tutScene(el);
  tutHandTip(s.right + gap, s.cy, 'left', jump);
}
function tutHandHide() { const h = _tutHand(); if (h) { h.style.display = 'none'; h.className = ''; } }
function tutHandBob(on) { const h = _tutHand(); if (h) h.classList.toggle('bob', !!on); }
// Knacket: fingret böjs; responsen (onContact) fyras vid BOTTEN av böjen (~160 ms) så svaret känns direkt.
async function tutHandTap(onContact) { const h = _tutHand(); if (!h) return; h.classList.remove('tap'); void h.offsetWidth; h.classList.add('tap'); await delay(160); onContact?.(); await delay(220); h.classList.remove('tap'); }
// Scriptad demo: handen visar att man kan klicka byggnaderna på kartan (efter bygge+byte).
async function tutBuildingDemo() {
  if (tutAbort) return;
  const all = [...map.svg.querySelectorAll('g[data-building]')];
  const blds = all.filter(b => b.style.cursor === 'pointer');   // bara byggnader med info-ruta (klickbara)
  if (!blds.length) return;                      // inget klickbart byggt → hoppa säkert
  const bld = blds[0], h = _tutHand();
  const done = () => { tutHandHide(); $('tut-block').style.display = 'none'; tutFocus(null); };
  tutFocus('.col-island');                        // lyft kartan ljus över slöjan
  $('tut-block').style.display = 'block';         // ingen användarklick under demon
  await Promise.race([delay(500), tutAbortP()]); if (tutAbort) return done();
  let s = _tutScene(bld);
  // dyker upp nära byggnaden (några cm bort), tonar in
  h.classList.add('fade');
  tutHandTip(s.cx + s.w * 0.7, s.cy + s.h * 0.9, 'up', true);
  await delay(60); h.classList.remove('fade');
  await Promise.race([delay(560), tutAbortP()]); if (tutAbort) return done();
  // kort, långsam rörelse fram till byggnaden → knacka → info visas
  s = _tutScene(bld); tutHandTip(s.cx, s.cy, 'up');
  await Promise.race([delay(1050), tutAbortP()]); if (tutAbort) return done();
  await tutHandTap(() => bld.dispatchEvent(new MouseEvent('click', { bubbles: true })));   // info visas vid trycket
  await Promise.race([delay(1800), tutAbortP()]); if (tutAbort) return done();
  // rörelse bredvid byggnaden → knacka → info stängs
  s = _tutScene(bld); tutHandTip(Math.min(s.right + s.w * 0.5, s.cx + 260), s.cy + s.h * 0.15, 'up');
  await Promise.race([delay(1000), tutAbortP()]); if (tutAbort) return done();
  await tutHandTap(() => map.svg.dispatchEvent(new MouseEvent('click', { bubbles: true })));   // stänger vid trycket
  await Promise.race([delay(600), tutAbortP()]); if (tutAbort) return done();
  // handen försvinner
  h.classList.add('fade');
  await Promise.race([delay(480), tutAbortP()]);
  done();
}

// ── FLASH-COACH ────────────────────────────────────────────────────────────────
// Lätt coachning OVANPÅ det riktiga år 1 (inget övningsår): SAMMA rutor som Mellan-tutorialen.
// Sekvens: "Bygg en byggnad" + hand på korten → (eget bygge) skärmen LÅSES, popup inkomst↑ sedan öhälsa↓
//   → efter ~10 s: hand på BYT VALUTOR-knappen + "Byt", försvinner när knappen klickas. Resten körs fritt.
// Gatas på att aktiva varianten har coach-tutorial (Flash). Rör inte Mellans runTutorial.
const flashCoach = { phase: null };   // null | 'bygg' | 'konsekvens' | 'byt-vant' | 'byt' | 'done'
function activeVariantId() { return (ONLINE ? realGame?.net?.variant?.selected : null) || E()?.cfg?.id || null; }
function flashCoachOn() { const f = tutorialFor(activeVariantId()); return !!(f && f.mode === 'coach'); }
let _coachTimer = null, _coachBytClick = null;
// En coach-ruta vid ett ankare. Handen hanteras separat av anroparen (bredvid rutan, ej under).
function coachBox(txt, anchorName, { ic = null } = {}) {
  const b = $('tutbox'), anc = tutAnchor(anchorName);
  $('tut-txt').innerHTML = txt;
  setTutIc(ic);
  $('tut-dots').style.display = 'none';                                // coach-rutor har inga beat-prickar
  $('tut-next').style.display = 'none';
  tutHandHide();                                                       // ev. tidigare hand bort; sätts om nedan
  b.style.display = 'block';                                           // visa först så besidePos kan mäta
  const pos = (anc.side && besidePos(anc.sel, anc.side)) || { x: anc.x ?? 960, y: anc.y ?? 540 };
  b.style.left = pos.x + 'px'; b.style.top = pos.y + 'px';
  audio.play('ui_tap');
}
function _coachHl(sel, on) { document.querySelectorAll(sel).forEach(el => el.classList.toggle('coach-hl', on)); }
// Placera handen BREDVID tutrutan, pekande rakt ner (mot korten) — inte på ett enskilt kort.
function tutHandByBox(side = 'right', gap = 20) {
  const b = $('tutbox'); if (!b || b.style.display === 'none') return;
  const { r: sr, scale } = _tutStage();
  const br = b.getBoundingClientRect();
  const bx = (br.left - sr.left) / scale, by = (br.top - sr.top) / scale, bw = br.width / scale, bh = br.height / scale;
  const tipX = side === 'right' ? bx + bw + gap : bx - gap;
  tutHandTip(tipX, by + bh + 8, 'down', true);   // fingertopp strax under rutan, bredvid den → pekar rakt ner
}
function coachClear() {
  clearTimeout(_coachTimer);
  if (_coachBytClick) { $('btn-trade')?.removeEventListener('click', _coachBytClick); _coachBytClick = null; }
  _coachHl('#cards .card', false); _coachHl('#btn-trade', false);
  const blk = $('tut-block'); blk.style.display = 'none'; blk.className = '';
  $('tutbox').style.display = 'none'; tutHandHide();
}
// 1) Byggfas år 1 → "Bygg en byggnad". Korten lyser + pulserar; handen pekar uppifrån ner, BREDVID rutan.
function flashCoachStart(round) {
  if (!flashCoachOn() || round !== 1 || flashCoach.phase) return;       // bara Flash, bara år 1, en gång
  flashCoach.phase = 'bygg';
  coachBox('Bygg en byggnad', 'byggkort', { ic: 'bygge' });
  _coachHl('#cards .card', true);                                       // de tre korten lyser i kanten + pulserar
  tutHandByBox('right'); tutHandBob(true);                             // hand BREDVID rutan, pekar rakt ner (inte på ett enskilt kort)
}
// 2) Eget bygge → nedsläckt + oklickbar skärm, popup inkomst↑ sedan öns hälsa↓ (samma rutor som tutorialen).
async function flashCoachOnBuild(p) {
  if (flashCoach.phase !== 'bygg' || p.teamId !== game.me) return;
  flashCoach.phase = 'konsekvens';
  _coachHl('#cards .card', false);
  const blk = $('tut-block'); blk.className = 'dim'; blk.style.display = 'block';   // nedsläckt + oklickbar under konsekvensen
  const inc = mySector === 'pengar' ? p.card.gp : p.card.gm;            // inkomst i lagets egen valuta
  coachBox(`<span class="lbl">Du tjänar</span> +${inc} ${curIco(mySector, 26)} <span class="per">/ år</span>`, 'prodBox');
  await delay(3200); if (flashCoach.phase !== 'konsekvens') return;
  const oh = p.card.oh, sign = oh > 0 ? '+' : '';
  coachBox(`Men öns hälsa <b class="${oh < 0 ? 'neg' : 'pos'}">${sign}${oh}</b>`, 'topbar');
  await delay(3600); if (flashCoach.phase !== 'konsekvens') return;
  blk.style.display = 'none'; blk.className = ''; $('tutbox').style.display = 'none';   // lås upp, vila
  flashCoach.phase = 'byt-vant';
  _coachTimer = setTimeout(flashCoachShowByt, 10000);                   // ~10 s senare: BYT-prompten
}
// 3) "Byt" + BYT VALUTOR-knappen lyser/pulserar + handen pekar på den. Försvinner när knappen klickas.
function flashCoachShowByt() {
  if (flashCoach.phase !== 'byt-vant') return;
  flashCoach.phase = 'byt';
  coachBox('Byt', 'byt1', { ic: 'byt' });
  _coachHl('#btn-trade', true);
  tutHandRightOfEl('#btn-trade', 10, true); tutHandBob(true);           // hand på HÖGER sida om knappen, pekar vänster in på den
  _coachBytClick = () => { flashCoach.phase = 'done'; coachClear(); };
  $('btn-trade')?.addEventListener('click', _coachBytClick, { once: true });
}
function flashCoachStop() { if (flashCoach.phase && flashCoach.phase !== 'done') { flashCoach.phase = 'done'; coachClear(); } }

// RUMS-FLÖDE: ett löfte som resolvar till 'abort' när spelledaren tar alla till lobbyn mitt i tutorialen.
// Varje väntepunkt i tutorialen racear mot detta → tutorialen släpper direkt och runTutorial returnerar.
function tutAbortP() { return new Promise(res => { if (tutAbort) res('abort'); else _tutAborters.push(res); }); }
// Ingen "hoppa över"-knapp och ingen kort auto-timer: spelaren måste GÖRA steget (bygga/byta/rösta)
// för att komma vidare. En lång inaktivitets-limit (autoMs) gör ändå steget åt en övergiven skärm
// så en bänk utan spelare kan drivas vidare (bot) och inget fastnar.
// Placera tutbox intill ett element (knapp) i SCEN-koordinater (1920×1080), oberoende av skärmskalning.
// side: 'left' = rutan till vänster om knappen, 'right' = till höger. Vertikalt centrerad, klampad till scenen.
function besidePos(sel, side) {
  const stage = document.getElementById('stage'), el = document.querySelector(sel), box = $('tutbox');
  if (!stage || !el) return null;
  const sr = stage.getBoundingClientRect(), er = el.getBoundingClientRect();
  const scale = sr.width / 1920 || 1;
  const bx = (er.left - sr.left) / scale, by = (er.top - sr.top) / scale, bw = er.width / scale, bh = er.height / scale;
  const boxW = box.offsetWidth, boxH = box.offsetHeight, gap = 24;
  let x = side === 'left' ? bx - boxW - gap : bx + bw + gap;
  let y = by + bh / 2 - boxH / 2;
  x = Math.max(16, Math.min(1920 - boxW - 16, x));
  y = Math.max(16, Math.min(1080 - boxH - 16, y));
  return { x, y };
}
async function tutBeat({ ix, txt, ic, x, y, focus, until, autoDo, autoMs = 120000, beside, side, nudge: nudgeTo }) {   // lång cool-down: gruppen hinner läsa + klicka utan att steget görs åt dem
  if (tutAbort) return;                       // omstart under tutorialen → visa ingenting mer
  tutFocus(focus);
  const b = $('tutbox');
  $('tut-txt').innerHTML = txt; setTutIc(ic);
  [...$('tut-dots').children].forEach((d, i) => d.classList.toggle('on', i <= ix));
  b.style.display = 'block';                   // visa först så vi kan mäta rutan innan vi placerar den
  const pos = (beside && besidePos(beside, side)) || { x, y };   // intill knappen om 'beside' anges, annars fasta x/y
  b.style.left = pos.x + 'px'; b.style.top = pos.y + 'px';
  audio.play('ui_tap');
  // HAND-NUDGE: handen pekar på knappen först efter 10 s utan tryck (hjälp, inte direkt).
  const nudgeSel = nudgeTo || beside || focus;
  let nudge = nudgeSel ? setTimeout(() => { tutHandAtEl(nudgeSel, true); tutHandBob(true); }, 10000) : null;
  let tmo = null;
  const timeP = new Promise(res => { tmo = setTimeout(() => res('timeout'), autoMs); });   // inaktivitets-limit (ej snabb auto)
  const r = await Promise.race([until, timeP, tutAbortP()]);
  clearTimeout(tmo); clearTimeout(nudge); tutHandHide();
  if (r === 'abort') { b.style.display = 'none'; tutFocus(null); return; }
  if (r === 'timeout') { await autoDo?.(); await Promise.race([until, delay(4000), tutAbortP()]); }  // inaktiv → handlingen görs åt en
  b.style.display = 'none';
  tutFocus(null);
}
async function tutBarrier(beat) {
  if (!ONLINE || humanCount() <= 1) return;          // solo: passera direkt
  if (beat !== 5) return;                            // synk BARA vid nedräkningen (beat 5) — alla kör fritt i egen takt innan
  realGame.net.tutBeat(beat);
  const bar = $('tutbarrier');
  let klart = false;
  const allaP = new Promise(res => {
    realGame.on('tutUpdate', m => {
      if (klart || m.beat !== beat) return;
      $('tutbarrier-dots').innerHTML = Array.from({ length: m.humans }, (_, i) =>
        `<i class="${i < m.klara.length ? 'on' : ''}"></i>`).join('');
      if (m.klara.length >= m.humans) { klart = true; res(); }
    });
  });
  const start = Date.now();
  await Promise.race([allaP, delay(700), tutAbortP()]);           // syns bara om någon faktiskt är långsammare
  if (!klart && !tutAbort) {
    bar.style.display = 'flex';
    await Promise.race([allaP, delay(12000 - (Date.now() - start)), tutAbortP()]);  // timeout: en seg bänk låser aldrig de andra
    klart = true;
  }
  bar.style.display = 'none';
}

// Ikon-chip i övningsrutan (valfri; ic = ikon-id ur icons.js).
function setTutIc(id) { const e = $('tut-ic'); if (!e) return; e.innerHTML = id ? ico(id, 64) : ''; e.style.display = id ? 'flex' : 'none'; }
// Konsekvens-beat ("SE"): spelaren läser i egen takt och trycker NÄSTA för att gå vidare.
function tutSay({ ix, txt, ic, x, y, focus, hold }) {   // hold = ingen auto-timeout (info-rutor före tutorialen väntar på tryck)
  if (tutAbort) return Promise.resolve();      // omstart under tutorialen → visa ingenting mer
  return new Promise(res => {
    tutFocus(focus);
    const b = $('tutbox');
    b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.display = 'block';
    $('tut-txt').innerHTML = txt; setTutIc(ic);
    [...$('tut-dots').children].forEach((d, i) => d.classList.toggle('on', i <= ix));
    const next = $('tut-next'); next.style.display = 'inline-block';
    audio.play('ui_tap');
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      next.onclick = null; clearTimeout(tmo);
      next.style.display = 'none'; b.style.display = 'none'; tutFocus(null); res();
    };
    next.onclick = finish;
    const tmo = hold ? null : setTimeout(finish, 120000);   // lång cool-down (2 min) så man hinner läsa; hold → vänta på tryck; obemannad skärm fångas av 90 s idle→bot
    tutAbortP().then(finish);                // omstart → släpp direkt (finish är idempotent via done)
  });
}

// Startceremoni: ÄR DU REDO? → (vänta in alla lag) → nedräkning 10→0 → RUNDA 1.
// Riggen (LED-chase, riser-soundscape, vitt ljus 3 s) styrs av semantiska cues: ecoloco/rigg/ceremoni.
async function startCeremony(fromIntro = false) {
  tutInCeremony = true;                       // från och med nu konvergerar skärmen mot spelet (rebuildFromState)
  $('ov-ready').classList.add('open');
  if (fromIntro) {                            // Flash: korsa från kontrollrummet (ov-intro) in i ÄR DU REDO — aldrig via ön
    const ov = $('ov-intro');
    ov.style.transition = 'opacity .9s ease'; ov.style.opacity = 0;   // ov-ready ligger under → tonas fram
    await delay(950);
    ov.classList.remove('open'); ov.innerHTML = ''; ov.style.opacity = 1;
  }
  // "ÄR DU REDO?" visas en kort stund (tryck går fortare) → sedan vidare till väntläget automatiskt.
  await Promise.race([new Promise(res => { $('btn-ready').onclick = () => { audio.play('ui_confirm'); res(); }; }), delay(5000), tutAbortP()]);
  if (tutAbort) return;
  $('ov-ready').classList.remove('open');

  if (ONLINE) {
    // ═══ Gate 3 + 4 (RUMS-FLÖDE): lämna över till SERVERN ═══
    // Säg bara "den här skärmen är redo". Servern väntar in ALLA levande lag (eller spelledarens
    // TVINGA START / failsafe), kör EN gemensam nedräkning (realGame 'startCountdown' nedan ritar
    // 10→0 synkat på alla skärmar) och startar runda 1 åt alla samtidigt (realGame 'start' →
    // convergeToGame). INGEN lokal nedräkning, INGEN lokal startGame → aldrig mer osynk.
    realGame.net.tutReady();
    stopTutIdleWatch();                        // redo-anmäld → blockerar inte längre, sluta bevaka inaktivitet
    vantarLag = true;                         // väntläge → tutReadyUpdate uppdaterar diamanterna
    $('cd-lbl').textContent = 'VÄNTAR PÅ DE ANDRA LAGEN';
    renderWaitDots(lastTutReady);             // små diamanter + "X/Y lag redo" (ej den stora siffran)
    $('ov-countdown').classList.remove('hot');
    $('ov-countdown').classList.add('open');
    return;                                   // resten drivs av serverns events
  }

  // ═══ OFFLINE (lokal tutorial utan server): behåll lokal nedräkning + direkt start ═══
  $('cd-lbl').textContent = 'SPELET BÖRJAR OM';
  $('ov-countdown').classList.add('open');
  for (let n = 10; n >= 1; n--) {
    const el = $('cd-num');
    el.textContent = n;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';   // starta om pop
    $('ov-countdown').classList.toggle('hot', n <= 3);
    audio.play('ui_tap');
    await Promise.race([delay(1000), tutAbortP()]);
    if (tutAbort) { $('ov-countdown').classList.remove('open'); return; }
  }
  $('ov-countdown').classList.remove('open');
  await delay(300);
  if (tutAbort) return;
  $('tutveil').style.display = 'none';
  await banner('ÅR 1', false, 1500);
  if (tutAbort) return;
  loggClear();                                  // töm tutorialens övnings-händelser → loggen tom när runda 1 börjar
  game.attach(realGame);
  game.startGame();
}

// ═══════════════ Tutorial-TOLK (innehåll/ordning ur spec/content/tutorial.js) ═══════════════
// Maskineriet (tutSay/tutBeat/tutBarrier/startCeremony/makeTutorial) är OFÖRÄNDRAT. Tolken loopar
// de deklarativa stegen och fyller i dynamik via tre små register: ankare, mallvariabler, until/autoDo.
// Mellan-sekvensen är ordagrant som förut → identiskt beteende; Flash (coach-läge) byggs i nästa steg.
const TUT_TERRAIN = { aker: 'Åkermarken', skog: 'Skogen', tundra: 'Tundran', stad: 'Staden' };
let _tutReopenTrade = null;   // reopen-trade-failsafe-lyssnare under byt-fasen (sätts/rensas av setup)

// Semantiskt ankare → { sel, x, y, side }. prodBox/getBox får sel ur aktuellt läge (mySector/getCur).
function tutAnchor(name) {
  const a = ANCHORS[name] || {};
  let sel = a.sel;
  if (name === 'prodBox') sel = mySector === 'pengar' ? '#box-pengar' : '#box-material';
  if (name === 'getBox')  sel = getCur === 'pengar' ? '#box-pengar' : '#box-material';
  return { sel, x: a.x, y: a.y, side: a.side };
}
// Mallvariabler → värden ur aktuellt state. Anropas FÄRSKT per steg (picked/mySector/getCur ändras).
function tutResolver(myLag) {
  const cfg = E().cfg;
  const a = AREAS.find(x => x.id === myLag) || {};
  const built = handFor(myLag).find(c => c.tier === picked) || handFor(myLag)[0] || {};
  const prodCur = mySector;
  const inc = prodCur === 'pengar' ? built.gp : built.gm;
  const SZ_OH = 24, SZ_CUR = 28;   // öhälso-ikoner / pengar-material-ikoner (större i texten)
  const tal = n => `<span style="color:${n > 0 ? 'var(--oh-green)' : n < 0 ? 'var(--oh-red)' : 'inherit'};font-weight:800">${n > 0 ? '+' + n : n}</span>`;   // +grön / −röd
  // Siffror i övningsrutorna: öns hälsa = röd/grön, pengar = guld, material = silver (Klara 2026-11-25)
  const colK = (n, cur) => `<b class="${cur === 'pengar' ? 'gld' : 'sil'}">${n > 0 ? '+' + n : n}</b>`;
  const konsekvens = built.oh < 0
    ? `<b class="neg">−${Math.abs(built.oh)}</b> ${ico('industri', 44)} <span class="per">öns hälsa</span><div class="sub">Alla delar notan</div>`
    : `<b class="pos">+${built.oh}</b> ${ico('tillvaxt', 44)} <span class="per">öns hälsa</span><div class="sub">Alla delar nyttan</div>`;
  const map = {
    rounds: cfg.rounds, threshold: cfg.threshold,
    lagNamn: `<span style="color:${a.farg}">${(a.namn || '').toUpperCase()}</span>`,
    terrain: TUT_TERRAIN[myLag] || a.namn || '',
    sektorNamn: a.sektor === 'material' ? 'material' : 'pengar',
    sektorIco: ico(a.sektor === 'material' ? 'material' : 'pengar', 26),
    inkomst: tal(inc), inkomstK: colK(inc, prodCur), prodIco: ico(prodCur === 'pengar' ? 'pengar' : 'material', 44),
    konsekvens, bytIco: ico(getCur === 'pengar' ? 'pengar' : 'material', 44), fickK: colK(tutFick, getCur),
    saknarIco: ico(mySector === 'material' ? 'pengar' : 'material', 44),   // valutan du SAKNAR (motsatt din sektor)
    fickBelopp: tal(tutFick),                                             // +grönt belopp från senaste bytet
  };
  return txt => (txt || '').replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}
// TUTORIAL-ONLY: sänk öhälsobaren med det byggda kortets oh PRECIS när konsekvens-rutan poppar upp.
// (I övningsåret finns bara ett bygge + inga händelser → värdet = bokslutets. Bokslutets ohalsa-event
//  med samma värde suppas i ohalsa-handlern så baren aldrig faller två gånger.) Rör inte riktiga spelet.
function tutRevealOh(myLag) {
  const built = handFor(myLag).find(c => c.tier === picked) || handFor(myLag)[0];
  if (!built || typeof built.oh !== 'number') return;
  const target = (E().getState().oh || 0) + built.oh;
  tutOhShown = target;
  updateOh({ value: target, mode: ohMode(target), delta: built.oh });
}
// until-villkor (namn → löfte som resolvar när villkoret uppfylls).
function tutUntil(name, myLag) {
  switch (name) {
    case 'build':     return tutOnce('build', p => p.teamId === myLag);
    case 'tradeOpen': return tutWaitP(() => $('ov-trade').classList.contains('open'));
    case 'tradeDone': return tutOnce('trade', p => p.from === myLag || p.to === myLag);
    case 'buildingInfo': return new Promise(res => {          // klick på en byggnad → info-rutan syns UPPLYST ~2 s, sedan mörk + stängs + nästa steg
      const h = e => {
        if (!e.target.closest?.('g[data-building]')) return;
        map.svg.removeEventListener('click', h, true);
        // Släck INTE skärmen direkt: låt info-rutan synas ~2 s medan kartan fortfarande är upplyst,
        // stäng den sedan och resolva → skärmen dimmar och "Ring de andra lagen" tar vid.
        setTimeout(() => {
          map.svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // stäng info-rutan
          res();                                                                // → nästa steg (telefon) dimmar skärmen
        }, 2000);
      };
      map.svg.addEventListener('click', h, true);
    });
    case 'roundEnd':  return tutOnce('roundEnd');
    case 'settled':   return tutWaitP(() => !running);
    default:          return new Promise(() => {});   // okänt → aldrig klart (autoMs/abort räddar)
  }
}
function tutPartner(myLag) {
  return E().getState().teams.find(x => x.id !== myLag && x.sektor !== mySector)?.id;
}
// autoDo-actions (görs åt en övergiven skärm vid inaktivitet).
function tutAutoDo(name, myLag) {
  switch (name) {
    case 'byggSmutsig': return () => buyCard(E().getState().banDirtyThisRound ? 'standard' : 'smutsig');
    case 'oppnaByt':    return () => { if (!$('ov-trade').classList.contains('open')) openTrade(tutPartner(myLag)); };
    case 'bekraftaByt': return () => { if (!$('ov-trade').classList.contains('open')) openTrade(tutPartner(myLag)); $('btn-trade-go').click(); };
    case 'avslutaAr':   return () => $('btn-end').click();
    case 'visaByggnad': return () => [...map.svg.querySelectorAll('g[data-building]')].find(b => b.style.cursor === 'pointer')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    default:            return undefined;
  }
}
// setup-hooks (förberedelse mellan steg).
function tutSetup(name, myLag) {
  if (name === 'nollaTimer') { $('timertxt').textContent = '–:––'; return; }
  if (name === 'markeraVagg') {
    const mig = E().team(myLag);
    const vagg = handFor(myLag).find(c => c.tier !== picked && (mig.pengar < c.kp || mig.material < c.km));
    if (vagg) {
      const el = document.querySelector(`#cards .card[data-tier="${vagg.tier}"]`);
      const brist = [];
      if (mig.pengar < vagg.kp) brist.push(`${vagg.kp - mig.pengar}${ico('pengar', 13)}`);
      if (mig.material < vagg.km) brist.push(`${vagg.km - mig.material}${ico('material', 13)}`);
      el?.classList.add('tut-vagg', 'poor');
      if (el) el.querySelector('.saknas').innerHTML = `saknar ${brist.join(' + ')} → BYT`;
    }
    // "Avbryt" i bytesrutan får inte lämna återvändsgränd → öppna den igen (nettoeffekt: rutan stannar).
    _tutReopenTrade = () => { if (!tutAbort) openTrade(tutPartner(myLag)); };
    $('btn-trade-cancel').addEventListener('click', _tutReopenTrade);
    return;
  }
  if (name === 'rensaVagg') {
    if (_tutReopenTrade) { $('btn-trade-cancel').removeEventListener('click', _tutReopenTrade); _tutReopenTrade = null; }
    document.querySelectorAll('#cards .card.tut-vagg').forEach(el => {
      el.classList.remove('tut-vagg', 'poor');
      const s = el.querySelector('.saknas'); if (s) s.innerHTML = '';
    });
    return;
  }
}
// ── INTRO efter introfilmen (Klara 2026-11-25; design/intro-uppdrag-skarmar-forslag.html) ──
// Svart → tomt kontrollrum → krona på kartskärmen + CENTRALMAKTEN-meddelande → (rummet släcks) →
// emblemvägg tänds → "DU ÄR [LAG]" → "ERT UPPDRAG" (Bygg/Handla/Påverka ön + antal år ur cfg.rounds).
// Ersätter gamla ov-mission/ov-roll + årtals-/hälsa-pratbubblorna. Tryck (efter 2 s) hoppar över.
const INTRO_TERR = { aker: 'Åkermark', skog: 'Skog', tundra: 'Tundra', stad: 'Stad' };
async function runIntro(myLag, keepCover = false) {   // keepCover (Flash): tona INTE ut mot ön — lämna täckningen kvar så ceremonin kan korsa in
  const ov = $('ov-intro');
  const a = AREAS.find(x => x.id === myLag) || AREAS[0];
  const rounds = E().cfg.rounds;
  const sek = a.sektor === 'material' ? 'material' : 'pengar';
  const step = (n, ic, namn) => `<div class="ln step"><span class="num">${n}</span><span class="sicon">${ico(ic, 70)}</span><span class="sname">${namn}</span></div>`;
  ov.innerHTML =
    `<div class="L" id="in-rw" style="opacity:0"><div class="L" style="background-image:url(assets/kontrollrum_neutral.jpg)"></div>` +
      `<div class="L im" id="in-crl" style="background-image:url(assets/kontrollrum_krona.jpg)"></div></div>` +
    `<div class="L im" id="in-wall" style="background-image:url(assets/vagg_mork.jpg)"></div>` +
    `<div class="L im" id="in-lit" style="background-image:url(assets/vagg_${a.id}.jpg)"></div>` +
    `<div class="L im dimw" id="in-dim"></div>` +
    `<div id="in-st">` +
      `<div class="ban pnl" id="in-r0" style="--acc:#C9A94F"><div class="bar"></div>` +
        `<div class="mhead"><span class="seal">${ico('orad', 62)}</span><div><div class="m1">CENTRALMAKTEN</div><div class="m2">OFFICIELLT MEDDELANDE</div></div>` +
        `<div class="prio"><i class="dot"></i>PRIORITET: HÖG</div></div>` +
        `<div class="msub"><div class="rh">Ön behöver en ny borgmästare</div></div>` +
        `<div class="rs">Fyra företag tävlar om makten.<br>Rikaste företaget tar över styret.</div></div>` +
      `<div class="ban" id="in-b2" style="--acc:${a.farg}"><div class="bar"></div><div class="lg"><span class="halo"></span>${logoSVG(a.id, 200)}</div>` +
        `<div class="info"><div class="tt">DU ÄR</div><div class="nm">${(a.namn || '').toUpperCase()}</div>` +
        `<div class="brow"><span class="isl">${ico('on', 60)}</span><b class="terr" style="color:${a.farg}">${INTRO_TERR[a.id] || ''}</b>` +
        `<span class="sy"><span class="rlab">${sek}</span>${ico(sek, 70)}</span></div></div></div>` +
      `<div class="ban pnl" id="in-s3" style="--acc:#C9A94F"><div class="bar"></div>` +
        `<div class="phead"><i class="dot"></i>ERT UPPDRAG<span class="yrs"><b>${rounds}</b> ÅR</span></div>` +
        `<div class="steps">${step(1, 'bygge', 'Bygg')}${step(2, 'byt', 'Handla')}${step(3, 'rosta', 'Påverka ön')}</div></div>` +
    `</div>`;
  const q = id => ov.querySelector('#' + id);
  const timers = [];
  const at = (ms, f) => timers.push(setTimeout(f, ms));
  const on = id => q(id).classList.add('on');
  const off = id => q(id).classList.remove('on');
  const fade = (id, ms, ease = 'ease-in-out') => { const e = q(id); e.style.transition = `opacity ${ms}ms ${ease}`; e.style.opacity = 1; };
  const efterFilm = $('ov-trailer').classList.contains('open');   // filmens sista bild ligger kvar under → tona mjukt till svart
  ov.style.transition = 'none'; ov.style.opacity = efterFilm ? 0 : 1;
  ov.classList.add('open'); void ov.offsetWidth;
  if (efterFilm) { ov.style.transition = 'opacity 1.6s ease-in-out'; ov.style.opacity = 1; }
  else ov.style.transition = '';
  realGame?.net?.intro?.(true);   // centralhögtalaren: musikbädd + myndighetssignatur (hjärnan tajmar)
  let klar; const slut = new Promise(res => { klar = res; });
  // Tidslinje (ms): ~1,6 s helt svart → tomt rum → krona → meddelande (7 s) → rummet släcks → emblemvägg → "DU ÄR" → "ERT UPPDRAG"
  at(2400, () => { q('in-rw').style.opacity = 1; });
  at(5800, () => { q('in-crl').style.opacity = 1; });
  at(8600, () => on('in-r0'));
  at(15600, () => off('in-r0'));
  at(16400, () => q('in-rw').classList.add('dip'));
  at(17400, () => { fade('in-wall', 2200); q('in-dim').style.opacity = 1; });
  at(20600, () => fade('in-lit', 1400));
  at(21900, () => { on('in-b2'); audio.play('relief'); });   // mjukt ljud i egna bänken vid "DU ÄR"
  at(27700, () => off('in-b2'));
  at(28700, () => on('in-s3'));
  [1300, 2400, 3500].forEach((d, i) => at(28700 + d, () => { ov.querySelectorAll('#in-s3 .ln')[i]?.classList.add('on'); audio.play('ui_tick'); }));
  at(36100, () => klar());
  const ts = Date.now();
  const hopp = () => { if (Date.now() - ts > 2000) klar(); };
  ov.onclick = hopp;
  await Promise.race([slut, tutAbortP()]);
  ov.onclick = null; timers.forEach(clearTimeout);
  realGame?.net?.intro?.(false);
  if (!keepCover && !tutAbort) audio.play('round_start');   // in i övningsåret
  if (keepCover) return;                      // Flash: behåll kontrollrummet som täckning → startCeremony korsar in i ÄR DU REDO
  ov.style.transition = ''; ov.style.opacity = 0;   // tonas ut mot ön (Mellan: övningsåret tar vid)
  await delay(950);
  ov.classList.remove('open'); ov.innerHTML = ''; ov.style.opacity = 1;
}

// Kör ETT deklarativt steg.
async function runTutStep(step, myLag) {
  const resolve = tutResolver(myLag);
  switch (step.typ) {
    case 'mission': { await runIntro(myLag); return; }
    case 'roll': {
      const a = AREAS.find(x => x.id === myLag);
      if (!a) return;
      $('roll-logo').innerHTML = `<img src="assets/makt/${myLag}.png" alt="" style="width:min(640px,70vw);height:auto;border-radius:16px;border:3px solid var(--edge2);box-shadow:0 10px 40px #000">`;
      $('roll-du').innerHTML = resolve(step.rollDu || 'DU ÄR {lagNamn}');
      $('roll-tx').innerHTML = resolve(step.rollTxt || '');
      $('ov-roll').classList.add('open');
      await Promise.race([new Promise(res => { $('ov-roll').onclick = res; }), tutAbortP()]);
      $('ov-roll').onclick = null; $('ov-roll').classList.remove('open');
      return;
    }
    case 'banner':   await banner(resolve(step.txt), false, step.ms || 1400); return;
    case 'endBtn':   setEndBtn('AVSLUTA<br>ÅR', !step.on); return;
    case 'setup':    tutSetup(step.gor, myLag); return;
    case 'pause':    await Promise.race([delay(step.ms || 400), tutAbortP()]); return;
    case 'barrier':  await tutBarrier(step.n); return;
    case 'ceremony': await startCeremony(); return;
    case 'demo': {                                           // handen visar byggnads-klick; valfri liten ruta (ic + kort rad) visas under demon
      if (step.demo !== 'byggnadsInfo') return;
      const anc = step.ankare ? tutAnchor(step.ankare) : null;
      if (step.txt && anc) {
        const b = $('tutbox');
        $('tut-txt').innerHTML = resolve(step.txt); setTutIc(step.ic);
        [...$('tut-dots').children].forEach((d, i) => d.classList.toggle('on', i <= (step.ix || 0)));
        $('tut-next').style.display = 'none';
        b.style.left = anc.x + 'px'; b.style.top = anc.y + 'px'; b.style.display = 'block';
      }
      await tutBuildingDemo();
      if (step.txt) $('tutbox').style.display = 'none';
      return;
    }
    case 'gate': {                                           // TYST grind: vänta in handlingen — ingen ruta. Ankare valfritt (lyser i så fall upp det)
      tutFocus(step.ankare ? tutAnchor(step.ankare).sel : null);
      const timeP = new Promise(res => setTimeout(() => res('timeout'), 120000));
      const r = await Promise.race([tutUntil(step.until, myLag), timeP, tutAbortP()]);
      if (r === 'timeout') { await tutAutoDo(step.autoDo, myLag)?.(); await Promise.race([tutUntil(step.until, myLag), delay(4000), tutAbortP()]); }
      if (step.until === 'tradeDone') { await Promise.race([delay(500), tutAbortP()]); await Promise.race([tutWaitP(() => !$('ov-traderes').classList.contains('open')), tutAbortP()]); }   // vänta ut den stora BYTT!-rutan
      tutFocus(null);
      return;
    }
    case 'say': {
      if (step.hidden) {                                   // osynligt vänte-steg (vänta ut bokslut/priser)
        if (step.until === 'settled') await delay(1200);
        if (step.until) await Promise.race([tutUntil(step.until, myLag), tutAbortP()]);
        return;
      }
      const anc = tutAnchor(step.ankare);
      if (step.ohReveal) tutRevealOh(myLag);                    // baren sjunker i takt med att konsekvens-rutan poppar upp
      await tutSay({ ix: step.ix || 0, txt: resolve(step.txt), ic: step.ic, x: anc.x, y: anc.y, focus: anc.sel, hold: !!step.hold });
      return;
    }
    case 'beat': {
      const anc = tutAnchor(step.ankare);
      await tutBeat({ ix: step.ix || 0, txt: resolve(step.txt), ic: step.ic, nudge: step.nudge, x: anc.x, y: anc.y, focus: anc.sel,
        beside: anc.side ? anc.sel : undefined, side: anc.side,
        until: tutUntil(step.until, myLag), autoDo: tutAutoDo(step.autoDo, myLag) });
      if (step.after) await Promise.race([delay(step.after), tutAbortP()]);   // paus efter steget innan nästa ruta (t.ex. låt byggnadens info synas)
      return;
    }
  }
}

async function runTutorial() {
  if (tutRunning) return;                      // redan igång (late-join/claim kan trigga dubbelt)
  tutRunning = true; tutAbort = false; tutInCeremony = false; _tutAborters.length = 0; tutOhShown = null; tutOhReset = false;
  startTutIdleWatch();                          // obemannad skärm (90 s utan beröring) → bot, så gruppen inte fastnar
  game.enterTutorial?.();                       // RUMS-FLÖDE: markera tutorial-fasen för sent anslutna
  const myLag = ONLINE ? realGame.me : (manifest.config?.humanTeam || 'aker');
  // Övningen ska följa den version nästa parti kör: slå ihop manifestets bas-config med vald variant
  // (online: serverns valda version; offline: ingen variant → manifest). Så år/tröskel/regler stämmer.
  const sel = ONLINE ? realGame.net?.variant?.selected : null;
  const baseCfg = (sel && VARIANTS[sel]) ? { ...(manifest.config || {}), ...VARIANTS[sel] } : (manifest.config || {});
  const tut = makeTutorial(myLag, baseCfg);
  game.attach(tut);
  $('ov-start').classList.remove('open');
  const flow = tutorialFor(sel) || TUTORIALS.mellan;
  const coach = flow.mode === 'coach';
  // COACH (Flash): lägg en svart täckning DIREKT (före startGame) så ön aldrig blinkar till mellan filmen och kontrollrummet.
  if (coach) { const ov = $('ov-intro'); ov.style.transition = 'none'; ov.style.opacity = 1; ov.classList.add('open'); void ov.offsetWidth; ov.style.transition = ''; }
  $('tutveil').style.display = 'block';
  tut.startGame();
  await delay(500);
  if (tutAbort) return;

  // COACH-läge (Flash): INGET övningsår — intro + ceremoni (samma som Mellan, {rounds}=4 ur Flash-configen),
  // med korsfade kontrollrum → ÄR DU REDO (aldrig via ön). Sedan tar flashCoach vid på det RIKTIGA år 1.
  if (coach) { await runCoachOnboarding(myLag); return; }
  // Flöde ur data: variantens tutorial (sequence), annars Mellan-sekvensen (Skola ärver tills vidare).
  const steps = flow.mode === 'sequence' ? flow.steps : TUTORIALS.mellan.steps;
  for (const step of steps) {
    if (tutAbort) return;
    await runTutStep(step, myLag);
  }
}
// Flash-onboarding: intro (behåll täckning) → korsfade in i ÄR DU REDO → nedräkning → år 1. Ingen ö emellan.
async function runCoachOnboarding(myLag) {
  await runIntro(myLag, true);
  if (tutAbort) return;
  await startCeremony(true);
}

// Spelar-start = ALLTID utan spelledare (selfplay). Spelledar-läget styrs från spelledar-pulten
// (den kan ta över riggen/prisutdelningen när som helst) — spelarna väljer det inte i lobbyn.
// Paus (spelledare): fryser BARA spelmotorn — ambiencen i riggen fortsätter spela.
$('btn-paus')?.addEventListener('click', () => game.pause());
$('ov-paus')?.addEventListener('click', () => game.pause());
game.on('paused', m => {
  const manual = !!m.paused;          // MANUELL spelledarpaus → visa "Spelet är pausat"-overlayen
  const any = manual || !!m.auto;     // händelse-/dilemma-paus (auto): frys men visa INGEN overlay
  uiPaused = any;                     // fryser award-popupens auto-nedräkning vid ALL paus
  $('ov-paus')?.classList.toggle('open', manual);   // overlay BARA vid manuell paus (ej händelse-/dilemmapaus)
  $('btn-paus')?.classList.toggle('aktiv', manual);
});
game.on('start',   () => { const pb = $('btn-paus'); if (pb) pb.style.display = ''; });
game.on('gameEnd', () => { const pb = $('btn-paus'); if (pb) pb.style.display = 'none'; $('ov-paus')?.classList.remove('open'); });

$('btn-start').addEventListener('click', async () => {
  audio.unlock();
  audio.play('ui_tap');
  if (ONLINE) {
    if (gamePhase() !== 'lobby') return;          // pågår/slut → STARTA gör inget
    if (startWindowLeft != null) { toast('Spelet startar strax…'); return; }   // fönstret redan öppet
    if (effMode() === 'tutorial') {
      if (!game.me) await delay(1500);            // kiosk-claim (?lag=) kan vara på väg in
      if (!game.me) { toast('Tryck på ett lag först!', true); return; }   // i tutorial-läge startar man inte utan lag
    }
    // RUMS-FLÖDE: öppna 15 s join-fönstret. Vid 0 → servern broadcastar 'startGo' → beginStartFlow()
    // kör det BEFINTLIGA flödet (trailer → tutorial → runda 1) på alla skärmar. Fler kan ansluta under tiden.
    game.startWindow();
  } else {
    $('ov-start').classList.remove('open');
    if (effMode() === 'tutorial') { runTutorial(); return; }
    game.startGame({ spelledare: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ═══ SLUTDEL — spelledarstegad slutdel (podium + reveal). Självbärande block. ═══
// All slutdels-DOM ligger i #ov-slutdel (spel.html); logiken här. Rör ingen befintlig vy.
// Servern dirigerar (SLUTDEL START + NÄSTA via ecoloco/spel/gm); skärmen är en ren vy:
//   slutdelStart    → öppna slutdels-overlay (tar över slutskärmen)
//   slutdelQuestion → stor frågetext + bild + touch-knappar + tom live-fördelning
//   slutdelDist     → lag-färgade marker landar på valt svar, i realtid på varje skärm
//   slutdelReveal   → reveal-kort (rubrik/text/bild · regi-text visas men läses ej automatiskt)
//   slutdelDone     → stäng, tillbaka till slutskärmen (SPELA IGEN)
// Ingen rätt/fel-markering — bara fördelning.
// ═══════════════════════════════════════════════════════════════════════════
let sdQuestion = null;   // aktuell fråga {id, fraga, options, bild}

function sdShow(which) {
  $('ov-slutdel').classList.add('open');
  $('sd-question').style.display = which === 'question' ? 'flex' : 'none';
  $('sd-reveal').style.display = which === 'reveal' ? 'flex' : 'none';
}
function renderSdDist(p) {
  if (!sdQuestion) return;
  const byOpt = {};
  (p.tokens || []).forEach(t => (byOpt[t.option] ||= []).push(t));
  $('sd-q-dist').innerHTML = (sdQuestion.options || []).map(o => {
    const toks = byOpt[o] || [];
    const markers = toks.map(t => `<i class="sd-marker" style="background:${t.farg}"></i>`).join('');
    return `<div class="sd-distrow"><span class="sd-distlbl">${o}</span><span class="sd-markers">${markers}</span><span class="sd-distn">${toks.length || ''}</span></div>`;
  }).join('');
}

game.on('slutdelStart', () => run(async () => {
  stangKroning();
  $('ov-slut').classList.remove('open');     // slutdelen tar över slutskärmen
  sdQuestion = null;
  sdShow('question');
  $('sd-q-img').style.display = 'none';
  $('sd-q-fraga').textContent = 'Spelledaren startar slutdelen…';
  $('sd-q-options').innerHTML = '';
  $('sd-q-dist').innerHTML = '';
}));

game.on('slutdelQuestion', p => run(async () => {
  sdQuestion = p;
  sdShow('question');
  if (p.bild) { $('sd-q-img').src = p.bild; $('sd-q-img').style.display = ''; } else $('sd-q-img').style.display = 'none';
  $('sd-q-fraga').textContent = p.fraga || '';
  $('sd-q-dist').innerHTML = '';
  $('sd-q-options').innerHTML = (p.options || []).map((o, i) => `<button class="sd-opt" data-opt="${i}">${o}</button>`).join('');
  document.querySelectorAll('#sd-q-options .sd-opt').forEach(b => b.addEventListener('click', () => {
    audio.play('ui_tap');
    document.querySelectorAll('#sd-q-options .sd-opt').forEach(x => x.classList.toggle('sel', x === b));
    game.podiumAnswer?.(p.id, p.options[+b.dataset.opt]);
  }));
  renderSdDist({ questionId: p.id, tokens: [] });
}));

game.on('slutdelDist', p => run(async () => { if (sdQuestion && p.questionId === sdQuestion.id) renderSdDist(p); }));

game.on('slutdelReveal', p => run(async () => {
  const k = p.kort || {};
  sdShow('reveal');
  if (k.bild) { $('sd-r-img').src = k.bild; $('sd-r-img').style.display = ''; } else $('sd-r-img').style.display = 'none';
  $('sd-r-rubrik').textContent = k.rubrik || '';
  $('sd-r-rubrik').style.display = k.rubrik ? '' : 'none';
  $('sd-r-text').textContent = k.text || '';
  $('sd-r-text').style.display = k.text ? '' : 'none';
  if (k.spelledartext) { $('sd-r-regi').textContent = k.spelledartext; $('sd-r-regi').style.display = ''; }   // regi — läses ej automatiskt
  else $('sd-r-regi').style.display = 'none';
}));

game.on('slutdelDone', () => run(async () => {
  $('ov-slutdel').classList.remove('open');
  sdQuestion = null;
  $('ov-slut').classList.add('open');   // tillbaka till slutskärmen
}));

// ═══ TEST: visa kröningsceremonin direkt — spel.html?local=1&kroningtest=vinst (eller =forlust) ═══
if (params.has('kroningtest')) {
  const vinst = params.get('kroningtest') !== 'forlust';
  $('ov-start').classList.remove('open');
  setTimeout(() => visaKroning({
    vunnet: vinst, vinnare: 'aker', oh: vinst ? 67 : 41, mal: 60, ar: 8,
    placering: [{ teamId: 'stad', namn: 'Örnen', kapital: 88 }, { teamId: 'tundra', namn: 'Räven', kapital: 104 }, { teamId: 'skog', namn: 'Björnen', kapital: 131 }, { teamId: 'aker', namn: 'Oxen', kapital: 142 }],
    bov: { teamId: 'stad', namn: 'Örnen', skada: -31 },
  }, { knapp: vinst ? 'STARTA NYTT SPEL' : 'TILLBAKA TILL LOBBYN', onKnapp: () => location.reload() }), 300);
}

// ═══ TEST: öppna slutdelen direkt för genomklickning — spel.html?slutdeltest=1 ═══
// Kräver inget parti och ingen server: stegar hela podiet + Newfoundland lokalt med en NÄSTA-knapp.
// Exempel-fördelning (fyra lag-färgade marker) visas per fråga så hela vyn kan bedömas.
if (params.has('slutdeltest')) {
  (async () => {
    const { buildSlutdel } = await import('../spec/slutdel.js');
    const steps = buildSlutdel('A');   // returnerar steglistan direkt (array)
    const LAGFARG = { aker: '#E7C24C', skog: '#3F8F4A', tundra: '#D98A3C', stad: '#8A8F96' };
    ['ov-attract', 'ov-narrativ', 'ov-start'].forEach(id => $(id)?.classList.remove('open'));
    let i = 0;
    const showStep = () => {
      const s = steps[i];
      if (!s) { game._emit('slutdelDone'); btn.textContent = 'KLART ✕'; btn.onclick = () => btn.remove(); return; }
      if (s.kind === 'question') {
        game._emit('slutdelQuestion', { id: s.id, fraga: s.fraga, options: s.options, bild: s.bild });
        setTimeout(() => game._emit('slutdelDist', {
          questionId: s.id,
          tokens: ['aker', 'skog', 'tundra', 'stad'].map((lag, k) =>
            ({ team: lag, farg: LAGFARG[lag], option: s.options[k % s.options.length] })),
        }), 500);
      } else {
        game._emit('slutdelReveal', { kort: s });
      }
    };
    game._emit('slutdelStart');
    const btn = document.createElement('button');
    btn.textContent = 'NÄSTA ›';
    btn.style.cssText = 'position:absolute;bottom:28px;right:28px;z-index:60;background:#C9A94F;color:#241E0F;border:0;border-radius:12px;font:inherit;font-weight:800;font-size:22px;letter-spacing:1px;padding:16px 30px;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.6)';
    btn.onclick = () => { try { audio.unlock(); } catch {} i++; showStep(); };
    $('stage').appendChild(btn);
    showStep();
  })();
}
