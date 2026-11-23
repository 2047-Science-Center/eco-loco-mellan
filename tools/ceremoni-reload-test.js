// tools/ceremoni-reload-test.js — REGRESSIONSTEST: omladdning mitt i prisutdelningen.
// Buggen: en skärm som laddades om (eller återanslöt) MITT i prisceremonin fick aldrig ceremonin
// återsänd — bara slutdelen hade den logiken i hello-hanteraren. Resultatet blev att skärmen
// missade ceremonin eller (som det upplevdes) "körde den från början". Fix: resumeAwards(ws) i
// server.js skickar det pris som visas NU (cer.i) till en nyansluten klient, precis som slutdel-steget.
//
// Testet startar servern på en testport, driver ett Flash-parti till prisceremonin, "laddar om" en
// klient (ny WS som samma lag) och verifierar att den omedelbart får aktuellt awardStep/awardCeremony.
// Rör inga regler/effekter. Exit 1 vid fel.
//
//   node tools/ceremoni-reload-test.js

import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8792;
let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const delay = ms => new Promise(r => setTimeout(r, ms));

const srv = spawn('node', [join(HERE, '..', 'server', 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
const srvlog = [];
srv.stdout.on('data', d => srvlog.push(d.toString()));
srv.stderr.on('data', d => srvlog.push(d.toString()));
function cleanup(code) { try { srv.kill('SIGKILL'); } catch {} process.exit(code); }

async function waitFor(pred, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await delay(50); } return false; }

// En WS-klient med enkel event-väntan.
function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const got = [];
  ws.on('message', d => { let m; try { m = JSON.parse(d); } catch { return; } got.push(m); });
  const open = new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = o => ws.send(JSON.stringify(o));
  const wait = (pred, ms = 6000) => new Promise(async res => {
    if (got.find(pred)) return res(got.find(pred));
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const hit = got.find(pred); if (hit) return res(hit); await delay(30); }
    res(null);
  });
  return { ws, got, open, send, wait };
}
const isEv = ev => m => m.type === 'event' && m.event === ev;

try {
  await waitFor(() => srvlog.join('').includes(`port ${PORT}`), 8000);
  await delay(200);

  // 1) Åker ansluter (enda människan → övriga blir botar) och startar partiet direkt.
  const a = client();
  await a.open;
  a.send({ type: 'hello', lag: 'aker' });
  ok(!!(await a.wait(m => m.type === 'hello-ack', 3000)), 'hello-ack mottagen');
  a.send({ type: 'startGame' });
  ok(!!(await a.wait(isEv('roundStart'), 4000)), 'runda 1 startad');

  // 2) Lös rundan (bygg + klar) → prisceremonin startar.
  a.send({ type: 'selectCard', tier: 'standard', reqId: 1 });
  await a.wait(m => m.type === 'actionResult' && m.reqId === 1, 2000);
  a.send({ type: 'klar' });
  const cer = await a.wait(isEv('awardCeremony'), 6000);
  ok(!!cer, 'prisceremoni startad (awardCeremony broadcastad)');
  if (!cer) { console.error('  (runda 1 gav ingen prisförändring — oväntat; kan ej testa resume)'); cleanup(1); }

  // vänta tills minst ett pris stegats fram (cer.i >= 0) så vi laddar om MITT i
  const step = await a.wait(isEv('awardStep'), 6000);
  ok(!!step, 'minst ett pris framstegat (awardStep)');

  // 3) "Ladda om": ny WS som samma lag → ska OMEDELBART få aktuellt pris via resumeAwards.
  const b = client();
  await b.open;
  b.send({ type: 'hello', lag: 'aker' });
  ok(!!(await b.wait(m => m.type === 'hello-ack', 3000)), 'omladdad klient fick hello-ack');
  const resume = await b.wait(m => m.type === 'event' && (m.event === 'awardStep' || m.event === 'awardCeremony'), 2500);
  ok(!!resume, 'omladdad klient landade på aktuellt pris (resumeAwards) i stället för tom bräda');
  if (resume && resume.event === 'awardStep' && step) {
    ok(resume.payload.i >= step.payload.i, `landade på rätt/senare pris (i=${resume.payload.i}, inte från början)`);
  }

  if (fails) { console.error(`\nFAIL: ${fails} kontroll(er) misslyckades`); cleanup(1); }
  console.log('\nALLA KONTROLLER GRÖNA — reload mitt i prisutdelningen återställs korrekt');
  cleanup(0);
} catch (e) {
  console.error('TESTFEL:', e && e.message);
  console.error(srvlog.join('').split('\n').slice(-8).join('\n'));
  cleanup(1);
}
