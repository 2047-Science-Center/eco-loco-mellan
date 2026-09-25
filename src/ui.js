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

import { EcoLoco, AREAS, handFor, ohMode } from '../spec/engine.js';
import { mockOpponentsAct, mockOpponentsVote } from '../spec/mock-opponents.js';
import { renderMap } from './map.js';
import { logoSVG } from './logos.js';
import { GameAudio } from './audio.js';
import { ServerNet } from './net.js';

const $ = id => document.getElementById(id);
const delay = ms => new Promise(r => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const ONLINE = params.has('online');

const manifest = await (await fetch('./spec/assets.json')).json();
const slots = Object.fromEntries(Object.entries(manifest.slots).filter(([k]) => k !== '_readme'));
const audio = new GameAudio(manifest.audio || {});

const MODE_LABEL = {
  superdaligt: '🤢 Superdåligt', daligt: '😟 Dåligt', neutralt: '😐 Neutralt',
  bra: '🙂 Bra', mycketbra: '😄 Mycket bra',
};
const TIER_LABEL = { smutsig: 'SMUTSIG', standard: 'STANDARD', gron: 'GRÖN' };
const CUR_ICON = { pengar: '🪙', material: '🧱' };
const teamName = id => AREAS.find(a => a.id === id).namn;
const fmtOh = v => (v > 0 ? '+' + v : v) + (v > 0 ? ' 🌱' : ' 🏭');

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
                    'income', 'ohalsa', 'award', 'event', 'roundEnd', 'gameEnd'])
    engine.on(ev, p => em.emit(ev, p));

  let left = 0, tid = null, votingOpen = false;
  const stopT = () => { clearInterval(tid); tid = null; };
  const startT = () => {
    stopT(); left = engine.cfg.timerSec;
    em.emit('timer', { left });
    tid = setInterval(() => { left--; em.emit('timer', { left }); if (left <= 0) { stopT(); doResolve(); } }, 1000);
  };
  function doResolve() {
    if (engine.getState().over || votingOpen) return;
    stopT();
    em.emit('resolveStart', {});
    mockOpponentsAct(engine, me);
    engine.endRound();
  }
  engine.on('roundStart', p => {
    startT();
    if (p.round >= 2 && Math.random() < 0.35) setTimeout(() => {
      const S = engine.getState();
      if (S.over || S.proposal) return;
      const bots = S.teams.filter(t => t.id !== me);
      const by = bots[Math.floor(Math.random() * bots.length)].id;
      const type = S.oh < 45 ? (Math.random() < 0.6 ? 'gron' : 'forbud')
                 : Math.random() < 0.5 ? 'skatt' : (Math.random() < 0.5 ? 'gron' : 'forbud');
      engine.openProposal(type, by);
    }, 2500);
  });
  engine.on('proposalOpened', () => { votingOpen = true; });
  engine.on('proposalResolved', () => { votingOpen = false; });
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
    startGame: () => net.startGame(),
    selectCard: t => net.selectCard(t),
    trade: (to, give, gc, get, gc2) => net.trade(to, give, gc, get, gc2),
    openProposal: t => net.openProposal(t),
    vote: y => net.vote(y),
    klar: () => net.klar(),
    playAgain: () => net.startGame(),
    claim: lag => net.claim(lag),
    tradeAnswer: (id, a) => net.tradeAnswer(id, a),
    _first: first,
  };
}

const game = ONLINE ? await makeOnline() : makeLocal();
const E = game.E;

// ═══════════════ Karta + skala ═══════════════
const map = renderMap($('map'), { slots, mode: 'neutralt' });
map.showSlots(false);
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

game.on('event', p => run(async () => {
  audio.play('event');
  await banner(`⚠ ${p.namn.toUpperCase()}!`, true, 1700);
  toast(`⚠ Krisen slog till: alla lag förlorar ${p.loss} 🪙 och ${p.loss} 🧱`, true);
  renderMe(); renderTeams();
  if (resolving) await delay(600);
}));

