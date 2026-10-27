// ui.js — Eco Loco (Mellan): vylager i två lägen bakom SAMMA spelfasad.
//   spel.html              → LOKALT: motorn kör i webbläsaren, mock-opponents styr 3 lag
//   spel.html?online=1     → ONLINE: server/server.js äger motorn; denna klient är en
//                            statslös vy (lag väljs i lobbyn, resten blir botar)
//   spel.html?online=1&lag=aker → kioskläge: gör anspråk på ett lag direkt (NUC-autostart)
//
// Fasadens kontrakt: game.on(event, cb) för motorns 12 events + timer/lobby/…,
// game.E() = läsare (team/leaderboards/contribution/getState/cfg), actions som promises.
// Events spelas alltid genom en seriell kö — under bokslutet ('resolveStart') tar
// stegen sina scenpauser, annars kör de direkt.

import { EcoLoco, AREAS, handFor, ohMode, timerSecFor } from '../spec/engine.js';
import { mockOpponentsAct, mockOpponentsVote } from '../spec/mock-opponents.js';
import { renderMap } from './map.js';
import { logoSVG } from './logos.js';
import { GameAudio } from './audio.js';
import { ServerNet } from './net.js';
import { ico, moodIco, curIco } from './icons.js';

const $ = id => document.getElementById(id);
const delay = ms => new Promise(r => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const ONLINE = params.has('online');

const manifest = await (await fetch('./spec/assets.json')).json();
const slots = Object.fromEntries(Object.entries(manifest.slots).filter(([k]) => k !== '_readme'));
const audio = new GameAudio(manifest.audio || {});

const MODE_LABEL = {
  superdaligt: 'Superdåligt', daligt: 'Dåligt', neutralt: 'Neutralt',
  bra: 'Bra', mycketbra: 'Mycket bra',
};
const TIER_LABEL = { smutsig: 'SMUTSIG', standard: 'STANDARD', gron: 'GRÖN' };
const CUR_ICON = { pengar: '🪙', material: '🧱' };
const teamName = id => AREAS.find(a => a.id === id).namn;
const fmtOh = v => (v > 0 ? '+' + v : v) + (v > 0 ? ' 🌱' : ' 🏭');

// Bot-/auto-val av förslag. Grund-3 öhälso-viktat (som förr). Fr.o.m. runda 4 kan boten även
// välja ur rundans extra-pool (S.extraProposals) — i kris (låg öhälsa) prioriteras Krispaket.
function pickBotProposal(S) {
  const base = S.oh < 45 ? (Math.random() < 0.6 ? 'gron' : 'forbud')
             : Math.random() < 0.5 ? 'skatt' : (Math.random() < 0.5 ? 'gron' : 'forbud');
  const extra = (S.round >= 4 && Array.isArray(S.extraProposals)) ? S.extraProposals : [];
  if (extra.length && Math.random() < 0.4) {
    if (S.oh < 45 && extra.includes('krispaket')) return 'krispaket';
    return extra[Math.floor(Math.random() * extra.length)];
  }
  return base;
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
                    'income', 'ohalsa', 'award', 'event', 'crisis', 'roundReplay', 'roundEnd', 'gameEnd'])
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
      engine.openProposal(pickBotProposal(S), by);
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
    vote: y => net.vote(y),
    klar: () => net.klar(),
    awardsKlara: () => net.awardsKlara(),
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
               'income', 'ohalsa', 'award', 'awardCeremony', 'awardStep', 'awardDone',
               'event', 'crisis', 'roundReplay', 'roundEnd', 'gameEnd', 'timer', 'resolveStart',
               'lobby', 'klarUpdate', 'claimAck', 'voteUpdate', 'tradeIncoming', 'notis',
               'disconnected', 'reconnected', 'paused',
               'trailer', 'trailerDone',
               'startWindow', 'startGo', 'startWindowCancel', 'tilllobby',
               'slutdelStart', 'slutdelQuestion', 'slutdelReveal', 'slutdelDist', 'slutdelDone'];
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
    vote: (...a) => cur.vote(...a),
    klar: (...a) => cur.klar(...a),
    awardsKlara: (...a) => cur.awardsKlara?.(...a),
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
  set('#box-pengar .ic', ico('pengar', 26));
  set('#box-material .ic', ico('material', 26));
  set('#btn-trade', `${ico('byt', 22)} BYT VALUTOR`);
  set('#btn-prop', `${ico('rosta', 22)} LÄGG FÖRSLAG`);
  set('#toplist-h', `${ico('borsen', 18)} TOPPLISTA`);
  set('#ov-start h1', `${ico('on', 46)} MAKTSPELET`);
  set('#ov-trade h2', `${ico('byt', 24)} BYT VALUTOR`);
  set('#ov-choose h2', `${ico('rosta', 24)} LÄGG ETT FÖRSLAG`);
  set('#ov-vote h2', `${ico('rosta', 24)} OMRÖSTNING`);
  set('#ov-tradein h2', `${ico('byt', 24)} BYTESFÖRFRÅGAN`);
}
initIcons();
function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('stage').style.transform = `scale(${s})`;
}
addEventListener('resize', fit); fit();

// ═══════════════ Vy-tillstånd + seriell event-kö ═══════════════
let resolving = false;
let picked = null;
let expanded = null;
let voteOpenFor = null;
let klarLag = new Set();   // lag som tryckt AVSLUTA denna runda (online)
const queue = [];
let running = false;
// RUMS-FLÖDE: delat vy-tillstånd (deklareras tidigt → late-join-routern vid boot kan läsa dem).
let startWindowLeft = null;   // 15 s start-fönster: sekunder kvar (null = inget fönster öppet)
let tutRunning = false;       // solo-tutorialen kör (gard mot dubbelstart vid late-join/claim)
let tutAbort = false;         // omstart mitt i tutorialen → avbryt den rent
let tutInCeremony = false;    // tutorialen är i slut-ceremonin (redo→nedräkning) — konvergerar själv mot spelet
const _tutAborters = [];      // väntare som väcks när tutorialen ska avbrytas
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
  setEndBtn('BOKSLUT…', true);
}));

game.on('build', p => run(async () => {
  const b = manifest.buildings[p.card.asset];
  map.placeBuilding(p.area, p.slotIndex, b.file);
  audio.play(`build_${p.card.tier}`);
  if (p.teamId !== game.me) toast(`${teamName(p.teamId)} byggde ${p.card.namn} <span class="${p.card.oh > 0 ? 'ohplus' : 'ohminus'}">${fmtOh(p.card.oh)}</span>`);
  renderMe(); renderTeams();
  if (resolving) await delay(650);
}));

game.on('trade', p => run(async () => {
  audio.play('trade');
  if (p.from !== game.me && p.to !== game.me) {
    toast(`${teamName(p.from)} bytte ${p.give} ${CUR_ICON[p.giveCur]} mot ${p.get} ${CUR_ICON[p.getCur]} med ${teamName(p.to)}`);
  }
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
  updateOh(p);
  if (resolving) await delay(1300);
}));

// Konsekvens-chips under event-bilden: vilka lag drabbas och hur + öns hälsa.
function eventKonsHTML(p) {
  const chip = (v, ic) => `<span class="${v > 0 ? 'plus' : 'minus'}">${v > 0 ? '+' : ''}${v} ${ic}</span>`;
  const chips = [];
  (p.effekter || []).forEach(e => {
    const parts = [];
    if (e.egen)     parts.push(chip(e.egen, e.sektor === 'pengar' ? '🪙' : '🧱'));
    if (e.pengar)   parts.push(chip(e.pengar, '🪙'));
    if (e.material) parts.push(chip(e.material, '🧱'));
    if (parts.length) chips.push(`<div class="kons">${logoSVG(e.teamId, 26)} ${teamName(e.teamId)} ${parts.join(' ')}</div>`);
  });
  if (p.oh) chips.push(`<div class="kons oh">🏝 öns hälsa ${chip(p.oh, p.oh > 0 ? '🌱' : '🏭')}</div>`);
  return chips.join('');
}

