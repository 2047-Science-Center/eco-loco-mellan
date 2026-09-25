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
import { EcoLoco, AREAS } from '../spec/engine.js';
import { mockOpponentsAct, mockOpponentsVote } from '../spec/mock-opponents.js';
import { attachMqtt } from '../src/mqtt.js';

const PORT = parseInt(process.env.PORT) || 8765;
const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'spec', 'assets.json')));

// ——— Statiska filer (så iPad/NUC bara behöver en URL) ———
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.css': 'text/css' };
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
let engine = null;
let started = false;
const claims = { aker: null, skog: null, tundra: null, stad: null };  // teamId → ws | 'bot' | null
let klar = new Set();          // mänskliga lag som tryckt AVSLUTA
let timerLeft = 0, timerInt = null;
let resolvingNow = false;
let offerSeq = 0;
const offers = new Map();      // offerId → { from, to, give, giveCur, get, getCur }

const humanIds = () => TEAMS.filter(id => claims[id] && claims[id] !== 'bot');
const liveHumanIds = () => humanIds().filter(id => claims[id].readyState === 1);

function send(ws, obj) { if (ws && ws !== 'bot' && ws.readyState === 1) ws.send(JSON.stringify({ ...obj, state: engine?.getState() ?? null })); }
function broadcast(obj) { for (const ws of wss.clients) send(ws, obj); }
function lobbyMsg() {
  return { type: 'lobby', started, claims: Object.fromEntries(TEAMS.map(id => [id, claims[id] === 'bot' ? 'bot' : claims[id] ? 'human' : null])) };
}

function newEngine() {
  engine = new EcoLoco(manifest.config || {});
  attachMqtt(engine);  // MQTT-sömmen: console-mock tills broker kopplas (byt publish i src/mqtt.js)
  const relay = ev => payload => broadcast({ type: 'event', event: ev, payload });
  for (const ev of ['start', 'build', 'trade', 'proposalOpened', 'proposalResolved', 'income', 'ohalsa', 'award', 'event', 'roundEnd', 'gameEnd'])
    engine.on(ev, relay(ev));
  engine.on('roundStart', p => {
    resolvingNow = false; klar = new Set();
    broadcast({ type: 'event', event: 'roundStart', payload: p });
    startTimer();
    maybeBotProposal(p.round);
  });
  engine.on('gameEnd', () => stopTimer());
  engine.on('proposalOpened', () => { checkBotVotes(); });
}

function startTimer() {
  stopTimer();
  timerLeft = engine.cfg.timerSec;
  broadcast({ type: 'timer', left: timerLeft });
  timerInt = setInterval(() => {
    timerLeft--;
    broadcast({ type: 'timer', left: timerLeft });
    if (timerLeft <= 0) { stopTimer(); forceResolve(); }
  }, 1000);
}
function stopTimer() { clearInterval(timerInt); timerInt = null; }

// Röstlogik: botar röstar när alla (levande) människor röstat; döda/mänskliga eftersläntrare tvingas vid timeout.
function checkBotVotes() {
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
  if (resolvingNow || !started || engine.getState().over) return;
  resolvingNow = true;
  forceOpenVotes();
  broadcast({ type: 'resolveStart' });
  mockOpponentsAct(engine, humanIds());
  engine.endRound();
}
function maybeResolve() {
  if (resolvingNow) return;
  const p = engine.getState().proposal;
  if (p && !p.resolved) return;                            // röstning pågår
  if (liveHumanIds().every(id => klar.has(id))) { stopTimer(); forceResolve(); }
}

function maybeBotProposal(round) {
  if (round < 2 || Math.random() > 0.35) return;
  setTimeout(() => {
    const S = engine.getState();
    if (S.over || S.proposal || resolvingNow) return;
    const bots = TEAMS.filter(id => claims[id] === 'bot');
    if (!bots.length) return;
    const by = bots[Math.floor(Math.random() * bots.length)];
    const type = S.oh < 45 ? (Math.random() < 0.6 ? 'gron' : 'forbud')
               : Math.random() < 0.5 ? 'skatt' : (Math.random() < 0.5 ? 'gron' : 'forbud');
    engine.openProposal(type, by);
  }, 2500);
}

// Bot-svar på byteserbjudande (samma logik som mock-läget i ui.js)
function botAccepts(bot, get, getCur, give) {
  if (bot[getCur] < get + 6) return { ok: false, why: `${bot.namn} har inte ${get} att avvara` };
  if (give < get * 0.8) return { ok: false, why: `${bot.namn} tyckte bytet var för snålt` };
  return { ok: true };
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

wss.on('connection', ws => {
  ws._alive = true;
  ws.on('pong', () => { ws._alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const lag = ws._lag;
    switch (m.type) {

      case 'hello': {
        if (m.lag && TEAMS.includes(m.lag) && (!claims[m.lag] || claims[m.lag] === 'bot' || claims[m.lag].readyState !== 1)) {
          const varBot = claims[m.lag] === 'bot';
          claims[m.lag] = ws; ws._lag = m.lag;
          if (varBot && started && !engine.getState().over) broadcast({ type: 'notis', text: `🧑 En spelare tog över ${NAMN[m.lag]}` });
        }
        send(ws, { type: 'hello-ack', lag: ws._lag ?? null, started, config: engine?.cfg ?? new EcoLoco(manifest.config || {}).cfg });
        broadcast(lobbyMsg());
        break;
      }
      case 'claim': {
        // Ledig plats, bot, eller död anslutning får tas över — även mitt i pågående spel.
        const free = TEAMS.includes(m.lag) && (!claims[m.lag] || claims[m.lag] === 'bot' || claims[m.lag].readyState !== 1);
        if (free) {
          if (lag && claims[lag] === ws) claims[lag] = started ? 'bot' : null;
          claims[m.lag] = ws; ws._lag = m.lag;
          if (started && !engine.getState().over) broadcast({ type: 'notis', text: `🧑 En spelare tog över ${NAMN[m.lag]}` });
        }
        send(ws, { type: 'claimAck', lag: ws._lag ?? null });
        broadcast(lobbyMsg());
        break;
      }
      case 'startGame': {
        if (started && !engine.getState().over) break;
        for (const id of TEAMS) if (!claims[id] || claims[id] === 'bot' || claims[id].readyState !== 1) claims[id] = claims[id] && claims[id] !== 'bot' && claims[id].readyState === 1 ? claims[id] : 'bot';
        started = true;
        newEngine();
        broadcast(lobbyMsg());
        engine.start();
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
      case 'openProposal': {
        if (!lag || engine.getState().proposal || resolvingNow) break;
        engine.openProposal(m.ptype, lag);
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
    }
  });
  ws.on('close', () => {
    const lag = ws._lag;
    if (lag && claims[lag] === ws) {
      claims[lag] = started ? 'bot' : null;   // mitt i spel → boten tar över; i lobby → platsen släpps
      if (started && !engine.getState().over) broadcast({ type: 'notis', text: `🤖 ${NAMN[lag]} tappade kontakten — styrs nu av datorn` });
      broadcast(lobbyMsg());
      if (started) { klar.delete(lag); checkBotVotes(); maybeResolve(); }
    }
  });
});

httpServer.listen(PORT, async () => {
  const os = await import('node:os');
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`Eco Loco-server igång på port ${PORT}. Öppna på varje enhet:`);
  for (const ip of ips.length ? ips : ['localhost']) console.log(`  http://${ip}:${PORT}/spel.html?online=1`);
});
