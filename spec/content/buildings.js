// spec/content/buildings.js — BYGGNADSBANK (innehåll, ingen logik).
// Flyttad ur spec/engine.js (MATERIAL_HAND / PENGAR_HAND / NAMES) 2026-11-11, migrerings-Etapp 1.
// Alla 12 byggnader, EXAKT samma balansvärden som tidigare — motorns beteende är oförändrat.
//
// Ingen spelversion är inbyggd som standard: varje byggnad anger själv i variants[] var den är
// tillgänglig (alla tre tills vi börjar filtrera per version). Motorn läser denna bank i stället
// för att ha listorna hårdkodade.
//
// Fält:
//   id         stabilt ID (= region_tier, matchar card.asset + nyckeln i assets.json buildings). ÄNDRA ALDRIG.
//   region     internt företags-/områdes-ID (aker=Oxen, skog=Björnen, tundra=Räven, stad=Örnen). ÄNDRA ALDRIG (MQTT/rigg).
//   tier       byggnadskategori: 'smutsig' | 'standard' | 'gron'.
//   namn       visningsnamn.
//   cost       { pengar, material } — engångskostnad att bygga (= tidigare kp/km).
//   production { pengar, material } — passiv inkomst per år (= tidigare gp/gm).
//   impact     engångseffekt på öhälsan (= tidigare oh).
//   asset      bildnyckel (= id).
//   variants   spelversioner där byggnaden är tillgänglig.
//
// Ordningen per region (smutsig → standard → gron) bevaras, den syns i spelarens hand.

export const BUILDINGS = [
  // ── Oxen (aker) — material-sektor ──
  { id: 'aker_smutsig',  region: 'aker', tier: 'smutsig',  namn: 'Storodling',   cost: { pengar: 8,  material: 0  }, production: { pengar: 0, material: 9 }, impact: -6, asset: 'aker_smutsig',  variants: ['flash', 'mellan', 'skola'] },
  { id: 'aker_standard', region: 'aker', tier: 'standard', namn: 'Växthus',           cost: { pengar: 8,  material: 6  }, production: { pengar: 0, material: 7 }, impact: -3, asset: 'aker_standard', variants: ['flash', 'mellan', 'skola'] },
  { id: 'aker_gron',     region: 'aker', tier: 'gron',     namn: 'Ekogård', cost: { pengar: 14, material: 10 }, production: { pengar: 0, material: 5 }, impact: 3,  asset: 'aker_gron',     variants: ['flash', 'mellan', 'skola'] },

  // ── Björnen (skog) — material-sektor ──
  { id: 'skog_smutsig',  region: 'skog', tier: 'smutsig',  namn: 'Skövling',           cost: { pengar: 8,  material: 0  }, production: { pengar: 0, material: 9 }, impact: -6, asset: 'skog_smutsig',  variants: ['flash', 'mellan', 'skola'] },
  { id: 'skog_standard', region: 'skog', tier: 'standard', namn: 'Sågverk',          cost: { pengar: 8,  material: 6  }, production: { pengar: 0, material: 7 }, impact: -3, asset: 'skog_standard', variants: ['flash', 'mellan', 'skola'] },
  { id: 'skog_gron',     region: 'skog', tier: 'gron',     namn: 'Hållbart skogsbruk',      cost: { pengar: 14, material: 10 }, production: { pengar: 0, material: 5 }, impact: 3,  asset: 'skog_gron',     variants: ['flash', 'mellan', 'skola'] },

  // ── Räven (tundra) — pengar-sektor ──
  { id: 'tundra_smutsig',  region: 'tundra', tier: 'smutsig',  namn: 'Oljefält', cost: { pengar: 0,  material: 8  }, production: { pengar: 9, material: 0 }, impact: -6, asset: 'tundra_smutsig',  variants: ['flash', 'mellan', 'skola'] },
  { id: 'tundra_standard', region: 'tundra', tier: 'standard', namn: 'Fabrik',        cost: { pengar: 6,  material: 8  }, production: { pengar: 7, material: 0 }, impact: -3, asset: 'tundra_standard', variants: ['flash', 'mellan', 'skola'] },
  { id: 'tundra_gron',     region: 'tundra', tier: 'gron',     namn: 'Vindkraft',     cost: { pengar: 10, material: 14 }, production: { pengar: 5, material: 0 }, impact: 3,  asset: 'tundra_gron',     variants: ['flash', 'mellan', 'skola'] },

  // ── Örnen (stad) — pengar-sektor ──
  { id: 'stad_smutsig',  region: 'stad', tier: 'smutsig',  namn: 'Betongstad',     cost: { pengar: 0,  material: 8  }, production: { pengar: 9, material: 0 }, impact: -6, asset: 'stad_smutsig',  variants: ['flash', 'mellan', 'skola'] },
  { id: 'stad_standard', region: 'stad', tier: 'standard', namn: 'Handelsområde',  cost: { pengar: 6,  material: 8  }, production: { pengar: 7, material: 0 }, impact: -3, asset: 'stad_standard', variants: ['flash', 'mellan', 'skola'] },
  { id: 'stad_gron',     region: 'stad', tier: 'gron',     namn: 'Stadskvarter',        cost: { pengar: 10, material: 14 }, production: { pengar: 5, material: 0 }, impact: 3,  asset: 'stad_gron',     variants: ['flash', 'mellan', 'skola'] },
];

// Hand för ett område i spelarens kort-form (= tidigare handFor-utdata). Tillfällig bro som
// motorn/klienten/mocken använder oförändrat. När vi senare filtrerar per version görs det här.
export function buildingsForRegion(regionId) {
  return BUILDINGS.filter(b => b.region === regionId).map(b => ({
    tier: b.tier,
    kp: b.cost.pengar, km: b.cost.material,
    gp: b.production.pengar, gm: b.production.material,
    oh: b.impact,
    namn: b.namn, asset: b.asset,
  }));
}
