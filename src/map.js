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
export const MAP_IMAGE = 'assets/karta.png';

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
    <clipPath id="islandClip"><polygon points="${pts(OUTLINE)}"/></clipPath>`;
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
  const overlay = el('polygon', { points: pts(OUTLINE), fill: '#000', opacity: 0, style: 'transition: opacity 1.2s, fill 1.2s' });
  svg.appendChild(overlay);

  const smokeG = el('g', { 'clip-path': 'url(#islandClip)', style: 'transition: opacity 1.2s' });
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

  const sparkG = el('g', { 'clip-path': 'url(#islandClip)', style: 'transition: opacity 1.2s' });
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
      .ecoloco-map g { transition: filter 1.2s; }`;
    document.head.appendChild(st);
  }

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
  function placeBuilding(area, slotIndex, href, size = 135) {
    const s = (slots[area] || [])[slotIndex];
    if (!s) return null;
    const img = el('image', {
      href, x: s.x - size / 2, y: s.y - size * 0.82, width: size, height: size,
      'data-building': `${area}-${slotIndex}`,
    });
    // måla i y-ordning så främre byggnader hamnar över bakre
    const after = [...buildLayer.children].find(c => +c.getAttribute('y') > +img.getAttribute('y'));
    buildLayer.insertBefore(img, after || null);
    return img;
  }

  return {
    svg, setOhalsaMode, placeBuilding,
    showSlots(v) { slotLayer.style.display = v ? '' : 'none'; },
    clearBuildings() { buildLayer.replaceChildren(); },
  };
}