// Händelse (EVENT-systemet). Ljudet spelas centralt (rigg); skärmen visar bild + rubrik + text + konsekvenser.
game.on('event', p => run(async () => {
  const warn = p.id !== 'godskord' && p.id !== 'gronafonden' && p.id !== 'pengaslapp';
  renderMe(); renderTeams(); renderRegs();
  if (p.bild) {
    $('event-img').src = p.bild;
    $('event-rubrik').textContent = p.rubrik || '';
    $('event-text').textContent = p.text || '';
    $('event-kons').innerHTML = eventKonsHTML(p);
    $('ov-event').classList.toggle('warn', warn);
    $('ov-event').classList.add('open');
    await delay(500);                               // hinner läsas innan tryck registreras
    await clickOrTimeout($('ov-event'), resolving ? 6000 : 8000);
    $('ov-event').classList.remove('open');
    await delay(200);
  } else {                                          // t.ex. pengasläpp (ingen bild) → banner + toast
    await banner(`${warn ? '⚠ ' : '🎉 '}${(p.rubrik || '').toUpperCase()}`, warn, 1900);
    if (p.text) toast(`${warn ? '⚠' : '🎉'} ${p.text}`, warn);
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
    $('event-img').src = 'assets/kris.png';   // placeholder tills Josef genererar bilden (fallback = som andra saknade event-bilder)
    $('event-rubrik').textContent = 'Ön står inför kollaps';
    $('event-text').textContent = 'Centralmakten meddelar kyligt: öns hälsa är kritisk. Rädda den innan rundan är slut — annars faller allt, och ni får börja om. Lösningen är er.';
    $('event-kons').innerHTML =
      `<div class="kons oh">🎯 Få öns hälsa <b>över ${reset}</b></div>` +
      `<div class="kons"><span class="minus">⏳ 1 runda — annars förlorar <b>alla</b></span></div>`;
    $('ov-event').classList.add('warn');
    $('ov-event').classList.add('open');
    await delay(500);                               // hinner läsas innan tryck registreras
    await clickOrTimeout($('ov-event'), resolving ? 6000 : 8000);
    $('ov-event').classList.remove('open');
    await delay(200);
    // .krisglow ligger KVAR — släcks först vid crisis{on:false}
  } else {
    $('krisglow').classList.remove('on');
    toast('✓ Krisen avvärjd — ön andas ut');
  }
}));

// Award-popup: tryck går vidare; auto-fortsätter efter 8 s så självspelande läge aldrig fastnar.
// Paus fryser auto-nedräkningen (uiPaused) → skärmens prisutdelning håller i takt med riggen.
let uiPaused = false;
function clickOrTimeout(el, ms) {
  return new Promise(res => {
    let remaining = ms;
    const step = 100;
    let t = setTimeout(tick, step);
    function tick() {
      if (!uiPaused) remaining -= step;
      if (remaining <= 0) done(); else t = setTimeout(tick, step);
    }
    function done() { clearTimeout(t); el.removeEventListener('pointerdown', done); res(); }
    el.addEventListener('pointerdown', done);
  });
}

// Pris-typ → kort-innehåll (samma för selfplay-popupen och GM-stegningen). Ljud spelas centralt (rigg/hjärna).
const awardMeta = (typ, w) => ({
  led: { em: '🏆', rubrik: 'Årets ledande företag', val: w ? `+${w.varde} kapital` : '', cls: 'ohplus' },
  eld: { em: '🌱', rubrik: 'Årets eldsjäl',          val: w ? `+${w.varde} öhälsa` : '',  cls: 'ohplus' },
  sab: { em: '💀', rubrik: 'Årets sabotör',          val: w ? `${w.varde} öhälsa` : '',   cls: 'ohminus' },
}[typ]);
// Lag-agnostiska prisbilder (kontrollrummets skärmar) — samma bild oavsett vinnarlag.
const AWARD_BILD = {
  led: 'assets/framgangsrik_foretag01.png',
  eld: 'assets/eldsjal01.png',
  sab: 'assets/sabotor_01.png',
};
function renderAwardCard(typ, w, footer = '') {
  const m = awardMeta(typ, w);
  // Event-korts-struktur: lag-agnostisk prisbild på topp (döljs snällt om filen saknas) + ram med
  // titel + vinnarlag (laget färg-/namnges här, bilden är samma för alla).
  const img = `<img src="${AWARD_BILD[typ] || ''}" alt="" onerror="this.style.display='none'">`;
  $('awardcard').className = 'awardcard' + (typ === 'sab' ? ' sab' : '');
  $('awardcard').innerHTML = img + `<div class="aw-tx"><div class="em">${m.em}</div><h4>${m.rubrik}</h4>` +
    (w ? `<div class="who">${logoSVG(w.teamId, 64)}${w.namn}<span class="val ${m.cls}">${m.val}</span></div>`
       : `<div class="who" style="font-size:19px;color:var(--dim)">Ön andas ut 😮‍💨</div>`) + footer + `</div>`;
}

// Slutskärmen (win/lose) ska visas FÖRST när prisceremonin för sista rundan spelats klart.
// Online driver servern ceremonin (awardCeremony→awardStep→awardDone{over}); gameEnd kan komma FÖRE
// awardCeremony i auto-läge, så vi väntar alltid in awardDone(over) online. Lokalt (mock) stegar
// 'award' själv via den seriella kön före gameEnd → då visas slut direkt.
let pendingSlut = null, slutFailsafe = null;
function showPendingSlut() {
  clearTimeout(slutFailsafe); slutFailsafe = null;
  if (!pendingSlut) return;
  const s = pendingSlut; pendingSlut = null; showSlut(s);
}

// SELFPLAY: skärmen stegar själv genom priserna (tryck eller auto efter 8 s).
game.on('award', p => run(async () => {
  const show = async (typ, w) => {
    renderAwardCard(typ, w, `<div class="fortsatt">tryck för att fortsätta ›</div>`);
    $('ov-award').classList.add('open');
    await delay(500);                       // hinner läsas innan tryck registreras
    await clickOrTimeout($('ov-award'), 8000);
    $('ov-award').classList.remove('open');
    await delay(250);
  };
  if (p.led) await show('led', p.led);
  if (p.eld) await show('eld', p.eld);
  await show('sab', p.sab);
  game.awardsKlara?.();   // prisutdelningen genomklickad → rundtimern får börja ticka
  renderRegs();
}));

// GM-LÄGE: servern dirigerar — skärmen visar det pris spelledaren klickar fram (ingen auto-stegning).
game.on('awardCeremony', () => run(async () => {
  $('awardcard').innerHTML = `<div class="em">🏅</div><h4>Prisutdelning</h4>` +
    `<div class="who" style="font-size:18px;color:var(--dim)">Spelledaren presenterar priserna…</div>`;
  $('ov-award').classList.add('open');
}));
game.on('awardStep', p => run(async () => {
  renderAwardCard(p.typ, p.w);
  $('ov-award').classList.add('open');
}));
game.on('awardDone', p => run(async () => {
  $('ov-award').classList.remove('open');
  renderRegs();
  if (p?.over) showPendingSlut();   // sista rundans ceremoni klar → nu visas slutskärmen
}));

game.on('roundEnd', () => run(async () => renderRegs()));

game.on('start', () => run(async () => {
  if (game.me) initSector();
  // Bänk utan lag (åskådare): behåll lobbyn öppen så man kan ta över en dator när som helst.
  if (!(ONLINE && !game.me)) $('ov-start').classList.remove('open');
  $('ov-slut').classList.remove('open');
  pendingSlut = null; clearTimeout(slutFailsafe); slutFailsafe = null;   // nytt parti → nollställ ev. väntande slutskärm
  map.clearBuildings();
}));

