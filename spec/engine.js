// engine.js — Eco Loco (Mellan): ren spelmotor.
// KÄLLA TILL SANNING för reglerna. Ingen DOM, inget nätverk, ingen AI.
// Körs oförändrad i webbläsaren (fas 3) och server-side i Node (fas 4 multiplayer).
// Ändra INTE balans/regler utan avstämning. Tunbara siffror ligger i DEFAULT_CONFIG + assets.json.
//
// Actions (in):   start, selectCard, transfer, openProposal, vote, endRound, reset
// Events (ut):    start, roundStart, build, trade, proposalOpened, proposalResolved,
//                 income, ohalsa, award, event, roundEnd, gameEnd
//
// I multiplayer kommer actions från nätverksmeddelanden i stället för från UI/mock.

export const DEFAULT_CONFIG = {
  rounds: 8,
  timerSec: 90,
  startPengar: 40,
  startMaterial: 30,
  ohStart: 50,
  ohMax: 100,
  threshold: 60,     // öhälsa som måste nås vid slutet
  redZone: 30,       // under detta = kris (event kan slå)
  greenZone: 70,
  slotsPerArea: 10,
  eventLoss: 10,     // pengar + material som förloras vid katastrof
  gronCost: 10,      // "grön satsning": kostnad per ja-röst
  gronGain: 8,       // "grön satsning": öhälsa +
  taxAmount: 15,     // "miljöskatt": belopp värsta boven betalar
  humanTeam: 'aker', // vilket område människan styr i mock/fas 3
};

// Ett område = ett lag. Områdesfärg = lagfärg. sektor styr valuta-beroendet.
export const AREAS = [
  { id: 'aker',   namn: 'Åkermark', farg: '#E7C24C', sektor: 'material' },
  { id: 'skog',   namn: 'Skog',     farg: '#3F8F4A', sektor: 'material' },
  { id: 'tundra', namn: 'Tundra',   farg: '#D98A3C', sektor: 'pengar'   },
  { id: 'stad',   namn: 'Stad',     farg: '#8A8F96', sektor: 'pengar'   },
];

// Händer per område. Samma balans-siffror per sektor; bara namn/asset skiljer.
// kp/km = engångskostnad (pengar/material). gp/gm = passiv inkomst/runda. oh = engångseffekt på öhälsa.
const MATERIAL_HAND = [
  { tier: 'smutsig',  kp: 10, km: 0,  gp: 0, gm: 8, oh: -4 },
  { tier: 'standard', kp: 15, km: 5,  gp: 0, gm: 6, oh: -2 },
  { tier: 'gron',     kp: 25, km: 10, gp: 0, gm: 5, oh:  1 },
];
const PENGAR_HAND = [
  { tier: 'smutsig',  kp: 0,  km: 8,  gp: 10, gm: 0, oh: -2 },
  { tier: 'standard', kp: 6,  km: 6,  gp: 7,  gm: 0, oh:  1 },
  { tier: 'gron',     kp: 10, km: 8,  gp: 6,  gm: 0, oh:  3 },
];
const NAMES = {
  aker:   { smutsig: 'Industrijordbruk', standard: 'Jordbruk',        gron: 'Ekologiskt jordbruk' },
  skog:   { smutsig: 'Sågverk',          standard: 'Skogsbruk',       gron: 'Skogsjordbruk' },
  tundra: { smutsig: 'Oljeplattform',    standard: 'Fabrik',          gron: 'Vindkraft' },
  stad:   { smutsig: 'Kolkraftverk',     standard: 'Kontor & hotell', gron: 'Solceller' },
};

export function handFor(areaId) {
  const area = AREAS.find(a => a.id === areaId);
  const base = area.sektor === 'material' ? MATERIAL_HAND : PENGAR_HAND;
  return base.map(c => ({ ...c, namn: NAMES[areaId][c.tier], asset: `${areaId}_${c.tier}` }));
}

export function ohMode(oh) {
  if (oh <= 20) return 'superdaligt';
  if (oh <= 40) return 'daligt';
  if (oh <= 60) return 'neutralt';
  if (oh <= 80) return 'bra';
  return 'mycketbra';
}

export class EcoLoco {
  constructor(config = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this._h = {};
    this.S = null;
  }
  on(ev, cb) { (this._h[ev] ||= []).push(cb); return this; }
  _emit(ev, payload) { (this._h[ev] || []).forEach(cb => cb(payload)); }
  getState() { return this.S; }

