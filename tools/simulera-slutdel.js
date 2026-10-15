// tools/simulera-slutdel.js — HEADLESS end-to-end för persistens + slutdel.
// Bootar server/server.js, spelar ett HELT parti över WebSocket (4 människolag), kör sedan
// den spelledarstegade SLUTDELEN, och verifierar att data/sessions/<id>.jsonl +
// <id>.summary.json skapas med rätt innehåll. Inga npm-deps utöver vendrade `ws`.
//
//   node tools/simulera-slutdel.js
//
// GM-kommandon skickas över den sekundära WS-kanalen ({type:'gmcmd', cmd:...}); MQTT-kanalen
// ecoloco/spel/gm är oförändrad (den kräver mosquitto, som inte behövs för detta test).

import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8799;
const TEAMS = ['aker', 'skog', 'tundra', 'stad'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let srv = null;
const fail = msg => { console.error(`\n❌ FAIL: ${msg}`); try { srv?.kill('SIGKILL'); } catch {} process.exit(1); };
function cleanup(code) { try { srv?.kill('SIGTERM'); } catch {} setTimeout(() => process.exit(code), 150); }

// ——— Boota servern ———
srv = spawn('node', [join(ROOT, 'server', 'server.js')],
  { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let booted = false;
srv.stdout.on('data', d => { if (/igång på port/.test(d.toString())) booted = true; });
srv.stderr.on('data', () => {});   // mosquitto-varningar m.m. — ofarliga i test
srv.on('exit', c => { if (!booted) fail(`servern dog innan boot (exit ${c})`); });

for (let i = 0; i < 60 && !booted; i++) await sleep(100);
if (!booted) fail('servern bootade inte inom 6 s');
console.log(`✓ servern bootade på port ${PORT}`);

// ——— WS-klient ———
function makeClient(lag) {
  const c = { lag, state: null, h: {} };
  c.ws = new WebSocket(`ws://localhost:${PORT}`);
  c.on = (ev, f) => ((c.h[ev] ||= []).push(f), c);
  c.send = o => c.ws.send(JSON.stringify(o));
  c.ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.state) c.state = m.state;
    if (m.type === 'event') (c.h[m.event] || []).forEach(f => f(m.payload));
    else (c.h[m.type] || []).forEach(f => f(m));
  });
  return new Promise(res => c.ws.on('open', () => { c.send({ type: 'hello', lag }); res(c); }));
}

const clients = await Promise.all(TEAMS.map(makeClient));
await sleep(150);

// Varje lag: på roundStart → köp billigaste möjliga kort, tryck klar. (Misslyckat köp → avstå, rundan löser ändå.)
let gameEnded = null;
const gameEndP = new Promise(res => clients[0].on('gameEnd', p => { gameEnded = p; res(p); }));
clients.forEach((c, idx) => {
  c.on('roundStart', () => {
    if (c.state?.over) return;
    const tiers = ['smutsig', 'standard', 'gron'];
    c.send({ type: 'selectCard', tier: tiers[(c.state?.round || 1 + idx) % 3] });
    setTimeout(() => c.send({ type: 'klar' }), 40);
  });
});

console.log('✓ 4 lag anslutna — startar parti');
clients[0].send({ type: 'startGame' });

// Vänta ut hela partiet (med takgräns så testet aldrig hänger).
await Promise.race([gameEndP, sleep(20000)]);
if (!gameEnded) fail('partiet nådde aldrig gameEnd');
console.log(`✓ parti slut (won=${gameEnded.won}, öhälsa=${gameEnded.oh})`);

// ——— SLUTDEL: spelledarstegad (gmcmd över WS) ———
// Lagen svarar på varje podiefråga (olika alternativ → fördelning att verifiera).
clients.forEach((c, idx) => c.on('slutdelQuestion', p => {
  const opt = p.options[idx % p.options.length];
  c.send({ type: 'podiumAnswer', questionId: p.id, option: opt });
}));
let slutdelDone = false, questions = 0, reveals = 0;
clients[0].on('slutdelQuestion', () => questions++);
clients[0].on('slutdelReveal', () => reveals++);
clients[0].on('slutdelDone', () => { slutdelDone = true; });

