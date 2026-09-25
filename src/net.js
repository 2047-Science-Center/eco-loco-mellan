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
        if (m.state && this.reader) this.reader.S = m.state;
        switch (m.type) {
          case 'hello-ack':
            this.me = m.lag;
            this.reader = new EcoLoco({});
            this.reader.cfg = m.config;
            this.reader.S = m.state;
            resolve({ lag: m.lag, started: m.started, state: m.state });
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
  startGame() { this._send({ type: 'startGame' }); }
  selectCard(tier) { return this._request({ type: 'selectCard', tier }); }
  trade(to, give, giveCur, get, getCur) { return this._request({ type: 'tradeOffer', to, give, giveCur, get, getCur }, 30000); }
  tradeAnswer(offerId, accept) { this._send({ type: 'tradeAnswer', offerId, accept }); }
  openProposal(ptype) { this._send({ type: 'openProposal', ptype }); }
  vote(yes) { this._send({ type: 'vote', yes }); }
  klar() { this._send({ type: 'klar' }); }
}