  start() {
    const c = this.cfg;
    this.S = {
      round: 1, oh: c.ohStart, lastDelta: 0, over: false,
      banDirtyThisRound: false, banDirtyNextRound: false,
      proposal: null, gronQueued: 0,
      teams: AREAS.map(a => ({
        id: a.id, namn: a.namn, farg: a.farg, sektor: a.sektor,
        pengar: c.startPengar, material: c.startMaterial,
        incP: 0, incM: 0, built: 0, impactPos: 0, impactNeg: 0, totalImpact: 0,
        choice: null, log: [], slots: [], // slots: index-ordning för placerade byggnader
        _roundStartWealth: 0, _roundOh: 0, _roundGain: 0,
      })),
    };
    this._snapshot();
    this._emit('start', { config: c, areas: AREAS });
    this._emit('roundStart', { round: 1 });
    this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: 0 });
    return this.S;
  }
  reset() { return this.start(); }

  team(id) { return this.S.teams.find(t => t.id === id); }
  _snapshot() { this.S.teams.forEach(t => t._roundStartWealth = t.pengar + t.material); }
  _canAfford(t, card) { return t.pengar >= card.kp && t.material >= card.km; }

  // ACTION: välj kort. Emitterar 'build' (rita på slot + kontoanimation + bygg-ljud).
  selectCard(teamId, tier) {
    const t = this.team(teamId);
    const card = handFor(teamId).find(c => c.tier === tier);
    if (!card) return { ok: false, reason: 'okänt kort' };
    if (this.S.banDirtyThisRound && tier === 'smutsig') return { ok: false, reason: 'smutsig förbjuden denna runda' };
    if (!this._canAfford(t, card)) {
      return { ok: false, reason: 'har inte råd', need: { pengar: Math.max(0, card.kp - t.pengar), material: Math.max(0, card.km - t.material) } };
    }
    t.pengar -= card.kp; t.material -= card.km;
    t.choice = card.tier;
    // Byggnaden placeras på nästa lediga slot (slots fylls i byggd-ordning; commit sker vid bokslut).
    const slotIndex = t.slots.length;
    this._emit('build', { teamId, area: teamId, card, slotIndex, cost: { pengar: card.kp, material: card.km } });
    return { ok: true, card };
  }

  // ACTION: byt valutor mellan två lag (atomiskt). I mock avgör mock-opponents om en bot accepterar.
  transfer(fromId, toId, give, giveCur, get, getCur) {
    const a = this.team(fromId), b = this.team(toId);
    if (giveCur === getCur) return { ok: false, reason: 'samma valuta' };
    if (a[giveCur] < give) return { ok: false, reason: 'givaren saknar täckning' };
    if (b[getCur] < get) return { ok: false, reason: 'mottagaren saknar täckning' };
    a[giveCur] -= give; a[getCur] += get; b[getCur] -= get; b[giveCur] += give;
    this._emit('trade', { from: fromId, to: toId, give, giveCur, get, getCur });
    return { ok: true };
  }

  // ACTION: politik. Ett förslag/runda. type: 'gron' | 'skatt' | 'forbud'
  openProposal(type, byTeamId) {
    this.S.proposal = { type, by: byTeamId, votes: {}, resolved: false, passed: false };
    this._emit('proposalOpened', { type, by: byTeamId });
  }
  vote(teamId, yes) {
    const p = this.S.proposal;
    if (!p || p.resolved) return;
    p.votes[teamId] = !!yes;
    if (Object.keys(p.votes).length >= this.S.teams.length) this._resolveProposal();
  }
  _resolveProposal() {
    const p = this.S.proposal;
    const yesCount = Object.values(p.votes).filter(Boolean).length;
    p.resolved = true; p.passed = yesCount >= 3;
    if (p.passed) {
      if (p.type === 'gron') {
        this.S.teams.forEach(t => { if (p.votes[t.id]) t.pengar = Math.max(0, t.pengar - this.cfg.gronCost); });
        this.S.gronQueued += this.cfg.gronGain;
      } else if (p.type === 'skatt') {
        const w = this.worstPolluter();
        const pay = Math.min(this.cfg.taxAmount, w.pengar); w.pengar -= pay;
        const others = this.S.teams.filter(t => t.id !== w.id);
        const share = Math.floor(pay / others.length);
        others.forEach(t => t.pengar += share);
      } else if (p.type === 'forbud') {
        this.S.banDirtyNextRound = true;
      }
    }
    this._emit('proposalResolved', { type: p.type, votes: { ...p.votes }, passed: p.passed, yesCount });
  }

  worstPolluter() { return [...this.S.teams].sort((a, b) => a.impactNeg - b.impactNeg)[0]; }
  richest() { return [...this.S.teams].sort((a, b) => (b.pengar + b.material) - (a.pengar + a.material))[0]; }
  leaderboards() {
    return {
      bors: [...this.S.teams].sort((a, b) => (b.pengar + b.material) - (a.pengar + a.material))
        .map(t => ({ id: t.id, namn: t.namn, farg: t.farg, varde: t.pengar + t.material })),
      klimat: [...this.S.teams].sort((a, b) => a.impactNeg - b.impactNeg)
        .map(t => ({ id: t.id, namn: t.namn, farg: t.farg, skada: t.impactNeg })),
    };
  }
  contribution(teamId) {
    const t = this.team(teamId);
    return { impactPos: t.impactPos, impactNeg: t.impactNeg, netto: t.impactPos + t.impactNeg,
             kapital: t.pengar + t.material, log: t.log };
  }

  // ACTION: bokslut. Anropas när alla lag som ska agera har valt kort (i mock: efter mock-opponents).
  endRound() {
    if (this.S.over) return;
    const c = this.cfg;
    let delta = 0;
    this.S.teams.forEach(t => {
      let oh = 0, namn = '—';
      if (t.choice) {
        const card = handFor(t.id).find(x => x.tier === t.choice);
        oh = card.oh; namn = card.namn;
        delta += card.oh; t.totalImpact += card.oh; t.built++;
        t.slots.push({ tier: card.tier, asset: card.asset });
        if (card.oh > 0) t.impactPos += card.oh; else if (card.oh < 0) t.impactNeg += card.oh;
        t.incP += card.gp; t.incM += card.gm;
      }
      t._roundOh = oh;
      t.log.unshift({ round: this.S.round, namn, oh });
    });
    if (this.S.gronQueued) delta += this.S.gronQueued;

    // inkomst
    this.S.teams.forEach(t => {
      t.pengar += t.incP; t.material += t.incM;
      if (t.incP || t.incM) this._emit('income', { teamId: t.id, pengar: t.incP, material: t.incM });
    });

    // öhälsa
    const before = this.S.oh;
    this.S.oh = Math.max(0, Math.min(c.ohMax, this.S.oh + delta));
    this.S.lastDelta = this.S.oh - before;
    this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: this.S.lastDelta });

    // event vid kris
    let ev = null;
    if (this.S.oh > 0 && this.S.oh < c.redZone) {
      const namn = ['Storm', 'Skogsbrand', 'Uppror', 'Torka'][Math.floor(Math.random() * 4)];
      this.S.teams.forEach(t => { t.pengar = Math.max(0, t.pengar - c.eventLoss); t.material = Math.max(0, t.material - c.eventLoss); });
      ev = { namn, loss: c.eventLoss };
      this._emit('event', ev);
    }

    // rundans kapitalökning (för award "ledande")
    this.S.teams.forEach(t => t._roundGain = (t.pengar + t.material) - t._roundStartWealth);
    this._emit('award', { round: this.S.round, ...this._computeAwards() });

    // nollställ rund-scope
    this.S.gronQueued = 0; this.S.proposal = null;
    this.S.banDirtyThisRound = this.S.banDirtyNextRound; this.S.banDirtyNextRound = false;
    this.S.teams.forEach(t => { t.choice = null; t._roundOh = 0; });

    this._emit('roundEnd', { round: this.S.round });

    // slut / krasch / nästa runda
    if (this.S.oh <= 0) return this._end(false, 'Ön kollapsade totalt.');
    if (this.S.round >= c.rounds) {
      return this.S.oh >= c.threshold ? this._end(true) : this._end(false, `Ön nådde bara ${this.S.oh} — under tröskeln ${c.threshold}.`);
    }
    this.S.round++;
    this._snapshot();
    this._emit('roundStart', { round: this.S.round });
  }

  _computeAwards() {
    const teams = this.S.teams;
    const led = [...teams].sort((a, b) => b._roundGain - a._roundGain)[0];
    const eld = teams.filter(t => t._roundOh > 0).sort((a, b) => b._roundOh - a._roundOh)[0];
    const sab = teams.filter(t => t._roundOh < 0).sort((a, b) => a._roundOh - b._roundOh)[0];
    const wrap = (t, v) => t ? { teamId: t.id, namn: t.namn, farg: t.farg, varde: v } : null;
    return {
      led: led && led._roundGain > 0 ? wrap(led, led._roundGain) : null,
      eld: eld ? wrap(eld, eld._roundOh) : null,
      sab: sab ? wrap(sab, sab._roundOh) : null,
    };
  }
  _end(won, reason) {
    this.S.over = true;
    const w = this.richest(), bov = this.worstPolluter();
    this._emit('gameEnd', {
      won, reason: reason || null,
      winner: { teamId: w.id, namn: w.namn, kapital: w.pengar + w.material },
      klimatbov: bov.impactNeg < 0 ? { teamId: bov.id, namn: bov.namn, skada: bov.impactNeg } : null,
      oh: this.S.oh, threshold: this.cfg.threshold,
    });
  }
}
