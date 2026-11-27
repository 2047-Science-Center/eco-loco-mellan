// kroning.js — KRÖNINGSCEREMONIN på skärmen (#ov-kroning). Ren vy: all data kommer in, tidslinjen
// ligger i spec/kroning.js (delad med riggen). Ljudet spelas centralt (hjärnan) — skärmen är tyst.
import { kroningSteg, duellHopp } from '../spec/kroning.js';
import { logoSVG } from './logos.js';
import { ico } from './icons.js';

const FARG = { aker: '#E0B43C', skog: '#4C9F5A', tundra: '#E0752F', stad: '#B9C0C8' };
const VAGG_X = { skog: 39.6, aker: 54.4, tundra: 71, stad: 88 };   // emblemens läge (% av väggbilden)
const AR_ORD = { 4: 'Fyra', 6: 'Sex', 8: 'Åtta', 10: 'Tio' };
const BILDER = ['assets/kontrollrum_neutral.jpg', 'assets/kontrollrum_gron.jpg', 'assets/kontrollrum_rod.jpg', 'assets/vagg_mork.jpg',
  ...Object.keys(VAGG_X).flatMap(id => [`assets/vagg_${id}.jpg`, `assets/slut/arets-foretag-${id}.png`]), 'assets/slut/on-dog.png'];

const $ = id => document.getElementById(id);
let timers = [], raf = 0, korId = 0;
const _forladdat = [];

export function forladdaKroning() {
  if (_forladdat.length) return;
  for (const src of BILDER) { const im = new Image(); im.src = src; im.decode?.().catch(() => {}); _forladdat.push(im); }
}

export function stangKroning() {
  korId++; timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
  const ov = $('ov-kroning'); if (!ov) return;
  ov.classList.remove('open'); ov.innerHTML = '';
}
export const kroningOppen = () => !!$('ov-kroning')?.classList.contains('open');