// Award-popup: tryck går vidare; auto-fortsätter efter 8 s så självspelande läge aldrig fastnar.
function clickOrTimeout(el, ms) {
  return new Promise(res => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); el.removeEventListener('pointerdown', done); res(); }
    el.addEventListener('pointerdown', done);
  });
}

game.on('award', p => run(async () => {
  const show = async (em2, rubrik, w, val, snd, cls) => {
    audio.play(snd);
    $('awardcard').innerHTML = `<div class="em">${em2}</div><h4>${rubrik}</h4>` +
      (w ? `<div class="who">${logoSVG(w.teamId, 64)}${w.namn}<span class="val ${cls}">${val}</span></div>`
         : `<div class="who" style="font-size:19px;color:var(--dim)">Ön andas ut 😮‍💨</div>`) +
      `<div class="fortsatt">tryck för att fortsätta ›</div>`;
    $('ov-award').classList.add('open');
    await delay(500);                       // hinner läsas innan tryck registreras
    await clickOrTimeout($('ov-award'), 8000);
    $('ov-award').classList.remove('open');
    await delay(250);
  };
  if (p.led) await show('🏆', 'Årets ledande företag', p.led, `+${p.led.varde} kapital`, 'award_led', 'ohplus');
  if (p.eld) await show('🌱', 'Årets eldsjäl', p.eld, `+${p.eld.varde} öhälsa`, 'award_eld', 'ohplus');
  await show('💀', 'Årets sabotör', p.sab, p.sab ? `${p.sab.varde} öhälsa` : '', 'award_sab', 'ohminus');
  renderRegs();
}));

game.on('roundEnd', () => run(async () => renderRegs()));

game.on('start', () => run(async () => {
  if (game.me) initSector();
  $('ov-start').classList.remove('open');
  $('ov-slut').classList.remove('open');
  map.clearBuildings();
}));

game.on('roundStart', p => run(async () => {
  $('roundnum').textContent = p.round;
  if (p.round > 1) { audio.play('round_start'); await banner(`RUNDA ${p.round}`, false, 1300); }
  picked = null; expanded = null; resolving = false; klarLag = new Set();
  renderHand(); renderMe(); renderTeams(); renderRegs();
  $('btn-prop').disabled = false;
  $('endwrap').classList.remove('pulse');
  setEndBtn('AVSLUTA<br>OMGÅNG', false);
}));

game.on('gameEnd', p => run(async () => {
  audio.play(p.won ? 'win' : 'lose');
  showSlut(p);
}));

game.on('proposalOpened', p => run(async () => {
  audio.play('vote');
  $('btn-prop').disabled = true;
  openVoteModal(p);
}));

game.on('proposalResolved', p => run(async () => {
  audio.play(p.passed ? 'proposal_pass' : 'proposal_fail');
  renderVoteState();
  $('vote-btns').style.display = 'none';
  $('vote-sub').innerHTML = p.passed
    ? `<b style="color:var(--led-green)">✅ Förslaget gick igenom (${p.yesCount} av 4 röstade ja)</b>`
    : `<b style="color:var(--led-red)">❌ Förslaget föll (${p.yesCount} av 4 röstade ja)</b>`;
  setTimeout(() => { $('ov-vote').classList.remove('open'); voteOpenFor = null; renderMe(); renderTeams(); renderRegs(); }, 1900);
}));

game.on('timer', ({ left }) => {
  const m = Math.floor(Math.max(0, left) / 60), s = Math.max(0, left) % 60;
  $('timertxt').textContent = `${m}:${String(s).padStart(2, '0')}`;
  $('timerring').style.strokeDashoffset = 414.7 * (1 - Math.max(0, left) / E().cfg.timerSec);
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
  });
  game.on('voteUpdate', () => renderVoteState());
  game.on('tradeIncoming', m => openTradeIncoming(m));
  game.on('notis', m => toast(m.text));
  game.on('disconnected', () => setConn(false));
  game.on('reconnected', r => { setConn(true); toast('✅ Återansluten'); if (r.started && r.state) rebuildFromState(r.state); });
}

