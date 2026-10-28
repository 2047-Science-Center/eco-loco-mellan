// map.js — Eco Loco (Mellan): AI-genererad ö-bild som terräng (assets/karta.png, frilagd PNG),
// med hav, lag-markörer, slots, byggnadslager och öhälso-overlay ritade i kod ovanpå/bakom.
// (Vald väg efter avstämning med Josef: genererad bild i assetsens stil i stället för kodritad terräng.
//  Den kodritade isometriska versionen finns i git-historik/tidigare fil om den behövs igen.)
//
// Återanvänds i fas 3: vyn anropar placeBuilding() på motorns 'build'-event
// och setOhalsaMode() på 'ohalsa'-eventet.
//
// Koordinatsystem: kartbildens pixlar, 0–1536 × 0–1024 (samma som spec/assets.json → slots).
// SVG:ns viewBox är något större så havet + lag-markörerna får plats runt bilden.

import { logoSVG } from './logos.js';

export const VIEW = { w: 1536, h: 1024 };                 // kartbildens mått
const VB = { x: -130, y: -60, w: 1796, h: 1170 };          // viewBox med havsmarginal
export const MAP_IMAGE = 'assets/Karta%201.2.png';

export const AREA_COLORS = {
  aker: '#E7C24C', skog: '#3F8F4A', tundra: '#D98A3C', stad: '#8A8F96',
};
const AREA_DARK = {
  aker: '#B8942F', skog: '#2A6132', tundra: '#A5601F', stad: '#5F646C',
};
export const AREA_NAMES = { aker: 'Åkermark', skog: 'Skog', tundra: 'Tundra', stad: 'Stad' };

// Grov silhuett av ön i bilden (för öhälso-overlay, rök/gnistor och svallring).
const OUTLINE = [
  [200, 300], [420, 90], [700, 55], [880, 60], [1240, 70], [1440, 230],
  [1480, 420], [1440, 600], [1380, 760], [1150, 850], [900, 900], [620, 950],
  [420, 900], [230, 780], [120, 650], [80, 480],
];

// Lag-markörer i havet vid respektive hörn (badge + namn). Zonerna i karta.png:
// gul=NV, grön=NÖ, grå=SÖ, orange=SV.
const TEAM_MARKERS = {
  aker: [-20, 130], skog: [1590, 170], stad: [1600, 800], tundra: [-20, 760],
};

// De fem ölägena → filter på ön + overlay + rök/gnistor. (Kartan ÄR öhälso-visningen.)
export const OH_MODES = {
  superdaligt: { filter: 'saturate(0.35) brightness(0.72)', overlay: '#3d362e', op: 0.45, smoke: 1,   spark: 0 },
  daligt:      { filter: 'saturate(0.6) brightness(0.88)',  overlay: '#4c463c', op: 0.26, smoke: 0.5, spark: 0 },
  neutralt:    { filter: 'none',                            overlay: '#000000', op: 0,    smoke: 0,   spark: 0 },
  bra:         { filter: 'saturate(1.12) brightness(1.03)', overlay: '#000000', op: 0,    smoke: 0,   spark: 0.5 },
  mycketbra:   { filter: 'saturate(1.3) brightness(1.08)',  overlay: '#000000', op: 0,    smoke: 0,   spark: 1 },
};

// — Seating: håll byggnadsfoten innanför ön (clamp mot silhuetten) —
const ISLAND_CENTROID = (() => {
  const s = OUTLINE.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
  return [s[0] / OUTLINE.length, s[1] / OUTLINE.length];
})();
const SHRUNK = OUTLINE.map(([x, y]) => [
  ISLAND_CENTROID[0] + (x - ISLAND_CENTROID[0]) * 0.86,
  ISLAND_CENTROID[1] + (y - ISLAND_CENTROID[1]) * 0.86,
]);
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
// Rör inte slots som redan ligger på ön; dra bara in sådana som hamnat i havet.
function clampToIsland(x, y) {
  if (pointInPoly(x, y, OUTLINE)) return { x, y };
  for (let t = 0.08; t <= 1; t += 0.08) {
    const nx = x + (ISLAND_CENTROID[0] - x) * t;
    const ny = y + (ISLAND_CENTROID[1] - y) * t;
    if (pointInPoly(nx, ny, SHRUNK)) return { x: nx, y: ny };
  }
  return { x: ISLAND_CENTROID[0], y: ISLAND_CENTROID[1] };
}

