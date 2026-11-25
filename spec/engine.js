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

import { buildingsForRegion } from './content/buildings.js';
import { TEAMS } from './content/teams.js';
import { EVENTS } from './content/events.js';   // bara 'rost'-erbjudanden kvar (sponsrat). Det gamla fullt slumpade EVENT_CONFIG är borttaget 2026-11-19.
import { PROPOSALS, proposalById } from './content/proposals.js';
import { DILEMMAS, dilemmaById } from './content/dilemmas.js';
import { COMPANY_CRISES } from './content/company-crises.js';
import { COMPANY_EVENTS, COMPANY_EVENT_IDS, companyEventById } from './content/company-events.js';
import { OHALSA_EVENTS, ohalsaEventById } from './content/ohalsa-events.js';
import { GM_EVENTS, gmEventById } from './content/gm-events.js';
import { applyProposalEffects } from './effects.js';
import { selectProposals, proposalEligible, makeRng } from './systems/proposal-selector.js';

export const DEFAULT_CONFIG = {
  rounds: 8,
  timerSec: 120,      // ALLA rundor 120 s (fler valmöjligheter nu → lagen behöver prata med varandra)
  timerSecEarly: 120, // rundtid för de första rundorna (inlärning)
  earlyRounds: 3,     // så många rundor körs med timerSecEarly (nu samma 120 s som resten)
  startPengar: 35,   // OMBALANSERING: symmetrisk start (var 40) — se design/REBALANSERING-FORSLAG.md §7 för nuläge
  startMaterial: 35, // OMBALANSERING: symmetrisk start (var 30); summan 70 oförändrad
  ohStart: 50,
  ohMax: 100,
  threshold: 60,     // öhälsa som måste nås vid slutet
  redZone: 35,       // VISUELL/bot-tröskel (öhälsomätarens röda zon, rigg-cue, bot-försiktighet). Orsakar
                     // INGEN automatisk förlust längre — röda zonens öhälso-funktion (årlig −3) och
                     // RESURSförlust (eventLoss −4/−4) är BORTTAGNA 2026-11-18/19. Konsekvenserna av låg
                     // öhälsa hanteras helt av öhälsohändelserna (Värmebölja ≤35, Storm ≤27, Resursbrist
                     // ≤30 [Skola]) + KRIS ≤20.
  greenZone: 70,
  resursbristProdFaktor: 0.8, // RESURSBRIST (Skola): produktion × 0.8 (−20 %) medan aktiv. ⚠ preliminär balans.
  // FÖRDRÖJDA ÖHÄLSOHÄNDELSER (2026-11-18): öhälsohändelser (NATUREN BLOMSTRAR/MILJÖLYFT/VÄRMEBÖLJA/STORM)
  // KVALIFICERAS vid bokslut men VISAS först en bit in i NÄSTA byggfas (presentations-/tidsstyrning i servern,
  // ej en balansändring — trösklar/effekter oförändrade). true = nya beteendet; false = legacy (omedelbar).
  // RESURSBRIST (Skola) undantas och är ALLTID omedelbar pga sin pågående produktionskoppling.
  ohalsaDelayed: true,
  ohalsaDelaySeconds: 30,  // aktiv byggtid innan 1:a väntande öhälsohändelsen visas (och mellan flera). Servern mäter.
  slotsPerArea: 10,
  maxBuildsPerYear: null,   // VARIANTSTYRD bygggräns: null = obegränsat (Mellan/Skola). Flash sätter 1
                            // (max ett bygge/lag/år). Kontrolleras i selectCard → gäller UI/server/bot/simulator.

  // ─── LOKALA FÖRETAGSKRISER: tröskel (ackumulerad impactNeg) + ÅRSKRAV (tidigast tillåtna spelår) ───
  // Beslut 2026-11-19 (Klara/Josef): kriserna inträffade för tidigt (kunde båda slå år 1 vid fritt byggande).
  // NYA regler: en kris kräver att BÅDA villkoren är uppfyllda — tillräcklig ackumulerad miljöskada OCH att
  // spelet nått det angivna året. Inget nytt miljöskadligt bygge krävs just det året (väntande kriser köas vid
  // starten av det första tillåtna årets byggfas via fireDueCrises; passeras tröskeln ett tillåtet år slår den
  // direkt vid bygget). Resursförluster/öhälsoeffekter (−10/−20, −4/−8) ligger kvar oförändrade i company-crises.js.
  // Allvarsgrad (minor/major) kommer från crisens `grad`-fält. Config-styrt så GAMLA regler kan simuleras i SAMMA
  // motor: companyCrisisThreshold:{minor:-10,major:-20} + companyCrisisMinRound:{minor:1,major:1}. Gäller
  // Mellan/Skola (features.companyCrises); Flash saknar företagskriser och påverkas inte.
  companyCrisisThreshold: { minor: -15, major: -25 },   // ackumulerad impactNeg (negativ) som måste nås
  companyCrisisMinRound:  { minor: 2,  major: 4 },       // tidigast spelår (round) krisen får inträffa
  gronCost: 8,       // OMBALANSERING: billigare grön satsning (var 10)
  gronGain: 14,      // OMBALANSERING: kollektiv satsning kan VÄNDA en kris (var 8)
  taxAmount: 20,     // OMBALANSERING: vassare maktmedel mot boven (var 15)

  // ─── KRIS / FÖRLUST-MEKANIK (design/VINST-FORLUST-FORSLAG.md, Alternativ B) ───────────────────
  // "Blandaren = kris-linjen": en deterministisk, hänvisningsbar kris-gräns som biter MITT i spelet
  // (dagens enda mitt-i-död = öh ≤ 0 nås i praktiken aldrig av en reagerande grupp). Vinstvillkoret
  // (öh ≥ threshold på sista rundan → rikaste vinner) och 0-golvet (backstop) är ORÖRDA.
  krisGrind: true,    // PÅ: tydlig kris deklareras när öh är låg (röd look + siren via 'crisis'-eventet).
  krisGameOver: false, // AV (Klaras test 2026): en olöst kris dödar INTE automatiskt nästa runda — krisen fortsätter bara (varning kvar). Spelet avgörs på sista rundan + 0-golvet. Sätt true för gammal auto-död.
  krisZon: 20,        // öh ≤ 20 vid bokslut (utan aktiv kris) → KRIS startar. = ohMode 'superdaligt' + hjärnans kris.wav-gräns.
  krisReset: 35,      // öh ≥ 35 vid bokslut (med aktiv kris) → krisen LÖST. 15 p hysteres (= redZone) hindrar flimmer.
  krisReplay: true,   // olöst kris vid deadline → rollback + spela OM rundan (false = krisen fortsätter utan omspel).
  krisMaxReplay: 2,   // tak på antal omspel av samma kris-runda. deadline = 1 runda (implicit av grind-strukturen).
  // OBS game-over-gränsen: efter krisMaxReplay omspel FORTSÄTTER spelet ändå (ingen hård game-over som default —
  // spelledaren/gmMode räddar i rummet). Platsen där en hård game-over SKULLE sitta är flaggad i _krisGrind().

  humanTeam: 'aker', // vilket område människan styr i mock/fas 3

  // ─── BESLUTSSYSTEM (Ö-rådet) ───────────────────
  // Config-styrt urval för ALLA förslag jämbördigt (Slice 6B: legacy grund-3 borttaget). decisionSystem
  // 'politics' (förslag + ja/nej) | 'dilemma' (A/B). En naken motor (utan variant) får detta default-urval;
  // varianterna (spec/config/variants/) överstyr med egna värden. Urvalet: spec/systems/proposal-selector.js.
  decisionSystem: 'politics',
  politics: { proposalCount: 5, selection: { fillRemaining: 'random' } },   // 5 jämbördiga förslag/år
  krisProposalOh: 20,          // öhälsa under detta → SOS Krispaket blir eligible (proposals.js eligibility)
  powerFromRound: 2,           // ÖRÅD: första Ö-rådet (efter år 1, round 2) = Oxen/aker, sedan skog→räven→örnen.
                               //   (Round 1:s bygge har ingen ordförande; Ö-rådet körs efter round++ → round 2 = aker.)

  // Belopp för de NYA extra-förslagen. Konservativt satta — Klara/Josef får tuna.
  // (Grund-3-siffrorna ovan rörs INTE; nya förslag återanvänder dem där det går.)
  krispaketGain: 28,        // 🆘 Krispaket: öhälso-lyft (≈2×gronGain) vid lyckad kris-satsning
  krispaketCost: 15,        // 🆘 Krispaket: ja-röstarnas insats var (dyrare än vanlig grön satsning → ett verkligt val; har man mindre betalar man allt man har)
  sektorskattAmount: 12,    // 🏭 Industriskatt (id sektorskatt): 🪙 som VARJE pengar-lag (Räven+Örnen) betalar; delas lika till materiallagen (Oxen+Björnen)
  naturbruksskattAmount: 12, // 🌾 Naturbruksskatt: SPEGEL av Industriskatt — 🪙 som VARJE material-lag (Oxen+Björnen) betalar; delas lika till pengarlagen (Räven+Örnen)
  solidaritetPengar: 15,    // 👑 Solidaritetsskatt: 🪙 som rikaste laget betalar (delas på de tre andra)
  solidaritetMaterial: 10,  // 👑 Solidaritetsskatt: 🧱 som rikaste laget betalar (delas på de tre andra)
  marknadsavtalBonus: 8,    // 📈 Marknadsavtal: 🪙 till ALLA fyra lag — men bara om EXAKT 3 röstade ja
  marknadsavtalOh: 2,       // 📈 Marknadsavtal: litet öhälso-lyft vid exakt 3 ja
  // (💊 Riktat grönt stöd återanvänder gronCost som ja-röstarnas insats → ingen egen ratt.)

  // ─── NYA testförslag (Klara 2026-10-27) ───
  grannskattAmount: 12,     // 💰 Grannskatt: 🪙 som vardera av de TVÅ rikaste betalar → delas på de två fattigaste
  alliansBonus: 8,          // 🤝 Allians: 🪙 till varje JA-lag
  alliansBoter: 8,          // 🤝 Allians: 🪙 som varje NEJ-lag betalar
  kustvaktAmount: 8,        // 🌊 Kustvakt: 🪙 som Räven + Örnen betalar var
  kustvaktOh: 10,           // 🌊 Kustvakt: öhälso-lyft
  skogsvardAmount: 8,       // 🪵 Skogsvård: 🪙 som Oxen + Björnen betalar var (speglar kustvakt för material-laget)
  skogsvardOh: 10,          // 🪵 Skogsvård: öhälso-lyft (återställd skog & mark)
  utslappAmount: 15,        // 🏭 Utsläppshandel: 🪙 som värsta boven betalar till grönaste laget
  utslappOh: -6,            // 🏭 Utsläppshandel: öhälso-smäll (köper rätten att smutsa)
  naturreservatOh: 12,      // 🌳 Naturreservat: öhälso-lyft; INGEN får bygga nästa runda
};