// ═══════════════ Rendering ═══════════════
function updateOh({ value, mode, delta }) {
  const c = E().cfg;
  $('ohfill').style.width = `calc(${value}% - 6px)`;
  $('ohfill').style.background = value < c.redZone ? 'var(--oh-red)' : value > c.greenZone ? 'var(--oh-green)' : 'var(--oh-yellow)';
  $('ohneedle').style.left = `${value}%`;
  $('ohval').textContent = value;
  const d = $('ohdelta');
  d.textContent = delta === 0 ? '—' : (delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`);
  d.className = 'ohdelta' + (delta > 0 ? ' pos' : delta < 0 ? ' neg' : '');
  $('ohmode').textContent = MODE_LABEL[mode];
  map.setOhalsaMode(mode);
  audio.setAmbience(mode);
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

function renderTeams() {
  if (!E()?.getState()) return;
  const lb = E().leaderboards();
  const rich = lb.bors[0], bov = lb.klimat[0];
  $('teams').innerHTML = E().getState().teams.filter(t => t.id !== game.me).map(t => `
    <div class="team">
      <span style="display:inline-flex">${logoSVG(t.id, 44)}</span>
      <div class="nm">${t.namn}<small>gör ${t.sektor} ${CUR_ICON[t.sektor]}</small></div>
      <span class="tr">🪙${t.pengar} 🧱${t.material}</span>
      <span class="tag">${klarLag.has(t.id) ? '✅' : ''}${t.id === rich.id && rich.varde > 0 ? '👑' : ''}${t.id === bov.id && bov.skada < 0 ? '⚠️' : ''}</span>
      <button class="byt" data-partner="${t.id}">BYT</button>
    </div>`).join('');
  document.querySelectorAll('[data-partner]').forEach(b =>
    b.addEventListener('click', () => { audio.play('ui_tap'); openTrade(b.dataset.partner); }));
}

function renderRegs() {
  if (!E()?.getState()) return;
  const lb = E().leaderboards();
  $('reg-bors').innerHTML = lb.bors.map(r =>
    `<li class="${r.id === game.me ? 'me-row' : ''}">${r.namn} ${r.varde}</li>`).join('');
  $('reg-klimat').innerHTML = lb.klimat.map(r =>
    `<li class="${r.id === game.me ? 'me-row' : ''}">${r.namn} ${r.skada}</li>`).join('');
}

function renderHand() {
  if (!game.me) return;
  const hand = handFor(game.me);
  const banned = E().getState().banDirtyThisRound;
  $('cards').innerHTML = hand.map(c => {
    const kost = [c.kp ? `${c.kp} 🪙` : '', c.km ? `${c.km} 🧱` : ''].filter(Boolean).join(' + ');
    const ger = c.gp ? `+${c.gp} 🪙/runda` : `+${c.gm} 🧱/runda`;
    return `
    <div class="card ${c.tier} ${banned && c.tier === 'smutsig' ? 'banned' : ''}" data-tier="${c.tier}">
      <div class="band">${TIER_LABEL[c.tier]}</div>
      <div class="inner">
        <img src="${manifest.buildings[c.asset].file}" alt="">
        <div class="info">
          <div class="nm">${c.namn}</div>
          <div class="row"><span class="k">Kostar</span> ${kost}</div>
          <div class="row"><span class="k">Ger</span> ${ger}</div>
          <div class="row"><span class="k">Ön</span> <span class="${c.oh > 0 ? 'ohplus' : 'ohminus'}">${fmtOh(c.oh)}</span></div>
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
  handFor(game.me).forEach(c => {
    const el = document.querySelector(`#cards .card[data-tier="${c.tier}"]`);
    if (!el) return;
    const brist = [];
    if (t.pengar < c.kp) brist.push(`${c.kp - t.pengar} 🪙`);
    if (t.material < c.km) brist.push(`${c.km - t.material} 🧱`);
    el.classList.toggle('poor', brist.length > 0 && !picked);
    el.querySelector('.saknas').textContent = brist.length ? `saknar ${brist.join(' + ')} → BYT` : '';
  });
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
    ? `Du producerar <b>material 🧱</b>.<br>Pengar 🪙 måste du <b>byta till dig</b> från Tundra eller Stad.`
    : `Du producerar <b>pengar 🪙</b>.<br>Material 🧱 måste du <b>byta till dig</b> från Åkermark eller Skog.`;
  $('melogo').innerHTML = logoSVG(game.me, 64);
  $('mename').textContent = teamName(game.me);
}

function openTrade(partnerId = null) {
  const partners = E().getState().teams.filter(t => t.id !== game.me);
  tradePartner = partnerId || partners.find(t => t.sektor !== mySector)?.id || partners[0].id;
  giveAmt = 10; getAmt = 10;
  $('trade-give-lbl').textContent = `${giveCur} ${CUR_ICON[giveCur]}`;
  $('trade-get-lbl').textContent = `${getCur} ${CUR_ICON[getCur]}`;
  $('tb-give').textContent = `DU GER (${giveCur} ${CUR_ICON[giveCur]})`;
  $('tb-get').textContent = `DU FÅR (${getCur} ${CUR_ICON[getCur]})`;
  renderTradeModal();
  $('ov-trade').classList.add('open');
}
function renderTradeModal() {
  $('partners').innerHTML = E().getState().teams.filter(t => t.id !== game.me).map(t => `
    <button class="${t.id === tradePartner ? 'sel' : ''}" data-p="${t.id}">
      ${logoSVG(t.id, 46)}${t.namn}<small>🪙${t.pengar} 🧱${t.material}</small>
    </button>`).join('');
  document.querySelectorAll('#partners [data-p]').forEach(b =>
    b.addEventListener('click', () => { tradePartner = b.dataset.p; renderTradeModal(); }));
  $('give-amt').textContent = giveAmt;
  $('get-amt').textContent = getAmt;
}
$('btn-trade').addEventListener('click', () => { audio.play('ui_tap'); openTrade(); });
$('btn-trade-cancel').addEventListener('click', () => $('ov-trade').classList.remove('open'));
$('give-minus').addEventListener('click', () => { giveAmt = Math.max(1, giveAmt - 1); renderTradeModal(); });
$('give-plus').addEventListener('click', () => { giveAmt = Math.min(E().team(game.me)[giveCur], giveAmt + 1); renderTradeModal(); });
$('get-minus').addEventListener('click', () => { getAmt = Math.max(1, getAmt - 1); renderTradeModal(); });
$('get-plus').addEventListener('click', () => { getAmt = getAmt + 1; renderTradeModal(); });
$('btn-trade-go').addEventListener('click', async () => {
  $('btn-trade-go').disabled = true;
  const res = await game.trade(tradePartner, giveAmt, giveCur, getAmt, getCur);
  $('btn-trade-go').disabled = false;
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
function propDefs() {
  const c = E().cfg, bov = E().worstPolluter();
  return [
    { type: 'gron', pic: '🌱', rubrik: 'Grön satsning', tx: `Alla som röstar JA betalar ${c.gronCost} 🪙.<br>Öns hälsa går <b>upp +${c.gronGain}</b>.`, ja: `JA — jag betalar ${c.gronCost} 🪙` },
    { type: 'skatt', pic: '💸', rubrik: 'Miljöskatt', tx: `Värsta boven (<b>${bov.namn}</b>) betalar ${c.taxAmount} 🪙<br>som delas mellan de andra lagen.`, ja: 'JA — beskatta boven' },
    { type: 'forbud', pic: '🚫', rubrik: 'Förbjud smutsig', tx: `Nästa runda kan <b>ingen</b> bygga det smutsiga kortet.`, ja: 'JA — förbjud smutsig' },
  ];
}
$('btn-prop').addEventListener('click', () => {
  if (E().getState().proposal || resolving) return;
  audio.play('ui_tap');
  $('proplist').innerHTML = propDefs().map(p => `
    <div class="propcard propchoice" data-type="${p.type}">
      <div class="pic">${p.pic}</div>
      <div class="tx"><b style="color:var(--text)">${p.rubrik}</b><br>${p.tx}</div>
    </div>`).join('');
  document.querySelectorAll('.propchoice').forEach(el => el.addEventListener('click', () => {
    $('ov-choose').classList.remove('open');
    game.openProposal(el.dataset.type);
  }));
  $('ov-choose').classList.add('open');
});
$('btn-choose-cancel').addEventListener('click', () => $('ov-choose').classList.remove('open'));

function openVoteModal(p) {
  voteOpenFor = p;
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
$('btn-log').addEventListener('click', () => { audio.play('ui_tap'); renderRegister(); $('ov-register').classList.add('open'); });
$('btn-reg-close').addEventListener('click', () => $('ov-register').classList.remove('open'));
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
  $('ov-slut').classList.add('open');
}
$('btn-again').addEventListener('click', () => game.playAgain());

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
  $('lobbytag').textContent =
    phase === 'pagar' ? 'Spelet pågår — tryck på ett datorstyrt lag för att ta över det.'
    : phase === 'slut' ? 'Spelet är slut — gå med och starta ett nytt!'
    : game.me ? `Du har gått med som ${teamName(game.me)}. Tryck STARTA när alla är med!`
    : 'Gå med i spelet: tryck på laget du vill spela.';

  $('lobby').innerHTML = ['aker', 'skog', 'tundra', 'stad'].map(id => {
    const st = m.claims[id];
    const mine = game.me === id;
    const takbar = !mine && st !== 'human';
    const status = mine ? '✓ DU'
      : st === 'human' ? 'Spelare ansluten'
      : st === 'bot' ? (phase === 'pagar' ? 'Dator — tryck för att ta över' : 'Dator')
      : phase === 'pagar' ? '—' : 'Ledig — blir dator vid start';
    return `<button class="lobbyteam ${mine ? 'sel' : ''} ${!takbar && !mine ? 'taken' : ''}" data-lag="${id}" ${takbar ? '' : 'disabled'}>
      ${logoSVG(id, 54)}<b>${teamName(id)}</b>
      <small>${status}</small>
    </button>`;
  }).join('');
  document.querySelectorAll('.lobbyteam:not([disabled])').forEach(b =>
    b.addEventListener('click', () => { audio.unlock(); game.claim(b.dataset.lag); }));

  const btn = $('btn-start');
  if (phase === 'pagar') { btn.style.display = 'none'; }
  else {
    btn.style.display = '';
    btn.disabled = !game.me;
    btn.textContent = !game.me ? 'VÄLJ ETT LAG FÖRST'
      : phase === 'slut' ? 'STARTA NYTT SPEL — lag utan spelare styrs av datorn'
      : 'STARTA SPELET — lag utan spelare styrs av datorn';
  }
}
function setConn(ok) {
  const el = $('connstatus');
  el.style.display = '';
  el.className = ok ? 'ok' : 'bad';
  el.textContent = ok ? '● Ansluten till servern' : '● Ingen kontakt med servern — försöker återansluta…';
}

function rebuildFromState(S) {
  if (!S || !S.teams) return;
  $('roundnum').textContent = S.round;
  map.clearBuildings();
  for (const t of S.teams) t.slots.forEach((b, i) => map.placeBuilding(t.id, i, manifest.buildings[b.asset].file));
  updateOh({ value: S.oh, mode: ohMode(S.oh), delta: S.lastDelta });
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
  $('btn-start').disabled = true;
  $('btn-start').textContent = 'VÄLJ ETT LAG FÖRST';
  setConn(true);
  if (game._first.started && game._first.state) {
    audio.unlock();
    rebuildFromState(game._first.state);
  }
  if (game.me) initSector();
} else {
  initSector();
}

$('btn-start').addEventListener('click', () => {
  audio.unlock();
  audio.play('ui_tap');
  if (ONLINE) {
    if (gamePhase() === 'pagar') return;
    if (!game.me) { toast('Välj ett lag först!', true); return; }
    initSector();
    game.startGame();
  } else {
    $('ov-start').classList.remove('open');
    game.startGame();
  }
});
