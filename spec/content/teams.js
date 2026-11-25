// spec/content/teams.js — LAGBANK (innehåll, ingen logik).
// Flyttad ur spec/engine.js (den hårdkodade AREAS-listan) 2026-11-25, migrerings-Etapp 2.
// EXAKT samma värden som tidigare — motorns beteende är oförändrat (motorn re-exporterar som AREAS).
//
// Ett område = ett lag. Områdesfärg = lagfärg. sektor styr valuta-beroendet.
//
// Fält:
//   id      internt områdes-/lag-ID (används i MQTT/rigg/assets — ÄNDRA ALDRIG).
//   namn    lagets visningsnamn (djuret).
//   farg    lagfärg (= områdesfärg på kartan).
//   sektor  'material' | 'pengar' — vilken huvudresurs laget producerar/är beroende av (balans-nära;
//           ändra inte utan avstämning, invariant 1).

export const TEAMS = [
  { id: 'aker',   namn: 'Oxen',    farg: '#E7C24C', sektor: 'material' },
  { id: 'skog',   namn: 'Björnen', farg: '#3F8F4A', sektor: 'material' },
  { id: 'tundra', namn: 'Räven',   farg: '#D98A3C', sektor: 'pengar'   },
  { id: 'stad',   namn: 'Örnen',   farg: '#8A8F96', sektor: 'pengar'   },
];
