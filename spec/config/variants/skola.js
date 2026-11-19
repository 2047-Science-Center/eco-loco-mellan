// spec/config/variants/skola.js — VERSIONSKONFIGURATION: Skola (~45 min). Etapp 3a, 2026-11-16.
// Jämbördig variant ovanpå SAMMA motor. Förbereder avancerade mekaniker men implementerar dem INTE
// (modules deklareras men motorn kör dem inte än). Skickas som `new EcoLoco(skolaConfig)`.
// Inga balansvärden ändrade (de ligger i motorns DEFAULT_CONFIG).

export default {
  id: 'skola',
  namn: 'Skola',

  // ── Spelstruktur ──
  rounds: 10,                // ~10 år ⚠ exakt antal ej fastställt
  timerSec: 180,             // ⚠ preliminär, längre byggfas för strategi
  earlyRounds: 0,
  phases: { bygga: 180, prisutdelning: 30, politik: 60 },   // ⚠ preliminära

  // ── Beslutssystem: Ö-rådet kör POLITIK ──
  // Beslut 2026-11-19: Skola delar den GEMENSAMMA politikbanken (spec/content/proposals.js, 15 förslag)
  // med Mellan, men behåller tills vidare HELT SLUMPMÄSSIGT urval (inga kategorikvoter). När vi senare
  // bygger investeringar + fler byggnader får Skola en egen 'investment'-kategori och egen fördelning.
  decisionSystem: 'politics',
  politics: {
    proposalCount: 5,                 // ⚠ preliminärt
    selection: {
      quotas: {},                     // tomt = rent slumpurval ur hela den giltiga banken (oförändrat beteende)
      fillRemaining: 'random',
    },
  },

  // ── Valfria mekaniker / toggles ──
  features: { trade: true, companyCrises: true, companyEvents: true, ohalsaEvents: true, complexEvents: true },
  // ⚠ DEKLARERADE men EJ IMPLEMENTERADE (Etapp D/framtid): staplade/beroende byggnader, driftkostnad,
  //   produktionsstopp, långsiktiga effekter, investeringar. Motorn ignorerar okända modules tills vidare.
  modules: ['upgrades', 'dependencies', 'production-effects'],

  // ── Innehållsbanker som används (deklarativt) ──
  content: {
    buildings: 'all',
    events: { triggers: ['foretag', 'ohalsa', 'gm'], complex: true },   // complex (Resursbrist) = features.complexEvents
    proposals: 'all',
    dilemmas: 'gm',
  },

  // ── Onboarding-standard ──
  mode: 'tutorial',

  // ⚠ ATT STÄMMA AV: rundantal, fas-tider, politikurvalets kvoter, vilka avancerade mekaniker som
  //   faktiskt ska byggas och hur slutanalysen ser ut. Se design/FLERVERSION-ARKITEKTUR.md.
};
