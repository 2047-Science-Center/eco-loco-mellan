// spec/config/variants/flash.js — VERSIONSKONFIGURATION: Flash (5-minutersvarianten). Etapp 3a, 2026-11-16.
// Jämbördig variant ovanpå SAMMA motor (spec/engine.js) — ingen version är inbyggd standard.
// Skickas som `new EcoLoco(flashConfig)`. Motorn läser rounds/timerSec/decisionSystem/dilemma direkt;
// phases/features/modules/content är FRAMÅTBLICKANDE data som UI/bot/server läser i Etapp 3b.
//
// PRELIMINÄRA värden (⚠ = behöver avstämning, se nedan). Ändra inte befintliga balansvärden —
// de ligger kvar i motorns DEFAULT_CONFIG (delad, versionsneutral baslinje).

export default {
  id: 'flash',
  namn: 'Flash',

  // ── Spelstruktur ──
  rounds: 4,                 // ~4 år
  timerSec: 60,              // bygg-/rundtimer (motorn läser). Beslut 2026-11-19: 60 s bygge (var 90).
  earlyRounds: 0,            // inga längre inlärningsrundor i Flash
  maxBuildsPerYear: 1,       // FLASH-REGEL (beslut 2026-11-18): max ETT bygge/lag/år. Mellan/Skola: obegränsat
                             // (null i DEFAULT_CONFIG). Kontrolleras i motorns selectCard → gäller UI/server/bot/sim.
  // FÖRDRÖJDA ÖHÄLSOHÄNDELSER: kortare intervall än default (30 s) pga kort byggfas (90 s). Med 20 s får
  // Flash 4 visnings-slots/byggfas (mot 2 vid 30 s) → marginal även om 3 öhälsohändelser kvalificerar
  // samma bokslut. Verifierat (tools/fordrojd-sim.js flash): 0 väntande hinner aldrig visas. Presentations-
  // tidsvärde, ingen balansändring. Se design/MELLAN-FORDROJDA-HANDELSER.md §7.
  ohalsaDelaySeconds: 10,   // Flash: naturkatastrofer visas 10 s (aktiv byggtid) in i nästa år (Klara 2026-11-23; var 20 — hann sällan visas i snabba Flash).
  // Fas-längder i sek. Beslut 2026-11-19: bygge 60 s, dilemma-röst 30 s (politik → vote i dilemma-läge).
  phases: { bygga: 60, prisutdelning: 20, politik: 30 },

  // ── Beslutssystem: Ö-rådet kör DILEMMAN (inte politik) ──
  // POOL (beslut 2026-11-19): EXAKT 8 aktiva beslut. Motorn (_decisionPool) filtrerar den gemensamma
  // dilemma-/rost-banken mot denna id-lista → koncernerbjudande är UTE (överlappade sponsrat), de fyra
  // nya Flash-only-dilemman + sponsrat är INNE. Ett auto-draget beslut/år; urvalshistorik per parti
  // (S.usedDecisions) ger fyra olika beslut när nog finns. INGA kategorier/kvoter i Flash.
  decisionSystem: 'dilemma',
  dilemma: {
    perRound: 1,
    pool: ['algblomning', 'oljefynd', 'urskog', 'markkonflikt', 'sponsrat',
           'naturreservat_flash', 'leveransstopp_flash', 'bra_skord_flash'],
  },
  // RÖSTREGLER för A/B-dilemman (beslut 2026-11-19, ENBART Flash): uteblivna röster räknas inte (servern
  // fyller ingen default-A), och oavgjort (A===B, inkl 0–0) → INGET BESLUT (inga effekter), resultatpopup
  // "INGET BESLUT FATTADES". Motorn (_resolveDilemma) + servern (forceDilemmaVotes) läser flaggan.
  // Mellan/Skola saknar flaggan → oförändrat (oavgjort → A, utebliven → A). Sponsrat (rost) opåverkat.
  dilemmaStrict: true,

  // ── Valfria mekaniker / toggles (3b) ──
  // FLASH-BESLUT (Klara 2026-11-19): Flash använder ENDAST öhälsohändelser som "kriser" (NATUREN BLOMSTRAR/
  // MILJÖLYFT/VÄRMEBÖLJA/STORM, styrda av öns hälsa). INGA företagsspecifika miljökriser (companyCrises:
  // VATTENBRIST/TORKA m.fl.), INGA prestations-/företagshändelser (companyEvents: GRÖNA FONDEN/EXPANSION/
  // UPPROR m.fl.) och INGA GM-händelser (gm-events; GM aktiveras aldrig i Flash-selfplay). Håll därför
  // companyCrises/companyEvents BORTA ur features och 'foretag'/'gm' borta ur content.events.triggers.
  // (KRIS-mekaniken vid öhälsa ≤20 är en separat motorsak, inte en "händelse", och är opåverkad.)
  features: { trade: true, ohalsaEvents: true },  // handel + ENBART öhälsohändelser
  modules: [],

  // ── Innehållsbanker som används (deklarativt; urval/utlösare kopplas i 3b) ──
  content: {
    buildings: 'all',
    events: { triggers: ['ohalsa'] },   // BARA öhälsostyrda händelser — aldrig 'foretag' eller 'gm'
    proposals: false,                   // Flash använder INTE politikbanken
    dilemmas: 'oracle',                 // dilemman auto under Ö-rådet (beslutsmekanik, ej GM-händelser)
  },

  // ── Onboarding-standard ──
  mode: 'selfplay',          // självstart, ingen spelledare

  // ⚠ ATT STÄMMA AV: exakt fas-tider, om tutorial ersätts av pop-ups, dilemma-urvalsregler,
  //   vilka händelser Flash ska ha, avslutets form. Se design/FLERVERSION-ARKITEKTUR.md §Öppna frågor.
};
