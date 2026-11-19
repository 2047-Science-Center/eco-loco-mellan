// tools/paus-test.js — INTEGRATIONSTEST för pausbuggen ("Spelet är pausat" vid händelse).
// Startar servern på en testport, ansluter en WS-klient som Åker, hoppar till runda 1, bygger tills en
// företagshändelse (EXPANSION, 3 byggen/år) utlöses och verifierar serverns 'paused'-broadcasts:
//   • Händelse-paus (auto): paused=false (ingen manuell paus) + auto=true → klienten visar INGEN overlay.
//   • Efter händelsen: auto=false.
//   • Manuell paus: paused=true. Manuell paus + händelse: händelsens slut upphäver INTE manuell paus.
// Rör inga regler/effekter. Exit 1 vid fel.
//
//   node tools/paus-test.js

import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8791;
let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const delay = ms => new Promise(r => setTimeout(r, ms));

const srv = spawn('node', [join(HERE, '..', 'server', 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
const log = [];
srv.stdout.on('data', d => log.push(d.toString()));
srv.stderr.on('data', d => log.push(d.toString()));

function cleanup(code) { try { srv.kill('SIGKILL'); } catch {} process.exit(code); }

async function waitFor(pred, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (pred()) return true; await delay(50); }
  return false;
}

try {
  // vänta tills servern lyssnar
  await waitFor(() => log.join('').includes(`port ${PORT}`), 8000);
  await delay(200);

  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const msgs = [];
  const paused = [];                 // alla 'paused'-broadcasts i ordning
  const cevents = [];                // companyEvent-broadcasts (för cooldown-mätning)
  ws.on('message', d => { let m; try { m = JSON.parse(d); } catch { return; } msgs.push(m);
    if (m.type === 'paused') paused.push({ ...m, t: Date.now() });
    if (m.type === 'event' && m.event === 'companyEvent') cevents.push({ id: m.payload?.id, t: Date.now() }); });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = o => ws.send(JSON.stringify(o));

  // bli Åker + hoppa direkt till runda 1 (fyller övriga lag med botar, startar motorn)
  send({ type: 'hello', lag: 'aker' });
  await delay(150);
  send({ type: 'gmcmd', cmd: 'tillrunda1' });

  // vänta tills byggfasen är igång (timer tickar, inte pausad)
  await waitFor(() => msgs.some(m => m.type === 'timer' && m.left > 0), 8000);
  await delay(400);

  // bygg 3 gånger som Åker → EXPANSION (3 byggen/år) ger en företagshändelse (companyEvent) → auto-paus
  for (let i = 0; i < 3; i++) { send({ type: 'selectCard', tier: 'standard', reqId: 'b' + i }); await delay(250); }

  // vänta på händelse-pausen
  const gotAutoPause = await waitFor(() => paused.some(p => p.auto === true), 4000);

  console.log('1) Automatisk händelse → paus-broadcast med auto=true, paused=false (ingen manuell overlay)');
  const autoP = paused.find(p => p.auto === true);
  ok(gotAutoPause && autoP, 'en paus-broadcast med auto=true kom vid händelsen');
  ok(autoP && autoP.paused === false, `auto-pausen bär paused=false (manuell overlay visas ej) — fick paused=${autoP?.paused}`);
  ok(!paused.slice(0, paused.indexOf(autoP) + 1).some(p => p.paused === true),
     'ingen broadcast med paused=true (manuell) fram t.o.m. händelsen → ingen "Spelet är pausat"-overlay (buggen)');

  console.log('2) MANUELL paus MITT i händelsen → paused=true (overlay) och auto=true samtidigt');
  send({ type: 'gmcmd', cmd: 'pause', on: true });   // spelledaren pausar medan händelsen visas
  const gotManualDuring = await waitFor(() => paused.some(p => p.paused === true), 3000);
  ok(gotManualDuring, 'manuell paus mitt i händelsen → en broadcast med paused=true (overlay visas)');

  console.log('3) Händelsen avslutas efter ~3 s (INTE 10 s) → auto=false MEN manuell paus består (paused=true)');
  const resumed = await waitFor(() => paused.some(p => p.t > autoP.t && p.auto === false), 8000);
  const autoFalse = paused.find(p => p.t > autoP.t && p.auto === false);
  ok(resumed && autoFalse, 'en broadcast med auto=false kom när händelsen avslutades');
  const dur = autoFalse ? autoFalse.t - autoP.t : -1;
  ok(dur >= 1500 && dur <= 6000, `händelse-frysen varade ~3 s, inte 10 s (uppmätt ${dur} ms)`);
  ok(autoFalse && autoFalse.paused === true, 'manuell paus kvar (paused=true) efter händelsens slut — händelsen upphävde den INTE');

  console.log('4) Spelledaren återupptar manuellt → paused=false');
  const n4 = paused.length;
  send({ type: 'gmcmd', cmd: 'pause', on: false });
  await waitFor(() => paused.length > n4, 3000);
  ok(paused[paused.length - 1].paused === false, 'manuell fortsättning → paused=false (overlay stängs)');

  console.log('5) KÖ-COOLDOWN: två köade händelser visas INTE back-to-back utan med cooldown emellan');
  send({ type: 'gmcmd', cmd: 'gm', on: true }); await delay(200);
  const nc = cevents.length;
  send({ type: 'gmcmd', cmd: 'gmEvent', id: 'gm_marknadskrasch' }); await delay(150);
  send({ type: 'gmcmd', cmd: 'gmEvent', id: 'gm_ekonomisktstod' });
  await waitFor(() => cevents.length >= nc + 2, 12000);
  const two = cevents.slice(nc, nc + 2);
  ok(two.length === 2, `båda GM-händelserna visades (${two.map(e => e.id).join(', ')})`);
  const gap = two.length === 2 ? two[1].t - two[0].t : -1;
  ok(gap >= 5000 && gap <= 9000, `mellanrum ~3 s frys + ~4 s cooldown ≈ 7 s (uppmätt ${gap} ms) → popups staplas inte`);

  ws.close();
} catch (e) {
  console.error('  ✗ oväntat fel:', e.message);
  console.error(log.join(''));
  fails++;
}

console.log(fails === 0 ? '\n[paus] ALLA TESTER OK' : `\n[paus] ${fails} TEST MISSLYCKADES`);
cleanup(fails === 0 ? 0 : 1);
