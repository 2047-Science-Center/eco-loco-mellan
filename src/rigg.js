// rigg.js — Förstärkningsriggen: Eco Loco-motorns events -> semantiska cues (ecoloco/rigg/*).
// REN LÄSARE av motorn (ändrar inga regler). Option A: adaptern äger award-tidslinjen.
// Awards = KUMULATIVA (lästa ur motorns state vid award-tillfället):
//   företagare = mest förmögenhet · sabotör = mest neg öhälsa · eldsjäl = mest pos öhälsa.
// publish är utbytbar: console.log i mock, mosquitto/mqtt i drift. Se RIGG-KONTRAKT.md.
//
// Syskon till mqtt.js (som driver bänkarna). Hjärnan (stubb -> Blocks) översätter semantiken.

let publish = (topic, msg) => console.log(`[rigg] ${topic} <- ${msg}`);
export function setPublisher(fn) { publish = fn; }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const P = (t, m) => publish(t, typeof m === 'object' ? JSON.stringify(m) : String(m));

const base = s => String(s).split('/').pop();   // 'assets/audio/rigg/event_storm.mp3' -> 'event_storm.mp3'

export function attachRigg(engine, opts = {}) {
  if (opts.publish) setPublisher(opts.publish);
  const waveMs  = opts.waveMs  ?? 3000;
  const awardMs = opts.awardMs ?? 10000;   // 10 s per pris (spec) — används bara när GM är AV
  const redZone = engine.cfg?.redZone ?? 30;

  let gm = opts.gm ?? false;               // GM PÅ → award-ceremonin stegas av 'award_next' i stället för klockan
  let stepResolve = null;                  // väntar på nästa steg i GM-ceremonin
  let lastOh = engine.cfg?.ohStart ?? 50;
  let over = false;
  let ceremony = Promise.resolve();
  let countdownFired = false;

  // Centrala "show"-ljud spelas på centralhögtalaren av hjarna-stubb/Blocks (aldrig på skärmen).
  const cue = name => { if (name) P('ecoloco/rigg/ljud', base(name)); };
  const waitStep = () => new Promise(res => { stepResolve = res; });

  // Kumulativa vinnare ur motorns state (ren läsning).
  function winners() {
    const teams = engine.getState().teams;
    const foretagare = [...teams].sort((a, b) => (b.pengar + b.material) - (a.pengar + a.material))[0];
    const sabotor    = [...teams].sort((a, b) => a.impactNeg - b.impactNeg)[0];   // mest negativ
    const eldsjal    = [...teams].sort((a, b) => b.impactPos - a.impactPos)[0];   // mest positiv
    return [
      { typ: 'sabotor',    lag: sabotor.id },
      { typ: 'foretagare', lag: foretagare.id },
      { typ: 'eldsjal',    lag: eldsjal.id },
    ];
  }

  // Option A: adaptern sprider ut awards. GM AV → egen 10 s-klocka. GM PÅ → ett steg per 'award_next'.
  async function runCeremony() {
    P('ecoloco/rigg/scen', 'awards');
    P('ecoloco/rigg/wave', 1);
    await sleep(waveMs);                 // tombola snurrar
    P('ecoloco/rigg/wave', 0);
    for (const a of winners()) {
      P('ecoloco/rigg/award', a);        // sida + spot + ljud (hjärnan)
      if (gm) await waitStep(); else await sleep(awardMs);
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
  engine.on('roundEnd',   () => { ceremony = runCeremony(); });
  // Händelse-ljud (auto) + förslags-/frestelse-ljud (rost) på centralhögtalaren.
  engine.on('event',        p => cue(p.ljud));
  engine.on('proposalOpened', p => cue(p.event?.ljud || 'proposal_open'));

  return {
    // Vänta tills pågående award-ceremoni spelat klart (för selfplay-harness / server-pacing).
    whenIdle: () => ceremony,
    setGm(on) { gm = !!on; },
    // GM-läge: stega ett pris framåt i award-ceremonin.
    awardNext() { const r = stepResolve; stepResolve = null; if (r) r(); },
    // Anropa varje sekund från den som äger timern (ui.js / server.js). Ingen timer -> hoppa över.
    tick(left) {
      if (left === 10 && !countdownFired) { countdownFired = true; P('ecoloco/rigg/countdown', 1); }
      if (left <= 0) P('ecoloco/rigg/countdown', 0);
    },
  };
}
