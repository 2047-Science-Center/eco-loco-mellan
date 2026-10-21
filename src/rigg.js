// rigg.js — Förstärkningsriggen: Eco Loco-motorns events -> semantiska cues (ecoloco/rigg/*).
// REN LÄSARE av motorn (ändrar inga regler). Option A: adaptern äger award-tidslinjen.
// Awards = KUMULATIVA (lästa ur motorns state vid award-tillfället):
//   företagare = mest förmögenhet · sabotör = mest neg öhälsa · eldsjäl = mest pos öhälsa.
// publish är utbytbar: console.log i mock, mosquitto/mqtt i drift. Se RIGG-KONTRAKT.md.
//
// Syskon till mqtt.js (som driver bänkarna). Hjärnan (stubb -> Blocks) översätter semantiken.

let publish = (topic, msg) => console.log(`[rigg] ${topic} <- ${msg}`);
export function setPublisher(fn) { publish = fn; }

const P = (t, m) => publish(t, typeof m === 'object' ? JSON.stringify(m) : String(m));

const base = s => String(s).split('/').pop();   // 'assets/audio/rigg/event_storm.mp3' -> 'event_storm.mp3'

export function attachRigg(engine, opts = {}) {
  if (opts.publish) setPublisher(opts.publish);
  const waveMs  = opts.waveMs  ?? 3000;
  const awardMs = opts.awardMs ?? 8750;    // per pris — matchar skärmens popup-takt (används bara när GM är AV)
  const redZone = engine.cfg?.redZone ?? 30;
  const isPaused = opts.isPaused ?? (() => false);   // paus fryser award-ceremonins takt (auto-läget)

  // Paus-medveten sleep: nedräkningen stannar medan spelet är pausat (riggen visar paus-wave så länge).
  const pausableSleep = ms => new Promise(resolve => {
    let remaining = ms;
    const step = 100;
    const tick = () => {
      if (!isPaused()) remaining -= step;
      if (remaining <= 0) resolve(); else setTimeout(tick, step);
    };
    setTimeout(tick, step);
  });

  let gm = opts.gm ?? false;               // GM PÅ → SERVERN dirigerar ceremonin (ett pris per NÄSTA AWARD)
  let lastOh = engine.cfg?.ohStart ?? 50;
  let over = false;
  let ceremony = Promise.resolve();
  let countdownFired = false;
  let pendingAwards = null;                // motorns award-event (för den auto-timade ceremonin i selfplay)

  // Centrala "show"-ljud spelas på centralhögtalaren av hjarna-stubb/Blocks (aldrig på skärmen).
  const cue = name => { if (name) P('ecoloco/rigg/ljud', base(name)); };

  // Award-sekvensen för riggen = SAMMA vinnare och ordning som skärmen (motorns award-event),
  // så ljus/ljud alltid matchar popupen. Skärmens ordning: led(🏆 ledande)→eld(🌱 eldsjäl)→sab(💀 sabotör).
  // Mappning till rigg-typ/färg: ledande=foretagare (grön), eldsjäl=eldsjal (grön), sabotör=sabotor (röd).
  function awardSeq() {
    const p = pendingAwards || {};
    const seq = [];
    if (p.led) seq.push({ typ: 'foretagare', lag: p.led.teamId });
    if (p.eld) seq.push({ typ: 'eldsjal',    lag: p.eld.teamId });
    if (p.sab) seq.push({ typ: 'sabotor',    lag: p.sab.teamId });
    return seq;
  }

  // SELFPLAY: adaptern sprider ut awards i skärmens ordning/takt (auto-timad).
  // GM-läge: servern dirigerar i stället via beginAwards/showAward/endAwards nedan.
  async function runCeremony() {
    P('ecoloco/rigg/scen', 'awards');
    await pausableSleep(500);             // kort paus (matchar skärmens pre-award); ambience redan tyst
    for (const a of awardSeq()) {
      P('ecoloco/rigg/award', a);        // sida + spot + ljud (hjärnan) — samma lag/ordning som skärmen
      await pausableSleep(awardMs);       // fryser medan spelet är pausat → nästa pris väntar in fortsätt
    }
    if (over) {
      P('ecoloco/rigg/scen', 'slut');
    } else {
      P('ecoloco/rigg/scen', 'runda');
      P('ecoloco/rigg/ohalsa', lastOh);  // återställ grundlooken för nya rundan
    }
  }

  P('ecoloco/rigg/scen', 'attract');     // viloläge tills partiet startar

  engine.on('start',      () => { over = false; P('ecoloco/rigg/scen', 'runda'); });
  engine.on('ohalsa',     p  => {
    if (p.value >= redZone && lastOh < redZone) cue('relief');   // ön reser sig ur krisen
    lastOh = p.value; P('ecoloco/rigg/ohalsa', p.value);
  });
  engine.on('roundStart', p  => { countdownFired = false; if (p.round > 1) cue('round_start'); });
  engine.on('gameEnd',    p  => { over = true; cue(p.won ? 'win' : 'lose'); });
  engine.on('award',      p  => { pendingAwards = p; });   // fångas FÖRE roundEnd (motorns emit-ordning)
  // Ceremonin dirigeras numera av SERVERN i BÅDA lägen (beginAwards/showAward/endAwards) så skärm + rigg
  // kliver i exakt takt. Riggen self-pacar INTE längre på roundEnd (runCeremony kvar för ev. testharness).
  // Händelse-ljud (auto) + förslags-/frestelse-ljud (rost) på centralhögtalaren.
  engine.on('event',        p => cue(p.ljud));
  engine.on('proposalOpened', p => cue(p.event?.ljud || 'proposal_open'));

  // Mappning: skärmens pris-typ → riggens award-typ (färg/sida sätts av hjärnan/Blocks).
  const RIG_TYP = { led: 'foretagare', eld: 'eldsjal', sab: 'sabotor' };

  return {
    // Vänta tills pågående award-ceremoni spelat klart (för selfplay-harness / server-pacing).
    whenIdle: () => ceremony,
    setGm(on) { gm = !!on; },
    // GM-ceremonin (servern dirigerar): öppna scenen → ett pris i taget → stäng/återställ.
    beginAwards() { P('ecoloco/rigg/scen', 'awards'); },
    showAward(typ, w) { if (w) P('ecoloco/rigg/award', { typ: RIG_TYP[typ], lag: w.teamId }); },
    endAwards(isOver) {
      if (isOver) P('ecoloco/rigg/scen', 'slut');
      else { P('ecoloco/rigg/scen', 'runda'); P('ecoloco/rigg/ohalsa', lastOh); }
    },
    // Anropa varje sekund från den som äger timern (ui.js / server.js). Ingen timer -> hoppa över.
    tick(left) {
      if (left <= 10 && left > 0 && !countdownFired) { countdownFired = true; P('ecoloco/rigg/countdown', 1); }
      if (left <= 0) P('ecoloco/rigg/countdown', 0);
    },
    // ——— Slutdelen (servern dirigerar): håll scenen i 'slut', spela ev. reveal-ljud centralt ———
    beginSlutdel() { P('ecoloco/rigg/scen', 'slut'); },
    slutdelReveal(kort) { if (kort && kort.ljud) cue(kort.ljud); },   // Institutets röst / klipp-cue (om satt)
    endSlutdel() { P('ecoloco/rigg/scen', 'slut'); },                  // stannar i slut-scenen efter slutdelen
  };
}
