// spec/kroning.js — KRÖNINGSCEREMONIN: gemensam tidslinje + data. Ren modul (ingen DOM/nät).
// Samma tidslinje läses av skärmen (src/kroning.js) och servern (riggens steg) → bild, ljus och ljud i takt.
// Design: design/kroning-forslag.html (Klara 2026-11-27). Tider i sekunder från ceremonins start.

export const LAG_ORDNING = ['skog', 'aker', 'tundra', 'stad'];   // samma ordning som emblemen på väggen (vänster → höger)
export const DUELL_SEK = 5.2;

// Data ur motorns slutläge + gameEnd. placering: sämst först; vinnaren (motorns winner) alltid sist.
export function kroningData(state, ge) {
  const vinnare = ge?.winner?.teamId || null;
  const placering = (state?.teams || [])
    .map(t => ({ teamId: t.id, namn: t.namn, kapital: t.pengar + t.material }))
    .sort((a, b) => (a.teamId === vinnare) - (b.teamId === vinnare) || a.kapital - b.kapital);
  return {
    vunnet: !!(ge?.won && vinnare), vinnare, oh: ge?.oh ?? state?.oh ?? 0, mal: ge?.threshold ?? 60,
    ar: state?.round ?? 8, placering, bov: ge?.klimatbov || null,
  };
}

// Steglista [{ t, steg, lag? }] för utfallet.
export function kroningSteg(d) {
  const s = [];
  const at = (t, steg, extra) => s.push({ t, steg, ...extra });
  at(0.3, 'rum');
  at(2, 'meddelande');
  at(7, 'meddelande_bort');
  at(8, 'rakna');                          // öns hälsa räknas upp (5,5 s)
  at(14.1, d.vunnet ? 'overlevde' : 'foll');
  if (!d.vunnet) {
    at(20, 'slack');                       // lamporna blinkar ut
    at(21.5, 'vagg');                      // den mörka emblemväggen (inget emblem tänds)
    at(24.2, 'ingen');                     // INGEN BLIR BORGMÄSTARE
    at(25.9, 'dampa');
    at(27.5, 'on_dod');                    // bilden av ön + saftblandaren
    at(30.4, 'on_foll');
    at(32.5, 'lugn');
    at(35.9, 'kort');
    return s;
  }
  const [fyra, tre, tva, ett] = d.placering.map(p => p.teamId);
  at(20.5, 'slack');
  at(22, 'vagg');
  LAG_ORDNING.forEach((lag, i) => at(24.8 + i * 0.7, 'tand', { lag }));
  at(30.3, 'ut', { lag: fyra, plats: 4 });
  at(33.3, 'ut', { lag: tre, plats: 3 });
  at(35.3, 'duell', { lag: [tva, ett] });  // ljuset hoppar mellan de två sista
  at(40.9, 'ut', { lag: tva, plats: 2 });
  at(40.9, 'kvar', { lag: ett, plats: 1 });
  at(44.3, 'blixt', { lag: ett });
  at(45.2, 'krona', { lag: ett });
  at(53.3, 'kort');
  return s;
}

export const kroningLangd = d => kroningSteg(d).at(-1).t;

// Duellens hopp: tidpunkter (s efter duellens start) då ljuset byter sida, snabbare och snabbare.
export function duellHopp() {
  const ut = [];
  for (let t = 0, d = 0.55; t < DUELL_SEK; t += d, d = Math.max(0.16, d * 0.92)) ut.push(+t.toFixed(3));
  return ut;
}
