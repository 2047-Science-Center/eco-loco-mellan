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
  timerSecEarly: 120, // rundtid för de första rundorna (inlärning)
  earlyRounds: 3,     // så många rundor körs med timerSecEarly
  startPengar: 35,   // OMBALANSERING: symmetrisk start (var 40) — se design/REBALANSERING-FORSLAG.md §7 för nuläge
  startMaterial: 35, // OMBALANSERING: symmetrisk start (var 30); summan 70 oförändrad
  ohStart: 50,
  ohMax: 100,
  threshold: 60,     // öhälsa som måste nås vid slutet
  redZone: 35,       // OMBALANSERING: kris-zon biter tidigare (var 30); röd-zons-spiralen slår under detta
  redZonePenalty: 3, // OMBALANSERING (ny): extra öhälso-fall/runda i röd zon (mjuk spiral, räddningsbar)
  greenZone: 70,
  slotsPerArea: 10,
  eventLoss: 4,      // OMBALANSERING: allmänningens nota i röd zon (var 10, oanvänd) — lågt pga resurs-svält-risk
  gronCost: 8,       // OMBALANSERING: billigare grön satsning (var 10)
  gronGain: 14,      // OMBALANSERING: kollektiv satsning kan VÄNDA en kris (var 8)
  taxAmount: 20,     // OMBALANSERING: vassare maktmedel mot boven (var 15)

  // ─── KRIS / FÖRLUST-MEKANIK (design/VINST-FORLUST-FORSLAG.md, Alternativ B) ───────────────────
  // "Blandaren = kris-linjen": en deterministisk, hänvisningsbar kris-gräns som biter MITT i spelet
  // (dagens enda mitt-i-död = öh ≤ 0 nås i praktiken aldrig av en reagerande grupp). Vinstvillkoret
  // (öh ≥ threshold på sista rundan → rikaste vinner) och 0-golvet (backstop) är ORÖRDA.
  krisZon: 20,        // öh ≤ 20 vid bokslut (utan aktiv kris) → KRIS startar. = ohMode 'superdaligt' + hjärnans kris.wav-gräns.
  krisReset: 35,      // öh ≥ 35 vid bokslut (med aktiv kris) → krisen LÖST. 15 p hysteres (= redZone) hindrar flimmer.
  krisReplay: true,   // olöst kris vid deadline → rollback + spela OM rundan (false = krisen fortsätter utan omspel).
  krisMaxReplay: 2,   // tak på antal omspel av samma kris-runda. deadline = 1 runda (implicit av grind-strukturen).
  // OBS game-over-gränsen: efter krisMaxReplay omspel FORTSÄTTER spelet ändå (ingen hård game-over som default —
  // spelledaren/gmMode räddar i rummet). Platsen där en hård game-over SKULLE sitta är flaggad i _krisGrind().

  humanTeam: 'aker', // vilket område människan styr i mock/fas 3

  // ─── DYNAMISK FÖRSLAGSPOOL (design/FORSLAGSPOOL-FORSLAG.md) ───────────────────
  // Grund-3 (gron/skatt/forbud) ligger ALLTID kvar. Från extraProposalsFromRound
  // visas dessutom extraProposalsPerRound slumpade extra-förslag/runda (roterar).
  // Motorn väljer dem server-auktoritativt → S.extraProposals (se _rollExtraProposals).
  extraProposalsFromRound: 4,  // först fr.o.m. denna runda dyker extra-förslag upp (runda 1–3 = bara grund-3)
  extraProposalsPerRound: 2,   // exakt så många extra-förslag/runda (utöver grund-3)

  // Belopp för de NYA extra-förslagen. Konservativt satta — Klara/Josef får tuna.
  // (Grund-3-siffrorna ovan rörs INTE; nya förslag återanvänder dem där det går.)
  krispaketGain: 28,        // 🆘 Krispaket: öhälso-lyft (≈2×gronGain) vid lyckad kris-satsning; ja-röstare betalar gronCost var
  sektorskattAmount: 12,    // 🏝 Sektorskatt: 🪙 som VARJE pengar-lag betalar; potten delas lika till materiallagen
  solidaritetPengar: 15,    // 👑 Solidaritetsskatt: 🪙 som rikaste laget betalar (delas på de tre andra)
  solidaritetMaterial: 10,  // 👑 Solidaritetsskatt: 🧱 som rikaste laget betalar (delas på de tre andra)
  lojalitetBonus: 6,        // 🤝 Grön utdelning: 🪙 bonus till VARJE ja-röstare
  lojalitetBoter: 8,        // 🤝 Grön utdelning: 🪙 böter som VARJE nej-röstare betalar
  lojalitetOh: 4,           // 🤝 Grön utdelning: litet öhälso-lyft vid lyckat förslag
  marknadsavtalBonus: 8,    // 📈 Marknadsavtal: 🪙 till ALLA fyra lag — men bara om EXAKT 3 röstade ja
  marknadsavtalOh: 2,       // 📈 Marknadsavtal: litet öhälso-lyft vid exakt 3 ja
  // (💊 Riktat grönt stöd återanvänder gronCost som ja-röstarnas insats → ingen egen ratt.)
};

