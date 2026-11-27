// spec/config/variants/mellan.js — VERSIONSKONFIGURATION: Mellan (~15–25 min). Etapp 3a, 2026-11-16.
// Jämbördig variant ovanpå SAMMA motor — Mellan är INTE motorns inbyggda standard längre, utan en
// explicit config som Flash/Skola. Skickas som `new EcoLoco(mellanConfig)`.
//
// OBS: den här configen beskriver MÅL-Mellan (nytt generellt urval, alla förslag jämbördiga). Den är
// INTE kopplad till live-servern än — live-Mellan kör fortfarande legacy (grund-3 + extra) tills vi
// aktiverar i Etapp 3b. Inga balansvärden ändrade (de ligger i motorns DEFAULT_CONFIG).

export default {
  id: 'mellan',
  namn: 'Mellan',

  // ── Spelstruktur ──
  rounds: 8,                 // ~8 år
  // ⚠ SKILLNAD MOT STANDARD/LEGACY: dagens live-Mellan (Standard) har byggtimer 120 s. Schemat/
  // configen anger 100 s. Servern använder nu phases.bygga för varianter → Mellan-VARIANTEN spelar
  // 100 s (Standard/legacy fortsatt 120 s, orört). Bekräfta om 100 är rätt för Mellan-varianten.
  timerSec: 100,             // = phases.bygga (intern konsekvens; motorns timerSecFor i lokalt läge)
  earlyRounds: 0,            // varianten har uniform byggtimer (phases.bygga) → ingen inlärnings-skillnad
  phases: { bygga: 100, prisutdelning: 30, politik: 60 },   // ⚠ preliminära (ur schemat)

  // ── Beslutssystem: Ö-rådet kör POLITIK (förslag + ja/nej) ──
  // FAST KATEGORIFÖRDELNING (beslut 2026-11-19): ordföranden får 5 förslag, slumpade inom varje
  // kategori. Summan av kvoterna = proposalCount (5) → ingen slumpfyllnad behövs. Urvalet sköts av
  // spec/systems/proposal-selector.js (kvoter per `category`, utan dubbletter). eligibility gäller
  // fortfarande: krispaket (cooperation) faller bort vid öhälsa ≥ 20 → cooperation fylls då ur de
  // övriga fyra samarbetsförslagen (gron/marknadsavtal/gronstod/allians). Alla kategorier har alltid
  // nog med giltiga förslag (future 2, sector 4, polluter 4, cooperation 4–5) → aldrig varningar.
  decisionSystem: 'politics',
  politics: {
    proposalCount: 5,                 // 5 förslag att välja på
    selection: {
      quotas: { future: 1, sector: 1, cooperation: 2, polluter: 1 },   // = 5
      fillRemaining: 'random',        // ingen effekt (kvoterna fyller alla 5 platser)
      // tags: [...]                   // INGET taggfilter — urvalet styrs enbart av category-kvoterna
    },
  },

  // ── Valfria mekaniker / toggles (3b) ──
  kroning: true,             // sista årets öråd avgör → kröningsceremonin (spec/kroning.js)
  features: { trade: true, companyCrises: true, companyEvents: true, ohalsaEvents: true },
  modules: [],

  // ── Innehållsbanker som används (deklarativt) ──
  content: {
    buildings: 'all',
    events: { triggers: ['foretag', 'ohalsa', 'gm'] },   // foretag + ohalsa auto; gm manuellt
    proposals: 'all',
    dilemmas: 'gm',                   // dilemman återanvänds som spelledarstyrda händelser
  },

  // ── Onboarding-standard ──
  mode: 'tutorial',          // dagens Mellan-standard

  // ⚠ ATT STÄMMA AV: kategorikvoter för politikurvalet, exakt fas-tider, vilka händelse-triggers
  //   som faktiskt ska gälla. Se design/FLERVERSION-ARKITEKTUR.md.
};
