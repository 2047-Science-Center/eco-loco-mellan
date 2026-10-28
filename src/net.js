// net.js — Eco Loco (Mellan): klientens nätverkslager mot server/server.js.
// Servern äger motorn; klienten håller en REPLIKA av tillståndet (varje server-
// meddelande bär hela state) och en lokal EcoLoco-instans används enbart som
// läsare (team/leaderboards/contribution är rena funktioner av state).
// Återanslutning: 'hello' igen → hello-ack med fullt state → vyn ritar om allt.

import { EcoLoco } from '../spec/engine.js';

export class ServerNet {
  constructor() {
    this._h = {};
    this.me = null;
    this.reader = null;          // EcoLoco-instans vars S skrivs över av serverns state
    this._reqId = 0;
    this._pending = new Map();   // reqId → resolve
    this.connected = false;
    this.phase = 'lobby';        // RUMS-FLÖDE: serverns senaste fas (bärs i varje meddelande)
    this.claims = {};            // lag → 'human'|'bot'|null (bärs i varje meddelande; spelledarpultens stations-lista)
  }
  on(ev, cb) { (this._h[ev] ||= []).push(cb); return this; }
  _emit(ev, p) { (this._h[ev] || []).forEach(cb => cb(p)); }
  _send(obj) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj)); }

  connect(wishLag = null) {
    return new Promise(resolve => {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
      this.ws = new WebSocket(url);
      this.ws.addEventListener('open', () => { this.connected = true; this._send({ type: 'hello', lag: wishLag }); });
      this.ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (typeof m.phase === 'string') this.phase = m.phase;   // RUMS-FLÖDE: fasen bärs i varje send()
        if (m.claims) this.claims = m.claims;                    // lag-status (human/bot/tom) bärs i varje send()
        // state följer med varje meddelande (null när ingen motor finns = lobby/omstart) → spegla rakt av.
        if (this.reader && 'state' in m) this.reader.S = m.state;
        else if (m.state && this.reader) this.reader.S = m.state;
        switch (m.type) {
          case 'hello-ack':
            this.me = m.lag;
            this.reader = new EcoLoco({});
            this.reader.cfg = m.config;
            this.reader.S = m.state;
            resolve({ lag: m.lag, started: m.started, state: m.state, phase: m.phase || 'lobby' });
            break;
          case 'claimAck': this.me = m.lag; this._emit('claimAck', m); break;
          case 'event': this._emit(m.event, m.payload); break;
          case 'actionResult': case 'tradeResult':
            this._pending.get(m.reqId)?.(m.res); this._pending.delete(m.reqId); break;
          default: this._emit(m.type, m); // lobby, timer, resolveStart, voteUpdate, klarUpdate, tradeIncoming
        }
      });
      this.ws.addEventListener('close', () => {
        this.connected = false;
        this._emit('disconnected', {});
        setTimeout(() => this.connect(this.me).then(r => this._emit('reconnected', r)), 1500);
      });
    });
  }

  _request(obj, timeoutMs = 8000) {
    return new Promise(res => {
      const reqId = ++this._reqId;
      this._pending.set(reqId, res);
      this._send({ ...obj, reqId });
      setTimeout(() => { if (this._pending.has(reqId)) { this._pending.delete(reqId); res({ ok: false, why: 'inget svar — motparten kanske funderar ännu' }); } }, timeoutMs);
    });
  }

  claim(lag) { this._send({ type: 'claim', lag }); }
  startGame(opts = {}) { this._send({ type: 'startGame', ...opts }); }   // opts.spelledare → med/utan spelledare
  // ——— RUMS-FLÖDE ———
  startWindow() { this._send({ type: 'startWindow' }); }                 // spelar-STARTA (självspel) → öppna 15 s join-fönster
  enterTutorial() { this._send({ type: 'phaseTutorial' }); }            // klient → server: nått solo-tutorialen
  tutReady() { this._send({ type: 'tutReady' }); }                      // Gate 3: den här skärmens tutorial är klar (servern väntar in alla)
  tutIdle() { this._send({ type: 'tutIdle' }); }                        // obemannad skärm i tutorialen (90 s utan beröring) → servern gör laget till bot
  tillLobby() { this._send({ type: 'gmcmd', cmd: 'tilllobby' }); }      // SPELLEDARE: omstart → alla till lobbyn
  skipIntro() { this._send({ type: 'gmcmd', cmd: 'skipintro' }); }      // SPELLEDARE: skippa introt/trailern
  pause() { this._send({ type: 'pause' }); }                             // paus: frys bara spelmotorn
  selectCard(tier) { return this._request({ type: 'selectCard', tier }); }
  trade(to, give, giveCur, get, getCur) { return this._request({ type: 'tradeOffer', to, give, giveCur, get, getCur }, 30000); }
  tradeAnswer(offerId, accept) { this._send({ type: 'tradeAnswer', offerId, accept }); }
  openProposal(ptype) { this._send({ type: 'openProposal', ptype }); }
  vote(yes) { this._send({ type: 'vote', yes }); }
  klar() { this._send({ type: 'klar' }); }
  awardsKlara() { this._send({ type: 'awardsKlara' }); }
  tutBeat(beat) { this._send({ type: 'tutBeat', beat }); }
  podiumAnswer(questionId, option) { this._send({ type: 'podiumAnswer', questionId, option }); }   // slutdelen
  rigCue(phase) { this._send({ type: 'rigCue', phase }); }   // startceremonin → rigg (hjärnan)
  // ——— Spelledarpanel ———
  gmcmd(cmd) { this._send({ type: 'gmcmd', ...cmd }); }                         // grupp A → handleGmCmd
  rigcmd(topic, payload) { this._send({ type: 'rigcmd', topic, payload }); }    // grupp B → riggSend (riggen)
  playTrailer() { this._send({ type: 'gmcmd', cmd: 'trailer' }); }              // STARTA → spela intro-trailern på alla skärmar
  skipTrailer() { this._send({ type: 'gmcmd', cmd: 'trailerSkip' }); }          // tap på trailern → hoppa över (alla skärmar)
}
