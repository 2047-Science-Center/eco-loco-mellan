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
//     'beat'     "GÖR"-steg: väntar på en spel-händelse. Fält: txt, ankare, until, autoDo, ix?.
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
//   {sektorNamn} {sektorIco} {inkomst} {prodIco} {konsekvens} {bytIco}. (Se KONTRAKT nedan.)
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
  byggkort:  { sel: '.handbar',    x: 520,  y: 560 },
  prodBox:   { sel: null,          x: 300,  y: 300 },   // sel sätts av tolken: #box-pengar/#box-material
  topbar:    { sel: '.topbar',     x: 520,  y: 150 },
  on:        { sel: '.col-island', x: 520,  y: 420 },
  sektor:    { sel: '#me-sektor',  x: 300,  y: 330 },
  bytKnapp:  { sel: '#btn-trade',  side: 'right' },      // visas BESIDE knappen (ingen fast x/y)
  bytForslag:{ sel: null,          x: 1180, y: 150 },
  getBox:    { sel: null,          x: 300,  y: 300 },    // sel sätts av tolken: #box-pengar/#box-material
  telefon:   { sel: null,          x: 1140, y: 150 },
  coach:     { sel: null,          x: 520,  y: 380 },
  orad:      { sel: null,          x: 1020, y: 540 },
  avsluta:   { sel: '#endwrap',    x: 1040, y: 760 },
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
      { typ: 'mission' },
      { typ: 'roll',
        rollDu:  'DU ÄR {lagNamn}',
        rollTxt: 'Du ansvarar för <b>{terrain}</b> och producerar <b>{sektorNamn} {sektorIco}</b>.'
               + '<br><br>Kan ditt företag bli öns nästa <b>borgmästare</b>?' },

      { typ: 'say', ix: 0, ankare: 'ar', hold: true,
        txt: '⏱️ <b>Ni har {rounds} år på er!</b><br>Bygg, handla och påverka ön genom <b>politiska beslut</b>.' },
      { typ: 'say', ix: 0, ankare: 'matare', hold: true,
        txt: '🏝️ <b>Men det finns en hake!</b><br>Om <b>öns hälsa sjunker under {threshold}</b> när spelet är slut kollapsar ön. Då förlorar alla – och ingen blir borgmästare!' },

      { typ: 'setup', gor: 'nollaTimer' },
      { typ: 'banner', txt: 'ÖVNING — ÅR 0', ms: 1400 },
      { typ: 'endBtn', on: false },

      // 1) BYGG (gör) — det billiga lockar
      { typ: 'beat', ix: 0, ankare: 'byggkort',
        txt: 'Bygg en byggnad!',
        until: 'build', autoDo: 'byggSmutsig' },
      { typ: 'pause', ms: 650 },

      // 2) SE KONSEKVENSEN
      { typ: 'say', ix: 0, ankare: 'prodBox', ms: 3000,
        txt: 'Byggt! Ger <b>+{inkomst}{prodIco}</b> varje år.' },
      { typ: 'say', ix: 0, ankare: 'topbar', ms: 3400,
        txt: '{konsekvens}' },                                  // tolken bygger neg/pos-meningen ur byggt kort
      { typ: 'say', ix: 0, ankare: 'on',
        txt: 'Klicka på <b>byggnaderna på ön</b> för att se vad som byggts.' },

      { typ: 'barrier', n: 1 },

      // 3) SLÅ I VÄGGEN → BYT (beroendet upptäcks)
      { typ: 'setup', gor: 'markeraVagg' },
      { typ: 'say', ix: 1, ankare: 'sektor',
        txt: 'Du saknar den andra valutan. <b>Byt med ett annat lag.</b>' },
      { typ: 'beat', ix: 1, ankare: 'bytKnapp',
        txt: 'Tryck på den upplysta <b>BYT VALUTOR</b>-knappen.',
        until: 'tradeOpen', autoDo: 'oppnaByt' },
      { typ: 'beat', ix: 1, ankare: 'bytForslag',
        txt: 'Välj lag och tryck <b>FÖRESLÅ BYTET</b>.',
        until: 'tradeDone', autoDo: 'bekraftaByt' },
      { typ: 'setup', gor: 'rensaVagg' },
      { typ: 'pause', ms: 500 },
      { typ: 'say', ix: 1, ankare: 'getBox',
        txt: 'Bytte till dig <b>{bytIco}</b>.' },
      { typ: 'say', ix: 1, ankare: 'telefon',
        txt: 'Förhandla med de andra lagen genom att <b>ringa dem</b> på telefonen.' },

      { typ: 'barrier', n: 2 },
      { typ: 'barrier', n: 3 },                                  // (gamla politik-steget borttaget)

      // 4) COACH-TIPS + ÖRÅD
      { typ: 'say', ix: 3, ankare: 'coach',
        txt: 'Har ni frågor? Vid sidan står en <b>coach</b> som kan reglerna — fråga den när ni vill.' },
      { typ: 'say', ix: 3, ankare: 'orad',
        txt: 'Efter <b>varje år</b> blir det <b>öråd</b>.' },

      // 5) AVSLUTA & BOKSLUT (alla tre priser lärs ut), sedan på riktigt
      { typ: 'endBtn', on: true },
      { typ: 'beat', ix: 3, ankare: 'avsluta',
        txt: 'Klar? Tryck på knappen <b>AVSLUTA ÅR</b>.',
        until: 'roundEnd', autoDo: 'avslutaAr' },
      { typ: 'say', hidden: true, until: 'settled' },            // vänta ut bokslut + prisutdelning (ingen ruta)

      { typ: 'barrier', n: 4 },
      { typ: 'ceremony' },                                        // redo → nedräkning → RUNDA 1
    ],
  },

  // ── FLASH: kort intro + trigger-baserade coach-popups UNDER spelet. INGET övningsår. ──
  // UTKAST (utvecklas i arbetsordningens steg 4, efter att Mellan verifierats). Strukturen är klar:
  // intro[] visas vid start; coach[] knyter hjälp-block till spelfaser/-händelser; ?-knappen visar help[].
  flash: {
    mode: 'coach',
    intro: [
      { typ: 'mission' },
      { typ: 'roll',
        rollDu:  'DU ÄR {lagNamn}',
        rollTxt: 'Du ansvarar för <b>{terrain}</b> och producerar <b>{sektorNamn} {sektorIco}</b>.'
               + '<br><br>{rounds} år. Håll ön över {threshold} — annars förlorar alla.' },
    ],
    // on = spelfas/händelse tolken lyssnar på; ref = HELP-block. (Triggers finslipas i steg 4.)
    coach: [
      { on: 'firstBuildPhase',  ref: 'bygg',       once: true },
      { on: 'afterFirstBuild',  ref: 'konsekvens', once: true },
      { on: 'afterFirstBuild',  ref: 'handel',     once: true },
      { on: 'firstOrad',        ref: 'orad',        once: true },
    ],
    // ?-knappens meny (återanvänder samma HELP-block — ingen duplicerad text).
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
