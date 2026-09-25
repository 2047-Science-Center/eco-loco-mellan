// logos.js — Eco Loco (Mellan): de fyra företagsloggorna, omfärgade till områdesfärgerna.
// Områdesfärgen ÄR lagfärgen (spec): åker=gul, skog=grön, tundra=orange, stad=grå.
// Djuren från originalet (Eagle/Bison/Wolf/Bear) — mappning mot område (stäm av med Josef):
//   Åkermark=Bison (betesmark), Skog=Björn, Tundra=Varg, Stad=Örn.
// Stil: fasetterade silhuetter i mörk rund badge, i samma anda som originalets emblem.

export const TEAM_LOGOS = {
  aker:   { djur: 'Bison', farg: '#E7C24C', ljus: '#F2DA8A', mork: '#B08F2B' },
  skog:   { djur: 'Björn', farg: '#3F8F4A', ljus: '#7FBF87', mork: '#28632F' },
  tundra: { djur: 'Varg',  farg: '#D98A3C', ljus: '#EDB47C', mork: '#A5601F' },
  stad:   { djur: 'Örn',   farg: '#A9AEB5', ljus: '#D3D7DC', mork: '#70767E' },
};

// Fasetterade huvud-silhuetter i profil (100×100-box). Två toner per djur för djup.
const SHAPES = {
  // Bison: stor puckel bak, brant panna, ljust horn, hängande skägg.
  aker: (c) => `
    <polygon fill="${c.farg}" points="12,66 16,42 30,24 48,26 58,24 68,32 74,44 72,56 64,60 62,74 52,70 48,60 36,62 24,64"/>
    <polygon fill="${c.ljus}" points="16,42 30,24 48,26 34,42"/>
    <polygon fill="${c.ljus}" points="58,28 66,18 74,24 66,34"/>
    <polygon fill="${c.mork}" points="64,60 62,74 52,70 54,58"/>
    <polygon fill="${c.mork}" points="12,66 24,64 36,62 26,52 16,52"/>
    <polygon fill="#1E1E1A" points="60,40 66,38 65,44 60,44"/>
    <polygon fill="#1E1E1A" points="72,48 76,50 72,54"/>`,
  // Björn: öronbula, sluttande panna, trubbig nos, käftlinje.
  skog: (c) => `
    <polygon fill="${c.farg}" points="18,60 24,36 30,24 40,30 52,22 66,26 80,40 84,50 74,52 72,60 58,66 40,66 26,64"/>
    <polygon fill="${c.ljus}" points="24,36 30,24 40,30 34,40"/>
    <polygon fill="${c.mork}" points="72,60 58,66 40,66 54,54"/>
    <polygon fill="${c.mork}" points="80,40 84,50 74,52 74,42"/>
    <polygon fill="#1E1E1A" points="58,38 64,36 63,42 58,42"/>
    <polygon fill="#1E1E1A" points="80,44 86,46 82,50"/>`,
  // Varg: spetsiga öron, lång nos, vass käft.
  tundra: (c) => `
    <polygon fill="${c.farg}" points="24,44 30,20 40,36 50,16 56,34 70,40 90,54 82,60 64,58 56,70 40,68 28,58"/>
    <polygon fill="${c.mork}" points="30,20 40,36 32,40"/>
    <polygon fill="${c.mork}" points="56,70 40,68 50,58"/>
    <polygon fill="${c.ljus}" points="70,40 90,54 82,60 68,50"/>
    <polygon fill="#1E1E1A" points="52,42 58,40 57,46 52,46"/>`,
  // Örn: markerad krokig näbb med hak, ögonbrynskant, fjäderlager i nacken.
  stad: (c) => `
    <polygon fill="${c.farg}" points="22,70 26,44 36,28 54,20 70,22 80,30 88,40 92,48 80,50 84,58 72,54 70,64 56,72 38,76"/>
    <polygon fill="${c.ljus}" points="80,30 88,40 92,48 80,50 76,38"/>
    <polygon fill="${c.ljus}" points="36,28 54,20 70,22 52,32"/>
    <polygon fill="${c.mork}" points="70,64 56,72 38,76 54,60"/>
    <polygon fill="${c.mork}" points="22,70 38,76 34,60"/>
    <polygon fill="#1E1E1A" points="62,32 70,30 69,37 62,37"/>`,
};

// Returnerar en komplett SVG-badge (sträng) för ett område.
export function logoSVG(areaId, size = 96) {
  const c = TEAM_LOGOS[areaId];
  if (!c) return '';
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.djur}">
    <circle cx="50" cy="50" r="48" fill="#26251F"/>
    <circle cx="50" cy="50" r="48" fill="none" stroke="${c.farg}" stroke-width="4"/>
    <circle cx="50" cy="50" r="41" fill="none" stroke="${c.mork}" stroke-width="1.5" opacity="0.7"/>
    ${SHAPES[areaId](c)}
  </svg>`;
}
