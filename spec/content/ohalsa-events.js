// spec/content/ohalsa-events.js — ÖHÄLSOHÄNDELSER (innehåll, ingen logik).
// Kategori 'ohalsa': utlöses automatiskt av öns hälsa (tröskel) eller dess nettoförändring under året
// (Miljölyft). Aktiva i versioner med cfg.features.ohalsaEvents (alla tre); complex-händelser (Resursbrist)
// kräver dessutom cfg.features.complexEvents (bara Skola). Delar kö + 10 s-paus med företagshändelserna.
//
// ⚠ ALLA gränsvärden och effekter är PRELIMINÄRA (se att-göra: "BALANSERING AV HÄNDELSER").
//
// Fält:
//   id        stabilt id. 'storm' återanvänder den gamla händelsens id/bild — den gamla AUTOMATISKA
//             storm-effekten ersätts av denna (gamla tas ur slumppoolen när ohalsaEvents är på).
//   namn/text kort presentation (samma stil som företagshändelserna).
//   warn      true = negativ (röd ram), false = positiv.
//   complex   true = bara i Skola (cfg.features.complexEvents).
//   reward    { huvudresurs } per lag (material för Oxen/Björnen, pengar för Räven/Örnen). Negativ = förlust.
//             Tom {} = ingen omedelbar resurseffekt (Resursbrist verkar via produktionsminskning).
//   ohalsa    öhälsoförändring — 0 för samtliga (positiva händelser ger ALDRIG extra öhälsa; §8).
//   trigger   villkorsdata; LOGIKEN ligger i motorn (spec/engine.js):
//               { typ:'troskel', riktning:'upp'|'ned', niva }   öhälsa ≥ (upp) / ≤ (ned) niva
//               { typ:'miljolyft', netto }                       öhälsans NETTO under året ≥ netto (vid bokslut)
//               { typ:'resursbrist', pa, av }                    aktiveras ≤ pa, upphör ≥ av (långvarig)

export const OHALSA_EVENTS = [
  { id: 'naturenblomstrar', namn: 'FISKEN ÄR TILLBAKA', text: 'Naturen återhämtar sig — ekosystemet blomstrar igen!',     warn: false, complex: false, reward: { huvudresurs: 5 },  ohalsa: 0, trigger: { typ: 'troskel', riktning: 'upp', niva: 70 } },
  { id: 'miljolyft',        namn: 'MILJÖLYFT',         text: 'Öns miljö har förbättrats rekordmycket! Framtiden ser ljus ut!', warn: false, complex: false, reward: { huvudresurs: 3 },  ohalsa: 0, trigger: { typ: 'miljolyft', netto: 15 } },
  { id: 'varmebolja',       namn: 'VÄRMEBÖLJA',        text: 'Extremvärme drabbar ön!',                                     warn: true,  complex: false, reward: { huvudresurs: -3 }, ohalsa: 0, trigger: { typ: 'troskel', riktning: 'ned', niva: 35 } },
  { id: 'resursbrist',      namn: 'RESURSBRIST',       text: 'Öns naturresurser sinar! Produktionen minskar.',              warn: true,  complex: true,  reward: {},                 ohalsa: 0, trigger: { typ: 'resursbrist', pa: 30, av: 40 } },
  { id: 'storm',            namn: 'STORM',             text: 'Kraftiga stormar drar in över ön!',                           warn: true,  complex: false, reward: { huvudresurs: -5 }, ohalsa: 0, trigger: { typ: 'troskel', riktning: 'ned', niva: 27 } },
];

export const OHALSA_EVENT_IDS = OHALSA_EVENTS.map(e => e.id);
export const ohalsaEventById = id => OHALSA_EVENTS.find(e => e.id === id) || null;
