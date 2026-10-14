// persist.js — Eco Loco (Mellan): session-persistens (fas 4-grund, server-sidan).
// Tappar motorns eventström (servern är auktoritativ) och skriver EN JSONL-rad per händelse
// till data/sessions/<sessionId>.jsonl + en härledd <sessionId>.summary.json.
//
// Fire-and-forget, EXAKT samma anda som riggPublish i server.js:
//   - fs.appendFile (icke-blockerande), fel → console.warn EN gång, aldrig krascha spel-loopen.
//   - data/ är gitignorerad (skapas vid behov).
//
// Radformat (oförändrade payloads):  { schema:1, sessionId, ts, type, payload }
// Startraden (type:'sessionStart') bär metadata: config-snapshot, gmMode, version, lag människa/bot.

import { appendFile, writeFile, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Tidsstämpel-id, ex: 2026-10-14T15-30-00  (ISO utan millisekunder/Z, ':' → '-').
function makeSessionId(d = new Date()) {
  return d.toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '-');
}

// root = projektroten (där data/ ska ligga). meta = { config, gmMode, version, claims }.
// claims = serverns claims-objekt (teamId → ws | 'bot' | null) — vi härleder människa/bot ur det.
export function newSession(root, { config, gmMode = false, version = 'A', claims = {} } = {}) {
  const sessionId = makeSessionId();
  const dir = join(root, 'data', 'sessions');
  const file = join(dir, `${sessionId}.jsonl`);
  const summaryFile = join(dir, `${sessionId}.summary.json`);
  let warned = false;

  try { mkdirSync(dir, { recursive: true }); }
  catch (e) { console.warn(`[persist] kunde inte skapa ${dir} (${e.code || e.message}) — loggning avstängd denna session`); }

  // En JSONL-rad, fire-and-forget. Fel loggas en gång och sväljs — spelet får ALDRIG hänga/krascha på detta.
  const logEvent = (type, payload) => {
    let line;
    try { line = JSON.stringify({ schema: 1, sessionId, ts: Date.now(), type, payload }) + '\n'; }
    catch { return; }   // ocirkulerbar payload → hoppa raden hellre än att krascha
    appendFile(file, line, err => {
      if (err && !warned) {
        warned = true;
        console.warn(`[persist] skrivning misslyckades (${err.code || err.message}) — ${file} blir ofullständig`);
      }
    });
  };

  // ——— Ackumulatorer för summaryn (det som inte går att läsa ur slutgiltigt motortillstånd) ———
  const ohPerRound = [];     // [{round, oh}]
  const events = [];         // [{round, id, rubrik, oh, traffade}]  — händelser som slog
  const gmDecisions = [];    // [{round, event, beslut}]             — spelledarens ja/nej på händelseförslag
  const podium = {};         // questionId → {fraga, counts:{option:n}, n}  — podie-fördelning per fråga

  // Startrad med metadata.
  logEvent('sessionStart', {
    config,
    gmMode: !!gmMode,
    version,
    teams: Object.fromEntries(Object.keys(claims).map(id =>
      [id, claims[id] && claims[id] !== 'bot' && claims[id].readyState === 1 ? 'human' : 'bot'])),
  });

  return {
    sessionId, file, summaryFile,
    logEvent,
    noteOhRound(round, oh) { ohPerRound.push({ round, oh }); },
    noteEvent(round, p) { events.push({ round, id: p.id, rubrik: p.rubrik, oh: p.oh || 0, traffade: p.traffade || [] }); },
    noteGmDecision(round, eventId, beslut) { gmDecisions.push({ round, event: eventId, beslut }); },
    notePodium(questionId, fraga, counts, n) { podium[questionId] = { fraga, counts, n }; },

    // Skriv/uppdatera summary.json (fire-and-forget). Anropas vid gameEnd OCH vid slutet av slutdelen.
    // state = engine.getState() (slutgiltigt), gameEnd = motorns gameEnd-payload (eller null).
    writeSummary(state, gameEnd) {
      const summary = {
        schema: 1, sessionId, version, gmMode: !!gmMode,
        ohPerRound,
        slutOhalsa: (gameEnd && gameEnd.oh != null) ? gameEnd.oh : (state ? state.oh : null),
        won: gameEnd ? gameEnd.won : null,
        reason: gameEnd ? (gameEnd.reason || null) : null,
        teams: (state && state.teams ? state.teams : []).map(t => ({
          id: t.id, namn: t.namn,
          kapital: t.pengar + t.material,   // kapital = pengar + material
          impactNeg: t.impactNeg,
          built: t.built,
        })),
        events,
        gmDecisions,
        podium,
      };
      let json;
      try { json = JSON.stringify(summary, null, 2); } catch { return summary; }
      writeFile(summaryFile, json, err => {
        if (err) console.warn(`[persist] summary-skrivning misslyckades (${err.code || err.message}) — ${summaryFile}`);
      });
      return summary;
    },
  };
}
