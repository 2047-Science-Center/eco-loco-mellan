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

app.listen(PORT, () => {
  console.log(`[strateg] Maktspelet-coach igång på http://localhost:${PORT}  (modell: ${MODEL}, keyed: ${Boolean(openai)})`)
  console.log(`[strateg] System-prompt = narrativ (${NARRATIVE.length} tecken) + auto-genererat sifferblock ur spec/engine.js (${SYSTEM_PROMPT.length - NARRATIVE.length} tecken).`)
})
