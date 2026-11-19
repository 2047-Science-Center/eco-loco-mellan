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

  // ---------- POLITIK-FÖRSLAG (örådet, Mellan/Skola) ----------
  forbud: `
    <polygon points="40,34 60,34 64,86 36,86" fill="#8A8372"/>
    <polygon points="40,34 49,34 47,86 36,86" fill="#B8AF9A"/>
    <polygon points="55,34 60,34 64,86 59,86" fill="#6E685A"/>
    <polygon points="37,29 63,29 63,36 37,36" fill="#B8AF9A"/>
    <line x1="38" y1="54" x2="62" y2="54" stroke="${DARK}" stroke-width="1.8" opacity="0.28"/>
    <line x1="37" y1="70" x2="63" y2="70" stroke="${DARK}" stroke-width="1.8" opacity="0.28"/>
    <path d="M41,30 Q38,24 45,23 Q52,21 54,27 Q56,32 49,33 Q43,33 41,30 Z" fill="#C9C0AE" opacity="0.5"/>
    <path d="M34,23 Q31,16 39,15 Q47,13 49,19 Q51,25 44,26 Q36,27 34,23 Z" fill="#B8AF9A" opacity="0.5"/>
    <path d="M47,17 Q45,9 54,8 Q62,7 63,15 Q64,21 56,21 Q49,22 47,17 Z" fill="#D8D1C2" opacity="0.5"/>
    <path d="M30,15 Q28,8 36,8 Q44,7 45,14 Q46,20 38,20 Q31,20 30,15 Z" fill="#C9C0AE" opacity="0.45"/>
    <line x1="22" y1="84" x2="80" y2="20" stroke="#F0564B" stroke-width="5" stroke-linecap="round"/>`,

  naturreservat: `
    <polygon points="50,14 68,42 32,42" fill="#3DD68C"/>
    <polygon points="50,14 32,42 44,38" fill="#7FE7B5"/>
    <polygon points="50,14 68,42 56,38" fill="#2A9E64"/>
    <polygon points="50,26 70,54 30,54" fill="#3DD68C"/>
    <polygon points="50,26 30,54 43,49" fill="#7FE7B5"/>
    <polygon points="50,26 70,54 57,49" fill="#2A9E64"/>
    <polygon points="46,54 54,54 54,66 46,66" fill="#8A6A3A"/>
    <rect x="22" y="70" width="56" height="5" fill="#C9A94F"/>
    <rect x="22" y="70" width="56" height="2" fill="#E4CE8C"/>
    <rect x="26" y="66" width="5" height="20" fill="#937A34"/>
    <rect x="47" y="66" width="5" height="20" fill="#C9A94F"/>
    <rect x="68" y="66" width="5" height="20" fill="#937A34"/>`,

  gron: `
    <polygon points="34,60 66,60 64,67 36,67" fill="#D9794A"/>
    <polygon points="34,60 66,60 66,63 34,63" fill="#E8936A"/>
    <polygon points="37,67 63,67 58,86 42,86" fill="#C66B3D"/>
    <polygon points="37,67 50,67 46,86 42,86" fill="#D9794A"/>
    <polygon points="58,67 63,67 58,86 54,86" fill="#A5512A"/>
    <polygon points="48,62 52,62 51,42 49,42" fill="#2A9E64"/>
    <polygon points="50,43 34,28 20,23 31,41" fill="#3DD68C"/>
    <polygon points="50,43 34,28 20,23" fill="#7FE7B5"/>
    <line x1="21" y1="24" x2="49" y2="42" stroke="#2A9E64" stroke-width="1.8" opacity="0.65"/>
    <polygon points="50,43 66,28 80,23 69,41" fill="#3DD68C"/>
    <polygon points="50,43 66,28 80,23" fill="#7FE7B5"/>
    <line x1="79" y1="24" x2="51" y2="42" stroke="#2A9E64" stroke-width="1.8" opacity="0.65"/>`,

  krispaket: `
    <rect x="20" y="32" width="60" height="50" rx="9" fill="#F0564B"/>
    <path d="M20,41 Q20,32 29,32 H71 Q80,32 80,41 Z" fill="#F58A82"/>
    <rect x="20" y="70" width="60" height="12" rx="6" fill="#B33A32"/>
    <path d="M41,32 V26 Q41,22 45,22 H55 Q59,22 59,26 V32" fill="none" stroke="#8A8372" stroke-width="4"/>
    <rect x="45" y="44" width="10" height="28" rx="2" fill="#F3ECDD"/>
    <rect x="36" y="53" width="28" height="10" rx="2" fill="#F3ECDD"/>`,

  marknadsavtal: `
    <polygon points="26,16 70,16 74,84 30,84" fill="#F3ECDD"/>
    <polygon points="26,16 48,16 50,84 30,84" fill="#FFFFFF"/>
    <polygon points="70,16 74,84 66,84 64,16" fill="#D8D1C2"/>
    <line x1="35" y1="30" x2="63" y2="30" stroke="#8A8372" stroke-width="2.6" opacity="0.7"/>
    <line x1="35" y1="39" x2="63" y2="39" stroke="#8A8372" stroke-width="2.6" opacity="0.7"/>
    <line x1="35" y1="48" x2="55" y2="48" stroke="#8A8372" stroke-width="2.6" opacity="0.7"/>
    <polyline points="36,62 44,70 60,52" fill="none" stroke="#3DD68C" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="58" cy="76" r="9" fill="#F0564B"/>
    <circle cx="58" cy="76" r="9" fill="none" stroke="#B33A32" stroke-width="2"/>
    <polygon points="58,70 60,75 65,75 61,78 63,83 58,80 53,83 55,78 51,75 56,75" fill="#F58A82"/>`,

  gronstod: `
    <circle cx="50" cy="52" r="33" fill="#C9A94F"/>
    <circle cx="50" cy="52" r="23" fill="#F3ECDD"/>
    <circle cx="50" cy="52" r="13" fill="#C9A94F"/>
    <circle cx="50" cy="52" r="33" fill="none" stroke="#937A34" stroke-width="2"/>
    <circle cx="50" cy="52" r="23" fill="none" stroke="#937A34" stroke-width="1.5"/>
    <polygon points="50,36 62,54 50,66 38,54" fill="#3DD68C"/>
    <polygon points="50,36 38,54 50,54" fill="#7FE7B5"/>
    <polygon points="50,36 62,54 50,54" fill="#2A9E64"/>`,

  allians: `
    <circle cx="38" cy="50" r="21" fill="none" stroke="#C9A94F" stroke-width="9"/>
    <circle cx="62" cy="50" r="21" fill="none" stroke="#3DD68C" stroke-width="9"/>
    <path d="M50,31 A21,21 0 0,1 50,69" fill="none" stroke="#2A9E64" stroke-width="9"/>`,

  skatt: `
    <polygon points="30,38 78,28 82,48 34,58" fill="#6BA87A"/>
    <polygon points="30,38 78,28 79,35 31,45" fill="#8CC79A"/>
    <polygon points="31,45 79,35 82,48 34,58" fill="#4E8A60"/>
    <circle cx="55" cy="43" r="6" fill="#D6EEDC" opacity="0.75"/>
    <ellipse cx="46" cy="82" rx="23" ry="8" fill="#B5832A"/>
    <ellipse cx="46" cy="77" rx="23" ry="8" fill="#F0B33C"/>
    <ellipse cx="46" cy="76" rx="23" ry="8" fill="#B5832A"/>
    <ellipse cx="46" cy="71" rx="23" ry="8" fill="#F7CE78"/>
    <ellipse cx="46" cy="70" rx="23" ry="8" fill="#B5832A"/>
    <ellipse cx="46" cy="65" rx="23" ry="8" fill="#F0B33C"/>`,

  utslappshandel: `
    <path d="M30,54 Q28,42 40,42 Q43,32 55,35 Q68,33 68,45 Q80,45 80,55 Q80,63 70,63 H36 Q28,63 28,56 Q28,54 30,54 Z" fill="#B8AF9A"/>
    <path d="M30,54 Q28,42 40,42 Q43,32 55,35 L55,47 Q40,47 30,54 Z" fill="#D8D1C2"/>
    <polygon points="28,74 46,74 46,70 56,77 46,84 46,80 28,80" fill="#3DD68C"/>
    <polygon points="72,90 54,90 54,94 44,87 54,80 54,84 72,84" fill="#F0564B"/>`,

  solidaritet: `
    <path d="M50,82 L22,53 Q13,41 25,33 Q37,27 50,41 Q63,27 75,33 Q87,41 78,53 Z" fill="#F0564B"/>
    <path d="M50,41 Q37,27 25,33 Q13,41 22,53 L50,82 Z" fill="#F58A82"/>
    <path d="M50,41 Q63,27 75,33 Q87,41 78,53 L50,82 Z" fill="#B33A32"/>`,

  grannskatt: `
    <polygon points="12,56 27,43 42,56 42,82 12,82" fill="#C9A94F"/>
    <polygon points="12,56 27,43 27,82 12,82" fill="#E4CE8C"/>
    <polygon points="27,43 42,56 42,82 27,82" fill="#937A34"/>
    <polygon points="58,56 73,43 88,56 88,82 58,82" fill="#8FB3C4"/>
    <polygon points="58,56 73,43 73,82 58,82" fill="#B9D4E0"/>
    <polygon points="73,43 88,56 88,82 73,82" fill="#5E8699"/>
    <polygon points="43,60 49,55 49,58 51,58 51,55 57,60 51,65 51,62 49,62 49,65" fill="#F3ECDD"/>`,

  sektorskatt: `
    <g fill="#EE8A45">
      <rect x="45" y="12" width="10" height="18"/>
      <rect x="45" y="70" width="10" height="18"/>
      <rect x="12" y="45" width="18" height="10"/>
      <rect x="70" y="45" width="18" height="10"/>
      <rect x="22" y="24" width="10" height="18" transform="rotate(-45 27 33)"/>
      <rect x="68" y="58" width="10" height="18" transform="rotate(-45 73 67)"/>
      <rect x="68" y="24" width="10" height="18" transform="rotate(45 73 33)"/>
      <rect x="22" y="58" width="10" height="18" transform="rotate(45 27 67)"/>
    </g>
    <circle cx="50" cy="50" r="27" fill="#EE8A45"/>
    <path d="M50,23 A27,27 0 0,0 23,50 L50,50 Z" fill="#F2A773"/>
    <circle cx="50" cy="50" r="12" fill="${DARK}"/>
    <circle cx="50" cy="50" r="7" fill="#C05A28"/>`,

  naturbruksskatt: `
    <rect x="37" y="28" width="4" height="14" fill="#6E685A"/>
    <polygon points="12,56 40,56 40,70 12,70" fill="#F0564B"/>
    <polygon points="12,56 40,56 40,60 12,60" fill="#F58A82"/>
    <polygon points="40,40 60,40 60,70 40,70" fill="#F0564B"/>
    <polygon points="40,40 50,40 50,70 40,70" fill="#F58A82"/>
    <polygon points="56,40 60,40 60,70 56,70" fill="#B33A32"/>
    <polygon points="42,31 62,31 60,40 40,40" fill="#B33A32"/>
    <polygon points="44,43 56,43 56,53 44,53" fill="#8FB3C4"/>
    <polygon points="44,43 50,43 50,53 44,53" fill="#B9D4E0"/>
    <circle cx="68" cy="72" r="16" fill="#2A2824"/>
    <circle cx="68" cy="72" r="7" fill="#C9A94F"/>
    <circle cx="68" cy="72" r="3" fill="#8A6A3A"/>
    <circle cx="24" cy="76" r="10" fill="#2A2824"/>
    <circle cx="24" cy="76" r="4.5" fill="#C9A94F"/>`,

  kustvakt: `
    <polygon points="44,12 56,12 58,18 42,18" fill="#6E685A"/>
    <polygon points="42,18 58,18 60,30 40,30" fill="#F0B33C"/>
    <polygon points="42,18 58,18 59,24 41,24" fill="#F7CE78"/>
    <polygon points="60,24 84,16 84,33" fill="#F7CE78" opacity="0.45"/>
    <polygon points="40,24 16,16 16,33" fill="#F7CE78" opacity="0.45"/>
    <polygon points="40,30 60,30 64,76 36,76" fill="#F3ECDD"/>
    <polygon points="40,30 49,30 47,76 36,76" fill="#FFFFFF"/>
    <polygon points="55,30 60,30 64,76 59,76" fill="#D8D1C2"/>
    <polygon points="39,40 61,40 61,49 38,49" fill="#F0564B"/>
    <polygon points="37,58 63,58 64,67 36,67" fill="#F0564B"/>
    <path d="M12,80 Q22,74 31,80 Q40,86 49,80 Q58,74 67,80 Q76,86 85,80 L88,92 L10,92 Z" fill="#5E8699"/>
    <path d="M12,82 Q22,76 31,82 Q40,88 49,82 Q58,76 67,82 Q76,88 85,82" fill="none" stroke="#8FB3C4" stroke-width="2.4"/>`,

  skogsvard: `
    <polygon points="38,16 49,34 27,34" fill="#3DD68C"/>
    <polygon points="38,16 27,34 38,34" fill="#7FE7B5"/>
    <polygon points="38,28 53,50 23,50" fill="#2A9E64"/>
    <polygon points="38,28 23,50 38,50" fill="#3DD68C"/>
    <polygon points="38,44 57,68 19,68" fill="#2A9E64"/>
    <polygon points="38,44 19,68 38,68" fill="#3DD68C"/>
    <polygon points="34,68 42,68 42,82 34,82" fill="#8A6A3A"/>
    <polygon points="66,28 74,28 72,60 68,60" fill="#C9A94F"/>
    <polygon points="66,26 74,26 74,31 66,31" fill="#E4CE8C"/>
    <polygon points="62,60 78,60 76,80 64,80" fill="#8FB3C4"/>
    <polygon points="62,60 70,60 69,80 64,80" fill="#B9D4E0"/>`,

  // ---------- CHROME: öråd / dilemma / kris / lobby / logg ----------
  vag: `
    <polygon points="40,80 60,80 64,87 36,87" fill="#B5832A"/>
    <polygon points="40,80 50,80 50,87 36,87" fill="#C9A94F"/>
    <polygon points="47,30 53,30 53,80 47,80" fill="#F0B33C"/>
    <polygon points="47,30 50,30 50,80 47,80" fill="#F7CE78"/>
    <polygon points="50,22 57,28 50,34 43,28" fill="#F7CE78"/>
    <polygon points="20,31 80,31 80,37 20,37" fill="#F0B33C"/>
    <polygon points="20,31 80,31 80,33 20,33" fill="#F7CE78"/>
    <line x1="24" y1="36" x2="24" y2="50" stroke="${DARK}" stroke-width="1.6" opacity="0.5"/>
    <line x1="76" y1="36" x2="76" y2="50" stroke="${DARK}" stroke-width="1.6" opacity="0.5"/>
    <polygon points="13,50 35,50 30,59 18,59" fill="#F0B33C"/>
    <polygon points="13,50 35,50 32,53 16,53" fill="#F7CE78"/>
    <polygon points="65,50 87,50 82,59 70,59" fill="#B5832A"/>
    <polygon points="65,50 87,50 84,53 68,53" fill="#F0B33C"/>`,

  orad: `
    <polygon points="50,14 86,34 14,34" fill="#C9A94F"/>
    <polygon points="50,14 14,34 50,34" fill="#E4CE8C"/>
    <polygon points="50,14 86,34 50,34" fill="#937A34"/>
    <rect x="16" y="34" width="68" height="7" fill="#B8AF9A"/>
    <rect x="16" y="34" width="68" height="3" fill="#D8D1C2"/>
    <rect x="22" y="41" width="9" height="34" fill="#D8D1C2"/>
    <rect x="22" y="41" width="4" height="34" fill="#F3ECDD"/>
    <rect x="37" y="41" width="9" height="34" fill="#D8D1C2"/>
    <rect x="37" y="41" width="4" height="34" fill="#F3ECDD"/>
    <rect x="52" y="41" width="9" height="34" fill="#D8D1C2"/>
    <rect x="52" y="41" width="4" height="34" fill="#F3ECDD"/>
    <rect x="67" y="41" width="9" height="34" fill="#D8D1C2"/>
    <rect x="67" y="41" width="4" height="34" fill="#F3ECDD"/>
    <rect x="14" y="75" width="72" height="5" fill="#B8AF9A"/>
    <rect x="11" y="80" width="78" height="6" fill="#8A8372"/>
    <rect x="11" y="80" width="78" height="2" fill="#B8AF9A"/>`,

  mal: `
    <circle cx="46" cy="54" r="30" fill="#F0564B"/>
    <circle cx="46" cy="54" r="30" fill="none" stroke="#B33A32" stroke-width="2"/>
    <circle cx="46" cy="54" r="20" fill="#F3ECDD"/>
    <circle cx="46" cy="54" r="10" fill="#F0564B"/>
    <line x1="46" y1="54" x2="84" y2="20" stroke="#8A8372" stroke-width="3.5"/>
    <polygon points="46,54 56,50 52,60" fill="#C9A94F"/>
    <polygon points="84,20 74,22 80,30" fill="#B8AF9A"/>`,

  happening: `
    <polygon points="18,84 40,62 52,74" fill="#F0B33C"/>
    <polygon points="18,84 40,62 44,68" fill="#F7CE78"/>
    <polygon points="18,84 52,74 40,78" fill="#B5832A"/>
    <rect x="56" y="54" width="7" height="7" transform="rotate(20 59 57)" fill="#3DD68C"/>
    <rect x="68" y="44" width="7" height="7" transform="rotate(-15 71 47)" fill="#F0564B"/>
    <rect x="60" y="34" width="6" height="6" transform="rotate(30 63 37)" fill="#8FB3C4"/>
    <rect x="78" y="58" width="6" height="6" transform="rotate(10 81 61)" fill="#C9A94F"/>
    <rect x="74" y="28" width="6" height="6" transform="rotate(-25 77 31)" fill="#EE8A45"/>
    <circle cx="52" cy="40" r="3" fill="#F7CE78"/>
    <circle cx="84" cy="44" r="3" fill="#3DD68C"/>`,

  bot: `
    <line x1="50" y1="20" x2="50" y2="30" stroke="#8A8372" stroke-width="3"/>
    <circle cx="50" cy="17" r="4" fill="#F0564B"/>
    <rect x="24" y="30" width="52" height="42" rx="10" fill="#8FB3C4"/>
    <path d="M24,40 Q24,30 34,30 H66 Q76,30 76,40 Z" fill="#B9D4E0"/>
    <rect x="24" y="62" width="52" height="10" rx="5" fill="#5E8699"/>
    <circle cx="40" cy="48" r="6" fill="${DARK}"/>
    <circle cx="60" cy="48" r="6" fill="${DARK}"/>
    <circle cx="42" cy="46" r="2" fill="#7FE7B5"/>
    <circle cx="62" cy="46" r="2" fill="#7FE7B5"/>
    <rect x="38" y="60" width="24" height="4" rx="2" fill="${DARK}"/>
    <rect x="18" y="44" width="6" height="14" rx="2" fill="#5E8699"/>
    <rect x="76" y="44" width="6" height="14" rx="2" fill="#5E8699"/>`,

  bygge: `
    <polygon points="40,86 48,86 46,30 42,30" fill="#F0B33C"/>
    <polygon points="40,86 44,86 43,30 42,30" fill="#F7CE78"/>
    <polygon points="44,30 86,30 86,36 44,36" fill="#F0B33C"/>
    <polygon points="44,30 86,30 86,32 44,32" fill="#F7CE78"/>
    <polygon points="30,31 44,31 44,35 30,35" fill="#B5832A"/>
    <rect x="40" y="36" width="10" height="9" fill="#5E8699"/>
    <line x1="76" y1="36" x2="76" y2="54" stroke="${DARK}" stroke-width="1.6"/>
    <polygon points="73,54 79,54 78,60 74,60" fill="#8A8372"/>
    <rect x="70" y="60" width="12" height="9" fill="#8A8372"/>
    <rect x="34" y="86" width="20" height="4" fill="#8A8372"/>`,

  ja: `
    <polyline points="22,54 40,72 78,30" fill="none" stroke="#3DD68C" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,

  nej: `
    <line x1="28" y1="28" x2="72" y2="72" stroke="#F0564B" stroke-width="13" stroke-linecap="round"/>
    <line x1="72" y1="28" x2="28" y2="72" stroke="#F0564B" stroke-width="13" stroke-linecap="round"/>`,

  bok: `
    <polygon points="50,34 20,30 20,74 50,78" fill="#F3ECDD"/>
    <polygon points="50,34 20,30 20,34 50,38" fill="#FFFFFF"/>
    <polygon points="50,34 80,30 80,74 50,78" fill="#E8E0CF"/>
    <polygon points="48,34 52,34 52,78 48,78" fill="#C9A94F"/>
    <line x1="26" y1="42" x2="44" y2="44" stroke="#B8AF9A" stroke-width="2"/>
    <line x1="26" y1="50" x2="44" y2="52" stroke="#B8AF9A" stroke-width="2"/>
    <line x1="26" y1="58" x2="44" y2="60" stroke="#B8AF9A" stroke-width="2"/>
    <line x1="56" y1="44" x2="74" y2="42" stroke="#B8AF9A" stroke-width="2"/>
    <line x1="56" y1="52" x2="74" y2="50" stroke="#B8AF9A" stroke-width="2"/>
    <line x1="56" y1="60" x2="74" y2="58" stroke="#B8AF9A" stroke-width="2"/>`,
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
