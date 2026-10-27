/**
 * Maktspelet — Strateg-coach · liten backend-proxy (Node/Express).
 *
 * Fristående från spelet: pratar INTE med server.js eller spelets WebSocket.
 * Bara en AI tränad på spelet. Frontend (index.html) anropar /chat här,
 * backend håller OpenAI-nyckeln i en MILJÖVARIABEL och proxar anropet.
 *
 * Anropsmönstret är speglat från minnestest/server/index.js (gptbackend-mönstret):
 * openai-paketet, new OpenAI({apiKey}), openai.responses.create({ model,
 * instructions, input, reasoning, max_output_tokens }), nyckel via dotenv.
 *
 * Nyckel via .env (AI_API_KEY eller OPENAI_API_KEY) — ALDRIG i git, ALDRIG i fronten.
 * Utan nyckel svarar /chat med ett tydligt MOCK-svar så UI:t går att demo:a.
 *
 *   npm start   (kräver server/.env med AI_API_KEY=... för skarpa svar)
 */
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildNumbersBlock } from './game-numbers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Ladda server/.env oavsett från vilken katalog servern startas.
dotenv.config({ path: path.join(__dirname, '.env') })

const PORT = process.env.PORT || 8790
const MODEL = process.env.STRATEG_MODEL || 'gpt-5-mini'
const API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY

// System-prompt komponeras vid serverstart av TVÅ delar:
//  1) stabil narrativ/filosofi/roll (handskriven) i system-prompt.sv.txt
//  2) AUTO-GENERERAT sifferblock importerat ur spec/engine.js (sanningen)
// → coachen auto-speglar motorn: ändra reglerna i engine.js + starta om servern,
//   ingen manuell promptredigering. Importerar bara regel-MODULEN, inte spelservern.
const NARRATIVE = fs.readFileSync(path.join(__dirname, 'system-prompt.sv.txt'), 'utf8').trim()
const SYSTEM_PROMPT = `${NARRATIVE}\n\n${buildNumbersBlock()}`

if (!API_KEY) {
  console.warn(
    '[strateg] Ingen AI_API_KEY i server/.env — /chat svarar med MOCK-svar (UI går att demo:a utan nyckel).',
  )
}

const openai = API_KEY ? new OpenAI({ apiKey: API_KEY }) : null

// --- Mock-svar (när ingen nyckel finns) ---
function mockReply(question) {
  const q = (question || '').toLowerCase()
  let tips
  if (q.includes('byt') || q.includes('byte') || q.includes('handel')) {
    tips = 'Du tjänar bara en valuta men behöver båda för att bygga — börja byta tidigt med ett lag som har det du saknar. Material-lag och pengar-lag behöver varandra.'
  } else if (q.includes('röst') || q.includes('omröstning') || q.includes('förslag')) {
    tips = 'Ett lag lägger ett förslag per runda, alla fyra röstar JA/NEJ, och det går igenom om minst 3 säger JA. Grön satsning lyfter ön men bara ja-röstarna betalar.'
  } else if (q.includes('grön') || q.includes('smutsig')) {
    tips = 'Smutsigt är billigast och ger mest pengar men drar ner ön. Grönt kostar mest men lyfter hälsan. Kör alla smutsigt kraschar ön — och då vinner ingen.'
  } else if (q.includes('rädda') || q.includes('ön') || q.includes('hälsa')) {
    tips = 'Öns hälsa måste vara minst 60 efter runda 8, annars förlorar alla. Håll koll på mätaren och satsa grönt eller rösta igenom grön satsning om den sjunker.'
  } else {
    tips = 'Vinn genom att vara rikast VID slutet och samtidigt hålla ön över 60. Rikast på en död ö är ändå en förlust — prata med de andra lagen.'
  }
  return `🔧 DEMO-läge (ingen API-nyckel satt): ${tips}`
}

// --- Server ---
const app = express()
app.use(express.json({ limit: '128kb' }))
app.use(cors())
// Servera frontend (index.html ligger en nivå upp).
app.use(express.static(path.join(__dirname, '..')))

app.get('/health', (_req, res) =>
  res.json({ ok: true, keyed: Boolean(openai), model: MODEL }),
)

app.post('/chat', async (req, res) => {
  const started = Date.now()
  try {
    const { messages } = req.body ?? {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] krävs' })
    }
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || ''

    // Ingen nyckel → tydligt mock-svar så flödet går att demo:a.
    if (!openai) {
      return res.json({
        reply: mockReply(lastUser),
        meta: { model: 'mock', keyed: false, latencyMs: Date.now() - started },
      })
    }

    // Speglar minnestest: responses.create med instructions + input + låg reasoning-effort.
    // input = konversationshistoriken (roll/innehåll); instructions = kunskapsbasen.
    const input = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: String(m.content) }))

    const response = await openai.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input,
      reasoning: { effort: 'low' }, // gpt-5-familjen: låg effort kapar latensen
      max_output_tokens: 400, // koncisa svar
    })

    const reply = String(response.output_text ?? '').trim() || 'Jag kunde tyvärr inte svara just nu — fråga gärna igen.'
    return res.json({
      reply,
      meta: { model: MODEL, keyed: true, latencyMs: Date.now() - started },
    })
  } catch (err) {
    console.error('[strateg] /chat fel:', err)
    return res.status(500).json({ error: 'AI-anropet misslyckades', detail: err.message })
  }
})

