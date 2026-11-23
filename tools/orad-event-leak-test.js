// tools/orad-event-leak-test.js — REGRESSIONSTEST: företagshändelse läcker in i Ö-rådet.
// Buggen: en företagshändelse-popup (t.ex. GRÖN OMSTÄLLNING / FRAMTIDSVISIONÄR) som visades i slutet
// av byggfasen låg kvar — eller en köad händelse dränerades av 15 s-timern — EFTER att rundan löst,
// så rutan dök upp mitt i prisutdelningen/Ö-rådet. Fix: forceResolve() stänger en pågående popup
// (cancelCompanyEventPopup → eventClosed) och companyEvent-hanteraren tystar emits utanför byggfasen.
//
// Testet: gmMode på, hoppa till runda 1, trigga en GM-företagshändelse (popup under byggfasen),
// lös rundan direkt och verifiera att servern skickar 'eventClosed' (popupen stängs) i stället för
// att låta den ligga kvar. Verifierat att testet FAILAR utan fixen. Exit 1 vid fel.
//
//   node tools/orad-event-leak-test.js

import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8793;
let fails = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); fails++; } };
const delay = ms => new Promise(r => setTimeout(r, ms));

const srv = spawn('node', [join(HERE, '..', 'server', 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
const srvlog = [];
srv.stdout.on('data', d => srvlog.push(d.toString()));
srv.stderr.on('data', d => srvlog.push(d.toString()));
function cleanup(code) { try { srv.kill('SIGKILL'); } catch {} process.exit(code); }
async function waitFor(pred, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await delay(50); } return false; }

try {
  await waitFor(() => srvlog.join('').includes(`port ${PORT}`), 8000);
  await delay(200);

  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const got = [];
  ws.on('message', d => { let m; try { m = JSON.parse(d); } catch { return; } got.push(m); });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const send = o => ws.send(JSON.stringify(o));
  const seen = (pred, ms = 3000) => waitFor(() => got.some(pred), ms).then(() => got.find(pred));
  const isEv = ev => m => m.type === 'event' && m.event === ev;

  send({ type: 'hello', lag: 'aker' });
  await seen(m => m.type === 'hello-ack');
  send({ type: 'gmcmd', cmd: 'gm', on: true });     // gmMode på → gmEvent tillåts
  await delay(150);
  send({ type: 'gmcmd', cmd: 'tillrunda1' });        // hoppa till runda 1 byggfas (timerInt aktiv)
  ok(await waitFor(() => got.some(m => m.type === 'timer' && m.left > 0), 6000), 'byggfas igång (timer tickar)');
  await delay(300);

  // trigga en GM-företagshändelse → popup under byggfasen (autoPaused)
  const before = got.length;
  send({ type: 'gmcmd', cmd: 'gmEvent', id: 'gm_braskord' });
  const cev = await seen(isEv('companyEvent'), 3000);
  ok(!!cev, 'företagshändelse-popup visas under byggfasen');
  const pausedAuto = got.slice(before).find(m => m.type === 'paused' && m.auto === true);
  ok(!!pausedAuto, 'auto-paus satt medan popupen visas');

  // lös rundan DIREKT medan popupen är aktiv → fixen ska stänga popupen (eventClosed)
  const mark = got.length;
  send({ type: 'klar' });
  await seen(isEv('resolveStart'), 3000);
  const closed = await waitFor(() => got.slice(mark).some(isEv('eventClosed')), 2500);
  ok(closed, 'popupen STÄNGS vid resolve (eventClosed) — läcker inte in i Ö-rådet');

  // ingen NY företagshändelse-popup ska dyka upp efter resolve (inom rimlig tid)
  const leak = await waitFor(() => got.slice(mark).some(isEv('companyEvent')), 1500);
  ok(!leak, 'ingen ny företagshändelse-popup efter resolve');

  if (fails) { console.error(`\nFAIL: ${fails} kontroll(er) misslyckades`); cleanup(1); }
  console.log('\nALLA KONTROLLER GRÖNA — företagshändelser läcker inte in i Ö-rådet');
  cleanup(0);
} catch (e) {
  console.error('TESTFEL:', e && e.message);
  console.error(srvlog.join('').split('\n').slice(-8).join('\n'));
  cleanup(1);
}
