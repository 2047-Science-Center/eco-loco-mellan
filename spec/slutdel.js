// slutdel.js — Eco Loco (Mellan): spelledarstegad SLUTDEL (podium + reveal).
// REN DATA + en liten byggfunktion. Läses LIVE av servern (samma anda som EVENTS i engine.js):
// Josef & Klara redigerar frågor, svarsalternativ och reveal-texter DIREKT här — inget i logiken.
//
// INGA rätta svar i podiet — bara fördelning. Marker på skärmarna färgas efter LAGFÄRG (AREAS.farg).
// Servern är auktoritativ: den bygger den ordnade steglistan och stegar via ecoloco/spel/gm
// (SLUTDEL START + NÄSTA, samma takt som award_next). Institutets röst läses i centralhögtalaren.
//
// Version 'A' (byggd nu) = PODIUM (q1–q6) följt av Newfoundland (nf1–nf3).
// Version 'B' (framtid)  = SAMMA podium + fler REVEAL-kort (El Hierro + återkoppling till lagets
//   EGEN session, läst ur <sessionId>.summary.json). Se stubbarna + VERSIONS nedan: version B blir
//   bara fler kort i listan + läsning ur summary — INTE en ombyggnad.

// ═══════════════ PODIUM — 6 frågor, inga rätta svar ═══════════════
// Fält per fråga: id, fraga, options[], bild:'assets/slutdel/<id>.png'.
export const PODIUM = [
  { id: 'q1', fraga: 'Hur gick det egentligen för ön under ert styre?',
    options: ['Blomstrande', 'Vi klarade oss', 'Vi tänjde på gränsen', 'Fråga inte'],
    bild: 'assets/slutdel/q1.png' },

  { id: 'q2', fraga: 'Vem bär ansvaret för hur ön mår nu?',
    options: ['Vårt lag', 'De andra lagen', 'Centralmakten', 'Reglerna', 'Ingen'],
    bild: 'assets/slutdel/q2.png' },

  { id: 'q3', fraga: 'De andra lagen — var de motståndare eller grannar?',
    options: ['Motståndare', 'Grannar', 'Det växlade', 'Fattade aldrig'],
    bild: 'assets/slutdel/q3.png' },

  { id: 'q4', fraga: 'När erbjudandet kom — vad styrde ert ja eller nej?',
    options: ['Vad som gynnade oss', 'Vad som var bäst för ön', 'Vad de andra skulle göra', 'Magkänsla'],
    bild: 'assets/slutdel/q4.png' },

  { id: 'q5', fraga: 'Gick det ens att vinna utan att ön fick betala?',
    options: ['Ja, vi missade det', 'Nej, reglerna tillät inte', 'Kanske, med mer tid', 'Vi brydde oss inte om att vinna'],
    bild: 'assets/slutdel/q5.png' },

  { id: 'q6', fraga: 'Vad liknar det här mest?',
    options: ['Internationell politik', 'Näringslivet', 'Skolans grupparbete', 'Nej, bara ett spel'],
    bild: 'assets/slutdel/q6.png' },
];

// ═══════════════ REVEAL — kort/beats (stegas av GM, Institutets röst i centralhögtalaren) ═══════════════
// En lista av kort så nya versioner bara är FLER kort. Fält:
//   id, typ ('reveal' = rubrik/text/bild · 'regi' = spelledartext, visas som regi, läses EJ automatiskt)
//   rubrik?, text?, bild?, ljud? (central-rigg-ljud, spelas via src/rigg.js om satt),
//   spelledartext? (endast typ:'regi'), version? ('B' = ingår inte i version A:s steglista).
export const REVEAL = [
  // ——— Newfoundland (version A) ———
  { id: 'nf1', typ: 'reveal', rubrik: 'Meddelande från en annan ö',
    text: 'Nordatlanten, för inte så länge sedan. En ö levde på torsken. Varje båt fiskade så ' +
          'mycket den kunde — klokt, för sin egen familj. Ingen ville vara den som slutade först.',
    bild: 'assets/slutdel/newfoundland.png',   // placeholder nu; slot för foto/20–30s-klipp sen
    ljud: null },

  { id: 'nf2', typ: 'reveal',
    text: 'En säsong var fisken borta. Tiotusentals jobb med den. Trettio år senare har den inte ' +
          'kommit tillbaka.',
    bild: 'assets/slutdel/newfoundland.png',
    ljud: null },

  { id: 'nf3', typ: 'regi',
    spelledartext: 'Varenda båt hade rätt. Tillsammans hade de fel. — Känns det igen?' },

  // ——— TODO(version B): stubbar — ingår INTE i version A:s steglista (se VERSIONS) ———
  // El Hierro: en ö som gick ÅT ANDRA HÅLLET (100 % förnybart, gemensamt beslut). Kontrast till Newfoundland.
  { id: 'elHierro', typ: 'reveal', version: 'B', rubrik: 'En ö som valde annorlunda',
    text: 'TODO(version B): El Hierro — skriv in berättelsen om ön som gick samman och klarade det. ' +
          'Lägg bild/klipp i assets/slutdel/elhierro.png.',
    bild: 'assets/slutdel/elhierro.png', ljud: null },

  // Din-session: återkoppling till lagets EGEN ö, läst ur <sessionId>.summary.json (podie + utfall).
  { id: 'dinSession', typ: 'callback', version: 'B', rubrik: 'Och er egen ö?',
    text: 'TODO(version B): läs ur summary.json och spegla tillbaka lagets egna val — slutöhälsa, ' +
          'vem som tjänade mest, hur podiet svarade. Rendera som ett eget reveal-kort.' },
];

// ═══════════════ Versioner → ordnad steglista ═══════════════
// En version pekar ut vilka podiefrågor och reveal-kort som ingår, i ordning.
// Version B = samma podium + fler reveal-id:n ['nf1','nf2','nf3','elHierro','dinSession'] (inte byggd).
export const VERSIONS = {
  A: { podium: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'], reveal: ['nf1', 'nf2', 'nf3'] },
};

// Bygg den ordnade steglistan för en version: [ ...frågor, ...reveal-kort ].
// Varje steg får ett 'kind' ('question' | 'reveal') så servern/skärmen vet hur det ska visas.
export function buildSlutdel(version = 'A') {
  const v = VERSIONS[version] || VERSIONS.A;
  const qById = Object.fromEntries(PODIUM.map(q => [q.id, q]));
  const rById = Object.fromEntries(REVEAL.map(r => [r.id, r]));
  return [
    ...v.podium.map(id => ({ kind: 'question', ...qById[id] })),
    ...v.reveal.map(id => ({ kind: 'reveal', ...rById[id] })),
  ].filter(s => s.id);   // hoppa över id:n som saknar definition (robusthet vid redigering)
}
