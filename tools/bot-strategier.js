// tools/bot-strategier.js — DELAD bot-/strategilogik för Eco Locos analysverktyg.
// Extraherad ur tools/simulera.js 2026-11-18 så att simulera.js OCH tools/mellan-analys.js
// använder EXAKT samma strategier (ingen risk att de glider isär). Ingen spel-/balanslogik här —
// bara hur en bot VÄLJER kort, HUR MÅNGA den bygger och hur 1:1-handeln provas. Reglerna/värdena
// ligger kvar i spec/engine.js + spec/content.

// — seedad PRNG (mulberry32) → reproducerbara frön (samma seed = samma parti) —
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// — 1:1-byteshandel: skaffa valutan som saknas från ett lag med överskott (som mock-opponents).
// stats är valfritt (räknar byten/volym när det finns). Returnerar om laget nu har råd med kp/km. —
export function tryTrade(engine, t, kp, km, stats) {
  const S = engine.getState();
  for (const cur of ['pengar', 'material']) {
    const need = (cur === 'pengar' ? kp : km) - t[cur];
    if (need > 0) {
      const other = cur === 'pengar' ? 'material' : 'pengar';
      const seller = S.teams.find(x => x.id !== t.id && x[cur] - need >= 6 && t[other] >= need);
      if (seller && engine.transfer(t.id, seller.id, need, other, need, cur).ok) {
        if (stats) { stats.trades[t.id]++; stats.tradeVol[t.id] += need; }
      }
    }
  }
  return t.pengar >= kp && t.material >= km;
}

// — EXPANSIONSAPPETIT: hur MÅNGA byggen/lag/år, inte VILKET kort (det styr pickOrder).
// Fritt byggande ≠ spendera allt: reserv = lagets minsta önskade kvar-resurs efter ett bygge
// (laget bygger inte om det skulle sjunka under reserven), max = tak/år så loopen inte skenar.
// 'en' = exakt gamla simulatorbeteendet (1/år, ingen reserv) för äpple-mot-äpple-jämförelse.
export const EXP_PROFILES = {
  en:        { max: 1,  reserveP: 0, reserveM: 0, stretch: true  },   // = tidigare simulator (1 bygge/år)
  forsiktig: { max: 2,  reserveP: 6, reserveM: 6, stretch: false },   // bygger bara med god marginal, ingen stretch-handel
  normal:    { max: 4,  reserveP: 2, reserveM: 2, stretch: true  },   // bygger lagom, håller liten reserv
  aggressiv: { max: 10, reserveP: 0, reserveM: 0, stretch: true  },   // bygger tills resurserna tar slut (med handel)
};
export function expProfile(name) { return EXP_PROFILES[name] || EXP_PROFILES.normal; }

// Strategi kan vara tidsberoende: 'vand' = miljöskadligt (girigt) före vändAr, grönt efter
// (för frågan: kan ett företag som börjar smutsigt rädda ön genom att sedan bygga flera gröna/år?).
export function resolveStrat(s, year, vandAr) {
  if (s === 'vand') return year < (vandAr || 99) ? 'girig' : 'gron';
  return s;
}

// Kortprioritet per strategi (bygger på kortets avkastning gp+gm och miljöpåverkan oh).
export function pickOrder(strategy, hand, oh, redZone, rng) {
  const byYield = [...hand].sort((a, b) => (b.gp + b.gm) - (a.gp + a.gm));
  const byOh = [...hand].sort((a, b) => b.oh - a.oh);
  switch (strategy) {
    case 'girig': return byYield;
    // Miljövänlig bygger BARA grönt (bygger inte smutsigt för att spara ihop); har laget inte råd
    // med grönt avstår det hellre än bygger skadligt. Gör "alla gröna" till ett trovärdigt tak.
    case 'gron': return byOh.filter(c => c.oh > 0);
    case 'adaptiv':
      if (oh < redZone + 8) return byOh;
      if (rng() < 0.3) return [hand.find(c => c.oh >= 0) || hand[1], ...byYield].filter(Boolean);
      return byYield;
    default: return [hand.find(c => c.tier === 'standard'), ...hand].filter(Boolean);
  }
}