// Extra-förslagens typ-id (ur design/FORSLAGSPOOL-FORSLAG.md §3, ENBART [BYGG]-märkta —
// återanvänder primitiverna P1–P6, kräver INGEN ny motor-mekanik). [NY MEK]-förslagen
// (blockad/utslappstak/katastroffond) är medvetet UTELÄMNADE (kräver nytt state).
export const EXTRA_PROPOSAL_POOL = ['krispaket', 'sektorskatt', 'solidaritet', 'lojalitet', 'marknadsavtal', 'gronstod'];

// Ett område = ett lag. Områdesfärg = lagfärg. sektor styr valuta-beroendet.
// id = internt områdesnamn (används i MQTT/rigg — ändra ALDRIG). namn = lagets visningsnamn (djuret).
export const AREAS = [
  { id: 'aker',   namn: 'Oxen',    farg: '#E7C24C', sektor: 'material' },
  { id: 'skog',   namn: 'Björnen', farg: '#3F8F4A', sektor: 'material' },
  { id: 'tundra', namn: 'Räven',   farg: '#D98A3C', sektor: 'pengar'   },
  { id: 'stad',   namn: 'Örnen',   farg: '#8A8F96', sektor: 'pengar'   },
];

// ═══════════════ Händelser (events) ═══════════════
// Hårdkodad men lätt-redigerbar struktur: Josef & Klara ändrar siffror/text direkt här.
// chansPerRunda = sannolikhet att en händelse dras varje runda (endast i selfplay/auto-läge;
//   i GM-läge dras förslaget varje runda och spelledaren avgör ja/nej).
// utanAterlaggning = en dragen händelse återkommer inte (flyttas till drawnEvents).
// typ:'auto' → slår automatiskt. typ:'rost' → individuell frestelse (varje lag röstar själv).
// traffar: 'alla' | 'rikaste' | 'greenaste' | 'sektorPengar' | 'sektorMaterial' | 'omrade:<id>'
// pengar/material = förändring per träffat lag. egenValuta = förändring i lagets egen sektorvaluta.
// oh = öhälsoförändring (auto: alltid; rost: hela ön, om minst ett ja). ljud = central-rigg-ljud.
export const EVENT_CONFIG = { chansPerRunda: 0.6, utanAterlaggning: true };   // OMBALANSERING: mer yttre press (var 0.5; endast auto/selfplay, GM-läge opåverkat)
export const EVENTS = [
  { id:'storm', typ:'auto', traffar:'sektorPengar', pengar:-12, material:0, oh:-5, rubrik:'Höststormen är här', text:'Centralmyndigheten meddelar: kusten tar emot. De som byggt mot havet får bära vädrets kostnad — resten av ön önskar er lycka till.', ljud:'assets/audio/rigg/event_storm.mp3' },
  { id:'skogsbrand', typ:'auto', traffar:'omrade:skog', pengar:0, material:-15, oh:-8, rubrik:'Det brinner i Björnens skogar', text:'Elden frågade inte om lov. Björnens lager går upp i rök, och röken lägger sig över hela ön. Tack för er förståelse.', ljud:'assets/audio/rigg/event_skogsbrand.mp3' },
  { id:'uppror', typ:'auto', traffar:'rikaste', pengar:-15, material:-10, oh:-3, rubrik:'Folket har fått nog', text:'Missnöjet har hittat en adress: öns rikaste. Centralmakten ser på med milt ogillande medan era lager plundras.', ljud:'assets/audio/rigg/event_uppror.mp3' },
  { id:'torka', typ:'auto', traffar:'sektorMaterial', pengar:0, material:-12, oh:-4, rubrik:'Torkan slår till', text:'Ingen regndans hjälpte. Åker och skog ger mindre i år — ön noterar att råvaror plötsligt blivit en bristvara.', ljud:'assets/audio/rigg/event_torka.mp3' },
  { id:'godskord', typ:'auto', traffar:'alla', egenValuta:8, oh:2, rubrik:'Ett ovanligt gott år', text:'Vädret var med oss, för en gångs skull. Alla fyra lag får fylla på sina lager — njut, det varar inte.', ljud:'assets/audio/rigg/event_godskord.mp3' },
  { id:'sponsrat', typ:'rost', pengarTillJa:15, oh:-6, rostFraga:'Ska ön anta koncernens erbjudande?', rubrik:'Ett erbjudande ni knappast kan tacka nej till', text:'En vänligt sinnad koncern vill investera i ön — mot att vi blundar för lite smuts. Rösta nu: tar ni pengarna?', ljud:'assets/audio/rigg/event_sponsrat.mp3' },
  { id:'gronafonden', typ:'auto', traffar:'greenaste', pengar:12, material:0, oh:3, rubrik:'Gröna fonden delar ut', text:'Den som skött ön bäst belönas av omvärlden. Centralmakten gratulerar — övriga lag uppmanas vänligen att ta efter.', ljud:'assets/audio/rigg/event_gronafonden.mp3' },
  { id:'marknadskrasch', typ:'auto', traffar:'sektorPengar', pengar:-15, material:0, oh:0, rubrik:'Marknaden kollapsar', text:'Pengar är bara papper i dag. Pengar-lagens förmögenheter smälter bort medan råvaror plötsligt är allt som räknas.', ljud:'assets/audio/rigg/event_marknadskrasch.mp3' },
];

