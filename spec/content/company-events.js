// spec/content/company-events.js — PRESTATIONSBASERADE FÖRETAGSHÄNDELSER (innehåll, ingen logik).
// Fem händelser i huvudkategorin `foretag`, utlösta av ett företags handlingar/ekonomi (inte av ett
// specifikt område som miljökriserna i company-crises.js). Aktiva i Mellan + Skola (cfg.features
// .companyEvents), ALDRIG i Flash. Triggas under byggfasen; delar kö + 10 s-paus med miljökriserna.
//
// ⚠ ALLA tröskelvärden och belopp är PRELIMINÄRA (se att-göra: "BALANSERING AV HÄNDELSER").
//
// Fält:
//   id        stabilt id (matchar ev. assets/event_<id>.png + ljud). gronafonden/uppror återanvänder
//             de befintliga id:na i events.js (men EGNA, nya effekter här) → i Mellan/Skola tas de ur
//             slumppoolen och ersätts av dessa prestationstriggers. Flash behåller slump-versionen.
//   namn/text kort presentation (samma stil som miljökriserna).
//   warn      true = negativ (röd ram), false = positiv belöning (neutral/grön ram).
//   reward    { pengar, material } ELLER { huvudresurs } (huvudresurs = lagets sektor: material för
//             Oxen/Björnen, pengar för Räven/Örnen). Negativa tal = förlust.
//   ohalsa    öhälsoförändring (0 för alla utom Uppror).
//   trigger   villkorsdata (tröskar). LOGIKEN ligger i motorn (_checkCompanyAchievements).

export const COMPANY_EVENTS = [
  { id: 'gronafonden',      namn: 'GRÖNA FONDEN',     text: 'Företagets miljösatsningar belönas!',              warn: false, reward: { pengar: 5 },               ohalsa: 0,  trigger: { typ: 'gronTotal', n: 3 } },
  { id: 'uppror',           namn: 'UPPROR',           text: 'Folket protesterar mot de växande ekonomiska klyftorna!', warn: true, reward: { pengar: -15, material: -10 }, ohalsa: -3, trigger: { typ: 'rikast', margin: 30 } },
  { id: 'expansion',        namn: 'EXPANSION',        text: 'Företaget växer så det knakar!',                    warn: false, reward: { huvudresurs: 5 },          ohalsa: 0,  trigger: { typ: 'byggenPerAr', n: 3 } },
  { id: 'gronomstallning',  namn: 'GRÖN OMSTÄLLNING', text: 'Företaget byter kurs och satsar på miljön!',       warn: false, reward: { pengar: 5 },               ohalsa: 0,  trigger: { typ: 'gronOmstallning', skadliga: 2, streak: 2 } },
  { id: 'framtidsvisionar', namn: 'FRAMTIDSVISIONÄR', text: 'Trots motgångar satsar företaget på öns framtid!', warn: false, reward: { pengar: 5, material: 5 },    ohalsa: 0,  trigger: { typ: 'framtidsvisionar', streak: 2 } },
  // GEMENSAM: träffar ALLA fyra lag (inte ett enskilt företag). Alla fyra bygger ≥1 grön/år → alla
  // får +5 huvudresurs. reward.huvudresurs beräknas per lag (material för Oxen/Björnen, pengar för Räven/Örnen).
  { id: 'gemensamsatsning', namn: 'GEMENSAM SATSNING', text: 'För en gångs skull drar alla företag åt samma håll!', warn: false, reward: { huvudresurs: 5 }, ohalsa: 0, trigger: { typ: 'gemensam', allaGronPerAr: 1 } },
];

export const COMPANY_EVENT_IDS = COMPANY_EVENTS.map(e => e.id);
export const companyEventById = id => COMPANY_EVENTS.find(e => e.id === id) || null;