const pts = p => p.map(q => q.join(',')).join(' ');
const S = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}) {
  const e = document.createElementNS(S, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// Ritar hela kartan i `container`. slots = assets.json → slots (läses live av anroparen).
// Returnerar ett handle: { setOhalsaMode, placeBuilding, showSlots, clearBuildings, svg }.
export function renderMap(container, { slots = {}, mode = 'neutralt', mapImage = MAP_IMAGE } = {}) {
  const svg = el('svg', { viewBox: `${VB.x} ${VB.y} ${VB.w} ${VB.h}`, role: 'img' });
  svg.classList.add('ecoloco-map');

  const defs = el('defs');
  defs.innerHTML = `
    <radialGradient id="sea" cx="50%" cy="48%" r="75%">
      <stop offset="0%" stop-color="#2E7D93"/>
      <stop offset="62%" stop-color="#256579"/>
      <stop offset="100%" stop-color="#1C4E60"/>
    </radialGradient>
    <clipPath id="islandClip"><polygon points="${pts(OUTLINE)}"/></clipPath>
    <filter id="bshadow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>`;
  svg.appendChild(defs);

  const world = el('g'); // allt som tonas av öhälso-filtret
  svg.appendChild(world);
  world.appendChild(el('rect', { x: VB.x, y: VB.y, width: VB.w, height: VB.h, fill: 'url(#sea)' }));

  // svallring runt ön
  world.appendChild(el('polygon', {
    points: pts(OUTLINE), fill: 'none', stroke: '#4FA3B8',
    'stroke-width': 40, 'stroke-linejoin': 'round', opacity: 0.25,
  }));

  // — Ön: den genererade kartbilden —
  world.appendChild(el('image', {
    href: mapImage, x: 0, y: 0, width: VIEW.w, height: VIEW.h,
    preserveAspectRatio: 'xMidYMid meet',
  }));

  // — Slots (visas i fas 1 / debug; döljs i spel tills byggnad droppar) —
  const slotLayer = el('g');
  world.appendChild(slotLayer);
  for (const [area, list] of Object.entries(slots)) {
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      const g = el('g', { 'data-slot': `${area}-${s.index}` });
      g.appendChild(el('ellipse', {
        cx: s.x, cy: s.y, rx: 40, ry: 20,
        fill: AREA_DARK[area] || '#555', opacity: 0.45,
        stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '6 6',
      }));
      const t = el('text', {
        x: s.x, y: s.y + 6, 'text-anchor': 'middle',
        'font-size': 17, 'font-weight': 700, fill: '#fff', opacity: 0.85,
      });
      t.textContent = s.index + 1;
      g.appendChild(t);
      slotLayer.appendChild(g);
    }
  }

  // — Byggnadslager (fylls via placeBuilding; målas i y-ordning) —
  const buildLayer = el('g');
  world.appendChild(buildLayer);

  // — Lag-markörer i havet (badge + namn) —
  for (const [id, [x, y]] of Object.entries(TEAM_MARKERS)) {
    const g = el('g');
    g.innerHTML = logoSVG(id, 88);
    const badge = g.firstElementChild;
    badge.setAttribute('x', x - 44);
    badge.setAttribute('y', y - 44);
    const t = el('text', {
      x, y: y + 70, 'text-anchor': 'middle', 'font-size': 23, 'font-weight': 800,
      fill: '#EFE8D6', 'letter-spacing': '2',
      style: 'paint-order: stroke; stroke: #1C4E60; stroke-width: 6px;',
    });
    t.textContent = AREA_NAMES[id].toUpperCase();
    g.appendChild(t);
    world.appendChild(g);
  }

  // — Öhälso-overlay (klippt till ön) + rök + gnistor —
  const overlay = el('polygon', { points: pts(OUTLINE), fill: '#000', opacity: 0, style: 'transition: opacity 1.2s, fill 1.2s; pointer-events:none' });
  svg.appendChild(overlay);

  const smokeG = el('g', { 'clip-path': 'url(#islandClip)', style: 'transition: opacity 1.2s; pointer-events:none' });
  for (let i = 0; i < 7; i++) {
    const e = el('ellipse', {
      cx: 260 + i * 170, cy: 260 + (i % 3) * 200, rx: 100 + (i % 3) * 35, ry: 32 + (i % 2) * 12,
      fill: '#6b6257', opacity: 0.4,
    });
    e.style.animation = `ecoloco-drift ${14 + i * 3}s linear infinite`;
    e.style.animationDelay = `${-i * 4}s`;
    smokeG.appendChild(e);
  }
  svg.appendChild(smokeG);

  const sparkG = el('g', { 'clip-path': 'url(#islandClip)', style: 'transition: opacity 1.2s; pointer-events:none' });
  for (let i = 0; i < 14; i++) {
    const e = el('circle', {
      cx: 220 + ((i * 271) % 1100), cy: 180 + ((i * 149) % 640), r: 4 + (i % 3) * 1.5,
      fill: i % 2 ? '#FFF7C9' : '#CFF5C9',
    });
    e.style.animation = `ecoloco-twinkle ${2 + (i % 4)}s ease-in-out infinite`;
    e.style.animationDelay = `${-i * 0.6}s`;
    sparkG.appendChild(e);
  }
  svg.appendChild(sparkG);

  if (!document.getElementById('ecoloco-map-anim')) {
    const st = document.createElement('style');
    st.id = 'ecoloco-map-anim';
    st.textContent = `
      @keyframes ecoloco-drift { from { transform: translateX(-220px); } to { transform: translateX(1760px); } }
      @keyframes ecoloco-twinkle { 0%,100% { opacity: 0; } 50% { opacity: 0.9; } }
      @keyframes ecoloco-drop { from { transform: translateY(-42px) scale(0.9); opacity: 0; } 60% { opacity: 1; } to { transform: translateY(0) scale(1); opacity: 1; } }
      .ecoloco-drop { animation: ecoloco-drop 340ms cubic-bezier(.22,1,.36,1) both; transform-box: fill-box; transform-origin: 50% 88%; }
      .ecoloco-map g { transition: filter 1.2s; }`;
    document.head.appendChild(st);
  }

  // — Info-ruta för klickbara byggnader (ritas överst) —
  const tipLayer = el('g');
  svg.appendChild(tipLayer);
  let activeTip = null;
  function hideTip() { if (activeTip) { activeTip.remove(); activeTip = null; } }
  function showTip(foot, info) {
    hideTip();
    const w = 380, h = 156, pad = 16;
    let x = foot.x - w / 2; x = Math.max(VB.x + 12, Math.min(x, VB.x + VB.w - w - 12));
    let y = foot.y - 150 - h; if (y < VB.y + 12) y = foot.y + 44;   // under byggnaden om det inte får plats ovanför
    const g = el('g', { style: 'pointer-events:none' });
    g.appendChild(el('rect', { x, y, width: w, height: h, rx: 18, fill: '#14120E', opacity: 0.96, stroke: '#4A443A', 'stroke-width': 2 }));
    const lines = [
      { t: info.namn, size: 32, weight: 800, fill: '#EFE8D6' },
      { t: `${info.oh > 0 ? '+' : ''}${info.oh} öhälsa`, size: 28, weight: 700, fill: info.oh > 0 ? '#3DD68C' : info.oh < 0 ? '#F0564B' : '#C9BfA6' },
      { t: info.lagNamn, size: 25, weight: 700, fill: '#C9A94F' },
    ];
    lines.forEach((ln, i) => {
      const t = el('text', { x: x + w / 2, y: y + pad + 32 + i * 42, 'text-anchor': 'middle', 'font-size': ln.size, 'font-weight': ln.weight, fill: ln.fill });
      t.textContent = ln.t;
      g.appendChild(t);
    });
    tipLayer.appendChild(g);
    activeTip = g;
  }
  // Klick på tom karta/hav → stäng ev. öppen info-ruta (byggnads-klick stoppar bubblingen).
  svg.addEventListener('click', hideTip);

  container.appendChild(svg);

  function setOhalsaMode(m) {
    const cfg = OH_MODES[m] || OH_MODES.neutralt;
    world.style.filter = cfg.filter;
    overlay.setAttribute('fill', cfg.overlay);
    overlay.setAttribute('opacity', cfg.op);
    smokeG.style.opacity = cfg.smoke;
    sparkG.style.opacity = cfg.spark;
  }
  setOhalsaMode(mode);

  // Byggnad droppar på slot. size i kartbildens pixlar (~135 ≈ assetsens naturliga skala här).
  function placeBuilding(area, slotIndex, href, size = 135, info = null) {
    const s = (slots[area] || [])[slotIndex];
    if (!s) return null;
    const foot = clampToIsland(s.x, s.y);
    const g = el('g', { 'data-building': `${area}-${slotIndex}`, 'data-y': foot.y });
    // Klickbar byggnad → visa info-ruta (namn · öhälso-effekt · vilket lag som byggde).
    if (info) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', ev => { ev.stopPropagation(); showTip(foot, info); });
    }
    // kontaktskugga: grundar den grövre tilen mot den (nu texturerade) ytan
    g.appendChild(el('ellipse', {
      cx: foot.x, cy: foot.y + size * 0.06, rx: size * 0.34, ry: size * 0.14,
      fill: '#000', opacity: 0.3, filter: 'url(#bshadow)',
    }));
    g.appendChild(el('image', {
      href, x: foot.x - size / 2, y: foot.y - size * 0.82, width: size, height: size,
      class: 'ecoloco-drop',
    }));
    // måla i y-ordning så främre byggnader hamnar över bakre
    const after = [...buildLayer.children].find(c => +c.getAttribute('data-y') > foot.y);
    buildLayer.insertBefore(g, after || null);
    return g;
  }

  return {
    svg, setOhalsaMode, placeBuilding,
    showSlots(v) { slotLayer.style.display = v ? '' : 'none'; },
    clearBuildings() { hideTip(); buildLayer.replaceChildren(); },
  };
}
