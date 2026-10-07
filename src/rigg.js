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

export function attachRigg(engine, opts = {}) {
  if (opts.publish) setPublisher(opts.publish);
  const waveMs  = opts.waveMs  ?? 3000;
  const awardMs = opts.awardMs ?? 10000;   // 10 s per pris (spec)

  let lastOh = engine.cfg?.ohStart ?? 50;
  let over = false;
  let ceremony = Promise.resolve();
  let countdownFired = false;

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

  // Option A: adaptern sprider ut awards på en egen klocka (10 s/pris).
  async function runCeremony() {
    P('ecoloco/rigg/scen', 'awards');
    P('ecoloco/rigg/wave', 1);
    await sleep(waveMs);                 // tombola snurrar
    P('ecoloco/rigg/wave', 0);
    for (const a of winners()) {
      P('ecoloco/rigg/award', a);        // sida + spot + ljud (hjärnan)
      await sleep(awardMs);
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
  engine.on('ohalsa',     p  => { lastOh = p.value; P('ecoloco/rigg/ohalsa', p.value); });
  engine.on('roundStart', () => { countdownFired = false; });
  engine.on('gameEnd',    () => { over = true; });
  engine.on('roundEnd',   () => { ceremony = runCeremony(); });

  return {
    // Vänta tills pågående award-ceremoni spelat klart (för selfplay-harness / server-pacing).
    whenIdle: () => ceremony,
    // Anropa varje sekund från den som äger timern (ui.js / server.js). Ingen timer -> hoppa över.
    tick(left) {
      if (left === 10 && !countdownFired) { countdownFired = true; P('ecoloco/rigg/countdown', 1); }
      if (left <= 0) P('ecoloco/rigg/countdown', 0);
    },
  };
}