game.on('roundStart', p => run(async () => {
  $('roundnum').textContent = p.round;
  if (ONLINE && !game.me && lastLobby) renderLobby(lastLobby);   // åskådarbänk: visa ta-över-läget
  if (p.round > 1) { await banner(`RUNDA ${p.round}`, false, 1300); }   // round_start-ljud spelas centralt (rigg)
  picked = null; expanded = null; resolving = false; klarLag = new Set();
  renderHand(); renderMe(); renderTeams(); renderRegs();
  $('btn-prop').disabled = false;
  $('endwrap').classList.remove('pulse');
  setEndBtn('AVSLUTA<br>OMGÅNG', false);
}));

game.on('gameEnd', p => run(async () => {
  // win/lose-ljud spelas centralt (rigg) — skärmen är tyst.
  // Lokalt (mock): 'award' stegade redan klart via kön → visa slut direkt.
  // Online: servern driver prisceremonin och avslutar med awardDone{over:true}; gameEnd kan komma
  // FÖRE awardCeremony (auto-läge) → vänta in awardDone. Säkerhetsnät om awardDone aldrig kommer.
  if (!ONLINE) { showSlut(p); return; }
  pendingSlut = p;
  clearTimeout(slutFailsafe);
  slutFailsafe = setTimeout(() => run(async () => showPendingSlut()), 15000);
}));

game.on('proposalOpened', p => run(async () => {
  // proposal_open-ljud spelas centralt (rigg); 'vote' stannar som torr feedback när DU trycker JA/NEJ.
  $('btn-prop').disabled = true;
  openVoteModal(p);
}));

game.on('proposalResolved', p => run(async () => {
  audio.play(p.passed ? 'proposal_pass' : 'proposal_fail');
  renderVoteState();
  $('vote-btns').style.display = 'none';
  if (p.type === 'event') {
    $('vote-sub').innerHTML = p.passed
      ? `<b style="color:var(--led-green)">${p.yesCount} av 4 lag tog erbjudandet — ön tar smällen</b>`
      : `<b style="color:var(--dim)">Inget lag nappade — ön slapp undan</b>`;
  } else {
    $('vote-sub').innerHTML = p.passed
      ? `<b style="color:var(--led-green)">✅ Förslaget gick igenom (${p.yesCount} av 4 röstade ja)</b>`
      : `<b style="color:var(--led-red)">❌ Förslaget föll (${p.yesCount} av 4 röstade ja)</b>`;
  }
  setTimeout(() => { $('ov-vote').classList.remove('open'); voteOpenFor = null; renderMe(); renderTeams(); renderRegs(); }, 1900);
}));

game.on('voteUpdate', () => renderVoteState());   // online: serverns röst-tally; tutorial: skriptade bot-röster

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
    if (m.senast && m.senast !== game.me) toast(`✓ ${teamName(m.senast)} har avslutat — rundan körs när alla är klara`);
    if (klarSent) setEndBtn(`VÄNTAR…<br>${m.klar.filter(id => lastLobby?.claims[id] === 'human').length}/${m.humans}`, true);
    renderTeams();
  });
  game.on('claimAck', () => {
    if (game.me) initSector();
    if (lastLobby) renderLobby(lastLobby);
    // Tog över ett lag mitt i pågående spel → bygg upp vyn och stäng lobbyn.
    const S = E()?.getState();
    if (game.me && S && S.round >= 1 && !S.over) rebuildFromState(S);
    // RUMS-FLÖDE: sent ansluten claimade ett lag medan gruppen är i tutorial-fasen → kör egen solo-tutorial.
    else if (game.me && game.phase === 'tutorial' && !tutRunning) runTutorial();
  });
  game.on('tradeIncoming', m => openTradeIncoming(m));
  game.on('notis', m => { audio.play('ui_notis'); toast(m.text); });
  game.on('disconnected', () => setConn(false));
  game.on('reconnected', r => { setConn(true); toast('✅ Återansluten'); if (r.started && r.state) rebuildFromState(r.state); });
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
  $('ohmode').innerHTML = `${moodIco(mode, 22)} ${MODE_LABEL[mode]}`;
  map.setOhalsaMode(mode);
  // Ambiens flyttad till centralhögtalaren (rigg/hjärna) — skärmen är tyst mellan interaktioner.
}

function renderMe() {
  if (!game.me || !E()?.getState()) return;
  const t = E().team(game.me);
  $('me-pengar').textContent = t.pengar;
  $('me-material').textContent = t.material;
  const inc = [];
  if (t.incP) inc.push(`＋${t.incP} 🪙`);
  if (t.incM) inc.push(`＋${t.incM} 🧱`);
  $('me-inc').textContent = inc.length ? inc.join('  ') + ' i inkomst varje runda' : '';
  renderHandAfford();
}