clients[0].send({ type: 'gmcmd', cmd: 'slutdel_start' });
await sleep(150);
for (let i = 0; i < 20 && !slutdelDone; i++) {
  clients[0].send({ type: 'gmcmd', cmd: 'slutdel_next' });
  await sleep(160);   // hinner ta emot svar + låsa frågan innan nästa steg
}
if (!slutdelDone) fail('slutdelen nådde aldrig slutdelDone');
console.log(`✓ slutdel klar (${questions} frågor, ${reveals} reveal-kort)`);
if (questions !== 6) fail(`förväntade 6 podiefrågor, fick ${questions}`);
if (reveals !== 3) fail(`förväntade 3 reveal-kort (Newfoundland), fick ${reveals}`);

await sleep(400);   // hinner skriva JSONL + summary (fire-and-forget)

// ——— Verifiera loggfilerna ———
const dir = join(ROOT, 'data', 'sessions');
if (!existsSync(dir)) fail(`${dir} skapades inte`);
const jsonls = readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort();
if (!jsonls.length) fail('ingen .jsonl skrevs');
const jsonl = jsonls[jsonls.length - 1];
const id = jsonl.replace('.jsonl', '');
const summaryFile = join(dir, `${id}.summary.json`);
console.log(`✓ sessionId = ${id}`);

const lines = readFileSync(join(dir, jsonl), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const types = lines.map(l => l.type);
// Briefens kanoniska eventlista (OBS: roundStart ingår medvetet INTE i den strömmen).
const need = ['sessionStart', 'start', 'build', 'ohalsa', 'roundEnd', 'award', 'gameEnd', 'podiumAnswer'];
for (const t of need) if (!types.includes(t)) fail(`JSONL saknar rad av typ '${t}'`);
if (lines.some(l => l.schema !== 1)) fail('JSONL: alla rader ska ha schema:1');
const meta = lines.find(l => l.type === 'sessionStart').payload;
if (!meta.config || meta.version !== 'A' || !meta.teams) fail('sessionStart saknar config/version/teams');
if (Object.values(meta.teams).filter(v => v === 'human').length !== 4) fail('sessionStart: alla 4 lag borde vara human');
console.log(`✓ JSONL: ${lines.length} rader, alla schema:1, metadata OK (version ${meta.version})`);

if (!existsSync(summaryFile)) fail('summary.json skrevs inte');
const sum = JSON.parse(readFileSync(summaryFile, 'utf8'));
if (!Array.isArray(sum.ohPerRound) || !sum.ohPerRound.length) fail('summary: ohPerRound tom');
if (typeof sum.slutOhalsa !== 'number') fail('summary: slutOhalsa saknas');
if (!Array.isArray(sum.teams) || sum.teams.length !== 4) fail('summary: teams ska vara 4');
for (const t of sum.teams) if (!('kapital' in t && 'impactNeg' in t && 'built' in t)) fail(`summary: lag ${t.id} saknar härledda tal`);
const podiumKeys = Object.keys(sum.podium || {});
if (podiumKeys.length !== 6) fail(`summary: podium borde ha 6 frågor, har ${podiumKeys.length}`);
const q1 = sum.podium.q1;
if (!q1 || !q1.counts || !q1.n) fail('summary: q1-fördelning saknas');
console.log(`✓ summary.json: ohPerRound=${sum.ohPerRound.length}, slutöhälsa=${sum.slutOhalsa}, won=${sum.won}, podium q1 n=${q1.n} counts=${JSON.stringify(q1.counts)}`);

console.log('\n✅ ALLT OK — server bootar, helt parti + slutdel går igenom, JSONL + summary.json korrekta.');
cleanup(0);
