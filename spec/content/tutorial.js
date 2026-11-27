// spec/content/tutorial.js — TUTORIAL-BANK (innehåll + flöde som data, ingen DOM/logik).
// Migrerings-Etapp 3 (2026-11-25): tutorialens STEG/TEXTER/ORDNING flyttas ut ur src/ui.js till data,
// per variant. Klienten (src/ui.js) blir en generisk TOLK som renderar stegen. Inget innehåll i motorn.
//
// ⚠ DEN HÄR FILEN RÖR INTE ui.js. Tolken byggs i ui.js i ett SEPARAT steg (efter avstämning med chatten).
//    Tills dess är filen bara data + kontrakt. Mellan-sekvensen nedan är ORDAGRANT dagens runTutorial.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// SCHEMA
//
// Två flödestyper (en variant väljer en):
//   mode: 'sequence' → en LINJÄR tutorial som körs FÖRE spelet (Mellan): ett övningsår, steg för steg.
//   mode: 'coach'    → INGEN separat övning; en kort intro + instruktioner som TRIGGAS av spelfaser/
//                      händelser UNDER det riktiga spelet (Flash). Samma hjälp-block återanvänds av ?-knappen.
//
// Ett STEG (sequence.steps[] och coach-blockens steps[]) är ett objekt:
//   { typ, ... }  där typ ∈:
//     'mission'  helskärms-MÅL (ov-mission), vänta på tryck.
//     'roll'     lag-identitet (ov-roll). Tolken fyller lag-bild; texterna rollDu/rollTxt (mallvariabler).
//     'banner'   kort textbanner (txt, ms).
//     'endBtn'   { on:true|false } tänd/släck AVSLUTA ÅR-knappen.
//     'setup'    { gor:'<namn>' } tolk-registrerad förberedelse mellan steg (t.ex. markera "slå-i-väggen"-kort).
//     'say'      instruktion som LIGGER och sedan går vidare. Fält: txt, ankare, hold?, ms?, ix?.
//                hold:true → NÄSTA-knapp, väntar på tryck (kiosk-säkring). annars auto efter ms.
//     'gate'     TYST "GÖR"-grind: lyser upp ett ankare (t.ex. knappen) och väntar på en spel-händelse
//                (until) UTAN instruktionsruta. autoDo görs åt en övergiven skärm. Fält: ankare, until, autoDo.
//     'beat'     "GÖR"-steg: väntar på en spel-händelse. Fält: txt, ankare, until, autoDo, ix?.
//     'demo'     scriptad coach-hand-demo (ingen ruta). Fält: demo:'byggnadsInfo' → handen låser skärmen,
//                knackar en byggnad på ön (visar dess info), knackar bredvid (stänger), försvinner.
//     'pause'    { ms } kort paus mellan steg (bevarar dagens pacing, t.ex. 650 ms efter bygget).
//     'barrier'  { n } fler-skärms-synk (bara Mellan; tolken reläar via servern, se tutBarrier).
//     'ceremony' avslutande start-ceremoni → RUNDA 1 (bara sequence/Mellan).
//     'help'     { ref:'<id>' } visa ett återanvändbart block ur HELP (coach + ?-knapp).
//
// ANKARE (semantiskt, INTE x/y i innehållet): ankare:'<namn>'. Tolken slår upp namnet i ANCHORS →
//   { sel, x, y, side? }. ANCHORS håller dagens EXAKTA Mellan-positioner så beteendet bevaras under
//   migreringen; de kan senare göras relativa (placering utifrån elementet) utan att röra innehållet.
//
// MALLVARIABLER i txt (tolken ersätter mot state): {rounds} {threshold} {lagNamn} {terrain}
//   {sektorNamn} {sektorIco} {inkomst} {prodIco} {konsekvens} {bytIco} {saknarIco} {fickBelopp} {inkomstK} {fickK}. (Se KONTRAKT nedan.)
//
// TOLK-KONTRAKT (det ui.js-tolken MÅSTE tillhandahålla — namnen refereras ovan):
//   anchors:   se ANCHORS-exporten.
//   tokens:    rounds, threshold, lagNamn, terrain, sektorNamn, sektorIco, inkomst, prodIco,
//              konsekvens (hela neg/pos-meningen inkl. ikon), bytIco.
//   until:     'build'(eget bygge) · 'tradeOpen'(bytesrutan öppen) · 'tradeDone'(eget byte) ·
//              'roundEnd' · 'settled'(bokslut+priser klara, !running).
//   autoDo:    'byggSmutsig'(köp billigaste tillåtna) · 'oppnaByt'(öppna byte mot partner) ·
//              'bekraftaByt'(öppna+FÖRESLÅ BYTET) · 'avslutaAr'(klicka AVSLUTA ÅR).
//   setup:     'markeraVagg'(lys "saknar X → BYT" på kort man inte har råd med) · 'rensaVagg'.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// Semantiska ankare → dagens exakta Mellan-koordinater (PRESENTATION; bevarar nuvarande beteende).
// (Kan flyttas till ui.js eller göras relativa senare — innehållet nedan refererar bara namnen.)
export const ANCHORS = {
  ar:        { sel: '#roundnum',   x: 300,  y: 190 },
  matare:    { sel: '.ohbar',      x: 520,  y: 190 },
  byggkort:  { sel: '.handbar',    x: 520,  y: 588 },
  prodBox:   { sel: null,          x: 412,  y: 300 },   // sel sätts av tolken: #box-pengar/#box-material
  topbar:    { sel: '.topbar',     x: 420,  y: 160 },
  on:        { sel: '.col-island', x: 520,  y: 420 },
  karta:     { sel: '.col-island', x: 690,  y: 676 },   // liten ruta nedanför ön (handen-demon)
  sektor:    { sel: '#me-sektor',  x: 300,  y: 330 },
  byt1:      { sel: '#btn-trade',  x: 408, y: 490 },     // "Du saknar…"-rutan (lyser upp BYT-knappen)
  bytKnapp:  { sel: '#btn-trade',  side: 'right' },      // visas BESIDE knappen (ingen fast x/y)
  bytForslag:{ sel: null,          x: 1180, y: 150 },
  getBox:    { sel: null,          x: 300,  y: 300 },    // sel sätts av tolken: #box-pengar/#box-material
  minruta:   { sel: '.col-me',     x: 412,  y: 300 },    // HELA vänsterpanelen (lag + pengar + material) — tänds så man ser siffrorna ändras
  telefon:   { sel: null,          x: 1130, y: 270 },
  coach:     { sel: null,          x: 1210, y: 640 },
  orad:      { sel: null,          x: 1210, y: 640 },
  avsluta:   { sel: '#endwrap',    x: 1590, y: 650 },
};

