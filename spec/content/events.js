// spec/content/events.js — RÖST-ERBJUDANDEN (individuell ja/nej), ingen logik.
//
// Det GAMLA FULLT SLUMPADE händelsesystemet (EVENT_CONFIG + 'auto'-händelserna storm/skogsbrand/
// uppror/torka/godskord/gronafonden/marknadskrasch som drogs slumpmässigt varje år) är BORTTAGET
// 2026-11-19. Händelser kommer nu BARA ur de tre kategorierna foretag (company-crises/-events),
// ohalsa (ohalsa-events) och gm (gm-events). De gamla auto-händelsernas motsvarigheter lever vidare
// där (t.ex. skogsbrand → company-crises `skog_major`, marknadskrasch → gm `gm_marknadskrasch`).
//
// KVAR här: 'rost'-erbjudanden — individuella ja/nej-frestelser som Ö-rådets beslutspool kan dra
// (dilemmas.js + dessa). `sponsrat` är det enda i drift (Flash Ö-råd). Fältreferens:
//   id          stabilt ID (matchar ljud-nyckel event_<id> + assets/event_<id>.png). ÄNDRA ALDRIG.
//   typ         'rost' → varje lag röstar själv (individuell frestelse).
//   pengarTillJa pengar till varje ja-röstare. oh  öhälsoförändring (hela ön om minst ett ja).
//   rostFraga   frågetext vid röst-händelse. rubrik/text presentationstext. ljud  central-rigg-ljud.
//   category/tags/eligibility  styr Ö-rådets urval (spec/systems/proposal-selector.js).

export const EVENTS = [
  { id:'sponsrat', typ:'rost', category:'mojlighet', pengarTillJa:15, oh:-6, rostFraga:'Ska ön anta koncernens erbjudande?', rubrik:'Ett erbjudande ni knappast kan tacka nej till', text:'En vänligt sinnad koncern vill investera i ön — mot att vi blundar för lite smuts. Rösta nu: tar ni pengarna?', ljud:'assets/audio/rigg/event_sponsrat.mp3' },
];
