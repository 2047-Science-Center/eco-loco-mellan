// map.js — Maktspelet (Mellan): AI-genererad ö-bild som terräng (assets/karta-kandidat-4.png, frilagd PNG),
// med hav, lag-markörer, byggnadslager och öhälso-overlay ritade i kod ovanpå/bakom.
//
// NY KARTA + DYNAMISK PLACERING (2026-11-27): kartbilden segmenteras i webbläsaren (src/placering.js)
// och byggplatserna RÄKNAS FRAM dynamiskt per område i stället för fasta slots i assets.json. Positionerna
// förberäknas EN gång vid kartladdning (stabila → byggnader hoppar aldrig) och fylls i spridd ordning.
// Byggnaderna är de beskurna stickersen (assets/bygg/<id>.png) med per-typ-ankare/proportion (src/bygg.js).
// Kompositionen i KORTEN (markunderlag) är skild från detta — ändringar här rör inte korten.
//
// MEDVETET ORÖRT (per Klara 2026-11-27): TEAM_MARKERS och händelsebilder. Markörvärdena ligger kvar i den
// GAMLA geografin (stad/tundra-hörnen är inte omkastade för nya kartan) — det är dokumenterat följdarbete (beslut.md).
//
// Koordinatsystem: kartbildens pixlar, 0–1448 × 0–1086. SVG:ns viewBox är något större för hav + markörer.

import { logoSVG } from './logos.js';
import { AREAS } from '../spec/engine.js';   // lag-metadata (namn, sektor) för klickbara företags-ikoner
import { segment, placeForLoad } from './placering.js';
import { GEO, buildingSrc } from './bygg.js';

export const VIEW = { w: 1448, h: 1086 };                  // nya kartbildens mått
const VB = { x: -150, y: -70, w: 1760, h: 1230 };          // viewBox med havsmarginal (rymmer markörerna)
export const MAP_IMAGE = 'assets/karta-kandidat-4.png';
const N_FIXED = 12;                                        // antal förberäknade byggplatser per område

export const AREA_COLORS = {
  aker: '#E7C24C', skog: '#3F8F4A', tundra: '#D98A3C', stad: '#8A8F96',
};
const AREA_DARK = {
  aker: '#B8942F', skog: '#2A6132', tundra: '#A5601F', stad: '#5F646C',
};
export const AREA_NAMES = { aker: 'Åkermark', skog: 'Skog', tundra: 'Tundra', stad: 'Stad' };

// Silhuett av nya ön (för öhälso-overlay, rök/gnistor och svallring). Framräknad ur bildens alfakanal.
const OUTLINE = [
  [1419,575],[1431,720],[1379,856],[1274,958],[1148,1021],[999,1011],[890,1016],[798,1064],[695,1068],[591,1054],
  [467,1060],[340,1027],[190,979],[85,869],[19,730],[51,575],[50,427],[162,315],[281,236],[396,185],
  [497,142],[597,115],[697,101],[799,74],[922,35],[1049,52],[1167,108],[1313,163],[1390,288],[1424,431],
];

// Lag-markörer i havet vid respektive hörn (badge + namn). ORÖRT per Klara (gamla geografin).
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
  ISLAND_CENTROID[0] + (x - ISLAND_CENTROID[0]) * 0.9,
  ISLAND_CENTROID[1] + (y - ISLAND_CENTROID[1]) * 0.9,
]);
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function clampToIsland(x, y) {
  if (pointInPoly(x, y, OUTLINE)) return { x, y };
  for (let t = 0.06; t <= 1; t += 0.06) {
    const nx = x + (ISLAND_CENTROID[0] - x) * t;
    const ny = y + (ISLAND_CENTROID[1] - y) * t;
    if (pointInPoly(nx, ny, SHRUNK)) return { x: nx, y: ny };
  }
  return { x: ISLAND_CENTROID[0], y: ISLAND_CENTROID[1] };
}

