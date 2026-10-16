/**
 * game-numbers.js — bygger ett KOMPAKT svenskt "AKTUELLA SPELSIFFROR"-block
 * genom att IMPORTERA de faktiska balansvärdena ur spelets regel-MODUL
 * (spec/engine.js). Detta är sanningen; inga siffror handkopieras.
 *
 * VIKTIGT: Detta importerar bara regel-MODULEN (ren data/logik, ingen DOM,
 * inget nätverk). Coachen pratar fortfarande INTE med spelservern (server.js)
 * eller spelets WebSocket — den är fristående.
 *
 * Allt som behövs exporteras redan av engine.js:
 *   DEFAULT_CONFIG, AREAS, EVENT_CONFIG, EVENTS, handFor()
 * handFor(areaId) ger kort-tiers (smutsig/standard/grön) med kp/km/gp/gm/oh,
 * så MATERIAL_HAND/PENGAR_HAND/NAMES behöver inte exporteras separat.
 */
import { DEFAULT_CONFIG, AREAS, EVENT_CONFIG, EVENTS, handFor } from '../../spec/engine.js'

const sign = (n) => (n >= 0 ? `+${n}` : `${n}`)

function fmtCost(card) {
  const parts = []
  if (card.kp) parts.push(`${card.kp} pengar`)
  if (card.km) parts.push(`${card.km} material`)
  return parts.length ? parts.join(' + ') : 'gratis'
}
function fmtIncome(card) {
  const parts = []
  if (card.gp) parts.push(`+${card.gp} pengar/runda`)
  if (card.gm) parts.push(`+${card.gm} material/runda`)
  return parts.length ? parts.join(', ') : 'ingen inkomst'
}
function fmtHand(areaId) {
  // En representativ area per sektor räcker — siffrorna är lika inom sektorn.
  return handFor(areaId)
    .map((c) => `  • ${c.tier.toUpperCase()}: kostar ${fmtCost(c)} → ${fmtIncome(c)} → öhälsa ${sign(c.oh)}`)
    .join('\n')
}

function fmtEvent(ev) {
  const eff = []
  if (ev.pengar) eff.push(`${sign(ev.pengar)} pengar`)
  if (ev.material) eff.push(`${sign(ev.material)} material`)
  if (ev.egenValuta) eff.push(`${sign(ev.egenValuta)} egen valuta`)
  if (ev.pengarTillJa) eff.push(`+${ev.pengarTillJa} pengar till ja-röstare`)
  if (ev.oh) eff.push(`öhälsa ${sign(ev.oh)}`)
  const typ = ev.typ === 'rost' ? 'omröstning' : 'slår automatiskt'
  const traffar = ev.traffar ? `träffar ${ev.traffar}` : 'hela ön'
  return `  • ${ev.rubrik} (${typ}, ${traffar}): ${eff.join(', ') || 'ingen direkt effekt'}`
}

/** Returnerar hela sifferblocket som text, genererat ur engine.js. */
export function buildNumbersBlock() {
  const c = DEFAULT_CONFIG

  const materialArea = AREAS.find((a) => a.sektor === 'material')
  const pengarArea = AREAS.find((a) => a.sektor === 'pengar')

  const sektorRader = AREAS.map(
    (a) => `  • ${a.namn} (${a.sektor === 'material' ? 'tjänar MATERIAL' : 'tjänar PENGAR'})`,
  ).join('\n')

  return `════════ AKTUELLA SPELSIFFROR (auto-genererat ur spec/engine.js — ändra reglerna där, starta om servern) ════════

GRUNDREGLER
  • Antal rundor: ${c.rounds} (ca ${c.timerSec} sek/runda; de första ${c.earlyRounds} rundorna ${c.timerSecEarly} sek för inlärning).
  • Start per lag: ${c.startPengar} pengar, ${c.startMaterial} material.
  • Öns hälsa: ${c.ohStart} vid start, skala 0–${c.ohMax}. Röd zon under ${c.redZone} (kris), grön zon över ${c.greenZone}.
  • Vid kris (röd zon) kan katastrof slå varje runda: alla förlorar ${c.eventLoss} pengar + ${c.eventLoss} material.
  • VINNA: efter runda ${c.rounds} måste öns hälsa vara MINST ${c.threshold} → då vinner RIKASTE laget (pengar + material). Under ${c.threshold} → ALLA förlorar. Når hälsan 0 → direkt kollaps, alla förlorar.

LAGEN (tjänar bara en valuta, behöver båda → måste byta)
${sektorRader}

HANDEN — 3 val/runda (siffror lika inom sektorn)
MATERIAL-lagen (t.ex. ${materialArea.namn}):
${fmtHand(materialArea.id)}
PENGAR-lagen (t.ex. ${pengarArea.namn}):
${fmtHand(pengarArea.id)}

POLITIK (ett förslag/runda, kräver 3 av 4 JA)
  • Grön satsning: alla ja-röstare betalar ${c.gronCost} pengar → öns hälsa +${c.gronGain}.
  • Miljöskatt: värsta boven betalar ${c.taxAmount} pengar, delas lika mellan de andra.
  • Förbjud smutsigt: nästa runda kan ingen välja det smutsiga kortet.

HÄNDELSER (chans ${Math.round(EVENT_CONFIG.chansPerRunda * 100)}%/runda i auto-läge, utan återläggning: ${EVENT_CONFIG.utanAterlaggning ? 'ja' : 'nej'})
${EVENTS.map(fmtEvent).join('\n')}`
}
