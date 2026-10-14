// icons.js — Eco Loco (Mellan): spelets egna fasett-ikoner (variant A, frontend-design).
// Samma anda som logos.js: fasetterade polygon-silhuetter, tre toner per färg
// (ljus/bas/mörk) + #1E1E1A-accent. Ersätter de generiska emoji i UI-chromet.
//
// API:  ico(id, size=24, { badge, cls, title })  → SVG-sträng (inline-block, vertikalt centrerad)
//         badge: true → standardfärgad rund badge (som loggorna); en färgsträng → den färgen; utelämnat → ingen badge
//       moodIco(mode, size) → öläges-ansikte för 'superdaligt'|'daligt'|'neutralt'|'bra'|'mycketbra'
//       curIco(cur, size)   → 'pengar' | 'material'

const DARK = '#1E1E1A';

const INNER = {
  // ---------- VALUTOR ----------
  pengar: `
    <polygon points="50,10 78,22 90,50 78,78 50,90 22,78 10,50 22,22" fill="#F0B33C"/>
    <polygon points="50,10 78,22 90,50 10,50 22,22" fill="#F7CE78"/>
    <polygon points="90,50 78,78 50,90 50,50" fill="#B5832A"/>
    <polygon points="50,26 70,34 78,50 70,66 50,74 30,66 22,50 30,34" fill="none" stroke="${DARK}" stroke-width="2.4" opacity="0.6"/>
    <polygon points="50,33 60,50 50,67 40,50" fill="#B5832A"/>
    <polygon points="50,33 60,50 50,50 40,50" fill="#F7CE78"/>`,

  material: `
    <polygon points="50,16 84,35 50,54 16,35" fill="#B9D4E0"/>
    <polygon points="16,35 50,54 50,90 16,71" fill="#8FB3C4"/>
    <polygon points="84,35 50,54 50,90 84,71" fill="#5E8699"/>
    <polygon points="16,35 50,54 50,44 24,30" fill="#D4E6EE" opacity="0.55"/>
    <line x1="50" y1="54" x2="50" y2="90" stroke="${DARK}" stroke-width="1.4" opacity="0.4"/>
    <line x1="16" y1="35" x2="50" y2="54" stroke="#3b5663" stroke-width="1.2" opacity="0.5"/>`,

  // ---------- ÖHÄLSA ----------
  tillvaxt: `
    <polygon points="47,90 53,90 51,56 49,56" fill="#2A9E64"/>
    <polygon points="34,52 40,44 50,58" fill="#3DD68C"/>
    <polygon points="24,36 40,44 50,58" fill="#7FE7B5"/>
    <polygon points="24,36 50,58 34,52" fill="#2A9E64"/>
    <polygon points="50,58 60,44 66,52" fill="#3DD68C"/>
    <polygon points="76,36 60,44 50,58" fill="#7FE7B5"/>
    <polygon points="76,36 50,58 66,52" fill="#2A9E64"/>`,

  industri: `
    <polygon points="12,86 12,58 30,58 30,44 48,58 48,44 66,58 66,44 84,58 84,86" fill="#F0564B"/>
    <polygon points="30,44 48,58 30,58" fill="#F58A82"/>
    <polygon points="48,44 66,58 48,58" fill="#F58A82"/>
    <polygon points="66,44 84,58 66,58" fill="#F58A82"/>
    <polygon points="60,58 84,58 84,86 60,86" fill="#B33A32"/>
    <polygon points="16,58 16,30 26,30 26,58" fill="#F0564B"/>
    <polygon points="21,30 26,30 26,58 21,58" fill="#B33A32"/>
    <rect x="20" y="66" width="8" height="10" fill="${DARK}"/>
    <rect x="36" y="66" width="8" height="10" fill="${DARK}"/>
    <rect x="68" y="66" width="8" height="12" fill="${DARK}"/>
    <rect x="48" y="70" width="12" height="16" fill="${DARK}"/>
    <polygon points="19,25 27,19 35,25 28,31" fill="#8A8372"/>
    <polygon points="29,16 38,9 47,16 39,23" fill="#B8AF9A"/>`,

  on: `
    <polygon points="12,66 30,58 50,56 70,58 88,66 70,78 50,80 30,78" fill="#5E8699"/>
    <polygon points="12,66 30,58 50,56 30,66" fill="#8FB3C4"/>
    <polygon points="22,66 40,59 50,57 62,59 78,66 64,72 36,72" fill="#C9A94F"/>
    <polygon points="22,66 40,59 50,57 36,66" fill="#E4CE8C"/>
    <polygon points="50,24 66,59 34,59" fill="#C9A94F"/>
    <polygon points="50,24 34,59 44,51" fill="#E4CE8C"/>
    <polygon points="50,24 66,59 56,51" fill="#937A34"/>
    <polygon points="50,24 58,41 42,41" fill="#7FE7B5"/>`,

  // ---------- HANDLING ----------
  byt: `
    <polygon points="16,32 58,32 58,21 82,40 58,59 58,48 16,48" fill="#F0B33C"/>
    <polygon points="16,32 58,32 58,21 82,40 58,40 16,40" fill="#F7CE78"/>
    <polygon points="58,40 82,40 58,59 58,48" fill="#B5832A"/>
    <polygon points="84,68 42,68 42,79 18,60 42,41 42,52 84,52" fill="#8FB3C4"/>
    <polygon points="84,68 42,68 42,79 18,60 42,60 84,60" fill="#5E8699"/>
    <polygon points="42,60 18,60 42,41 42,52" fill="#B9D4E0"/>`,

  rosta: `
    <polygon points="20,54 50,66 80,54 50,42" fill="#D8D1C2"/>
    <polygon points="42,53 58,53 56,57 44,57" fill="${DARK}"/>
    <polygon points="20,54 50,66 50,92 20,80" fill="#B8AF9A"/>
    <polygon points="80,54 50,66 50,92 80,80" fill="#8A8372"/>
    <polygon points="46,52 64,45 68,23 50,30" fill="#E4CE8C"/>
    <polygon points="64,45 68,23 62,25 58,47" fill="#C9A94F"/>
    <polyline points="52,37 56,43 64,30" fill="none" stroke="#2A9E64" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,

  // ---------- MÄRKNINGAR (badge) ----------
  krona: `
    <polygon points="16,72 22,40 38,60 50,32 62,60 78,40 84,72" fill="#C9A94F"/>
    <polygon points="16,72 22,40 38,60 50,32 50,72" fill="#E4CE8C"/>
    <polygon points="50,32 62,60 78,40 84,72 50,72" fill="#937A34"/>
    <rect x="16" y="71" width="34" height="13" fill="#E4CE8C"/>
    <rect x="50" y="71" width="34" height="13" fill="#937A34"/>
    <polygon points="50,74 55,79 50,84 45,79" fill="#F0564B"/>
    <polygon points="29,74 33,78 29,82 25,78" fill="#8FB3C4"/>
    <polygon points="71,74 75,78 71,82 67,78" fill="#8FB3C4"/>`,

  varning: `
    <polygon points="50,14 88,84 12,84" fill="#F5C518"/>
    <polygon points="50,14 12,84 50,84" fill="#FADD6E"/>
    <polygon points="50,14 88,84 50,84" fill="#BD9608"/>
    <polygon points="50,26 79,78 21,78" fill="none" stroke="${DARK}" stroke-width="2" opacity="0.28"/>
    <polygon points="46,38 54,38 52,64 48,64" fill="${DARK}"/>
    <rect x="46" y="69" width="8" height="8" rx="1" fill="${DARK}"/>`,

  trofe: `
    <path d="M30,30 C15,30 16,54 33,51" fill="none" stroke="#E4CE8C" stroke-width="5"/>
    <path d="M70,30 C85,30 84,54 67,51" fill="none" stroke="#937A34" stroke-width="5"/>
    <polygon points="30,24 70,24 64,48 50,59 36,48" fill="#C9A94F"/>
    <polygon points="30,24 50,24 50,59 36,48" fill="#E4CE8C"/>
    <polygon points="50,24 70,24 64,48 50,59" fill="#937A34"/>
    <polygon points="46,59 54,59 54,69 46,69" fill="#937A34"/>
    <polygon points="33,69 67,69 73,83 27,83" fill="#C9A94F"/>
    <polygon points="33,69 50,69 50,83 27,83" fill="#E4CE8C"/>
    <polygon points="50,30 53,38 61,38 55,43 57,51 50,46 43,51 45,43 39,38 47,38" fill="${DARK}" opacity="0.32"/>`,

  sabotor: `
    <polygon points="26,30 40,20 60,20 74,30 78,48 72,58 62,58 62,67 38,67 38,58 28,58 22,48" fill="#B8AF9A"/>
    <polygon points="26,30 40,20 50,20 50,67 38,67 38,58 28,58 22,48" fill="#D8D1C2"/>
    <polygon points="50,20 60,20 74,30 78,48 72,58 62,58 62,67 50,67" fill="#8A8372"/>
    <polygon points="42,67 58,67 56,77 50,81 44,77" fill="#B8AF9A"/>
    <polygon points="50,67 58,67 56,77 50,81" fill="#8A8372"/>
    <polygon points="30,40 43,37 41,50 31,50" fill="${DARK}"/>
    <polygon points="70,40 57,37 59,50 69,50" fill="${DARK}"/>
    <polygon points="50,50 55,60 45,60" fill="${DARK}"/>
    <rect x="44" y="68" width="2.4" height="10" fill="#8A8372"/>
    <rect x="49" y="68" width="2.4" height="12" fill="#8A8372"/>
    <rect x="54" y="68" width="2.4" height="10" fill="#8A8372"/>`,

  // ---------- REGISTER ----------
  borsen: `
    <rect x="14" y="88" width="72" height="3" fill="#4A443A"/>
    <polygon points="18,62 34,62 34,88 18,88" fill="#B5832A"/>
    <polygon points="18,62 34,62 34,67 18,67" fill="#F7CE78"/>
    <polygon points="42,46 58,46 58,88 42,88" fill="#F0B33C"/>
    <polygon points="42,46 58,46 58,51 42,51" fill="#F7CE78"/>
    <polygon points="54,46 58,46 58,88 54,88" fill="#B5832A"/>
    <polygon points="66,28 82,28 82,88 66,88" fill="#F0B33C"/>
    <polygon points="66,28 82,28 82,33 66,33" fill="#F7CE78"/>
    <polygon points="78,28 82,28 82,88 78,88" fill="#B5832A"/>
    <polyline points="20,58 46,40 74,20" fill="none" stroke="#C9A94F" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="84,15 66,19 78,31" fill="#E4CE8C"/>`,
};

// Fasetterat ansikte i oktagon (för de fem ölägena).
function faceFace(base, ljus, mork, mouth) {
  const oct = '50,14 76,24 86,50 76,76 50,86 24,76 14,50 24,24';
  const m = {
    sick:  `<polyline points="33,66 41,60 50,62 59,60 67,66" fill="none" stroke="${DARK}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><polygon points="64,54 70,54 67,62" fill="#2A9E64"/>`,
    frown: `<path d="M34,66 Q50,56 66,66" fill="none" stroke="${DARK}" stroke-width="3.6" stroke-linecap="round"/>`,
    flat:  `<rect x="36" y="61" width="28" height="3.6" rx="1.8" fill="${DARK}"/>`,
    smile: `<path d="M34,60 Q50,70 66,60" fill="none" stroke="${DARK}" stroke-width="3.6" stroke-linecap="round"/>`,
    grin:  `<path d="M33,58 Q50,76 67,58 Z" fill="${DARK}"/><path d="M38,61 Q50,70 62,61 Z" fill="#F58A82" opacity="0.65"/>`,
  }[mouth];
  return `
    <polygon points="${oct}" fill="${base}"/>
    <polygon points="50,14 76,24 86,50 14,50 24,24" fill="${ljus}"/>
    <polygon points="86,50 76,76 50,86 50,50" fill="${mork}"/>
    <polygon points="34,40 41,43 39,51 32,49" fill="${DARK}"/>
    <polygon points="66,40 59,43 61,51 68,49" fill="${DARK}"/>
    ${m}`;
}