// Ordna punkter i SPRIDD sekvens (greedy farthest-first) → även få byggnader fördelas över ytan.
function spreadOrder(points) {
  if (points.length <= 2) return points.map(p => ({ x: p[0], y: p[1] }));
  const P = points.map(p => ({ x: p[0], y: p[1] }));
  let cx = 0, cy = 0; for (const p of P) { cx += p.x; cy += p.y; } cx /= P.length; cy /= P.length;
  let start = 0, bd = Infinity;
  P.forEach((p, i) => { const d = (p.x - cx) ** 2 + (p.y - cy) ** 2; if (d < bd) { bd = d; start = i; } });
  const used = new Array(P.length).fill(false), order = [start]; used[start] = true;
  const mind = P.map(() => Infinity);
  while (order.length < P.length) {
    const last = P[order[order.length - 1]]; let pick = -1, pd = -1;
    for (let i = 0; i < P.length; i++) {
      if (used[i]) continue;
      const d = (P[i].x - last.x) ** 2 + (P[i].y - last.y) ** 2;
      if (d < mind[i]) mind[i] = d;
      if (mind[i] > pd) { pd = mind[i]; pick = i; }
    }
    used[pick] = true; order.push(pick);
  }
  return order.map(i => P[i]);
}

const pts = p => p.map(q => q.join(',')).join(' ');
const S = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}) {
  const e = document.createElementNS(S, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function renderMap(container, { mode = 'neutralt', mapImage = MAP_IMAGE } = {}) {
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

  // — Byggplats-debug (döljs i spel; fylls när positionerna är framräknade) —
  const slotLayer = el('g');
  slotLayer.style.display = 'none';
  world.appendChild(slotLayer);

  // — Byggnadslager (fylls via placeBuilding; målas i y-ordning) —
  const buildLayer = el('g');
  world.appendChild(buildLayer);

  // — Lag-markörer i havet (badge + namn) — ORÖRT —
  const MARK = 156;
  for (const [id, [x, y]] of Object.entries(TEAM_MARKERS)) {
    const g = el('g');
    g.innerHTML = logoSVG(id, MARK);
    const badge = g.firstElementChild;
    badge.setAttribute('x', x - MARK / 2);
    badge.setAttribute('y', y - MARK / 2);
    const t = el('text', {
      x, y: y + MARK / 2 + 26, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800,
      fill: '#EFE8D6', 'letter-spacing': '2',
      style: 'paint-order: stroke; stroke: #1C4E60; stroke-width: 6px;',
    });
    t.textContent = AREA_NAMES[id].toUpperCase();
    g.appendChild(t);
    const area = AREAS.find(a => a.id === id);
    g.style.cursor = 'pointer';
    g.addEventListener('click', ev => { ev.stopPropagation(); showTip({ x, y: y + 44 }, [
      { t: area?.namn || id.toUpperCase(), size: 34, weight: 800, fill: area?.farg || '#EFE8D6' },
      { t: `Område: ${AREA_NAMES[id]}`, size: 25, weight: 700, fill: '#C9BFA6' },
      { t: `Tillverkar: ${area?.sektor === 'pengar' ? 'Pengar' : 'Material'}`, size: 25, weight: 700, fill: area?.sektor === 'pengar' ? '#F0B33C' : '#8FB3C4' },
    ]); });
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
  function showTip(foot, lines) {
    hideTip();
    const w = 400, pad = 18, lineH = 44, h = pad * 2 + lines.length * lineH;
    let x = foot.x - w / 2; x = Math.max(VB.x + 12, Math.min(x, VB.x + VB.w - w - 12));
    let y = foot.y - 150 - h; if (y < VB.y + 12) y = foot.y + 44;
    const g = el('g', { style: 'pointer-events:none' });
    g.appendChild(el('rect', { x, y, width: w, height: h, rx: 18, fill: '#14120E', opacity: 0.96, stroke: '#4A443A', 'stroke-width': 2 }));
    lines.forEach((ln, i) => {
      const t = el('text', { x: x + w / 2, y: y + pad + 30 + i * lineH, 'text-anchor': 'middle', 'font-size': ln.size, 'font-weight': ln.weight, fill: ln.fill });
      t.textContent = ln.t;
      g.appendChild(t);
    });
    tipLayer.appendChild(g);
    activeTip = g;
  }
  const buildingLines = info => [
    { t: info.namn, size: 32, weight: 800, fill: '#EFE8D6' },
    { t: `${info.oh > 0 ? '+' : ''}${info.oh} öhälsa`, size: 28, weight: 700, fill: info.oh > 0 ? '#3DD68C' : info.oh < 0 ? '#F0564B' : '#C9BfA6' },
    { t: info.lagNamn, size: 25, weight: 700, fill: '#C9A94F' },
  ];
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

  // ── Dynamiska byggplatser: segmentera kartbilden EN gång → positioner + bredd per område ──
  let POS = null, WS = null;                 // POS[area] = [{x,y}…] (spridd ordning), WS[area] = sprite-bredd (px)
  const pending = [];                        // byggen som anropades innan positionerna var klara
  const segImg = new Image(); segImg.crossOrigin = 'anonymous';
  segImg.onload = () => {
    try {
      const W = segImg.naturalWidth, H = segImg.naturalHeight;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(segImg, 0, 0);
      const seg = segment(cx.getImageData(0, 0, W, H).data, W, H);
      const wMin = Math.round(0.055 * W), wMax = Math.round(0.130 * W);
      const pl = placeForLoad(seg, N_FIXED, wMin, wMax);
      POS = {}; WS = {};
      for (const area of ['aker', 'skog', 'tundra', 'stad']) {
        POS[area] = spreadOrder(pl.foots[area] || []);
        WS[area] = pl.Ws[area];
      }
      for (const b of pending) drawBuilding(b.area, b.slotIndex, b.assetId, b.info);
      pending.length = 0;
    } catch (e) { console.warn('[map] dynamisk placering misslyckades:', e); }
  };
  segImg.src = MAP_IMAGE;

  // Ritar en byggnad på en förberäknad position (beskuren sticker, per-typ-ankare/proportion).
  function drawBuilding(area, slotIndex, assetId, info) {
    const list = POS[area] || [];
    const p = list[slotIndex] || list[list.length - 1];      // fler byggen än platser → sista platsen
    if (!p) return null;
    const foot = clampToIsland(p.x, p.y);
    const g = el('g', { 'data-building': `${area}-${slotIndex}`, 'data-y': foot.y });
    if (info) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', ev => { ev.stopPropagation(); showTip(foot, buildingLines(info)); });
    }
    const w = WS[area] || 150;
    const geo = GEO[assetId] || { ay: 0.84, aspect: 1.1 };
    const h = w / geo.aspect;
    // kontaktskugga under motivets markkontakt
    g.appendChild(el('ellipse', {
      cx: foot.x, cy: foot.y + w * 0.04, rx: w * 0.30, ry: w * 0.12,
      fill: '#000', opacity: 0.28, filter: 'url(#bshadow)',
    }));
    g.appendChild(el('image', {
      href: buildingSrc(assetId), x: foot.x - w / 2, y: foot.y - geo.ay * h, width: w, height: h,
      class: 'ecoloco-drop', preserveAspectRatio: 'xMidYMid meet',
    }));
    const after = [...buildLayer.children].find(c => +c.getAttribute('data-y') > foot.y);
    buildLayer.insertBefore(g, after || null);
    return g;
  }

  // Publikt API: köar om positionerna inte hunnit räknas fram än.
  function placeBuilding(area, slotIndex, assetId, info = null) {
    if (!POS) { pending.push({ area, slotIndex, assetId, info }); return null; }
    return drawBuilding(area, slotIndex, assetId, info);
  }

  return {
    svg, setOhalsaMode, placeBuilding,
    showSlots(v) { slotLayer.style.display = v ? '' : 'none'; },
    clearBuildings() { hideTip(); buildLayer.replaceChildren(); pending.length = 0; },
  };
}
