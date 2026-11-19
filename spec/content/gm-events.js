// spec/content/gm-events.js — DIREKTA GM-HÄNDELSER (innehåll, ingen logik).
// Kategori 'gm': aktiveras ENDAST manuellt av spelledaren. Utlöses aldrig av ekonomi, öhälsa eller
// slump. Verkställs DIREKT (ingen omröstning) via companyEvent-kön (paus + 10 s + UI återanvänds).
// Varje händelse högst en gång per spel (firedCompanyEvents). Resurser kan aldrig bli negativa.
//
// GM kan dessutom aktivera BEFINTLIGA dilemman (A/B) + ja/nej-omröstningar (sponsrat) — de ligger kvar
// i DILEMMAS/EVENTS och öppnas via openOradDecision; INGEN ny bank skapas för dem.
//
// Fält:
//   id        stabilt id (gm_-prefix → krockar inte med gamla EVENTS 'marknadskrasch').
//   namn/text presentation. warn: true = negativ (röd), false = positiv.
//   effekt    { typ, ... } som motorn (_gmEventTeams) tolkar till en teams-lista:
//               typ:'alla'       → alla fyra lag (pengar/material).
//               typ:'lag'        → bara lag i `lag`-listan (pengar/material).
//               typ:'fattigast'  → laget med minst (pengar+material); tie-break = AREAS-ordning.

export const GM_EVENTS = [
  { id: 'gm_marknadskrasch', namn: 'MARKNADSKRASCH', text: 'Börsen rasar! Tundran och Staden förlorar pengar!',                      warn: true,  effekt: { typ: 'lag', lag: ['tundra', 'stad'], pengar: -10 } },
  { id: 'gm_leveransstopp',  namn: 'LEVERANSSTOPP',  text: 'Leveranserna har fastnat! Hela ön får materialbrist!',                   warn: true,  effekt: { typ: 'alla', material: -5 } },
  { id: 'gm_braskord',       namn: 'BRA SKÖRD',      text: 'Oxens skördar slår alla rekord! De delar generöst med sig till hela ön!', warn: false, effekt: { typ: 'alla', material: 8 } },
  { id: 'gm_ekonomisktstod', namn: 'EKONOMISKT STÖD', text: 'Centralmakten ger ekonomiskt stöd till öns mest utsatta företag!',       warn: false, effekt: { typ: 'fattigast', pengar: 10, material: 10 } },
];

export const GM_EVENT_IDS = GM_EVENTS.map(e => e.id);
export const gmEventById = id => GM_EVENTS.find(e => e.id === id) || null;