// Återanvändbara hjälp-block (coach-popups i Flash + ?-knappens meny). EN text per sak → ingen duplicering.
// Flash-coachen och ?-knappen refererar dessa via id. (Fylls ut i Flash-steget; stubbar nu.)
export const HELP = {
  bygg:        { titel: 'Bygg', ankare: 'byggkort',
                 txt: 'Välj ett kort och bygg. <b>Smutsigt</b> är billigt men <b>sänker ön</b>; <b>grönt</b> är dyrt men skonar den.' },
  konsekvens:  { titel: 'Konsekvens', ankare: 'topbar',
                 txt: 'Ditt bygge ger dig inkomst varje år — men påverkar <b>öns hälsa</b>. Notan för smutsigt delar alla fyra.' },
  handel:      { titel: 'Byt', ankare: 'bytKnapp',
                 txt: 'Du tjänar bara EN valuta men behöver den andra för att bygga. <b>Byt med ett annat lag.</b>' },
  orad:        { titel: 'Ö-rådet', ankare: 'orad',
                 txt: 'Efter varje år hålls <b>Ö-råd</b>: ett beslut som påverkar hela öns hälsa.' },
  avsluta:     { titel: 'Avsluta år', ankare: 'avsluta',
                 txt: 'När ni är klara: tryck <b>AVSLUTA ÅR</b> för att gå vidare till bokslutet.' },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// VARIANTERNAS TUTORIALFLÖDEN
// ─────────────────────────────────────────────────────────────────────────────────────────────
export const TUTORIALS = {

  // ── MELLAN: sammanhängande övningsår FÖRE spelet (ordagrant dagens runTutorial). ──
  mellan: {
    mode: 'sequence',
    steps: [
      // Hela intro-sekvensen (kartskärm → CENTRALMAKTEN → DU ÄR → ERT UPPDRAG med {rounds} år) ligger i ui.js runIntro.
      { typ: 'mission' },

      { typ: 'setup', gor: 'nollaTimer' },
      { typ: 'banner', txt: 'ÖVNING — ÅR 0', ms: 1400 },
      { typ: 'endBtn', on: false },

      // 1) BYGG (gör) — det billiga lockar
      { typ: 'beat', ix: 0, ankare: 'byggkort', ic: 'bygge',
        txt: 'Välj ett kort',
        until: 'build', autoDo: 'byggSmutsig' },
      { typ: 'pause', ms: 650 },

      // 2) SE KONSEKVENSEN
      { typ: 'say', ix: 0, ankare: 'prodBox',
        txt: '<span class="lbl">Byggt!</span> {inkomstK} {prodIco} <span class="per">/ år</span>' },
      { typ: 'say', ix: 0, ankare: 'topbar', ohReveal: true,     // TUTORIAL-ONLY: baren sjunker NÄR den här rutan poppar (ej vid bokslutet)
        txt: '{konsekvens}' },                                  // tolken bygger siffra + ikon + "Alla delar…" ur byggt kort

      { typ: 'barrier', n: 1 },

      // 3) SLÅ I VÄGGEN → BYT (beroendet upptäcks)
      { typ: 'setup', gor: 'markeraVagg' },
      // "Du saknar X → byt" lyser upp BYT VALUTOR-knappen och FÖRSVINNER när man trycker på den (ingen
      // NÄSTA). Sedan ett TYST gate (ingen ruta) som väntar in att bytet faktiskt görs i modalen.
      { typ: 'beat', ix: 1, ankare: 'byt1',
        txt: 'Du saknar {saknarIco} <span class="arr">→</span> byt',
        until: 'tradeOpen', autoDo: 'oppnaByt' },
      { typ: 'gate', until: 'tradeDone', autoDo: 'bekraftaByt' },
      { typ: 'setup', gor: 'rensaVagg' },
      { typ: 'pause', ms: 500 },
      // Ingen automatisk handrörelse: ruta med handikon som väntar på att man trycker på en byggnad. Handen pekar först efter 10 s utan tryck (som övriga steg).
      { typ: 'beat', ix: 1, ankare: 'karta', ic: 'hand', txt: 'Tryck på en byggnad',
        until: 'buildingInfo', autoDo: 'visaByggnad', nudge: 'g[data-building][style*="pointer"]' },   // 2 s upplyst info-ruta sköts i buildingInfo
      { typ: 'say', ix: 2, ankare: 'telefon', ic: 'telefon',
        txt: 'Ring de andra lagen' },

      { typ: 'barrier', n: 2 },
      { typ: 'barrier', n: 3 },                                  // (gamla politik-steget borttaget)

      // 4) COACH-TIPS + ÖRÅD
      { typ: 'say', ix: 2, ankare: 'coach', ic: 'coach',
        txt: 'Fråga coachen' },
      { typ: 'say', ix: 3, ankare: 'orad', ic: 'orad',
        txt: 'Efter varje år: öråd' },

      // 5) AVSLUTA & BOKSLUT (alla tre priser lärs ut), sedan på riktigt
      { typ: 'endBtn', on: true },
      { typ: 'beat', ix: 3, ankare: 'avsluta',
        txt: 'Klar? Tryck<br>AVSLUTA ÅR',
        until: 'roundEnd', autoDo: 'avslutaAr' },
      { typ: 'say', hidden: true, until: 'settled' },            // vänta ut bokslut + prisutdelning (ingen ruta)

      { typ: 'barrier', n: 4 },
      { typ: 'ceremony' },                                        // redo → nedräkning → RUNDA 1
    ],
  },

  // ── FLASH: INGET övningsår — coachning (inforuta + hand) ovanpå det RIKTIGA år 1. ──
  // Beslut (Klara 2026-11-25): Flash kör Mellans intro + ceremoni (ERT UPPDRAG = 4 år), INGET övningsår.
  // Sedan SAMMA rutor som tutorialen på det riktiga år 1 (flashCoach-runtimen i src/ui.js):
  //   1) "Bygg en byggnad" + hand på korten → (eget bygge)
  //   2) skärmen låses: popup inkomst↑ sedan öns hälsa↓
  //   3) efter ~10 s: hand på BYT VALUTOR-knappen + "Byt", försvinner när knappen klickas.
  // År 1:s byggfas +30 s (spec/config/variants/flash.js firstYearBonusSec) för att hinna med coachningen.
  flash: {
    mode: 'coach',
    intro: [
      { typ: 'mission' },   // kontrollrum → CENTRALMAKTEN → DU ÄR → ERT UPPDRAG (4 år) → ceremoni (runTutorial)
    ],
    // runtimen (flashCoach) lyssnar på roundStart år 1 + eget bygge; texterna sätts där (samma som tutorialen).
    coach: [
      { on: 'firstBuildPhase', do: 'bygg',       once: true },   // "Bygg en byggnad" + hand på korten
      { on: 'afterFirstBuild', do: 'konsekvens', once: true },   // lås skärm: inkomst↑ + öhälsa↓
      { on: 'afterConsequence', do: 'byt',       once: true },   // ~10 s senare: hand på BYT + "Byt"
    ],
    // ?-knappens meny (återanvänder HELP-block — ingen duplicerad text).
    help: ['bygg', 'konsekvens', 'handel', 'orad', 'avsluta'],
  },

  // ── SKOLA: lämnas tills vidare (ärver tills dess Mellan-flödet via mode: 'tutorial'). ──
};

// Hämta en variants tutorial-flöde (eller null om varianten inte har någon).
export function tutorialFor(variantId) {
  return TUTORIALS[variantId] || null;
}
// Hämta ett återanvändbart hjälp-block (coach/?-knapp).
export function helpById(id) {
  return HELP[id] || null;
}