Object.assign(INNER, {
  lage1: faceFace('#F0564B', '#F58A82', '#B33A32', 'sick'),
  lage2: faceFace('#EE7D45', '#F2A070', '#C05A28', 'frown'),
  lage3: faceFace('#F5C518', '#FADD6E', '#BD9608', 'flat'),
  lage4: faceFace('#7FE7B5', '#B4F0D4', '#4FC48E', 'smile'),
  lage5: faceFace('#3DD68C', '#7FE7B5', '#2A9E64', 'grin'),
});

// Standard-badgefärg per märknings-ikon (ringfärg som loggorna).
const BADGE_COLOR = { krona: '#C9A94F', trofe: '#C9A94F', varning: '#F5C518', sabotor: '#F0564B' };

const MOOD_ICON = {
  superdaligt: 'lage1', daligt: 'lage2', neutralt: 'lage3', bra: 'lage4', mycketbra: 'lage5',
};

// Bygger en SVG-sträng. size i px. opts: { badge, cls, title }
export function ico(id, size = 24, opts = {}) {
  if (!INNER[id]) return '';
  let badge = opts.badge;
  if (badge === true) badge = BADGE_COLOR[id] || '#C9A94F';
  let ring = '';
  let body = INNER[id];
  if (badge) {
    ring = `<circle cx="50" cy="50" r="48" fill="#26251F"/>`
         + `<circle cx="50" cy="50" r="48" fill="none" stroke="${badge}" stroke-width="4"/>`
         + `<circle cx="50" cy="50" r="41" fill="none" stroke="#000" stroke-width="1.5" opacity="0.35"/>`;
    body = `<g transform="translate(50,50) scale(0.74) translate(-50,-50)">${body}</g>`;
  }
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const title = opts.title ? `<title>${opts.title}</title>` : '';
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" `
       + `role="img" aria-hidden="true" style="display:inline-block;vertical-align:-0.16em;flex:none">${title}${ring}${body}</svg>`;
}

export function moodIco(mode, size = 24) {
  return ico(MOOD_ICON[mode] || 'lage3', size);
}

export function curIco(cur, size = 24) {
  return ico(cur === 'pengar' ? 'pengar' : 'material', size);
}

export const ICON_IDS = Object.keys(INNER);