// d = kroningData(...). opts: { forbi: sekunder som redan gått (sen anslutning), knapp: text|null, onKnapp, onKort }
export function visaKroning(d, opts = {}) {
  stangKroning();
  const min = korId;
  const ov = $('ov-kroning');
  const lager = (id, src) => `<div class="L" id="${id}"${src ? ` style="background-image:url(${src})"` : ''}></div>`;
  ov.innerHTML =
    lager('kr-rum', 'assets/kontrollrum_neutral.jpg') + lager('kr-mood') +
    `<div id="kr-vagg">${lager('kr-mork', 'assets/vagg_mork.jpg')}` +
      Object.entries(VAGG_X).map(([id, x]) => `<div class="lys" id="kr-l-${id}" style="--x:${x}%;background-image:url(assets/vagg_${id}.jpg)"></div>`).join('') +
      Object.entries(VAGG_X).map(([id, x]) => `<div class="emb" id="kr-e-${id}" style="left:${x}%"><b class="kap"></b><b class="plats"></b></div>`).join('') +
    `</div>` + lager('kr-win') +
    `<div id="kr-st">` +
      `<div id="kr-cm"><div class="cbar"></div><div class="mhead"><span class="seal">${ico('orad', 62)}</span><div><div class="m1">CENTRALMAKTEN</div><div class="m2">OFFICIELLT MEDDELANDE</div></div>` +
        `<div class="prio"><i></i>PRIORITET: HÖG</div></div><div class="rh">${AR_ORD[d.ar] || d.ar} år har gått</div><div class="rs">Nu avgörs öns framtid.</div></div>` +
      `<div id="kr-oh"><div id="kr-ohq">KLARADE SIG ÖN?</div><div class="h"><span>ÖNS HÄLSA</span><span id="kr-ohn">0</span></div><div class="bar"><div id="kr-ohf"></div><div class="mal" style="left:${d.mal}%"><span>MÅL ${d.mal}</span></div></div></div>` +
      `<div id="kr-ingen"><span class="cbar"></span><span class="ik">${ico('sabotor', 180)}</span><span class="tx">INGEN BLIR<br>BORGMÄSTARE</span></div>` +
      `<div id="kr-namn"></div><div id="kr-kort"></div>` +
    `</div><div id="kr-flash"></div>`;
  // Väggen fyller hela skärmen även utanför 16:9 → skala hela vägg-gruppen (emblem + siffror följer med).
  const r = ov.getBoundingClientRect(), s = $('kr-st').getBoundingClientRect();
  if (s.width) $('kr-vagg').style.transform = `scale(${Math.max(r.width / s.width, r.height / s.height)})`;
  ov.classList.add('open');

  const on = (id, v = true) => $(id)?.classList.toggle('on', v);
  const bild = (id, src) => { $(id).style.backgroundImage = `url(${src})`; };
  const vinn = d.placering.at(-1);
  const kapital = id => d.placering.find(p => p.teamId === id)?.kapital ?? 0;
  const raknaOh = (sek, direkt) => {
    const t0 = performance.now();
    const f = () => {
      if (min !== korId) return;
      const p = direkt ? 1 : Math.min(1, (performance.now() - t0) / (sek * 1000));
      const v = Math.round(d.oh * (1 - Math.pow(1 - p, 3)));
      const c = v >= d.mal ? 'var(--oh-green)' : v >= 35 ? 'var(--led)' : 'var(--oh-red)';
      $('kr-ohn').textContent = v; $('kr-ohn').style.color = c; $('kr-ohf').style.width = v + '%'; $('kr-ohf').style.background = c;
      if (p < 1) raf = requestAnimationFrame(f);
    };
    f();
  };
  const dom = vunnet => {
    cancelAnimationFrame(raf);
    const c = vunnet ? 'var(--oh-green)' : 'var(--oh-red)';
    $('kr-ohq').textContent = vunnet ? 'ÖN ÖVERLEVDE' : 'NEJ.'; $('kr-ohq').style.color = c;
    $('kr-ohn').textContent = d.oh; $('kr-ohn').style.color = c; $('kr-ohf').style.width = d.oh + '%'; $('kr-ohf').style.background = c;
    bild('kr-mood', vunnet ? 'assets/kontrollrum_gron.jpg' : 'assets/kontrollrum_rod.jpg'); on('kr-mood');
  };
  const visaSiffra = (id, plats) => {
    const e = $(`kr-e-${id}`);
    e.querySelector('.kap').textContent = kapital(id); e.querySelector('.plats').textContent = `${plats}:a`;
    e.classList.add('on'); e.classList.toggle('etta', plats === 1);
  };
  const vaggBort = () => { $('kr-vagg').classList.add('bort'); on('kr-rum', false); on('kr-mood', false); };

  const steg = {
    rum: () => on('kr-rum'),
    meddelande: () => on('kr-cm'),
    meddelande_bort: () => on('kr-cm', false),
    rakna: () => { on('kr-oh'); raknaOh(5.5); },
    overlevde: () => dom(true),
    foll: () => dom(false),
    slack: () => { on('kr-oh', false); $('kr-rum').classList.add('dip'); $('kr-mood').classList.add('dip'); },
    vagg: () => on('kr-mork'),
    tand: x => on(`kr-l-${x.lag}`),
    ut: x => { const l = $(`kr-l-${x.lag}`); l.style.opacity = ''; l.classList.remove('on', 'lead'); visaSiffra(x.lag, x.plats); },
    duell: x => duellHopp().forEach((t, n) => timers.push(setTimeout(() => {
      x.lag.forEach((id, i) => { const l = $(`kr-l-${id}`); if (!l) return; const hit = i === n % 2; l.classList.toggle('lead', hit); l.style.opacity = hit ? 1 : .25; });
    }, t * 1000))),
    kvar: x => { const l = $(`kr-l-${x.lag}`); l.style.opacity = ''; l.classList.add('on', 'lead'); visaSiffra(x.lag, 1); },
    blixt: x => { vaggBort(); $('kr-flash').classList.add('go'); bild('kr-win', `assets/slut/arets-foretag-${x.lag}.png`); $('kr-win').classList.add('snabb'); on('kr-win'); },
    krona: x => {
      $('kr-namn').innerHTML = `<div class="n">${(vinn?.namn || '').toUpperCase()}</div><div class="s">${ico('krona', 70, { badge: false })}BORGMÄSTARE</div>`;
      on('kr-namn');
      for (let i = 0; i < 150; i++) {
        const g = document.createElement('i'); g.className = 'gnist';
        g.style.cssText = `left:${Math.random() * 100}%;animation-duration:${2.5 + Math.random() * 3.5}s;animation-delay:${Math.random() * 3}s;opacity:${.4 + Math.random() * .6}`;
        ov.appendChild(g);
      }
    },
    ingen: () => on('kr-ingen'),
    dampa: () => {},                     // bara riggen
    on_dod: () => { on('kr-ingen', false); vaggBort(); bild('kr-win', 'assets/slut/on-dog.png'); on('kr-win'); },
    on_foll: () => { $('kr-namn').innerHTML = `<div class="n foll">ÖN FÖLL</div>`; on('kr-namn'); },
    lugn: () => {},                      // bara riggen
    kort: () => visaKort(),
  };

  function visaKort() {
    on('kr-namn', false); on('kr-ingen', false); on('kr-oh', false); on('kr-cm', false);
    ov.querySelectorAll('.gnist').forEach(g => g.remove());
    if (!$('kr-win').style.backgroundImage) { vaggBort(); bild('kr-win', d.vunnet ? `assets/slut/arets-foretag-${d.vinnare}.png` : 'assets/slut/on-dog.png'); on('kr-win'); }
    $('kr-win').classList.add('dov');
    const G = '#E8C96A', GR = 'var(--oh-green)', RD = 'var(--oh-red)';
    let n = 0;
    const kort = (cls, acc, top, mitt, namn, tal) => `<div class="kort ${cls}" style="--acc:${acc};animation-delay:${(n++) * .35}s"><div class="top">${top}</div><div class="mitt"><span class="halo"></span>${mitt}</div><div class="namn">${namn}</div>${tal}</div>`;
    const halsa = () => kort('', d.vunnet ? GR : RD, `<div class="hbar"><i style="width:${d.oh}%"></i><b style="left:${d.mal}%"></b></div>`, ico('on', 150), 'ÖNS HÄLSA', `<div class="v">${d.oh}</div>`);
    const bov = () => d.bov ? kort('', RD, ico('sabotor', 170), logoSVG(d.bov.teamId, 270), `<span style="color:${FARG[d.bov.teamId]}">${(d.bov.namn || '').toUpperCase()}</span>`,
      `<div class="v">−${Math.abs(d.bov.skada)}<span class="ik">${ico('industri', 104)}</span></div>`) : '';
    const mastare = () => kort('stor', G, ico('krona', 170, { badge: false }), logoSVG(d.vinnare, 270), `<span style="color:${FARG[d.vinnare]}">${(vinn?.namn || '').toUpperCase()}</span>`,
      `<div class="v">${vinn?.kapital ?? ''}<span class="ik">${ico('pengar', 104)}${ico('material', 104)}</span></div>`);
    let rad;
    if (d.vunnet) { const a = halsa(), b = mastare(), c = bov(); rad = a + b + c; }
    else rad = halsa() + bov();
    $('kr-kort').innerHTML = `<div class="rad">${rad}</div><div class="fraga">${ico('orad', 70)}${d.vunnet ? 'Vem betalade priset?' : 'Vem bär ansvaret?'}</div>`
      + (opts.knapp ? `<button class="bigbtn gold" id="kr-knapp">${opts.knapp}</button>` : '');
    on('kr-kort');
    const k = $('kr-knapp');
    if (k) { k.addEventListener('click', () => opts.onKnapp?.()); timers.push(setTimeout(() => k.classList.add('on'), 4000)); }
    opts.onKort?.();
  }

  const lista = kroningSteg(d);
  if ((opts.forbi || 0) > 3) { on('kr-rum'); visaKort(); return; }   // sen anslutning mitt i ceremonin → direkt till slutrutan
  for (const x of lista) timers.push(setTimeout(() => { if (min === korId) steg[x.steg]?.(x); }, x.t * 1000));
}
