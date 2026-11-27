// bygg.js — Byggnadsväljarens komposition (byggnad + flytande markunderlag) som separata lager.
// Används av korten (handen) och kan återanvändas där en komplett byggnads-miniatyr behövs.
// SKILD från kartans placering (src/placering.js): ändringar här påverkar inte kartan.
// Assets: byggnad = assets/bygg/<id>.png (beskurna stickers), mark = assets/bygg/mark/<zon>.png.
//
// Parametrarna nedan = Klaras intrimmade värden (byggnadsvaljare-preview, 2026-11-27).

// Per-TYP-ankare (markkontaktspunkt, andel av bildhöjd) + proportion, ur beskärningen.
export const GEO = {
  aker_smutsig:{ay:0.866,aspect:1.278}, aker_standard:{ay:0.813,aspect:1.423}, aker_gron:{ay:0.842,aspect:1.100},
  skog_smutsig:{ay:0.850,aspect:1.164}, skog_standard:{ay:0.838,aspect:1.042}, skog_gron:{ay:0.831,aspect:1.001},
  tundra_smutsig:{ay:0.863,aspect:1.352}, tundra_standard:{ay:0.839,aspect:0.995}, tundra_gron:{ay:0.894,aspect:1.019},
  stad_smutsig:{ay:0.827,aspect:1.227}, stad_standard:{ay:0.816,aspect:1.326}, stad_gron:{ay:0.828,aspect:1.094},
};
// Markytans front-center-y per zon (% av markunderlagets höjd).
export const SURF = { aker:54, skog:56, tundra:56, stad:55 };
// Per byggnad: bredd (% av markunderlagets bredd) + förskjutning (%).
export const COMP = {
  aker_smutsig:{scale:65,dx:0,dy:4}, aker_standard:{scale:74,dx:0,dy:0}, aker_gron:{scale:74,dx:0,dy:3},
  skog_smutsig:{scale:73,dx:0,dy:6}, skog_standard:{scale:72,dx:0,dy:2}, skog_gron:{scale:74,dx:0,dy:5},
  tundra_smutsig:{scale:79,dx:0,dy:6}, tundra_standard:{scale:76,dx:0,dy:4}, tundra_gron:{scale:80,dx:0,dy:2},
  stad_smutsig:{scale:86,dx:0,dy:6}, stad_standard:{scale:85,dx:0,dy:4}, stad_gron:{scale:87,dx:0,dy:6},
};

export const groundSrc   = zone => `assets/bygg/mark/${zone}.png`;
export const buildingSrc = id   => `assets/bygg/${id}.png`;

// HTML-sträng för en komposition (byggnad på markunderlag), fyller sin kvadratiska behållare.
// `id` = byggnads-id (t.ex. 'aker_smutsig'). Behållaren ska vara position:relative, kvadratisk.
export function compositeHTML(id){
  const zone = id.split('_')[0];
  const g = GEO[id] || {ay:0.82}, p = COMP[id] || {scale:72,dx:0,dy:0}, surf = SURF[zone] ?? 55;
  return `<img class="bv-ground" src="${groundSrc(zone)}" alt="">`
       + `<img class="bv-bldg" src="${buildingSrc(id)}" alt=""`
       + ` style="width:${p.scale}%;left:${50+p.dx}%;top:${surf+p.dy}%;`
       + `transform:translate(-50%,-${(g.ay*100).toFixed(1)}%)">`;
}