// Rundtid: de första earlyRounds rundorna är längre (inlärning), resten timerSec.
export const timerSecFor = (cfg, round) =>
  round <= (cfg.earlyRounds ?? 0) ? (cfg.timerSecEarly ?? cfg.timerSec) : cfg.timerSec;

// Händer per område. Samma balans-siffror per sektor; bara namn/asset skiljer.
// kp/km = engångskostnad (pengar/material). gp/gm = passiv inkomst/runda. oh = engångseffekt på öhälsa.
// OMBALANSERING: speglade, symmetriska händer (var osymmetriska → pengar-sektorn dominerade ~100%).
// Smutsigt billigast + högst avkastning + värst för ön; grönt dyrast + lägst avk. + enda som bygger upp.
// Standard inte längre gratis/läkande (oh −3). Spännvidd −6…+3. Se §3.1 + §7 (nuläge) i förslaget.
const MATERIAL_HAND = [            // own = material (gm), opp = pengar (kp)
  { tier: 'smutsig',  kp: 8,  km: 0,  gp: 0, gm: 9, oh: -6 },
  { tier: 'standard', kp: 8,  km: 6,  gp: 0, gm: 7, oh: -3 },
  { tier: 'gron',     kp: 14, km: 10, gp: 0, gm: 5, oh:  3 },
];
const PENGAR_HAND = [              // own = pengar (gp), opp = material (km) — exakt spegel av MATERIAL_HAND
  { tier: 'smutsig',  kp: 0,  km: 8,  gp: 9, gm: 0, oh: -6 },
  { tier: 'standard', kp: 6,  km: 8,  gp: 7, gm: 0, oh: -3 },
  { tier: 'gron',     kp: 10, km: 14, gp: 5, gm: 0, oh:  3 },
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
    this.gm = false;   // GM-läge: AV = händelser dras/applicera automatiskt (chansPerRunda);
                       // PÅ = förslag dras men väntar på spelledarens ja/nej (sätts av server.js).
  }
  setGm(on) { this.gm = !!on; }
  on(ev, cb) { (this._h[ev] ||= []).push(cb); return this; }
  _emit(ev, payload) { (this._h[ev] || []).forEach(cb => cb(payload)); }
  getState() { return this.S; }

  start() {
    const c = this.cfg;
    this.S = {
      round: 1, oh: c.ohStart, lastDelta: 0, over: false,
      banDirtyThisRound: false, banDirtyNextRound: false,
      inCrisis: false, krisReplaysLeft: c.krisMaxReplay,   // kris-mekanik: följer med i getState() → klient + spelledarpult
      proposal: null, gronQueued: 0, extraProposals: [],
      eventPool: EVENTS.map(e => e.id), drawnEvents: [], pendingEvent: null,
      teams: AREAS.map(a => ({
        id: a.id, namn: a.namn, farg: a.farg, sektor: a.sektor,
        pengar: c.startPengar, material: c.startMaterial,
        incP: 0, incM: 0, built: 0, impactPos: 0, impactNeg: 0, totalImpact: 0,
        choice: null, log: [], slots: [], // slots: index-ordning för placerade byggnader
        _roundStartWealth: 0, _roundOh: 0, _roundGain: 0,
      })),
    };
    this._snapshot();
    this._rollExtraProposals();                      // runda 1 → [] (extra-förslag öppnar först runda ≥4)
    this._emit('start', { config: c, areas: AREAS });
    this._emit('roundStart', { round: 1 });
    this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: 0 });
    this._captureRound();                            // full state-snapshot = det läge spelarna agerar från (för replayRound)
    return this.S;
  }
  reset() { return this.start(); }

  team(id) { return this.S.teams.find(t => t.id === id); }
  _snapshot() { this.S.teams.forEach(t => t._roundStartWealth = t.pengar + t.material); }
  // Full state-snapshot vid rundstart. Lagras på instansen (INTE i this.S) → structuredClone(this.S)
  // refererar aldrig sig själv. S är ren data (tal/strängar/arrayer/objekt) → strukturklon är exakt.
  _captureRound() { this._roundSnapshot = structuredClone(this.S); }
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

  // Rulla rundans extra-förslag. Server-auktoritativt → S.extraProposals, som alla vyer läser
  // (samma 2 extra på alla skärmar + spelledarpulten). Runda < gate → []; annars N unika ur poolen.
  _rollExtraProposals() {
    const fromRound = this.cfg.extraProposalsFromRound ?? 4;
    const count = this.cfg.extraProposalsPerRound ?? 2;
    if (!this.S || this.S.round < fromRound) { if (this.S) this.S.extraProposals = []; return; }
    const pool = [...EXTRA_PROPOSAL_POOL];
    const pick = [];
    for (let i = 0; i < count && pool.length; i++) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.S.extraProposals = pick;
  }
  // Vilka förslagstyper får öppnas just nu: grund-3 alltid, extra-förslag bara om de ligger i
  // rundans S.extraProposals (hindrar desync — en stale klient kan inte öppna ett icke-aktuellt extra).
  _proposalAllowed(type) {
    if (type === 'gron' || type === 'skatt' || type === 'forbud') return true;
    return (this.S?.extraProposals || []).includes(type);
  }

  // ACTION: politik. Ett förslag/runda. type: grund-3 ('gron'|'skatt'|'forbud') + rundans extra (S.extraProposals).
  openProposal(type, byTeamId) {
    if (!this._proposalAllowed(type)) return;        // icke-aktuellt extra-förslag → ignoreras (server-auktoritativt)
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
    p.resolved = true;
    // Händelse-omröstning (typ:'rost', t.ex. sponsrat): INDIVIDUELL frestelse — varje ja-lag
    // får belöningen, och hela ön tar öhälso-smällen om minst ett lag nappar. Ingen 3/4-grind.
    if (p.type === 'event') {
      const ev = p.event;
      this.S.teams.forEach(t => { if (p.votes[t.id]) t.pengar = Math.max(0, t.pengar + (ev.pengarTillJa || 0)); });
      p.passed = yesCount >= 1;
      if (p.passed && ev.oh) {
        const before = this.S.oh;
        this.S.oh = Math.max(0, Math.min(this.cfg.ohMax, this.S.oh + ev.oh));
        this.S.lastDelta = this.S.oh - before;
        this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: this.S.lastDelta });
      }
      this.S.pendingEvent = null;
      this._emit('proposalResolved', { type: 'event', event: { id: ev.id, rubrik: ev.rubrik }, votes: { ...p.votes }, passed: p.passed, yesCount });
      return;
    }
    p.passed = yesCount >= 3;
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

      // ─── Extra-förslag ur poolen (alla [BYGG] = befintliga primitiver P1–P6) ───
      } else if (p.type === 'krispaket') {
        // 🆘 Krispaket (P1+P3+P6): ja-röstare betalar gronCost var; öhälsan lyfts STORT (krispaketGain).
        // Gratisåkare: nej-röstaren (max 1 vid 3/4) slipper betala men får ändå öhälso-nyttan.
        this.S.teams.forEach(t => { if (p.votes[t.id]) t.pengar = Math.max(0, t.pengar - this.cfg.gronCost); });
        this.S.gronQueued += this.cfg.krispaketGain;
      } else if (p.type === 'sektorskatt') {
        // 🏝 Sektorskatt (P1+P5): varje pengar-lag betalar sektorskattAmount🪙; potten delas lika till materiallagen.
        // Delar ön 2-mot-2 längs sektorslinjen (materiallagens maktmedel mot den dominerande pengar-sektorn).
        const payers = this.S.teams.filter(t => t.sektor === 'pengar');
        const recips = this.S.teams.filter(t => t.sektor === 'material');
        let pot = 0;
        payers.forEach(t => { const pay = Math.min(this.cfg.sektorskattAmount, t.pengar); t.pengar -= pay; pot += pay; });
        const share = recips.length ? Math.floor(pot / recips.length) : 0;
        recips.forEach(t => t.pengar += share);
      } else if (p.type === 'solidaritet') {
        // 👑 Solidaritetsskatt (P1+P2+P5): rikaste laget betalar solidaritetPengar🪙 + solidaritetMaterial🧱,
        // delas lika mellan de tre andra (omfördelning från den ekonomiska ledaren).
        const r = this.richest();
        const payP = Math.min(this.cfg.solidaritetPengar, r.pengar);
        const payM = Math.min(this.cfg.solidaritetMaterial, r.material);
        r.pengar -= payP; r.material -= payM;
        const others = this.S.teams.filter(t => t.id !== r.id);
        const shareP = Math.floor(payP / others.length), shareM = Math.floor(payM / others.length);
        others.forEach(t => { t.pengar += shareP; t.material += shareM; });
      } else if (p.type === 'lojalitet') {
        // 🤝 Grön utdelning / Lojalitetstest (P1+P3+P6): ja-röstare får lojalitetBonus🪙, nej-röstare
        // betalar lojalitetBoter🪙, litet öhälso-lyft (lojalitetOh). Att stå utanför blocket kostar konkret.
        this.S.teams.forEach(t => {
          if (p.votes[t.id]) t.pengar += this.cfg.lojalitetBonus;
          else t.pengar = Math.max(0, t.pengar - this.cfg.lojalitetBoter);
        });
        this.S.gronQueued += this.cfg.lojalitetOh;
      } else if (p.type === 'marknadsavtal') {
        // 📈 Marknadsavtal (P1+P6): bonus bara vid EXAKT 3 ja (fyra ja → inget). Rent koordinationsproblem
        // (någon måste frivilligt avstå). Förslagsläggaren auto-röstar ja → "en måste avstå".
        if (yesCount === 3) {
          this.S.teams.forEach(t => t.pengar += this.cfg.marknadsavtalBonus);
          this.S.gronQueued += this.cfg.marknadsavtalOh;
        }
      } else if (p.type === 'gronstod') {
        // 💊 Riktat grönt stöd (P1+P5, pott-variant): ja-röstare betalar gronCost var → hela potten
        // ges till det grönaste laget (_greenest), så det får råd med dyra gröna kort.
        let pot = 0;
        this.S.teams.forEach(t => { if (p.votes[t.id]) { const pay = Math.min(this.cfg.gronCost, t.pengar); t.pengar -= pay; pot += pay; } });
        const target = this._greenest();
        if (target) target.pengar += pot;
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
    // OMBALANSERING: röd-zons-spiral — är ön i kris (under redZone) faller den EXTRA varje runda
    // (exponentiell nedförsbacke) och alla lag betalar allmänningens nota. Vänds bara genom samarbete.
    // Mjuk (−redZonePenalty) så en djup kris är RÄDDNINGSBAR. Se §3.4 + §7 (nuläge) i förslaget.
    const provisional = before + delta;
    if (provisional > 0 && provisional < c.redZone) {
      delta -= (c.redZonePenalty || 0);
      this.S.teams.forEach(t => {
        t.pengar   = Math.max(0, t.pengar   - (c.eventLoss || 0));
        t.material = Math.max(0, t.material - (c.eventLoss || 0));
      });
    }
    this.S.oh = Math.max(0, Math.min(c.ohMax, this.S.oh + delta));
    this.S.lastDelta = this.S.oh - before;
    this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: this.S.lastDelta });

    // (Gamla kris-slumpen är borttagen — händelser hanteras nu av EVENT-systemet vid roundStart.)

    // rundans kapitalökning (för award "ledande")
    this.S.teams.forEach(t => t._roundGain = (t.pengar + t.material) - t._roundStartWealth);
    this._emit('award', { round: this.S.round, ...this._computeAwards() });

    // nollställ rund-scope
    this.S.gronQueued = 0; this.S.proposal = null;
    this.S.banDirtyThisRound = this.S.banDirtyNextRound; this.S.banDirtyNextRound = false;
    this.S.teams.forEach(t => { t.choice = null; t._roundOh = 0; });

    this._emit('roundEnd', { round: this.S.round });

    // slut / krasch / kris / nästa runda
    // (1) backstop: total kollaps vid 0 — ORÖRT (ligger FÖRE kris-grinden; kris-linjen vid 20 träffar först).
    if (this.S.oh <= 0) return this._end(false, 'Ön kollapsade totalt.');
    // (2) sista rundan: vinstvillkoret (öh ≥ threshold → rikaste vinner) är ORÖRT. Kris-grinden gäller
    //     bara MITT i spelet (runda < rounds) → ingen omspelning av själva slutrundan.
    if (this.S.round >= c.rounds) {
      return this.S.oh >= c.threshold ? this._end(true) : this._end(false, `Ön nådde bara ${this.S.oh} — under tröskeln ${c.threshold}.`);
    }
    // (3) KRIS-GRIND: starta/lös kris, eller spela om rundan (full rollback) om olöst vid deadline.
    if (this._krisGrind() === 'replay') return this.replayRound();

    this.S.round++;
    this._snapshot();
    this._rollExtraProposals();                      // rulla rundans extra-förslag (server-auktoritativt) före roundStart
    this._drawEvent();                               // dra rundans händelse (före roundStart → servern ser pendingEvent)
    this._emit('roundStart', { round: this.S.round });
    if (!this.gm && this.S.pendingEvent) this._runEvent(this.S.pendingEvent);   // auto-läge: applicera direkt
    this._captureRound();                            // snapshot EFTER rundsetup + ev. auto-händelse = replay-punkt
  }

  // ═══════════════ Kris-grind (design/VINST-FORLUST-FORSLAG.md, Alternativ B) ═══════════════
  // Körs i endRound EFTER att öh uppdaterats, FÖRE rundan avancerar. Returnerar:
  //   'advance' → fortsätt normalt (ev. efter att kris startat/lösts)
  //   'replay'  → olöst kris vid deadline → endRound gör rollback via replayRound()
  // Deadline = 1 runda: krisen deklareras vid bokslut N, måste lösas till bokslut N+1.
  _krisGrind() {
    const c = this.cfg;
    if (!this.S.inCrisis) {
      // Ingen aktiv kris → starta om öh föll till/under krisZon vid detta bokslut.
      if (this.S.oh <= c.krisZon) {
        this.S.inCrisis = true;
        this.S.krisReplaysLeft = c.krisMaxReplay;   // färskt omspels-tak per kris (en senare, separat kris får egna 2)
        this._emit('crisis', { on: true, oh: this.S.oh, replaysLeft: this.S.krisReplaysLeft });
      }
      return 'advance';
    }
    // Aktiv kris → LÖST om öh klättrat upp över återhämtnings-tröskeln (hysteres krisReset > krisZon).
    if (this.S.oh >= c.krisReset) {
      this.S.inCrisis = false;
      this._emit('crisis', { on: false, oh: this.S.oh, replaysLeft: this.S.krisReplaysLeft });
      return 'advance';
    }
    // Aktiv kris, fortfarande olöst vid deadline → spela OM rundan om tak ej nått.
    if (c.krisReplay && this.S.krisReplaysLeft > 0) {
      this.S.krisReplaysLeft--;
      return 'replay';
    }
    // ── HÅRD GAME-OVER-GRÄNS ── Taket (krisMaxReplay) är nått och krisen är fortfarande olöst.
    // DEFAULT: ingen hård game-over — spelet fortsätter med krisen kvar aktiv (spelledaren/gmMode
    // räddar i rummet). Vill Josef ha en hård game-over här är detta exakt platsen:
    //   return this._end(false, 'Ön kollapsade — krisen löstes aldrig.');
    return 'advance';
  }

  // Spela om rundan: full rollback till rundans start (snapshotten) + emit 'roundReplay'.
  // krisReplaysLeft/inCrisis är META om omspels-processen → överlever rollbacken (rullas EJ tillbaka).
  // Emittar INTE 'roundStart' (undviker award-paus-maskineriet) — lyssnarna hanterar 'roundReplay' separat.
  replayRound() {
    const keepReplaysLeft = this.S.krisReplaysLeft;
    this.S = structuredClone(this._roundSnapshot);
    this.S.inCrisis = true;                 // krisen är fortfarande aktiv under omspelet (blandaren kvar PÅ)
    this.S.krisReplaysLeft = keepReplaysLeft;
    this._emit('roundReplay', { round: this.S.round });
    this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: 0 });
    // _roundSnapshot lämnas orört → varje omspel rullar tillbaka till SAMMA rena rundstart.
  }

  // ═══════════════ Händelse-system ═══════════════
  // Dra rundans händelse. Auto-läge: chansPerRunda avgör; GM-läge: dra alltid (spelledaren avgör sen).
  // Utan återläggning → flyttas till drawnEvents så den inte kommer igen.
  _drawEvent() {
    this.S.pendingEvent = null;
    const pool = this.S.eventPool;
    if (!pool || pool.length === 0) return;
    if (!this.gm && Math.random() >= EVENT_CONFIG.chansPerRunda) return;
    const i = Math.floor(Math.random() * pool.length);
    const id = EVENT_CONFIG.utanAterlaggning === false ? pool[i] : pool.splice(i, 1)[0];
    this.S.drawnEvents.push(id);
    this.S.pendingEvent = EVENTS.find(e => e.id === id) || null;
  }

  // Spelledaren svarar på rundans händelseförslag (GM-läge). ja = kör, nej = hoppa. Idempotent.
  resolveEventDecision(beslut) {
    const ev = this.S?.pendingEvent;
    if (!ev) return;
    if (beslut === 'ja') this._runEvent(ev);
    else this.S.pendingEvent = null;
  }

  // Kör en dragen händelse. typ:'auto' → applicera på en gång. typ:'rost' → öppna individuell omröstning.
  _runEvent(ev) {
    if (!ev) return;
    if (ev.typ === 'rost') {
      this.S.proposal = { type: 'event', event: ev, by: null, votes: {}, resolved: false, passed: false };
      this._emit('proposalOpened', { type: 'event', by: null,
        event: { id: ev.id, rubrik: ev.rubrik, text: ev.text, rostFraga: ev.rostFraga, ja: ev.pengarTillJa, ljud: ev.ljud, bild: 'assets/event_' + ev.id + '.png' } });
      return;   // pendingEvent ligger kvar tills omröstningen upplöses
    }
    const targets = this._eventTargets(ev.traffar);
    targets.forEach(t => {
      if (ev.egenValuta) t[t.sektor] = Math.max(0, t[t.sektor] + ev.egenValuta);
      if (ev.pengar)   t.pengar   = Math.max(0, t.pengar + ev.pengar);
      if (ev.material) t.material = Math.max(0, t.material + ev.material);
    });
    if (ev.oh) {
      const before = this.S.oh;
      this.S.oh = Math.max(0, Math.min(this.cfg.ohMax, this.S.oh + ev.oh));
      this.S.lastDelta = this.S.oh - before;
      this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: this.S.lastDelta });
    }
    this._emit('event', { id: ev.id, rubrik: ev.rubrik, text: ev.text, ljud: ev.ljud,
      bild: 'assets/event_' + ev.id + '.png', traffade: targets.map(t => t.id), oh: ev.oh || 0,
      effekter: targets.map(t => ({ teamId: t.id, namn: t.namn, sektor: t.sektor,
        pengar: ev.pengar || 0, material: ev.material || 0, egen: ev.egenValuta || 0 })) });
    this.S.pendingEvent = null;
  }

  // Lös upp en träff-selektor till en lag-lista.
  _eventTargets(traffar) {
    const teams = this.S.teams;
    if (traffar === 'alla') return teams;
    if (traffar === 'sektorPengar') return teams.filter(t => t.sektor === 'pengar');
    if (traffar === 'sektorMaterial') return teams.filter(t => t.sektor === 'material');
    if (traffar === 'rikaste') return [this.richest()];
    if (traffar === 'greenaste') return [this._greenest()];
    if (typeof traffar === 'string' && traffar.startsWith('omrade:')) {
      const t = this.team(traffar.slice('omrade:'.length));
      return t ? [t] : [];
    }
    return [];
  }

  // Grönast = högst impactNeg (minst negativ). Tie-break: lägst totalt kapital, sedan AREAS-ordning.
  _greenest() {
    const order = AREAS.map(a => a.id);
    return [...this.S.teams].sort((a, b) =>
      (b.impactNeg - a.impactNeg) ||
      ((a.pengar + a.material) - (b.pengar + b.material)) ||
      (order.indexOf(a.id) - order.indexOf(b.id)))[0];
  }

  // ACTION (GM): pengasläpp från centralmakten — +10 pengar och +10 material till ALLA fyra lag.
  pengaslapp() {
    if (!this.S || this.S.over) return;
    this.S.teams.forEach(t => { t.pengar += 10; t.material += 10; });
    this.S.teams.forEach(t => this._emit('income', { teamId: t.id, pengar: 10, material: 10 }));
    this._emit('event', { id: 'pengaslapp', rubrik: 'PENGASLÄPP FRÅN CENTRALMAKTEN',
      text: 'Centralmakten skjuter till 10 pengar och 10 material till varje lag för att hålla öns ekonomi flytande.',
      ljud: null, traffade: this.S.teams.map(t => t.id) });
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
    // Släpp en ev. aktiv kris FÖRE gameEnd → riggen (kris→0: blandare av + ambient) och skärmen
    // (glöd av) nollställs innan slutrutan. Täcker fallet att krisen var olöst på sista rundan.
    if (this.S.inCrisis) {
      this.S.inCrisis = false;
      this._emit('crisis', { on: false, oh: this.S.oh, replaysLeft: this.S.krisReplaysLeft });
    }
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