// Politikbanken ligger i spec/content/proposals.js. De 15 förslagen (gemensam bank Mellan+Skola,
// omarbetad 2026-11-19) är JÄMBÖRDIG data i fyra kategorier (future/cooperation/polluter/sector);
// urvalet görs config-styrt (spec/systems/proposal-selector.js), effekterna av spec/effects.js.
// Mellan kvoterar per kategori (variant-config), Skola väljer tills vidare helt slumpmässigt.

// Lagbanken ligger i spec/content/teams.js (migrerings-Etapp 2, 2026-11-25). Motorn re-exporterar den
// som AREAS → map.js m.fl. och motorns egen logik är oförändrade. Samma värden som tidigare.
export const AREAS = TEAMS;

// ═══════════════ Händelser (events) ═══════════════
// Händelser kommer ur tre kategorier: foretag (company-crises/-events), ohalsa (ohalsa-events),
// gm (gm-events). Det GAMLA fullt slumpade systemet (EVENT_CONFIG + 'auto'-händelser) är borttaget
// 2026-11-19. Kvar i events.js: 'rost'-erbjudanden (sponsrat) som Ö-rådets beslutspool kan dra.
export { EVENTS };
export { COMPANY_CRISES };
export { COMPANY_EVENTS };
export { OHALSA_EVENTS };
export { GM_EVENTS };

// Rundtid: de första earlyRounds rundorna är längre (inlärning), resten timerSec.
export const timerSecFor = (cfg, round) =>
  round <= (cfg.earlyRounds ?? 0) ? (cfg.timerSecEarly ?? cfg.timerSec) : cfg.timerSec;