// ── Utvärdering: en rad per svarande, lokalt (JSONL). Ingen DB, ingen extern koppling. ──
const DATA_DIR = path.join(__dirname, 'data')
const UTV_FILE = path.join(DATA_DIR, 'utvardering.jsonl')
fs.mkdirSync(DATA_DIR, { recursive: true })

// Frontend postar hela svaret hit vid slutet av utvärderingen.
app.post('/utvardering', (req, res) => {
  try {
    const body = req.body ?? {}
    const row = { tid: new Date().toISOString(), id: 'u_' + Math.random().toString(36).slice(2, 9), ...body }
    fs.appendFileSync(UTV_FILE, JSON.stringify(row) + '\n')
    res.json({ ok: true })
  } catch (err) {
    console.error('[strateg] /utvardering fel:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Hämta ut datan: öppna /utvardering/export.csv i webbläsaren → laddar ner allt som CSV
// (flerval/rang blir " | "-separerade i cellen). /utvardering/count visar antal svar.
const UTV_COLS = ['tid','id','alder','forVem','gruppkul','yngreBehov','forstod','svart','roligast','laggaTill','banta','handladeOm','tankvackt','ovrigt']
app.get('/utvardering/export.csv', (_req, res) => {
  try {
    const rows = fs.existsSync(UTV_FILE)
      ? fs.readFileSync(UTV_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
    const cell = v => '"' + String(Array.isArray(v) ? v.join(' | ') : (v ?? '')).replace(/"/g, '""') + '"'
    const csv = [UTV_COLS.join(','), ...rows.map(r => UTV_COLS.map(c => cell(r[c])).join(','))].join('\n')
    res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="utvardering.csv"').send('﻿' + csv)
  } catch (err) { res.status(500).send('fel: ' + err.message) }
})
app.get('/utvardering/count', (_req, res) => {
  const n = fs.existsSync(UTV_FILE) ? fs.readFileSync(UTV_FILE, 'utf8').split('\n').filter(Boolean).length : 0
  res.json({ count: n })
})

// Admin: liten sida för Klara — antal svar + nedladdningsknapp + senaste svaren. Bokmärk /utvardering/admin.
app.get('/utvardering/admin', (_req, res) => {
  const rows = fs.existsSync(UTV_FILE)
    ? fs.readFileSync(UTV_FILE, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) : []
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const fmt = v => esc(Array.isArray(v) ? v.join(' | ') : v)
  const cols = ['tid', 'alder', 'forVem', 'roligast', 'tankvackt']
  const last = rows.slice(-10).reverse()
  const trs = last.map(r => '<tr>' + cols.map(c => `<td>${fmt(r[c]).slice(0, 90)}</td>`).join('') + '</tr>').join('')
  res.type('html').send(`<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Utvärderingar — Maktspelet</title>
<style>
  body{font-family:system-ui,sans-serif;background:#14120e;color:#eee;margin:0 auto;padding:28px;max-width:900px}
  h1{font-size:24px;margin:0 0 4px} h3{margin:28px 0 6px} .sub{color:#aaa;margin:0 0 18px}
  .big{font-size:52px;font-weight:800;color:#C9A94F;line-height:1}
  a.btn{display:inline-block;margin:18px 0;background:#C9A94F;color:#14120e;font-weight:800;font-size:20px;padding:16px 32px;border-radius:12px;text-decoration:none}
  table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #333;vertical-align:top}
  th{color:#C9A94F;text-transform:uppercase;font-size:11px;letter-spacing:1px}
  .note{color:#888;font-size:13px;margin-top:26px;line-height:1.7}
</style></head><body>
  <h1>Utvärderingar — Maktspelet</h1>
  <p class="sub">Besökarnas svar efter spelet.</p>
  <div class="big">${rows.length}</div><p class="sub">svar totalt</p>
  <a class="btn" href="/utvardering/export.csv">⬇ Ladda ner alla som CSV (Excel)</a>
  <h3>Senaste ${last.length} svaren</h3>
  <table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
  <tbody>${trs || '<tr><td colspan="5" style="color:#888">Inga svar än.</td></tr>'}</tbody></table>
  <p class="note">CSV:en öppnas direkt i Excel/Numbers (flerval blir "a | b"). Uppdatera sidan för färska siffror.<br>
  Du når den här sidan på <b>http://&lt;nuc&gt;:${PORT}/utvardering/admin</b> — på plats via LAN, på distans via Tailscale.</p>
</body></html>`)
})

app.listen(PORT, () => {
  console.log(`[strateg] Maktspelet-coach igång på http://localhost:${PORT}  (modell: ${MODEL}, keyed: ${Boolean(openai)})`)
  console.log(`[strateg] System-prompt = narrativ (${NARRATIVE.length} tecken) + auto-genererat sifferblock ur spec/engine.js (${SYSTEM_PROMPT.length - NARRATIVE.length} tecken).`)
})
