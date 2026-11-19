// spec/content/company-crises.js — FÖRETAGSKRISER (innehåll, ingen logik).
// Åtta kriser — två per företag — utlöses av ackumulerad negativ miljöpåverkan (impactNeg).
// Triggas under byggfasen, inte vid bokslut. Bara i Mellan och Skola (cfg.features.companyCrises).
//
// grad      'minor' | 'major' — allvarsgrad. TRÖSKEL (ackumulerad impactNeg) och ÅRSKRAV (tidigast spelår)
//           är INTE längre hårdkodade här utan styrs per grad av motorns config (DEFAULT_CONFIG.
//           companyCrisisThreshold / companyCrisisMinRound) så gamla/nya regler kan köras i samma motor.
//           NYA default: minor ≥15 från år 2, major ≥25 från år 4. resource/loss/ohalsa är OFÖRÄNDRADE.

export const COMPANY_CRISES = [
  // ── Oxen (aker) — material-sektor ──
  { id: 'aker_minor', region: 'aker', grad: 'minor', namn: 'VATTENBRIST', text: 'Åkrarna får för lite vatten!',      resource: 'material', loss: 10, ohalsa: -4 },
  { id: 'aker_major', region: 'aker', grad: 'major', namn: 'TORKA',       text: 'Skördarna torkar bort!',            resource: 'material', loss: 20, ohalsa: -8 },

  // ── Björnen (skog) — material-sektor ──
  { id: 'skog_minor', region: 'skog', grad: 'minor', namn: 'SKADEDJUR',   text: 'Träden angrips av insekter!',       resource: 'material', loss: 10, ohalsa: -4 },
  { id: 'skog_major', region: 'skog', grad: 'major', namn: 'SKOGSBRAND',  text: 'Skogen står i lågor!',              resource: 'material', loss: 20, ohalsa: -8 },

  // ── Räven (tundra) — pengar-sektor ──
  { id: 'tundra_minor', region: 'tundra', grad: 'minor', namn: 'OLJEUTSLÄPP',  text: 'Olja läcker ut på tundran!',   resource: 'pengar', loss: 10, ohalsa: -4 },
  { id: 'tundra_major', region: 'tundra', grad: 'major', namn: 'MARKEN RASAR', text: 'Marken ger vika under oljefälten!', resource: 'pengar', loss: 20, ohalsa: -8 },

  // ── Örnen (stad) — pengar-sektor ──
  { id: 'stad_minor', region: 'stad', grad: 'minor', namn: 'ÖVERBELASTNING', text: 'Staden växer för snabbt!',        resource: 'pengar', loss: 10, ohalsa: -4 },
  { id: 'stad_major', region: 'stad', grad: 'major', namn: 'STRÖMAVBROTT',   text: 'Hela staden slocknar!',           resource: 'pengar', loss: 20, ohalsa: -8 },
];

export function crisesForRegion(regionId) {
  return COMPANY_CRISES.filter(c => c.region === regionId);
}