// Byggnadsbanken ligger i spec/content/buildings.js (migrerings-Etapp 1, 2026-11-11). Samma
// balansvärden som tidigare — handFor är kvar som motorns/klientens oförändrade gränssnitt och
// läser banken i stället för de tidigare hårdkodade MATERIAL_HAND/PENGAR_HAND/NAMES-listorna.
export function handFor(areaId) {
  return buildingsForRegion(areaId);
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
    // Config-styrt urval (Etapp 2b–B): aktivt BARA när varianten anger politics.proposalCount
    // eller politics.selection. Annars körs legacy-urvalet (grund-3 + slumpade extra) oförändrat,
    // så det körande spelet, UI/bots och de gamla golden-baselines är opåverkade tills vi flippar.
    // Beslutssystem för Ö-rådet: 'politics' (förslag + ja/nej) | 'dilemma' (A/B). Urvalet är ALLTID
    // config-styrt (Slice 6B: legacy grund-3-urval borttaget). DEFAULT_CONFIG ger ett default-urval så
    // även en naken motor (lokalt läge/test) fungerar; varianterna överstyr.
    this._decisionSystem = this.cfg.decisionSystem || 'politics';
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
      banAllThisRound: false, banAllNextRound: false,              // 🌳 Naturreservat: byggstopp
      banDirtySektorThisRound: null, banDirtySektorNextRound: null, // 🚫 Sektorblockad: smutsig-stopp för en sektor
      buildDiscountThisRound: 0, buildDiscountNextRound: 0,         // 🏗️ Byggboom: 🧱-rabatt/bygge
      usedProposals: [],                                           // förslagstyper som redan lagts denna runda
      inCrisis: false, krisReplaysLeft: c.krisMaxReplay,   // kris-mekanik: följer med i getState() → klient + spelledarpult
      proposal: null, proposedBy: [], gronQueued: 0,
      // rundans valbara beslut: dilemma-läge → decisionChoices (A/B + rost), annars proposalChoices (politik).
      ...(this._decisionSystem === 'dilemma' ? { decisionChoices: [], usedDecisions: [] } : { proposalChoices: [] }),
      powerTeam: null,                                             // MAKT-ROTATION: vilket lag som får lägga förslag denna runda (null = fritt, t.ex. runda 1)
      // KÖADE HÄNDELSER (kategori 'foretag' + 'ohalsa'): miljökriser, prestationshändelser och
      // öhälsohändelser delar EN kö + 10 s-paus. firedCompanyEvents = id:n som redan slagit (max 1/spel).
      firedCompanyEvents: [], companyEventQueue: [], activeCompanyEvent: null,
      pendingOhalsa: [],                // FÖRDRÖJDA öhälsohändelser: id:n kvalificerade vid senaste bokslut, väntar på nästa byggfas
      resursbristAktiv: false,          // RESURSBRIST (Skola): långvarig produktionsminskning medan aktiv
      ohAtYearStart: c.ohStart,         // öhälsa vid byggårets början → MILJÖLYFT jämför mot bokslutet
      gmDecisionsUsed: [],              // GM-aktiverade dilemman/omröstningar (en gång/spel). SKILD från Flash Ö-råd.
      teams: AREAS.map(a => ({
        id: a.id, namn: a.namn, farg: a.farg, sektor: a.sektor,
        pengar: c.startPengar, material: c.startMaterial,
        incP: 0, incM: 0, built: 0, impactPos: 0, impactNeg: 0, totalImpact: 0,
        // Prestationsräknare (company-events): gröna/skadliga byggen totalt, grön-svit (bryts av neutral/
        // skadlig) och byggen i år (Expansion; nollställs vid endRound).
        gronBuilt: 0, dirtyBuilt: 0, _gronStreak: 0, _builtThisYear: 0, _gronThisYear: 0,
        choice: null, _roundCards: [], log: [], slots: [], // slots: index-ordning för placerade byggnader
        _roundStartWealth: 0, _roundOh: 0, _roundGain: 0,
      })),
    };
    this._snapshot();
    this.S.powerTeam = this._powerTeamForRound(1);   // MAKT-ROTATION: vem styr politiken runda 1 (null med default powerFromRound=2)
    this._rollRoundProposals();                      // legacy: runda 1 → [] (extra öppnar runda ≥4) | nytt urval: rundans valbara förslag
    // (Runda 1: ingen autonom slumphändelse längre — se borttagningen i endRound 2026-11-19.)
    this._emit('start', { config: c, areas: AREAS });
    this._emit('roundStart', { round: 1, powerTeam: this.S.powerTeam });
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
    if (this.S.banAllThisRound) return { ok: false, reason: 'byggstopp denna runda (naturreservat)' };
    if (this.S.banDirtyThisRound && tier === 'smutsig') return { ok: false, reason: 'smutsig förbjuden denna runda' };
    if (this.S.banDirtySektorThisRound === t.sektor && tier === 'smutsig') return { ok: false, reason: 'smutsig förbjuden för din sektor denna runda' };
    // VARIANTSTYRD BYGGGRÄNS (Flash: maxBuildsPerYear=1): när laget redan byggt sitt tak för året nekas
    // ytterligare byggen UTAN att dra resurser eller ändra state. _builtThisYear nollas vid endRound (årsskifte).
    const maxB = this.cfg.maxBuildsPerYear;
    if (maxB != null && t._builtThisYear >= maxB) return { ok: false, reason: 'redan byggt i år', maxReached: true };
    const kmEff = Math.max(0, card.km - (this.S.buildDiscountThisRound || 0));   // 🏗️ Byggboom-rabatt på material
    if (t.pengar < card.kp || t.material < kmEff) {
      return { ok: false, reason: 'har inte råd', need: { pengar: Math.max(0, card.kp - t.pengar), material: Math.max(0, kmEff - t.material) } };
    }
    t.pengar -= card.kp; t.material -= kmEff;
    t.choice = card.tier;                              // sista valet (UI-markering)
    (t._roundCards ||= []).push(card);                 // FLER BYGGEN/RUNDA: alla rundans byggen räknas vid bokslut
    // Varje bygge får en egen slot direkt (så flera byggen samma runda inte hamnar på samma plats).
    const slotIndex = t.slots.length;
    t.slots.push({ tier: card.tier, asset: card.asset });
    t.totalImpact += card.oh; t.built++;
    if (card.oh > 0) t.impactPos += card.oh; else if (card.oh < 0) t.impactNeg += card.oh;
    // Prestationsräknare: grön (impact>0) / miljöskadlig (impact<0) / neutral (=0). Neutral bryter
    // grön-sviten men räknas varken som grön eller skadlig.
    t._builtThisYear++;
    if (card.oh > 0) { t.gronBuilt++; t._gronStreak++; t._gronThisYear++; }
    else { if (card.oh < 0) t.dirtyBuilt++; t._gronStreak = 0; }
    this._emit('build', { teamId, area: teamId, card, slotIndex, cost: { pengar: card.kp, material: card.km } });
    this._checkCompanyCrises(teamId);
    this._checkCompanyAchievements(teamId, card);
    return { ok: true, card };
  }

  // ACTION: byt valutor mellan två lag (atomiskt). I mock avgör mock-opponents om en bot accepterar.
  transfer(fromId, toId, give, giveCur, get, getCur) {
    if (this.cfg.features && this.cfg.features.trade === false) return { ok: false, reason: 'handel av i denna version' };   // version-gate (Flash). Legacy: features saknas → handel på.
    const a = this.team(fromId), b = this.team(toId);
    if (giveCur === getCur) return { ok: false, reason: 'samma valuta' };
    if (a[giveCur] < give) return { ok: false, reason: 'givaren saknar täckning' };
    if (b[getCur] < get) return { ok: false, reason: 'mottagaren saknar täckning' };
    a[giveCur] -= give; a[getCur] += get; b[getCur] -= get; b[giveCur] += give;
    this._emit('trade', { from: fromId, to: toId, give, giveCur, get, getCur });
    this._checkUppror();   // handel kan göra ett lag betydligt rikare → Uppror
    return { ok: true };
  }

  // Dispatcher: config-styrt urval. Beslutssystemet avgör VAD som dras: politik-förslag (ja/nej)
  // eller ett dilemma/rost-händelse (A/B resp. ja/nej).
  _rollRoundProposals() {
    if (this._decisionSystem === 'dilemma') return this._rollRoundDecisions();
    this._rollProposalChoices();
  }
  // Kombinerad BESLUTSPOOL för Flashs Ö-råd (Slice 4b): A/B-dilemman (dilemmas.js) + ALLA
  // 'rost'-erbjudandehändelser (events.js) — framtida rost-händelser ingår automatiskt (inga manuella
  // id:n). Varje innehållsobjekt stannar i sin bank; vi bygger bara en urvals-vy med `_kind`.
  // cfg.dilemma.pool (variant) FILTRERAR poolen till en EXPLICIT id-lista (Flash = exakt 8 beslut);
  // utelämnad → hela banken. Urvalet respekterar eligibility/taggar (cfg.dilemma.selection). Lagras {id, kind}.
  _decisionPool() {
    const poolIds = this.cfg.dilemma && Array.isArray(this.cfg.dilemma.pool) ? this.cfg.dilemma.pool : null;
    const all = [
      ...DILEMMAS.map(d => ({ id: d.id, category: d.category, tags: d.tags, eligibility: d.eligibility, _kind: 'dilemma' })),
      ...EVENTS.filter(e => e.typ === 'rost').map(e => ({ id: e.id, category: e.category, tags: e.tags, eligibility: e.eligibility, _kind: 'event' })),
    ];
    return poolIds ? all.filter(p => poolIds.includes(p.id)) : all;
  }
  _rollRoundDecisions() {
    if (!this.S) return;
    const dcfg = this.cfg.dilemma || {};
    const selection = { proposalCount: dcfg.perRound ?? 1, ...(dcfg.selection || {}) };
    const rng = this.cfg.seed != null ? makeRng((this.cfg.seed >>> 0) + this.S.round + 0x5d1) : Math.random;
    // eligibility-ctx bär round + rounds → notLastRound-villkoret (t.ex. naturreservat_flash år 1–3).
    const isEligible = item => proposalEligible(item, { oh: this.S.oh, cfg: this.cfg, round: this.S.round, rounds: this.cfg.rounds });
    const pool = this._decisionPool();
    const need = selection.proposalCount ?? 1;
    const tagF = (selection.tags && selection.tags.length) ? selection.tags : null;
    const passesFilter = p => isEligible(p) && (!tagF || (p.tags || []).some(t => tagF.includes(t)));
    // HISTORIK (Flash, per parti): undvik beslut som redan använts i partiet SÅ LÄNGE det finns nog med
    // oanvända giltiga. Annars (poolen slut) → tillåt upprepning men undvik helst FÖRRA ÅRETS beslut.
    // S.usedDecisions nollställs av start() → ingen historik delas mellan partier.
    const used = this.S.usedDecisions || [];
    const unusedValid = pool.filter(p => passesFilter(p) && !used.includes(p.id));
    let usePool;
    if (unusedValid.length >= need) {
      usePool = pool.filter(p => !used.includes(p.id));                 // begränsa till oanvända (selektorn eligibility-filtrerar igen)
    } else {
      const last = this.S._lastDecisionId;                             // uttömt → tillåt upprepning, undvik förra årets om möjligt
      usePool = (last && pool.filter(p => p.id !== last && passesFilter(p)).length >= need) ? pool.filter(p => p.id !== last) : pool;
    }
    const { chosen, warnings } = selectProposals(usePool, selection, { isEligible, rng });
    this.S.decisionChoices = chosen.map(id => ({ id, kind: pool.find(p => p.id === id)?._kind || 'dilemma' }));
    if (this.S.decisionChoices.length) {
      this.S._lastDecisionId = this.S.decisionChoices[0].id;
      for (const c of this.S.decisionChoices) if (!this.S.usedDecisions.includes(c.id)) this.S.usedDecisions.push(c.id);
    }
    this.S._decisionWarnings = warnings.length ? warnings : undefined;
  }
  // Presentera ett Ö-råds-beslut med RÄTT mekanik (ingen dubblering, varje bank sin logik):
  // kind 'dilemma' → A/B-omröstning (openDilemma); kind 'event' → individuell ja/nej ('rost' via _runEvent).
  openOradDecision(choice) {
    if (!choice) return { ok: false };
    if (choice.kind === 'event') {
      const ev = EVENTS.find(e => e.id === choice.id);
      if (!ev || ev.typ !== 'rost') return { ok: false, reason: 'ingen rost-händelse' };
      const cur = this.S?.proposal;
      if (cur && !cur.resolved) return { ok: false, reason: 'ett beslut i taget' };
      this._runEvent(ev);   // 'rost' → öppnar proposal type:'event' (individuell ja/nej) — konsekvenser exakt som förr
      return { ok: true, kind: 'event' };
    }
    return { ...this.openDilemma(choice.id), kind: 'dilemma' };
  }
  // GENERELLT URVAL (Etapp 2b–B): alla förslag jämbördiga. Antal/kvoter/taggfilter ur cfg.politics;
  // eligibility filtreras mot speltillståndet; seedbar + reproducerbar per runda (cfg.seed + round).
  // Server-auktoritativt → S.proposalChoices. Varningar (otillräckligt antal m.m.) loggas på S.
  _rollProposalChoices() {
    if (!this.S) return;
    const pol = this.cfg.politics || {};
    const selection = { proposalCount: pol.proposalCount, ...(pol.selection || {}) };
    const rng = this.cfg.seed != null ? makeRng((this.cfg.seed >>> 0) + this.S.round) : Math.random;
    const isEligible = p => proposalEligible(p, { oh: this.S.oh, cfg: this.cfg });
    const { chosen, warnings } = selectProposals(PROPOSALS, selection, { isEligible, rng });
    this.S.proposalChoices = chosen;
    this.S._proposalWarnings = warnings.length ? warnings : undefined;   // för validering/logg
  }
  // MAKT-ROTATION: vilket lag som styr politiken runda R. null = fritt (runda < powerFromRound).
  // Roterar i områdesordning (Oxen → Björnen → Räven → Örnen → …) från powerFromRound och framåt.
  _powerTeamForRound(round) {
    const from = this.cfg.powerFromRound ?? 2;
    if (!from || round < from) return null;
    const order = AREAS.map(a => a.id);
    return order[(round - from) % order.length];
  }
  // Alla valbara förslag ligger i S.proposalChoices — ingen förslagstyp har särskild status.
  _proposalAllowed(type) {
    return (this.S?.proposalChoices || []).includes(type);
  }
  // De förslag ordföranden FAKTISKT kan lägga just nu — ENDA källan för UI + botar (ingen hårdkodad
  // förslagslista utanför motorn).
  allowedProposals() {
    if (!this.S) return [];
    return [...(this.S.proposalChoices || [])];
  }

  // ACTION: politik. ETT förslag per LAG per runda (byTeamId får lägga ett, inte två). Förslagen
  // avgörs ett i taget. type måste ligga i rundans S.proposalChoices (config-styrt urval).
  openProposal(type, byTeamId) {
    if (this.S.powerTeam && byTeamId !== this.S.powerTeam) return;   // MAKT-ROTATION: bara rundans maktlag får lägga förslag
    if (!this._proposalAllowed(type)) return;        // ej bland rundans valbara förslag → ignoreras (server-auktoritativt)
    if ((this.S.proposedBy || []).includes(byTeamId)) return;   // laget har redan lagt sitt förslag denna runda
    if ((this.S.usedProposals || []).includes(type)) return;    // förslagstypen är redan lagd denna runda (ett annat lag tog den)
    const p = this.S.proposal;
    if (p && !p.resolved) return;                    // ett i taget — vänta tills nuvarande avgjorts
    (this.S.proposedBy ||= []).push(byTeamId);
    (this.S.usedProposals ||= []).push(type);
    this.S.proposal = { type, by: byTeamId, votes: {}, resolved: false, passed: false };
    this._emit('proposalOpened', { type, by: byTeamId });
  }
  // Gemensam röstinsamling för politik OCH dilemman. För politik/event är rösten boolean (ja/nej);
  // för dilemman är den 'A'/'B'. När alla lag röstat avgörs beslutet enligt sin interaktionsform.
  vote(teamId, val) {
    const p = this.S.proposal;
    if (!p || p.resolved) return;
    p.votes[teamId] = p.kind === 'dilemma' ? (val === 'B' ? 'B' : 'A') : !!val;
    if (Object.keys(p.votes).length >= this.S.teams.length) {
      if (p.kind === 'dilemma') this._resolveDilemma(); else this._resolveProposal();
    }
  }

  // Öråd-svansen: applicera köad öhälso-förändring DIREKT (syns på mätaren nu) + emit. Delas av
  // politik- och dilemma-resolutionen så tajming/emit är identiska.
  _applyQueuedOhalsa() {
    if (!this.S.gronQueued) return;
    const before = this.S.oh;
    this.S.oh = Math.max(0, Math.min(this.cfg.ohMax, this.S.oh + this.S.gronQueued));
    this.S.lastDelta = this.S.oh - before;
    this.S.gronQueued = 0;
    this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: this.S.lastDelta });
    // Ett politik-/dilemmabeslut som ändrar öhälsan kan passera en öhälsotröskel (t.ex. 28→26 → STORM).
    // LEGACY: köa direkt. FÖRDRÖJT (default): öhälsohändelser kvalificeras bara vid bokslut → ingen köning här.
    if (!this.cfg.ohalsaDelayed) this._checkOhalsaThresholds();
  }

  // ACTION: öppna ett DILEMMA (A/B). Samma entry oavsett om det triggas automatiskt i Flash Ö-råd
  // eller aktiveras av spelledaren i Mellan/Skola (samma innehållsdefinition, inte två kopior).
  openDilemma(id, byTeamId = null) {
    if (!this.S) return { ok: false };
    const d = dilemmaById(id);
    if (!d) return { ok: false, reason: 'okänt dilemma' };
    if (!proposalEligible(d, { oh: this.S.oh, cfg: this.cfg })) return { ok: false, reason: 'ej eligible' };
    const cur = this.S.proposal;
    if (cur && !cur.resolved) return { ok: false, reason: 'ett beslut i taget' };
    this.S.proposal = { kind: 'dilemma', dilemmaId: id, by: byTeamId, votes: {}, resolved: false, outcome: null };
    this._emit('dilemmaOpened', { id: d.id, rubrik: d.namn, text: d.text, category: d.category,
      alternativ: { A: { namn: d.alternativ.A.namn }, B: { namn: d.alternativ.B.namn } }, bild: d.bild || null, by: byTeamId });
    return { ok: true };
  }
  // Publik: tvinga avgörande av det öppna beslutet med de röster som FAKTISKT registrerats (används av
  // servern när Flashs röst-tid går ut utan att alla röstat → uteblivna räknas inte, se dilemmaStrict).
  resolveOpenDecision() {
    const p = this.S?.proposal;
    if (!p || p.resolved) return;
    if (p.kind === 'dilemma') this._resolveDilemma(); else this._resolveProposal();
  }
  // Avgör ett dilemma: flest FAKTISKA röster vinner. Två regelvarianter (config-styrt, påverkar bara Flash):
  //   • cfg.dilemmaStrict (Flash, beslut 2026-11-19): A>B → A · B>A → B · A===B → INGET BESLUT (outcome=null,
  //     inga effekter). Uteblivna röster räknas inte (servern fyller inte i någon default — se forceDilemmaVotes).
  //   • default (Mellan/Skola GM): oförändrat — aCount >= bCount → 'A' (oavgjort 2–2 → A).
  // Den vinnande vägens effekter verkställs via SAMMA effektsystem som politiken.
  _resolveDilemma() {
    const p = this.S.proposal;
    const d = dilemmaById(p.dilemmaId);
    const aCount = Object.values(p.votes).filter(v => v === 'A').length;
    const bCount = Object.values(p.votes).filter(v => v === 'B').length;
    const outcome = this.cfg.dilemmaStrict
      ? (aCount > bCount ? 'A' : (bCount > aCount ? 'B' : null))   // oavgjort → null = inget beslut
      : (aCount >= bCount ? 'A' : 'B');
    p.resolved = true; p.outcome = outcome;
    if (outcome) {   // INGET BESLUT (null) → inga effekter: öhälsa/pengar/material/byggförbud orörda
      const alt = d.alternativ[outcome];
      applyProposalEffects(this, { effects: alt.effects, conditions: alt.conditions || [] }, { votes: {}, yesCount: 0, by: p.by });
    }
    this._applyQueuedOhalsa();   // gronQueued är 0 vid inget beslut → ingen öhälsoförändring
    this._emit('dilemmaResolved', { id: d.id, outcome, alternativ: outcome ? d.alternativ[outcome].namn : null, votes: { ...p.votes }, aCount, bCount });
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
      this._emit('proposalResolved', { type: 'event', event: { id: ev.id, rubrik: ev.rubrik }, votes: { ...p.votes }, passed: p.passed, yesCount });
      return;
    }
    p.passed = yesCount >= 3;
    if (p.passed) {
      // Effekterna ligger som DATA i spec/content/proposals.js och verkställs av spec/effects.js
      // (ersätter den tidigare if/else-kedjan). Resolvern muterar S + S.gronQueued men emitterar
      // inget — öhälso-svansen nedan applicerar gronQueued och emitterar 'ohalsa' oförändrat.
      applyProposalEffects(this, proposalById(p.type), { votes: p.votes, yesCount, by: p.by });
    }
    // ÖRÅD: beslutet hör till örådet (före nästa år) → applicera öhälso-konsekvensen DIREKT (svansen).
    this._applyQueuedOhalsa();
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
      const cards = t._roundCards || [];   // FLER BYGGEN/RUNDA: summera ALLA rundans byggen (slots committas i selectCard)
      for (const card of cards) {
        oh += card.oh;
        delta += card.oh;
        t.incP += card.gp; t.incM += card.gm;
      }
      if (cards.length === 1) namn = cards[0].namn;
      else if (cards.length > 1) namn = `${cards.length} byggen`;
      t._roundOh = oh;
      t.log.unshift({ round: this.S.round, namn, oh });
    });
    if (this.S.gronQueued) delta += this.S.gronQueued;

    // inkomst (passiv produktion = summan av byggnadernas gp/gm, ackumulerad över spelet).
    // RESURSBRIST (Skola, långvarig): produktionen minskas med faktorn medan tillståndet är aktivt.
    const prodFaktor = this.S.resursbristAktiv ? (c.resursbristProdFaktor ?? 1) : 1;
    this.S.teams.forEach(t => {
      const gP = Math.round(t.incP * prodFaktor), gM = Math.round(t.incM * prodFaktor);
      t.pengar += gP; t.material += gM;
      if (gP || gM) this._emit('income', { teamId: t.id, pengar: gP, material: gM });
    });

    // öhälsa
    const before = this.S.oh;
    // Röd zon orsakar INGEN automatisk årlig förlust längre (2026-11-18: −3 öhälsa borttagen; 2026-11-19:
    // eventLoss-resursförlusten −4/−4 borttagen). Konsekvenserna av låg öhälsa hanteras helt av
    // öhälsohändelserna (Värmebölja ≤35, Storm ≤27, Resursbrist ≤30 [Skola]) + KRIS ≤20.
    this.S.oh = Math.max(0, Math.min(c.ohMax, this.S.oh + delta));
    this.S.lastDelta = this.S.oh - before;
    this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: this.S.lastDelta });

    // (Gamla kris-slumpen är borttagen — händelser hanteras nu av EVENT-systemet vid roundStart.)

    // rundans kapitalökning (för award "ledande")
    this.S.teams.forEach(t => t._roundGain = (t.pengar + t.material) - t._roundStartWealth);
    this._emit('award', { round: this.S.round, ...this._computeAwards() });

    // nollställ rund-scope
    this.S.gronQueued = 0; this.S.proposal = null; this.S.proposedBy = []; this.S.usedProposals = [];
    this.S.banDirtyThisRound = this.S.banDirtyNextRound; this.S.banDirtyNextRound = false;
    this.S.banAllThisRound = this.S.banAllNextRound; this.S.banAllNextRound = false;                               // 🌳 Naturreservat
    this.S.banDirtySektorThisRound = this.S.banDirtySektorNextRound; this.S.banDirtySektorNextRound = null;        // 🚫 Sektorblockad
    this.S.buildDiscountThisRound = this.S.buildDiscountNextRound; this.S.buildDiscountNextRound = 0;              // 🏗️ Byggboom
    this.S.teams.forEach(t => { t.choice = null; t._roundOh = 0; t._roundCards = []; t._builtThisYear = 0; t._gronThisYear = 0; });   // Expansion + gemensam-räknare nollas vid årsskifte

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
    const krisRes = this._krisGrind();
    if (krisRes === 'replay')   return this.replayRound();   // omspel → öhälsohändelser hoppas (rundan görs om)
    if (krisRes === 'gameover') return;   // olöst kris → _krisGrind kallade redan _end(false) (game over)

    // ÖHÄLSOHÄNDELSER vid bokslut: EFTER KRIS (så KRIS-vyn får företräde) och bara när rundan står kvar
    // (ingen replay/gameover → stör inte omspelning). Kvalificeras på årets netto (Miljölyft) + öns tröskel.
    // FÖRDRÖJT (default): kvalificerade händelser läggs som VÄNTANDE och visas en bit in i NÄSTA byggfas
    // (servern/simulatorn avfyrar via fireNextPendingOhalsa). LEGACY (ohalsaDelayed=false): visas direkt nu.
    // OBS: detta körs bara när round < rounds (raden 527 returnerar på sista rundan) → en händelse som
    // kvalificerar vid SISTA bokslutet blir alltså ALDRIG väntande (inget nästa år) — §6 i uppgiften.
    if (this.cfg.ohalsaDelayed) this._qualifyPendingOhalsa();
    else { this._checkMiljolyft(); this._checkOhalsaThresholds(); }

    this.S.round++;
    this.S.ohAtYearStart = this.S.oh;   // nästa byggårs utgångsläge (Miljölyft-referens)
    this._snapshot();
    this.S.powerTeam = this._powerTeamForRound(this.S.round);   // MAKT-ROTATION: nästa lag i turordningen styr politiken
    this._rollRoundProposals();                      // rulla rundans förslag (server-auktoritativt) före roundStart
    // Händelser kommer BARA ur kategorierna foretag/ohalsa/gm (det gamla fullt slumpade EVENTS-systemet
    // togs helt bort 2026-11-19). Flash Ö-råds slump (_rollRoundDecisions) + politikurvalet
    // (_rollProposalChoices) + GM:s manuella slump (gmRandomDecision) är ORÖRDA.
    this._emit('roundStart', { round: this.S.round, powerTeam: this.S.powerTeam });
    this._captureRound();                            // snapshot EFTER rundsetup = replay-punkt
  }

  // ═══════════════ Kris-grind (design/VINST-FORLUST-FORSLAG.md, Alternativ B) ═══════════════
  // Körs i endRound EFTER att öh uppdaterats, FÖRE rundan avancerar. Returnerar:
  //   'advance' → fortsätt normalt (ev. efter att kris startat/lösts)
  //   'replay'  → olöst kris vid deadline → endRound gör rollback via replayRound()
  // Deadline = 1 runda: krisen deklareras vid bokslut N, måste lösas till bokslut N+1.
  _krisGrind() {
    const c = this.cfg;
    if (!c.krisGrind) return 'advance';   // AV: ingen kris-deklaration, inget omspel, ingen mitt-i-spelet-kollaps (bara öh 0-golvet + sista rundan avgör)
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
    // Aktiv kris, fortfarande olöst vid deadline.
    // krisGameOver AV (default nu): INGEN auto-död — krisen fortsätter bara (röd varning kvar) och
    // spelet rullar vidare; ön kan fortfarande räddas eller nå 0-golvet/sista rundan.
    if (!c.krisGameOver) return 'advance';
    // krisGameOver PÅ (gammalt beteende): ett förlorat spel AVSLUTAS → game over.
    this._end(false, 'Ön kollapsade — krisen löstes aldrig i tid.');
    return 'gameover';
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

  // ═══════════════ 'Rost'-erbjudanden (Ö-rådets individuella ja/nej) ═══════════════
  // Det gamla fullt slumpade händelsesystemet (_drawEvent/chooseEvent/drawRandomEvent/
  // resolveEventDecision + auto-händelsernas effekter) togs bort 2026-11-19. Kvar är bara körningen
  // av en 'rost'-händelse (sponsrat), som Ö-rådets beslutspool öppnar via openOradDecision →
  // individuell ja/nej. Konsekvenserna tillämpas när omröstningen upplöses (resolveProposal), exakt som förr.
  _runEvent(ev) {
    if (!ev || ev.typ !== 'rost') return;
    this.S.proposal = { type: 'event', event: ev, by: null, votes: {}, resolved: false, passed: false };
    this._emit('proposalOpened', { type: 'event', by: null,
      event: { id: ev.id, rubrik: ev.rubrik, text: ev.text, rostFraga: ev.rostFraga, ja: ev.pengarTillJa, oh: ev.oh, ljud: ev.ljud, bild: 'assets/event_' + ev.id + '.png' } });
  }

  // Grönast = högst impactNeg (minst negativ). Tie-break: lägst totalt kapital, sedan AREAS-ordning.
  // Används av 'greenest'-selektorn i spec/effects.js + spec/bot-policy.js (deklarativa effekter/bot-val).
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

  // ═══════════════ Företagshändelser (kategori 'foretag') ═══════════════
  // Miljökriser (company-crises, områdesbundna, impactNeg-trösklar) + prestationshändelser
  // (company-events, valfritt företag, bygg-/ekonomitriggers) delar EN kö + 10 s-paus (servern).
  // Varje händelse max 1 gång/spel (firedCompanyEvents). Köposter är färdigberäknade:
  //   { id, namn, text, teamId, warn, dPengar, dMaterial, ohalsa }.
  _queueCompanyEvent(post) {
    this.S.firedCompanyEvents.push(post.id);
    this.S.companyEventQueue.push(post);
    if (!this.S.activeCompanyEvent) this._processNextCompanyEvent();
  }
  _processNextCompanyEvent() {
    if (!this.S.companyEventQueue.length) return;
    const p = this.S.companyEventQueue.shift();
    // Effekten kan träffa ETT lag (p.teamId + p.dPengar/dMaterial) eller FLERA (p.teams = lista med
    // {teamId,dPengar,dMaterial}, t.ex. GEMENSAM SATSNING). Öhälsan är global (en gång).
    const rader = p.teams || [{ teamId: p.teamId, dPengar: p.dPengar || 0, dMaterial: p.dMaterial || 0 }];
    for (const r of rader) {
      const t = this.team(r.teamId);
      if (r.dPengar)   t.pengar   = Math.max(0, t.pengar   + r.dPengar);
      if (r.dMaterial) t.material = Math.max(0, t.material + r.dMaterial);
    }
    const before = this.S.oh;
    this.S.oh = Math.max(0, Math.min(this.cfg.ohMax, this.S.oh + (p.ohalsa || 0)));
    this.S.lastDelta = this.S.oh - before;
    this.S.activeCompanyEvent = p.id;
    this._emit('companyEvent', { id: p.id, teamId: p.teamId || null, namn: p.namn, text: p.text, warn: p.warn,
      teams: rader, dPengar: p.dPengar || 0, dMaterial: p.dMaterial || 0, ohalsa: p.ohalsa || 0, ohAfter: this.S.oh });
    if (p.ohalsa) this._emit('ohalsa', { value: this.S.oh, mode: ohMode(this.S.oh), delta: this.S.lastDelta });
    // En händelse som sänkte/höjde öhälsan (t.ex. en miljökris) kan passera en öhälsotröskel.
    // LEGACY: köa ev. öhälsohändelse bakom den nuvarande (kedja). FÖRDRÖJT (default): ingen mitt-i-året-
    // kedja — öhälsohändelser kvalificeras bara vid bokslut (_qualifyPendingOhalsa). firedCompanyEvents skyddar.
    if (p.ohalsa && !this.cfg.ohalsaDelayed) this._checkOhalsaThresholds();
  }
  companyEventResolved() {
    this.S.activeCompanyEvent = null;
    if (this.S.companyEventQueue.length) this._processNextCompanyEvent();
  }

  // Miljökriser: ackumulerad impactNeg når tröskeln (config per grad) OCH spelet har nått krisens
  // tidigast tillåtna år. Direkt vid bygge NÄR båda villkoren är uppfyllda i en tillåten runda.
  _checkCompanyCrises(teamId) {
    if (!this.cfg.features?.companyCrises) return;
    const t = this.team(teamId);
    for (const c of COMPANY_CRISES) {
      if (c.region !== t.id) continue;
      this._maybeQueueCrisis(t, c);
    }
  }
  // Config-styrda kris-parametrar per grad (minor/major). Default: nya reglerna (−15/−25, år 2/4).
  _crisisGrad(c) { return c.grad || (c.id.endsWith('_major') ? 'major' : 'minor'); }
  _crisisThreshold(grad) { const m = this.cfg.companyCrisisThreshold || {}; return m[grad] ?? (grad === 'major' ? -20 : -10); }
  _crisisMinRound(grad) { const m = this.cfg.companyCrisisMinRound || {}; return m[grad] ?? 1; }
  // Köa EN kris om BÅDA villkoren är uppfyllda: ackumulerad skada ≤ tröskel OCH round ≥ årskrav. Max
  // en gång/spel (firedCompanyEvents). Returnerar true om den köades (för fireDueCrises-rapportering).
  _maybeQueueCrisis(t, c) {
    if (this.S.firedCompanyEvents.includes(c.id)) return false;
    const grad = this._crisisGrad(c);
    if (t.impactNeg > this._crisisThreshold(grad)) return false;   // skada ej nådd (impactNeg & tröskel är negativa)
    if (this.S.round < this._crisisMinRound(grad)) return false;    // ÅRSKRAV: för tidigt — väntar till tillåtet år
    const d = { pengar: 0, material: 0 };
    d[c.resource] = -c.loss;
    this._queueCompanyEvent({ id: c.id, namn: c.namn, text: c.text, teamId: t.id, warn: true,
      dPengar: d.pengar, dMaterial: d.material, ohalsa: c.ohalsa });
    return true;
  }
  // ACTION (server/simulator): köa kriser vars villkor (skada + årskrav) redan är uppfyllda men som
  // väntat på sitt tillåtna spelår. Anropas vid BÖRJAN av varje byggfas (efter Ö-råd, under byggfasen) så
  // en kris vars tröskel passerades ett tidigare år köas direkt när det tillåtna året börjar — utan att
  // kräva ett nytt bygge. Idempotent (firedCompanyEvents skyddar mot dubbel; redan-visade hoppas över).
  // Krisen presenteras sedan via den vanliga företagshändelse-kön (10 s-paus). Flera samtidiga → köas.
  fireDueCrises() {
    if (!this.S || this.S.over) return [];
    if (!this.cfg.features?.companyCrises) return [];
    const fired = [];
    for (const c of COMPANY_CRISES) {
      const t = this.team(c.region);
      if (t && this._maybeQueueCrisis(t, c)) fired.push(c.id);
    }
    return fired;
  }

  // Prestationshändelser: byggnadsbaserade (för det lag som just byggde) + rikedomsbaserad (Uppror,
  // globalt). Direkt vid bygge. Varje en gång/spel.
  _checkCompanyAchievements(teamId, card) {
    if (!this.cfg.features?.companyEvents) return;
    const t = this.team(teamId);
    const fired = id => this.S.firedCompanyEvents.includes(id);

    // GRÖNA FONDEN: 3 gröna byggnader totalt.
    if (!fired('gronafonden') && t.gronBuilt >= 3) this._queuePrestation('gronafonden', t.id);

    // EXPANSION: tredje bygget samma år (_builtThisYear nollas vid endRound).
    if (!fired('expansion') && t._builtThisYear >= 3) this._queuePrestation('expansion', t.id);

    // GRÖN OMSTÄLLNING / FRAMTIDSVISIONÄR: utlöses när en grön-svit (≥2 i rad) fullbordas med denna
    // gröna byggnad. Framtidsvisionär prioriteras; Grön omställning förbrukas då INTE utan kan utlösas
    // vid ett senare kvalificerande grönt bygge → ingen dubbelbelöning av exakt samma par.
    if (card.oh > 0 && t._gronStreak >= 2) {
      if (!fired('framtidsvisionar') && this._liggerSist(t)) this._queuePrestation('framtidsvisionar', t.id);
      else if (!fired('gronomstallning') && t.dirtyBuilt >= 2) this._queuePrestation('gronomstallning', t.id);
    }

    // GEMENSAM SATSNING: alla fyra lag har byggt ≥1 grön byggnad detta år → alla får +5 huvudresurs.
    if (!fired('gemensamsatsning') && this.S.teams.every(x => x._gronThisYear >= 1)) this._queueGemensam('gemensamsatsning');

    this._checkUppror();
  }
  // UPPROR: rikaste lagets kapital ≥ näst rikaste + margin. ⚠ margin är PRELIMINÄR (company-events.js).
  _checkUppror() {
    if (!this.cfg.features?.companyEvents) return;
    if (this.S.firedCompanyEvents.includes('uppror')) return;
    const kap = x => x.pengar + x.material;
    const sorted = [...this.S.teams].sort((a, b) => kap(b) - kap(a));
    const margin = companyEventById('uppror').trigger.margin;
    if (sorted.length < 2 || kap(sorted[0]) - kap(sorted[1]) < margin) return;
    this._queuePrestation('uppror', sorted[0].id);
  }
  // Delad sistaplats räknas: lagets kapital ≤ alla andras.
  _liggerSist(t) {
    const kap = x => x.pengar + x.material;
    return this.S.teams.every(o => kap(t) <= kap(o));
  }
  // Köa en prestationshändelse: reward → dPengar/dMaterial (huvudresurs = lagets sektor).
  _queuePrestation(id, teamId) {
    const def = companyEventById(id);
    const t = this.team(teamId);
    let dP = def.reward.pengar || 0, dM = def.reward.material || 0;
    if (def.reward.huvudresurs != null) {
      if (t.sektor === 'pengar') dP += def.reward.huvudresurs; else dM += def.reward.huvudresurs;
    }
    this._queueCompanyEvent({ id, namn: def.namn, text: def.text, teamId, warn: def.warn,
      dPengar: dP, dMaterial: dM, ohalsa: def.ohalsa || 0 });
  }
  // Köa en GEMENSAM händelse som träffar alla fyra lag (+5 huvudresurs var).
  _queueGemensam(id) {
    const def = companyEventById(id);
    const hr = def.reward.huvudresurs || 0;
    const teams = this.S.teams.map(t => t.sektor === 'pengar'
      ? { teamId: t.id, dPengar: hr, dMaterial: 0 }
      : { teamId: t.id, dPengar: 0, dMaterial: hr });
    this._queueCompanyEvent({ id, namn: def.namn, text: def.text, warn: def.warn, teams, ohalsa: def.ohalsa || 0 });
  }

  // ═══════════════ Öhälsohändelser (kategori 'ohalsa') ═══════════════
  // Trösklar (Naturen blomstrar ≥70, Värmebölja ≤35, Storm ≤27) + långvarig Resursbrist (≤30, Skola).
  // Delar kö + paus med företagshändelserna. Miljölyft (årets netto) kollas separat vid bokslut.
  // Köas via samma mekanism → KRIS behåller företräde (öhälsohändelser köas EFTER _krisGrind).
  // FÖRDRÖJT LÄGE (ohalsaDelayed): kvalificera öhälsohändelser vid bokslut → lägg som VÄNTANDE för nästa år.
  // RESURSBRIST undantas (ALLTID omedelbar — pågående produktionskoppling; får ej skjutas upp/få fördröjd
  // återhämtning). Miljölyft = årets netto ≥15; övriga troskel-händelser = öns tröskel vid bokslut.
  _qualifyPendingOhalsa() {
    if (!this.cfg.features?.ohalsaEvents) return;
    for (const def of OHALSA_EVENTS) if (def.trigger.typ === 'resursbrist') this._updateResursbrist(def);   // omedelbar, oförändrad
    this._pendIf('miljolyft', (this.S.oh - this.S.ohAtYearStart) >= 15);
    for (const def of OHALSA_EVENTS) {
      if (def.trigger.typ !== 'troskel') continue;
      if (def.complex && !this.cfg.features?.complexEvents) continue;
      const hit = def.trigger.riktning === 'upp' ? this.S.oh >= def.trigger.niva : this.S.oh <= def.trigger.niva;
      this._pendIf(def.id, hit);
    }
  }
  _pendIf(id, cond) {
    if (!cond) return;
    if (this.S.firedCompanyEvents.includes(id)) return;   // en gång/parti (redan visad)
    if (this.S.pendingOhalsa.includes(id)) return;         // redan väntande (ingen dubblett)
    this.S.pendingOhalsa.push(id);
  }
  // Avfyra NÄSTA väntande öhälsohändelse (servern kallar ~var 30:e aktiva byggsekund; simulatorn modellerar
  // samma). Effekten tillämpas HÄR (inte vid bokslutet) → ingen retroaktiv/dubbel effekt. Köar bakom en ev.
  // redan visad händelse-popup (hoppar över om en visas just nu → servern försöker igen nästa tick).
  fireNextPendingOhalsa() {
    if (!this.S || this.S.over) return { ok: false, reason: 'inget aktivt parti' };
    if (this.S.activeCompanyEvent) return { ok: false, reason: 'en händelse visas redan' };
    if (!this.S.pendingOhalsa.length) return { ok: false, reason: 'inga väntande' };
    const id = this.S.pendingOhalsa.shift();
    if (this.S.firedCompanyEvents.includes(id)) return { ok: true, id, skipped: true };   // säkerhet mot dubbel
    const def = ohalsaEventById(id);
    if (def) this._queueOhalsa(def);
    return { ok: true, id };
  }
  _checkOhalsaThresholds() {
    if (!this.cfg.features?.ohalsaEvents) return;
    const oh = this.S.oh;
    for (const def of OHALSA_EVENTS) {
      if (def.trigger.typ === 'resursbrist') { this._updateResursbrist(def); continue; }
      if (def.trigger.typ !== 'troskel') continue;                 // miljolyft → _checkMiljolyft (bokslut)
      if (def.complex && !this.cfg.features?.complexEvents) continue;   // complex endast i Skola
      if (this.S.firedCompanyEvents.includes(def.id)) continue;         // max en gång/spel
      const hit = def.trigger.riktning === 'upp' ? oh >= def.trigger.niva : oh <= def.trigger.niva;
      if (hit) this._queueOhalsa(def);
    }
  }
  // MILJÖLYFT: öhälsans NETTO under byggåret ≥ 15 (bokslut-oh − årets utgångsläge). En gång/spel.
  _checkMiljolyft() {
    if (!this.cfg.features?.ohalsaEvents) return;
    if (this.S.firedCompanyEvents.includes('miljolyft')) return;
    if ((this.S.oh - this.S.ohAtYearStart) >= 15) this._queueOhalsa(ohalsaEventById('miljolyft'));
  }
  // RESURSBRIST (Skola): långvarigt tillstånd. Aktiveras ≤pa, upphör ≥av (hysteres). Visas en gång/spel.
  _updateResursbrist(def) {
    if (!this.cfg.features?.complexEvents) return;
    const oh = this.S.oh;
    if (!this.S.resursbristAktiv && oh <= def.trigger.pa) {
      this.S.resursbristAktiv = true;
      if (!this.S.firedCompanyEvents.includes(def.id)) this._queueOhalsa(def);   // visningen en gång/spel
    } else if (this.S.resursbristAktiv && oh >= def.trigger.av) {
      this.S.resursbristAktiv = false;
    }
  }
  // Köa en öhälsohändelse. reward.huvudresurs → +/− per lag (sektor); tomt reward → inga resurs-rader.
  _queueOhalsa(def) {
    const hr = def.reward && def.reward.huvudresurs != null ? def.reward.huvudresurs : 0;
    const teams = hr === 0 ? [] : this.S.teams.map(t => t.sektor === 'pengar'
      ? { teamId: t.id, dPengar: hr, dMaterial: 0 }
      : { teamId: t.id, dPengar: 0, dMaterial: hr });
    this._queueCompanyEvent({ id: def.id, namn: def.namn, text: def.text, warn: def.warn, teams, ohalsa: def.ohalsa || 0 });
  }

  // ═══════════════ Direkta GM-händelser (kategori 'gm') ═══════════════
  // ACTION (GM): verkställ en av de fyra direkta GM-händelserna. Ingen omröstning — effekten går direkt
  // via companyEvent-kön (paus + 10 s + UI återanvänds). Max en gång/spel (firedCompanyEvents).
  fireGmEvent(id) {
    if (!this.S || this.S.over) return { ok: false, reason: 'inget aktivt parti' };
    const def = gmEventById(id);
    if (!def) return { ok: false, reason: 'okänd GM-händelse' };
    if (this.S.firedCompanyEvents.includes(id)) return { ok: false, reason: 'redan använd denna spelomgång' };
    const teams = this._gmEventTeams(def);
    this._queueCompanyEvent({ id, namn: def.namn, text: def.text, warn: def.warn, teams, ohalsa: 0 });
    return { ok: true };
  }
  // Beräkna påverkade lag + resursdeltan för en GM-händelse. Mottagaren bestäms av AKTUELLT läge.
  _gmEventTeams(def) {
    const e = def.effekt;
    const mk = t => ({ teamId: t.id, dPengar: e.pengar || 0, dMaterial: e.material || 0 });
    if (e.typ === 'alla') return this.S.teams.map(mk);
    if (e.typ === 'lag')  return this.S.teams.filter(t => e.lag.includes(t.id)).map(mk);
    if (e.typ === 'fattigast') {
      const order = AREAS.map(a => a.id);
      const poor = [...this.S.teams].sort((a, b) =>
        ((a.pengar + a.material) - (b.pengar + b.material)) ||      // minst sammanlagda resurser
        (order.indexOf(a.id) - order.indexOf(b.id)))[0];           // tie-break: AREAS-ordning (deterministiskt)
      return [mk(poor)];
    }
    return [];
  }

  // ACTION (GM): aktivera ett BEFINTLIGT dilemma eller en ja/nej-omröstning (sponsrat) ur de banker
  // Flash Ö-råd redan använder. Återanvänder openOradDecision (A/B resp. rost). Max en gång/spel via
  // gmDecisionsUsed (SKILD lista → påverkar INTE Flash urvalslogik). id ur _decisionPool().
  gmOpenDecision(choice) {
    if (!this.S || this.S.over) return { ok: false, reason: 'inget aktivt parti' };
    if (!choice || !choice.id) return { ok: false, reason: 'inget val' };
    if (this.S.gmDecisionsUsed.includes(choice.id)) return { ok: false, reason: 'redan använd denna spelomgång' };
    const cur = this.S.proposal;
    if (cur && !cur.resolved) return { ok: false, reason: 'ett beslut i taget' };
    const kind = choice.kind || (this._decisionPool().find(p => p.id === choice.id)?._kind) || 'dilemma';
    const res = this.openOradDecision({ id: choice.id, kind });
    if (res && res.ok) this.S.gmDecisionsUsed.push(choice.id);
    return res;
  }
  // Välj (utan att öppna) ett ej-använt beslut ur de befintliga bankerna. Servern använder detta för
  // att slumpa och sedan sätta upp sitt röst-/pausflöde. SLUMPEN SKER BARA på GM:s aktiva handling.
  gmPickRandomDecision(rng = Math.random) {
    const pool = this._decisionPool().filter(p => !this.S.gmDecisionsUsed.includes(p.id));
    if (!pool.length) return null;
    const pick = pool[Math.floor(rng() * pool.length)];
    return { id: pick.id, kind: pick._kind };
  }
  // GM slumpar fram ETT beslut OCH öppnar det (test/enkel väg). Ingen autonom slump — bara på GM-handling.
  gmRandomDecision(rng = Math.random) {
    const pick = this.gmPickRandomDecision(rng);
    if (!pick) return { ok: false, reason: 'alla beslut redan använda' };
    return this.gmOpenDecision(pick);
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