function flashRes(cur, amount) {
  const box = $(cur === 'pengar' ? 'box-pengar' : 'box-material');
  box.classList.add(amount > 0 ? 'flash-up' : 'flash-down');
  const chip = document.createElement('span');
  chip.className = 'floatchip';
  chip.style.color = amount > 0 ? 'var(--led-green)' : 'var(--led-red)';
  chip.textContent = `${amount > 0 ? '+' : ''}${amount} ${CUR_ICON[cur]}`;
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
                      : `<button class="byt" data-partner="${t.id}">${ico('byt', 16)} BYT</button>`;
    if (i === 0) {
      const crown = rich.varde > 0 ? ' ' + ico('krona', 24, { badge: false }) : '';
      return `<div class="tl-row lead ${me ? 'me' : ''}" style="${style}">
        <span class="rank">1</span>
        <span class="tl-badge">${logoSVG(t.id, 46)}</span>
        <div class="tl-id"><div class="nm">${t.namn}${crown}</div><div class="tl-sub">LEDARE${me ? ' · DU' : ''}</div></div>
        <div class="tl-cap"><span class="c-p">${ico('pengar', 20)}${t.pengar}</span><span class="c-m">${ico('material', 20)}${t.material}</span></div>
        ${me ? '' : `<button class="byt" data-partner="${t.id}">${ico('byt', 16)} BYT</button>`}
      </div>`;
    }
    return `<div class="tl-row ${me ? 'me' : ''}" style="${style}">
      <span class="rank">${i + 1}</span>
      <span class="tl-badge sm">${logoSVG(t.id, 30)}</span>
      <div class="tl-id"><div class="nm sm">${t.namn}${isBov ? ' ' + ico('varning', 16, { badge: false }) : ''}</div></div>
      <div class="tl-cap sm"><span class="c-p">${ico('pengar', 14)}${t.pengar}</span><span class="c-m">${ico('material', 14)}${t.material}</span></div>
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
    ? `${ico('varning', 16, { badge: false })} <b>${bov.namn}</b> sänker ön mest <span class="n">${bov.skada}</span>`
    : 'Ingen bov — ön andas ut';
  $('reg-klimat-mirror').innerHTML = `<div class="km-head">${ico('industri', 15)} KLIMATREGISTRET</div><div class="km-body">${body}</div>`;
}

function renderHand() {
  if (!game.me) return;
  const hand = handFor(game.me);
  const banned = E().getState().banDirtyThisRound;
  $('cards').innerHTML = hand.map(c => {
    const kostHtml = [c.kp ? `${c.kp}${ico('pengar', 14)}` : '', c.km ? `${c.km}${ico('material', 14)}` : ''].filter(Boolean).join(' + ');
    const gerHtml = c.gp ? `+${c.gp}${ico('pengar', 14)} /runda` : `+${c.gm}${ico('material', 14)} /runda`;
    const pos = c.oh > 0;
    return `
    <div class="card ${c.tier} ${banned && c.tier === 'smutsig' ? 'banned' : ''}" data-tier="${c.tier}">
      <div class="band">${TIER_LABEL[c.tier]}</div>
      <div class="inner">
        <img src="${manifest.buildings[c.asset].file}" alt="">
        <div class="info">
          <div class="nm">${c.namn}</div>
          <div class="oh-badge ${pos ? 'pos' : 'neg'}">${pos ? ico('tillvaxt', 30) : ico('industri', 30)}<span class="oh-num">${pos ? '+' + c.oh : c.oh}</span><span class="oh-lbl">öhälsa / runda</span></div>
          <div class="stat"><span class="k">Kostar</span> <span class="v">${kostHtml}</span></div>
          <div class="stat"><span class="k">Ger</span> <span class="v">${gerHtml}</span></div>
        </div>
      </div>
      <button class="kop">KÖP — BYGG PÅ ÖN</button>
      <span class="saknas"></span>
    </div>`;
  }).join('');
  $('cards').parentElement.classList.remove('hand-locked');
  document.querySelectorAll('#cards .card').forEach(el => {
    el.addEventListener('click', ev => {
      if (picked || resolving) return;
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
    if (res.need) toast(`Har inte råd — saknar ${res.need.pengar ? res.need.pengar + ' 🪙 ' : ''}${res.need.material ? res.need.material + ' 🧱' : ''}. Byt med ett annat lag!`, true);
    else toast(res.reason || res.why || 'gick inte', true);
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
  await banner('ÖN KOLLAPSADE — SPELAR OM RUNDAN', true, 1900);
  const S = E()?.getState();
  if (S) rebuildFromState(S);                         // ritar om byggnader/resurser/öhälsa från rollbacken; tänder .krisglow (S.inCrisis)
  $('btn-prop').disabled = false;
  $('endwrap').classList.remove('pulse');
  setEndBtn('AVSLUTA<br>OMGÅNG', false);
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
  $('me-sektor').innerHTML = mySector === 'material'
    ? `Du producerar <b>material ${ico('material', 16)}</b>.<br>Pengar ${ico('pengar', 16)} måste du <b>byta till dig</b> från Räven eller Örnen.`
    : `Du producerar <b>pengar ${ico('pengar', 16)}</b>.<br>Material ${ico('material', 16)} måste du <b>byta till dig</b> från Oxen eller Björnen.`;
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
  $('trade-give-lbl').innerHTML = `${giveCur} ${curIco(giveCur, 16)}`;
  $('trade-get-lbl').innerHTML = `${getCur} ${curIco(getCur, 16)}`;
  $('tb-give').innerHTML = `DU GER (${giveCur} ${curIco(giveCur, 14)})`;
  $('tb-get').innerHTML = `DU FÅR (${getCur} ${curIco(getCur, 14)})`;
  renderTradeModal();
  const go = $('btn-trade-go'); go.classList.remove('sent'); go.textContent = 'FÖRESLÅ BYTET'; go.disabled = false;   // nollställ ev. "skickad"-låsning
  audio.play('ui_open');
  $('ov-trade').classList.add('open');
}
function renderTradeModal() {
  $('partners').innerHTML = tradePartnersByNeed().map((t, i) => `
    <button class="${t.id === tradePartner ? 'sel' : ''} ${i === 0 ? 'top' : ''}" data-p="${t.id}">
      ${i === 0 ? `<span class="most">MEST ${curIco(getCur, 13)}</span>` : ''}
      ${logoSVG(t.id, i === 0 ? 54 : 40)}
      <span class="pn">${t.namn}</span>
      <small><span class="hot">${t[getCur]}${curIco(getCur, 13)}</span> · ${t[giveCur]}${curIco(giveCur, 13)}</small>
    </button>`).join('');
  document.querySelectorAll('#partners [data-p]').forEach(b =>
    b.addEventListener('click', () => { tradePartner = b.dataset.p; renderTradeModal(); }));
  $('give-amt').textContent = giveAmt;
  $('get-amt').textContent = getAmt;
}
$('btn-trade').addEventListener('click', () => { audio.play('ui_tap'); openTrade(); });
$('btn-trade-cancel').addEventListener('click', () => { audio.play('ui_close'); $('ov-trade').classList.remove('open'); });
$('give-minus').addEventListener('click', () => { giveAmt = Math.max(1, giveAmt - 1); renderTradeModal(); });
$('give-plus').addEventListener('click', () => { giveAmt = Math.min(E().team(game.me)[giveCur], giveAmt + 1); renderTradeModal(); });
$('get-minus').addEventListener('click', () => { getAmt = Math.max(1, getAmt - 1); renderTradeModal(); });
$('get-plus').addEventListener('click', () => { getAmt = getAmt + 1; renderTradeModal(); });
$('btn-trade-go').addEventListener('click', async () => {
  const go = $('btn-trade-go');
  go.disabled = true;
  // Byte med ett MÄNSKLIGT lag → servern frågar dem, svaret kan dröja. Själva knappen blir gul och
  // säger FÖRFRÅGAN SKICKAD (låst) så man inte trycker igen — AVBRYT går fortfarande. (Botar svarar
  // direkt → ingen väntan.) Återställs när svaret kommit.
  const partnerHuman = ONLINE && lastLobby?.claims?.[tradePartner] === 'human';
  if (partnerHuman) { go.classList.add('sent'); go.textContent = 'FÖRFRÅGAN SKICKAD'; }
  const res = await game.trade(tradePartner, giveAmt, giveCur, getAmt, getCur);
  go.classList.remove('sent'); go.textContent = 'FÖRESLÅ BYTET'; go.disabled = false;
  if (!res.ok) { toast(`❌ ${res.why || 'bytet gick inte'}`, true); return; }
  toast(`✅ Bytte ${giveAmt} ${CUR_ICON[giveCur]} mot ${getAmt} ${CUR_ICON[getCur]} med ${teamName(tradePartner)}`);
  flashRes(giveCur, -giveAmt); flashRes(getCur, getAmt);
  $('ov-trade').classList.remove('open');
  renderMe(); renderTeams();
});

// Inkommande bytesförfrågan (online, människa → människa)
function openTradeIncoming(m) {
  $('tradein-tx').innerHTML = `<b>${teamName(m.from)}</b> vill ge dig <b>${m.give} ${CUR_ICON[m.giveCur]}</b><br>i utbyte mot <b>${m.get} ${CUR_ICON[m.getCur]}</b> från dig.`;
  $('ov-tradein').classList.add('open');
  $('btn-tradein-ja').onclick = () => { game.tradeAnswer(m.offerId, true); $('ov-tradein').classList.remove('open'); };
  $('btn-tradein-nej').onclick = () => { game.tradeAnswer(m.offerId, false); $('ov-tradein').classList.remove('open'); };
}

// ═══════════════ Politik ═══════════════
// Fullständiga kort-definitioner för ALLA 9 förslagstyper (3 grund + 6 extra ur poolen).
// Render-logiken (visibleProps) visar grund-3 + de typer motorn lagt i S.extraProposals.
// Text-mallarna speglar de faktiska config-siffrorna (som grund-korten alltid gjort).
const GRUND_PROPS = ['gron', 'skatt', 'forbud'];
function propDefs() {
  const c = E().cfg, bov = E().worstPolluter(), rik = E().richest(), gron = E()._greenest();
  return [
    // ── Grund-3 (ligger alltid kvar) ──
    { type: 'gron', pic: '🌱', rubrik: 'Grön satsning', tx: `Alla som röstar JA betalar ${c.gronCost} 🪙.<br>Öns hälsa går <b>upp +${c.gronGain}</b>.`, ja: `JA — jag betalar ${c.gronCost} 🪙` },
    { type: 'skatt', pic: '💸', rubrik: 'Miljöskatt', tx: `Värsta boven (<b>${bov.namn}</b>) betalar ${c.taxAmount} 🪙<br>som delas mellan de andra lagen.`, ja: 'JA — beskatta boven' },
    { type: 'forbud', pic: '🚫', rubrik: 'Förbjud smutsig', tx: `Nästa runda kan <b>ingen</b> bygga det smutsiga kortet.`, ja: 'JA — förbjud smutsig' },
    // ── Extra-förslag (roterar; visas bara när de ligger i S.extraProposals) ──
    { type: 'krispaket', pic: '🆘', rubrik: 'Krispaket', tx: `Alla som röstar JA betalar ${c.gronCost} 🪙.<br>Går det igenom lyfts öns hälsa <b>+${c.krispaketGain}</b>.`, ja: `JA — jag betalar ${c.gronCost} 🪙` },
    { type: 'sektorskatt', pic: '🏝', rubrik: 'Sektorskatt', tx: `Pengar-lagen betalar ${c.sektorskattAmount} 🪙 var<br>som delas mellan material-lagen.`, ja: 'JA — beskatta pengar-sektorn' },
    { type: 'solidaritet', pic: '👑', rubrik: 'Solidaritetsskatt', tx: `Rikaste laget (<b>${rik.namn}</b>) betalar ${c.solidaritetPengar} 🪙 + ${c.solidaritetMaterial} 🧱<br>som delas mellan de tre andra.`, ja: 'JA — beskatta rikaste' },
    { type: 'lojalitet', pic: '🤝', rubrik: 'Grön utdelning', tx: `Går det igenom: varje JA-lag får <b>+${c.lojalitetBonus} 🪙</b>,<br>varje NEJ-lag betalar <b>${c.lojalitetBoter} 🪙</b>. Öns hälsa +${c.lojalitetOh}.`, ja: `JA — jag tar +${c.lojalitetBonus} 🪙` },
    { type: 'marknadsavtal', pic: '📈', rubrik: 'Marknadsavtal', tx: `Bonus <b>+${c.marknadsavtalBonus} 🪙 till alla</b> — men <b>bara om exakt 3 av 4</b> röstar JA.<br>En måste avstå.`, ja: 'JA — jag är med' },
    { type: 'gronstod', pic: '💊', rubrik: 'Riktat grönt stöd', tx: `Alla som röstar JA betalar ${c.gronCost} 🪙 → hela potten<br>går till grönaste laget (<b>${gron.namn}</b>).`, ja: `JA — jag skänker ${c.gronCost} 🪙` },
  ];
}
// Grund-3 + rundans extra (server-auktoritativa i S.extraProposals). INGEN klient-lokal slump här.
function visibleProps() {
  const defs = propDefs();
  const extra = E().getState()?.extraProposals || [];
  const show = [...GRUND_PROPS, ...extra];
  return show.map(type => defs.find(d => d.type === type)).filter(Boolean);
}
$('btn-prop').addEventListener('click', () => {
  if (E().getState().proposal || resolving) return;
  audio.play('ui_tap');
  $('proplist').innerHTML = visibleProps().map(p => `
    <div class="propcard propchoice" data-type="${p.type}">
      <div class="pic">${p.pic}</div>
      <div class="tx"><b style="color:var(--text)">${p.rubrik}</b><br>${p.tx}</div>
    </div>`).join('');
  document.querySelectorAll('.propchoice').forEach(el => el.addEventListener('click', () => {
    $('ov-choose').classList.remove('open');
    game.openProposal(el.dataset.type);
  }));
  audio.play('ui_open');
  $('ov-choose').classList.add('open');
});
$('btn-choose-cancel').addEventListener('click', () => { audio.play('ui_close'); $('ov-choose').classList.remove('open'); });

function openVoteModal(p) {
  voteOpenFor = p;
  // Händelse-frestelse (typ:'event', t.ex. sponsrat): varje lag väljer själv, ingen 3/4-grind.
  if (p.type === 'event') {
    const ev = p.event || E().getState().proposal?.event || {};
    const bild = ev.bild || (ev.id ? `assets/event_${ev.id}.png` : null);
    $('vote-sub').textContent = 'Centralmakten erbjuder — varje lag väljer själv';
    if (bild) $('vote-pic').innerHTML = `<img src="${bild}" alt="" style="width:200px;height:120px;object-fit:cover;border-radius:12px;display:block">`;
    else $('vote-pic').textContent = '🤝';
    $('vote-tx').innerHTML = `<b style="color:var(--text)">${ev.rubrik || ''}</b><br>${ev.rostFraga || ev.text || ''}`;
    $('btn-ja').textContent = `JA — ta ${ev.ja ?? ''} 🪙`;
    $('vote-btns').style.display = p.by === game.me ? 'none' : 'flex';
    renderVoteState();
    $('ov-vote').classList.add('open');
    return;
  }
  const def = propDefs().find(d => d.type === p.type);
  $('vote-sub').textContent = `${teamName(p.by)} föreslår — det krävs 3 av 4 JA`;
  $('vote-pic').textContent = def.pic;
  $('vote-tx').innerHTML = `<b style="color:var(--text)">${def.rubrik}</b><br>${def.tx}`;
  $('btn-ja').textContent = def.ja;
  $('vote-btns').style.display = p.by === game.me ? 'none' : 'flex';
  renderVoteState();
  $('ov-vote').classList.add('open');
}
function renderVoteState() {
  const p = E().getState()?.proposal; if (!p) return;
  $('votestat').innerHTML = E().getState().teams.map(t => {
    const v = p.votes[t.id];
    return `<div class="v"><div class="d ${v === true ? 'ja' : v === false ? 'nej' : ''}"></div>${t.namn}${t.id === game.me ? ' (du)' : ''}</div>`;
  }).join('');
}
$('btn-ja').addEventListener('click', () => humanVote(true));
$('btn-nej').addEventListener('click', () => humanVote(false));
function humanVote(yes) {
  audio.play('vote');
  game.vote(yes);
  $('vote-btns').style.display = 'none';
  renderVoteState();
}

// ═══════════════ Register / årsberättelse ═══════════════
$('btn-log').addEventListener('click', () => { audio.play('ui_open'); renderRegister(); $('ov-register').classList.add('open'); });
$('btn-reg-close').addEventListener('click', () => { audio.play('ui_close'); $('ov-register').classList.remove('open'); });
function renderRegister() {
  const lb = E().leaderboards();
  $('tbl-bors').innerHTML = lb.bors.map((r, i) =>
    `<tr class="${r.id === game.me ? 'me-row' : ''}"><td>${i + 1}.</td><td>${logoSVG(r.id, 28)} ${r.namn}${r.id === game.me ? ' (du)' : ''} ${i === 0 ? '👑' : ''}</td><td class="n">${r.varde}</td></tr>`).join('');
  $('tbl-klimat').innerHTML = lb.klimat.map((r, i) =>
    `<tr class="${r.id === game.me ? 'me-row' : ''}"><td>${i + 1}.</td><td>${logoSVG(r.id, 28)} ${r.namn}${r.id === game.me ? ' (du)' : ''} ${i === 0 && r.skada < 0 ? '⚠️' : ''}</td><td class="n" style="color:var(--led-red)">${r.skada}</td></tr>`).join('');
  const c = E().contribution(game.me);
  $('me-contrib').innerHTML = `Ditt avtryck: <span class="ohplus">+${c.impactPos}</span> / <span class="ohminus">${c.impactNeg}</span> · netto <b>${c.netto >= 0 ? '+' + c.netto : c.netto}</b> · kapital <b style="color:var(--led)">${c.kapital}</b>`;
  $('tbl-log').innerHTML = `<tr><th>RUNDA</th><th>DU BYGGDE</th><th>ÖN</th></tr>` +
    c.log.map(r => `<tr><td>${r.round}</td><td>${r.namn}</td><td class="${r.oh > 0 ? 'ohplus' : r.oh < 0 ? 'ohminus' : ''}">${r.oh === 0 ? '—' : fmtOh(r.oh)}</td></tr>`).join('');
}

// ═══════════════ Slutskärm ═══════════════
const EFTERSNACK = [
  '💬 <b>Prata om det:</b> Vem tjänade mest på öns bekostnad — och vem betalade priset?',
  '💬 <b>Prata om det:</b> Hade ön klarat sig om alla byggt likadant som du?',
  '💬 <b>Prata om det:</b> Vilket politiskt förslag hade behövts tidigare?',
];
function showSlut(p) {
  $('slut-title').textContent = p.won ? '🌱 ÖN KLARADE SIG!' : '💀 ALLA FÖRLORADE';
  $('slut-title').className = 'big ' + (p.won ? 'win' : 'lose');
  $('slut-why').innerHTML = p.won
    ? `Öns hälsa slutade på <b style="color:var(--led-green)">${p.oh}</b> — över målet ${p.threshold}. Då vinner det rikaste laget.`
    : p.reason;
  $('slut-cards').innerHTML =
    (p.won ? `<div class="award"><div class="em">🏆</div><h4>Vinnare — rikast</h4><div class="who">${logoSVG(p.winner.teamId, 64)}${p.winner.namn}${p.winner.teamId === game.me ? ' (du!)' : ''}<span class="val">${p.winner.kapital} kapital</span></div></div>` : '') +
    (p.klimatbov ? `<div class="award" style="border-color:var(--edge2)"><div class="em">🏭</div><h4>Klimatbov</h4><div class="who">${logoSVG(p.klimatbov.teamId, 64)}${p.klimatbov.namn}${p.klimatbov.teamId === game.me ? ' (du…)' : ''}<span class="val ohminus">${p.klimatbov.skada} öhälsa</span></div></div>` : '');
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
  } else game.playAgain();
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
  $('bannertxt').textContent = text;
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
function renderLobby(m) {
  lastLobby = m;
  if (!ONLINE) return;
  const phase = gamePhase();
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
    const status = mine ? `<span class="st du"><i class="dot"></i>DU ✓</span>`
      : st === 'human' ? `<span class="st human"><i class="dot"></i>SPELARE</span>`
      : st === 'bot' ? `<span class="st"><i class="dot"></i>${phase === 'pagar' ? 'DATOR — TA ÖVER!' : 'DATOR 🤖'}</span>`
      : phase === 'pagar' ? `<span class="st"><i class="dot"></i>—</span>`
      : `<span class="st"><i class="dot"></i>DATOR 🤖</span>`;
    return `<button class="lobbyteam ${mine ? 'sel' : ''} ${!takbar && !mine ? 'taken' : ''}" data-lag="${id}" ${takbar ? '' : 'disabled'}>
      ${logoSVG(id, 54)}<b>${teamName(id)}</b>
      <small>${status}</small>
    </button>`;
  }).join('');
  document.querySelectorAll('.lobbyteam:not([disabled])').forEach(b =>
    b.addEventListener('click', () => { audio.unlock(); game.claim(b.dataset.lag); }));

  const btn = $('btn-start');
  if (phase === 'pagar') { btn.style.display = 'none'; $('startnote').style.display = 'none'; }
  else {
    btn.style.display = '';
    btn.disabled = false;   // startbar när som helst — tomma lag körs av bottar
    btn.textContent = phase === 'slut' ? 'STARTA NYTT SPEL' : 'STARTA SPELET';
    $('startnote').style.display = 'block';
    $('startnote').textContent = game.me ? 'Lag utan spelare styrs av datorn 🤖'
                                         : 'Inget lag valt — du tittar på. Datorn spelar alla 🤖';
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
  map.clearBuildings();
  for (const t of S.teams) t.slots.forEach((b, i) => map.placeBuilding(t.id, i, manifest.buildings[b.asset].file));
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
  if (S.proposal && !S.proposal.resolved) openVoteModal(S.proposal);
  $('ov-start').classList.remove('open');
}

// ——— Init ———
$('roundmax').textContent = E().cfg.rounds;
$('ohgoal').style.left = `${E().cfg.threshold}%`;
$('ohgoal-lbl').textContent = `MÅL ${E().cfg.threshold}`;
$('ohzones').innerHTML = `<i class="z1" style="width:${E().cfg.redZone}%"></i><i class="z2" style="width:${E().cfg.greenZone - E().cfg.redZone}%"></i><i class="z3" style="width:${100 - E().cfg.greenZone}%"></i>`;

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
// Servern broadcastar 'trailer' när alla anslutit (före tutorial) eller via spelledarens
// kommando. Skärmen spelar BARA videon i #ov-trailer; ljus-cuesen fyras från EN källa
// (servern), aldrig härifrån. Döljs vid 'trailerDone' ELLER video-'ended' — och senast
// efter dur (failsafe) så det normala flödet (attract/lobby/tutorial) ALDRIG fastnar.
let trailerFailsafe = null;
function doljTrailer() {
  clearTimeout(trailerFailsafe); trailerFailsafe = null;
  const v = $('trailer-video');
  try { v.pause?.(); } catch {}
  $('ov-trailer').classList.remove('open');
}
game.on('trailer', p => {
  trailerVisad = true;   // denna skärm har sett trailern → STARTA ska inte trigga en ny
  const v = videoEllerFallback('trailer-video', 'trailer-fallback', p?.src);   // saknas klippet → placeholder
  $('ov-trailer').classList.add('open');
  if (v) {
    v.muted = true;   // TYST på skärmen — trailer-ljudet går centralt via hjärnan (navet → centralhögtalaren)
    v.addEventListener('ended', doljTrailer, { once: true });
    try { v.currentTime = 0; } catch {}
    v.play?.().catch(() => {});   // autoplay nekad → ljussekvensen körs ändå, failsafe/trailerDone döljer
  }
  const dur = (p && p.dur) ? p.dur : 30;
  clearTimeout(trailerFailsafe);
  trailerFailsafe = setTimeout(doljTrailer, (dur + 1) * 1000);   // dölj senast efter dur även om trailerDone/ended uteblir
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
  efterTrailerFailsafe = setTimeout(korEfterTrailer, 33000);  // failsafe: fastna aldrig om 'trailerDone' uteblir
}
function korEfterTrailer() {
  clearTimeout(efterTrailerFailsafe); efterTrailerFailsafe = null;
  if (!efterTrailer) return;
  const f = efterTrailer; efterTrailer = null;
  f();
}
// Tap på trailern → hoppa över (servern stoppar ljussekvensen + säger "klart" till alla skärmar).
$('ov-trailer').addEventListener('click', () => {
  if (game.skipTrailer) game.skipTrailer(); else { doljTrailer(); korEfterTrailer(); }
});
// Nytt parti (replay) → tillåt att trailern + tutorialen körs igen vid nästa STARTA.
game.on('gameEnd', () => { trailerVisad = false; tutRunning = false; });

// ═══════════════ RUMS-FLÖDE: 15 s start-fönster · startGo · late-join · omstart · skippa intro ═══════════════
// Det BEFINTLIGA flödet (trailer → tutorial → runda 1) rörs inte — fönstret läggs FÖRE det, och
// late-join/omstart hoppar in i / river ner rätt fas. Allt gardat av ONLINE (lokalt läge opåverkat).

// Vad som händer EFTER trailern (tutorial eller riktiga spelet). I tutorial-läge krävs ett lag.
function computeFortsatt() {
  if (MODE === 'tutorial' && gamePhase() === 'lobby') {
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
function fireTutAbort() { tutAbort = true; while (_tutAborters.length) _tutAborters.shift()('abort'); }
function resetToLobbyUI() {
  fireTutAbort();                               // avbryt ev. pågående solo-tutorial rent
  tutRunning = false; tutInCeremony = false;
  startWindowLeft = null;
  efterTrailer = null;
  trailerVisad = false;                         // BUGFIX: annars hoppas trailern över nästa parti efter "TILL LOBBYN" (nollades bara vid gameEnd)
  clearTimeout(efterTrailerFailsafe); efterTrailerFailsafe = null;
  doljTrailer();
  ['ov-attract', 'ov-narrativ', 'ov-trailer', 'ov-ready', 'ov-countdown', 'ov-slut', 'ov-slutdel',
   'ov-award', 'ov-event', 'ov-vote', 'ov-choose', 'ov-trade', 'ov-tradein', 'ov-register', 'ov-paus'].forEach(id => $(id)?.classList.remove('open'));
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
    // Servern skickar 'tilllobby' FÖRE detta → vyn är redan nollställd; lägg attract-skärmen överst + spela filmen.
    $('ov-attract').classList.add('open');
    const v = videoEllerFallback('attract-video', 'attract-fallback', ONB.attract);
    v && v.play?.().catch(() => {});
  });
  // Gate 4: SERVERN äger den gemensamma nedräkningen. Rita 10→0 synkat på alla skärmar.
  realGame.on('startCountdown', m => {
    tutInCeremony = true;                      // håll konvergens-läget (även om vi kom hit utan tutorial)
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
    if (!tutRunning || game.backend === realGame) return;
    convergeToGame();
  });
}

// Sent ansluten: nu finns alla trailer-/tutorial-hjälpare → hoppa in i rätt fas.
if (senJoin) joinPhase(bootPhase);

// ═══════════════ Runda 0 — tutorial (mode='tutorial') ═══════════════
// En skriptad övningsrunda på en EGEN kastmotor bakom samma UI: deterministiska botar,
// ingen timer, varje beat gör-gated men hoppbar och auto-utförd vid timeout (fastnar aldrig).
// Kastas när den är klar — det riktiga spelet startar orört på runda 1. Inga regler rörda.

function makeTutorial(myLag) {
  const em = makeEmitter();
  const engine = new EcoLoco({ ...(manifest.config || {}), humanTeam: myLag, startPengar: 26, startMaterial: 26 });
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
    openProposal: () => {},
    vote: yes => engine.vote(myLag, yes),
    klar: () => { em.emit('resolveStart', {}); engine.endRound(); },
    awardsKlara: () => {}, playAgain: () => {},
    script: {
      bots,
      oppnaForslag: () => engine.openProposal('gron', bots[0]),
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
// RUMS-FLÖDE: ett löfte som resolvar till 'abort' när spelledaren tar alla till lobbyn mitt i tutorialen.
// Varje väntepunkt i tutorialen racear mot detta → tutorialen släpper direkt och runTutorial returnerar.
function tutAbortP() { return new Promise(res => { if (tutAbort) res('abort'); else _tutAborters.push(res); }); }
async function tutBeat({ ix, txt, x, y, focus, until, autoDo, autoMs = 12000 }) {
  if (tutAbort) return;                       // omstart under tutorialen → visa ingenting mer
  tutFocus(focus);
  const b = $('tutbox');
  b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.display = 'block';
  $('tut-txt').innerHTML = txt;
  [...$('tut-dots').children].forEach((d, i) => d.classList.toggle('on', i <= ix));
  audio.play('ui_tap');
  let tmo = null;
  const skipP = new Promise(res => { $('tut-skip').onclick = () => res('skip'); });
  const timeP = new Promise(res => { tmo = setTimeout(() => res('timeout'), autoMs); });
  const r = await Promise.race([until, skipP, timeP, tutAbortP()]);
  clearTimeout(tmo);
  if (r === 'abort') { b.style.display = 'none'; tutFocus(null); return; }
  if (r === 'skip' || r === 'timeout') { await autoDo?.(); await Promise.race([until, delay(4000), tutAbortP()]); }  // handlingen görs åt dig
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

// Konsekvens-beat ("SE"): spelaren läser i egen takt och trycker NÄSTA för att gå vidare.
function tutSay({ ix, txt, x, y, focus }) {
  if (tutAbort) return Promise.resolve();      // omstart under tutorialen → visa ingenting mer
  return new Promise(res => {
    tutFocus(focus);
    const b = $('tutbox');
    b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.display = 'block';
    $('tut-txt').innerHTML = txt;
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
    const tmo = setTimeout(finish, 45000);   // kiosk-säkring: aldrig fast för alltid
    tutAbortP().then(finish);                // omstart → släpp direkt (finish är idempotent via done)
  });
}

// Startceremoni: ÄR DU REDO? → (vänta in alla lag) → nedräkning 10→0 → RUNDA 1.
// Riggen (LED-chase, riser-soundscape, vitt ljus 3 s) styrs av semantiska cues: ecoloco/rigg/ceremoni.
async function startCeremony() {
  tutInCeremony = true;                       // från och med nu konvergerar skärmen mot spelet (rebuildFromState)
  $('ov-ready').classList.add('open');
  await Promise.race([new Promise(res => { $('btn-ready').onclick = () => { audio.play('ui_confirm'); res(); }; }), tutAbortP()]);
  if (tutAbort) return;
  $('ov-ready').classList.remove('open');

  if (ONLINE) {
    // ═══ Gate 3 + 4 (RUMS-FLÖDE): lämna över till SERVERN ═══
    // Säg bara "den här skärmen är redo". Servern väntar in ALLA levande lag (eller spelledarens
    // TVINGA START / failsafe), kör EN gemensam nedräkning (realGame 'startCountdown' nedan ritar
    // 10→0 synkat på alla skärmar) och startar runda 1 åt alla samtidigt (realGame 'start' →
    // convergeToGame). INGEN lokal nedräkning, INGEN lokal startGame → aldrig mer osynk.
    realGame.net.tutReady();
    $('cd-lbl').textContent = 'VÄNTAR PÅ DE ANDRA LAGEN';
    $('cd-num').textContent = '…';
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
  await banner('RUNDA 1', false, 1500);
  if (tutAbort) return;
  game.attach(realGame);
  game.startGame();
}

async function runTutorial() {
  if (tutRunning) return;                      // redan igång (late-join/claim kan trigga dubbelt)
  tutRunning = true; tutAbort = false; tutInCeremony = false; _tutAborters.length = 0;
  game.enterTutorial?.();                       // RUMS-FLÖDE: markera tutorial-fasen för sent anslutna
  const myLag = ONLINE ? realGame.me : (manifest.config?.humanTeam || 'aker');
  const tut = makeTutorial(myLag);
  game.attach(tut);
  $('ov-start').classList.remove('open');
  $('tutveil').style.display = 'block';
  tut.startGame();
  await delay(500);
  if (tutAbort) return;

  // ——— INTRO: vad går spelet ut på? (3 rutor, klicka igenom, highlightar relevant yta) ———
  await tutSay({ ix: 0, focus: '.res', x: 300, y: 380,
    txt: '🎯 Målet: bli <b>rikast</b>. Den som har mest <b>pengar + material</b> tillsammans när spelet är slut vinner.' });
  if (tutAbort) return;
  await tutSay({ ix: 0, focus: '#roundnum', x: 300, y: 190,
    txt: '⏱ Ni spelar <b>8 rundor</b> totalt. Varje runda bygger ni, byter och röstar.' });
  if (tutAbort) return;
  await tutSay({ ix: 0, focus: '.ohbar', x: 520, y: 190,
    txt: '🏝 Men håll <b>öns hälsa över 60</b> till slutet — annars <b>kollapsar hela ön och ingen vinner</b>. Ni sitter i samma båt.' });
  if (tutAbort) return;

  $('timertxt').textContent = '–:––';
  await banner('ÖVNING — RUNDA 0', false, 1400);
  if (tutAbort) return;

  // ——— 1) BYGG (gör) — det billiga lockar ———
  const dirtyTier = E().getState().banDirtyThisRound ? 'standard' : 'smutsig';
  await tutBeat({ ix: 0, txt: 'Bygg en byggnad. Tryck på ett kort.', x: 520, y: 560, focus: '.handbar',
    until: tutOnce('build', p => p.teamId === myLag),
    autoDo: () => buyCard(dirtyTier) });
  if (tutAbort) return;
  await delay(650);
  if (tutAbort) return;

  // ——— 2) SE KONSEKVENSEN: du tjänar + ön betalar (Josefs kärna) ———
  const built = handFor(myLag).find(c => c.tier === picked) || handFor(myLag)[0];
  const prodCur = mySector;
  const prodBox = prodCur === 'pengar' ? '#box-pengar' : '#box-material';
  const inc = prodCur === 'pengar' ? built.gp : built.gm;
  await tutSay({ ix: 0, focus: prodBox, x: 300, y: 300,
    txt: `Byggt! Den ger dig <b>+${inc}${ico(prodCur === 'pengar' ? 'pengar' : 'material', 18)}</b> varje år.`, ms: 3000 });
  await tutSay({ ix: 0, focus: '.topbar', x: 520, y: 150,
    txt: built.oh < 0
      ? `Men det billiga <b>sänker ön ${built.oh}${ico('industri', 18)}</b> — notan delar ni fyra.`
      : `Och det <b>lyfter ön +${built.oh}${ico('tillvaxt', 18)}</b>.`, ms: 3400 });
  if (tutAbort) return;
  await tutBarrier(1);
  if (tutAbort) return;

  // ——— 3) SLÅ I VÄGGEN → BYT (beroendet upptäcks genom att fastna) ———
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
  await tutSay({ ix: 1, focus: '#me-sektor', x: 300, y: 330,
    txt: `Du gör bara <b>${prodCur === 'pengar' ? 'pengar' : 'material'}</b>. Den andra valutan <b>saknas</b> — därför måste du byta med de andra.`, ms: 3600 });
  const partner = E().getState().teams.find(x => x.id !== myLag && x.sektor !== mySector)?.id;
  openTrade(partner);
  await tutBeat({ ix: 1, txt: `Byt till dig ${ico(getCur === 'pengar' ? 'pengar' : 'material', 18)}. Tryck <b>FÖRESLÅ BYTET</b>.`,
    x: 1180, y: 150, focus: null,
    until: tutOnce('trade', p => p.from === myLag || p.to === myLag),
    autoDo: () => $('btn-trade-go').click() });
  if (tutAbort) return;
  document.querySelectorAll('#cards .card.tut-vagg').forEach(el => {
    el.classList.remove('tut-vagg', 'poor');
    el.querySelector('.saknas').innerHTML = '';
  });
  await delay(500);
  if (tutAbort) return;
  const getBox = getCur === 'pengar' ? '#box-pengar' : '#box-material';
  await tutSay({ ix: 1, focus: getBox, x: 300, y: 300,
    txt: `Bytte till dig <b>${ico(getCur === 'pengar' ? 'pengar' : 'material', 18)}</b> — nu räcker det.` });
  await tutSay({ ix: 1, focus: null, x: 1140, y: 150,
    txt: `På riktigt förhandlar ni med de andra lagen genom <b>telefonen på arbetsbordet</b>.` });
  if (tutAbort) return;
  await tutBarrier(2);
  if (tutAbort) return;

  // ——— 4) RÖSTA → se den delade mätaren svara ———
  const resolvedP = tutOnce('proposalResolved');
  tut.script.oppnaForslag();
  await delay(700);
  if (tutAbort) return;
  await tutBeat({ ix: 2, txt: 'Ön behöver hjälp. Rösta <b>JA</b>.', x: 1180, y: 120, focus: null,
    until: tutWaitP(() => tut.E().getState().proposal?.votes[myLag] !== undefined),
    autoDo: () => $('btn-ja').click() });
  if (tutAbort) return;
  for (const b of tut.script.bots) { await delay(600); if (tutAbort) return; tut.script.botRosta(b); }
  await Promise.race([resolvedP, delay(3000), tutAbortP()]);
  if (tutAbort) return;
  await delay(500);
  if (tutAbort) return;
  await tutSay({ ix: 2, focus: '.topbar', x: 520, y: 150,
    txt: `3 av 4 sa ja — <b>ön andas ut ${ico('tillvaxt', 18)}</b>. Din röst flyttade den delade mätaren.`, ms: 3200 });
  if (tutAbort) return;
  await tutBarrier(3);
  if (tutAbort) return;

  // ——— Coach-tips: peka ut surfplattan med spel-coachen innan sista steget ———
  // tutSay visar NÄSTA-knapp och ligger kvar tills spelaren trycker (45 s kiosk-säkring) — ingen auto-timer.
  await tutSay({ ix: 3, focus: null, x: 520, y: 380,
    txt: `Har ni frågor? Vid sidan står en <b>coach</b> som kan reglerna — fråga den när ni vill.` });
  if (tutAbort) return;

  // ——— 5) AVSLUTA & BOKSLUT: alla tre priser lärs ut, sedan på riktigt ———
  await tutSay({ ix: 3, focus: '#endwrap', x: 1020, y: 540,
    txt: `Sista steget: avsluta rundan. Efter <b>varje runda</b> delas tre priser ut — årets ledande företag, årets eldsjäl och årets sabotör.` });
  if (tutAbort) return;
  const roundEndP = tutOnce('roundEnd');
  await tutBeat({ ix: 3, txt: 'Klar? Tryck på knappen <b>AVSLUTA OMGÅNG</b>.', x: 1040, y: 760, focus: '#endwrap',
    until: roundEndP,
    autoDo: () => $('btn-end').click() });
  if (tutAbort) return;
  await delay(1200);
  await tutWaitP(() => !running);                    // vänta ut bokslutsscenerna + award-popuparna
  if (tutAbort) return;
  await tutBarrier(4);
  if (tutAbort) return;

  // Övningen klar → tydlig startceremoni (redo → nedräkning → vitt ljus → RUNDA 1) → riktiga spelet
  await startCeremony();
}

// Spelar-start = ALLTID utan spelledare (selfplay). Spelledar-läget styrs från spelledar-pulten
// (den kan ta över riggen/prisutdelningen när som helst) — spelarna väljer det inte i lobbyn.
// Paus (spelledare): fryser BARA spelmotorn — ambiencen i riggen fortsätter spela.
$('btn-paus')?.addEventListener('click', () => game.pause());
$('ov-paus')?.addEventListener('click', () => game.pause());
game.on('paused', m => {
  uiPaused = !!m.paused;                      // fryser award-popupens auto-nedräkning
  $('ov-paus')?.classList.toggle('open', !!m.paused);
  $('btn-paus')?.classList.toggle('aktiv', !!m.paused);
});
game.on('start',   () => { const pb = $('btn-paus'); if (pb) pb.style.display = ''; });
game.on('gameEnd', () => { const pb = $('btn-paus'); if (pb) pb.style.display = 'none'; $('ov-paus')?.classList.remove('open'); });

$('btn-start').addEventListener('click', async () => {
  audio.unlock();
  audio.play('ui_tap');
  if (ONLINE) {
    if (gamePhase() !== 'lobby') return;          // pågår/slut → STARTA gör inget
    if (startWindowLeft != null) { toast('Spelet startar strax…'); return; }   // fönstret redan öppet
    if (MODE === 'tutorial') {
      if (!game.me) await delay(1500);            // kiosk-claim (?lag=) kan vara på väg in
      if (!game.me) { toast('Tryck på ett lag först!', true); return; }   // i tutorial-läge startar man inte utan lag
    }
    // RUMS-FLÖDE: öppna 15 s join-fönstret. Vid 0 → servern broadcastar 'startGo' → beginStartFlow()
    // kör det BEFINTLIGA flödet (trailer → tutorial → runda 1) på alla skärmar. Fler kan ansluta under tiden.
    game.startWindow();
  } else {
    $('ov-start').classList.remove('open');
    if (MODE === 'tutorial') { runTutorial(); return; }
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
